import type { GameState, PayKind, PayLedger } from "../types";

/** One-off payment keys are kept for this many entries; older ones can no longer recur (their fixtures are long gone). */
const PAID_KEEP = 400;

/** The income ledger, created on first use. Income earned before itemising existed is kept as "earlier". */
export function ledgerOf(state: GameState): PayLedger {
  const u = state.user;
  if (!u.pay) u.pay = { career: u.earnings > 0 ? { earlier: u.earnings } : {}, season: { season: state.season, amounts: {} }, paid: [] };
  if (u.pay.season.season !== state.season) u.pay.season = { season: state.season, amounts: {} };
  return u.pay;
}

/** Money earned: counts toward career earnings and goes into the bank. */
export function receiveIncome(state: GameState, amount: number, kind: PayKind = "other"): void {
  if (!amount) return;
  const ledger = ledgerOf(state);
  state.user.earnings += Math.max(0, amount);
  state.user.bank += amount;
  if (amount > 0) {
    ledger.career[kind] = (ledger.career[kind] ?? 0) + amount;
    ledger.season.amounts[kind] = (ledger.season.amounts[kind] ?? 0) + amount;
  }
}

/** A payment that may only happen once for `key`. Returns whether it was paid now. */
export function payOnce(state: GameState, key: string, amount: number, kind: PayKind): boolean {
  const ledger = ledgerOf(state);
  if (amount <= 0 || ledger.paid.includes(key)) return false;
  ledger.paid.push(key);
  if (ledger.paid.length > PAID_KEEP) ledger.paid.splice(0, ledger.paid.length - PAID_KEEP);
  receiveIncome(state, amount, kind);
  return true;
}

export const PAY_LABEL: Record<PayKind, string> = {
  wage: "Wages",
  signing: "Signing bonuses",
  appearance: "Appearance bonuses",
  goal: "Goal bonuses",
  assist: "Assist bonuses",
  cleanSheet: "Clean-sheet bonuses",
  trophy: "Trophy bonuses",
  promotion: "Promotion bonuses",
  other: "Sponsors & other",
  earlier: "Earlier income (not itemised)",
};
