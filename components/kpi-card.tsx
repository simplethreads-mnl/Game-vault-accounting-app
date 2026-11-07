import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/charts";
import { cn } from "@/lib/utils";

export function KpiCard({
  label, value, icon: Icon, delta, deltaLabel = "vs prev. period", invert = false, spark, sparkColor, hint, className,
}: {
  label: string; value: string; icon?: LucideIcon; delta?: number | null; deltaLabel?: string; invert?: boolean;
  spark?: number[]; sparkColor?: string; hint?: string; className?: string;
}) {
  const flat = delta == null || Math.abs(delta) < 0.0005;
  const good = flat ? null : invert ? delta! < 0 : delta! > 0;
  const Arrow = delta == null || Math.abs(delta) < 0.0005 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className={cn("relative overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">{value}</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {delta != null && Number.isFinite(delta) && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", good == null ? "text-muted-foreground" : good ? "text-[var(--delta-good)]" : "text-[#d03b3b] dark:text-[#ff8a8a]")}>
            <Arrow className="h-3.5 w-3.5" aria-hidden />
            {(Math.abs(delta) * 100).toFixed(1)}%
          </span>
        )}
        <span className="text-muted-foreground">{delta != null && Number.isFinite(delta) ? deltaLabel : hint}</span>
      </div>
      {spark && spark.length > 1 && <div className="-mx-1 mt-2"><Sparkline values={spark} color={sparkColor} /></div>}
    </Card>
  );
}

export const change = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? 0 : null) : (cur - prev) / Math.abs(prev));
