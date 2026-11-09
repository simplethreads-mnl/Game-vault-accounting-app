import Form from "next/form";
import Link from "next/link";
import { Boxes, Clock, Gauge, Package, PiggyBank, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard, PageHeader } from "@/components/section";
import { ClientBars, ClientDonut } from "@/components/charts/simple";
import { S } from "@/components/charts/theme";
import { QuickAdd } from "@/components/forms/quick-add";
import { PriceButton } from "@/components/forms/price-button";
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
        <KpiCard label="Inventory value" value={money(d.inventory.value, { cents: false })} icon={Tag} hint={d.inventory.unpriced ? `${d.inventory.unpriced} without a price · counted at cost` : "at list price"} />
        <KpiCard label="Profit potential" value={money(d.inventory.profitPotential, { cents: false })} icon={PiggyBank} hint="value − cost" />
        <KpiCard label="Turnover (12m)" value={`${d.inventory.turnover.rate.toFixed(1)}×`} icon={Gauge} hint={`${Math.round(d.inventory.turnover.daysInInventory)} days avg. in stock`} />
        <KpiCard label="Units sold (12m)" value={num(d.unitStats.soldCount)} icon={Clock} hint={`avg ${money(d.unitStats.avgProfitPerConsole, { cents: false })} / console`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Inventory aging" description="Cost tied up by days since purchase" className="lg:col-span-2">
          <ClientBars data={d.inventory.aging.map((a) => ({ label: `${a.label} (${a.units})`, cost: a.cost }))} series={[{ key: "cost", label: "Cost tied up", color: S(1) }]} height={220} />
        </ChartCard>
        <ChartCard title="Units by stage" description="Repair-and-resale pipeline">
          <ClientDonut kind="count" data={byStatus} centerLabel="Unsold" centerValue={String(d.inventory.units)} />
        </ChartCard>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link prefetch={false} href={qs({ tab: "units" })} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === "units" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>Devices</Link>
        <Link prefetch={false} href={qs({ tab: "parts" })} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === "parts" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          Parts {partRows.some((p) => p.low) && <span className="ml-1 rounded-full bg-[#d03b3b] px-1.5 text-[10px] text-white">{partRows.filter((p) => p.low).length}</span>}
        </Link>
      </div>

      {tab === "units" ? (
        <ChartCard
          title="Devices"
          description={`${list.length} units`}
          action={
            <Form prefetch={false} className="flex gap-2" action="/inventory">
              <input type="hidden" name="status" value={status} />
              <input name="q" aria-label="Search devices" defaultValue={sp.q} placeholder="Search SKU, model, serial…" className="h-8 w-44 rounded-lg border bg-card px-2.5 text-base sm:w-56 sm:text-xs" />
            </Form>
          }
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Link prefetch={false} key={f.key} href={qs({ status: f.key })} className={cn("rounded-full border px-2.5 py-1 text-xs", status === f.key ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{f.label}</Link>
            ))}
            <span className="mx-1 w-px bg-border" />
            {[["", "All lines"], ["SWITCH", "Switch"], ["IPHONE", "iPhone"], ["PC_PARTS", "PC parts"]].map(([k, l]) => (
              <Link prefetch={false} key={l} href={qs({ line: k || undefined })} className={cn("rounded-full border px-2.5 py-1 text-xs", (sp.line ?? "") === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{l}</Link>
            ))}
          </div>
          {/* Phones: stacked cards */}
          <ul className="divide-y md:hidden">
            {list.slice(0, 200).map((u) => {
              const age = Math.max(0, Math.floor(((u.soldAt?.getTime() ?? now) - u.acquiredAt.getTime()) / 86_400_000));
              const price = u.salePrice ?? u.listPrice;
              const profit = price - u.costBasis;
              return (
                <li key={u.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{u.model}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-mono">{u.sku}</span> · {age}d old</p>
                    </div>
                    <Badge variant={UNIT_STATUS_VARIANT[u.status]}>{UNIT_STATUS_LABEL[u.status]}</Badge>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Cost</dt><dd className="font-medium tabular">{money(u.costBasis, { cents: false })}</dd></div>
                    <div><dt className="text-muted-foreground">{u.salePrice != null ? "Sold for" : "List price"}</dt><dd className="font-medium tabular">{price > 0 ? money(price, { cents: false }) : "—"}</dd></div>
                    <div><dt className="text-muted-foreground">{u.salePrice != null ? "Profit" : "Est. profit"}</dt><dd className={cn("font-medium tabular", profit < 0 && "text-[#d03b3b]")}>{price > 0 ? money(profit, { cents: false }) : "—"}</dd></div>
                  </dl>
                  <div className="mt-2 flex justify-end gap-1.5">
                    {!["SOLD", "WRITTEN_OFF"].includes(u.status) && <PriceButton id={u.id} sku={u.sku} model={u.model} listPrice={u.listPrice} costBasis={u.costBasis} showLabel />}
                    {["IN_STOCK", "READY", "RETURNED"].includes(u.status) && <QuickAdd type="SALE" label="Sell" variant="secondary" showLabel preset={{ unitId: u.id, ...(u.listPrice > 0 ? { amount: String(u.listPrice) } : {}) }} />}
                    {["BROKEN", "IN_REPAIR"].includes(u.status) && <QuickAdd type="REFURBISH" label="Refurbish" variant="secondary" showLabel preset={{ unitId: u.id }} />}
                  </div>
                </li>
              );
            })}
          </ul>
          {/* Tablets and laptops: table */}
          <div className="hidden md:block">
          <Table className="table-fixed">
            <THead>
              <TR>
                <TH className="hidden w-[96px] xl:table-cell">SKU</TH>
                <TH>Model</TH>
                <TH className="w-[124px]">Status</TH>
                <TH className="hidden w-[112px] text-right xl:table-cell">Purchase</TH>
                <TH className="hidden w-[112px] text-right lg:table-cell">Cost basis</TH>
                <TH className="w-[112px] text-right">List / Sold</TH>
                <TH className="w-[112px] text-right">Profit</TH>
                <TH className="hidden w-[64px] text-right lg:table-cell">Age</TH>
                <TH className="sticky right-0 bg-card w-[132px] sm:w-[188px]"><span className="sr-only">Actions</span></TH>
              </TR>
            </THead>
            <TBody>
              {list.slice(0, 200).map((u) => {
                const age = Math.max(0, Math.floor(((u.soldAt?.getTime() ?? now) - u.acquiredAt.getTime()) / 86_400_000));
                const price = u.salePrice ?? u.listPrice;
                return (
                  <TR key={u.id} className="group">
                    <TD className="hidden truncate font-mono text-xs text-muted-foreground xl:table-cell">{u.sku}</TD>
                    <TD className="min-w-0">
                      <span className="block truncate font-medium" title={u.model}>{u.model}</span>
                      <span className="block truncate text-xs text-muted-foreground xl:hidden">
                        <span className="font-mono">{u.sku}</span>
                        <span className="lg:hidden"> · cost {money(u.costBasis, { cents: false })} · {age}d</span>
                      </span>
                    </TD>
                    <TD><Badge className="whitespace-normal leading-tight" variant={UNIT_STATUS_VARIANT[u.status]}>{UNIT_STATUS_LABEL[u.status]}</Badge></TD>
                    <TD className="hidden whitespace-nowrap text-right text-muted-foreground xl:table-cell">{money(u.purchaseCost)}</TD>
                    <TD className="hidden whitespace-nowrap text-right lg:table-cell">{money(u.costBasis)}</TD>
                    <TD className="whitespace-nowrap text-right">{money(price)}</TD>
                    <TD className={cn("whitespace-nowrap text-right font-medium", price - u.costBasis < 0 && "text-[#d03b3b]")}>{money(price - u.costBasis)}{!u.salePrice && <span className="text-[10px] text-muted-foreground"> est.</span>}</TD>
                    <TD className={cn("hidden text-right lg:table-cell", !u.soldAt && age > 60 && "font-medium text-[#ec835a]")}>{age}d</TD>
                    <TD className="sticky right-0 bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)] group-hover:bg-muted px-1 text-right">
                      <div className="flex justify-end gap-1.5">
                        {!["SOLD", "WRITTEN_OFF"].includes(u.status) && <PriceButton id={u.id} sku={u.sku} model={u.model} listPrice={u.listPrice} costBasis={u.costBasis} />}
                        {["IN_STOCK", "READY", "RETURNED"].includes(u.status) && <QuickAdd type="SALE" label="Sell" variant="secondary" preset={{ unitId: u.id, ...(u.listPrice > 0 ? { amount: String(u.listPrice) } : {}) }} />}
                        {["BROKEN", "IN_REPAIR"].includes(u.status) && <QuickAdd type="REFURBISH" label="Refurbish" variant="secondary" preset={{ unitId: u.id }} />}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          </div>
          {list.length > 200 && <p className="pt-3 text-xs text-muted-foreground">Showing 200 of {list.length}. Narrow the filter to see more.</p>}
          <p className="pt-3 text-xs text-muted-foreground">Acquired dates: newest {list[0] ? shortDate(list[0].acquiredAt) : "—"}.</p>
        </ChartCard>
      ) : (
        <ChartCard title="Parts inventory" description={`${partRows.length} SKUs · valued ${money(partRows.reduce((a, p) => a + p.value, 0))} at weighted-average cost`}>
          {/* Phones: stacked cards */}
          <ul className="divide-y md:hidden">
            {partRows.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{p.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-mono">{p.sku}</span>{p.compatible ? ` · ${p.compatible}` : ""}</p>
                  </div>
                  {p.low ? <Badge variant={p.quantity === 0 ? "critical" : "warning"}>{p.quantity} · low</Badge> : <Badge variant="secondary">{p.quantity} on hand</Badge>}
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className="text-xs text-muted-foreground">avg {money(p.avgCost)} · value {money(p.value, { cents: false })} · reorder at {p.reorderLevel}</p>
                  <QuickAdd type="PARTS_PURCHASE" label="Restock" variant="secondary" showLabel preset={{ partId: p.id, unitCost: String(p.avgCost), method: "BANK" }} />
                </div>
              </li>
            ))}
          </ul>
          {/* Tablets and laptops: table */}
          <div className="hidden md:block">
          <Table className="table-fixed">
            <THead>
              <TR>
                <TH className="hidden w-[120px] xl:table-cell">SKU</TH>
                <TH>Part</TH>
                <TH className="hidden w-[150px] lg:table-cell">Compatible</TH>
                <TH className="w-[96px] text-right">On hand</TH>
                <TH className="hidden w-[96px] text-right xl:table-cell">Reorder at</TH>
                <TH className="w-[104px] text-right">Avg cost</TH>
                <TH className="hidden w-[112px] text-right sm:table-cell">Value</TH>
                <TH className="sticky right-0 bg-card w-[64px] sm:w-[124px]"><span className="sr-only">Actions</span></TH>
              </TR>
            </THead>
            <TBody>
              {partRows.map((p) => (
                <TR key={p.id} className="group">
                  <TD className="hidden truncate font-mono text-xs text-muted-foreground xl:table-cell">{p.sku}</TD>
                  <TD className="min-w-0">
                    <span className="block truncate font-medium" title={p.name}>{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground xl:hidden">
                      <span className="font-mono">{p.sku}</span>
                      <span className="lg:hidden">{p.compatible ? ` · ${p.compatible}` : ""}</span>
                      {` · reorder at ${p.reorderLevel}`}
                    </span>
                  </TD>
                  <TD className="hidden truncate text-muted-foreground lg:table-cell">{p.compatible}</TD>
                  <TD className="text-right">{p.low ? <Badge variant={p.quantity === 0 ? "critical" : "warning"}>{p.quantity} · low</Badge> : p.quantity}</TD>
                  <TD className="hidden text-right text-muted-foreground xl:table-cell">{p.reorderLevel}</TD>
                  <TD className="whitespace-nowrap text-right">{money(p.avgCost)}</TD>
                  <TD className="hidden whitespace-nowrap text-right sm:table-cell">{money(p.value)}</TD>
                  <TD className="sticky right-0 bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)] group-hover:bg-muted px-1 text-right"><QuickAdd type="PARTS_PURCHASE" label="Restock" variant="secondary" preset={{ partId: p.id, unitCost: String(p.avgCost), method: "BANK" }} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
