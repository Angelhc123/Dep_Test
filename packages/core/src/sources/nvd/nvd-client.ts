import { cached, httpJson, RateLimiter } from "../http.js";
import type { Cache, CveEnricher, CveInfo } from "../ports.js";

interface CvssMetric {
  cvssData?: { baseScore?: number; vectorString?: string; version?: string };
}

interface NvdResponse {
  vulnerabilities?: {
    cve?: {
      id?: string;
      descriptions?: { lang?: string; value?: string }[];
      metrics?: {
        cvssMetricV40?: CvssMetric[];
        cvssMetricV31?: CvssMetric[];
        cvssMetricV30?: CvssMetric[];
        cvssMetricV2?: CvssMetric[];
      };
    };
  }[];
}

export interface NvdClientOptions {
  apiKey?: string;
  cache?: Cache;
  cacheTtlSeconds?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/**
 * Enriquecimiento por CVE desde NVD (https://nvd.nist.gov/developers/vulnerabilities).
 * Límites: 5 solicitudes / 30 s sin API key, 50 / 30 s con key. Solo se busca por ID de CVE,
 * nunca por nombre de paquete (la cobertura CPE de npm/PyPI es pobre).
 */
export class NvdClient implements CveEnricher {
  private readonly limiter: RateLimiter;
  private readonly baseUrl: string;

  constructor(private readonly opts: NvdClientOptions = {}) {
    this.limiter = new RateLimiter(opts.apiKey ? 50 : 5, 30_000);
    this.baseUrl = opts.baseUrl ?? "https://services.nvd.nist.gov/rest/json/cves/2.0";
  }

  getCve(cveId: string): Promise<CveInfo | null> {
    if (!/^CVE-\d{4}-\d+$/.test(cveId)) return Promise.resolve(null);
    return cached(this.opts.cache, `nvd:cve:${cveId}`, this.opts.cacheTtlSeconds ?? 86_400, async () => {
      await this.limiter.acquire();
      const res = await httpJson<NvdResponse>(`${this.baseUrl}?cveId=${encodeURIComponent(cveId)}`, {
        headers: this.opts.apiKey ? { apiKey: this.opts.apiKey } : {},
        fetchImpl: this.opts.fetchImpl,
        timeoutMs: 30_000,
      });
      const cve = res?.vulnerabilities?.[0]?.cve;
      if (!cve) return null;
      const m = cve.metrics ?? {};
      // Se prefiere CVSS 3.x porque es el que más avisos tienen; 4.0 y 2.0 como respaldo.
      const metric =
        m.cvssMetricV31?.[0] ?? m.cvssMetricV30?.[0] ?? m.cvssMetricV40?.[0] ?? m.cvssMetricV2?.[0];
      return {
        id: cve.id ?? cveId,
        description: cve.descriptions?.find((d) => d.lang === "en")?.value,
        cvss: metric?.cvssData?.baseScore,
        cvssVector: metric?.cvssData?.vectorString,
        cvssVersion: metric?.cvssData?.version,
      };
    });
  }
}
