import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, authSecret, signSession } from "@/lib/auth/session";

export const runtime = "nodejs";

// Simple in-memory brute-force guard: 5 failures per IP per 15 minutes.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: NextRequest) {
  const secret = authSecret();
  const hash = process.env.OWNER_PASSWORD_HASH;
  if (!secret || !hash) {
    return NextResponse.json({ error: "Login is not set up. Run `npm run auth:setup` on the server, then restart." }, { status: 503 });
  }

  const ip = clientIp(req);
  const now = Date.now();
  const recent = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_FAILURES) {
    const wait = Math.ceil((WINDOW_MS - (now - recent[0])) / 60000);
    return NextResponse.json({ error: `Too many attempts. Try again in ${wait} min.` }, { status: 429 });
  }

  const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => ({})));
  const ok = parsed.success && (await verifyPassword(parsed.data.password, hash));
  const user = process.env.APP_USER ?? "Owner";

  if (!ok) {
    recent.push(now);
    failures.set(ip, recent);
    await prisma.auditLog.create({ data: { entity: "Session", entityId: ip, action: "LOGIN_FAILED", summary: `Failed sign-in from ${ip}`, actor: "anonymous" } }).catch(() => {});
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  failures.delete(ip);
  await prisma.auditLog.create({ data: { entity: "Session", entityId: ip, action: "LOGIN", summary: `${user} signed in from ${ip}`, actor: user } }).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(user, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.AUTH_INSECURE_COOKIE !== "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
