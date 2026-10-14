// FD06-EPIS-PropuestaProyecto – Propuesta del Proyecto (formato APA 7, según plantilla.js)
// Uso: npm install  &&  node fd06.js   (logo_upt.png e img/ en la misma carpeta)
// Contenido tomado de FD06-EPIS-PropuestaProyecto.md; los diagramas están en img/fd06-NN.png.
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
const INFORME = "Propuesta del Proyecto";
const VERSION = "Versión 1.0";
const FECHA = "14/10/2026";
const ANIO = "2026";
const SIGLA = "PP";
const LOGO = path.join(__dirname, "logo_upt.png");
const IMG = path.join(__dirname, "img");
const SALIDA = path.join(__dirname, "FD06-EPIS-PropuestaProyecto.docx");

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

    h1("1. Resumen Ejecutivo"),
    parrafo("Según los informes de la industria sobre software de código abierto, la mayor parte del código de una aplicación moderna proviene de librerías de terceros, y una sola librería desactualizada basta para comprometer un sistema completo, como ocurrió en Equifax (2017) y con Log4Shell (2021). Sin embargo, la mayoría de los proyectos estudiantiles y de equipos pequeños **no revisan sus dependencias**, porque hacerlo a mano es lento y las herramientas gratuitas son de consola, en inglés, y se limitan a enumerar fallas."),
    parrafo("**DepScan** propone resolverlo con un sistema web que, a partir de los archivos de dependencias de un proyecto (o directamente desde un repositorio de GitHub), **detecta en segundos las librerías con vulnerabilidades conocidas en npm y PyPI**. Además, para cada una indica **la versión segura recomendada, todas las alternativas seguras, los comandos exactos para actualizar y cómo protegerse si no es posible hacerlo**. El resultado queda en reportes HTML y PDF que sirven como evidencia formal."),
    ...tablaAPA("Resumen Ejecutivo", ["Aspecto","Propuesta"], [1625,7401], [
      ["Producto", "Aplicación web + herramienta de línea de comandos para CI"],
      ["Usuarios", "Estudiantes de la EPIS, docentes evaluadores y equipos de desarrollo pequeños"],
      ["Diferencial", "Remediación verificada contra todos los avisos, en español, con reportes PDF y soporte de npm y PyPI en un solo análisis"],
      ["Duración", "16 semanas (semestre 2026-II)"],
      ["Inversión", "**S/ 6,955.00**"],
      ["Rentabilidad estimada", "VAN S/ 1,834.70 · TIR 26.8 % · B/C 1.12"],
      ["Estado", "Prototipo funcional desplegado en https://deptest-production-7f98.up.railway.app"],
    ]),
    salto(),

    h1("2. Planteamiento del Problema y Justificación"),
    parrafo("**Problema.** Los equipos de desarrollo no saben, de forma rápida y confiable, si las librerías que usan tienen vulnerabilidades conocidas, ni a qué versión deben actualizar sin romper el proyecto o caer en otra falla."),
    ...figuraAPA("Causas y efectos", "fd06-01.png"),
    ...tablaAPA("Justificación", ["Dimensión","Justificación"], [986,8040], [
      ["Técnica", "Las bases OSV y NVD son públicas y gratuitas. El valor del proyecto está en procesarlas correctamente: versiones exactas, deduplicación y verificación de versiones seguras."],
      ["Académica", "Aplica de forma integrada ingeniería de requerimientos, arquitectura de software, seguridad, pruebas y despliegue en la nube, bajo la metodología RUP."],
      ["Social", "Promueve una cultura de desarrollo seguro y enseña, en español, por qué cada falla importa y cómo resolverla."],
      ["Económica", "Ahorra horas de revisión manual con una inversión baja y una operación menor a S/ 300 mensuales."],
      ["Normativa", "Responde a la categoría A06 del OWASP Top 10 (componentes vulnerables y desactualizados)."],
    ]),
    salto(),

    h1("3. Objetivo General y Específicos"),
    parrafo("**Objetivo general.** Desarrollar e implantar, en el semestre 2026-II, un sistema web que detecte dependencias con vulnerabilidades conocidas en proyectos npm y PyPI y proponga acciones de remediación verificadas."),
    ...tablaAPA("Objetivos específicos (SMART)", ["N.º","Objetivo","Medible","Alcanzable","Relevante","Plazo"], [798,3195,2084,1118,1034,797], [
      ["OE1", "Construir un motor que obtenga la versión exacta de todas las dependencias, incluidas las transitivas.", "Soporte de lockfile npm v1–v3, *workspaces* y `requirements.txt`", "Con TypeScript y Node.js 24", "Base de todo el análisis", "Semana 8"],
      ["OE2", "Detectar vulnerabilidades consultando OSV en lote y NVD de forma opcional, sin avisos duplicados.", "Lotes de hasta 1000 paquetes; 0 duplicados", "APIs públicas y gratuitas", "Reportes claros", "Semana 9"],
      ["OE3", "Recomendar para cada librería vulnerable una versión verificada contra todos sus avisos, junto con comandos y mitigaciones.", "100 % de hallazgos con remediación", "Datos de OSV y registros", "Principal aporte", "Semana 12"],
      ["OE4", "Ofrecer una interfaz web con login (Google y GitHub), historial y reportes HTML/PDF.", "Flujo completo en producción", "React, Fastify y Railway", "Facilidad de uso y evidencia", "Semana 13"],
      ["OE5", "Validar los resultados frente a `npm audit` en al menos 3 repositorios reales.", "0 fallas omitidas", "Benchmark reproducible", "Credibilidad", "Semana 15"],
    ]),
    salto(),

    h1("4. Beneficios"),
    ...tablaAPA("Beneficios tangibles", ["Beneficio","Estimación"], [2257,6769], [
      ["Ahorro de tiempo de revisión", "~4 horas por proyecto (escenario: 5 proyectos/mes ≈ S/ 7,200 anuales)"],
      ["Rapidez", "Proyectos de más de 1000 dependencias analizados en menos de 20 segundos"],
      ["Costo para el usuario", "S/ 0, frente a planes comerciales con costo por desarrollador"],
      ["Cobertura", "npm y PyPI en un solo análisis, incluidas las dependencias transitivas"],
    ]),
    parrafo("**Beneficios intangibles**"),
    ...vinetas([
      "Menor riesgo de incidentes de seguridad en los proyectos de la Escuela.",
      "Aprendizaje práctico de seguridad del software en español.",
      "Evidencia objetiva (PDF con fecha y commit) para la evaluación docente.",
      "Integración con los hábitos del estudiante (GitHub) y con la integración continua.",
      "Proyecto de código abierto reutilizable por otros cursos y universidades.",
    ]),
    ...figuraAPA("Beneficiarios", "fd06-02.png"),
    salto(),

    h1("5. Alcance y Restricciones"),
    ...tablaAPA("Alcance", ["Incluye","No incluye"], [4606,4420], [
      ["Ecosistemas npm y PyPI", "Maven, Go, Cargo, NuGet, Composer, RubyGems"],
      ["Lectura de `package.json`, `package-lock.json` (v1–v3), `requirements*.txt`", "Análisis del código fuente propio"],
      ["Fuentes OSV y NVD", "Descubrimiento de vulnerabilidades nuevas (*zero-day*)"],
      ["Detección, deduplicación, severidad y semáforo", "Análisis de si el código vulnerable realmente se ejecuta"],
      ["Versión recomendada, todas las seguras, comandos y mitigaciones", "Aplicación automática de las correcciones en el repositorio"],
      ["Web, CLI para CI y reportes HTML/PDF", "Aplicación móvil nativa"],
      ["Login con Google y GitHub y repositorios privados", "Otros proveedores de identidad (Microsoft, GitLab)"],
      ["Despliegue en Railway", "Instalación on-premise con alta disponibilidad"],
    ]),
    ...tablaAPA("Restricciones", ["Tipo","Restricción"], [1856,7170], [
      ["Tiempo", "Un semestre académico (16 semanas)."],
      ["Presupuesto", "Inversión máxima de S/ 7,000."],
      ["Tecnología", "Solo Visual Studio Code; frontend React; backend Node.js/TypeScript."],
      ["Infraestructura", "Una réplica en Railway (base SQLite en volumen)."],
      ["Servicios externos", "Disponibilidad y límites de uso de OSV, NVD y GitHub."],
      ["Login con Google", "Modo prueba (hasta 100 usuarios) hasta que Google verifique la app."],
      ["Precisión", "Menor sin lockfile; se declara en el reporte."],
    ]),
    salto(),

    h1("6. Cronograma"),
    ...tablaAPA("Cronograma", ["Fase RUP","Actividades","Inicio","Fin","Hito"], [974,4007,893,893,2259], [
      ["Inicio", "Planteamiento, factibilidad, visión", "17/08/2026", "06/09/2026", "FD01 y FD02 aprobados"],
      ["Elaboración", "Requerimientos, arquitectura, prototipo del motor", "07/09/2026", "04/10/2026", "FD03 y FD04 aprobados"],
      ["Construcción", "Motor, CLI, API, web, remediación, OAuth, PDF", "05/10/2026", "15/11/2026", "Versión funcional con pruebas"],
      ["Transición", "Despliegue, benchmark, informe final, sustentación", "16/11/2026", "06/12/2026", "Sistema en producción y FD05"],
    ]),
    ...figuraAPA("Diagrama: Cronograma", "fd06-03.png"),
    salto(),

    h1("7. Presupuesto"),
    parrafo("Tipo de cambio de referencia: US$ 1 = S/ 3.75. Fuente: estudio de factibilidad (FD01)."),
    ...tablaAPA("Presupuesto", ["Rubro","Detalle","Monto (S/)"], [2290,5597,1139], [
      ["Costos generales", "Depreciación de equipo, útiles, impresión", "400.00"],
      ["Costos operativos", "Internet y energía (4 meses)", "480.00"],
      ["Costos del ambiente", "Railway plan Hobby (4 meses); software y APIs gratuitos", "75.00"],
      ["Costos de personal", "Analista-desarrollador, 20 h/semana × 4 meses", "6,000.00"],
      ["**Total de inversión**", "", "**6,955.00**"],
    ]),
    ...figuraAPA("Diagrama: Presupuesto", "fd06-04.png"),
    parrafo("**Operación anual posterior:** S/ 3,540.00 (hosting S/ 540 y mantenimiento S/ 3,000)."),
    ...tablaAPA("Evaluación financiera (3 años, tasa 12 %)", ["Indicador","Valor","Decisión"], [2275,2351,4400], [
      ["VAN", "S/ 1,834.70", "> 0, aceptable"],
      ["TIR", "≈ 26.8 %", "> 12 %, rentable"],
      ["B/C", "1.12", "> 1, conveniente"],
      ["Recuperación", "≈ 1.9 años", "Dentro del horizonte"],
    ]),
    parrafo("Por su bajo costo, su viabilidad técnica ya demostrada con un prototipo en producción y su impacto en la formación en desarrollo seguro, **se solicita la aprobación del proyecto DepScan**."),
    salto(),

    h1("BIBLIOGRAFÍA"),
    ref("Kruchten, P. (2003). *The Rational Unified Process: An introduction* (3.ª ed.). Addison-Wesley."),
    ref("Sapag Chain, N., Sapag Chain, R., y Sapag Puelma, J. M. (2014). *Preparación y evaluación de proyectos* (6.ª ed.). McGraw-Hill."),
    ref("U.S. Government Accountability Office. (2018). *Data protection: Actions taken by Equifax and federal agencies in response to the 2017 breach* (GAO-18-559). https://www.gao.gov/products/gao-18-559"),
    salto(),

    h1("WEBGRAFÍA"),
    ref("Apache Software Foundation. (2021). *Apache Log4j security vulnerabilities*. https://logging.apache.org/log4j/2.x/security.html"),
    ref("Google. (2026). *OSV: Open Source Vulnerabilities*. https://osv.dev"),
    ref("OWASP Foundation. (2021). *A06:2021 – Vulnerable and Outdated Components*. https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/"),
  ];
}

// páginas de cada título para el índice precargado
const PAGINAS = {
  "1. Resumen Ejecutivo": "",
  "2. Planteamiento del Problema y Justificación": "",
  "3. Objetivo General y Específicos": "",
  "4. Beneficios": "",
  "5. Alcance y Restricciones": "",
  "6. Cronograma": "",
  "7. Presupuesto": "",
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
