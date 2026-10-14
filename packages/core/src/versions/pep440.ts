/**
 * Implementación propia de PEP 440 (versiones de Python) y de los especificadores
 * (==, !=, >=, <=, >, <, ~=, ===, comodines .*), suficiente para requirements.txt
 * y para comparar rangos de OSV en el ecosistema PyPI.
 */

export interface Pep440 {
  epoch: number;
  release: number[];
  pre: [number, number] | null; // [0=a, 1=b, 2=rc, número]
  post: number | null;
  dev: number | null;
  local: (string | number)[] | null;
  raw: string;
}

const VERSION_RE = new RegExp(
  "^\\s*v?" +
    "(?:(?<epoch>[0-9]+)!)?" +
    "(?<release>[0-9]+(?:\\.[0-9]+)*)" +
    "(?<pre>[-_.]?(?<pre_l>alpha|a|beta|b|preview|pre|c|rc)[-_.]?(?<pre_n>[0-9]+)?)?" +
    "(?<post>(?:-(?<post_n1>[0-9]+))|(?:[-_.]?(?<post_l>post|rev|r)[-_.]?(?<post_n2>[0-9]+)?))?" +
    "(?<dev>[-_.]?(?<dev_l>dev)[-_.]?(?<dev_n>[0-9]+)?)?" +
    "(?:\\+(?<local>[a-z0-9]+(?:[-_.][a-z0-9]+)*))?" +
    "\\s*$",
  "i",
);

function preRank(label: string): number {
  const l = label.toLowerCase();
  if (l === "a" || l === "alpha") return 0;
  if (l === "b" || l === "beta") return 1;
  return 2; // c, rc, pre, preview
}

export function parsePep440(input: string): Pep440 | null {
  const m = VERSION_RE.exec(input);
  const g = m?.groups;
  if (!g || g.release === undefined) return null;
  const postN = g.post_n1 ?? g.post_n2;
  return {
    epoch: g.epoch ? Number(g.epoch) : 0,
    release: g.release.split(".").map(Number),
    pre: g.pre_l ? [preRank(g.pre_l), Number(g.pre_n ?? 0)] : null,
    post: g.post !== undefined ? Number(postN ?? 0) : null,
    dev: g.dev_l ? Number(g.dev_n ?? 0) : null,
    local: g.local
      ? g.local
          .toLowerCase()
          .split(/[-_.]/)
          .map((s) => (/^\d+$/.test(s) ? Number(s) : s))
      : null,
    raw: input.trim(),
  };
}

export function isPep440(input: string): boolean {
  return parsePep440(input) !== null;
}

export function isPrerelease(v: Pep440): boolean {
  return v.pre !== null || v.dev !== null;
}

function cmpNum(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function cmpRelease(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const c = cmpNum(a[i] ?? 0, b[i] ?? 0);
    if (c !== 0) return c;
  }
  return 0;
}

/** Clave de pre-release: sin pre pero con dev va antes que cualquier pre; sin pre va después. */
function preKey(v: Pep440): [number, number] {
  if (v.pre) return v.pre;
  if (v.post === null && v.dev !== null) return [-1, 0];
  return [3, 0];
}

function cmpLocal(a: Pep440["local"], b: Pep440["local"]): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return cmpNum(x, y);
    } else if (typeof x === "number")
      return 1; // numérico > alfanumérico
    else if (typeof y === "number") return -1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function comparePep440Parsed(a: Pep440, b: Pep440, ignoreLocal = false): number {
  let c = cmpNum(a.epoch, b.epoch);
  if (c) return c;
  c = cmpRelease(a.release, b.release);
  if (c) return c;
  const [ap, an] = preKey(a);
  const [bp, bn] = preKey(b);
  c = cmpNum(ap, bp) || cmpNum(an, bn);
  if (c) return c;
  c = cmpNum(a.post ?? -1, b.post ?? -1);
  if (c) return c;
  c = cmpNum(a.dev ?? Infinity, b.dev ?? Infinity);
  if (c) return c;
  return ignoreLocal ? 0 : cmpLocal(a.local, b.local);
}

export function comparePep440(a: string, b: string): number {
  const pa = parsePep440(a);
  const pb = parsePep440(b);
  if (!pa || !pb) throw new Error(`Versión PEP 440 inválida: ${pa ? b : a}`);
  return comparePep440Parsed(pa, pb);
}

interface Specifier {
  op: "~=" | "==" | "!=" | "<=" | ">=" | "<" | ">" | "===";
  version: string;
  wildcard: boolean;
}

/** Interpreta "~=1.4.2, >=1.0, !=1.3.*". Devuelve null si algún especificador es inválido. */
export function parseSpecifiers(spec: string): Specifier[] | null {
  const out: Specifier[] = [];
  for (const part of spec.split(",")) {
    const text = part.trim();
    if (!text) continue;
    const m = /^(~=|===|==|!=|<=|>=|<|>)\s*(.+)$/.exec(text);
    if (!m || !m[1] || !m[2]) return null;
    const op = m[1] as Specifier["op"];
    let version = m[2].trim();
    const wildcard = version.endsWith(".*");
    if (wildcard) {
      if (op !== "==" && op !== "!=") return null;
      version = version.slice(0, -2);
    }
    if (op !== "===" && !parsePep440(version)) return null;
    out.push({ op, version, wildcard });
  }
  return out;
}

function prefixMatch(v: Pep440, prefix: Pep440): boolean {
  if (v.epoch !== prefix.epoch) return false;
  return prefix.release.every((n, i) => (v.release[i] ?? 0) === n);
}

function sameRelease(a: Pep440, b: Pep440): boolean {
  return a.epoch === b.epoch && cmpRelease(a.release, b.release) === 0;
}

function testSpecifier(v: Pep440, s: Specifier): boolean {
  if (s.op === "===") return v.raw.toLowerCase() === s.version.toLowerCase();
  const t = parsePep440(s.version);
  if (!t) return false;
  switch (s.op) {
    case "==":
      return s.wildcard ? prefixMatch(v, t) : comparePep440Parsed(v, t, t.local === null) === 0;
    case "!=":
      return s.wildcard ? !prefixMatch(v, t) : comparePep440Parsed(v, t, t.local === null) !== 0;
    case ">=":
      return comparePep440Parsed(v, t, true) >= 0;
    case "<=":
      return comparePep440Parsed(v, t, true) <= 0;
    case ">":
      // >V excluye las post-releases de V (salvo que V sea post) y las versiones locales.
      if (comparePep440Parsed(v, t, true) <= 0) return false;
      return !(v.post !== null && t.post === null && sameRelease(v, t) && v.pre === null);
    case "<":
      // <V excluye las pre-releases de V (salvo que V sea pre-release).
      if (comparePep440Parsed(v, t, true) >= 0) return false;
      return !(isPrerelease(v) && !isPrerelease(t) && sameRelease(v, t));
    case "~=": {
      if (t.release.length < 2) return false;
      const prefix: Pep440 = { ...t, release: t.release.slice(0, -1), pre: null, post: null, dev: null };
      return comparePep440Parsed(v, t, true) >= 0 && prefixMatch(v, prefix);
    }
  }
}

function mentionsPrerelease(specs: Specifier[]): boolean {
  return specs.some((s) => {
    const t = parsePep440(s.version);
    return t !== null && isPrerelease(t) && s.op !== "!=";
  });
}

export function satisfiesPep440(version: string, spec: string, includePrerelease = false): boolean {
  const v = parsePep440(version);
  const specs = parseSpecifiers(spec);
  if (!v || !specs) return false;
  if (isPrerelease(v) && !includePrerelease && !mentionsPrerelease(specs)) return false;
  return specs.every((s) => testSpecifier(v, s));
}

export function maxSatisfyingPep440(versions: string[], spec: string): string | null {
  const specs = parseSpecifiers(spec);
  if (!specs) return null;
  const allowPre = mentionsPrerelease(specs);
  let best: Pep440 | null = null;
  for (const s of versions) {
    const v = parsePep440(s);
    if (!v || (isPrerelease(v) && !allowPre)) continue;
    if (!specs.every((sp) => testSpecifier(v, sp))) continue;
    if (!best || comparePep440Parsed(v, best) > 0) best = v;
  }
  return best?.raw ?? null;
}

/** Si el especificador fija una versión ("==1.2.3" o "===1.2.3") la devuelve; si no, null. */
export function exactPep440(spec: string): string | null {
  const specs = parseSpecifiers(spec);
  if (!specs || specs.length !== 1) return null;
  const [s] = specs;
  if (!s || s.wildcard || (s.op !== "==" && s.op !== "===")) return null;
  return s.version;
}
