import type { Ecosystem, Finding, Mitigation, Remediation, UpgradeOption } from "../domain/types.js";
import type { OsvAffected, OsvVulnerability } from "../sources/ports.js";
import {
  compareVersions,
  isValidVersion,
  majorOf,
  parsePep440,
  parseSemver,
  satisfies,
} from "../versions/index.js";
import { isPrerelease } from "../versions/pep440.js";
import { affectedFor, isAffected } from "./affected.js";
import { cweGuidance, extractWorkaround } from "./cwe-guidance.js";

export interface RemediationInput {
  finding: Finding;
  /** Todos los avisos conocidos del paquete (OSV /v1/query sin versión). null si no se pudo obtener. */
  advisories: OsvVulnerability[] | null;
  /** Avisos que afectan a la versión actual (detalle OSV completo). */
  currentVulns: OsvVulnerability[];
  /** Versiones publicadas en el registro. null si no se pudo obtener. */
  versions: string[] | null;
}

const MAX_SAFE_LISTED = 40;

function isStable(eco: Ecosystem, v: string): boolean {
  if (eco === "npm") return (parseSemver(v)?.prerelease.length ?? 1) === 0;
  const p = parsePep440(v);
  return p !== null && !isPrerelease(p);
}

function fixUrls(v: OsvVulnerability): string[] {
  const refs = v.references ?? [];
  const fix = refs.filter((r) => r.type === "FIX" || /\/commit\/[0-9a-f]{7,}|\/pull\/\d+/.test(r.url));
  return [...new Set(fix.map((r) => r.url))].slice(0, 3);
}

function mitigationsFor(vulns: OsvVulnerability[], idOf: (v: OsvVulnerability) => string): Mitigation[] {
  const out: Mitigation[] = [];
  const byCwe = new Map<string, string[]>();
  for (const v of vulns) {
    const workaround = extractWorkaround(v.details);
    if (workaround)
      out.push({
        vulnId: idOf(v),
        title: "Solución temporal indicada en el aviso",
        text: workaround,
        source: "advisory",
      });
    for (const cwe of v.database_specific?.cwe_ids ?? []) {
      byCwe.set(cwe, [...new Set([...(byCwe.get(cwe) ?? []), idOf(v)])]);
    }
  }
  for (const [cwe, ids] of byCwe) {
    const g = cweGuidance(cwe);
    if (g)
      out.push({ vulnId: ids.join(", "), title: `${cwe}: ${g.name}`, text: g.advice, source: "cwe", cwe });
  }
  return out;
}

/**
 * Calcula cómo resolver un hallazgo:
 * - versiones seguras = versiones estables publicadas que no están afectadas por NINGÚN aviso del paquete
 *   (no solo los que afectan a la versión actual: una versión nueva puede tener fallas propias);
 * - recomendada = la más nueva sin fallas dentro de la misma versión mayor (sin ruptura según semver);
 *   si no existe, la mínima segura (implica salto mayor);
 * - comandos, fragmento de overrides para transitivas y mitigaciones si se sigue con la versión vulnerable.
 */
export function buildRemediation({
  finding,
  advisories,
  currentVulns,
  versions,
}: RemediationInput): Remediation {
  const dep = finding.dependency;
  const eco = dep.ecosystem;
  const current = dep.resolved;
  const cmp = (a: string, b: string) => compareVersions(eco, a, b);
  const notes: string[] = [];
  const canonical = new Map<string, string>();
  for (const v of finding.vulnerabilities) for (const a of v.aliases) canonical.set(a, v.id);
  const idOf = (v: OsvVulnerability) => canonical.get(v.id) ?? v.id;

  const mitigations = mitigationsFor(currentVulns, idOf);
  const patches = currentVulns.flatMap((v) => fixUrls(v).map((url) => ({ vulnId: idOf(v), url })));
  const empty: Remediation = {
    status: "unknown",
    recommended: null,
    options: [],
    safeVersions: [],
    totalSafeVersions: 0,
    verified: false,
    commands: [],
    mitigations,
    patches,
    notes,
  };
  if (!current || !isValidVersion(eco, current))
    return { ...empty, notes: ["No hay versión exacta para calcular la solución."] };

  // Avisos contra los que se evalúa cada versión candidata.
  const verified = advisories !== null && versions !== null;
  const pool = (advisories ?? currentVulns).filter((v) => !v.withdrawn);
  const entries: OsvAffected[][] = pool.map((v) => affectedFor(v, eco, dep.name)).filter((e) => e.length > 0);
  const isSafe = (v: string) => !entries.some((e) => isAffected(v, e, eco));

  const candidates = versions
    ? versions.filter((v) => isValidVersion(eco, v) && isStable(eco, v))
    : [...new Set(finding.vulnerabilities.flatMap((v) => v.fixedIn))];
  const safe = [...new Set(candidates)].filter(isSafe).sort(cmp);
  const newer = safe.filter((v) => cmp(v, current) > 0);
  if (!verified) {
    notes.push(
      "Lista parcial: no se pudo consultar el registro o todos los avisos del paquete; se usaron solo las versiones corregidas de los avisos actuales.",
    );
  }

  const curMajor = majorOf(eco, current);
  const options: UpgradeOption[] = [];
  const minimal = newer[0];
  const sameMajor = [...newer].reverse().find((v) => majorOf(eco, v) === curMajor);
  const latest = newer.at(-1);
  const breaking = (v: string) => (majorOf(eco, v) ?? 0) > (curMajor ?? 0);
  if (minimal) options.push({ kind: "minimal", version: minimal, breaking: breaking(minimal) });
  if (sameMajor && sameMajor !== minimal)
    options.push({ kind: "same-major", version: sameMajor, breaking: false });
  if (latest && latest !== minimal && latest !== sameMajor)
    options.push({ kind: "latest", version: latest, breaking: breaking(latest) });

  const recommended = sameMajor ?? minimal ?? null;
  const status: Remediation["status"] = recommended ? "upgrade" : verified ? "no-fix" : "unknown";

  if (!recommended && safe.length) {
    notes.push(
      `Solo hay versiones seguras anteriores a la actual (por ejemplo ${safe.at(-1)}): evalúa volver a una de ellas.`,
    );
  }
  if (status === "no-fix") {
    notes.push(
      "Ninguna versión publicada está libre de fallas conocidas: aplica las mitigaciones o evalúa reemplazar la librería.",
    );
  }
  if (recommended && breaking(recommended)) {
    notes.push(
      `La versión segura cambia de versión mayor (${curMajor} → ${majorOf(eco, recommended)}): revisa el changelog y corre las pruebas.`,
    );
  }
  if (dep.dev) notes.push("Dependencia solo de desarrollo: no llega a producción, la prioridad es menor.");
  if (finding.unfixed.length) notes.push(`Sin corrección publicada: ${finding.unfixed.join(", ")}.`);
  if (patches.length) {
    notes.push(
      eco === "npm"
        ? "Si no puedes actualizar, puedes portar el commit de corrección con patch-package (npx patch-package <paquete>) como medida temporal."
        : "Si no puedes actualizar, puedes aplicar el commit de corrección en un fork o paquete propio como medida temporal.",
    );
  }

  // Pasos concretos.
  const commands: Remediation["commands"] = [];
  let snippet: Remediation["snippet"];
  let fixableByLockfileUpdate: boolean | undefined;
  if (recommended) {
    if (eco === "npm") {
      if (dep.direct) {
        commands.push({
          label: "Actualizar la dependencia directa",
          command: `npm install ${dep.dev ? "-D " : ""}${dep.name}@${recommended}`,
        });
      } else {
        const parent = dep.requiredBy;
        fixableByLockfileUpdate = parent ? newer.some((v) => satisfies("npm", v, parent.range)) : undefined;
        if (fixableByLockfileUpdate && parent) {
          commands.push({
            label: `${parent.name} acepta "${parent.range}": basta con actualizar el lockfile`,
            command: `npm update ${dep.name}`,
          });
        } else {
          const root = dep.path[0];
          if (root) {
            commands.push({
              label: `O actualiza la dependencia directa que la trae (${root}) a una versión que use ${dep.name} ≥ ${recommended}`,
              command: `npm install ${root}@latest`,
            });
          }
          snippet = {
            file: "package.json",
            language: "json",
            content: JSON.stringify({ overrides: { [dep.name]: recommended } }, null, 2),
            note: `Fuerza la versión de la transitiva. ${parent ? `${parent.name} pide "${parent.range}"; ` : ""}verifica que siga funcionando y luego ejecuta npm install.`,
          };
          commands.unshift({
            label: "Forzar la versión con overrides (ver fragmento) y reinstalar",
            command: "npm install",
          });
        }
      }
      commands.push({ label: "Verificar", command: "npm ls " + dep.name });
    } else {
      commands.push({ label: "Actualizar el paquete", command: `pip install "${dep.name}==${recommended}"` });
      snippet = {
        file: dep.sourceFile,
        language: "text",
        content: `${dep.name}==${recommended}`,
        note: `Reemplaza la línea de ${dep.name} (actualmente "${dep.declared || dep.resolved}").`,
      };
    }
  }

  return {
    status,
    recommended,
    options,
    safeVersions: [...safe].reverse().slice(0, MAX_SAFE_LISTED),
    totalSafeVersions: safe.length,
    verified,
    ...(fixableByLockfileUpdate !== undefined ? { fixableByLockfileUpdate } : {}),
    commands,
    ...(snippet ? { snippet } : {}),
    mitigations,
    patches,
    notes,
  };
}
