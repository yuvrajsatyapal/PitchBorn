/**
 * The Match Day briefing: what the match is, how much it matters, who the user will meet and what the two sides look
 * like. Everything is read from competition, standings, squad and career state; labels like "derby" or "relegation
 * battle" appear only when the table and the rivalry data say so.
 */
import { intlTeam } from "../national/identity";
import { BALANCE } from "../balance";
import { staticClub, stadium, clubName, country } from "../data/world";
import { leagueCompId } from "../competitions/setup";
import { journeyOf } from "../competitions/bracket";
import { clubIdentity, departments, userTacticalFit, type ClubIdentity, type Department, type FitView } from "../club/overview";
import { standingOf, type Standing } from "../club/standing";
import { selectTeam } from "../match/lineup";
import { baseRivalry, rivalryLevel } from "../memory/rivalry";
import { describeMemory } from "../memory/describe";
import { overallFor } from "../players/attributes";
import { ATTR_LABEL } from "../players/model";
import { squadOf, userPlayer } from "../world/helpers";
import type { AttrKey, Competition, Fixture, GameState, Memory, Player } from "../types";
import { adjustRel } from "../career/relationships";
import { isNationalComp, teamSelection } from "./matchday";
import { COMMIT_RATING } from "./commitments";
import { NEWS_MIN } from "../managers/story";
import { meetings, relLabel, withManager, type RelLabel } from "../managers/history";
import type { TenureHonours } from "../types";
import { addStintEvent } from "../managers/history";
import { matchStatus, type MatchStatus } from "./selection";

export type ImportanceTag = "former-boss" | "derby" | "title-decider" | "promotion-battle" | "relegation-battle" | "continental-battle" | "cup-knockout" | "cup-final" | "continental-knockout" | "rival" | "qualifier" | "tournament-knockout";

export const IMPORTANCE_LABEL: Record<ImportanceTag, string> = {
  "former-boss": "Former boss",
  derby: "Derby",
  "title-decider": "Title decider",
  "promotion-battle": "Promotion battle",
  "relegation-battle": "Relegation battle",
  "continental-battle": "Race for Europe",
  "cup-knockout": "Cup knockout",
  "cup-final": "Cup final",
  "continental-knockout": "Continental knockout",
  rival: "Career rival",
  qualifier: "Qualifier",
  "tournament-knockout": "Tournament knockout",
};

export interface TeamLine {
  id: string;
  name: string;
  position: number | null;
  points: number | null;
  form: ("W" | "D" | "L")[];
  isNation: boolean;
}

export interface MatchContext {
  fixtureId: string;
  competition: string;
  stage: string | null;
  neutral: boolean;
  homeAway: "home" | "away" | "neutral";
  stadium: string | null;
  home: TeamLine;
  away: TeamLine;
  tags: ImportanceTag[];
  level: "ordinary" | "notable" | "major";
  /** One sentence on why it matters, built from the tags. */
  summary: string | null;
}

const RUN_IN = BALANCE.calendar.seasonEnd - 8;

function teamLine(state: GameState, id: string, comp: Competition | undefined): TeamLine {
  const club = state.clubs[id];
  const nation = !club;
  const table = comp?.kind === "league" ? comp.table : undefined;
  const idx = table ? table.findIndex((r) => r.team === id) : -1;
  const st = club ? standingOf(state, id) : null;
  const row = idx >= 0 && table ? table[idx] : st?.row;
  return {
    id,
    name: club ? clubName(id) : country(id)?.name ?? id,
    position: comp?.kind === "league" && idx >= 0 && table![idx].played > 0 ? idx + 1 : club && st && st.position !== null && comp?.kind !== "league" ? st.position : null,
    points: row ? row.points : null,
    form: (club ? club.form : state.nationalTeams[id]?.form ?? []).slice(-5),
    isNation: nation,
  };
}

function leagueStakes(state: GameState, f: Fixture, comp: Competition): ImportanceTag[] {
  const tags: ImportanceTag[] = [];
  const a = standingOf(state, f.home);
  const b = standingOf(state, f.away);
  if (!a || !b || a.position === null || b.position === null) return tags;
  const late = state.turn >= RUN_IN;
  if (late && a.position <= 2 && b.position <= 3) tags.push("title-decider");
  if (late && a.tier > 1 && a.position <= a.promoted + 2 && b.position <= b.promoted + 2) tags.push("promotion-battle");
  const slots = a.slots.champions + a.slots.continental;
  if (late && a.tier === 1 && Math.abs(a.position - slots) <= 2 && Math.abs(b.position - slots) <= 2) tags.push("continental-battle");
  const danger = a.relegated + 2;
  if (late && a.relegated > 0 && a.position > a.size - danger && b.position > b.size - danger) tags.push("relegation-battle");
  void comp;
  return tags;
}

export function matchContext(state: GameState, fixture: Fixture): MatchContext | null {
  const comp = state.competitions[fixture.compId];
  if (!comp) return null;
  const u = userPlayer(state);
  const nat = isNationalComp(comp);
  const tags: ImportanceTag[] = [];
  if (!nat && fixture.home && fixture.away) {
    const lvl = rivalryLevel(state, fixture.home, fixture.away);
    if (lvl >= 0.4 && (u.clubId === fixture.home || u.clubId === fixture.away ? rivalryLevel(state, u.clubId, u.clubId === fixture.home ? fixture.away : fixture.home) : baseRivalry(fixture.home, fixture.away)) >= 0.4) tags.push("derby");
  }
  if (comp.kind === "league") tags.push(...leagueStakes(state, fixture, comp));
  const stage = fixture.stage ?? null;
  const final = !!stage && /final/i.test(stage) && !/semi|quarter/i.test(stage);
  if (comp.kind === "cup") tags.push(final ? "cup-final" : "cup-knockout");
  if (comp.kind === "continental" && fixture.group === undefined) tags.push("continental-knockout");
  if (comp.kind === "international") {
    if (stage === "Qualifier") tags.push("qualifier");
    else if (fixture.group === undefined && stage && stage !== "Friendly") tags.push("tournament-knockout");
  }
  const opp = u.clubId === fixture.home ? fixture.away : u.clubId === fixture.away ? fixture.home : null;
  if (opp && state.user.rivalry.rivals.some((r) => r.status === "active" && state.players[r.playerId]?.clubId === opp)) tags.push("rival");
  const fm = opp ? formerManagerContext(state, fixture) : null;
  if (fm && fm.importance >= NEWS_MIN) tags.push("former-boss");
  const major: ImportanceTag[] = ["derby", "title-decider", "promotion-battle", "relegation-battle", "cup-final"];
  const level = tags.some((t) => major.includes(t) && (t !== "derby" || rivalryLevel(state, u.clubId, opp) >= 0.6)) ? "major" : tags.length ? "notable" : "ordinary";
  const stadiumName = nat || fixture.neutral ? null : stadium(staticClub(fixture.home)?.stadiumId ?? "")?.name ?? null;
  const team = u.clubId === fixture.home || u.clubId === fixture.away ? u.clubId : null;
  const homeAway: MatchContext["homeAway"] = fixture.neutral ? "neutral" : team === fixture.home ? "home" : team === fixture.away ? "away" : fixture.home === intlTeam(u) ? "home" : "away";
  return {
    fixtureId: fixture.id,
    competition: comp.name,
    stage,
    neutral: !!fixture.neutral,
    homeAway,
    stadium: stadiumName,
    home: teamLine(state, fixture.home, comp),
    away: teamLine(state, fixture.away, comp),
    tags,
    level,
    summary: tags.length ? tags.map((t) => IMPORTANCE_LABEL[t]).join(" · ") : null,
  };
}

// ------------------------------------------------------------------------------------------------ connections

export interface Connection {
  kind: "standout" | "rival" | "former-teammate" | "former-club";
  text: string;
  playerId?: string;
}

/** People and history that really connect the user to the opposition. Nothing is shown unless it exists. */
export function keyOpponents(state: GameState, fixture: Fixture): Connection[] {
  const u = userPlayer(state);
  const opp = u.clubId === fixture.home ? fixture.away : u.clubId === fixture.away ? fixture.home : null;
  if (!opp || !state.clubs[opp]) return [];
  const out: Connection[] = [];
  const squad = squadOf(state, opp);
  const star = [...squad].sort((a, b) => overallFor(b.attrs, b.position) - overallFor(a.attrs, a.position))[0];
  if (star) out.push({ kind: "standout", playerId: star.id, text: `${star.firstName} ${star.lastName} (${star.position}, ${Math.round(overallFor(star.attrs, star.position))} OVR) is their standout player.` });
  for (const rv of state.user.rivalry.rivals) {
    const p = state.players[rv.playerId];
    if (rv.status !== "ended" && p?.clubId === opp) out.push({ kind: "rival", playerId: p.id, text: `Your career rival ${p.firstName} ${p.lastName} plays for them.` });
  }
  if (u.history.some((h) => h.clubId === opp && h.stats.apps > 0)) out.push({ kind: "former-club", text: `You used to play for ${clubName(opp, true)}.` });
  const mine = new Map(u.history.filter((h) => h.clubId).map((h) => [h.season, h.clubId as string]));
  for (const p of squad) {
    if (p.isUser) continue;
    const together = p.history.find((h) => h.clubId && mine.get(h.season) === h.clubId && h.stats.apps > 0 && h.clubId !== opp);
    if (together) out.push({ kind: "former-teammate", playerId: p.id, text: `Former teammate ${p.firstName} ${p.lastName} (together at ${clubName(together.clubId, true)}).` });
    if (out.filter((o) => o.kind === "former-teammate").length >= 2) break;
  }
  return out.slice(0, 5);
}

export interface H2H {
  meetings: { season: number; turn: number; score: [number, number]; result: "W" | "D" | "L"; comp: string; goals: number; rating: number }[];
  record: { w: number; d: number; l: number };
  memory: { line: string; title: string } | null;
}

/** Previous meetings the user played in, and the strongest memory of this opponent. */
export function headToHead(state: GameState, fixture: Fixture): H2H | null {
  const u = userPlayer(state);
  const opp = u.clubId === fixture.home ? fixture.away : u.clubId === fixture.away ? fixture.home : null;
  if (!opp) return null;
  const log = (state.user.matchLog ?? []).filter((e) => e.opponent === opp && !e.fixtureId.startsWith("legacy-") && e.team === u.clubId);
  const meetings = log.slice(-5).reverse().map((e) => ({ season: e.season, turn: e.turn, score: e.score, result: e.result, comp: state.competitions[e.compId]?.shortName ?? e.compId, goals: e.goals, rating: e.rating }));
  const record = { w: log.filter((e) => e.result === "W").length, d: log.filter((e) => e.result === "D").length, l: log.filter((e) => e.result === "L").length };
  const mem: Memory | undefined = state.user.memories.filter((m) => (m.opponentId === opp || m.rivalId === opp) && m.kind !== "rivalry").sort((a, b) => b.importance - a.importance)[0];
  const view = mem ? describeMemory(state, mem) : null;
  if (!meetings.length && !view) return null;
  return { meetings, record, memory: view ? { line: view.line, title: view.title } : null };
}

// ------------------------------------------------------------------------------------------------ tactics

export interface Duel {
  yours: { name: string; ovr: number };
  theirs: { name: string; ovr: number; position: string };
  edges: string[];
}

export interface TacticalPreview {
  mine: { formation: string; identity: ClubIdentity; departments: Department[] };
  theirs: { formation: string; identity: ClubIdentity; departments: Department[] } | null;
  strengths: string[];
  weaknesses: string[];
  fit: FitView | null;
  duel: Duel | null;
  /** Only claims the engine really implements. */
  note: string;
}

const MIRROR: Record<string, string[]> = {
  ST: ["CB"], RW: ["LB"], LW: ["RB"], AM: ["DM", "CM"], CM: ["CM", "DM"], DM: ["AM", "CM"], CB: ["ST"], RB: ["LW"], LB: ["RW"], GK: ["ST"],
};
const DUEL_ATTRS: Record<string, (keyof Player["attrs"])[]> = {
  ST: ["finishing", "offBall", "pace", "strength", "heading", "jumping"], RW: ["pace", "agility", "dribbling", "crossing"], LW: ["pace", "agility", "dribbling", "crossing"],
  AM: ["creativity", "vision", "passing", "dribbling", "offBall"], CM: ["passing", "stamina", "tackling", "workRate", "decisions"],
  DM: ["tackling", "positioning", "interceptions", "strength", "anticipation"], CB: ["tackling", "marking", "heading", "jumping", "strength", "pace"],
  RB: ["pace", "tackling", "stamina", "marking"], LB: ["pace", "tackling", "stamina", "marking"], GK: ["reflexes", "handling", "oneOnOnes", "command"],
};

export function tacticalPreview(state: GameState, fixture: Fixture): TacticalPreview | null {
  const u = userPlayer(state);
  if (!u.clubId || (fixture.home !== u.clubId && fixture.away !== u.clubId) || isNationalComp(state.competitions[fixture.compId])) return null;
  const club = state.clubs[u.clubId];
  const oppId = fixture.home === u.clubId ? fixture.away : fixture.home;
  const opp = state.clubs[oppId];
  if (!opp) return null;
  const myDepts = departments(state, club.id);
  const theirDepts = departments(state, opp.id);
  const strongest = [...theirDepts].sort((a, b) => a.rank - b.rank)[0];
  const weakest = [...theirDepts].sort((a, b) => b.rank - a.rank)[0];
  const strengths = [strongest.rank <= strongest.of / 3 ? `${clubName(oppId, true)}'s best area is ${strongest.label.toLowerCase()} (${ord(strongest.rank)} of ${strongest.of} in the league).` : `${clubName(oppId, true)} have no standout area: their best, ${strongest.label.toLowerCase()}, is ${ord(strongest.rank)} of ${strongest.of}.`];
  const weaknesses = weakest.rank > weakest.of / 2 ? [`Their ${weakest.label.toLowerCase()} is ranked ${ord(weakest.rank)} of ${weakest.of}.`] : [];
  // The likely opposing player for the user's role, from the line-up they would pick.
  const likely = selectTeam(squadOf(state, oppId), opp.formation, null, { style: opp.style });
  const mirror = MIRROR[u.position] ?? [];
  const facing = likely.starters.find((s) => mirror.includes(s.slot));
  const attrs = DUEL_ATTRS[u.position] ?? [];
  const duel: Duel | null = facing
    ? {
        yours: { name: u.lastName, ovr: Math.round(overallFor(u.attrs, u.position)) },
        theirs: { name: facing.player.lastName, ovr: Math.round(overallFor(facing.player.attrs, facing.slot)), position: facing.slot },
        edges: attrs.map((a) => ({ a, d: u.attrs[a] - facing.player.attrs[a] })).filter((x) => Math.abs(x.d) >= 8).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 2).map((x) => `${ATTR_LABEL[x.a as AttrKey].toLowerCase()} ${x.d > 0 ? "+" : ""}${Math.round(x.d)}`),
      }
    : null;
  return {
    mine: { formation: club.formation, identity: clubIdentity(state, club), departments: myDepts },
    theirs: { formation: opp.formation, identity: clubIdentity(state, opp), departments: theirDepts },
    strengths,
    weaknesses,
    fit: userTacticalFit(state, club),
    duel,
    note: "Styles shift a team's midfield control and chance creation by a few percent either way; line-ups shown for the opposition are the XI they would most likely pick.",
  };
}

const ord = (n: number) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

// ------------------------------------------------------------------------------------------------ pre-match actions

export type PreMatchKind = "ask-start" | "accept-bench" | "commit" | "discuss";

export const PREMATCH_COOLDOWN: Record<PreMatchKind, number> = { "ask-start": 8, "accept-bench": 6, commit: 10, discuss: 16 };

export interface PreMatchAction {
  kind: PreMatchKind;
  label: string;
  hint: string;
  enabled: boolean;
  /** Why it can't be used right now. */
  why?: string;
}


export function preMatchActions(state: GameState, fixture: Fixture, status: MatchStatus = matchStatus(state, fixture)): PreMatchAction[] {
  const u = userPlayer(state);
  const comp = state.competitions[fixture.compId];
  if (!u.clubId || isNationalComp(comp) || state.user.retired || status.teamId !== u.clubId) return [];
  const last = state.user.preMatch?.last ?? {};
  const wait = (k: PreMatchKind) => {
    const left = (last[k] ?? -999) + PREMATCH_COOLDOWN[k] - state.turnIndex;
    return left > 0 ? `Again in ${left} week${left === 1 ? "" : "s"}` : undefined;
  };
  const healthy = !u.injury && u.suspension <= 0;
  const out: PreMatchAction[] = [];
  const asked = state.user.preMatch?.requestedStart?.fixtureId === fixture.id;
  if (healthy && (status.status === "bench" || status.status === "not-selected")) {
    const why = asked ? "Already asked for this match" : wait("ask-start");
    out.push({ kind: "ask-start", label: "Ask for a start", hint: "The manager may give you a chance. Pushing too hard costs trust.", enabled: !why, why });
  }
  if (healthy && status.status === "bench") {
    const why = state.user.preMatch?.acceptedBench?.fixtureId === fixture.id ? "Already agreed for this match" : wait("accept-bench");
    out.push({ kind: "accept-bench", label: "Accept a substitute role", hint: "Show you're a team player: the manager notices.", enabled: !why, why });
  }
  if (healthy && (status.status === "starting" || status.status === "bench")) {
    const pending = state.user.preMatch?.commitment?.fixtureId === fixture.id;
    const why = pending ? "You've already made a promise for this match" : wait("commit");
    out.push({ kind: "commit", label: `Promise a ${COMMIT_RATING.toFixed(1)}+ display`, hint: "Deliver and the manager's trust grows. Fall short and it takes a hit.", enabled: !why, why });
  }
  if (healthy) {
    const why = wait("discuss");
    out.push({ kind: "discuss", label: "Discuss your role", hint: "Talk tactics with the manager for honest feedback.", enabled: !why, why });
  }
  return out;
}

export interface PreMatchResult {
  ok: boolean;
  message: string;
}

export function performPreMatch(state: GameState, fixtureId: string, kind: PreMatchKind): PreMatchResult {
  let fixture: Fixture | undefined;
  for (const c of Object.values(state.competitions)) fixture ??= c.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || fixture.result) return { ok: false, message: "That match isn't pending." };
  const status = matchStatus(state, fixture);
  const action = preMatchActions(state, fixture, status).find((a) => a.kind === kind);
  if (!action) return { ok: false, message: "That isn't available right now." };
  if (!action.enabled) return { ok: false, message: action.why ?? "Not available." };
  const u = userPlayer(state);
  const club = state.clubs[u.clubId as string];
  const pm = (state.user.preMatch ??= { last: {} });
  pm.last[kind] = state.turnIndex;
  const trust = state.user.relationships.manager;
  if (kind === "ask-start") {
    if (trust >= 45) {
      pm.requestedStart = { fixtureId, index: state.turnIndex };
      adjustRel(state, "manager", -1.5, "Asked the manager for a start");
      return { ok: true, message: `${club.manager.name} will consider it. You're given a better chance of starting.` };
    }
    adjustRel(state, "manager", -4, "Asked for a start without the manager's trust");
    return { ok: false, message: `${club.manager.name} doesn't appreciate being asked. Earn some trust first.` };
  }
  if (kind === "accept-bench") {
    pm.acceptedBench = { fixtureId };
    adjustRel(state, "manager", 2.5, "Accepted a substitute role");
    adjustRel(state, "teammates", 1, "Accepted a substitute role");
    return { ok: true, message: "The manager appreciates it. Be ready when called." };
  }
  if (kind === "commit") {
    pm.commitment = { fixtureId, kind: "performance", rating: COMMIT_RATING, index: state.turnIndex };
    return { ok: true, message: `You've promised ${COMMIT_RATING.toFixed(1)}+. The manager will judge you on it.` };
  }
  const fit = userTacticalFit(state, club);
  adjustRel(state, "manager", fit.score >= 55 ? 2 : 1, "Talked through your role with the manager");
  addStintEvent(state, "talk");
  return { ok: true, message: `${club.manager.name}: "${fit.label} for how we play (${fit.score}/100). ${fit.note}"` };
}

export { leagueCompId, journeyOf };
export type { Standing };

// ------------------------------------------------------------------------------------------------ former manager

export interface FormerManagerContext {
  managerId: string;
  name: string;
  /** "You played under him at Milan for three seasons." */
  together: string;
  seasons: number;
  apps: number;
  honours: TenureHonours;
  honoursText: string;
  relationship: RelLabel;
  /** How many matches against his sides so far, and which one this is. */
  meeting: number;
  first: boolean;
  headline: string;
  importance: number;
  /** The same club is also a former club of the user's. */
  alsoFormerClub: boolean;
  breakthrough: boolean;
}

/**
 * The opposing manager, when the user genuinely played under him: seasons together, how it ended and what they won.
 * Only facts the game tracked (appearances, honours, the relationship when they parted). Null for any other manager.
 */
export function formerManagerContext(state: GameState, fixture: Fixture): FormerManagerContext | null {
  const u = userPlayer(state);
  const comp = state.competitions[fixture.compId];
  if (!u.clubId || !comp || isNationalComp(comp)) return null;
  const opp = fixture.home === u.clubId ? fixture.away : fixture.home;
  const id = state.clubs[opp]?.manager.id;
  if (!id) return null;
  const w = withManager(state, id);
  if (!w || w.together) return null;
  const n = meetings(state, id);
  const bits: string[] = [];
  if (w.honours.league) bits.push(`${w.honours.league} league title${w.honours.league > 1 ? "s" : ""}`);
  if (w.honours.continental) bits.push(`${w.honours.continental} continental trophy${w.honours.continental > 1 ? "s" : ""}`);
  if (w.honours.cup) bits.push(`${w.honours.cup} cup${w.honours.cup > 1 ? "s" : ""}`);
  if (w.honours.promotions) bits.push(`${w.honours.promotions} promotion${w.honours.promotions > 1 ? "s" : ""}`);
  const home = clubName(w.clubs[w.clubs.length - 1], true);
  const first = n === 0;
  const ord = ["", "first", "second", "third", "fourth", "fifth"][n + 1] ?? `${n + 1}th`;
  return {
    managerId: id,
    name: w.name,
    together: `You played under ${w.name} at ${w.clubs.map((c) => clubName(c, true)).join(" and ")} for ${w.seasons} season${w.seasons === 1 ? "" : "s"}.`,
    seasons: w.seasons,
    apps: w.apps,
    honours: w.honours,
    honoursText: bits.join(" · "),
    relationship: relLabel(w.rel),
    meeting: n + 1,
    first,
    headline: first ? `You're facing your former manager for the first time since leaving ${home}.` : `${ord[0].toUpperCase()}${ord.slice(1)} meeting with your former manager.`,
    importance: w.importance,
    alsoFormerClub: u.history.some((h) => h.clubId === opp && h.stats.apps > 0),
    breakthrough: w.breakthrough,
  };
}

// ------------------------------------------------------------------------------------------------------ line-ups

export interface LineupPlayer {
  id: string;
  no: number | null;
  name: string;
  position: string;
  slot?: string;
  isUser: boolean;
}

export interface LineupSide {
  teamId: string;
  formation: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  /** The user's own side is exactly the one that plays; the other is the line-up it would most likely pick. */
  exact: boolean;
}

/** Both sides' squad numbers as they appear on the team sheet: a club number for clubs, the squad number for a nation. */
export function lineupView(state: GameState, fixture: Fixture): { home: LineupSide; away: LineupSide } | null {
  const comp = state.competitions[fixture.compId];
  if (!comp) return null;
  const nat = isNationalComp(comp);
  const u = userPlayer(state);
  const side = (teamId: string): LineupSide => {
    const sel = selectionForView(state, fixture, teamId);
    const numberOf = (id: string): number | null => (nat ? state.nationalTeams[teamId]?.numbers?.[id] ?? null : state.players[id]?.squadNo ?? null);
    const row = (p: { id: string; lastName: string; firstName: string; position: string }, slot?: string): LineupPlayer => ({ id: p.id, no: numberOf(p.id), name: `${p.firstName[0]}. ${p.lastName}`, position: p.position, slot, isUser: p.id === u.id });
    const withUser = nat ? !!state.nationalTeams[teamId]?.squad.includes(u.id) : u.clubId === teamId;
    return {
      teamId,
      formation: state.clubs[teamId]?.formation ?? "4-3-3",
      starters: sel.starters.map((s) => row(s.player, s.slot)),
      bench: sel.bench.map((p) => row(p)),
      exact: withUser,
    };
  };
  return { home: side(fixture.home), away: side(fixture.away) };
}

function selectionForView(state: GameState, fixture: Fixture, teamId: string) {
  return teamSelection(state, teamId, fixture, null);
}
