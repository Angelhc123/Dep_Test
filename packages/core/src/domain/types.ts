/** Ecosistemas soportados (nombres tal como los usa OSV). */
export type Ecosystem = "npm" | "PyPI";

export type Severity = "critical" | "high" | "medium" | "low" | "unknown";

export type Risk = "red" | "yellow" | "green";

/** Cómo se obtuvo la versión exacta de una dependencia. */
export type Resolution = "lockfile" | "exact-pin" | "registry-estimate" | "unknown";

/** Archivos de un proyecto: ruta relativa (con "/") → contenido. */
export type ProjectFiles = Map<string, string>;

export interface Dependency {
  name: string;
  ecosystem: Ecosystem;
  /** Lo que declara el manifiesto ("^4.17.0", ">=2.0,<3"). Vacío si solo aparece en el lockfile. */
  declared: string;
  /** Versión exacta, o null si no se pudo determinar. */
  resolved: string | null;
  resolution: Resolution;
  direct: boolean;
  /** Solo se usa en desarrollo (devDependencies). */
  dev: boolean;
  /** Cadena desde la raíz: ["express", "body-parser", "qs"]. Para directas: [name]. */
  path: string[];
  sourceFile: string;
  /** Motivo cuando resolved es null o es una estimación. */
  note?: string;
  /** Transitivas (lockfile): paquete padre y rango que pide. */
  requiredBy?: { name: string; range: string };
}

export interface Vulnerability {
  /** ID canónico tras deduplicar (prefiere CVE, luego GHSA). */
  id: string;
  /** Todos los IDs conocidos de la misma falla (incluye los IDs OSV originales). */
  aliases: string[];
  summary: string;
  details?: string;
  severity: Severity;
  /** Puntaje CVSS base (0-10) si se conoce. */
  cvss?: number;
  cvssVector?: string;
  /** De dónde salió la severidad. */
  severitySource: "nvd" | "osv-cvss" | "osv-label" | "none";
  /** Versiones que corrigen la falla para este paquete. */
  fixedIn: string[];
  references: string[];
  published?: string;
  /** Tipos de falla (CWE-79, CWE-1321…). */
  cwes?: string[];
}

export interface Finding {
  dependency: Dependency;
  vulnerabilities: Vulnerability[];
  maxSeverity: Severity;
  /** Menor versión superior a la actual que no está afectada por ninguna falla con corrección. */
  minSafeVersion: string | null;
  /** La versión segura cambia la versión mayor (posible ruptura de compatibilidad). */
  majorBump: boolean;
  /** IDs de fallas sin versión corregida publicada. */
  unfixed: string[];
  risk: Risk;
  /** Recomendaciones de solución (si se calcularon). */
  remediation?: Remediation;
}

export interface UpgradeOption {
  kind: "minimal" | "same-major" | "latest";
  version: string;
  /** Cambia la versión mayor: puede romper compatibilidad. */
  breaking: boolean;
}

export interface Mitigation {
  vulnId: string;
  title: string;
  text: string;
  /** "advisory": texto del aviso original; "cwe": guía según el tipo de falla. */
  source: "advisory" | "cwe";
  cwe?: string;
}

export interface Remediation {
  /**
   * upgrade: hay versión segura publicada · no-fix: ninguna versión publicada está libre de fallas conocidas ·
   * unknown: no se pudo calcular (sin datos del registro u OSV).
   */
  status: "upgrade" | "no-fix" | "unknown";
  /** Versión recomendada (menor cambio que deja el paquete sin fallas conocidas). */
  recommended: string | null;
  options: UpgradeOption[];
  /** Todas las versiones estables publicadas sin fallas conocidas, de la más nueva a la más vieja (máx. 40). */
  safeVersions: string[];
  totalSafeVersions: number;
  /** true si se verificó contra todos los avisos del paquete y la lista completa de versiones publicadas. */
  verified: boolean;
  /** Transitiva: el rango del padre ya admite una versión segura (basta con regenerar el lockfile). */
  fixableByLockfileUpdate?: boolean;
  /** Pasos concretos para aplicar la solución. */
  commands: { label: string; command: string }[];
  /** Fragmento a pegar en el manifiesto (overrides de npm, constraints de pip…). */
  snippet?: { file: string; language: "json" | "text"; content: string; note: string };
  /** Qué hacer si se decide seguir usando la versión vulnerable. */
  mitigations: Mitigation[];
  /** Commits o PRs con la corrección, útiles para un parche local (patch-package). */
  patches: { vulnId: string; url: string }[];
  notes: string[];
}

export interface ScanSummary {
  dependencies: number;
  direct: number;
  transitive: number;
  unresolved: number;
  vulnerableDependencies: number;
  /** Fallas únicas (tras deduplicar) por severidad. */
  bySeverity: Record<Severity, number>;
  risk: Risk;
}

export interface ScanTarget {
  name: string;
  source: "directory" | "upload" | "github";
  commit?: string;
  ref?: string;
}

export interface ScanReport {
  id?: string;
  scannedAt: string;
  scannerVersion: string;
  target: ScanTarget;
  manifests: string[];
  summary: ScanSummary;
  findings: Finding[];
  /** Todas las dependencias analizadas (vulnerables o no). */
  dependencies: Dependency[];
  warnings: string[];
  durationMs: number;
}

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "unknown"];

/** Rango numérico para ordenar: mayor = más grave. "unknown" queda entre low y medium. */
export function severityRank(s: Severity): number {
  switch (s) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "unknown":
      return 2;
    case "low":
      return 1;
  }
}

export function severityFromScore(score: number): Severity {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "unknown";
}
