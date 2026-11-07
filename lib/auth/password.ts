import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Format: scrypt:<saltHex>:<hashHex> (no "$" so .env files don't expand it). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, saltHex, hashHex] = stored.split(":");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Checks against OWNER_PASSWORD_HASH if set, otherwise a plain OWNER_PASSWORD setting. */
export async function verifyOwnerPassword(password: string) {
  const hash = process.env.OWNER_PASSWORD_HASH;
  if (hash) return verifyPassword(password, hash);
  const plain = process.env.OWNER_PASSWORD;
  if (!plain) return false;
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(plain).digest();
  return timingSafeEqual(a, b);
}
