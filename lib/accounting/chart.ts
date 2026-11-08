import type { AccountType } from "@prisma/client";

export type AccountDef = {
  code: string;
  name: string;
  type: AccountType;
  category?: string;
};

/**
 * Standard chart of accounts for a device resale + repair shop.
 * Codes follow the conventional 1xxx assets … 6xxx expenses numbering.
 */
export const CHART_OF_ACCOUNTS: AccountDef[] = [
  // Assets
  { code: "1000", name: "Cash on Hand", type: "ASSET", category: "CASH" },
  { code: "1010", name: "Bank / Card Settlements", type: "ASSET", category: "CASH" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET", category: "AR" },
  { code: "1150", name: "Loans Receivable", type: "ASSET", category: "LOANS_RECEIVABLE" },
  { code: "1200", name: "Inventory – Devices", type: "ASSET", category: "INVENTORY" },
  { code: "1210", name: "Inventory – Parts", type: "ASSET", category: "PARTS_INVENTORY" },
  { code: "1220", name: "Repair Work in Progress", type: "ASSET", category: "WIP" },
  { code: "1500", name: "Tools & Equipment (Fixed Assets)", type: "ASSET", category: "FIXED" },
  // Liabilities
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", category: "AP" },
  { code: "2200", name: "Customer Deposits", type: "LIABILITY", category: "DEPOSITS" },
  { code: "2300", name: "Accrued Technician Labor", type: "LIABILITY", category: "WAGES" },
  // Equity
  { code: "3000", name: "Owner's Capital", type: "EQUITY", category: "CAPITAL" },
  { code: "3100", name: "Owner's Draws", type: "EQUITY", category: "DRAWS" },
  { code: "3200", name: "Retained Earnings", type: "EQUITY", category: "RETAINED" },
  // Revenue
  { code: "4000", name: "Nintendo Switch Sales", type: "REVENUE", category: "SWITCH_SALES" },
  { code: "4010", name: "iPhone Sales", type: "REVENUE", category: "IPHONE_SALES" },
  { code: "4100", name: "Nintendo Switch Repairs", type: "REVENUE", category: "SWITCH_REPAIRS" },
  { code: "4110", name: "Phone Repairs", type: "REVENUE", category: "PHONE_REPAIRS" },
  { code: "4200", name: "Accessories Sales", type: "REVENUE", category: "ACCESSORY_SALES" },
  { code: "4300", name: "PC Parts Sales", type: "REVENUE", category: "PC_PARTS_SALES" },
  { code: "4900", name: "Other Income", type: "REVENUE", category: "OTHER_INCOME" },
  { code: "4950", name: "Sales Returns & Refunds", type: "CONTRA_REVENUE", category: "REFUNDS" },
  // Cost of goods sold
  { code: "5000", name: "COGS – Nintendo Switch", type: "COGS", category: "COGS_SWITCH" },
  { code: "5010", name: "COGS – iPhone", type: "COGS", category: "COGS_IPHONE" },
  { code: "5020", name: "COGS – Accessories", type: "COGS", category: "COGS_ACCESSORY" },
  { code: "5030", name: "COGS – PC Parts", type: "COGS", category: "COGS_PC_PARTS" },
  { code: "5100", name: "Repair Parts Used", type: "COGS", category: "REPAIR_PARTS" },
  { code: "5110", name: "Repair Labor", type: "COGS", category: "REPAIR_LABOR" },
  // Operating expenses
  { code: "6000", name: "Parts & Components", type: "EXPENSE", category: "PARTS" },
  { code: "6100", name: "Shipping", type: "EXPENSE", category: "SHIPPING" },
  { code: "6200", name: "Fuel / Gas", type: "EXPENSE", category: "FUEL" },
  { code: "6300", name: "Food", type: "EXPENSE", category: "FOOD" },
  { code: "6400", name: "Employee Labor", type: "EXPENSE", category: "LABOR" },
  { code: "6500", name: "Tools & Equipment", type: "EXPENSE", category: "TOOLS" },
  { code: "6600", name: "Rent", type: "EXPENSE", category: "RENT" },
  { code: "6700", name: "Utilities", type: "EXPENSE", category: "UTILITIES" },
  { code: "6800", name: "Marketing", type: "EXPENSE", category: "MARKETING" },
  { code: "6900", name: "Internet", type: "EXPENSE", category: "INTERNET" },
  { code: "6990", name: "Miscellaneous Expenses", type: "EXPENSE", category: "MISC" },
];

export const ACCOUNT_BY_CATEGORY = Object.fromEntries(
  CHART_OF_ACCOUNTS.filter((a) => a.category).map((a) => [a.category!, a]),
) as Record<string, AccountDef>;

export const INCOME_CATEGORIES = [
  "SWITCH_SALES",
  "IPHONE_SALES",
  "SWITCH_REPAIRS",
  "PHONE_REPAIRS",
  "ACCESSORY_SALES",
  "PC_PARTS_SALES",
  "OTHER_INCOME",
] as const;

export const EXPENSE_CATEGORIES = [
  "PARTS",
  "SHIPPING",
  "FUEL",
  "FOOD",
  "LABOR",
  "TOOLS",
  "RENT",
  "UTILITIES",
  "MARKETING",
  "INTERNET",
  "MISC",
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CHART_OF_ACCOUNTS.filter((a) => a.category).map((a) => [a.category!, a.name]),
);

/** Normal balance side — debit-normal accounts grow with debits. */
export const isDebitNormal = (t: AccountType) =>
  t === "ASSET" || t === "EXPENSE" || t === "COGS" || t === "CONTRA_REVENUE";

export const CASH_CODES = ["1000", "1010"];
