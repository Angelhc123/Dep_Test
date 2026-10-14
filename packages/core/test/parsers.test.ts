import { describe, expect, it } from "vitest";
import { parseLockfile } from "../src/parsers/npm/lockfile.js";
import { nonRegistrySpec, parsePackageJson } from "../src/parsers/npm/package-json.js";
import { parseRequirements } from "../src/parsers/pypi/requirements.js";

describe("parsePackageJson", () => {
  it("lee dependencies, devDependencies y optional", () => {
    const info = parsePackageJson(
      JSON.stringify({
        name: "app",
        dependencies: { express: "^4.18.0" },
        devDependencies: { vitest: "^3.0.0" },
        optionalDependencies: { fsevents: "~2.3.0" },
        peerDependencies: { react: ">=18" },
      }),
    );
    expect(info.dependencies.map((d) => [d.name, d.dev])).toEqual([
      ["express", false],
      ["fsevents", false],
      ["vitest", true],
    ]);
  });

  it("identifica rangos fuera del registro", () => {
    expect(nonRegistrySpec("github:user/repo")).toBe("dependencia desde git");
    expect(nonRegistrySpec("file:../lib")).toBe("dependencia local");
    expect(nonRegistrySpec("^1.0.0")).toBeNull();
  });
});

describe("parseLockfile v3", () => {
  const lock = {
    name: "app",
    lockfileVersion: 3,
    packages: {
      "": { name: "app", dependencies: { express: "^4.17.0" }, devDependencies: { jest: "^29.0.0" } },
      "node_modules/express": { version: "4.17.1", dependencies: { "body-parser": "1.19.0", qs: "6.7.0" } },
      "node_modules/body-parser": { version: "1.19.0", dependencies: { qs: "6.7.0" } },
      "node_modules/qs": { version: "6.7.0" },
      "node_modules/jest": { version: "29.7.0", dev: true, dependencies: { qs: "^6.11.0" } },
      "node_modules/jest/node_modules/qs": { version: "6.11.2", dev: true },
      "node_modules/@scope/pkg": { version: "1.0.0" },
      "packages/local": { version: "0.0.1" },
      "node_modules/local": { resolved: "packages/local", link: true },
    },
  };
  const info = parseLockfile(JSON.stringify(lock));
  const byKey = new Map(info.packages.map((p) => [`${p.name}@${p.version}`, p]));

  it("extrae versiones exactas, incluidas las anidadas", () => {
    expect([...byKey.keys()].sort()).toEqual(
      [
        "@scope/pkg@1.0.0",
        "body-parser@1.19.0",
        "express@4.17.1",
        "jest@29.7.0",
        "qs@6.11.2",
        "qs@6.7.0",
      ].sort(),
    );
  });

  it("separa directas de transitivas y reconstruye la cadena más corta", () => {
    expect(byKey.get("express@4.17.1")).toMatchObject({ direct: true, path: ["express"] });
    expect(byKey.get("qs@6.7.0")).toMatchObject({ direct: false, path: ["express", "qs"] });
    expect(byKey.get("qs@6.11.2")).toMatchObject({ direct: false, dev: true, path: ["jest", "qs"] });
  });

  it("avisa de paquetes no alcanzables", () => {
    expect(info.warnings.some((w) => w.includes("no son alcanzables"))).toBe(true);
  });
});

describe("parseLockfile v1", () => {
  it("lee el árbol anidado", () => {
    const lock = {
      lockfileVersion: 1,
      dependencies: {
        lodash: { version: "4.17.15" },
        request: {
          version: "2.88.0",
          requires: { qs: "~6.5.2" },
          dependencies: { qs: { version: "6.5.2" } },
        },
      },
    };
    const info = parseLockfile(JSON.stringify(lock));
    expect(info.packages.find((p) => p.name === "qs")).toMatchObject({
      version: "6.5.2",
      direct: false,
      path: ["request", "qs"],
    });
    expect(info.packages.find((p) => p.name === "lodash")).toMatchObject({ direct: true });
  });
});

describe("parseRequirements", () => {
  const files: Record<string, string> = {
    "requirements.txt": [
      "# dependencias de producción",
      "-r requirements/base.txt",
      "--index-url https://pypi.org/simple",
      "Django==4.2.1  # framework",
      "requests[security,socks]>=2.25,<3 ; python_version >= '3.8'",
      "Flask_Login ~= 0.6.2",
      "numpy==1.24.0 \\",
      "    --hash=sha256:abc123",
      "pkg @ https://example.com/pkg-1.0.tar.gz",
      "-e git+https://github.com/user/lib.git#egg=mylib",
      "-c constraints.txt",
      "https://example.com/sin-nombre.whl",
    ].join("\n"),
    "requirements/base.txt": "urllib3==1.26.5\n-r ../requirements.txt\n",
  };
  const info = parseRequirements("requirements.txt", (p) => files[p]);
  const byName = new Map(info.dependencies.map((d) => [d.name, d]));

  it("interpreta especificadores, extras, marcadores y continuaciones", () => {
    expect(byName.get("django")?.specifier).toBe("==4.2.1");
    expect(byName.get("requests")).toMatchObject({ specifier: ">=2.25,<3", extras: ["security", "socks"] });
    expect(byName.get("requests")?.marker).toContain("python_version");
    expect(byName.get("flask-login")?.specifier).toBe("~=0.6.2");
    expect(byName.get("numpy")?.specifier).toBe("==1.24.0");
  });

  it("sigue -r con rutas relativas y detecta ciclos", () => {
    expect(byName.get("urllib3")).toMatchObject({ specifier: "==1.26.5", file: "requirements/base.txt" });
    expect(info.files).toEqual(["requirements.txt", "requirements/base.txt"]);
    expect(info.warnings.some((w) => w.includes("circular"))).toBe(true);
  });

  it("marca URL y editables como fuera del índice", () => {
    expect(byName.get("pkg")?.nonRegistry).toBe("requisito por URL");
    expect(byName.get("mylib")?.nonRegistry).toBe("editable (-e)");
    expect(info.warnings.some((w) => w.includes("-c"))).toBe(true);
    expect(info.warnings.some((w) => w.includes("sin nombre"))).toBe(true);
  });
});
