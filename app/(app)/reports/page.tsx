import Form from "next/form";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, FileText, Sheet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ChartCard, PageHeader } from "@/components/section";
import { buildReport, REPORT_PERIODS, type ReportPeriod } from "@/lib/reports";
import { cn, money, pct, shortDate } from "@/lib/utils";

export const metadata = { title: "Reports" };

function Row({ label, value, bold, indent, negative }: { label: string; value: number; bold?: boolean; indent?: boolean; negative?: boolean }) {
  return (
    <TR className={cn(bold && "bg-muted/40")}>
      <TD className={cn(indent && "pl-8 text-muted-foreground", bold && "font-semibold")}>{label}</TD>
      <TD className={cn("text-right", bold && "font-semibold", value < 0 && "text-[#d03b3b]")}>{negative ? `(${money(Math.abs(value))})` : money(value)}</TD>
    </TR>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string | string[]; date?: string }> }) {
  const sp = await searchParams;
  const rawPeriod = Array.isArray(sp.period) ? sp.period[0] : sp.period;
  const period = (REPORT_PERIODS.includes(rawPeriod as ReportPeriod) ? rawPeriod : "monthly") as ReportPeriod;
  const date = sp.date ?? new Date().toISOString().slice(0, 10);
  const r = await buildReport(period, new Date(`${date}T12:00:00`));
  const href = (format: string) => `/api/reports?period=${period}&date=${date}&format=${format}`;
  const b = r.balanceSheet;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Daily, weekly, monthly, quarterly and annual financial statements">
        <Button asChild variant="outline" size="sm"><a href={href("pdf")} download><FileText /> PDF</a></Button>
        <Button asChild variant="outline" size="sm"><a href={href("xlsx")} download><FileSpreadsheet /> Excel</a></Button>
        <Button asChild variant="outline" size="sm"><a href={href("csv")} download><Sheet /> CSV</a></Button>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-2">
        <nav className="inline-flex rounded-lg border bg-card p-0.5" aria-label="Report period">
          {REPORT_PERIODS.map((p) => (
            <Link prefetch={false} key={p} href={`/reports?period=${p}&date=${date}`} aria-current={p === period ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize", p === period ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{p}</Link>
          ))}
        </nav>
        <Form prefetch={false} className="flex items-end gap-2" action="/reports">
          <input type="hidden" name="period" value={period} />
          <input type="date" name="date" defaultValue={date} className="h-9 rounded-lg border bg-card px-2 text-base sm:text-sm" aria-label="Report date" />
          <Button size="sm" variant="secondary">Run</Button>
        </Form>
      </div>

      <div className="rounded-2xl border bg-gradient-to-br from-[#6250d6]/10 to-[#2a78d6]/10 p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{period} report</p>
        <p className="text-xl font-semibold">{r.label}</p>
        <p className="text-sm text-muted-foreground">{shortDate(r.start)} – {shortDate(new Date(r.end.getTime() - 1))} · {r.transactions.length} transactions</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Profit & Loss" description="Accrual basis">
          <Table>
            <TBody>
              {r.income.map((i) => <Row key={i.label} label={i.label} value={i.amount} indent />)}
              <Row label="Gross Revenue" value={r.pnl.grossRevenue} bold />
              <Row label="Less: refunds & returns" value={-r.pnl.refunds} indent negative />
              <Row label="Net Revenue" value={r.pnl.netRevenue} bold />
              <Row label="Cost of goods sold" value={-r.pnl.cogs} indent negative />
              <Row label="Repair costs (parts + labor)" value={-r.pnl.repairCosts} indent negative />
              <Row label={`Gross Profit · ${pct(r.pnl.grossMargin)}`} value={r.pnl.grossProfit} bold />
              {r.expenses.filter((e) => e.amount).map((e) => <Row key={e.label} label={e.label} value={-e.amount} indent negative />)}
              <Row label="Total Operating Expenses" value={-r.pnl.operatingExpenses} bold negative />
              <Row label={`Net Profit · ${pct(r.pnl.netMargin)} margin`} value={r.pnl.netProfit} bold />
            </TBody>
          </Table>
        </ChartCard>
        <div className="space-y-4">
          <ChartCard title="Balance Sheet" description={`As of ${shortDate(new Date(r.end.getTime() - 1))}`} action={b.balanced ? <span className="inline-flex items-center gap-1 text-xs text-[var(--delta-good)]"><CheckCircle2 className="h-3.5 w-3.5" /> Balanced</span> : <span className="inline-flex items-center gap-1 text-xs text-[#d03b3b]"><XCircle className="h-3.5 w-3.5" /> Out of balance</span>}>
            <Table>
              <TBody>
                {b.assets.filter((a) => a.amount).map((a) => <Row key={a.code} label={`${a.code} ${a.label}`} value={a.amount} indent />)}
                <Row label="Total Assets" value={b.totalAssets} bold />
                {b.liabilities.filter((a) => a.amount).map((a) => <Row key={a.code} label={`${a.code} ${a.label}`} value={a.amount} indent />)}
                <Row label="Total Liabilities" value={b.totalLiabilities} bold />
                {b.equity.map((a) => <Row key={a.code + a.label} label={`${a.code} ${a.label}`} value={a.amount} indent />)}
                <Row label="Total Equity" value={b.totalEquity} bold />
                <Row label="Liabilities + Equity" value={b.totalLiabilities + b.totalEquity} bold />
              </TBody>
            </Table>
          </ChartCard>
          <ChartCard title="Cash summary">
            <Table><TBody><Row label="Cash in" value={r.cash.cashIn} /><Row label="Cash out" value={-r.cash.cashOut} negative /><Row label="Net change in cash" value={r.cash.netCash} bold /></TBody></Table>
          </ChartCard>
        </div>
      </section>

      <ChartCard title="Transactions in period" description="Full list included in every export">
        <Table>
          <THead><TR><TH>Date</TH><TH>Ref</TH><TH>Type</TH><TH>Description</TH><TH className="text-right">Amount</TH></TR></THead>
          <TBody>
            {r.transactions.slice(-100).reverse().map((t) => (
              <TR key={t.reference} className={cn(t.status === "VOIDED" && "opacity-50")}><TD className="whitespace-nowrap">{shortDate(t.date)}</TD><TD className="font-mono text-xs">{t.reference}</TD><TD className="text-xs">{t.type.replace(/_/g, " ").toLowerCase()}</TD><TD className="max-w-[360px] truncate">{t.description}</TD><TD className="text-right">{money(t.amount)}</TD></TR>
            ))}
          </TBody>
        </Table>
      </ChartCard>
    </div>
  );
}
