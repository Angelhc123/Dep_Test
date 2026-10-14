import type { OAuthClient } from "../config.js";
import type { Provider } from "../db.js";

export interface OAuthProfile {
  providerUserId: string;
  email: string | null;
  /** El proveedor confirma que el email es del usuario (necesario para vincular cuentas por email). */
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  login: string | null;
}

export interface TokenResult {
  accessToken: string;
  scopes: string | null;
}

interface ProviderSpec {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  /** Google acepta PKCE; GitHub se protege con state + secreto de cliente. */
  pkce: boolean;
}

/**
 * Scopes:
 * - Google: solo identidad (openid email profile).
 * - GitHub: read:user y user:email para el perfil; repo para leer repos privados
 *   (GitHub OAuth no ofrece un scope de solo lectura de código privado).
 */
export const PROVIDERS: Record<Provider, ProviderSpec> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "openid email profile",
    pkce: true,
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: "read:user user:email repo",
    pkce: false,
  },
};

export function authorizeUrl(
  provider: Provider,
  client: OAuthClient,
  p: { redirectUri: string; state: string; codeChallenge?: string },
): string {
  const spec = PROVIDERS[provider];
  const q = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: spec.scopes,
    state: p.state,
  });
  if (spec.pkce && p.codeChallenge) {
    q.set("code_challenge", p.codeChallenge);
    q.set("code_challenge_method", "S256");
  }
  if (provider === "google") q.set("prompt", "select_account");
  if (provider === "github") q.set("allow_signup", "true");
  return `${spec.authorizeUrl}?${q.toString()}`;
}

async function json<T>(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<T> {
  const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; error_description?: string };
  if (!res.ok || body.error) {
    throw new Error(`OAuth: ${body.error_description ?? body.error ?? `HTTP ${res.status}`}`);
  }
  return body;
}

export async function exchangeCode(
  provider: Provider,
  client: OAuthClient,
  p: { code: string; redirectUri: string; codeVerifier?: string },
  fetchImpl: typeof fetch,
): Promise<TokenResult> {
  const body = new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    code: p.code,
    redirect_uri: p.redirectUri,
    grant_type: "authorization_code",
  });
  if (PROVIDERS[provider].pkce && p.codeVerifier) body.set("code_verifier", p.codeVerifier);
  const res = await json<{ access_token?: string; scope?: string }>(fetchImpl, PROVIDERS[provider].tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.access_token) throw new Error("OAuth: el proveedor no devolvió un token");
  return { accessToken: res.access_token, scopes: res.scope ?? null };
}

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "depscan",
});

export async function fetchProfile(
  provider: Provider,
  token: string,
  fetchImpl: typeof fetch,
): Promise<OAuthProfile> {
  if (provider === "google") {
    const u = await json<{
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    }>(fetchImpl, "https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      providerUserId: u.sub,
      email: u.email ?? null,
      emailVerified: u.email_verified === true,
      name: u.name ?? null,
      avatarUrl: u.picture ?? null,
      login: null,
    };
  }
  const u = await json<{
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string;
    email?: string | null;
  }>(fetchImpl, "https://api.github.com/user", { headers: GH_HEADERS(token) });
  // El email público puede faltar: se busca el primario verificado.
  let email: string | null = null;
  let verified = false;
  try {
    const emails = await json<{ email: string; primary: boolean; verified: boolean }[]>(
      fetchImpl,
      "https://api.github.com/user/emails",
      { headers: GH_HEADERS(token) },
    );
    const primary = emails.find((e) => e.primary && e.verified);
    if (primary) {
      email = primary.email;
      verified = true;
    }
  } catch {
    email = u.email ?? null;
  }
  return {
    providerUserId: String(u.id),
    email,
    emailVerified: verified,
    name: u.name ?? u.login,
    avatarUrl: u.avatar_url ?? null,
    login: u.login,
  };
}

export interface GithubRepo {
  fullName: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
  htmlUrl: string;
}

/** Repos a los que el usuario tiene acceso (propios, de colaborador y de organizaciones). */
export async function listGithubRepos(
  token: string,
  page: number,
  fetchImpl: typeof fetch,
): Promise<{ repos: GithubRepo[]; hasMore: boolean }> {
  const perPage = 100;
  const url = `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`;
  const raw = await json<
    {
      full_name: string;
      private: boolean;
      description: string | null;
      default_branch: string;
      language: string | null;
      pushed_at: string | null;
      updated_at: string;
      html_url: string;
      archived?: boolean;
    }[]
  >(fetchImpl, url, { headers: GH_HEADERS(token) });
  return {
    hasMore: raw.length === perPage,
    repos: raw.map((r) => ({
      fullName: r.full_name,
      private: r.private,
      description: r.description,
      defaultBranch: r.default_branch,
      language: r.language,
      updatedAt: r.pushed_at ?? r.updated_at,
      htmlUrl: r.html_url,
    })),
  };
}
