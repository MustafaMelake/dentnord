import { createHmac, randomInt } from "node:crypto";

// TOTP codes for E2E logins (RFC 6238: HMAC-SHA1, 30 s, 6 digits), the same as Better Auth's
// twoFactor plugin. Its key is the UTF-8 bytes of the stored secret; the otpauth:// URI (and the
// setup page's manual key) carries those bytes in base32.

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A secret shaped like Better Auth's (32 random alphanumerics). */
export function randomSecret(length = 32) {
  return Array.from({ length }, () => ALPHANUMERIC[randomInt(ALPHANUMERIC.length)]).join("");
}

export function totp(key: Buffer | string, at = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const hmac = createHmac("sha1", typeof key === "string" ? Buffer.from(key, "utf8") : key)
    .update(counter)
    .digest();
  const offset = hmac[hmac.length - 1] & 15;
  const value = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

/** "MFRG GZDF …" (the setup page's manual key) → key bytes. */
export function base32Decode(text: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = text.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error(`not base32: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// Accounts created with 2FA on (admins, see db.ts): login() answers the code step for them.
const secrets = new Map<string, string>();

export const rememberTotp = (email: string, secret: string) => secrets.set(email, secret);
export const totpSecretFor = (email: string) => secrets.get(email);
