import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ChartCard, PageHeader } from "@/components/section";
import { prisma } from "@/lib/db";

export const metadata = { title: "Audit Trail" };

const VARIANT: Record<string, "good" | "critical" | "warning" | "secondary" | "default"> = { CREATE: "good", VOID: "critical", STATUS_CHANGE: "default", UPDATE: "warning", DELETE: "critical" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const logs = await prisma.auditLog.findMany({ where: sp.entity ? { entity: sp.entity } : undefined, orderBy: { createdAt: "desc" }, take: 100, skip: (page - 1) * 100 });
  return (
    <div className="space-y-6">
      <PageHeader title="Audit trail" description="Immutable log of every change — posted entries are never edited or deleted, only reversed" />
      <div className="flex flex-wrap gap-1.5">
        {["", "Transaction", "RepairJob", "InventoryUnit"].map((e) => (
          <Link key={e} href={e ? `?entity=${e}` : "/audit"} className={`rounded-full border px-3 py-1 text-xs ${(sp.entity ?? "") === e ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{e || "All"}</Link>
        ))}
      </div>
      <ChartCard title="Events">
        <Table>
          <THead><TR><TH>When</TH><TH>Who</TH><TH>Action</TH><TH>Entity</TH><TH>Summary</TH></TR></THead>
          <TBody>
            {logs.map((l) => (
              <TR key={l.id}>
                <TD className="whitespace-nowrap text-xs text-muted-foreground">{l.createdAt.toLocaleString("en-US")}</TD>
                <TD>{l.actor}</TD>
                <TD><Badge variant={VARIANT[l.action] ?? "secondary"}>{l.action.replace("_", " ")}</Badge></TD>
                <TD className="text-xs text-muted-foreground">{l.entity}</TD>
                <TD className="max-w-[520px] truncate">{l.entity === "RepairJob" ? <Link href={`/repairs/${l.entityId}`} className="hover:underline">{l.summary}</Link> : l.summary}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="flex justify-end gap-2 pt-4 text-sm">
          {page > 1 && <Link className="rounded-lg border px-3 py-1.5" href={`?${sp.entity ? `entity=${sp.entity}&` : ""}page=${page - 1}`}>← Newer</Link>}
          {logs.length === 100 && <Link className="rounded-lg border px-3 py-1.5" href={`?${sp.entity ? `entity=${sp.entity}&` : ""}page=${page + 1}`}>Older →</Link>}
        </div>
      </ChartCard>
    </div>
  );
}
