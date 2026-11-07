import "server-only";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PostingError } from "./accounting/posting";
import { UnbalancedEntryError } from "./accounting/ledger";
import { prisma } from "./db";

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response | unknown>) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      if (e instanceof ZodError) return NextResponse.json({ error: "Invalid input", issues: e.issues }, { status: 400 });
      if (e instanceof PostingError || e instanceof UnbalancedEntryError) return NextResponse.json({ error: e.message }, { status: 422 });
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
      console.error(e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
    }
  };
}

/** Lets forms pass a free-text customer / supplier name instead of an id. */
export async function resolveParties<T extends { customerId?: string; customerName?: string; supplierId?: string; supplierName?: string }>(body: T) {
  const out = { ...body } as T & { customerId?: string; supplierId?: string };
  if (!out.customerId && body.customerName?.trim()) {
    const name = body.customerName.trim();
    out.customerId = (await prisma.customer.findFirst({ where: { name: { equals: name, mode: "insensitive" } } }) ?? (await prisma.customer.create({ data: { name } }))).id;
  }
  if (!out.supplierId && body.supplierName?.trim()) {
    const name = body.supplierName.trim();
    out.supplierId = (await prisma.supplier.findFirst({ where: { name: { equals: name, mode: "insensitive" } } }) ?? (await prisma.supplier.create({ data: { name } }))).id;
  }
  delete (out as Record<string, unknown>).customerName;
  delete (out as Record<string, unknown>).supplierName;
  return out;
}
