/**
 * Signed session cookie using Web Crypto (HMAC-SHA256), so it works in both
 * the Edge middleware and Node route handlers. Token: base64url(payload).base64url(sig)
 */
export const SESSION_COOKIE = "gv_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export type Session = { sub: string; exp: number };

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The owner password is configured either as a hash (npm run auth:setup) or as plain text (hosting dashboards). */
export function passwordConfigured() {
  return Boolean(process.env.OWNER_PASSWORD_HASH || process.env.OWNER_PASSWORD);
}

/**
 * Key that signs session cookies. Uses AUTH_SECRET when set; otherwise derives one
 * from the (secret) database URL and the configured password, so a hosted deploy
 * needs no extra setting — and changing the password signs every device out.
 */
export async function authSecret(): Promise<string | null> {
  const explicit = process.env.AUTH_SECRET;
  if (explicit && explicit.length >= 32) return explicit;
  const pw = process.env.OWNER_PASSWORD_HASH || process.env.OWNER_PASSWORD;
  const db = process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (!pw || !db) return null;
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`game-vault-session|${db}|${pw}`));
  return b64url(new Uint8Array(digest));
}

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(sub: string, secret: string, ttl = SESSION_TTL_SECONDS) {
  const payload: Session = { sub, exp: Math.floor(Date.now() / 1000) + ttl };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
    if (typeof s.exp !== "number" || s.exp < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}
