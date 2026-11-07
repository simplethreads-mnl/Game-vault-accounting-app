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

export const compactMoney = (v: number) =>
  Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`;
