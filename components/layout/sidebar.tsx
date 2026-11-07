"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Gamepad2, Loader2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";

/** Spinner shown on the tapped menu item while its page loads (useful when the database is waking up). */
function PendingIndicator() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" aria-label="Loading" /> : null;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    <PendingIndicator />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-6 py-5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#6250d6] to-[#2a78d6] text-white shadow-md">
        <Gamepad2 className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-[15px] font-semibold leading-tight">Game Vault</span>
        <span className="block text-[11px] text-muted-foreground">Books · Stock · Repairs</span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <Brand />
      <NavList />
      <div className="m-3 rounded-xl bg-gradient-to-br from-[#6250d6]/10 to-[#2a78d6]/10 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Double-entry ledger</p>
        Every number on screen is derived from balanced journal entries.
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <button className="rounded-lg p-2 hover:bg-accent lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-xl animate-in slide-in-from-left">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button className="rounded-lg p-2 hover:bg-accent" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
