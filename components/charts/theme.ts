import { CURRENCY_SYMBOL } from "@/lib/currency";

export const S = (i: number) => `var(--series-${i})`;
export const GRID = "var(--chart-grid)";
export const AXIS = "var(--chart-axis)";
export const SURFACE = "var(--chart-surface)";

export const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/** Short axis labels: ₱4.5k, ₱120k, ₱1.2M (sign before the symbol). */
export const compactMoney = (v: number) => {
  const a = Math.abs(v), sign = v < 0 ? "-" : "";
  const body = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}M` : a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `${Math.round(a)}`;
  return `${sign}${CURRENCY_SYMBOL}${body}`;
};
