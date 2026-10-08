/**
 * The user's standing in the squad, from the contract, the manager's selections and the squad itself. The label is the
 * contract's own SquadRole, so the Club page, the contract screen and negotiation always agree.
 */
import { BALANCE } from "../balance";
import { ROLE_LABEL, expectedRole } from "../career/offers";
import { overallFor } from "../players/attributes";
import { ageOf } from "../players/generate";
import type { GameState, SquadRole } from "../types";
import { squadOf, userPlayer } from "../world/helpers";

/** Share of the club's matches a player in each role is expected to start. */
export const START_EXPECTATION: Record<SquadRole, number> = { star: 0.85, first: 0.75, rotation: 0.45, backup: 0.2, prospect: 0.1 };
/** How far below the expectation counts as not meeting it. */
const TOLERANCE = 0.15;
/** Fewest club matches before the expectation is judged at all. */
const MIN_MATCHES = 6;

export interface SelectionDot {
  turn: number;
  status: "started" | "sub" | "unused";
  opponent: string;
}

export interface RoleView {
  role: SquadRole;
  label: string;
  /** The role the squad's own pecking order suggests, which may differ from the one signed. */
  suggested: SquadRole;
  expectedShare: number;
  actualShare: number | null;
  matches: number;
  meeting: boolean | null;
  trend: SelectionDot[];
  pathway: string;
}

/** Club matches (league and cup) this season since the user joined, with how the user figured in each. */
export function selectionTrend(state: GameState, n = 5): SelectionDot[] {
  const u = userPlayer(state);
  if (!u.clubId) return [];
  const joined = [...state.user.transfers].reverse().find((t) => t.season === state.season && t.to === u.clubId)?.turn ?? 0;
  const mine = Object.values(state.competitions)
    .filter((c) => c.season === state.season && (c.kind === "league" || c.kind === "cup" || c.kind === "continental"))
    .flatMap((c) => c.fixtures.filter((f) => f.result && (f.home === u.clubId || f.away === u.clubId) && f.turn >= joined))
    .sort((a, b) => a.turn - b.turn || a.round - b.round)
    .slice(-n);
  const log = new Map((state.user.matchLog ?? []).map((e) => [e.fixtureId, e]));
  return mine.map((f) => {
    const e = log.get(f.id);
    return { turn: f.turn, status: e ? (e.started ? "started" : "sub") : "unused", opponent: f.home === u.clubId ? f.away : f.home };
  });
}

export function roleView(state: GameState): RoleView | null {
  const u = userPlayer(state);
  const club = u.clubId ? state.clubs[u.clubId] : null;
  if (!club || !u.contract) return null;
  const role = u.contract.role;
  const suggested = expectedRole(state, club, u);
  const joined = [...state.user.transfers].reverse().find((t) => t.season === state.season && t.to === club.id)?.turn ?? 0;
  const clubGames = Object.values(state.competitions)
    .filter((c) => c.season === state.season && (c.kind === "league" || c.kind === "cup" || c.kind === "continental"))
    .flatMap((c) => c.fixtures.filter((f) => f.result && (f.home === club.id || f.away === club.id) && f.turn >= joined)).length;
  let starts = 0;
  for (const e of state.user.matchLog ?? []) if (e.season === state.season && e.started && e.team === club.id) starts++;
  const matches = clubGames;
  const actualShare = matches >= MIN_MATCHES ? starts / matches : null;
  const expectedShare = START_EXPECTATION[role];
  const meeting = actualShare === null ? null : actualShare >= expectedShare - TOLERANCE;
  const squad = squadOf(state, club.id).filter((p) => !p.isUser && (p.position === u.position || p.secondary.includes(u.position)));
  const mine = overallFor(u.attrs, u.position);
  const best = [...squad].sort((a, b) => overallFor(b.attrs, u.position) - overallFor(a.attrs, u.position))[0];
  const gap = best ? Math.round(overallFor(best.attrs, u.position) - mine) : 0;
  const age = ageOf(u, state.season);
  const pathway =
    role === "star" || role === "first"
      ? "You're a first-choice option: keep your level and the role holds."
      : best && gap > 0
        ? `${best.lastName} is ${gap} point${gap === 1 ? "" : "s"} ahead of you at ${u.position}; close the gap to move up.`
        : age <= 21
          ? "Your overall is already ahead of the competition: playing time should follow."
          : "You lead the squad at your position: a stronger role is within reach at the next contract.";
  return { role, label: ROLE_LABEL[role], suggested, expectedShare, actualShare, matches, meeting, trend: selectionTrend(state), pathway };
}

/**
 * The contract promised a starting role and the manager is not honouring it. Feeds the manager relationship and the
 * transfer-saga score, so a broken promise has the consequences a player would expect.
 */
export function rolePromiseBroken(state: GameState): boolean {
  const u = userPlayer(state);
  if (!u.contract || u.loan || u.injury || (u.contract.role !== "star" && u.contract.role !== "first")) return false;
  if (state.turn < BALANCE.calendar.seasonStart + 8 || state.turn > BALANCE.calendar.seasonEnd) return false;
  const v = roleView(state);
  return !!v && v.meeting === false && v.matches >= 8;
}
