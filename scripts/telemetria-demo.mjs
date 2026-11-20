// Genera evidencia de telemetría reproducible para la presentación de calidad.
//
//   npm run build && node scripts/telemetria-demo.mjs [minutos=5]
//
// 1. Levanta DepScan completo (tests/support/servidor-pruebas.mjs: API + SQLite +
//    web, con OSV simulado) en un puerto libre.
// 2. Simula uso real durante N minutos: escaneos de 3 proyectos de ejemplo,
//    consultas de historial y salud, y peticiones inválidas (400/404).
// 3. Cada 10 s lee GET /api/metrics y guarda la muestra.
// 4. Escribe docs/presentacion/datos/telemetria-demo.json (muestras + snapshot
//    final con la serie por minuto) y /metrics en formato Prometheus.
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";

const MINUTOS = Number(process.argv[2] ?? 5);
const SALIDA = "docs/presentacion/datos";

const puerto = await new Promise((r) => {
  const s = createServer().listen(0, "127.0.0.1", () => {
    const { port } = s.address();
    s.close(() => r(port));
  });
});
const URL_BASE = `http://127.0.0.1:${puerto}`;
const servidor = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "tests/support/servidor-pruebas.mjs"], {
  env: { ...process.env, PORT: String(puerto), SCAN_RATE_LIMIT: "100000", LOG_LEVEL: "warn" },
  stdio: "inherit",
});

for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${URL_BASE}/api/health`)).ok) break;
  } catch {
    /* arrancando */
  }
  if (i > 100) throw new Error("el servidor no arrancó");
  await new Promise((r) => setTimeout(r, 150));
}

const proyecto = (dir) => ({
  name: dir,
  files: readdirSync(`tests/fixtures/${dir}`).map((path) => ({
    path,
    content: readFileSync(`tests/fixtures/${dir}/${path}`, "utf8"),
  })),
});
const PROYECTOS = ["proyecto-demo", "proyecto-seguro", "proyecto-python"].map(proyecto);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const muestras = [];
let cookie = "";
const fin = Date.now() + MINUTOS * 60_000;
let ciclo = 0;

const muestreo = setInterval(async () => {
  const m = await (await fetch(`${URL_BASE}/api/metrics`)).json();
  muestras.push({
    t: new Date().toISOString(),
    requests: m.http.requests,
    p95Ms: m.http.latencyMs.p95,
    scans: m.scans.total,
    errorRate: m.http.errorRate,
    sesiones: m.sessions.active,
    historial: m.history.scansStored,
  });
  process.stdout.write(`\r${muestras.length} muestras · ${m.http.requests} peticiones · ${m.scans.total} escaneos   `);
}, 10_000);

while (Date.now() < fin) {
  ciclo++;
  // La carga varía por minuto para que la serie muestre tendencia (picos y valles).
  const minuto = Math.floor((MINUTOS * 60_000 - (fin - Date.now())) / 60_000);
  const intensidad = [1, 3, 2, 4, 2, 3, 1][minuto % 7];
  for (let k = 0; k < intensidad; k++) {
    const p = PROYECTOS[(ciclo + k) % PROYECTOS.length];
    const res = await fetch(`${URL_BASE}/api/scans`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie && { cookie }) },
      body: JSON.stringify(p),
    });
    cookie ||= res.headers.get("set-cookie")?.split(";")[0] ?? "";
    await res.arrayBuffer();
  }
  await fetch(`${URL_BASE}/api/scans?limit=10`, { headers: { cookie } }).then((r) => r.arrayBuffer());
  await fetch(`${URL_BASE}/api/health`).then((r) => r.arrayBuffer());
  if (ciclo % 4 === 0) await fetch(`${URL_BASE}/api/scans`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  if (ciclo % 6 === 0) await fetch(`${URL_BASE}/api/no-existe`);
  await espera(2000);
}

clearInterval(muestreo);
const final = await (await fetch(`${URL_BASE}/api/metrics`)).json();
const prometheus = await (await fetch(`${URL_BASE}/metrics`)).text();
mkdirSync(SALIDA, { recursive: true });
writeFileSync(
  `${SALIDA}/telemetria-demo.json`,
  JSON.stringify({ generado: new Date().toISOString(), minutos: MINUTOS, muestras, final }, null, 2),
);
writeFileSync(`${SALIDA}/metrics-prometheus.txt`, prometheus);
console.log(`\nListo: ${SALIDA}/telemetria-demo.json (${muestras.length} muestras, ${final.scans.total} escaneos)`);
servidor.kill();
