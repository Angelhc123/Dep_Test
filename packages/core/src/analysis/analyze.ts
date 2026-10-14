import {
  severityFromScore,
  severityRank,
  type Dependency,
  type Finding,
  type Risk,
  type ScanSummary,
  type Severity,
  type Vulnerability,
} from "../domain/types.js";
import type { CveInfo, OsvAffected, OsvVulnerability } from "../sources/ports.js";
import { compareVersions, majorOf } from "../versions/index.js";
import { affectedFor, fixedVersions, isAffected } from "./affected.js";
import { cvss3BaseScore } from "./cvss.js";

const LABELS: Record<string, Severity> = {
  CRITICAL: "critical",
  HIGH: "high",
  MODERATE: "medium",
  MEDIUM: "medium",
  LOW: "low",
};

function labelFrom(obj: Record<string, unknown> | undefined): Severity | null {
  const s = obj?.severity;
  return typeof s === "string" ? (LABELS[s.toUpperCase()] ?? null) : null;
}

/** Vulnerabilidad normalizada para una dependencia concreta, más sus rangos OSV para calcular la corrección. */
export interface DependencyVuln {
  vuln: Vulnerability;
  affected: OsvAffected[];
}

export function normalizeVulnerability(osv: OsvVulnerability, dep: Dependency): DependencyVuln {
  const affected = affectedFor(osv, dep.ecosystem, dep.name);
  let severity: Severity = "unknown";
  let severitySource: Vulnerability["severitySource"] = "none";
  let cvss: number | undefined;
  let cvssVector: string | undefined;

  const v3 = osv.severity?.find((s) => s.type === "CVSS_V3");
  const score = v3 ? cvss3BaseScore(v3.score) : null;
  if (v3 && score !== null) {
    cvss = score;
    cvssVector = v3.score;
    severity = severityFromScore(score);
    severitySource = "osv-cvss";
  } else {
    const label =
      labelFrom(osv.database_specific) ?? affected.map((a) => labelFrom(a.database_specific)).find(Boolean);
    if (label) {
      severity = label;
      severitySource = "osv-label";
    }
    cvssVector = osv.severity?.[0]?.score;
  }

  return {
    vuln: {
      id: osv.id,
      aliases: [...new Set([osv.id, ...(osv.aliases ?? [])])],
      summary: osv.summary?.trim() || osv.details?.split("\n")[0]?.slice(0, 200) || osv.id,
      details: osv.details,
      severity,
      cvss,
      cvssVector,
      severitySource,
      fixedIn: fixedVersions(affected, dep.ecosystem),
      references: (osv.references ?? []).map((r) => r.url).slice(0, 15),
      published: osv.published,
      ...(osv.database_specific?.cwe_ids?.length ? { cwes: osv.database_specific.cwe_ids } : {}),
    },
    affected,
  };
}

function canonicalId(ids: string[]): string {
  return ids.find((i) => i.startsWith("CVE-")) ?? ids.find((i) => i.startsWith("GHSA-")) ?? ids[0]!;
}

/**
 * Deduplica la misma falla publicada con varios IDs (CVE, GHSA, PYSEC…).
 * Dos entradas son la misma si comparten algún ID o alias (unión transitiva).
 */
export function dedupe(items: DependencyVuln[], ecosystem: Dependency["ecosystem"]): DependencyVuln[] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const owner = new Map<string, number>();
  items.forEach((it, i) => {
    for (const id of it.vuln.aliases) {
      const j = owner.get(id);
      if (j === undefined) owner.set(id, i);
      else parent[find(i)] = find(j);
    }
  });
  const groups = new Map<number, DependencyVuln[]>();
  items.forEach((it, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), it]);
  });

  return [...groups.values()].map((group) => {
    if (group.length === 1) {
      const only = group[0]!;
      return { ...only, vuln: { ...only.vuln, id: canonicalId(only.vuln.aliases) } };
    }
    // Se toma como base la entrada con mejor fuente de severidad (CVSS > etiqueta) y mayor gravedad.
    const sourceRank = { nvd: 3, "osv-cvss": 2, "osv-label": 1, none: 0 } as const;
    const best = [...group].sort(
      (a, b) =>
        sourceRank[b.vuln.severitySource] - sourceRank[a.vuln.severitySource] ||
        severityRank(b.vuln.severity) - severityRank(a.vuln.severity),
    )[0]!;
    const aliases = [...new Set(group.flatMap((g) => g.vuln.aliases))].sort();
    const fixed = [...new Set(group.flatMap((g) => g.vuln.fixedIn))].sort((x, y) =>
      compareVersions(ecosystem, x, y),
    );
    const ghsa = group.find((g) => g.vuln.id.startsWith("GHSA-"));
    return {
      vuln: {
        ...best.vuln,
        id: canonicalId(aliases),
        aliases,
        summary: ghsa?.vuln.summary ?? best.vuln.summary,
        fixedIn: fixed,
        references: [...new Set(group.flatMap((g) => g.vuln.references))].slice(0, 20),
        cwes: [...new Set(group.flatMap((g) => g.vuln.cwes ?? []))],
      },
      affected: group.flatMap((g) => g.affected),
    };
  });
}

/** Aplica el puntaje de NVD (si existe) por encima del de OSV. */
export function applyNvd(v: Vulnerability, info: CveInfo | null | undefined): Vulnerability {
  if (!info || info.cvss === undefined) return v;
  return {
    ...v,
    cvss: info.cvss,
    cvssVector: info.cvssVector ?? v.cvssVector,
    severity: severityFromScore(info.cvss),
    severitySource: "nvd",
    details: v.details ?? info.description,
  };
}

export function riskOf(s: Severity): Risk {
  if (s === "critical" || s === "high") return "red";
  if (s === "medium" || s === "unknown") return "yellow";
  return "green";
}

/**
 * Menor versión superior a la actual que no está afectada por ninguna de las fallas
 * que tienen corrección. Las fallas sin corrección se reportan aparte.
 */
export function minSafeVersion(
  current: string,
  items: DependencyVuln[],
  ecosystem: Dependency["ecosystem"],
): { version: string | null; unfixed: string[] } {
  const cmp = (a: string, b: string) => compareVersions(ecosystem, a, b);
  const fixable = items.filter((i) => i.vuln.fixedIn.length > 0);
  const unfixed = items.filter((i) => i.vuln.fixedIn.length === 0).map((i) => i.vuln.id);
  if (!fixable.length) return { version: null, unfixed };
  const candidates = [...new Set(fixable.flatMap((i) => i.vuln.fixedIn))]
    .filter((v) => cmp(v, current) > 0)
    .sort(cmp);
  for (const c of candidates) {
    if (fixable.every((i) => !isAffected(c, i.affected, ecosystem))) return { version: c, unfixed };
  }
  return { version: null, unfixed };
}

export function buildFinding(dep: Dependency, items: DependencyVuln[]): Finding {
  const vulns = items
    .map((i) => i.vuln)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (b.cvss ?? 0) - (a.cvss ?? 0));
  const maxSeverity = vulns[0]?.severity ?? "unknown";
  const { version, unfixed } = dep.resolved
    ? minSafeVersion(dep.resolved, items, dep.ecosystem)
    : { version: null, unfixed: [] };
  const curMajor = dep.resolved ? majorOf(dep.ecosystem, dep.resolved) : null;
  const newMajor = version ? majorOf(dep.ecosystem, version) : null;
  return {
    dependency: dep,
    vulnerabilities: vulns,
    maxSeverity,
    minSafeVersion: version,
    majorBump: curMajor !== null && newMajor !== null && newMajor > curMajor,
    unfixed,
    risk: riskOf(maxSeverity),
  };
}

/** Orden de prioridad: severidad, directas primero, CVSS, nombre. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      severityRank(b.maxSeverity) - severityRank(a.maxSeverity) ||
      Number(b.dependency.direct) - Number(a.dependency.direct) ||
      (b.vulnerabilities[0]?.cvss ?? 0) - (a.vulnerabilities[0]?.cvss ?? 0) ||
      a.dependency.name.localeCompare(b.dependency.name),
  );
}

export function summarize(dependencies: Dependency[], findings: Finding[]): ScanSummary {
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const seen = new Set<string>();
  for (const f of findings) {
    for (const v of f.vulnerabilities) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      bySeverity[v.severity]++;
    }
  }
  const worst = findings.reduce<Severity | null>(
    (acc, f) => (acc === null || severityRank(f.maxSeverity) > severityRank(acc) ? f.maxSeverity : acc),
    null,
  );
  return {
    dependencies: dependencies.length,
    direct: dependencies.filter((d) => d.direct).length,
    transitive: dependencies.filter((d) => !d.direct).length,
    unresolved: dependencies.filter((d) => d.resolved === null).length,
    vulnerableDependencies: findings.length,
    bySeverity,
    risk: worst === null ? "green" : riskOf(worst),
  };
}

/** Umbral para el código de salida de la CLI/CI. */
export type FailThreshold = "critical" | "high" | "medium" | "low" | "none";

export function shouldFail(summary: ScanSummary, threshold: FailThreshold): boolean {
  if (threshold === "none") return false;
  const order: Severity[] = ["critical", "high", "medium", "low"];
  const limit = order.indexOf(threshold);
  return order.slice(0, limit + 1).some((s) => summary.bySeverity[s] > 0);
}
