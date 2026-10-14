import { fileURLToPath } from "node:url";

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface Config {
  port: number;
  host: string;
  /** Carpeta persistente (en Railway: el volumen montado, p. ej. /data). ":memory:" para pruebas. */
  dataDir: string;
  nvdApiKey?: string;
  /** Token de servidor para repos públicos (opcional). Los usuarios conectados usan el suyo. */
  githubToken?: string;
  /** Carpeta con el build de la web; si no existe, solo se sirve la API. */
  webDist: string;
  /** Máximo de escaneos por IP y minuto. */
  scanRateLimit: number;
  logLevel: string;
  /** URL pública (https://depscan.up.railway.app). Si falta, se deduce de la petición. */
  publicUrl?: string;
  /** Secreto para cifrar tokens OAuth guardados. Obligatorio en producción si se usa login. */
  sessionSecret?: string;
  google?: OAuthClient;
  github?: OAuthClient;
}

function oauth(id: string | undefined, secret: string | undefined): OAuthClient | undefined {
  return id && secret ? { clientId: id, clientSecret: secret } : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : undefined;
  return {
    port: Number(env.PORT ?? 3000),
    // Railway enruta por IPv4/IPv6; "::" escucha en ambas.
    host: env.HOST ?? "::",
    dataDir: env.DATA_DIR ?? env.RAILWAY_VOLUME_MOUNT_PATH ?? "./data",
    nvdApiKey: env.NVD_API_KEY || undefined,
    githubToken: env.GITHUB_TOKEN || undefined,
    webDist: env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url)),
    scanRateLimit: Number(env.SCAN_RATE_LIMIT ?? 20),
    logLevel: env.LOG_LEVEL ?? "info",
    publicUrl: (env.PUBLIC_URL || railwayDomain)?.replace(/\/$/, ""),
    sessionSecret: env.SESSION_SECRET || undefined,
    google: oauth(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
    github: oauth(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
  };
}
