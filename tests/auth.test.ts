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
