import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Authenticated encryption (AES-256-GCM) for per-site provider secrets
 * (Part A SS11, Part B SS20/SS25). The root key lives outside the
 * database, in `INTEGRATION_ENCRYPTION_KEY`. The AAD (additional
 * authenticated data) binds the site/provider identity into the
 * ciphertext itself, so a row copied onto a different site (or a
 * different provider's column) fails to decrypt rather than silently
 * decrypting into the wrong context.
 */

function loadKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new Error("Missing required environment variable: INTEGRATION_ENCRYPTION_KEY");

  // Accept either `openssl rand -base64 32` or `openssl rand -hex 32`
  // output — both have shown up in this project's env files. Whichever
  // decodes to exactly 32 bytes wins; anything else is a config error,
  // not something to silently coerce (a wrong-length key must never
  // quietly become "some other 32 bytes").
  const asBase64 = Buffer.from(raw, "base64");
  if (asBase64.length === 32) return asBase64;

  const asHex = /^[0-9a-fA-F]+$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.alloc(0);
  if (asHex.length === 32) return asHex;

  throw new Error(
    "INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or hex). " +
      `Got ${asBase64.length} bytes as base64 / ${asHex.length} bytes as hex. ` +
      "Regenerate with: openssl rand -base64 32",
  );
}

export type EncryptedSecret = {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
};

export function encryptSecret(plaintext: string, aad: string): EncryptedSecret {
  const key = loadKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, nonce, tag };
}

export function decryptSecret(encrypted: EncryptedSecret, aad: string): string {
  const key = loadKey();
  const decipher = createDecipheriv("aes-256-gcm", key, encrypted.nonce);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(encrypted.tag);
  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]).toString("utf8");
}

/** e.g. "sk_d05f...babe5c" -> "sk_d05***abe5c" — never log/display the full value. */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 8) return "***";
  return `${plaintext.slice(0, 6)}***${plaintext.slice(-4)}`;
}

/**
 * Postgres `bytea` columns round-trip through PostgREST as hex text
 * prefixed with `\x` (Postgres's "hex format" for bytea_in/bytea_out) —
 * NOT a plain hex string. Sending a plain hex string gets interpreted as
 * literal escape-format bytea (i.e. the hex *characters* themselves get
 * UTF-8 encoded, silently corrupting the value); verified directly
 * against the hosted project before relying on this anywhere.
 */
export function bufferToPgBytea(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}

export function pgByteaToBuffer(pgHex: string): Buffer {
  return Buffer.from(pgHex.replace(/^\\x/, ""), "hex");
}
