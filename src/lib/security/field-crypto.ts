import crypto from "crypto";

/**
 * AES-256-GCM helpers for sensitive columns (e.g. agent bank account numbers).
 * The key is derived from FIELD_ENCRYPTION_KEY, falling back to AUTH_SECRET so
 * it works without extra setup. Output format: iv.tag.ciphertext (base64url).
 */
function getKey(): Buffer {
  const secret = process.env.FIELD_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("FIELD_ENCRYPTION_KEY or AUTH_SECRET must be set to store sensitive fields");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptField(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptField(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function maskAccountNumber(last4: string | null | undefined): string | null {
  return last4 ? `••••${last4}` : null;
}
