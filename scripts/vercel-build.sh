#!/usr/bin/env bash
# Build used by Vercel (package.json "vercel-build"): migrate, load the chart of accounts, build.
set -euo pipefail
# Accept the names other database integrations use (e.g. a Neon prefix left as "STORAGE").
export DATABASE_URL="${DATABASE_URL:-${STORAGE_URL:-${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-}}}}"
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-${STORAGE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-}}}"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Connect a database (Vercel → Storage → Neon) and redeploy." >&2
  exit 1
fi
# Migrations need a direct (unpooled) connection; fall back to DATABASE_URL if the host didn't provide one.
[ -n "$DATABASE_URL_UNPOOLED" ] || export DATABASE_URL_UNPOOLED="$DATABASE_URL"
npx prisma generate
npx prisma migrate deploy
SEED_DEMO=false npx tsx prisma/seed.ts
npx next build
