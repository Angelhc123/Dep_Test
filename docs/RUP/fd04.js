// FD04-EPIS-Informe_Arquitectura_de_Software – Documento de Arquitectura de Software (formato APA 7, según plantilla.js)
// Uso: npm install  &&  node fd04.js   (logo_upt.png e img/ en la misma carpeta)
// Contenido tomado de FD04-EPIS-Informe_Arquitectura_de_Software.md; los diagramas están en img/fd04-NN.png.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, PageBreak, TableOfContents, Header, Footer,
  PageNumber, WidthType, BorderStyle, ShadingType, VerticalAlign, TabStopType,
  LevelFormat, HeightRule,
} = require("docx");

// ================== DATOS ==================
const PROYECTO = "DepScan: Sistema Web de Detección y Remediación de Dependencias Vulnerables";
const CURSO = "{Nombre del Curso}";
const DOCENTE = "{Nombre del Docente}";
const INTEGRANTES = [["Hernández Cruz, Angel Gadiel", "(2021070017)"]];
const INFORME = "Documento de Arquitectura de Software";
const VERSION = "Versión 1.0";
const FECHA = "14/10/2026";
const ANIO = "2026";
const SIGLA = "SAD";
const LOGO = path.join(__dirname, "logo_upt.png");
const IMG = path.join(__dirname, "img");
const SALIDA = path.join(__dirname, "FD04-EPIS-Informe_Arquitectura_de_Software.docx");

const FONT = "Calibri";      // APA 7 admite Calibri 11 o Times New Roman 12
const SIZE = 22;             // 11 pt (medios puntos)
const CW = 9026;             // ancho útil A4 con márgenes de 2.54 cm (DXA)

// ================== HELPERS ==================
const run = (text, o = {}) => new TextRun({ text, font: o.font ?? FONT, size: o.size ?? SIZE,
  bold: o.bold, italics: o.italics, color: o.color });

// texto con marcas markdown: **negrita**, *cursiva*, `código`
function md(text, o = {}) {
  const out = [];
  const re = /\*\*(.+?)\*\*|(?<![\w\\])\*(?!\s)(.+?)\*(?!\w)|`([^`]+)`/g;
  const plano = (t) => t.replace(/\\\*/g, "*");
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(run(plano(text.slice(last, m.index)), o));
    if (m[1] !== undefined) out.push(...md(m[1], { ...o, bold: true }));
    else if (m[2] !== undefined) out.push(...md(m[2], { ...o, italics: true }));
    else out.push(run(m[3], { ...o, font: "Consolas", size: (o.size ?? SIZE) - 2 }));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(run(plano(text.slice(last)), o));
  return out;
}

const center = (children, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER,
  spacing: { before: o.before ?? 0, after: o.after ?? 160 }, children });

// párrafo APA: doble espacio, sangría 1.27 cm en primera línea
const parrafo = (text) => new Paragraph({
  spacing: { line: 480, after: 0 }, indent: { firstLine: 720 }, alignment: AlignmentType.JUSTIFIED,
  children: md(text),
});

// cita en bloque APA: sangría izquierda de 1.27 cm, sin comillas
const cita = (text) => new Paragraph({
  spacing: { line: 480, after: 0 }, indent: { left: 720 }, children: md(text),
});

// listas con viñetas y numeradas (cada lista numerada reinicia en 1)
let nLista = 0;
const vinetas = (items) => items.map((t) => new Paragraph({
  numbering: { reference: "vinetas", level: 0 }, spacing: { line: 360, after: 60 }, children: md(t) }));
const numerada = (items) => { const inst = ++nLista; return items.map((t) => new Paragraph({
  numbering: { reference: "numeros", level: 0, instance: inst }, spacing: { line: 360, after: 60 }, children: md(t) })); };

const TITULOS = [];   // se llena al construir el cuerpo -> índice
const h1 = (t) => (TITULOS.push([t, 1]), new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(t, { size: 24, bold: true })] }));
const h2 = (t) => (TITULOS.push([t, 2]), new Paragraph({ heading: HeadingLevel.HEADING_2, children: [run(t, { bold: true })] }));
const h3 = (t) => (TITULOS.push([t, 3]), new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run(t, { bold: true, italics: true })] }));
const salto = () => new Paragraph({ children: [new PageBreak()] });

// --- Tablas APA: solo líneas horizontales (arriba, bajo encabezado, abajo) ---
const LN = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
const NO = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
let nTabla = 0, nFigura = 0;

function celda(text, w, { header = false, top = false, bottom = false } = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    borders: { top: top ? LN : NO, bottom: bottom ? LN : NO, left: NO, right: NO },
    children: String(text).split("\n").map((l) => new Paragraph({ spacing: { after: 0 },
      children: md(l, { bold: header || undefined, size: 20 }) })),
  });
}

const rotulo = (tipo, n, titulo) => [
  new Paragraph({ spacing: { before: 240, after: 0 }, keepNext: true, children: [run(`${tipo} ${n}`, { bold: true })] }),
  new Paragraph({ spacing: { after: 120 }, keepNext: true, children: [run(titulo, { italics: true })] }),
];
const nota = (texto) => new Paragraph({ spacing: { before: 80, after: 240 },
  children: [run("Nota. ", { italics: true, size: 20 }), ...md(texto, { size: 20 })] });

function tablaAPA(titulo, columnas, anchos, filas, notaTxt = "Elaboración propia.") {
  nTabla++;
  const rows = [new TableRow({ tableHeader: true,
    children: columnas.map((c, i) => celda(c, anchos[i], { header: true, top: true, bottom: true })) })];
  filas.forEach((f, r) => {
    const last = r === filas.length - 1;
    rows.push(new TableRow({ cantSplit: true, children: columnas.map((_, i) => celda(f[i] ?? "", anchos[i], { bottom: last })) }));
  });
  return [
    ...rotulo("Tabla", nTabla, titulo),
    new Table({ width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: anchos, rows }),
    nota(notaTxt),
  ];
}

// tabla de atributos (primera columna con el atributo, segunda con el detalle)
function tablaAtributos(titulo, encabezado, atributos) {
  nTabla++;
  const a = [2600, CW - 2600];
  const rows = [new TableRow({ tableHeader: true, children: [
    celda(encabezado[0], a[0], { header: true, top: true, bottom: true }),
    celda(encabezado[1], a[1], { header: true, top: true, bottom: true })] })];
  atributos.forEach(([t, d], i) => {
    const last = i === atributos.length - 1;
    rows.push(new TableRow({ children: [celda(`**${t}**`, a[0], { bottom: last }), celda(d, a[1], { bottom: last })] }));
  });
  return [
    ...rotulo("Tabla", nTabla, titulo),
    new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: a, rows }),
    nota("Elaboración propia."),
  ];
}

// figura APA: número en negrita, título en cursiva, imagen del diagrama (o recuadro vacío), nota
const MAX_W = 600, MAX_H = 820;   // px a 96 ppp dentro del área útil
function figuraAPA(titulo, archivo, notaTxt = "Elaboración propia.") {
  nFigura++;
  const f = path.join(IMG, archivo);
  let cuerpoFig;
  if (fs.existsSync(f)) {
    const data = fs.readFileSync(f);
    const w0 = data.readUInt32BE(16) / 2, h0 = data.readUInt32BE(20) / 2;   // PNG renderizado a 2x
    const k = Math.min(1.6, MAX_W / w0, MAX_H / h0);   // amplía los diagramas pequeños
    cuerpoFig = center([new ImageRun({ type: "png", data,
      transformation: { width: Math.round(w0 * k), height: Math.round(h0 * k) } })], { after: 0 });
  } else {
    const caja = { style: BorderStyle.DASHED, size: 6, color: "999999" };
    cuerpoFig = new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], rows: [
      new TableRow({ height: { value: 3600, rule: HeightRule.EXACT }, children: [new TableCell({
        width: { size: CW, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        borders: { top: caja, bottom: caja, left: caja, right: caja },
        shading: { fill: "F5F5F5", type: ShadingType.CLEAR, color: "auto" },
        children: [center([run("[ Insertar diagrama aquí ]", { color: "999999", italics: true })], { after: 0 })],
      })] })] });
  }
  return [...rotulo("Figura", nFigura, titulo), cuerpoFig, nota(notaTxt)];
}

// referencia APA con sangría francesa
const ref = (text) => new Paragraph({
  spacing: { line: 480, after: 0 }, indent: { left: 720, hanging: 720 }, children: md(text),
});

// ================== CARÁTULA ==================
function caratula() {
  const c = [];
  if (fs.existsSync(LOGO)) c.push(center([new ImageRun({ type: "png", data: fs.readFileSync(LOGO),
    transformation: { width: 104, height: 140 } })], { after: 300 }));
  c.push(
    center([run("UNIVERSIDAD PRIVADA DE TACNA", { font: "Arial", size: 28, bold: true })], { after: 240 }),
    center([run("FACULTAD DE INGENIERÍA", { font: "Arial", size: 24, bold: true })], { after: 80 }),
    center([run("Escuela Profesional de Ingeniería de Sistemas", { font: "Arial", size: 24, bold: true })], { after: 600 }),
    center([run("Proyecto ", { font: "Arial", size: 26, bold: true }),
            run(`“${PROYECTO}”`, { font: "Arial", size: 26, bold: true, italics: true })], { after: 600 }),
    center([run("Curso: ", { font: "Arial", size: 24 }), run(CURSO, { font: "Arial", size: 24, italics: true })], { after: 240 }),
    center([run("Docente: ", { font: "Arial", size: 24 }), run(DOCENTE, { font: "Arial", size: 24, italics: true })], { after: 600 }),
    new Paragraph({ spacing: { after: 160 }, children: [run("Integrantes:", { font: "Arial", size: 24 })] }),
  );
  for (const [nom, cod] of INTEGRANTES) c.push(new Paragraph({
    spacing: { after: 40 }, tabStops: [{ type: TabStopType.LEFT, position: 4300 }],
    children: [run(nom, { font: "Arial", size: 20, bold: true, italics: true }),
               run("\t" + cod, { font: "Arial", size: 20, bold: true, italics: true })],
  }));
  c.push(
    center([run("Tacna – Perú", { font: "Arial", size: 24, bold: true })], { before: 1400, after: 40 }),
    center([run(ANIO, { font: "Arial", size: 24, bold: true, italics: true })]),
    salto(),
  );
  return c;
}

// ================== PORTADA INTERNA + CONTROL DE VERSIONES ==================
function portadaInterna() {
  const R = (children, before = 0) => new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before, after: 0 }, children });
  const tnr = (t, o = {}) => run(t, { font: "Times New Roman", size: 32, bold: true, ...o });
  const cols = ["Versión", "Hecha por", "Revisada por", "Aprobada por", "Fecha", "Motivo"];
  const a = [1100, 1600, 1600, 1600, 1300, 1826];
  const enc = new TableRow({ tableHeader: true, children: cols.map((c, i) => celda(c, a[i], { header: true, top: true, bottom: true })) });
  const f1 = new TableRow({ children: ["1.0", "A. G. Hernández Cruz", "", "", FECHA, "Versión original"].map((t, i) => celda(t, a[i], { bottom: true })) });
  return [
    ...Array.from({ length: 14 }, () => new Paragraph({ children: [] })),
    R([tnr(PROYECTO, { italics: true })]),   // el nombre ya incluye "Sistema"
    R([tnr(INFORME)]),
    R([run(VERSION, { font: "Times New Roman", size: 20, bold: true })], 400),
    salto(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run("CONTROL DE VERSIONES", { bold: true, size: 24 })] }),
    new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: a, rows: [enc, f1] }),
    salto(),
  ];
}

// ================== ÍNDICE ==================
function indice() {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run("ÍNDICE GENERAL", { bold: true, size: 24 })] }),
    new TableOfContents("Índice general", { hyperlink: true, headingStyleRange: "1-2",
      // entradas precargadas (Word las recalcula al abrir con "Sí")
      cachedEntries: TITULOS.filter(([, l]) => l <= 2).map(([title, level]) => ({ title, level, page: PAGINAS[title] ?? "" })) }),
    salto(),
  ];
}

// ================== CUERPO ==================
function cuerpo() {
  return [

    h1("INTRODUCCIÓN"),
    h2("1. Propósito"),
    parrafo("El presente Documento de Arquitectura de Software (SAD) describe la arquitectura de DepScan mediante el modelo de vistas 4+1 de Kruchten: la vista de casos de uso, que articula a las demás, y las vistas lógica, de procesos, de despliegue y de implementación, complementadas con la vista de datos. Explica cómo se organizan los componentes, cómo colaboran durante un escaneo, cómo se persisten los datos, cómo se despliega el sistema y qué patrones y decisiones de diseño se adoptaron, con su justificación."),
    parrafo("El documento está dirigido al docente evaluador, a los desarrolladores que mantengan o extiendan el sistema y a quien deba operarlo en producción."),
    h2("2. Alcance"),
    parrafo("Cubre el motor de análisis (`packages/core`), la API web (`apps/api`), la interfaz web (`apps/web`), la CLI (`apps/cli`) y la infraestructura de despliegue en Railway. Los requerimientos que la arquitectura satisface se especifican en FD03 (RF-01 a RF-20 y RNF-01 a RNF-11). Quedan fuera de este documento el detalle de la interfaz gráfica y los procedimientos de gestión del proyecto, tratados en FD02 y FD05."),
    ...tablaAPA("Stack tecnológico", ["Capa","Tecnología","Versión"], [1211,6315,1500], [
      ["Lenguaje", "TypeScript (ESM, `strict`)", "5.9"],
      ["Runtime", "Node.js LTS", "24"],
      ["Motor", "TypeScript puro, **cero dependencias de runtime**", "—"],
      ["API", "Fastify, `@fastify/cookie`, `@fastify/rate-limit`, `@fastify/static`", "5.x"],
      ["Persistencia", "SQLite nativo (`node:sqlite`, `DatabaseSync`)", "Node 24"],
      ["PDF", "pdfkit (generación en el servidor)", "0.17"],
      ["Web", "React, Vite, Tailwind CSS, TanStack Query, Recharts", "19 / 7 / 4 / 5 / 3"],
      ["Pruebas", "Vitest", "4.1"],
      ["Calidad", "ESLint 9, Prettier 3, `tsc -b` con *project references*", "—"],
      ["Monorepo", "npm workspaces", "npm 11"],
      ["CI", "GitHub Actions", "—"],
      ["Despliegue", "Docker multi-etapa (`node:24-alpine`) en Railway + volumen", "—"],
    ]),
    h2("3. Definiciones, Acrónimos y Abreviaturas"),
    ...tablaAPA("Definiciones, Acrónimos y Abreviaturas", ["Término","Definición"], [1414,7612], [
      ["SAD", "*Software Architecture Document*, documento de arquitectura de software."],
      ["API REST", "Interfaz de programación que expone recursos mediante HTTP y JSON."],
      ["SPA", "*Single Page Application*: aplicación web que se carga una vez y actualiza la vista en el navegador."],
      ["CLI", "*Command Line Interface*: herramienta de línea de comandos."],
      ["OSV", "*Open Source Vulnerabilities*, base de avisos de Google."],
      ["NVD", "*National Vulnerability Database* del NIST (EE. UU.)."],
      ["CVE / GHSA / PYSEC", "Identificadores de avisos de seguridad (MITRE, GitHub y Python)."],
      ["CVSS", "*Common Vulnerability Scoring System*: puntaje de gravedad de 0 a 10."],
      ["CWE", "*Common Weakness Enumeration*: catálogo de tipos de debilidad."],
      ["OAuth 2.0 / PKCE", "Protocolo de autorización delegada y su extensión contra el robo del código de autorización."],
      ["ADR", "*Architecture Decision Record*: registro de una decisión arquitectónica."],
      ["CI", "Integración continua."],
      ["Puerto", "Interfaz TypeScript que el núcleo define para hablar con el exterior (`VulnSource`, `CveEnricher`, `RegistrySource`, `Cache`)."],
      ["Adaptador", "Implementación concreta de un puerto (`OsvClient`, `NvdClient`, `RegistryClient`, caché SQLite)."],
      ["Pipeline de escaneo", "Secuencia `resolve → query → fetch → dedupe → enrich → analyze → remediate → report`."],
      ["Owner key", "Identificador del dueño de un escaneo: `user:<id>` o `anon:<sesión>`."],
    ]),
    h2("4. Referencias"),
    ...tablaAPA("Referencias", ["Documento","Descripción"], [3479,5547], [
      ["FD01 – Informe de Factibilidad", "Riesgos, costos y viabilidad del proyecto."],
      ["FD02 – Documento de Visión", "Problema, interesados, alcance y características del producto."],
      ["FD03 – Especificación de Requerimientos", "RF, RNF, reglas de negocio y casos de uso CU-01 a CU-10."],
      ["`docs/ARQUITECTURA.md` y `docs/decisiones/`", "Descripción técnica y ADR del repositorio."],
      ["Kruchten (1995)", "Modelo de vistas 4+1 (ver Bibliografía)."],
    ]),
    salto(),

    h1("I. REPRESENTACIÓN ARQUITECTÓNICA"),
    parrafo("La arquitectura se representa con el modelo 4+1 de Kruchten, porque separa las preocupaciones de cada interesado y es el modelo de referencia de RUP. Cada vista se documenta con diagramas UML o equivalentes en notación Mermaid."),
    ...tablaAPA("REPRESENTACIÓN ARQUITECTÓNICA", ["Vista","Interesado principal","Qué muestra","Sección"], [1389,2205,4567,865], [
      ["Casos de uso (+1)", "Todos", "Realización técnica de CU-01 a CU-10", "II"],
      ["Lógica", "Desarrolladores", "Estilo, paquetes, capas, clases e interfaces", "III"],
      ["Procesos", "Integradores", "Pipeline de escaneo, autenticación y concurrencia", "IV"],
      ["Despliegue", "Operación", "Railway, contenedor, volumen y servicios externos", "V"],
      ["Implementación", "Desarrolladores", "Estructura del monorepo y del código", "VI"],
      ["Datos", "Desarrolladores y operación", "Modelo entidad-relación y migraciones", "VII"],
    ]),
    h2("Metas y Restricciones Arquitectónicas"),
    ...tablaAPA("Metas (atributos de calidad dominantes)", ["ID","Objetivo","Táctica arquitectónica","RNF"], [844,2110,5228,844], [
      ["OA-01", "**Corrección** de versiones y avisos", "Comparadores semver y PEP 440 propios con pruebas de especificación; evaluación OSV por eventos `introduced/fixed/last_affected`.", "RNF-07"],
      ["OA-02", "**Rendimiento**", "Consulta en lote (`/v1/querybatch`, ≤ 1000 consultas), concurrencia limitada (`mapLimit`), caché persistente de 24 h.", "RNF-01"],
      ["OA-03", "**Mantenibilidad y testabilidad**", "Arquitectura hexagonal: núcleo puro sin E/S directa; adaptadores inyectables; 97 pruebas sin red.", "RNF-10"],
      ["OA-04", "**Seguridad**", "OAuth 2.0 con `state` y PKCE, sesión opaca hasheada, cookies `HttpOnly/SameSite=Lax/Secure`, tokens AES-256-GCM, control de acceso por dueño, rate limiting, validación con JSON Schema.", "RNF-04, RNF-05"],
      ["OA-05", "**Resiliencia ante servicios externos**", "Timeouts, reintentos con *backoff* exponencial y `Retry-After`, limitador de ventana deslizante para NVD.", "RNF-06"],
      ["OA-06", "**Reproducibilidad**", "Cada reporte guarda fecha, versión del escáner y SHA del commit analizado.", "RNF-08"],
      ["OA-07", "**Portabilidad y despliegue simple**", "Un único contenedor que sirve API y web; configuración solo por variables de entorno.", "RNF-06"],
    ]),
    ...tablaAPA("Restricciones", ["Tipo","Restricción","Impacto en la arquitectura"], [901,2885,5240], [
      ["Herramientas", "Solo Visual Studio Code", "Todo se ejecuta con scripts npm, sin generadores de IDE."],
      ["Tecnología", "Frontend React; backend Node/TypeScript", "Tipos compartidos: la web importa `@depscan/core` solo con `import type`."],
      ["Plataforma", "Railway, una réplica", "SQLite en volumen `/data`; no hay escritores concurrentes."],
      ["Externa", "NVD: 5 req/30 s (50 con clave)", "Enriquecimiento opcional y limitado."],
      ["Externa", "GitHub: 60 req/h sin token", "Uso del token OAuth del usuario o `GITHUB_TOKEN`."],
      ["Seguridad", "Volúmenes Railway montados como root", "El contenedor se ejecuta como root (documentado en ADR-07)."],
    ]),
    salto(),

    h1("II. VISTA DE CASOS DE USO"),
    parrafo("Cada caso de uso de FD03 se realiza con los componentes indicados en la tabla siguiente y se detalla con su ficha y su diagrama de secuencia técnico, que muestra los objetos de frontera (páginas React), control (rutas Fastify y orquestador), servicio (clientes OSV, NVD, registros y GitHub) y persistencia (clase `Database`)."),
    ...tablaAPA("Realización de los casos de uso por componente", ["CU","Componentes de presentación","Rutas / comandos","Componentes de núcleo e infraestructura"], [842,1953,2992,3239], [
      ["CU-01", "`NewScan.tsx`, `lib/manifests.ts`", "`POST /api/scans` (`files`)", "`cleanPath`, `isManifestPath`, `ensureSession`, `scanProject`, `Database.saveScan`"],
      ["CU-02", "`NewScan.tsx`", "`POST /api/scans` (`github`)", "`parseGithubRepo`, `githubTokenOf`, `fetchGithubProject`, `scanProject`"],
      ["CU-03", "`ScanResult.tsx`, `FindingsTable.tsx`, `VulnDrawer.tsx`", "`GET /api/scans/:id`, `GET /api/vulns/:id`", "`readable()`, `OsvClient.getVulnerability`, caché SQLite"],
      ["CU-04", "`RemediationDrawer.tsx`", "— (datos del reporte)", "`buildRemediation` (calculado en el escaneo), API Clipboard"],
      ["CU-05", "`ScanResult.tsx`", "`GET /api/scans/:id/report.html?download=1`, `GET /api/scans/:id/report.pdf`", "`renderHtml`, `renderPdf` (pdfkit)"],
      ["CU-06", "`Login.tsx`, `UserMenu.tsx`, `lib/auth.ts`", "`GET /api/auth/:provider/login`, `GET /api/auth/:provider/callback`", "`authorizeUrl`, `exchangeCode`, `fetchProfile`, `TokenCipher`, `Database`"],
      ["CU-07", "`GithubRepos.tsx`", "`GET /api/auth/me`, `GET /api/github/repos`, `POST /api/scans`", "`listGithubRepos`, `githubTokenOf`"],
      ["CU-08", "`History.tsx`, `Compare.tsx`", "`GET /api/scans`, `GET /api/scans/:id`, `DELETE /api/scans/:id`", "`Database.listScans`, `Database.deleteScan`, `ownerKey`"],
      ["CU-09", "GitHub Actions (`ci.yml`)", "`node apps/cli/dist/index.js . --fail-on high`", "`readProjectDirectory`, `scanProject`, `renderHtml`, `shouldFail`"],
      ["CU-10", "`UserMenu.tsx`, `GithubRepos.tsx`", "`POST /api/auth/logout`, `DELETE /api/auth/github`", "`Database.deleteSession`, `Database.clearIdentityToken`"],
    ]),
    h2("Secuencia de CU-01: Revisar un proyecto subiendo sus archivos"),
    ...tablaAtributos("Ficha del caso de uso CU-01", ["Atributo","Detalle"], [
      ["Actores", "Visitante / Usuario registrado; bases de avisos (OSV, NVD); registros npm y PyPI"],
      ["Módulo / Componentes", "Web: `NewScan.tsx`, `lib/manifests.ts`. API: `POST /api/scans`. Núcleo: `scanProject`. Persistencia: `Database.saveScan`"],
      ["Requerimientos relacionados", "RF-01, RF-03, RF-04, RF-05, RF-06, RF-19; RNF-01, RNF-05, RNF-09"],
    ]),
    parrafo("La página filtra en el navegador los manifiestos válidos y envía su contenido a `POST /api/scans`. La API aplica el límite de tasa por IP, valida el cuerpo con JSON Schema, normaliza las rutas, asegura una sesión (anónima si no hay login) y delega el análisis al orquestador `scanProject` del núcleo, que consulta OSV en lote. El reporte se guarda con su dueño y se devuelve con estado 201."),
    ...figuraAPA("Diagrama de secuencia del CU-01", "fd04-01.png"),
    h2("Secuencia de CU-02: Revisar un repositorio de GitHub"),
    ...tablaAtributos("Ficha del caso de uso CU-02", ["Atributo","Detalle"], [
      ["Actores", "Visitante / Usuario registrado; GitHub (API y raw); bases de avisos"],
      ["Módulo / Componentes", "Web: `NewScan.tsx`, `GithubRepos.tsx`. API: `POST /api/scans` (`github`). Infraestructura: `fetchGithubProject`, `githubTokenOf`. Núcleo: `scanProject`"],
      ["Requerimientos relacionados", "RF-02, RF-03, RF-04, RF-05, RF-06, RF-19; RNF-05, RNF-08"],
    ]),
    parrafo("La API interpreta `owner/repo@ref`, obtiene el token del usuario (descifrado con AES-256-GCM) o el token del servidor, fija el commit exacto (SHA), recorre el árbol del repositorio y descarga solo los manifiestos con concurrencia 6. El escaneo queda marcado como privado si el repositorio lo es, lo que restringe su lectura al dueño."),
    ...figuraAPA("Diagrama de secuencia del CU-02", "fd04-02.png"),
    h2("Secuencia de CU-03: Consultar el resultado y el detalle de las fallas"),
    ...tablaAtributos("Ficha del caso de uso CU-03", ["Atributo","Detalle"], [
      ["Actores", "Visitante / Usuario registrado; OSV"],
      ["Módulo / Componentes", "Web: `ScanResult.tsx`, `FindingsTable.tsx`, `VulnDrawer.tsx`. API: `GET /api/scans/:id`, `GET /api/vulns/:id`. Infraestructura: `OsvClient`, caché SQLite"],
      ["Requerimientos relacionados", "RF-06, RF-07; RNF-03, RNF-05"],
    ]),
    parrafo("El cliente reutiliza el reporte guardado por TanStack Query; si no lo tiene, lo pide a la API, que aplica `readable()` para ocultar escaneos privados ajenos. El detalle de cada aviso se obtiene bajo demanda desde OSV a través de la caché de 24 horas (patrón cache-aside)."),
    ...figuraAPA("Diagrama de secuencia del CU-03", "fd04-03.png"),
    h2("Secuencia de CU-04: Ver la solución de una librería"),
    ...tablaAtributos("Ficha del caso de uso CU-04", ["Atributo","Detalle"], [
      ["Actores", "Visitante / Usuario registrado"],
      ["Módulo / Componentes", "Web: `RemediationDrawer.tsx`, API Clipboard. Núcleo (en tiempo de escaneo): `buildRemediation`"],
      ["Requerimientos relacionados", "RF-08, RF-09, RF-10, RF-11; RNF-07"],
    ]),
    parrafo("La remediación se calcula durante el escaneo y viaja dentro del reporte (`Finding.remediation`); el panel no hace llamadas al servidor. El cálculo ocurre en `buildRemediation`: se obtienen todos los avisos del paquete y todas sus versiones publicadas, y cada versión estable se evalúa contra todos los avisos."),
    ...figuraAPA("Diagrama de secuencia del CU-04", "fd04-04.png"),
    h2("Secuencia de CU-05: Descargar el informe"),
    ...tablaAtributos("Ficha del caso de uso CU-05", ["Atributo","Detalle"], [
      ["Actores", "Visitante / Usuario registrado / Docente"],
      ["Módulo / Componentes", "Web: `ScanResult.tsx`. API: `GET /api/scans/:id/report.html`, `GET /api/scans/:id/report.pdf`. Reportes: `renderHtml` (núcleo), `renderPdf` (pdfkit)"],
      ["Requerimientos relacionados", "RF-12; RNF-08"],
    ]),
    parrafo("La API verifica el acceso al escaneo y genera el documento en el servidor: HTML autocontenido con `renderHtml` del núcleo o PDF con pdfkit. Ambos incluyen fecha, versión del escáner y commit analizado, y se entregan con `Content-Disposition: attachment`."),
    ...figuraAPA("Diagrama de secuencia del CU-05", "fd04-05.png"),
    h2("Secuencia de CU-06: Iniciar sesión y unir cuentas"),
    ...tablaAtributos("Ficha del caso de uso CU-06", ["Atributo","Detalle"], [
      ["Actores", "Visitante; Google OAuth; GitHub OAuth"],
      ["Módulo / Componentes", "Web: `Login.tsx`, `UserMenu.tsx`, `lib/auth.ts`. API: `GET /api/auth/:provider/login`, `/callback`. Seguridad: `TokenCipher`. Persistencia: `Database`"],
      ["Requerimientos relacionados", "RF-13; RNF-04, RNF-11"],
    ]),
    parrafo("Flujo OAuth 2.0 *authorization code* implementado sin librerías externas: `state` ligado a la sesión, PKCE S256 en Google, intercambio del código en el servidor, resolución del usuario (identidad, sesión o correo verificado), cifrado del token de GitHub, transferencia de los escaneos anónimos y rotación del identificador de sesión."),
    ...figuraAPA("Diagrama de secuencia del CU-06", "fd04-06.png"),
    h2("Secuencia de CU-07: Revisar mis repositorios de GitHub"),
    ...tablaAtributos("Ficha del caso de uso CU-07", ["Atributo","Detalle"], [
      ["Actores", "Usuario registrado; GitHub"],
      ["Módulo / Componentes", "Web: `GithubRepos.tsx`. API: `GET /api/auth/me`, `GET /api/github/repos`, `POST /api/scans`. Infraestructura: `listGithubRepos`, `githubTokenOf`"],
      ["Requerimientos relacionados", "RF-14, RF-02; RNF-04, RNF-05"],
    ]),
    parrafo("Con la identidad de GitHub vinculada, la API lista los repositorios del usuario (incluidos privados) con su token cifrado y, al elegir uno, reutiliza el flujo técnico del CU-02."),
    ...figuraAPA("Diagrama de secuencia del CU-07", "fd04-07.png"),
    h2("Secuencia de CU-08: Consultar, comparar y eliminar revisiones del historial"),
    ...tablaAtributos("Ficha del caso de uso CU-08", ["Atributo","Detalle"], [
      ["Actores", "Visitante / Usuario registrado"],
      ["Módulo / Componentes", "Web: `History.tsx`, `Compare.tsx`. API: `GET /api/scans`, `GET /api/scans/:id`, `DELETE /api/scans/:id`. Persistencia: `Database.listScans`, `deleteScan`, `ownerKey`"],
      ["Requerimientos relacionados", "RF-15, RF-16, RF-17; RNF-05"],
    ]),
    parrafo("El historial se filtra por la clave de dueño (`user:<id>` o `anon:<sesión>`). La comparación se calcula en el cliente a partir de dos reportes (fallas nuevas, corregidas y persistentes) y el borrado solo procede si el solicitante es el dueño."),
    ...figuraAPA("Diagrama de secuencia del CU-08", "fd04-08.png"),
    h2("Secuencia de CU-09: Revisión automática en cada cambio"),
    ...tablaAtributos("Ficha del caso de uso CU-09", ["Atributo","Detalle"], [
      ["Actores", "Revisión automática (GitHub Actions); bases de avisos"],
      ["Módulo / Componentes", "CI: `.github/workflows/ci.yml`. CLI: `apps/cli` (`readProjectDirectory`, `shouldFail`). Núcleo: `scanProject`, `renderHtml`"],
      ["Requerimientos relacionados", "RF-18; RNF-10"],
    ]),
    parrafo("El flujo de integración continua compila el proyecto y ejecuta la CLI sobre el propio repositorio con `--fail-on`. La CLI lee los manifiestos del disco, usa el mismo núcleo que la API y termina con código de salida 1 cuando existe una falla igual o más grave que el umbral, lo que detiene la entrega."),
    ...figuraAPA("Diagrama de secuencia del CU-09", "fd04-09.png"),
    h2("Secuencia de CU-10: Cerrar sesión o desconectar GitHub"),
    ...tablaAtributos("Ficha del caso de uso CU-10", ["Atributo","Detalle"], [
      ["Actores", "Usuario registrado"],
      ["Módulo / Componentes", "Web: `UserMenu.tsx`, `GithubRepos.tsx`. API: `POST /api/auth/logout`, `DELETE /api/auth/github`. Persistencia: `deleteSession`, `clearIdentityToken`"],
      ["Requerimientos relacionados", "RF-20; RNF-04"],
    ]),
    parrafo("El cierre de sesión elimina el registro de sesión y la cookie; la desconexión de GitHub borra el token cifrado de la identidad sin eliminar la cuenta ni el historial."),
    ...figuraAPA("Diagrama de secuencia del CU-10", "fd04-10.png"),
    salto(),

    h1("III. VISTA LÓGICA"),
    h2("1. Estilo Arquitectónico"),
    parrafo("DepScan adopta un **monolito modular cliente-servidor** cuyo núcleo sigue la **arquitectura hexagonal (puertos y adaptadores)**. La SPA en React consume una API REST en Fastify; ambas se sirven desde el mismo proceso. El núcleo (`packages/core`) concentra las reglas del dominio y no depende de ninguna tecnología de entrada o salida: define puertos que implementan los adaptadores de infraestructura."),
    parrafo("Se eligió este estilo porque permite reutilizar el mismo motor en la web, la CLI y el benchmark; probarlo sin red; y desplegar un único servicio, lo que reduce el costo y la operación (ver ADR-06 y ADR-07)."),
    h2("2. Diagrama de Paquetes"),
    parrafo("El sistema se organiza en capas concéntricas: el dominio y los casos de uso no dependen de ninguna tecnología de entrada/salida."),
    ...figuraAPA("Diagrama de paquetes del sistema", "fd04-11.png"),
    h2("3. Descripción de las Capas"),
    ...tablaAPA("Descripción de las Capas", ["Capa","Responsabilidad","Componentes"], [894,4264,3868], [
      ["Presentación", "Interacción con el usuario: carga de archivos, resultados, remediación, historial, login; y ejecución por consola.", "`apps/web` (páginas, componentes, `lib/api`), `apps/cli`"],
      ["Aplicación", "Exponer la API REST, validar entradas, autenticar, controlar acceso por dueño, generar PDF y servir la SPA.", "`apps/api` (`app.ts`, `auth/`, `report/pdf`)"],
      ["Dominio (núcleo)", "Resolver versiones, detectar y deduplicar avisos, calcular severidad, riesgo y remediación, y generar reportes.", "`packages/core` (`scan.ts`, `domain`, `analysis`, `versions`, `parsers`, `resolver`, `report`)"],
      ["Infraestructura", "Acceso a servicios externos y persistencia mediante adaptadores de los puertos del núcleo.", "`OsvClient`, `NvdClient`, `RegistryClient`, `github-source`, `Database` (SQLite)"],
    ]),
    h2("4. Diagrama de Clases de Dominio"),
    parrafo("El reporte de escaneo (`ScanReport`) es la raíz del agregado: contiene el objetivo analizado, el resumen, las dependencias y los hallazgos; cada hallazgo agrupa los avisos deduplicados de una dependencia y su remediación."),
    ...figuraAPA("Diagrama de clases de dominio", "fd04-12.png"),
    ...tablaAPA("Diagrama de Clases de Dominio", ["Entidad","Descripción"], [1268,7758], [
      ["`ScanReport`", "Resultado completo de un escaneo, con fecha, versión del escáner y duración."],
      ["`ScanTarget`", "Proyecto analizado: nombre, origen (archivos o GitHub), commit y rama."],
      ["`Dependency`", "Librería con su ecosistema, versión declarada y resuelta, forma de resolución y cadena de dependencia."],
      ["`Finding`", "Hallazgo de una dependencia vulnerable: severidad máxima, versión mínima segura y riesgo."],
      ["`Vulnerability`", "Aviso normalizado y deduplicado, con alias, CVSS, versiones corregidas y CWE."],
      ["`Remediation`", "Versión recomendada, alternativas seguras, comandos, fragmentos y mitigaciones."],
      ["`ScanSummary`", "Totales por tipo de dependencia y por severidad, y semáforo de riesgo."],
    ]),
    h2("5. Diagrama de Interfaces de la Capa de Servicios"),
    parrafo("Los puertos del núcleo son los contratos de la capa de servicios; cada uno tiene uno o más adaptadores intercambiables."),
    ...figuraAPA("Diagrama de interfaces (puertos y adaptadores)", "fd04-13.png"),
    ...tablaAPA("Diagrama de Interfaces de la Capa de Servicios", ["Interfaz (puerto)","Contrato","Adaptadores"], [1283,5629,2114], [
      ["`VulnSource`", "Consultar avisos en lote, el detalle de un aviso y todos los avisos de un paquete.", "`OsvClient`"],
      ["`CveEnricher`", "Obtener el CVSS oficial de un CVE.", "`NvdClient` (con `RateLimiter`)"],
      ["`RegistrySource`", "Listar las versiones publicadas de un paquete.", "`RegistryClient` (npm y PyPI)"],
      ["`Cache`", "Leer y escribir valores con tiempo de vida.", "`MemoryCache`, caché SQLite"],
    ]),
    ...tablaAPA("Interfaz REST de la API", ["Método","Ruta","Responsabilidad","Acceso"], [862,3001,3508,1655], [
      ["POST", "`/api/scans`", "Escanear archivos (`files`) o repositorio (`github`)", "Público, 20/min por IP"],
      ["GET", "`/api/scans`", "Historial del dueño actual", "Sesión"],
      ["GET", "`/api/scans/:id`", "Reporte completo", "Dueño si es privado"],
      ["GET", "`/api/scans/:id/report.html` · `.pdf`", "Descargas", "Dueño si es privado"],
      ["DELETE", "`/api/scans/:id`", "Eliminar", "Solo dueño"],
      ["GET", "`/api/vulns/:id`", "Detalle OSV (con caché)", "Público"],
      ["GET", "`/api/auth/me`", "Usuario, proveedores y estado de GitHub", "Público"],
      ["GET", "`/api/auth/:provider/login` · `/callback`", "Flujo OAuth", "Público"],
      ["POST", "`/api/auth/logout` · DELETE `/api/auth/github`", "Cerrar sesión / desconectar", "Sesión"],
      ["GET", "`/api/github/repos`", "Repositorios del usuario", "Usuario con GitHub"],
      ["GET", "`/api/health`", "Healthcheck de Railway", "Público"],
    ]),
    salto(),

    h1("IV. VISTA DE PROCESOS"),
    parrafo("DepScan se ejecuta como un único proceso Node.js. Las operaciones de entrada/salida son asíncronas y la concurrencia hacia servicios externos se limita con `mapLimit` para respetar sus cuotas."),
    ...figuraAPA("Pipeline de escaneo", "fd04-14.png"),
    parrafo("**Algoritmo de versiones seguras.** Para un paquete *p* con versiones estables *V* y avisos *A*, la versión *v* es segura si para todo *a ∈ A* `isAffected(v, a.affected) = false`. La evaluación recorre los eventos OSV ordenados: `introduced` abre el intervalo, `fixed` lo cierra de forma exclusiva y `last_affected` de forma inclusiva. La recomendada es `max{v ∈ seguras : v > actual ∧ mayor(v) = mayor(actual)}`; si no existe, `min{v ∈ seguras : v > actual}` marcada como `breaking`."),
    ...figuraAPA("Autenticación OAuth", "fd04-15.png"),
    parrafo("\\* PKCE se aplica en Google; en GitHub la protección es `state` + secreto de cliente."),
    ...tablaAPA("VISTA DE PROCESOS", ["Proceso","Tipo","Concurrencia / periodicidad"], [3096,2351,3579], [
      ["Atención de solicitudes HTTP", "Asíncrono (bucle de eventos)", "Ilimitado, con 20 escaneos/min por IP"],
      ["Detalle de avisos OSV", "Asíncrono con caché", "8 en paralelo, caché 24 h"],
      ["Remediación por paquete", "Asíncrono con caché", "6 en paralelo"],
      ["Descarga de manifiestos de GitHub", "Asíncrono", "6 en paralelo, máx. 100 archivos"],
      ["Enriquecimiento NVD", "Secuencial limitado", "5 (o 50 con clave) solicitudes cada 30 s"],
      ["Purga de caché y sesiones vencidas", "Temporizador", "Cada 6 horas"],
    ]),
    salto(),

    h1("V. VISTA DE DESPLIEGUE"),
    parrafo("El sistema se despliega como un único contenedor en Railway con un volumen persistente; el navegador y la integración continua son los clientes, y OSV, NVD, los registros, GitHub y Google son servicios externos consumidos por HTTPS."),
    ...figuraAPA("Diagrama de despliegue", "fd04-16.png"),
    ...tablaAPA("Pipeline de construcción (Dockerfile multi-etapa)", ["Etapa","Acción"], [885,8141], [
      ["`build`", "Copia los `package.json` (capa cacheable), `npm ci`, copia el código, `npm run build` (`tsc -b` + `vite build`), `npm prune --omit=dev`."],
      ["`runtime`", "Copia solo `node_modules` de producción y los `dist/` de core, api, cli y web. `CMD node --disable-warning=ExperimentalWarning apps/api/dist/server.js`."],
    ]),
    ...tablaAPA("Configuración (variables de entorno)", ["Variable","Uso","Obligatoria"], [2470,5137,1419], [
      ["`PORT`", "Puerto HTTP (inyectado por Railway)", "Sí (automática)"],
      ["`DATA_DIR`", "Ruta del volumen (`/data`)", "Sí"],
      ["`SESSION_SECRET`", "Derivación de clave AES para tokens OAuth", "Sí, con login"],
      ["`GOOGLE_CLIENT_ID/SECRET`", "OAuth Google", "Opcional"],
      ["`GITHUB_CLIENT_ID/SECRET`", "OAuth GitHub", "Opcional"],
      ["`PUBLIC_URL`", "URL de retorno OAuth (por defecto `RAILWAY_PUBLIC_DOMAIN`)", "No"],
      ["`NVD_API_KEY`, `GITHUB_TOKEN`", "Límites de API ampliados", "No"],
    ]),
    parrafo("**Ciclo de vida.** Railway espera a que `/api/health` responda (timeout 60 s) antes de enrutar tráfico a la nueva versión y envía `SIGTERM` a la anterior; el servidor cierra Fastify y la base de datos ordenadamente. Política de reinicio `ON_FAILURE` con 5 reintentos."),
    salto(),

    h1("VI. VISTA DE IMPLEMENTACIÓN"),
    parrafo("El código se organiza como un monorepo de npm workspaces; cada paquete se compila con `tsc -b` y *project references*, lo que fija los límites de dependencia entre ellos."),
    ...figuraAPA("Diagrama de componentes", "fd04-17.png"),
    ...tablaAPA("VISTA DE IMPLEMENTACIÓN", ["Carpeta","Componente lógico","Contenido principal"], [2166,1590,5270], [
      ["`packages/core/src/parsers`", "Parsers", "Lectura de `package.json`, `package-lock.json` (v1–v3) y `requirements*.txt`"],
      ["`packages/core/src/versions`", "Comparadores", "SemVer y PEP 440 propios (fachada `index.ts`)"],
      ["`packages/core/src/resolver`", "Resolución", "Versión exacta: lockfile, pin exacto, estimación o desconocida"],
      ["`packages/core/src/sources`", "Puertos y adaptadores", "`ports.ts`, `OsvClient`, `NvdClient`, `RegistryClient`, `github-source`, `httpJson`"],
      ["`packages/core/src/analysis`", "Análisis", "Deduplicación, CVSS, rangos afectados, CWE y remediación"],
      ["`packages/core/src/report`", "Reportes", "HTML y texto"],
      ["`packages/core/src/scan.ts`", "Orquestador", "Pipeline `scanProject`"],
      ["`apps/api/src`", "Aplicación", "`app.ts` (rutas), `auth/`, `db.ts`, `report/` (PDF), `server.ts`"],
      ["`apps/web/src`", "Presentación web", "`pages/`, `components/`, `lib/`"],
      ["`apps/cli/src`", "Presentación CLI", "`index.ts`"],
      ["`benchmark/`", "Validación", "Comparación contra `npm audit`"],
    ]),
    salto(),

    h1("VII. VISTA DE DATOS"),
    parrafo("La persistencia usa SQLite con cinco tablas. Un usuario puede tener varias identidades (Google y GitHub); los escaneos pertenecen a un usuario o, si no inició sesión, a una sesión anónima."),
    ...figuraAPA("Modelo entidad-relación", "fd04-18.png"),
    ...tablaAPA("VISTA DE DATOS", ["Tabla","Propósito"], [943,8083], [
      ["`users`", "Cuenta de usuario con correo, nombre y avatar."],
      ["`identities`", "Identidad por proveedor (Google o GitHub); guarda el token de GitHub cifrado."],
      ["`sessions`", "Sesiones activas; el identificador es el hash SHA-256 del token de la cookie."],
      ["`scans`", "Escaneos con su resumen, el reporte completo en JSON, el dueño y la marca de privado."],
      ["`cache`", "Respuestas de servicios externos con fecha de expiración."],
    ]),
    parrafo("Las migraciones son versionadas con `PRAGMA user_version` y se aplican en una transacción al iniciar. El modo `WAL` mejora la lectura concurrente; la tabla `cache` se purga cada 6 horas junto con las sesiones vencidas."),
    salto(),

    h1("VIII. PATRONES DE DISEÑO APLICADOS"),
    ...tablaAPA("PATRONES DE DISEÑO APLICADOS", ["Patrón","Dónde","Propósito"], [1914,3065,4047], [
      ["**Arquitectura hexagonal (puertos y adaptadores)**", "`packages/core/src/sources/ports.ts` y adaptadores", "El dominio no conoce HTTP ni SQLite; las fuentes se sustituyen por dobles en las pruebas."],
      ["**Inyección de dependencias**", "`scanProject(files, sources, opts)`, `buildApp({ sources, fetchImpl })`", "Probar el pipeline y el OAuth completos sin red."],
      ["**Pipeline**", "`scan.ts`", "Etapas encadenadas con progreso (`onProgress`)."],
      ["**Fachada**", "`versions/index.ts` (`compareVersions`, `satisfies`, `maxSatisfying`)", "Ocultar la diferencia entre semver y PEP 440 al resto del motor."],
      ["**Estrategia**", "Comparador según ecosistema; formato de reporte (HTML, texto, PDF, JSON)", "Elegir el algoritmo en tiempo de ejecución."],
      ["**Repositorio**", "Clase `Database` (`saveScan`, `listScans`, `getIdentity`…)", "Aislar el acceso a datos; facilita migrar a PostgreSQL."],
      ["**Decorador / Cache-aside**", "`cached(cache, key, ttl, load)`", "Añadir caché a cualquier consulta externa."],
      ["**Retry con backoff**", "`httpJson`", "Tolerar errores 429/5xx transitorios."],
      ["**Rate limiter (ventana deslizante)**", "`RateLimiter` para NVD; `@fastify/rate-limit` en la API", "Respetar cuotas externas y proteger el servicio."],
      ["**Union-Find**", "`dedupe()`", "Agrupar avisos que comparten alias de forma transitiva."],
      ["**SPA con enrutado por hash**", "`lib/router.ts`", "Rutas del cliente sin configuración del servidor."],
      ["**Monorepo con *project references***", "`tsc -b`", "Compilación incremental y límites claros entre paquetes."],
    ]),
    salto(),

    h1("IX. DECISIONES ARQUITECTÓNICAS"),
    parrafo("Las decisiones se registran con el formato ADR (Contexto, Decisión y Consecuencias). Las versiones completas de ADR-01, ADR-02, ADR-07, ADR-09 y ADR-10 se encuentran en `docs/decisiones/` del repositorio."),
    h2("ADR-01: OSV como fuente principal y NVD solo para enriquecer por CVE"),
    h3("Contexto"),
    parrafo("Se necesita una base de vulnerabilidades consultable por paquete y versión para npm y PyPI. NVD busca por CPE, con cobertura pobre para paquetes de npm, y sin clave permite solo 5 solicitudes cada 30 segundos."),
    h3("Decisión"),
    parrafo("OSV es la fuente de verdad: `/v1/querybatch` (hasta 1000 consultas por lote) y `/v1/vulns/{id}` para el detalle. NVD se consulta solo por identificador CVE para obtener el CVSS oficial, es opcional y respeta su límite de uso. La severidad se toma en el orden: CVSS de NVD, CVSS 3.x calculado desde el vector de OSV, etiqueta de GHSA y \"sin dato\". Se descartaron NVD por nombre de paquete y la consulta directa a GitHub Advisory Database."),
    h3("Consecuencias"),
    parrafo("Un proyecto de 1000 dependencias se resuelve con una llamada en lote más una llamada por aviso único, con caché. La calculadora CVSS 3.x es código propio y probado. CVSS 4.0 no se calcula localmente; si OSV solo trae ese vector, se usa la etiqueta de GHSA o NVD."),
    h2("ADR-02: Comparadores de versiones propios (semver y PEP 440)"),
    h3("Contexto"),
    parrafo("Para resolver rangos sin lockfile, decidir si una versión cae en un rango afectado y calcular versiones seguras es necesario comparar versiones de npm (SemVer 2.0.0 y rangos de npm) y de Python (PEP 440)."),
    h3("Decisión"),
    parrafo("Se implementaron `semver.ts` y `pep440.ts` en `packages/core/src/versions/`, con rangos `^`, `~`, x-ranges, guiones y `||`, y especificadores `==`, `!=`, `~=`, `>=`, `<=`, `>`, `<`, `===` y `.*`. Se descartó el uso de la librería `semver` y de un port de `packaging`."),
    h3("Consecuencias"),
    parrafo("El núcleo mantiene cero dependencias de runtime y las pruebas usan los casos de las especificaciones oficiales. El riesgo de casos borde no cubiertos se mitiga con el benchmark contra `npm audit`."),
    h2("ADR-03: TypeScript en todo el stack"),
    h3("Contexto"),
    parrafo("El proyecto debe desarrollarse solo con Visual Studio Code, con frontend en React, y la web debe mostrar exactamente los tipos que produce el motor."),
    h3("Decisión"),
    parrafo("Se usa TypeScript (ESM, modo `strict`) en el núcleo, la API, la CLI y la web, organizado como monorepo con npm workspaces y *project references*. Se descartaron Python o Java para el backend."),
    h3("Consecuencias"),
    parrafo("Los tipos del dominio se comparten sin duplicación (la web los importa con `import type`), hay una sola cadena de herramientas (`tsc`, ESLint, Prettier, Vitest) y la compilación es incremental."),
    h2("ADR-04: Fastify como framework HTTP"),
    h3("Contexto"),
    parrafo("La API necesita validación estricta de entradas, limitación de tasa, cookies y servir la SPA, con bajo consumo de memoria en un plan pequeño de Railway."),
    h3("Decisión"),
    parrafo("Se eligió Fastify 5 con `@fastify/cookie`, `@fastify/rate-limit` y `@fastify/static`, y validación por JSON Schema. Se descartaron Express y NestJS."),
    h3("Consecuencias"),
    parrafo("Validación declarativa con `additionalProperties: false`, buen rendimiento y pocas dependencias. A cambio, la estructura modular debe mantenerse por convención, sin el andamiaje de un framework mayor."),
    h2("ADR-05: SQLite nativo en volumen persistente"),
    h3("Contexto"),
    parrafo("Se debe persistir el historial, las sesiones, las identidades y la caché de consultas externas con el menor costo de operación posible."),
    h3("Decisión"),
    parrafo("Se usa `node:sqlite` (`DatabaseSync`) en modo WAL sobre el volumen `/data` de Railway, con migraciones versionadas por `PRAGMA user_version`. Se descartó PostgreSQL por requerir un servicio adicional."),
    h3("Consecuencias"),
    parrafo("No hay servidor de base de datos que administrar ni costo extra. La restricción es operar con una sola réplica; el acceso está aislado en la clase `Database` (patrón repositorio), lo que permite migrar a PostgreSQL si el uso crece."),
    h2("ADR-06: Arquitectura hexagonal en el núcleo"),
    h3("Contexto"),
    parrafo("El mismo motor de análisis debe servir a la API, a la CLI y al benchmark, y debe poder probarse sin acceso a red."),
    h3("Decisión"),
    parrafo("El núcleo define puertos (`VulnSource`, `CveEnricher`, `RegistrySource`, `Cache`) y recibe sus adaptadores por inyección de dependencias (`scanProject(files, sources, opts)`). Se descartó ubicar la lógica dentro de la API."),
    h3("Consecuencias"),
    parrafo("El núcleo no conoce HTTP ni SQLite; las 97 pruebas automatizadas sustituyen las fuentes por dobles. Agregar una nueva fuente de avisos solo requiere un adaptador nuevo."),
    h2("ADR-07: Despliegue como un solo servicio en Railway"),
    h3("Contexto"),
    parrafo("El sistema tiene una API, una web estática y necesita persistir datos; se despliega en Railway."),
    h3("Decisión"),
    parrafo("Una sola imagen Docker multi-etapa: Fastify sirve `/api/*` y el build de React en `/`, con healthcheck en `/api/health`, cierre ordenado ante `SIGTERM` y `trustProxy` para obtener la IP real. Se descartaron dos servicios separados y Nixpacks sin Dockerfile."),
    h3("Consecuencias"),
    parrafo("Un solo dominio, sin configuración CORS y con un único despliegue por `git push`. El contenedor se ejecuta como root por los permisos del volumen montado."),
    h2("ADR-08: Escaneo de repositorios de GitHub por commit exacto"),
    h3("Contexto"),
    parrafo("En un servidor no existe la carpeta local del usuario, y un resultado debe poder reproducirse aunque el repositorio cambie después."),
    h3("Decisión"),
    parrafo("Se agregó el escaneo de repositorios de GitHub: se fija el SHA del commit de la rama solicitada y se descargan solo los manifiestos de ese commit. Se descartó admitir únicamente la subida de archivos."),
    h3("Consecuencias"),
    parrafo("Cada reporte de GitHub registra el commit analizado, lo que lo hace reproducible y verificable. Se depende de la disponibilidad y de los límites de la API de GitHub (60 solicitudes por hora sin token)."),
    h2("ADR-09: OAuth propio con Google y GitHub"),
    h3("Contexto"),
    parrafo("Se requiere iniciar sesión con Google y GitHub y acceder a repositorios privados, sin manejar contraseñas."),
    h3("Decisión"),
    parrafo("Flujo OAuth 2.0 *authorization code* implementado en `apps/api/src/auth/` con `fetch` nativo, `state` contra CSRF y PKCE S256 en Google. Sesión opaca en cookie `HttpOnly`/`SameSite=Lax`/`Secure` cuyo hash SHA-256 se guarda en la base; token de GitHub cifrado con AES-256-GCM. Se descartaron Passport/Auth.js y una GitHub App."),
    h3("Consecuencias"),
    parrafo("Sin credenciales configuradas, la aplicación funciona sin login. Si cambia `SESSION_SECRET`, los tokens guardados dejan de servir y el usuario debe reconectar GitHub. GitHub requiere el scope `repo`, más amplio que solo lectura."),
    h2("ADR-10: Versiones seguras verificadas contra todos los avisos"),
    h3("Contexto"),
    parrafo("No basta con indicar que una librería es vulnerable: se debe recomendar a qué versión pasar, listar todas las versiones seguras e indicar cómo protegerse si no se puede actualizar."),
    h3("Decisión"),
    parrafo("El módulo `remediation.ts` obtiene todos los avisos del paquete y todas sus versiones publicadas, y evalúa cada versión estable contra todos los avisos. La recomendada es la más nueva sin fallas dentro de la misma versión mayor; si no existe, la mínima segura, marcada como salto mayor. Se descartó usar solo la versión \"fixed\" de un aviso aislado."),
    h3("Consecuencias"),
    parrafo("Se hacen N consultas extra a OSV y N al registro por cada paquete vulnerable (concurrencia 6 y caché); en NodeGoat, unos 18 segundos la primera vez. \"Seguro\" significa \"sin avisos conocidos hoy\", y el reporte lo declara."),
    h2("ADR-11: Generación de PDF con pdfkit"),
    h3("Contexto"),
    parrafo("El usuario y el docente necesitan un informe PDF descargable como evidencia formal."),
    h3("Decisión"),
    parrafo("El PDF se genera en el servidor con pdfkit, dibujando directamente el contenido del reporte. Se descartó Chrome headless."),
    h3("Consecuencias"),
    parrafo("La imagen del contenedor es mucho más liviana y el consumo de memoria es bajo. El diseño del PDF se programa a mano y no reutiliza los estilos del HTML."),
    h2("Decisiones de seguridad"),
    ...tablaAPA("Decisiones de seguridad", ["Amenaza","Control"], [2543,6483], [
      ["CSRF en OAuth", "Parámetro `state` aleatorio ligado a la sesión, con expiración de 10 minutos."],
      ["Robo del código de autorización", "PKCE S256 (Google) y secreto de cliente en el servidor."],
      ["Fijación de sesión", "Rotación del token de sesión tras autenticar."],
      ["Robo de cookies", "`HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS; en la base solo se guarda el SHA-256 del token."],
      ["Fuga de tokens OAuth", "AES-256-GCM con clave derivada de `SESSION_SECRET`."],
      ["Redirección abierta", "`returnTo` solo acepta rutas internas (`/…`, nunca `//`)."],
      ["Acceso a escaneos ajenos", "`owner` y `private` validados en cada lectura y borrado."],
      ["*Path traversal* en archivos subidos", "Normalización de rutas y lista blanca de nombres de manifiestos."],
      ["Abuso del servicio", "20 escaneos/min por IP, `bodyLimit` 25 MB, máx. 200 archivos."],
      ["Vinculación indebida de cuentas", "Unión por email solo si el proveedor lo marca como verificado."],
    ]),
    salto(),

    h1("X. ATRIBUTOS DE CALIDAD"),
    ...tablaAPA("ATRIBUTOS DE CALIDAD", ["Atributo","Escenario","Métrica / Criterio"], [1615,3391,4020], [
      ["Rendimiento (RNF-01)", "Se escanea un proyecto de más de 1000 dependencias con remediación.", "Menos de 60 s; consulta OSV en un solo lote."],
      ["Usabilidad (RNF-02)", "Un estudiante revisa su proyecto por primera vez.", "Máximo tres pasos; interfaz en español."],
      ["Adaptabilidad (RNF-03)", "Se abre el resultado en un celular.", "Diseño responsivo con Tailwind; modo claro y oscuro."],
      ["Seguridad (RNF-04)", "Un atacante intenta robar la sesión o el token de GitHub.", "Cookie `HttpOnly`/`Secure`, hash SHA-256 de sesión, AES-256-GCM, `state` y PKCE."],
      ["Privacidad (RNF-05)", "Un tercero intenta abrir el escaneo de un repositorio privado.", "Respuesta 404; solo se leen manifiestos."],
      ["Disponibilidad (RNF-06)", "El proceso falla o se publica una nueva versión.", "Healthcheck `/api/health`, reinicio `ON_FAILURE` (5 intentos), cierre ordenado."],
      ["Corrección (RNF-07)", "No hay lockfile para una dependencia.", "Se marca \"no determinable\" o \"estimada\"; nunca se inventa una versión."],
      ["Trazabilidad (RNF-08)", "Un docente verifica un informe semanas después.", "Fecha, versión del escáner y SHA del commit en cada reporte."],
      ["Protección del servicio (RNF-09)", "Un cliente envía escaneos masivos.", "20 escaneos/min por IP, cuerpo máx. 25 MB, máx. 200 archivos."],
      ["Mantenibilidad (RNF-10)", "Se modifica el comparador de versiones.", "97 pruebas automatizadas, lint y typecheck en CI antes de desplegar."],
      ["Cumplimiento (RNF-11)", "Se almacenan datos de una cuenta.", "Solo correo, nombre y avatar; tratamiento según la Ley N.º 29733."],
    ]),
    salto(),

    h1("CONCLUSIONES"),
    ...numerada([
      "Los **10 casos de uso** de FD03 tienen su realización técnica con diagrama de secuencia propio, trazada a rutas, componentes y funciones reales del código.",
      "La **arquitectura hexagonal** aísla el motor de análisis de toda tecnología externa; gracias a ello, el mismo núcleo sirve a la API, a la CLI y al benchmark, y se prueba completamente sin acceso a red (97 pruebas).",
      "El **pipeline de escaneo** combina consulta en lote, concurrencia limitada y caché persistente, lo que permite analizar proyectos de más de 1000 dependencias en segundos.",
      "El diseño de la **remediación** es la principal contribución técnica: evalúa cada versión publicada contra todos los avisos del paquete, en lugar de confiar en la versión \"corregida\" de un aviso aislado.",
      "La **seguridad** se abordó por capas: OAuth con `state` y PKCE, sesiones opacas hasheadas, tokens cifrados, control de acceso por dueño y limitación de tasa.",
      "El **despliegue** en un único contenedor con volumen persistente reduce la operación a un `git push`, con healthcheck y cierre ordenado. La principal restricción, el uso de una sola réplica por SQLite, está aislada en la clase `Database`, lo que permite migrar a PostgreSQL si el uso crece.",
    ]),
    salto(),

    h1("RECOMENDACIONES"),
    ...numerada([
      "Migrar la persistencia a PostgreSQL cuando se requiera más de una réplica; el cambio se limita a la clase `Database`.",
      "Sustituir la OAuth App de GitHub por una GitHub App para obtener permisos de solo lectura más finos sobre los repositorios.",
      "Incorporar nuevos ecosistemas (Maven, Go, Cargo) agregando parsers y comparadores de versiones, sin modificar el resto del núcleo.",
      "Implementar el cálculo local de CVSS 4.0 cuando su adopción en OSV sea mayoritaria.",
      "Agregar análisis de alcanzabilidad para reducir los falsos positivos de dependencias que no se ejecutan.",
      "Ejecutar el contenedor con un usuario sin privilegios cuando Railway permita ajustar los permisos del volumen.",
    ]),
    salto(),

    h1("BIBLIOGRAFÍA"),
    ref("Bass, L., Clements, P., y Kazman, R. (2021). *Software architecture in practice* (4.ª ed.). Addison-Wesley."),
    ref("Cockburn, A. (2005). Hexagonal architecture. En *Alistair Cockburn*. https://alistair.cockburn.us/hexagonal-architecture/"),
    ref("Kruchten, P. (1995). The 4+1 view model of architecture. *IEEE Software*, *12*(6), 42–50. https://doi.org/10.1109/52.469759"),
    ref("Kruchten, P. (2003). *The Rational Unified Process: An introduction* (3.ª ed.). Addison-Wesley."),
    salto(),

    h1("WEBGRAFÍA"),
    ref("Fastify. (2026). *Fastify documentation*. https://fastify.dev/docs/latest/"),
    ref("Google. (2026). *OSV API*. Open Source Vulnerabilities. https://google.github.io/osv.dev/api/"),
    ref("IETF. (2015). *RFC 7636: Proof Key for Code Exchange by OAuth Public Clients*. https://www.rfc-editor.org/rfc/rfc7636"),
    ref("National Institute of Standards and Technology. (2026). *NVD CVE API 2.0*. https://nvd.nist.gov/developers/vulnerabilities"),
    ref("OWASP Foundation. (2021). *A06:2021 – Vulnerable and Outdated Components*. https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/"),
    ref("Railway. (2026). *Railway documentation*. https://docs.railway.com/"),
  ];
}

// páginas de cada título para el índice precargado
const PAGINAS = {
  "INTRODUCCIÓN": "",
  "1. Propósito": "",
  "2. Alcance": "",
  "3. Definiciones, Acrónimos y Abreviaturas": "",
  "4. Referencias": "",
  "I. REPRESENTACIÓN ARQUITECTÓNICA": "",
  "Metas y Restricciones Arquitectónicas": "",
  "II. VISTA DE CASOS DE USO": "",
  "Secuencia de CU-01: Revisar un proyecto subiendo sus archivos": "",
  "Secuencia de CU-02: Revisar un repositorio de GitHub": "",
  "Secuencia de CU-03: Consultar el resultado y el detalle de las fallas": "",
  "Secuencia de CU-04: Ver la solución de una librería": "",
  "Secuencia de CU-05: Descargar el informe": "",
  "Secuencia de CU-06: Iniciar sesión y unir cuentas": "",
  "Secuencia de CU-07: Revisar mis repositorios de GitHub": "",
  "Secuencia de CU-08: Consultar, comparar y eliminar revisiones del historial": "",
  "Secuencia de CU-09: Revisión automática en cada cambio": "",
  "Secuencia de CU-10: Cerrar sesión o desconectar GitHub": "",
  "III. VISTA LÓGICA": "",
  "1. Estilo Arquitectónico": "",
  "2. Diagrama de Paquetes": "",
  "3. Descripción de las Capas": "",
  "4. Diagrama de Clases de Dominio": "",
  "5. Diagrama de Interfaces de la Capa de Servicios": "",
  "IV. VISTA DE PROCESOS": "",
  "V. VISTA DE DESPLIEGUE": "",
  "VI. VISTA DE IMPLEMENTACIÓN": "",
  "VII. VISTA DE DATOS": "",
  "VIII. PATRONES DE DISEÑO APLICADOS": "",
  "IX. DECISIONES ARQUITECTÓNICAS": "",
  "ADR-01: OSV como fuente principal y NVD solo para enriquecer por CVE": "",
  "ADR-02: Comparadores de versiones propios (semver y PEP 440)": "",
  "ADR-03: TypeScript en todo el stack": "",
  "ADR-04: Fastify como framework HTTP": "",
  "ADR-05: SQLite nativo en volumen persistente": "",
  "ADR-06: Arquitectura hexagonal en el núcleo": "",
  "ADR-07: Despliegue como un solo servicio en Railway": "",
  "ADR-08: Escaneo de repositorios de GitHub por commit exacto": "",
  "ADR-09: OAuth propio con Google y GitHub": "",
  "ADR-10: Versiones seguras verificadas contra todos los avisos": "",
  "ADR-11: Generación de PDF con pdfkit": "",
  "Decisiones de seguridad": "",
  "X. ATRIBUTOS DE CALIDAD": "",
  "CONCLUSIONES": "",
  "RECOMENDACIONES": "",
  "BIBLIOGRAFÍA": "",
  "WEBGRAFÍA": "",
};

// ================== DOCUMENTO ==================
const doc = new Document({
  features: { updateFields: true },  // Word pide actualizar el índice al abrir -> "Sí"
  numbering: { config: [
    { reference: "vinetas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] },
    { reference: "numeros", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] },
  ] },
  styles: {
    default: { document: { run: { font: FONT, size: SIZE } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 24, bold: true, color: "000000" },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: SIZE, bold: true, color: "000000" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: SIZE, bold: true, italics: true, color: "000000" },
        paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 2, keepNext: true } },
      { id: "TOC1", name: "toc 1", basedOn: "Normal", next: "Normal", run: { bold: true }, paragraph: { spacing: { after: 60 } } },
      { id: "TOC2", name: "toc 2", basedOn: "Normal", next: "Normal", paragraph: { indent: { left: 440 }, spacing: { after: 60 } } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 },
      margin: { top: 1440, bottom: 1440, left: 1440, right: 1440, header: 708, footer: 708 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      run(`${SIGLA} — ${PROYECTO}  |  Página `, { size: 14 }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14 }),
      run(" de ", { size: 14 }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14 })] })] }) },
    children: (() => { const c = cuerpo(); return [...caratula(), ...portadaInterna(), ...indice(), ...c]; })(),
  }],
});

Packer.toBuffer(doc).then((b) => { fs.writeFileSync(SALIDA, b); console.log("OK", SALIDA); });
