import { describe, expect, it, vi } from "vitest";
import { NvdClient } from "../src/sources/nvd/nvd-client.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("NvdClient.getCve", () => {
  it("devuelve null si el ID no tiene el formato CVE-YYYY-NNN", async () => {
    const fetchImpl = vi.fn();
    const client = new NvdClient({ fetchImpl });
    expect(await client.getCve("not-a-cve")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("devuelve null si NVD no conoce el CVE", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ vulnerabilities: [] }));
    const client = new NvdClient({ fetchImpl });
    expect(await client.getCve("CVE-2024-1234")).toBeNull();
  });

  it("prefiere CVSS 3.1 sobre 3.0, 4.0 y 2.0", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        vulnerabilities: [
          {
            cve: {
              id: "CVE-2024-1234",
              descriptions: [
                { lang: "es", value: "en español" },
                { lang: "en", value: "in english" },
              ],
              metrics: {
                cvssMetricV2: [{ cvssData: { baseScore: 5, vectorString: "v2", version: "2.0" } }],
                cvssMetricV31: [{ cvssData: { baseScore: 9.8, vectorString: "v31", version: "3.1" } }],
                cvssMetricV30: [{ cvssData: { baseScore: 7, vectorString: "v30", version: "3.0" } }],
              },
            },
          },
        ],
      }),
    );
    const client = new NvdClient({ fetchImpl });
    const info = await client.getCve("CVE-2024-1234");
    expect(info).toEqual({
      id: "CVE-2024-1234",
      description: "in english",
      cvss: 9.8,
      cvssVector: "v31",
      cvssVersion: "3.1",
    });
  });

  it("usa un apiKey en la cabecera cuando se provee", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ vulnerabilities: [] }));
    const client = new NvdClient({ fetchImpl, apiKey: "secret-key" });
    await client.getCve("CVE-2024-0001");
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).apiKey).toBe("secret-key");
  });
});
