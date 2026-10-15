import { describe, expect, it, vi } from "vitest";
import { OsvClient, OSV_BATCH_LIMIT } from "../src/sources/osv/osv-client.js";
import type { OsvVulnerability, PackageQuery } from "../src/sources/ports.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("OsvClient.queryBatch", () => {
  it("devuelve los IDs de vulnerabilidades por cada query, en orden", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [{ vulns: [{ id: "GHSA-1" }, { id: "GHSA-1" }] }, { vulns: [] }],
      }),
    );
    const client = new OsvClient({ fetchImpl });
    const queries: PackageQuery[] = [
      { name: "lodash", ecosystem: "npm", version: "4.0.0" },
      { name: "requests", ecosystem: "PyPI", version: "2.0.0" },
    ];
    const res = await client.queryBatch(queries);
    expect(res).toEqual([["GHSA-1"], []]);
  });

  it("pagina en lotes cuando hay más queries que OSV_BATCH_LIMIT", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { queries: unknown[] };
      return jsonResponse({ results: body.queries.map(() => ({ vulns: [] })) });
    });
    const client = new OsvClient({ fetchImpl });
    const queries: PackageQuery[] = Array.from({ length: OSV_BATCH_LIMIT + 5 }, (_, i) => ({
      name: `pkg${i}`,
      ecosystem: "npm",
      version: "1.0.0",
    }));
    const res = await client.queryBatch(queries);
    expect(res).toHaveLength(OSV_BATCH_LIMIT + 5);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("sigue next_page_token para completar los IDs de una query", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ results: [{ vulns: [{ id: "A" }], next_page_token: "tok1" }] }),
      )
      .mockResolvedValueOnce(jsonResponse({ vulns: [{ id: "B" }], next_page_token: "tok2" }))
      .mockResolvedValueOnce(jsonResponse({ vulns: [{ id: "C" }] }));
    const client = new OsvClient({ fetchImpl });
    const res = await client.queryBatch([{ name: "x", ecosystem: "npm", version: "1.0.0" }]);
    expect(res).toEqual([["A", "B", "C"]]);
  });

  it("lanza si la respuesta no tiene el mismo tamaño que el lote", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    const client = new OsvClient({ fetchImpl });
    await expect(
      client.queryBatch([{ name: "x", ecosystem: "npm", version: "1.0.0" }]),
    ).rejects.toThrow(/Respuesta inesperada/);
  });
});

describe("OsvClient.queryPackage", () => {
  it("acumula vulnerabilidades a través de varias páginas y cachea por paquete", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ vulns: [{ id: "GHSA-a" }], next_page_token: "p2" }),
      )
      .mockResolvedValueOnce(jsonResponse({ vulns: [{ id: "GHSA-b" }] }));
    const client = new OsvClient({ fetchImpl });
    const res = await client.queryPackage("lodash", "npm");
    expect(res.map((v) => v.id)).toEqual(["GHSA-a", "GHSA-b"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("filtra entradas que no cumplen el esquema mínimo", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ vulns: [{ id: "ok" }, { notId: 1 }] }));
    const client = new OsvClient({ fetchImpl });
    const res = await client.queryPackage("x", "npm");
    expect(res.map((v) => v.id)).toEqual(["ok"]);
  });
});

describe("OsvClient.getVulnerability / getVulnerabilities", () => {
  it("devuelve null si la respuesta no es una vulnerabilidad válida", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ notAVuln: true }));
    const client = new OsvClient({ fetchImpl });
    expect(await client.getVulnerability("GHSA-x")).toBeNull();
  });

  it("devuelve el detalle de la vulnerabilidad", async () => {
    const vuln: OsvVulnerability = { id: "GHSA-y", summary: "algo" };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(vuln));
    const client = new OsvClient({ fetchImpl });
    expect(await client.getVulnerability("GHSA-y")).toEqual(vuln);
  });

  it("descarga varios detalles en paralelo y descarta los nulos", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/missing")) return new Response("{}", { status: 404 });
      return jsonResponse({ id: url.split("/").pop() });
    });
    const client = new OsvClient({ fetchImpl, concurrency: 2 });
    const res = await client.getVulnerabilities(["id1", "missing", "id2"]);
    expect([...res.keys()].sort()).toEqual(["id1", "id2"]);
  });
});
