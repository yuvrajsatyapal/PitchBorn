/**
 * The end-of-season awards ceremony.
 *
 * Simulation decides, the ceremony presents. When the league season is final, the awards are calculated once and
 * stored (`state.ceremony`). Watching or skipping only changes how they are shown: both end in `completeCeremony`,
 * which applies every career consequence exactly once, and `settleCeremony` applies them automatically if the
 * player simply carries on. Nothing here reads UI state, so the football world is identical either way.
 */
import { BALANCE } from "../balance";
import { staticLeague } from "../data/world";
import { rememberSeasonAward } from "../memory/detect";
import { noteAwardDuel, primaryRival } from "../career/rivalry/engine";
import { clamp } from "../rng";
import type { AwardRecord, AwardResult, GameState, Player, SeasonCeremony } from "../types";
import { addNews, addTimeline, fullName, userPlayer } from "../world/helpers";
import { calculateLeagueAwards, leagueSeason, TEAM_FORMATION } from "./calc";
import { updateAwardRecords } from "./records";
import { leaguesInPlay } from "../data/world";

/** Reputation each award is worth before it is scaled down for a player who is already well known. */
const REPUTATION: Record<string, number> = { pots: 4, topscorer: 2.5, ypots: 2.5, goldenglove: 3, breakthrough: 2, topassist: 1.5, tots: 1.5 };
/** Most reputation a player can gain from one season's awards. */
const REPUTATION_CAP = 7;
const TIER_WEIGHT = [1, 1, 0.65, 0.45, 0.35];
/** Relationship effects for the user. */
const RELATIONS: Record<string, Partial<Record<"supporters" | "manager" | "board", number>>> = {
  pots: { supporters: 5, manager: 3, board: 2 },
  topscorer: { supporters: 3, manager: 1 },
  ypots: { supporters: 2, manager: 2 },
  breakthrough: { supporters: 2, manager: 2 },
  goldenglove: { supporters: 2, manager: 1 },
  topassist: { supporters: 1 },
  tots: { supporters: 1 },
};
const MORALE = 5;
const MORALE_CAP = 12;

export const CEREMONY_ORDER = ["topscorer", "topassist", "goldenglove", "breakthrough", "ypots", "pots"] as const;

export const ceremonyStatus = (state: GameState) => state.ceremony?.status ?? "not-ready";
export const ceremonyPending = (state: GameState) => !!state.ceremony && state.ceremony.status !== "completed";

// --------------------------------------------------------------------------- calculation

/** The league whose ceremony the player attends: the one their club plays in, else the strongest in play. */
function primaryLeague(state: GameState) {
  const club = userPlayer(state).clubId;
  const own = club ? state.clubs[club]?.leagueId : undefined;
  const leagues = leaguesInPlay(state);
  return leagues.find((l) => l.id === own) ?? [...leagues].sort((a, b) => a.tier - b.tier)[0];
}

const valueOf = (r: AwardResult): string => {
  const n = r.nominees[0];
  switch (r.id) {
    case "topscorer": return `${n.goals} goals`;
    case "topassist": return `${n.assists} assists`;
    case "goldenglove": return `${n.cleanSheets} clean sheets`;
    case "ypots": return `Age ${n.age} · ${n.goals}G ${n.assists}A · avg ${n.avgRating.toFixed(2)}`;
    default: return `${n.goals}G ${n.assists}A · avg ${n.avgRating.toFixed(2)}`;
  }
};

const toRecord = (state: GameState, r: AwardResult): AwardRecord => ({ season: state.season, id: r.id, name: r.name, scope: r.scope, playerId: r.winnerId, playerName: state.players[r.winnerId] ? fullName(state.players[r.winnerId]) : undefined, clubId: r.nominees[0].clubId, value: valueOf(r), age: r.nominees[0].age });

/**
 * Called once, when the season's league tables are final. Calculates the awards for every league, keeps the full
 * results (nominees, Team of the Season) for the user's league, and returns the winners for the season archive.
 */
export function prepareSeasonAwards(state: GameState): AwardRecord[] {
  settleCeremony(state); // never leave an earlier ceremony unapplied
  const records: AwardRecord[] = [];
  const own = primaryLeague(state);
  let ceremony: SeasonCeremony | null = null;
  const others: SeasonCeremony["others"] = [];
  for (const l of leaguesInPlay(state)) {
    const ls = leagueSeason(state, l.id, l.name);
    if (!ls) continue;
    const out = calculateLeagueAwards(state, ls);
    for (const r of out.results) records.push(toRecord(state, r));
    if (l.id === own?.id) {
      for (const t of out.team) records.push({ season: state.season, id: "tots", name: "Team of the Season", scope: l.name, playerId: t.playerId, clubId: t.clubId });
      ceremony = { season: state.season, leagueId: l.id, leagueName: l.name, status: "ready", step: 0, results: out.results, team: out.team, formation: TEAM_FORMATION, others: [], applied: false, turnIndex: state.turnIndex };
    } else {
      for (const r of out.results) others.push({ id: r.id, name: r.name, scope: r.scope, leagueId: r.leagueId, playerId: r.winnerId });
    }
  }
  if (ceremony) {
    ceremony.others = others;
    state.ceremony = ceremony;
  }
  return records;
}

// --------------------------------------------------------------------------- scenes (shared by the UI and the resume logic)

export type Scene =
  | { kind: "opening" }
  | { kind: "award"; id: string; phase: "nominees" | "winner" }
  | { kind: "team" }
  | { kind: "yours" }
  | { kind: "story" };

/** The ordered scenes of the ceremony. Judged awards show their nominees first, then reveal the winner. */
export function buildScenes(c: SeasonCeremony): Scene[] {
  const scenes: Scene[] = [{ kind: "opening" }];
  for (const id of CEREMONY_ORDER) {
    const r = c.results.find((x) => x.id === id);
    if (!r) continue;
    if (r.tier === "statistical") scenes.push({ kind: "award", id, phase: "winner" });
    else scenes.push({ kind: "award", id, phase: "nominees" }, { kind: "award", id, phase: "winner" });
  }
  if (c.team.length) scenes.push({ kind: "team" });
  scenes.push({ kind: "yours" }, { kind: "story" });
  return scenes;
}

// --------------------------------------------------------------------------- lifecycle

export function startCeremony(state: GameState): boolean {
  const c = state.ceremony;
  if (!c || c.status === "completed") return false;
  if (c.status === "ready") c.status = "in-progress";
  return true;
}

export function setCeremonyStep(state: GameState, step: number): void {
  const c = state.ceremony;
  if (!c || c.status !== "in-progress") return;
  c.step = clamp(Math.round(step), 0, Math.max(0, buildScenes(c).length - 1));
}

/** Finishes the ceremony, watched or skipped. The consequences are identical, and applied once. */
export function completeCeremony(state: GameState, how: "watched" | "skipped" | "auto" = "skipped"): boolean {
  const c = state.ceremony;
  if (!c || c.status === "completed") return false;
  applyCeremony(state);
  c.status = "completed";
  c.how = how;
  return true;
}

/** If the player carries on without attending, the awards are still given: it counts as skipping. */
export function settleCeremony(state: GameState): void {
  const c = state.ceremony;
  if (!c || c.status === "completed") return;
  if (state.turn > BALANCE.calendar.endOfSeasonTurn || state.season > c.season || state.turnIndex > c.turnIndex || state.user.retired) completeCeremony(state, "auto");
}

// --------------------------------------------------------------------------- consequences

const tierWeight = (leagueId: string) => TIER_WEIGHT[staticLeague(leagueId)?.tier ?? 3] ?? 0.35;

function giveReputation(p: Player, id: string, leagueId: string, gained: Map<string, number>): void {
  const base = (REPUTATION[id] ?? 0) * tierWeight(leagueId) * (1 - p.reputation / 130);
  const room = REPUTATION_CAP - (gained.get(p.id) ?? 0);
  const delta = Math.max(0, Math.min(base, room));
  if (delta <= 0) return;
  gained.set(p.id, (gained.get(p.id) ?? 0) + delta);
  p.reputation = Math.min(100, Math.round((p.reputation + delta) * 10) / 10);
}

const ordinal = (n: number) => (n === 2 ? "second" : n === 3 ? "third" : n === 4 ? "fourth" : `${n}th`);

/**
 * Applies everything the awards mean for careers: reputation (which the transfer market already reads), career
 * history, memories, rivalry, relationships, records and news. It runs once, from the stored results.
 */
function applyCeremony(state: GameState): void {
  const c = state.ceremony;
  if (!c || c.applied) return;
  c.applied = true;
  const uid = state.user.playerId;
  const me = userPlayer(state);
  const gained = new Map<string, number>();
  const wonNow: AwardResult[] = [];
  const before = state.user.awards.filter((a) => a.id !== "totw" && a.id !== "potm");
  const rival = primaryRival(state);
  const sweep = c.results.filter((r) => r.winnerId === uid).length >= 3;

  for (const r of c.results) {
    const winner = state.players[r.winnerId];
    if (winner) giveReputation(winner, r.id, r.leagueId, gained);
    const mine = r.nominees.findIndex((n) => n.playerId === uid);

    if (r.winnerId === uid) {
      wonNow.push(r);
      const rec = toRecord(state, r);
      const prior = before.filter((a) => a.id === r.id);
      let streak = 1;
      while (before.some((a) => a.id === r.id && a.season === state.season - streak)) streak++;
      state.user.awards.push(rec);
      addTimeline(state, { kind: "award", title: `${r.name} — ${r.scope}`, detail: rec.value });
      const rel = RELATIONS[r.id];
      if (rel) for (const k of Object.keys(rel) as (keyof typeof rel)[]) state.user.relationships[k] = clamp(state.user.relationships[k] + (rel[k] ?? 0), 0, 100);
      const rivalBeaten = rival && r.nominees.some((n) => n.playerId === rival.playerId) ? rival.name : undefined;
      rememberSeasonAward(state, { id: r.id, name: r.name, scope: r.scope, clubId: rec.clubId }, { first: prior.length === 0, streak, total: prior.length + 1, overRival: rivalBeaten, sweep });
      const major = r.tier === "major";
      addNews(state, {
        kind: "award",
        title: prior.length === 0 ? `You win your first ${r.name}` : streak >= 3 ? `${streak} in a row: ${r.name}` : `You win ${r.name}`,
        body: `${r.scope} · ${r.nominees[0].reason}${streak === 2 ? " · back to back" : prior.length ? ` · your ${ordinal(prior.length + 1)}` : ""}`,
        important: major || prior.length === 0,
      });
    } else if (mine > 0) {
      (state.user.awardNoms ??= []).push({ season: state.season, id: r.id, name: r.name, scope: r.scope, place: mine + 1 });
    }

    // The user's duels count as rivalry evidence only when they were one of the top two.
    if (["topscorer", "pots", "ypots"].includes(r.id) && r.nominees.length > 1) {
      const [a, b] = r.nominees;
      if (a.playerId === uid || b.playerId === uid) noteAwardDuel(state, r.id, r.name, a.playerId, b.playerId, r.margin);
    }
  }

  // Team of the Season.
  for (const t of c.team) {
    const p = state.players[t.playerId];
    if (p) giveReputation(p, "tots", c.leagueId, gained);
    if (t.playerId === uid) {
      const prior = before.filter((a) => a.id === "tots");
      state.user.awards.push({ season: state.season, id: "tots", name: "Team of the Season", scope: c.leagueName, playerId: uid, clubId: t.clubId, value: t.label });
      addTimeline(state, { kind: "award", title: `Team of the Season — ${c.leagueName}`, detail: t.label });
      rememberSeasonAward(state, { id: "tots", name: "Team of the Season", scope: c.leagueName, clubId: t.clubId }, { first: prior.length === 0, streak: 1, total: prior.length + 1 });
      const rel = RELATIONS.tots;
      state.user.relationships.supporters = clamp(state.user.relationships.supporters + (rel.supporters ?? 0), 0, 100);
      if (prior.length === 0) addNews(state, { kind: "award", title: "You make your first Team of the Season", body: `${c.leagueName} · ${t.label}`, important: true });
    }
  }

  // Other leagues: the winners' careers feel it too.
  for (const o of c.others) {
    const p = state.players[o.playerId];
    if (p) giveReputation(p, o.id, o.leagueId, gained);
    if (p && (o.id === "pots" || o.id === "topscorer") && staticLeague(o.leagueId)?.tier === 1) addNews(state, { kind: "award", title: `${fullName(p)} wins the ${o.scope} ${o.name}` });
  }
  // News for the user's own league's headline winners (when it is not the user).
  for (const r of c.results) {
    if (r.winnerId !== uid && (r.id === "pots" || r.id === "topscorer")) addNews(state, { kind: "award", title: `${fullName(state.players[r.winnerId] ?? me)} is the ${r.scope} ${r.name}`, body: r.nominees[0].reason });
  }

  // Morale for a good night, and a sweep.
  me.morale = clamp(me.morale + Math.min(MORALE_CAP, wonNow.length * MORALE), 0, 100);
  if (sweep) addNews(state, { kind: "award", title: "A clean sweep", body: `You won ${wonNow.map((r) => r.name).join(", ")}.`, important: true });
  updateAwardRecords(state);
}
