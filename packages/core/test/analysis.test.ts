import { describe, expect, it } from "vitest";
import { isAffected } from "../src/analysis/affected.js";
import { dedupe, minSafeVersion, normalizeVulnerability, shouldFail } from "../src/analysis/analyze.js";
import type { Dependency } from "../src/domain/types.js";
import type { OsvEvent, OsvVulnerability } from "../src/sources/ports.js";

const dep = (name: string, version: string): Dependency => ({
  name,
  ecosystem: "npm",
  declared: "",
  resolved: version,
  resolution: "lockfile",
  direct: true,
  dev: false,
  path: [name],
  sourceFile: "package-lock.json",
});

const vuln = (
  id: string,
  aliases: string[],
  events: OsvEvent[],
  extra: Partial<OsvVulnerability> = {},
): OsvVulnerability => ({
  id,
  aliases,
  summary: `falla ${id}`,
  affected: [{ package: { name: "lodash", ecosystem: "npm" }, ranges: [{ type: "SEMVER", events }] }],
  ...extra,
});

describe("isAffected", () => {
  const entries = vuln(
    "X",
    [],
    [{ introduced: "0" }, { fixed: "4.17.12" }, { introduced: "5.0.0" }, { last_affected: "5.1.0" }],
  ).affected!;
  it.each([
    ["4.17.11", true],
    ["4.17.12", false],
    ["4.99.0", false],
    ["5.0.0", true],
    ["5.1.0", true],
    ["5.1.1", false],
  ])("%s → %s", (v, expected) => {
    expect(isAffected(v, entries, "npm")).toBe(expected);
  });
});

describe("normalizeVulnerability", () => {
  it("calcula la severidad desde el vector CVSS 3", () => {
    const v = vuln("GHSA-1", ["CVE-2019-10744"], [{ introduced: "0" }, { fixed: "4.17.12" }], {
      severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H" }],
    });
    const n = normalizeVulnerability(v, dep("lodash", "4.17.11")).vuln;
    expect(n).toMatchObject({
      cvss: 9.1,
      severity: "critical",
      severitySource: "osv-cvss",
      fixedIn: ["4.17.12"],
    });
  });

  it("usa la etiqueta de GHSA si no hay vector", () => {
    const v = vuln("GHSA-2", [], [{ introduced: "0" }, { fixed: "1.0.0" }], {
      database_specific: { severity: "MODERATE" },
    });
    expect(normalizeVulnerability(v, dep("lodash", "0.9.0")).vuln).toMatchObject({
      severity: "medium",
      severitySource: "osv-label",
    });
  });
});

describe("dedupe", () => {
  it("une entradas que comparten CVE y usa el CVE como ID", () => {
    const d = dep("lodash", "4.17.11");
    const a = normalizeVulnerability(
      vuln("GHSA-aaa", ["CVE-2020-8203"], [{ introduced: "0" }, { fixed: "4.17.19" }]),
      d,
    );
    const b = normalizeVulnerability(
      vuln("PYSEC-1", ["CVE-2020-8203"], [{ introduced: "0" }, { fixed: "4.17.20" }]),
      d,
    );
    const c = normalizeVulnerability(vuln("GHSA-zzz", [], [{ introduced: "0" }, { fixed: "4.17.21" }]), d);
    const out = dedupe([a, b, c], "npm");
    expect(out).toHaveLength(2);
    const merged = out.find((o) => o.vuln.id === "CVE-2020-8203")!;
    expect(merged.vuln.aliases).toEqual(["CVE-2020-8203", "GHSA-aaa", "PYSEC-1"]);
    expect(merged.vuln.fixedIn).toEqual(["4.17.19", "4.17.20"]);
  });
});

describe("minSafeVersion", () => {
  it("elige la menor versión que corrige todas las fallas", () => {
    const d = dep("lodash", "4.17.11");
    const items = [
      normalizeVulnerability(vuln("A", [], [{ introduced: "0" }, { fixed: "4.17.12" }]), d),
      normalizeVulnerability(vuln("B", [], [{ introduced: "0" }, { fixed: "4.17.21" }]), d),
    ];
    expect(minSafeVersion("4.17.11", items, "npm")).toEqual({ version: "4.17.21", unfixed: [] });
  });

  it("reporta fallas sin corrección", () => {
    const d = dep("lodash", "4.17.11");
    const items = [normalizeVulnerability(vuln("C", [], [{ introduced: "0" }]), d)];
    expect(minSafeVersion("4.17.11", items, "npm")).toEqual({ version: null, unfixed: ["C"] });
  });
});

describe("shouldFail", () => {
  const summary = {
    dependencies: 1,
    direct: 1,
    transitive: 0,
    unresolved: 0,
    vulnerableDependencies: 1,
    bySeverity: { critical: 0, high: 1, medium: 0, low: 0, unknown: 0 },
    risk: "red" as const,
  };
  it("respeta el umbral", () => {
    expect(shouldFail(summary, "critical")).toBe(false);
    expect(shouldFail(summary, "high")).toBe(true);
    expect(shouldFail(summary, "none")).toBe(false);
  });
});
