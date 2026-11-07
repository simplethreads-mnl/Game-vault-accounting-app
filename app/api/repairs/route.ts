import type { NextRequest } from "next/server";
import { prisma, currentUser } from "@/lib/db";
import { handle } from "@/lib/api";
import { createRepair } from "@/lib/accounting/posting";

export const GET = handle(async () => prisma.repairJob.findMany({ include: { customer: true }, orderBy: { receivedAt: "desc" }, take: 500 }));

export const POST = handle(async (req: NextRequest) => {
  const body = await req.json();
  if (!body.customerId && body.customerName) body.customer = { name: body.customerName, phone: body.customerPhone || undefined };
  return createRepair(prisma, body, currentUser());
});
