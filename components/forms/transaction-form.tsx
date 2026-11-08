"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { CHART_OF_ACCOUNTS } from "@/lib/accounting/chart";
import { EXPENSE_OPTIONS, TX_TYPES } from "@/lib/labels";
import { money } from "@/lib/utils";
import { useApi, type Lookups } from "./use-api";

/** Local calendar date (not UTC) for the date picker default. */
const today = () => new Date().toLocaleDateString("en-CA");
/** Entries dated today keep the current time so they sort above earlier entries. */
const dateForApi = (d: string) => (d === today() ? new Date().toISOString() : d);
type State = Record<string, string | boolean>;

export function TransactionForm({ initialType = "SALE", preset = {}, onDone }: { initialType?: string; preset?: State; onDone?: () => void }) {
  const [type, setType] = useState(initialType);
  const [s, setS] = useState<State>({ date: today(), method: "CASH", ...preset });
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [parts, setParts] = useState<{ partId: string; quantity: string }[]>([]);
  const [lines, setLines] = useState([{ code: "1000", debit: "", credit: "" }, { code: "3000", debit: "", credit: "" }]);
  const { call, pending } = useApi();

  useEffect(() => {
    fetch("/api/lookups").then((r) => r.json()).then(setLookups).catch(() => setLookups({ units: [], parts: [], customers: [], suppliers: [], repairs: [] }));
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setS((p) => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  const v = (k: string) => String(s[k] ?? "");

  const sellable = useMemo(() => lookups?.units.filter((u) => ["IN_STOCK", "READY", "RETURNED"].includes(u.status)) ?? [], [lookups]);
  const refurbishable = useMemo(() => lookups?.units.filter((u) => ["BROKEN", "IN_REPAIR", "RETURNED", "IN_STOCK"].includes(u.status)) ?? [], [lookups]);
  const soldUnits = useMemo(() => lookups?.units.filter((u) => u.status === "SOLD") ?? [], [lookups]);
  const selectedUnit = lookups?.units.find((u) => u.id === s.unitId);

  const totalDr = lines.reduce((a, l) => a + Number(l.debit || 0), 0);
  const totalCr = lines.reduce((a, l) => a + Number(l.credit || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = (k: string) => (s[k] === "" || s[k] == null ? undefined : Number(s[k]));
    const str = (k: string) => (s[k] ? String(s[k]) : undefined);
    const common = { type, date: dateForApi(v("date")), description: str("description"), notes: str("notes") };
    let body: Record<string, unknown> = { ...common, amount: n("amount"), method: v("method") };
    switch (type) {
      case "PURCHASE":
        body = { ...body, supplierName: str("supplierName"), unit: { productLine: v("productLine") || "SWITCH", model: v("model"), serial: str("serial"), condition: v("condition") || "USED", listPrice: n("listPrice") ?? 0, quantity: n("quantity") ?? 1 } };
        break;
      case "SALE":
        body = { ...body, unitId: str("unitId"), category: s.unitId ? undefined : v("category") || "ACCESSORY_SALES", customerName: str("customerName") };
        break;
      case "REFURBISH":
        body = { ...common, unitId: v("unitId"), laborCost: n("laborCost") ?? 0, complete: s.complete !== false, parts: parts.filter((p) => p.partId).map((p) => ({ partId: p.partId, quantity: Number(p.quantity || 1) })) };
        break;
      case "REPAIR":
        body = { ...common, repairId: v("repairId"), method: v("method") };
        break;
      case "PARTS_PURCHASE":
        body = { ...common, method: v("method"), supplierName: str("supplierName"), quantity: n("quantity"), unitCost: n("unitCost"), partId: s.partId && s.partId !== "__new" ? v("partId") : undefined, newPart: s.partId === "__new" ? { sku: v("newSku"), name: v("newName"), compatible: str("newCompatible"), reorderLevel: n("reorderLevel") ?? 3 } : undefined };
        break;
      case "EXPENSE":
        body = { ...body, category: v("category") || "MISC", supplierName: str("supplierName") };
        break;
      case "REFUND":
        body = { ...body, unitId: str("unitId"), restock: Boolean(s.restock), customerName: str("customerName") };
        break;
      case "CUSTOMER_PAYMENT":
        body = { ...body, repairId: str("repairId"), customerName: str("customerName") };
        break;
      case "SUPPLIER_PAYMENT":
        body = { ...body, supplierName: str("supplierName") };
        break;
      case "MISC":
        body = { ...common, lines: lines.map((l) => ({ code: l.code, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })) };
        break;
    }
    if (body.method === undefined || body.method === "") delete body.method;
    const res = await call("/api/transactions", body, "POST", "Transaction posted to the ledger");
    if (res) onDone?.();
  }

  const methodSelect = (allowAccount = true) => (
    <Field label="Paid via">
      <NativeSelect value={v("method")} onChange={set("method")}>
        <option value="CASH">Cash</option>
        <option value="BANK">Bank transfer</option>
        <option value="CARD">Card</option>
        {allowAccount && <option value="ON_ACCOUNT">On account (AR / AP)</option>}
      </NativeSelect>
    </Field>
  );
  const amountField = (label = "Amount") => (
    <Field label={label}>
      <Input type="number" inputMode="decimal" step="0.01" min="0" required value={v("amount")} onChange={set("amount")} placeholder="0.00" />
    </Field>
  );
  const nameList = (id: string, items: { id: string; name: string }[] | undefined) => (
    <datalist id={id}>{items?.map((c) => <option key={c.id} value={c.name} />)}</datalist>
  );

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Transaction type">
          <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
            {["Money in", "Money out", "Internal"].map((g) => (
              <optgroup key={g} label={g}>
                {TX_TYPES.filter((t) => t.group === g).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date">
          <Input type="date" required value={v("date")} onChange={set("date")} />
        </Field>
      </div>

      {type === "PURCHASE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product line">
            <NativeSelect value={v("productLine") || "SWITCH"} onChange={set("productLine")}>
              <option value="SWITCH">Nintendo Switch</option>
              <option value="IPHONE">iPhone</option>
              <option value="PC_PARTS">PC parts</option>
              <option value="ACCESSORY">Accessory</option>
            </NativeSelect>
          </Field>
          <Field label="Condition">
            <NativeSelect value={v("condition") || "USED"} onChange={set("condition")}>
              <option value="NEW">New</option><option value="LIKE_NEW">Like new</option><option value="USED">Used (working)</option><option value="BROKEN">Broken – needs repair</option>
            </NativeSelect>
          </Field>
          <Field label="Model"><Input required value={v("model")} onChange={set("model")} placeholder="Switch OLED / iPhone 13 128GB" list="models" /></Field>
          <datalist id="models">{["Switch OLED", "Switch V2", "Switch V1", "Switch Lite", "iPhone 12 64GB", "iPhone 13 128GB", "iPhone 14 Pro 256GB", "iPhone 15 128GB", "RTX 3060 12GB", "RX 6600 8GB", "Ryzen 5 5600", "16GB DDR4 3200 (2×8GB)", "1TB NVMe SSD", "650W PSU 80+ Bronze"].map((m) => <option key={m} value={m} />)}</datalist>
          <Field label="Serial / IMEI"><Input value={v("serial")} onChange={set("serial")} /></Field>
          <Field label="Quantity"><Input type="number" inputMode="numeric" min="1" max="100" step="1" value={v("quantity") || "1"} onChange={set("quantity")} /></Field>
          {amountField(Number(v("quantity") || 1) > 1 ? "Total purchase price (0 if free)" : "Purchase price (0 if free)")}
          {Number(v("quantity") || 1) > 1 && s.amount !== undefined && v("amount") !== "" && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
              {v("quantity")} separate items will be added, each costing <b className="text-foreground">{money(Number(v("amount")) / Number(v("quantity")))}</b>.
            </p>
          )}
          <Field label="Target list price per item (optional)"><Input type="number" step="0.01" min="0" value={v("listPrice")} onChange={set("listPrice")} /></Field>
          {methodSelect()}
          <Field label="Bought from"><Input value={v("supplierName")} onChange={set("supplierName")} list="suppliers" placeholder="Seller / supplier" /></Field>
          {nameList("suppliers", lookups?.suppliers)}
        </div>
      )}

      {type === "SALE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unit (leave blank for accessories)" className="sm:col-span-2">
            <NativeSelect value={v("unitId")} onChange={(e) => { const u = lookups?.units.find((x) => x.id === e.target.value); setS((p) => ({ ...p, unitId: e.target.value, amount: u ? String(u.listPrice) : p.amount })); }}>
              <option value="">— Non-serialised sale —</option>
              {sellable.map((u) => <option key={u.id} value={u.id}>{u.sku} · {u.model} · list {money(u.listPrice)}</option>)}
            </NativeSelect>
          </Field>
          {!s.unitId && (
            <Field label="Income category">
              <NativeSelect value={v("category") || "ACCESSORY_SALES"} onChange={set("category")}>
                <option value="ACCESSORY_SALES">Accessories Sales</option><option value="PC_PARTS_SALES">PC Parts Sales</option><option value="SWITCH_SALES">Nintendo Switch Sales</option><option value="IPHONE_SALES">iPhone Sales</option><option value="OTHER_INCOME">Other Income</option>
              </NativeSelect>
            </Field>
          )}
          {amountField("Sale price")}
          {methodSelect()}
          <Field label="Customer"><Input value={v("customerName")} onChange={set("customerName")} list="customers" /></Field>
          {nameList("customers", lookups?.customers)}
          {selectedUnit && s.amount && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
              Cost basis {money(selectedUnit.costBasis)} → gross profit <b className="text-foreground">{money(Number(s.amount) - selectedUnit.costBasis)}</b>
            </p>
          )}
        </div>
      )}

      {type === "REFURBISH" && (
        <div className="grid gap-4">
          <Field label="Unit to refurbish">
            <NativeSelect required value={v("unitId")} onChange={set("unitId")}>
              <option value="">Select unit…</option>
              {refurbishable.map((u) => <option key={u.id} value={u.id}>{u.sku} · {u.model} · {u.status.replace("_", " ").toLowerCase()} · cost {money(u.costBasis)}</option>)}
            </NativeSelect>
          </Field>
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Parts used (taken from parts inventory at average cost)</p>
            {parts.map((p, i) => (
              <div key={i} className="flex gap-2">
                <NativeSelect value={p.partId} onChange={(e) => setParts((a) => a.map((x, j) => (j === i ? { ...x, partId: e.target.value } : x)))}>
                  <option value="">Select part…</option>
                  {lookups?.parts.map((pt) => <option key={pt.id} value={pt.id} disabled={pt.quantity === 0}>{pt.name} · {pt.quantity} on hand · {money(pt.avgCost)}</option>)}
                </NativeSelect>
                <Input className="w-20" type="number" min="1" value={p.quantity} onChange={(e) => setParts((a) => a.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setParts((a) => a.filter((_, j) => j !== i))} aria-label="Remove part"><Trash2 /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setParts((a) => [...a, { partId: "", quantity: "1" }])}><Plus /> Add part</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Technician labor cost"><Input type="number" step="0.01" min="0" value={v("laborCost")} onChange={set("laborCost")} placeholder="0.00" /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={s.complete !== false} onChange={set("complete")} /> Repair finished – mark ready for sale</label>
          </div>
        </div>
      )}

      {type === "REPAIR" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Repair job" className="sm:col-span-2">
            <NativeSelect required value={v("repairId")} onChange={set("repairId")}>
              <option value="">Select job…</option>
              {lookups?.repairs.map((r) => <option key={r.id} value={r.id}>{r.jobNumber} · {r.customer} · {r.problem} · {money(r.price)}</option>)}
            </NativeSelect>
          </Field>
          {methodSelect()}
        </div>
      )}

      {type === "PARTS_PURCHASE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Part" className="sm:col-span-2">
            <NativeSelect required value={v("partId")} onChange={set("partId")}>
              <option value="">Select part…</option>
              {lookups?.parts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku}) · {p.quantity} on hand</option>)}
              <option value="__new">+ New part…</option>
            </NativeSelect>
          </Field>
          {s.partId === "__new" && (
            <>
              <Field label="New part name"><Input required value={v("newName")} onChange={set("newName")} /></Field>
              <Field label="SKU"><Input required value={v("newSku")} onChange={set("newSku")} /></Field>
              <Field label="Compatible with"><Input value={v("newCompatible")} onChange={set("newCompatible")} /></Field>
              <Field label="Reorder level"><Input type="number" min="0" value={v("reorderLevel")} onChange={set("reorderLevel")} placeholder="3" /></Field>
            </>
          )}
          <Field label="Quantity"><Input type="number" min="1" required value={v("quantity")} onChange={set("quantity")} /></Field>
          <Field label="Unit cost"><Input type="number" step="0.01" min="0" required value={v("unitCost")} onChange={set("unitCost")} /></Field>
          {methodSelect()}
          <Field label="Supplier"><Input value={v("supplierName")} onChange={set("supplierName")} list="suppliers" /></Field>
          {nameList("suppliers", lookups?.suppliers)}
        </div>
      )}

      {type === "EXPENSE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expense category">
            <NativeSelect value={v("category") || "MISC"} onChange={set("category")}>
              {EXPENSE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </NativeSelect>
          </Field>
          {amountField()}
          {methodSelect()}
          <Field label="Vendor (optional)"><Input value={v("supplierName")} onChange={set("supplierName")} list="suppliers" /></Field>
          {nameList("suppliers", lookups?.suppliers)}
        </div>
      )}

      {type === "REFUND" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sold unit (optional)" className="sm:col-span-2">
            <NativeSelect value={v("unitId")} onChange={set("unitId")}>
              <option value="">— Not tied to a unit —</option>
              {soldUnits.map((u) => <option key={u.id} value={u.id}>{u.sku} · {u.model}</option>)}
            </NativeSelect>
          </Field>
          {amountField("Refund amount")}
          {methodSelect(false)}
          {s.unitId && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={Boolean(s.restock)} onChange={set("restock")} /> Unit returned – put back into inventory (reverses COGS)</label>}
          <Field label="Customer"><Input value={v("customerName")} onChange={set("customerName")} list="customers" /></Field>
          {nameList("customers", lookups?.customers)}
        </div>
      )}

      {type === "CUSTOMER_PAYMENT" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deposit for repair job (optional)" className="sm:col-span-2">
            <NativeSelect value={v("repairId")} onChange={set("repairId")}>
              <option value="">— Payment against receivables —</option>
              {lookups?.repairs.map((r) => <option key={r.id} value={r.id}>{r.jobNumber} · {r.customer}</option>)}
            </NativeSelect>
          </Field>
          {amountField()}
          {methodSelect(false)}
          {!s.repairId && <Field label="Customer"><Input value={v("customerName")} onChange={set("customerName")} list="customers" /></Field>}
          {nameList("customers", lookups?.customers)}
        </div>
      )}

      {["SUPPLIER_PAYMENT", "WAGES_PAYMENT", "OTHER_INCOME", "OWNER_CONTRIBUTION", "OWNER_DRAW"].includes(type) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {amountField()}
          {methodSelect(type === "OTHER_INCOME")}
          {type === "SUPPLIER_PAYMENT" && (<><Field label="Supplier"><Input value={v("supplierName")} onChange={set("supplierName")} list="suppliers" /></Field>{nameList("suppliers", lookups?.suppliers)}</>)}
        </div>
      )}

      {type === "MISC" && (
        <div className="grid gap-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_88px_88px_36px] gap-2">
              <NativeSelect value={l.code} onChange={(e) => setLines((a) => a.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}>
                {CHART_OF_ACCOUNTS.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
              </NativeSelect>
              <Input type="number" step="0.01" min="0" placeholder="Debit" value={l.debit} onChange={(e) => setLines((a) => a.map((x, j) => (j === i ? { ...x, debit: e.target.value, credit: "" } : x)))} />
              <Input type="number" step="0.01" min="0" placeholder="Credit" value={l.credit} onChange={(e) => setLines((a) => a.map((x, j) => (j === i ? { ...x, credit: e.target.value, debit: "" } : x)))} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setLines((a) => a.filter((_, j) => j !== i))} aria-label="Remove line" disabled={lines.length <= 2}><Trash2 /></Button>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs">
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((a) => [...a, { code: "6990", debit: "", credit: "" }])}><Plus /> Line</Button>
            <span className={Math.abs(totalDr - totalCr) < 0.005 && totalDr > 0 ? "text-[var(--delta-good)]" : "text-[#d03b3b]"}>
              Dr {money(totalDr)} · Cr {money(totalCr)} {Math.abs(totalDr - totalCr) < 0.005 && totalDr > 0 ? "✓ balanced" : "— must balance"}
            </span>
          </div>
        </div>
      )}

      <Field label={type === "MISC" ? "Memo (required)" : "Description (optional)"}>
        <Input required={type === "MISC"} value={v("description")} onChange={set("description")} />
      </Field>
      <Field label="Notes"><Textarea rows={2} value={v("notes")} onChange={set("notes")} /></Field>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Posting…" : "Post transaction"}</Button>
      </div>
    </form>
  );
}
