/**
 * Derived career statistics. Everything here is computed from the match log, the season lines and the archives that
 * already exist; nothing is stored, nothing is invented. Where a number needs a minimum sample to mean anything, the
 * threshold is a named constant and the result says when it is not met.
 */
import { BALANCE } from "../balance";
import { leagueCompId } from "../competitions/setup";
import { positionGroup } from "../players/attributes";
import { addStat, avgRating, emptyStat } from "../players/generate";
import type { GameState, MatchLogEntry, Player, StatLine } from "../types";
import { userPlayer } from "../world/helpers";
import { isPartial } from "./matchlog";

// ---------------------------------------------------------------------------------------------------------------
// Rates

/** `value` per 90 minutes. Zero minutes is zero, never NaN or infinity. */
export function per90(value: number, minutes: number): number {
  return minutes > 0 ? (value / minutes) * 90 : 0;
}

/** Fewest minutes before a per-90 figure is shown as a rate for a season line (a quarter of a regular's season). */
export const PER90_MIN_MINUTES = 450;
/** Fewest minutes for a player to count in a ranking or comparison table. */
export const RANK_MIN_MINUTES = 270;
/** A season average rating or scoring rate counts as a personal best only from this many minutes. */
export const BEST_MIN_MINUTES = 900;
/** Fewest rated games before a form trend is claimed. */
export const TREND_MIN_GAMES = 6;

export interface Per90Row {
  key: string;
  label: string;
  value: number;
  /** Raw total, for the tooltip. */
  total: number;
}

/** The per-90 metrics that make sense for a position group. Goalkeepers are judged on what they stop. */
export function per90Rows(s: StatLine, group: ReturnType<typeof positionGroup>): Per90Row[] {
  const m = s.minutes;
  if (group === "GK") {
    return [
      { key: "saves", label: "Saves / 90", value: per90(s.saves, m), total: s.saves },
      { key: "conceded", label: "Conceded / 90", value: per90(s.conceded, m), total: s.conceded },
      { key: "cs", label: "Clean sheets / 90", value: per90(s.cleanSheets, m), total: s.cleanSheets },
    ];
  }
  const rows: Per90Row[] = [
    { key: "goals", label: "Goals / 90", value: per90(s.goals, m), total: s.goals },
    { key: "assists", label: "Assists / 90", value: per90(s.assists, m), total: s.assists },
    { key: "shots", label: "Shots / 90", value: per90(s.shots, m), total: s.shots },
    { key: "key", label: "Key passes / 90", value: per90(s.keyPasses, m), total: s.keyPasses },
    { key: "tackles", label: "Tackles / 90", value: per90(s.tackles, m), total: s.tackles },
  ];
  if (group === "DEF") rows.push({ key: "cs", label: "Clean sheets / 90", value: per90(s.cleanSheets, m), total: s.cleanSheets });
  return rows;
}

export interface StartSplit {
  apps: number;
  starts: number;
  subs: number;
  startPct: number;
  minPerApp: number;
}

export function startSplit(s: StatLine): StartSplit {
  const subs = Math.max(0, s.apps - s.starts);
  return { apps: s.apps, starts: s.starts, subs, startPct: s.apps ? s.starts / s.apps : 0, minPerApp: s.apps ? s.minutes / s.apps : 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// Ratings

export type RatingBand = "poor" | "average" | "good" | "excellent";
export const RATING_SCALE: [number, number] = [4, 10];

export function ratingBand(r: number): RatingBand {
  return r >= 8 ? "excellent" : r >= 7 ? "good" : r >= 6 ? "average" : "poor";
}

/** Senior matches with a rating, oldest first. */
export function ratedMatches(state: GameState, n?: number): MatchLogEntry[] {
  const list = (state.user.matchLog ?? []).filter((e) => Number.isFinite(e.rating) && e.rating > 0);
  return n ? list.slice(-n) : list;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export type FormTrend = "improving" | "stable" | "declining" | "unknown";

/** Last three ratings against the three before: a change of 0.4 either way is a trend. Needs six rated games. */
export function formTrend(ratings: number[]): FormTrend {
  if (ratings.length < TREND_MIN_GAMES) return "unknown";
  const recent = mean(ratings.slice(-3));
  const before = mean(ratings.slice(-6, -3));
  const d = recent - before;
  return d >= 0.4 ? "improving" : d <= -0.4 ? "declining" : "stable";
}

export interface RecentForm {
  entries: MatchLogEntry[];
  average: number;
  trend: FormTrend;
  /** Fewer rated games than were asked for. */
  short: boolean;
}

export function recentForm(state: GameState, n: number): RecentForm {
  const all = ratedMatches(state);
  const entries = all.slice(-n);
  return { entries, average: mean(entries.map((e) => e.rating)), trend: formTrend(all.map((e) => e.rating)), short: entries.length < n };
}

export interface ReserveForm {
  entries: { season: number; turn: number; rating: number; goals: number; assists: number }[];
  average: number;
}

export function reserveForm(state: GameState, n: number): ReserveForm {
  const entries = (state.user.reserveLog ?? []).slice(-n);
  return { entries, average: mean(entries.map((e) => e.rating)) };
}

// ---------------------------------------------------------------------------------------------------------------
// Breakdowns from the match log

export interface SplitRow {
  key: string;
  label: string;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  avg: number;
}

function splitBy(log: MatchLogEntry[], keyOf: (e: MatchLogEntry) => [string, string]): SplitRow[] {
  const rows = new Map<string, SplitRow & { sum: number }>();
  for (const e of log) {
    if (isPartial(e)) continue; // rebuilt entries have no score, venue or minutes
    const [key, label] = keyOf(e);
    const r = rows.get(key) ?? { key, label, apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, avg: 0, sum: 0 };
    r.apps++;
    r.starts += e.started ? 1 : 0;
    r.minutes += e.minutes ?? 0;
    r.goals += e.goals;
    r.assists += e.assists;
    r.sum += e.rating;
    rows.set(key, r);
  }
  return [...rows.values()].map(({ sum, ...r }) => ({ ...r, avg: r.apps ? sum / r.apps : 0 }));
}

export const homeAway = (log: MatchLogEntry[]) => splitBy(log, (e) => (e.home ? ["home", "Home"] : ["away", "Away"]));
export const byRole = (log: MatchLogEntry[]) => splitBy(log, (e) => (e.started ? ["start", "Starts"] : ["sub", "Substitute appearances"]));
export const byPositionPlayed = (log: MatchLogEntry[]) => splitBy(log, (e) => [e.slot, e.slot]);
export const byCompetitionKind = (log: MatchLogEntry[]) =>
  splitBy(log, (e) => [e.compKind, { league: "League", cup: "Domestic cup", continental: "Continental", international: "International", friendly: "Friendlies" }[e.compKind]]);

/** Senior matches in a window of the log: a season (or all of them). */
export function logForSeason(state: GameState, season: number | "all"): MatchLogEntry[] {
  const log = state.user.matchLog ?? [];
  return season === "all" ? log : log.filter((e) => e.season === season);
}

// ---------------------------------------------------------------------------------------------------------------
// Seasons and records

export interface SeasonLine {
  season: number;
  clubId: string | null;
  age: number;
  stats: StatLine;
  /** The season in progress (not yet in the archive). */
  current?: boolean;
}

/** Every season the player has a line for, oldest first, with the current one last when it has started. */
export function seasonLines(state: GameState): SeasonLine[] {
  const p = userPlayer(state);
  const out: SeasonLine[] = p.history.map((h) => ({ season: h.season, clubId: h.clubId, age: h.age, stats: h.stats }));
  const cur = emptyStat();
  for (const k in p.season) addStat(cur, p.season[k]);
  if (cur.apps > 0 && !out.some((l) => l.season === state.season)) out.push({ season: state.season, clubId: p.clubId, age: state.season - p.birthYear, stats: cur, current: true });
  return out;
}

export type BestId = "goals" | "assists" | "apps" | "minutes" | "rating" | "cleanSheets" | "goalRate";

export interface PersonalBest {
  id: BestId;
  label: string;
  value: number;
  display: string;
  season: number;
  current: boolean;
  /** For qualified records, how the sample qualifies. */
  note?: string;
}

/** Personal records across completed and current seasons. Rate records need a real sample. */
export function personalBests(state: GameState): PersonalBest[] {
  const lines = seasonLines(state);
  const gk = userPlayer(state).position === "GK";
  const out: PersonalBest[] = [];
  const best = (id: BestId, label: string, pick: (s: StatLine) => number, fmt: (v: number) => string, qualify?: (s: StatLine) => boolean, note?: string) => {
    let top: SeasonLine | null = null;
    let value = 0;
    for (const l of lines) {
      if (qualify && !qualify(l.stats)) continue;
      const v = pick(l.stats);
      if (v > value) {
        value = v;
        top = l;
      }
    }
    if (top && value > 0) out.push({ id, label, value, display: fmt(value), season: top.season, current: !!top.current, note });
  };
  if (!gk) {
    best("goals", "Most goals in a season", (s) => s.goals, String);
    best("assists", "Most assists in a season", (s) => s.assists, String);
  }
  best("apps", "Most appearances in a season", (s) => s.apps, String);
  best("minutes", "Most minutes in a season", (s) => s.minutes, (v) => v.toLocaleString());
  best("rating", "Best average rating", avgRating, (v) => v.toFixed(2), (s) => s.minutes >= BEST_MIN_MINUTES, `Min. ${BEST_MIN_MINUTES} minutes`);
  if (gk || positionGroup(userPlayer(state).position) === "DEF") best("cleanSheets", "Most clean sheets in a season", (s) => s.cleanSheets, String);
  if (!gk) best("goalRate", "Best scoring rate", (s) => per90(s.goals, s.minutes), (v) => `${v.toFixed(2)} / 90`, (s) => s.minutes >= BEST_MIN_MINUTES, `Min. ${BEST_MIN_MINUTES} minutes`);
  return out;
}

export interface Milestone {
  id: string;
  label: string;
  /** Reached: the career date it was reached, from the timeline. */
  reached: boolean;
  /** Not reached yet: how far off. */
  progress?: { have: number; need: number };
  when?: { season: number; turn: number };
}

const APP_STEPS = [50, 100, 200, 300];
const GOAL_STEPS = [10, 50, 100, 150, 200];
const CAP_STEPS = [10, 25, 50, 100];

/** Milestones the engine already records on the timeline, plus the next one of each kind. */
export function milestones(state: GameState): Milestone[] {
  const p = userPlayer(state);
  const tl = state.user.timeline;
  const find = (pred: (t: (typeof tl)[number]) => boolean) => tl.find(pred);
  const out: Milestone[] = [];
  const add = (id: string, label: string, ev: (typeof tl)[number] | undefined) => out.push({ id, label, reached: !!ev, when: ev ? { season: ev.season, turn: ev.turn } : undefined });
  add("debut", "Professional debut", find((t) => t.kind === "debut"));
  add("first-goal", "First senior goal", find((t) => t.kind === "first-goal"));
  add("intl-debut", "International debut", find((t) => t.kind === "international" && /debut/i.test(t.title)));
  add("intl-goal", "First international goal", find((t) => t.kind === "international" && /first international goal/i.test(t.title)));
  const next = (steps: number[], have: number, label: (n: number) => string, idPrefix: string, evTitle: (n: number) => RegExp) => {
    for (const n of steps) {
      const ev = find((t) => evTitle(n).test(t.title));
      if (have >= n) out.push({ id: `${idPrefix}-${n}`, label: label(n), reached: true, when: ev ? { season: ev.season, turn: ev.turn } : undefined });
    }
    const upcoming = steps.find((n) => n > have);
    if (upcoming) out.push({ id: `${idPrefix}-${upcoming}`, label: label(upcoming), reached: false, progress: { have, need: upcoming } });
  };
  next(APP_STEPS, p.career.apps, (n) => `${n} career appearances`, "apps", (n) => new RegExp(`^${n} career appearances`));
  if (p.position !== "GK") next(GOAL_STEPS, p.career.goals, (n) => `${n} career goals`, "goals", (n) => new RegExp(`^${n} career goals`));
  next(CAP_STEPS, p.intl.caps, (n) => `${n} international caps`, "caps", (n) => new RegExp(`${n} international caps`));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// League rankings and comparisons

/** Minutes a player needs to count in this season's rankings: 40% of a regular's minutes so far, within sane bounds. */
export function rankMinutes(state: GameState): number {
  const p = userPlayer(state);
  const lid = p.clubId ? state.clubs[p.clubId]?.leagueId : undefined;
  const comp = lid ? state.competitions[leagueCompId(lid, state.season)] : undefined;
  const played = comp?.table?.find((r) => r.team === p.clubId)?.played ?? 0;
  return Math.max(RANK_MIN_MINUTES, Math.min(BEST_MIN_MINUTES, Math.round(played * 90 * 0.4)));
}

function leagueLine(p: Player, compId: string): StatLine {
  return p.season[compId] ?? emptyStat();
}

export interface RankRow {
  id: "goals" | "assists" | "rating" | "positional" | "cleanSheets";
  label: string;
  rank: number | null;
  of: number;
  value: string;
  /** Why there is no rank, if there isn't. */
  reason?: string;
}

/**
 * Where the user stands among players of their league this season. Counting stats rank everyone; rate stats rank only
 * players with enough minutes, and say so when the user has not reached the bar.
 */
export function leagueRankings(state: GameState): RankRow[] {
  const u = userPlayer(state);
  const lid = u.clubId ? state.clubs[u.clubId]?.leagueId : undefined;
  if (!lid) return [];
  const compId = leagueCompId(lid, state.season);
  const clubs = state.leagueClubs[lid] ?? [];
  const minMin = rankMinutes(state);
  const players: Player[] = [];
  for (const c of clubs) for (const id of state.clubs[c]?.squad ?? []) {
    const p = state.players[id];
    if (p && !p.retired) players.push(p);
  }
  const mine = leagueLine(u, compId);
  const rows: RankRow[] = [];
  const rankOf = (value: number, list: number[]) => 1 + list.filter((v) => v > value).length;
  const counting = (id: RankRow["id"], label: string, pick: (s: StatLine) => number, pool: Player[]) => {
    const vals = pool.map((p) => pick(leagueLine(p, compId))).filter((v) => v > 0);
    const v = pick(mine);
    rows.push(v > 0 ? { id, label, rank: rankOf(v, vals), of: Math.max(vals.length, 1), value: String(v) } : { id, label, rank: null, of: vals.length, value: "0", reason: "None yet" });
  };
  if (u.position !== "GK") {
    counting("goals", "League goals", (s) => s.goals, players);
    counting("assists", "League assists", (s) => s.assists, players);
  }
  const group = positionGroup(u.position);
  const qualified = (p: Player) => leagueLine(p, compId).minutes >= minMin;
  const rate = (id: RankRow["id"], label: string, pool: Player[]) => {
    const vals = pool.filter(qualified).map((p) => avgRating(leagueLine(p, compId)));
    if (mine.minutes < minMin || !mine.apps) {
      rows.push({ id, label, rank: null, of: vals.length, value: mine.apps ? avgRating(mine).toFixed(2) : "–", reason: `Needs ${minMin} minutes (you have ${mine.minutes})` });
    } else rows.push({ id, label, rank: rankOf(avgRating(mine), vals), of: vals.length, value: avgRating(mine).toFixed(2) });
  };
  rate("rating", "Average rating", players);
  rate("positional", group === "GK" ? "Rating among keepers" : `Rating among ${group === "DEF" ? "defenders" : group === "MID" ? "midfielders" : "forwards"}`, players.filter((p) => positionGroup(p.position) === group));
  if (u.position === "GK") counting("cleanSheets", "Clean sheets", (s) => s.cleanSheets, players.filter((p) => p.position === "GK"));
  return rows;
}

export type CompareWho = "rival" | "teammate" | "league" | "similar";

export interface Comparable {
  id: string;
  who: CompareWho;
  name: string;
  clubId: string | null;
  position: string;
  note: string;
}

/** Players who can be set against the user on equal terms: the same kind of player, with enough minutes to mean something. */
export function comparables(state: GameState): Comparable[] {
  const u = userPlayer(state);
  const lid = u.clubId ? state.clubs[u.clubId]?.leagueId : undefined;
  const compId = lid ? leagueCompId(lid, state.season) : "";
  const minMin = rankMinutes(state);
  const gk = u.position === "GK";
  const same = (p: Player) => (gk ? p.position === "GK" : p.position !== "GK") && p.id !== u.id && !p.retired;
  const ok = (p: Player) => same(p) && leagueLine(p, compId).minutes >= minMin;
  const out: Comparable[] = [];
  const seen = new Set<string>();
  const push = (p: Player, who: CompareWho, note: string) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    out.push({ id: p.id, who, name: `${p.firstName} ${p.lastName}`, clubId: p.clubId, position: p.position, note });
  };
  for (const rv of state.user.rivalry?.rivals ?? []) {
    const p = state.players[rv.playerId];
    if (p && rv.status !== "ended" && ok(p)) push(p, "rival", "Career rival");
  }
  const mates = (u.clubId ? state.clubs[u.clubId]?.squad ?? [] : []).map((id) => state.players[id]).filter((p): p is Player => !!p && ok(p));
  mates.filter((p) => positionGroup(p.position) === positionGroup(u.position)).sort((a, b) => leagueLine(b, compId).minutes - leagueLine(a, compId).minutes).slice(0, 3).forEach((p) => push(p, "teammate", "Teammate"));
  const pool: Player[] = [];
  for (const c of lid ? state.leagueClubs[lid] ?? [] : []) for (const id of state.clubs[c]?.squad ?? []) {
    const p = state.players[id];
    if (p && ok(p)) pool.push(p);
  }
  pool.filter((p) => p.position === u.position).sort((a, b) => avgRating(leagueLine(b, compId)) - avgRating(leagueLine(a, compId))).slice(0, 4).forEach((p) => push(p, "similar", `Top ${u.position} in the league`));
  pool.sort((a, b) => avgRating(leagueLine(b, compId)) - avgRating(leagueLine(a, compId))).slice(0, 3).forEach((p) => push(p, "league", "Top-rated in the league"));
  return out.slice(0, 12);
}

export interface CompareRow {
  label: string;
  mine: string;
  theirs: string;
  /** Which side is ahead, if either (per-90 and rating rows only, where more is better; "conceded" inverts). */
  lead?: "mine" | "theirs";
}

/** This season's league line for each, side by side. Goalkeepers are only ever set against goalkeepers. */
export function compareWith(state: GameState, otherId: string): { rows: CompareRow[]; reason?: string } | null {
  const u = userPlayer(state);
  const o = state.players[otherId];
  if (!o) return null;
  if ((u.position === "GK") !== (o.position === "GK")) return { rows: [], reason: "A goalkeeper can't be fairly compared with an outfield player." };
  const lid = u.clubId ? state.clubs[u.clubId]?.leagueId : undefined;
  const compId = lid ? leagueCompId(lid, state.season) : "";
  const a = leagueLine(u, compId);
  const b = leagueLine(o, compId);
  const minMin = rankMinutes(state);
  if (b.minutes < minMin || a.minutes < minMin) return { rows: [], reason: `Both players need ${minMin} league minutes this season.` };
  const group = positionGroup(u.position);
  const rowsA = per90Rows(a, group);
  const rowsB = per90Rows(b, group);
  const lead = (x: number, y: number, lowerBetter = false): CompareRow["lead"] => (Math.abs(x - y) < 0.005 ? undefined : (x > y) !== lowerBetter ? "mine" : "theirs");
  const rows: CompareRow[] = [
    { label: "Appearances", mine: String(a.apps), theirs: String(b.apps) },
    { label: "Minutes", mine: String(a.minutes), theirs: String(b.minutes) },
    { label: "Average rating", mine: avgRating(a).toFixed(2), theirs: avgRating(b).toFixed(2), lead: lead(avgRating(a), avgRating(b)) },
    ...rowsA.map((r, i) => ({ label: r.label, mine: r.value.toFixed(2), theirs: rowsB[i].value.toFixed(2), lead: lead(r.value, rowsB[i].value, r.key === "conceded") })),
  ];
  return { rows };
}

// ---------------------------------------------------------------------------------------------------------------
// Earnings

export const SEASON_WEEKS = BALANCE.calendar.turnsPerSeason;
