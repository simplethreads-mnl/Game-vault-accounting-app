export const TX_TYPES = [
  { value: "SALE", label: "Sale", group: "Money in" },
  { value: "CUSTOMER_PAYMENT", label: "Customer payment / deposit", group: "Money in" },
  { value: "OTHER_INCOME", label: "Other income", group: "Money in" },
  { value: "OWNER_CONTRIBUTION", label: "Owner contribution", group: "Money in" },
  { value: "PURCHASE", label: "Device purchase", group: "Money out" },
  { value: "PARTS_PURCHASE", label: "Parts purchase", group: "Money out" },
  { value: "EXPENSE", label: "Expense", group: "Money out" },
  { value: "SUPPLIER_PAYMENT", label: "Supplier payment", group: "Money out" },
  { value: "WAGES_PAYMENT", label: "Technician payout", group: "Money out" },
  { value: "REFUND", label: "Refund", group: "Money out" },
  { value: "OWNER_DRAW", label: "Owner draw", group: "Money out" },
  { value: "REFURBISH", label: "Refurbish own unit", group: "Internal" },
  { value: "REPAIR", label: "Invoice repair job", group: "Internal" },
  { value: "MISC", label: "Manual journal entry", group: "Internal" },
] as const;

export const TX_LABEL: Record<string, string> = Object.fromEntries(TX_TYPES.map((t) => [t.value, t.label]));

export const MONEY_IN = new Set(["SALE", "CUSTOMER_PAYMENT", "OTHER_INCOME", "OWNER_CONTRIBUTION", "REPAIR"]);

export const EXPENSE_OPTIONS = [
  ["PARTS", "Parts & Components"], ["SHIPPING", "Shipping"], ["FUEL", "Fuel / Gas"], ["FOOD", "Food"],
  ["LABOR", "Employee Labor"], ["TOOLS", "Tools & Equipment"], ["RENT", "Rent"], ["UTILITIES", "Utilities"],
  ["MARKETING", "Marketing"], ["INTERNET", "Internet"], ["MISC", "Miscellaneous"],
] as const;

export const REPAIR_STATUSES = [
  { value: "RECEIVED", label: "Received" },
  { value: "DIAGNOSING", label: "Diagnosing" },
  { value: "WAITING_FOR_PARTS", label: "Waiting for Parts" },
  { value: "REPAIRING", label: "Repairing" },
  { value: "TESTING", label: "Testing" },
  { value: "READY_FOR_PICKUP", label: "Ready for Pickup" },
  { value: "COMPLETED", label: "Completed" },
] as const;
export const REPAIR_LABEL: Record<string, string> = { ...Object.fromEntries(REPAIR_STATUSES.map((s) => [s.value, s.label])), CANCELLED: "Cancelled" };

export const DEVICE_TYPES = [
  ["SWITCH", "Nintendo Switch"], ["SWITCH_OLED", "Switch OLED"], ["SWITCH_LITE", "Switch Lite"], ["JOYCON", "Joy-Con"],
  ["IPHONE", "iPhone"], ["ANDROID", "Android phone"], ["OTHER", "Other"],
] as const;
export const DEVICE_LABEL: Record<string, string> = Object.fromEntries(DEVICE_TYPES);

export const UNIT_STATUS_LABEL: Record<string, string> = {
  IN_STOCK: "In stock", BROKEN: "Broken", IN_REPAIR: "In repair", READY: "Repaired · ready", SOLD: "Sold", RETURNED: "Returned", WRITTEN_OFF: "Written off",
};
export const UNIT_STATUS_VARIANT: Record<string, "default" | "secondary" | "good" | "warning" | "serious" | "critical" | "outline"> = {
  IN_STOCK: "default", BROKEN: "critical", IN_REPAIR: "warning", READY: "good", SOLD: "secondary", RETURNED: "serious", WRITTEN_OFF: "outline",
};
export const REPAIR_VARIANT: Record<string, "default" | "secondary" | "good" | "warning" | "serious" | "critical" | "outline"> = {
  RECEIVED: "secondary", DIAGNOSING: "default", WAITING_FOR_PARTS: "serious", REPAIRING: "warning", TESTING: "default", READY_FOR_PICKUP: "good", COMPLETED: "secondary", CANCELLED: "outline",
};
