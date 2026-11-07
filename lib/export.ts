import "server-only";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Report } from "./reports";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: process.env.NEXT_PUBLIC_CURRENCY ?? "USD" });
const d = (x: Date) => x.toISOString().slice(0, 10);

function pnlRows(r: Report): [string, number][] {
  const p = r.pnl;
  return ([
    ...r.income.map((i) => [i.label, i.amount] as [string, number]),
    ["Gross Revenue", p.grossRevenue],
    ["Less: Refunds & Returns", -p.refunds],
    ["Net Revenue", p.netRevenue],
    ["Cost of Goods Sold", -p.cogs],
    ["Repair Costs (parts + labor)", -p.repairCosts],
    ["Gross Profit", p.grossProfit],
    ...r.expenses.map((e) => [e.label, -e.amount] as [string, number]),
    ["Total Operating Expenses", -p.operatingExpenses],
    ["Net Profit", p.netProfit],
  ] as [string, number][]).map(([l, v]) => [l, v === 0 ? 0 : v]); // avoid "-$0.00"
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(r: Report) {
  const lines: string[][] = [
    [`Game Vault – ${r.label}`],
    [`Period`, d(r.start), d(new Date(r.end.getTime() - 1))],
    [],
    ["PROFIT & LOSS", "Amount"],
    ...pnlRows(r).map(([l, a]) => [l, a.toFixed(2)]),
    ["Gross Margin %", (r.pnl.grossMargin * 100).toFixed(2)],
    ["Net Margin %", (r.pnl.netMargin * 100).toFixed(2)],
    [],
    ["CASH FLOW", "Amount"],
    ["Cash in", r.cash.cashIn.toFixed(2)],
    ["Cash out", r.cash.cashOut.toFixed(2)],
    ["Net cash", r.cash.netCash.toFixed(2)],
    [],
    ["BALANCE SHEET (as of period end)", "Amount"],
    ...r.balanceSheet.assets.map((a) => [`${a.code} ${a.label}`, a.amount.toFixed(2)]),
    ["Total Assets", r.balanceSheet.totalAssets.toFixed(2)],
    ...r.balanceSheet.liabilities.map((a) => [`${a.code} ${a.label}`, a.amount.toFixed(2)]),
    ["Total Liabilities", r.balanceSheet.totalLiabilities.toFixed(2)],
    ...r.balanceSheet.equity.map((a) => [`${a.code} ${a.label}`, a.amount.toFixed(2)]),
    ["Total Equity", r.balanceSheet.totalEquity.toFixed(2)],
    [],
    ["TRANSACTIONS"],
    ["Date", "Reference", "Type", "Description", "Party", "Method", "Status", "Amount"],
    ...r.transactions.map((t) => [d(t.date), t.reference, t.type, t.description, t.party, t.method, t.status, t.amount.toFixed(2)]),
  ];
  return lines.map((l) => l.map(csvCell).join(",")).join("\n");
}

export async function toExcel(r: Report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Game Vault";
  wb.created = new Date();
  const money = '"$"#,##0.00;[Red]-"$"#,##0.00';
  const bold = { bold: true };

  const ws = wb.addWorksheet("P&L");
  ws.columns = [{ width: 38 }, { width: 18 }];
  ws.addRow([`Profit & Loss – ${r.label}`]).font = { bold: true, size: 14 };
  ws.addRow([`${d(r.start)} to ${d(new Date(r.end.getTime() - 1))}`]);
  ws.addRow([]);
  for (const [label, amount] of pnlRows(r)) {
    const row = ws.addRow([label, amount]);
    row.getCell(2).numFmt = money;
    if (/^(Gross|Net|Total)/.test(label)) row.font = bold;
  }
  ws.addRow([]);
  ws.addRow(["Gross Margin", r.pnl.grossMargin]).getCell(2).numFmt = "0.0%";
  ws.addRow(["Net Margin", r.pnl.netMargin]).getCell(2).numFmt = "0.0%";

  const bs = wb.addWorksheet("Balance Sheet");
  bs.columns = [{ width: 10 }, { width: 38 }, { width: 18 }];
  bs.addRow([`Balance Sheet – as of ${d(new Date(r.end.getTime() - 1))}`]).font = { bold: true, size: 14 };
  const section = (title: string, items: { code: string; label: string; amount: number }[], total: number) => {
    bs.addRow([]);
    bs.addRow([title]).font = bold;
    for (const i of items) bs.addRow([i.code, i.label, i.amount]).getCell(3).numFmt = money;
    const t = bs.addRow(["", `Total ${title}`, total]);
    t.font = bold;
    t.getCell(3).numFmt = money;
  };
  section("Assets", r.balanceSheet.assets, r.balanceSheet.totalAssets);
  section("Liabilities", r.balanceSheet.liabilities, r.balanceSheet.totalLiabilities);
  section("Equity", r.balanceSheet.equity, r.balanceSheet.totalEquity);

  const tx = wb.addWorksheet("Transactions");
  tx.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Reference", key: "reference", width: 13 },
    { header: "Type", key: "type", width: 18 },
    { header: "Description", key: "description", width: 44 },
    { header: "Party", key: "party", width: 22 },
    { header: "Method", key: "method", width: 12 },
    { header: "Status", key: "status", width: 10 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt: money } },
  ];
  tx.getRow(1).font = bold;
  tx.views = [{ state: "frozen", ySplit: 1 }];
  for (const t of r.transactions) tx.addRow({ ...t, date: d(t.date) });
  tx.autoFilter = { from: "A1", to: "H1" };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toPDF(r: Report) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const accent: [number, number, number] = [98, 80, 214];
  doc.setFillColor(...accent);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.text("Game Vault", 40, 30);
  doc.setFontSize(11);
  doc.text(`${r.label} · ${d(r.start)} – ${d(new Date(r.end.getTime() - 1))}`, 40, 48);
  doc.setTextColor(20);

  const kpis = [
    ["Net Revenue", fmt(r.pnl.netRevenue)],
    ["Gross Profit", fmt(r.pnl.grossProfit)],
    ["Net Profit", fmt(r.pnl.netProfit)],
    ["Net Margin", `${(r.pnl.netMargin * 100).toFixed(1)}%`],
  ];
  autoTable(doc, { startY: 84, head: [kpis.map((k) => k[0])], body: [kpis.map((k) => k[1])], theme: "grid", headStyles: { fillColor: accent }, styles: { halign: "center", fontSize: 11 } });

  const bolds = new Set(["Gross Revenue", "Net Revenue", "Gross Profit", "Total Operating Expenses", "Net Profit"]);
  autoTable(doc, {
    head: [["Profit & Loss", "Amount"]],
    body: pnlRows(r).map(([l, a]) => [l, fmt(a)]),
    theme: "striped",
    headStyles: { fillColor: accent },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (h) => { if (h.section === "body" && bolds.has(String(h.row.raw && (h.row.raw as string[])[0]))) h.cell.styles.fontStyle = "bold"; },
  });
  autoTable(doc, {
    head: [["Cash Flow", "Amount"]],
    body: [["Cash in", fmt(r.cash.cashIn)], ["Cash out", fmt(r.cash.cashOut)], ["Net cash", fmt(r.cash.netCash)]],
    theme: "striped",
    headStyles: { fillColor: accent },
    columnStyles: { 1: { halign: "right" } },
  });
  const b = r.balanceSheet;
  autoTable(doc, {
    head: [["Balance Sheet (period end)", "Amount"]],
    body: [
      ...b.assets.map((a) => [`${a.code}  ${a.label}`, fmt(a.amount)]),
      ["Total Assets", fmt(b.totalAssets)],
      ...b.liabilities.map((a) => [`${a.code}  ${a.label}`, fmt(a.amount)]),
      ["Total Liabilities", fmt(b.totalLiabilities)],
      ...b.equity.map((a) => [`${a.code}  ${a.label}`, fmt(a.amount)]),
      ["Total Equity", fmt(b.totalEquity)],
    ],
    theme: "striped",
    headStyles: { fillColor: accent },
    columnStyles: { 1: { halign: "right" } },
  });
  doc.addPage();
  autoTable(doc, {
    head: [["Date", "Ref", "Type", "Description", "Amount"]],
    body: r.transactions.map((t) => [d(t.date), t.reference, t.type.replace(/_/g, " "), t.description + (t.status === "VOIDED" ? " (VOID)" : ""), fmt(t.amount)]),
    theme: "striped",
    headStyles: { fillColor: accent },
    styles: { fontSize: 8 },
    columnStyles: { 4: { halign: "right" } },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Generated ${r.generatedAt.toLocaleString("en-US")} · Page ${i} of ${pages}`, 40, doc.internal.pageSize.getHeight() - 20);
  }
  return Buffer.from(doc.output("arraybuffer"));
}
