// PRUEBAS DE INTEGRACIÓN: los adaptadores reales (OsvClient y RegistryClient sobre
// HTTP) + la caché persistente en SQLite (Database) + el motor scanProject,
// ensamblados de verdad. Solo se reemplaza internet por un servidor HTTP local
// que imita la API de OSV y los registros npm/PyPI.
import { createServer, type IncomingMessage, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  OsvClient,
  RegistryClient,
  readProjectDirectory,
  scanProject,
  type OsvVulnerability,
} from "@depscan/core";
import { Database } from "../src/db.js";

const LODASH: OsvVulnerability = {
  id: "GHSA-int-lodash",
  aliases: ["CVE-2021-23337"],
  summary: "Inyección de comandos en lodash.template",
  database_specific: { severity: "HIGH", cwe_ids: ["CWE-77"] },
  affected: [
    {
      package: { name: "lodash", ecosystem: "npm" },
      ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }],
    },
  ],
};

/** Contador de peticiones por ruta: permite verificar la caché. */
const hits: Record<string, number> = {};
let fallarProximoBatch = false;
let server: Server;
let base = "";

const leerCuerpo = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const ruta = (req.url ?? "").split("?")[0]!;
    const clave = ruta.startsWith("/v1/vulns/") ? "/v1/vulns" : ruta;
    hits[clave] = (hits[clave] ?? 0) + 1;
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json", "retry-after": "1" });
      res.end(JSON.stringify(body));
    };
    if (ruta === "/v1/querybatch") {
      if (fallarProximoBatch) {
        fallarProximoBatch = false;
        return json(503, { error: "temporalmente no disponible" });
      }
      const { queries } = JSON.parse(await leerCuerpo(req));
      return json(200, {
        results: queries.map((q: { package: { name: string }; version: string }) =>
          q.package.name === "lodash" && q.version !== "4.17.21" ? { vulns: [{ id: LODASH.id }] } : {},
        ),
      });
    }
    if (ruta === `/v1/vulns/${LODASH.id}`) return json(200, LODASH);
    if (ruta === "/v1/query") {
      const { package: p } = JSON.parse(await leerCuerpo(req));
      return json(200, { vulns: p.name === "lodash" ? [LODASH] : [] });
    }
    if (ruta === "/npm/lodash") {
      return json(200, { versions: { "4.17.15": {}, "4.17.20": {}, "4.17.21": {} } });
    }
    if (ruta.startsWith("/npm/")) return json(200, { versions: { "4.18.2": {} } });
    return json(404, {});
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  for (const k of Object.keys(hits)) delete hits[k];
});

/** fetch real, pero redirigiendo registry.npmjs.org al servidor local. */
const fetchLocal: typeof fetch = (input, init) =>
  fetch(String(input).replace("https://registry.npmjs.org/", `${base}/npm/`), init);

function fuentes(db: Database) {
  const cache = db.cache();
  return {
    osv: new OsvClient({ baseUrl: base, cache }),
    registry: new RegistryClient({ cache, fetchImpl: fetchLocal }),
  };
}

const PROYECTO = "tests/fixtures/proyecto-demo";

describe("Integración: escaneo con adaptadores HTTP reales + caché SQLite", () => {
  let dir = "";
  let db: Database;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "depscan-int-"));
    db = new Database(dir);
  });
  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("lee el proyecto del disco, consulta OSV por HTTP y propone la versión segura", async () => {
    const files = await readProjectDirectory(PROYECTO);
    expect([...files.keys()].sort()).toEqual(["package-lock.json", "package.json", "requirements.txt"]);

    const reporte = await scanProject(files, fuentes(db), { target: { name: "demo", source: "directory" } });
    const lodash = reporte.findings.find((f) => f.dependency.name === "lodash")!;
    expect(lodash.vulnerabilities.map((v) => v.id)).toEqual(["CVE-2021-23337"]);
    expect(lodash.remediation).toMatchObject({ status: "upgrade", recommended: "4.17.21", verified: true });
    expect(hits["/v1/querybatch"]).toBe(1); // todas las dependencias en UN solo lote
  });

  it("el segundo escaneo reutiliza la caché: no vuelve a pedir el detalle a OSV", async () => {
    const files = await readProjectDirectory(PROYECTO);
    await scanProject(files, fuentes(db), { target: { name: "demo", source: "directory" } });
    expect(hits["/v1/vulns"] ?? 0).toBe(0);
    expect(hits["/v1/query"] ?? 0).toBe(0);
    expect(hits["/npm/lodash"] ?? 0).toBe(0);
  });

  it("la caché sobrevive a cerrar y reabrir la base de datos", async () => {
    db.close();
    db = new Database(dir);
    const v = await fuentes(db).osv.getVulnerability(LODASH.id);
    expect(v?.id).toBe(LODASH.id);
    expect(hits["/v1/vulns"] ?? 0).toBe(0);
  });

  it("reintenta cuando OSV responde 503 y termina el escaneo", async () => {
    fallarProximoBatch = true;
    const files = await readProjectDirectory(PROYECTO);
    const reporte = await scanProject(files, fuentes(db), { target: { name: "demo", source: "directory" } });
    expect(hits["/v1/querybatch"]).toBe(2);
    expect(reporte.summary.vulnerableDependencies).toBeGreaterThanOrEqual(1);
  });

  it("guarda el reporte en SQLite y lo lista por dueño", async () => {
    const files = await readProjectDirectory(PROYECTO);
    const reporte = await scanProject(files, fuentes(db), { target: { name: "demo", source: "directory" } });
    db.saveScan({ ...reporte, id: "int-1" }, "anon:prueba", false);
    expect(db.getScan("int-1")?.report.target.name).toBe("demo");
    expect(db.listScans("anon:prueba", 10, 0).total).toBe(1);
    expect(db.listScans("anon:otro", 10, 0).total).toBe(0);
  });
});
