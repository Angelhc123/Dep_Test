import { describe, expect, it } from "vitest";
import { buildFinding, dedupe, normalizeVulnerability } from "../src/analysis/analyze.js";
import { extractWorkaround } from "../src/analysis/cwe-guidance.js";
import { buildRemediation } from "../src/analysis/remediation.js";
import type { Dependency } from "../src/domain/types.js";
import type { OsvVulnerability } from "../src/sources/ports.js";

const qsDep: Dependency = {
  name: "qs",
  ecosystem: "npm",
  declared: "",
  resolved: "6.7.0",
  resolution: "lockfile",
  direct: false,
  dev: false,
  path: ["express", "body-parser", "qs"],
  sourceFile: "package-lock.json",
  requiredBy: { name: "body-parser", range: "6.7.0" },
};

/** Falla que afecta a la versión actual (corregida en 6.7.3 y 6.10.3 según la rama). */
const protoPollution: OsvVulnerability = {
  id: "GHSA-hrpp-h998-j3pp",
  aliases: ["CVE-2022-24999"],
  summary: "qs vulnerable to Prototype Pollution",
  details:
    "Descripción.\n\n### Workarounds\nNo uses `allowPrototypes: true` con entrada externa.\n\n### References\n- x",
  database_specific: { severity: "HIGH", cwe_ids: ["CWE-1321"] },
  references: [
    { type: "FIX", url: "https://github.com/ljharb/qs/commit/4310742efbd8c03f6495f07906b45213da0a32ec" },
  ],
  affected: [
    {
      package: { name: "qs", ecosystem: "npm" },
      ranges: [
        {
          type: "SEMVER",
          events: [{ introduced: "6.7.0" }, { fixed: "6.7.3" }, { introduced: "6.8.0" }, { fixed: "6.8.3" }],
        },
      ],
    },
  ],
};

/** Otra falla que NO afecta a la actual pero sí a 6.7.3: una versión "corregida" no siempre es segura. */
const laterBug: OsvVulnerability = {
  id: "GHSA-later",
  summary: "Falla introducida después",
  database_specific: { severity: "MODERATE" },
  affected: [
    {
      package: { name: "qs", ecosystem: "npm" },
      ranges: [{ type: "SEMVER", events: [{ introduced: "6.7.1" }, { fixed: "6.7.4" }] }],
    },
  ],
};

const versions = ["6.6.0", "6.7.0", "6.7.1", "6.7.3", "6.7.4", "6.8.0", "6.8.3", "6.9.0-rc.1", "7.0.0"];

function finding(dep: Dependency) {
  return buildFinding(dep, dedupe([normalizeVulnerability(protoPollution, dep)], dep.ecosystem));
}

describe("buildRemediation", () => {
  it("evalúa todas las versiones contra todos los avisos del paquete", () => {
    const r = buildRemediation({
      finding: finding(qsDep),
      advisories: [protoPollution, laterBug],
      currentVulns: [protoPollution],
      versions,
    });
    expect(r.verified).toBe(true);
    // 6.7.3 está corregida para la falla actual pero tiene la otra: no es segura.
    expect(r.safeVersions).toEqual(["7.0.0", "6.8.3", "6.7.4", "6.6.0"]);
    expect(r.options).toEqual([
      { kind: "minimal", version: "6.7.4", breaking: false },
      { kind: "same-major", version: "6.8.3", breaking: false },
      { kind: "latest", version: "7.0.0", breaking: true },
    ]);
    expect(r.recommended).toBe("6.8.3");
    expect(r.status).toBe("upgrade");
  });

  it("propone overrides cuando el rango del padre no admite la versión segura", () => {
    const r = buildRemediation({
      finding: finding(qsDep),
      advisories: [protoPollution],
      currentVulns: [protoPollution],
      versions,
    });
    expect(r.fixableByLockfileUpdate).toBe(false);
    expect(r.snippet?.language).toBe("json");
    expect(JSON.parse(r.snippet!.content)).toEqual({ overrides: { qs: "6.8.3" } });
    expect(r.commands.map((c) => c.command)).toContain("npm install express@latest");
  });

  it("basta con npm update si el rango del padre ya admite una versión segura", () => {
    const dep = { ...qsDep, requiredBy: { name: "body-parser", range: "^6.7.0" } };
    const r = buildRemediation({
      finding: finding(dep),
      advisories: [protoPollution],
      currentVulns: [protoPollution],
      versions,
    });
    expect(r.fixableByLockfileUpdate).toBe(true);
    expect(r.commands[0]!.command).toBe("npm update qs");
    expect(r.snippet).toBeUndefined();
  });

  it("incluye mitigaciones del aviso y por CWE, y el commit de corrección", () => {
    const r = buildRemediation({
      finding: finding(qsDep),
      advisories: null,
      currentVulns: [protoPollution],
      versions: null,
    });
    expect(r.verified).toBe(false);
    expect(r.mitigations.map((m) => m.source)).toEqual(["advisory", "cwe"]);
    expect(r.mitigations[0]!.text).toContain("allowPrototypes");
    expect(r.mitigations[1]!.title).toContain("CWE-1321");
    expect(r.patches[0]!.url).toContain("/commit/");
    expect(r.patches[0]!.vulnId).toBe("CVE-2022-24999");
  });

  it("reporta no-fix si ninguna versión publicada es segura", () => {
    const allBad: OsvVulnerability = {
      ...protoPollution,
      affected: [
        {
          package: { name: "qs", ecosystem: "npm" },
          ranges: [{ type: "SEMVER", events: [{ introduced: "0" }] }],
        },
      ],
    };
    const r = buildRemediation({
      finding: finding(qsDep),
      advisories: [allBad],
      currentVulns: [allBad],
      versions,
    });
    expect(r.status).toBe("no-fix");
    expect(r.recommended).toBeNull();
  });

  it("genera comandos de pip para PyPI", () => {
    const dep: Dependency = {
      ...qsDep,
      name: "django",
      ecosystem: "PyPI",
      resolved: "4.2.1",
      declared: "==4.2.1",
      direct: true,
      path: ["django"],
      sourceFile: "requirements.txt",
      requiredBy: undefined,
    };
    const v: OsvVulnerability = {
      id: "PYSEC-1",
      affected: [
        {
          package: { name: "django", ecosystem: "PyPI" },
          ranges: [{ type: "ECOSYSTEM", events: [{ introduced: "4.2" }, { fixed: "4.2.3" }] }],
        },
      ],
    };
    const r = buildRemediation({
      finding: buildFinding(dep, [normalizeVulnerability(v, dep)]),
      advisories: [v],
      currentVulns: [v],
      versions: ["4.2.1", "4.2.3", "4.2.4", "5.0a1", "5.0"],
    });
    expect(r.recommended).toBe("4.2.4");
    expect(r.commands[0]!.command).toBe('pip install "django==4.2.4"');
    expect(r.snippet).toMatchObject({ file: "requirements.txt", content: "django==4.2.4" });
  });
});

describe("extractWorkaround", () => {
  it("extrae la sección de workarounds del markdown", () => {
    expect(extractWorkaround("x\n## Workarounds\nDesactiva la opción X.\n## Impact\ny")).toBe(
      "Desactiva la opción X.",
    );
    expect(extractWorkaround("Sin sección.")).toBeNull();
  });
});
