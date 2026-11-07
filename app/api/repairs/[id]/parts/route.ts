import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, currentUser } from "@/lib/db";
import { handle } from "@/lib/api";
import { issuePartToRepair } from "@/lib/accounting/posting";

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const b = z.object({ partId: z.string(), quantity: z.coerce.number().int().positive().default(1) }).parse(await req.json());
  return issuePartToRepair(prisma, id, b.partId, b.quantity, currentUser());
});
