import type { Dependency, ProjectFiles } from "../domain/types.js";
import { parseLockfile } from "../parsers/npm/lockfile.js";
import { nonRegistrySpec, parsePackageJson } from "../parsers/npm/package-json.js";
import { parseRequirements } from "../parsers/pypi/requirements.js";
import { isRequirementsFile } from "../project/files.js";
import { mapLimit } from "../sources/http.js";
import type { RegistrySource } from "../sources/ports.js";
import { exactVersion, maxSatisfying } from "../versions/index.js";

export interface ResolveOptions {
  /** Si no hay lockfile, estimar la versión con el registro (npm/PyPI). */
  estimate?: boolean;
  registry?: RegistrySource;
  /** Incluir devDependencies. Por defecto true. */
  includeDev?: boolean;
}

export interface ResolveResult {
  dependencies: Dependency[];
  /** Manifiestos efectivamente usados. */
  manifests: string[];
  warnings: string[];
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

const inDir = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

/** Pendiente de resolución: versión declarada sin fijar. */
interface Pending {
  dep: Dependency;
  range: string;
}

function unresolved(
  base: Omit<Dependency, "resolved" | "resolution" | "note">,
  range: string,
  reason: string | null,
  pending: Pending[],
): Dependency {
  const exact = reason ? null : exactVersion(base.ecosystem, range);
  if (exact) return { ...base, resolved: exact, resolution: "exact-pin" };
  const dep: Dependency = {
    ...base,
    resolved: null,
    resolution: "unknown",
    note: reason ?? `versión no determinable: rango "${range || "*"}" sin lockfile`,
  };
  if (!reason) pending.push({ dep, range });
  return dep;
}

function resolveNpm(
  files: ProjectFiles,
  dir: string,
  pending: Pending[],
  out: ResolveResult,
  includeDev: boolean,
) {
  const pkgPath = inDir(dir, "package.json");
  const lockPath = files.has(inDir(dir, "npm-shrinkwrap.json"))
    ? inDir(dir, "npm-shrinkwrap.json")
    : files.has(inDir(dir, "package-lock.json"))
      ? inDir(dir, "package-lock.json")
      : undefined;

  let declared = new Map<string, { range: string; dev: boolean }>();
  const pkgText = files.get(pkgPath);
  if (pkgText !== undefined) {
    try {
      const info = parsePackageJson(pkgText);
      declared = new Map(info.dependencies.map((d) => [d.name, { range: d.range, dev: d.dev }]));
      out.manifests.push(pkgPath);
    } catch (e) {
      out.warnings.push(`${pkgPath}: ${(e as Error).message}`);
    }
  }

  if (lockPath) {
    const lockText = files.get(lockPath)!;
    try {
      const lock = parseLockfile(lockText);
      out.manifests.push(lockPath);
      out.warnings.push(...lock.warnings.map((w) => `${lockPath}: ${w}`));
      const seen = new Set<string>();
      for (const p of lock.packages) {
        if (!includeDev && p.dev) continue;
        seen.add(p.name);
        out.dependencies.push({
          name: p.name,
          ecosystem: "npm",
          declared: p.direct ? (declared.get(p.name)?.range ?? "") : "",
          resolved: p.version,
          resolution: "lockfile",
          direct: p.direct,
          dev: p.dev,
          path: p.path,
          sourceFile: lockPath,
          ...(p.requiredBy ? { requiredBy: p.requiredBy } : {}),
        });
      }
      const missing = [...declared.entries()].filter(([n, d]) => !seen.has(n) && (includeDev || !d.dev));
      if (missing.length) {
        out.warnings.push(
          `${lockPath}: ${missing.length} dependencia(s) de package.json no están en el lockfile (¿lockfile desactualizado?)`,
        );
        for (const [name, d] of missing) {
          const base = {
            name,
            ecosystem: "npm" as const,
            declared: d.range,
            direct: true,
            dev: d.dev,
            path: [name],
            sourceFile: pkgPath,
          };
          out.dependencies.push(unresolved(base, d.range, nonRegistrySpec(d.range), pending));
        }
      }
      return;
    } catch (e) {
      out.warnings.push(`${lockPath}: ${(e as Error).message}; se usa solo package.json`);
    }
  }

  if (!declared.size) return;
  out.warnings.push(`${pkgPath}: sin package-lock.json, las versiones exactas no se pueden garantizar`);
  for (const [name, d] of declared) {
    if (!includeDev && d.dev) continue;
    const base = {
      name,
      ecosystem: "npm" as const,
      declared: d.range,
      direct: true,
      dev: d.dev,
      path: [name],
      sourceFile: pkgPath,
    };
    out.dependencies.push(unresolved(base, d.range, nonRegistrySpec(d.range), pending));
  }
}

function resolvePypi(files: ProjectFiles, reqFiles: string[], pending: Pending[], out: ResolveResult) {
  const read = (p: string) => files.get(p);
  // Archivos incluidos por otro con -r no se analizan como entrada propia (evita duplicados).
  const parsed = reqFiles.map((f) => ({ file: f, info: parseRequirements(f, read) }));
  const included = new Set(parsed.flatMap((p) => p.info.files.slice(1)));
  for (const { file, info } of parsed) {
    if (included.has(file)) continue;
    out.manifests.push(...info.files.filter((f) => !out.manifests.includes(f)));
    out.warnings.push(...info.warnings);
    const seen = new Set<string>();
    for (const d of info.dependencies) {
      const key = `${d.name}|${d.specifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const base = {
        name: d.name,
        ecosystem: "PyPI" as const,
        declared: d.specifier,
        direct: true,
        dev: /dev|test/i.test(d.file),
        path: [d.name],
        sourceFile: d.file,
      };
      out.dependencies.push(unresolved(base, d.specifier, d.nonRegistry ?? null, pending));
    }
  }
}

async function estimate(pending: Pending[], registry: RegistrySource, warnings: string[]) {
  await mapLimit(pending, 8, async ({ dep, range }) => {
    try {
      const versions = await registry.listVersions(dep.ecosystem, dep.name);
      if (!versions) {
        dep.note = `el paquete no existe en el registro de ${dep.ecosystem}`;
        return;
      }
      const best = maxSatisfying(dep.ecosystem, versions, range || (dep.ecosystem === "npm" ? "*" : ">=0"));
      if (best) {
        dep.resolved = best;
        dep.resolution = "registry-estimate";
        dep.note = `estimación: versión más alta publicada que cumple "${range || "*"}"`;
      }
    } catch (e) {
      warnings.push(`no se pudo estimar la versión de ${dep.name}: ${(e as Error).message}`);
    }
  });
}

/** Detecta los manifiestos de un proyecto y obtiene la lista de dependencias con su versión. */
export async function resolveProject(files: ProjectFiles, opts: ResolveOptions = {}): Promise<ResolveResult> {
  const out: ResolveResult = { dependencies: [], manifests: [], warnings: [] };
  const pending: Pending[] = [];
  const includeDev = opts.includeDev ?? true;
  const paths = [...files.keys()].sort();

  const npmDirs = new Set(
    paths.filter((p) => /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json)$/.test(p)).map(dirOf),
  );
  const lockDirs = new Set(
    paths.filter((p) => /(^|\/)(package-lock\.json|npm-shrinkwrap\.json)$/.test(p)).map(dirOf),
  );
  for (const dir of [...npmDirs].sort()) {
    // Un package.json sin lockfile dentro de un proyecto con lockfile (workspace) ya está cubierto.
    const coveredByAncestor =
      !lockDirs.has(dir) && [...lockDirs].some((l) => (l === "" ? dir !== "" : dir.startsWith(`${l}/`)));
    if (coveredByAncestor) continue;
    resolveNpm(files, dir, pending, out, includeDev);
  }

  const reqFiles = paths.filter(isRequirementsFile);
  if (reqFiles.length) resolvePypi(files, reqFiles, pending, out);

  if (pending.length && opts.estimate && opts.registry) await estimate(pending, opts.registry, out.warnings);

  if (!out.manifests.length) {
    out.warnings.push("no se encontraron package.json, package-lock.json ni requirements.txt");
  }
  return out;
}
