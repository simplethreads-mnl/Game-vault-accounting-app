import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { buildReport, REPORT_PERIODS } from "@/lib/reports";
import { toCSV, toExcel, toPDF } from "@/lib/export";

export const runtime = "nodejs";

export const GET = handle(async (req: NextRequest) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const q = z.object({
    period: z.enum(REPORT_PERIODS).default("monthly"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    format: z.enum(["json", "csv", "xlsx", "pdf"]).default("json"),
  }).parse(sp);
  const anchor = q.date ? new Date(`${q.date}T12:00:00`) : new Date();
  const report = await buildReport(q.period, anchor);
  const name = `game-vault-${q.period}-${anchor.toISOString().slice(0, 10)}`;
  switch (q.format) {
    case "csv":
      return new Response(toCSV(report), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
    case "xlsx":
      return new Response(new Uint8Array(await toExcel(report)), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` } });
    case "pdf":
      return new Response(new Uint8Array(toPDF(report)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
    default:
      return report;
  }
});
