/**
 * Implementación propia de Semantic Versioning 2.0.0 y de los rangos de npm
 * (^, ~, x-ranges, guiones, ||). Sigue las reglas documentadas de node-semver,
 * incluida la exclusión de pre-releases que no comparten [mayor, menor, parche].
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
  raw: string;
}

type Op = "<" | "<=" | ">" | ">=" | "=";

interface Comparator {
  op: Op;
  v: SemVer;
}

/** Un rango es una disyunción (||) de conjuntos de comparadores (AND). Un conjunto vacío acepta todo. */
export type SemverRange = Comparator[][];

const FULL = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const PARTIAL =
  /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parsePrerelease(s: string | undefined): (string | number)[] {
  if (!s) return [];
  return s.split(".").map((id) => (/^\d+$/.test(id) ? Number(id) : id));
}

export function parseSemver(input: string): SemVer | null {
  const raw = input.trim().replace(/^=+/, "").trim();
  const m = FULL.exec(raw);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: parsePrerelease(m[4]),
    raw,
  };
}

export function isSemver(input: string): boolean {
  return parseSemver(input) !== null;
}

function compareIdentifiers(a: string | number, b: string | number): number {
  const an = typeof a === "number";
  const bn = typeof b === "number";
  if (an && bn) return a - b;
  if (an) return -1;
  if (bn) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareSemverParsed(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  const ap = a.prerelease;
  const bp = b.prerelease;
  if (ap.length === 0 && bp.length === 0) return 0;
  if (ap.length === 0) return 1;
  if (bp.length === 0) return -1;
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const x = ap[i];
    const y = bp[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const c = compareIdentifiers(x, y);
    if (c !== 0) return Math.sign(c);
  }
  return 0;
}

/** Compara dos versiones semver. Lanza error si alguna no es válida. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) throw new Error(`Versión semver inválida: ${pa ? b : a}`);
  return compareSemverParsed(pa, pb);
}

function sv(major: number, minor: number, patch: number, prerelease: (string | number)[] = []): SemVer {
  const pre = prerelease.length ? `-${prerelease.join(".")}` : "";
  return { major, minor, patch, prerelease, raw: `${major}.${minor}.${patch}${pre}` };
}

const isX = (p: string | undefined): boolean => p === undefined || p === "x" || p === "X" || p === "*";

interface Partial {
  major: number | null;
  minor: number | null;
  patch: number | null;
  prerelease: (string | number)[];
}

function parsePartial(s: string): Partial | null {
  const m = PARTIAL.exec(s);
  if (!m) return null;
  const major = isX(m[1]) ? null : Number(m[1]);
  const minor = major === null || isX(m[2]) ? null : Number(m[2]);
  const patch = minor === null || isX(m[3]) ? null : Number(m[3]);
  return { major, minor, patch, prerelease: patch === null ? [] : parsePrerelease(m[4]) };
}

/** Límite superior exclusivo "X.Y.Z-0" (excluye las pre-releases de X.Y.Z). */
const upper = (major: number, minor: number, patch: number): Comparator => ({
  op: "<",
  v: sv(major, minor, patch, [0]),
});

function caret(p: Partial): Comparator[] | null {
  if (p.major === null) return [];
  const lo: Comparator = { op: ">=", v: sv(p.major, p.minor ?? 0, p.patch ?? 0, p.prerelease) };
  if (p.major > 0 || p.minor === null) return [lo, upper(p.major + 1, 0, 0)];
  if (p.minor > 0 || p.patch === null) return [lo, upper(0, p.minor + 1, 0)];
  return [lo, upper(0, 0, p.patch + 1)];
}

function tilde(p: Partial): Comparator[] | null {
  if (p.major === null) return [];
  const lo: Comparator = { op: ">=", v: sv(p.major, p.minor ?? 0, p.patch ?? 0, p.prerelease) };
  if (p.minor === null) return [lo, upper(p.major + 1, 0, 0)];
  return [lo, upper(p.major, p.minor + 1, 0)];
}

function xrange(op: string, p: Partial): Comparator[] | null {
  const { major, minor, patch } = p;
  if (major === null) {
    // "*", ">=*" aceptan todo; "<*" y ">*" no aceptan nada.
    return op === "<" || op === ">" ? [{ op: "<", v: sv(0, 0, 0, [0]) }] : [];
  }
  if (patch !== null) {
    const o: Op = op === "" ? "=" : (op as Op);
    return [{ op: o, v: sv(major, minor ?? 0, patch, p.prerelease) }];
  }
  // Versión parcial: 1 o 1.2
  switch (op) {
    case "":
    case "=":
      return minor === null
        ? [{ op: ">=", v: sv(major, 0, 0) }, upper(major + 1, 0, 0)]
        : [{ op: ">=", v: sv(major, minor, 0) }, upper(major, minor + 1, 0)];
    case ">":
      return minor === null
        ? [{ op: ">=", v: sv(major + 1, 0, 0) }]
        : [{ op: ">=", v: sv(major, minor + 1, 0) }];
    case ">=":
      return [{ op: ">=", v: sv(major, minor ?? 0, 0) }];
    case "<":
      return [upper(major, minor ?? 0, 0)];
    case "<=":
      return minor === null ? [upper(major + 1, 0, 0)] : [upper(major, minor + 1, 0)];
    default:
      return null;
  }
}

function parseComparator(token: string): Comparator[] | null {
  const m = /^(\^|~>?|>=|<=|>|<|=)?\s*(.+)$/.exec(token);
  if (!m || m[2] === undefined) return null;
  const op = m[1] ?? "";
  const p = parsePartial(m[2]);
  if (!p) return null;
  if (op === "^") return caret(p);
  if (op === "~" || op === "~>") return tilde(p);
  return xrange(op, p);
}

function parseHyphen(from: string, to: string): Comparator[] | null {
  const a = parsePartial(from);
  const b = parsePartial(to);
  if (!a || !b) return null;
  const out: Comparator[] = [];
  if (a.major !== null) out.push({ op: ">=", v: sv(a.major, a.minor ?? 0, a.patch ?? 0, a.prerelease) });
  if (b.major !== null) {
    if (b.minor === null) out.push(upper(b.major + 1, 0, 0));
    else if (b.patch === null) out.push(upper(b.major, b.minor + 1, 0));
    else out.push({ op: "<=", v: sv(b.major, b.minor, b.patch, b.prerelease) });
  }
  return out;
}

/** Interpreta un rango de npm. Devuelve null si no es un rango semver (git, file:, url, etc.). */
export function parseSemverRange(range: string): SemverRange | null {
  const sets: SemverRange = [];
  for (const part of range.trim().split("||")) {
    const text = part.trim();
    const hy = /^(\S+)\s+-\s+(\S+)$/.exec(text);
    if (hy && hy[1] && hy[2]) {
      const set = parseHyphen(hy[1], hy[2]);
      if (!set) return null;
      sets.push(set);
      continue;
    }
    // Une operadores separados de su versión: ">= 1.2" → ">=1.2"
    const tokens = text
      .replace(/(\^|~>?|>=|<=|>|<|=)\s+/g, "$1")
      .split(/\s+/)
      .filter(Boolean);
    const set: Comparator[] = [];
    for (const t of tokens) {
      const c = parseComparator(t);
      if (!c) return null;
      set.push(...c);
    }
    sets.push(set);
  }
  return sets;
}

function testComparator(v: SemVer, c: Comparator): boolean {
  const r = compareSemverParsed(v, c.v);
  switch (c.op) {
    case "<":
      return r < 0;
    case "<=":
      return r <= 0;
    case ">":
      return r > 0;
    case ">=":
      return r >= 0;
    case "=":
      return r === 0;
  }
}

function testSet(v: SemVer, set: Comparator[], includePrerelease: boolean): boolean {
  if (!set.every((c) => testComparator(v, c))) return false;
  if (v.prerelease.length === 0 || includePrerelease) return true;
  // Una pre-release solo cuenta si algún comparador menciona una pre-release de la misma tupla.
  // Se ignoran los límites "-0" sintéticos, que no son una mención explícita.
  return set.some(
    (c) =>
      c.v.prerelease.length > 0 &&
      !(c.op === "<" && c.v.prerelease.length === 1 && c.v.prerelease[0] === 0) &&
      c.v.major === v.major &&
      c.v.minor === v.minor &&
      c.v.patch === v.patch,
  );
}

export function satisfiesSemver(version: string, range: string, includePrerelease = false): boolean {
  const v = parseSemver(version);
  const r = parseSemverRange(range);
  if (!v || !r) return false;
  return r.some((set) => testSet(v, set, includePrerelease));
}

export function maxSatisfyingSemver(versions: string[], range: string): string | null {
  const r = parseSemverRange(range);
  if (!r) return null;
  let best: SemVer | null = null;
  for (const s of versions) {
    const v = parseSemver(s);
    if (!v || !r.some((set) => testSet(v, set, false))) continue;
    if (!best || compareSemverParsed(v, best) > 0) best = v;
  }
  return best?.raw ?? null;
}

/** Si el rango fija una sola versión ("1.2.3", "=1.2.3", "v1.2.3") la devuelve; si no, null. */
export function exactSemver(range: string): string | null {
  const v = parseSemver(range.trim());
  return v ? v.raw.replace(/^v/, "") : null;
}
