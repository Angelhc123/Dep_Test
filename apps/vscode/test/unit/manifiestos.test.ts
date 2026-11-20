import { describe, expect, it } from "vitest";
import type { Finding } from "@depscan/core";
import {
  aplicarVersion,
  corregible,
  esManifiesto,
  mensajeDiagnostico,
  superaSeveridad,
  ubicarDependencia,
} from "../../src/manifiestos.js";

const PKG = `{
  "name": "demo",
  "version": "1.0.0",
  "scripts": { "lodash": "no es una dependencia" },
  "dependencies": {
    "express": "4.18.2",
    "lodash": "^4.17.15"
  },
  "devDependencies": {
    "vitest": "~1.0.0"
  }
}`;

const LOCK = `{
  "packages": {
    "": { "name": "demo" },
    "node_modules/express": { "version": "4.18.2" },
    "node_modules/express/node_modules/qs": { "version": "6.5.2" }
  }
}`;

const REQ = `# dependencias
Django==3.2.0 ; python_version >= "3.8"  # web
requests>=2.0
`;

const hallazgo = (over: Partial<Finding> = {}): Finding => ({
  dependency: {
    name: "lodash",
    ecosystem: "npm",
    declared: "^4.17.15",
    resolved: "4.17.15",
    resolution: "lockfile",
    direct: true,
    dev: false,
    path: ["lodash"],
    sourceFile: "package.json",
  },
  vulnerabilities: [
    {
      id: "CVE-2021-23337",
      aliases: ["CVE-2021-23337"],
      summary: "x",
      severity: "high",
      severitySource: "osv-label",
      fixedIn: ["4.17.21"],
      references: [],
    },
  ],
  maxSeverity: "high",
  minSafeVersion: "4.17.21",
  majorBump: false,
  unfixed: [],
  risk: "red",
  remediation: {
    status: "upgrade",
    recommended: "4.17.21",
    options: [],
    safeVersions: ["4.17.21"],
    totalSafeVersions: 1,
    verified: true,
    commands: [],
    mitigations: [],
  },
  ...over,
});

describe("esManifiesto", () => {
  it.each([
    ["package.json", true],
    ["a/b/package-lock.json", true],
    ["C:\\proy\\requirements-dev.txt", true],
    ["README.md", false],
    ["package.json.bak", false],
  ])("%s → %s", (f, esperado) => expect(esManifiesto(f)).toBe(esperado));
});

describe("ubicarDependencia", () => {
  it("encuentra la dependencia en package.json y no confunde scripts", () => {
    expect(ubicarDependencia("package.json", PKG, "lodash")).toEqual({ line: 6, start: 4, end: 24 });
  });

  it("busca también en devDependencies", () => {
    expect(ubicarDependencia("package.json", PKG, "vitest")?.line).toBe(9);
  });

  it("encuentra transitivas anidadas en package-lock.json", () => {
    expect(ubicarDependencia("package-lock.json", LOCK, "qs")?.line).toBe(4);
  });

  it("en requirements.txt normaliza el nombre e ignora comentarios", () => {
    expect(ubicarDependencia("requirements.txt", REQ, "django")).toEqual({ line: 1, start: 0, end: 39 });
    expect(ubicarDependencia("requirements.txt", REQ, "dependencias")).toBeNull();
  });

  it("devuelve null si no existe", () => {
    expect(ubicarDependencia("package.json", PKG, "react")).toBeNull();
  });
});

describe("aplicarVersion", () => {
  it("en package.json conserva el prefijo ^", () => {
    const nuevo = aplicarVersion("package.json", PKG, "lodash", "4.17.21")!;
    expect(nuevo).toContain(`"lodash": "^4.17.21"`);
    expect(nuevo).toContain(`"express": "4.18.2"`);
    expect(JSON.parse(nuevo).dependencies.lodash).toBe("^4.17.21");
  });

  it("en requirements.txt fija == y conserva marcador y comentario", () => {
    const nuevo = aplicarVersion("requirements.txt", REQ, "django", "3.2.19")!;
    expect(nuevo.split("\n")[1]).toBe(`Django==3.2.19 ; python_version >= "3.8"  # web`);
  });

  it("no toca el lockfile (se regenera con npm install)", () => {
    expect(aplicarVersion("package-lock.json", LOCK, "qs", "6.5.3")).toBeNull();
  });
});

describe("mensajes y filtros", () => {
  it("el mensaje resume severidad, CVE y la solución verificada", () => {
    expect(mensajeDiagnostico(hallazgo())).toBe(
      "lodash 4.17.15: 1 vulnerabilidad HIGH (CVE-2021-23337) → actualizar a 4.17.21 (verificada)",
    );
  });

  it("indica la cadena de una transitiva", () => {
    const f = hallazgo({
      dependency: {
        ...hallazgo().dependency,
        name: "qs",
        direct: false,
        path: ["express", "body-parser", "qs"],
      },
    });
    expect(mensajeDiagnostico(f)).toContain("(transitiva vía express › body-parser)");
    expect(corregible(f)).toBe(false);
  });

  it("filtra por severidad mínima", () => {
    expect(superaSeveridad(hallazgo(), "high")).toBe(true);
    expect(superaSeveridad(hallazgo(), "critical")).toBe(false);
  });

  it("solo las directas con versión recomendada son corregibles", () => {
    expect(corregible(hallazgo())).toBe(true);
    expect(
      corregible(
        hallazgo({ remediation: { ...hallazgo().remediation!, status: "no-fix", recommended: null } }),
      ),
    ).toBe(false);
  });
});
