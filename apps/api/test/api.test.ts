import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { OsvVulnerability, ScanReport, VulnSource } from "@depscan/core";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const vuln: OsvVulnerability = {
  id: "GHSA-test",
  aliases: ["CVE-2024-0001"],
  summary: "Falla de prueba",
  details: "### Workarounds\nValida la entrada.",
  database_specific: { severity: "CRITICAL", cwe_ids: ["CWE-1321"] },
  affected: [
    {
      package: { name: "lodash", ecosystem: "npm" },
      ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }],
    },
  ],
};

const osv: VulnSource = {
  queryBatch: async (qs) => qs.map((q) => (q.name === "lodash" ? [vuln.id] : [])),
  getVulnerability: async (id) => (id === vuln.id ? vuln : null),
  queryPackage: async (name) => (name === "lodash" ? [vuln] : []),
};

/** GitHub simulado: OAuth, perfil, emails y lista de repos. */
const fakeFetch: typeof fetch = async (input) => {
  const url = String(input);
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  if (url.startsWith("https://github.com/login/oauth/access_token"))
    return json({ access_token: "gho_secreto", scope: "read:user,user:email,repo" });
  if (url === "https://api.github.com/user")
    return json({ id: 42, login: "octo", name: "Octo Cat", avatar_url: "https://x/a.png" });
  if (url === "https://api.github.com/user/emails")
    return json([{ email: "octo@example.com", primary: true, verified: true }]);
  if (url.startsWith("https://api.github.com/user/repos")) {
    return json([
      {
        full_name: "octo/privado",
        private: true,
        description: null,
        default_branch: "main",
        language: "TypeScript",
        pushed_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
        html_url: "https://github.com/octo/privado",
      },
    ]);
  }
  return new Response("{}", { status: 404 });
};

let app: FastifyInstance;
const githubTokensSeen: (string | undefined)[] = [];

const cookieOf = (res: LightMyRequestResponse) => {
  const c = res.cookies.find((x) => x.name === "depscan_sid");
  return c ? `depscan_sid=${c.value}` : "";
};

beforeAll(async () => {
  const config = {
    ...loadConfig({}),
    dataDir: ":memory:",
    webDist: "/no-existe",
    logLevel: "silent",
    sessionSecret: "secreto-de-prueba",
    publicUrl: "http://localhost:3000",
    github: { clientId: "gh-id", clientSecret: "gh-secret" },
  };
  app = await buildApp({
    config,
    sources: { osv, registry: { listVersions: async () => ["4.17.15", "4.17.20", "4.17.21"] } },
    fetchImpl: fakeFetch,
    fetchGithub: async (ref, opts) => {
      githubTokensSeen.push(opts?.token);
      return {
        files: new Map([["package.json", JSON.stringify({ dependencies: { lodash: "4.17.15" } })]]),
        commit: "abc123",
        ref: "main",
        truncated: false,
        private: ref.repo === "privado",
      };
    },
  });
});

afterAll(() => app.close());

describe("API: escaneos", () => {
  it("GET /api/health", async () => {
    const res = await app.inject("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", db: true });
  });

  it("escanea, calcula la solución, guarda por sesión y descarga HTML y PDF", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/scans",
      payload: {
        name: "demo",
        files: [
          { path: "package.json", content: JSON.stringify({ dependencies: { lodash: "4.17.15" } }) },
          { path: "../../etc/README.md", content: "ignorado" },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const cookie = cookieOf(res);
    expect(cookie).not.toBe("");
    const report = res.json<ScanReport & { id: string }>();
    expect(report.summary).toMatchObject({ vulnerableDependencies: 1, risk: "red" });
    expect(report.findings[0]!.remediation).toMatchObject({
      status: "upgrade",
      recommended: "4.17.21",
      verified: true,
    });
    expect(report.findings[0]!.remediation!.mitigations.length).toBeGreaterThan(0);

    // El historial es por sesión: otro visitante no lo ve.
    expect((await app.inject({ url: "/api/scans", headers: { cookie } })).json().total).toBe(1);
    expect((await app.inject("/api/scans")).json().total).toBe(0);

    const html = await app.inject({
      url: `/api/scans/${report.id}/report.html?download=1`,
      headers: { cookie },
    });
    expect(html.headers["content-disposition"]).toMatch(
      /^attachment; filename="depscan-demo-\d{4}-\d{2}-\d{2}\.html"$/,
    );
    expect(html.body).toContain("Cómo resolverlo");
    expect(html.body).toContain("4.17.21");

    const pdf = await app.inject({ url: `/api/scans/${report.id}/report.pdf`, headers: { cookie } });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");

    // Solo el dueño puede borrar.
    expect((await app.inject({ method: "DELETE", url: `/api/scans/${report.id}` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: "DELETE", url: `/api/scans/${report.id}`, headers: { cookie } }))
        .statusCode,
    ).toBe(204);
  });

  it("valida la entrada", async () => {
    expect((await app.inject({ method: "POST", url: "/api/scans", payload: {} })).statusCode).toBe(400);
    expect(
      (await app.inject({ method: "POST", url: "/api/scans", payload: { github: "no valido!" } })).statusCode,
    ).toBe(400);
    const none = await app.inject({
      method: "POST",
      url: "/api/scans",
      payload: { files: [{ path: "README.md", content: "x" }] },
    });
    expect(none.statusCode).toBe(422);
  });

  it("GET /api/vulns/:id", async () => {
    expect((await app.inject("/api/vulns/GHSA-test")).json().id).toBe("GHSA-test");
    expect((await app.inject("/api/vulns/GHSA-nada")).statusCode).toBe(404);
  });
});

describe("API: login con GitHub y repos privados", () => {
  it("informa qué proveedores están configurados", async () => {
    const me = (await app.inject("/api/auth/me")).json();
    expect(me).toMatchObject({ user: null, providers: { google: false, github: true } });
    expect((await app.inject("/api/auth/google/login")).statusCode).toBe(404);
  });

  it("flujo OAuth completo, repos privados y privacidad del escaneo", async () => {
    // Escaneo anónimo previo: debe pasar a la cuenta al iniciar sesión.
    const anon = await app.inject({ method: "POST", url: "/api/scans", payload: { github: "octo/publico" } });
    const anonCookie = cookieOf(anon);

    const login = await app.inject({
      url: "/api/auth/github/login?returnTo=/%23/github",
      headers: { cookie: anonCookie },
    });
    expect(login.statusCode).toBe(302);
    const location = new URL(login.headers.location as string);
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/github/callback");
    expect(location.searchParams.get("scope")).toContain("repo");
    const state = location.searchParams.get("state")!;

    // state incorrecto: rechazado.
    const bad = await app.inject({
      url: `/api/auth/github/callback?code=x&state=otro`,
      headers: { cookie: anonCookie },
    });
    expect(bad.headers.location).toMatch(/^\/#\/login\?error=/);

    const cb = await app.inject({
      url: `/api/auth/github/callback?code=abc&state=${state}`,
      headers: { cookie: anonCookie },
    });
    expect(cb.statusCode).toBe(302);
    expect(cb.headers.location).toBe("/#/github");
    const cookie = cookieOf(cb);
    expect(cookie).not.toBe(anonCookie); // sesión rotada

    const me = (await app.inject({ url: "/api/auth/me", headers: { cookie } })).json();
    expect(me.user).toMatchObject({ email: "octo@example.com", name: "Octo Cat" });
    expect(me.github).toMatchObject({ connected: true, login: "octo", canReadPrivate: true });
    expect((await app.inject({ url: "/api/scans", headers: { cookie } })).json().total).toBe(1);

    const repos = (await app.inject({ url: "/api/github/repos", headers: { cookie } })).json();
    expect(repos.repos[0]).toMatchObject({ fullName: "octo/privado", private: true });

    // Escaneo de repo privado: usa el token del usuario y solo lo ve él.
    const scan = await app.inject({
      method: "POST",
      url: "/api/scans",
      payload: { github: "octo/privado" },
      headers: { cookie },
    });
    expect(scan.statusCode).toBe(201);
    expect(githubTokensSeen.at(-1)).toBe("gho_secreto");
    const id = scan.json().id;
    expect((await app.inject({ url: `/api/scans/${id}`, headers: { cookie } })).json()).toMatchObject({
      private: true,
      mine: true,
    });
    expect((await app.inject(`/api/scans/${id}`)).statusCode).toBe(404);
    expect((await app.inject(`/api/scans/${id}/report.pdf`)).statusCode).toBe(404);

    // Cerrar sesión.
    expect(
      (await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } })).statusCode,
    ).toBe(204);
    expect((await app.inject({ url: "/api/auth/me", headers: { cookie } })).json().user).toBeNull();
  });

  it("rechaza returnTo externo (redirección abierta)", async () => {
    const login = await app.inject("/api/auth/github/login?returnTo=//evil.example");
    const cookie = cookieOf(login);
    const state = new URL(login.headers.location as string).searchParams.get("state");
    const cb = await app.inject({
      url: `/api/auth/github/callback?code=abc&state=${state}`,
      headers: { cookie },
    });
    expect(cb.headers.location).toBe("/#/");
  });
});
