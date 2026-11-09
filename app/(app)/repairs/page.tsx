import Link from "next/link";
import { CheckCircle2, Percent, Timer, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard, PageHeader } from "@/components/section";
import { ClientRanked } from "@/components/charts/simple";
import { S } from "@/components/charts/theme";
import { NewRepairButton } from "@/components/forms/repair-forms";
import { repairProfit, repairStats } from "@/lib/accounting/metrics";
import { DEVICE_LABEL, REPAIR_LABEL, REPAIR_STATUSES, REPAIR_VARIANT } from "@/lib/labels";
import { repairs } from "@/lib/queries";
import { businessToday } from "@/lib/currency";
import { cn, money, pct, shortDate } from "@/lib/utils";

export const metadata = { title: "Repairs" };

export default async function RepairsPage() {
  const jobs = await repairs();
  const active = jobs.filter((j) => !["COMPLETED", "CANCELLED"].includes(j.status));
  const since = new Date(Date.now() - 90 * 86_400_000);
  const recent = jobs.filter((j) => j.completedAt && j.completedAt >= since);
  const stats = repairStats(recent);
  const done = recent.filter((j) => j.status === "COMPLETED");
  const avgTurnaround = done.length ? done.reduce((a, j) => a + (j.completedAt!.getTime() - j.receivedAt.getTime()) / 86_400_000, 0) / done.length : 0;
  const board = REPAIR_STATUSES.filter((s) => s.value !== "COMPLETED");
  const now = businessToday();

  return (
    <div className="space-y-6">
      <PageHeader title="Repairs" description="Device repair queue, job costing and repair profitability">
        <NewRepairButton />
      </PageHeader>

      <section className="stagger grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Active jobs" value={String(active.length)} icon={Wrench} hint={`${active.filter((j) => j.dueAt && j.dueAt < now).length} overdue`} />
        <KpiCard label="Completed (90d)" value={String(stats.completed)} icon={CheckCircle2} hint={`${money(done.reduce((a, j) => a + j.price, 0), { cents: false })} billed`} />
        <KpiCard label="Avg repair margin" value={pct(stats.avgMargin)} icon={Percent} hint="after parts + labor" />
        <KpiCard label="Avg turnaround" value={`${avgTurnaround.toFixed(1)} days`} icon={Timer} hint="received → completed" />
      </section>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {board.map((col) => {
            const items = active.filter((j) => j.status === col.value);
            return (
              <div key={col.value} className="rounded-2xl border bg-muted/40 p-2.5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold">{col.label}</span>
                  <span className="rounded-full bg-card px-2 text-[11px] text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((j) => (
                    <Link prefetch={false} key={j.id} href={`/repairs/${j.id}`} className="block rounded-xl border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-mono">{j.jobNumber}</span>
                        {j.dueAt && j.dueAt < now && <Badge variant="critical">Overdue</Badge>}
                      </div>
                      <p className="mt-1 text-sm font-medium leading-snug">{j.customer.name}</p>
                      <p className="text-xs text-muted-foreground">{DEVICE_LABEL[j.deviceType]} · {j.problem}</p>
                      <p className="mt-1.5 text-xs tabular">{money(j.price, { cents: false })}{j.deposit > 0 && <span className="text-muted-foreground"> · dep. {money(j.deposit, { cents: false })}</span>}</p>
                    </Link>
                  ))}
                  {!items.length && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Most profitable repairs" description="Total profit by repair type, last 90 days" className="lg:col-span-1">
          <ClientRanked data={stats.types.slice(0, 7).map((t, i) => ({ key: t.type, label: t.type.split(" · ")[1]?.slice(0, 18) ?? t.type, value: t.profit, color: S(i + 1) }))} />
        </ChartCard>
        <ChartCard title="Repair profitability" description="By repair type, last 90 days" className="lg:col-span-2">
          <Table>
            <THead><TR><TH>Repair type</TH><TH className="text-right">Jobs</TH><TH className="text-right">Revenue</TH><TH className="text-right">Profit</TH><TH className="text-right">Margin</TH></TR></THead>
            <TBody>
              {stats.types.map((t) => (
                <TR key={t.type}><TD className="font-medium">{t.type}</TD><TD className="text-right">{t.jobs}</TD><TD className="text-right">{money(t.revenue, { cents: false })}</TD><TD className="text-right">{money(t.profit, { cents: false })}</TD><TD className="text-right">{pct(t.margin)}</TD></TR>
              ))}
            </TBody>
          </Table>
        </ChartCard>
      </section>

      <ChartCard title="All repair jobs" description="Most recent 100">
        <Table>
          <THead><TR><TH>Job #</TH><TH>Customer</TH><TH>Device</TH><TH>Problem</TH><TH>Parts</TH><TH className="text-right">Labor</TH><TH className="text-right">Price</TH><TH className="text-right">Profit</TH><TH>Status</TH><TH>Received</TH></TR></THead>
          <TBody>
            {jobs.slice(0, 100).map((j) => {
              const p = repairProfit(j);
              return (
                <TR key={j.id}>
                  <TD><Link prefetch={false} className="font-mono text-xs text-primary hover:underline" href={`/repairs/${j.id}`}>{j.jobNumber}</Link></TD>
                  <TD className="font-medium">{j.customer.name}</TD>
                  <TD>{DEVICE_LABEL[j.deviceType]}</TD>
                  <TD className="max-w-[220px] truncate text-muted-foreground">{j.problem}</TD>
                  <TD className="text-right">{money(j.partsCost)}</TD>
                  <TD className="text-right">{money(j.laborCost)}</TD>
                  <TD className="text-right">{money(j.price)}</TD>
                  <TD className={cn("text-right font-medium", p.profit < 0 && "text-[#d03b3b]")}>{money(p.profit)}</TD>
                  <TD><Badge variant={REPAIR_VARIANT[j.status]}>{REPAIR_LABEL[j.status]}</Badge></TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{shortDate(j.receivedAt)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </ChartCard>
    </div>
  );
}
