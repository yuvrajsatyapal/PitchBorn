/**
 * Personality and career traits meeting the rest of the game: transfers, contracts, relationships,
 * morale and loyalty. They shift probabilities and reactions; none of them is absolute — a loyal
 * player still leaves a collapsing club, an ambitious one can be content when things go well.
 */
import { clubLevel } from "../world/create";
import { overallFor } from "../players/attributes";
import { clamp } from "../rng";
import type { ClubState, GameState, Player, TransferOffer } from "../types";
import { addNews, squadOf, userPlayer } from "../world/helpers";
import { staticClub } from "../data/world";
import { rememberRejection } from "../memory/detect";
import { careerProfile } from "./effects";
import { clubTenure } from "./tenure";

/** Cached count of mentoring influence at a club (sum of Mentor strength among its senior players). */
export function mentorsOf(state: GameState, clubId: string, cache: Map<string, number>): number {
  const hit = cache.get(clubId);
  if (hit !== undefined) return hit;
  let n = 0;
  for (const p of squadOf(state, clubId)) if (state.season - p.birthYear >= 28) n += careerProfile(p).mentor;
  cache.set(clubId, n);
  return n;
}

export interface MovePressure {
  crisis: boolean;
  reasons: string[];
}

/** Reasons that can override loyalty: the club is in trouble, the player is frozen out, or his level has outgrown it. */
export function movePressure(state: GameState, p: Player): MovePressure {
  const reasons: string[] = [];
  const club = p.clubId ? state.clubs[p.clubId] : null;
  if (club) {
    if (club.balance < 0) reasons.push("the club is in financial trouble");
    if (overallFor(p.attrs, p.position) - clubLevel(club.reputation) > 9) reasons.push("he has outgrown the club");
    if (p.contract && (p.contract.role === "backup" || p.contract.role === "prospect") && state.season - p.birthYear >= 22) reasons.push("no real playing time");
  }
  if (p.listed) reasons.push("he has been put on the transfer list");
  if (p.isUser) {
    if (state.user.relationships.manager < 25) reasons.push("the manager relationship has broken down");
    if (state.user.relationships.board < 20) reasons.push("the board has lost faith");
  }
  return { crisis: reasons.length > 0, reasons };
}

/** Seasons spent at the current club (completed seasons plus the current one). */
export function tenure(p: Player, season: number): number {
  return Math.max(1, clubTenure(p, season));
}

/**
 * Shift to a player's willingness to join `buyer` (added to the score in playerWillJoin).
 * Loyalty resists a move unless the situation has gone wrong; ambition is drawn to bigger clubs;
 * money follows the wage; home comfort resists leaving the country.
 */
export function moveScoreDelta(state: GameState, p: Player, buyer: ClubState, wageGain: number): number {
  const cp = careerProfile(p);
  const current = p.clubId ? state.clubs[p.clubId] : null;
  if (!current) return 0;
  const { crisis } = movePressure(state, p);
  const bond = Math.min(1, cp.loyalty + Math.max(0, tenure(p, state.season) - 5) * 0.04 * (cp.loyalty > 0 ? 1 : 0));
  const loyalty = crisis ? bond * 0.2 : bond;
  const up = buyer.reputation - current.reputation;
  let delta = -loyalty * 16;
  delta += cp.ambition * (up > 0 ? up * 0.5 : up * 0.25);
  delta += cp.money * Math.max(0, wageGain - 1) * 25;
  const abroad = staticClub(buyer.id)?.countryCode !== staticClub(current.id)?.countryCode;
  if (abroad) delta -= cp.home * 12 + Math.max(0, -cp.adapt) * 4;
  return delta;
}

/** Contract-expiry decision for NPCs: how much more (or less) likely they are to stay. */
export function stayBonus(state: GameState, p: Player): number {
  const cp = careerProfile(p);
  const { crisis } = movePressure(state, p);
  // Loyalty and a bond with the stands keep a player; ambition, a hunger for money and a habit of difficult talks let him go.
  return (crisis ? 0.2 : 1) * (cp.loyalty * 0.12 + Math.max(0, cp.fan) * 0.04) - cp.ambition * 0.05 - cp.money * 0.04 - cp.contract * 0.05;
}

/** Clubs run out of patience a round sooner with a player known for difficult contract talks. */
export function negotiationPatience(p: Pick<Player, "traits">, base: number): number {
  return Math.max(1, base - (careerProfile(p).contract >= 0.4 ? 1 : 0));
}

/** Who gets the armband: standing first, with natural leaders favoured. Never decisive on its own. */
export function captainScore(p: Player): number {
  return p.reputation + careerProfile(p).leader * 14;
}

/** Share of a defeat's sting that a resilient player shrugs off. */
export function defeatSting(p: Pick<Player, "traits">): number {
  return 1 - careerProfile(p).resilience * 0.35;
}

/**
 * The user turns down a bigger move. A loyal player who has put in the years is remembered for it:
 * the fans love it, the board notices, and it feeds a one-club story. Returns true when it counted.
 */
export function loyaltyStand(state: GameState, o: TransferOffer): boolean {
  const p = userPlayer(state);
  const cp = careerProfile(p);
  const cur = p.clubId ? state.clubs[p.clubId] : null;
  const from = state.clubs[o.fromClubId];
  if (!cur || !from || (o.kind !== "transfer" && o.kind !== "free")) return false;
  if (cp.loyalty < 0.35 || tenure(p, state.season) < 3 || from.reputation < cur.reputation + 8) return false;
  const r = state.user.relationships;
  const bond = clamp((tenure(p, state.season) - 2) / 8, 0.3, 1);
  r.supporters = clamp(r.supporters + 8 * bond, 0, 100);
  r.board = clamp(r.board + 4 * bond, 0, 100);
  p.morale = clamp(p.morale + 2, 0, 100);
  state.user.loyaltyStands = (state.user.loyaltyStands ?? 0) + 1;
  addNews(state, { kind: "club", title: "Loyalty rewarded", body: `You turned down ${from.id ? staticClubName(from.id) : "a bigger club"} to stay. The supporters will not forget it.`, important: true });
  rememberRejection(state, o, true);
  return true;
}

const staticClubName = (id: string) => staticClub(id)?.shortName ?? id;

/** Weekly, user only: temper and dressing-room standing show up in relationships; ambition chafes at a small club. */
export function weeklyPersonality(state: GameState): void {
  const p = userPlayer(state);
  const cp = careerProfile(p);
  if (!p.traits?.length) return;
  const r = state.user.relationships;
  // A big personality amplifies whatever he already does to the room.
  const amp = cp.amp;
  if (cp.friction > 0 && r.manager > 30) r.manager = clamp(r.manager - cp.friction * 0.35 * amp, 0, 100);
  else if (cp.friction < 0) r.manager = clamp(r.manager + -cp.friction * 0.2, 0, 100);
  if (cp.team !== 0) r.teammates = clamp(r.teammates + cp.team * 0.25 * (cp.team < 0 ? amp : 1), 0, 100);
  if (cp.fan !== 0) r.supporters = clamp(r.supporters + cp.fan * 0.3 * (cp.fan > 0 ? amp : 1), 0, 100);
  if (cp.resilience > 0 && p.morale < 55) p.morale = clamp(p.morale + cp.resilience * 0.6, 0, 100);
  const club = p.clubId ? state.clubs[p.clubId] : null;
  // Ego: sulks when the role is below his own opinion of himself (only when he is genuinely good enough to feel it).
  if (club && cp.ego > 0.2 && p.contract && ["rotation", "backup", "prospect"].includes(p.contract.role) && overallFor(p.attrs, p.position) >= clubLevel(club.reputation) - 2) {
    p.morale = clamp(p.morale - cp.ego * 0.5, 0, 100);
    if (r.manager > 30) r.manager = clamp(r.manager - cp.ego * 0.25 * amp, 0, 100);
  }
  if (club && cp.ambition >= 0.4) {
    const gap = overallFor(p.attrs, p.position) - clubLevel(club.reputation);
    if (gap > 6) p.morale = clamp(p.morale - cp.ambition * 0.4, 0, 100);
  }
}

/** Settling in after a move: adaptability and a love of home decide how quickly a new club feels like one. */
export function settlingEffect(p: Player, fromCountry: string | undefined, toCountry: string | undefined): { morale: number; manager: number } {
  const cp = careerProfile(p);
  const abroad = !!fromCountry && !!toCountry && fromCountry !== toCountry;
  return { morale: Math.round(cp.adapt * 5 - (abroad ? cp.home * 6 : 0)), manager: Math.round(cp.adapt * 6) };
}
