import type { GameState } from "../types";

/** Money earned: counts toward career earnings and goes into the bank. */
export function receiveIncome(state: GameState, amount: number): void {
  if (!amount) return;
  state.user.earnings += Math.max(0, amount);
  state.user.bank += amount;
}
