import { test } from "node:test";
import assert from "node:assert/strict";
import { assertBalanced, UnbalancedEntryError } from "../lib/accounting/ledger";
import {
  agingBuckets, computePnL, inventoryValuation, linearForecast, repairProfit, repairStats,
  spendingBreakdown, turnover, unitProfitStats, weightedAverageCost, type LedgerRow,
} from "../lib/accounting/metrics";

const d = new Date("2026-05-10");
const row = (code: string, type: LedgerRow["type"], category: string, debit: number, credit: number): LedgerRow => ({ date: d, code, type, category, debit, credit });

test("assertBalanced accepts balanced entries and drops zero lines", () => {
  const out = assertBalanced([{ code: "1000", debit: 100 }, { code: "4000", credit: 100 }, { code: "2200", debit: 0 }]);
  assert.equal(out.length, 2);
});

test("assertBalanced rejects unbalanced, negative and two-sided lines", () => {
  assert.throws(() => assertBalanced([{ code: "1000", debit: 100 }, { code: "4000", credit: 99.99 }]), UnbalancedEntryError);
  assert.throws(() => assertBalanced([{ code: "1000", debit: -5 }, { code: "4000", credit: -5 }]));
  assert.throws(() => assertBalanced([{ code: "1000", debit: 5, credit: 5 }, { code: "4000", credit: 0 }]));
});

test("assertBalanced is immune to float drift", () => {
  assert.doesNotThrow(() => assertBalanced([{ code: "1000", debit: 0.1 }, { code: "1010", debit: 0.2 }, { code: "4000", credit: 0.3 }]));
});

test("computePnL derives every headline figure from ledger rows", () => {
  const rows: LedgerRow[] = [
    // Switch sale 300, cost 180
    row("1000", "ASSET", "CASH", 300, 0), row("4000", "REVENUE", "SWITCH_SALES", 0, 300),
    row("5000", "COGS", "COGS_SWITCH", 180, 0), row("1200", "ASSET", "INVENTORY", 0, 180),
    // repair 100, parts 20, labor 15
    row("4100", "REVENUE", "SWITCH_REPAIRS", 0, 100), row("5100", "COGS", "REPAIR_PARTS", 20, 0), row("5110", "COGS", "REPAIR_LABOR", 15, 0),
    // refund 10
    row("4950", "CONTRA_REVENUE", "REFUNDS", 10, 0),
    // expenses
    row("6300", "EXPENSE", "FOOD", 25, 0), row("6200", "EXPENSE", "FUEL", 40, 0), row("6600", "EXPENSE", "RENT", 50, 0),
  ];
  const p = computePnL(rows);
  assert.equal(p.grossRevenue, 400);
  assert.equal(p.refunds, 10);
  assert.equal(p.netRevenue, 390);
  assert.equal(p.cogs, 180);
  assert.equal(p.repairCosts, 35);
  assert.equal(p.grossProfit, 175);
  assert.equal(p.operatingExpenses, 115);
  assert.equal(p.netProfit, 60);
  assert.ok(Math.abs(p.netMargin - 60 / 390) < 1e-9);
  assert.equal(p.revenueByCategory.SWITCH_SALES, 300);
  assert.equal(p.expenseByCategory.FOOD, 25);

  const s = spendingBreakdown(p);
  assert.equal(s.total, 150); // opex 115 + repair costs 35
  const by = Object.fromEntries(s.items.map((i) => [i.key, i.value]));
  assert.deepEqual(by, { PARTS: 20, LABOR: 15, FOOD: 25, FUEL: 40, OTHER: 50 });
  assert.ok(Math.abs(s.items.reduce((a, i) => a + i.share, 0) - 1) < 1e-9);
});

test("computePnL handles an empty period without NaN", () => {
  const p = computePnL([]);
  assert.equal(p.netProfit, 0);
  assert.equal(p.netMargin, 0);
});

test("weighted average cost", () => {
  assert.equal(weightedAverageCost(10, 5, 10, 7), 6);
  assert.equal(weightedAverageCost(0, 0, 4, 3.33), 3.33);
});

test("linear forecast continues a straight line", () => {
  const f = linearForecast([100, 200, 300, 400], 2);
  assert.deepEqual(f.projected, [500, 600]);
  assert.deepEqual(linearForecast([], 2).projected, [0, 0]);
});

test("turnover and days in inventory", () => {
  const t = turnover(12000, 2000, 4000, 365);
  assert.equal(t.rate, 4);
  assert.equal(t.averageInventory, 3000);
  assert.ok(Math.abs(t.daysInInventory - 91.25) < 1e-9);
  assert.equal(turnover(0, 0, 0, 30).rate, 0);
});

const unit = (o: Partial<Parameters<typeof inventoryValuation>[0][number]>) => ({
  productLine: "SWITCH", model: "Switch OLED", status: "IN_STOCK", costBasis: 100, listPrice: 150, salePrice: null, acquiredAt: new Date("2026-05-01"), soldAt: null, ...o,
});

test("inventory valuation ignores sold units", () => {
  const v = inventoryValuation([unit({}), unit({ status: "BROKEN", costBasis: 40, listPrice: 120 }), unit({ status: "SOLD", salePrice: 160 })]);
  assert.deepEqual(v, { units: 2, cost: 140, value: 270, profitPotential: 130, unpriced: 0 });
});

test("a unit with no list price is valued at cost, not shown as a loss", () => {
  const v = inventoryValuation([unit({ costBasis: 4500, listPrice: 0 }), unit({ costBasis: 100, listPrice: 150 })]);
  assert.deepEqual(v, { units: 2, cost: 4600, value: 4650, profitPotential: 50, unpriced: 1 });
});

test("money is shown in Philippine pesos", async () => {
  const { money } = await import("../lib/utils");
  const { compactMoney } = await import("../components/charts/theme");
  assert.equal(money(4500), "₱4,500.00");
  assert.equal(money(-1250.5), "-₱1,250.50");
  assert.equal(compactMoney(4500), "₱4.5k");
  assert.equal(compactMoney(-25000), "-₱25k");
  assert.equal(compactMoney(1_250_000), "₱1.3M");
});

test("aging buckets by days held", () => {
  const asOf = new Date("2026-06-30");
  const b = agingBuckets([unit({ acquiredAt: new Date("2026-06-20") }), unit({ acquiredAt: new Date("2026-05-15") }), unit({ acquiredAt: new Date("2026-01-01") })], asOf);
  assert.deepEqual(b.map((x) => x.units), [1, 1, 0, 1]);
});

test("unit profit stats", () => {
  const s = unitProfitStats([
    unit({ status: "SOLD", salePrice: 160, costBasis: 100 }),
    unit({ status: "SOLD", salePrice: 140, costBasis: 100 }),
    unit({ status: "SOLD", model: "iPhone 13", productLine: "IPHONE", salePrice: 420, costBasis: 300 }),
  ]);
  assert.equal(s.avgProfitPerConsole, 50);
  assert.equal(s.mostProfitable?.model, "iPhone 13");
  assert.equal(s.bestSelling[0].model, "Switch OLED");
});

test("repair profit & stats", () => {
  assert.deepEqual(repairProfit({ price: 100, partsCost: 20, laborCost: 15 }), { profit: 65, margin: 0.65 });
  const s = repairStats([
    { deviceType: "SWITCH", problem: "Drift", price: 30, partsCost: 4, laborCost: 6, status: "COMPLETED" },
    { deviceType: "SWITCH", problem: "Screen", price: 130, partsCost: 48, laborCost: 20, status: "COMPLETED" },
    { deviceType: "SWITCH", problem: "Screen", price: 130, partsCost: 48, laborCost: 20, status: "REPAIRING" },
  ]);
  assert.equal(s.completed, 2);
  assert.equal(s.mostProfitable?.type, "Screen");
  assert.ok(Math.abs(s.avgMargin - 82 / 160) < 1e-9);
});

test("date-picker dates stay on the same calendar day in every timezone", async () => {
  const { businessDate } = await import("../lib/accounting/posting");
  const d = businessDate.parse("2026-11-07");
  assert.equal(d.toISOString(), "2026-11-07T12:00:00.000Z");
  // New York (UTC-5) and Tokyo (UTC+9) both still read Nov 7
  assert.equal(d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), "2026-11-07");
  assert.equal(d.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }), "2026-11-07");
  // full timestamps pass through untouched
  assert.equal(businessDate.parse("2026-11-07T18:30:00.000Z").toISOString(), "2026-11-07T18:30:00.000Z");
});

test("dates follow Manila time even though servers run on UTC", async () => {
  const { businessDateString, businessToday, formatDateTime } = await import("../lib/currency");
  const { shortDate } = await import("../lib/utils");
  const earlyMorningManila = new Date("2026-12-01T07:30:00+08:00"); // still Nov 30 in UTC
  assert.equal(businessDateString(earlyMorningManila), "2026-12-01");
  const t = businessToday(earlyMorningManila);
  assert.equal(t.getMonth(), 11, "already December for 'this month'");
  assert.equal(t.getDate(), 1);
  assert.equal(shortDate(earlyMorningManila), "Dec 1, 2026");
  assert.match(formatDateTime(earlyMorningManila), /Dec 1, 2026.*7:30/);
  // a date picked in a form (stored at 12:00 UTC) shows on the same day in Manila
  assert.equal(shortDate(new Date("2026-11-09T12:00:00Z")), "Nov 9, 2026");
});
