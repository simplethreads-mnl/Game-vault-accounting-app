"use client";
import { money } from "@/lib/utils";

type Item = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

export function ChartTooltip({ active, payload, label, format = (v: number) => money(v) }: { active?: boolean; payload?: Item[]; label?: string | number; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-xl border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label != null && <p className="mb-1.5 font-medium text-foreground">{label}</p>}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="tabular font-medium text-foreground">{format(Number(p.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-3.5 rounded-full" style={i.dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` } : { background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
