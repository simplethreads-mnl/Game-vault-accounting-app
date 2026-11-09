import type { NextRequest } from "next/server";
import { prisma, currentUser } from "@/lib/db";
import { handle } from "@/lib/api";
import { editCapabilities, editTransaction } from "@/lib/accounting/editing";

/** What can be edited on this transaction, plus its current journal lines. */
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return editCapabilities(prisma, id);
});

/** Edit a posted transaction (reverses and re-posts its journal entry; marks it as edited). */
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return editTransaction(prisma, id, await req.json(), currentUser());
});
