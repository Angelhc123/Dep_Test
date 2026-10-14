import type { Cache } from "./ports.js";

export const USER_AGENT = "depscan/0.1 (+https://github.com/depscan)";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface HttpOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** Para pruebas: permite inyectar un fetch simulado. */
  fetchImpl?: typeof fetch;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch con timeout, reintentos con backoff exponencial (429, 5xx y errores de red)
 * y respeto de la cabecera Retry-After. Devuelve null en 404.
 */
export async function httpJson<T>(url: string, opts: HttpOptions = {}): Promise<T | null> {
  const { method = "GET", body, headers = {}, timeoutMs = 20_000, retries = 3 } = opts;
  const doFetch = opts.fetchImpl ?? fetch;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await doFetch(url, {
        method,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 404) return null;
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status === 403 || res.status >= 500;
      lastError = new HttpError(res.status, url, `HTTP ${res.status} en ${url}`);
      if (!retryable || attempt === retries) throw lastError;
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      lastError = e;
      if (attempt === retries) break;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error(`No se pudo consultar ${url}: ${(lastError as Error)?.message ?? lastError}`);
}

/** Ejecuta tareas con un máximo de `limit` en paralelo, conservando el orden de resultados. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Envuelve una función asíncrona con caché JSON (incluye resultados null para no repetir 404). */
export async function cached<T>(
  cache: Cache | undefined,
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  if (cache) {
    const hit = await cache.get(key);
    if (hit !== undefined) return JSON.parse(hit) as T;
  }
  const value = await load();
  if (cache) await cache.set(key, JSON.stringify(value), ttlSeconds);
  return value;
}

/** Caché en memoria con expiración; útil para la CLI y las pruebas. */
export class MemoryCache implements Cache {
  private readonly store = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | undefined> {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }
}

/** Limitador de ventana deslizante: como máximo `max` llamadas cada `windowMs`. */
export class RateLimiter {
  private readonly calls: number[] = [];
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  acquire(): Promise<void> {
    const run = async () => {
      for (;;) {
        const now = Date.now();
        while (this.calls.length && this.calls[0]! <= now - this.windowMs) this.calls.shift();
        if (this.calls.length < this.max) {
          this.calls.push(now);
          return;
        }
        await sleep(this.calls[0]! + this.windowMs - now + 10);
      }
    };
    const p = this.chain.then(run);
    this.chain = p.catch(() => undefined);
    return p;
  }
}
