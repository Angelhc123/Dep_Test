/**
 * Parser de requirements.txt (formato de pip):
 * - comentarios (# al inicio o precedido de espacio), continuación de línea con "\"
 * - -r / --requirement (recursivo, con detección de ciclos) y -c / --constraint
 * - opciones globales (-i, --index-url, --extra-index-url, -f, --trusted-host…)
 * - extras "pkg[a,b]", marcadores de entorno "; python_version < '3.8'", --hash
 * - requisitos por URL ("pkg @ https://…"), editables (-e) y rutas locales
 */

export interface DeclaredPyDependency {
  /** Nombre normalizado según PEP 503. */
  name: string;
  /** Especificador de versión ("==1.2.3", ">=2,<3"); vacío si no hay. */
  specifier: string;
  extras: string[];
  marker?: string;
  /** Archivo donde se declaró (útil con -r). */
  file: string;
  line: number;
  /** Motivo si el requisito no apunta a una versión del índice (URL, ruta, editable). */
  nonRegistry?: string;
}

export interface RequirementsInfo {
  dependencies: DeclaredPyDependency[];
  /** Archivos leídos, en orden (incluye los referenciados con -r). */
  files: string[];
  warnings: string[];
}

/** Lector de archivos relativo al proyecto; devuelve undefined si no existe. */
export type FileReader = (path: string) => string | undefined;

/** PEP 503: minúsculas y cualquier secuencia de [-_.] se vuelve "-". */
export function normalizePyName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

const GLOBAL_OPTIONS =
  /^(-i|--index-url|--extra-index-url|--no-index|-f|--find-links|--trusted-host|--pre|--prefer-binary|--require-hashes|--only-binary|--no-binary|--use-feature|--config-settings)\b/;

const REQ_RE = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[([^\]]*)\])?\s*(.*)$/;

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

/** Une rutas con "/" resolviendo "." y "..". */
export function joinPath(base: string, rel: string): string {
  const parts = (rel.startsWith("/") ? rel : base ? `${base}/${rel}` : rel).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

/** Une las líneas con "\" final y elimina comentarios. Devuelve [número de línea original, texto]. */
function logicalLines(text: string): [number, string][] {
  const out: [number, string][] = [];
  const physical = text.replace(/\r\n?/g, "\n").split("\n");
  let buffer = "";
  let start = 0;
  physical.forEach((line, i) => {
    if (!buffer) start = i + 1;
    const noComment = line.replace(/(^|\s)#.*$/, "");
    if (/\\\s*$/.test(noComment)) {
      buffer += noComment.replace(/\\\s*$/, " ");
      return;
    }
    buffer += noComment;
    const trimmed = buffer.trim();
    if (trimmed) out.push([start, trimmed]);
    buffer = "";
  });
  if (buffer.trim()) out.push([start, buffer.trim()]);
  return out;
}

function parseRequirementLine(line: string, file: string, lineNo: number): DeclaredPyDependency | string {
  // Quita opciones por requisito (--hash=…, --global-option…)
  let req = line
    .replace(/\s--hash[=\s]\S+/g, "")
    .replace(/\s--(global|install)-option[=\s]\S+/g, "")
    .trim();
  let marker: string | undefined;
  const semi = req.indexOf(";");
  if (semi !== -1) {
    marker = req.slice(semi + 1).trim();
    req = req.slice(0, semi).trim();
  }

  // Requisito directo por URL: "nombre @ https://…"
  const at = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[([^\]]*)\])?\s*@\s*(\S+)/.exec(req);
  if (at && at[1]) {
    return {
      name: normalizePyName(at[1]),
      specifier: "",
      extras: at[2]
        ? at[2]
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean)
        : [],
      marker,
      file,
      line: lineNo,
      nonRegistry: "requisito por URL",
    };
  }
  // URLs o rutas sin nombre (git+https://…#egg=pkg, ./paquete, archivo.whl)
  if (
    /^(\w+\+)?(https?|file|git|ssh):/.test(req) ||
    /^[./\\]/.test(req) ||
    /\.(whl|tar\.gz|zip)$/.test(req)
  ) {
    const egg = /#egg=([A-Za-z0-9._-]+)/.exec(req);
    if (egg && egg[1]) {
      return {
        name: normalizePyName(egg[1]),
        specifier: "",
        extras: [],
        marker,
        file,
        line: lineNo,
        nonRegistry: "requisito por URL o ruta",
      };
    }
    return `línea ${lineNo}: requisito por URL o ruta sin nombre de paquete, se omite`;
  }

  const m = REQ_RE.exec(req);
  if (!m || !m[1]) return `línea ${lineNo}: no se pudo interpretar "${line}"`;
  const specifier = (m[3] ?? "").replace(/^\((.*)\)$/, "$1").replace(/\s+/g, "");
  return {
    name: normalizePyName(m[1]),
    specifier,
    extras: m[2]
      ? m[2]
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
      : [],
    marker,
    file,
    line: lineNo,
  };
}

export function parseRequirements(entryFile: string, read: FileReader): RequirementsInfo {
  const deps: DeclaredPyDependency[] = [];
  const files: string[] = [];
  const warnings: string[] = [];
  const visited = new Set<string>();

  const visit = (file: string, from?: string) => {
    if (visited.has(file)) {
      if (from) warnings.push(`${from}: referencia circular a ${file}, se ignora`);
      return;
    }
    visited.add(file);
    const text = read(file);
    if (text === undefined) {
      warnings.push(`${from ?? file}: no se encontró el archivo referenciado ${file}`);
      return;
    }
    files.push(file);
    for (const [lineNo, line] of logicalLines(text)) {
      const include = /^(-r|--requirement)(?:\s+|=)(\S+)/.exec(line);
      if (include && include[2]) {
        visit(joinPath(dirname(file), include[2]), file);
        continue;
      }
      if (/^(-c|--constraint)(?:\s+|=)/.test(line)) {
        warnings.push(`${file}:${lineNo}: archivo de restricciones (-c) no se analiza`);
        continue;
      }
      if (GLOBAL_OPTIONS.test(line)) continue;
      const editable = /^(-e|--editable)(?:\s+|=)(.+)$/.exec(line);
      if (editable && editable[2]) {
        const r = parseRequirementLine(editable[2], file, lineNo);
        if (typeof r === "string") warnings.push(`${file}: ${r}`);
        else deps.push({ ...r, nonRegistry: "editable (-e)" });
        continue;
      }
      if (line.startsWith("-")) {
        warnings.push(`${file}:${lineNo}: opción desconocida "${line}", se ignora`);
        continue;
      }
      const r = parseRequirementLine(line, file, lineNo);
      if (typeof r === "string") warnings.push(`${file}: ${r}`);
      else deps.push(r);
    }
  };

  visit(entryFile);
  return { dependencies: deps, files, warnings };
}
