import type { Ecosystem } from "../domain/types.js";
import type { OsvAffected, OsvVulnerability } from "../sources/ports.js";
import { compareVersions, isValidVersion } from "../versions/index.js";

/** Entradas "affected" de una vulnerabilidad que corresponden a este paquete. */
export function affectedFor(vuln: OsvVulnerability, ecosystem: Ecosystem, name: string): OsvAffected[] {
  const norm = (n: string) => (ecosystem === "PyPI" ? n.toLowerCase().replace(/[-_.]+/g, "-") : n);
  return (vuln.affected ?? []).filter(
    (a) => a.package && a.package.ecosystem === ecosystem && norm(a.package.name) === norm(name),
  );
}

/** Versiones "fixed" declaradas en rangos SEMVER/ECOSYSTEM (los rangos GIT usan commits). */
export function fixedVersions(entries: OsvAffected[], ecosystem: Ecosystem): string[] {
  const out = new Set<string>();
  for (const a of entries) {
    for (const r of a.ranges ?? []) {
      if (r.type === "GIT") continue;
      for (const e of r.events) if (e.fixed && isValidVersion(ecosystem, e.fixed)) out.add(e.fixed);
    }
  }
  return [...out].sort((x, y) => compareVersions(ecosystem, x, y));
}

/**
 * ¿La versión está afectada según los rangos de OSV?
 * Algoritmo del esquema OSV: se recorren los eventos ordenados; "introduced" abre el
 * intervalo, "fixed" lo cierra (exclusivo) y "last_affected" lo cierra (inclusivo).
 */
export function isAffected(version: string, entries: OsvAffected[], ecosystem: Ecosystem): boolean {
  if (!isValidVersion(ecosystem, version)) return false;
  const cmp = (a: string, b: string) => compareVersions(ecosystem, a, b);
  for (const a of entries) {
    if (a.versions?.includes(version)) return true;
    for (const r of a.ranges ?? []) {
      if (r.type === "GIT") continue;
      type Ev = { kind: "introduced" | "fixed" | "last_affected"; v: string };
      const events: Ev[] = [];
      for (const e of r.events) {
        if (e.introduced !== undefined) events.push({ kind: "introduced", v: e.introduced });
        if (e.fixed !== undefined) events.push({ kind: "fixed", v: e.fixed });
        if (e.last_affected !== undefined) events.push({ kind: "last_affected", v: e.last_affected });
      }
      const valid = events.filter((e) => e.v === "0" || isValidVersion(ecosystem, e.v));
      const isZero = (v: string) => v === "0";
      valid.sort((x, y) => (isZero(x.v) ? -1 : isZero(y.v) ? 1 : cmp(x.v, y.v)));
      let affected = false;
      for (const e of valid) {
        if (e.kind === "introduced") {
          if (isZero(e.v) || cmp(version, e.v) >= 0) affected = true;
        } else if (e.kind === "fixed") {
          if (cmp(version, e.v) >= 0) affected = false;
        } else if (cmp(version, e.v) > 0) {
          affected = false;
        }
      }
      if (affected) return true;
    }
  }
  return false;
}
