import { describe, expect, it } from "vitest";
import { renderHtml } from "../src/report/html.js";
import { renderText } from "../src/report/text.js";
import { scanProject } from "../src/scan.js";
import type { OsvVulnerability, PackageQuery, RegistrySource, VulnSource } from "../src/sources/ports.js";

/** Fuente OSV simulada: no usa internet. */
class FakeOsv implements VulnSource {
  queries: PackageQuery[] = [];
  constructor(private readonly db: Record<string, OsvVulnerability[]>) {}
  async queryBatch(queries: PackageQuery[]) {
    this.queries.push(...queries);
    return queries.map((q) => (this.db[`${q.name}@${q.version}`] ?? []).map((v) => v.id));
  }
  async getVulnerability(id: string) {
    return (
      Object.values(this.db)
        .flat()
        .find((v) => v.id === id) ?? null
    );
  }
}

const lodashVuln: OsvVulnerability = {
  id: "GHSA-p6mc-m468-83gw",
  aliases: ["CVE-2020-8203"],
  summary: "Prototype Pollution in lodash",
  severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:H" }],
  affected: [
    {
      package: { name: "lodash", ecosystem: "npm" },
      ranges: [{ type: "SEMVER", events: [{ introduced: "3.7.0" }, { fixed: "4.17.19" }] }],
    },
  ],
};

const djangoVuln: OsvVulnerability = {
  id: "PYSEC-2023-100",
  aliases: ["CVE-2023-36053", "GHSA-jh3w-4vvf-mjgr"],
  summary: "Django ReDoS",
  database_specific: { severity: "HIGH" },
  affected: [
    {
      package: { name: "django", ecosystem: "PyPI" },
      ranges: [
        {
          type: "ECOSYSTEM",
          events: [{ introduced: "4.0" }, { fixed: "4.1.10" }, { introduced: "4.2" }, { fixed: "4.2.3" }],
        },
      ],
    },
  ],
};

const files = new Map<string, string>([
  ["package.json", JSON.stringify({ name: "demo", dependencies: { express: "^4.17.0" } })],
  [
    "package-lock.json",
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { express: "^4.17.0" } },
        "node_modules/express": { version: "4.17.1", dependencies: { lodash: "^4.17.0" } },
        "node_modules/lodash": { version: "4.17.15" },
      },
    }),
  ],
  ["backend/requirements.txt", "Django==4.2.1\nrequests>=2.0\n"],
]);

describe("scanProject", () => {
  it("ejecuta el pipeline completo con fuentes simuladas", async () => {
    const osv = new FakeOsv({ "lodash@4.17.15": [lodashVuln], "django@4.2.1": [djangoVuln] });
    const stages: string[] = [];
    const report = await scanProject(
      files,
      { osv },
      { target: { name: "demo", source: "upload" }, onProgress: (s) => stages.push(s) },
    );

    expect(report.manifests).toEqual(["package.json", "package-lock.json", "backend/requirements.txt"]);
    expect(report.summary).toMatchObject({
      dependencies: 4,
      direct: 3,
      transitive: 1,
      unresolved: 1,
      vulnerableDependencies: 2,
    });
    expect(report.summary.bySeverity.high).toBe(2);
    expect(report.summary.risk).toBe("red");

    const lodash = report.findings.find((f) => f.dependency.name === "lodash")!;
    expect(lodash).toMatchObject({ minSafeVersion: "4.17.19", majorBump: false });
    expect(lodash.dependency.path).toEqual(["express", "lodash"]);
    expect(lodash.vulnerabilities[0]).toMatchObject({ id: "CVE-2020-8203", cvss: 7.4 });

    const django = report.findings.find((f) => f.dependency.name === "django")!;
    expect(django.minSafeVersion).toBe("4.2.3");
    expect(django.vulnerabilities[0]!.id).toBe("CVE-2023-36053");

    expect(osv.queries).toHaveLength(3); // express, lodash, django (requests no tiene versión)
    expect(report.warnings.some((w) => w.includes("sin versión determinable"))).toBe(true);
    expect(stages.at(-1)).toBe("Listo");

    expect(renderHtml(report)).toContain("CVE-2020-8203");
    expect(renderText(report, false)).toContain("lodash");
  });

  it("estima versiones sin lockfile si se pide", async () => {
    const registry: RegistrySource = { listVersions: async () => ["2.30.0", "2.31.0", "3.0.0b1"] };
    const report = await scanProject(
      new Map([["requirements.txt", "requests>=2.0,<3"]]),
      { osv: new FakeOsv({}), registry },
      { target: { name: "py", source: "upload" }, estimate: true },
    );
    expect(report.dependencies[0]).toMatchObject({ resolved: "2.31.0", resolution: "registry-estimate" });
    expect(report.summary.risk).toBe("green");
  });
});
