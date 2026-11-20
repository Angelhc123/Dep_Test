// PRUEBAS DE SISTEMA: DepScan completo corriendo como proceso real (Fastify +
// SQLite en disco + web compilada) y probado solo por HTTP, como lo usaría un
// cliente. Las fuentes externas (OSV/registros) están simuladas para que el
// resultado sea reproducible.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarServidor, type Servidor } from "./servidor.js";

const leer = (dir: string, archivos: string[]) =>
  archivos.map((path) => ({ path, content: readFileSync(`tests/fixtures/${dir}/${path}`, "utf8") }));

const proyectoDemo = leer("proyecto-demo", ["package.json", "package-lock.json", "requirements.txt"]);
const proyectoSeguro = leer("proyecto-seguro", ["package.json"]);

let srv: Servidor;

const escanear = (body: unknown, cookie = "") =>
  fetch(`${srv.url}/api/scans`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  });

const cookieDe = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

beforeAll(async () => {
  srv = await iniciarServidor();
});
afterAll(() => srv?.detener());

describe("Sistema: disponibilidad", () => {
  it("responde /api/health con la base de datos operativa", async () => {
    const res = await fetch(`${srv.url}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", db: true });
  });

  it("sirve la interfaz web y hace fallback de la SPA a index.html", async () => {
    for (const ruta of ["/", "/cualquier/ruta"]) {
      const res = await fetch(`${srv.url}${ruta}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('<div id="root">');
    }
  });

  it("agrega cabeceras de seguridad a todas las respuestas", async () => {
    const res = await fetch(`${srv.url}/api/health`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("same-origin");
  });
});

describe("Sistema: flujo completo de un escaneo", () => {
  let id = "";
  let cookie = "";

  it("escanea un proyecto npm + PyPI y detecta las 2 dependencias vulnerables", async () => {
    const res = await escanear({ name: "proyecto-demo", files: proyectoDemo });
    expect(res.status).toBe(201);
    cookie = cookieDe(res);
    expect(cookie).toMatch(/^depscan_sid=/);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);

    const reporte = await res.json();
    id = reporte.id;
    expect(reporte.summary).toMatchObject({
      dependencies: 3,
      vulnerableDependencies: 2,
      bySeverity: { critical: 1, high: 1 },
      risk: "red",
    });
  });

  it("propone una versión segura verificada para cada hallazgo", async () => {
    const reporte = await (await fetch(`${srv.url}/api/scans/${id}`, { headers: { cookie } })).json();
    const recomendadas = Object.fromEntries(
      reporte.findings.map((f: { dependency: { name: string }; remediation: { recommended: string } }) => [
        f.dependency.name,
        f.remediation.recommended,
      ]),
    );
    expect(recomendadas).toEqual({ lodash: "4.17.21", django: "3.2.19" });
    expect(reporte.mine).toBe(true);
  });

  it("guarda el escaneo en el historial de la sesión y no en el de otros", async () => {
    const mio = await (await fetch(`${srv.url}/api/scans`, { headers: { cookie } })).json();
    expect(mio.total).toBe(1);
    expect(mio.items[0].id).toBe(id);
    const ajeno = await (await fetch(`${srv.url}/api/scans`)).json();
    expect(ajeno.total).toBe(0);
  });

  it("exporta el reporte en HTML y PDF", async () => {
    const html = await fetch(`${srv.url}/api/scans/${id}/report.html`, { headers: { cookie } });
    expect(html.headers.get("content-type")).toMatch(/text\/html/);
    expect(await html.text()).toContain("4.17.21");

    const pdf = await fetch(`${srv.url}/api/scans/${id}/report.pdf`, { headers: { cookie } });
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("solo el dueño puede borrar el escaneo", async () => {
    expect((await fetch(`${srv.url}/api/scans/${id}`, { method: "DELETE" })).status).toBe(404);
    const res = await fetch(`${srv.url}/api/scans/${id}`, { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(204);
    expect((await fetch(`${srv.url}/api/scans/${id}`)).status).toBe(404);
  });

  it("un proyecto sin vulnerabilidades queda en verde", async () => {
    const reporte = await (await escanear({ name: "seguro", files: proyectoSeguro })).json();
    expect(reporte.summary).toMatchObject({ vulnerableDependencies: 0, risk: "green" });
  });
});

describe("Sistema: validación de entradas", () => {
  it.each([
    ["sin archivos ni repo", {}, 400],
    ["repositorio mal escrito", { github: "no es un repo" }, 400],
    ["archivos que no son manifiestos", { files: [{ path: "README.md", content: "hola" }] }, 422],
  ])("rechaza %s", async (_caso, body, status) => {
    const res = await escanear(body);
    expect(res.status).toBe(status);
    expect(await res.json()).toHaveProperty("error");
  });

  it("descarta campos desconocidos del cuerpo en lugar de procesarlos", async () => {
    const res = await escanear({ files: proyectoSeguro, admin: true, options: { estimate: false } });
    expect(res.status).toBe(201);
    expect(await res.json()).not.toHaveProperty("admin");
  });

  it("devuelve 404 JSON en rutas de API inexistentes", async () => {
    const res = await fetch(`${srv.url}/api/no-existe`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Ruta no encontrada" });
  });
});

describe("Sistema: persistencia y límites", () => {
  it("el historial sobrevive a un reinicio del servidor (SQLite en disco)", async () => {
    const res = await escanear({ name: "persistente", files: proyectoSeguro });
    const cookie = cookieDe(res);
    const { id } = await res.json();
    await srv.detener();

    srv = await iniciarServidor({ DATA_DIR: srv.dataDir });
    const lista = await (await fetch(`${srv.url}/api/scans`, { headers: { cookie } })).json();
    expect(lista.items.map((s: { id: string }) => s.id)).toContain(id);
  });

  it("limita los escaneos por IP (rate limit → 429)", async () => {
    const limitado = await iniciarServidor({ SCAN_RATE_LIMIT: "2" });
    try {
      const estados = [];
      for (let i = 0; i < 3; i++) estados.push((await fetch(`${limitado.url}/api/scans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: proyectoSeguro }),
      })).status);
      expect(estados).toEqual([201, 201, 429]);
    } finally {
      await limitado.detener();
    }
  });

  it("registra cada petición en el log estructurado (JSON)", () => {
    const lineas = srv.logs.join("").split("\n").filter((l) => l.startsWith("{"));
    const peticiones = lineas.map((l) => JSON.parse(l)).filter((l) => l.req?.url);
    expect(peticiones.length).toBeGreaterThan(0);
    expect(peticiones[0]).toHaveProperty("reqId");
  });
});
