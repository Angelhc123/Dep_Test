import type { Cache } from "@depscan/core";

/**
 * Telemetría en memoria del proceso: peticiones HTTP, escaneos y caché.
 * Se expone en /api/metrics (JSON, lo usa la página "Estado" de la web) y en
 * /metrics (formato de texto de Prometheus, para Grafana u otro colector).
 * Se reinicia con el proceso; los datos persistentes (sesiones, historial,
 * entradas de caché) se leen de SQLite en cada consulta.
 */

/** Ventana de muestras para percentiles (últimas N duraciones). */
const WINDOW = 500;

class Window {
  private readonly values: number[] = [];
  push(v: number): void {
    this.values.push(v);
    if (this.values.length > WINDOW) this.values.shift();
  }
  percentile(p: number): number {
    if (!this.values.length) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return round(sorted[Math.max(0, i)]!);
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Minutos que se conservan en la serie temporal (última hora). */
const SERIES_MINUTES = 60;

interface Bucket {
  minute: number; // epoch en minutos
  requests: number;
  errors: number;
  scans: number;
  cacheHits: number;
  cacheMisses: number;
  durations: number[];
}

export interface SeriesPoint {
  /** Inicio del minuto (ISO 8601). */
  t: string;
  requests: number;
  errors5xx: number;
  scans: number;
  p95Ms: number;
  cacheHitRate: number | null;
}

interface RouteStats {
  count: number;
  errors: number;
  durations: Window;
}

export interface StorageStats {
  activeSessions: number;
  loggedInSessions: number;
  users: number;
  scansStored: number;
  cacheEntries: number;
}

export interface MetricsSnapshot {
  version: string;
  startedAt: string;
  uptimeSeconds: number;
  memoryMb: number;
  http: {
    requests: number;
    byStatus: Record<string, number>;
    errorRate: number;
    latencyMs: { p50: number; p95: number; p99: number };
    routes: { route: string; count: number; errors: number; p95Ms: number }[];
  };
  scans: {
    total: number;
    failed: number;
    bySource: Record<string, number>;
    byRisk: Record<string, number>;
    dependencies: number;
    vulnerableDependencies: number;
    durationMs: { p50: number; p95: number };
  };
  cache: { hits: number; misses: number; writes: number; hitRate: number; entries: number };
  sessions: { active: number; loggedIn: number; users: number };
  history: { scansStored: number };
  /** Serie por minuto de la última hora (para gráficos de tendencia). */
  series: SeriesPoint[];
}

export interface ScanEvent {
  source: string;
  risk: string;
  dependencies: number;
  vulnerableDependencies: number;
  durationMs: number;
}

export class Telemetry {
  readonly startedAt: Date;
  private readonly routes = new Map<string, RouteStats>();
  private readonly byStatus: Record<string, number> = {};
  private readonly latency = new Window();
  private requests = 0;
  private scans = { total: 0, failed: 0, dependencies: 0, vulnerable: 0 };
  private readonly scanSource: Record<string, number> = {};
  private readonly scanRisk: Record<string, number> = {};
  private readonly scanDuration = new Window();
  private cacheStats = { hits: 0, misses: 0, writes: 0 };
  private readonly buckets: Bucket[] = [];

  constructor(
    private readonly version: string,
    /** Reloj inyectable (pruebas). */
    private readonly now: () => number = Date.now,
  ) {
    this.startedAt = new Date(now());
  }

  /** Bucket del minuto actual; descarta los de más de una hora. */
  private bucket(): Bucket {
    const minute = Math.floor(this.now() / 60_000);
    let b = this.buckets.at(-1);
    if (!b || b.minute !== minute) {
      b = { minute, requests: 0, errors: 0, scans: 0, cacheHits: 0, cacheMisses: 0, durations: [] };
      this.buckets.push(b);
      while (this.buckets.length && this.buckets[0]!.minute <= minute - SERIES_MINUTES) this.buckets.shift();
    }
    return b;
  }

  /** Serie continua de la última hora (los minutos sin actividad aparecen en cero). */
  series(): SeriesPoint[] {
    const actual = Math.floor(this.now() / 60_000);
    const primero = Math.max(actual - SERIES_MINUTES + 1, Math.floor(this.startedAt.getTime() / 60_000));
    const porMinuto = new Map(this.buckets.map((b) => [b.minute, b]));
    const out: SeriesPoint[] = [];
    for (let m = primero; m <= actual; m++) {
      const b = porMinuto.get(m);
      const lookups = b ? b.cacheHits + b.cacheMisses : 0;
      const w = new Window();
      for (const d of b?.durations ?? []) w.push(d);
      out.push({
        t: new Date(m * 60_000).toISOString(),
        requests: b?.requests ?? 0,
        errors5xx: b?.errors ?? 0,
        scans: b?.scans ?? 0,
        p95Ms: w.percentile(95),
        cacheHitRate: lookups ? round((100 * b!.cacheHits) / lookups) : null,
      });
    }
    return out;
  }

  recordRequest(method: string, route: string, status: number, ms: number): void {
    this.requests++;
    const b = this.bucket();
    b.requests++;
    if (status >= 500) b.errors++;
    b.durations.push(ms);
    const cls = `${Math.floor(status / 100)}xx`;
    this.byStatus[cls] = (this.byStatus[cls] ?? 0) + 1;
    this.latency.push(ms);
    const key = `${method} ${route}`;
    const r = this.routes.get(key) ?? { count: 0, errors: 0, durations: new Window() };
    r.count++;
    if (status >= 500) r.errors++;
    r.durations.push(ms);
    this.routes.set(key, r);
  }

  recordScan(e: ScanEvent): void {
    this.scans.total++;
    this.bucket().scans++;
    this.scans.dependencies += e.dependencies;
    this.scans.vulnerable += e.vulnerableDependencies;
    this.scanSource[e.source] = (this.scanSource[e.source] ?? 0) + 1;
    this.scanRisk[e.risk] = (this.scanRisk[e.risk] ?? 0) + 1;
    this.scanDuration.push(e.durationMs);
  }

  recordScanFailure(): void {
    this.scans.failed++;
  }

  /** Envuelve la caché para contar aciertos, fallos y escrituras. */
  instrumentCache(cache: Cache): Cache {
    return {
      get: async (key) => {
        const v = await cache.get(key);
        if (v === undefined) {
          this.cacheStats.misses++;
          this.bucket().cacheMisses++;
        } else {
          this.cacheStats.hits++;
          this.bucket().cacheHits++;
        }
        return v;
      },
      set: async (key, value, ttl) => {
        this.cacheStats.writes++;
        await cache.set(key, value, ttl);
      },
    };
  }

  snapshot(storage: StorageStats): MetricsSnapshot {
    const errors5xx = this.byStatus["5xx"] ?? 0;
    const lookups = this.cacheStats.hits + this.cacheStats.misses;
    return {
      version: this.version,
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.round((this.now() - this.startedAt.getTime()) / 1000),
      memoryMb: round(process.memoryUsage().rss / 1024 / 1024),
      http: {
        requests: this.requests,
        byStatus: { ...this.byStatus },
        errorRate: this.requests ? round((100 * errors5xx) / this.requests) : 0,
        latencyMs: {
          p50: this.latency.percentile(50),
          p95: this.latency.percentile(95),
          p99: this.latency.percentile(99),
        },
        routes: [...this.routes.entries()]
          .map(([route, r]) => ({
            route,
            count: r.count,
            errors: r.errors,
            p95Ms: r.durations.percentile(95),
          }))
          .sort((a, b) => b.count - a.count),
      },
      scans: {
        total: this.scans.total,
        failed: this.scans.failed,
        bySource: { ...this.scanSource },
        byRisk: { ...this.scanRisk },
        dependencies: this.scans.dependencies,
        vulnerableDependencies: this.scans.vulnerable,
        durationMs: { p50: this.scanDuration.percentile(50), p95: this.scanDuration.percentile(95) },
      },
      cache: {
        ...this.cacheStats,
        hitRate: lookups ? round((100 * this.cacheStats.hits) / lookups) : 0,
        entries: storage.cacheEntries,
      },
      sessions: {
        active: storage.activeSessions,
        loggedIn: storage.loggedInSessions,
        users: storage.users,
      },
      history: { scansStored: storage.scansStored },
      series: this.series(),
    };
  }
}

/** Formato de exposición de texto de Prometheus (https://prometheus.io/docs/instrumenting/exposition_formats/). */
export function toPrometheus(m: MetricsSnapshot): string {
  const out: string[] = [];
  const metric = (name: string, type: string, help: string, rows: [string, number][]) => {
    out.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
    for (const [labels, value] of rows) out.push(`${name}${labels} ${value}`);
  };
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  metric("depscan_uptime_seconds", "gauge", "Segundos desde el arranque", [["", m.uptimeSeconds]]);
  metric("depscan_memory_rss_megabytes", "gauge", "Memoria residente del proceso", [["", m.memoryMb]]);
  metric(
    "depscan_http_requests_total",
    "counter",
    "Peticiones HTTP por ruta",
    m.http.routes.map((r) => [`{route="${esc(r.route)}"}`, r.count]),
  );
  metric(
    "depscan_http_responses_total",
    "counter",
    "Respuestas HTTP por clase de estado",
    Object.entries(m.http.byStatus).map(([k, v]) => [`{status="${k}"}`, v]),
  );
  metric(
    "depscan_http_latency_ms",
    "gauge",
    "Latencia HTTP (percentiles de las últimas 500 peticiones)",
    Object.entries(m.http.latencyMs).map(([q, v]) => [`{quantile="${q}"}`, v]),
  );
  metric(
    "depscan_scans_total",
    "counter",
    "Escaneos completados por origen y semáforo",
    Object.entries(m.scans.bySource).map(([k, v]) => [`{source="${esc(k)}"}`, v]),
  );
  metric("depscan_scans_failed_total", "counter", "Escaneos que terminaron en error", [["", m.scans.failed]]);
  metric(
    "depscan_scans_by_risk_total",
    "counter",
    "Escaneos por semáforo de riesgo",
    Object.entries(m.scans.byRisk).map(([k, v]) => [`{risk="${esc(k)}"}`, v]),
  );
  metric("depscan_cache_hits_total", "counter", "Aciertos de caché", [["", m.cache.hits]]);
  metric("depscan_cache_misses_total", "counter", "Fallos de caché", [["", m.cache.misses]]);
  metric("depscan_cache_entries", "gauge", "Entradas vigentes en la caché SQLite", [["", m.cache.entries]]);
  metric("depscan_sessions_active", "gauge", "Sesiones vigentes", [["", m.sessions.active]]);
  metric("depscan_history_scans_stored", "gauge", "Escaneos guardados en el historial", [
    ["", m.history.scansStored],
  ]);
  return out.join("\n") + "\n";
}
