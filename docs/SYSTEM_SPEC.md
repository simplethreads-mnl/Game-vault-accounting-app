# Game Vault: system specification

Accounting, inventory and repair management for a business that:

1. Buys and sells Nintendo Switch consoles
2. Repairs Nintendo Switch consoles for customers
3. Buys broken Switches, repairs them, and resells them
4. Buys and sells iPhones
5. Repairs phones (now and in future)

---

## 1. Reference video analysis

> **No video was attached to the original request**, so it could not be analysed frame by frame.
> The design below follows the conventions of current premium finance dashboards (the
> QuickBooks / Xero / Zoho Books generation, plus SaaS analytics templates). If you share the
> video, compare it against the checklist in §2. Every item there maps to one component, so
> adjusting the look is a contained change.

## 2. Design elements and where they live

| Element | Implementation |
|---|---|
| Fixed left sidebar with grouped nav (Overview / Operations / Accounting), active pill | `components/layout/sidebar.tsx`. A slide-in drawer replaces it on mobile. |
| Sticky translucent top bar with quick-add, notifications badge, theme toggle and avatar | `components/layout/topbar.tsx` |
| Page header with title, subtitle and segmented date-range control (30D/MTD/QTD/YTD/12M) | `components/section.tsx`, `components/range-select.tsx` |
| KPI cards with icon chip, large figure, coloured delta arrow and sparkline | `components/kpi-card.tsx` |
| Rounded-2xl cards, hairline borders, soft shadow, generous spacing | `components/ui/card.tsx` |
| Gradient area charts, rounded bar ends, donuts with centre value and legend | `components/charts/charts.tsx` |
| Hover tooltips on every chart (crosshair on lines, per-bar on bars) | `components/charts/tooltip.tsx` |
| Staggered fade-up entrance animation (respects `prefers-reduced-motion`) | `app/globals.css` (`.stagger`) |
| Light/dark themes, with system preference as the default | `next-themes` plus CSS tokens in `globals.css` |
| Kanban board for the repair queue | `app/repairs/page.tsx` |
| Status badges with a reserved status palette | `components/ui/badge.tsx` |

**Colour system.** Chart colours come from a validated categorical palette with separate
light and dark steps. Hue order is fixed and chosen so neighbouring series stay
distinguishable for colour-blind users. Status colours (good, warning, serious, critical) are
kept separate from series colours and always appear with an icon or label.

## 3. System specification

### Modules

| Module | Route | Purpose |
|---|---|---|
| Dashboard | `/` | KPIs, device pipeline, the 4 main charts, 3 pies, insights, alerts, repair queue, monthly P&L |
| Analytics | `/analytics` | Most profitable product and repair, avg profit per console, repair margin, turnover, forecast, yearly and quarterly summary |
| Inventory | `/inventory` | Serialised devices by stage, parts stock, aging, valuation, sell / refurbish / restock actions |
| Repairs | `/repairs`, `/repairs/[id]` | Kanban queue, job costing, parts issue, status history, auto-invoicing |
| Transactions | `/transactions` | Every business event, with filters, search, pagination and void |
| Expenses | `/expenses` | "What eats our money": % tiles, pie, ranked bar, monthly stacked trend, full category table |
| Reports | `/reports` | Daily, weekly, monthly, quarterly and annual P&L, balance sheet, cash summary, with PDF / Excel / CSV export |
| General ledger | `/ledger` | Chart of accounts, trial balance, journal with account drill-down, manual journal entries |
| Audit trail | `/audit` | Immutable log of every create, update, status change and void |

### Transaction types and their double-entry postings

| Type | Debit | Credit | Side effect |
|---|---|---|---|
| Device purchase | 1200 Inventory – Devices | Cash / Bank / 2000 AP | Creates a unit (BROKEN or IN_STOCK) |
| Sale (serialised) | Cash / Bank / 1100 AR<br>50x0 COGS (unit cost basis) | 4000 Switch / 4010 iPhone / 4200 Accessories / 4300 PC parts Sales<br>1200 Inventory | Unit becomes SOLD and records its sale price |
| Sale (accessory / other) | Cash / Bank / AR | Chosen income account | none |
| Refurbish own unit | 1200 Inventory (capitalised) | 1210 Parts Inventory, 2300 Accrued Labor | Cost basis increases. Unit becomes READY / REFURBISHED. |
| Parts purchase | 1210 Parts Inventory | Cash / Bank / AP | Part qty increases. Weighted-average cost is recalculated. |
| Parts issued to repair job | 1220 Repair WIP | 1210 Parts Inventory | Part qty decreases. Job parts cost increases. |
| Repair deposit | Cash / Bank | 2200 Customer Deposits | Job deposit increases |
| Repair invoice (on COMPLETED) | 2200 Deposits, Cash / Bank / AR<br>5100 Repair Parts Used<br>5110 Repair Labor | 4100 / 4110 Repair revenue<br>1220 Repair WIP<br>2300 Accrued Labor | Job is marked invoiced |
| Expense | 6xxx expense account | Cash / Bank / AP | none |
| Supplier payment | 2000 AP | Cash / Bank | none |
| Technician payout | 2300 Accrued Labor | Cash / Bank | none |
| Customer payment | Cash / Bank | 1100 AR | none |
| Refund | 4950 Sales Returns | Cash / Bank | Optional restock: Dr 1200 / Cr COGS, unit becomes RETURNED |
| Other income | Cash / Bank | 4900 Other Income | none |
| Owner contribution / draw | Cash / Bank or 3100 Draws | 3000 Capital or Cash / Bank | none |
| Manual journal | any | any | Must balance |
| **Void** (any type) | exact reverse of the original | | Original stays visible. Side effects are rolled back where safe. |

### Accounting principles applied

- **Double entry everywhere.** Every posting runs through `assertBalanced`, which works in integer cents, so Σdebits must equal Σcredits exactly.
- **Accrual basis.** Revenue is recognised on sale or job completion. Costs are matched to the revenue they produce (COGS at sale, repair parts and labor at invoice).
- **Specific identification** costing for serialised devices. Refurbishment parts and labor are **capitalised** into the unit's cost basis, not expensed, so the profit on a flipped console is correct.
- **Moving weighted-average cost** for bulk parts.
- **Work in progress.** Parts sit in 1220 Repair WIP until the job is invoiced.
- **Customer deposits are liabilities** until the job is invoiced.
- **Accrued technician labor** (2300). Job labor is recognised when the work is done and cleared when you pay the technician, so cash and cost are never double-counted.
- **Immutable ledger.** Nothing posted is ever edited or deleted. Corrections are reversing entries, recorded with the actor and a reason in the audit log.
- **Business dates.** A date picked without a time is stored at 12:00 UTC, so it shows on the same calendar day in every timezone from UTC−11 to UTC+11.
- **Every operation is atomic.** Ledger entry, inventory change and audit record are written together in one database transaction.

## 4. Dashboard layout

```
┌ Sidebar ┐┌──────────────── Top bar: queue count · + New transaction · alerts · theme ───────────────┐
│Overview ││ Business overview                                  [30D MTD QTD YTD 12M] [Reports]       │
│Ops      ││ [Net revenue ~] [Gross profit ~] [Net profit ~] [Net margin]       ← KPI row 1 + sparklines│
│Accounts ││ [Cash & bank]   [Inventory @cost] [Profit potential] [Repair queue] ← KPI row 2           │
│         ││ [ Device pipeline: Broken → Under repair → Ready → Switch stock → iPhone stock → Sold ]   │
│         ││ [ Revenue vs Expenses (grouped bars, 12m)          ][ Profit/Expenses/Net income donut ]  │
│         ││ [ Profit trend + 3-mo forecast (area)  ][ Cash flow (in/out bars + net line)          ]  │
│         ││ [ Revenue breakdown donut ][ Expense breakdown donut ][ What eats our money (ranked) ]    │
│         ││ [ Top profit sources ][ Best sellers ][ Inventory alerts ][ Repair queue ]               │
│         ││ [ Monthly performance table: revenue · COGS · repair costs · GP · opex · NP · margin ]   │
└─────────┘└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Breakpoints: 4 columns at ≥1280px, 2 at ≥640px, 1 on phones. The sidebar collapses into a
drawer below 1024px. Tables scroll horizontally inside their card, never the whole page, and
the repair board scrolls sideways on phones.

## 5. Database schema (Prisma / PostgreSQL)

Full source: `prisma/schema.prisma`. Migration: `prisma/migrations/*_init`.

```
Account ─< JournalLine >─ JournalEntry ─? Transaction ─? Customer / Supplier / InventoryUnit / RepairJob
                                    └── reverses ─ JournalEntry (void)
InventoryUnit ─< PartUsage >─ Part
RepairJob ─< PartUsage, RepairStatusChange, Transaction ; RepairJob >─ Customer
AuditLog (entity, entityId, action, before, after, actor)
Counter (TX-, RJ-, SKU sequences)
```

| Table | Key fields |
|---|---|
| Account | code, name, type (ASSET, LIABILITY, EQUITY, REVENUE, CONTRA_REVENUE, COGS, EXPENSE), category |
| JournalEntry | number, date, memo, transactionId, reversesId, createdBy |
| JournalLine | entryId, accountId, debit, credit (Decimal 14,2), unitId, repairId |
| Transaction | reference, type, date, description, amount, method, category, status (POSTED/VOIDED), links |
| InventoryUnit | sku, productLine, model, serial, condition, status, purchaseCost, costBasis, listPrice, salePrice, acquiredAt, soldAt |
| Part | sku, name, compatible, quantity, avgCost, reorderLevel |
| RepairJob | jobNumber, customer, deviceType, deviceModel, problem, diagnosis, status, price, laborCost, partsCost, deposit, dueAt, completedAt, invoiced |
| RepairStatusChange | from, to, note, changedBy, createdAt |
| AuditLog | entity, entityId, action, summary, before, after, actor, createdAt |

Repair statuses: Received → Diagnosing → Waiting for Parts → Repairing → Testing → Ready for Pickup → Completed (plus Cancelled).
Unit statuses: BROKEN → IN_REPAIR → READY → SOLD, plus IN_STOCK, RETURNED and WRITTEN_OFF.

## 6. Accounting formulas

All formulas are in `lib/accounting/metrics.ts` and covered by `tests/accounting.test.ts`.
Every figure is computed from ledger lines within the selected period.

| Metric | Formula |
|---|---|
| Gross revenue | Σ(credit − debit) on REVENUE accounts (4000–4900) |
| Refunds | Σ(debit − credit) on 4950 |
| Net revenue | Gross revenue − Refunds |
| COGS | Σ(debit − credit) on 5000, 5010, 5020, 5030 |
| Repair costs | Σ(debit − credit) on 5100 + 5110 |
| Gross profit | Net revenue − COGS − Repair costs |
| Gross margin % | Gross profit ÷ Net revenue |
| Operating expenses | Σ(debit − credit) on 6xxx |
| Net profit | Gross profit − Operating expenses |
| Net margin % | Net profit ÷ Net revenue |
| Monthly / quarterly / annual profit | Net profit over calendar month / quarter / year buckets |
| Cash in / out | Σ debits / Σ credits on 1000 + 1010 |
| Inventory cost | Σ costBasis of unsold units |
| Inventory value | Σ listPrice of unsold units |
| Profit potential | Inventory value − Inventory cost |
| Inventory turnover | COGS ÷ ((Inventory₁₂₀₀ at start + at end) ÷ 2) |
| Days in inventory | Days in period ÷ turnover |
| Unit profit | salePrice − costBasis (purchase + capitalised parts + labor) |
| Avg profit per console | Σ unit profit of Switch units sold ÷ count |
| Repair profit | price − partsCost − laborCost; margin = profit ÷ price |
| Avg repair margin | Σ repair profit ÷ Σ repair revenue (completed jobs) |
| Spending buckets | Parts = 6000 + 5100; Labor = 6400 + 5110; Food = 6300; Fuel = 6200; Other = all remaining opex |
| Profit forecast | Ordinary least squares over the last 6 complete months, projected 3 months ahead |
| Parts weighted-average cost | (onHand × avg + qty × unitCost) ÷ (onHand + qty) |
| Balance sheet check | Assets = Liabilities + Equity + unclosed earnings |

## 7. Application architecture

```
Browser (React 19 client components: forms, charts, dialogs)
   │  fetch JSON                         ▲ RSC HTML
   ▼                                     │
Next.js 15 App Router ── app/**/page.tsx (server components, read via lib/queries.ts)
   │                    └ app/api/**/route.ts (mutations + exports, zod-validated)
   ▼
lib/accounting/posting.ts   ← the only code path that writes financial data
   ├ ledger.ts   balanced-entry validation (integer cents)
   ├ metrics.ts  pure formulas (unit-tested)
   └ chart.ts    chart of accounts
lib/queries.ts / lib/reports.ts / lib/export.ts (CSV · ExcelJS · jsPDF)
   ▼
Prisma 6 → PostgreSQL
```

- **Reads.** Server components call `lib/queries.ts` directly, with no API round trip.
- **Writes.** Client forms POST to `/api/*`, which validates with zod and calls the posting engine. On success, `router.refresh()` re-renders the server data.
- **Errors.** Validation problems return 400, accounting-rule violations (selling a sold unit, unbalanced entry, insufficient parts) return 422, and missing records return 404.
- **Auth.** Single-owner password login. `middleware.ts` checks an HMAC-signed session cookie (`lib/auth/session.ts`, Web Crypto) on every page and API route except `/login` and `/api/auth/login`. The password is verified with scrypt (`lib/auth/password.ts`), with a 5-attempts-per-15-minutes limit per IP. Cross-site writes are rejected by an Origin check. Sign-ins are written to the audit log. To support several staff accounts later, add a `User` table and put the user id in the session's `sub`.

### Hosting

- **Target:** Vercel (serverless functions + Edge middleware) with Neon Postgres. Both have free tiers. Any Node host with Postgres also works (`npm run build && npm start`).
- **Connections:** `DATABASE_URL` is the pooled connection. Prisma is told about the pooler automatically (`pgbouncer=true`, `connect_timeout=15` for cold starts). Migrations use `DATABASE_URL_UNPOOLED`.
- **Deploys:** `npm run vercel-build` runs `prisma migrate deploy`, upserts the chart of accounts (idempotent, no demo data), then `next build`.
- **Transactions:** interactive DB transactions allow 20 s, to absorb network latency to a remote database.
- **Installable app:** web app manifest (`app/manifest.ts`), generated icons (`app/icon.tsx`, `app/apple-icon.tsx`), standalone display, safe-area padding for notched phones, and 16px form text on phones so iOS doesn't zoom into fields.
- **Navigation:** there's no route-group `loading.tsx` (it made same-page filter navigations hang in production builds). Sidebar links show a per-link pending spinner instead. In-page filter and record links don't prefetch, which avoids a prefetch race and saves serverless invocations.

### API

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/transactions` | List (type, q, from, to) / post any transaction type |
| POST | `/api/transactions/:id/void` | Reverse a transaction (`{reason}`) |
| GET/POST | `/api/repairs` | List / create a job (with optional deposit) |
| GET/PATCH | `/api/repairs/:id` | Detail / change status, price, labor or diagnosis (COMPLETED auto-invoices) |
| POST | `/api/repairs/:id/parts` | Issue parts from stock to a job |
| GET/PATCH | `/api/inventory` | Units + parts / edit list price, notes or serial (audited) |
| GET | `/api/dashboard?range=` | Everything shown on the dashboard |
| GET | `/api/accounts` | Trial balance |
| GET | `/api/reports?period=&date=&format=json\|csv\|xlsx\|pdf` | Reports and exports |
| GET | `/api/lookups` | Dropdown data for forms |
| POST | `/api/auth/login`, `/api/auth/logout` | Start / end the owner session |

## 8. Improvements specific to Switch repair and resale

Already built in:

- A **device pipeline** strip (Broken → Under repair → Ready → Stock → Sold) that shows refurbishment flow at a glance.
- **Capitalised refurbishment cost.** A $60 broken V2 plus a $22 LCD plus $15 of labor has a cost basis of $97, so its resale profit is honest.
- **Aging alerts** at 60+ days, prompting a price drop before capital stays tied up.
- **Low-stock alerts** per part with reorder levels, plus one-click restock at the last average cost.
- **Profitability by repair type** (e.g. "Switch · Cracked screen" vs "Joy-Con · drift"), showing which services to promote.
- **Overdue job flags** on the repair board.

Recommended next steps:

1. **Model-level buy-price guide.** Use sold history to suggest a maximum buy price per model and condition for a target margin (e.g. max buy = avg sale × (1 − target margin) − avg refurb cost).
2. **Serial / IMEI checks.** Record blacklist and iCloud-lock status for iPhones, and flag patched vs unpatched Switch serials, which affect resale value.
3. **Parts compatibility matrix.** Suggest the right part when a job is created (V1/V2 LCD vs OLED panel, Lite charge port).
4. **Warranty tracking.** Store a 30/60/90-day warranty per sale or repair and log returns against it, to measure true warranty cost per model.
5. **Marketplace fee and shipping per sale.** Record eBay, Mercari or Facebook fees as part of the sale to get net-of-fee profit by channel.
6. **Technician performance.** Record a technician on each job to see jobs per day, average turnaround and comeback rate.
7. **Sales tax.** Add a 2100 Sales Tax Payable account and a tax rate on sales.
8. **Customer SMS / e-mail** when a job reaches Ready for Pickup (Twilio or Resend).
9. **Barcode / QR labels** for units and repair tickets, for fast lookup on mobile.
10. **Bank feed import** (CSV first, Plaid later) with matching against posted transactions.

## 9. Profit-visibility KPIs and reports

Dashboard KPIs: net revenue, gross profit and net profit (each with a 12-month sparkline and a
delta against the previous period), net margin, cash & bank, inventory at cost, profit
potential and repair queue.

Insights: top profit source (with margin), top expense category, best-selling models, average
profit per console, and inventory and repair alerts.

Reports (`/reports`): pick daily, weekly, monthly, quarterly or annual plus any date. Each
report contains a P&L (with gross and net margin), a balance sheet with a balanced check, a
cash summary, and the transaction list. It exports as:

- **PDF**: branded header, KPI strip, statements, transaction appendix, page numbers
- **Excel**: P&L, balance sheet and transaction sheets, currency-formatted, with a frozen header and filters
- **CSV**: every section, ready to import into a spreadsheet or another accounting package

## 10. Positioning against QuickBooks, Xero and Zoho Books

| | Game Vault | Generic SMB accounting |
|---|---|---|
| Double-entry GL, trial balance, P&L, balance sheet | ✓ | ✓ |
| Immutable ledger with reversal-based voids and audit log | ✓ | ✓ |
| Serialised device inventory with refurbishment capitalisation | ✓ | ✗ (needs add-ons) |
| Repair job costing, WIP, deposits and Kanban queue | ✓ | ✗ |
| Buy-broken → repair → resell pipeline view | ✓ | ✗ |
| "What eats our money" spend analysis | ✓ | partial |
| Setup effort | One screen per task | Accountant-oriented |
