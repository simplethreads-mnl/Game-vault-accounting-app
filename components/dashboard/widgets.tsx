import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleAlert, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/progress";
import { REPAIR_LABEL, REPAIR_VARIANT, DEVICE_LABEL } from "@/lib/labels";
import { money, pct } from "@/lib/utils";
import type { DashboardData } from "@/lib/queries";

export function AlertsList({ alerts }: { alerts: DashboardData["alerts"] }) {
  if (!alerts.length) return <p className="py-6 text-center text-sm text-muted-foreground">All clear — no stock or aging alerts.</p>;
  const Icon = { critical: CircleAlert, serious: Clock, warning: AlertTriangle };
  const label = { critical: "Out of stock", serious: "Aging", warning: "Attention" };
  return (
    <ul className="divide-y">
      {alerts.slice(0, 7).map((a, i) => {
        const I = Icon[a.level];
        return (
          <li key={i}>
            <Link href={a.href} className="flex items-start gap-3 py-2.5 hover:opacity-80">
              <I className={a.level === "critical" ? "mt-0.5 h-4 w-4 shrink-0 text-[#d03b3b]" : a.level === "serious" ? "mt-0.5 h-4 w-4 shrink-0 text-[#ec835a]" : "mt-0.5 h-4 w-4 shrink-0 text-[#c98500]"} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
              </div>
              <Badge variant={a.level}>{label[a.level]}</Badge>
            </Link>
          </li>
        );
      })}
      {alerts.length > 7 && <li className="pt-2 text-xs text-muted-foreground">+{alerts.length - 7} more</li>}
    </ul>
  );
}

export function RepairQueue({ jobs }: { jobs: DashboardData["activeRepairs"] }) {
  if (!jobs.length) return <p className="py-6 text-center text-sm text-muted-foreground">No active repairs.</p>;
  return (
    <ul className="divide-y">
      {jobs.slice(0, 6).map((j) => (
        <li key={j.id}>
          <Link href={`/repairs/${j.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium"><span className="text-muted-foreground">{j.jobNumber}</span> · {j.customer.name}</p>
              <p className="truncate text-xs text-muted-foreground">{DEVICE_LABEL[j.deviceType]} — {j.problem}</p>
            </div>
            <Badge variant={REPAIR_VARIANT[j.status]}>{REPAIR_LABEL[j.status]}</Badge>
          </Link>
        </li>
      ))}
      <li className="pt-2">
        <Link href="/repairs" className="inline-flex items-center gap-1 text-xs font-medium text-primary">Open repair board <ArrowRight className="h-3 w-3" /></Link>
      </li>
    </ul>
  );
}

export function ProfitSources({ sources }: { sources: DashboardData["profitSources"] }) {
  const max = Math.max(1, ...sources.map((s) => s.profit));
  return (
    <ul className="space-y-3">
      {sources.map((s, i) => (
        <li key={s.key}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">{i === 0 && <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">TOP</span>}{s.key}</span>
            <span className="tabular text-right">{money(s.profit, { cents: false })} <span className="text-xs text-muted-foreground">· {pct(s.revenue ? s.profit / s.revenue : 0, 0)}</span></span>
          </div>
          <Meter value={s.profit / max} color="var(--series-7)" />
        </li>
      ))}
    </ul>
  );
}

export function BestSellers({ models }: { models: DashboardData["unitStats"]["bestSelling"] }) {
  if (!models.length) return <p className="py-6 text-center text-sm text-muted-foreground">No units sold in this period.</p>;
  return (
    <ul className="divide-y">
      {models.map((m, i) => (
        <li key={m.model} className="flex items-center gap-3 py-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{m.model}</p>
            <p className="text-xs text-muted-foreground">{m.sold} sold · avg profit {money(m.avgProfit, { cents: false })}</p>
          </div>
          <span className="tabular text-sm font-medium">{money(m.profit, { cents: false })}</span>
        </li>
      ))}
    </ul>
  );
}

export function Pipeline({ p }: { p: DashboardData["pipeline"] }) {
  const steps = [
    { label: "Broken bought", value: p.broken, color: "var(--series-8)" },
    { label: "Under repair", value: p.inRepair, color: "var(--series-4)" },
    { label: "Repaired · ready", value: p.ready, color: "var(--series-3)" },
    { label: "Switch in stock", value: p.inStockSwitch, color: "var(--series-1)" },
    { label: "iPhones in stock", value: p.inStockIphone, color: "var(--series-7)" },
    { label: "Sold (period)", value: p.soldInPeriod, color: "var(--series-6)" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {steps.map((s) => (
        <div key={s.label} className="rounded-xl border bg-background/50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</div>
          <p className="mt-1 text-xl font-semibold tabular">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
