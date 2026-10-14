// FD05-EPIS-Informe_ProyectoFinal – Informe Final del Proyecto (formato APA 7, según plantilla.js)
// Uso: npm install  &&  node fd05.js   (logo_upt.png e img/ en la misma carpeta)
// Contenido tomado de FD05-EPIS-Informe_ProyectoFinal.md; los diagramas están en img/fd05-NN.png.
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
const INFORME = "Informe Final del Proyecto";
const VERSION = "Versión 1.0";
const FECHA = "14/10/2026";
const ANIO = "2026";
const SIGLA = "IFP";
const LOGO = path.join(__dirname, "logo_upt.png");
const IMG = path.join(__dirname, "img");
const SALIDA = path.join(__dirname, "FD05-EPIS-Informe_ProyectoFinal.docx");

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

    h1("1. Antecedentes"),
    ...tablaAPA("Incidentes que motivan el proyecto", ["Año","Caso","Componente vulnerable","Consecuencia"], [842,883,2808,4493], [
      ["2017", "Equifax", "Apache Struts (CVE-2017-5638)", "Filtración de datos de ~147 millones de personas; el parche existía dos meses antes del ataque."],
      ["2018", "event-stream (npm)", "Dependencia transitiva comprometida (`flatmap-stream`)", "Código malicioso distribuido a millones de descargas, dirigido a billeteras de criptomonedas."],
      ["2021", "Log4Shell", "Apache Log4j (CVE-2021-44228, CVSS 10.0)", "Ejecución remota de código en miles de sistemas en todo el mundo."],
    ]),
    ...tablaAPA("Herramientas existentes", ["Herramienta","Tipo","Limitación principal"], [1481,1586,5959], [
      ["`npm audit`", "CLI, gratuita", "Solo npm; no verifica que la versión sugerida sea segura respecto de otros avisos."],
      ["`pip-audit`", "CLI, gratuita", "Solo PyPI."],
      ["OSV-Scanner (Google)", "CLI, gratuita", "Lista fallas pero no propone una versión segura verificada ni mitigaciones; en inglés."],
      ["Snyk, Mend, Sonatype", "Plataformas comerciales", "Costo por desarrollador; planes gratuitos limitados."],
    ]),
    parrafo("**Antecedente académico.** El planteamiento original del proyecto (documento `proyecto.md`) identificó que reconstruir solo \"leer y consultar\" duplicaría una herramienta gratuita. Por eso el proyecto se justifica en el **motor propio**, la **lógica de remediación** y la **medición de resultados reales** contra herramientas reconocidas."),
    salto(),

    h1("2. Planteamiento del Problema"),
    parrafo("**Problema general.** ¿Cómo detectar, de forma rápida y confiable, las dependencias con vulnerabilidades conocidas en proyectos npm y PyPI, y orientar al desarrollador sobre cómo corregirlas sin introducir nuevas fallas?"),
    parrafo("**Problemas específicos**"),
    ...numerada([
      "Las dependencias transitivas no son visibles en los manifiestos y rara vez se revisan.",
      "Los avisos se publican con varios identificadores (CVE, GHSA, PYSEC), lo que infla y confunde los reportes.",
      "La \"versión corregida\" de un aviso puede estar afectada por otro aviso.",
      "No existe orientación cuando no hay versión corregida o cuando actualizar implica un cambio mayor.",
      "No queda evidencia formal de la revisión para docentes o clientes.",
    ]),
    ...figuraAPA("Árbol de problemas", "fd05-01.png"),
    salto(),

    h1("3. Objetivos"),
    parrafo("**Objetivo general.** Desarrollar un sistema web que detecte dependencias con vulnerabilidades conocidas en proyectos npm y PyPI y proponga acciones de remediación verificadas."),
    ...tablaAPA("Objetivos específicos y grado de cumplimiento", ["N.º","Objetivo específico","Indicador","Resultado","Estado"], [835,2401,1950,2716,1124], [
      ["OE1", "Motor propio de lectura de manifiestos y resolución de versiones", "Soporte lockfile v1/v2/v3, *workspaces*, `requirements.txt`", "Implementado y probado (parsers, resolver, semver, PEP 440)", "Cumplido"],
      ["OE2", "Consulta OSV en lote, NVD opcional y deduplicación", "Lote ≤ 1000; cero duplicados", "Implementado; 4 avisos duplicados de `npm audit` unificados en NodeGoat", "Cumplido"],
      ["OE3", "Remediación verificada", "Versiones evaluadas contra todos los avisos", "133/133 hallazgos de NodeGoat con remediación verificada", "Cumplido"],
      ["OE4", "Interfaz web con login, historial y reportes HTML/PDF", "Flujo completo en producción", "Desplegado en Railway; login con Google y GitHub probado", "Cumplido"],
      ["OE5", "Validación contra herramientas reconocidas", "Benchmark reproducible", "Coincidencia total con `npm audit` en 3 repositorios npm", "Cumplido (PyPI pendiente de comparar)"],
    ]),
    salto(),

    h1("4. Desarrollo de la Solución"),
    parrafo("El proyecto se desarrolló con la metodología **RUP**, organizada en cuatro fases."),
    h2("4.1 Fase de Inicio"),
    ...vinetas([
      "Análisis del planteamiento, del caso Equifax y de las APIs de OSV y NVD.",
      "Estudio de factibilidad (FD01) y documento de visión (FD02).",
      "Decisión de alcance: npm y PyPI, OSV como fuente principal (ADR-01 de FD04).",
    ]),
    h2("4.2 Fase de Elaboración"),
    ...vinetas([
      "Especificación de requerimientos (FD03): 20 RF, 11 RNF, 12 reglas de negocio y 10 casos de uso.",
      "Arquitectura (FD04): monorepo TypeScript con núcleo hexagonal, Fastify, SQLite y React.",
      "Prototipo del motor: comparadores semver y PEP 440 y parsers.",
    ]),
    h2("4.3 Fase de Construcción"),
    ...tablaAPA("Fase de Construcción", ["Iteración","Entregable","Evidencia"], [860,5126,3040], [
      ["C1", "Motor: parsers, resolución de versiones, cliente OSV, deduplicación, CVSS", "83 pruebas iniciales"],
      ["C2", "CLI y reporte de texto/HTML/JSON con código de salida", "Escaneo del propio repositorio"],
      ["C3", "API Fastify + SQLite, historial", "Pruebas de rutas con `inject`"],
      ["C4", "Interfaz React (escaneo, resultados, historial, comparación)", "Build de producción"],
      ["C5", "Remediación: versiones seguras, comandos, *overrides*, mitigaciones por CWE, parches", "Pruebas de remediación con datos reales"],
      ["C6", "Login OAuth Google/GitHub, repositorios privados, reporte PDF", "Flujo OAuth simulado en pruebas y real en producción"],
    ]),
    ...figuraAPA("Arquitectura resultante", "fd05-02.png"),
    h2("4.4 Fase de Transición"),
    ...vinetas([
      "Repositorio publicado en `github.com/Angelhc123/Dep_Test`.",
      "Despliegue en Railway: un servicio Docker con volumen persistente en `/data`, healthcheck y despliegue automático desde la rama `main`.",
      "Configuración de las credenciales OAuth en Google Cloud y GitHub con las URLs de producción.",
      "URL de producción: **https://deptest-production-7f98.up.railway.app**.",
    ]),
    h2("4.5 Resultados"),
    ...tablaAPA("a) Pruebas automatizadas", ["Módulo","Archivo de pruebas","Casos"], [4985,2329,1712], [
      ["Semver", "`semver.test.ts`", "34"],
      ["PEP 440", "`pep440.test.ts`", "19"],
      ["CVSS 3.x", "`cvss.test.ts`", "7"],
      ["Parsers npm y PyPI", "`parsers.test.ts`", "9"],
      ["Análisis (afectación, deduplicación, versión segura)", "`analysis.test.ts`", "12"],
      ["Remediación", "`remediation.test.ts`", "7"],
      ["Pipeline completo", "`scan.test.ts`", "2"],
      ["API (escaneo, privacidad, OAuth, PDF)", "`api.test.ts`", "7"],
      ["**Total**", "", "**97 (100 % aprobadas)**"],
    ]),
    ...figuraAPA("Diagrama: Resultados", "fd05-03.png"),
    parrafo("**b) Benchmark contra `npm audit`** (13 de octubre de 2026, repositorios fijados por commit)"),
    ...tablaAPA("Resultados", ["Repositorio","Dependencias","DepScan","npm audit","Coincidentes","Solo DepScan","Solo npm audit"], [2583,1198,884,889,1146,1078,1248], [
      ["OWASP/NodeGoat", "1091", "193", "197", "193", "0", "0"],
      ["snyk-labs/nodejs-goof", "980", "228", "232", "228", "0", "0"],
      ["cr0hn/vulnerable-node", "124", "5", "5", "5", "0", "0"],
    ]),
    parrafo("No hubo fallas omitidas ni falsos positivos frente a `npm audit`. La diferencia de 4 avisos en dos repositorios se debe a la deduplicación de DepScan: avisos GHSA distintos que comparten el mismo CVE se cuentan una sola vez."),
    ...figuraAPA("Diagrama: Resultados", "fd05-04.png"),
    ...tablaAPA("c) Rendimiento y remediación en un proyecto real (NodeGoat)", ["Métrica","Valor"], [7608,1418], [
      ["Paquetes vulnerables", "133"],
      ["Con versión segura publicada", "119"],
      ["Sin versión segura (se ofrecen mitigaciones)", "14"],
      ["Remediaciones verificadas contra todos los avisos", "133 (100 %)"],
      ["Transitivas resolubles con `npm update`", "38"],
      ["Transitivas que requieren `overrides`", "74"],
      ["Hallazgos con mitigaciones", "120"],
      ["Hallazgos con enlace a parche", "125"],
      ["Tiempo total del escaneo con remediación", "≈ 18 s"],
    ]),
    ...tablaAPA("d) Validación en producción", ["Prueba","Resultado"], [2946,6080], [
      ["Healthcheck `/api/health`", "`ok`, base de datos operativa"],
      ["Login con GitHub", "Lista de repositorios propios, privados y de colaboración"],
      ["Escaneo de un repositorio privado", "53 de 525 dependencias vulnerables, 15 críticas y 123 altas, en 22 s"],
      ["Login con Google", "Cuenta vinculada a la de GitHub"],
      ["Descarga de PDF y HTML", "Archivos válidos con nombre por proyecto y fecha"],
    ]),
    salto(),

    h1("5. Cronograma"),
    parrafo("Semestre académico 2026-II (16 semanas). El estado corresponde a la fecha de emisión de este informe."),
    ...tablaAPA("Cronograma", ["Fase RUP","Actividades principales","Inicio","Fin","Semanas","Estado"], [906,4129,845,845,845,1456], [
      ["Inicio", "Planteamiento, factibilidad, visión", "17/08/2026", "06/09/2026", "3", "Completada"],
      ["Elaboración", "Requerimientos, arquitectura, prototipo del motor", "07/09/2026", "04/10/2026", "4", "Completada"],
      ["Construcción", "Motor, CLI, API, web, remediación, OAuth, PDF", "05/10/2026", "15/11/2026", "6", "Completada (adelantada)"],
      ["Transición", "Despliegue, benchmark, documentación final, sustentación", "16/11/2026", "06/12/2026", "3", "En curso"],
    ]),
    ...figuraAPA("Diagrama: Cronograma", "fd05-05.png"),
    salto(),

    h1("6. Presupuesto"),
    parrafo("**Presupuesto planificado frente al ejecutado** (S/, tipo de cambio US$ 1 = S/ 3.75)"),
    ...tablaAPA("Presupuesto", ["Rubro","Planificado","Ejecutado","Variación"], [4791,1612,1407,1216], [
      ["Costos generales", "400.00", "400.00", "0.00"],
      ["Costos operativos", "480.00", "480.00", "0.00"],
      ["Costos del ambiente (Railway, 4 meses)", "75.00", "75.00", "0.00"],
      ["Costos de personal", "6,000.00", "6,000.00", "0.00"],
      ["**Total**", "**6,955.00**", "**6,955.00**", "**0.00**"],
    ]),
    parrafo("Todo el software utilizado es gratuito y de código abierto, y las APIs de OSV, NVD, Google y GitHub no tienen costo. El único gasto recurrente de infraestructura es el plan de Railway. La operación anual estimada es de **S/ 3,540.00** (hosting y mantenimiento), según FD01."),
    parrafo("**Indicadores financieros (FD01):** VAN S/ 1,834.70 · TIR ≈ 26.8 % · B/C 1.12 · recuperación ≈ 1.9 años."),
    salto(),

    h1("7. Conclusiones"),
    ...numerada([
      "Se cumplió el objetivo general: DepScan detecta dependencias vulnerables en npm y PyPI y propone remediaciones verificadas. Funciona en producción y se accede desde la web.",
      "El motor propio igualó a `npm audit` en los tres repositorios npm del benchmark, sin fallas omitidas, y además eliminó avisos duplicados.",
      "La remediación es el principal aporte: el 100 % de los hallazgos de NodeGoat recibió una recomendación verificada contra todos los avisos del paquete. El sistema además distingue cuándo basta un `npm update` (38 casos) y cuándo se requiere `overrides` (74).",
      "Las 97 pruebas automatizadas y la arquitectura hexagonal permitieron incorporar el login OAuth, el PDF y la remediación sin regresiones.",
      "El proyecto se ejecutó dentro del presupuesto previsto de S/ 6,955.00, con todo el software gratuito y una infraestructura de bajo costo.",
    ]),
    salto(),

    h1("8. Recomendaciones"),
    ...numerada([
      "Instalar OSV-Scanner y completar el benchmark para PyPI, junto con la revisión manual de una muestra de diferencias.",
      "Solicitar la verificación de la app OAuth en Google para habilitar el login a todos los usuarios.",
      "Regenerar los secretos OAuth de producción y mantenerlos solo en las variables de Railway.",
      "Implementar la renovación de tokens de GitHub para reactivar su vencimiento automático.",
      "Agregar otros ecosistemas (Maven, Go) y la creación automática de *pull requests* de actualización.",
      "Si el uso crece, migrar de SQLite a PostgreSQL para permitir varias réplicas.",
    ]),
    salto(),

    h1("9. Bibliografía"),
    ref("Kruchten, P. (2003). *The Rational Unified Process: An Introduction* (3.ª ed.). Addison-Wesley."),
    ref("Sommerville, I. (2016). *Software Engineering* (10.ª ed.). Pearson."),
    ref("Pressman, R. y Maxim, B. (2020). *Ingeniería del software: un enfoque práctico* (9.ª ed.). McGraw-Hill."),
    ref("Martin, R. C. (2017). *Clean Architecture*. Prentice Hall."),
    ref("Cockburn, A. (2005). *Hexagonal Architecture (Ports and Adapters)*. https://alistair.cockburn.us/hexagonal-architecture/"),
    ref("U.S. Government Accountability Office (2018). *Data Protection: Actions Taken by Equifax and Federal Agencies in Response to the 2017 Breach* (GAO-18-559)."),
    ref("OWASP Foundation (2021). *OWASP Top 10*. https://owasp.org/Top10/"),
    ref("Google. *OSV – Open Source Vulnerabilities*. https://osv.dev"),
    ref("NIST. *National Vulnerability Database*. https://nvd.nist.gov"),
    ref("FIRST (2019). *CVSS v3.1 Specification Document*. https://www.first.org/cvss/"),
    ref("Hardt, D. (2012). *RFC 6749: The OAuth 2.0 Authorization Framework*. IETF."),
    ref("Sakimura, N. et al. (2015). *RFC 7636: Proof Key for Code Exchange*. IETF."),
  ];
}

// páginas de cada título para el índice precargado
const PAGINAS = {
  "1. Antecedentes": "",
  "2. Planteamiento del Problema": "",
  "3. Objetivos": "",
  "4. Desarrollo de la Solución": "",
  "4.1 Fase de Inicio": "",
  "4.2 Fase de Elaboración": "",
  "4.3 Fase de Construcción": "",
  "4.4 Fase de Transición": "",
  "4.5 Resultados": "",
  "5. Cronograma": "",
  "6. Presupuesto": "",
  "7. Conclusiones": "",
  "8. Recomendaciones": "",
  "9. Bibliografía": "",
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
