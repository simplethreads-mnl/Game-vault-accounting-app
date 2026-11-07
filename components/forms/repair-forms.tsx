"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { DEVICE_TYPES, REPAIR_STATUSES } from "@/lib/labels";
import { money } from "@/lib/utils";
import { useApi, type Lookups } from "./use-api";

export function NewRepairButton() {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Lookups["customers"]>([]);
  const { call, pending } = useApi();
  const router = useRouter();
  useEffect(() => { if (open) fetch("/api/lookups").then((r) => r.json()).then((l: Lookups) => setCustomers(l.customers)); }, [open]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const existing = customers.find((c) => c.name.toLowerCase() === f.customerName.trim().toLowerCase());
    const job = await call<{ id: string; jobNumber: string }>("/api/repairs", {
      ...f,
      customerId: existing?.id,
      price: Number(f.price || 0), laborCost: Number(f.laborCost || 0), deposit: Number(f.deposit || 0),
      dueAt: f.dueAt || undefined,
    }, "POST", "Repair job created");
    if (job) { setOpen(false); router.push(`/repairs/${job.id}`); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus /> New repair job</Button></DialogTrigger>
      <DialogContent title="New repair job" description="Check a device in. Deposits are held as a liability until the job is invoiced." className="max-w-2xl">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name"><Input name="customerName" required list="repair-customers" /></Field>
          <datalist id="repair-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          <Field label="Phone"><Input name="customerPhone" type="tel" /></Field>
          <Field label="Device type">
            <NativeSelect name="deviceType" defaultValue="SWITCH">{DEVICE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</NativeSelect>
          </Field>
          <Field label="Model"><Input name="deviceModel" placeholder="e.g. HAC-001(-01), iPhone 13" /></Field>
          <Field label="Serial / IMEI"><Input name="serial" /></Field>
          <Field label="Due date"><Input name="dueAt" type="date" /></Field>
          <Field label="Problem reported" className="sm:col-span-2"><Textarea name="problem" required rows={2} placeholder="Joy-Con drift, no power, cracked screen…" /></Field>
          <Field label="Quoted price"><Input name="price" type="number" step="0.01" min="0" /></Field>
          <Field label="Est. technician labor cost"><Input name="laborCost" type="number" step="0.01" min="0" /></Field>
          <Field label="Deposit taken"><Input name="deposit" type="number" step="0.01" min="0" /></Field>
          <Field label="Deposit method">
            <NativeSelect name="depositMethod" defaultValue="CASH"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK">Bank</option></NativeSelect>
          </Field>
          <div className="flex justify-end sm:col-span-2"><Button disabled={pending}>Create job</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RepairControls({ job, parts }: { job: { id: string; status: string; price: number; laborCost: number; diagnosis: string | null; invoiced: boolean }; parts: { id: string; name: string; quantity: number; avgCost: number }[] }) {
  const { call, pending } = useApi();
  const [price, setPrice] = useState(String(job.price));
  const [labor, setLabor] = useState(String(job.laborCost));
  const [diagnosis, setDiagnosis] = useState(job.diagnosis ?? "");
  const [method, setMethod] = useState("CASH");
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState("1");
  const idx = REPAIR_STATUSES.findIndex((s) => s.value === job.status);
  const next = REPAIR_STATUSES[idx + 1];
  const locked = job.invoiced || job.status === "CANCELLED";

  const move = (status: string) => call(`/api/repairs/${job.id}`, { status, price: Number(price), laborCost: Number(labor), diagnosis, method }, "PATCH", status === "COMPLETED" ? "Job completed & invoiced" : "Status updated");

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-1.5">
        {REPAIR_STATUSES.map((s, i) => (
          <button key={s.value} disabled={locked || pending} onClick={() => move(s.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${i < idx ? "border-transparent bg-[var(--series-3)]/15 text-foreground" : i === idx ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary hover:text-foreground"}`}>
            {i < idx ? "✓ " : ""}{s.label}
          </button>
        ))}
      </div>
      {!locked && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Price to customer"><Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            <Field label="Technician labor cost"><Input type="number" step="0.01" min="0" value={labor} onChange={(e) => setLabor(e.target.value)} /></Field>
            <Field label="Payment method (on completion)">
              <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK">Bank</option><option value="ON_ACCOUNT">On account</option></NativeSelect>
            </Field>
            <Field label="Diagnosis / notes" className="sm:col-span-3"><Textarea rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={pending} onClick={() => move(job.status)}>Save</Button>
            {next && <Button size="sm" disabled={pending} onClick={() => move(next.value)}>Move to {next.label} →</Button>}
            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={() => move("CANCELLED")}>Cancel job</Button>
          </div>
          <div className="grid gap-2 rounded-xl border p-3">
            <p className="text-xs font-medium text-muted-foreground">Use a part from stock (Dr Repair WIP / Cr Parts Inventory)</p>
            <div className="flex flex-wrap gap-2">
              <NativeSelect className="min-w-0 flex-1" value={partId} onChange={(e) => setPartId(e.target.value)}>
                <option value="">Select part…</option>
                {parts.map((p) => <option key={p.id} value={p.id} disabled={p.quantity === 0}>{p.name} · {p.quantity} on hand · {money(p.avgCost)}</option>)}
              </NativeSelect>
              <Input className="w-20" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              <Button size="sm" variant="secondary" disabled={!partId || pending} onClick={async () => { if (await call(`/api/repairs/${job.id}/parts`, { partId, quantity: Number(qty) }, "POST", "Part added")) setPartId(""); }}>Add part</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
