// FD01-EPIS-Informe_de_Factibilidad – Informe de Factibilidad (formato APA 7, según plantilla.js)
// Uso: npm install  &&  node fd01.js   (logo_upt.png e img/ en la misma carpeta)
// Contenido tomado de FD01-EPIS-Informe_de_Factibilidad.md; los diagramas están en img/fd01-NN.png.
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
const INFORME = "Informe de Factibilidad";
const VERSION = "Versión 1.0";
const FECHA = "14/10/2026";
const ANIO = "2026";
const SIGLA = "IF";
const LOGO = path.join(__dirname, "logo_upt.png");
const IMG = path.join(__dirname, "img");
const SALIDA = path.join(__dirname, "FD01-EPIS-Informe_de_Factibilidad.docx");

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

    h1("1. Descripción del Proyecto"),
    parrafo("**Nombre del proyecto:** DepScan: Sistema Web de Detección y Remediación de Dependencias Vulnerables."),
    parrafo("**Duración:** 16 semanas (semestre académico 2026-II, agosto – diciembre de 2026)."),
    parrafo("**Descripción general.** El software moderno se construye sobre librerías de terceros: un proyecto web promedio en npm incorpora cientos de paquetes, la mayoría de ellos de forma *transitiva* (dependencias de dependencias). Cuando una de esas librerías tiene una vulnerabilidad publicada y el equipo no lo advierte, la aplicación queda expuesta aunque su propio código sea correcto. El caso de referencia es Equifax (2017): un componente sin actualizar (Apache Struts, CVE-2017-5638) permitió la filtración de datos de unos 147 millones de personas, a pesar de que el parche existía dos meses antes del ataque."),
    parrafo("DepScan es un sistema web que **lee los archivos de dependencias de un proyecto** (`package.json`, `package-lock.json` y `requirements.txt`), determina la **versión exacta** de cada librería, la cruza con las bases públicas de vulnerabilidades **OSV** (Google) y **NVD** (NIST) y, a partir de esa información, **prioriza los riesgos y propone soluciones concretas**: la versión segura recomendada, todas las versiones seguras de la librería, los comandos para aplicar la actualización y medidas de mitigación cuando no es posible actualizar. El resultado se presenta en una interfaz web y en reportes descargables en HTML y PDF."),
    parrafo("**Objetivo general.** Desarrollar un sistema web que detecte dependencias con vulnerabilidades conocidas en proyectos npm y PyPI y proponga acciones de remediación verificadas, reduciendo el tiempo y la incertidumbre de la revisión manual."),
    ...tablaAPA("Objetivos específicos.", ["N.º","Objetivo específico","Indicador de logro"], [840,4093,4093], [
      ["OE1", "Implementar un motor propio que interprete manifiestos y lockfiles y resuelva versiones exactas, incluidas dependencias transitivas.", "Soporte de lockfile npm v1, v2 y v3, *workspaces* y `requirements.txt` con `-r`, extras y marcadores."],
      ["OE2", "Consultar OSV en lote y enriquecer opcionalmente con NVD, deduplicando avisos repetidos (CVE, GHSA, PYSEC).", "Una consulta en lote de hasta 1000 paquetes; cero avisos duplicados en el reporte."],
      ["OE3", "Calcular, para cada librería vulnerable, la versión segura recomendada y todas las alternativas seguras.", "Versiones evaluadas contra **todos** los avisos publicados del paquete."],
      ["OE4", "Ofrecer una interfaz web con inicio de sesión (Google y GitHub), historial y reportes HTML/PDF.", "Flujo completo probado en producción."],
      ["OE5", "Validar los resultados frente a herramientas reconocidas.", "Benchmark reproducible contra `npm audit` sobre repositorios fijados en un commit."],
    ]),
    parrafo("**Alcance resumido.** Ecosistemas npm y PyPI; fuentes OSV y NVD; uso vía web, línea de comandos (CLI) e integración continua; despliegue en la nube (Railway). Quedan fuera del alcance: el descubrimiento de vulnerabilidades nuevas (*zero-day*), el análisis de alcanzabilidad del código vulnerable y otros ecosistemas (Maven, Go, Cargo)."),
    salto(),

    h1("2. Riesgos"),
    parrafo("Se identificaron los riesgos del proyecto y se valoraron con una escala de probabilidad (P) e impacto (I) de 1 a 5. La exposición es P × I: **alta** de 15 a 25, **media** de 8 a 14 y **baja** de 1 a 7."),
    ...tablaAPA("Riesgos", ["ID","Riesgo","Tipo","P","I","Exposición","Estrategia de respuesta"], [704,2330,704,704,704,704,3176], [
      ["R-01", "Indisponibilidad o cambios en la API de OSV", "Técnico / externo", "2", "5", "10 Media", "Caché local de 24 h, reintentos con espera exponencial y adaptadores aislados (puertos) que permiten cambiar de fuente."],
      ["R-02", "Límite de uso de NVD (5 solicitudes por 30 s sin clave)", "Técnico / externo", "4", "2", "8 Media", "NVD es opcional; limitador de tasa y API key gratuita (50 solicitudes por 30 s)."],
      ["R-03", "Falsos positivos: alertas sobre código que no se ejecuta", "Calidad", "4", "3", "12 Media", "Declaración explícita de la limitación, separación directa/transitiva y desarrollo/producción, y priorización por severidad."],
      ["R-04", "Versiones no determinables por falta de lockfile", "Calidad", "3", "3", "9 Media", "Advertencia visible y estimación opcional contra el registro, marcada como tal."],
      ["R-05", "Errores en la comparación de versiones (semver / PEP 440)", "Técnico", "2", "4", "8 Media", "Implementación propia con casos de las especificaciones oficiales y 97 pruebas automatizadas."],
      ["R-06", "Exposición de tokens OAuth de los usuarios", "Seguridad", "2", "5", "10 Media", "Tokens cifrados con AES-256-GCM, sesión en cookie `HttpOnly`, `state` y PKCE en OAuth."],
      ["R-07", "Vencimiento o impago del plan de hosting", "Operativo", "3", "4", "12 Media", "Presupuesto mensual previsto; imagen Docker portable a otro proveedor."],
      ["R-08", "Retraso en el cronograma por carga académica", "Gestión", "3", "3", "9 Media", "Iteraciones cortas por fase RUP y priorización MoSCoW de requerimientos."],
      ["R-09", "Pérdida de datos del historial", "Operativo", "2", "3", "6 Baja", "Volumen persistente en Railway; el historial es regenerable volviendo a escanear."],
      ["R-10", "Cambios en las políticas de Google o GitHub para apps OAuth", "Legal / externo", "2", "3", "6 Baja", "El sistema funciona sin inicio de sesión; los proveedores son opcionales."],
    ]),
    parrafo("La matriz ubica cada riesgo según su probabilidad e impacto; los cuadrantes superiores concentran los riesgos que requieren seguimiento continuo."),
    ...figuraAPA("Matriz de exposición de riesgos", "fd01-01.png"),
    salto(),

    h1("3. Análisis de la Situación actual"),
    parrafo("**Situación actual.** En los proyectos de software de la Escuela Profesional de Ingeniería de Sistemas, y en muchos equipos pequeños de desarrollo, la revisión de dependencias se hace de una de estas formas:"),
    ...numerada([
      "**No se hace**: el proyecto se entrega con las versiones que se instalaron el primer día.",
      "**Manualmente**: se buscan las librerías una por una en sitios web de avisos de seguridad, lo que es lento y no cubre las dependencias transitivas.",
      "**Con herramientas por consola** (`npm audit`, `pip-audit`, OSV-Scanner): son útiles, pero cada una cubre un solo ecosistema o entrega listas extensas en inglés, sin explicar qué versión elegir ni qué hacer si no se puede actualizar.",
    ]),
    ...figuraAPA("Proceso actual (manual)", "fd01-02.png"),
    ...tablaAPA("Problemas identificados", ["Problema","Consecuencia"], [4064,4962], [
      ["Las dependencias transitivas no se ven en `package.json`.", "La mayoría de los paquetes instalados nunca se revisan (en el proyecto NodeGoat, 1091 paquetes frente a una decena de dependencias declaradas)."],
      ["Un mismo fallo aparece con varios identificadores (CVE, GHSA, PYSEC).", "Reportes inflados y difíciles de priorizar."],
      ["La \"versión corregida\" de un aviso puede tener otra falla.", "Se actualiza a una versión que sigue siendo vulnerable."],
      ["No hay guía cuando no existe corrección.", "El equipo no sabe cómo protegerse mientras tanto."],
      ["No hay evidencia documentada de la revisión.", "No se puede demostrar el estado de seguridad ante un docente, cliente o auditor."],
    ]),
    ...figuraAPA("Proceso propuesto con DepScan", "fd01-03.png"),
    salto(),

    h1("4. Estudio de Factibilidad"),
    parrafo("El estudio evalúa si el proyecto puede realizarse con los recursos disponibles y si su operación es sostenible. Se analizan seis dimensiones; cada una concluye con un dictamen."),
    h2("4.1 Factibilidad Técnica"),
    ...tablaAPA("Recursos tecnológicos requeridos y disponibles", ["Recurso","Especificación","Disponibilidad"], [2423,4465,2138], [
      ["Equipo de desarrollo", "Laptop con 16 GB de RAM, Windows 10", "Disponible (propio)"],
      ["Entorno de desarrollo", "Visual Studio Code, sin IDE adicional", "Gratuito"],
      ["Lenguaje y entorno de ejecución", "TypeScript 5.9 sobre Node.js 24 LTS", "Gratuito, código abierto"],
      ["Frontend", "React 19, Vite 7, Tailwind CSS 4", "Gratuito, código abierto"],
      ["Backend", "Fastify 5, SQLite nativo de Node (`node:sqlite`)", "Gratuito, código abierto"],
      ["Pruebas", "Vitest 4", "Gratuito"],
      ["Control de versiones", "Git + GitHub", "Gratuito"],
      ["Fuentes de datos", "API de OSV (sin clave) y API de NVD (clave gratuita)", "Públicas y gratuitas"],
      ["Autenticación", "OAuth 2.0 de Google y de GitHub", "Gratuito"],
      ["Despliegue", "Railway (contenedor Docker + volumen persistente)", "Plan Hobby, US$ 5/mes"],
    ]),
    parrafo("**Capacidades técnicas comprobadas**"),
    ...vinetas([
      "El motor procesa proyectos reales de más de 1000 dependencias (NodeGoat: 1091) en segundos, gracias a la consulta en lote de OSV (hasta 1000 paquetes por solicitud).",
      "La base de datos embebida SQLite elimina la necesidad de un servidor de base de datos aparte.",
      "El sistema ya fue desplegado y probado en producción en `https://deptest-production-7f98.up.railway.app`.",
    ]),
    parrafo("**Dictamen:** el proyecto es **técnicamente factible**. Todas las tecnologías son maduras, gratuitas o de bajo costo, y el autor tiene las competencias necesarias."),
    h2("4.2 Factibilidad económica"),
    parrafo("Se estimaron los costos para el periodo de desarrollo (4 meses) y para la operación anual. Tipo de cambio de referencia: **US$ 1 = S/ 3.75**."),
    ...tablaAPA("a) Costos generales (materiales y equipos)", ["Concepto","Cantidad","Costo unitario (S/)","Total (S/)"], [5013,887,1917,1209], [
      ["Depreciación de laptop (uso durante 4 meses)", "1", "300.00", "300.00"],
      ["Útiles y material de oficina", "1", "50.00", "50.00"],
      ["Impresión y anillado de informes", "1", "50.00", "50.00"],
      ["**Subtotal**", "", "", "**400.00**"],
    ]),
    ...tablaAPA("b) Costos operativos durante el desarrollo", ["Concepto","Meses","Costo mensual (S/)","Total (S/)"], [4591,880,2116,1439], [
      ["Servicio de internet (prorrateado)", "4", "80.00", "320.00"],
      ["Energía eléctrica (prorrateada)", "4", "40.00", "160.00"],
      ["**Subtotal**", "", "", "**480.00**"],
    ]),
    ...tablaAPA("c) Costos del ambiente (infraestructura y software)", ["Concepto","Meses","Costo mensual (S/)","Total (S/)"], [5465,869,1639,1053], [
      ["Hosting Railway – plan Hobby (US$ 5)", "4", "18.75", "75.00"],
      ["Visual Studio Code, Node.js, React, Fastify, SQLite", "4", "0.00", "0.00"],
      ["GitHub (repositorio y GitHub Actions)", "4", "0.00", "0.00"],
      ["APIs OSV y NVD", "4", "0.00", "0.00"],
      ["Google Cloud (OAuth) y GitHub OAuth App", "4", "0.00", "0.00"],
      ["**Subtotal**", "", "", "**75.00**"],
    ]),
    ...tablaAPA("d) Costos de personal", ["Rol","Dedicación","Meses","Costo mensual (S/)","Total (S/)"], [4134,1145,865,1695,1187], [
      ["Analista, desarrollador y documentador (autor)", "20 h/semana", "4", "1,500.00", "6,000.00"],
      ["**Subtotal**", "", "", "", "**6,000.00**"],
    ]),
    ...tablaAPA("e) Costo total del desarrollo", ["Rubro","Total (S/)","%"], [4976,2513,1537], [
      ["Costos generales", "400.00", "5.8 %"],
      ["Costos operativos", "480.00", "6.9 %"],
      ["Costos del ambiente", "75.00", "1.1 %"],
      ["Costos de personal", "6,000.00", "86.3 %"],
      ["**Inversión total**", "**6,955.00**", "**100 %**"],
    ]),
    ...figuraAPA("Diagrama: Factibilidad económica", "fd01-04.png"),
    ...tablaAPA("f) Costos de operación anual (después de la puesta en marcha)", ["Concepto","Costo mensual (S/)","Costo anual (S/)"], [5514,1798,1714], [
      ["Hosting Railway (plan + consumo estimado, US$ 12)", "45.00", "540.00"],
      ["Mantenimiento y actualizaciones (10 h/mes × S/ 25)", "250.00", "3,000.00"],
      ["**Total operación anual**", "**295.00**", "**3,540.00**"],
    ]),
    parrafo("**Dictamen:** el proyecto es **económicamente factible**. La inversión se concentra en horas de trabajo del propio autor y el costo de infraestructura es menor a S/ 50 mensuales."),
    h2("4.3 Factibilidad Operativa"),
    ...vinetas([
      "**Facilidad de uso:** el usuario solo arrastra archivos o elige un repositorio; no necesita instalar nada.",
      "**Interfaz en español**, con semáforo de riesgo, explicaciones y pasos de solución con botón de copiar.",
      "**Integración con el flujo de trabajo:** inicio de sesión con las cuentas que el estudiante ya usa (Google o GitHub), importación directa de repositorios y una CLI para integración continua que devuelve código de error si hay fallas críticas.",
      "**Mantenimiento bajo:** un solo servicio en la nube, despliegue automático con cada `git push` y comprobación de salud (`/api/health`).",
    ]),
    ...tablaAPA("Interesados que operan el sistema", ["Interesado","Uso","Capacitación necesaria"], [2403,4023,2600], [
      ["Estudiante / desarrollador", "Escanear y corregir sus proyectos", "Ninguna (interfaz guiada)"],
      ["Docente / evaluador", "Revisar reportes PDF de los proyectos", "Ninguna"],
      ["Administrador del sistema", "Configurar variables y monitorear el despliegue", "Lectura de `docs/DESPLIEGUE.md`"],
    ]),
    parrafo("**Dictamen:** **operativamente factible**."),
    h2("4.4 Factibilidad Legal"),
    ...tablaAPA("Factibilidad Legal", ["Aspecto","Análisis"], [2445,6581], [
      ["Licencias de software", "Todas las dependencias del sistema son de código abierto con licencias permisivas (MIT, Apache-2.0, ISC). Se verifica con el propio DepScan sobre su repositorio."],
      ["Datos de vulnerabilidades", "OSV publica sus datos bajo CC-BY 4.0 y NVD es de dominio público (gobierno de EE. UU.); ambos permiten su uso con atribución, que el sistema muestra al pie de cada página."],
      ["Protección de datos personales", "Se cumple la **Ley N.º 29733 (Ley de Protección de Datos Personales del Perú)** y su reglamento: solo se almacena nombre, correo y foto para identificar la cuenta, con finalidad informada en la pantalla de consentimiento; no se ceden datos a terceros."],
      ["Términos de Google y GitHub", "La app cumple la *Google API Services User Data Policy* (aceptada al configurar OAuth) y los términos de GitHub para OAuth Apps."],
      ["Código de los usuarios", "Solo se descargan los manifiestos (no el código fuente) y los escaneos de repositorios privados solo los ve su dueño."],
    ]),
    parrafo("**Dictamen:** **legalmente factible**."),
    h2("4.5 Factibilidad Social"),
    ...vinetas([
      "**Formación en seguridad:** el reporte explica cada falla y su solución en español, por lo que funciona también como herramienta de aprendizaje para estudiantes.",
      "**Cultura de desarrollo seguro:** facilita incorporar la revisión de dependencias como un paso habitual antes de cada entrega (recomendación OWASP Top 10 2021, categoría A06: *Vulnerable and Outdated Components*).",
      "**Acceso equitativo:** el sistema es web y gratuito para el usuario final; no requiere licencias comerciales.",
    ]),
    parrafo("**Dictamen:** **socialmente factible**, con impacto positivo en la formación profesional."),
    h2("4.6 Factibilidad Ambiental"),
    ...vinetas([
      "**Sin consumo de papel:** los reportes son digitales (HTML y PDF).",
      "**Infraestructura compartida en la nube:** un único contenedor pequeño en lugar de servidores dedicados; la caché evita repetir consultas a internet.",
      "**Impacto indirecto positivo:** al prevenir incidentes de seguridad se evitan horas de recuperación y reprocesamiento.",
      "El único impacto es el consumo eléctrico del equipo del desarrollador y del centro de datos, que es marginal.",
    ]),
    parrafo("**Dictamen:** **ambientalmente factible**, con impacto mínimo."),
    salto(),

    h1("5. Análisis Financiero"),
    ...tablaAPA("Supuestos", ["Supuesto","Valor"], [6877,2149], [
      ["Horizonte de evaluación", "3 años"],
      ["Tasa de descuento (costo de oportunidad)", "12 % anual"],
      ["Inversión inicial (año 0)", "S/ 6,955.00"],
      ["Costo de operación anual", "S/ 3,540.00"],
      ["Beneficio anual estimado", "S/ 7,200.00"],
    ]),
    parrafo("**Estimación del beneficio.** El beneficio se calcula como **horas de revisión manual ahorradas**. Escenario conservador: 5 proyectos al mes × 4 horas ahorradas por proyecto × S/ 30 por hora = **S/ 600 mensuales = S/ 7,200 anuales**. No se incluye el costo evitado de un incidente de seguridad, que haría el resultado aún más favorable."),
    ...tablaAPA("Flujo de caja proyectado (S/)", ["Concepto","Año 0","Año 1","Año 2","Año 3"], [3456,1385,1416,1374,1395], [
      ["Ingresos / beneficios", "–", "7,200.00", "7,200.00", "7,200.00"],
      ["Costos de operación", "–", "(3,540.00)", "(3,540.00)", "(3,540.00)"],
      ["Inversión", "(6,955.00)", "–", "–", "–"],
      ["**Flujo neto**", "**(6,955.00)**", "**3,660.00**", "**3,660.00**", "**3,660.00**"],
      ["Flujo acumulado", "(6,955.00)", "(3,295.00)", "365.00", "4,025.00"],
      ["Factor de descuento (12 %)", "1.0000", "0.8929", "0.7972", "0.7118"],
      ["Flujo descontado", "(6,955.00)", "3,267.86", "2,917.73", "2,605.11"],
    ]),
    ...figuraAPA("Diagrama: Análisis Financiero", "fd01-05.png"),
    ...tablaAPA("Indicadores financieros", ["Indicador","Fórmula","Resultado","Interpretación"], [1782,2579,1148,3517], [
      ["**VAN** (Valor Actual Neto)", "Σ flujos descontados − inversión", "**S/ 1,834.70**", "VAN > 0: el proyecto genera valor por encima del 12 % exigido."],
      ["**TIR** (Tasa Interna de Retorno)", "Tasa que hace VAN = 0", "**≈ 26.8 %**", "TIR > 12 %: el proyecto es rentable."],
      ["**B/C** (Relación Beneficio/Costo)", "VA beneficios ÷ VA costos = 17,293.18 ÷ 15,458.48", "**1.12**", "B/C > 1: cada sol invertido retorna S/ 1.12."],
      ["**Periodo de recuperación**", "Inversión ÷ flujo neto anual", "**≈ 1.9 años** (≈ 23 meses)", "La inversión se recupera dentro del horizonte evaluado."],
    ]),
    salto(),

    h1("6. Conclusiones"),
    ...numerada([
      "El proyecto es **técnicamente factible**: utiliza tecnologías maduras y gratuitas, y ya se encuentra desplegado y funcionando en producción.",
      "Es **económicamente factible**: la inversión total es de **S/ 6,955.00**, concentrada en horas de trabajo del autor (86.3 %), con una operación anual de **S/ 3,540.00**.",
      "El análisis financiero en un escenario conservador arroja **VAN de S/ 1,834.70, TIR de 26.8 % y B/C de 1.12**, con recuperación de la inversión en aproximadamente 1.9 años.",
      "Es **operativa, legal, social y ambientalmente factible**: no requiere capacitación, cumple la Ley N.º 29733 y los términos de los proveedores, contribuye a la formación en desarrollo seguro y su impacto ambiental es mínimo.",
      "Los riesgos identificados son de exposición media o baja y cuentan con estrategias de mitigación ya implementadas (caché, cifrado de tokens, pruebas automatizadas).",
    ]),
    parrafo("Por lo expuesto, **se recomienda ejecutar el proyecto**."),
    salto(),

    h1("BIBLIOGRAFÍA"),
    ref("Sapag Chain, N., Sapag Chain, R., y Sapag Puelma, J. M. (2014). *Preparación y evaluación de proyectos* (6.ª ed.). McGraw-Hill."),
    ref("Sommerville, I. (2016). *Software engineering* (10.ª ed.). Pearson."),
    ref("U.S. Government Accountability Office. (2018). *Data protection: Actions taken by Equifax and federal agencies in response to the 2017 breach* (GAO-18-559). https://www.gao.gov/products/gao-18-559"),
    salto(),

    h1("WEBGRAFÍA"),
    ref("Congreso de la República del Perú. (2011, 3 de julio). *Ley N.º 29733, Ley de Protección de Datos Personales*. Diario Oficial El Peruano. https://www.gob.pe"),
    ref("Google. (2026). *OSV: Open Source Vulnerabilities*. https://osv.dev"),
    ref("National Institute of Standards and Technology. (2026). *National Vulnerability Database*. https://nvd.nist.gov"),
    ref("OWASP Foundation. (2021). *OWASP Top 10: 2021*. https://owasp.org/Top10/"),
    ref("Railway. (2026). *Pricing*. https://railway.com/pricing"),
  ];
}

// páginas de cada título para el índice precargado
const PAGINAS = {
  "1. Descripción del Proyecto": "",
  "2. Riesgos": "",
  "3. Análisis de la Situación actual": "",
  "4. Estudio de Factibilidad": "",
  "4.1 Factibilidad Técnica": "",
  "4.2 Factibilidad económica": "",
  "4.3 Factibilidad Operativa": "",
  "4.4 Factibilidad Legal": "",
  "4.5 Factibilidad Social": "",
  "4.6 Factibilidad Ambiental": "",
  "5. Análisis Financiero": "",
  "6. Conclusiones": "",
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
