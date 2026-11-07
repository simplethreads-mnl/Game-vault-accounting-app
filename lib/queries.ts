import "server-only";
import { prisma } from "./db";
import { CHART_OF_ACCOUNTS, isDebitNormal } from "./accounting/chart";
import { dec, round2 } from "./accounting/money";
import {
  agingBuckets,
  computePnL,
  inventoryValuation,
  linearForecast,
  monthBuckets,
  quarterBuckets,
  repairStats,
  series,
  spendingBreakdown,
  turnover,
  unitProfitStats,
  UNSOLD,
  type LedgerRow,
  type UnitLike,
} from "./accounting/metrics";

export type RangeKey = "mtd" | "qtd" | "ytd" | "12m" | "30d";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "mtd", label: "This month" },
  { key: "qtd", label: "This quarter" },
  { key: "ytd", label: "Year to date" },
  { key: "12m", label: "Last 12 months" },
];

export function resolveRange(key: string | undefined, now = new Date()) {
  const k = (RANGES.find((r) => r.key === key)?.key ?? "12m") as RangeKey;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let start: Date;
  switch (k) {
    case "30d": start = new Date(end.getTime() - 30 * 86_400_000); break;
    case "mtd": start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "qtd": start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
    case "ytd": start = new Date(now.getFullYear(), 0, 1); break;
    default: start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  }
  // previous comparable period for deltas
  const span = end.getTime() - start.getTime();
  return { key: k, label: RANGES.find((r) => r.key === k)!.label, start, end, prevStart: new Date(start.getTime() - span), prevEnd: start };
}

export async function ledgerRows(start?: Date, end?: Date): Promise<LedgerRow[]> {
  const lines = await prisma.journalLine.findMany({
    where: { entry: { date: { gte: start, lt: end } } },
    select: { debit: true, credit: true, entry: { select: { date: true } }, account: { select: { code: true, type: true, category: true } } },
  });
  return lines.map((l) => ({ date: l.entry.date, code: l.account.code, type: l.account.type, category: l.account.category, debit: dec(l.debit), credit: dec(l.credit) }));
}

/** Balance of each account as of a date (exclusive). */
export async function balancesAsOf(asOf?: Date) {
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: asOf ? { entry: { date: { lt: asOf } } } : undefined,
    _sum: { debit: true, credit: true },
  });
  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
  const byId = new Map(grouped.map((g) => [g.accountId, g]));
  return accounts.map((a) => {
    const g = byId.get(a.id);
    const debit = dec(g?._sum.debit);
    const credit = dec(g?._sum.credit);
    return { ...a, debit: round2(debit), credit: round2(credit), balance: round2(isDebitNormal(a.type) ? debit - credit : credit - debit) };
  });
}

const bal = (b: Awaited<ReturnType<typeof balancesAsOf>>, codes: string[]) => round2(b.filter((a) => codes.includes(a.code)).reduce((s, a) => s + a.balance, 0));

export async function units(): Promise<(UnitLike & { id: string; sku: string; condition: string; purchaseCost: number; serial: string | null })[]> {
  const rows = await prisma.inventoryUnit.findMany({ orderBy: { acquiredAt: "desc" } });
  return rows.map((u) => ({ ...u, costBasis: dec(u.costBasis), listPrice: dec(u.listPrice), purchaseCost: dec(u.purchaseCost), salePrice: u.salePrice == null ? null : dec(u.salePrice) }));
}

export async function repairs() {
  const rows = await prisma.repairJob.findMany({ include: { customer: true }, orderBy: { receivedAt: "desc" } });
  return rows.map((r) => ({ ...r, price: dec(r.price), laborCost: dec(r.laborCost), partsCost: dec(r.partsCost), deposit: dec(r.deposit), repairType: `${r.deviceType.startsWith("SWITCH") ? "Switch" : r.deviceType === "JOYCON" ? "Joy-Con" : "Phone"} · ${r.problem}` }));
}

export async function parts() {
  const rows = await prisma.part.findMany({ orderBy: { name: "asc" } });
  return rows.map((p) => ({ ...p, avgCost: dec(p.avgCost), value: round2(dec(p.avgCost) * p.quantity), low: p.quantity <= p.reorderLevel }));
}

export async function dashboard(rangeKey?: string) {
  const range = resolveRange(rangeKey);
  const now = new Date();
  const buckets = monthBuckets(now, 12);
  const [rows12, periodRows, prevRows, balNow, balStart, allUnits, allRepairs, allParts] = await Promise.all([
    ledgerRows(buckets[0].start, buckets[11].end),
    ledgerRows(range.start, range.end),
    ledgerRows(range.prevStart, range.prevEnd),
    balancesAsOf(),
    balancesAsOf(range.start),
    units(),
    repairs(),
    parts(),
  ]);

  const pnl = computePnL(periodRows);
  const prev = computePnL(prevRows);
  const monthly = series(rows12, buckets);
  // Fit on the last 6 *complete* months so a partial current month doesn't drag the trend down,
  // then project the current month and the two after it.
  const complete = monthly.slice(-7, -1);
  const forecast = linearForecast(complete.map((m) => m.netProfit), 3);
  const revForecast = linearForecast(complete.map((m) => m.netRevenue), 3);
  const nextMonths = monthBuckets(new Date(now.getFullYear(), now.getMonth() + 2, 1), 3);

  const inv = inventoryValuation(allUnits);
  const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000));
  const turn = turnover(pnl.cogs, bal(balStart, ["1200"]), bal(balNow, ["1200"]), days);
  const unitStats = unitProfitStats(allUnits.filter((u) => u.soldAt && u.soldAt >= range.start && u.soldAt < range.end));
  const rep = repairStats(allRepairs.filter((r) => r.completedAt && r.completedAt >= range.start && r.completedAt < range.end));

  const topExpense = Object.entries(pnl.expenseByCategory).sort((a, b) => b[1] - a[1])[0];
  const profitSources = [
    { key: "Switch resale", revenue: pnl.revenueByCategory.SWITCH_SALES, cost: pnl.cogsByCategory.COGS_SWITCH ?? 0 },
    { key: "iPhone resale", revenue: pnl.revenueByCategory.IPHONE_SALES, cost: pnl.cogsByCategory.COGS_IPHONE ?? 0 },
    { key: "Repairs", revenue: pnl.revenueByCategory.SWITCH_REPAIRS + pnl.revenueByCategory.PHONE_REPAIRS, cost: pnl.repairCosts },
    { key: "Accessories", revenue: pnl.revenueByCategory.ACCESSORY_SALES, cost: pnl.cogsByCategory.COGS_ACCESSORY ?? 0 },
    { key: "Other", revenue: pnl.revenueByCategory.OTHER_INCOME, cost: 0 },
  ].map((s) => ({ ...s, profit: round2(s.revenue - s.cost) })).sort((a, b) => b.profit - a.profit);

  const activeRepairs = allRepairs.filter((r) => !["COMPLETED", "CANCELLED"].includes(r.status));
  const unsold = allUnits.filter((u) => UNSOLD.includes(u.status));
  const agedUnits = unsold.filter((u) => (now.getTime() - u.acquiredAt.getTime()) / 86_400_000 > 60);
  const overdue = activeRepairs.filter((r) => r.dueAt && r.dueAt < now);

  const alerts = [
    ...allParts.filter((p) => p.low).map((p) => ({ level: p.quantity === 0 ? "critical" : "warning", title: `${p.name}: ${p.quantity} left`, detail: `Reorder level ${p.reorderLevel}`, href: "/inventory?tab=parts" })),
    ...agedUnits.map((u) => ({ level: "serious", title: `${u.model} unsold ${Math.floor((now.getTime() - u.acquiredAt.getTime()) / 86_400_000)} days`, detail: `${u.sku} · cost $${u.costBasis.toFixed(0)} — consider a price drop`, href: "/inventory" })),
    ...overdue.map((r) => ({ level: "warning", title: `${r.jobNumber} overdue`, detail: `${r.customer.name} · ${r.problem}`, href: `/repairs/${r.id}` })),
  ] as { level: "critical" | "serious" | "warning"; title: string; detail: string; href: string }[];

  const pipeline = {
    broken: allUnits.filter((u) => u.status === "BROKEN").length,
    inRepair: allUnits.filter((u) => u.status === "IN_REPAIR").length,
    ready: allUnits.filter((u) => u.status === "READY").length,
    inStockSwitch: allUnits.filter((u) => u.status === "IN_STOCK" && u.productLine === "SWITCH").length,
    inStockIphone: allUnits.filter((u) => ["IN_STOCK", "READY", "RETURNED"].includes(u.status) && u.productLine === "IPHONE").length,
    soldInPeriod: unitStats.soldCount,
  };

  return {
    range,
    pnl,
    prev,
    monthly,
    forecast: nextMonths.map((b, i) => ({ label: b.label, netProfit: forecast.projected[i], netRevenue: revForecast.projected[i] })),
    spending: spendingBreakdown(pnl),
    cash: bal(balNow, ["1000", "1010"]),
    receivables: bal(balNow, ["1100"]),
    payables: bal(balNow, ["2000"]),
    inventory: { ...inv, partsValue: bal(balNow, ["1210"]), wip: bal(balNow, ["1220"]), aging: agingBuckets(allUnits, now), turnover: turn },
    unitStats,
    repairStats: rep,
    topExpense: topExpense ? { category: topExpense[0], amount: topExpense[1], share: pnl.operatingExpenses ? topExpense[1] / pnl.operatingExpenses : 0 } : null,
    profitSources,
    activeRepairs,
    alerts,
    pipeline,
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboard>>;

export async function yearlySummary(year: number) {
  const rows = await ledgerRows(new Date(year, 0, 1), new Date(year + 1, 0, 1));
  const months = series(rows, monthBuckets(new Date(year, 11, 1), 12));
  const quarters = series(rows, quarterBuckets(year));
  return { year, total: computePnL(rows), months, quarters };
}

export async function expenseAnalysis(rangeKey?: string) {
  const range = resolveRange(rangeKey);
  const now = new Date();
  const buckets = monthBuckets(now, 12);
  const [rows, rows12] = await Promise.all([ledgerRows(range.start, range.end), ledgerRows(buckets[0].start, buckets[11].end)]);
  const pnl = computePnL(rows);
  const monthly = buckets.map((b) => {
    const p = computePnL(rows12.filter((r) => r.date >= b.start && r.date < b.end));
    const s = spendingBreakdown(p);
    return { label: b.label, ...Object.fromEntries(s.items.map((i) => [i.key, i.value])), total: s.total };
  });
  return { range, pnl, spending: spendingBreakdown(pnl), monthly };
}

export { CHART_OF_ACCOUNTS };
