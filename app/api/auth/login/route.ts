import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyOwnerPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, authSecret, passwordConfigured, signSession } from "@/lib/auth/session";

export const runtime = "nodejs";

// Brute-force guard: 5 failures per IP per 15 minutes. Counted from the audit log so it
// holds across serverless instances.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: NextRequest) {
  const secret = await authSecret();
  if (!secret || !passwordConfigured()) {
    return NextResponse.json({ error: "Login is not set up. Add an OWNER_PASSWORD setting on your host (or run npm run auth:setup), then redeploy." }, { status: 503 });
  }

  const ip = clientIp(req);
  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await prisma.auditLog.findMany({
    where: { entity: "Session", entityId: ip, action: "LOGIN_FAILED", createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (recent.length >= MAX_FAILURES) {
    const wait = Math.ceil((WINDOW_MS - (Date.now() - recent[0].createdAt.getTime())) / 60000);
    return NextResponse.json({ error: `Too many attempts. Try again in ${wait} min.` }, { status: 429 });
  }

  const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => ({})));
  const ok = parsed.success && (await verifyOwnerPassword(parsed.data.password));
  const user = process.env.APP_USER ?? "Owner";

  if (!ok) {
    await prisma.auditLog.create({ data: { entity: "Session", entityId: ip, action: "LOGIN_FAILED", summary: `Failed sign-in from ${ip}`, actor: "anonymous" } });
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  await prisma.auditLog.create({ data: { entity: "Session", entityId: ip, action: "LOGIN", summary: `${user} signed in from ${ip}`, actor: user } });
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
