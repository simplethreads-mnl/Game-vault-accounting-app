import Link from "next/link";
import { Banknote, Boxes, DollarSign, FileDown, Percent, PiggyBank, TrendingUp, Wallet, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { KpiCard, change } from "@/components/kpi-card";
import { ChartCard, PageHeader } from "@/components/section";
import { RangeSelect } from "@/components/range-select";
import { S } from "@/components/charts/theme";
import { CashFlowCard, DonutCard, EatsMoney, ProfitTrend, RevenueVsExpenses } from "@/components/dashboard/charts-panel";
import { AlertsList, BestSellers, Pipeline, ProfitSources, RepairQueue } from "@/components/dashboard/widgets";
import { CATEGORY_LABEL, INCOME_CATEGORIES } from "@/lib/accounting/chart";
import { dashboard } from "@/lib/queries";
import { money, pct } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const d = await dashboard(range);
  const { pnl, prev } = d;
  const slim = d.monthly.map((m) => ({ label: m.label, netRevenue: m.netRevenue, expensesTotal: m.expensesTotal, netProfit: m.netProfit, grossProfit: m.grossProfit, cashIn: m.cashIn, cashOut: m.cashOut, netCash: m.netCash }));
  const spark = (k: "netRevenue" | "grossProfit" | "netProfit") => d.monthly.map((m) => m[k]);

  const revenueSlices = INCOME_CATEGORIES.map((c, i) => ({ key: c, label: CATEGORY_LABEL[c], value: pnl.revenueByCategory[c] ?? 0, color: S(i + 1) }));
  const exp = Object.entries(pnl.expenseByCategory).sort((a, b) => b[1] - a[1]);
  const expenseSlices = [
    ...exp.slice(0, 6).map(([k, v], i) => ({ key: k, label: CATEGORY_LABEL[k], value: v, color: S(i + 1) })),
    { key: "OTHER", label: "All other", value: exp.slice(6).reduce((a, [, v]) => a + v, 0), color: "var(--chart-axis)" },
  ];
  const composition = [
    { key: "cos", label: "Cost of sales (COGS + repairs)", value: pnl.totalCostOfSales, color: S(2) },
    { key: "opex", label: "Operating expenses", value: pnl.operatingExpenses, color: S(4) },
    { key: "net", label: pnl.netProfit >= 0 ? "Net income" : "Net loss", value: Math.max(0, pnl.netProfit), color: S(3) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Business overview" description={`${d.range.label} · all figures from the general ledger`}>
        <RangeSelect value={d.range.key} />
        <Button asChild variant="outline" size="sm"><Link href="/reports"><FileDown /> Reports</Link></Button>
      </PageHeader>

      <section className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Net revenue" value={money(pnl.netRevenue, { cents: false })} icon={DollarSign} delta={change(pnl.netRevenue, prev.netRevenue)} spark={spark("netRevenue")} sparkColor={S(1)} />
        <KpiCard label="Gross profit" value={money(pnl.grossProfit, { cents: false })} icon={TrendingUp} delta={change(pnl.grossProfit, prev.grossProfit)} spark={spark("grossProfit")} sparkColor={S(1)} />
        <KpiCard label="Net profit" value={money(pnl.netProfit, { cents: false })} icon={PiggyBank} delta={change(pnl.netProfit, prev.netProfit)} spark={spark("netProfit")} sparkColor={S(3)} />
        <KpiCard label="Net margin" value={pct(pnl.netMargin)} icon={Percent} delta={prev.netRevenue ? pnl.netMargin - prev.netMargin : null} deltaLabel="pts vs prev." hint={`gross margin ${pct(pnl.grossMargin)}`} />
      </section>

      <section className="stagger grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Cash & bank" value={money(d.cash, { cents: false })} icon={Wallet} hint={`AR ${money(d.receivables, { cents: false })} · AP ${money(d.payables, { cents: false })}`} />
        <KpiCard label="Inventory at cost" value={money(d.inventory.cost, { cents: false })} icon={Boxes} hint={`${d.inventory.units} units · parts ${money(d.inventory.partsValue, { cents: false })}`} />
        <KpiCard label="Profit potential" value={money(d.inventory.profitPotential, { cents: false })} icon={Banknote} hint={`list value ${money(d.inventory.value, { cents: false })}`} />
        <KpiCard label="Repair queue" value={String(d.activeRepairs.length)} icon={Wrench} hint={`WIP ${money(d.inventory.wip, { cents: false })} in parts`} />
      </section>

      <ChartCard title="Device pipeline" description="Buy broken → repair → resell, plus ready stock">
        <Pipeline p={d.pipeline} />
      </ChartCard>

      <section className="grid gap-4 xl:grid-cols-3">
        <RevenueVsExpenses data={slim} />
        <DonutCard title="Profit · Expenses · Net income" description="Where each revenue dollar went" data={composition} centerLabel="Net revenue" centerValue={money(pnl.netRevenue, { compact: true })} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ProfitTrend data={slim} forecast={d.forecast} />
        <CashFlowCard data={slim} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DonutCard title="Revenue breakdown" description="By income category" data={revenueSlices} centerLabel="Gross revenue" centerValue={money(pnl.grossRevenue, { compact: true })} />
        <DonutCard title="Expenses breakdown" description="Operating expenses by category" data={expenseSlices} centerLabel="Operating exp." centerValue={money(pnl.operatingExpenses, { compact: true })} />
        <EatsMoney data={d.spending.items.map((s, i) => ({ key: s.key, label: s.label, value: s.value, color: S(i + 1) }))} total={d.spending.total} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Top profit sources" description={d.topExpense ? `Top expense: ${CATEGORY_LABEL[d.topExpense.category]} (${pct(d.topExpense.share, 0)} of opex)` : undefined}>
          <ProfitSources sources={d.profitSources} />
        </ChartCard>
        <ChartCard title="Best-selling products" description={`Avg profit / console ${money(d.unitStats.avgProfitPerConsole, { cents: false })}`}>
          <BestSellers models={d.unitStats.bestSelling} />
        </ChartCard>
        <ChartCard title="Inventory alerts" description="Low stock, aging units, overdue jobs">
          <AlertsList alerts={d.alerts} />
        </ChartCard>
        <ChartCard title="Repair queue" description="Active jobs, newest first">
          <RepairQueue jobs={d.activeRepairs} />
        </ChartCard>
      </section>

      <ChartCard title="Monthly performance" description="Last 12 months · automatic P&L by month">
        <Table>
          <THead>
            <TR><TH>Month</TH><TH className="text-right">Revenue</TH><TH className="text-right">COGS</TH><TH className="text-right">Repair costs</TH><TH className="text-right">Gross profit</TH><TH className="text-right">Opex</TH><TH className="text-right">Net profit</TH><TH className="text-right">Margin</TH></TR>
          </THead>
          <TBody>
            {[...d.monthly].reverse().map((m) => (
              <TR key={m.key}>
                <TD className="font-medium">{m.label}</TD>
                <TD className="text-right">{money(m.netRevenue, { cents: false })}</TD>
                <TD className="text-right text-muted-foreground">{money(m.cogs, { cents: false })}</TD>
                <TD className="text-right text-muted-foreground">{money(m.repairCosts, { cents: false })}</TD>
                <TD className="text-right">{money(m.grossProfit, { cents: false })}</TD>
                <TD className="text-right text-muted-foreground">{money(m.operatingExpenses, { cents: false })}</TD>
                <TD className={m.netProfit >= 0 ? "text-right font-medium" : "text-right font-medium text-[#d03b3b]"}>{money(m.netProfit, { cents: false })}</TD>
                <TD className="text-right">{pct(m.netMargin)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </ChartCard>
    </div>
  );
}
