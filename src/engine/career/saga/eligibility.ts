import { sagaDeadlineTurn, upcomingWindow, windowName } from "../../calendar";
import { overallFor } from "../../players/attributes";
import { marketValue } from "../../players/economy";
import { ageOf } from "../../players/generate";
import { rivalryLevel } from "../../memory/rivalry";
import { movePressure, tenure } from "../../traits/career";
import { careerProfile } from "../../traits/effects";
import type { ClubId, ClubState, GameState, TransferSaga } from "../../types";
import { userPlayer } from "../../world/helpers";
import { agentSkill } from "../agents";

/** A saga needs at least this much importance before it can happen at all. Ordinary players never reach it. */
export const SAGA_MIN_SCORE = 42;
/** Turns between the starts of two sagas. */
export const SAGA_GAP = 16;
/** Turns before the same club can start another saga, unless circumstances have materially changed (about two seasons). */
export const CLUB_COOLDOWN = 100;
/** Players below this reputation never have a saga brewing before a window, so the weeks before it cost them nothing. */
export const RUMOUR_MIN_REPUTATION = 55;
/** Fewest weeks a window must have left for a saga to begin in it. */
export const MIN_RUNWAY = 2;

export interface SagaAssessment {
  score: number;
  /** Probability that this candidate offer becomes a saga (0 when blocked). */
  chance: number;
  reasons: string[];
  blocked?: string;
  window: TransferSaga["window"];
  deadlineTurn: number;
}

export const isActiveSaga = (s: TransferSaga) => s.stage !== "completed" && s.stage !== "failed";
export const activeSaga = (state: GameState): TransferSaga | undefined => state.user.sagas.find(isActiveSaga);

/** Has the situation changed enough since an earlier saga with this club to justify another? */
export function materiallyChanged(state: GameState, prior: TransferSaga): boolean {
  const p = userPlayer(state);
  const yearsLeft = p.contract ? p.contract.expires - state.season : -1;
  return (
    p.reputation >= prior.snapshot.reputation + 8 ||
    marketValue(p, state.season) >= prior.snapshot.value * 1.5 ||
    (state.user.transferRequest && !prior.snapshot.requested) ||
    (yearsLeft <= 0 && prior.snapshot.yearsLeft > 0) ||
    p.clubId !== prior.fromClubId
  );
}

function blockedReason(state: GameState, clubId: ClubId, window: SagaAssessment["window"]): string | undefined {
  const sagas = state.user.sagas;
  if (sagas.some(isActiveSaga)) return "a saga is already running";
  const last = sagas.reduce((m, s) => Math.max(m, s.startIndex), -Infinity);
  if (state.turnIndex - last < SAGA_GAP) return "too soon after the last saga";
  if (window !== "free" && sagas.some((s) => s.window === window && s.startSeason === state.season && Math.abs(s.startIndex - state.turnIndex) < 12)) return "this window already had a saga";
  const prior = sagas.filter((s) => (s.clubId === clubId || s.rivals.includes(clubId)) && state.turnIndex - s.startIndex < CLUB_COOLDOWN).sort((a, b) => b.startIndex - a.startIndex)[0];
  if (prior && !materiallyChanged(state, prior)) return "same club, same circumstances";
  return undefined;
}

/**
 * How important a prospective move is, and how likely it is to play out as a saga. Context decides, not a quota:
 * standing, the buyer, rivalry, history with the club, unrest, the contract, money and the clock all add or subtract.
 */
export function assessSaga(state: GameState, club: ClubState, kind: "transfer" | "free", fee: number): SagaAssessment {
  const p = userPlayer(state);
  const free = !p.clubId;
  const wn = windowName(state.turn) ?? upcomingWindow(state.turn);
  const window: SagaAssessment["window"] = free ? "free" : wn ?? "free";
  const deadlineTurn = sagaDeadlineTurn(state.turn, free);
  const base = { window, deadlineTurn };
  if (state.user.retired || p.retired) return { score: 0, chance: 0, reasons: [], blocked: "retired", ...base };
  if (p.loan) return { score: 0, chance: 0, reasons: [], blocked: "on loan", ...base };
  if (!free && !wn) return { score: 0, chance: 0, reasons: [], blocked: "window closed", ...base };
  if (deadlineTurn - state.turn < MIN_RUNWAY) return { score: 0, chance: 0, reasons: [], blocked: "too late in the window", ...base };

  const reasons: string[] = [];
  let score = 0;
  const add = (label: string, pts: number) => {
    if (pts > 0.4 || pts < -0.4) {
      score += pts;
      if (pts > 0) reasons.push(label);
    }
  };
  const age = ageOf(p, state.season);
  const value = marketValue(p, state.season);
  const cp = careerProfile(p);
  const rel = state.user.relationships;
  const from = p.clubId ? state.clubs[p.clubId] : null;
  const current = from?.reputation ?? 0;
  const ovr = overallFor(p.attrs, p.position);

  add("A genuine star", Math.min(25, Math.max(0, (p.reputation - 45) * 0.45)));
  add("High market value", Math.min(14, Math.log10(value / 1e6 + 1) * 10));
  add("Young prospect", age <= 21 && p.hidden.potential > ovr + 8 ? 6 : 0);
  add("In form", Math.max(-5, Math.min(5, (p.form - 6.6) * 3)));
  add("Veteran", age >= 31 ? -4 : 0);
  add("A major club", club.reputation >= 75 ? 8 + (club.reputation - 75) * 0.4 : 0);

  const rivalry = from ? rivalryLevel(state, from.id, club.id) : 0;
  add("A rival of your club", rivalry >= 0.4 ? 10 + rivalry * 12 : 0);
  const pastClubs = new Set(p.history.filter((h) => h.clubId && h.stats.apps > 0).map((h) => h.clubId as string));
  add("A former club", pastClubs.has(club.id) && club.id !== p.clubId ? 12 : 0);
  const unfinished = state.user.offers.some((o) => o.fromClubId === club.id && state.season - o.season <= 3 && (o.status === "rejected" || o.status === "club-rejected" || o.status === "withdrawn"));
  add("Unfinished business", unfinished ? 6 : 0);

  const yearsLeft = p.contract ? p.contract.expires - state.season : -1;
  add("Contract running down", p.contract && yearsLeft <= 0 ? 6 : 0);
  add("Asked to leave", state.user.transferRequest ? 8 : 0);
  add("Unrest at the club", free ? 0 : p.morale < 45 || rel.manager < 35 ? 7 : 0);
  add("Pulled between loyalty and ambition", !free && ((tenure(p) >= 5 && rel.supporters >= 70) || cp.loyalty >= 0.35 || (cp.ambition >= 0.4 && club.reputation > current + 12)) ? 7 : 0);
  add("Crisis at the club", from && movePressure(state, p).crisis ? 4 : 0);
  add("A club in financial trouble", from && from.balance < 0 ? 5 : 0);
  add("Buyer can't afford it", fee > 0 && club.balance < fee * 0.4 ? -8 : 0);
  add("Other clubs are circling", state.user.offers.some((o) => (o.status === "terms" || o.status === "club-pending") && o.fromClubId !== club.id) ? 5 : 0);
  add("Deadline pressure", deadlineTurn - state.turn <= 3 && !free ? 4 : 0);
  add("Well-connected agent", (agentSkill(state, "connections") / 100) * 3);
  add("Big step up", club.reputation - current >= 12 ? 3 : 0);

  const blocked = blockedReason(state, club.id, window);
  const chance = blocked || score < SAGA_MIN_SCORE ? 0 : Math.min(0.5, (score - SAGA_MIN_SCORE) / 45) * 0.7 + 0.08;
  return { score: Math.round(score * 10) / 10, chance, reasons, blocked, ...base };
}
