import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, currentUser } from "@/lib/db";
import { handle } from "@/lib/api";
import { voidTransaction } from "@/lib/accounting/posting";

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { reason } = z.object({ reason: z.string().trim().min(3, "Give a reason for the audit trail") }).parse(await req.json());
  return voidTransaction(prisma, id, reason, currentUser());
});
