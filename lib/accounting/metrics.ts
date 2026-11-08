/**
 * Pure accounting formulas. Every dashboard / report number is derived here
 * from general-ledger lines, so the UI can never disagree with the books.
 */
import type { AccountType } from "@prisma/client";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./chart";
import { round2 } from "./money";

export type LedgerRow = {
  date: Date;
  code: string;
  type: AccountType;
  category: string | null;
  debit: number;
  credit: number;
};

export type PnL = {
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  cogs: number; // product cost of goods sold
  repairCosts: number; // parts + labor consumed by repair jobs
  totalCostOfSales: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  netProfit: number;
  netMargin: number;
  revenueByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  cogsByCategory: Record<string, number>;
};

const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function computePnL(rows: LedgerRow[]): PnL {
  const revenueByCategory: Record<string, number> = Object.fromEntries(INCOME_CATEGORIES.map((c) => [c, 0]));
  const expenseByCategory: Record<string, number> = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0]));
  const cogsByCategory: Record<string, number> = {};
  let grossRevenue = 0, refunds = 0, cogs = 0, repairCosts = 0, opex = 0;

  for (const r of rows) {
    const cat = r.category ?? "UNCATEGORISED";
    switch (r.type) {
      case "REVENUE": {
        const v = r.credit - r.debit;
        grossRevenue += v;
        revenueByCategory[cat] = (revenueByCategory[cat] ?? 0) + v;
        break;
      }
      case "CONTRA_REVENUE":
        refunds += r.debit - r.credit;
        break;
      case "COGS": {
        const v = r.debit - r.credit;
        if (cat === "REPAIR_PARTS" || cat === "REPAIR_LABOR") repairCosts += v;
        else cogs += v;
        cogsByCategory[cat] = (cogsByCategory[cat] ?? 0) + v;
        break;
      }
      case "EXPENSE": {
        const v = r.debit - r.credit;
        opex += v;
        expenseByCategory[cat] = (expenseByCategory[cat] ?? 0) + v;
        break;
      }
    }
  }
  const netRevenue = grossRevenue - refunds;
  const totalCostOfSales = cogs + repairCosts;
  const grossProfit = netRevenue - totalCostOfSales;
  const netProfit = grossProfit - opex;
  const r = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round2(v)]));
  return {
    grossRevenue: round2(grossRevenue),
    refunds: round2(refunds),
    netRevenue: round2(netRevenue),
    cogs: round2(cogs),
    repairCosts: round2(repairCosts),
    totalCostOfSales: round2(totalCostOfSales),
    grossProfit: round2(grossProfit),
    grossMargin: safeDiv(grossProfit, netRevenue),
    operatingExpenses: round2(opex),
    netProfit: round2(netProfit),
    netMargin: safeDiv(netProfit, netRevenue),
    revenueByCategory: r(revenueByCategory),
    expenseByCategory: r(expenseByCategory),
    cogsByCategory: r(cogsByCategory),
  };
}

export type Bucket = { key: string; label: string; start: Date; end: Date };

export function monthBuckets(end: Date, count: number): Bucket[] {
  const out: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const s = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 1);
    out.push({
      key: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`,
      label: s.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      start: s,
      end: e,
    });
  }
  return out;
}

export function quarterBuckets(year: number): Bucket[] {
  return [0, 1, 2, 3].map((q) => ({
    key: `${year}-Q${q + 1}`,
    label: `Q${q + 1} ${year}`,
    start: new Date(year, q * 3, 1),
    end: new Date(year, q * 3 + 3, 1),
  }));
}

export type PeriodPoint = { key: string; label: string } & PnL & {
  cashIn: number;
  cashOut: number;
  netCash: number;
  expensesTotal: number; // cost of sales + opex — "everything that left the P&L"
};

/** Cash movement = activity on cash accounts (1000/1010). */
export function cashMovement(rows: LedgerRow[]) {
  let cashIn = 0, cashOut = 0;
  for (const r of rows) {
    if (r.category !== "CASH") continue;
    cashIn += r.debit;
    cashOut += r.credit;
  }
  return { cashIn: round2(cashIn), cashOut: round2(cashOut), netCash: round2(cashIn - cashOut) };
}

export function series(rows: LedgerRow[], buckets: Bucket[]): PeriodPoint[] {
  return buckets.map((b) => {
    const inB = rows.filter((r) => r.date >= b.start && r.date < b.end);
    const p = computePnL(inB);
    return {
      key: b.key,
      label: b.label,
      ...p,
      ...cashMovement(inB),
      expensesTotal: round2(p.totalCostOfSales + p.operatingExpenses),
    };
  });
}

/** Ordinary least squares on (i, y). Returns projected values for the next `ahead` periods. */
export function linearForecast(values: number[], ahead: number) {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0, projected: Array(ahead).fill(0) as number[] };
  const xs = values.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (values[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  const projected = Array.from({ length: ahead }, (_, k) => round2(intercept + slope * (n + k)));
  return { slope, intercept, projected };
}

/**
 * "What eats our money" — groups operating spend + repair costs into the buckets
 * the owner cares about. Device COGS is excluded (it is the product itself).
 */
export function spendingBreakdown(p: PnL) {
  const e = p.expenseByCategory;
  const parts = (e.PARTS ?? 0) + (p.cogsByCategory.REPAIR_PARTS ?? 0);
  const labor = (e.LABOR ?? 0) + (p.cogsByCategory.REPAIR_LABOR ?? 0);
  const food = e.FOOD ?? 0;
  const fuel = e.FUEL ?? 0;
  const total = p.operatingExpenses + p.repairCosts;
  const other = total - parts - labor - food - fuel;
  const items = [
    { key: "PARTS", label: "Parts", value: round2(parts) },
    { key: "LABOR", label: "Labor", value: round2(labor) },
    { key: "FOOD", label: "Food", value: round2(food) },
    { key: "FUEL", label: "Fuel / Gas", value: round2(fuel) },
    { key: "OTHER", label: "Other", value: round2(other) },
  ];
  return { total: round2(total), items: items.map((i) => ({ ...i, share: safeDiv(i.value, total) })) };
}

export type UnitLike = {
  productLine: string;
  model: string;
  status: string;
  costBasis: number;
  listPrice: number;
  salePrice: number | null;
  acquiredAt: Date;
  soldAt: Date | null;
};

export const UNSOLD = ["IN_STOCK", "BROKEN", "IN_REPAIR", "READY", "RETURNED"];

export function inventoryValuation(units: UnitLike[]) {
  const unsold = units.filter((u) => UNSOLD.includes(u.status));
  const cost = unsold.reduce((a, u) => a + u.costBasis, 0);
  // Units without a list price yet are valued at cost, so they don't show as a loss.
  const value = unsold.reduce((a, u) => a + (u.listPrice > 0 ? u.listPrice : u.costBasis), 0);
  const unpriced = unsold.filter((u) => !(u.listPrice > 0)).length;
  return { units: unsold.length, cost: round2(cost), value: round2(value), profitPotential: round2(value - cost), unpriced };
}

export function agingBuckets(units: UnitLike[], asOf = new Date()) {
  const b = [
    { label: "0–30 days", min: 0, max: 30, units: 0, cost: 0 },
    { label: "31–60 days", min: 31, max: 60, units: 0, cost: 0 },
    { label: "61–90 days", min: 61, max: 90, units: 0, cost: 0 },
    { label: "90+ days", min: 91, max: Infinity, units: 0, cost: 0 },
  ];
  for (const u of units.filter((x) => UNSOLD.includes(x.status))) {
    const days = Math.floor((asOf.getTime() - u.acquiredAt.getTime()) / 86_400_000);
    const bucket = b.find((x) => days >= x.min && days <= x.max) ?? b[3];
    bucket.units++;
    bucket.cost = round2(bucket.cost + u.costBasis);
  }
  return b.map(({ label, units, cost }) => ({ label, units, cost }));
}

/** Inventory turnover = COGS ÷ average inventory; DIO = days ÷ turnover. */
export function turnover(cogs: number, beginningInventory: number, endingInventory: number, days: number) {
  const avg = (beginningInventory + endingInventory) / 2;
  const rate = safeDiv(cogs, avg);
  return { rate, averageInventory: round2(avg), daysInInventory: rate === 0 ? 0 : days / rate };
}

export function unitProfitStats(units: UnitLike[]) {
  const sold = units.filter((u) => u.status === "SOLD" && u.salePrice != null);
  const byModel = new Map<string, { model: string; productLine: string; sold: number; revenue: number; profit: number }>();
  for (const u of sold) {
    const k = u.model;
    const m = byModel.get(k) ?? { model: u.model, productLine: u.productLine, sold: 0, revenue: 0, profit: 0 };
    m.sold++;
    m.revenue += u.salePrice!;
    m.profit += u.salePrice! - u.costBasis;
    byModel.set(k, m);
  }
  const models = [...byModel.values()].map((m) => ({
    ...m,
    revenue: round2(m.revenue),
    profit: round2(m.profit),
    avgProfit: round2(m.profit / m.sold),
    margin: safeDiv(m.profit, m.revenue),
  }));
  const consoles = sold.filter((u) => u.productLine === "SWITCH");
  const avgProfitPerConsole = consoles.length
    ? round2(consoles.reduce((a, u) => a + (u.salePrice! - u.costBasis), 0) / consoles.length)
    : 0;
  return {
    models,
    mostProfitable: [...models].sort((a, b) => b.profit - a.profit)[0] ?? null,
    bestSelling: [...models].sort((a, b) => b.sold - a.sold).slice(0, 5),
    avgProfitPerConsole,
    soldCount: sold.length,
  };
}

export type RepairLike = { deviceType: string; problem: string; price: number; partsCost: number; laborCost: number; status: string };

export function repairProfit(r: Pick<RepairLike, "price" | "partsCost" | "laborCost">) {
  const profit = round2(r.price - r.partsCost - r.laborCost);
  return { profit, margin: safeDiv(profit, r.price) };
}

/** Groups completed repairs by a normalised "repair type" (device + first words of problem). */
export function repairStats(jobs: (RepairLike & { repairType?: string })[]) {
  const done = jobs.filter((j) => j.status === "COMPLETED");
  const groups = new Map<string, { type: string; jobs: number; revenue: number; profit: number }>();
  for (const j of done) {
    const t = j.repairType ?? j.problem;
    const g = groups.get(t) ?? { type: t, jobs: 0, revenue: 0, profit: 0 };
    g.jobs++;
    g.revenue += j.price;
    g.profit += repairProfit(j).profit;
    groups.set(t, g);
  }
  const types = [...groups.values()].map((g) => ({ ...g, revenue: round2(g.revenue), profit: round2(g.profit), margin: safeDiv(g.profit, g.revenue) }));
  const revenue = done.reduce((a, j) => a + j.price, 0);
  const profit = done.reduce((a, j) => a + repairProfit(j).profit, 0);
  return {
    types: types.sort((a, b) => b.profit - a.profit),
    mostProfitable: types.sort((a, b) => b.profit - a.profit)[0] ?? null,
    avgMargin: safeDiv(profit, revenue),
    completed: done.length,
  };
}

/** Weighted-average cost after receiving `qty` at `unitCost`. */
export function weightedAverageCost(onHand: number, avgCost: number, qty: number, unitCost: number) {
  const total = onHand + qty;
  if (total <= 0) return round2(unitCost);
  return round2((onHand * avgCost + qty * unitCost) / total);
}
