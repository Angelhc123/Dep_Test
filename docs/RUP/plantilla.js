// Plantilla SAD (Documento de Arquitectura de Software) - formato APA 7
// Uso: npm install docx  &&  node generar_sad.js   (logo_upt.png en la misma carpeta)
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, PageBreak, TableOfContents, Header, Footer,
  PageNumber, WidthType, BorderStyle, ShadingType, VerticalAlign, TabStopType,
  LevelFormat, HeightRule,
} = require("docx");

// ================== DATOS ==================
const PROYECTO = "{Nombre del Proyecto}";
const CURSO = "{Nombre del Curso}";
const DOCENTE = "{Nombre del Docente}";
const INTEGRANTES = [["Hernández Cruz, Angel Gadiel", "(2021070017)"]];
const INFORME = "Informe de SAD";
const VERSION = "Versión 1.0";
const ANIO = "2026";
const SIGLA = "SAD";
const LOGO = path.join(__dirname, "logo_upt.png");
const SALIDA = path.join(__dirname, "SAD_Plantilla_APA.docx");

const FONT = "Calibri";      // APA 7 admite Calibri 11 o Times New Roman 12
const SIZE = 22;             // 11 pt (medios puntos)
const CW = 9026;             // ancho útil A4 con márgenes de 2.54 cm (DXA)

// ================== HELPERS ==================
const run = (text, o = {}) => new TextRun({ text, font: o.font ?? FONT, size: o.size ?? SIZE,
  bold: o.bold, italics: o.italics, color: o.color });

const center = (children, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER,
  spacing: { before: o.before ?? 0, after: o.after ?? 160 }, children });

// párrafo APA: doble espacio, sangría 1.27 cm en primera línea
const parrafo = (text) => new Paragraph({
  spacing: { line: 480, after: 0 }, indent: { firstLine: 720 },
  children: [run(text)],
});

// texto guía (contexto de qué va en cada sección)
const guia = (text) => new Paragraph({
  spacing: { line: 480, after: 0 }, indent: { firstLine: 720 },
  children: [run(text, { italics: true, color: "808080" })],
});

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
    children: [new Paragraph({ spacing: { after: 0 },
      children: [run(text, { bold: header, size: 20 })] })],
  });
}

function tablaAPA(titulo, columnas, anchos, filas = 3, nota = "Elaboración propia.") {
  nTabla++;
  const rows = [new TableRow({ tableHeader: true,
    children: columnas.map((c, i) => celda(c, anchos[i], { header: true, top: true, bottom: true })) })];
  for (let r = 0; r < filas; r++) {
    const last = r === filas - 1;
    const datos = Array.isArray(filas) ? null : null;
    rows.push(new TableRow({ children: columnas.map((_, i) => celda("", anchos[i], { bottom: last })) }));
  }
  return [
    new Paragraph({ spacing: { before: 240, after: 0 }, keepNext: true, children: [run(`Tabla ${nTabla}`, { bold: true })] }),
    new Paragraph({ spacing: { after: 120 }, keepNext: true, children: [run(titulo, { italics: true })] }),
    new Table({ width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: anchos, rows }),
    new Paragraph({ spacing: { before: 80, after: 240 }, children: [run("Nota. ", { italics: true, size: 20 }), run(nota, { size: 20 })] }),
  ];
}

// tabla de atributos (primera columna con texto fijo, segunda vacía)
function tablaAtributos(titulo, atributos) {
  nTabla++;
  const a = [2600, CW - 2600];
  const rows = [new TableRow({ tableHeader: true, children: [
    celda("Atributo", a[0], { header: true, top: true, bottom: true }),
    celda("Detalle", a[1], { header: true, top: true, bottom: true })] })];
  atributos.forEach((t, i) => {
    const last = i === atributos.length - 1;
    rows.push(new TableRow({ children: [celda(t, a[0], { bottom: last }), celda("", a[1], { bottom: last })] }));
  });
  return [
    new Paragraph({ spacing: { before: 240, after: 0 }, keepNext: true, children: [run(`Tabla ${nTabla}`, { bold: true })] }),
    new Paragraph({ spacing: { after: 120 }, keepNext: true, children: [run(titulo, { italics: true })] }),
    new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: a, rows }),
    new Paragraph({ spacing: { before: 80, after: 240 }, children: [run("Nota. ", { italics: true, size: 20 }), run("Elaboración propia.", { size: 20 })] }),
  ];
}

// figura APA: número en negrita, título en cursiva, recuadro vacío, nota
function figuraAPA(titulo, nota = "Elaboración propia.") {
  nFigura++;
  const caja = { style: BorderStyle.DASHED, size: 6, color: "999999" };
  return [
    new Paragraph({ spacing: { before: 240, after: 0 }, keepNext: true, children: [run(`Figura ${nFigura}`, { bold: true })] }),
    new Paragraph({ spacing: { after: 120 }, keepNext: true, children: [run(titulo, { italics: true })] }),
    new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], rows: [
      new TableRow({ height: { value: 3600, rule: HeightRule.EXACT }, children: [new TableCell({
        width: { size: CW, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        borders: { top: caja, bottom: caja, left: caja, right: caja },
        shading: { fill: "F5F5F5", type: ShadingType.CLEAR, color: "auto" },
        children: [center([run("[ Insertar diagrama aquí ]", { color: "999999", italics: true })], { after: 0 })],
      })] })] }),
    new Paragraph({ spacing: { before: 80, after: 240 }, children: [run("Nota. ", { italics: true, size: 20 }), run(nota, { size: 20 })] }),
  ];
}

// referencia APA con sangría francesa
const ref = (parts) => new Paragraph({
  spacing: { line: 480, after: 0 }, indent: { left: 720, hanging: 720 },
  children: parts.map(([t, it]) => run(t, { italics: it })),
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
  const f1 = new TableRow({ children: ["1.0", "", "", "", "", "Versión original"].map((t, i) => celda(t, a[i], { bottom: true })) });
  return [
    ...Array.from({ length: 14 }, () => new Paragraph({ children: [] })),
    R([tnr("Sistema "), tnr(PROYECTO, { italics: true })]),
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
    guia("Describa el propósito del Documento de Arquitectura de Software, el modelo de vistas utilizado (4+1 de Kruchten) y a quién va dirigido."),
    h2("2. Alcance"),
    guia("Indique qué cubre este documento (vistas, patrones, decisiones y atributos de calidad) y qué queda fuera de su alcance."),
    h2("3. Definiciones, Acrónimos y Abreviaturas"),
    guia("Liste los términos técnicos empleados en el documento."),
    ...tablaAPA("Definiciones, acrónimos y abreviaturas", ["Término", "Definición"], [2400, CW - 2400], 4),
    h2("4. Referencias"),
    guia("Mencione los documentos base del proyecto (FD01–FD03) y fuentes consultadas, citadas en formato APA 7."),
    salto(),

    h1("I. REPRESENTACIÓN ARQUITECTÓNICA"),
    guia("Explique cómo se representa la arquitectura del sistema y por qué se eligió ese modelo de vistas."),
    h2("Metas y Restricciones Arquitectónicas"),
    guia("Enumere las metas que gobiernan el diseño (desacoplamiento, seguridad, rendimiento, etc.) y las restricciones técnicas, legales o de plataforma."),
    salto(),

    h1("II. VISTA DE CASOS DE USO"),
    guia("Describa los escenarios principales del sistema mostrando los objetos de frontera, control, servicio y persistencia que participan."),
    h2("Secuencia de CU-0001: {Nombre del caso de uso}"),
    ...tablaAtributos("Ficha del caso de uso CU-0001", ["Actores", "Módulo / Componentes", "Requerimientos relacionados"]),
    guia("Describa brevemente el flujo técnico del caso de uso."),
    ...figuraAPA("Diagrama de secuencia del CU-0001"),
    h2("Secuencia de CU-0002: {Nombre del caso de uso}"),
    guia("Repita la ficha, la descripción y el diagrama para cada caso de uso."),
    salto(),

    h1("III. VISTA LÓGICA"),
    h2("1. Estilo Arquitectónico"),
    guia("Indique el estilo adoptado (capas, MVC, cliente-servidor, microservicios, etc.) y su justificación."),
    h2("2. Diagrama de Paquetes"),
    ...figuraAPA("Diagrama de paquetes del sistema"),
    h2("3. Descripción de las Capas"),
    ...tablaAPA("Responsabilidades por capa", ["Capa", "Responsabilidad", "Componentes"], [2000, 4026, 3000], 4),
    h2("4. Diagrama de Clases de Dominio"),
    guia("Inserte el diagrama de clases y describa las entidades principales."),
    h2("5. Diagrama de Interfaces de la Capa de Servicios"),
    guia("Inserte el diagrama de interfaces y describa los contratos de cada servicio."),
    salto(),

    h1("IV. VISTA DE PROCESOS"),
    guia("Describa los procesos en ejecución, la concurrencia y las operaciones asíncronas del sistema."),
    h1("V. VISTA DE DESPLIEGUE"),
    guia("Describa la topología física: servidores, servicios en la nube, dispositivos cliente y protocolos de comunicación."),
    h1("VI. VISTA DE IMPLEMENTACIÓN"),
    guia("Relacione los componentes lógicos con la estructura real de carpetas y proyectos del código fuente."),
    h1("VII. VISTA DE DATOS"),
    guia("Inserte el modelo entidad-relación y describa las tablas principales."),
    h1("VIII. PATRONES DE DISEÑO APLICADOS"),
    guia("Liste los patrones utilizados, dónde se aplican y por qué."),
    salto(),

    h1("IX. DECISIONES ARQUITECTÓNICAS"),
    h2("ADR-01: {Título de la decisión}"),
    h3("Contexto"), guia("Situación o problema que motivó la decisión."),
    h3("Decisión"), guia("Alternativa elegida."),
    h3("Consecuencias"), guia("Ventajas, desventajas y riesgos asumidos."),
    h2("ADR-02: {Título de la decisión}"),
    guia("Repita la estructura Contexto / Decisión / Consecuencias para cada decisión."),
    salto(),

    h1("X. ATRIBUTOS DE CALIDAD"),
    guia("Relacione cada requerimiento no funcional con su escenario y métrica de verificación."),
    ...tablaAPA("Atributos de calidad del sistema", ["Atributo", "Escenario", "Métrica / Criterio"], [2000, 4026, 3000], 4),
    salto(),

    h1("CONCLUSIONES"),
    guia("Redacte las conclusiones respecto a la arquitectura implementada."),
    h1("RECOMENDACIONES"),
    guia("Redacte las recomendaciones para la evolución y mantenimiento del sistema."),
    salto(),

    h1("BIBLIOGRAFÍA"),
    ref([["Apellido, A. A. (Año). ", false], ["Título del libro en cursiva", true], [" (ed.). Editorial.", false]]),
    ref([["Apellido, A. A., y Apellido, B. B. (Año). Título del artículo. ", false], ["Nombre de la Revista", true], [", ", false], ["volumen", true], ["(número), pp–pp. https://doi.org/xxxx", false]]),
    h1("WEBGRAFÍA"),
    ref([["Autor u Organización. (Año, día de mes). ", false], ["Título de la página web", true], [". Nombre del sitio. https://url", false]]),
  ];
}

// páginas de cada título para el índice precargado
const PAGINAS = {
  "INTRODUCCIÓN": 5,
  "1. Propósito": 5,
  "2. Alcance": 5,
  "3. Definiciones, Acrónimos y Abreviaturas": 5,
  "4. Referencias": 5,
  "I. REPRESENTACIÓN ARQUITECTÓNICA": 6,
  "Metas y Restricciones Arquitectónicas": 6,
  "II. VISTA DE CASOS DE USO": 7,
  "Secuencia de CU-0001: {Nombre del caso de uso}": 7,
  "Secuencia de CU-0002: {Nombre del caso de uso}": 7,
  "III. VISTA LÓGICA": 8,
  "1. Estilo Arquitectónico": 8,
  "2. Diagrama de Paquetes": 8,
  "3. Descripción de las Capas": 8,
  "4. Diagrama de Clases de Dominio": 8,
  "5. Diagrama de Interfaces de la Capa de Servicios": 8,
  "IV. VISTA DE PROCESOS": 9,
  "V. VISTA DE DESPLIEGUE": 9,
  "VI. VISTA DE IMPLEMENTACIÓN": 9,
  "VII. VISTA DE DATOS": 9,
  "VIII. PATRONES DE DISEÑO APLICADOS": 9,
  "IX. DECISIONES ARQUITECTÓNICAS": 10,
  "ADR-01: {Título de la decisión}": 10,
  "ADR-02: {Título de la decisión}": 10,
  "X. ATRIBUTOS DE CALIDAD": 11,
  "CONCLUSIONES": 12,
  "RECOMENDACIONES": 12,
  "BIBLIOGRAFÍA": 13,
  "WEBGRAFÍA": 13
};

// ================== DOCUMENTO ==================
const doc = new Document({
  features: { updateFields: true },  // Word pide actualizar el índice al abrir -> "Sí"
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
