/**
 * Season award calculation: a pure function of the finished league season.
 *
 * Statistical awards are decided by the statistic (ties settled by stated rules). The judged awards (Player of the
 * Season, Young Player, Goalkeeper, Breakthrough) use a transparent performance index that is normalised within each
 * position group, so a striker's goals are measured against strikers, a keeper's saves against keepers. Nothing here
 * reads traits or reputation: what happened on the pitch decides.
 */
import { leagueCompId } from "../competitions/setup";
import { positionGroup } from "../players/attributes";
import { ageOf } from "../players/generate";
import { keeperMetrics } from "../players/keeper";
import type { AwardNominee, AwardResult, GameState, Player, Position, PositionGroup, StatLine, TeamOfSeasonSlot } from "../types";
import { squadOf } from "../world/helpers";

/** All the thresholds in one place, so none are scattered through the code. */
export const AWARD_RULES = {
  /** Share of the league's games a player must have played to be eligible for the judged awards. */
  minGameShare: 0.4,
  minAppsFloor: 8,
  /** Young Player of the Season: eligible while at most this age (the game's age is the season's start age). */
  youngMaxAge: 21,
  /** Young and Breakthrough candidates need this share of the games, a little less than the senior bar. */
  youngGameShare: 0.3,
  breakthroughMaxAge: 23,
  /** A breakthrough needs a small previous role: at most this many league appearances the season before. */
  breakthroughPrevAppsMax: 12,
  nominees: 4,
} as const;

const empty = (): StatLine => ({ apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, conceded: 0, yellow: 0, red: 0, ratingSum: 0, motm: 0, shots: 0, shotsOnTarget: 0, keyPasses: 0, tackles: 0, saves: 0 });

interface Row {
  p: Player;
  s: StatLine;
  group: PositionGroup;
  avg: number;
  min90: number;
  /** League position of the player's club (1 = champions). */
  clubPos: number;
  age: number;
  contribution: number;
  /** Rating in cups and continental games, when there were enough of them. */
  bigAvg: number | null;
}

interface Stats {
  mean: number;
  sd: number;
}

function stats(values: number[], floor: number): Stats {
  if (!values.length) return { mean: 0, sd: floor };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return { mean, sd: Math.max(sd, floor) };
}

const z = (v: number, st: Stats) => (v - st.mean) / st.sd;

/** What a player contributed, measured in the terms of his role. Per 90 minutes, so availability is judged separately. */
function contributionOf(group: PositionGroup, s: StatLine, min90: number): number {
  const m = keeperMetrics(s);
  switch (group) {
    case "GK":
      return m.cleanSheetRate * 3 + m.savePct * 6 - m.concededPer90 * 2;
    case "DEF":
      return (s.goals * 1.3 + s.assists * 0.9) / min90 + m.cleanSheetRate * 1.2 + (s.tackles / min90) * 0.12;
    case "MID":
      return (s.goals * 1.1 + s.assists * 0.9) / min90 + (s.keyPasses / min90) * 0.12 + (s.tackles / min90) * 0.04;
    default:
      return (s.goals + s.assists * 0.65) / min90;
  }
}

export interface LeagueSeason {
  leagueId: string;
  leagueName: string;
  compId: string;
  games: number;
  rows: Row[];
  maxMinutes: number;
  /** Rows meeting the senior participation bar. */
  qualified: Row[];
  baseline: Record<PositionGroup, { rating: Stats; contribution: Stats; n: number }>;
}

function bigAverage(p: Player, state: GameState, leagueCompId_: string): number | null {
  let sum = 0;
  let apps = 0;
  for (const k in p.season) {
    if (k === leagueCompId_) continue;
    const comp = state.competitions[k];
    if (!comp || (comp.kind !== "cup" && comp.kind !== "continental")) continue;
    sum += p.season[k].ratingSum;
    apps += p.season[k].apps;
  }
  return apps >= 2 ? sum / apps : null;
}

/** Everything the awards need from one league's finished season, gathered once. */
export function leagueSeason(state: GameState, leagueId: string, leagueName: string): LeagueSeason | null {
  const compId = leagueCompId(leagueId, state.season);
  const comp = state.competitions[compId];
  if (!comp?.table) return null;
  const clubIds = state.leagueClubs[leagueId] ?? [];
  const games = Math.max(...comp.table.map((r) => r.played), 0);
  const posOf = new Map(comp.table.map((r, i) => [r.team, i + 1]));
  const rows: Row[] = [];
  for (const clubId of clubIds) {
    for (const p of squadOf(state, clubId)) {
      const s = p.season[compId] ?? empty();
      if (s.apps < 1) continue;
      const min90 = Math.max(1, s.minutes / 90);
      const group = positionGroup(p.position);
      rows.push({ p, s, group, avg: s.ratingSum / s.apps, min90, clubPos: posOf.get(clubId) ?? comp.table.length, age: ageOf(p, state.season), contribution: contributionOf(group, s, min90), bigAvg: bigAverage(p, state, compId) });
    }
  }
  const minApps = Math.max(AWARD_RULES.minAppsFloor, Math.round(games * AWARD_RULES.minGameShare));
  const qualified = rows.filter((r) => r.s.apps >= minApps);
  const baseline = {} as LeagueSeason["baseline"];
  for (const g of ["GK", "DEF", "MID", "ATT"] as PositionGroup[]) {
    const inGroup = qualified.filter((r) => r.group === g);
    baseline[g] = { rating: stats(inGroup.map((r) => r.avg), 0.15), contribution: stats(inGroup.map((r) => r.contribution), g === "GK" ? 0.3 : 0.05), n: inGroup.length };
  }
  return { leagueId, leagueName, compId, games, rows, maxMinutes: Math.max(1, ...rows.map((r) => r.s.minutes)), qualified, baseline };
}

/** The performance index behind the judged awards: role-relative rating and contribution, availability, and the team's season. */
function index(ls: LeagueSeason, r: Row, tableSize: number): number {
  const b = ls.baseline[r.group];
  // A group with too few qualified players can't define "good for the role"; it just doesn't gain or lose from it.
  const zr = b.n >= 4 ? z(r.avg, b.rating) : 0;
  const zc = b.n >= 4 ? z(r.contribution, b.contribution) : 0;
  const avail = Math.min(1, r.s.minutes / (0.85 * ls.maxMinutes));
  const team = tableSize > 1 ? (tableSize - r.clubPos) / (tableSize - 1) : 0;
  const big = r.bigAvg === null ? 0 : Math.max(-0.6, Math.min(0.6, r.bigAvg - r.avg)) * 0.25;
  return zr + 0.65 * zc + 0.5 * avail + 0.4 * team + big;
}

const name = (p: Player) => `${p.firstName} ${p.lastName}`;
const r2 = (n: number) => Math.round(n * 100) / 100;

function nominee(r: Row): AwardNominee {
  const g = r.group;
  const a = r.s.apps;
  const avg = r.avg.toFixed(2);
  const reason =
    g === "GK"
      ? `${a} apps · ${r.s.cleanSheets} clean sheets · ${r.s.saves} saves · ${avg} avg rating`
      : g === "DEF"
        ? `${a} apps · ${r.s.cleanSheets} clean sheets · ${r.s.goals}G ${r.s.assists}A · ${avg} avg rating`
        : `${a} apps · ${r.s.goals}G ${r.s.assists}A · ${avg} avg rating`;
  return { playerId: r.p.id, clubId: r.p.clubId, position: r.p.position, age: r.age, apps: a, goals: r.s.goals, assists: r.s.assists, cleanSheets: r.s.cleanSheets, saves: r.s.saves, avgRating: r2(r.avg), reason };
}

const byName = (a: Row, b: Row) => name(a.p).localeCompare(name(b.p)) || (a.p.id < b.p.id ? -1 : 1);

function ranked(rows: Row[], score: (r: Row) => number): { r: Row; score: number }[] {
  return rows.map((r) => ({ r, score: score(r) })).sort((a, b) => b.score - a.score || byName(a.r, b.r));
}

function result(ls: LeagueSeason, id: string, label: string, tier: AwardResult["tier"], top: Row[], margin: number, tiebreak?: string): AwardResult | null {
  if (!top.length) return null;
  return { id, name: label, tier, scope: ls.leagueName, leagueId: ls.leagueId, compId: ls.compId, winnerId: top[0].p.id, nominees: top.slice(0, AWARD_RULES.nominees).map(nominee), margin, ...(tiebreak ? { tiebreak } : {}) };
}

const marginOf = (gap: number) => (gap < 0.25 ? 1 : gap < 0.8 ? 3 : 9);

/** Ordered statistic leaders. Ties: goals/assists first, then the other attacking stat, then fewer minutes, then name. */
function leaders(ls: LeagueSeason, key: "goals" | "assists"): { rows: Row[]; tiebreak?: string } {
  const other = key === "goals" ? "assists" : "goals";
  const rows = ls.rows.filter((r) => r.s[key] > 0).sort((a, b) => b.s[key] - a.s[key] || b.s[other] - a.s[other] || a.s.minutes - b.s.minutes || byName(a, b));
  let tiebreak: string | undefined;
  if (rows[1] && rows[0].s[key] === rows[1].s[key]) tiebreak = rows[0].s[other] !== rows[1].s[other] ? `level on ${key}, won on ${other}` : rows[0].s.minutes !== rows[1].s.minutes ? `level on ${key}, won on fewer minutes played` : `level on ${key}`;
  return { rows, tiebreak };
}

/** Team of the Season formation: slots and the positions that may fill them. */
export const TEAM_FORMATION = "4-3-3";
const TEAM_SLOTS: { slot: string; label: string; positions: Position[] }[] = [
  { slot: "GK", label: "Goalkeeper", positions: ["GK"] },
  { slot: "RB", label: "Right back", positions: ["RB"] },
  { slot: "CB1", label: "Centre back", positions: ["CB"] },
  { slot: "CB2", label: "Centre back", positions: ["CB"] },
  { slot: "LB", label: "Left back", positions: ["LB"] },
  { slot: "DM", label: "Defensive midfield", positions: ["DM", "CM"] },
  { slot: "CM", label: "Central midfield", positions: ["CM", "AM", "DM"] },
  { slot: "AM", label: "Attacking midfield", positions: ["AM", "CM"] },
  { slot: "RW", label: "Right wing", positions: ["RW", "LW"] },
  { slot: "ST", label: "Striker", positions: ["ST"] },
  { slot: "LW", label: "Left wing", positions: ["LW", "RW"] },
];
const SLOT_GROUP: Record<string, PositionGroup> = { GK: "GK", RB: "DEF", CB1: "DEF", CB2: "DEF", LB: "DEF", DM: "MID", CM: "MID", AM: "MID", RW: "ATT", ST: "ATT", LW: "ATT" };

/** A real XI: each slot filled by the best player who can actually play there, relaxing to the position group only if needed. */
export function teamOfTheSeason(ls: LeagueSeason, scoreOf: (r: Row) => number): TeamOfSeasonSlot[] {
  const pool = ranked(ls.qualified, scoreOf);
  const used = new Set<string>();
  const out: TeamOfSeasonSlot[] = [];
  // Scarce roles first so a flexible player isn't taken from a slot nobody else can fill.
  const order = [...TEAM_SLOTS].sort((a, b) => a.positions.length - b.positions.length);
  const fill = new Map<string, Row>();
  for (const slot of order) {
    const exact = pool.find((x) => !used.has(x.r.p.id) && slot.positions.includes(x.r.p.position));
    const flex = exact ?? pool.find((x) => !used.has(x.r.p.id) && x.r.p.secondary.some((s) => slot.positions.includes(s)));
    const group = flex ?? pool.find((x) => !used.has(x.r.p.id) && x.r.group === SLOT_GROUP[slot.slot]);
    if (!group) continue;
    used.add(group.r.p.id);
    fill.set(slot.slot, group.r);
  }
  for (const slot of TEAM_SLOTS) {
    const r = fill.get(slot.slot);
    if (r) out.push({ slot: slot.slot, label: slot.label, playerId: r.p.id, clubId: r.p.clubId, position: r.p.position, reason: nominee(r).reason });
  }
  return out;
}

export interface LeagueAwards {
  results: AwardResult[];
  team: TeamOfSeasonSlot[];
}

/** All awards for one finished league season. Deterministic, and independent of who the user is. */
export function calculateLeagueAwards(state: GameState, ls: LeagueSeason): LeagueAwards {
  const comp = state.competitions[ls.compId];
  const size = comp?.table?.length ?? 20;
  const results: AwardResult[] = [];
  const score = (r: Row) => index(ls, r, size);
  const push = (x: AwardResult | null) => x && results.push(x);

  const goals = leaders(ls, "goals");
  push(result(ls, "topscorer", "Golden Boot", "statistical", goals.rows, goals.rows[1] ? goals.rows[0].s.goals - goals.rows[1].s.goals : 9, goals.tiebreak));
  const assists = leaders(ls, "assists");
  push(result(ls, "topassist", "Playmaker Award", "statistical", assists.rows, assists.rows[1] ? assists.rows[0].s.assists - assists.rows[1].s.assists : 9, assists.tiebreak));

  const all = ranked(ls.qualified, score);
  const keepers = ranked(ls.qualified.filter((r) => r.group === "GK"), (r) => {
    const b = ls.baseline.GK;
    const zr = b.n >= 3 ? z(r.avg, b.rating) : 0;
    const zk = b.n >= 3 ? z(r.contribution, b.contribution) : 0;
    return zr + 0.8 * zk + 0.4 * Math.min(1, r.s.minutes / (0.85 * ls.maxMinutes));
  });
  push(result(ls, "goldenglove", "Goalkeeper of the Season", "special", keepers.map((x) => x.r), keepers[1] ? marginOf(keepers[0].score - keepers[1].score) : 9));

  const youngMin = Math.max(AWARD_RULES.minAppsFloor, Math.round(ls.games * AWARD_RULES.youngGameShare));
  const youngPool = ls.rows.filter((r) => r.age <= AWARD_RULES.youngMaxAge && r.s.apps >= youngMin && r.s.minutes >= youngMin * 55);
  const young = ranked(youngPool, score);
  push(result(ls, "ypots", "Young Player of the Season", "major", young.map((x) => x.r), young[1] ? marginOf(young[0].score - young[1].score) : 9));

  const breakPool = ls.rows.filter((r) => r.age <= AWARD_RULES.breakthroughMaxAge && r.s.apps >= youngMin);
  const prevOf = (r: Row) => r.p.history.find((h) => h.season === state.season - 1);
  const breakthrough = ranked(
    breakPool.filter((r) => (prevOf(r)?.stats.apps ?? 0) <= AWARD_RULES.breakthroughPrevAppsMax && score(r) > 0),
    (r) => {
      const prev = prevOf(r);
      const prevApps = prev?.stats.apps ?? 0;
      const prevAvg = prev && prev.stats.apps >= 5 ? prev.stats.ratingSum / prev.stats.apps : null;
      return score(r) + 0.8 * Math.max(0, Math.min(1.4, (r.s.apps - prevApps) / 25)) + (prevAvg === null ? 0.3 : 1.2 * Math.max(0, Math.min(1, r.avg - prevAvg)));
    },
  );
  push(result(ls, "breakthrough", "Breakthrough Player", "special", breakthrough.map((x) => x.r), breakthrough[1] ? marginOf(breakthrough[0].score - breakthrough[1].score) : 9));

  push(result(ls, "pots", "Player of the Season", "major", all.map((x) => x.r), all[1] ? marginOf(all[0].score - all[1].score) : 9));

  return { results, team: teamOfTheSeason(ls, score) };
}
