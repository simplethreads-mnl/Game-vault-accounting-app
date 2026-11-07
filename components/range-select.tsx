"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "30d", label: "30D" },
  { key: "mtd", label: "MTD" },
  { key: "qtd", label: "QTD" },
  { key: "ytd", label: "YTD" },
  { key: "12m", label: "12M" },
];

export function RangeSelect({ value }: { value: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5 shadow-sm" role="radiogroup" aria-label="Date range">
      {RANGES.map((r) => (
        <button
          key={r.key}
          role="radio"
          aria-checked={value === r.key}
          onClick={() => {
            const p = new URLSearchParams(params);
            p.set("range", r.key);
            router.push(`${path}?${p.toString()}`, { scroll: false });
          }}
          className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", value === r.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
