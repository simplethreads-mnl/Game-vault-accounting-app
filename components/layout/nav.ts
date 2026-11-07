import { ArrowLeftRight, BarChart3, BookOpen, FileText, Gauge, History, Package, PieChart, Wrench } from "lucide-react";

export const NAV = [
  { group: "Overview", items: [
    { href: "/", label: "Dashboard", icon: Gauge },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { group: "Operations", items: [
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/repairs", label: "Repairs", icon: Wrench },
    { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  ] },
  { group: "Accounting", items: [
    { href: "/expenses", label: "Expenses", icon: PieChart },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/ledger", label: "General Ledger", icon: BookOpen },
    { href: "/audit", label: "Audit Trail", icon: History },
  ] },
];
