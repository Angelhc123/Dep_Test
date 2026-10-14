// FD03-EPIS-Informe_Especificacion_Requerimientos – Documento de Especificación de Requerimientos de Software (formato APA 7, según plantilla.js)
// Uso: npm install  &&  node fd03.js   (logo_upt.png e img/ en la misma carpeta)
// Contenido tomado de FD03-EPIS-Informe_Especificacion_Requerimientos.md; los diagramas están en img/fd03-NN.png.
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
const INFORME = "Documento de Especificación de Requerimientos de Software";
const VERSION = "Versión 1.0";
const FECHA = "14/10/2026";
const ANIO = "2026";
const SIGLA = "ERS";
const LOGO = path.join(__dirname, "logo_upt.png");
const IMG = path.join(__dirname, "img");
const SALIDA = path.join(__dirname, "FD03-EPIS-Informe_Especificacion_Requerimientos.docx");

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

    h1("1. Introducción"),
    parrafo("Este documento describe, **en lenguaje sencillo**, todo lo que DepScan hará para sus usuarios. Está pensado para que cualquier persona —un estudiante, un docente o alguien sin formación técnica— entienda qué ofrece el sistema, cómo se usa y qué reglas sigue. Los detalles internos de construcción se explican en el Informe de Arquitectura (FD04)."),
    parrafo("**¿Qué es DepScan, en pocas palabras?**"),
    parrafo("Casi todos los programas se construyen usando \"piezas\" hechas por otras personas, llamadas **librerías** o **dependencias**. Es como construir una casa comprando puertas, ventanas y cerraduras a distintos fabricantes. Si uno de esos fabricantes descubre que cierto modelo de cerradura se abre fácilmente, lo publica en un aviso de seguridad; pero si el dueño de la casa no se entera, su casa sigue en riesgo."),
    parrafo("DepScan hace ese trabajo de vigilancia: **revisa la lista de piezas de un proyecto, la compara con los avisos de seguridad publicados en el mundo y le dice al usuario qué piezas están en riesgo, qué tan grave es y cómo reemplazarlas** por una versión segura."),
    parrafo("El usuario entrega su proyecto, DepScan lo revisa y devuelve un informe con el riesgo y las soluciones."),
    ...figuraAPA("Recorrido general del usuario", "fd03-01.png"),
    salto(),

    h1("2. Requerimientos Funcionales"),
    parrafo("Los requerimientos funcionales indican **qué puede hacer el usuario con el sistema**. La prioridad sigue la escala: **Alta** (imprescindible), **Media** (importante) y **Baja** (deseable)."),
    ...tablaAPA("Requerimientos Funcionales", ["ID","Requerimiento","Descripción para el usuario","Prioridad"], [817,2613,4779,817], [
      ["RF-01", "Subir archivos del proyecto", "El usuario puede arrastrar los archivos de su proyecto, o una carpeta completa, a la página. El sistema toma solo los archivos que necesita e ignora los demás.", "Alta"],
      ["RF-02", "Revisar un repositorio de GitHub", "El usuario puede escribir la dirección de un proyecto publicado en GitHub para revisarlo sin descargarlo.", "Alta"],
      ["RF-03", "Identificar las piezas y sus versiones", "El sistema descubre qué librerías usa el proyecto, incluidas las que llegan \"de rebote\" a través de otras, y qué versión exacta de cada una.", "Alta"],
      ["RF-04", "Buscar fallas de seguridad conocidas", "El sistema compara cada librería con los avisos de seguridad publicados en bases de datos internacionales.", "Alta"],
      ["RF-05", "Evitar fallas repetidas", "Si una misma falla aparece con varios nombres, el sistema la muestra una sola vez.", "Alta"],
      ["RF-06", "Mostrar un semáforo de riesgo", "El sistema resume el estado del proyecto en rojo (riesgo alto), amarillo (medio) o verde (sin riesgo relevante), con el número de fallas por gravedad.", "Alta"],
      ["RF-07", "Ver el detalle de cada falla", "El usuario puede abrir cualquier falla para leer en qué consiste, su gravedad, desde cuándo se conoce y dónde informarse más.", "Media"],
      ["RF-08", "Recomendar una versión segura", "Para cada librería en riesgo, el sistema indica a qué versión cambiar, prefiriendo la que menos cambios obliga a hacer.", "Alta"],
      ["RF-09", "Mostrar todas las alternativas seguras", "El sistema lista todas las versiones de esa misma librería que no tienen fallas conocidas.", "Media"],
      ["RF-10", "Explicar cómo aplicar la solución", "El sistema muestra las instrucciones exactas para actualizar, con un botón para copiarlas.", "Alta"],
      ["RF-11", "Aconsejar qué hacer si no se puede actualizar", "Si el usuario necesita seguir con la versión actual, el sistema le explica cómo protegerse mientras tanto y dónde está el arreglo oficial.", "Media"],
      ["RF-12", "Descargar el informe", "El usuario puede descargar el resultado como página web (HTML) o como documento PDF.", "Alta"],
      ["RF-13", "Iniciar sesión", "El usuario puede entrar con su cuenta de Google o de GitHub, y unir ambas en una sola cuenta.", "Media"],
      ["RF-14", "Ver y revisar mis repositorios", "Con GitHub conectado, el usuario ve la lista de sus proyectos (también los privados) y los revisa con un clic.", "Media"],
      ["RF-15", "Consultar el historial", "El usuario ve todas las revisiones que hizo, con fecha y resultado.", "Media"],
      ["RF-16", "Comparar dos revisiones", "El usuario elige dos revisiones y ve qué fallas son nuevas, cuáles se corrigieron y cuáles siguen.", "Baja"],
      ["RF-17", "Eliminar una revisión", "El usuario puede borrar una revisión de su historial.", "Baja"],
      ["RF-18", "Revisar automáticamente en cada cambio", "Un equipo puede programar la revisión para que se ejecute sola cada vez que sube cambios, y que detenga la entrega si hay fallas graves.", "Media"],
      ["RF-19", "Estimar versiones cuando no hay registro exacto", "Si el proyecto no indica la versión exacta instalada, el usuario puede pedir una estimación, que se marca claramente como tal.", "Baja"],
      ["RF-20", "Cerrar sesión y desconectar GitHub", "El usuario puede salir de su cuenta y retirar el permiso de acceso a GitHub cuando quiera.", "Media"],
    ]),
    salto(),

    h1("3. Requerimientos No Funcionales"),
    parrafo("Los requerimientos no funcionales describen **cómo debe comportarse el sistema**: rapidez, seguridad, facilidad de uso, etc."),
    ...tablaAPA("Requerimientos No Funcionales", ["ID","Cualidad","Requerimiento"], [867,1745,6414], [
      ["RNF-01", "Rapidez", "Un proyecto con mil librerías se revisa en menos de un minuto, incluyendo las soluciones; uno pequeño, en pocos segundos."],
      ["RNF-02", "Facilidad de uso", "Todo está en español y se puede revisar un proyecto en un máximo de tres pasos."],
      ["RNF-03", "Adaptabilidad", "La página se ve correctamente en computadoras, tablets y celulares, con modo claro y oscuro."],
      ["RNF-04", "Seguridad de la cuenta", "Las contraseñas nunca pasan por DepScan: el ingreso se hace en Google o GitHub. Los permisos guardados se almacenan cifrados."],
      ["RNF-05", "Privacidad", "Solo se leen los archivos de la lista de librerías, nunca el código del proyecto. Las revisiones de proyectos privados solo las ve su dueño."],
      ["RNF-06", "Disponibilidad", "El servicio está disponible en internet y se reinicia solo ante una falla."],
      ["RNF-07", "Honestidad del resultado", "El sistema nunca inventa una versión: si no puede saberla, lo dice. Las estimaciones se marcan como estimaciones."],
      ["RNF-08", "Evidencia", "Cada informe registra la fecha, la versión del sistema y, para proyectos de GitHub, la versión exacta del proyecto revisada."],
      ["RNF-09", "Uso responsable", "Cada persona puede hacer hasta 20 revisiones por minuto, para que el servicio no se sature."],
      ["RNF-10", "Confiabilidad", "Antes de publicar cualquier cambio, el sistema supera sus pruebas automáticas."],
      ["RNF-11", "Cumplimiento legal", "Los datos personales se tratan según la Ley N.º 29733 de Protección de Datos Personales."],
    ]),
    salto(),

    h1("4. Reglas de Negocio"),
    parrafo("Son las reglas que el sistema sigue siempre para decidir qué mostrar."),
    ...tablaAPA("Reglas de Negocio", ["ID","Regla"], [870,8156], [
      ["RN-01", "Una falla de seguridad cuenta **una sola vez** aunque se publique con varios nombres."],
      ["RN-02", "La gravedad de una falla se toma, en este orden, de: el puntaje oficial del gobierno de EE. UU. (si se pidió), el puntaje de la base internacional y, por último, la etiqueta del aviso."],
      ["RN-03", "El semáforo es **rojo** si hay alguna falla crítica o alta; **amarillo** si hay fallas medias o de gravedad desconocida; **verde** si solo hay fallas bajas o ninguna."],
      ["RN-04", "Una versión se considera **segura** solo si no tiene **ninguna** falla conocida, no basta con que corrija la falla actual."],
      ["RN-05", "La versión **recomendada** es la más nueva que no obligue a un cambio grande (misma \"versión mayor\"). Si no existe, se recomienda la mínima segura y se advierte que puede requerir ajustes."],
      ["RN-06", "Si una librería llega \"de rebote\" y la pieza que la trae ya acepta la versión segura, basta con actualizar; si no la acepta, se indica cómo forzar la versión."],
      ["RN-07", "Si no se conoce la versión exacta, la librería se marca como \"no determinable\" y no se revisa, salvo que el usuario pida una estimación."],
      ["RN-08", "Las librerías que solo se usan durante el desarrollo se señalan con prioridad menor, porque no llegan al producto final."],
      ["RN-09", "Las revisiones de un proyecto privado solo las puede ver la persona que las hizo."],
      ["RN-10", "Sin cuenta, el historial queda asociado al navegador; al iniciar sesión, esas revisiones pasan a la cuenta."],
      ["RN-11", "Al revisar automáticamente, la entrega se detiene si hay fallas iguales o más graves que el nivel elegido (por defecto, críticas)."],
      ["RN-12", "Las cuentas de Google y GitHub se unen automáticamente solo si ambas confirman el mismo correo verificado."],
    ]),
    salto(),

    h1("5. Perfiles de Usuario"),
    ...tablaAPA("Perfiles de Usuario", ["Perfil","¿Quién es?","¿Qué necesita?","¿Qué puede hacer?"], [996,2607,2912,2511], [
      ["**Visitante**", "Cualquier persona que entra a la página sin iniciar sesión.", "Saber rápido si su proyecto tiene riesgos.", "RF-01 a RF-12, RF-15 a RF-17 (historial en su navegador), RF-19."],
      ["**Usuario registrado**", "Persona que inició sesión con Google o GitHub.", "Guardar su historial, revisar sus proyectos privados y seguir su evolución.", "Todo lo del visitante, más RF-13, RF-14 y RF-20."],
      ["**Docente / evaluador**", "Profesor que revisa proyectos de estudiantes.", "Un informe claro y verificable.", "Abrir o descargar los informes (RF-12)."],
      ["**Revisión automática (CI)**", "Proceso que se ejecuta solo cuando un equipo sube cambios.", "Bloquear entregas con fallas graves.", "RF-18."],
    ]),
    parrafo("Los actores humanos interactúan con DepScan, que a su vez consulta servicios externos."),
    ...figuraAPA("Mapa de actores", "fd03-02.png"),
    salto(),

    h1("6. Casos de Uso Principales"),
    h2("6.1 Lista de casos de uso"),
    ...tablaAPA("Lista de casos de uso", ["ID","Caso de uso","Actor principal","Actores de apoyo","Requerimientos"], [846,2771,2015,2180,1214], [
      ["CU-01", "Revisar un proyecto subiendo sus archivos", "Visitante / Usuario registrado", "Bases de avisos de seguridad, registros de librerías", "RF-01, RF-03 a RF-06, RF-19"],
      ["CU-02", "Revisar un repositorio de GitHub", "Visitante / Usuario registrado", "GitHub, bases de avisos, registros de librerías", "RF-02 a RF-06, RF-19"],
      ["CU-03", "Consultar el resultado y el detalle de las fallas", "Visitante / Usuario registrado", "Bases de avisos de seguridad", "RF-06, RF-07"],
      ["CU-04", "Ver la solución de una librería", "Visitante / Usuario registrado", "—", "RF-08 a RF-11"],
      ["CU-05", "Descargar el informe", "Visitante / Usuario registrado / Docente", "—", "RF-12"],
      ["CU-06", "Iniciar sesión y unir cuentas", "Visitante", "Google, GitHub", "RF-13"],
      ["CU-07", "Revisar mis repositorios de GitHub", "Usuario registrado", "GitHub", "RF-14"],
      ["CU-08", "Consultar, comparar y eliminar revisiones del historial", "Visitante / Usuario registrado", "—", "RF-15, RF-16, RF-17"],
      ["CU-09", "Revisión automática en cada cambio", "Revisión automática", "Bases de avisos de seguridad", "RF-18"],
      ["CU-10", "Cerrar sesión o desconectar GitHub", "Usuario registrado", "—", "RF-20"],
    ]),
    h2("6.2 Diagrama general de casos de uso"),
    parrafo("El diagrama reúne a todos los actores y las acciones que cada uno puede realizar. Las flechas punteadas indican relaciones de **inclusión** (un caso siempre usa a otro) y de **extensión** (un caso agrega una opción a otro)."),
    ...figuraAPA("Diagrama: Diagrama general de casos de uso", "fd03-03.png"),
    h2("6.3 Diagramas de casos de uso por paquete"),
    parrafo("Para facilitar la lectura, los casos de uso se agrupan en tres paquetes: revisión de proyectos, resultados y cuenta."),
    ...figuraAPA("Paquete 1: Revisión de proyectos", "fd03-04.png"),
    ...figuraAPA("Paquete 2: Resultados", "fd03-05.png"),
    ...figuraAPA("Paquete 3: Cuenta", "fd03-06.png"),
    h2("6.4 Especificación de los casos de uso"),
    parrafo("Cada caso de uso se describe con su **ficha**, su **diagrama de actividades** (organizado en carriles: lo que hace el usuario, lo que hace DepScan y lo que hacen los servicios externos) y su **diagrama de secuencia** (el orden de los mensajes entre los participantes)."),
    h3("CU-01 – Revisar un proyecto subiendo sus archivos"),
    ...tablaAtributos("Ficha del caso de uso CU-01", ["Elemento","Descripción"], [
      ["Actor principal", "Visitante o usuario registrado"],
      ["Actores de apoyo", "Bases de avisos de seguridad; registros de librerías (solo si se pide estimar versiones)"],
      ["Objetivo", "Saber si las librerías de su proyecto tienen fallas de seguridad conocidas."],
      ["Precondición", "El usuario tiene en su computadora los archivos con la lista de librerías del proyecto."],
      ["Disparador", "El usuario abre la página \"Nuevo escaneo\"."],
      ["Flujo principal", "1. El usuario abre \"Nuevo escaneo\" en la pestaña \"Subir archivos\".\n2. Arrastra los archivos o pulsa \"Elegir carpeta\".\n3. DepScan separa los archivos útiles de los que no lo son y muestra la lista aceptada.\n4. El usuario escribe, si quiere, un nombre para el proyecto.\n5. Elige las opciones: incluir librerías de desarrollo, estimar versiones, usar la base oficial de EE. UU.\n6. Pulsa **Escanear**.\n7. DepScan identifica cada librería y su versión exacta.\n8. Consulta las bases de avisos de seguridad.\n9. Une las fallas repetidas y calcula su gravedad.\n10. Calcula las versiones seguras y los pasos de solución.\n11. Guarda la revisión en el historial.\n12. Muestra el resultado (continúa en CU-03)."],
      ["Flujos alternativos", "3a. Ningún archivo es válido: DepScan explica qué archivos necesita y vuelve al paso 2.\n3b. Falta el archivo de versiones exactas: DepScan advierte que la precisión será menor y sugiere subirlo o activar la estimación.\n6a. Se superó el límite de 20 revisiones por minuto: DepScan pide esperar un momento.\n8a. La base de avisos no responde: DepScan reintenta y, si no lo logra, informa que intente más tarde."],
      ["Postcondición", "La revisión queda guardada en el historial del usuario (o del navegador, si no inició sesión)."],
      ["Reglas de negocio", "RN-01, RN-02, RN-03, RN-07, RN-08, RN-10"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-01", "fd03-07.png"),
    ...figuraAPA("Diagrama de secuencia – CU-01", "fd03-08.png"),
    h3("CU-02 – Revisar un repositorio de GitHub"),
    ...tablaAtributos("Ficha del caso de uso CU-02", ["Elemento","Descripción"], [
      ["Actor principal", "Visitante o usuario registrado"],
      ["Actores de apoyo", "GitHub; bases de avisos de seguridad; registros de librerías"],
      ["Objetivo", "Revisar un proyecto publicado en GitHub sin descargarlo."],
      ["Precondición", "Conocer la dirección del repositorio. Si es privado, haber conectado GitHub (CU-06)."],
      ["Disparador", "El usuario elige la pestaña \"Repositorio de GitHub\" en \"Nuevo escaneo\" (o pulsa Escanear en CU-07)."],
      ["Flujo principal", "1. El usuario abre \"Nuevo escaneo\" y elige \"Repositorio de GitHub\".\n2. Escribe la dirección (por ejemplo, `usuario/proyecto`) y, si quiere, una rama o versión.\n3. Pulsa **Escanear**.\n4. DepScan pregunta a GitHub por el repositorio y por la versión exacta (commit) que va a revisar.\n5. Descarga solo los archivos con la lista de librerías.\n6. Continúa como CU-01 desde el paso 7.\n7. Guarda la revisión anotando la versión exacta del repositorio y si es privado."],
      ["Flujos alternativos", "2a. La dirección no tiene el formato correcto: DepScan lo indica.\n4a. El repositorio no existe, o es privado y el usuario no conectó GitHub: DepScan lo explica y sugiere conectar GitHub.\n4b. La rama o versión no existe: DepScan lo informa.\n5a. El repositorio no tiene archivos de librerías: DepScan informa que no encontró qué revisar."],
      ["Postcondición", "La revisión queda guardada; si el repositorio es privado, solo la ve su dueño."],
      ["Reglas de negocio", "RN-01 a RN-03, RN-07, RN-09"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-02", "fd03-09.png"),
    ...figuraAPA("Diagrama de secuencia – CU-02", "fd03-10.png"),
    h3("CU-03 – Consultar el resultado y el detalle de las fallas"),
    ...tablaAtributos("Ficha del caso de uso CU-03", ["Elemento","Descripción"], [
      ["Actor principal", "Visitante o usuario registrado"],
      ["Actores de apoyo", "Bases de avisos de seguridad (para la descripción completa de una falla)"],
      ["Objetivo", "Entender el estado de seguridad del proyecto y qué atender primero."],
      ["Precondición", "Existe una revisión terminada (CU-01, CU-02 o desde el historial en CU-08)."],
      ["Disparador", "Termina una revisión o el usuario abre una desde el historial."],
      ["Flujo principal", "1. DepScan muestra el nombre del proyecto, la fecha y la versión revisada.\n2. Muestra el semáforo y las cifras: librerías en riesgo, fallas críticas y altas, directas y \"de rebote\".\n3. Muestra un gráfico con las fallas por gravedad.\n4. Muestra los archivos analizados y las advertencias.\n5. Presenta la tabla de librerías en riesgo, ordenada de la más grave a la menos grave.\n6. El usuario filtra por gravedad, tipo o lenguaje, o busca por nombre.\n7. El usuario pulsa una falla.\n8. DepScan abre un panel con la gravedad, su origen, los otros nombres de la falla, las versiones que la corrigen, la descripción y las referencias.\n9. El usuario cierra el panel."],
      ["Flujos alternativos", "1a. La revisión es privada y el usuario no es su dueño: DepScan responde que no existe.\n5a. No hay fallas: DepScan muestra el mensaje \"No se encontraron vulnerabilidades conocidas\".\n6a. El usuario cambia a la pestaña \"Todas las dependencias\" para ver cada librería con su versión y de dónde se obtuvo.\n8a. No se puede obtener la descripción completa: DepScan muestra los datos que ya tiene."],
      ["Postcondición", "El usuario sabe qué librerías atender primero."],
      ["Reglas de negocio", "RN-01, RN-02, RN-03, RN-08, RN-09"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-03", "fd03-11.png"),
    ...figuraAPA("Diagrama de secuencia – CU-03", "fd03-12.png"),
    h3("CU-04 – Ver la solución de una librería"),
    ...tablaAtributos("Ficha del caso de uso CU-04", ["Elemento","Descripción"], [
      ["Actor principal", "Visitante o usuario registrado"],
      ["Objetivo", "Saber exactamente cómo resolver el riesgo de una librería, o cómo protegerse si no se puede actualizar."],
      ["Precondición", "El usuario está viendo un resultado con fallas (CU-03)."],
      ["Disparador", "El usuario pulsa **Ver solución** en una fila de la tabla."],
      ["Flujo principal", "1. DepScan abre el panel \"Cómo resolverlo\" con el nombre, la versión actual y si la librería es directa o \"de rebote\".\n2. Lista las fallas de esa librería con su gravedad.\n3. Muestra la recomendación, por ejemplo \"Actualizar a 7.3.7\".\n4. Muestra las opciones: mínima segura, más nueva sin cambio grande y más nueva disponible, indicando cuáles pueden requerir ajustes.\n5. Lista todas las versiones seguras e indica si fueron verificadas contra todos los avisos.\n6. Muestra los pasos para aplicar el cambio.\n7. El usuario pulsa **Copiar** en un paso.\n8. DepScan copia la instrucción y confirma con \"Copiado\".\n9. Muestra las medidas temporales y los arreglos oficiales, si existen.\n10. Muestra notas (por ejemplo, \"solo se usa en desarrollo\").\n11. El usuario cierra el panel."],
      ["Flujos alternativos", "3a. No existe versión segura: DepScan lo indica y destaca las medidas de protección.\n6a. La librería llega \"de rebote\" y la pieza que la trae ya acepta la versión segura: el paso es \"basta con actualizar\".\n6b. La pieza que la trae no la acepta: DepScan muestra cómo forzar la versión segura y, como alternativa, actualizar la pieza principal.\n5a. Hay más de 15 versiones seguras: DepScan muestra las primeras y un enlace \"ver más\"."],
      ["Postcondición", "El usuario tiene un plan de acción concreto."],
      ["Reglas de negocio", "RN-04, RN-05, RN-06, RN-08"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-04", "fd03-13.png"),
    ...figuraAPA("Diagrama de secuencia – CU-04", "fd03-14.png"),
    h3("CU-05 – Descargar el informe"),
    ...tablaAtributos("Ficha del caso de uso CU-05", ["Elemento","Descripción"], [
      ["Actor principal", "Visitante, usuario registrado o docente"],
      ["Objetivo", "Obtener un documento con el resultado para entregarlo o archivarlo."],
      ["Precondición", "Existe una revisión terminada a la que el actor tiene acceso."],
      ["Disparador", "El actor pulsa **Ver reporte**, **Descargar HTML** o **Descargar PDF**."],
      ["Flujo principal", "1. El actor pulsa el botón de descarga.\n2. DepScan comprueba que la revisión exista y que tenga permiso para verla.\n3. Arma el documento con la portada (proyecto, fecha, versión revisada), el semáforo, las cifras, la tabla de hallazgos, la solución de cada librería y las limitaciones.\n4. Entrega el archivo con un nombre que incluye el proyecto y la fecha.\n5. El navegador lo guarda en la computadora."],
      ["Flujos alternativos", "1a. Pulsa \"Ver reporte\": el informe HTML se abre en una pestaña nueva, en lugar de descargarse.\n2a. La revisión es privada y el actor no es su dueño: DepScan responde que no existe."],
      ["Postcondición", "El actor tiene el informe en su computadora."],
      ["Reglas de negocio", "RN-09"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-05", "fd03-15.png"),
    ...figuraAPA("Diagrama de secuencia – CU-05", "fd03-16.png"),
    h3("CU-06 – Iniciar sesión y unir cuentas"),
    ...tablaAtributos("Ficha del caso de uso CU-06", ["Elemento","Descripción"], [
      ["Actor principal", "Visitante (o usuario registrado que quiere unir la otra cuenta)"],
      ["Actores de apoyo", "Google; GitHub"],
      ["Objetivo", "Tener una cuenta para conservar el historial y revisar repositorios privados."],
      ["Precondición", "El actor tiene una cuenta de Google o de GitHub. El inicio de sesión está habilitado en el servidor."],
      ["Disparador", "El actor pulsa **Iniciar sesión** (o **Conectar GitHub** / **Vincular Google** en su menú)."],
      ["Flujo principal", "1. El actor elige \"Continuar con Google\" o \"Continuar con GitHub\".\n2. DepScan prepara una solicitud única y lo envía a la página oficial del servicio.\n3. El actor escribe allí su contraseña (DepScan nunca la ve).\n4. El actor acepta compartir su nombre, correo y foto (y, en GitHub, el acceso a sus repositorios).\n5. El servicio devuelve al actor a DepScan con un código de un solo uso.\n6. DepScan comprueba que la solicitud sea la misma que preparó y que no haya vencido.\n7. Canjea el código por la confirmación de identidad.\n8. Busca si esa cuenta ya existe; si no, crea la cuenta del usuario.\n9. Guarda cifrado el permiso de GitHub (si aplica).\n10. Pasa a la cuenta las revisiones hechas antes en ese navegador.\n11. Abre una sesión nueva y lleva al usuario a la página desde la que empezó."],
      ["Flujos alternativos", "4a. El actor cancela: vuelve a \"Iniciar sesión\" con el aviso \"Cancelaste el inicio de sesión\".\n6a. La solicitud no coincide o venció (más de 10 minutos): DepScan pide intentarlo de nuevo.\n8a. El actor ya tenía sesión con el otro servicio: ambas cuentas quedan unidas.\n8b. El correo verificado coincide con una cuenta existente: se une a esa cuenta.\n8c. Esa cuenta de Google/GitHub ya pertenece a otro usuario: DepScan lo informa y no la une.\n1a. El inicio de sesión no está configurado: los botones aparecen desactivados con una explicación."],
      ["Postcondición", "El usuario tiene sesión iniciada y su historial asociado a la cuenta."],
      ["Reglas de negocio", "RN-10, RN-12"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-06", "fd03-17.png"),
    ...figuraAPA("Diagrama de secuencia – CU-06", "fd03-18.png"),
    h3("CU-07 – Revisar mis repositorios de GitHub"),
    ...tablaAtributos("Ficha del caso de uso CU-07", ["Elemento","Descripción"], [
      ["Actor principal", "Usuario registrado"],
      ["Actores de apoyo", "GitHub"],
      ["Objetivo", "Ver todos sus proyectos de GitHub y revisar cualquiera con un clic."],
      ["Precondición", "El usuario inició sesión y conectó GitHub (CU-06)."],
      ["Disparador", "El usuario abre **Mis repos de GitHub**."],
      ["Flujo principal", "1. El usuario abre \"Mis repos de GitHub\".\n2. DepScan pide a GitHub la lista de repositorios del usuario (propios, de colaboración y de sus organizaciones), ordenados por fecha de actualización.\n3. Muestra cada repositorio con su nombre, lenguaje, descripción, si es privado y su última actualización.\n4. El usuario filtra por nombre.\n5. El usuario escribe, si quiere, una rama o versión.\n6. Pulsa **Escanear** junto al repositorio.\n7. El botón cambia a \"Escaneando…\".\n8. DepScan ejecuta CU-02 con ese repositorio.\n9. Al terminar, lleva al usuario al resultado."],
      ["Flujos alternativos", "1a. El inicio con GitHub no está configurado: DepScan lo indica y sugiere escanear repositorios públicos desde \"Nuevo escaneo\".\n2a. GitHub no está conectado: DepScan ofrece \"Conectar GitHub\" (CU-06).\n2b. El permiso fue retirado desde GitHub: DepScan pide volver a conectar.\n3a. Hay más de 100 repositorios: aparece el botón \"Cargar más\".\n8a. El repositorio no tiene archivos de librerías: el aviso aparece debajo de ese repositorio."],
      ["Postcondición", "La revisión del repositorio queda en el historial del usuario."],
      ["Reglas de negocio", "RN-09"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-07", "fd03-19.png"),
    ...figuraAPA("Diagrama de secuencia – CU-07", "fd03-20.png"),
    h3("CU-08 – Consultar, comparar y eliminar revisiones del historial"),
    ...tablaAtributos("Ficha del caso de uso CU-08", ["Elemento","Descripción"], [
      ["Actor principal", "Visitante o usuario registrado"],
      ["Objetivo", "Ver la evolución de la seguridad de sus proyectos y mantener ordenado su historial."],
      ["Precondición", "Haber hecho al menos una revisión desde esa cuenta o ese navegador."],
      ["Disparador", "El usuario abre **Historial**."],
      ["Flujo principal (consultar y comparar)", "1. El usuario abre \"Historial\".\n2. DepScan muestra sus revisiones con proyecto, origen, fecha, semáforo, librerías en riesgo y fallas críticas y altas.\n3. El usuario marca dos revisiones.\n4. Pulsa **Comparar**.\n5. DepScan toma la más antigua como \"antes\" y la más reciente como \"después\".\n6. Muestra tres listas: fallas **nuevas**, **corregidas** y que **persisten**."],
      ["Flujo alternativo (eliminar)", "E1. El usuario pulsa **Eliminar** en una revisión. E2. DepScan pide confirmación en la misma fila. E3. El usuario pulsa **Eliminar** de nuevo. E4. DepScan borra la revisión y actualiza la lista. E3a. El usuario pulsa **Cancelar**: no se borra nada."],
      ["Otros flujos alternativos", "2a. No hay revisiones: DepScan invita a crear la primera.\n2b. El usuario no inició sesión: DepScan le recuerda que el historial está asociado al navegador y le sugiere iniciar sesión.\n3a. Marca una tercera revisión: se desmarca la más antigua de las seleccionadas.\n1a. El usuario abre una revisión: continúa en CU-03."],
      ["Postcondición", "El usuario conoce la evolución de su proyecto o su historial queda actualizado."],
      ["Reglas de negocio", "RN-09, RN-10"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-08", "fd03-21.png"),
    ...figuraAPA("Diagrama de secuencia – CU-08", "fd03-22.png"),
    h3("CU-09 – Revisión automática en cada cambio"),
    ...tablaAtributos("Ficha del caso de uso CU-09", ["Elemento","Descripción"], [
      ["Actor principal", "Revisión automática (configurada por el equipo en su repositorio)"],
      ["Actores de apoyo", "Bases de avisos de seguridad"],
      ["Objetivo", "Impedir que se entregue una versión del proyecto con fallas graves."],
      ["Precondición", "El equipo agregó la herramienta de línea de comandos de DepScan a su proceso automático y eligió el nivel de gravedad que detiene la entrega."],
      ["Disparador", "Un integrante del equipo sube cambios al repositorio."],
      ["Flujo principal", "1. Se inicia el proceso automático del repositorio.\n2. Se ejecutan las verificaciones del equipo (compilación y pruebas).\n3. Se ejecuta DepScan sobre la carpeta del proyecto con el nivel elegido (por ejemplo, \"alto\").\n4. DepScan lee los archivos de librerías.\n5. Consulta las bases de avisos.\n6. Analiza y genera el informe.\n7. No hay fallas del nivel elegido o superior: DepScan termina \"sin errores\" y la entrega continúa.\n8. Se guarda el informe como evidencia del proceso."],
      ["Flujos alternativos", "7a. Hay fallas del nivel elegido o superior: DepScan termina \"con errores\", la entrega se detiene y el equipo revisa el informe.\n5a. La base de avisos no responde: DepScan termina \"con fallo de ejecución\" y el equipo puede reintentar."],
      ["Postcondición", "La entrega continúa o se detiene según la gravedad encontrada; el informe queda guardado."],
      ["Reglas de negocio", "RN-01 a RN-03, RN-11"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-09", "fd03-23.png"),
    ...figuraAPA("Diagrama de secuencia – CU-09", "fd03-24.png"),
    h3("CU-10 – Cerrar sesión o desconectar GitHub"),
    ...tablaAtributos("Ficha del caso de uso CU-10", ["Elemento","Descripción"], [
      ["Actor principal", "Usuario registrado"],
      ["Objetivo", "Salir de su cuenta o retirar el permiso de acceso a sus repositorios."],
      ["Precondición", "El usuario tiene sesión iniciada."],
      ["Disparador", "El usuario abre su menú (foto en la esquina) o la página \"Mis repos de GitHub\"."],
      ["Flujo principal (cerrar sesión)", "1. El usuario abre su menú.\n2. Pulsa **Cerrar sesión**.\n3. DepScan elimina la sesión.\n4. Borra todos los datos de la cuenta que la página tenía en memoria.\n5. Lleva al usuario a la página de inicio, sin sesión."],
      ["Flujo alternativo (desconectar GitHub)", "D1. En \"Mis repos de GitHub\", el usuario pulsa **desconectar**. D2. DepScan borra el permiso de GitHub que tenía guardado (la cuenta sigue existiendo). D3. La página muestra \"Conecta tu cuenta de GitHub\"."],
      ["Otros flujos alternativos", "3a. La sesión ya había vencido: DepScan igualmente muestra la página sin sesión."],
      ["Postcondición", "Desde ese navegador ya no hay acceso a la cuenta o a los repositorios del usuario."],
      ["Reglas de negocio", "RN-09"],
    ]),
    ...figuraAPA("Diagrama de actividades – CU-10", "fd03-25.png"),
    ...figuraAPA("Diagrama de secuencia – CU-10", "fd03-26.png"),
    h2("6.5 Estados de una revisión"),
    parrafo("Una revisión pasa por estos estados desde que se solicita hasta que se elimina."),
    ...figuraAPA("Diagrama: Estados de una revisión", "fd03-27.png"),
    h2("6.6 Matriz de trazabilidad (requerimientos ↔ casos de uso)"),
    ...tablaAPA("Matriz de trazabilidad (requerimientos ↔ casos de uso)", ["RF","CU-01","CU-02","CU-03","CU-04","CU-05","CU-06","CU-07","CU-08","CU-09","CU-10"], [990,804,804,804,804,804,804,804,804,804,800], [
      ["RF-01", "X", "", "", "", "", "", "", "", "", ""],
      ["RF-02", "", "X", "", "", "", "", "X", "", "", ""],
      ["RF-03", "X", "X", "", "", "", "", "", "", "X", ""],
      ["RF-04", "X", "X", "", "", "", "", "", "", "X", ""],
      ["RF-05", "X", "X", "X", "", "", "", "", "", "X", ""],
      ["RF-06", "X", "X", "X", "", "", "", "", "", "X", ""],
      ["RF-07", "", "", "X", "", "", "", "", "", "", ""],
      ["RF-08", "", "", "", "X", "", "", "", "", "", ""],
      ["RF-09", "", "", "", "X", "", "", "", "", "", ""],
      ["RF-10", "", "", "", "X", "", "", "", "", "", ""],
      ["RF-11", "", "", "", "X", "", "", "", "", "", ""],
      ["RF-12", "", "", "", "", "X", "", "", "", "", ""],
      ["RF-13", "", "", "", "", "", "X", "", "", "", ""],
      ["RF-14", "", "", "", "", "", "", "X", "", "", ""],
      ["RF-15", "", "", "", "", "", "", "", "X", "", ""],
      ["RF-16", "", "", "", "", "", "", "", "X", "", ""],
      ["RF-17", "", "", "", "", "", "", "", "X", "", ""],
      ["RF-18", "", "", "", "", "", "", "", "", "X", ""],
      ["RF-19", "X", "X", "", "", "", "", "", "", "", ""],
      ["RF-20", "", "", "", "", "", "", "", "", "", "X"],
    ]),
    salto(),

    h1("7. Conclusiones"),
    ...numerada([
      "Se definieron **20 requerimientos funcionales** y **11 no funcionales** que cubren el ciclo completo: entregar un proyecto, conocer su riesgo, saber cómo resolverlo y conservar la evidencia.",
      "Las **12 reglas de negocio** garantizan resultados honestos y útiles: no se repiten fallas, no se inventan versiones y solo se recomiendan versiones sin ninguna falla conocida.",
      "Los **10 casos de uso** están especificados en su totalidad: cada uno cuenta con su ficha (actores, precondición, disparador, flujo principal, flujos alternativos, postcondición y reglas aplicadas), su **diagrama de actividades** por carriles y su **diagrama de secuencia**.",
      "La matriz de trazabilidad confirma que los 20 requerimientos funcionales están cubiertos por al menos un caso de uso.",
      "El sistema fue diseñado para que una persona sin formación en seguridad pueda revisar su proyecto en tres pasos y entender qué hacer, lo que lo convierte también en una herramienta de aprendizaje.",
    ]),
    salto(),

    h1("BIBLIOGRAFÍA"),
    ref("Cockburn, A. (2001). *Writing effective use cases*. Addison-Wesley."),
    ref("IEEE. (1998). *IEEE Std 830-1998: Recommended practice for software requirements specifications*. IEEE."),
    ref("Pressman, R. S., y Maxim, B. R. (2020). *Ingeniería del software: un enfoque práctico* (9.ª ed.). McGraw-Hill."),
    ref("Sommerville, I. (2016). *Software engineering* (10.ª ed.). Pearson."),
    salto(),

    h1("WEBGRAFÍA"),
    ref("Congreso de la República del Perú. (2011, 3 de julio). *Ley N.º 29733, Ley de Protección de Datos Personales*. Diario Oficial El Peruano. https://www.gob.pe"),
    ref("Object Management Group. (2017). *Unified Modeling Language (UML) version 2.5.1*. https://www.omg.org/spec/UML/2.5.1"),
    ref("OWASP Foundation. (2021). *OWASP Top 10: 2021*. https://owasp.org/Top10/"),
  ];
}

// páginas de cada título para el índice precargado
const PAGINAS = {
  "1. Introducción": "",
  "2. Requerimientos Funcionales": "",
  "3. Requerimientos No Funcionales": "",
  "4. Reglas de Negocio": "",
  "5. Perfiles de Usuario": "",
  "6. Casos de Uso Principales": "",
  "6.1 Lista de casos de uso": "",
  "6.2 Diagrama general de casos de uso": "",
  "6.3 Diagramas de casos de uso por paquete": "",
  "6.4 Especificación de los casos de uso": "",
  "6.5 Estados de una revisión": "",
  "6.6 Matriz de trazabilidad (requerimientos ↔ casos de uso)": "",
  "7. Conclusiones": "",
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
