import { PrismaClient } from "@prisma/client";

/**
 * Hosted Postgres (e.g. Neon) is reached through a connection pooler in serverless
 * functions. Tell Prisma about the pooler and allow time for a sleeping database to wake.
 */
export function databaseUrl(raw = process.env.DATABASE_URL) {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname.includes("-pooler.") && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
    return u.toString();
  } catch {
    return raw;
  }
}

// Accept the names other database integrations use (e.g. a Neon prefix left as "STORAGE").
process.env.DATABASE_URL ||= process.env.STORAGE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
// The schema's directUrl (used only by migrations) must resolve; default it to the main URL.
process.env.DATABASE_URL_UNPOOLED ||= process.env.STORAGE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const currentUser = () => process.env.APP_USER ?? "Owner";

/** Interactive-transaction limits sized for a remote database. */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;
