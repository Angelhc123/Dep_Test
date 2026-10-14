/**
 * Parser de package-lock.json / npm-shrinkwrap.json.
 * - v2 y v3: mapa "packages" con rutas "node_modules/a/node_modules/b".
 * - v1: árbol anidado "dependencies" con "requires".
 * Reconstruye la cadena de dependencia más corta desde la raíz con el algoritmo
 * de resolución de Node (buscar en node_modules propio y luego hacia arriba).
 */

export interface LockedPackage {
  name: string;
  version: string;
  direct: boolean;
  dev: boolean;
  optional: boolean;
  /** Cadena más corta desde la raíz, incluyendo el propio paquete. */
  path: string[];
  /** Para transitivas: el paquete padre en la cadena y el rango que pide. */
  requiredBy?: { name: string; range: string };
}

export interface LockfileInfo {
  lockfileVersion: number;
  packages: LockedPackage[];
  warnings: string[];
}

interface Node {
  location: string;
  name: string;
  version: string | undefined;
  dev: boolean;
  optional: boolean;
  link: boolean;
  /** Paquete del workspace (ruta fuera de node_modules, p. ej. "apps/web"). */
  workspace: boolean;
  /** Nombre → rango declarado. */
  deps: Record<string, string>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Une secciones de dependencias; las posteriores tienen prioridad. */
function depRanges(entry: Record<string, unknown>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const section = entry[k];
    if (!isRecord(section)) continue;
    for (const [name, range] of Object.entries(section)) out[name] = typeof range === "string" ? range : "*";
  }
  return out;
}

const nameFromLocation = (loc: string): string => {
  const i = loc.lastIndexOf("node_modules/");
  return i === -1 ? loc : loc.slice(i + "node_modules/".length);
};

/** Resuelve `name` desde `from` subiendo por los node_modules, como hace Node. */
function resolveFrom(nodes: Map<string, Node>, from: string, name: string): Node | undefined {
  let base = from;
  for (;;) {
    const candidate = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
    const hit = nodes.get(candidate);
    if (hit) return hit;
    if (!base) return undefined;
    const i = base.lastIndexOf("/node_modules/");
    base = i === -1 ? "" : base.slice(0, i);
  }
}

function emptyRoot(deps: Record<string, string>): Node {
  return {
    location: "",
    name: "",
    version: undefined,
    dev: false,
    optional: false,
    link: false,
    workspace: false,
    deps,
  };
}

function fromPackagesMap(packages: Record<string, unknown>): { nodes: Map<string, Node>; root: Node } {
  const nodes = new Map<string, Node>();
  let root: Node | undefined;
  for (const [location, raw] of Object.entries(packages)) {
    if (!isRecord(raw)) continue;
    const workspace = location !== "" && !location.includes("node_modules/");
    const node: Node = {
      location,
      name: typeof raw.name === "string" && location !== "" ? raw.name : nameFromLocation(location),
      version: typeof raw.version === "string" ? raw.version : undefined,
      dev: raw.dev === true,
      optional: raw.optional === true || raw.devOptional === true,
      link: raw.link === true,
      workspace,
      // La raíz y los workspaces instalan también sus devDependencies.
      deps:
        location === "" || workspace
          ? depRanges(raw, ["devDependencies", "optionalDependencies", "dependencies"])
          : depRanges(raw, ["peerDependencies", "optionalDependencies", "dependencies"]),
    };
    if (location === "") root = node;
    else nodes.set(location, node);
  }
  return { nodes, root: root ?? emptyRoot({}) };
}

/** Convierte el árbol v1 al mismo formato de mapa de rutas que v2/v3. */
function fromV1(data: Record<string, unknown>): { nodes: Map<string, Node>; root: Node } {
  const nodes = new Map<string, Node>();
  const rootDeps: Record<string, string> = {};
  const walk = (deps: Record<string, unknown>, parentLoc: string, isRoot: boolean) => {
    for (const [name, raw] of Object.entries(deps)) {
      if (!isRecord(raw)) continue;
      const location = parentLoc ? `${parentLoc}/node_modules/${name}` : `node_modules/${name}`;
      const version = typeof raw.version === "string" ? raw.version : undefined;
      nodes.set(location, {
        location,
        name,
        version,
        dev: raw.dev === true,
        optional: raw.optional === true,
        link: version?.startsWith("file:") ?? false,
        workspace: false,
        deps: depRanges(raw, ["requires"]),
      });
      if (isRoot) rootDeps[name] = version ?? "*";
      if (isRecord(raw.dependencies)) walk(raw.dependencies, location, false);
    }
  };
  if (isRecord(data.dependencies)) walk(data.dependencies, "", true);
  return { nodes, root: emptyRoot(rootDeps) };
}

/**
 * Una dependencia es directa si la declara la raíz o un workspace (cadena de longitud 1).
 */
export function parseLockfile(text: string): LockfileInfo {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`package-lock.json no es JSON válido: ${(e as Error).message}`);
  }
  if (!isRecord(data)) throw new Error("package-lock.json no contiene un objeto");

  const lockfileVersion = typeof data.lockfileVersion === "number" ? data.lockfileVersion : 1;
  const warnings: string[] = [];
  const { nodes, root } =
    lockfileVersion >= 2 && isRecord(data.packages) ? fromPackagesMap(data.packages) : fromV1(data);

  // BFS desde la raíz y los workspaces: la primera vez que se alcanza un nodo es por la cadena más corta.
  const pathOf = new Map<string, string[]>();
  const parentOf = new Map<string, { name: string; range: string }>();
  const queue: Node[] = [];
  const starts = [root, ...[...nodes.values()].filter((n) => n.workspace)];
  for (const start of starts) {
    for (const name of Object.keys(start.deps)) {
      const n = resolveFrom(nodes, start.location, name);
      if (n && !n.link && !pathOf.has(n.location)) {
        pathOf.set(n.location, [n.name]);
        queue.push(n);
      }
    }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    const curPath = pathOf.get(cur.location)!;
    for (const [name, range] of Object.entries(cur.deps)) {
      const n = resolveFrom(nodes, cur.location, name);
      if (n && !n.link && !pathOf.has(n.location)) {
        pathOf.set(n.location, [...curPath, n.name]);
        parentOf.set(n.location, { name: cur.name, range });
        queue.push(n);
      }
    }
  }

  // Un mismo name@version puede estar en varias rutas: se agrupa.
  const byKey = new Map<string, LockedPackage>();
  let unreachable = 0;
  for (const node of nodes.values()) {
    if (node.link || node.workspace || !node.version) continue;
    if (/^(file:|git|https?:)/.test(node.version)) continue;
    const path = pathOf.get(node.location);
    if (!path) unreachable++;
    const isDirect = path?.length === 1;
    const key = `${node.name}@${node.version}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        name: node.name,
        version: node.version,
        direct: isDirect,
        dev: node.dev,
        optional: node.optional,
        path: isDirect ? [node.name] : (path ?? [node.name]),
        requiredBy: isDirect ? undefined : parentOf.get(node.location),
      });
    } else {
      prev.direct ||= isDirect;
      prev.dev &&= node.dev;
      prev.optional &&= node.optional;
      if (prev.direct) {
        prev.path = [node.name];
        prev.requiredBy = undefined;
      } else if (path && (prev.path.length <= 1 || path.length < prev.path.length)) {
        prev.path = path;
        prev.requiredBy = parentOf.get(node.location);
      }
    }
  }
  if (unreachable > 0) {
    warnings.push(
      `${unreachable} paquete(s) del lockfile no son alcanzables desde la raíz (posible lockfile desactualizado)`,
    );
  }
  if (lockfileVersion === 1) warnings.push("lockfile v1 (npm ≤ 6): se recomienda regenerarlo con npm ≥ 7");

  return {
    lockfileVersion,
    packages: [...byKey.values()].sort(
      (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
    ),
    warnings,
  };
}
