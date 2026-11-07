import type { NextRequest } from "next/server";
import { Prisma, type TransactionType } from "@prisma/client";
import { prisma, currentUser } from "@/lib/db";
import { handle, resolveParties } from "@/lib/api";
import { postTransaction, type TransactionInput } from "@/lib/accounting/posting";

export const GET = handle(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const where: Prisma.TransactionWhereInput = {};
  if (sp.get("type")) where.type = sp.get("type") as TransactionType;
  if (sp.get("q")) where.OR = [{ description: { contains: sp.get("q")!, mode: "insensitive" } }, { reference: { contains: sp.get("q")!, mode: "insensitive" } }];
  if (sp.get("from") || sp.get("to")) where.date = { gte: sp.get("from") ? new Date(sp.get("from")!) : undefined, lt: sp.get("to") ? new Date(sp.get("to")!) : undefined };
  const take = Math.min(500, Number(sp.get("limit") ?? 100));
  return prisma.transaction.findMany({ where, orderBy: { date: "desc" }, take, include: { customer: true, supplier: true } });
});

export const POST = handle(async (req: NextRequest) => {
  const body = await resolveParties(await req.json());
  return postTransaction(prisma, body as TransactionInput, currentUser());
});
