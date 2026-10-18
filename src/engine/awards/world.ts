/**
 * The global awards gala: Golden Pitch, Rising Star and World Goalkeeper of the Year.
 *
 * Like the league ceremony, the simulation decides and the gala presents. When the summer tournaments are over the
 * results are calculated once from the finished season and stored in `state.worldCeremony`; the gala is held on the
 * first day of the next season. Watching or skipping gives the identical world: both end in `completeCeremony`, which
 * applies every career consequence exactly once.
 */
import { clubName, staticLeague } from "../data/world";
import { intlTeam } from "../national/identity";
import { overallFor, positionGroup } from "../players/attributes";
import { ageOf, avgRating } from "../players/generate";
import { recordAward, totalSeason } from "../season/awards";
import { addNews, addTimeline, fullName, userPlayer } from "../world/helpers";
import { rememberAward } from "../memory/detect";
import type { AwardNominee, AwardRecord, AwardResult, GameState, Player, SeasonCeremony, StatLine } from "../types";

export const WORLD_LEAGUE_ID = "world";
export const WORLD_ORDER = ["world-glove", "rising-star", "golden-pitch"] as const;

/** Nominees named per award, and the youngest age (at the season's start) a Rising Star can be. */
export const WORLD_RULES = { nominees: { "golden-pitch": 5, "rising-star": 4, "world-glove": 4 }, risingStarMaxAge: 21, minApps: 15 } as const;

const SCOPE = { "golden-pitch": "World Player of the Year", "rising-star": "Best U21 player in the world", "world-glove": "World" } as const;
const NAME = { "golden-pitch": "Golden Pitch", "rising-star": "Rising Star Award", "world-glove": "World Goalkeeper of the Year" } as const;
const TIER = { "golden-pitch": "major", "rising-star": "special", "world-glove": "special" } as const;
type WorldAwardId = keyof typeof NAME;

export const worldCeremonyPending = (state: GameState) => !!state.worldCeremony && state.worldCeremony.status !== "completed";

interface Candidate {
  p: Player;
  s: StatLine;
  score: number;
}

/** Everything the global awards weigh: form over the whole season, the trophies the club and nation won, and the level played at. */
function rank(state: GameState): Candidate[] {
  const trophyPoints = new Map<string, number>();
  for (const comp of Object.values(state.competitions)) {
    if (comp.season !== state.season || !comp.winner) continue;
    const pts = comp.kind === "continental" ? comp.prestige * 1.6 : comp.kind === "international" && comp.groups ? comp.prestige * 1.8 : comp.kind === "league" ? (comp.tier === 1 ? 10 : 2) : comp.kind === "cup" ? 4 : 0;
    trophyPoints.set(comp.winner, (trophyPoints.get(comp.winner) ?? 0) + pts);
  }
  const inNationalSquad = new Set<string>();
  for (const n of Object.values(state.nationalTeams)) for (const id of n.squad) inNationalSquad.add(id);
  return Object.values(state.players)
    .filter((p) => !p.virtual && !p.retired)
    .map((p) => {
      const s = totalSeason(p);
      if (s.apps < WORLD_RULES.minApps) return { p, s, score: 0 };
      const att = positionGroup(p.position) === "ATT" || p.position === "AM";
      const club = p.clubId ? trophyPoints.get(p.clubId) ?? 0 : 0;
      const nation = inNationalSquad.has(p.id) ? trophyPoints.get(intlTeam(p)) ?? 0 : 0;
      const tier = p.clubId ? staticLeague(state.clubs[p.clubId]?.leagueId ?? "")?.tier ?? 3 : 3;
      const score =
        avgRating(s) * 11 * Math.min(1, s.apps / 35) + s.goals * (att ? 0.42 : 0.6) + s.assists * 0.3 + s.cleanSheets * (p.position === "GK" ? 0.9 : 0.35) + (p.position === "GK" ? s.saves * 0.01 : 0) + club + nation + p.reputation * 0.12 + p.intlReputation * 0.1 + overallFor(p.attrs, p.position) * 0.35 - (tier - 1) * 12;
      return { p, s, score };
    })
    .filter((c) => c.score > 0)
    // Equal scores are settled by id so the same season always gives the same podium.
    .sort((a, b) => b.score - a.score || (a.p.id < b.p.id ? -1 : 1));
}

function nominee(state: GameState, c: Candidate): AwardNominee {
  const { p, s } = c;
  const avg = s.apps ? s.ratingSum / s.apps : 0;
  const gk = p.position === "GK";
  const reason = gk ? `${s.apps} apps · ${s.cleanSheets} clean sheets · ${s.saves} saves · ${avg.toFixed(2)} avg rating` : `${s.apps} apps · ${s.goals}G ${s.assists}A · ${avg.toFixed(2)} avg rating`;
  return { playerId: p.id, clubId: p.clubId, position: p.position, age: ageOf(p, state.season), apps: s.apps, goals: s.goals, assists: s.assists, cleanSheets: s.cleanSheets, saves: s.saves, avgRating: Math.round(avg * 100) / 100, reason };
}

function result(state: GameState, id: WorldAwardId, pool: Candidate[]): AwardResult | null {
  const top = pool.slice(0, WORLD_RULES.nominees[id]);
  if (!top.length) return null;
  const gap = top[1] ? top[0].score - top[1].score : 99;
  return { id, name: NAME[id], tier: TIER[id], scope: SCOPE[id], leagueId: WORLD_LEAGUE_ID, compId: WORLD_LEAGUE_ID, winnerId: top[0].p.id, nominees: top.map((c) => nominee(state, c)), margin: gap < 1.5 ? 1 : gap < 5 ? 3 : 9 };
}

/** The global awards for the season just played: a pure function of the finished season. */
export function calculateWorldAwards(state: GameState): { results: AwardResult[]; userRank?: number } {
  const all = rank(state);
  const results = [
    result(state, "golden-pitch", all),
    result(state, "rising-star", all.filter((c) => ageOf(c.p, state.season) <= WORLD_RULES.risingStarMaxAge)),
    result(state, "world-glove", all.filter((c) => c.p.position === "GK")),
  ].filter((r): r is AwardResult => !!r);
  const at = all.findIndex((c) => c.p.isUser);
  return { results, ...(at >= 0 ? { userRank: at + 1 } : {}) };
}

const awardOf = (state: GameState, r: AwardResult): Omit<AwardRecord, "season"> => ({
  id: r.id,
  name: r.name,
  scope: r.scope,
  playerId: r.winnerId,
  playerName: state.players[r.winnerId] ? fullName(state.players[r.winnerId]) : undefined,
  clubId: r.nominees[0].clubId,
  ...(r.id === "golden-pitch" ? { value: `${r.nominees[0].goals}G ${r.nominees[0].assists}A in ${r.nominees[0].apps} games` } : {}),
});

/**
 * Called once, as the season's last week ends. Calculates the global awards, stores the gala for the first day of the
 * next season, and returns the winners for the season archive. Preparing the same season twice returns the same
 * records and keeps the gala as it is, so a repeated call can never reset or re-award it.
 */
export function prepareWorldCeremony(state: GameState): AwardRecord[] {
  const existing = state.worldCeremony;
  if (existing && existing.season === state.season) return existing.results.map((r) => ({ season: existing.season, ...awardOf(state, r) }));
  settleWorldCeremony(state, true);
  const { results, userRank } = calculateWorldAwards(state);
  if (!results.length) {
    delete state.worldCeremony;
    return [];
  }
  state.worldCeremony = { kind: "world", season: state.season, leagueId: WORLD_LEAGUE_ID, leagueName: "World", status: "ready", step: 0, results, team: [], formation: "", others: [], applied: false, turnIndex: state.turnIndex, ...(userRank ? { userRank } : {}) };
  return results.map((r) => ({ season: state.season, ...awardOf(state, r) }));
}

/** The gala is only held on the first day of the next season: carrying on without attending counts as skipping it. */
export function settleWorldCeremony(state: GameState, force = false): void {
  const c = state.worldCeremony;
  if (!c || c.status === "completed") return;
  if (force || state.turnIndex > c.turnIndex || state.user.retired) completeWorld(state, "auto");
}

export function completeWorld(state: GameState, how: "watched" | "skipped" | "auto"): boolean {
  const c = state.worldCeremony;
  if (!c || c.status === "completed") return false;
  applyWorld(state, c);
  c.status = "completed";
  c.how = how;
  return true;
}

/** Everything the gala means for careers, applied once from the stored results. */
function applyWorld(state: GameState, c: SeasonCeremony): void {
  if (c.applied) return;
  c.applied = true;
  const uid = state.user.playerId;
  const me = userPlayer(state);
  for (const r of c.results) {
    const winner = state.players[r.winnerId];
    const award = awardOf(state, r);
    recordAward(state, award, { news: `${winner ? fullName(winner) : "A player"} (${clubName(award.clubId)}) wins the ${r.name}`, season: c.season });
    if (winner && r.id === "golden-pitch") {
      winner.reputation = Math.min(100, winner.reputation + 6);
      winner.intlReputation = Math.min(100, winner.intlReputation + 8);
    }
    const mine = r.nominees.findIndex((n) => n.playerId === uid);
    if (mine >= 1 && mine <= 3) (state.user.awardNoms ??= []).push({ season: c.season, id: r.id, name: r.name, scope: r.scope, place: mine + 1 });
    if (r.id === "golden-pitch" && mine >= 1 && mine <= 2) {
      const place = mine === 1 ? "2nd" : "3rd";
      state.user.awards.push({ season: c.season, id: "golden-pitch-podium", name: `Golden Pitch — ${place} place`, scope: "World", playerId: uid });
      rememberAward(state, "golden-pitch-podium", `Golden Pitch — ${place} place`, "World", me.clubId);
      addTimeline(state, { kind: "award", title: `Golden Pitch podium (${place})` });
    }
  }
  const winner = c.results.find((r) => r.id === "golden-pitch");
  if (c.userRank && c.userRank > 1 && c.userRank < 30) {
    addNews(state, { kind: "award", title: `Golden Pitch: you finished #${c.userRank}`, body: `Won by ${winner && state.players[winner.winnerId] ? fullName(state.players[winner.winnerId]) : "—"}.`, important: c.userRank < 10 });
  }
}
