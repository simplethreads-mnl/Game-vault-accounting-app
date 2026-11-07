import Link from "next/link";
import type { Prisma, TransactionType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ChartCard, PageHeader } from "@/components/section";
import { QuickAdd } from "@/components/forms/quick-add";
import { VoidButton } from "@/components/forms/void-button";
import { prisma } from "@/lib/db";
import { dec } from "@/lib/accounting/money";
import { CATEGORY_LABEL } from "@/lib/accounting/chart";
import { MONEY_IN, TX_LABEL, TX_TYPES } from "@/lib/labels";
import { cn, money, shortDate } from "@/lib/utils";

export const metadata = { title: "Transactions" };
const PAGE = 50;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; from?: string; to?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where: Prisma.TransactionWhereInput = {};
  if (sp.type) where.type = sp.type as TransactionType;
  if (sp.q) where.OR = [{ description: { contains: sp.q, mode: "insensitive" } }, { reference: { contains: sp.q, mode: "insensitive" } }, { customer: { name: { contains: sp.q, mode: "insensitive" } } }, { supplier: { name: { contains: sp.q, mode: "insensitive" } } }];
  if (sp.from || sp.to) where.date = { gte: sp.from ? new Date(`${sp.from}T00:00:00`) : undefined, lte: sp.to ? new Date(`${sp.to}T23:59:59`) : undefined };

  const [rows, count, sums] = await Promise.all([
    prisma.transaction.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: PAGE, skip: (page - 1) * PAGE, include: { customer: true, supplier: true, unit: true, repair: true } }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({ by: ["type"], where: { ...where, status: "POSTED" }, _sum: { amount: true } }),
  ]);
  const totalIn = sums.filter((s) => MONEY_IN.has(s.type)).reduce((a, s) => a + dec(s._sum.amount), 0);
  const totalOut = sums.filter((s) => !MONEY_IN.has(s.type) && !["REFURBISH", "MISC"].includes(s.type)).reduce((a, s) => a + dec(s._sum.amount), 0);
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const qs = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Every business event, each backed by a balanced journal entry">
        <QuickAdd type="EXPENSE" label="Add expense" variant="outline" />
        <QuickAdd type="SALE" label="New transaction" />
      </PageHeader>

      <section className="grid grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Matching</p><p className="mt-1 text-xl font-semibold tabular">{count}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Money in</p><p className="mt-1 text-xl font-semibold tabular text-[var(--delta-good)]">{money(totalIn, { cents: false })}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Money out</p><p className="mt-1 text-xl font-semibold tabular">{money(totalOut, { cents: false })}</p></Card>
      </section>

      <ChartCard title="History">
        <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_150px_150px_auto]" action="/transactions">
          <input name="q" aria-label="Search transactions" defaultValue={sp.q} placeholder="Search description, ref, customer, supplier…" className="h-9 rounded-lg border bg-card px-3 text-sm" />
          <select name="type" aria-label="Transaction type filter" defaultValue={sp.type ?? ""} className="h-9 rounded-lg border bg-card px-2 text-sm">
            <option value="">All types</option>
            {TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="date" name="from" defaultValue={sp.from} className="h-9 rounded-lg border bg-card px-2 text-sm" aria-label="From" />
          <input type="date" name="to" defaultValue={sp.to} className="h-9 rounded-lg border bg-card px-2 text-sm" aria-label="To" />
          <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Filter</button>
        </form>
        <Table>
          <THead><TR><TH>Date</TH><TH>Ref</TH><TH>Type</TH><TH>Description</TH><TH>Category</TH><TH>Party</TH><TH>Method</TH><TH className="text-right">Amount</TH><TH /></TR></THead>
          <TBody>
            {rows.map((t) => {
              const inflow = MONEY_IN.has(t.type);
              return (
                <TR key={t.id} className={cn(t.status === "VOIDED" && "opacity-50")}>
                  <TD className="whitespace-nowrap text-muted-foreground">{shortDate(t.date)}</TD>
                  <TD className="font-mono text-xs">{t.reference}</TD>
                  <TD><Badge variant={inflow ? "good" : t.type === "REFUND" ? "serious" : "secondary"}>{TX_LABEL[t.type]}</Badge></TD>
                  <TD className="max-w-[280px] truncate">
                    {t.repair ? <Link href={`/repairs/${t.repair.id}`} className="hover:underline">{t.description}</Link> : t.description}
                    {t.status === "VOIDED" && <Badge variant="outline" className="ml-2">VOID</Badge>}
                  </TD>
                  <TD className="text-muted-foreground">{t.category ? CATEGORY_LABEL[t.category] ?? t.category : "—"}</TD>
                  <TD className="text-muted-foreground">{t.customer?.name ?? t.supplier?.name ?? "—"}</TD>
                  <TD className="text-xs text-muted-foreground">{t.method.replace("_", " ").toLowerCase()}</TD>
                  <TD className={cn("text-right font-medium", inflow && "text-[var(--delta-good)]")}>{inflow ? "+" : "−"}{money(dec(t.amount))}</TD>
                  <TD className="text-right">{t.status === "POSTED" && <VoidButton id={t.id} reference={t.reference} />}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <div className="flex items-center justify-between pt-4 text-sm">
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="rounded-lg border px-3 py-1.5" href={qs({ page: String(page - 1) })}>← Prev</Link>}
            {page < pages && <Link className="rounded-lg border px-3 py-1.5" href={qs({ page: String(page + 1) })}>Next →</Link>}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
