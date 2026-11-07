import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { signSession, verifySession } from "../lib/auth/session";

const SECRET = "x".repeat(40);

test("password hash verifies only the right password", async () => {
  const h = await hashPassword("correct horse battery");
  assert.match(h, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("correct horse battery", h), true);
  assert.equal(await verifyPassword("correct horse batterY", h), false);
  assert.equal(await verifyPassword("anything", "garbage"), false);
  assert.notEqual(await hashPassword("same"), await hashPassword("same")); // salted
});

test("session tokens verify, expire and resist tampering", async () => {
  const t = await signSession("Owner", SECRET);
  assert.equal((await verifySession(t, SECRET))?.sub, "Owner");
  assert.equal(await verifySession(t, "y".repeat(40)), null); // wrong secret
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "Owner", exp: 9999999999 })).toString("base64url");
  assert.equal(await verifySession(`${forged}.${sig}`, SECRET), null); // body swapped
  assert.equal(await verifySession(`${body}.`, SECRET), null);
  assert.equal(await verifySession(undefined, SECRET), null);
  assert.equal(await verifySession("not-a-token", SECRET), null);
  const expired = await signSession("Owner", SECRET, -10);
  assert.equal(await verifySession(expired, SECRET), null);
});

test("plain OWNER_PASSWORD works and the derived session key follows it", async () => {
  const { verifyOwnerPassword } = await import("../lib/auth/password");
  const { authSecret } = await import("../lib/auth/session");
  const saved = { ...process.env };
  try {
    delete process.env.OWNER_PASSWORD_HASH;
    delete process.env.AUTH_SECRET;
    process.env.DATABASE_URL = "postgres://u:p@host/db";
    process.env.OWNER_PASSWORD = "my shop password";
    assert.equal(await verifyOwnerPassword("my shop password"), true);
    assert.equal(await verifyOwnerPassword("my shop passworD"), false);
    const k1 = await authSecret();
    assert.ok(k1 && k1.length >= 32);
    process.env.OWNER_PASSWORD = "changed password";
    assert.notEqual(await authSecret(), k1); // changing the password signs everyone out
    delete process.env.OWNER_PASSWORD;
    assert.equal(await verifyOwnerPassword("anything"), false);
    assert.equal(await authSecret(), null);
  } finally {
    process.env = saved;
  }
});
