/**
 * Editing posted transactions.
 *
 * Posted journal entries are never changed in place. An edit:
 *   1. reverses the transaction's active journal entries (dated as the originals,
 *      so the original period nets to zero),
 *   2. posts a corrected entry at the (possibly new) date,
 *   3. updates the transaction and its operational records (unit sale price, deposit…),
 *   4. stamps the transaction as edited and writes before/after to the audit log.
 *
 * Only fields that can change without breaking other records are editable; the
 * rules live in `editCapabilities`, which both the API and the edit form use.
 */
import type { PaymentMethod, Prisma, PrismaClient, Transaction } from "@prisma/client";
import { z } from "zod";
import { ACCOUNT_BY_CATEGORY, EXPENSE_CATEGORIES } from "./chart";
import type { DraftLine } from "./ledger";
import { dec, round2, toCents } from "./money";
import { PostingError, audit, businessDate, inAccount, outAccount, writeEntry } from "./posting";
import { TX_OPTIONS } from "../db";

type Tx = Prisma.TransactionClient;

const SALE_CATEGORIES = ["SWITCH_SALES", "IPHONE_SALES", "ACCESSORY_SALES", "PC_PARTS_SALES", "OTHER_INCOME"] as const;

/** Payment methods each type accepts (mirrors the posting schemas). */
const METHODS: Record<string, PaymentMethod[]> = {
  ALL: ["CASH", "BANK", "CARD", "ON_ACCOUNT"],
  NO_ACCOUNT: ["CASH", "BANK", "CARD"],
  OWNER: ["CASH", "BANK"],
};
function methodsFor(type: string): PaymentMethod[] {
  if (["SUPPLIER_PAYMENT", "WAGES_PAYMENT", "CUSTOMER_PAYMENT", "REFUND"].includes(type)) return METHODS.NO_ACCOUNT;
  if (type === "OWNER_CONTRIBUTION" || type === "OWNER_DRAW") return METHODS.OWNER;
  return METHODS.ALL;
}

export type EditCapabilities = {
  editable: boolean;
  reason?: string;
  amount: boolean;
  amountNote?: string;
  methods: PaymentMethod[];
  category: "expense" | "income" | null;
  lines: boolean;
};

type Loaded = Awaited<ReturnType<typeof loadForEdit>>;

async function loadForEdit(db: Tx | PrismaClient, id: string) {
  const t = await db.transaction.findUniqueOrThrow({
    where: { id },
    include: {
      entries: { include: { lines: { include: { account: true } }, reversedBy: true } },
      unit: true,
      repair: true,
    },
  });
  const active = t.entries.filter((e) => !e.reversedBy && !e.reversesId);
  const purchaseUnits =
    t.type === "PURCHASE" ? await db.inventoryUnit.findMany({ where: { OR: [{ purchaseTransactionId: t.id }, ...(t.unitId ? [{ id: t.unitId }] : [])] } }) : [];
  return { t, active, purchaseUnits };
}

export function capabilitiesOf({ t, purchaseUnits }: Pick<Loaded, "t" | "purchaseUnits">): EditCapabilities {
  const none: EditCapabilities = { editable: false, amount: false, methods: [], category: null, lines: false };
  if (t.status === "VOIDED") return { ...none, reason: "Voided transactions can't be edited." };

  const caps: EditCapabilities = { editable: true, amount: false, methods: methodsFor(t.type), category: null, lines: false };
  switch (t.type) {
    case "EXPENSE":
      return { ...caps, amount: true, category: "expense" };
    case "OTHER_INCOME":
    case "OWNER_CONTRIBUTION":
    case "OWNER_DRAW":
    case "SUPPLIER_PAYMENT":
    case "WAGES_PAYMENT":
    case "REFUND":
      return { ...caps, amount: true };
    case "SALE":
      return { ...caps, amount: true, category: t.unitId ? null : "income" };
    case "CUSTOMER_PAYMENT":
      if (t.repair?.invoiced) return { ...caps, amount: false, amountNote: "The repair job is already invoiced, so the deposit amount is locked." };
      return { ...caps, amount: true };
    case "MISC":
      return { ...caps, methods: [], lines: true };
    case "PURCHASE": {
      const u = purchaseUnits;
      if (u.length > 1) return { ...caps, amountNote: "This purchase created several items. To change the price, void it and enter it again." };
      const unit = u[0];
      if (unit?.status === "SOLD") return { ...caps, amountNote: "This item is already sold, so its cost is locked. Void the sale first to change it." };
      if (unit && toCents(unit.costBasis) !== toCents(unit.purchaseCost)) return { ...caps, amountNote: "This item has been refurbished, so its purchase price is locked." };
      return { ...caps, amount: true };
    }
    case "PARTS_PURCHASE":
      return { ...caps, amountNote: "Parts already received at this cost. To change it, void and re-enter the purchase." };
    case "REPAIR":
      return { ...caps, amountNote: "The amount comes from the repair job's price. Change it on the job before completing it." };
    case "REFURBISH":
      return { ...caps, methods: [], amountNote: "Refurbishment costs come from the parts and labor used." };
    default:
      return none;
  }
}

export async function editCapabilities(db: PrismaClient, id: string) {
  const loaded = await loadForEdit(db, id);
  return {
    capabilities: capabilitiesOf(loaded),
    transaction: loaded.t,
    lines: loaded.active.flatMap((e) => e.lines.map((l) => ({ code: l.account.code, name: l.account.name, debit: dec(l.debit), credit: dec(l.credit) }))),
  };
}

export const editInput = z.object({
  date: businessDate.optional(),
  description: z.string().trim().min(1).max(300).optional(),
  notes: z.string().max(2000).optional(),
  amount: z.coerce.number().finite().nonnegative().optional(),
  method: z.enum(["CASH", "BANK", "CARD", "ON_ACCOUNT"]).optional(),
  category: z.string().optional(),
  lines: z.array(z.object({ code: z.string(), debit: z.coerce.number().nonnegative().default(0), credit: z.coerce.number().nonnegative().default(0) })).min(2).optional(),
  reason: z.string().trim().max(300).optional(),
});
export type EditInput = z.input<typeof editInput>;

const linesKey = (lines: DraftLine[]) =>
  lines
    .map((l) => `${l.code}:${toCents(l.debit ?? 0)}:${toCents(l.credit ?? 0)}`)
    .filter((k) => !k.endsWith(":0:0"))
    .sort()
    .join("|");

/** Rebuilds the journal lines for the edited values. */
function rebuildLines(L: Loaded, amount: number, method: PaymentMethod, category: string | null, newLines?: DraftLine[]): DraftLine[] {
  const { t, active } = L;
  const old = active.flatMap((e) =>
    e.lines.map((l) => ({ code: l.account.code, type: l.account.type, debit: dec(l.debit), credit: dec(l.credit), unitId: l.unitId ?? undefined, repairId: l.repairId ?? undefined, memo: l.memo ?? undefined })),
  );
  const strip = ({ code, debit, credit, unitId, repairId, memo }: (typeof old)[number]): DraftLine => ({ code, debit, credit, unitId, repairId, memo });
  const inA = inAccount(method), outA = outAccount(method);
  const oldIn = inAccount(t.method), oldOut = outAccount(t.method);

  switch (t.type) {
    case "EXPENSE":
      return [{ code: ACCOUNT_BY_CATEGORY[category ?? t.category ?? "MISC"].code, debit: amount }, { code: outA, credit: amount }];
    case "OTHER_INCOME":
      return [{ code: inA, debit: amount }, { code: "4900", credit: amount }];
    case "OWNER_CONTRIBUTION":
      return [{ code: inA, debit: amount }, { code: "3000", credit: amount }];
    case "OWNER_DRAW":
      return [{ code: "3100", debit: amount }, { code: outA, credit: amount }];
    case "SUPPLIER_PAYMENT":
      return [{ code: "2000", debit: amount }, { code: outA, credit: amount }];
    case "WAGES_PAYMENT":
      return [{ code: "2300", debit: amount }, { code: outA, credit: amount }];
    case "CUSTOMER_PAYMENT":
      return t.repairId
        ? [{ code: inA, debit: amount }, { code: "2200", credit: amount, repairId: t.repairId }]
        : [{ code: inA, debit: amount }, { code: "1100", credit: amount }];
    case "REFUND": {
      // keep any restock lines (inventory back in, COGS reversed) exactly as they were
      const restock = old.filter((l) => l.code === "1200" || l.type === "COGS").map(strip);
      return [{ code: "4950", debit: amount }, { code: outA, credit: amount }, ...restock];
    }
    case "SALE": {
      if (t.unitId) {
        const revenue = old.find((l) => l.type === "REVENUE");
        const cost = old.filter((l) => l.code === "1200" || l.type === "COGS").map(strip);
        return [{ code: inA, debit: amount }, { code: revenue?.code ?? "4900", credit: amount, unitId: t.unitId }, ...cost];
      }
      return [{ code: inA, debit: amount }, { code: ACCOUNT_BY_CATEGORY[category ?? t.category ?? "ACCESSORY_SALES"].code, credit: amount }];
    }
    case "MISC":
      return newLines ?? old.map(strip);
    case "PURCHASE": {
      const debits = old.filter((l) => l.code === "1200");
      if (debits.length <= 1) {
        return [{ code: "1200", debit: amount, unitId: debits[0]?.unitId ?? t.unitId ?? undefined }, { code: outA, credit: amount }];
      }
      return [...debits.map(strip), { code: outA, credit: amount }];
    }
    case "PARTS_PURCHASE":
      return [...old.filter((l) => l.debit > 0).map(strip), { code: outA, credit: amount }];
    case "REPAIR":
      return old.map((l) => (l.code === oldIn && l.debit > 0 ? { ...strip(l), code: inA } : strip(l)));
    case "REFURBISH":
      return old.map(strip);
    default:
      void oldOut;
      return old.map(strip);
  }
}

export async function editTransaction(db: PrismaClient, id: string, raw: EditInput, actor = "system") {
  const input = editInput.parse(raw);
  return db.$transaction(async (tx) => {
    const L = await loadForEdit(tx, id);
    const { t, active, purchaseUnits } = L;
    const caps = capabilitiesOf(L);
    if (!caps.editable) throw new PostingError(caps.reason ?? "This transaction can't be edited");

    const oldAmount = dec(t.amount);
    if (input.amount !== undefined && toCents(input.amount) !== toCents(oldAmount) && !caps.amount)
      throw new PostingError(caps.amountNote ?? "The amount of this transaction can't be changed");
    if (input.method && input.method !== t.method && !caps.methods.includes(input.method))
      throw new PostingError(`"${input.method.replace("_", " ").toLowerCase()}" isn't allowed for this kind of transaction`);
    if (input.lines && !caps.lines) throw new PostingError("Only manual journal entries have editable lines");
    let category = t.category;
    if (input.category && input.category !== t.category) {
      if (caps.category === "expense" && !(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) throw new PostingError("Unknown expense category");
      if (caps.category === "income" && !(SALE_CATEGORIES as readonly string[]).includes(input.category)) throw new PostingError("Unknown income category");
      if (!caps.category) throw new PostingError("The category of this transaction can't be changed");
      category = input.category;
    }

    const amount = input.lines
      ? round2(input.lines.reduce((a, l) => a + (l.debit ?? 0), 0))
      : round2(input.amount ?? oldAmount);
    if (amount <= 0 && t.type !== "PURCHASE") throw new PostingError("Enter an amount greater than zero");
    const method = input.method ?? t.method;
    const date = input.date ?? t.date;
    const description = input.description ?? t.description;

    const oldLines: DraftLine[] = active.flatMap((e) => e.lines.map((l) => ({ code: l.account.code, debit: dec(l.debit), credit: dec(l.credit) })));
    const newLines = rebuildLines(L, amount, method, category, input.lines);
    const ledgerChanged = linesKey(oldLines) !== linesKey(newLines) || (active.length > 0 && date.getTime() !== t.date.getTime());

    const before = { date: t.date, description: t.description, amount: oldAmount, method: t.method, category: t.category, notes: t.notes, lines: oldLines };
    const changedFields = [
      date.getTime() !== t.date.getTime() && "date",
      description !== t.description && "description",
      amount !== oldAmount && "amount",
      method !== t.method && "payment method",
      category !== t.category && "category",
      input.notes !== undefined && input.notes !== (t.notes ?? "") && "notes",
      input.lines && linesKey(oldLines) !== linesKey(newLines) && "journal lines",
    ].filter(Boolean) as string[];
    if (!changedFields.length) return t;

    if (ledgerChanged) {
      for (const e of active) {
        await writeEntry(tx, {
          date: e.date,
          memo: `EDIT ${t.reference}: reversal of JE-${e.number}`,
          reversesId: e.id,
          transactionId: t.id,
          actor,
          lines: e.lines.map((l) => ({ code: l.account.code, debit: dec(l.credit), credit: dec(l.debit), unitId: l.unitId ?? undefined, repairId: l.repairId ?? undefined })),
        });
      }
      if (newLines.some((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0))
        await writeEntry(tx, { date, memo: `${t.reference} · ${description} (edited)`, lines: newLines, transactionId: t.id, actor });
    }

    // keep operational records in step
    if (t.type === "SALE" && t.unitId) await tx.inventoryUnit.update({ where: { id: t.unitId }, data: { salePrice: amount, soldAt: date } });
    if (t.type === "PURCHASE" && purchaseUnits.length) {
      await tx.inventoryUnit.updateMany({ where: { id: { in: purchaseUnits.map((u) => u.id) } }, data: { acquiredAt: date } });
      if (purchaseUnits.length === 1 && amount !== oldAmount)
        await tx.inventoryUnit.update({ where: { id: purchaseUnits[0].id }, data: { purchaseCost: amount, costBasis: amount } });
    }
    if (t.type === "CUSTOMER_PAYMENT" && t.repairId && amount !== oldAmount)
      await tx.repairJob.update({ where: { id: t.repairId }, data: { deposit: { increment: round2(amount - oldAmount) } } });

    const updated: Transaction = await tx.transaction.update({
      where: { id },
      data: {
        date,
        description,
        amount,
        method,
        category,
        notes: input.notes ?? t.notes,
        editedAt: new Date(),
        editedBy: actor,
        editCount: { increment: 1 },
      },
    });
    await audit(tx, {
      entity: "Transaction",
      entityId: id,
      action: "EDIT",
      summary: `${t.reference} edited (${changedFields.join(", ")})${input.reason ? ` – ${input.reason}` : ""}`,
      before,
      after: { date, description, amount, method, category, notes: updated.notes, lines: ledgerChanged ? newLines : oldLines },
      actor,
    });
    return updated;
  }, TX_OPTIONS);
}
