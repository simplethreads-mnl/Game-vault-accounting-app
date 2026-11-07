import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, currentUser } from "@/lib/db";
import { handle } from "@/lib/api";
import { audit } from "@/lib/accounting/posting";
import { parts, units } from "@/lib/queries";

export const GET = handle(async () => ({ units: await units(), parts: await parts() }));

/** Non-financial edits only (list price, notes, serial). Cost changes must go through transactions. */
export const PATCH = handle(async (req: NextRequest) => {
  const b = z.object({ id: z.string(), listPrice: z.coerce.number().nonnegative().optional(), notes: z.string().optional(), serial: z.string().optional() }).parse(await req.json());
  return prisma.$transaction(async (tx) => {
    const before = await tx.inventoryUnit.findUniqueOrThrow({ where: { id: b.id } });
    const after = await tx.inventoryUnit.update({ where: { id: b.id }, data: { listPrice: b.listPrice, notes: b.notes, serial: b.serial } });
    await audit(tx, { entity: "InventoryUnit", entityId: b.id, action: "UPDATE", summary: `${before.sku} updated${b.listPrice != null ? ` – list price ${before.listPrice} → ${b.listPrice}` : ""}`, before, after, actor: currentUser() });
    return after;
  });
});
