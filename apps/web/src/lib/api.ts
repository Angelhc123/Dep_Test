import type { OsvVulnerability, ScanReport, ScanSummary } from "@depscan/core";

export type SavedScan = ScanReport & { id: string; private?: boolean; mine?: boolean };

export interface ScanListItem {
  id: string;
  createdAt: string;
  targetName: string;
  source: string;
  commit: string | null;
  risk: ScanSummary["risk"];
  private: boolean;
  summary: ScanSummary;
}

export interface ScanRequest {
  name?: string;
  files?: { path: string; content: string }[];
  github?: string;
  options?: { estimate?: boolean; enrichNvd?: boolean; includeDev?: boolean; remediation?: boolean };
}

export interface Health {
  status: string;
  version: string;
  db: boolean;
  nvdApiKey: boolean;
}

export interface Me {
  user: { id: string; email: string | null; name: string | null; avatarUrl: string | null } | null;
  providers: { google: boolean; github: boolean };
  linked: ("google" | "github")[];
  github: { connected: boolean; login: string | null; canReadPrivate: boolean };
}

export interface GithubRepo {
  fullName: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
  htmlUrl: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Error HTTP ${res.status}`, res.status);
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  health: () => request<Health>("/api/health"),
  me: () => request<Me>("/api/auth/me"),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  disconnectGithub: () => request<void>("/api/auth/github", { method: "DELETE" }),
  loginUrl: (provider: "google" | "github", returnTo = "/#/") =>
    `/api/auth/${provider}/login?returnTo=${enc(returnTo)}`,
  githubRepos: (page = 1) =>
    request<{ repos: GithubRepo[]; hasMore: boolean }>(`/api/github/repos?page=${page}`),
  createScan: (body: ScanRequest) =>
    request<SavedScan>("/api/scans", { method: "POST", body: JSON.stringify(body) }),
  listScans: (limit = 50, offset = 0) =>
    request<{ items: ScanListItem[]; total: number }>(`/api/scans?limit=${limit}&offset=${offset}`),
  getScan: (id: string) => request<SavedScan>(`/api/scans/${enc(id)}`),
  deleteScan: (id: string) => request<void>(`/api/scans/${enc(id)}`, { method: "DELETE" }),
  getVuln: (id: string) => request<OsvVulnerability>(`/api/vulns/${enc(id)}`),
  reportHtmlUrl: (id: string, download = false) =>
    `/api/scans/${enc(id)}/report.html${download ? "?download=1" : ""}`,
  reportPdfUrl: (id: string) => `/api/scans/${enc(id)}/report.pdf`,
};
