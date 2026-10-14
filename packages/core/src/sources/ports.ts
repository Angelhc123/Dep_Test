import type { Ecosystem } from "../domain/types.js";

/** Puertos (interfaces) que el motor necesita del exterior. Los adaptadores los implementan. */

export interface PackageQuery {
  name: string;
  ecosystem: Ecosystem;
  version: string;
}

export interface OsvEvent {
  introduced?: string;
  fixed?: string;
  last_affected?: string;
  limit?: string;
}

export interface OsvRange {
  type: "SEMVER" | "ECOSYSTEM" | "GIT" | string;
  events: OsvEvent[];
}

export interface OsvAffected {
  package?: { name: string; ecosystem: string; purl?: string };
  ranges?: OsvRange[];
  versions?: string[];
  database_specific?: Record<string, unknown>;
}

/** Subconjunto del esquema OSV que usa el motor (https://ossf.github.io/osv-schema/). */
export interface OsvVulnerability {
  id: string;
  aliases?: string[];
  related?: string[];
  summary?: string;
  details?: string;
  published?: string;
  modified?: string;
  withdrawn?: string;
  severity?: { type: string; score: string }[];
  affected?: OsvAffected[];
  references?: { type?: string; url: string }[];
  database_specific?: Record<string, unknown> & { cwe_ids?: string[] };
}

export interface VulnSource {
  /** Devuelve, para cada consulta y en el mismo orden, los IDs de vulnerabilidades. */
  queryBatch(queries: PackageQuery[]): Promise<string[][]>;
  getVulnerability(id: string): Promise<OsvVulnerability | null>;
  /** Opcional: todos los avisos de un paquete (para calcular qué versiones son seguras). */
  queryPackage?(name: string, ecosystem: Ecosystem): Promise<OsvVulnerability[]>;
}

export interface CveInfo {
  id: string;
  description?: string;
  cvss?: number;
  cvssVector?: string;
  cvssVersion?: string;
}

export interface CveEnricher {
  getCve(cveId: string): Promise<CveInfo | null>;
}

export interface RegistrySource {
  /** Versiones publicadas (sin las retiradas/yanked). null si el paquete no existe. */
  listVersions(ecosystem: Ecosystem, name: string): Promise<string[] | null>;
}

export interface Cache {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}
