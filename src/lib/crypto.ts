import crypto from "crypto";

/**
 * Symmetric encryption for provider tokens stored in the database (Google Drive
 * refresh tokens, storage secret keys). AES-256-GCM, key derived from
 * AUTH_SECRET. Rotating AUTH_SECRET requires reconnecting the providers.
 */
const PREFIX = "v1";

function key() {
  const source = process.env.AUTH_SECRET || "picdeck-dev-secret-change-me";
  return crypto.createHash("sha256").update(`picdeck-token:${source}`).digest();
}

export function encryptSecret(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(
    ".",
  );
}

export function decryptSecret(stored: string): string | null {
  try {
    const [prefix, iv, tag, ciphertext] = stored.split(".");
    if (prefix !== PREFIX || !iv || !tag || !ciphertext) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Short masked preview so the UI never renders a full token. */
export function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  return value.length <= 6 ? "••••" : `${value.slice(0, 3)}••••${value.slice(-3)}`;
}