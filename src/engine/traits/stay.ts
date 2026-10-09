/**
 * Loyalty evidence for One-Club Minded. A handful of counters on the player (never a scan of his history), updated at the
 * moments a stay is actually decided: a contract extension, an approach he turns down, the season review.
 *
 * Time at a club is not loyalty on its own. The record only counts a stay as a choice when leaving was a real option:
 * an extension that came while he was good enough to sign elsewhere, a comparable or bigger club that came for him
 * and was refused. A season in which nobody wanted him adds minutes and years, never commitment.
 */
import { overallFor } from "../players/attributes";
import { clamp } from "../rng";
import type { ClubState, GameState, Player, StayRecord } from "../types";
import { clubLevel } from "../world/create";

/** A club this much smaller than his own is not a temptation. */
const REP_SLACK = 3;
/** Fraction of a waver forgiven each calm season. */
const FORGIVE = 0.34;

const fresh = (clubId: string): StayRecord => ({ clubId, seasons: 0, minutes: 0, renewals: 0, freeStays: 0, declined: 0, wavered: 0 });

/**
 * The record for the player's present club, created on first sight. A player already settled at a club is credited with the
 * seasons his history shows (NPC histories only go back a few years); nothing else is invented.
 */
export function stayOf(p: Player, season: number): StayRecord | undefined {
  if (!p.clubId || p.virtual) {
    delete p.stay;
    return undefined;
  }
  if (p.stay?.clubId === p.clubId) return p.stay;
  if (p.loan) return undefined;
  const s = fresh(p.clubId);
  for (let i = p.history.length - 1; i >= 0 && p.history[i].clubId === p.clubId; i--) {
    if (p.history[i].season >= season) continue;
    s.seasons++;
    s.minutes += p.history[i].stats.minutes;
  }
  p.stay = s;
  return s;
}

/** Above the level the club fields, so that a bigger club would plausibly take him. */
const ABOVE_CLUB = 4;
const LAST_MOVE_AGE = 31;

/**
 * Whether leaving was a real option: better than his club's own level (clubs a rung up play at that level) and not yet at the age
 * clubs stop paying for. A regular who is simply as good as his team-mates has not turned anything down by signing again.
 */
export function marketable(state: GameState, p: Player, club: ClubState): boolean {
  return overallFor(p.attrs, p.position) >= clubLevel(club.reputation) + ABOVE_CLUB && state.season - p.birthYear <= LAST_MOVE_AGE;
}

/** A contract extension was agreed at the current club. */
export function noteRenewal(state: GameState, p: Player): void {
  const s = stayOf(p, state.season);
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!s || !club) return;
  s.renewals++;
  if (marketable(state, p, club)) s.freeStays++;
}

/** A club came for the player and he turned it down. Only a comparable or bigger club counts, and once a season. */
export function noteApproachDeclined(state: GameState, p: Player, buyerReputation: number): void {
  const s = stayOf(p, state.season);
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!s || !club || buyerReputation < club.reputation - REP_SLACK || s.lastDeclined === state.season) return;
  s.lastDeclined = state.season;
  s.declined++;
}

/** Season review: the minutes, the years, and whether he was restless. */
export function reviewStay(state: GameState, p: Player, minutes: number): void {
  const s = stayOf(p, state.season);
  if (!s) return;
  s.seasons++;
  s.minutes += minutes;
  const restless = p.isUser ? state.user.transferRequest || !!p.listed : !!p.listed;
  s.wavered = restless ? s.wavered + 1 : Math.max(0, Math.round((s.wavered - FORGIVE) * 100) / 100);
}

/** Validates a stored record on load (anything wrong is dropped; it rebuilds from history on the next review). */
export function cleanStay(p: Player): void {
  const s = p.stay as Partial<StayRecord> | undefined;
  if (s === undefined) return;
  const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, 0, max) : NaN);
  const rec = {
    seasons: num(s.seasons, 60), minutes: num(s.minutes, 400000), renewals: num(s.renewals, 60), freeStays: num(s.freeStays, 60),
    declined: num(s.declined, 60), wavered: num(s.wavered, 60),
  };
  if (typeof s.clubId !== "string" || s.clubId !== p.clubId || Object.values(rec).some(Number.isNaN)) {
    delete p.stay;
    return;
  }
  p.stay = { clubId: s.clubId, ...rec, freeStays: Math.min(rec.freeStays, rec.renewals), ...(Number.isFinite(s.lastDeclined) ? { lastDeclined: Number(s.lastDeclined) } : {}) };
}
