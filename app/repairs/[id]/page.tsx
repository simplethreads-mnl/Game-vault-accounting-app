import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ChartCard } from "@/components/section";
import { RepairControls } from "@/components/forms/repair-forms";
import { prisma } from "@/lib/db";
import { dec } from "@/lib/accounting/money";
import { repairProfit } from "@/lib/accounting/metrics";
import { DEVICE_LABEL, REPAIR_LABEL, REPAIR_VARIANT, TX_LABEL } from "@/lib/labels";
import { money, pct, shortDate } from "@/lib/utils";
import { parts as getParts } from "@/lib/queries";

export default async function RepairDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.repairJob.findUnique({ where: { id }, include: { customer: true, partsUsed: { include: { part: true }, orderBy: { createdAt: "asc" } }, history: { orderBy: { createdAt: "asc" } }, transactions: { orderBy: { date: "asc" } } } });
  if (!job) notFound();
  const parts = await getParts();
  const j = { ...job, price: dec(job.price), laborCost: dec(job.laborCost), partsCost: dec(job.partsCost), deposit: dec(job.deposit) };
  const p = repairProfit(j);

  return (
    <div className="space-y-6">
      <Link href="/repairs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Repair board</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">{j.jobNumber}</h1>
        <Badge variant={REPAIR_VARIANT[j.status]}>{REPAIR_LABEL[j.status]}</Badge>
        {j.invoiced && <Badge variant="good">Invoiced</Badge>}
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Price", money(j.price)], ["Parts cost", money(j.partsCost)], ["Labor cost", money(j.laborCost)],
          ["Repair profit", money(p.profit)], ["Margin", pct(p.margin)],
        ].map(([l, v]) => (
          <Card key={l} className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-semibold tabular">{v}</p></Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Job" className="lg:col-span-2">
          <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Customer</dt><dd className="font-medium">{j.customer.name}{j.customer.phone && <span className="text-muted-foreground"> · {j.customer.phone}</span>}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Device</dt><dd className="font-medium">{DEVICE_LABEL[j.deviceType]}{j.deviceModel && ` · ${j.deviceModel}`}{j.serial && <span className="text-muted-foreground"> · SN {j.serial}</span>}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Problem reported</dt><dd>{j.problem}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Received / due</dt><dd>{shortDate(j.receivedAt)}{j.dueAt && ` → ${shortDate(j.dueAt)}`}</dd></div>
            {j.deposit > 0 && <div><dt className="text-xs text-muted-foreground">Deposit held</dt><dd>{money(j.deposit)}</dd></div>}
          </dl>
          <RepairControls job={{ id: j.id, status: j.status, price: j.price, laborCost: j.laborCost, diagnosis: j.diagnosis, invoiced: j.invoiced }} parts={parts.map((x) => ({ id: x.id, name: x.name, quantity: x.quantity, avgCost: x.avgCost }))} />
        </ChartCard>
        <ChartCard title="Status history">
          <ol className="relative space-y-4 border-l pl-4">
            {j.history.map((h) => (
              <li key={h.id} className="text-sm">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <p className="font-medium">{REPAIR_LABEL[h.to]}</p>
                <p className="text-xs text-muted-foreground">{h.createdAt.toLocaleString("en-US")} · {h.changedBy}</p>
                {h.note && <p className="text-xs">{h.note}</p>}
              </li>
            ))}
          </ol>
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Parts used">
          {j.partsUsed.length ? (
            <Table>
              <THead><TR><TH>Part</TH><TH className="text-right">Qty</TH><TH className="text-right">Unit cost</TH><TH className="text-right">Total</TH></TR></THead>
              <TBody>{j.partsUsed.map((u) => <TR key={u.id}><TD>{u.part.name}</TD><TD className="text-right">{u.quantity}</TD><TD className="text-right">{money(dec(u.unitCost))}</TD><TD className="text-right">{money(dec(u.unitCost) * u.quantity)}</TD></TR>)}</TBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground">No parts used yet.</p>}
        </ChartCard>
        <ChartCard title="Linked transactions">
          {j.transactions.length ? (
            <Table>
              <THead><TR><TH>Ref</TH><TH>Type</TH><TH>Date</TH><TH className="text-right">Amount</TH></TR></THead>
              <TBody>{j.transactions.map((t) => <TR key={t.id}><TD className="font-mono text-xs">{t.reference}</TD><TD>{TX_LABEL[t.type]}{t.status === "VOIDED" && <Badge variant="outline" className="ml-1">Void</Badge>}</TD><TD>{shortDate(t.date)}</TD><TD className="text-right">{money(dec(t.amount))}</TD></TR>)}</TBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground">Nothing posted yet. Completing the job invoices it automatically.</p>}
        </ChartCard>
      </section>
    </div>
  );
}
