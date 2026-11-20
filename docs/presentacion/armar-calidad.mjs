// Arma fuente-calidad.html: toma el estilo y la navegación de fuente.html, inserta las
// diapositivas de slides-calidad.html y rellena {{TEL:…}} con los datos reales de
// datos/telemetria-demo.json y datos/metrics-produccion.txt. Luego: node build.js
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const leer = (f) => readFileSync(join(dir, f), "utf8");
const base = leer("fuente.html");
const inicio = base.indexOf('<div id="stage">') + '<div id="stage">'.length;
const fin = base.indexOf('<div id="bar">');
const cabeza = base
  .slice(0, inicio)
  .replace("<title>DepScan · Presentación</title>", "<title>DepScan · Calidad y pruebas</title>")
  .replace(
    "@media print {",
    `pre.gherkin, pre.prom { font-family: "JetBrains Mono", ui-monospace, monospace; background: var(--code); border-radius: 10px; padding: 14px 16px; white-space: pre; overflow: hidden; }
pre.gherkin { font-size: 13px; line-height: 1.55; }
pre.prom { font-size: 11px; line-height: 1.45; padding: 8px 10px; margin-top: 4px; }
pre.gherkin .kw { color: var(--accent); font-weight: 700; }
ol.steps { padding-left: 22px; display: grid; gap: 8px; }
.slide .body img.shot { max-height: 500px; object-fit: cover; object-position: top; }
ol.steps li { font-size: 15px; line-height: 1.45; }

@media print {`,
  );
const cola = "\n</div>\n\n" + base.slice(fin);

const tel = JSON.parse(leer("datos/telemetria-demo.json"));
const f = tel.final;
const resumen =
  `${f.http.requests} peticiones · ${f.scans.total} escaneos (${f.scans.byRisk.red ?? 0} en rojo, ${f.scans.byRisk.green ?? 0} en verde) · ` +
  `latencia p95 ${f.http.latencyMs.p95} ms · ${f.http.errorRate} % de errores 5xx · ` +
  `generado con scripts/telemetria-demo.mjs el ${new Date(tel.generado).toLocaleString("es-PE", { timeZone: "America/Lima" })}`;
const prom = leer("datos/metrics-produccion.txt")
  .split("\n")
  .filter((l) => /^depscan_(uptime|memory|history|sessions_active|http_responses)/.test(l))
  .slice(0, 7)
  .join("\n")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;");

const slides = leer("slides-calidad.html")
  .replace("{{TEL:resumen}}", resumen)
  .replace("{{TEL:prometheus}}", prom);

writeFileSync(join(dir, "fuente-calidad.html"), cabeza + "\n" + slides + cola);
console.log("fuente-calidad.html armado");
