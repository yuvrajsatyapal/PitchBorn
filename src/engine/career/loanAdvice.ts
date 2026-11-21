/**
 * Loan advice for young players who are not getting games. Elite academies rarely give minutes to prospects, so
 * the game says so plainly and suggests clubs where the player would actually play, using the same pool of clubs
 * the weekly loan offers come from (career/offers.ts).
 */
import { BALANCE } from "../balance";
import { isTransferWindow, upcomingWindow } from "../calendar";
import { clubName } from "../data/world";
import { overallFor, positionGroup } from "../players/attributes";
import { clubLevel } from "../players/economy";
import { ageOf } from "../players/generate";
import type { ClubId, ClubState, GameState, Player } from "../types";
import { squadOf, userPlayer } from "../world/helpers";

export const LOAN_MAX_AGE = 22;
/** Below this share of the club's minutes a young player is "not playing". */
const LOW_SHARE = 0.35;

export interface LoanDestination {
  clubId: ClubId;
  leagueId: string;
  /** Squad players in his position group rated at or above him. */
  ahead: number;
  /** The best player he would compete with, if any. */
  bestRival?: { name: string; overall: number };
  outlook: "starter" | "rotation";
  reason: string;
}

export interface LoanAdvice {
  /** "urge" when he has barely played; "suggest" when he is a prospect at a club far above his level. */
  level: "suggest" | "urge";
  reasons: string[];
  minutes: number;
  /** Minutes his club has played in the competitions he could have featured in. */
  possible: number;
  share: number;
  windowOpen: boolean;
  /** Weeks until the next window opens (0 while one is open). */
  weeksToWindow: number | null;
  destinations: LoanDestination[];
}

const ovr = (p: Player) => Math.round(overallFor(p.attrs, p.position));

function clubMinutesSoFar(state: GameState, clubId: ClubId): number {
  let games = 0;
  for (const c of Object.values(state.competitions)) {
    if (c.kind === "international" || c.kind === "friendly" || c.season !== state.season) continue;
    for (const f of c.fixtures) if (f.result && (f.home === clubId || f.away === clubId)) games++;
  }
  return games * 90;
}

/**
 * Clubs that would take the player on loan: a level or two below his parent club, where he is good enough to play.
 * A prospect at the very top can be rated below every club in a small world, so the band widens until a few clubs fit.
 */
export function loanPool(state: GameState, p: Player): ClubState[] {
  const parent = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!parent) return [];
  const mine = overallFor(p.attrs, p.position);
  const below = Object.values(state.clubs).filter((c) => c.id !== parent.id && c.reputation < parent.reputation - 6 && clubLevel(c.reputation) >= mine - 6);
  for (const headroom of [3, 6, 9]) {
    const pool = below.filter((c) => clubLevel(c.reputation) <= mine + headroom);
    if (pool.length >= 3 || headroom === 9) return pool;
  }
  return [];
}

/** The clubs a loan could realistically come from, best fit first. */
export function loanDestinations(state: GameState, limit = 3): LoanDestination[] {
  const p = userPlayer(state);
  if (!p.clubId) return [];
  const mine = overallFor(p.attrs, p.position);
  const group = positionGroup(p.position);
  const pool = loanPool(state, p);
  const scored = pool.map((c) => {
    const rivals = squadOf(state, c.id).filter((x) => !x.isUser && positionGroup(x.position) === group).sort((a, b) => ovr(b) - ovr(a));
    const ahead = rivals.filter((x) => ovr(x) >= Math.round(mine)).length;
    const best = rivals[0];
    // Strikers and keepers need to be first choice; other groups have two or more places.
    const places = group === "GK" ? 1 : group === "ATT" ? 2 : group === "DEF" ? 4 : 3;
    const outlook: LoanDestination["outlook"] = ahead < places ? "starter" : "rotation";
    const reason = outlook === "starter"
      ? best && ovr(best) >= Math.round(mine)
        ? `You'd compete with ${best.firstName[0]}. ${best.lastName} (${ovr(best)}) for a starting place.`
        : `You'd walk into the side${best ? `: their best ${p.position} option is ${ovr(best)}` : ""}.`
      : `${ahead} players ahead of you, but a level where you'd get minutes.`;
    return {
      dest: { clubId: c.id, leagueId: c.leagueId, ahead, bestRival: best ? { name: `${best.firstName} ${best.lastName}`, overall: ovr(best) } : undefined, outlook, reason },
      score: (outlook === "starter" ? 100 : 0) - ahead * 10 + c.reputation * 0.3,
    };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.dest);
}

/** Advice for the user's player, or null when none applies. */
export function loanAdvice(state: GameState): LoanAdvice | null {
  if (state.user.retired) return null;
  const p = userPlayer(state);
  if (!p?.clubId || p.loan || ageOf(p, state.season) > LOAN_MAX_AGE) return null;
  const club = state.clubs[p.clubId];
  if (!club) return null;
  const C = BALANCE.calendar;
  let minutes = 0;
  for (const k in p.season) minutes += p.season[k].minutes;
  const possible = clubMinutesSoFar(state, p.clubId);
  const share = possible > 0 ? minutes / possible : 1;
  const mine = overallFor(p.attrs, p.position);
  const gap = clubLevel(club.reputation) - mine;
  const role = p.contract?.role;
  const reasons: string[] = [];
  const lowMinutes = state.turn >= C.seasonStart + 6 && possible >= 6 * 90 && share < LOW_SHARE;
  const eliteProspect = (role === "prospect" || role === "backup") && gap >= 5;
  const lastSeason = p.history[p.history.length - 1];
  const quietLastSeason = state.turn < C.seasonStart + 6 && state.season > state.user.startSeason && !!lastSeason && lastSeason.stats.minutes < 900;
  if (lowMinutes) reasons.push(`You've played ${minutes} of ${possible} possible minutes this season (${Math.round(share * 100)}%).`);
  if (quietLastSeason) reasons.push(`Last season you played only ${lastSeason.stats.minutes} minutes.`);
  if (eliteProspect) reasons.push(`${clubName(club.id)}'s first team plays around ${Math.round(clubLevel(club.reputation))}; you're ${Math.round(mine)}. Prospects at this level rarely get games.`);
  if (!reasons.length) return null;
  const windowOpen = isTransferWindow(state.turn);
  let weeksToWindow: number | null = windowOpen ? 0 : null;
  if (!windowOpen) {
    for (let t = state.turn + 1, n = 1; n <= C.turnsPerSeason; t++, n++) {
      const turn = ((t - 1) % C.turnsPerSeason) + 1;
      if (isTransferWindow(turn)) {
        weeksToWindow = n;
        break;
      }
    }
  }
  return {
    level: lowMinutes || quietLastSeason ? "urge" : "suggest",
    reasons,
    minutes,
    possible,
    share,
    windowOpen,
    weeksToWindow,
    destinations: loanDestinations(state),
  };
}

/** The player asks for a loan, optionally naming the club he'd like. */
export function requestLoan(state: GameState, clubId?: ClubId): string {
  const p = userPlayer(state);
  if (!p.clubId || p.loan) return "You can't go on loan right now.";
  if (ageOf(p, state.season) > LOAN_MAX_AGE) return `Only players aged ${LOAN_MAX_AGE} or under can go out on loan.`;
  state.user.wantsLoan = true;
  if (clubId && state.clubs[clubId] && loanDestinations(state, 50).some((d) => d.clubId === clubId)) state.user.loanTarget = clubId;
  else delete state.user.loanTarget;
  const when = isTransferWindow(state.turn) ? "this window" : upcomingWindow(state.turn) ? "the coming window" : "the next window";
  return state.user.loanTarget ? `Your agent will push for a loan to ${clubName(state.user.loanTarget)} in ${when}.` : `Your agent will look for a loan in ${when}.`;
}

export function cancelLoanRequest(state: GameState): void {
  state.user.wantsLoan = false;
  delete state.user.loanTarget;
}
