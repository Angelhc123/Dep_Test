// Genera site/index.html: panel de pruebas y calidad de DepScan publicado en
// GitHub Pages. Lee los resultados con scripts/resumen-pruebas.mjs (JUnit,
// Stryker y cobertura) y enlaza cada reporte HTML y el análisis estático.
import { resumen } from "./resumen-pruebas.mjs";

const REPO = process.env.GITHUB_REPOSITORY ?? "Angelhc123/Dep_Test";
const [OWNER, NAME] = REPO.split("/");
const SONAR_KEY = process.env.SONAR_PROJECT_KEY || "Angelhc123_Dep_Test";
const GH = `https://github.com/${OWNER}/${NAME}`;
const RUN = process.env.GITHUB_RUN_ID ? `${GH}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;

const r = resumen();
const suite = (id) => r.suites.find((s) => s.id === id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function estado(s) {
  if (!s || s.total === null) return { clase: "na", texto: "sin datos", valor: "—" };
  const ok = s.total - s.fallidas - s.omitidas;
  return s.fallidas
    ? { clase: "mal", texto: `${s.fallidas} fallidas`, valor: `${ok}/${s.total}` }
    : { clase: "bien", texto: "todas superadas", valor: `${ok}/${s.total}` };
}

const FILAS = [
  {
    id: "unitarias",
    tipo: "Unitarias",
    herramienta: "Vitest",
    que: "Parsers npm/PyPI, comparación de versiones semver y PEP 440, CVSS, análisis y remediación, con dobles de prueba.",
    enlace: "unitarias/index.html",
  },
  {
    id: "integracion",
    tipo: "Integración",
    herramienta: "Vitest + Fastify inject",
    que: "API + SQLite + sesiones/OAuth ensamblados; clientes HTTP reales de OSV y registros con caché SQLite, reintentos ante 503.",
    enlace: "unitarias/index.html",
  },
  {
    id: "sistema",
    tipo: "Sistema",
    herramienta: "Vitest + servidor real",
    que: "DepScan compilado y corriendo como proceso: flujo completo por HTTP, persistencia tras reinicio, rate limit, logs y CLI.",
    enlace: "sistema/index.html",
  },
  {
    id: "ui",
    tipo: "Interfaz de usuario",
    herramienta: "Playwright",
    que: "Chromium real en escritorio y móvil: subir archivos, ver hallazgos y solución, filtrar, descargar, historial. Con video y traza.",
    enlace: "ui/index.html",
  },
  {
    id: "aceptacion",
    tipo: "Aceptación (BDD)",
    herramienta: "Gherkin + playwright-bdd",
    que: "Historias en español por caso de uso del FD03 (CU-01, CU-04, CU-05, CU-08) y telemetría, ejecutadas en el navegador.",
    enlace: "aceptacion/index.html",
  },
  {
    id: "vscode",
    tipo: "Extensión VS Code (e2e)",
    herramienta: "@vscode/test-electron",
    que: "VS Code real con la extensión: subrayado, hover, Quick Fix, reescaneo al guardar y skills del agente @depscan.",
    enlace: "extension/",
  },
];

const filas = FILAS.map((f) => {
  const e = estado(suite(f.id));
  return `<tr>
    <td><strong>${f.tipo}</strong><div class="sub">${f.herramienta}</div></td>
    <td>${f.que}</td>
    <td class="num"><span class="pill ${e.clase}">${e.valor}</span><div class="sub">${e.texto}</div></td>
    <td><a href="${f.enlace}">Ver reporte →</a></td>
  </tr>`;
}).join("\n");

const m = r.mutacion;
const filaMutacion = `<tr>
    <td><strong>Mutación</strong><div class="sub">Stryker</div></td>
    <td>Altera el código del core (operadores, condiciones, regex) y comprueba que alguna prueba lo detecte. Mide la calidad de las pruebas, no solo cuánto código ejecutan.</td>
    <td class="num">${
      m
        ? `<span class="pill ${m.puntaje >= 70 ? "bien" : m.puntaje >= 50 ? "medio" : "mal"}">${m.puntaje.toFixed(1)} %</span><div class="sub">${m.eliminados} de ${m.mutantes} mutantes eliminados</div>`
        : `<span class="pill na">—</span><div class="sub">sin datos</div>`
    }</td>
    <td><a href="mutacion/index.html">Ver reporte →</a></td>
  </tr>`;

const c = r.cobertura;
const totalPruebas = r.suites.reduce((n, s) => n + (s.total ?? 0), 0);
const totalFallidas = r.suites.reduce((n, s) => n + (s.fallidas ?? 0), 0);

const tile = (valor, etiqueta, clase = "") =>
  `<div class="tile ${clase}"><div class="v">${valor}</div><div class="l">${etiqueta}</div></div>`;

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>DepScan · Pruebas y calidad</title>
<style>
  :root { --bg:#f7f7f5; --card:#fff; --tx:#1b1b1f; --mu:#62626b; --bd:#e3e3df; --ac:#2457d6;
          --ok:#16794a; --okbg:#e3f4ea; --md:#9a6300; --mdbg:#fdf1d8; --ko:#b3261e; --kobg:#fbe4e2; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#141417; --card:#1d1d22; --tx:#ececf1; --mu:#a1a1ab; --bd:#2e2e35; --ac:#7aa2ff;
            --ok:#6fd49b; --okbg:#173326; --md:#f2c46b; --mdbg:#3a2e14; --ko:#ff8a80; --kobg:#3d1a18; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--tx); font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:1080px; margin:0 auto; padding:32px 16px 64px; }
  h1 { font-size:1.75rem; margin:0 0 4px; letter-spacing:-.01em; }
  h2 { font-size:1.1rem; margin:40px 0 12px; }
  a { color:var(--ac); }
  .mu, .sub { color:var(--mu); }
  .sub { font-size:.82rem; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-top:24px; }
  .tile { background:var(--card); border:1px solid var(--bd); border-radius:12px; padding:14px 16px; }
  .tile .v { font-size:1.6rem; font-weight:700; font-variant-numeric:tabular-nums; }
  .tile .l { color:var(--mu); font-size:.85rem; }
  .tile.bien .v { color:var(--ok); } .tile.mal .v { color:var(--ko); } .tile.medio .v { color:var(--md); }
  .wrap { overflow-x:auto; background:var(--card); border:1px solid var(--bd); border-radius:12px; }
  table { border-collapse:collapse; width:100%; min-width:720px; }
  th, td { text-align:left; padding:12px 14px; border-bottom:1px solid var(--bd); vertical-align:top; }
  tr:last-child td { border-bottom:0; }
  th { font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; color:var(--mu); font-weight:600; }
  td.num, td:last-child { white-space:nowrap; }
  .pill { display:inline-block; padding:2px 10px; border-radius:999px; font-weight:700; font-variant-numeric:tabular-nums; }
  .pill.bien { background:var(--okbg); color:var(--ok); } .pill.mal { background:var(--kobg); color:var(--ko); }
  .pill.medio { background:var(--mdbg); color:var(--md); } .pill.na { background:var(--bd); color:var(--mu); }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
  .card { background:var(--card); border:1px solid var(--bd); border-radius:12px; padding:14px 16px; }
  .card a { font-weight:600; text-decoration:none; }
  .badges img { margin:2px 4px 2px 0; vertical-align:middle; }
  pre { background:var(--card); border:1px solid var(--bd); border-radius:12px; padding:14px 16px; overflow-x:auto; font-size:.85rem; }
  footer { margin-top:48px; font-size:.82rem; color:var(--mu); }
</style>
</head>
<body>
<main>
  <h1>DepScan · Pruebas y calidad</h1>
  <p class="mu">Generado automáticamente por GitHub Actions en cada push a <code>main</code>.
  ${r.commit ? `Commit <a href="${GH}/commit/${r.commit}"><code>${r.commit.slice(0, 7)}</code></a> · ` : ""}
  ${esc(new Date(r.generado).toLocaleString("es-PE", { timeZone: "America/Lima" }))}
  ${RUN ? ` · <a href="${RUN}">ver ejecución</a>` : ""}</p>

  <div class="tiles">
    ${tile(totalPruebas, "pruebas automatizadas", totalFallidas ? "mal" : "bien")}
    ${tile(totalFallidas, "fallidas", totalFallidas ? "mal" : "bien")}
    ${c ? tile(`${c.lines.toFixed(1)} %`, "cobertura de líneas", c.lines >= 80 ? "bien" : "medio") : ""}
    ${c ? tile(`${c.branches.toFixed(1)} %`, "cobertura de ramas", c.branches >= 65 ? "bien" : "medio") : ""}
    ${m ? tile(`${m.puntaje.toFixed(1)} %`, "puntaje de mutación", m.puntaje >= 70 ? "bien" : m.puntaje >= 50 ? "medio" : "mal") : ""}
  </div>

  <h2>Pruebas automatizadas</h2>
  <div class="wrap"><table>
    <thead><tr><th>Tipo</th><th>Qué verifica</th><th>Resultado</th><th>Reporte</th></tr></thead>
    <tbody>
${filas}
${filaMutacion}
    </tbody>
  </table></div>
  <p class="sub">Cobertura detallada por archivo: <a href="cobertura/index.html">reporte de cobertura (v8)</a>.
  Las pruebas de sistema, UI y aceptación usan OSV y los registros simulados (<code>tests/support</code>) para ser reproducibles.</p>

  <h2>Análisis estático</h2>
  <div class="badges">
    <img src="${GH}/actions/workflows/pruebas.yml/badge.svg" alt="Pruebas" />
    <img src="${GH}/actions/workflows/calidad.yml/badge.svg" alt="Calidad" />
    <img src="${GH}/actions/workflows/ci.yml/badge.svg" alt="CI" />
    <img src="https://sonarcloud.io/api/project_badges/measure?project=${SONAR_KEY}&metric=alert_status" alt="SonarCloud Quality Gate" />
  </div>
  <div class="cards" style="margin-top:12px">
    <div class="card"><a href="https://sonarcloud.io/project/overview?id=${SONAR_KEY}">SonarCloud →</a><div class="sub">Bugs, code smells, duplicación y cobertura.</div></div>
    <div class="card"><a href="${GH}/security/code-scanning?query=tool%3ASemgrep">Semgrep →</a><div class="sub">SAST con reglas de la comunidad (SARIF).</div></div>
    <div class="card"><a href="${GH}/security/code-scanning?query=tool%3ASnyk">Snyk →</a><div class="sub">SAST (Snyk Code) y dependencias (Snyk Open Source).</div></div>
    <div class="card"><a href="${GH}/actions/workflows/calidad.yml">Workflow Calidad →</a><div class="sub">Sonar, Snyk, Semgrep y Hadolint en cada push.</div></div>
    <div class="card"><a href="${GH}/blob/main/docs/NO_FUNCIONALES.md">Aspectos no funcionales →</a><div class="sub">Sesiones, historial, caché, logs y telemetría.</div></div>
    <div class="card"><a href="depscan-report.html">DepScan sobre sí mismo →</a><div class="sub">Dependencias del propio proyecto.</div></div>
  </div>

  <h2>Reproducir en local</h2>
  <pre>npm ci && npm run build
npx playwright install chromium
npm run test:unit          # unitarias
npm run test:integration   # integración
npm run test:system        # sistema
npm run test:mutation      # mutación (≈5 min)
npm run test:ui            # interfaz de usuario
npm run test:acceptance    # aceptación BDD</pre>

  <footer>DepScan · Angel Gadiel Hernández Cruz · Richard Alexis Podestá Condori · Gustavo Alonso Sagua Ramos · <a href="${GH}">${esc(REPO)}</a></footer>
</main>
</body>
</html>
`;

process.stdout.write(html);
