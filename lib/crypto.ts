// AES-256-GCM encryption for Plaid access tokens at rest.
// Stored format: "<iv>:<authTag>:<ciphertext>" (all base64).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function key(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex) throw new Error("APP_ENCRYPTION_KEY is not set");
  const k = Buffer.from(hex, "hex");
  if (k.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return k;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed ciphertext");
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
