import { Fragment } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ChartCard, PageHeader } from "@/components/section";
import { QuickAdd } from "@/components/forms/quick-add";
import { prisma } from "@/lib/db";
import { dec } from "@/lib/accounting/money";
import { balancesAsOf } from "@/lib/queries";
import { cn, money, shortDate, titleCase } from "@/lib/utils";

export const metadata = { title: "General Ledger" };

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ account?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const accounts = await balancesAsOf();
  const totalDr = accounts.reduce((a, x) => a + x.debit, 0);
  const totalCr = accounts.reduce((a, x) => a + x.credit, 0);
  const selected = sp.account ? accounts.find((a) => a.code === sp.account) : null;
  const entries = await prisma.journalEntry.findMany({
    where: selected ? { lines: { some: { accountId: selected.id } } } : undefined,
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: 30,
    skip: (page - 1) * 30,
    include: { lines: { include: { account: true } } },
  });
  const groups = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "CONTRA_REVENUE", "COGS", "EXPENSE"] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="General ledger" description="Chart of accounts, trial balance and journal">
        <QuickAdd type="MISC" label="Journal entry" />
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-5">
        <ChartCard title="Trial balance" description="Click an account to filter the journal" className="xl:col-span-2"
          action={Math.abs(totalDr - totalCr) < 0.01 ? <span className="inline-flex items-center gap-1 text-xs text-[var(--delta-good)]"><CheckCircle2 className="h-3.5 w-3.5" /> Debits = credits</span> : <span className="text-xs text-[#d03b3b]">Unbalanced!</span>}>
          <Table>
            <THead><TR><TH>Account</TH><TH className="text-right">Debits</TH><TH className="text-right">Credits</TH><TH className="text-right">Balance</TH></TR></THead>
            <TBody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <TR className="hover:bg-transparent"><TD colSpan={4} className="pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titleCase(g)}</TD></TR>
                  {accounts.filter((a) => a.type === g).map((a) => (
                    <TR key={a.code} className={cn(sp.account === a.code && "bg-accent")}>
                      <TD><Link href={`?account=${a.code}`} className="hover:underline"><span className="font-mono text-xs text-muted-foreground">{a.code}</span> {a.name}</Link></TD>
                      <TD className="text-right text-muted-foreground">{money(a.debit, { cents: false })}</TD>
                      <TD className="text-right text-muted-foreground">{money(a.credit, { cents: false })}</TD>
                      <TD className="text-right font-medium">{money(a.balance)}</TD>
                    </TR>
                  ))}
                </Fragment>
              ))}
              <TR className="bg-muted/40 font-semibold"><TD>Total</TD><TD className="text-right">{money(totalDr, { cents: false })}</TD><TD className="text-right">{money(totalCr, { cents: false })}</TD><TD /></TR>
            </TBody>
          </Table>
        </ChartCard>

        <ChartCard title={selected ? `Journal · ${selected.code} ${selected.name}` : "Journal"} description={selected ? <Link href="/ledger" className="text-primary">Clear filter</Link> : "Most recent entries first"} className="xl:col-span-3">
          <div className="space-y-3">
            {entries.map((e) => (
              <div key={e.id} className="rounded-xl border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium">JE-{e.number} · {e.memo}</span>
                  <span className="text-muted-foreground">{shortDate(e.date)} · {e.createdBy}{e.reversesId && " · reversal"}</span>
                </div>
                <table className="w-full text-xs tabular">
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l.id} className={cn(selected && l.accountId === selected.id && "font-semibold")}>
                        <td className={cn("py-0.5", dec(l.credit) > 0 && "pl-6")}><span className="font-mono text-muted-foreground">{l.account.code}</span> {l.account.name}</td>
                        <td className="w-24 text-right">{dec(l.debit) ? money(dec(l.debit)) : ""}</td>
                        <td className="w-24 text-right">{dec(l.credit) ? money(dec(l.credit)) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 text-sm">
            {page > 1 && <Link className="rounded-lg border px-3 py-1.5" href={`?${sp.account ? `account=${sp.account}&` : ""}page=${page - 1}`}>← Newer</Link>}
            {entries.length === 30 && <Link className="rounded-lg border px-3 py-1.5" href={`?${sp.account ? `account=${sp.account}&` : ""}page=${page + 1}`}>Older →</Link>}
          </div>
        </ChartCard>
      </section>
    </div>
  );
}
