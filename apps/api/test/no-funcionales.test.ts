// PRUEBAS DE ASPECTOS NO FUNCIONALES (integración): telemetría, logs,
// sesiones, historial y caché, verificados sobre la API ensamblada de verdad.
import { Writable } from "node:stream";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { MemoryCache, type OsvVulnerability, type VulnSource } from "@depscan/core";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { Database } from "../src/db.js";
import { Telemetry, toPrometheus } from "../src/telemetry.js";

const vuln: OsvVulnerability = {
  id: "GHSA-nf-lodash",
  aliases: ["CVE-2021-23337"],
  summary: "Falla de prueba",
  database_specific: { severity: "HIGH" },
  affected: [
    {
      package: { name: "lodash", ecosystem: "npm" },
      ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }],
    },
  ],
};
const osv: VulnSource = {
  queryBatch: async (qs) => qs.map((q) => (q.name === "lodash" && q.version !== "4.17.21" ? [vuln.id] : [])),
  getVulnerability: async (id) => (id === vuln.id ? vuln : null),
  queryPackage: async (name) => (name === "lodash" ? [vuln] : []),
};

const pkg = (version: string) => [
  { path: "package.json", content: JSON.stringify({ dependencies: { lodash: version } }) },
];

/** Captura cada línea JSON que escribe el logger (pino). */
const logs: Record<string, unknown>[] = [];
const sink = new Writable({
  write(chunk, _enc, cb) {
    for (const line of String(chunk).split("\n").filter(Boolean)) logs.push(JSON.parse(line));
    cb();
  },
});

let app: FastifyInstance;
const cookieOf = (res: LightMyRequestResponse) => {
  const c = res.cookies.find((x) => x.name === "depscan_sid");
  return c ? `depscan_sid=${c.value}` : "";
};
const escanear = (version: string, cookie = "") =>
  app.inject({
    method: "POST",
    url: "/api/scans",
    payload: { name: "nf", files: pkg(version) },
    headers: cookie ? { cookie } : {},
  });

beforeAll(async () => {
  app = await buildApp({
    config: {
      ...loadConfig({}),
      dataDir: ":memory:",
      webDist: "/no-existe",
      logLevel: "info",
      sessionSecret: "secreto-de-prueba",
    },
    sources: { osv, registry: { listVersions: async () => ["4.17.15", "4.17.21"] } },
    logStream: sink,
  });
});
afterAll(() => app.close());

describe("Telemetría", () => {
  it("/api/metrics cuenta peticiones, escaneos por semáforo, sesiones e historial", async () => {
    const a = await escanear("4.17.15");
    await escanear("4.17.21", cookieOf(a));
    await app.inject("/api/no-existe");

    const m = (await app.inject("/api/metrics")).json();
    expect(m.scans).toMatchObject({
      total: 2,
      failed: 0,
      byRisk: { red: 1, green: 1 },
      bySource: { upload: 2 },
    });
    expect(m.scans.vulnerableDependencies).toBe(1);
    expect(m.http.requests).toBeGreaterThanOrEqual(3);
    expect(m.http.byStatus["4xx"]).toBeGreaterThanOrEqual(1);
    expect(m.http.routes.find((r: { route: string }) => r.route === "POST /api/scans").count).toBe(2);
    expect(m.sessions.active).toBe(1); // los dos escaneos comparten la misma sesión
    expect(m.history.scansStored).toBe(2);
    expect(m.http.latencyMs.p95).toBeGreaterThan(0);
    expect(m.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("/metrics expone el formato de texto de Prometheus", async () => {
    const res = await app.inject("/metrics");
    expect(res.headers["content-type"]).toMatch(/^text\/plain; version=0\.0\.4/);
    expect(res.body).toContain("# TYPE depscan_scans_total counter");
    expect(res.body).toMatch(/depscan_scans_by_risk_total\{risk="red"\} 1/);
    expect(res.body).toMatch(/depscan_history_scans_stored \d+/);
  });

  it("con METRICS_TOKEN las métricas exigen Bearer token", async () => {
    const protegida = await buildApp({
      config: {
        ...loadConfig({ METRICS_TOKEN: "t0k3n" }),
        dataDir: ":memory:",
        webDist: "/no-existe",
        logLevel: "silent",
      },
      sources: { osv },
    });
    expect((await protegida.inject("/api/metrics")).statusCode).toBe(401);
    expect((await protegida.inject("/metrics")).statusCode).toBe(401);
    const ok = await protegida.inject({ url: "/api/metrics", headers: { authorization: "Bearer t0k3n" } });
    expect(ok.statusCode).toBe(200);
    await protegida.close();
  });

  it("arma una serie por minuto de la última hora para los gráficos", () => {
    let ahora = Date.parse("2026-11-20T10:00:10Z");
    const t = new Telemetry("test", () => ahora);
    t.recordRequest("GET", "/api/health", 200, 10);
    t.recordRequest("POST", "/api/scans", 500, 30);
    ahora += 2 * 60_000; // dos minutos después
    t.recordRequest("GET", "/api/health", 200, 20);
    t.recordScan({
      source: "upload",
      risk: "red",
      dependencies: 3,
      vulnerableDependencies: 1,
      durationMs: 50,
    });
    const vacio = { activeSessions: 0, loggedInSessions: 0, users: 0, scansStored: 0, cacheEntries: 0 };
    const serie = t.snapshot(vacio).series;
    expect(serie.map((p) => p.t)).toEqual([
      "2026-11-20T10:00:00.000Z",
      "2026-11-20T10:01:00.000Z",
      "2026-11-20T10:02:00.000Z",
    ]);
    expect(serie[0]).toMatchObject({ requests: 2, errors5xx: 1, scans: 0, p95Ms: 30 });
    expect(serie[1]).toMatchObject({ requests: 0, scans: 0, cacheHitRate: null });
    expect(serie[2]).toMatchObject({ requests: 1, scans: 1, p95Ms: 20 });

    ahora += 90 * 60_000; // hora y media después: solo queda la última hora
    t.recordRequest("GET", "/api/health", 200, 5);
    const reciente = t.snapshot(vacio).series;
    expect(reciente).toHaveLength(60);
    expect(reciente.at(-1)!.requests).toBe(1);
    expect(reciente.slice(0, -1).every((p) => p.requests === 0)).toBe(true);
  });

  it("la caché instrumentada mide aciertos, fallos y tasa de aciertos", async () => {
    const t = new Telemetry("test");
    const cache = t.instrumentCache(new MemoryCache());
    await cache.get("k"); // fallo
    await cache.set("k", "v", 60);
    await cache.get("k"); // acierto
    await cache.get("k"); // acierto
    const m = t.snapshot({
      activeSessions: 0,
      loggedInSessions: 0,
      users: 0,
      scansStored: 0,
      cacheEntries: 1,
    });
    expect(m.cache).toEqual({ hits: 2, misses: 1, writes: 1, hitRate: 66.7, entries: 1 });
    expect(toPrometheus(m)).toContain("depscan_cache_hits_total 2");
  });
});

describe("Logs", () => {
  it("cada respuesta lleva X-Request-Id y el mismo id aparece en el log", async () => {
    const res = await app.inject({ url: "/api/health", headers: { "x-request-id": "demo-123" } });
    expect(res.headers["x-request-id"]).toBe("demo-123");
    expect(logs.some((l) => l.reqId === "demo-123")).toBe(true);
  });

  it("ignora un X-Request-Id inseguro y genera un UUID", async () => {
    const res = await app.inject({ url: "/api/health", headers: { "x-request-id": "<script>" } });
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("registra un evento estructurado por escaneo (event=scan)", async () => {
    await escanear("4.17.15");
    const ev = logs.filter((l) => l.event === "scan").at(-1)!;
    expect(ev).toMatchObject({
      msg: "escaneo completado",
      source: "upload",
      owner: "anon",
      risk: "red",
      vulnerable: 1,
    });
    expect(ev).toHaveProperty("scanId");
    expect(ev).toHaveProperty("durationMs");
  });

  it("nunca escribe cookies de sesión en los logs", async () => {
    const a = await escanear("4.17.15");
    await app.inject({ url: "/api/scans", headers: { cookie: cookieOf(a) } });
    const valor = cookieOf(a).split("=")[1]!;
    expect(JSON.stringify(logs)).not.toContain(valor);
  });
});

describe("Sesiones", () => {
  it("la cookie de sesión es HttpOnly, SameSite=Lax y dura 30 días", async () => {
    const res = await escanear("4.17.21");
    const c = res.cookies.find((x) => x.name === "depscan_sid")!;
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe("Lax");
    expect(c.maxAge).toBe(30 * 24 * 3600);
  });

  it("una cookie inventada no da acceso a ningún historial", async () => {
    const res = await app.inject({ url: "/api/scans", headers: { cookie: "depscan_sid=falsa" } });
    expect(res.json().total).toBe(0);
  });

  it("las sesiones y la caché vencidas se purgan", () => {
    const db = new Database(mkdtempSync(join(tmpdir(), "depscan-nf-")));
    db.createSession("vencida", null, -1000);
    db.createSession("vigente", null, 60_000);
    void db.cache().set("viejo", "x", -1);
    expect(db.stats().activeSessions).toBe(1);
    db.purgeExpired();
    expect(db.getSession("vencida")).toBeNull();
    expect(db.getSession("vigente")).not.toBeNull();
    expect(db.stats().cacheEntries).toBe(0);
    db.close();
  });
});

describe("Historial", () => {
  it("pagina los escaneos del más reciente al más antiguo", async () => {
    const primero = await escanear("4.17.15");
    const cookie = cookieOf(primero);
    for (let i = 0; i < 4; i++) await escanear("4.17.21", cookie);
    const pag1 = (await app.inject({ url: "/api/scans?limit=2&offset=0", headers: { cookie } })).json();
    const pag3 = (await app.inject({ url: "/api/scans?limit=2&offset=4", headers: { cookie } })).json();
    expect(pag1.total).toBe(5);
    expect(pag1.items).toHaveLength(2);
    expect(pag3.items).toHaveLength(1);
    expect(pag3.items[0].id).toBe(primero.json().id); // el más antiguo queda al final
  });

  it("rechaza límites de paginación fuera de rango", async () => {
    expect((await app.inject("/api/scans?limit=1000")).statusCode).toBe(400);
  });
});
