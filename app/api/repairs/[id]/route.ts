import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, currentUser } from "@/lib/db";
import { handle } from "@/lib/api";
import { changeRepairStatus } from "@/lib/accounting/posting";

const patch = z.object({
  status: z.enum(["RECEIVED", "DIAGNOSING", "WAITING_FOR_PARTS", "REPAIRING", "TESTING", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED"]),
  note: z.string().optional(),
  method: z.enum(["CASH", "BANK", "CARD", "ON_ACCOUNT"]).optional(),
  price: z.coerce.number().nonnegative().optional(),
  laborCost: z.coerce.number().nonnegative().optional(),
  diagnosis: z.string().optional(),
});

export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return prisma.repairJob.findUniqueOrThrow({ where: { id }, include: { customer: true, partsUsed: { include: { part: true } }, history: { orderBy: { createdAt: "asc" } }, transactions: true } });
});

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const b = patch.parse(await req.json());
  return changeRepairStatus(prisma, id, b.status, b, currentUser());
});
