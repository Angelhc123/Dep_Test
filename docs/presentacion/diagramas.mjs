// Genera los diagramas UML de la presentación como SVG (docs/presentacion/diagramas/*.svg).
// build.js los incrusta en el HTML con {{SVG:nombre}}. Usan las clases .dg de fuente.html,
// así que respetan el tema claro/oscuro. Reflejan el código real (rutas y funciones).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "diagramas");
mkdirSync(DIR, { recursive: true });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function marcadores(p) {
  return `<defs>
  <marker id="${p}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah" d="M0,0 L10,5 L0,10 z"/></marker>
  <marker id="${p}-aa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="aha" d="M0,0 L10,5 L0,10 z"/></marker>
  <marker id="${p}-o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="ahopen" d="M0,0 L10,5 L0,10"/></marker>
  <marker id="${p}-tri" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path class="gen" d="M0,0 L12,6 L0,12 z"/></marker>
  <marker id="${p}-dia" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="13" markerHeight="9" orient="auto-start-reverse"><path class="ah" d="M1,5 L7,1 L13,5 L7,9 z"/></marker>
</defs>`;
}

const svg = (vb, label, cuerpo) =>
  `<svg class="dg" viewBox="${vb}" role="img" aria-label="${esc(label)}">${cuerpo}</svg>`;

const t = (x, y, s, cls = "", anchor = "start", extra = "") =>
  `<text x="${x}" y="${y}"${cls ? ` class="${cls}"` : ""}${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}${extra ? ` ${extra}` : ""}>${esc(s)}</text>`;

/** Clase UML: nombre (+ estereotipo) y atributos/operaciones. Devuelve { svg, h, x, y, w }. */
function clase(x, y, w, nombre, filas, { estereo, acento = false, sep = [] } = {}) {
  const cab = estereo ? 40 : 28;
  const h = cab + filas.length * 16 + 10 + sep.length * 6;
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${acento ? "bxa" : "bx"}"/>`;
  if (estereo) out += t(x + w / 2, y + 15, `«${estereo}»`, "s", "middle", 'style="font-size:11px"');
  out += t(x + w / 2, y + (estereo ? 32 : 20), nombre, "t", "middle", 'style="font-size:14px"');
  out += `<path class="ln" style="stroke-width:1" d="M${x},${y + cab} h${w}"/>`;
  let yy = y + cab + 15;
  filas.forEach((f, i) => {
    if (sep.includes(i)) {
      out += `<path class="ln" style="stroke-width:1" d="M${x},${yy - 11} h${w}"/>`;
      yy += 6;
    }
    out += t(x + 8, yy, f, "m", "start", 'style="fill:var(--ink)"');
    yy += 16;
  });
  return { svg: out, x, y, w, h };
}

/** Paquete UML (carpeta con pestaña). */
function paquete(x, y, w, h, nombre, contenido = [], { acento = false } = {}) {
  const tab = Math.min(w - 10, nombre.length * 8 + 22);
  let out = `<path class="${acento ? "bxa" : "bx"}" d="M${x},${y + 18} V${y} h${tab} v18 H${x + w} V${y + h} H${x} z"/>`;
  out += t(x + 10, y + 13, nombre, "t", "start", 'style="font-size:12.5px"');
  contenido.forEach((c, i) => (out += t(x + 12, y + 38 + i * 16, c, "m", "start", 'style="fill:var(--ink)"')));
  return out;
}

const linea = (d, cls, marker, extra = "") => `<path class="${cls}" d="${d}" ${marker ? `marker-end="url(#${marker})"` : ""} ${extra}/>`;
const etiqueta = (x, y, s, anchor = "middle") => t(x, y, s, "lb", anchor);

// ───────────────────────── 1. Diagrama de paquetes ─────────────────────────
{
  const P = "pk";
  let s = marcadores(P);
  // Aplicaciones (entradas)
  const apps = [
    [20, "apps/web", ["React 19 · Vite", "páginas, componentes, lib/api"]],
    [300, "apps/api", ["Fastify 5 · SQLite", "rutas, auth, db, pdf, telemetría"]],
    [580, "apps/cli", ["node:util parseArgs", "index.ts · uso en CI"]],
    [860, "apps/vscode", ["extensión VS Code", "skills + agente @depscan"]],
  ];
  for (const [x, n, c] of apps) s += paquete(x, 6, 256, 84, n, c);
  s += t(20, 112, "«aplicación» adaptadores de entrada", "k");

  // Núcleo
  s += paquete(10, 124, 1116, 392, "packages/core  ·  @depscan/core  (sin dependencias de runtime)", [], { acento: true });
  const sub = {
    project: [40, 166, 210, "project/", ["files.ts"]],
    scan: [462, 166, 212, "scan.ts", ["scanProject()  orquestador"]],
    report: [886, 166, 210, "report/", ["html.ts · text.ts"]],
    parsers: [40, 290, 230, "parsers/", ["npm/package-json.ts", "npm/lockfile.ts", "pypi/requirements.ts"]],
    resolver: [300, 290, 180, "resolver/", ["resolve.ts"]],
    analysis: [510, 290, 260, "analysis/", ["analyze · affected · cvss", "remediation · cwe-guidance"]],
    ports: [800, 290, 296, "sources/  (puertos)", ["ports.ts: VulnSource, CveEnricher,", "RegistrySource, Cache · http.ts"]],
    versions: [130, 430, 250, "versions/", ["semver.ts · pep440.ts · index.ts"]],
    domain: [470, 430, 210, "domain/", ["types.ts"]],
    adapters: [760, 430, 336, "sources/  (adaptadores)", ["osv/ · nvd/ · registry/ · github/"]],
  };
  for (const [k, [x, y, w, n, c]] of Object.entries(sub)) {
    s += paquete(x, y, w, 30 + c.length * 16 + 10, n, c, { acento: k === "scan" });
  }
  const dep = (d, lbl, lx, ly, a = "middle") =>
    linea(d, "ln dash", `${P}-o`) + (lbl ? etiqueta(lx, ly, lbl, a) : "");
  // apps → core
  s += linea("M148,90 V100 H428 V96", "ln", `${P}-a`) + etiqueta(288, 98, "HTTP / JSON");
  s += dep("M428,90 V164", "«import»", 470, 140);
  s += dep("M708,90 V140 H600 V164", "", 0, 0);
  s += dep("M988,90 V140 H640 V164", "«import» (motor como librería)", 820, 134);
  // core interno
  s += dep("M462,196 H252", "readProjectDirectory", 357, 188);
  s += dep("M520,232 V250 H390 V288", "resolveProject", 455, 262);
  s += dep("M580,232 V288", "buildFinding · buildRemediation", 660, 270);
  s += dep("M674,210 H948 V288", "ScanSources (puertos)", 800, 204);
  s += dep("M300,330 H272", "", 0, 0);
  s += dep("M390,362 V400 H300 V428", "", 0, 0);
  s += dep("M600,378 V400 H330 V428", "compareVersions", 470, 396);
  s += dep("M640,378 V428", "tipos", 652, 410, "start");
  // realización adaptadores → puertos
  s += linea("M930,428 V378", "ln dash", `${P}-tri`) + etiqueta(940, 412, "implementan", "start");
  writeFileSync(join(DIR, "paquetes.svg"), svg("0 0 1136 520", "Diagrama de paquetes de DepScan", s));
}

// ───────────────────────── 2. Clases de dominio ─────────────────────────
{
  const P = "cd";
  let s = marcadores(P);
  const C = {};
  const add = (k, ...a) => {
    C[k] = clase(...a);
    s += C[k].svg;
  };
  add("report", 10, 10, 250, "ScanReport", [
    "scannedAt: string",
    "scannerVersion: string",
    "manifests: string[]",
    "warnings: string[]",
    "durationMs: number",
  ], { acento: true });
  add("target", 10, 200, 250, "ScanTarget", [
    "name: string",
    'source: "directory"|"upload"|"github"',
    "commit?: string · ref?: string",
  ]);
  add("summary", 10, 330, 250, "ScanSummary", [
    "dependencies · direct · transitive",
    "unresolved: number",
    "vulnerableDependencies: number",
    "bySeverity: Record<Severity, n>",
    "risk: Risk",
  ]);
  add("finding", 340, 10, 270, "Finding", [
    "maxSeverity: Severity",
    "minSafeVersion: string | null",
    "majorBump: boolean",
    "unfixed: string[]",
    "risk: Risk",
  ], { acento: true });
  add("dep", 340, 196, 270, "Dependency", [
    "name: string",
    "ecosystem: Ecosystem",
    "declared: string",
    "resolved: string | null",
    "resolution: Resolution",
    "direct: boolean · dev: boolean",
    "path: string[]",
    "sourceFile: string",
    "requiredBy?: {name, range}",
  ]);
  add("vuln", 690, 10, 250, "Vulnerability", [
    "id: string  (CVE > GHSA)",
    "aliases: string[]",
    "summary · details?",
    "severity: Severity",
    "cvss?: number · cvssVector?",
    "severitySource",
    "fixedIn: string[]",
    "references · cwes?",
  ]);
  add("rem", 690, 236, 250, "Remediation", [
    "status: upgrade|no-fix|unknown",
    "recommended: string | null",
    "safeVersions: string[]",
    "verified: boolean",
    "fixableByLockfileUpdate?",
    "commands · snippet? · patches",
  ]);
  add("opt", 976, 236, 150, "UpgradeOption", ["kind", "version", "breaking"]);
  add("mit", 976, 352, 150, "Mitigation", ["vulnId · title", "text", 'source: advisory|cwe']);
  add("sev", 976, 10, 150, "Severity", ["critical · high", "medium · low", "unknown"], { estereo: "enumeration" });
  add("risk", 976, 128, 150, "Risk", ["red · yellow · green"], { estereo: "enumeration" });
  add("eco", 690, 398, 250, "Ecosystem · Resolution", ["Ecosystem: npm | PyPI", "Resolution: lockfile | exact-pin", "  | registry-estimate | unknown"], { estereo: "enumeration" });

  // composiciones (rombo lleno en el dueño) con multiplicidad
  const comp = (d, mult, mx, my, a = "middle") => linea(d, "ln", null, `marker-start="url(#${P}-dia)"`) + etiqueta(mx, my, mult, a);
  s += comp("M260,60 H338", "findings 0..*", 299, 52);
  s += comp("M135,140 V198", "target 1", 170, 172);
  s += comp("M10,120 H3 V400 H8", "summary 1", 14, 314, "start");
  s += comp("M260,150 H300 V290 H338", "dependencies 0..*", 306, 180, "start");
  s += comp("M610,60 H688", "vulnerabilities 1..*", 649, 52);
  s += comp("M610,130 C650,160 650,250 688,262", "remediation 0..1", 654, 210);
  s += comp("M940,280 H974", "0..*", 957, 272);
  s += comp("M940,360 C958,360 958,390 974,390", "0..*", 957, 352);
  s += linea("M475,148 V194", "ln", `${P}-a`) + etiqueta(512, 176, "dependency 1");
  s += t(10, 512, "◆ composición (el reporte contiene sus partes) · → asociación · tipos de packages/core/src/domain/types.ts", "s");
  writeFileSync(join(DIR, "clases-dominio.svg"), svg("0 0 1136 520", "Diagrama de clases del dominio", s));
}

// ───────────────────── 3. Clases: puertos y adaptadores ─────────────────────
{
  const P = "cp";
  let s = marcadores(P);
  const add = (...a) => {
    const c = clase(...a);
    s += c.svg;
    return c;
  };
  const scan = add(330, 6, 300, "scan.ts", ["scanProject(files, sources, opts)", ": Promise<ScanReport>"], { estereo: "módulo", acento: true });
  const ss = add(690, 6, 260, "ScanSources", ["osv: VulnSource", "nvd?: CveEnricher", "registry?: RegistrySource"], { estereo: "interface" });
  s += linea(`M630,40 H688`, "ln", `${P}-a`) + etiqueta(659, 32, "usa");

  const vs = add(10, 150, 270, "VulnSource", ["queryBatch(qs): string[][]", "getVulnerability(id)", "queryPackage?(name, eco)"], { estereo: "interface" });
  const ce = add(300, 150, 230, "CveEnricher", ["getCve(id): CveInfo | null"], { estereo: "interface" });
  const rs = add(550, 150, 250, "RegistrySource", ["listVersions(eco, name)", ": string[] | null"], { estereo: "interface" });
  const ca = add(856, 150, 270, "Cache", ["get(key): string | undefined", "set(key, value, ttlSeconds)"], { estereo: "interface" });
  s += linea("M820,98 V120 H145 V148", "ln", `${P}-a`);
  s += linea("M820,98 V120 H415 V148", "ln", `${P}-a`);
  s += linea("M820,98 V120 H675 V148", "ln", `${P}-a`);

  const osv = add(10, 330, 270, "OsvClient", ["- baseUrl · cache?", "+ queryBatch()  lotes de 1000", "+ getVulnerability()  caché 24 h", "+ queryPackage()"], { sep: [1] });
  const nvd = add(300, 330, 230, "NvdClient", ["- apiKey? · RateLimiter", "+ getCve()"], { sep: [1] });
  const reg = add(550, 330, 250, "RegistryClient", ["- cache?", "+ listVersions()  npm / PyPI"], { sep: [1] });
  const mem = add(840, 290, 136, "MemoryCache", ["core · CLI"]);
  const db = add(990, 290, 136, "Database", ["api · cache()", "SQLite"]);
  const file = add(840, 400, 136, "CacheArchivo", ["vscode · JSON"]);
  const tel = add(990, 400, 136, "Telemetry", ["instrumentCache()", "decorador"]);
  const real = (x1, y1, x2, y2) => linea(`M${x1},${y1} V${y2}`, "ln dash", `${P}-tri`);
  s += real(145, osv.y, 145, vs.y + vs.h);
  s += real(415, nvd.y, 415, ce.y + ce.h);
  s += real(675, reg.y, 675, rs.y + rs.h);
  s += linea(`M908,290 V${ca.y + ca.h}`, "ln dash", `${P}-tri`);
  s += linea(`M1058,290 V${ca.y + ca.h}`, "ln dash", `${P}-tri`);
  s += linea(`M840,425 H828 V256 H880 V${ca.y + ca.h}`, "ln dash", `${P}-tri`);
  s += linea(`M1126,425 H1132 V191 H1128`, "ln dash", `${P}-o`) + etiqueta(1126, 140, "envuelve", "end");
  // uso de la caché (inyectada en el constructor)
  s += linea(`M145,${osv.y + osv.h} V470 H812 V200 H854`, "ln", `${P}-a`);
  s += linea(`M415,${nvd.y + nvd.h} V470`, "ln", null);
  s += linea(`M675,${reg.y + reg.h} V470`, "ln", null);
  s += etiqueta(470, 488, "«usa» Cache: se inyecta en el constructor de OsvClient, NvdClient y RegistryClient");
  s += etiqueta(152, 318, "implementa") + etiqueta(422, 318, "implementa") + etiqueta(682, 318, "implementa");
  s += t(10, 512, "Arquitectura hexagonal: el núcleo define los puertos (packages/core/src/sources/ports.ts) y cada adaptador los implementa; se cambia la fuente sin tocar la lógica.", "s");
  void scan; void ss; void tel; void file; void mem;
  writeFileSync(join(DIR, "clases-puertos.svg"), svg("0 0 1136 520", "Diagrama de clases de puertos y adaptadores", s));
}

// ───────────────────────── 4. Diagrama de actividades ─────────────────────────
{
  const P = "ac";
  let s = marcadores(P);
  const W = 400;
  const accion = (cx, y, txt, cod, paso) => {
    const x = cx - W / 2;
    let o = `<rect x="${x}" y="${y}" width="${W}" height="44" rx="18" class="bx"/>`;
    o += t(cx, y + 19, txt, "", "middle", 'style="font-size:13.5px;font-weight:600"');
    o += t(cx, y + 35, cod, "m", "middle");
    if (paso) o += `<circle cx="${x + 2}" cy="${y + 4}" r="11" class="numbg"/>${t(x + 2, y + 8, paso, "num", "middle")}`;
    return o;
  };
  const decision = (cx, y, pregunta, izquierda = false) =>
    `<path class="bx" d="M${cx},${y} l16,14 l-16,14 l-16,-14 z"/>` +
    t(izquierda ? cx - 24 : cx + 24, y + 18, pregunta, "s", izquierda ? "end" : "start", 'style="font-size:12px;fill:var(--ink)"');
  const lado = (x, y, w, txt, cod) =>
    `<rect x="${x}" y="${y}" width="${w}" height="40" rx="16" class="bx" style="stroke-dasharray:4 3"/>` +
    t(x + w / 2, y + 17, txt, "", "middle", 'style="font-size:12.5px;font-weight:600"') +
    t(x + w / 2, y + 32, cod, "m", "middle", 'style="font-size:10.5px"');
  const v = (x, y1, y2) => linea(`M${x},${y1} V${y2}`, "ln", `${P}-a`);

  // Columna 1
  const A = 250;
  s += `<circle cx="${A}" cy="12" r="9" fill="var(--ink)"/>` + t(A + 16, 16, "scanProject(files, sources, opts)", "m", "start", 'style="fill:var(--ink)"');
  s += v(A, 21, 34);
  s += accion(A, 36, "Parsear manifiestos y resolver versión exacta", "resolveProject() → resolveNpm / resolvePypi", "1");
  s += v(A, 80, 92);
  s += decision(A, 92, "¿quedan sin versión y opts.estimate?");
  s += linea(`M${A - 16},106 H40 V150`, "ln", `${P}-a`) + etiqueta(70, 100, "sí", "start");
  s += lado(-6, 150, 196, "Estimar con el registro", "estimate() · listVersions()");
  s += linea(`M94,190 V196 H${A - 3}`, "ln", `${P}-a`);
  s += v(A, 120, 200) + etiqueta(A + 8, 160, "no", "start");
  s += accion(A, 202, "Consultas únicas name@version", "scan.ts L66–73 · solo d.resolved", "2");
  s += v(A, 246, 258);
  s += decision(A, 258, "¿hay consultas?", true);
  s += linea(`M${A + 16},272 H470 V354 H${A + 3}`, "ln", `${P}-a`) + etiqueta(462, 288, "no → ids = []", "end");
  s += v(A, 286, 300) + etiqueta(A + 8, 296, "sí", "start");
  s += accion(A, 302, "Consultar OSV en lote (≤ 1000 por lote)", "osv.queryBatch() → POST /v1/querybatch", "3");
  s += v(A, 346, 360);
  s += accion(A, 362, "Detalle de cada ID único (8 en paralelo)", "getVulnerability() · caché · descarta withdrawn", "4");
  s += v(A, 406, 420);
  s += accion(A, 422, "Normalizar y deduplicar por dependencia", "normalizeVulnerability() · dedupe()", "4");
  s += linea(`M${A},466 V500 H520 V12 H${830} V34`, "ln", `${P}-a`);

  // Columna 2
  const B = 830;
  s += decision(B, 36, "¿opts.enrichNvd y sources.nvd?", true);
  s += linea(`M${B + 16},50 H1100 V82`, "ln", `${P}-a`) + etiqueta(1060, 44, "sí", "start");
  s += lado(960, 82, 170, "CVSS de NVD (4 en paralelo)", "getCve() · applyNvd()");
  s += linea(`M1045,122 V146 H${B + 4}`, "ln", `${P}-a`);
  s += v(B, 64, 132) + etiqueta(B + 8, 100, "no", "start");
  s += accion(B, 134, "Armar hallazgos y ordenar por prioridad", "buildFinding() · riskOf() · sortFindings()", "6");
  s += v(B, 178, 192);
  s += decision(B, 192, "¿opts.remediation y hay hallazgos?", true);
  s += linea(`M${B + 16},206 H1100 V236`, "ln", `${P}-a`) + etiqueta(1060, 200, "sí", "start");
  s += lado(938, 236, 194, "Versión segura (6 en paralelo)", "queryPackage ‖ listVersions → buildRemediation");
  s += linea(`M1035,276 V300 H${B + 4}`, "ln", `${P}-a`);
  s += v(B, 220, 286) + etiqueta(B + 8, 256, "no", "start");
  s += accion(B, 288, "Advertencias: sin versión / estimadas", "scan.ts L150–155", "7");
  s += v(B, 332, 346);
  s += accion(B, 348, "Resumen y semáforo → ScanReport", "summarize() · durationMs", "7");
  s += v(B, 392, 406);
  s += accion(B, 408, "Guardar y responder · o reporte CLI", "app.ts db.saveScan() → 201 · cli renderText / shouldFail", "7");
  s += v(B, 452, 468);
  s += `<circle cx="${B}" cy="480" r="11" fill="none" stroke="var(--ink)" stroke-width="2"/><circle cx="${B}" cy="480" r="6" fill="var(--ink)"/>`;
  s += t(10, 514, "Sigue packages/core/src/scan.ts línea a línea. Los números son los 7 pasos de la presentación (el 5, NVD, es opcional).", "s");
  writeFileSync(join(DIR, "actividades.svg"), svg("-10 0 1146 520", "Diagrama de actividades de scanProject", s));
}

// ───────────────────────── 5. Mapa de archivos ─────────────────────────
{
  const P = "mf";
  let s = marcadores(P);
  const RH = 17.6; // alto de fila
  const pos = {}; // id → {x, y, w}
  const columna = (x, w, y0, grupos) => {
    let y = y0;
    for (const [titulo, archivos] of grupos) {
      s += t(x, y + 11, titulo, "ka", "start", 'style="font-size:10px"');
      y += 16;
      for (const [id, nombre, acento] of archivos) {
        s += `<rect x="${x}" y="${y}" width="${w}" height="${RH - 3}" rx="4" class="${acento ? "bxa" : "bx"}" style="stroke-width:1"/>`;
        s += t(x + 6, y + 10.6, nombre, "m", "start", `style="font-size:10px;fill:var(--ink)${acento ? ";font-weight:600" : ""}"`);
        pos[id] = { x, y: y + (RH - 3) / 2, w };
        y += RH;
      }
      y += 6;
    }
  };
  columna(0, 196, 0, [
    ["apps/web/src", [
      ["w-main", "main.tsx"], ["w-app", "App.tsx"], ["w-router", "lib/router.ts"], ["w-new", "pages/NewScan.tsx", 1],
      ["w-man", "lib/manifests.ts", 1], ["w-api", "lib/api.ts", 1], ["w-res", "pages/ScanResult.tsx", 1],
      ["w-find", "components/FindingsTable.tsx"], ["w-rem", "components/RemediationDrawer.tsx"], ["w-vul", "components/VulnDrawer.tsx"],
      ["w-deps", "components/DependenciesTable.tsx"], ["w-chart", "components/SeverityChart.tsx"], ["w-hist", "pages/History.tsx"],
      ["w-cmp", "pages/Compare.tsx"], ["w-gh", "pages/GithubRepos.tsx"], ["w-login", "pages/Login.tsx"], ["w-user", "components/UserMenu.tsx"],
      ["w-auth", "lib/auth.ts"], ["w-status", "pages/Status.tsx"], ["w-about", "pages/About.tsx"], ["w-fmt", "lib/format.ts"],
      ["w-ui", "components/ui.tsx"], ["w-css", "index.css"],
    ]],
  ]);
  columna(258, 186, 0, [
    ["apps/api/src", [
      ["a-server", "server.ts"], ["a-config", "config.ts"], ["a-app", "app.ts  POST /api/scans", 1], ["a-routes", "auth/routes.ts"],
      ["a-prov", "auth/providers.ts"], ["a-crypto", "auth/crypto.ts"], ["a-db", "db.ts", 1], ["a-tel", "telemetry.ts"], ["a-pdf", "report/pdf.ts"],
    ]],
    ["apps/cli/src", [["c-index", "index.ts"]]],
    ["apps/vscode/src", [
      ["v-ext", "extension.ts"], ["v-ctl", "controlador.ts"], ["v-prov", "proveedores.ts"], ["v-ag", "agente.ts"],
      ["v-motor", "motor.ts"], ["v-man", "manifiestos.ts"],
    ]],
  ]);
  columna(512, 210, 0, [
    ["packages/core/src", [
      ["k-index", "index.ts  (API pública)"], ["k-scan", "scan.ts  scanProject()", 1], ["k-files", "project/files.ts"],
      ["k-pkg", "parsers/npm/package-json.ts", 1], ["k-lock", "parsers/npm/lockfile.ts", 1], ["k-req", "parsers/pypi/requirements.ts", 1],
      ["k-res", "resolver/resolve.ts", 1], ["k-vidx", "versions/index.ts"], ["k-sem", "versions/semver.ts"], ["k-pep", "versions/pep440.ts"],
      ["k-ports", "sources/ports.ts"], ["k-http", "sources/http.ts"], ["k-osv", "sources/osv/osv-client.ts", 1],
      ["k-nvd", "sources/nvd/nvd-client.ts"], ["k-reg", "sources/registry/registry-client.ts"], ["k-gh", "sources/github/github-source.ts"],
      ["k-ana", "analysis/analyze.ts", 1], ["k-aff", "analysis/affected.ts"], ["k-cvss", "analysis/cvss.ts"],
      ["k-remd", "analysis/remediation.ts", 1], ["k-cwe", "analysis/cwe-guidance.ts"], ["k-html", "report/html.ts"],
      ["k-text", "report/text.ts"], ["k-types", "domain/types.ts"],
    ]],
  ]);
  columna(800, 150, 0, [
    ["servicios externos", [["x-osv", "api.osv.dev"], ["x-nvd", "NVD (NIST)"], ["x-reg", "registry.npmjs.org · pypi.org"], ["x-gh", "api.github.com · OAuth"], ["x-goo", "Google OAuth"]]],
    ["persistencia", [["x-sqlite", "SQLite  /data/depscan.db"]]],
  ]);
  columna(984, 150, 0, [
    ["raíz del monorepo", [
      ["r-pkg", "package.json  workspaces"], ["r-lock", "package-lock.json"], ["r-ts", "tsconfig.base.json"], ["r-docker", "Dockerfile"],
      ["r-rail", "railway.json"], ["r-vite", "apps/web/vite.config.ts"], ["r-html", "apps/web/index.html"],
      ["r-sonar", "sonar-project.properties"], ["r-gha", ".github/workflows/*.yml"],
    ]],
  ]);

  // Conexiones: der = sale por la derecha del origen y entra por la izquierda del destino.
  const der = (a, b, cls = "ln", paso = "") => {
    const A = pos[a], B = pos[b];
    const x1 = A.x + A.w, x2 = B.x;
    const mx = x1 + Math.max(14, (x2 - x1) * 0.5);
    let o = linea(`M${x1},${A.y} C${mx},${A.y} ${x2 - 30},${B.y} ${x2 - 2},${B.y}`, cls, cls === "lna" ? `${P}-aa` : `${P}-a`, 'style="stroke-width:1.1;opacity:.85"');
    if (paso) o += `<circle cx="${x2 - 14}" cy="${B.y}" r="7" class="numbg"/>${t(x2 - 14, B.y + 3.5, paso, "num", "middle", 'style="font-size:9px"')}`;
    return o;
  };
  // de derecha a izquierda: sale por la izquierda del origen y entra por la derecha del destino
  const izq = (a, b, cls = "ln") => {
    const A = pos[a], B = pos[b];
    const x1 = A.x, x2 = B.x + B.w;
    const mx = (x1 + x2) / 2;
    return linea(`M${x1},${A.y} C${mx},${A.y} ${mx},${B.y} ${x2 + 2},${B.y}`, cls, cls === "lna" ? `${P}-aa` : `${P}-a`, 'style="stroke-width:1.1;opacity:.85"');
  };
  // misma columna: arco por la derecha
  const arco = (a, b, cls = "ln", paso = "") => {
    const A = pos[a], B = pos[b];
    const x = A.x + A.w;
    const r = 12 + Math.abs(B.y - A.y) * 0.08;
    let o = linea(`M${x},${A.y} C${x + r},${A.y} ${x + r},${B.y} ${x + 2},${B.y}`, cls, cls === "lna" ? `${P}-aa` : `${P}-a`, 'style="stroke-width:1.1;opacity:.85"');
    if (paso) o += `<circle cx="${x - 12}" cy="${B.y}" r="7" class="numbg"/>${t(x - 12, B.y + 3.5, paso, "num", "middle", 'style="font-size:9px"')}`;
    return o;
  };
  // Flujo principal de un escaneo (azul, numerado como los 7 pasos)
  s += arco("w-new", "w-man", "lna", "1");
  s += arco("w-man", "w-api", "lna");
  s += der("w-api", "a-app", "lna");
  s += der("a-app", "k-scan", "lna");
  s += arco("k-scan", "k-res", "lna", "2");
  s += arco("k-res", "k-pkg", "lna", "1");
  s += arco("k-res", "k-lock", "lna");
  s += arco("k-res", "k-req", "lna");
  s += arco("k-res", "k-vidx", "ln");
  s += arco("k-scan", "k-osv", "lna", "3");
  s += der("k-osv", "x-osv", "lna", "4");
  s += arco("k-osv", "k-http", "ln");
  s += arco("k-scan", "k-nvd", "ln", "5");
  s += der("k-nvd", "x-nvd", "ln");
  s += arco("k-scan", "k-ana", "lna", "6");
  s += arco("k-scan", "k-remd", "lna");
  s += der("k-reg", "x-reg", "ln");
  s += arco("a-app", "a-db", "lna");
  s += der("a-db", "x-sqlite", "lna", "7");
  s += izq("a-app", "w-res", "lna");
  // Otros vínculos
  s += der("k-gh", "x-gh", "ln");
  s += der("a-prov", "x-goo", "ln");
  s += der("c-index", "k-files", "ln");
  s += der("v-motor", "k-scan", "ln");
  s += der("a-pdf", "k-types", "ln");
  writeFileSync(join(DIR, "mapa-archivos.svg"), svg("0 -4 1136 470", "Mapa de archivos del proyecto con el flujo de un escaneo", s));
}

// ───────────────────────── 6. Modelo de datos (SQLite) ─────────────────────────
{
  const P = "er";
  let s = marcadores(P);
  const tabla = (x, y, w, nombre, cols) => {
    const c = clase(x, y, w, nombre, cols.map((c) => c), { estereo: "tabla" });
    s += c.svg;
    return c;
  };
  tabla(20, 20, 280, "users", ["PK id: TEXT", "email · name · avatar_url", "created_at: TEXT"]);
  tabla(420, 20, 300, "identities", ["PK provider + provider_user_id", "FK user_id → users.id", "login · email", "access_token_enc  (AES-256-GCM)", "scopes · updated_at"]);
  tabla(20, 220, 280, "sessions", ["PK id: TEXT  (sha256 del token)", "FK user_id → users.id  (null = anónima)", "created_at · expires_at", "data: JSON"]);
  tabla(420, 230, 300, "scans", ["PK id: TEXT (UUID)", "owner: user:<id> | anon:<sesión>", "private: 0|1", "target_name · source · commit_sha", "risk · created_at", "summary_json · report_json"]);
  tabla(840, 20, 276, "cache", ["PK key: TEXT  (osv:vuln:…)", "value: TEXT (JSON)", "expires_at: INTEGER (TTL)"]);
  s += linea("M418,70 H302", "ln", `${P}-a`) + etiqueta(360, 62, "N : 1");
  s += linea("M160,218 V122", "ln", `${P}-a`) + etiqueta(172, 172, "N : 1  (0..1)", "start");
  s += linea("M302,290 H418", "ln dash", null) + etiqueta(360, 282, "owner anon:<id>");
  s += linea("M570,228 V160", "ln dash", null) + etiqueta(582, 196, "owner user:<id>", "start");
  s += t(840, 190, "Sin relaciones: caché de OSV, NVD", "s") + t(840, 206, "y registros, con vencimiento.", "s");
  s += t(20, 470, "apps/api/src/db.ts · node:sqlite · migraciones versionadas · purgeExpired() cada 6 h borra sesiones y caché vencidas.", "s");
  writeFileSync(join(DIR, "datos.svg"), svg("0 0 1136 480", "Modelo de datos SQLite", s));
}

console.log("diagramas generados en", DIR);
