/** All ledger math is done in integer cents to avoid floating point drift. */
export const toCents = (n: number | string | { toString(): string }) =>
  Math.round(Number(typeof n === "object" ? n.toString() : n) * 100);

export const fromCents = (c: number) => c / 100;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const dec = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number((v as { toString(): string }).toString());
};
