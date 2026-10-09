/**
 * The two sides of a renewal, kept apart on purpose.
 *
 * THE CLUB decides what it is willing to pay: the player's market wage (see players/economy.ts: the same model that prices
 * every transfer offer and free-agent deal), scaled by how much the squad needs him, held back by what the club can afford.
 *
 * THE PLAYER decides what he is willing to accept: the market wage less a small discount for loyalty (years at the club,
 * renewals, the stands, the dressing room, his own nature, One-Club Minded). Loyalty only ever closes a small gap.
 */
import { BALANCE } from "../balance";
import { stadium, staticClub, staticLeague } from "../data/world";
import { overallFor } from "../players/attributes";
import { clubLevel, clubRevenue, marketWage, playerWage } from "../players/economy";
import { ageOf } from "../players/generate";
import { clamp } from "../rng";
import { movePressure, tenure } from "../traits/career";
import { careerProfile, hasTrait } from "../traits/effects";
import { stayOf } from "../traits/stay";
import type { ClubState, GameState, Player, SquadRole } from "../types";
import { squadOf } from "../world/helpers";

/** The most a player's loyalty can take off the wage he will accept, as a share of his market wage. */
export const LOYALTY_DISCOUNT_MAX = 0.08;
/** What a player with no other club interested will give up against the market rate. */
const NO_SUITORS_SLACK = 0.18;
/** Retention premium over market: a squad player is worth a little less, a key man up to a quarter more. */
export const RETENTION_MIN = 0.85;
export const RETENTION_SPAN = 0.4;
/** Share of annual revenue a club can put into wages before it starts holding offers back. */
const WAGE_RATIO_COMFORT = 0.62;
/** Longest cut a club proposes unless the player's situation has changed dramatically. */
const CUT_FLOOR = 0.72;
const CUT_FLOOR_DRAMATIC = 0.55;
/** Club walk-away price as a share above its opening offer, scaled by importance. */
const STRETCH_BASE = 0.04;
const STRETCH_SPAN = 0.12;
/** The market wage is the most any club stretches to, whatever the premium. */
const MARKET_CEILING = 1.3;

const ROLE_WEIGHT: Record<SquadRole, number> = { star: 1, first: 0.65, rotation: 0.35, backup: 0.1, prospect: 0.1 };

/** Wages as a share of the club's annual revenue. */
export function wageBillRatio(state: GameState, club: ClubState): number {
  const st = staticClub(club.id);
  const tier = staticLeague(club.leagueId)?.tier ?? 3;
  const cap = stadium(st?.stadiumId ?? "")?.capacity ?? 10000;
  const revenue = clubRevenue(club.reputation, tier, cap);
  let bill = 0;
  for (const p of squadOf(state, club.id)) bill += p.contract?.wage ?? 0;
  return (bill * BALANCE.calendar.turnsPerSeason) / Math.max(1, revenue);
}

/** How much the club needs this player, 0–1: his role, his level against the team's, form, standing, promise, the armband. */
export function squadImportance(club: ClubState, p: Player, role: SquadRole, season: number): number {
  const o = overallFor(p.attrs, p.position);
  const level = clubLevel(club.reputation);
  const margin = clamp((o - level + 4) / 10, 0, 1);
  const form = clamp((p.form - 5.8) / 2.2, 0, 1);
  const standing = clamp(p.reputation / 80, 0, 1);
  const promise = ageOf(p, season) <= 23 ? clamp((p.hidden.potential - level) / 10, 0, 1) : 0;
  const armband = club.captain === p.id ? 1 : 0;
  return clamp(0.5 * ROLE_WEIGHT[role] + 0.2 * margin + 0.12 * form + 0.1 * standing + 0.08 * Math.max(promise, armband), 0, 1);
}

export interface RetentionOffer {
  /** What the club opens with. */
  wage: number;
  /** The most it will go to in talks. */
  maxWage: number;
  importance: number;
}

/**
 * What the player's own club will pay to keep him. Derived from the market wage, so a better player earns more and a worse
 * one less, whatever he earned before; there is no automatic raise. Cuts are bounded unless things have changed dramatically.
 */
export function retentionOffer(state: GameState, club: ClubState, p: Player, role: SquadRole): RetentionOffer {
  const market = marketWage(p, state.season);
  const importance = squadImportance(club, p, role, state.season);
  let premium = RETENTION_MIN + RETENTION_SPAN * importance;
  const ratio = wageBillRatio(state, club);
  // A club already stretched on wages, or in the red, cannot pay a premium and trims what it offers.
  const squeeze = clamp((ratio - WAGE_RATIO_COMFORT) / 0.2, 0, 1);
  if (premium > 1) premium = 1 + (premium - 1) * (1 - squeeze);
  premium *= 1 - 0.1 * squeeze;
  if (club.balance < 0) premium = Math.min(premium, 0.95);
  const affordable = playerWage(p, state.season, club.reputation, "star") * 1.1;
  let wage = market * premium;
  const current = p.contract?.wage ?? 0;
  if (current > 0) {
    const dramatic = market < current * CUT_FLOOR_DRAMATIC || ageOf(p, state.season) >= 33 || importance < 0.25;
    wage = Math.max(wage, current * (dramatic ? CUT_FLOOR_DRAMATIC : CUT_FLOOR));
  }
  wage = Math.min(wage, affordable);
  const maxWage = Math.min(wage * (1 + STRETCH_BASE + STRETCH_SPAN * importance), market * MARKET_CEILING, affordable);
  return { wage: Math.round(wage / 100) * 100, maxWage: Math.round(Math.max(wage, maxWage) / 100) * 100, importance };
}

/** How tied the player is to his club, 0–1. Feeds both the wage he will accept and how hard he is to prise away. */
export function loyaltyPull(state: GameState, p: Player): number {
  if (!p.clubId) return 0;
  const cp = careerProfile(p);
  const stay = stayOf(p, state.season);
  const years = clamp((tenure(p, state.season) - 2) / 6, 0, 1);
  const renewals = stay ? clamp(stay.renewals / 3, 0, 1) : 0;
  // The user's relationships are tracked; an NPC's are taken as neutral.
  const bond = p.isUser ? (state.user.relationships.supporters * 0.6 + state.user.relationships.manager * 0.4) / 100 : 0.5;
  let pull = 0.3 * years + 0.12 * renewals + 0.22 * cp.loyalty + 0.16 * (p.hidden.loyalty / 100) + 0.2 * bond;
  if (hasTrait(p, "club_oriented")) pull += 0.1;
  // Money and ambition pull the other way, and a club in crisis loosens the bond.
  pull *= 1 - 0.5 * cp.money;
  pull *= 1 - 0.4 * cp.ambition;
  if (movePressure(state, p).crisis) pull *= 0.25;
  return clamp(pull, 0, 1);
}

/**
 * How many clubs would realistically want him, 0–1. A player good enough to move up has real alternatives; a squad player
 * past his prime has few, and knows it.
 */
export function marketDemand(state: GameState, p: Player): number {
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  const o = overallFor(p.attrs, p.position);
  const age = ageOf(p, state.season);
  const young = age <= 23 ? clamp((p.hidden.potential - (club ? clubLevel(club.reputation) : o)) / 8, 0, 1) : 0;
  const fit = club ? clamp((o - clubLevel(club.reputation) + 8) / 12, 0, 1) : 1;
  return clamp(Math.max(fit, young) * (age >= 32 ? 0.7 : 1), 0, 1);
}

/** The lowest renewal wage he will take. Never more than a small step under what other clubs would pay. */
export function reservationWage(state: GameState, p: Player): number {
  // Without suitors a player cannot hold out for the full going rate.
  const market = marketWage(p, state.season) * (1 - NO_SUITORS_SLACK * (1 - marketDemand(state, p)));
  const discount = LOYALTY_DISCOUNT_MAX * loyaltyPull(state, p);
  // A hunger for money asks for a touch above the going rate.
  const greed = 0.04 * careerProfile(p).money;
  return Math.round((market * (1 - discount + greed)) / 100) * 100;
}

/** How far a renewal offer sits below what he will accept, as a share of that wage (0 when it is enough). */
export function renewalGap(state: GameState, p: Player, wage: number): number {
  const need = reservationWage(state, p);
  return need > 0 ? Math.max(0, (need - wage) / need) : 0;
}
