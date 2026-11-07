import { cn } from "@/lib/utils";

export function Meter({ value, className, color = "var(--series-7)" }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="meter" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}
