import { prisma } from "@/lib/db";
import { handle } from "@/lib/api";
import { dec } from "@/lib/accounting/money";

export const GET = handle(async () => {
  const [units, parts, customers, suppliers, repairs] = await Promise.all([
    prisma.inventoryUnit.findMany({ where: { status: { in: ["IN_STOCK", "BROKEN", "IN_REPAIR", "READY", "RETURNED", "SOLD"] } }, orderBy: { acquiredAt: "desc" }, take: 500 }),
    prisma.part.findMany({ orderBy: { name: "asc" } }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.repairJob.findMany({ where: { invoiced: false, status: { not: "CANCELLED" } }, include: { customer: { select: { name: true } } }, orderBy: { receivedAt: "desc" } }),
  ]);
  return {
    units: units.map((u) => ({ id: u.id, sku: u.sku, model: u.model, status: u.status, productLine: u.productLine, costBasis: dec(u.costBasis), listPrice: dec(u.listPrice) })),
    parts: parts.map((p) => ({ id: p.id, sku: p.sku, name: p.name, quantity: p.quantity, avgCost: dec(p.avgCost) })),
    customers,
    suppliers,
    repairs: repairs.map((r) => ({ id: r.id, jobNumber: r.jobNumber, customer: r.customer.name, price: dec(r.price), problem: r.problem, status: r.status })),
  };
});
