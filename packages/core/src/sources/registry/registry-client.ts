import type { Ecosystem } from "../../domain/types.js";
import { cached, httpJson } from "../http.js";
import type { Cache, RegistrySource } from "../ports.js";

interface NpmPackument {
  versions?: Record<string, { deprecated?: string }>;
}

interface PyPiProject {
  releases?: Record<string, { yanked?: boolean }[]>;
}

export interface RegistryClientOptions {
  cache?: Cache;
  cacheTtlSeconds?: number;
  fetchImpl?: typeof fetch;
}

/** Lista versiones publicadas en registry.npmjs.org y pypi.org (para estimar versiones sin lockfile). */
export class RegistryClient implements RegistrySource {
  constructor(private readonly opts: RegistryClientOptions = {}) {}

  listVersions(ecosystem: Ecosystem, name: string): Promise<string[] | null> {
    return cached(this.opts.cache, `registry:${ecosystem}:${name}`, this.opts.cacheTtlSeconds ?? 3600, () =>
      ecosystem === "npm" ? this.npm(name) : this.pypi(name),
    );
  }

  private async npm(name: string): Promise<string[] | null> {
    const url = `https://registry.npmjs.org/${name.replace("/", "%2f")}`;
    const res = await httpJson<NpmPackument>(url, {
      // Formato abreviado: mucho más liviano que el documento completo.
      headers: { Accept: "application/vnd.npm.install-v1+json" },
      fetchImpl: this.opts.fetchImpl,
    });
    return res?.versions ? Object.keys(res.versions) : null;
  }

  private async pypi(name: string): Promise<string[] | null> {
    const res = await httpJson<PyPiProject>(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, {
      fetchImpl: this.opts.fetchImpl,
    });
    if (!res?.releases) return null;
    return Object.entries(res.releases)
      .filter(([, files]) => files.length === 0 || files.some((f) => !f.yanked))
      .map(([v]) => v);
  }
}
