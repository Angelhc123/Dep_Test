// Resume los resultados de todas las pruebas automatizadas a partir de los
// reportes que deja cada herramienta (JUnit XML, Stryker JSON, cobertura v8).
//
//   node scripts/resumen-pruebas.mjs            → tabla Markdown (para $GITHUB_STEP_SUMMARY)
//   node scripts/resumen-pruebas.mjs --json     → JSON (lo usa scripts/pages-index.js)
//
// Rutas por defecto: reports/junit/*.xml, reports/mutation/mutation.json,
// coverage/coverage-summary.json. Se puede cambiar la raíz con REPORTS_DIR.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.env.REPORTS_DIR ?? ".";

const SUITES = [
  { id: "unitarias", nombre: "Unitarias", junit: "reports/junit/vitest.xml", filtro: "unitarias" },
  { id: "integracion", nombre: "Integración", junit: "reports/junit/vitest.xml", filtro: "integracion" },
  { id: "sistema", nombre: "Sistema", junit: "reports/junit/sistema.xml" },
  { id: "ui", nombre: "Interfaz de usuario", junit: "reports/junit/ui.xml" },
  { id: "aceptacion", nombre: "Aceptación (BDD)", junit: "reports/junit/aceptacion.xml" },
  { id: "vscode", nombre: "Extensión VS Code (e2e)", junit: "reports/junit/vscode.xml" },
];

function leer(ruta) {
  const p = join(RAIZ, ruta);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

/** Cuenta casos de un JUnit XML. Con `filtro`, solo los <testsuite> cuyo nombre lo contiene. */
function contarJunit(xml, filtro) {
  if (!xml) return null;
  const r = { total: 0, fallidas: 0, omitidas: 0, segundos: 0 };
  const suites = xml.match(/<testsuite\b[^>]*>[\s\S]*?<\/testsuite>/g) ?? [];
  for (const s of suites) {
    const cabecera = s.slice(0, s.indexOf(">"));
    // Vitest pone el nombre del proyecto en el classname de cada caso ("|unitarias| ...") o en la ruta.
    if (filtro && !esDelProyecto(s, filtro)) continue;
    const casos = s.match(/<testcase\b[\s\S]*?(?:\/>|<\/testcase>)/g) ?? [];
    r.total += casos.length;
    r.fallidas += casos.filter((c) => /<(failure|error)\b/.test(c)).length;
    r.omitidas += casos.filter((c) => /<skipped\b/.test(c)).length;
    r.segundos += Number(/time="([\d.]+)"/.exec(cabecera)?.[1] ?? 0);
  }
  return r;
}

function esDelProyecto(suite, proyecto) {
  const nombre = /<testsuite\s[^>]*?\bname="([^"]*)"/.exec(suite)?.[1] ?? "";
  if (proyecto === "unitarias") return nombre.startsWith("packages/");
  if (proyecto === "integracion") return nombre.startsWith("apps/");
  return true;
}

function mutacion() {
  const txt = leer("reports/mutation/mutation.json");
  if (!txt) return null;
  const c = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0, CompileError: 0, RuntimeError: 0, Ignored: 0 };
  for (const f of Object.values(JSON.parse(txt).files)) {
    for (const m of f.mutants) c[m.status] = (c[m.status] ?? 0) + 1;
  }
  const detectados = c.Killed + c.Timeout;
  const validos = detectados + c.Survived + c.NoCoverage;
  return {
    mutantes: validos,
    eliminados: detectados,
    sobrevivientes: c.Survived,
    sinCobertura: c.NoCoverage,
    puntaje: validos ? (100 * detectados) / validos : 0,
  };
}

function cobertura() {
  const txt = leer("coverage/coverage-summary.json");
  if (!txt) return null;
  const t = JSON.parse(txt).total;
  return Object.fromEntries(["lines", "statements", "functions", "branches"].map((k) => [k, t[k].pct]));
}

export function resumen() {
  return {
    generado: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    suites: SUITES.map((s) => ({ ...s, ...(contarJunit(leer(s.junit), s.filtro) ?? { total: null }) })),
    mutacion: mutacion(),
    cobertura: cobertura(),
  };
}

function markdown(r) {
  const filas = r.suites.map((s) =>
    s.total === null
      ? `| ${s.nombre} | — | — | sin reporte |`
      : `| ${s.nombre} | ${s.total - s.fallidas - s.omitidas}/${s.total} | ${s.segundos.toFixed(1)} s | ${s.fallidas ? "❌ " + s.fallidas + " fallidas" : "✅"} |`,
  );
  const lineas = [
    "## DepScan · Pruebas automatizadas",
    "",
    "| Tipo de prueba | Superadas | Tiempo | Estado |",
    "|---|---|---|---|",
    ...filas,
  ];
  if (r.mutacion) {
    const m = r.mutacion;
    lineas.push(
      `| Mutación (Stryker) | ${m.eliminados}/${m.mutantes} mutantes eliminados | — | puntaje ${m.puntaje.toFixed(1)} % |`,
    );
  }
  if (r.cobertura) {
    const c = r.cobertura;
    lineas.push("", `**Cobertura:** líneas ${c.lines} % · ramas ${c.branches} % · funciones ${c.functions} %`);
  }
  return lineas.join("\n") + "\n";
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/").replace(/^(?=[A-Za-z]:)/, "/")}`) {
  const r = resumen();
  process.stdout.write(process.argv.includes("--json") ? JSON.stringify(r, null, 2) : markdown(r));
}
