"use client";
import { useState } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { money } from "@/lib/utils";
import { useApi } from "./use-api";

/** Set or change a unit's asking (list) price. Non-financial edit, recorded in the audit trail. */
export function PriceButton({ id, sku, model, listPrice, costBasis, showLabel = false }: { id: string; sku: string; model: string; listPrice: number; costBasis: number; showLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(listPrice > 0 ? String(listPrice) : "");
  const { call, pending } = useApi();
  const p = Number(price || 0);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={listPrice > 0 ? "ghost" : "outline"} aria-label={`Set price for ${sku}`}>
          <Tag /> <span className={showLabel ? "" : "hidden sm:inline"}>{listPrice > 0 ? "Price" : "Set price"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent title={`Asking price · ${model}`} description={`${sku} · cost ${money(costBasis)}. This changes the price you plan to sell at, not your books.`}>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call("/api/inventory", { id, listPrice: p }, "PATCH", "Price updated")) setOpen(false);
          }}
        >
          <Field label="List price">
            <Input type="number" inputMode="decimal" step="0.01" min="0" required autoFocus value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          {p > 0 && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Expected profit <b className={p - costBasis < 0 ? "text-[#d03b3b]" : "text-foreground"}>{money(p - costBasis)}</b>
            </p>
          )}
          <Button disabled={pending}>Save price</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
