import { clubName, country, leaguesInPlay, staticLeague } from "../data/world";
import { rememberAward, rememberTrophy } from "../memory/detect";
import { positionGroup } from "../players/attributes";
import { emptyStat, addStat } from "../players/generate";
import type { AwardRecord, Competition, GameState, Player, StatLine } from "../types";
import { addNews, addTimeline, fullName, squadOf, userPlayer } from "../world/helpers";
import type { TurnRatings } from "./matchday";
import { payTrophyBonus } from "../career/bonuses";
import { creditStintHonour } from "../managers/history";
import { adjustRel } from "../career/relationships";
import { leagueCompId } from "../competitions/setup";

export function recordAward(state: GameState, a: Omit<AwardRecord, "season">, opts: { timeline?: boolean; news?: string; season?: number } = {}) {
  // The season the award belongs to, which is not the current one when a gala is held after the rollover.
  const rec: AwardRecord = { ...a, season: opts.season ?? state.season };
  const isUser = a.playerId === state.user.playerId;
  if (isUser) {
    state.user.awards.push(rec);
    rememberAward(state, a.id, a.name, a.scope, a.clubId);
    if (opts.timeline !== false) addTimeline(state, { kind: "award", title: `${a.name}${a.scope ? ` — ${a.scope}` : ""}`, detail: a.value });
    addNews(state, { kind: "award", title: `You win ${a.name}!`, body: [a.scope, a.value].filter(Boolean).join(" · "), important: true });
    state.players[a.playerId].morale = Math.min(100, state.players[a.playerId].morale + 6);
  } else if (opts.news) {
    addNews(state, { kind: "award", title: opts.news, body: a.value });
  }
  return rec;
}

const XI_SHAPE: { group: ReturnType<typeof positionGroup>; n: number }[] = [
  { group: "GK", n: 1 },
  { group: "DEF", n: 4 },
  { group: "MID", n: 3 },
  { group: "ATT", n: 3 },
];

function pickXI<T extends { p: Player; score: number }>(entries: T[]): T[] {
  const out: T[] = [];
  for (const { group, n } of XI_SHAPE) out.push(...entries.filter((e) => positionGroup(e.p.position) === group).sort((a, b) => b.score - a.score).slice(0, n));
  return out;
}

/** Team of the Week for the user's league from this turn's ratings. */
export function teamOfTheWeek(state: GameState, ratings: TurnRatings): string[] {
  const u = userPlayer(state);
  const lid = u.clubId ? state.clubs[u.clubId]?.leagueId : undefined;
  if (!lid) return [];
  const compId = leagueCompId(lid, state.season);
  const entries = Object.entries(ratings)
    .filter(([, r]) => r.compId === compId)
    .map(([id, r]) => ({ p: state.players[id], score: r.rating }))
    .filter((e) => e.p);
  if (entries.length < 11) return [];
  const xi = pickXI(entries);
  if (xi.some((e) => e.p.id === u.id)) {
    recordAward(state, { id: "totw", name: "Team of the Week", scope: staticLeague(lid)?.name ?? "", playerId: u.id, clubId: u.clubId, value: `Rating ${ratings[u.id].rating.toFixed(1)}` }, { timeline: false });
  }
  return xi.map((e) => e.p.id);
}

function leaguePlayers(state: GameState, leagueId: string): Player[] {
  return (state.leagueClubs[leagueId] ?? []).flatMap((c) => squadOf(state, c));
}

/** Player of the Month for each top flight and the user's league; then reset month counters. */
export function playerOfTheMonth(state: GameState): void {
  const u = userPlayer(state);
  const userLeague = u.clubId ? state.clubs[u.clubId]?.leagueId : undefined;
  const leagues = leaguesInPlay(state).filter((l) => l.tier === 1 || l.id === userLeague);
  for (const l of leagues) {
    const best = leaguePlayers(state, l.id)
      .filter((p) => p.month.apps >= 2)
      .map((p) => ({ p, score: p.month.ratingSum / p.month.apps + p.month.goals * 0.16 + p.month.assists * 0.09 }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    recordAward(
      state,
      { id: "potm", name: "Player of the Month", scope: l.name, playerId: best.p.id, clubId: best.p.clubId, value: `${best.p.month.goals}G ${best.p.month.assists}A · avg ${(best.p.month.ratingSum / best.p.month.apps).toFixed(2)}` },
      { timeline: true, news: l.id === userLeague ? `${fullName(best.p)} named ${l.name} Player of the Month` : undefined },
    );
  }
  for (const p of Object.values(state.players)) p.month = { apps: 0, ratingSum: 0, goals: 0, assists: 0 };
}

export function totalSeason(p: Player, filter?: (compId: string) => boolean): StatLine {
  const s = emptyStat();
  for (const k in p.season) if (!filter || filter(k)) addStat(s, p.season[k]);
  return s;
}

/** Hand out trophies to the squad that won a competition. */
export function awardTrophy(state: GameState, comp: Competition): void {
  if (!comp.winner) return;
  const nat = comp.kind === "international";
  const ids = nat ? state.nationalTeams[comp.winner]?.squad ?? [] : state.clubs[comp.winner]?.squad ?? [];
  const u = userPlayer(state);
  for (const id of ids) {
    const p = state.players[id];
    if (!p) continue;
    const appeared = (p.season[comp.id]?.apps ?? 0) > 0;
    if (!appeared && comp.kind !== "league") continue;
    p.trophies++;
    p.reputation = Math.min(100, p.reputation + (comp.prestige >= 8 ? 3 : 1));
    if (p.id === u.id) {
      state.user.trophies.push({ season: state.season, compId: comp.id, name: comp.name, kind: comp.kind, clubId: nat ? undefined : comp.winner, country: nat ? comp.winner : undefined });
      addTimeline(state, { kind: "trophy", title: `${comp.name} winner`, detail: nat ? country(comp.winner)?.name : clubName(comp.winner) });
      addNews(state, { kind: "award", title: `Champions! You win the ${comp.name}`, important: true });
      rememberTrophy(state, comp, appeared ? p.season[comp.id]?.apps ?? 0 : 0);
      adjustRel(state, "supporters", 6, `Won the ${comp.name}`);
      if (!nat) {
        payTrophyBonus(state, comp, appeared);
        creditStintHonour(state, comp.kind === "league" ? "league" : comp.kind === "cup" ? "cup" : "continental");
      }
    }
  }
  const major = comp.kind !== "league" || comp.tier === 1;
  if (major && !ids.includes(u.id)) addNews(state, { kind: "world", title: `${nat ? country(comp.winner)?.name : clubName(comp.winner)} win the ${comp.name}` });
}
