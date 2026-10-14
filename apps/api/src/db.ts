import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Cache, ScanReport } from "@depscan/core";

export interface ScanListItem {
  id: string;
  createdAt: string;
  targetName: string;
  source: string;
  commit: string | null;
  risk: string;
  private: boolean;
  summary: ScanReport["summary"];
}

export interface StoredScan {
  report: ScanReport & { id: string };
  owner: string | null;
  private: boolean;
}

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export type Provider = "google" | "github";

export interface Identity {
  provider: Provider;
  providerUserId: string;
  userId: string;
  login: string | null;
  email: string | null;
  /** Token cifrado (solo GitHub, para leer repos). */
  accessTokenEnc: string | null;
  scopes: string | null;
}

export interface Session {
  id: string;
  userId: string | null;
  expiresAt: number;
  data: Record<string, unknown>;
}

/**
 * Migraciones versionadas con PRAGMA user_version: cada entrada se aplica una sola vez, en orden.
 * No se edita una migración ya publicada; se agrega una nueva.
 */
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS scans (
       id TEXT PRIMARY KEY,
       created_at TEXT NOT NULL,
       target_name TEXT NOT NULL,
       source TEXT NOT NULL,
       commit_sha TEXT,
       risk TEXT NOT NULL,
       summary_json TEXT NOT NULL,
       report_json TEXT NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS scans_created_at ON scans(created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS cache (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       expires_at INTEGER NOT NULL
     )`,
  ],
  [
    `CREATE TABLE users (
       id TEXT PRIMARY KEY,
       email TEXT,
       name TEXT,
       avatar_url TEXT,
       created_at TEXT NOT NULL
     )`,
    `CREATE TABLE identities (
       provider TEXT NOT NULL,
       provider_user_id TEXT NOT NULL,
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       login TEXT,
       email TEXT,
       access_token_enc TEXT,
       scopes TEXT,
       updated_at TEXT NOT NULL,
       PRIMARY KEY (provider, provider_user_id)
     )`,
    `CREATE INDEX identities_user ON identities(user_id)`,
    `CREATE TABLE sessions (
       id TEXT PRIMARY KEY,
       user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
       created_at INTEGER NOT NULL,
       expires_at INTEGER NOT NULL,
       data TEXT NOT NULL DEFAULT '{}'
     )`,
    // owner: "user:<id>" o "anon:<sesión>". private: escaneo de un repo privado (solo lo ve su dueño).
    `ALTER TABLE scans ADD COLUMN owner TEXT`,
    `ALTER TABLE scans ADD COLUMN private INTEGER NOT NULL DEFAULT 0`,
    `CREATE INDEX scans_owner ON scans(owner, created_at DESC)`,
  ],
];

type Row = Record<string, string | number | null>;

/** Persistencia con SQLite nativo de Node (sin servidor de base de datos). */
export class Database {
  private readonly db: DatabaseSync;

  constructor(dataDir: string) {
    if (dataDir === ":memory:") {
      this.db = new DatabaseSync(":memory:");
    } else {
      mkdirSync(dataDir, { recursive: true });
      this.db = new DatabaseSync(join(dataDir, "depscan.db"));
      this.db.exec("PRAGMA journal_mode = WAL");
    }
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    const current = (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    for (let v = current; v < MIGRATIONS.length; v++) {
      this.db.exec("BEGIN");
      try {
        for (const sql of MIGRATIONS[v]!) this.db.exec(sql);
        this.db.exec(`PRAGMA user_version = ${v + 1}`);
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    }
  }

  // ---------- Escaneos ----------

  saveScan(report: ScanReport & { id: string }, owner: string, isPrivate: boolean): void {
    this.db
      .prepare(
        `INSERT INTO scans (id, created_at, target_name, source, commit_sha, risk, summary_json, report_json, owner, private)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        report.id,
        report.scannedAt,
        report.target.name,
        report.target.source,
        report.target.commit ?? null,
        report.summary.risk,
        JSON.stringify(report.summary),
        JSON.stringify(report),
        owner,
        isPrivate ? 1 : 0,
      );
  }

  listScans(owner: string, limit: number, offset: number): { items: ScanListItem[]; total: number } {
    const rows = this.db
      .prepare(
        `SELECT id, created_at, target_name, source, commit_sha, risk, private, summary_json
         FROM scans WHERE owner = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(owner, limit, offset) as Row[];
    const total = (
      this.db.prepare("SELECT COUNT(*) AS n FROM scans WHERE owner = ?").get(owner) as { n: number }
    ).n;
    return {
      total,
      items: rows.map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at),
        targetName: String(r.target_name),
        source: String(r.source),
        commit: r.commit_sha === null ? null : String(r.commit_sha),
        risk: String(r.risk),
        private: r.private === 1,
        summary: JSON.parse(String(r.summary_json)) as ScanReport["summary"],
      })),
    };
  }

  getScan(id: string): StoredScan | null {
    const row = this.db.prepare("SELECT report_json, owner, private FROM scans WHERE id = ?").get(id) as
      Row | undefined;
    if (!row) return null;
    return {
      report: JSON.parse(String(row.report_json)) as ScanReport & { id: string },
      owner: row.owner === null ? null : String(row.owner),
      private: row.private === 1,
    };
  }

  deleteScan(id: string, owner: string): boolean {
    return Number(this.db.prepare("DELETE FROM scans WHERE id = ? AND owner = ?").run(id, owner).changes) > 0;
  }

  /** Al iniciar sesión, los escaneos anónimos de esa sesión pasan a la cuenta. */
  transferScans(fromOwner: string, toOwner: string): number {
    return Number(
      this.db.prepare("UPDATE scans SET owner = ? WHERE owner = ?").run(toOwner, fromOwner).changes,
    );
  }

  // ---------- Usuarios e identidades ----------

  getUser(id: string): User | null {
    const r = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
    return r
      ? {
          id: String(r.id),
          email: (r.email as string | null) ?? null,
          name: (r.name as string | null) ?? null,
          avatarUrl: (r.avatar_url as string | null) ?? null,
          createdAt: String(r.created_at),
        }
      : null;
  }

  findUserByEmail(email: string): User | null {
    const r = this.db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(email) as
      Row | undefined;
    return r ? this.getUser(String(r.id)) : null;
  }

  createUser(data: { email: string | null; name: string | null; avatarUrl: string | null }): User {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO users (id, email, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, data.email, data.name, data.avatarUrl, new Date().toISOString());
    return this.getUser(id)!;
  }

  /** Completa nombre, email o avatar que falten (no pisa datos existentes). */
  fillUserProfile(
    id: string,
    data: { email: string | null; name: string | null; avatarUrl: string | null },
  ): void {
    this.db
      .prepare(
        `UPDATE users SET email = COALESCE(email, ?), name = COALESCE(name, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?`,
      )
      .run(data.email, data.name, data.avatarUrl, id);
  }

  getIdentity(provider: Provider, providerUserId: string): Identity | null {
    const r = this.db
      .prepare("SELECT * FROM identities WHERE provider = ? AND provider_user_id = ?")
      .get(provider, providerUserId) as Row | undefined;
    return r ? this.toIdentity(r) : null;
  }

  identitiesOf(userId: string): Identity[] {
    return (this.db.prepare("SELECT * FROM identities WHERE user_id = ?").all(userId) as Row[]).map((r) =>
      this.toIdentity(r),
    );
  }

  upsertIdentity(i: Identity): void {
    this.db
      .prepare(
        `INSERT INTO identities (provider, provider_user_id, user_id, login, email, access_token_enc, scopes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, provider_user_id) DO UPDATE SET
           user_id = excluded.user_id, login = excluded.login, email = excluded.email,
           access_token_enc = excluded.access_token_enc, scopes = excluded.scopes, updated_at = excluded.updated_at`,
      )
      .run(
        i.provider,
        i.providerUserId,
        i.userId,
        i.login,
        i.email,
        i.accessTokenEnc,
        i.scopes,
        new Date().toISOString(),
      );
  }

  clearIdentityToken(userId: string, provider: Provider): void {
    this.db
      .prepare(
        "UPDATE identities SET access_token_enc = NULL, scopes = NULL WHERE user_id = ? AND provider = ?",
      )
      .run(userId, provider);
  }

  private toIdentity(r: Row): Identity {
    return {
      provider: r.provider as Provider,
      providerUserId: String(r.provider_user_id),
      userId: String(r.user_id),
      login: (r.login as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      accessTokenEnc: (r.access_token_enc as string | null) ?? null,
      scopes: (r.scopes as string | null) ?? null,
    };
  }

  // ---------- Sesiones ----------

  createSession(
    id: string,
    userId: string | null,
    ttlMs: number,
    data: Record<string, unknown> = {},
  ): Session {
    const now = Date.now();
    this.db
      .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, data) VALUES (?, ?, ?, ?, ?)")
      .run(id, userId, now, now + ttlMs, JSON.stringify(data));
    return { id, userId, expiresAt: now + ttlMs, data };
  }

  getSession(id: string): Session | null {
    const r = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Row | undefined;
    if (!r || Number(r.expires_at) < Date.now()) return null;
    return {
      id: String(r.id),
      userId: (r.user_id as string | null) ?? null,
      expiresAt: Number(r.expires_at),
      data: JSON.parse(String(r.data)) as Record<string, unknown>,
    };
  }

  updateSessionData(id: string, data: Record<string, unknown>): void {
    this.db.prepare("UPDATE sessions SET data = ? WHERE id = ?").run(JSON.stringify(data), id);
  }

  deleteSession(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }

  // ---------- Mantenimiento ----------

  ping(): boolean {
    return (this.db.prepare("SELECT 1 AS ok").get() as { ok: number }).ok === 1;
  }

  /** Caché persistente para OSV/NVD/registros (sobrevive reinicios del contenedor). */
  cache(): Cache {
    const get = this.db.prepare("SELECT value, expires_at FROM cache WHERE key = ?");
    const set = this.db.prepare(
      "INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
    );
    return {
      get: async (key) => {
        const row = get.get(key) as { value: string; expires_at: number } | undefined;
        return row && row.expires_at > Date.now() ? row.value : undefined;
      },
      set: async (key, value, ttlSeconds) => {
        set.run(key, value, Date.now() + ttlSeconds * 1000);
      },
    };
  }

  purgeExpired(): void {
    const now = Date.now();
    this.db.prepare("DELETE FROM cache WHERE expires_at < ?").run(now);
    this.db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  }

  close(): void {
    this.db.close();
  }
}
