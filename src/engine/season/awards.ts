import { clubName, country, leaguesInPlay, staticLeague } from "../data/world";
import { rememberAward, rememberTrophy } from "../memory/detect";
import { overallFor, positionGroup } from "../players/attributes";
import { ageOf, avgRating, emptyStat, addStat } from "../players/generate";
import type { AwardRecord, Competition, GameState, Player, StatLine } from "../types";
import { addNews, addTimeline, fullName, squadOf, userPlayer } from "../world/helpers";
import type { TurnRatings } from "./matchday";
import { leagueCompId } from "../competitions/setup";

function record(state: GameState, a: Omit<AwardRecord, "season">, opts: { timeline?: boolean; news?: string } = {}) {
  const rec: AwardRecord = { ...a, season: state.season };
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
    record(state, { id: "totw", name: "Team of the Week", scope: staticLeague(lid)?.name ?? "", playerId: u.id, clubId: u.clubId, value: `Rating ${ratings[u.id].rating.toFixed(1)}` }, { timeline: false });
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
    record(
      state,
      { id: "potm", name: "Player of the Month", scope: l.name, playerId: best.p.id, clubId: best.p.clubId, value: `${best.p.month.goals}G ${best.p.month.assists}A · avg ${(best.p.month.ratingSum / best.p.month.apps).toFixed(2)}` },
      { timeline: true, news: l.id === userLeague ? `${fullName(best.p)} named ${l.name} Player of the Month` : undefined },
    );
  }
  for (const p of Object.values(state.players)) p.month = { apps: 0, ratingSum: 0, goals: 0, assists: 0 };
}

function compStat(p: Player, compId: string): StatLine {
  return p.season[compId] ?? emptyStat();
}

export function totalSeason(p: Player, filter?: (compId: string) => boolean): StatLine {
  const s = emptyStat();
  for (const k in p.season) if (!filter || filter(k)) addStat(s, p.season[k]);
  return s;
}

/** End-of-season league awards. Returns archive-friendly records. */
export function seasonAwards(state: GameState): AwardRecord[] {
  const out: AwardRecord[] = [];
  for (const l of leaguesInPlay(state)) {
    const compId = leagueCompId(l.id, state.season);
    const comp = state.competitions[compId];
    if (!comp) continue;
    const players = leaguePlayers(state, l.id);
    const table = comp.table ?? [];
    const posOf = (clubId: string | null) => (clubId ? table.findIndex((r) => r.team === clubId) + 1 : 20);
    const scored = players
      .map((p) => {
        const s = compStat(p, compId);
        const apps = s.apps;
        const pos = posOf(p.clubId);
        const score = apps < 12 ? 0 : avgRating(s) * 10 * Math.min(1, apps / 30) + s.goals * 0.55 + s.assists * 0.35 + s.cleanSheets * 0.25 + (table.length - pos) * 0.25;
        return { p, s, score };
      })
      .filter((x) => x.score > 0);
    if (!scored.length) continue;
    const pots = [...scored].sort((a, b) => b.score - a.score)[0];
    const major = l.tier === 1 || players.some((p) => p.isUser);
    out.push(record(state, { id: "pots", name: "Player of the Season", scope: l.name, playerId: pots.p.id, clubId: pots.p.clubId, value: `${pots.s.goals}G ${pots.s.assists}A · avg ${avgRating(pots.s).toFixed(2)}` }, { news: major ? `${fullName(pots.p)} is the ${l.name} Player of the Season` : undefined }));
    const young = scored.filter((x) => ageOf(x.p, state.season) <= 21).sort((a, b) => b.score - a.score)[0];
    if (young) out.push(record(state, { id: "ypots", name: "Young Player of the Season", scope: l.name, playerId: young.p.id, clubId: young.p.clubId, value: `Age ${ageOf(young.p, state.season)}` }));
    const scorer = [...scored].sort((a, b) => b.s.goals - a.s.goals || a.s.minutes - b.s.minutes)[0];
    if (scorer && scorer.s.goals > 0) out.push(record(state, { id: "topscorer", name: "Golden Boot", scope: l.name, playerId: scorer.p.id, clubId: scorer.p.clubId, value: `${scorer.s.goals} goals` }, { news: major ? `${fullName(scorer.p)} wins the ${l.name} Golden Boot (${scorer.s.goals})` : undefined }));
    const assister = [...scored].sort((a, b) => b.s.assists - a.s.assists)[0];
    if (assister && assister.s.assists > 0) out.push(record(state, { id: "topassist", name: "Playmaker Award", scope: l.name, playerId: assister.p.id, clubId: assister.p.clubId, value: `${assister.s.assists} assists` }));
    const glove = scored.filter((x) => x.p.position === "GK").sort((a, b) => b.s.cleanSheets - a.s.cleanSheets)[0];
    if (glove && l.tier === 1) out.push(record(state, { id: "goldenglove", name: "Golden Glove", scope: l.name, playerId: glove.p.id, clubId: glove.p.clubId, value: `${glove.s.cleanSheets} clean sheets` }));
    const xi = pickXI(scored);
    const user = xi.find((x) => x.p.isUser);
    if (user) out.push(record(state, { id: "tots", name: "Team of the Season", scope: l.name, playerId: user.p.id, clubId: user.p.clubId }));
  }
  return out;
}

/** Global end-of-year awards (after summer tournaments). */
export function worldAwards(state: GameState): AwardRecord[] {
  const trophyPoints = new Map<string, number>();
  for (const comp of Object.values(state.competitions)) {
    if (comp.season !== state.season || !comp.winner) continue;
    const pts = comp.kind === "continental" ? comp.prestige * 1.6 : comp.kind === "international" && comp.groups ? comp.prestige * 1.8 : comp.kind === "league" ? (comp.tier === 1 ? 10 : 2) : comp.kind === "cup" ? 4 : 0;
    trophyPoints.set(comp.winner, (trophyPoints.get(comp.winner) ?? 0) + pts);
  }
  const candidates = Object.values(state.players)
    .filter((p) => !p.virtual && !p.retired)
    .map((p) => {
      const s = totalSeason(p);
      if (s.apps < 15) return { p, s, score: 0 };
      const att = positionGroup(p.position) === "ATT" || p.position === "AM";
      const club = p.clubId ? trophyPoints.get(p.clubId) ?? 0 : 0;
      const nation = trophyPoints.get(p.intl.tiedTo ?? p.nationality) ?? 0;
      const nationIn = Object.values(state.nationalTeams).some((n) => n.squad.includes(p.id)) ? nation : 0;
      const tier = p.clubId ? staticLeague(state.clubs[p.clubId]?.leagueId ?? "")?.tier ?? 3 : 3;
      const score =
        avgRating(s) * 11 * Math.min(1, s.apps / 35) + s.goals * (att ? 0.42 : 0.6) + s.assists * 0.3 + s.cleanSheets * 0.35 + club + nationIn + p.reputation * 0.12 + p.intlReputation * 0.1 + overallFor(p.attrs, p.position) * 0.35 - (tier - 1) * 12;
      return { p, s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const out: AwardRecord[] = [];
  const winner = candidates[0];
  if (winner) {
    out.push(record(state, { id: "golden-pitch", name: "Golden Pitch", scope: "World Player of the Year", playerId: winner.p.id, clubId: winner.p.clubId, value: `${winner.s.goals}G ${winner.s.assists}A in ${winner.s.apps} games` }, { news: `${fullName(winner.p)} (${clubName(winner.p.clubId)}) wins the Golden Pitch` }));
    winner.p.reputation = Math.min(100, winner.p.reputation + 6);
    winner.p.intlReputation = Math.min(100, winner.p.intlReputation + 8);
  }
  const rank = candidates.findIndex((c) => c.p.isUser);
  if (rank > 0 && rank < 30) {
    addNews(state, { kind: "award", title: `Golden Pitch: you finished #${rank + 1}`, body: `Won by ${winner ? fullName(winner.p) : "—"}.`, important: rank < 10 });
    if (rank < 3) {
      state.user.awards.push({ season: state.season, id: "golden-pitch-podium", name: `Golden Pitch — ${rank === 1 ? "2nd" : "3rd"} place`, scope: "World", playerId: state.user.playerId });
      rememberAward(state, "golden-pitch-podium", `Golden Pitch — ${rank === 1 ? "2nd" : "3rd"} place`, "World", state.user.playerId ? userPlayer(state).clubId : null);
      addTimeline(state, { kind: "award", title: `Golden Pitch podium (${rank === 1 ? "2nd" : "3rd"})` });
    }
  }
  const young = candidates.filter((c) => ageOf(c.p, state.season) <= 21)[0];
  if (young) out.push(record(state, { id: "rising-star", name: "Rising Star Award", scope: "Best U21 player in the world", playerId: young.p.id, clubId: young.p.clubId }, { news: `${fullName(young.p)} wins the Rising Star Award` }));
  const gk = candidates.filter((c) => c.p.position === "GK")[0];
  if (gk) out.push(record(state, { id: "world-glove", name: "World Goalkeeper of the Year", scope: "World", playerId: gk.p.id, clubId: gk.p.clubId }));
  return out;
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
      state.user.relationships.supporters = Math.min(100, state.user.relationships.supporters + 6);
    }
  }
  const major = comp.kind !== "league" || comp.tier === 1;
  if (major && !ids.includes(u.id)) addNews(state, { kind: "world", title: `${nat ? country(comp.winner)?.name : clubName(comp.winner)} win the ${comp.name}` });
}
