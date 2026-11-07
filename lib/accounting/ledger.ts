import { toCents } from "./money";

export type DraftLine = {
  code: string;
  debit?: number;
  credit?: number;
  memo?: string;
  unitId?: string;
  repairId?: string;
};

export class UnbalancedEntryError extends Error {
  constructor(public debits: number, public credits: number) {
    super(`Journal entry is not balanced: debits ${debits / 100} ≠ credits ${credits / 100}`);
  }
}

/** Drops zero lines, rejects negatives, and enforces Σdebits = Σcredits (in cents). */
export function assertBalanced(lines: DraftLine[]): DraftLine[] {
  const clean = lines.filter((l) => toCents(l.debit ?? 0) !== 0 || toCents(l.credit ?? 0) !== 0);
  if (clean.length < 2) throw new Error("A journal entry needs at least two non-zero lines");
  let dr = 0;
  let cr = 0;
  for (const l of clean) {
    const d = toCents(l.debit ?? 0);
    const c = toCents(l.credit ?? 0);
    if (d < 0 || c < 0) throw new Error(`Negative amount on account ${l.code}`);
    if (d > 0 && c > 0) throw new Error(`Line on ${l.code} has both a debit and a credit`);
    dr += d;
    cr += c;
  }
  if (dr !== cr) throw new UnbalancedEntryError(dr, cr);
  return clean;
}

/** Signed balance in the account's normal direction. */
export function normalBalance(debitNormal: boolean, debit: number, credit: number) {
  return debitNormal ? debit - credit : credit - debit;
}
