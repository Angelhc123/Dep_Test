import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Config } from "../config.js";
import type { Database, Provider, Session, User } from "../db.js";
import { pkceChallenge, randomToken, sha256, TokenCipher } from "./crypto.js";
import { authorizeUrl, exchangeCode, fetchProfile, listGithubRepos } from "./providers.js";

export const SESSION_COOKIE = "depscan_sid";
const SESSION_TTL_MS = 30 * 24 * 3600_000;
const OAUTH_TTL_MS = 10 * 60_000;

declare module "fastify" {
  interface FastifyRequest {
    session: Session | null;
    user: User | null;
  }
}

interface PendingOAuth {
  provider: Provider;
  state: string;
  verifier: string;
  returnTo: string;
  createdAt: number;
}

export interface AuthContext {
  db: Database;
  config: Config;
  cipher: TokenCipher;
  fetchImpl: typeof fetch;
}

/** Dueño de los escaneos: la cuenta si hay login; si no, la sesión anónima. */
export function ownerKey(req: FastifyRequest): string | null {
  if (req.user) return `user:${req.user.id}`;
  if (req.session) return `anon:${req.session.id}`;
  return null;
}

function setSessionCookie(req: FastifyRequest, reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: req.protocol === "https",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Crea la sesión (anónima) si todavía no existe. */
export function ensureSession(db: Database, req: FastifyRequest, reply: FastifyReply): Session {
  if (req.session) return req.session;
  const token = randomToken();
  const session = db.createSession(sha256(token), null, SESSION_TTL_MS);
  setSessionCookie(req, reply, token);
  req.session = session;
  return session;
}

/** Token de GitHub del usuario conectado (descifrado), o null. */
export function githubTokenOf(ctx: AuthContext, user: User | null): string | null {
  if (!user) return null;
  const id = ctx.db.identitiesOf(user.id).find((i) => i.provider === "github");
  return id?.accessTokenEnc ? ctx.cipher.decrypt(id.accessTokenEnc) : null;
}

/** Solo rutas internas ("/#/github"); evita redirecciones abiertas a otros dominios. */
function safeReturnTo(value: unknown): string {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/#/";
}

function baseUrl(ctx: AuthContext, req: FastifyRequest): string {
  return ctx.config.publicUrl ?? `${req.protocol}://${req.host}`;
}

export async function registerAuth(app: FastifyInstance, ctx: AuthContext): Promise<void> {
  const { db, config } = ctx;
  const clients = { google: config.google, github: config.github };

  app.decorateRequest("session", null);
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const session = db.getSession(sha256(token));
    if (!session) return;
    req.session = session;
    req.user = session.userId ? db.getUser(session.userId) : null;
  });

  app.get("/api/auth/me", async (req) => {
    const identities = req.user ? db.identitiesOf(req.user.id) : [];
    const gh = identities.find((i) => i.provider === "github");
    return {
      user: req.user,
      providers: { google: Boolean(clients.google), github: Boolean(clients.github) },
      linked: identities.map((i) => i.provider),
      github: {
        connected: Boolean(gh?.accessTokenEnc && githubTokenOf(ctx, req.user)),
        login: gh?.login ?? null,
        canReadPrivate: gh?.scopes?.split(/[ ,]+/).includes("repo") ?? false,
      },
    };
  });

  app.get<{ Params: { provider: string }; Querystring: { returnTo?: string } }>(
    "/api/auth/:provider/login",
    async (req, reply) => {
      const provider = req.params.provider as Provider;
      const client = clients[provider];
      if (!client)
        return reply.status(404).send({ error: `Login con ${req.params.provider} no está configurado` });
      const session = ensureSession(db, req, reply);
      const pending: PendingOAuth = {
        provider,
        state: randomToken(24),
        verifier: randomToken(48),
        returnTo: safeReturnTo(req.query.returnTo),
        createdAt: Date.now(),
      };
      db.updateSessionData(session.id, { ...session.data, oauth: pending });
      return reply.redirect(
        authorizeUrl(provider, client, {
          redirectUri: `${baseUrl(ctx, req)}/api/auth/${provider}/callback`,
          state: pending.state,
          codeChallenge: pkceChallenge(pending.verifier),
        }),
      );
    },
  );

  app.get<{ Params: { provider: string }; Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/auth/:provider/callback",
    async (req, reply) => {
      const provider = req.params.provider as Provider;
      const client = clients[provider];
      const fail = (msg: string) => reply.redirect(`/#/login?error=${encodeURIComponent(msg)}`);
      if (!client) return fail("Proveedor no configurado");
      if (req.query.error)
        return fail(req.query.error === "access_denied" ? "Cancelaste el inicio de sesión" : req.query.error);

      const pending = req.session?.data.oauth as PendingOAuth | undefined;
      if (
        !req.session ||
        !pending ||
        pending.provider !== provider ||
        !req.query.state ||
        pending.state !== req.query.state ||
        Date.now() - pending.createdAt > OAUTH_TTL_MS
      ) {
        return fail("La solicitud de inicio de sesión expiró o no es válida. Inténtalo de nuevo.");
      }
      if (!req.query.code) return fail("Falta el código de autorización");

      let profile;
      let token;
      try {
        token = await exchangeCode(
          provider,
          client,
          {
            code: req.query.code,
            redirectUri: `${baseUrl(ctx, req)}/api/auth/${provider}/callback`,
            codeVerifier: pending.verifier,
          },
          ctx.fetchImpl,
        );
        profile = await fetchProfile(provider, token.accessToken, ctx.fetchImpl);
      } catch (e) {
        req.log.warn(e, "OAuth falló");
        return fail("No se pudo completar el inicio de sesión con el proveedor");
      }

      // ¿Quién es? 1) identidad ya conocida, 2) sesión ya iniciada (vincular), 3) email verificado, 4) nuevo.
      const existing = db.getIdentity(provider, profile.providerUserId);
      if (existing && req.user && existing.userId !== req.user.id) {
        return fail(`Esa cuenta de ${provider} ya está vinculada a otro usuario de depscan`);
      }
      let user: User | null = existing ? db.getUser(existing.userId) : null;
      if (!user && req.user) user = req.user;
      if (!user && profile.email && profile.emailVerified) user = db.findUserByEmail(profile.email);
      if (!user)
        user = db.createUser({ email: profile.email, name: profile.name, avatarUrl: profile.avatarUrl });
      else
        db.fillUserProfile(user.id, {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        });

      db.upsertIdentity({
        provider,
        providerUserId: profile.providerUserId,
        userId: user.id,
        login: profile.login,
        email: profile.email,
        // Solo se guarda el token de GitHub (para leer repos); el de Google no se necesita.
        accessTokenEnc: provider === "github" ? ctx.cipher.encrypt(token.accessToken) : null,
        scopes: provider === "github" ? token.scopes : null,
      });

      // Sesión nueva al autenticarse (evita fijación de sesión) y los escaneos anónimos pasan a la cuenta.
      const oldSession = req.session;
      db.transferScans(`anon:${oldSession.id}`, `user:${user.id}`);
      db.deleteSession(oldSession.id);
      const newToken = randomToken();
      db.createSession(sha256(newToken), user.id, SESSION_TTL_MS);
      setSessionCookie(req, reply, newToken);
      return reply.redirect(pending.returnTo);
    },
  );

  app.post("/api/auth/logout", async (req, reply) => {
    if (req.session) db.deleteSession(req.session.id);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.status(204).send();
  });

  /** Desconecta GitHub: borra el token guardado (la identidad queda para poder volver a entrar). */
  app.delete("/api/auth/github", async (req, reply) => {
    if (!req.user) return reply.status(401).send({ error: "Inicia sesión primero" });
    db.clearIdentityToken(req.user.id, "github");
    return reply.status(204).send();
  });

  app.get<{ Querystring: { page?: number } }>(
    "/api/github/repos",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { page: { type: "integer", minimum: 1, maximum: 50, default: 1 } },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) return reply.status(401).send({ error: "Inicia sesión primero" });
      const token = githubTokenOf(ctx, req.user);
      if (!token)
        return reply.status(409).send({ error: "Conecta tu cuenta de GitHub para ver tus repositorios" });
      try {
        return await listGithubRepos(token, req.query.page ?? 1, ctx.fetchImpl);
      } catch (e) {
        req.log.warn(e, "GitHub repos");
        return reply
          .status(502)
          .send({ error: "GitHub no respondió o el token fue revocado. Vuelve a conectar tu cuenta." });
      }
    },
  );
}
