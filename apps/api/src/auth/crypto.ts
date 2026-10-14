import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Token aleatorio apto para cookies y parámetros OAuth (base64url). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

/** PKCE (RFC 7636): code_challenge = BASE64URL(SHA256(code_verifier)). */
export function pkceChallenge(verifier: string): string {
  return sha256(verifier);
}

/**
 * Cifrado AES-256-GCM para guardar tokens OAuth en la base.
 * La clave se deriva de SESSION_SECRET; si el secreto cambia, los tokens guardados dejan de servir
 * y el usuario solo tiene que volver a conectar su cuenta.
 */
export class TokenCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash("sha256").update(`depscan:tokens:${secret}`).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      data.toString("base64url"),
    ].join(".");
  }

  decrypt(payload: string): string | null {
    const [version, iv, tag, data] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !data) return null;
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString(
        "utf8",
      );
    } catch {
      return null;
    }
  }
}
