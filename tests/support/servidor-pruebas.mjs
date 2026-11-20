// Levanta DepScan completo (API Fastify + SQLite + interfaz web compilada) igual
// que en producción, pero con OSV y los registros simulados. Lo usan las pruebas
// de sistema, de interfaz (Playwright) y de aceptación (BDD).
//
//   npm run build && node tests/support/servidor-pruebas.mjs   → http://127.0.0.1:4321
//
// Variables: PORT (4321), DATA_DIR (carpeta temporal nueva), SCAN_RATE_LIMIT (20).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../../apps/api/dist/app.js";
import { loadConfig } from "../../apps/api/dist/config.js";
import { fuentesSimuladas } from "./datos-prueba.mjs";

const port = Number(process.env.PORT ?? 4321);
const config = {
  ...loadConfig({}),
  port,
  host: "127.0.0.1",
  dataDir: process.env.DATA_DIR ?? mkdtempSync(join(tmpdir(), "depscan-e2e-")),
  webDist: fileURLToPath(new URL("../../apps/web/dist", import.meta.url)),
  scanRateLimit: Number(process.env.SCAN_RATE_LIMIT ?? 20),
  logLevel: process.env.LOG_LEVEL ?? "warn",
  sessionSecret: "secreto-solo-para-pruebas",
};

const app = await buildApp({ config, sources: fuentesSimuladas });
await app.listen({ port, host: config.host });
console.log(`servidor de pruebas listo en http://127.0.0.1:${port} (datos: ${config.dataDir})`);

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => app.close().then(() => process.exit(0)));
}
