/**
 * Calculadora del puntaje base CVSS 3.0 / 3.1 a partir del vector
 * (especificación: https://www.first.org/cvss/v3.1/specification-document, sección 7).
 * OSV entrega el vector, no el número, así que se calcula aquí.
 */

const W = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 },
} as const;

const PR_UNCHANGED = { N: 0.85, L: 0.62, H: 0.27 } as const;
const PR_CHANGED = { N: 0.85, L: 0.68, H: 0.5 } as const;

/** Redondeo hacia arriba a 1 decimal definido en CVSS 3.1 (evita errores de punto flotante). */
export function roundUp(value: number): number {
  const int = Math.round(value * 100_000);
  return int % 10_000 === 0 ? int / 100_000 : (Math.floor(int / 10_000) + 1) / 10;
}

export function cvss3BaseScore(vector: string): number | null {
  const m = /^CVSS:3\.[01]\/(.+)$/.exec(vector.trim());
  if (!m || !m[1]) return null;
  const metrics = new Map<string, string>();
  for (const part of m[1].split("/")) {
    const [k, v] = part.split(":");
    if (k && v) metrics.set(k, v);
  }
  const get = <T extends Record<string, number>>(table: T, key: string): number | null => {
    const v = metrics.get(key);
    return v !== undefined && v in table ? table[v as keyof T]! : null;
  };
  const scope = metrics.get("S");
  if (scope !== "U" && scope !== "C") return null;
  const changed = scope === "C";
  const av = get(W.AV, "AV");
  const ac = get(W.AC, "AC");
  const pr = get(changed ? PR_CHANGED : PR_UNCHANGED, "PR");
  const ui = get(W.UI, "UI");
  const c = get(W.CIA, "C");
  const i = get(W.CIA, "I");
  const a = get(W.CIA, "A");
  if ([av, ac, pr, ui, c, i, a].some((x) => x === null)) return null;

  const iss = 1 - (1 - c!) * (1 - i!) * (1 - a!);
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  const exploitability = 8.22 * av! * ac! * pr! * ui!;
  if (impact <= 0) return 0;
  return changed
    ? roundUp(Math.min(1.08 * (impact + exploitability), 10))
    : roundUp(Math.min(impact + exploitability, 10));
}
