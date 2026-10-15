// Genera site/index.html: panel de calidad de DepScan (cobertura + enlaces a
// SonarCloud/Snyk/Semgrep/Hadolint). Lee coverage/coverage-summary.json si existe.
import { readFileSync } from "node:fs";

const REPO = process.env.GITHUB_REPOSITORY ?? "Angelhc123/Dep_Test";
const [OWNER, NAME] = REPO.split("/");
const SONAR_KEY = process.env.SONAR_PROJECT_KEY || "Angelhc123_Dep_Test";

function readCoverageSummary() {
  try {
    const data = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8"));
    return data.total;
  } catch {
    return null;
  }
}

function pct(n) {
  return `${n.toFixed(2)}%`;
}

function coverageCard(total) {
  if (!total) {
    return `<p class="muted">Reporte de cobertura no disponible en esta build.</p>`;
  }
  const rows = ["statements", "branches", "functions", "lines"]
    .map((k) => {
      const v = total[k];
      const ok = v.pct >= 80 || (k === "branches" && v.pct >= 65);
      return `<tr><td>${k}</td><td class="${ok ? "ok" : "warn"}">${pct(v.pct)}</td><td>${v.covered}/${v.total}</td></tr>`;
    })
    .join("\n");
  return `<table class="cov"><thead><tr><th>Métrica</th><th>%</th><th>Cubierto/Total</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const total = readCoverageSummary();

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>DepScan · Panel de calidad</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; max-width: 880px; margin: 0 auto; padding: 32px 20px; line-height: 1.5; }
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #8884; padding-bottom: 4px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
  .card { border: 1px solid #8884; border-radius: 8px; padding: 14px 16px; flex: 1 1 220px; }
  .card a { text-decoration: none; font-weight: 600; }
  table.cov { border-collapse: collapse; width: 100%; }
  table.cov td, table.cov th { padding: 6px 10px; border-bottom: 1px solid #8884; text-align: left; }
  .ok { color: #1a7f37; font-weight: 600; }
  .warn { color: #b35900; font-weight: 600; }
  .muted { opacity: 0.7; }
  .badges img { margin: 2px; }
  code { background: #8882; padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
  <h1>DepScan · Panel de calidad</h1>
  <p class="muted">Generado automáticamente en cada push a <code>main</code>. Aplica al propio código de DepScan
  las prácticas de los laboratorios de calidad (SonarCloud, Snyk, Semgrep, análisis estático de infraestructura).</p>

  <div class="badges">
    <img src="https://github.com/${OWNER}/${NAME}/actions/workflows/ci.yml/badge.svg" alt="CI" />
    <img src="https://github.com/${OWNER}/${NAME}/actions/workflows/calidad.yml/badge.svg" alt="Calidad" />
    <img src="https://sonarcloud.io/api/project_badges/measure?project=${SONAR_KEY}&metric=alert_status" alt="SonarCloud Quality Gate" />
    <img src="https://sonarcloud.io/api/project_badges/measure?project=${SONAR_KEY}&metric=coverage" alt="SonarCloud Coverage" />
  </div>

  <h2>Cobertura de tests (vitest)</h2>
  ${coverageCard(total)}
  <p><a href="coverage/index.html">Ver reporte detallado de cobertura →</a></p>

  <h2>Escaneo de dependencias (dogfooding)</h2>
  <p>DepScan se analiza a sí mismo en cada CI. <a href="depscan-report.html">Ver último reporte →</a></p>

  <h2>Análisis estático (SonarCloud, Snyk, Semgrep, Hadolint)</h2>
  <div class="cards">
    <div class="card"><a href="https://sonarcloud.io/project/overview?id=${SONAR_KEY}">SonarCloud →</a><br/>Calidad de código y cobertura.</div>
    <div class="card"><a href="https://github.com/${OWNER}/${NAME}/security/code-scanning">GitHub Code Scanning →</a><br/>Hallazgos de Snyk, Semgrep y Hadolint (SARIF).</div>
    <div class="card"><a href="https://github.com/${OWNER}/${NAME}/actions/workflows/calidad.yml">Workflow de calidad →</a><br/>Historial de ejecuciones.</div>
  </div>
</body>
</html>
`;

process.stdout.write(html);
