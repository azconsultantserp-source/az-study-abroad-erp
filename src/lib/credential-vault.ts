import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";
const SALT = "az-erp-credential-vault";

function vaultKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is required for credential encryption");
    }
    return scryptSync("dev-only-insecure-key", SALT, 32);
  }
  return scryptSync(secret, SALT, 32);
}

/** Encrypt a password before persisting in `User.plainPassword`. */
export function sealCredential(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, vaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

/**
 * Decrypt a stored credential for admin display.
 * Legacy rows stored as raw plaintext are returned as-is until the next password change.
 */
export function revealCredential(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored;

  const payload = stored.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return null;

  const decipher = createDecipheriv(ALGO, vaultKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
