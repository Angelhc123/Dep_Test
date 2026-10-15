import { describe, expect, it, vi } from "vitest";
import { fetchGithubProject, parseGithubRepo } from "../src/sources/github/github-source.js";

describe("parseGithubRepo", () => {
  it("acepta owner/repo", () => {
    expect(parseGithubRepo("foo/bar")).toEqual({ owner: "foo", repo: "bar", ref: undefined });
  });

  it("acepta owner/repo@ref", () => {
    expect(parseGithubRepo("foo/bar@v1.2.3")).toEqual({ owner: "foo", repo: "bar", ref: "v1.2.3" });
  });

  it("acepta una URL completa de GitHub", () => {
    expect(parseGithubRepo("https://github.com/foo/bar")).toEqual({
      owner: "foo",
      repo: "bar",
      ref: undefined,
    });
  });

  it("acepta una URL con /tree/<ref>", () => {
    expect(parseGithubRepo("https://github.com/foo/bar/tree/main")).toEqual({
      owner: "foo",
      repo: "bar",
      ref: "main",
    });
  });

  it("acepta .git al final y www.", () => {
    expect(parseGithubRepo("https://www.github.com/foo/bar.git")).toEqual({
      owner: "foo",
      repo: "bar",
      ref: undefined,
    });
  });

  it("devuelve null para una entrada inválida", () => {
    expect(parseGithubRepo("no es un repo")).toBeNull();
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchGithubProject", () => {
  const ref = { owner: "foo", repo: "bar" };

  it("descarga los manifiestos de un repo público (sin token)", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://api.github.com/repos/foo/bar") {
        return json({ default_branch: "main", private: false });
      }
      if (url.endsWith("/commits/main")) return json({ sha: "deadbeef" });
      if (url.includes("/git/trees/")) {
        return json({
          tree: [
            { path: "package.json", type: "blob", size: 100 },
            { path: "src/index.ts", type: "blob", size: 100 },
            { path: "node_modules/x/package.json", type: "blob", size: 100 },
          ],
          truncated: false,
        });
      }
      if (url.startsWith("https://raw.githubusercontent.com/")) {
        return new Response('{"name":"bar"}', { status: 200 });
      }
      throw new Error(`URL no esperada: ${url}`);
    });

    const res = await fetchGithubProject(ref, { fetchImpl });
    expect(res.commit).toBe("deadbeef");
    expect(res.ref).toBe("main");
    expect(res.private).toBe(false);
    expect(res.truncated).toBe(false);
    expect([...res.files.keys()]).toEqual(["package.json"]);
  });

  it("usa la API de contenidos cuando hay token", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://api.github.com/repos/foo/bar") return json({ default_branch: "main" });
      if (url.endsWith("/commits/main")) return json({ sha: "abc123" });
      if (url.includes("/git/trees/")) {
        return json({ tree: [{ path: "requirements.txt", type: "blob", size: 10 }], truncated: false });
      }
      if (url.includes("/contents/requirements.txt")) {
        return new Response("flask==2.0.0", { status: 200 });
      }
      throw new Error(`URL no esperada: ${url}`);
    });

    const res = await fetchGithubProject(ref, { fetchImpl, token: "gh-token" });
    expect(res.files.get("requirements.txt")).toBe("flask==2.0.0");
    const contentsCall = fetchImpl.mock.calls.find(([url]: [string]) => url.includes("/contents/"));
    expect((contentsCall![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer gh-token" });
  });

  it("lanza si el repositorio no existe (sin token)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(fetchGithubProject(ref, { fetchImpl })).rejects.toThrow(/no tiene acceso|conecta tu cuenta/);
  });

  it("lanza con mensaje distinto si el repo no existe y hay token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(fetchGithubProject(ref, { fetchImpl, token: "t" })).rejects.toThrow(/no tiene acceso/);
  });

  it("lanza si la rama/ref no existe", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://api.github.com/repos/foo/bar") return json({ default_branch: "main" });
      return new Response("{}", { status: 404 });
    });
    await expect(fetchGithubProject(ref, { fetchImpl })).rejects.toThrow(/No existe la rama/);
  });

  it("lanza si no se puede leer el árbol de archivos", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://api.github.com/repos/foo/bar") return json({ default_branch: "main" });
      if (url.endsWith("/commits/main")) return json({ sha: "sha1" });
      return new Response("{}", { status: 404 });
    });
    await expect(fetchGithubProject(ref, { fetchImpl })).rejects.toThrow(/árbol de archivos/);
  });

  it("respeta maxFiles y omite archivos que no respondieron 200", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://api.github.com/repos/foo/bar") return json({ default_branch: "main" });
      if (url.endsWith("/commits/main")) return json({ sha: "sha1" });
      if (url.includes("/git/trees/")) {
        return json({
          tree: [
            { path: "requirements.txt", type: "blob", size: 10 },
            { path: "requirements-dev.txt", type: "blob", size: 10 },
          ],
          truncated: true,
        });
      }
      return new Response(null, { status: 500 });
    });
    const res = await fetchGithubProject(ref, { fetchImpl, maxFiles: 1 });
    expect(res.files.size).toBe(0);
    expect(res.truncated).toBe(true);
  });
});
