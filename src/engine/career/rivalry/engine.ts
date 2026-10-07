/**
 * Emergent player rivalries.
 *
 * Nobody is a rival by default. Other players collect points as candidates when something meaningful happens between
 * them and the user (a final, a derby, a goal duel, a Golden Boot race, an award squeezed out, a shirt fought over,
 * a record taken), and only a rare candidate with enough weight from enough different causes is promoted. Once a
 * rival, intensity (0–100) moves with context, never with raw encounter counts, and fades with distance and time.
 * Media comparisons add a small, capped nudge and can never create a rivalry alone.
 *
 * It is deterministic and draws no random numbers, so adding it does not change any existing seed.
 */
import { clubName, country } from "../../data/world";
import { rivalryLevel } from "../../memory/rivalry";
import { Factors } from "../../memory/score";
import { recordMemory } from "../../memory/store";
import type { MatchResult } from "../../match/engine";
import { leagueCompId } from "../../competitions/setup";
import { overallFor, positionGroup } from "../../players/attributes";
import { ageOf } from "../../players/generate";
import { clamp } from "../../rng";
import type { Competition, Fixture, GameState, Player, PlayerRival, RivalCandidate, RivalEvent, RivalEventKind, RivalMeeting, RivalryState, TransferSaga } from "../../types";
import { addNews, addTimeline, fullName, squadOf, userPlayer } from "../../world/helpers";
import { BALANCE } from "../../balance";

type Line = MatchResult["lines"][number];

/** Evidence a candidate needs before becoming a rival, and the higher bar when the evidence is only international. */
export const PROMOTE_POINTS = 20;
export const PROMOTE_INTL_ONLY = 30;
/** Turns that must pass between one rivalry forming and the next. */
export const FORM_GAP = 24;
export const MAX_ACTIVE = 3;
const MEDIA_CAP_CANDIDATE = 4;
/** Most points ordinary meetings can ever give a candidate, and the intensity above which they stop moving a rivalry. */
const PLAIN_CAP = 6;
const PLAIN_FADE = 45;
const MEDIA_CAP_RIVAL = 10;
const MEDIA_GAP = 8;
const MAX_CANDIDATES = 12;
const MAX_MEETINGS = 40;
const MAX_EVENTS = 50;
/** Idle turns before a rivalry starts to cool, and the intensity below which it is dormant or over. */
const IDLE_TURNS = 16;
const DORMANT_BELOW = 26;
const ENDED_BELOW = 8;
const ENDED_IDLE = 150;
const MEANINGFUL = new Set(["derby", "final", "knockout", "decider", "duel", "incident", "race", "award", "transfer", "record"]);

export const rivalryOf = (state: GameState): RivalryState => state.user.rivalry;
const live = (r: PlayerRival) => r.status !== "ended";

export function intensityLabel(i: number): string {
  return i >= 85 ? "Defining" : i >= 65 ? "Bitter" : i >= 45 ? "Heated" : i >= 25 ? "Growing" : "Simmering";
}

/** The primary rivalry is whichever active one is hottest, so a minor rival can overtake the main one. */
export function primaryRival(state: GameState): PlayerRival | undefined {
  return [...rivalryOf(state).rivals].filter((r) => r.status === "active").sort((a, b) => b.intensity - a.intensity)[0];
}

export function rivalsByIntensity(state: GameState): PlayerRival[] {
  return [...rivalryOf(state).rivals].sort((a, b) => Number(live(b)) - Number(live(a)) || b.intensity - a.intensity);
}

const ovr = (p: Player) => overallFor(p.attrs, p.position);

/** How alike two players' profiles are: shared position, similar age and standing make a rivalry likelier. */
function profileFactor(state: GameState, me: Player, other: Player): number {
  let f = 1;
  f *= me.position === other.position ? 1.25 : positionGroup(me.position) === positionGroup(other.position) ? 1.1 : 0.8;
  const ageGap = Math.abs(ageOf(me, state.season) - ageOf(other, state.season));
  f *= ageGap <= 3 ? 1.1 : ageGap >= 8 ? 0.8 : 1;
  const repGap = Math.abs(me.reputation - other.reputation);
  f *= repGap <= 15 ? 1.1 : repGap > 35 ? 0.8 : 1;
  return clamp(f, 0.6, 1.5);
}

/** A peer worth tracking: not retired, not far below the user's level, and not from another generation. */
function relevant(state: GameState, me: Player, other: Player | undefined): other is Player {
  if (!other || other.isUser || other.retired || other.id === me.id) return false;
  return ovr(other) >= ovr(me) - 8 && Math.abs(ageOf(me, state.season) - ageOf(other, state.season)) <= 8;
}

function pushEvent(list: RivalEvent[], state: GameState, kind: RivalEventKind, text: string): void {
  list.push({ season: state.season, turn: state.turn, kind, text });
  if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
}

const rivalFor = (state: GameState, id: string) => rivalryOf(state).rivals.find((r) => r.playerId === id);

// --------------------------------------------------------------------------- evidence

interface Evidence {
  points: number;
  cause: string;
  text: string;
  intl?: boolean;
  media?: boolean;
  /** Counts toward promotion but is not added to an existing rivalry's intensity (already applied elsewhere). */
  meeting?: RivalMeeting;
}

function addIntensity(state: GameState, rv: PlayerRival, ev: Evidence): void {
  const cap = ev.media ? Math.max(0, MEDIA_CAP_RIVAL - rv.media) : Infinity;
  // Ordinary meetings fade to nothing as a rivalry heats up: only moments with something at stake keep it burning.
  const plainFade = ev.cause === "meeting" ? clamp((PLAIN_FADE - rv.intensity) / PLAIN_FADE, 0, 1) : 1;
  const pts = Math.min(ev.points * plainFade, cap);
  if (pts <= 0) return;
  if (ev.media) rv.media += pts;
  rv.intensity = clamp(rv.intensity + pts * 1.5 * (1 - rv.intensity / 130), 0, 100);
  rv.peak = Math.max(rv.peak, rv.intensity);
  if (!ev.media) rv.lastContactIndex = state.turnIndex;
  if (!rv.causes.includes(ev.cause) && ev.cause !== "meeting") rv.causes.push(ev.cause);
  if (rv.status === "dormant" && rv.intensity >= DORMANT_BELOW + 6 && !ev.media) {
    rv.status = "active";
    pushEvent(rv.events, state, "meeting", "The rivalry flares up again.");
  }
}

function recordMeeting(list: RivalMeeting[], m: RivalMeeting): void {
  list.push(m);
  if (list.length > MAX_MEETINGS) list.splice(0, list.length - MAX_MEETINGS);
}

function tally(rv: PlayerRival, m: RivalMeeting): void {
  const h = rv.h2h;
  h.meetings++;
  if (m.result === "win") h.wins++;
  else if (m.result === "loss") h.losses++;
  else h.draws++;
  h.myGoals += m.myGoals;
  h.theirGoals += m.theirGoals;
}

function candidateFor(state: GameState, id: string): RivalCandidate {
  const r = rivalryOf(state);
  let c = r.candidates[id];
  if (!c) {
    c = r.candidates[id] = { points: 0, intl: 0, media: 0, causes: [], lastIndex: state.turnIndex, meetings: [], events: [] };
    const ids = Object.keys(r.candidates);
    if (ids.length > MAX_CANDIDATES) {
      const weakest = ids.filter((x) => x !== id).sort((a, b) => r.candidates[a].points - r.candidates[b].points || r.candidates[a].lastIndex - r.candidates[b].lastIndex)[0];
      if (weakest) delete r.candidates[weakest];
    }
  }
  return c;
}

/** Records something between the user and another player, as intensity if they are a rival or as candidate points if not. */
function addEvidence(state: GameState, other: Player, ev: Evidence): void {
  const rv = rivalFor(state, other.id);
  if (rv && live(rv)) {
    addIntensity(state, rv, ev);
    if (ev.meeting) {
      recordMeeting(rv.meetings, ev.meeting);
      tally(rv, ev.meeting);
    }
    if (ev.text) pushEvent(rv.events, state, ev.media ? "media" : kindFor(ev.cause), ev.text);
    rv.clubId = other.clubId;
    return;
  }
  const c = candidateFor(state, other.id);
  if (ev.media) {
    // Only players already building a case get a media nudge, and it is small and capped.
    if (c.points - c.media < 6) return;
    c.media = Math.min(MEDIA_CAP_CANDIDATE, c.media + ev.points);
  } else {
    let pts = ev.points;
    if (ev.cause === "meeting") {
      pts = Math.min(pts, Math.max(0, PLAIN_CAP - (c.plain ?? 0)));
      c.plain = (c.plain ?? 0) + pts;
    }
    c.points += pts;
    if (ev.intl) c.intl += pts;
    if (!c.causes.includes(ev.cause)) c.causes.push(ev.cause);
  }
  c.lastIndex = state.turnIndex;
  if (ev.meeting) recordMeeting(c.meetings, ev.meeting);
  if (ev.text && !ev.media) pushEvent(c.events, state, kindFor(ev.cause), ev.text);
  tryPromote(state, other, c);
}

const EVENT_KINDS: Record<string, RivalEventKind> = { race: "race", award: "award", transfer: "transfer", incident: "incident", record: "record" };
const kindFor = (cause: string): RivalEventKind => EVENT_KINDS[cause] ?? "meeting";

function tryPromote(state: GameState, other: Player, c: RivalCandidate): void {
  const r = rivalryOf(state);
  const me = userPlayer(state);
  const own = c.points; // media is held separately, so it never counts here
  const intlOnly = own - c.intl < 8;
  if (own < (intlOnly ? PROMOTE_INTL_ONLY : PROMOTE_POINTS)) return;
  if (c.causes.length < 2 || !c.causes.some((x) => MEANINGFUL.has(x))) return;
  if (state.turnIndex - r.lastFormedIndex < FORM_GAP) return;
  if (!relevant(state, me, other)) return;
  const active = r.rivals.filter((x) => x.status === "active");
  if (active.length >= MAX_ACTIVE) {
    const weakest = [...active].sort((a, b) => a.intensity - b.intensity)[0];
    if (own < weakest.intensity + 10) return;
    weakest.status = "dormant";
    pushEvent(weakest.events, state, "cooled", `${fullName(other)} has taken over as the bigger story.`);
  }
  const name = fullName(other);
  const rv: PlayerRival = {
    playerId: other.id,
    name,
    clubId: other.clubId,
    since: { season: state.season, turn: state.turn },
    intensity: clamp(28 + (own - PROMOTE_POINTS) * 0.8, 28, 55),
    peak: 0,
    status: "active",
    causes: [...c.causes],
    lastContactIndex: state.turnIndex,
    media: c.media,
    lastNewsIndex: state.turnIndex,
    h2h: { meetings: 0, wins: 0, draws: 0, losses: 0, myGoals: 0, theirGoals: 0 },
    meetings: [],
    events: [...c.events],
  };
  rv.peak = rv.intensity;
  for (const m of c.meetings) {
    recordMeeting(rv.meetings, m);
    tally(rv, m);
  }
  pushEvent(rv.events, state, "formed", `A rivalry takes shape between you and ${name}.`);
  const i = r.rivals.findIndex((x) => x.playerId === other.id);
  if (i >= 0) r.rivals.splice(i, 1);
  r.rivals.push(rv);
  delete r.candidates[other.id];
  r.lastFormedIndex = state.turnIndex;
  addTimeline(state, { kind: "event", title: `A rivalry with ${name} begins`, detail: causeSummary(rv) });
  addNews(state, { kind: "career", title: `A rivalry is born: you vs ${name}`, body: `${causeSummary(rv)}${other.clubId ? ` · ${clubName(other.clubId, true)}` : ""}`, important: true });
  const f = new Factors().add("A rival emerges", 24 + Math.min(12, own * 0.3));
  recordMemory(state, { kind: "rivalry", clubId: other.clubId, tags: ["rivalry"], factors: f, key: `formed-${other.id}`, data: { rival: other.id, name, event: "formed" } });
}

const CAUSE_TEXT: Record<string, string> = {
  derby: "derby clashes", final: "a final", knockout: "knockout ties", decider: "a title decider", duel: "goal-for-goal duels", incident: "an ugly moment",
  race: "a Golden Boot race", award: "an award battle", transfer: "a fight for the same place", record: "a record", intl: "international clashes", meeting: "repeated meetings",
};
export function causeSummary(rv: Pick<PlayerRival, "causes">): string {
  const parts = rv.causes.filter((c) => c in CAUSE_TEXT && c !== "meeting").slice(0, 3).map((c) => CAUSE_TEXT[c]);
  return parts.length ? `Built on ${parts.join(", ")}.` : "Built on repeated meetings.";
}

// --------------------------------------------------------------------------- matches

const minutesOf = (l: Line) => Math.max(0, (l.minuteOff ?? 90) - l.minuteOn);

/**
 * After one of the user's matches: weigh what happened between the user and the players opposite. Existing rivals
 * who played are updated; otherwise the most likely opponents collect candidate points.
 */
export function noteMatch(state: GameState, fixture: Fixture, comp: Competition, res: MatchResult, line: Line): void {
  const me = userPlayer(state);
  if (state.user.retired || minutesOf(line) < 15) return;
  const nat = comp.kind === "international";
  const side = line.side;
  const myTeamGoals = side === "home" ? res.homeGoals : res.awayGoals;
  const theirTeamGoals = side === "home" ? res.awayGoals : res.homeGoals;
  const result: RivalMeeting["result"] = myTeamGoals > theirTeamGoals ? "win" : myTeamGoals < theirTeamGoals ? "loss" : "draw";
  const opposite = res.lines.filter((l) => l.side !== side && minutesOf(l) >= 15);
  if (!opposite.length) return;

  const rivalIds = new Set(rivalryOf(state).rivals.filter(live).map((r) => r.playerId));
  const myGroup = positionGroup(me.position);
  const tracked: { line: Line; other: Player; known: boolean }[] = [];
  for (const l of opposite) {
    const other = state.players[l.id];
    if (rivalIds.has(l.id) && other) tracked.push({ line: l, other, known: true });
  }
  // Up to two fresh candidates: direct opposite numbers and anyone who made a mark on the game.
  const fresh = opposite
    .map((l) => ({ l, p: state.players[l.id] }))
    .filter((x) => !rivalIds.has(x.l.id) && relevant(state, me, x.p) && (positionGroup(x.p.position) === myGroup || x.l.goals > 0))
    .map((x) => ({ ...x, score: profileFactor(state, me, x.p) * (1 + x.l.goals * 0.6 + Math.max(0, x.l.rating - 6.6) * 0.25) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  for (const f of fresh) tracked.push({ line: f.l, other: f.p, known: false });

  const stage = fixture.stage ?? "";
  const isFinal = /final/i.test(stage) && !/semi|quarter/i.test(stage);
  const isKnockout = /final|semi|quarter|round of|knock|play/i.test(stage);
  const mine = side === "home" ? fixture.home : fixture.away;
  const oppTeam = side === "home" ? fixture.away : fixture.home;
  const derby = !nat && rivalryLevel(state, mine, oppTeam) >= 0.5;
  const decider = !nat && comp.kind === "league" && state.turn >= BALANCE.calendar.seasonEnd - 7 && decidesTitle(comp, mine, oppTeam);
  const qualifier = nat && /qualif/i.test(comp.name + stage);
  const redIds = new Set(res.events.filter((e) => e.type === "red" && e.playerId).map((e) => e.playerId as string));

  for (const t of tracked) {
    const myGoals = line.goals;
    const theirGoals = t.line.goals;
    let w = nat ? 0.6 : 0.9;
    const causes: string[] = [];
    const add = (pts: number, cause?: string) => {
      w += pts;
      if (cause) causes.push(cause);
    };
    if (derby) add(3, "derby");
    if (isFinal) add(nat ? 9 : comp.kind === "continental" ? 8 : 6, "final");
    else if (isKnockout) add(nat ? 4 : comp.kind === "continental" ? 3 : 2, "knockout");
    if (qualifier) add(4, "knockout");
    if (decider) add(5, "decider");
    if (myGoals >= 3) add(3);
    else if (myGoals === 2) add(1.5);
    if (theirGoals >= 2) add(2);
    if (myGoals > 0 && theirGoals > 0) add(1.5, "duel");
    else if (myGoals >= 2 || theirGoals >= 2) causes.push("duel");
    if (redIds.has(me.id) || redIds.has(t.other.id)) add(3, "incident");
    const factor = profileFactor(state, me, t.other);
    const points = w * factor;
    const meeting: RivalMeeting = {
      season: state.season,
      turn: state.turn,
      fixtureId: fixture.id,
      compId: comp.id,
      compName: comp.name,
      stage: stage || undefined,
      intl: nat,
      score: [myTeamGoals, theirTeamGoals],
      myGoals,
      theirGoals,
      result,
      weight: Math.round(points * 10) / 10,
    };
    if (nat) causes.push("intl");
    const main = causes[0] ?? "meeting";
    for (const c of causes.slice(1)) {
      const rv = rivalFor(state, t.other.id);
      if (rv && live(rv) && !rv.causes.includes(c)) rv.causes.push(c);
      else if (!rv) {
        const cand = candidateFor(state, t.other.id);
        if (!cand.causes.includes(c)) cand.causes.push(c);
      }
    }
    const text = `${fullName(t.other)}: ${myTeamGoals}–${theirTeamGoals} (${comp.name}${stage ? ` ${stage}` : ""}) · you ${myGoals}, ${fullName(t.other).split(" ").slice(-1)[0]} ${theirGoals}`;
    addEvidence(state, t.other, { points, cause: main, text: causes.length || points >= 4 ? text : "", intl: nat, meeting });
    const rv = rivalFor(state, t.other.id);
    if (rv && live(rv) && t.known) meetingAftermath(state, rv, meeting, points);
  }
}

function decidesTitle(comp: Competition, a: string, b: string): boolean {
  const table = comp.table;
  if (!table) return false;
  const pos = (id: string) => table.findIndex((r) => r.team === id) + 1;
  return pos(a) > 0 && pos(a) <= 2 && pos(b) > 0 && pos(b) <= 2;
}

/** News and, for the biggest duels, a memory. Ordinary league meetings stay quiet. */
function meetingAftermath(state: GameState, rv: PlayerRival, m: RivalMeeting, points: number): void {
  if (points >= 4) {
    const verdict = m.myGoals > m.theirGoals ? "You came out on top" : m.myGoals < m.theirGoals ? "They had the better of it" : m.result === "win" ? "You took the points" : m.result === "loss" ? "They took the points" : "Honours even";
    addNews(state, { kind: "career", title: `Rivalry: you vs ${rv.name}`, body: `${m.compName}${m.stage ? ` · ${m.stage}` : ""} · ${m.score[0]}–${m.score[1]} · ${verdict}`, important: points >= 7 });
    rv.lastNewsIndex = state.turnIndex;
  }
  if (points >= 8) {
    const f = new Factors().add("Face to face with your rival", Math.min(26, points * 2 + rv.intensity * 0.1));
    recordMemory(state, { kind: "rivalry", clubId: userPlayer(state).clubId, fixtureId: m.fixtureId, opponentId: rv.clubId ?? undefined, compId: m.compId, compName: m.compName, stage: m.stage, score: m.score, outcome: m.result, tags: ["rivalry"], factors: f, data: { rival: rv.playerId, name: rv.name, event: "duel" } });
  }
}

/** Extra importance for a match memory when the user faced a rival in it. */
export function rivalMatchBonus(state: GameState, fixtureId: string): { rival: PlayerRival; bonus: number } | null {
  for (const rv of rivalryOf(state).rivals) {
    const m = rv.meetings.find((x) => x.fixtureId === fixtureId);
    if (m) return { rival: rv, bonus: Math.min(16, 4 + m.weight * 1.1 + rv.intensity * 0.08) };
  }
  return null;
}

// --------------------------------------------------------------------------- weekly

function leaguePlayers(state: GameState, leagueId: string): Player[] {
  return (state.leagueClubs[leagueId] ?? []).flatMap((c) => squadOf(state, c));
}

export interface Race {
  mine: number;
  theirs: number;
  rank: number;
  theirRank: number;
}

/** Where the user and a rival stand in the league scoring table, if they play in the same league. */
export function raceStanding(state: GameState, rv: PlayerRival): Race | null {
  const me = userPlayer(state);
  const rival = state.players[rv.playerId];
  const league = me.clubId ? state.clubs[me.clubId]?.leagueId : undefined;
  if (!league || !rival?.clubId || state.clubs[rival.clubId]?.leagueId !== league) return null;
  const compId = leagueCompId(league, state.season);
  const goals = (p: Player) => p.season[compId]?.goals ?? 0;
  const table = leaguePlayers(state, league).sort((a, b) => goals(b) - goals(a));
  const rank = table.findIndex((p) => p.id === me.id) + 1;
  const theirRank = table.findIndex((p) => p.id === rival.id) + 1;
  if (!rank || !theirRank) return null;
  return { mine: goals(me), theirs: goals(rival), rank, theirRank };
}

function racesCheck(state: GameState): void {
  const me = userPlayer(state);
  const league = me.clubId ? state.clubs[me.clubId]?.leagueId : undefined;
  if (!league) return;
  const compId = leagueCompId(league, state.season);
  const goals = (p: Player) => p.season[compId]?.goals ?? 0;
  const table = leaguePlayers(state, league).sort((a, b) => goals(b) - goals(a)).slice(0, 5);
  const myGoals = goals(me);
  const rank = table.findIndex((p) => p.id === me.id) + 1;
  if (myGoals < 6 || !rank || rank > 3) return;
  const late = state.turn >= 30 ? 1.5 : 1;
  const rival = table.filter((p) => p.id !== me.id && Math.abs(goals(p) - myGoals) <= 3 && !p.retired).sort((a, b) => Math.abs(goals(a) - myGoals) - Math.abs(goals(b) - myGoals))[0];
  if (!rival) return;
  const gap = Math.abs(goals(rival) - myGoals);
  const points = (1.5 - 0.35 * gap) * late * (0.85 + profileFactor(state, me, rival) * 0.15);
  const lead = goals(rival) > myGoals ? "leads" : goals(rival) < myGoals ? "trails" : "is level with";
  const text = `Golden Boot race: ${fullName(rival)} ${lead} you (${goals(rival)}–${myGoals})`;
  const rv = rivalFor(state, rival.id);
  const throttled = rv ? state.turnIndex - rv.lastNewsIndex < 10 : true;
  addEvidence(state, rival, { points, cause: "race", text: "" });
  const after = rivalFor(state, rival.id);
  if (after && live(after) && !throttled) {
    addNews(state, { kind: "career", title: text, body: "The race for the league's top scorer is down to the two of you.", important: false });
    after.lastNewsIndex = state.turnIndex;
    pushEvent(after.events, state, "race", text);
  }
}

function transferScan(state: GameState): void {
  const r = rivalryOf(state);
  const me = userPlayer(state);
  const log = state.transferLog;
  if (r.transferScan > log.length) r.transferScan = 0;
  for (let i = r.transferScan; i < log.length; i++) {
    const e = log[i];
    const p = state.players[e.playerId];
    if (!p || p.isUser) continue;
    const rv = r.rivals.find((x) => x.playerId === e.playerId && live(x));
    if (rv) {
      rv.clubId = e.to;
      if (me.clubId && e.to === me.clubId) {
        const same = positionGroup(p.position) === positionGroup(me.position);
        addIntensity(state, rv, { points: same ? 4 : 1, cause: "transfer", text: "" });
        pushEvent(rv.events, state, "transfer", `${rv.name} joins your club${same ? " — now you fight for the same shirt" : ""}.`);
        addNews(state, { kind: "career", title: `${rv.name} arrives at your club`, body: same ? "Your rival is now a teammate, and competition for your place." : "Your rival is now a teammate.", important: true });
      }
      continue;
    }
    if (me.clubId && e.to === me.clubId && e.from !== me.clubId && relevant(state, me, p) && positionGroup(p.position) === positionGroup(me.position) && ovr(p) >= ovr(me) - 3) {
      addEvidence(state, p, { points: 3 * profileFactor(state, me, p), cause: "transfer", text: `Signed by your club to compete for your place.` });
    }
  }
  r.transferScan = log.length;
}

function mediaStory(state: GameState): void {
  const r = rivalryOf(state);
  if (state.turnIndex - (r.lastMediaIndex ?? -999) < MEDIA_GAP) return;
  const me = userPlayer(state);
  const rivals = r.rivals.filter((x) => x.status === "active" && x.intensity >= 20);
  const cand = Object.entries(r.candidates).filter(([id, c]) => c.points - c.media >= 6 && relevant(state, me, state.players[id])).sort((a, b) => b[1].points - a[1].points)[0];
  const rv = rivals.sort((a, b) => b.intensity - a.intensity)[0];
  const other = rv ? state.players[rv.playerId] : cand ? state.players[cand[0]] : undefined;
  if (!other || !relevant(state, me, other) || profileFactor(state, me, other) < 1) return;
  const name = fullName(other);
  const seed = (state.turnIndex + name.length) % 3;
  const body = [`Pundits can't agree who is the better ${me.position === other.position ? "player" : "talent"}.`, "A fan poll puts the two of you neck and neck.", "The papers line the pair of you up for the big debate."][seed];
  addEvidence(state, other, { points: 1, cause: "media", text: `Pundits compared you with ${name}.`, media: true });
  addNews(state, { kind: "career", title: `${name} or you? The debate rages`, body });
  r.lastMediaIndex = state.turnIndex;
}

/** Weekly upkeep: decay, races, transfers, media, and rivalries cooling or ending. */
export function weeklyRivalry(state: GameState): void {
  if (state.user.retired) return;
  const r = rivalryOf(state);
  const me = userPlayer(state);

  for (const [id, c] of Object.entries(r.candidates)) {
    c.points *= 0.985;
    c.intl *= 0.985;
    c.media *= 0.985;
    if (c.points < 2 && state.turnIndex - c.lastIndex > 30) delete r.candidates[id];
    else if (!state.players[id] || state.players[id].retired) delete r.candidates[id];
  }

  for (const rv of r.rivals) {
    if (!live(rv)) continue;
    const other = state.players[rv.playerId];
    if (!other || other.retired) {
      rv.status = "ended";
      rv.endedReason = "retired";
      pushEvent(rv.events, state, "ended", `${rv.name} has retired.`);
      addNews(state, { kind: "career", title: `${rv.name} retires`, body: "Your great rival has hung up the boots." });
      continue;
    }
    rv.clubId = other.clubId;
    const idle = state.turnIndex - rv.lastContactIndex;
    if (idle > IDLE_TURNS) {
      // Different leagues cool a rivalry faster than the same one.
      const apart = me.clubId && other.clubId && state.clubs[me.clubId]?.leagueId !== state.clubs[other.clubId]?.leagueId ? 1.5 : 1;
      rv.intensity = Math.max(0, rv.intensity - 0.2 * apart);
    }
    if (rv.status === "active" && rv.intensity < DORMANT_BELOW) {
      rv.status = "dormant";
      pushEvent(rv.events, state, "cooled", "The rivalry has gone quiet.");
    }
    if (rv.intensity < ENDED_BELOW || idle > ENDED_IDLE) {
      rv.status = "ended";
      rv.endedReason = "faded";
      pushEvent(rv.events, state, "ended", "The rivalry has faded into history.");
    }
  }

  transferScan(state);
  if (state.turn >= BALANCE.calendar.seasonStart + 8 && state.turn <= BALANCE.calendar.seasonEnd && state.turn % 3 === 0) racesCheck(state);
  if (state.turn % 4 === 0) mediaStory(state);
}

// --------------------------------------------------------------------------- awards, records, transfers

/** The user and one other player finished first and second for an award. */
export function noteAwardDuel(state: GameState, awardId: string, awardName: string, winnerId: string, runnerUpId: string, margin: number): void {
  const uid = state.user.playerId;
  if (winnerId !== uid && runnerUpId !== uid) return;
  const me = userPlayer(state);
  const other = state.players[winnerId === uid ? runnerUpId : winnerId];
  if (!relevant(state, me, other)) return;
  const weight = awardId === "topscorer" ? 8 : awardId === "pots" ? 7 : 4;
  const points = weight * (margin <= 1 ? 1.5 : margin <= 3 ? 1.2 : 1) * (0.8 + profileFactor(state, me, other) * 0.2);
  const won = winnerId === uid;
  const name = fullName(other);
  const text = won ? `You edged ${name} to the ${awardName}.` : `${name} beat you to the ${awardName}.`;
  addEvidence(state, other, { points, cause: "award", text });
  const rv = rivalFor(state, other.id);
  if (rv && live(rv)) {
    addNews(state, { kind: "career", title: won ? `You beat ${name} to the ${awardName}` : `${name} pips you to the ${awardName}`, body: "The battle between rivals went to the wire.", important: true });
    const f = new Factors().add("An award decided between rivals", Math.min(26, points * 2.2 + rv.intensity * 0.1));
    recordMemory(state, { kind: "rivalry", tags: ["rivalry", "award"], factors: f, key: `${awardId}-${other.id}`, data: { rival: other.id, name, event: "award", won, award: awardName } });
  }
}

/** The user took a record from another player, or lost one to them. */
export function noteRecord(state: GameState, otherId: string, took: boolean, label: string): void {
  const me = userPlayer(state);
  const other = state.players[otherId];
  if (!relevant(state, me, other)) return;
  addEvidence(state, other, { points: 7, cause: "record", text: took ? `You passed ${fullName(other)}: ${label}.` : `${fullName(other)} passed you: ${label}.` });
}

/** The user joined a club: a rival already there becomes a teammate. */
export function noteUserTransfer(state: GameState, toClubId: string): void {
  for (const rv of rivalryOf(state).rivals) {
    if (!live(rv) || rv.clubId !== toClubId) continue;
    const other = state.players[rv.playerId];
    const me = userPlayer(state);
    if (!other) continue;
    const same = positionGroup(other.position) === positionGroup(me.position);
    addIntensity(state, rv, { points: same ? 4 : 1, cause: "transfer", text: "" });
    pushEvent(rv.events, state, "transfer", `You join ${rv.name}'s club${same ? " and compete for the same shirt" : ""}.`);
  }
}

/** A finished transfer saga: a similar player who joined one of the interested clubs is the one you were measured against. */
export function noteSagaCompetition(state: GameState, saga: TransferSaga): void {
  const me = userPlayer(state);
  const clubs = new Set([saga.clubId, ...saga.rivals]);
  let best: { p: Player; score: number } | null = null;
  for (let i = state.transferLog.length - 1; i >= 0 && i >= state.transferLog.length - 60; i--) {
    const e = state.transferLog[i];
    if (e.season !== saga.startSeason || e.turn < saga.startTurn - 8 || !clubs.has(e.to)) continue;
    const p = state.players[e.playerId];
    if (!p || p.isUser || !relevant(state, me, p) || positionGroup(p.position) !== positionGroup(me.position)) continue;
    const score = profileFactor(state, me, p) * Math.log10(Math.max(2, e.fee / 1e6 + 2));
    if (!best || score > best.score) best = { p, score };
  }
  if (best) addEvidence(state, best.p, { points: 5, cause: "transfer", text: `Wanted by the same club as you (${clubName(saga.clubId, true)}).` });
}

// --------------------------------------------------------------------------- presentation

const lastWord = (n: string) => n.split(" ").slice(-1)[0];

export function headToHeadLine(rv: PlayerRival): string {
  const h = rv.h2h;
  if (!h.meetings) return "You have yet to meet on the pitch.";
  return `${h.meetings} meeting${h.meetings === 1 ? "" : "s"} · you ${h.wins}W ${h.draws}D ${h.losses}L · goals ${h.myGoals}–${h.theirGoals}`;
}

/** The live storyline: a current race if there is one, otherwise the latest thing that happened between you. */
export function storyline(state: GameState, rv: PlayerRival): string {
  if (rv.status === "ended") return rv.endedReason === "retired" ? `${rv.name} has retired; the rivalry is part of history.` : "The rivalry has faded into history.";
  const race = rv.status === "active" ? raceStanding(state, rv) : null;
  if (race && race.rank <= 3 && race.theirRank <= 3 && Math.abs(race.mine - race.theirs) <= 4) {
    const who = race.theirs > race.mine ? `${lastWord(rv.name)} leads` : race.theirs < race.mine ? "You lead" : "Level";
    return `Golden Boot race: ${who} (you ${race.mine}, ${lastWord(rv.name)} ${race.theirs}).`;
  }
  if (rv.status === "dormant") return "Things have gone quiet — for now.";
  const last = [...rv.events].reverse().find((e) => e.kind !== "formed" && e.kind !== "media");
  return last?.text ?? causeSummary(rv);
}

export interface RivalPreview {
  rival: PlayerRival;
  line: string;
}

/** A line for the match preview when a rival is in the opposition's squad. */
export function matchPreview(state: GameState, fixture: Fixture, comp: Competition | undefined): RivalPreview | null {
  const me = userPlayer(state);
  const nat = comp?.kind === "international";
  const mine = nat ? (fixture.home === (me.intl.tiedTo ?? me.nationality) || fixture.home === me.nationality ? fixture.home : fixture.away) : me.clubId;
  const opp = fixture.home === mine ? fixture.away : fixture.home;
  for (const rv of [...rivalryOf(state).rivals].filter((r) => r.status !== "ended").sort((a, b) => b.intensity - a.intensity)) {
    const p = state.players[rv.playerId];
    if (!p || p.retired) continue;
    const onOpp = nat ? (p.intl.tiedTo ?? p.nationality) === opp || p.nationality === opp : p.clubId === opp;
    if (!onOpp) continue;
    const place = nat ? country(opp)?.name ?? opp : clubName(opp, true);
    const race = raceStanding(state, rv);
    const raceText = race && race.rank <= 3 && race.theirRank <= 3 ? ` The Golden Boot race: you ${race.mine}, ${lastWord(rv.name)} ${race.theirs}.` : "";
    return { rival: rv, line: `Your ${intensityLabel(rv.intensity).toLowerCase()} rival ${rv.name} plays for ${place}. ${headToHeadLine(rv)}.${raceText}` };
  }
  return null;
}

/** For the retirement summary: the rivalry that defined the career. */
export function rivalryStory(state: GameState): string | null {
  const best = [...rivalryOf(state).rivals].sort((a, b) => b.peak - a.peak)[0];
  if (!best || best.peak < 40) return null;
  const h = best.h2h;
  return `Defining Rival — ${best.name}. ${h.meetings ? `${h.meetings} meetings (${h.wins}W ${h.draws}D ${h.losses}L), ${h.myGoals}–${h.theirGoals} in goals. ` : ""}${causeSummary(best)}`;
}

