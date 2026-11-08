"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { money, pct } from "@/lib/utils";
import { AXIS, GRID, S, SURFACE, axisProps, compactMoney } from "./theme";
import { ChartTooltip, Legend } from "./tooltip";

export type SeriesDef = { key: string; label: string; color: string; dashed?: boolean };
type Row = Record<string, number | string | null>;

const H = 260;

/** Multi-series area chart for trends (e.g. profit trend + forecast). */
export function TrendArea({ data, series, height = H, xKey = "label" }: { data: Row[]; series: SeriesDef[]; height?: number; xKey?: string }) {
  return (
    <div className="space-y-3">
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={s.dashed ? 0.06 : 0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axisProps} tickFormatter={compactMoney} width={52} />
          <ReferenceLine y={0} stroke={AXIS} strokeOpacity={0.5} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS, strokeDasharray: "3 3" }} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }} connectNulls animationDuration={900} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Grouped vertical bars (e.g. revenue vs expenses by month). */
export function GroupedBars({ data, series, height = H, xKey = "label", stacked = false }: { data: Row[]; series: SeriesDef[]; height?: number; xKey?: string; stacked?: boolean }) {
  return (
    <div className="space-y-3">
      {series.length > 1 && <Legend items={series} />}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={2} barCategoryGap={stacked ? "28%" : "22%"}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} tickFormatter={compactMoney} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? "a" : undefined} stroke={stacked ? SURFACE : undefined} strokeWidth={stacked ? 1 : 0}
              radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]} maxBarSize={28} animationDuration={800} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cash flow: inflow / outflow bars with net line, single shared axis. */
export function CashFlow({ data, height = H }: { data: Row[]; height?: number }) {
  return (
    <div className="space-y-3">
      <Legend items={[{ label: "Cash in", color: S(1) }, { label: "Cash out", color: S(2) }, { label: "Net cash", color: S(7) }]} />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} tickFormatter={compactMoney} width={52} />
          <ReferenceLine y={0} stroke={AXIS} strokeOpacity={0.6} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />
          <Bar dataKey="cashIn" name="Cash in" fill={S(1)} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="cashOutNeg" name="Cash out" fill={S(2)} radius={[0, 0, 4, 4]} maxBarSize={22} />
          <Line type="monotone" dataKey="netCash" name="Net cash" stroke={S(7)} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: SURFACE, fill: S(7) }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export type Slice = { key: string; label: string; value: number; color: string };

/** Donut with a hero number in the middle and a value legend underneath. */
export function Donut({ data, centerLabel, centerValue, height = 210, kind = "money" }: { data: Slice[]; centerLabel: string; centerValue: string; height?: number; kind?: "money" | "count" }) {
  const fmtValue = (v: number) => (kind === "count" ? v.toLocaleString() : money(v, { cents: false }));
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0);
  const visible = data.filter((d) => d.value > 0);
  return (
    <div className="grid gap-4">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip format={(v) => `${kind === "count" ? v.toLocaleString() : money(v)} · ${pct(total ? v / total : 0)}`} />} />
            <Pie data={visible} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="92%" paddingAngle={visible.length > 1 ? 1.5 : 0} cornerRadius={4} stroke={SURFACE} strokeWidth={2} animationDuration={900}>
              {visible.map((d) => <Cell key={d.key} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">{centerLabel}</p>
            <p className="text-xl font-semibold tracking-tight">{centerValue}</p>
          </div>
        </div>
      </div>
      <ul className="grid gap-1.5 text-xs">
        {data.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="tabular shrink-0 font-medium">
              {fmtValue(d.value)} <span className="text-muted-foreground">· {pct(total ? Math.max(0, d.value) / total : 0, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal ranked bars — "what eats our money". */
export function RankedBars({ data, height }: { data: Slice[]; height?: number }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, sorted.length * 40)}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="28%">
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" {...axisProps} width={96} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />
        <Bar dataKey="value" name="Spend" radius={[0, 4, 4, 0]} animationDuration={800}
          label={{ position: "right", fill: AXIS, fontSize: 11, formatter: (v: number) => compactMoney(v) }}>
          {sorted.map((d) => <Cell key={d.key} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({ data, series, height = H, format = compactMoney }: { data: Row[]; series: SeriesDef[]; height?: number; format?: (v: number) => string }) {
  return (
    <div className="space-y-3">
      {series.length > 1 && <Legend items={series} />}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} tickFormatter={format} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS, strokeDasharray: "3 3" }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, color = S(1) }: { values: number[]; color?: string }) {
  const data = values.map((v, i) => ({ i, v }));
  const id = `sp-${color.replace(/\W/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
