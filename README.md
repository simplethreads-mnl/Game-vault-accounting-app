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

See **[docs/SYSTEM_SPEC.md](docs/SYSTEM_SPEC.md)** for the full specification: layout, schema,
posting rules, every formula, architecture and the roadmap.

## Quick start

```bash
# 1. Postgres (or use any existing instance)
docker compose up -d db

# 2. Install & configure
npm install
cp .env.example .env          # edit DATABASE_URL if needed

# 3. Create tables + load 12 months of demo data
npx prisma migrate deploy
npm run db:seed

# 4. Run
npm run dev                   # http://localhost:3000
```

**Starting your real books:** run `SEED_DEMO=false npm run db:seed` to load only the chart of
accounts. Then record an *Owner contribution* for your opening cash, and a *Device purchase*
for each unit already on the shelf.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit tests for the accounting formulas and ledger rules |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run db:migrate` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Chart of accounts + demo data |

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
