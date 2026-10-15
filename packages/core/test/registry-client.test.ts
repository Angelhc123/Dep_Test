import { describe, expect, it, vi } from "vitest";
import { RegistryClient } from "../src/sources/registry/registry-client.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("RegistryClient.listVersions (npm)", () => {
  it("devuelve las versiones publicadas", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ versions: { "1.0.0": {}, "1.1.0": { deprecated: "usar 2.x" } } }),
    );
    const client = new RegistryClient({ fetchImpl });
    const versions = await client.listVersions("npm", "lodash");
    expect(versions).toEqual(["1.0.0", "1.1.0"]);
  });

  it("devuelve null si el paquete no existe", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    const client = new RegistryClient({ fetchImpl });
    expect(await client.listVersions("npm", "no-existe")).toBeNull();
  });
});

describe("RegistryClient.listVersions (PyPI)", () => {
  it("excluye versiones donde todos los archivos están yanked", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        releases: {
          "1.0.0": [{ yanked: false }],
          "2.0.0": [{ yanked: true }],
          "3.0.0": [],
        },
      }),
    );
    const client = new RegistryClient({ fetchImpl });
    const versions = await client.listVersions("PyPI", "requests");
    expect(versions?.sort()).toEqual(["1.0.0", "3.0.0"]);
  });

  it("devuelve null si el proyecto no existe", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    const client = new RegistryClient({ fetchImpl });
    expect(await client.listVersions("PyPI", "no-existe")).toBeNull();
  });
});
