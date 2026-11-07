import "server-only";
import { prisma } from "./db";
import { CATEGORY_LABEL, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./accounting/chart";
import { computePnL, cashMovement } from "./accounting/metrics";
import { dec, round2 } from "./accounting/money";
import { balancesAsOf, ledgerRows } from "./queries";

export const REPORT_PERIODS = ["daily", "weekly", "monthly", "quarterly", "annual"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export function periodBounds(period: ReportPeriod, anchor: Date) {
  const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
  switch (period) {
    case "daily": return { start: new Date(y, m, d), end: new Date(y, m, d + 1), label: anchor.toLocaleDateString("en-US", { dateStyle: "long" }) };
    case "weekly": {
      const dow = (anchor.getDay() + 6) % 7; // Monday start
      const s = new Date(y, m, d - dow);
      const e = new Date(y, m, d - dow + 7);
      return { start: s, end: e, label: `Week of ${s.toLocaleDateString("en-US", { dateStyle: "medium" })}` };
    }
    case "monthly": return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1), label: anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
    case "quarterly": {
      const q = Math.floor(m / 3);
      return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 1), label: `Q${q + 1} ${y}` };
    }
    case "annual": return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), label: `Fiscal year ${y}` };
  }
}

export async function buildReport(period: ReportPeriod, anchor: Date) {
  const { start, end, label } = periodBounds(period, anchor);
  const [rows, balances, txs] = await Promise.all([
    ledgerRows(start, end),
    balancesAsOf(end),
    prisma.transaction.findMany({ where: { date: { gte: start, lt: end } }, orderBy: { date: "asc" }, include: { customer: true, supplier: true } }),
  ]);
  const pnl = computePnL(rows);
  const cash = cashMovement(rows);

  const income = INCOME_CATEGORIES.map((c) => ({ label: CATEGORY_LABEL[c], amount: pnl.revenueByCategory[c] ?? 0 }));
  const expenses = EXPENSE_CATEGORIES.map((c) => ({ label: CATEGORY_LABEL[c], amount: pnl.expenseByCategory[c] ?? 0 }));

  const assets = balances.filter((a) => a.type === "ASSET").map((a) => ({ code: a.code, label: a.name, amount: a.balance }));
  const liabilities = balances.filter((a) => a.type === "LIABILITY").map((a) => ({ code: a.code, label: a.name, amount: a.balance }));
  const equityAccts = balances.filter((a) => a.type === "EQUITY").map((a) => ({ code: a.code, label: a.name, amount: a.balance }));
  // Current-year earnings = all P&L accounts to date (books are not formally closed)
  const pl = balances.filter((a) => ["REVENUE", "CONTRA_REVENUE", "COGS", "EXPENSE"].includes(a.type));
  const earnings = round2(
    pl.reduce((s, a) => s + (a.type === "REVENUE" ? a.balance : -a.balance), 0),
  );
  const totalAssets = round2(assets.reduce((s, a) => s + a.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((s, a) => s + a.amount, 0));
  const totalEquity = round2(equityAccts.reduce((s, a) => s + a.amount, 0) + earnings);

  return {
    period,
    label,
    start,
    end,
    generatedAt: new Date(),
    pnl,
    income,
    expenses,
    cash,
    balanceSheet: {
      assets,
      liabilities,
      equity: [...equityAccts, { code: "—", label: "Accumulated Earnings (unclosed)", amount: earnings }],
      totalAssets,
      totalLiabilities,
      totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    },
    transactions: txs.map((t) => ({
      date: t.date,
      reference: t.reference,
      type: t.type,
      description: t.description,
      party: t.customer?.name ?? t.supplier?.name ?? "",
      method: t.method,
      status: t.status,
      amount: dec(t.amount),
    })),
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;
