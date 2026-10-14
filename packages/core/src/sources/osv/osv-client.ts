import { cached, httpJson, mapLimit, type HttpOptions } from "../http.js";
import type { Cache, OsvVulnerability, PackageQuery, VulnSource } from "../ports.js";

/** Máximo de consultas por lote que acepta /v1/querybatch. */
export const OSV_BATCH_LIMIT = 1000;

interface BatchResponse {
  results: { vulns?: { id: string; modified?: string }[]; next_page_token?: string }[];
}

interface QueryResponse {
  vulns?: OsvVulnerability[];
  next_page_token?: string;
}

export interface OsvClientOptions {
  baseUrl?: string;
  cache?: Cache;
  /** TTL del detalle de cada vulnerabilidad en caché. Por defecto 24 h. */
  cacheTtlSeconds?: number;
  concurrency?: number;
  fetchImpl?: typeof fetch;
}

function isOsvVulnerability(v: unknown): v is OsvVulnerability {
  return typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "string";
}

/** Adaptador de la API de OSV (https://google.github.io/osv.dev/api/). */
export class OsvClient implements VulnSource {
  private readonly baseUrl: string;
  private readonly http: HttpOptions;

  constructor(private readonly opts: OsvClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://api.osv.dev";
    this.http = { fetchImpl: opts.fetchImpl };
  }

  async queryBatch(queries: PackageQuery[]): Promise<string[][]> {
    const results: string[][] = [];
    for (let start = 0; start < queries.length; start += OSV_BATCH_LIMIT) {
      const chunk = queries.slice(start, start + OSV_BATCH_LIMIT);
      const body = {
        queries: chunk.map((q) => ({
          package: { name: q.name, ecosystem: q.ecosystem },
          version: q.version,
        })),
      };
      const res = await httpJson<BatchResponse>(`${this.baseUrl}/v1/querybatch`, {
        ...this.http,
        method: "POST",
        body,
      });
      if (!res || !Array.isArray(res.results) || res.results.length !== chunk.length) {
        throw new Error("Respuesta inesperada de OSV /v1/querybatch");
      }
      for (let i = 0; i < chunk.length; i++) {
        const r = res.results[i]!;
        const ids = (r.vulns ?? []).map((v) => v.id);
        // Un resultado paginado indica que hay más IDs: se piden con /v1/query y page_token.
        if (r.next_page_token) ids.push(...(await this.remainingIds(chunk[i]!, r.next_page_token)));
        results.push([...new Set(ids)]);
      }
    }
    return results;
  }

  private async remainingIds(q: PackageQuery, token: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined = token;
    while (pageToken) {
      const res: QueryResponse | null = await httpJson<QueryResponse>(`${this.baseUrl}/v1/query`, {
        ...this.http,
        method: "POST",
        body: {
          package: { name: q.name, ecosystem: q.ecosystem },
          version: q.version,
          page_token: pageToken,
        },
      });
      ids.push(...(res?.vulns ?? []).map((v) => v.id));
      pageToken = res?.next_page_token;
    }
    return ids;
  }

  /** Todos los avisos de un paquete (cualquier versión), con su detalle completo. */
  async queryPackage(name: string, ecosystem: PackageQuery["ecosystem"]): Promise<OsvVulnerability[]> {
    return cached(
      this.opts.cache,
      `osv:pkg:${ecosystem}:${name}`,
      this.opts.cacheTtlSeconds ?? 86_400,
      async () => {
        const out: OsvVulnerability[] = [];
        let pageToken: string | undefined;
        do {
          const res: QueryResponse | null = await httpJson<QueryResponse>(`${this.baseUrl}/v1/query`, {
            ...this.http,
            method: "POST",
            body: { package: { name, ecosystem }, ...(pageToken ? { page_token: pageToken } : {}) },
          });
          out.push(...(res?.vulns ?? []).filter(isOsvVulnerability));
          pageToken = res?.next_page_token;
        } while (pageToken);
        return out;
      },
    );
  }

  async getVulnerability(id: string): Promise<OsvVulnerability | null> {
    return cached(this.opts.cache, `osv:vuln:${id}`, this.opts.cacheTtlSeconds ?? 86_400, async () => {
      const res = await httpJson<unknown>(`${this.baseUrl}/v1/vulns/${encodeURIComponent(id)}`, this.http);
      return isOsvVulnerability(res) ? res : null;
    });
  }

  /** Descarga varios detalles en paralelo (limitado). */
  async getVulnerabilities(ids: string[]): Promise<Map<string, OsvVulnerability>> {
    const out = new Map<string, OsvVulnerability>();
    const list = await mapLimit(ids, this.opts.concurrency ?? 8, (id) => this.getVulnerability(id));
    list.forEach((v, i) => v && out.set(ids[i]!, v));
    return out;
  }
}
