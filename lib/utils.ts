import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { CURRENCY, LOCALE } from "./currency";

export function money(n: number, opts: { compact?: boolean; cents?: boolean } = {}) {
  const { compact = false, cents = true } = opts;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact || !cents ? 0 : 2,
    maximumFractionDigits: compact ? 1 : cents ? 2 : 0,
  }).format(n);
}

export function pct(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function num(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function shortDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
