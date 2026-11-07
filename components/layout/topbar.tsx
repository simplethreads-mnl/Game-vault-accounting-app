import { Bell } from "lucide-react";
import Link from "next/link";
import { MobileNav } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";
import { QuickAdd } from "@/components/forms/quick-add";
import { prisma } from "@/lib/db";

export async function Topbar() {
  const [lowParts, activeRepairs] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Part" WHERE quantity <= "reorderLevel"`,
    prisma.repairJob.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
  ]);
  const alerts = Number(lowParts[0]?.n ?? 0);
  return (
    <header className="app-topbar sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-8">
      <MobileNav />
      <div className="hidden text-sm text-muted-foreground sm:block">
        <span className="font-medium text-foreground">{activeRepairs}</span> repairs in queue
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <QuickAdd />
        <Link href="/inventory?tab=parts" className="relative rounded-lg p-2 hover:bg-accent" aria-label={`${alerts} low-stock alerts`}>
          <Bell className="h-4 w-4" />
          {alerts > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#d03b3b] px-1 text-[10px] font-semibold text-white">{alerts}</span>}
        </Link>
        <ThemeToggle />
        <LogoutButton />
        <div className="ml-1 hidden h-8 w-8 sm:grid place-items-center rounded-full bg-gradient-to-br from-[#eb6834] to-[#e87ba4] text-xs font-semibold text-white">GV</div>
      </div>
    </header>
  );
}
