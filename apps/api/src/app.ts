import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import {
  fetchGithubProject,
  isManifestPath,
  NvdClient,
  OsvClient,
  parseGithubRepo,
  RegistryClient,
  renderHtml,
  scanProject,
  SCANNER_VERSION,
  type ProjectFiles,
  type ScanSources,
  type ScanTarget,
  type VulnSource,
} from "@depscan/core";
import { randomToken, TokenCipher } from "./auth/crypto.js";
import { ensureSession, githubTokenOf, ownerKey, registerAuth, type AuthContext } from "./auth/routes.js";
import type { Config } from "./config.js";
import { Database, type StoredScan } from "./db.js";
import { renderPdf } from "./report/pdf.js";

export interface AppDeps {
  config: Config;
  /** Para pruebas: fuentes simuladas en lugar de OSV/NVD reales. */
  sources?: ScanSources;
  fetchGithub?: typeof fetchGithubProject;
  /** Para pruebas: fetch simulado para OAuth y la API de GitHub. */
  fetchImpl?: typeof fetch;
}

interface ScanBody {
  name?: string;
  files?: { path: string; content: string }[];
  github?: string;
  options?: { estimate?: boolean; enrichNvd?: boolean; includeDev?: boolean; remediation?: boolean };
}

const MAX_BODY = 25 * 1024 * 1024;

const scanBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", maxLength: 200 },
    github: { type: "string", maxLength: 300 },
    files: {
      type: "array",
      maxItems: 200,
      items: {
        type: "object",
        required: ["path", "content"],
        additionalProperties: false,
        properties: { path: { type: "string", maxLength: 500 }, content: { type: "string" } },
      },
    },
    options: {
      type: "object",
      additionalProperties: false,
      properties: {
        estimate: { type: "boolean" },
        enrichNvd: { type: "boolean" },
        includeDev: { type: "boolean" },
        remediation: { type: "boolean" },
      },
    },
  },
} as const;

/** Normaliza rutas subidas: "/", sin "..", sin prefijos absolutos. */
function cleanPath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s && s !== "." && s !== "..")
    .join("/");
}

/** Nombre de archivo seguro para descargas: depscan-owner_repo-2026-10-13.pdf */
function downloadName(scan: StoredScan, ext: string): string {
  const name = scan.report.target.name.replace(/[^\w.-]+/g, "_").slice(0, 60) || "proyecto";
  return `depscan-${name}-${scan.report.scannedAt.slice(0, 10)}.${ext}`;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({
    logger: { level: config.logLevel },
    bodyLimit: MAX_BODY,
    trustProxy: true, // Railway pone un proxy delante: la IP y el protocolo reales llegan en X-Forwarded-*
  });

  const db = new Database(config.dataDir);
  const cache = db.cache();
  const osv = new OsvClient({ cache });
  const sources: ScanSources = deps.sources ?? {
    osv,
    nvd: new NvdClient({ apiKey: config.nvdApiKey, cache }),
    registry: new RegistryClient({ cache }),
  };
  const vulnSource: VulnSource = deps.sources?.osv ?? osv;
  const fetchGithub = deps.fetchGithub ?? fetchGithubProject;

  let secret = config.sessionSecret;
  if (!secret) {
    secret = randomToken();
    if (config.google || config.github) {
      app.log.warn(
        "SESSION_SECRET no está definido: los tokens de GitHub guardados no sobrevivirán un reinicio",
      );
    }
  }
  const auth: AuthContext = {
    db,
    config,
    cipher: new TokenCipher(secret),
    fetchImpl: deps.fetchImpl ?? fetch,
  };

  app.addHook("onClose", async () => db.close());
  const purge = setInterval(() => db.purgeExpired(), 6 * 3600_000);
  purge.unref();

  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.addHook("onSend", async (_req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
  });

  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    reply.status(status).send({ error: status >= 500 ? "Error interno del servidor" : err.message });
  });

  await registerAuth(app, auth);

  /** Un escaneo privado (repo privado) solo lo ve su dueño; los demás, cualquiera con el enlace. */
  const readable = (req: FastifyRequest, id: string): StoredScan | null => {
    const scan = db.getScan(id);
    if (!scan) return null;
    if (scan.private && scan.owner !== ownerKey(req)) return null;
    return scan;
  };

  app.get("/api/health", async () => ({
    status: "ok",
    version: SCANNER_VERSION,
    db: db.ping(),
    nvdApiKey: Boolean(config.nvdApiKey),
    uptime: Math.round(process.uptime()),
  }));

  app.post<{ Body: ScanBody }>(
    "/api/scans",
    {
      schema: { body: scanBodySchema },
      config: { rateLimit: { max: config.scanRateLimit, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const body = req.body;
      let files: ProjectFiles;
      let target: ScanTarget;
      let isPrivate = false;

      if (body.github) {
        const ref = parseGithubRepo(body.github);
        if (!ref) {
          return reply
            .status(400)
            .send({ error: "Repositorio no válido: usa owner/repo o la URL de GitHub" });
        }
        try {
          // Con la cuenta de GitHub conectada se usa el token del usuario (permite repos privados).
          const token = githubTokenOf(auth, req.user) ?? config.githubToken;
          const gh = await fetchGithub(ref, { token });
          files = gh.files;
          isPrivate = gh.private;
          target = { name: `${ref.owner}/${ref.repo}`, source: "github", commit: gh.commit, ref: gh.ref };
        } catch (e) {
          return reply.status(422).send({ error: (e as Error).message });
        }
      } else if (body.files?.length) {
        files = new Map();
        for (const f of body.files) {
          const path = cleanPath(f.path);
          if (path && isManifestPath(path)) files.set(path, f.content);
        }
        target = { name: body.name?.trim() || "proyecto subido", source: "upload" };
      } else {
        return reply.status(400).send({ error: "Envía archivos (files) o un repositorio (github)" });
      }

      if (files.size === 0) {
        return reply
          .status(422)
          .send({ error: "No se encontraron package.json, package-lock.json ni requirements*.txt" });
      }

      const session = ensureSession(db, req, reply);
      const owner = req.user ? `user:${req.user.id}` : `anon:${session.id}`;
      const opts = body.options ?? {};
      const report = await scanProject(files, sources, {
        target,
        estimate: opts.estimate ?? false,
        enrichNvd: opts.enrichNvd ?? false,
        includeDev: opts.includeDev ?? true,
        remediation: opts.remediation ?? true,
      });
      const saved = { ...report, id: randomUUID() };
      db.saveScan(saved, owner, isPrivate);
      return reply.status(201).send({ ...saved, private: isPrivate });
    },
  );

  app.get<{ Querystring: { limit?: number; offset?: number } }>(
    "/api/scans",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (req) => {
      const owner = ownerKey(req);
      return owner
        ? db.listScans(owner, req.query.limit ?? 20, req.query.offset ?? 0)
        : { items: [], total: 0 };
    },
  );

  app.get<{ Params: { id: string } }>("/api/scans/:id", async (req, reply) => {
    const scan = readable(req, req.params.id);
    if (!scan) return reply.status(404).send({ error: "Escaneo no encontrado" });
    return {
      ...scan.report,
      private: scan.private,
      mine: scan.owner !== null && scan.owner === ownerKey(req),
    };
  });

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>(
    "/api/scans/:id/report.html",
    async (req, reply) => {
      const scan = readable(req, req.params.id);
      if (!scan) return reply.status(404).send({ error: "Escaneo no encontrado" });
      const disposition = req.query.download ? "attachment" : "inline";
      return reply
        .type("text/html; charset=utf-8")
        .header("Content-Disposition", `${disposition}; filename="${downloadName(scan, "html")}"`)
        .header("Cache-Control", "private, no-store")
        .send(renderHtml(scan.report));
    },
  );

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>(
    "/api/scans/:id/report.pdf",
    async (req, reply) => {
      const scan = readable(req, req.params.id);
      if (!scan) return reply.status(404).send({ error: "Escaneo no encontrado" });
      const pdf = await renderPdf(scan.report);
      const disposition = req.query.download === "0" ? "inline" : "attachment";
      return reply
        .type("application/pdf")
        .header("Content-Disposition", `${disposition}; filename="${downloadName(scan, "pdf")}"`)
        .header("Cache-Control", "private, no-store")
        .send(pdf);
    },
  );

  app.delete<{ Params: { id: string } }>("/api/scans/:id", async (req, reply) => {
    const owner = ownerKey(req);
    return owner && db.deleteScan(req.params.id, owner)
      ? reply.status(204).send()
      : reply.status(404).send({ error: "Escaneo no encontrado" });
  });

  app.get<{ Params: { id: string } }>("/api/vulns/:id", async (req, reply) => {
    if (!/^[A-Za-z0-9._:-]{3,80}$/.test(req.params.id))
      return reply.status(400).send({ error: "ID no válido" });
    const v = await vulnSource.getVulnerability(req.params.id);
    return v ?? reply.status(404).send({ error: "Vulnerabilidad no encontrada en OSV" });
  });

  app.all("/api/*", async (_req, reply) => reply.status(404).send({ error: "Ruta no encontrada" }));

  // Interfaz web (build de Vite) con fallback a index.html para la SPA.
  if (existsSync(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api/")) return reply.sendFile("index.html");
      return reply.status(404).send({ error: "Ruta no encontrada" });
    });
  } else {
    app.log.warn(`No existe ${config.webDist}: se sirve solo la API (ejecuta npm run build)`);
  }

  return app;
}
