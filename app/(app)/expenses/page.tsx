import { Card } from "@/components/ui/card";
import { Meter } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ChartCard, PageHeader } from "@/components/section";
import { RangeSelect } from "@/components/range-select";
import { ClientBars, ClientDonut, ClientRanked } from "@/components/charts/simple";
import { S } from "@/components/charts/theme";
import { QuickAdd } from "@/components/forms/quick-add";
import { CATEGORY_LABEL } from "@/lib/accounting/chart";
import { expenseAnalysis } from "@/lib/queries";
import { money, pct } from "@/lib/utils";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const a = await expenseAnalysis(range ?? "12m");
  const items = a.spending.items.map((s, i) => ({ ...s, color: S(i + 1) }));
  const top = [...items].sort((x, y) => y.value - x.value)[0];
  const cats = Object.entries(a.pnl.expenseByCategory).sort((x, y) => y[1] - x[1]);
  const opex = a.pnl.operatingExpenses;
  const revenue = a.pnl.netRevenue;

  return (
    <div className="space-y-6">
      <PageHeader title="Expense analysis" description={`What eats our money · ${a.range.label}`}>
        <RangeSelect value={a.range.key} />
        <QuickAdd type="EXPENSE" label="Add expense" />
      </PageHeader>

      <section className="stagger grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Card className="col-span-2 bg-gradient-to-br from-[#6250d6] to-[#2a78d6] p-5 text-white md:col-span-3 xl:col-span-1">
          <p className="text-xs text-white/80">Biggest cost driver</p>
          <p className="mt-1 text-2xl font-semibold">{top?.label}</p>
          <p className="text-sm text-white/85">{money(top?.value ?? 0, { cents: false })} · {pct(top?.share ?? 0, 0)} of spend</p>
        </Card>
        {items.map((i) => (
          <Card key={i.key} className="p-5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: i.color }} />{i.label} expenses</div>
            <p className="mt-1 text-2xl font-semibold tabular">{pct(i.share)}</p>
            <p className="mb-2 text-xs text-muted-foreground">{money(i.value, { cents: false })} · {pct(revenue ? i.value / revenue : 0)} of revenue</p>
            <Meter value={i.share} color={i.color} />
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Spending mix" description={`Operating expenses + repair parts & labor · ${money(a.spending.total, { cents: false })}`}>
          <ClientDonut data={items} centerLabel="Total spend" centerValue={money(a.spending.total, { compact: true })} />
        </ChartCard>
        <ChartCard title="Ranked by amount" description="Parts and labor include repair-job costs">
          <ClientRanked data={items} height={260} />
        </ChartCard>
      </section>

      <ChartCard title="Monthly expense trend" description="Last 12 months, stacked by bucket">
        <ClientBars stacked data={a.monthly} series={items.map((i) => ({ key: i.key, label: i.label, color: i.color }))} height={300} />
      </ChartCard>

      <ChartCard title="All expense categories" description={`Operating expenses ${money(opex)} · ${pct(revenue ? opex / revenue : 0)} of net revenue`}>
        <Table>
          <THead><TR><TH>Category</TH><TH className="text-right">Amount</TH><TH className="text-right">% of opex</TH><TH className="text-right">% of revenue</TH><TH className="w-1/3">Share</TH></TR></THead>
          <TBody>
            {cats.map(([k, v]) => (
              <TR key={k}>
                <TD className="font-medium">{CATEGORY_LABEL[k]}</TD>
                <TD className="text-right">{money(v)}</TD>
                <TD className="text-right">{pct(opex ? v / opex : 0)}</TD>
                <TD className="text-right text-muted-foreground">{pct(revenue ? v / revenue : 0)}</TD>
                <TD><Meter value={opex ? v / opex : 0} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </ChartCard>
    </div>
  );
}
