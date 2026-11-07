import Link from "next/link";
import { Boxes, Clock, Gauge, Package, PiggyBank, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard, PageHeader } from "@/components/section";
import { ClientBars, ClientDonut } from "@/components/charts/simple";
import { S } from "@/components/charts/theme";
import { QuickAdd } from "@/components/forms/quick-add";
import { dashboard, parts, units } from "@/lib/queries";
import { UNIT_STATUS_LABEL, UNIT_STATUS_VARIANT } from "@/lib/labels";
import { cn, money, num, shortDate } from "@/lib/utils";

export const metadata = { title: "Inventory" };

const FILTERS = [
  { key: "unsold", label: "All unsold" },
  { key: "BROKEN", label: "Broken" },
  { key: "IN_REPAIR", label: "In repair" },
  { key: "READY", label: "Ready" },
  { key: "IN_STOCK", label: "In stock" },
  { key: "SOLD", label: "Sold" },
  { key: "all", label: "Everything" },
];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string; line?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "parts" ? "parts" : "units";
  const status = sp.status ?? "unsold";
  const [all, partRows, d] = await Promise.all([units(), parts(), dashboard("12m")]);
  const now = Date.now();

  let list = all;
  if (status === "unsold") list = list.filter((u) => ["IN_STOCK", "BROKEN", "IN_REPAIR", "READY", "RETURNED"].includes(u.status));
  else if (status !== "all") list = list.filter((u) => u.status === status);
  if (sp.line) list = list.filter((u) => u.productLine === sp.line);
  if (sp.q) list = list.filter((u) => `${u.sku} ${u.model} ${u.serial ?? ""}`.toLowerCase().includes(sp.q!.toLowerCase()));

  const byStatus = ["BROKEN", "IN_REPAIR", "READY", "IN_STOCK", "RETURNED"].map((s, i) => ({ key: s, label: UNIT_STATUS_LABEL[s], value: all.filter((u) => u.status === s).length, color: S(i + 1) }));
  const qs = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ tab, status, line: sp.line, q: sp.q, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Serialised devices (specific-identification cost) and parts (moving weighted-average cost)">
        <QuickAdd type="PURCHASE" label="Buy device" variant="outline" />
        <QuickAdd type="PARTS_PURCHASE" label="Buy parts" variant="outline" />
        <QuickAdd type="SALE" label="Record sale" />
      </PageHeader>

      <section className="stagger grid grid-cols-2 gap-4 xl:grid-cols-6">
        <KpiCard label="Unsold units" value={num(d.inventory.units)} icon={Package} hint="all statuses except sold" />
        <KpiCard label="Inventory cost" value={money(d.inventory.cost, { cents: false })} icon={Boxes} hint="at cost basis" />
        <KpiCard label="Inventory value" value={money(d.inventory.value, { cents: false })} icon={Tag} hint="at list price" />
        <KpiCard label="Profit potential" value={money(d.inventory.profitPotential, { cents: false })} icon={PiggyBank} hint="value − cost" />
        <KpiCard label="Turnover (12m)" value={`${d.inventory.turnover.rate.toFixed(1)}×`} icon={Gauge} hint={`${Math.round(d.inventory.turnover.daysInInventory)} days avg. in stock`} />
        <KpiCard label="Units sold (12m)" value={num(d.unitStats.soldCount)} icon={Clock} hint={`avg ${money(d.unitStats.avgProfitPerConsole, { cents: false })} / console`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Inventory aging" description="Cost tied up by days since purchase" className="lg:col-span-2">
          <ClientBars data={d.inventory.aging.map((a) => ({ label: `${a.label} (${a.units})`, cost: a.cost }))} series={[{ key: "cost", label: "Cost tied up", color: S(1) }]} height={220} />
        </ChartCard>
        <ChartCard title="Units by stage" description="Repair-and-resale pipeline">
          <ClientDonut data={byStatus} centerLabel="Unsold" centerValue={String(d.inventory.units)} />
        </ChartCard>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={qs({ tab: "units" })} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === "units" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>Devices</Link>
        <Link href={qs({ tab: "parts" })} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === "parts" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          Parts {partRows.some((p) => p.low) && <span className="ml-1 rounded-full bg-[#d03b3b] px-1.5 text-[10px] text-white">{partRows.filter((p) => p.low).length}</span>}
        </Link>
      </div>

      {tab === "units" ? (
        <ChartCard
          title="Devices"
          description={`${list.length} units`}
          action={
            <form className="flex gap-2" action="/inventory">
              <input type="hidden" name="status" value={status} />
              <input name="q" aria-label="Search devices" defaultValue={sp.q} placeholder="Search SKU, model, serial…" className="h-8 w-44 rounded-lg border bg-card px-2.5 text-xs sm:w-56" />
            </form>
          }
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Link key={f.key} href={qs({ status: f.key })} className={cn("rounded-full border px-2.5 py-1 text-xs", status === f.key ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{f.label}</Link>
            ))}
            <span className="mx-1 w-px bg-border" />
            {[["", "All lines"], ["SWITCH", "Switch"], ["IPHONE", "iPhone"]].map(([k, l]) => (
              <Link key={l} href={qs({ line: k || undefined })} className={cn("rounded-full border px-2.5 py-1 text-xs", (sp.line ?? "") === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{l}</Link>
            ))}
          </div>
          <Table>
            <THead>
              <TR><TH>SKU</TH><TH>Model</TH><TH>Status</TH><TH className="text-right">Purchase</TH><TH className="text-right">Cost basis</TH><TH className="text-right">List / Sold</TH><TH className="text-right">Profit</TH><TH className="text-right">Age</TH><TH /></TR>
            </THead>
            <TBody>
              {list.slice(0, 200).map((u) => {
                const age = Math.floor(((u.soldAt?.getTime() ?? now) - u.acquiredAt.getTime()) / 86_400_000);
                const price = u.salePrice ?? u.listPrice;
                return (
                  <TR key={u.id}>
                    <TD className="font-mono text-xs text-muted-foreground">{u.sku}</TD>
                    <TD className="font-medium">{u.model}</TD>
                    <TD><Badge variant={UNIT_STATUS_VARIANT[u.status]}>{UNIT_STATUS_LABEL[u.status]}</Badge></TD>
                    <TD className="text-right text-muted-foreground">{money(u.purchaseCost)}</TD>
                    <TD className="text-right">{money(u.costBasis)}</TD>
                    <TD className="text-right">{money(price)}</TD>
                    <TD className={cn("text-right font-medium", price - u.costBasis < 0 && "text-[#d03b3b]")}>{money(price - u.costBasis)}{!u.salePrice && <span className="text-[10px] text-muted-foreground"> est.</span>}</TD>
                    <TD className={cn("text-right", !u.soldAt && age > 60 && "font-medium text-[#ec835a]")}>{age}d</TD>
                    <TD className="text-right">
                      {["IN_STOCK", "READY", "RETURNED"].includes(u.status) && <QuickAdd type="SALE" label="Sell" variant="secondary" preset={{ unitId: u.id, amount: String(u.listPrice) }} />}
                      {["BROKEN", "IN_REPAIR"].includes(u.status) && <QuickAdd type="REFURBISH" label="Refurbish" variant="secondary" preset={{ unitId: u.id }} />}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {list.length > 200 && <p className="pt-3 text-xs text-muted-foreground">Showing 200 of {list.length}. Narrow the filter to see more.</p>}
          <p className="pt-3 text-xs text-muted-foreground">Acquired dates: newest {list[0] ? shortDate(list[0].acquiredAt) : "—"}.</p>
        </ChartCard>
      ) : (
        <ChartCard title="Parts inventory" description={`${partRows.length} SKUs · valued ${money(partRows.reduce((a, p) => a + p.value, 0))} at weighted-average cost`}>
          <Table>
            <THead><TR><TH>SKU</TH><TH>Part</TH><TH>Compatible</TH><TH className="text-right">On hand</TH><TH className="text-right">Reorder at</TH><TH className="text-right">Avg cost</TH><TH className="text-right">Value</TH><TH /></TR></THead>
            <TBody>
              {partRows.map((p) => (
                <TR key={p.id}>
                  <TD className="font-mono text-xs text-muted-foreground">{p.sku}</TD>
                  <TD className="font-medium">{p.name}</TD>
                  <TD className="text-muted-foreground">{p.compatible}</TD>
                  <TD className="text-right">{p.low ? <Badge variant={p.quantity === 0 ? "critical" : "warning"}>{p.quantity} · low</Badge> : p.quantity}</TD>
                  <TD className="text-right text-muted-foreground">{p.reorderLevel}</TD>
                  <TD className="text-right">{money(p.avgCost)}</TD>
                  <TD className="text-right">{money(p.value)}</TD>
                  <TD className="text-right"><QuickAdd type="PARTS_PURCHASE" label="Restock" variant="secondary" preset={{ partId: p.id, unitCost: String(p.avgCost), method: "BANK" }} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </ChartCard>
      )}
    </div>
  );
}
