"use client";
import { CashFlow, Donut, GroupedBars, RankedBars, TrendArea, type Slice } from "@/components/charts/charts";
import { S } from "@/components/charts/theme";
import { ChartCard } from "@/components/section";
import { money } from "@/lib/utils";

type Point = { label: string; netRevenue: number; expensesTotal: number; netProfit: number; grossProfit: number; cashIn: number; cashOut: number; netCash: number };

export function RevenueVsExpenses({ data }: { data: Point[] }) {
  return (
    <ChartCard title="Revenue vs Expenses" description="Net revenue against cost of sales + operating expenses, last 12 months" className="xl:col-span-2">
      <GroupedBars data={data} series={[{ key: "netRevenue", label: "Revenue", color: S(1) }, { key: "expensesTotal", label: "Expenses", color: S(2) }]} />
    </ChartCard>
  );
}

export function ProfitTrend({ data, forecast }: { data: Point[]; forecast: { label: string; netProfit: number }[] }) {
  // Actuals for complete months; the current (partial) month and the next two are shown as forecast.
  const complete = data.slice(0, -1);
  const rows = [
    ...complete.map((d, i) => ({ label: d.label, netProfit: d.netProfit, grossProfit: d.grossProfit, forecast: i === complete.length - 1 ? d.netProfit : null })),
    ...forecast.map((f, i) => ({ label: i === 0 ? `${f.label} (fcst)` : f.label, netProfit: null, grossProfit: null, forecast: f.netProfit })),
  ];
  return (
    <ChartCard title="Profit trend & forecast" description="Complete months, plus a linear forecast for this month and the next two">
      <TrendArea data={rows} series={[{ key: "grossProfit", label: "Gross profit", color: S(1) }, { key: "netProfit", label: "Net profit", color: S(3) }, { key: "forecast", label: "Forecast (net)", color: S(3), dashed: true }]} />
    </ChartCard>
  );
}

export function CashFlowCard({ data }: { data: Point[] }) {
  return (
    <ChartCard title="Cash flow" description="Money in and out of cash & bank accounts">
      <CashFlow data={data.map((d) => ({ label: d.label, cashIn: d.cashIn, cashOutNeg: -d.cashOut, netCash: d.netCash }))} />
    </ChartCard>
  );
}

export function DonutCard({ title, description, data, centerLabel, centerValue }: { title: string; description?: string; data: Slice[]; centerLabel: string; centerValue: string }) {
  return (
    <ChartCard title={title} description={description}>
      <Donut data={data} centerLabel={centerLabel} centerValue={centerValue} />
    </ChartCard>
  );
}

export function EatsMoney({ data, total }: { data: Slice[]; total: number }) {
  return (
    <ChartCard title="What eats our money" description={`Operating spend + repair costs · ${money(total, { cents: false })}`}>
      <RankedBars data={data} />
    </ChartCard>
  );
}
