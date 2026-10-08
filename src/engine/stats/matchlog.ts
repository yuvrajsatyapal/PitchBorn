/**
 * The record of the user's senior matches. Charts, form, per-90 breakdowns and the dashboard's recent ratings all read
 * this one list, so they can never disagree. Only things a match actually produced are stored.
 */
import type { MatchResult } from "../match/engine";
import type { Competition, Fixture, GameState, MatchLogEntry, ReserveLogEntry } from "../types";

type Line = MatchResult["lines"][number];

/** About eight seasons of club and international games. */
export const MATCH_LOG_CAP = 320;
export const RESERVE_LOG_CAP = 80;

export function matchLogOf(state: GameState): MatchLogEntry[] {
  return (state.user.matchLog ??= []);
}

export function recordMatchLog(state: GameState, fixture: Fixture, comp: Competition, res: MatchResult, line: Line, team: string): void {
  const log = matchLogOf(state);
  if (log.some((e) => e.fixtureId === fixture.id)) return;
  const home = fixture.home === team;
  const mine = home ? res.homeGoals : res.awayGoals;
  const theirs = home ? res.awayGoals : res.homeGoals;
  const pens = res.penalties ? (home ? res.penalties : ([res.penalties[1], res.penalties[0]] as [number, number])) : undefined;
  const won = mine > theirs || (mine === theirs && !!pens && pens[0] > pens[1]);
  const lost = mine < theirs || (mine === theirs && !!pens && pens[0] < pens[1]);
  const minutes = Math.max(0, (line.minuteOff ?? 90) - line.minuteOn);
  const entry: MatchLogEntry = {
    season: state.season,
    turn: state.turn,
    fixtureId: fixture.id,
    compId: comp.id,
    compKind: comp.kind,
    team,
    opponent: home ? fixture.away : fixture.home,
    home,
    score: [mine, theirs],
    result: won ? "W" : lost ? "L" : "D",
    slot: line.slot,
    started: line.started,
    minutes,
    rating: line.rating,
    goals: line.goals,
    assists: line.assists,
    shots: line.shots,
    keyPasses: line.keyPasses,
    tackles: line.tackles,
    saves: line.saves,
    cleanSheet: line.conceded === 0 && minutes >= 60 && ["GK", "CB", "RB", "LB"].includes(line.slot),
  };
  if (pens) entry.pens = pens;
  if (fixture.stage) entry.stage = fixture.stage;
  log.push(entry);
  if (log.length > MATCH_LOG_CAP) log.splice(0, log.length - MATCH_LOG_CAP);
}

export function recordReserveLog(state: GameState, e: Omit<ReserveLogEntry, "season" | "turn">): void {
  const log = (state.user.reserveLog ??= []);
  log.push({ season: state.season, turn: state.turn, ...e });
  if (log.length > RESERVE_LOG_CAP) log.splice(0, log.length - RESERVE_LOG_CAP);
}

/** Old saves only kept a short list of ratings. Rebuild what it really recorded (no minutes, no scores). */
export function backfillMatchLog(state: GameState): void {
  const rec = state.user.recentRatings ?? [];
  if (state.user.matchLog?.length || !rec.length) {
    state.user.matchLog ??= [];
    return;
  }
  state.user.matchLog = rec.map((r, i): MatchLogEntry => ({
    season: r.season,
    turn: r.turn,
    fixtureId: `legacy-${i}`,
    compId: r.compId,
    compKind: /^intl|^world|^euro/.test(r.compId) ? "international" : /^ccup|^ecup/.test(r.compId) ? "continental" : /^cup/.test(r.compId) ? "cup" : "league",
    team: "",
    opponent: r.opponent,
    home: true,
    score: [0, 0],
    result: "D",
    slot: state.players[state.user.playerId]?.position ?? "CM",
    started: true,
    rating: r.rating,
    goals: r.goals,
    assists: r.assists,
  }));
}

/** True for entries rebuilt from an older save: they know a rating, not a score or minutes. */
export const isPartial = (e: MatchLogEntry) => e.fixtureId.startsWith("legacy-");
