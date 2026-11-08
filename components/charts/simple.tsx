"use client";
import { Donut, GroupedBars, MultiLine, RankedBars, TrendArea, type SeriesDef, type Slice } from "./charts";

/** Thin client wrappers so server pages can pass plain data. */
export function ClientDonut(p: { data: Slice[]; centerLabel: string; centerValue: string; kind?: "money" | "count" }) { return <Donut {...p} />; }
export function ClientBars(p: { data: Record<string, number | string | null>[]; series: SeriesDef[]; stacked?: boolean; height?: number; xKey?: string }) { return <GroupedBars {...p} />; }
export function ClientRanked(p: { data: Slice[]; height?: number }) { return <RankedBars {...p} />; }
export function ClientArea(p: { data: Record<string, number | string | null>[]; series: SeriesDef[]; height?: number }) { return <TrendArea {...p} />; }
export function ClientLines(p: { data: Record<string, number | string | null>[]; series: SeriesDef[]; height?: number }) { return <MultiLine {...p} />; }
