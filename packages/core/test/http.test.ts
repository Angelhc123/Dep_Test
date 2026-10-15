import { describe, expect, it, vi } from "vitest";
import { cached, httpJson, HttpError, mapLimit, MemoryCache, RateLimiter } from "../src/sources/http.js";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("httpJson", () => {
  it("devuelve el cuerpo parseado en una respuesta 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const res = await httpJson<{ ok: boolean }>("https://example.com", { fetchImpl });
    expect(res).toEqual({ ok: true });
  });

  it("devuelve null en 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(404, {}));
    const res = await httpJson("https://example.com", { fetchImpl });
    expect(res).toBeNull();
  });

  it("lanza HttpError en un error no reintentable (400)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, {}));
    await expect(httpJson("https://example.com", { fetchImpl, retries: 2 })).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reintenta en 503 y respeta Retry-After", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}, { "retry-after": "0" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: 1 }));
    const res = await httpJson<{ ok: number }>("https://example.com", { fetchImpl, retries: 2 });
    expect(res).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("lanza HttpError tras agotar los reintentos en 429", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(429, {}));
    const assertion = expect(httpJson("https://example.com", { fetchImpl, retries: 1 })).rejects.toBeInstanceOf(
      HttpError,
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("reintenta ante errores de red y finalmente lanza", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const assertion = expect(httpJson("https://example.com", { fetchImpl, retries: 1 })).rejects.toThrow(
      /No se pudo consultar/,
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("se recupera de un error de red seguido de éxito", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const assertion = expect(
      httpJson<{ ok: boolean }>("https://example.com", { fetchImpl, retries: 1 }),
    ).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    vi.useRealTimers();
  });

  it("envía el cuerpo como JSON cuando se pasa body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    await httpJson("https://example.com", { fetchImpl, method: "POST", body: { a: 1 } });
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});

describe("mapLimit", () => {
  it("conserva el orden de los resultados con concurrencia limitada", async () => {
    const items = [5, 1, 3, 2, 4];
    const res = await mapLimit(items, 2, async (n) => {
      await new Promise((r) => setTimeout(r, n));
      return n * 10;
    });
    expect(res).toEqual([50, 10, 30, 20, 40]);
  });

  it("funciona con límite mayor que el número de items", async () => {
    const res = await mapLimit([1, 2, 3], 10, async (n) => n + 1);
    expect(res).toEqual([2, 3, 4]);
  });

  it("funciona con lista vacía", async () => {
    const res = await mapLimit<number, number>([], 3, async (n) => n);
    expect(res).toEqual([]);
  });
});

describe("cached", () => {
  it("usa el loader cuando no hay caché y guarda el resultado", async () => {
    const cache = new MemoryCache();
    const load = vi.fn().mockResolvedValue({ v: 1 });
    const res = await cached(cache, "k", 60, load);
    expect(res).toEqual({ v: 1 });
    expect(load).toHaveBeenCalledTimes(1);

    const res2 = await cached(cache, "k", 60, load);
    expect(res2).toEqual({ v: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("sin caché siempre ejecuta el loader", async () => {
    const load = vi.fn().mockResolvedValue(42);
    await cached(undefined, "k", 60, load);
    await cached(undefined, "k", 60, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("MemoryCache", () => {
  it("expira las entradas tras el TTL", async () => {
    vi.useFakeTimers();
    const cache = new MemoryCache();
    await cache.set("k", "v", 1);
    expect(await cache.get("k")).toBe("v");
    vi.advanceTimersByTime(1500);
    expect(await cache.get("k")).toBeUndefined();
    vi.useRealTimers();
  });

  it("devuelve undefined para claves inexistentes", async () => {
    const cache = new MemoryCache();
    expect(await cache.get("nope")).toBeUndefined();
  });
});

describe("RateLimiter", () => {
  it("permite hasta `max` llamadas inmediatas y encola el resto", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2, 1000);
    const order: number[] = [];
    const p1 = limiter.acquire().then(() => order.push(1));
    const p2 = limiter.acquire().then(() => order.push(2));
    const p3 = limiter.acquire().then(() => order.push(3));
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1500);
    await Promise.all([p1, p2, p3]);
    expect(order).toEqual([1, 2, 3]);
    vi.useRealTimers();
  });
});
