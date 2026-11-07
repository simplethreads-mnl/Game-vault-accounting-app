#!/usr/bin/env bash
# Build used by Vercel (package.json "vercel-build"): migrate, load the chart of accounts, build.
set -euo pipefail
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Connect a database (Vercel → Storage → Neon) and redeploy." >&2
  exit 1
fi
# Migrations need a direct (unpooled) connection; fall back to DATABASE_URL if the host didn't provide one.
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
npx prisma generate
npx prisma migrate deploy
SEED_DEMO=false npx tsx prisma/seed.ts
npx next build
