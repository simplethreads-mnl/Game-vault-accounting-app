"use client";
import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useApi } from "./use-api";

export function VoidButton({ id, reference }: { id: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { call, pending } = useApi();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"><Ban /> Void</Button>
      </DialogTrigger>
      <DialogContent title={`Void ${reference}?`} description="A reversing journal entry is posted. The original stays in the audit trail.">
        <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); if (await call(`/api/transactions/${id}/void`, { reason }, "POST", `${reference} voided`)) setOpen(false); }}>
          <Field label="Reason"><Input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Entered twice, wrong amount…" /></Field>
          <Button variant="destructive" disabled={pending}>Void transaction</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
