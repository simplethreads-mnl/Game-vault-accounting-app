/**
 * Business currency. Defaults to Philippine peso; override with NEXT_PUBLIC_CURRENCY (ISO code)
 * and NEXT_PUBLIC_LOCALE if the business ever operates in another currency.
 */
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "PHP";
export const LOCALE = process.env.NEXT_PUBLIC_LOCALE || "en-PH";

/** The bare symbol, e.g. "₱". */
export const CURRENCY_SYMBOL =
  new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).formatToParts(0).find((p) => p.type === "currency")?.value ?? CURRENCY;
