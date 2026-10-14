import type { ProjectFiles } from "../../domain/types.js";
import { isManifestPath, MAX_FILE_BYTES } from "../../project/files.js";
import { httpJson, mapLimit, USER_AGENT } from "../http.js";

export interface GithubRepoRef {
  owner: string;
  repo: string;
  ref?: string;
}

export interface GithubFetchResult {
  files: ProjectFiles;
  commit: string;
  ref: string;
  truncated: boolean;
  /** El repositorio es privado (solo accesible con token). */
  private: boolean;
}

export interface GithubSourceOptions {
  token?: string;
  maxFiles?: number;
  fetchImpl?: typeof fetch;
}

/** Acepta "owner/repo", "owner/repo@ref" o URLs https://github.com/owner/repo[/tree/ref]. */
export function parseGithubRepo(input: string): GithubRepoRef | null {
  const s = input.trim().replace(/\.git$/, "");
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:\/tree\/(.+?))?\/?$/.exec(s);
  if (url && url[1] && url[2]) return { owner: url[1], repo: url[2], ref: url[3] };
  const short = /^([\w.-]+)\/([\w.-]+)(?:@(.+))?$/.exec(s);
  if (short && short[1] && short[2]) return { owner: short[1], repo: short[2], ref: short[3] };
  return null;
}

interface RepoInfo {
  default_branch: string;
  private?: boolean;
}
interface CommitInfo {
  sha: string;
}
interface TreeInfo {
  tree: { path: string; type: string; size?: number }[];
  truncated: boolean;
}

/**
 * Descarga solo los manifiestos de un repo de GitHub en un commit concreto.
 * Sin token: 3 llamadas a la API (repo, commit, árbol) y raw.githubusercontent.com para el contenido
 * (60 llamadas/hora por IP, solo repos públicos). Con token (OAuth del usuario) también lee repos
 * privados usando la API de contenidos.
 */
export async function fetchGithubProject(
  ref: GithubRepoRef,
  opts: GithubSourceOptions = {},
): Promise<GithubFetchResult> {
  const api = "https://api.github.com";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
  };
  const http = { headers, fetchImpl: opts.fetchImpl, retries: 1 };
  const base = `${api}/repos/${ref.owner}/${ref.repo}`;

  const info = await httpJson<RepoInfo>(base, http);
  if (!info) {
    throw new Error(
      opts.token
        ? `No existe el repositorio ${ref.owner}/${ref.repo} o tu cuenta de GitHub no tiene acceso`
        : `No existe el repositorio ${ref.owner}/${ref.repo} o es privado (conecta tu cuenta de GitHub)`,
    );
  }
  const branch = ref.ref ?? info.default_branch;
  const commit = await httpJson<CommitInfo>(`${base}/commits/${encodeURIComponent(branch)}`, http);
  if (!commit) throw new Error(`No existe la rama, tag o commit "${branch}" en ${ref.owner}/${ref.repo}`);

  const tree = await httpJson<TreeInfo>(`${base}/git/trees/${commit.sha}?recursive=1`, http);
  if (!tree) throw new Error("No se pudo leer el árbol de archivos del repositorio");

  const wanted = tree.tree
    .filter((e) => e.type === "blob" && isManifestPath(e.path) && (e.size ?? 0) <= MAX_FILE_BYTES)
    .slice(0, opts.maxFiles ?? 100);

  const files: ProjectFiles = new Map();
  const doFetch = opts.fetchImpl ?? fetch;
  await mapLimit(wanted, 6, async (e) => {
    const path = e.path.split("/").map(encodeURIComponent).join("/");
    const res = opts.token
      ? await doFetch(`${base}/contents/${path}?ref=${commit.sha}`, {
          headers: { ...headers, Accept: "application/vnd.github.raw+json", "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(30_000),
        })
      : await doFetch(`https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${commit.sha}/${path}`, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(30_000),
        });
    if (res.ok) files.set(e.path, await res.text());
  });

  return {
    files,
    commit: commit.sha,
    ref: branch,
    truncated: tree.truncated,
    private: info.private === true,
  };
}
