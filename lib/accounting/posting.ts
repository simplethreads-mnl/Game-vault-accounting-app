/**
 * Posting engine: turns business events into balanced double-entry journal
 * entries and keeps operational tables (inventory, parts, repairs) in sync —
 * all inside one database transaction, with an audit-log record.
 */
import { Prisma, type PaymentMethod, type PrismaClient, type ProductLine } from "@prisma/client";
import { z } from "zod";
import { ACCOUNT_BY_CATEGORY, EXPENSE_CATEGORIES } from "./chart";
import { assertBalanced, type DraftLine } from "./ledger";
import { dec, round2 } from "./money";
import { weightedAverageCost } from "./metrics";
import { TX_OPTIONS } from "../db";

type Tx = Prisma.TransactionClient;

// ───────────────────────────── Input schemas ─────────────────────────────────

const money = z.coerce.number().finite().nonnegative();
/**
 * A bare "YYYY-MM-DD" from a date picker is stored at 12:00 UTC so it stays on the
 * same calendar day in every timezone from UTC-11 to UTC+11 (plain parsing gives
 * midnight UTC, which shows as the previous day in the Americas).
 */
export const businessDate = z.preprocess(
  (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00Z`) : v),
  z.coerce.date(),
);
const date = businessDate.default(() => new Date());
const method = z.enum(["CASH", "BANK", "CARD", "ON_ACCOUNT"]).default("CASH");
const base = { date, description: z.string().trim().max(300).optional(), notes: z.string().max(2000).optional() };

export const transactionInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PURCHASE"),
    ...base,
    amount: money,
    method,
    supplierId: z.string().optional(),
    unit: z.object({
      productLine: z.enum(["SWITCH", "IPHONE", "ACCESSORY"]),
      model: z.string().trim().min(1),
      serial: z.string().trim().optional(),
      condition: z.enum(["NEW", "LIKE_NEW", "USED", "BROKEN", "REFURBISHED"]),
      listPrice: money,
    }),
  }),
  z.object({
    type: z.literal("SALE"),
    ...base,
    amount: money,
    method,
    customerId: z.string().optional(),
    unitId: z.string().optional(),
    /** for non-serialised sales (accessories, misc) */
    category: z.enum(["SWITCH_SALES", "IPHONE_SALES", "ACCESSORY_SALES", "OTHER_INCOME"]).optional(),
  }),
  z.object({
    type: z.literal("REFURBISH"),
    ...base,
    unitId: z.string(),
    parts: z.array(z.object({ partId: z.string(), quantity: z.coerce.number().int().positive() })).default([]),
    laborCost: money.default(0),
    complete: z.boolean().default(true),
  }),
  z.object({ type: z.literal("REPAIR"), ...base, repairId: z.string(), method }),
  z.object({
    type: z.literal("PARTS_PURCHASE"),
    ...base,
    method,
    supplierId: z.string().optional(),
    partId: z.string().optional(),
    newPart: z.object({ sku: z.string().min(1), name: z.string().min(1), compatible: z.string().optional(), reorderLevel: z.coerce.number().int().nonnegative().default(3) }).optional(),
    quantity: z.coerce.number().int().positive(),
    unitCost: money,
  }),
  z.object({ type: z.literal("EXPENSE"), ...base, amount: money, method, category: z.enum(EXPENSE_CATEGORIES), supplierId: z.string().optional() }),
  z.object({ type: z.literal("SUPPLIER_PAYMENT"), ...base, amount: money, method: z.enum(["CASH", "BANK", "CARD"]).default("BANK"), supplierId: z.string().optional() }),
  z.object({ type: z.literal("WAGES_PAYMENT"), ...base, amount: money, method: z.enum(["CASH", "BANK", "CARD"]).default("CASH") }),
  z.object({ type: z.literal("CUSTOMER_PAYMENT"), ...base, amount: money, method: z.enum(["CASH", "BANK", "CARD"]).default("CASH"), customerId: z.string().optional(), repairId: z.string().optional() }),
  z.object({ type: z.literal("REFUND"), ...base, amount: money, method: z.enum(["CASH", "BANK", "CARD"]).default("CASH"), customerId: z.string().optional(), unitId: z.string().optional(), restock: z.boolean().default(false) }),
  z.object({ type: z.literal("OTHER_INCOME"), ...base, amount: money, method }),
  z.object({ type: z.literal("OWNER_CONTRIBUTION"), ...base, amount: money, method: z.enum(["CASH", "BANK"]).default("BANK") }),
  z.object({ type: z.literal("OWNER_DRAW"), ...base, amount: money, method: z.enum(["CASH", "BANK"]).default("BANK") }),
  z.object({
    type: z.literal("MISC"),
    ...base,
    description: z.string().trim().min(1),
    lines: z.array(z.object({ code: z.string(), debit: money.default(0), credit: money.default(0), memo: z.string().optional() })).min(2),
  }),
]);

export type TransactionInput = z.input<typeof transactionInput>;

// ───────────────────────────── Helpers ───────────────────────────────────────

/** Account that receives money in (cash/bank) or AR when on account. */
const inAccount = (m: PaymentMethod) => (m === "CASH" ? "1000" : m === "ON_ACCOUNT" ? "1100" : "1010");
/** Account money leaves from, or AP when on account. */
const outAccount = (m: PaymentMethod) => (m === "CASH" ? "1000" : m === "ON_ACCOUNT" ? "2000" : "1010");

const SALES_ACCOUNT: Record<ProductLine, string> = { SWITCH: "4000", IPHONE: "4010", ACCESSORY: "4200" };
const SALES_CATEGORY: Record<ProductLine, string> = { SWITCH: "SWITCH_SALES", IPHONE: "IPHONE_SALES", ACCESSORY: "ACCESSORY_SALES" };
const COGS_ACCOUNT: Record<ProductLine, string> = { SWITCH: "5000", IPHONE: "5010", ACCESSORY: "5020" };
const isSwitchDevice = (d: string) => d.startsWith("SWITCH") || d === "JOYCON";

export class PostingError extends Error {}

async function nextNumber(tx: Tx, key: string, prefix: string, pad = 6, start = 0) {
  const c = await tx.counter.upsert({ where: { key }, create: { key, value: start + 1 }, update: { value: { increment: 1 } } });
  return `${prefix}${String(c.value).padStart(pad, "0")}`;
}
export const nextReference = (tx: Tx) => nextNumber(tx, "transaction", "TX-");
export const nextSku = (tx: Tx, line: ProductLine) => nextNumber(tx, `sku-${line}`, `${line.slice(0, 2)}-`, 5);
export const nextJobNumber = (tx: Tx) => nextNumber(tx, "repair", "RJ-", 4, 1000);

async function accountIds(tx: Tx) {
  const accounts = await tx.account.findMany({ select: { id: true, code: true } });
  return new Map(accounts.map((a) => [a.code, a.id]));
}

export async function writeEntry(
  tx: Tx,
  args: { date: Date; memo: string; lines: DraftLine[]; transactionId?: string; actor: string; reversesId?: string },
) {
  const lines = assertBalanced(args.lines);
  const ids = await accountIds(tx);
  for (const l of lines) if (!ids.has(l.code)) throw new PostingError(`Unknown account code ${l.code}`);
  return tx.journalEntry.create({
    data: {
      date: args.date,
      memo: args.memo,
      transactionId: args.transactionId,
      reversesId: args.reversesId,
      createdBy: args.actor,
      lines: {
        create: lines.map((l) => ({
          accountId: ids.get(l.code)!,
          debit: round2(l.debit ?? 0),
          credit: round2(l.credit ?? 0),
          memo: l.memo,
          unitId: l.unitId,
          repairId: l.repairId,
        })),
      },
    },
  });
}

export async function audit(
  tx: Tx,
  a: { entity: string; entityId: string; action: string; summary: string; before?: unknown; after?: unknown; actor: string },
) {
  await tx.auditLog.create({
    data: {
      entity: a.entity,
      entityId: a.entityId,
      action: a.action,
      summary: a.summary,
      before: a.before === undefined ? undefined : (JSON.parse(JSON.stringify(a.before)) as Prisma.InputJsonValue),
      after: a.after === undefined ? undefined : (JSON.parse(JSON.stringify(a.after)) as Prisma.InputJsonValue),
      actor: a.actor,
    },
  });
}

// ───────────────────────────── Main entry point ──────────────────────────────

export async function postTransaction(db: PrismaClient, raw: TransactionInput, actor = "system") {
  const input = transactionInput.parse(raw);
  return db.$transaction(async (tx) => {
    const reference = await nextReference(tx);
    const lines: DraftLine[] = [];
    let amount = 0;
    let description = input.description ?? "";
    const link: { unitId?: string; repairId?: string; customerId?: string; supplierId?: string; category?: string; method?: PaymentMethod } = {};
    let sideEffect: (() => Promise<unknown>) | null = null;

    switch (input.type) {
      case "PURCHASE": {
        const sku = await nextSku(tx, input.unit.productLine);
        const broken = input.unit.condition === "BROKEN";
        const unit = await tx.inventoryUnit.create({
          data: {
            sku,
            productLine: input.unit.productLine,
            model: input.unit.model,
            serial: input.unit.serial,
            condition: input.unit.condition,
            status: broken ? "BROKEN" : "IN_STOCK",
            purchaseCost: input.amount,
            costBasis: input.amount,
            listPrice: input.unit.listPrice,
            acquiredAt: input.date,
          },
        });
        amount = input.amount;
        description ||= `Bought ${broken ? "broken " : ""}${unit.model} (${sku})`;
        lines.push({ code: "1200", debit: amount, unitId: unit.id }, { code: outAccount(input.method), credit: amount });
        Object.assign(link, { unitId: unit.id, supplierId: input.supplierId, method: input.method });
        break;
      }

      case "SALE": {
        amount = input.amount;
        Object.assign(link, { customerId: input.customerId, method: input.method });
        if (input.unitId) {
          const unit = await tx.inventoryUnit.findUniqueOrThrow({ where: { id: input.unitId } });
          if (!["IN_STOCK", "READY", "RETURNED"].includes(unit.status))
            throw new PostingError(`${unit.sku} is ${unit.status} and cannot be sold`);
          const cost = dec(unit.costBasis);
          lines.push(
            { code: inAccount(input.method), debit: amount },
            { code: SALES_ACCOUNT[unit.productLine], credit: amount, unitId: unit.id },
            { code: COGS_ACCOUNT[unit.productLine], debit: cost, unitId: unit.id },
            { code: "1200", credit: cost, unitId: unit.id },
          );
          description ||= `Sold ${unit.model} (${unit.sku})`;
          link.unitId = unit.id;
          link.category = SALES_CATEGORY[unit.productLine];
          sideEffect = () =>
            tx.inventoryUnit.update({ where: { id: unit.id }, data: { status: "SOLD", salePrice: amount, soldAt: input.date } });
        } else {
          const cat = input.category ?? "ACCESSORY_SALES";
          lines.push({ code: inAccount(input.method), debit: amount }, { code: ACCOUNT_BY_CATEGORY[cat].code, credit: amount });
          description ||= `Sale – ${ACCOUNT_BY_CATEGORY[cat].name}`;
          link.category = cat;
        }
        break;
      }

      case "REFURBISH": {
        const unit = await tx.inventoryUnit.findUniqueOrThrow({ where: { id: input.unitId } });
        if (!["BROKEN", "IN_REPAIR", "RETURNED", "IN_STOCK"].includes(unit.status))
          throw new PostingError(`${unit.sku} is ${unit.status}; only unsold units can be refurbished`);
        let partsCost = 0;
        for (const p of input.parts) {
          const part = await tx.part.findUniqueOrThrow({ where: { id: p.partId } });
          if (part.quantity < p.quantity) throw new PostingError(`Only ${part.quantity} × ${part.name} in stock`);
          const cost = round2(dec(part.avgCost) * p.quantity);
          partsCost += cost;
          await tx.part.update({ where: { id: part.id }, data: { quantity: { decrement: p.quantity } } });
          await tx.partUsage.create({ data: { partId: part.id, quantity: p.quantity, unitCost: part.avgCost, unitId: unit.id } });
        }
        partsCost = round2(partsCost);
        amount = round2(partsCost + input.laborCost);
        lines.push(
          { code: "1200", debit: amount, unitId: unit.id, memo: "Capitalised refurbishment" },
          { code: "1210", credit: partsCost },
          { code: "2300", credit: input.laborCost },
        );
        description ||= `Refurbished ${unit.model} (${unit.sku})`;
        link.unitId = unit.id;
        sideEffect = () =>
          tx.inventoryUnit.update({
            where: { id: unit.id },
            data: {
              costBasis: { increment: amount },
              status: input.complete ? "READY" : "IN_REPAIR",
              condition: input.complete ? "REFURBISHED" : unit.condition,
            },
          });
        break;
      }

      case "REPAIR": {
        const job = await tx.repairJob.findUniqueOrThrow({ where: { id: input.repairId }, include: { customer: true } });
        if (job.invoiced) throw new PostingError(`${job.jobNumber} has already been invoiced`);
        const price = dec(job.price);
        const deposit = Math.min(dec(job.deposit), price);
        const parts = dec(job.partsCost);
        const labor = dec(job.laborCost);
        amount = price;
        lines.push(
          { code: "2200", debit: deposit, repairId: job.id, memo: "Apply deposit" },
          { code: inAccount(input.method), debit: round2(price - deposit) },
          { code: isSwitchDevice(job.deviceType) ? "4100" : "4110", credit: price, repairId: job.id },
          { code: "5100", debit: parts, repairId: job.id },
          { code: "1220", credit: parts, repairId: job.id },
          { code: "5110", debit: labor, repairId: job.id },
          { code: "2300", credit: labor, repairId: job.id },
        );
        description ||= `Repair ${job.jobNumber} – ${job.customer.name}`;
        Object.assign(link, { repairId: job.id, customerId: job.customerId, method: input.method, category: isSwitchDevice(job.deviceType) ? "SWITCH_REPAIRS" : "PHONE_REPAIRS" });
        sideEffect = () => tx.repairJob.update({ where: { id: job.id }, data: { invoiced: true, completedAt: job.completedAt ?? input.date } });
        break;
      }

      case "PARTS_PURCHASE": {
        let part = input.partId ? await tx.part.findUniqueOrThrow({ where: { id: input.partId } }) : null;
        if (!part) {
          if (!input.newPart) throw new PostingError("Choose an existing part or describe a new one");
          part = await tx.part.create({ data: { ...input.newPart, quantity: 0, avgCost: 0 } });
        }
        amount = round2(input.quantity * input.unitCost);
        const avg = weightedAverageCost(part.quantity, dec(part.avgCost), input.quantity, input.unitCost);
        const p = part;
        sideEffect = () => tx.part.update({ where: { id: p.id }, data: { quantity: { increment: input.quantity }, avgCost: avg } });
        lines.push({ code: "1210", debit: amount }, { code: outAccount(input.method), credit: amount });
        description ||= `Bought ${input.quantity} × ${part.name}`;
        Object.assign(link, { supplierId: input.supplierId, method: input.method });
        break;
      }

      case "EXPENSE": {
        amount = input.amount;
        lines.push({ code: ACCOUNT_BY_CATEGORY[input.category].code, debit: amount }, { code: outAccount(input.method), credit: amount });
        description ||= ACCOUNT_BY_CATEGORY[input.category].name;
        Object.assign(link, { category: input.category, supplierId: input.supplierId, method: input.method });
        break;
      }

      case "SUPPLIER_PAYMENT":
        amount = input.amount;
        lines.push({ code: "2000", debit: amount }, { code: outAccount(input.method), credit: amount });
        description ||= "Supplier payment";
        Object.assign(link, { supplierId: input.supplierId, method: input.method });
        break;

      case "WAGES_PAYMENT":
        amount = input.amount;
        lines.push({ code: "2300", debit: amount }, { code: outAccount(input.method), credit: amount });
        description ||= "Technician labor paid";
        link.method = input.method;
        break;

      case "CUSTOMER_PAYMENT": {
        amount = input.amount;
        if (input.repairId) {
          const job = await tx.repairJob.findUniqueOrThrow({ where: { id: input.repairId } });
          if (job.invoiced) throw new PostingError(`${job.jobNumber} is already invoiced — record a payment against AR instead`);
          lines.push({ code: inAccount(input.method), debit: amount }, { code: "2200", credit: amount, repairId: job.id });
          description ||= `Deposit for ${job.jobNumber}`;
          link.repairId = job.id;
          link.customerId = job.customerId;
          sideEffect = () => tx.repairJob.update({ where: { id: job.id }, data: { deposit: { increment: amount } } });
        } else {
          lines.push({ code: inAccount(input.method), debit: amount }, { code: "1100", credit: amount });
          description ||= "Customer payment (AR)";
          link.customerId = input.customerId;
        }
        link.method = input.method;
        break;
      }

      case "REFUND": {
        amount = input.amount;
        lines.push({ code: "4950", debit: amount }, { code: outAccount(input.method), credit: amount });
        Object.assign(link, { customerId: input.customerId, method: input.method, category: "REFUNDS" });
        if (input.unitId) {
          const unit = await tx.inventoryUnit.findUniqueOrThrow({ where: { id: input.unitId } });
          link.unitId = unit.id;
          description ||= `Refund for ${unit.model} (${unit.sku})`;
          if (input.restock) {
            if (unit.status !== "SOLD") throw new PostingError(`${unit.sku} is not sold; nothing to restock`);
            const cost = dec(unit.costBasis);
            lines.push({ code: "1200", debit: cost, unitId: unit.id }, { code: COGS_ACCOUNT[unit.productLine], credit: cost, unitId: unit.id });
            sideEffect = () => tx.inventoryUnit.update({ where: { id: unit.id }, data: { status: "RETURNED", soldAt: null, salePrice: null } });
          }
        }
        description ||= "Customer refund";
        break;
      }

      case "OTHER_INCOME":
        amount = input.amount;
        lines.push({ code: inAccount(input.method), debit: amount }, { code: "4900", credit: amount });
        description ||= "Other income";
        Object.assign(link, { category: "OTHER_INCOME", method: input.method });
        break;

      case "OWNER_CONTRIBUTION":
        amount = input.amount;
        lines.push({ code: inAccount(input.method), debit: amount }, { code: "3000", credit: amount });
        description ||= "Owner contribution";
        link.method = input.method;
        break;

      case "OWNER_DRAW":
        amount = input.amount;
        lines.push({ code: "3100", debit: amount }, { code: outAccount(input.method), credit: amount });
        description ||= "Owner draw";
        link.method = input.method;
        break;

      case "MISC":
        lines.push(...input.lines);
        amount = round2(input.lines.reduce((a, l) => a + (l.debit ?? 0), 0));
        break;
    }

    const record = await tx.transaction.create({
      data: {
        reference,
        type: input.type,
        date: input.date,
        description,
        amount,
        method: link.method ?? "CASH",
        category: link.category,
        customerId: link.customerId,
        supplierId: link.supplierId,
        unitId: link.unitId,
        repairId: link.repairId,
        notes: input.notes,
        createdBy: actor,
      },
    });
    await writeEntry(tx, { date: input.date, memo: `${reference} · ${description}`, lines, transactionId: record.id, actor });
    if (sideEffect) await sideEffect();
    await audit(tx, { entity: "Transaction", entityId: record.id, action: "CREATE", summary: `${reference} ${input.type} ${amount.toFixed(2)} – ${description}`, after: record, actor });
    return record;
  }, TX_OPTIONS);
}

/**
 * Voiding never deletes history: it posts an exact reversing entry and rolls
 * back operational side effects where that is safe.
 */
export async function voidTransaction(db: PrismaClient, id: string, reason: string, actor = "system") {
  return db.$transaction(async (tx) => {
    const t = await tx.transaction.findUniqueOrThrow({
      where: { id },
      include: { entries: { include: { lines: { include: { account: true } }, reversedBy: true } } },
    });
    if (t.status === "VOIDED") throw new PostingError(`${t.reference} is already voided`);

    for (const e of t.entries) {
      if (e.reversedBy || e.reversesId) continue;
      await writeEntry(tx, {
        date: new Date(),
        memo: `VOID ${t.reference}: ${reason}`,
        reversesId: e.id,
        transactionId: t.id,
        actor,
        lines: e.lines.map((l) => ({ code: l.account.code, debit: dec(l.credit), credit: dec(l.debit), unitId: l.unitId ?? undefined, repairId: l.repairId ?? undefined })),
      });
    }

    // Roll back side effects
    if (t.unitId) {
      const unit = await tx.inventoryUnit.findUnique({ where: { id: t.unitId } });
      if (unit) {
        if (t.type === "SALE" && unit.status === "SOLD")
          await tx.inventoryUnit.update({ where: { id: unit.id }, data: { status: unit.condition === "REFURBISHED" ? "READY" : "IN_STOCK", salePrice: null, soldAt: null } });
        if (t.type === "PURCHASE") {
          if (unit.status === "SOLD") throw new PostingError(`Void the sale of ${unit.sku} first`);
          await tx.inventoryUnit.update({ where: { id: unit.id }, data: { status: "WRITTEN_OFF", notes: `Purchase ${t.reference} voided` } });
        }
        if (t.type === "REFURBISH") {
          await tx.inventoryUnit.update({ where: { id: unit.id }, data: { costBasis: { decrement: dec(t.amount) } } });
          const usages = await tx.partUsage.findMany({ where: { unitId: unit.id, createdAt: { gte: t.createdAt } } });
          for (const u of usages) await tx.part.update({ where: { id: u.partId }, data: { quantity: { increment: u.quantity } } });
        }
      }
    }
    if (t.repairId) {
      if (t.type === "REPAIR") await tx.repairJob.update({ where: { id: t.repairId }, data: { invoiced: false } });
      if (t.type === "CUSTOMER_PAYMENT") await tx.repairJob.update({ where: { id: t.repairId }, data: { deposit: { decrement: dec(t.amount) } } });
    }

    const updated = await tx.transaction.update({ where: { id }, data: { status: "VOIDED", notes: [t.notes, `Voided: ${reason}`].filter(Boolean).join("\n") } });
    await audit(tx, { entity: "Transaction", entityId: id, action: "VOID", summary: `${t.reference} voided – ${reason}`, before: { status: t.status }, after: { status: "VOIDED" }, actor });
    return updated;
  }, TX_OPTIONS);
}

// ───────────────────────────── Repair jobs ───────────────────────────────────

export const repairInput = z.object({
  customerId: z.string().optional(),
  customer: z.object({ name: z.string().trim().min(1), phone: z.string().optional(), email: z.string().optional() }).optional(),
  deviceType: z.enum(["SWITCH", "SWITCH_LITE", "SWITCH_OLED", "JOYCON", "IPHONE", "ANDROID", "OTHER"]),
  deviceModel: z.string().optional(),
  serial: z.string().optional(),
  problem: z.string().trim().min(1),
  price: money.default(0),
  laborCost: money.default(0),
  deposit: money.default(0),
  depositMethod: z.enum(["CASH", "BANK", "CARD"]).default("CASH"),
  dueAt: businessDate.optional(),
  receivedAt: businessDate.optional(),
});

export async function createRepair(db: PrismaClient, raw: z.input<typeof repairInput>, actor = "system") {
  const input = repairInput.parse(raw);
  const job = await db.$transaction(async (tx) => {
    let customerId = input.customerId;
    if (!customerId) {
      if (!input.customer) throw new PostingError("Customer is required");
      customerId = (await tx.customer.create({ data: input.customer })).id;
    }
    const jobNumber = await nextJobNumber(tx);
    const job = await tx.repairJob.create({
      data: {
        jobNumber,
        customerId,
        deviceType: input.deviceType,
        deviceModel: input.deviceModel,
        serial: input.serial,
        problem: input.problem,
        price: input.price,
        laborCost: input.laborCost,
        dueAt: input.dueAt,
        receivedAt: input.receivedAt ?? new Date(),
        history: { create: { to: "RECEIVED", changedBy: actor, note: "Job created" } },
      },
    });
    await audit(tx, { entity: "RepairJob", entityId: job.id, action: "CREATE", summary: `${jobNumber} created – ${input.problem}`, after: job, actor });
    return job;
  }, TX_OPTIONS);
  if (input.deposit > 0)
    await postTransaction(db, { type: "CUSTOMER_PAYMENT", amount: input.deposit, method: input.depositMethod, repairId: job.id }, actor);
  return job;
}

/** Issue parts from stock to a repair job: Dr Repair WIP / Cr Parts Inventory. */
export async function issuePartToRepair(db: PrismaClient, repairId: string, partId: string, quantity: number, actor = "system") {
  return db.$transaction(async (tx) => {
    const job = await tx.repairJob.findUniqueOrThrow({ where: { id: repairId } });
    if (job.invoiced) throw new PostingError(`${job.jobNumber} is invoiced; parts can no longer be added`);
    const part = await tx.part.findUniqueOrThrow({ where: { id: partId } });
    if (part.quantity < quantity) throw new PostingError(`Only ${part.quantity} × ${part.name} in stock`);
    const cost = round2(dec(part.avgCost) * quantity);
    await tx.part.update({ where: { id: partId }, data: { quantity: { decrement: quantity } } });
    const usage = await tx.partUsage.create({ data: { partId, quantity, unitCost: part.avgCost, repairId } });
    await tx.repairJob.update({ where: { id: repairId }, data: { partsCost: { increment: cost } } });
    if (cost > 0)
      await writeEntry(tx, {
        date: new Date(),
        memo: `Parts issued to ${job.jobNumber}: ${quantity} × ${part.name}`,
        actor,
        lines: [
          { code: "1220", debit: cost, repairId },
          { code: "1210", credit: cost },
        ],
      });
    await audit(tx, { entity: "RepairJob", entityId: repairId, action: "UPDATE", summary: `${job.jobNumber}: used ${quantity} × ${part.name} (${cost.toFixed(2)})`, after: usage, actor });
    return usage;
  }, TX_OPTIONS);
}

export const REPAIR_FLOW = ["RECEIVED", "DIAGNOSING", "WAITING_FOR_PARTS", "REPAIRING", "TESTING", "READY_FOR_PICKUP", "COMPLETED"] as const;

export async function changeRepairStatus(
  db: PrismaClient,
  repairId: string,
  to: (typeof REPAIR_FLOW)[number] | "CANCELLED",
  opts: { note?: string; method?: PaymentMethod; price?: number; laborCost?: number; diagnosis?: string } = {},
  actor = "system",
) {
  const job = await db.repairJob.findUniqueOrThrow({ where: { id: repairId } });
  if (job.status === to && opts.price === undefined && opts.laborCost === undefined && opts.diagnosis === undefined) return job;
  if (to === "CANCELLED" && job.invoiced) throw new PostingError("Void the invoice before cancelling an invoiced job");
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.repairJob.update({
      where: { id: repairId },
      data: {
        status: to,
        price: opts.price,
        laborCost: opts.laborCost,
        diagnosis: opts.diagnosis,
        completedAt: to === "COMPLETED" ? new Date() : undefined,
        history: job.status !== to ? { create: { from: job.status, to, note: opts.note, changedBy: actor } } : undefined,
      },
    });
    await audit(tx, { entity: "RepairJob", entityId: repairId, action: "STATUS_CHANGE", summary: `${job.jobNumber}: ${job.status} → ${to}`, before: { status: job.status, price: job.price, laborCost: job.laborCost }, after: { status: to, price: u.price, laborCost: u.laborCost }, actor });
    return u;
  }, TX_OPTIONS);
  // Completing a job automatically invoices it (revenue + cost recognition).
  if (to === "COMPLETED" && !updated.invoiced)
    await postTransaction(db, { type: "REPAIR", repairId, method: opts.method ?? "CASH" }, actor);
  return updated;
}
