export interface DeclaredNpmDependency {
  name: string;
  range: string;
  dev: boolean;
  optional: boolean;
}

export interface PackageJsonInfo {
  name: string | undefined;
  dependencies: DeclaredNpmDependency[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Lee las dependencias declaradas en package.json.
 * Prioridad si un paquete aparece en varias secciones: dependencies > optional > dev.
 * peerDependencies no se instalan por este proyecto, así que se omiten.
 */
export function parsePackageJson(text: string): PackageJsonInfo {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`package.json no es JSON válido: ${(e as Error).message}`);
  }
  if (!isRecord(data)) throw new Error("package.json no contiene un objeto");

  const byName = new Map<string, DeclaredNpmDependency>();
  const sections: [string, boolean, boolean][] = [
    ["devDependencies", true, false],
    ["optionalDependencies", false, true],
    ["dependencies", false, false],
  ];
  for (const [key, dev, optional] of sections) {
    const section = data[key];
    if (!isRecord(section)) continue;
    for (const [name, range] of Object.entries(section)) {
      if (typeof range !== "string") continue;
      byName.set(name, { name, range, dev, optional });
    }
  }
  return {
    name: typeof data.name === "string" ? data.name : undefined,
    dependencies: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Rango que no apunta al registro de npm (git, url, archivo local, workspace, alias). */
export function nonRegistrySpec(range: string): string | null {
  const r = range.trim();
  if (/^(file:|link:|workspace:|portal:)/.test(r)) return "dependencia local";
  if (/^(git\+|git:|github:|gitlab:|bitbucket:)/.test(r) || /^[\w.-]+\/[\w.-]+(#.*)?$/.test(r)) {
    return "dependencia desde git";
  }
  if (/^https?:/.test(r)) return "dependencia desde URL";
  if (r.startsWith("npm:")) return "alias npm:";
  return null;
}
