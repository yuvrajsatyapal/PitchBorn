/**
 * The season in review: a recap built from what the save already records (match log, memories, trophies, awards, the
 * league table, chemistry). Read-only apart from a snapshot of teammate bonds taken as each season starts, so the review
 * can say how the dressing room changed. Shown from the end of the league season through the summer.
 */
import { BALANCE } from "../balance";
import { clubName, staticLeague } from "../data/world";
import { describeMemory } from "../memory/describe";
import { overallFor } from "../players/attributes";
import { ageOf } from "../players/generate";
import type { GameState, MatchLogEntry } from "../types";
import { fullName, userPlayer } from "../world/helpers";
import { bondLabel } from "./chemistry";

const C = BALANCE.calendar;

/** Keep a copy of the bonds as they stood when the season began. */
export function snapshotChemistry(state: GameState): void {
  const u = state.user;
  if (u.retired || u.chemistrySnap?.season === state.season) return;
  u.chemistrySnap = { season: state.season, values: Object.fromEntries(Object.entries(u.chemistry ?? {}).map(([id, b]) => [id, Math.round(b.v)])) };
}

/** Whether the dashboard should offer the review: the league season is over and the new one has not begun. */
export function reviewAvailable(state: GameState): boolean {
  return !state.user.retired && state.turn > C.seasonEnd && (state.user.matchLog ?? []).some((m) => m.season === state.season);
}

export interface SeasonReview {
  season: number;
  club: string | null;
  age: number;
  overall: { now: number; start?: number };
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  avgRating: number | null;
  /** The season's ratings in order, for a trend line. */
  ratings: number[];
  record: { w: number; d: number; l: number };
  best: MatchLogEntry[];
  leaguePosition?: { pos: number; of: number; league: string };
  trophies: string[];
  awards: string[];
  moments: { icon: string; title: string; line: string }[];
  bonds: { name: string; from: number; to: number; label: string }[];
  verdict: string;
}

export function seasonReview(state: GameState, season = state.season): SeasonReview {
  const p = userPlayer(state);
  const u = state.user;
  const log = (u.matchLog ?? []).filter((m) => m.season === season);
  const ratings = log.map((m) => m.rating);
  const avg = ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 100) / 100 : null;
  const prev = p.history.find((h) => h.season === season - 1);
  const clubId = p.clubId ?? p.history.find((h) => h.season === season)?.clubId ?? null;
  let leaguePosition: SeasonReview["leaguePosition"];
  if (clubId) {
    const comp = Object.values(state.competitions).find((c) => c.kind === "league" && c.season === season && c.teams.includes(clubId));
    const idx = comp?.table?.findIndex((r) => r.team === clubId) ?? -1;
    if (comp?.table && idx >= 0) leaguePosition = { pos: idx + 1, of: comp.table.length, league: staticLeague(state.clubs[clubId]?.leagueId ?? "")?.name ?? comp.name };
  }
  const snap = u.chemistrySnap?.season === season ? u.chemistrySnap.values : {};
  const bonds = Object.entries(u.chemistry ?? {})
    .map(([id, b]) => ({ id, from: snap[id] ?? 0, to: Math.round(b.v) }))
    .filter((b) => state.players[b.id] && Math.abs(b.to - b.from) >= 8)
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
    .slice(0, 4)
    .map((b) => ({ name: fullName(state.players[b.id]), from: b.from, to: b.to, label: bondLabel(b.to) }));
  const moments = u.memories
    .filter((m) => m.season === season)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 4)
    .map((m) => {
      const v = describeMemory(state, m);
      return { icon: v.icon, title: v.title, line: v.line };
    });
  const goals = log.reduce((s, m) => s + m.goals, 0);
  const assists = log.reduce((s, m) => s + m.assists, 0);
  const verdict =
    avg === null ? "A season without senior football." :
    avg >= 7.5 ? "An outstanding season: one to remember." :
    avg >= 7 ? "A very good season." :
    avg >= 6.6 ? "A solid season." :
    avg >= 6.2 ? "A mixed season, with things to work on." :
    "A difficult season.";
  return {
    season,
    club: clubId ? clubName(clubId) : null,
    age: ageOf(p, season),
    overall: { now: Math.round(overallFor(p.attrs, p.position)), start: prev?.overall },
    apps: log.length,
    starts: log.filter((m) => m.started).length,
    goals,
    assists,
    avgRating: avg,
    ratings,
    record: { w: log.filter((m) => m.result === "W").length, d: log.filter((m) => m.result === "D").length, l: log.filter((m) => m.result === "L").length },
    best: [...log].sort((a, b) => b.rating - a.rating || b.goals - a.goals).slice(0, 3),
    leaguePosition,
    trophies: u.trophies.filter((t) => t.season === season).map((t) => t.name),
    awards: u.awards.filter((a) => a.season === season).map((a) => a.name),
    moments,
    bonds,
    verdict,
  };
}
