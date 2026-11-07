# Game Vault

Accounting, inventory and repair management for a Nintendo Switch and iPhone resale and repair
business. Built with **Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Prisma and
PostgreSQL**.

- Double-entry general ledger. Every dashboard number is derived from balanced journal entries.
- Serialised device inventory (buy → repair → resell) and parts stock at weighted-average cost
- Repair queue (Kanban), job costing, deposits and automatic invoicing on completion
- Dashboards: revenue vs expenses, profit trend + forecast, cash flow, revenue, expense and profit pies, "what eats our money"
- Daily, weekly, monthly, quarterly and annual reports with **PDF, Excel and CSV** export
- Audit trail, reversal-based voids, dark mode, responsive down to phone width

**Use it online on your phone, iPad and laptop for free: follow [docs/DEPLOY.md](docs/DEPLOY.md)**
(Vercel + Neon, about 15 minutes, no coding tools needed). It installs to your home screen like an app.

See **[docs/SYSTEM_SPEC.md](docs/SYSTEM_SPEC.md)** for the full specification: layout, schema,
posting rules, every formula, architecture and the roadmap.

## Quick start (on your own computer)

```bash
# 1. Postgres (or use any existing instance)
docker compose up -d db

# 2. Install & configure
npm install
cp .env.example .env          # edit DATABASE_URL if needed

# 3. Create tables + load 12 months of demo data
npx prisma migrate deploy
npm run db:seed

# 4. Choose your owner password (writes OWNER_PASSWORD_HASH + AUTH_SECRET to .env)
npm run auth:setup

# 5. Run
npm run dev                   # http://localhost:3000 → sign in with your password
```

## Sign-in

The app is locked behind a single owner password. Every page, API route and export needs a
valid session; signed-out visitors are sent to `/login`.

- Set the password either as `OWNER_PASSWORD` (simplest; this is what the online guide uses, and the
  value stays in your host's encrypted settings) or as a salted **scrypt** hash in `OWNER_PASSWORD_HASH`
  via `npm run auth:setup`. Session cookies are signed with `AUTH_SECRET`, or, if that isn't set, with a
  key derived from the secret database URL and the password. Changing the password therefore signs out every device.
- Sessions are **HMAC-signed, HttpOnly, SameSite=Lax** cookies that last 14 days. They're `Secure` (HTTPS-only) in production.
- After **5 wrong passwords**, sign-in from that IP is blocked for 15 minutes. Attempts are counted in the database, so the limit holds across serverless instances. Successful and failed sign-ins are recorded in the audit trail.
- Writes from other websites are rejected (Origin check).
- **Change the password:** run `npm run auth:setup` again and restart. Add `--rotate` to also sign out every device: `npm run auth:setup -- "new password" --rotate`.
- If you serve the production build over plain HTTP on a private network, set `AUTH_INSECURE_COOKIE="true"`. Otherwise the browser won't keep the session cookie.

**Starting your real books:** run `SEED_DEMO=false npm run db:seed` to load only the chart of
accounts. Then record an *Owner contribution* for your opening cash, and a *Device purchase*
for each unit already on the shelf.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit tests: accounting formulas, ledger rules, dates, password hashing, sessions |
| `npm run test:e2e` | Browser click-through of every page and form (see below) |
| `npm run auth:setup` | Set or change the owner password |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run db:migrate` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Chart of accounts + demo data (`SEED_DEMO=false` for accounts only) |
| `npm run vercel-build` | What Vercel runs: migrate, load the chart of accounts, build |

## Browser click-through test

`tests/e2e/ui-smoke.mjs` drives a real Chromium through 33 checks. It covers sign-in, every page, every
transaction form, refurbish/sell/refund from inventory, the full repair lifecycle, voiding,
all report periods and exports, dark mode, the phone menu, sign-out and console errors. It
also confirms the ledger still balances afterwards.

```bash
npx playwright install chromium          # first time only
npm run build && npm start               # in one terminal
E2E_PASSWORD="your-password" npm run test:e2e
```

**It posts real "E2E …" transactions, so run it against demo data, never your real books.**

## Project layout

```
app/                    pages (server components) and app/api/* route handlers
components/ui           shadcn-style primitives (button, card, dialog, tabs, table…)
components/charts       Recharts wrappers using the validated light/dark palette
components/forms        transaction, repair and void forms (client)
lib/accounting          chart of accounts, posting engine, ledger rules, formulas
lib/queries.ts          read models for pages
lib/reports.ts          P&L / balance sheet / cash report builder
lib/export.ts           CSV, Excel (ExcelJS) and PDF (jsPDF) exporters
prisma/                 schema, migrations, seed
tests/                  node:test unit tests
```

## Day-to-day use

| You want to… | Do this |
|---|---|
| Log a console you bought | **New transaction → Device purchase** (choose *Broken* if it needs repair) |
| Fix one of your own broken units | Inventory → **Refurbish** (parts + labor are added to the unit's cost) |
| Sell a unit | Inventory → **Sell** (COGS is posted automatically) |
| Check in a customer repair | Repairs → **New repair job** (an optional deposit is held as a liability) |
| Finish a repair | On the job page, add parts and move it to **Completed**. It is invoiced automatically. |
| Record gas, food, rent… | **Add expense** and pick the category |
| Pay your technician | **New transaction → Technician payout** |
| Fix a mistake | Transactions → **Void** (posts a reversal and keeps history) |
| Send numbers to your accountant | Reports → pick a period → **PDF / Excel / CSV** |
