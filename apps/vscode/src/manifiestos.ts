// Lógica pura de la extensión (sin importar "vscode"): ubicar una dependencia
// dentro de su manifiesto, reescribir su versión y decidir qué se subraya.
// Se prueba con Vitest en apps/vscode/test/unit.
import { normalizePyName, type Finding, type Severity } from "@depscan/core";

export interface Ubicacion {
  line: number; // base 0
  start: number;
  end: number;
}

const ORDEN: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };

export const esManifiesto = (archivo: string): boolean =>
  /(^|[\\/])(package\.json|package-lock\.json|npm-shrinkwrap\.json|requirements[^\\/]*\.txt)$/i.test(archivo);

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function nombreArchivo(ruta: string): string {
  return ruta.split(/[\\/]/).pop()!.toLowerCase();
}

function aUbicacion(texto: string, indice: number, largo: number): Ubicacion {
  const antes = texto.slice(0, indice);
  const line = antes.split("\n").length - 1;
  const start = indice - (antes.lastIndexOf("\n") + 1);
  return { line, start, end: start + largo };
}

/** Busca dónde aparece la dependencia en el texto del manifiesto. */
export function ubicarDependencia(archivo: string, texto: string, nombre: string): Ubicacion | null {
  const base = nombreArchivo(archivo);
  if (base === "package.json") {
    // Primera aparición como clave dentro de un bloque de dependencias: "lodash": "^4.17.15"
    const bloques = /"(dependencies|devDependencies|optionalDependencies|peerDependencies)"\s*:\s*\{/g;
    for (let b = bloques.exec(texto); b; b = bloques.exec(texto)) {
      const inicio = b.index + b[0].length;
      const fin = texto.indexOf("}", inicio);
      const re = new RegExp(`"${escapar(nombre)}"\\s*:\\s*"[^"]*"`);
      const m = re.exec(texto.slice(inicio, fin));
      if (m) return aUbicacion(texto, inicio + m.index, m[0].length);
    }
    return null;
  }
  if (base === "package-lock.json" || base === "npm-shrinkwrap.json") {
    const m = new RegExp(`"(?:[^"]*/)?node_modules/${escapar(nombre)}"`).exec(texto);
    return m ? aUbicacion(texto, m.index, m[0].length) : null;
  }
  if (/^requirements.*\.txt$/.test(base)) {
    const objetivo = normalizePyName(nombre);
    const lineas = texto.split("\n");
    for (let i = 0; i < lineas.length; i++) {
      const sinComentario = lineas[i]!.replace(/#.*/, "");
      const m = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(sinComentario);
      if (m && normalizePyName(m[1]!) === objetivo) {
        const start = sinComentario.indexOf(m[1]!);
        return { line: i, start, end: sinComentario.trimEnd().length };
      }
    }
  }
  return null;
}

/**
 * Devuelve el texto del manifiesto con la dependencia actualizada a `version`,
 * o null si no se encontró. En package.json conserva el prefijo ^ o ~.
 */
export function aplicarVersion(
  archivo: string,
  texto: string,
  nombre: string,
  version: string,
): string | null {
  const base = nombreArchivo(archivo);
  if (base === "package.json") {
    const u = ubicarDependencia(archivo, texto, nombre);
    if (!u) return null;
    const lineas = texto.split("\n");
    const linea = lineas[u.line]!;
    const tramo = linea.slice(u.start, u.end);
    const nuevo = tramo.replace(/:\s*"([\^~]?)[^"]*"$/, (_m, prefijo: string) => `: "${prefijo}${version}"`);
    lineas[u.line] = linea.slice(0, u.start) + nuevo + linea.slice(u.end);
    return lineas.join("\n");
  }
  if (/^requirements.*\.txt$/.test(base)) {
    const u = ubicarDependencia(archivo, texto, nombre);
    if (!u) return null;
    const lineas = texto.split("\n");
    const linea = lineas[u.line]!;
    const nombreOriginal = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*(\[[^\]]*\])?)/.exec(linea)![1]!;
    // Se conserva el marcador de entorno (; python_version…) y el comentario.
    const resto = linea.slice(u.end);
    const marcador = /;[^#]*/.exec(linea.slice(0, u.end))?.[0]?.trimEnd() ?? "";
    lineas[u.line] =
      linea.slice(0, u.start) + `${nombreOriginal}==${version}${marcador ? ` ${marcador}` : ""}` + resto;
    return lineas.join("\n");
  }
  return null;
}

/** ¿Este hallazgo alcanza la severidad mínima configurada? */
export const superaSeveridad = (f: Finding, minima: Severity): boolean =>
  ORDEN[f.maxSeverity] >= ORDEN[minima];

/** Texto corto para el subrayado del editor. */
export function mensajeDiagnostico(f: Finding): string {
  const d = f.dependency;
  const n = f.vulnerabilities.length;
  const ids = f.vulnerabilities
    .slice(0, 3)
    .map((v) => v.id)
    .join(", ");
  const mas = n > 3 ? ` y ${n - 3} más` : "";
  const sol =
    f.remediation?.status === "upgrade" && f.remediation.recommended
      ? ` → actualizar a ${f.remediation.recommended}${f.remediation.verified ? " (verificada)" : ""}`
      : f.remediation?.status === "no-fix"
        ? " → sin versión segura publicada: ver mitigaciones"
        : "";
  const via = d.direct ? "" : ` (transitiva vía ${d.path.slice(0, -1).join(" › ")})`;
  return `${d.name} ${d.resolved ?? "?"}: ${n} ${n === 1 ? "vulnerabilidad" : "vulnerabilidades"} ${f.maxSeverity.toUpperCase()} (${ids}${mas})${via}${sol}`;
}

/** Puede corregirse editando el manifiesto: directa con versión segura recomendada. */
export const corregible = (f: Finding): boolean =>
  f.dependency.direct && f.remediation?.status === "upgrade" && !!f.remediation.recommended;
