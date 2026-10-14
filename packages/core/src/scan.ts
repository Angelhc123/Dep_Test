import {
  applyNvd,
  buildFinding,
  dedupe,
  normalizeVulnerability,
  sortFindings,
  summarize,
} from "./analysis/analyze.js";
import { buildRemediation } from "./analysis/remediation.js";
import type { Dependency, Finding, ProjectFiles, ScanReport, ScanTarget } from "./domain/types.js";
import { resolveProject } from "./resolver/resolve.js";
import { mapLimit } from "./sources/http.js";
import type {
  CveEnricher,
  CveInfo,
  OsvVulnerability,
  PackageQuery,
  RegistrySource,
  VulnSource,
} from "./sources/ports.js";

export const SCANNER_VERSION = "0.1.0";

export interface ScanSources {
  osv: VulnSource;
  nvd?: CveEnricher;
  registry?: RegistrySource;
}

export interface ScanOptions {
  target: ScanTarget;
  /** Estimar versiones sin lockfile consultando el registro. */
  estimate?: boolean;
  /** Enriquecer con NVD (lento sin API key: 5 solicitudes / 30 s). */
  enrichNvd?: boolean;
  includeDev?: boolean;
  /** Calcular soluciones: versiones seguras, comandos y mitigaciones (por defecto true). */
  remediation?: boolean;
  /** Avance para la interfaz: etapa y porcentaje aproximado. */
  onProgress?: (stage: string, percent: number) => void;
}

const queryKey = (q: PackageQuery) => `${q.ecosystem}|${q.name}|${q.version}`;

/**
 * Pipeline completo: manifiestos → versiones exactas → OSV (lote) → detalle →
 * NVD (opcional) → deduplicación, prioridad y versión segura → reporte.
 */
export async function scanProject(
  files: ProjectFiles,
  sources: ScanSources,
  opts: ScanOptions,
): Promise<ScanReport> {
  const started = Date.now();
  const progress = opts.onProgress ?? (() => undefined);

  progress("Leyendo manifiestos", 5);
  const resolved = await resolveProject(files, {
    estimate: opts.estimate,
    registry: sources.registry,
    includeDev: opts.includeDev,
  });
  const warnings = [...resolved.warnings];
  const deps = resolved.dependencies;

  // 1 consulta por name@version único, aunque aparezca en varios manifiestos.
  const queries = new Map<string, PackageQuery>();
  for (const d of deps) {
    if (!d.resolved) continue;
    const q = { name: d.name, ecosystem: d.ecosystem, version: d.resolved };
    queries.set(queryKey(q), q);
  }
  const queryList = [...queries.values()];

  progress(`Consultando OSV (${queryList.length} paquetes)`, 20);
  const idsPerQuery = queryList.length ? await sources.osv.queryBatch(queryList) : [];
  const idsByKey = new Map<string, string[]>();
  queryList.forEach((q, i) => idsByKey.set(queryKey(q), idsPerQuery[i] ?? []));

  const allIds = [...new Set(idsPerQuery.flat())];
  progress(`Descargando detalle de ${allIds.length} vulnerabilidades`, 45);
  const details = new Map<string, OsvVulnerability>();
  await mapLimit(allIds, 8, async (id) => {
    const v = await sources.osv.getVulnerability(id);
    if (v && !v.withdrawn) details.set(id, v);
  });

  // Normaliza y deduplica por dependencia.
  const perDep = new Map<Dependency, ReturnType<typeof dedupe>>();
  for (const d of deps) {
    if (!d.resolved) continue;
    const ids = idsByKey.get(queryKey({ name: d.name, ecosystem: d.ecosystem, version: d.resolved })) ?? [];
    const items = ids.flatMap((id) => {
      const osv = details.get(id);
      return osv ? [normalizeVulnerability(osv, d)] : [];
    });
    if (items.length) perDep.set(d, dedupe(items, d.ecosystem));
  }

  if (opts.enrichNvd && sources.nvd) {
    const cves = [
      ...new Set(
        [...perDep.values()]
          .flat()
          .map((i) => i.vuln.id)
          .filter((id) => id.startsWith("CVE-")),
      ),
    ];
    progress(`Enriqueciendo ${cves.length} CVE con NVD`, 65);
    const nvdInfo = new Map<string, CveInfo | null>();
    let failed = 0;
    await mapLimit(cves, 4, async (id) => {
      try {
        nvdInfo.set(id, await sources.nvd!.getCve(id));
      } catch {
        failed++;
      }
    });
    if (failed)
      warnings.push(`NVD: no se pudieron consultar ${failed} CVE (límite de uso o servicio no disponible)`);
    for (const items of perDep.values()) {
      for (const it of items) it.vuln = applyNvd(it.vuln, nvdInfo.get(it.vuln.id));
    }
  }

  progress("Analizando resultados", 75);
  const findings: Finding[] = sortFindings([...perDep.entries()].map(([d, items]) => buildFinding(d, items)));

  if (opts.remediation !== false && findings.length) {
    progress(`Calculando soluciones para ${findings.length} paquetes`, 85);
    let partial = 0;
    await mapLimit(findings, 6, async (f) => {
      const d = f.dependency;
      const ids =
        idsByKey.get(queryKey({ name: d.name, ecosystem: d.ecosystem, version: d.resolved ?? "" })) ?? [];
      const currentVulns = ids.flatMap((id) => details.get(id) ?? []);
      const [advisories, versions] = await Promise.all([
        sources.osv.queryPackage ? sources.osv.queryPackage(d.name, d.ecosystem).catch(() => null) : null,
        sources.registry ? sources.registry.listVersions(d.ecosystem, d.name).catch(() => null) : null,
      ]);
      f.remediation = buildRemediation({ finding: f, advisories, currentVulns, versions });
      if (!f.remediation.verified) partial++;
    });
    if (partial)
      warnings.push(
        `${partial} solución(es) calculadas con datos parciales (sin registro o sin avisos completos)`,
      );
  }

  const unresolved = deps.filter((d) => !d.resolved).length;
  if (unresolved)
    warnings.push(`${unresolved} dependencia(s) sin versión determinable no se pudieron verificar`);
  const estimated = deps.filter((d) => d.resolution === "registry-estimate").length;
  if (estimated)
    warnings.push(`${estimated} versión(es) estimadas con el registro: pueden no coincidir con lo instalado`);

  progress("Listo", 100);
  return {
    scannedAt: new Date().toISOString(),
    scannerVersion: SCANNER_VERSION,
    target: opts.target,
    manifests: resolved.manifests,
    summary: summarize(deps, findings),
    findings,
    dependencies: deps,
    warnings,
    durationMs: Date.now() - started,
  };
}
