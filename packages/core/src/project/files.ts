import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { ProjectFiles } from "../domain/types.js";

const IGNORED_DIRS = new Set([
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
  "bower_components",
]);

export const NPM_FILES = new Set(["package.json", "package-lock.json", "npm-shrinkwrap.json"]);

/** Tamaño máximo por archivo (los lockfiles grandes rondan 1-5 MB). */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

function basename(p: string): string {
  return p.slice(p.lastIndexOf("/") + 1);
}

export function isIgnoredPath(path: string): boolean {
  return path.split("/").some((seg) => IGNORED_DIRS.has(seg));
}

/** requirements.txt, requirements-dev.txt, requirements/base.txt, dev-requirements.txt… */
export function isRequirementsFile(path: string): boolean {
  const name = basename(path).toLowerCase();
  if (!name.endsWith(".txt")) return false;
  return name.includes("requirements") || path.toLowerCase().split("/").slice(0, -1).includes("requirements");
}

export function isManifestPath(path: string): boolean {
  if (isIgnoredPath(path)) return false;
  return NPM_FILES.has(basename(path)) || isRequirementsFile(path);
}

/** Lee del disco los manifiestos de un proyecto (recursivo, ignorando node_modules, venv, etc.). */
export async function readProjectDirectory(root: string, maxFiles = 300): Promise<ProjectFiles> {
  const files: ProjectFiles = new Map();
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (files.size >= maxFiles) return;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name) && !e.name.startsWith(".")) await walk(full);
        continue;
      }
      if (!e.isFile()) continue;
      const rel = relative(root, full).split(sep).join("/");
      if (!isManifestPath(rel)) continue;
      if ((await stat(full)).size > MAX_FILE_BYTES) continue;
      files.set(rel, await readFile(full, "utf8"));
    }
  };
  await walk(root);
  return files;
}
