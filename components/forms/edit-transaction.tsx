"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { CHART_OF_ACCOUNTS } from "@/lib/accounting/chart";
import { EXPENSE_OPTIONS, TX_LABEL } from "@/lib/labels";
import { money, shortDate } from "@/lib/utils";
import { TIMEZONE, formatDateTime } from "@/lib/currency";
import { useApi } from "./use-api";

type Caps = {
  editable: boolean;
  reason?: string;
  amount: boolean;
  amountNote?: string;
  methods: string[];
  category: "expense" | "income" | null;
  lines: boolean;
};
type Loaded = {
  capabilities: Caps;
  transaction: { id: string; reference: string; type: string; date: string; description: string; amount: string | number; method: string; category: string | null; notes: string | null };
  lines: { code: string; debit: number; credit: number }[];
};

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK: "Bank transfer", CARD: "Card", ON_ACCOUNT: "On account (AR / AP)" };
const INCOME_OPTIONS = [
  ["ACCESSORY_SALES", "Accessories Sales"],
  ["SWITCH_SALES", "Nintendo Switch Sales"],
  ["IPHONE_SALES", "iPhone Sales"],
  ["PC_PARTS_SALES", "PC Parts Sales"],
  ["OTHER_INCOME", "Other Income"],
] as const;

const localDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TIMEZONE });

export function EditTransactionButton({ id, reference }: { id: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<{ code: string; debit: string; credit: string }[]>([]);
  const { call, pending } = useApi();

  async function load() {
    setData(null);
    setError(null);
    const res = await fetch(`/api/transactions/${id}`);
    const d = await res.json();
    if (!res.ok) return setError(d.error ?? "Couldn't load this transaction");
    const t = d.transaction;
    setData(d);
    setF({ date: localDate(t.date), description: t.description, amount: String(Number(t.amount)), method: t.method, category: t.category ?? "", notes: t.notes ?? "", reason: "" });
    setLines(d.lines.map((l: { code: string; debit: number; credit: number }) => ({ code: l.code, debit: l.debit ? String(l.debit) : "", credit: l.credit ? String(l.credit) : "" })));
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const dr = lines.reduce((a, l) => a + Number(l.debit || 0), 0);
  const cr = lines.reduce((a, l) => a + Number(l.credit || 0), 0);
  const balanced = Math.abs(dr - cr) < 0.005 && dr > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const t = data.transaction, c = data.capabilities;
    const body: Record<string, unknown> = {};
    if (f.date !== localDate(t.date)) body.date = f.date;
    if (f.description !== t.description) body.description = f.description;
    if (f.notes !== (t.notes ?? "")) body.notes = f.notes;
    if (c.amount && Number(f.amount) !== Number(t.amount)) body.amount = Number(f.amount);
    if (c.methods.length && f.method !== t.method) body.method = f.method;
    if (c.category && f.category !== (t.category ?? "")) body.category = f.category;
    if (c.lines) body.lines = lines.map((l) => ({ code: l.code, debit: Number(l.debit || 0), credit: Number(l.credit || 0) }));
    if (f.reason) body.reason = f.reason;
    if (await call(`/api/transactions/${id}`, body, "PATCH", `${reference} updated`)) setOpen(false);
  }

  const c = data?.capabilities;
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label={`Edit ${reference}`}><Pencil /> <span className="hidden md:inline">Edit</span></Button>
      </DialogTrigger>
      <DialogContent
        title={`Edit ${reference}`}
        description="The original ledger entry is reversed and a corrected one is posted. The transaction is marked as edited, and the change is recorded in the audit trail."
        className="max-w-2xl"
      >
        {error && <p className="text-sm text-[#d03b3b]">{error}</p>}
        {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data && c && !c.editable && <p className="text-sm text-muted-foreground">{c.reason}</p>}
        {data && c?.editable && (
          <form onSubmit={submit} className="grid gap-4">
            <p className="text-xs text-muted-foreground">{TX_LABEL[data.transaction.type] ?? data.transaction.type}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date"><Input type="date" required value={f.date} onChange={set("date")} /></Field>
              {!c.lines && (
                <Field label="Amount">
                  <Input type="number" inputMode="decimal" step="0.01" min="0" required disabled={!c.amount} value={f.amount} onChange={set("amount")} />
                </Field>
              )}
              {!c.amount && !c.lines && c.amountNote && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground sm:col-span-2">{c.amountNote}</p>}
              {c.methods.length > 0 && (
                <Field label="Paid via">
                  <NativeSelect value={f.method} onChange={set("method")}>
                    {c.methods.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                  </NativeSelect>
                </Field>
              )}
              {c.category === "expense" && (
                <Field label="Expense category">
                  <NativeSelect value={f.category} onChange={set("category")}>{EXPENSE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</NativeSelect>
                </Field>
              )}
              {c.category === "income" && (
                <Field label="Income category">
                  <NativeSelect value={f.category} onChange={set("category")}>{INCOME_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</NativeSelect>
                </Field>
              )}
            </div>

            {c.lines && (
              <div className="grid gap-2">
                <p className="text-xs font-medium text-muted-foreground">Journal lines</p>
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_88px_88px_36px] gap-2">
                    <NativeSelect aria-label={`Line ${i + 1} account`} value={l.code} onChange={(e) => setLines((a) => a.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}>
                      {CHART_OF_ACCOUNTS.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                    </NativeSelect>
                    <Input type="number" step="0.01" min="0" placeholder="Debit" value={l.debit} onChange={(e) => setLines((a) => a.map((x, j) => (j === i ? { ...x, debit: e.target.value, credit: "" } : x)))} />
                    <Input type="number" step="0.01" min="0" placeholder="Credit" value={l.credit} onChange={(e) => setLines((a) => a.map((x, j) => (j === i ? { ...x, credit: e.target.value, debit: "" } : x)))} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length <= 2} onClick={() => setLines((a) => a.filter((_, j) => j !== i))}><Trash2 /></Button>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs">
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines((a) => [...a, { code: "6990", debit: "", credit: "" }])}><Plus /> Line</Button>
                  <span className={balanced ? "text-[var(--delta-good)]" : "text-[#d03b3b]"}>Dr {money(dr)} · Cr {money(cr)} {balanced ? "✓ balanced" : "— must balance"}</span>
                </div>
              </div>
            )}

            <Field label="Description"><Input required value={f.description} onChange={set("description")} /></Field>
            <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={set("notes")} /></Field>
            <Field label="Reason for the edit (optional, saved in the audit trail)"><Input value={f.reason} onChange={set("reason")} placeholder="Typo in amount, wrong date…" /></Field>
            <div className="flex justify-end">
              <Button disabled={pending || (c.lines && !balanced)}>{pending ? "Saving…" : "Save changes"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "Edited · Nov 9, 2026" marker shown wherever a transaction is listed. */
export function EditedBadge({ editedAt, editCount, editedBy }: { editedAt: Date | string | null; editCount?: number; editedBy?: string | null }) {
  if (!editedAt) return null;
  const d = new Date(editedAt);
  const label = shortDate(d);
  const title = `Edited ${editCount && editCount > 1 ? `${editCount} times, last ` : ""}on ${formatDateTime(d)}${editedBy ? ` by ${editedBy}` : ""}`;
  return (
    <span title={title} className="ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#fab219]/20 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-[#fab219]">
      <Pencil className="h-3 w-3" aria-hidden /> Edited · {label}
    </span>
  );
}
