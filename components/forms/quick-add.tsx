"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";

export function QuickAdd({ type = "SALE", label = "New transaction", preset, variant = "default", showLabel = false }: { type?: string; label?: string; preset?: Record<string, string>; variant?: "default" | "outline" | "secondary"; showLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant} aria-label={label}><Plus /> <span className={showLabel ? "" : "hidden sm:inline"}>{label}</span></Button>
      </DialogTrigger>
      <DialogContent title={label} description="Posts a balanced double-entry journal entry and updates inventory automatically." className="max-w-2xl">
        {open && <TransactionForm initialType={type} preset={preset} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
