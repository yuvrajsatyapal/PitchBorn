import rivalries from "../../data/rivalries.json";
import { staticClub } from "../data/world";
import type { ClubId, GameState } from "../types";

const PAIRS = new Map<string, number>();
for (const [a, b, level] of rivalries.pairs as [string, string, number][]) PAIRS.set(a < b ? `${a}|${b}` : `${b}|${a}`, level);

/** Clubs from the same city: that fixture is a derby, whatever its level. */
export function sameCity(a: string, b: string): boolean {
  const ca = staticClub(a);
  const cb = staticClub(b);
  return !!ca && !!cb && ca.countryCode === cb.countryCode && !!ca.city && ca.city === cb.city;
}

/** Editorial rivalry of two clubs, 0–1: famous derbies, then same-city, else 0. */
export function baseRivalry(a?: string | null, b?: string | null): number {
  if (!a || !b || a === b) return 0;
  const listed = PAIRS.get(a < b ? `${a}|${b}` : `${b}|${a}`);
  if (listed !== undefined) return listed;
  return sameCity(a, b) ? 0.4 : 0;
}

/** How heated this fixture is for the user: editorial rivalry plus grudges their own career created. */
export function rivalryLevel(state: GameState, myClub?: string | null, opponent?: string | null): number {
  const base = baseRivalry(myClub, opponent);
  const heat = opponent ? state.user.rivalHeat?.[opponent] ?? 0 : 0;
  return Math.min(1, base + heat);
}

export interface Rival {
  clubId: ClubId;
  level: number;
  label: string;
}

export function rivalryLabel(level: number, derby = false): string {
  if (derby) return "Derby";
  return level >= 0.85 ? "Fierce rivalry" : level >= 0.6 ? "Heated rivalry" : level >= 0.4 ? "Rivalry" : "Bad blood";
}

/** The clubs that matter most to a club's supporters (and to you), strongest first. */
export function rivalsOf(state: GameState, clubId: ClubId, limit = 4): Rival[] {
  const out = new Map<ClubId, number>();
  for (const [a, b] of Array.from(PAIRS.keys(), (k) => k.split("|") as [string, string])) {
    const other = a === clubId ? b : b === clubId ? a : null;
    if (other && state.clubs[other]) out.set(other, rivalryLevel(state, clubId, other));
  }
  for (const [other, heat] of Object.entries(state.user.rivalHeat ?? {})) if (heat >= 0.2 && other !== clubId && state.clubs[other] && !out.has(other)) out.set(other, rivalryLevel(state, clubId, other));
  return [...out.entries()]
    .filter(([, level]) => level >= 0.3)
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([id, level]) => ({ clubId: id, level, label: rivalryLabel(level, sameCity(clubId, id)) }));
}

/** Moments with a club (a late winner, a bitter exit) make it matter more to this player. */
export function bumpRivalHeat(state: GameState, clubId: ClubId | undefined | null, amount: number): void {
  if (!clubId) return;
  const h = (state.user.rivalHeat ??= {});
  h[clubId] = Math.min(0.35, (h[clubId] ?? 0) + amount);
}
