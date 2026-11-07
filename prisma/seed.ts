/**
 * Seeds the chart of accounts plus ~12 months of realistic activity.
 * Every financial record goes through the real posting engine, so the
 * seeded books are balanced exactly like production data.
 */
import { PrismaClient } from "@prisma/client";
import { CHART_OF_ACCOUNTS } from "../lib/accounting/chart";
import { changeRepairStatus, createRepair, issuePartToRepair, postTransaction } from "../lib/accounting/posting";

const db = new PrismaClient();

// deterministic PRNG so the demo looks the same every time
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const between = (a: number, b: number) => Math.round((a + rand() * (b - a)) * 100) / 100;
const rng = (r: readonly number[]) => between(r[0], r[1]);
const chance = (p: number) => rand() < p;

const SWITCH_MODELS = [
  { model: "Switch OLED", buy: [180, 230], sell: [270, 320], brokenBuy: [70, 110] },
  { model: "Switch V2", buy: [140, 180], sell: [210, 250], brokenBuy: [50, 85] },
  { model: "Switch Lite", buy: [90, 120], sell: [140, 170], brokenBuy: [30, 55] },
  { model: "Switch V1", buy: [110, 140], sell: [170, 200], brokenBuy: [40, 65] },
] as const;
const IPHONE_MODELS = [
  { model: "iPhone 13 128GB", buy: [260, 320], sell: [380, 430] },
  { model: "iPhone 14 Pro 256GB", buy: [520, 600], sell: [690, 760] },
  { model: "iPhone 12 64GB", buy: [170, 220], sell: [260, 300] },
  { model: "iPhone 15 128GB", buy: [480, 540], sell: [620, 680] },
] as const;
const PARTS = [
  { sku: "PT-OLED-SCR", name: "Switch OLED Screen", compatible: "Switch OLED", cost: 48, reorder: 3 },
  { sku: "PT-V2-LCD", name: "Switch V2 LCD", compatible: "Switch V1/V2", cost: 22, reorder: 4 },
  { sku: "PT-JC-STICK", name: "Joy-Con Analog Stick", compatible: "Joy-Con", cost: 3.5, reorder: 15 },
  { sku: "PT-USBC", name: "USB-C Charging Port", compatible: "Switch (all)", cost: 4, reorder: 10 },
  { sku: "PT-FAN", name: "Cooling Fan", compatible: "Switch V1/V2", cost: 6, reorder: 5 },
  { sku: "PT-HDMI-IC", name: "M92T36 Power IC", compatible: "Switch (all)", cost: 2.5, reorder: 10 },
  { sku: "PT-IP13-SCR", name: "iPhone 13 OLED Screen", compatible: "iPhone 13", cost: 65, reorder: 2 },
  { sku: "PT-IP-BAT", name: "iPhone Battery", compatible: "iPhone 11–14", cost: 14, reorder: 6 },
  { sku: "PT-IP12-SCR", name: "iPhone 12 Screen", compatible: "iPhone 12/12 Pro", cost: 38, reorder: 2 },
] as const;
const REPAIRS = [
  { device: "SWITCH_OLED", problem: "Cracked screen", part: "PT-OLED-SCR", price: [120, 150], labor: 20 },
  { device: "SWITCH", problem: "Not charging – USB-C port", part: "PT-USBC", price: [65, 85], labor: 15 },
  { device: "SWITCH", problem: "No power – power IC", part: "PT-HDMI-IC", price: [80, 110], labor: 25 },
  { device: "JOYCON", problem: "Joy-Con drift", part: "PT-JC-STICK", price: [25, 35], labor: 6 },
  { device: "SWITCH", problem: "Overheating – fan replacement", part: "PT-FAN", price: [55, 70], labor: 12 },
  { device: "IPHONE", problem: "Battery replacement", part: "PT-IP-BAT", price: [70, 90], labor: 12 },
  { device: "IPHONE", problem: "Cracked screen", part: "PT-IP13-SCR", price: [160, 200], labor: 20 },
] as const;
const NAMES = ["Marcus Lee", "Ana Rivera", "Jordan Smith", "Priya Patel", "Diego Santos", "Kim Nguyen", "Sam Taylor", "Chris Johnson", "Lena Cruz", "Tyler Brooks", "Maya Reyes", "Noah Kim", "Ava Garcia", "Eli Thompson", "Zoe Martin"];

async function main() {
  console.log("Seeding chart of accounts…");
  for (const a of CHART_OF_ACCOUNTS)
    await db.account.upsert({ where: { code: a.code }, create: { ...a, isSystem: true }, update: { name: a.name, type: a.type, category: a.category } });

  if (process.env.SEED_DEMO === "false") {
    console.log("Chart of accounts ready (demo data skipped).");
    return;
  }
  if ((await db.transaction.count()) > 0) {
    console.log("Transactions already exist – skipping demo data.");
    return;
  }

  const actor = "Seed";
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  const suppliers = await Promise.all(
    ["iFixit Wholesale", "AliExpress Parts", "Local Marketplace Sellers", "GameStop Trade-ins"].map((name) => db.supplier.create({ data: { name } })),
  );
  const customers = await Promise.all(NAMES.map((name, i) => db.customer.create({ data: { name, phone: `555-01${String(i).padStart(2, "0")}` } })));

  await postTransaction(db, { type: "OWNER_CONTRIBUTION", amount: 15000, method: "BANK", date: start, description: "Opening capital" }, actor);

  // initial parts stock
  const partIds: Record<string, string> = {};
  for (const p of PARTS) {
    const t = await postTransaction(db, { type: "PARTS_PURCHASE", date: start, quantity: p.reorder * 3, unitCost: p.cost, method: "BANK", supplierId: suppliers[1].id, newPart: { sku: p.sku, name: p.name, compatible: p.compatible, reorderLevel: p.reorder } }, actor);
    void t;
    partIds[p.sku] = (await db.part.findUniqueOrThrow({ where: { sku: p.sku } })).id;
  }

  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const isCurrent = m === 11;
    const lastDay = isCurrent ? Math.max(1, today.getDate()) : daysInMonth;
    const day = (d: number) => new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(d, lastDay), 10 + Math.floor(rand() * 8));
    const growth = 1 + m * 0.06; // business is growing
    const seasonal = [10, 11].includes(monthStart.getMonth()) ? 1.35 : 1; // holiday bump

    // ── Fixed monthly expenses
    await postTransaction(db, { type: "EXPENSE", category: "RENT", amount: 900, method: "BANK", date: day(1), description: "Shop rent" }, actor);
    await postTransaction(db, { type: "EXPENSE", category: "INTERNET", amount: 79.99, method: "CARD", date: day(3), description: "Fiber internet" }, actor);
    await postTransaction(db, { type: "EXPENSE", category: "UTILITIES", amount: between(140, 210), method: "BANK", date: day(5), description: "Electric & water" }, actor);
    await postTransaction(db, { type: "EXPENSE", category: "MARKETING", amount: between(120, 320), method: "CARD", date: day(8), description: "Facebook Marketplace & IG ads" }, actor);
    await postTransaction(db, { type: "EXPENSE", category: "LABOR", amount: between(600, 900), method: "BANK", date: day(15), description: "Front-desk helper payroll" }, actor);
    for (let i = 0; i < 6; i++) await postTransaction(db, { type: "EXPENSE", category: "FUEL", amount: between(35, 65), method: "CARD", date: day(2 + i * 5), description: "Gas – pickups & meetups" }, actor);
    for (let i = 0; i < 8; i++) await postTransaction(db, { type: "EXPENSE", category: "FOOD", amount: between(12, 38), method: "CARD", date: day(1 + i * 4), description: "Team lunch" }, actor);
    for (let i = 0; i < 3; i++) await postTransaction(db, { type: "EXPENSE", category: "SHIPPING", amount: between(12, 30), method: "CARD", date: day(4 + i * 9), description: "Shipping labels" }, actor);
    if (chance(0.4)) await postTransaction(db, { type: "EXPENSE", category: "TOOLS", amount: between(40, 180), method: "CARD", date: day(12), description: "Soldering / tools" }, actor);
    if (chance(0.5)) await postTransaction(db, { type: "EXPENSE", category: "MISC", amount: between(20, 90), method: "CASH", date: day(20), description: "Supplies" }, actor);
    if (chance(0.5)) await postTransaction(db, { type: "EXPENSE", category: "PARTS", amount: between(25, 70), method: "CARD", date: day(18), description: "Screws, adhesive, thermal paste" }, actor);

    // ── Parts restock
    for (const p of PARTS) {
      const part = await db.part.findUniqueOrThrow({ where: { id: partIds[p.sku] } });
      if (part.quantity <= p.reorder * 2 && !(isCurrent && chance(0.6)))
        await postTransaction(db, { type: "PARTS_PURCHASE", partId: part.id, quantity: p.reorder * 3, unitCost: Math.round(p.cost * between(0.9, 1.1) * 100) / 100, method: chance(0.3) ? "ON_ACCOUNT" : "BANK", supplierId: pick(suppliers).id, date: day(2) }, actor);
    }

    // ── Working Switch flips
    const flips = Math.round(11 * growth * seasonal);
    for (let i = 0; i < flips; i++) {
      const s = pick(SWITCH_MODELS);
      const buyDay = 1 + Math.floor(rand() * (lastDay - 1));
      const t = await postTransaction(db, { type: "PURCHASE", amount: rng(s.buy), method: chance(0.7) ? "CASH" : "BANK", supplierId: suppliers[2].id, date: day(buyDay), unit: { productLine: "SWITCH", model: s.model, condition: chance(0.5) ? "USED" : "LIKE_NEW", listPrice: rng(s.sell) } }, actor);
      if (!isCurrent || chance(0.4)) {
        const sellDay = Math.min(lastDay, buyDay + 2 + Math.floor(rand() * 14));
        const unit = await db.inventoryUnit.findUniqueOrThrow({ where: { id: t.unitId! } });
        if (sellDay <= lastDay && chance(0.92))
          await postTransaction(db, { type: "SALE", unitId: unit.id, amount: Math.round(Number(unit.listPrice) * between(0.94, 1.0)), method: pick(["CASH", "CARD", "BANK"] as const), customerId: pick(customers).id, date: day(sellDay) }, actor);
      }
    }

    // ── Broken Switch → refurbish → resell
    const broken = Math.round(7 * growth * seasonal);
    for (let i = 0; i < broken; i++) {
      const s = pick(SWITCH_MODELS);
      const buyDay = 1 + Math.floor(rand() * Math.max(1, lastDay - 5));
      const t = await postTransaction(db, { type: "PURCHASE", amount: rng(s.brokenBuy), method: "CASH", supplierId: suppliers[2].id, date: day(buyDay), unit: { productLine: "SWITCH", model: s.model, condition: "BROKEN", listPrice: rng(s.sell) * 0.95 } }, actor);
      if (isCurrent && chance(0.5)) continue; // still broken
      const partSku = s.model === "Switch OLED" ? pick(["PT-OLED-SCR", "PT-USBC", "PT-HDMI-IC"]) : s.model === "Switch Lite" ? pick(["PT-USBC", "PT-JC-STICK", "PT-HDMI-IC"]) : pick(["PT-V2-LCD", "PT-USBC", "PT-FAN", "PT-HDMI-IC"]);
      const part = await db.part.findUniqueOrThrow({ where: { id: partIds[partSku] } });
      const complete = !(isCurrent && chance(0.4));
      await postTransaction(db, { type: "REFURBISH", unitId: t.unitId!, parts: part.quantity > 0 ? [{ partId: part.id, quantity: 1 }] : [], laborCost: between(10, 25), complete, date: day(buyDay + 2) }, actor);
      if (complete && (!isCurrent || chance(0.5)) && chance(0.9)) {
        const unit = await db.inventoryUnit.findUniqueOrThrow({ where: { id: t.unitId! } });
        await postTransaction(db, { type: "SALE", unitId: unit.id, amount: Math.round(Number(unit.listPrice)), method: pick(["CASH", "CARD"] as const), customerId: pick(customers).id, date: day(buyDay + 6 + Math.floor(rand() * 10)) }, actor);
      }
    }

    // ── iPhone flips
    const phones = Math.round(5 * growth * seasonal);
    for (let i = 0; i < phones; i++) {
      const p = pick(IPHONE_MODELS);
      const buyDay = 1 + Math.floor(rand() * (lastDay - 1));
      const t = await postTransaction(db, { type: "PURCHASE", amount: rng(p.buy), method: "BANK", supplierId: pick([suppliers[2], suppliers[3]]).id, date: day(buyDay), unit: { productLine: "IPHONE", model: p.model, condition: "USED", listPrice: rng(p.sell) } }, actor);
      if ((!isCurrent || chance(0.3)) && chance(0.88)) {
        const unit = await db.inventoryUnit.findUniqueOrThrow({ where: { id: t.unitId! } });
        await postTransaction(db, { type: "SALE", unitId: unit.id, amount: Math.round(Number(unit.listPrice) * between(0.95, 1)), method: pick(["CARD", "BANK"] as const), customerId: pick(customers).id, date: day(buyDay + 3 + Math.floor(rand() * 12)) }, actor);
      }
    }

    // ── Accessories (non-serialised)
    for (let i = 0; i < Math.round(8 * growth); i++)
      await postTransaction(db, { type: "SALE", category: "ACCESSORY_SALES", amount: between(12, 45), method: pick(["CASH", "CARD"] as const), date: day(1 + Math.floor(rand() * lastDay)), description: pick(["Tempered glass", "Carrying case", "Joy-Con grips", "Charging dock", "USB-C cable"]) }, actor);

    // ── Customer repairs
    const jobs = Math.round(20 * growth * seasonal);
    for (let i = 0; i < jobs; i++) {
      const r = pick(REPAIRS);
      const receivedDay = 1 + Math.floor(rand() * (lastDay - 1));
      const job = await createRepair(db, { customerId: pick(customers).id, deviceType: r.device, deviceModel: r.device === "IPHONE" ? pick(["iPhone 12", "iPhone 13", "iPhone 14"]) : undefined, problem: r.problem, price: Math.round(rng(r.price)), laborCost: r.labor, deposit: chance(0.4) ? 20 : 0, receivedAt: day(receivedDay), dueAt: day(receivedDay + 4) }, actor);
      const part = await db.part.findUniqueOrThrow({ where: { id: partIds[r.part] } });
      const recent = isCurrent && receivedDay > lastDay - 10;
      if (part.quantity > 0 && (!recent || chance(0.5))) await issuePartToRepair(db, job.id, part.id, 1, actor);
      if (recent) {
        const stage = pick(["DIAGNOSING", "WAITING_FOR_PARTS", "REPAIRING", "TESTING", "READY_FOR_PICKUP"] as const);
        await changeRepairStatus(db, job.id, stage, {}, actor);
      } else {
        await changeRepairStatus(db, job.id, "DIAGNOSING", {}, actor);
        await changeRepairStatus(db, job.id, "REPAIRING", {}, actor);
        await changeRepairStatus(db, job.id, "COMPLETED", { method: pick(["CASH", "CARD"] as const) }, actor);
        // backdate completion so it lands in the right month
        const done = day(receivedDay + 2);
        await db.repairJob.update({ where: { id: job.id }, data: { completedAt: done } });
        const inv = await db.transaction.findFirst({ where: { repairId: job.id, type: "REPAIR" } });
        if (inv) {
          await db.transaction.update({ where: { id: inv.id }, data: { date: done } });
          await db.journalEntry.updateMany({ where: { transactionId: inv.id }, data: { date: done } });
        }
        await db.journalEntry.updateMany({ where: { memo: { startsWith: `Parts issued to ${job.jobNumber}:` } }, data: { date: day(receivedDay) } });
      }
    }

    // ── Pay technician labor, supplier balances, occasional refunds & other income
    const accrued = await db.journalLine.aggregate({ where: { account: { code: "2300" } }, _sum: { credit: true, debit: true } });
    const owedLabor = Number(accrued._sum.credit ?? 0) - Number(accrued._sum.debit ?? 0);
    if (owedLabor > 0) await postTransaction(db, { type: "WAGES_PAYMENT", amount: Math.round(owedLabor * 100) / 100, method: "CASH", date: day(28), description: "Technician payout" }, actor);
    const ap = await db.journalLine.aggregate({ where: { account: { code: "2000" } }, _sum: { credit: true, debit: true } });
    const owed = Number(ap._sum.credit ?? 0) - Number(ap._sum.debit ?? 0);
    if (owed > 0 && !isCurrent) await postTransaction(db, { type: "SUPPLIER_PAYMENT", amount: Math.round(owed * 100) / 100, method: "BANK", supplierId: suppliers[1].id, date: day(25) }, actor);
    if (chance(0.5)) await postTransaction(db, { type: "REFUND", amount: between(15, 60), method: "CARD", customerId: pick(customers).id, date: day(19), description: "Partial refund – cosmetic issue" }, actor);
    if (chance(0.3)) await postTransaction(db, { type: "OTHER_INCOME", amount: between(30, 120), method: "CASH", date: day(22), description: "Data transfer / setup service" }, actor);
    if (m % 3 === 2) await postTransaction(db, { type: "OWNER_DRAW", amount: 1200, method: "BANK", date: day(28) }, actor);

    console.log(`  ✓ ${monthStart.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`);
  }

  // Age a few units so aging alerts show up
  const stale = await db.inventoryUnit.findMany({ where: { status: { in: ["IN_STOCK", "READY"] } }, take: 3 });
  for (const [i, u] of stale.entries()) {
    const d = new Date(today.getTime() - (75 + i * 30) * 86_400_000);
    await db.inventoryUnit.update({ where: { id: u.id }, data: { acquiredAt: d } });
  }

  const totals = await db.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  console.log(`Done. Ledger debits ${totals._sum.debit} = credits ${totals._sum.credit}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
