import Form from "next/form";
import Link from "next/link";
import type { Prisma, TransactionType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ChartCard, PageHeader } from "@/components/section";
import { QuickAdd } from "@/components/forms/quick-add";
import { VoidButton } from "@/components/forms/void-button";
import { EditTransactionButton, EditedBadge } from "@/components/forms/edit-transaction";
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
        <Form prefetch={false} className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-[1fr_200px_150px_150px_auto] [&>*:first-child]:col-span-2 xl:[&>*:first-child]:col-span-1" action="/transactions">
          <input name="q" aria-label="Search transactions" defaultValue={sp.q} placeholder="Search description, ref, customer, supplier…" className="h-9 rounded-lg border bg-card px-3 text-base sm:text-sm" />
          <select name="type" aria-label="Transaction type filter" defaultValue={sp.type ?? ""} className="h-9 rounded-lg border bg-card px-2 text-base sm:text-sm">
            <option value="">All types</option>
            {TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="date" name="from" defaultValue={sp.from} className="h-9 rounded-lg border bg-card px-2 text-base sm:text-sm" aria-label="From" />
          <input type="date" name="to" defaultValue={sp.to} className="h-9 rounded-lg border bg-card px-2 text-base sm:text-sm" aria-label="To" />
          <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Filter</button>
        </Form>
        {/* Phones: stacked cards */}
        <ul className="divide-y md:hidden">
          {rows.map((t) => {
            const inflow = MONEY_IN.has(t.type);
            return (
              <li key={t.id} className={cn("py-3", t.status === "VOIDED" && "opacity-50")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">
                      {t.repair ? <Link prefetch={false} href={`/repairs/${t.repair.id}`} className="hover:underline">{t.description}</Link> : t.description}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {shortDate(t.date)} · <span className="font-mono">{t.reference}</span> · {TX_LABEL[t.type]}
                      {t.category ? ` · ${CATEGORY_LABEL[t.category] ?? t.category}` : ""}
                    </p>
                  </div>
                  <p className={cn("shrink-0 text-sm font-semibold tabular", inflow && "text-[var(--delta-good)]")}>{inflow ? "+" : "−"}{money(dec(t.amount))}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
                  <span className="flex flex-wrap gap-1 [&>*]:ml-0">
                    {t.status === "VOIDED" && <Badge variant="outline">VOID</Badge>}
                    <EditedBadge editedAt={t.editedAt} editCount={t.editCount} editedBy={t.editedBy} />
                  </span>
                  {t.status === "POSTED" && (
                    <span className="flex gap-0.5">
                      <EditTransactionButton id={t.id} reference={t.reference} />
                      <VoidButton id={t.id} reference={t.reference} />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {/* Tablets and laptops: table */}
        <div className="hidden md:block">
        <Table>
          <THead><TR><TH>Date</TH><TH className="hidden xl:table-cell">Ref</TH><TH>Type</TH><TH>Description</TH><TH className="hidden lg:table-cell">Category</TH><TH className="hidden xl:table-cell">Party</TH><TH className="hidden xl:table-cell">Method</TH><TH className="text-right">Amount</TH><TH /></TR></THead>
          <TBody>
            {rows.map((t) => {
              const inflow = MONEY_IN.has(t.type);
              return (
                <TR key={t.id} className={cn(t.status === "VOIDED" && "opacity-50")}>
                  <TD className="whitespace-nowrap text-muted-foreground">{shortDate(t.date)}</TD>
                  <TD className="hidden font-mono text-xs xl:table-cell">{t.reference}</TD>
                  <TD><Badge variant={inflow ? "good" : t.type === "REFUND" ? "serious" : "secondary"}>{TX_LABEL[t.type]}</Badge></TD>
                  <TD className="max-w-[320px]">
                    <span className="block truncate">
                      {t.repair ? <Link prefetch={false} href={`/repairs/${t.repair.id}`} className="hover:underline">{t.description}</Link> : t.description}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground xl:hidden">
                      <span className="font-mono">{t.reference}</span>
                      <span className="lg:hidden">{t.category ? ` · ${CATEGORY_LABEL[t.category] ?? t.category}` : ""}</span>
                      {` · ${t.method.replace("_", " ").toLowerCase()}`}
                    </span>
                    {(t.status === "VOIDED" || t.editedAt) && (
                      <span className="mt-1 flex flex-wrap gap-1 [&>*]:ml-0">
                        {t.status === "VOIDED" && <Badge variant="outline">VOID</Badge>}
                        <EditedBadge editedAt={t.editedAt} editCount={t.editCount} editedBy={t.editedBy} />
                      </span>
                    )}
                  </TD>
                  <TD className="hidden text-muted-foreground lg:table-cell">{t.category ? CATEGORY_LABEL[t.category] ?? t.category : "—"}</TD>
                  <TD className="hidden text-muted-foreground xl:table-cell">{t.customer?.name ?? t.supplier?.name ?? "—"}</TD>
                  <TD className="hidden text-xs text-muted-foreground xl:table-cell">{t.method.replace("_", " ").toLowerCase()}</TD>
                  <TD className={cn("text-right font-medium", inflow && "text-[var(--delta-good)]")}>{inflow ? "+" : "−"}{money(dec(t.amount))}</TD>
                  <TD className="text-right">
                    {t.status === "POSTED" && (
                      <div className="flex justify-end gap-0.5">
                        <EditTransactionButton id={t.id} reference={t.reference} />
                        <VoidButton id={t.id} reference={t.reference} />
                      </div>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        </div>
        <div className="flex items-center justify-between pt-4 text-sm">
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link prefetch={false} className="rounded-lg border px-3 py-1.5" href={qs({ page: String(page - 1) })}>← Prev</Link>}
            {page < pages && <Link prefetch={false} className="rounded-lg border px-3 py-1.5" href={qs({ page: String(page + 1) })}>Next →</Link>}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
