/**
 * Business currency. Defaults to Philippine peso; override with NEXT_PUBLIC_CURRENCY (ISO code)
 * and NEXT_PUBLIC_LOCALE if the business ever operates in another currency.
 */
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "PHP";
export const LOCALE = process.env.NEXT_PUBLIC_LOCALE || "en-PH";

/** The bare symbol, e.g. "₱". */
export const CURRENCY_SYMBOL =
  new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).formatToParts(0).find((p) => p.type === "currency")?.value ?? CURRENCY;

/** Business timezone for dates and times (the app's servers run on UTC). */
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Manila";

/** Calendar date (YYYY-MM-DD) of an instant in the business timezone. */
export function businessDateString(at: Date = new Date()) {
  return at.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * "Today" in the business timezone, as a Date at local midday on the server.
 * Period maths (this month, last 30 days, monthly buckets) uses the server's
 * calendar, so anchoring it to the business date keeps those boundaries right
 * around midnight.
 */
export function businessToday(at: Date = new Date()) {
  const [y, m, d] = businessDateString(at).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-US", { timeZone: TIMEZONE, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
