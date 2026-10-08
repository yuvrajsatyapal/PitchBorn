/**
 * Performance bonuses written into the user's contract. Every payment goes through `payOnce` with a key built from the
 * thing that earned it (the fixture, the competition, the season), so a reload, a re-simulated week or a repeated
 * click can never pay it twice. The club foots the bill.
 */
import type { MatchResult } from "../match/engine";
import type { Competition, Contract, Fixture, GameState, PayKind } from "../types";
import { userPlayer } from "../world/helpers";
import { payOnce } from "./money";

type Line = MatchResult["lines"][number];

const CLUB_COMPS = new Set(["league", "cup", "continental"]);

/** The clubs' contract applies to their own matches, not a loan club's or the national team's. */
function bonusContract(state: GameState): Contract | null {
  const p = userPlayer(state);
  if (!p.contract || p.loan || !p.clubId || p.contract.clubId !== p.clubId) return null;
  return p.contract;
}

function pay(state: GameState, key: string, amount: number, kind: PayKind): number {
  const c = bonusContract(state);
  if (!c || amount <= 0) return 0;
  if (!payOnce(state, key, amount, kind)) return 0;
  const club = state.clubs[c.clubId];
  if (club) club.balance -= amount;
  return amount;
}

/** Appearance, goal, assist and clean-sheet bonuses for one match. Returns what was paid. */
export function payMatchBonuses(state: GameState, fixture: Fixture, comp: Competition, line: Line): number {
  const c = bonusContract(state);
  if (!c || !CLUB_COMPS.has(comp.kind)) return 0;
  const p = userPlayer(state);
  if (fixture.home !== p.clubId && fixture.away !== p.clubId) return 0;
  const minutes = Math.max(0, (line.minuteOff ?? 90) - line.minuteOn);
  if (minutes <= 0) return 0;
  let total = pay(state, `app:${fixture.id}`, c.appearanceBonus ?? 0, "appearance");
  total += pay(state, `goal:${fixture.id}`, (c.goalBonus ?? 0) * line.goals, "goal");
  total += pay(state, `assist:${fixture.id}`, (c.assistBonus ?? 0) * line.assists, "assist");
  const cleanSheet = line.conceded === 0 && minutes >= 60 && ["GK", "CB", "RB", "LB"].includes(line.slot);
  if (cleanSheet) total += pay(state, `cs:${fixture.id}`, c.cleanSheetBonus ?? 0, "cleanSheet");
  return total;
}

/** Paid when the user's club wins a competition they took part in (or any league title they were registered for). */
export function payTrophyBonus(state: GameState, comp: Competition, appeared: boolean): number {
  const c = bonusContract(state);
  if (!c || !CLUB_COMPS.has(comp.kind) || comp.winner !== c.clubId) return 0;
  if (!appeared && comp.kind !== "league") return 0;
  return pay(state, `trophy:${comp.id}`, c.trophyBonus ?? 0, "trophy");
}

export const PROMOTION_MIN_APPS = 10;

/** Paid once for the season in which the club went up, to a player who played a real part. */
export function payPromotionBonus(state: GameState, apps: number): number {
  const c = bonusContract(state);
  if (!c || apps < PROMOTION_MIN_APPS) return 0;
  return pay(state, `promo:${state.season}:${c.clubId}`, c.promotionBonus ?? 0, "promotion");
}

/** Applies the contract's annual wage rise once for the season that is starting. */
export function applyWageRise(state: GameState): void {
  const p = userPlayer(state);
  const c = p.contract;
  if (!c?.wageRise || p.loan) return;
  const key = `rise:${state.season}:${c.clubId}`;
  const ledger = state.user.pay;
  if (ledger?.paid.includes(key)) return;
  if (c.signed >= state.season) return; // the first year is the wage agreed
  if (c.expires < state.season) return;
  c.wage = Math.round((c.wage * (1 + c.wageRise)) / 100) * 100;
  if (ledger) ledger.paid.push(key);
}
