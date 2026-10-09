/**
 * What a contract costs the club, week by week, and what a club can afford to promise.
 *
 * The whole package is compared against one ceiling in negotiation (see offers.ts), so the clauses trade off: more
 * signing bonus or bonuses leave less room for wage, a low release clause is a concession the club wants paying for, and
 * a high one is a concession the club will give something back for. Everything is bounded so no clause can run away.
 */
import { BALANCE } from "../balance";
import { annualRevenue, spendableCash } from "../club/ownership";
import { overallFor } from "../players/attributes";
import { marketValue } from "../players/economy";
import { clamp } from "../rng";
import type { ClubState, ContractTerms, GameState, Player, Position, SquadRole } from "../types";

const WEEKS = BALANCE.calendar.turnsPerSeason;

export const CLAUSE_KEYS = ["appearanceBonus", "goalBonus", "assistBonus", "cleanSheetBonus", "trophyBonus", "promotionBonus", "wageRise"] as const;
export type ClauseKey = (typeof CLAUSE_KEYS)[number];

/** Highest value of each clause as a multiple of the weekly wage (wageRise is a fraction a year). */
export const CLAUSE_LIMIT: Record<ClauseKey, number> = {
  appearanceBonus: 0.3,
  goalBonus: 0.6,
  assistBonus: 0.4,
  cleanSheetBonus: 0.4,
  trophyBonus: 8,
  promotionBonus: 6,
  wageRise: 0.12,
};

const SCORERS: Position[] = ["ST", "RW", "LW", "AM"];
const CREATORS: Position[] = ["AM", "RW", "LW", "CM", "ST"];
const DEFENDERS: Position[] = ["GK", "CB", "RB", "LB"];

/** Which clauses make football sense for a position. A keeper has no goal bonus; a striker no clean-sheet bonus. */
export function relevantClauses(position: Position): ClauseKey[] {
  const keys: ClauseKey[] = ["appearanceBonus"];
  if (SCORERS.includes(position) || position === "CM") keys.push("goalBonus");
  if (CREATORS.includes(position)) keys.push("assistBonus");
  if (DEFENDERS.includes(position)) keys.push("cleanSheetBonus");
  keys.push("trophyBonus", "promotionBonus", "wageRise");
  return keys;
}

const APPS: Record<SquadRole, number> = { star: 34, first: 32, rotation: 22, backup: 12, prospect: 8 };
const GOALS_PER_APP: Partial<Record<Position, number>> = { ST: 0.42, RW: 0.24, LW: 0.24, AM: 0.2, CM: 0.07, DM: 0.03, CB: 0.03, RB: 0.02, LB: 0.02 };
const ASSISTS_PER_APP: Partial<Record<Position, number>> = { ST: 0.12, RW: 0.2, LW: 0.2, AM: 0.24, CM: 0.12, DM: 0.05, RB: 0.1, LB: 0.1, CB: 0.02 };
const CLEAN_SHEETS_PER_APP: Partial<Record<Position, number>> = { GK: 0.32, CB: 0.3, RB: 0.28, LB: 0.28 };

/** A season of output the club can expect from a player in this role (used only to price bonuses, never to simulate). */
export function expectedSeason(p: Player, role: SquadRole, club: ClubState): { apps: number; goals: number; assists: number; cleanSheets: number } {
  const apps = APPS[role];
  const quality = clamp(overallFor(p.attrs, p.position) / clamp(40 + club.reputation * 0.5, 45, 90), 0.6, 1.4);
  return {
    apps,
    goals: apps * (GOALS_PER_APP[p.position] ?? 0) * quality,
    assists: apps * (ASSISTS_PER_APP[p.position] ?? 0) * quality,
    cleanSheets: apps * (CLEAN_SHEETS_PER_APP[p.position] ?? 0),
  };
}

/** Expected weekly cost of the bonus clauses, as the club prices them. */
export function bonusWeekly(t: ContractTerms, p: Player, club: ClubState): number {
  const e = expectedSeason(p, t.role, club);
  const season =
    e.apps * (t.appearanceBonus ?? 0) +
    e.goals * (t.goalBonus ?? 0) +
    e.assists * (t.assistBonus ?? 0) +
    e.cleanSheets * (t.cleanSheetBonus ?? 0) +
    0.12 * (t.trophyBonus ?? 0) +
    0.08 * (t.promotionBonus ?? 0);
  return season / WEEKS;
}

/** What the club asks in return for a low release clause, or gives back for a high one. Bounded to ±~4% of the wage. */
export function clauseWeekly(t: ContractTerms, p: Player, state: GameState): number {
  if (!t.releaseClause) return 0;
  const ratio = t.releaseClause / Math.max(1, marketValue(p, state.season));
  return ratio < 2.5 ? (2.5 - Math.max(ratio, 0.5)) * 0.02 * t.wage : -(Math.min(ratio, 6) - 2.5) * 0.012 * t.wage;
}

/** Everything in the offer except the base wage, as a weekly cost to the club. */
export function extrasWeekly(t: ContractTerms, p: Player, club: ClubState, state: GameState): number {
  const years = Math.max(1, t.years);
  const rise = t.wage * (t.wageRise ?? 0) * ((years - 1) / 2);
  return t.signingBonus / (years * WEEKS) + bonusWeekly(t, p, club) + clauseWeekly(t, p, state) + rise;
}

/** The weekly cost of the whole package: the number compared with the club's ceiling. */
export function packageWeekly(t: ContractTerms, p: Player, club: ClubState, state: GameState): number {
  return t.wage + extrasWeekly(t, p, club, state);
}

/**
 * The most signing bonus a club will pay. It is a cash payment up front, so it is capped by what the club has in the
 * bank (a club in debt pays none) and by the player's standing: bigger names command a bigger up-front sum.
 */
export function signingBonusCeiling(club: ClubState, p: Player, wage: number): number {
  const cash = spendableCash(club, annualRevenue(club));
  if (cash <= 0) return 0;
  const byStanding = wage * (6 + p.reputation / 4);
  const byCash = cash * 0.04;
  return Math.round(Math.min(byStanding, byCash) / 1000) * 1000;
}

/** Clamp requested clauses to football-sensible values for the position and wage. */
export function normaliseClauses(t: ContractTerms, position: Position): ContractTerms {
  const relevant = new Set<ClauseKey>(relevantClauses(position));
  const out: ContractTerms = { ...t };
  for (const k of CLAUSE_KEYS) {
    const v = out[k];
    if (!v || !relevant.has(k)) {
      if (k === "goalBonus") out.goalBonus = 0;
      else delete out[k];
      continue;
    }
    const max = k === "wageRise" ? CLAUSE_LIMIT.wageRise : Math.round(out.wage * CLAUSE_LIMIT[k]);
    out[k] = k === "wageRise" ? Math.round(clamp(v, 0, max) * 100) / 100 : Math.round(clamp(v, 0, max) / 10) * 10;
    if (!out[k] && k !== "goalBonus") delete out[k];
  }
  out.signingBonus = Math.max(0, Math.round(out.signingBonus || 0));
  if (out.releaseClause !== undefined && !(out.releaseClause > 0)) delete out.releaseClause;
  return out;
}

/** The clauses a club writes into its own opening offer: those that make sense for the position, nothing exotic. */
export function openingClauses(p: Player, wage: number, role: SquadRole): Partial<Record<ClauseKey, number>> {
  const out: Partial<Record<ClauseKey, number>> = {};
  const rel = relevantClauses(p.position);
  if (rel.includes("appearanceBonus") && (role === "rotation" || role === "backup" || role === "prospect")) out.appearanceBonus = Math.round((wage * 0.06) / 10) * 10;
  if (rel.includes("goalBonus") && SCORERS.includes(p.position)) out.goalBonus = Math.round((wage * 0.04) / 10) * 10;
  if (rel.includes("cleanSheetBonus") && (p.position === "GK" || p.position === "CB")) out.cleanSheetBonus = Math.round((wage * 0.04) / 10) * 10;
  return out;
}

/** Contract fields copied onto the Player when a deal completes. */
export function contractClauses(t: ContractTerms): Partial<Pick<ContractTerms, ClauseKey | "releaseClause">> {
  const out: Partial<Pick<ContractTerms, ClauseKey | "releaseClause">> = {};
  if (t.releaseClause) out.releaseClause = t.releaseClause;
  for (const k of CLAUSE_KEYS) if (t[k]) out[k] = t[k];
  return out;
}

/** Remove malformed clause values from a stored contract or terms object (used on load). */
export function sanitizeClauses<T extends Partial<Record<ClauseKey | "releaseClause", number>>>(c: T | null | undefined): void {
  if (!c) return;
  for (const k of CLAUSE_KEYS) {
    const v = c[k];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) delete c[k];
    else if (k === "wageRise") c[k] = Math.min(v, CLAUSE_LIMIT.wageRise) as T[ClauseKey];
  }
  if (c.releaseClause !== undefined && (typeof c.releaseClause !== "number" || !Number.isFinite(c.releaseClause) || c.releaseClause <= 0)) delete c.releaseClause;
}
