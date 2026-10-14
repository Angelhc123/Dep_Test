import type { Ecosystem } from "../domain/types.js";
import { comparePep440, exactPep440, maxSatisfyingPep440, parsePep440, satisfiesPep440 } from "./pep440.js";
import { compareSemver, exactSemver, maxSatisfyingSemver, parseSemver, satisfiesSemver } from "./semver.js";

export * from "./semver.js";
export * from "./pep440.js";

/** Fachada por ecosistema para que el resto del motor no dependa del formato de versión. */
export function isValidVersion(ecosystem: Ecosystem, v: string): boolean {
  return ecosystem === "npm" ? parseSemver(v) !== null : parsePep440(v) !== null;
}

export function compareVersions(ecosystem: Ecosystem, a: string, b: string): number {
  return ecosystem === "npm" ? compareSemver(a, b) : comparePep440(a, b);
}

export function satisfies(ecosystem: Ecosystem, version: string, range: string): boolean {
  return ecosystem === "npm" ? satisfiesSemver(version, range) : satisfiesPep440(version, range);
}

export function maxSatisfying(ecosystem: Ecosystem, versions: string[], range: string): string | null {
  return ecosystem === "npm" ? maxSatisfyingSemver(versions, range) : maxSatisfyingPep440(versions, range);
}

export function exactVersion(ecosystem: Ecosystem, range: string): string | null {
  return ecosystem === "npm" ? exactSemver(range) : exactPep440(range);
}

/** Primer componente "mayor" de la versión (semver major o primer número del release PEP 440). */
export function majorOf(ecosystem: Ecosystem, v: string): number | null {
  if (ecosystem === "npm") return parseSemver(v)?.major ?? null;
  const p = parsePep440(v);
  return p ? (p.release[0] ?? 0) : null;
}
