import Link from "next/link";
import { Award, Boxes, Gamepad2, Gauge, Percent, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard, PageHeader } from "@/components/section";
import { RangeSelect } from "@/components/range-select";
import { ClientArea, ClientBars, ClientRanked } from "@/components/charts/simple";
import { S } from "@/components/charts/theme";
import { dashboard, yearlySummary } from "@/lib/queries";
import { PRODUCT_LINE_LABEL } from "@/lib/labels";
import { cn, money, pct } from "@/lib/utils";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; year?: string }> }) {
  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = Number(sp.year ?? thisYear);
  const [d, y, py] = await Promise.all([dashboard(sp.range ?? "12m"), yearlySummary(year), yearlySummary(year - 1)]);
  const u = d.unitStats;
  const r = d.repairStats;

  const forecastRows = [
    ...d.monthly.slice(-7, -1).map((m) => ({ label: m.label, revenue: m.netRevenue, profit: m.netProfit, fRevenue: null as number | null, fProfit: null as number | null })),
    ...d.forecast.map((f) => ({ label: f.label, revenue: null, profit: null, fRevenue: f.netRevenue, fProfit: f.netProfit })),
  ];
  const last = forecastRows[5];
  if (last) { last.fRevenue = last.revenue; last.fProfit = last.profit; }
  const yoy = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description={`Inventory & profit intelligence · ${d.range.label}`}>
        <RangeSelect value={d.range.key} />
      </PageHeader>

      <section className="stagger grid grid-cols-2 gap-4 xl:grid-cols-6">
        <KpiCard label="Most profitable product" value={u.mostProfitable?.model ?? "—"} icon={Award} hint={u.mostProfitable ? `${money(u.mostProfitable.profit, { cents: false })} from ${u.mostProfitable.sold} sold` : ""} />
        <KpiCard label="Most profitable repair" value={r.mostProfitable?.type.split(" · ")[1] ?? "—"} icon={Wrench} hint={r.mostProfitable ? `${money(r.mostProfitable.profit, { cents: false })} · ${pct(r.mostProfitable.margin, 0)} margin` : ""} />
        <KpiCard label="Avg profit / console" value={money(u.avgProfitPerConsole)} icon={Gamepad2} hint="Switch units sold" />
        <KpiCard label="Avg repair margin" value={pct(r.avgMargin)} icon={Percent} hint={`${r.completed} jobs completed`} />
        <KpiCard label="Unsold inventory" value={money(d.inventory.cost, { cents: false })} icon={Boxes} hint={`${d.inventory.units} units at cost`} />
        <KpiCard label="Inventory turnover" value={`${d.inventory.turnover.rate.toFixed(2)}×`} icon={Gauge} hint={`${Math.round(d.inventory.turnover.daysInInventory)} days in inventory`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Profit forecast" description="Last 6 complete months + projection for this month and the next two (dashed)">
          <ClientArea data={forecastRows} series={[{ key: "revenue", label: "Revenue", color: S(1) }, { key: "fRevenue", label: "Revenue forecast", color: S(1), dashed: true }, { key: "profit", label: "Net profit", color: S(3) }, { key: "fProfit", label: "Profit forecast", color: S(3), dashed: true }]} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            {d.forecast.map((f) => (
              <div key={f.label} className="rounded-lg bg-muted p-2"><p className="text-muted-foreground">{f.label}</p><p className="font-semibold tabular">{money(f.netProfit, { cents: false })}</p></div>
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Profit by product model" description="Sold units in period — profit = sale price − full cost basis">
          <ClientRanked data={u.models.sort((a, b) => b.profit - a.profit).slice(0, 8).map((m) => ({ key: m.model, label: m.model, value: m.profit, color: S(m.productLine === "IPHONE" ? 7 : m.productLine === "PC_PARTS" ? 5 : 1) }))} />
        </ChartCard>
      </section>

      <ChartCard title="Product profitability" description="Per-model unit economics">
        <Table>
          <THead><TR><TH>Model</TH><TH>Line</TH><TH className="text-right">Units sold</TH><TH className="text-right">Revenue</TH><TH className="text-right">Profit</TH><TH className="text-right">Avg profit / unit</TH><TH className="text-right">Margin</TH></TR></THead>
          <TBody>
            {u.models.map((m) => (
              <TR key={m.model}><TD className="font-medium">{m.model}</TD><TD className="text-muted-foreground">{PRODUCT_LINE_LABEL[m.productLine] ?? m.productLine}</TD><TD className="text-right">{m.sold}</TD><TD className="text-right">{money(m.revenue, { cents: false })}</TD><TD className="text-right">{money(m.profit, { cents: false })}</TD><TD className="text-right">{money(m.avgProfit)}</TD><TD className="text-right">{pct(m.margin)}</TD></TR>
            ))}
          </TBody>
        </Table>
      </ChartCard>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="text-lg font-semibold">Yearly summary · {year}</h2>
        <div className="flex gap-1">
          {[thisYear - 2, thisYear - 1, thisYear].map((yy) => (
            <Link prefetch={false} key={yy} href={`?year=${yy}${sp.range ? `&range=${sp.range}` : ""}`} className={cn("rounded-lg px-3 py-1.5 text-sm", yy === year ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{yy}</Link>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Gross revenue", y.total.grossRevenue, py.total.grossRevenue],
          ["COGS + repair costs", y.total.totalCostOfSales, py.total.totalCostOfSales],
          ["Gross profit", y.total.grossProfit, py.total.grossProfit],
          ["Operating expenses", y.total.operatingExpenses, py.total.operatingExpenses],
          ["Annual net profit", y.total.netProfit, py.total.netProfit],
        ].map(([l, v, p]) => {
          const c = yoy(v as number, p as number);
          return (
            <Card key={l as string} className="p-4">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="mt-1 text-xl font-semibold tabular">{money(v as number, { cents: false })}</p>
              <p className="text-xs text-muted-foreground">{c == null ? "no prior-year data" : `${c >= 0 ? "+" : ""}${(c * 100).toFixed(0)}% vs ${year - 1}`}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly profit" description={`${year} · gross vs net`}>
          <ClientBars data={y.months.map((m) => ({ label: m.label, grossProfit: m.grossProfit, netProfit: m.netProfit }))} series={[{ key: "grossProfit", label: "Gross profit", color: S(1) }, { key: "netProfit", label: "Net profit", color: S(3) }]} />
        </ChartCard>
        <ChartCard title="Quarterly profit" description={`${year} · net margin in table`}>
          <ClientBars data={y.quarters.map((q) => ({ label: q.label, netRevenue: q.netRevenue, netProfit: q.netProfit }))} series={[{ key: "netRevenue", label: "Revenue", color: S(1) }, { key: "netProfit", label: "Net profit", color: S(3) }]} height={180} />
          <Table className="mt-3">
            <THead><TR><TH>Quarter</TH><TH className="text-right">Revenue</TH><TH className="text-right">Gross profit</TH><TH className="text-right">Net profit</TH><TH className="text-right">Net margin</TH></TR></THead>
            <TBody>{y.quarters.map((q) => <TR key={q.key}><TD className="font-medium">{q.label}</TD><TD className="text-right">{money(q.netRevenue, { cents: false })}</TD><TD className="text-right">{money(q.grossProfit, { cents: false })}</TD><TD className="text-right">{money(q.netProfit, { cents: false })}</TD><TD className="text-right">{pct(q.netMargin)}</TD></TR>)}</TBody>
          </Table>
        </ChartCard>
      </section>
    </div>
  );
}
