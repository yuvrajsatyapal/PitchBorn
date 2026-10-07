import rivalries from "../../data/rivalries.json";
import { staticClub } from "../data/world";
import type { ClubId, GameState } from "../types";

const PAIRS = new Map<string, number>();
for (const [a, b, level] of rivalries.pairs as [string, string, number][]) PAIRS.set(a < b ? `${a}|${b}` : `${b}|${a}`, level);

/** Editorial rivalry of two clubs, 0–1: famous derbies, then same-city, else 0. */
export function baseRivalry(a?: string | null, b?: string | null): number {
  if (!a || !b || a === b) return 0;
  const listed = PAIRS.get(a < b ? `${a}|${b}` : `${b}|${a}`);
  if (listed !== undefined) return listed;
  const ca = staticClub(a);
  const cb = staticClub(b);
  return ca && cb && ca.countryCode === cb.countryCode && ca.city && ca.city === cb.city ? 0.4 : 0;
}

/** How heated this fixture is for the user: editorial rivalry plus grudges their own career created. */
export function rivalryLevel(state: GameState, myClub?: string | null, opponent?: string | null): number {
  const base = baseRivalry(myClub, opponent);
  const heat = opponent ? state.user.rivalHeat?.[opponent] ?? 0 : 0;
  return Math.min(1, base + heat);
}

/** Moments with a club (a late winner, a bitter exit) make it matter more to this player. */
export function bumpRivalHeat(state: GameState, clubId: ClubId | undefined | null, amount: number): void {
  if (!clubId) return;
  const h = (state.user.rivalHeat ??= {});
  h[clubId] = Math.min(0.35, (h[clubId] ?? 0) + amount);
}
