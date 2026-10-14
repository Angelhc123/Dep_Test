/** Mismo criterio que el motor (packages/core/src/project/files.ts), para filtrar antes de leer archivos. */
const IGNORED = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "venv",
  ".venv",
  "env",
  ".tox",
  "site-packages",
  "__pycache__",
]);
const NPM = new Set(["package.json", "package-lock.json", "npm-shrinkwrap.json"]);

export function isManifestPath(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((p) => IGNORED.has(p))) return false;
  const name = parts.at(-1)!.toLowerCase();
  if (NPM.has(name)) return true;
  return (
    name.endsWith(".txt") && (name.includes("requirements") || parts.slice(0, -1).includes("requirements"))
  );
}

export interface PickedFile {
  path: string;
  content: string;
  size: number;
}

/** Ruta relativa: al elegir una carpeta se quita la carpeta raíz ("mi-app/package.json" → "package.json"). */
function relativePath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!rel) return file.name;
  const parts = rel.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : rel;
}

export async function readManifests(
  list: FileList | File[],
): Promise<{ files: PickedFile[]; skipped: number }> {
  const files: PickedFile[] = [];
  let skipped = 0;
  for (const f of Array.from(list)) {
    const path = relativePath(f);
    if (!isManifestPath(path) || f.size > 15 * 1024 * 1024) {
      skipped++;
      continue;
    }
    files.push({ path, content: await f.text(), size: f.size });
  }
  return { files, skipped };
}
