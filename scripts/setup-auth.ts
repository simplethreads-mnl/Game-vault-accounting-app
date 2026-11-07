/**
 * Sets (or changes) the owner password and session secret in .env.
 *   npm run auth:setup              → prompts for the password
 *   npm run auth:setup -- "pass"    → non-interactive
 * Changing the secret signs everyone out.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { hashPassword } from "../lib/auth/password";

async function ask(q: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => rl.question(q, (a) => { rl.close(); resolve(a); }));
}

function upsert(env: string, key: string, value: string) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`;
}

async function main() {
  const password = process.argv[2] ?? (await ask("Choose an owner password (min 10 characters): "));
  if (password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }
  const file = process.env.ENV_FILE ?? ".env";
  let env = existsSync(file) ? readFileSync(file, "utf8") : "";
  env = upsert(env, "OWNER_PASSWORD_HASH", await hashPassword(password));
  if (!/^AUTH_SECRET=.{34,}$/m.test(env) || process.argv.includes("--rotate")) env = upsert(env, "AUTH_SECRET", randomBytes(32).toString("base64url"));
  writeFileSync(file, env);
  console.log(`Saved to ${file}. Restart the app, then sign in with your password.`);
}

main();
