import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-transparent bg-primary/10 text-primary",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "text-foreground",
      good: "border-transparent bg-[#0ca30c]/12 text-[var(--delta-good)]",
      warning: "border-transparent bg-[#fab219]/20 text-amber-800 dark:text-[#fab219]",
      serious: "border-transparent bg-[#ec835a]/15 text-orange-800 dark:text-[#ec835a]",
      critical: "border-transparent bg-[#d03b3b]/12 text-[#b02a2a] dark:text-[#ff8a8a]",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
