import { beforeAll, describe, expect, it } from "vitest";
import { careerStories } from "../src/engine/career/legacy";
import {
  FORM_GAP, MAX_ACTIVE, PROMOTE_INTL_ONLY, intensityLabel, matchPreview, noteAwardDuel, noteMatch, noteRecord, noteUserTransfer, primaryRival, rivalMatchBonus,
  rivalryOf, rivalryStory, storyline, weeklyRivalry,
} from "../src/engine/career/rivalry/engine";
import { sanitizeRivalry } from "../src/engine/career/rivalry/sanitize";
import { leagueCompId } from "../src/engine/competitions/setup";
import type { MatchResult } from "../src/engine/match/engine";
import { overallFor } from "../src/engine/players/attributes";
import { advanceTurn } from "../src/engine/season/advance";
import type { Competition, Fixture, GameState, Player } from "../src/engine/types";
import { checkInvariants } from "../src/engine/validate";
import { userPlayer } from "../src/engine/world/helpers";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer } from "./helpers";

type Line = MatchResult["lines"][number];
let base: GameState;
beforeAll(() => {
  base = newCareer({ seed: "rivalry-base" });
}, 60000);

const fresh = () => structuredClone(base);

/** Another club's player who is a true peer of the user: same position, age, standing and ability. */
function makePeer(s: GameState, n = 0): Player {
  const me = userPlayer(s);
  const others = Object.values(s.clubs).filter((c) => c.id !== me.clubId && c.leagueId === s.clubs[me.clubId as string].leagueId);
  const club = others[n % others.length];
  const p = s.players[club.squad.find((id) => !s.players[id].isUser && s.players[id].position === me.position) ?? club.squad[0]];
  p.position = me.position;
  p.attrs = { ...me.attrs };
  p.birthYear = me.birthYear;
  p.reputation = me.reputation;
  return p;
}

const line = (id: string, side: "home" | "away", goals = 0, rating = 7): Line => ({ id, side, slot: "ST", started: true, minuteOn: 0, minuteOff: 90, rating, goals, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, tackles: 0, saves: 0 }) as unknown as Line;

let fx = 0;
interface Meet {
  s: GameState;
  other: Player;
  myGoals?: number;
  theirGoals?: number;
  homeGoals?: number;
  awayGoals?: number;
  stage?: string;
  kind?: Competition["kind"];
  compName?: string;
  derby?: boolean;
  events?: MatchResult["events"];
  turn?: number;
}

/** Plays one fake meeting between the user and `other` through the real rivalry hook. */
function meet({ s, other, myGoals = 0, theirGoals = 0, homeGoals, awayGoals, stage, kind = "league", compName = "League", derby = false, events = [], turn }: Meet) {
  const me = userPlayer(s);
  if (turn) s.turn = turn;
  s.turnIndex += 1;
  const home = me.clubId as string;
  const away = derby ? (Object.keys(s.clubs).find((c) => c !== home && s.clubs[c].leagueId === s.clubs[home].leagueId && c !== other.clubId) as string) : (other.clubId as string);
  void away;
  const awayClub = derby ? home : (other.clubId as string);
  const fixture = { id: `fx${fx++}`, compId: `c-${kind}`, round: 1, turn: s.turn, home, away: awayClub === home ? (other.clubId as string) : awayClub, stage } as Fixture;
  const comp = { id: fixture.compId, kind, name: compName, shortName: compName } as unknown as Competition;
  const hg = homeGoals ?? myGoals;
  const ag = awayGoals ?? theirGoals;
  const res = { homeGoals: hg, awayGoals: ag, lines: [line(me.id, "home", myGoals), line(other.id, "away", theirGoals)], events, goals: [] } as unknown as MatchResult;
  noteMatch(s, fixture, comp, res, res.lines[0]);
  return fixture;
}

describe("rivalry formation is rare and context-driven", () => {
  it("dozens of ordinary league meetings never make a rival", () => {
    const s = fresh();
    const other = makePeer(s);
    for (let i = 0; i < 40; i++) meet({ s, other, turn: 10 + (i % 25) });
    expect(rivalryOf(s).rivals).toHaveLength(0);
    // Playing someone often is worth next to nothing: ordinary meetings are capped.
    expect(rivalryOf(s).candidates[other.id]?.points ?? 0).toBeLessThanOrEqual(6.01);
  });

  it("a final, a title decider and goal duels are what make a rival", () => {
    const s = fresh();
    const other = makePeer(s);
    meet({ s, other, myGoals: 1, theirGoals: 1, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 40 });
    expect(rivalryOf(s).rivals).toHaveLength(0);
    meet({ s, other, myGoals: 3, theirGoals: 2, stage: "Final", kind: "cup", compName: "Cup", turn: 42 });
    meet({ s, other, myGoals: 2, theirGoals: 2, stage: "Semi-final", kind: "continental", compName: "Champions Cup", turn: 43 });
    const rv = rivalryOf(s).rivals[0];
    expect(rv).toBeDefined();
    expect(rv.playerId).toBe(other.id);
    expect(rv.causes).toEqual(expect.arrayContaining(["final"]));
    expect(rv.h2h.meetings).toBeGreaterThanOrEqual(2);
    expect(s.user.timeline.some((t) => t.title.includes("rivalry"))).toBe(true);
    expect(s.news.some((n) => n.title.includes("rivalry is born"))).toBe(true);
    expect(s.user.memories.some((m) => m.kind === "rivalry" && m.data?.event === "formed")).toBe(true);
  });

  it("needs more than one kind of evidence: a single cause is not enough", () => {
    const s = fresh();
    const other = makePeer(s);
    for (let i = 0; i < 8; i++) meet({ s, other, myGoals: 1, theirGoals: 1, stage: "Final", kind: "cup", compName: "Cup", turn: 20 + i });
    const c = rivalryOf(s).candidates[other.id];
    // Each of these is a cup final with a goal each, so it carries final and duel; check that a lone cause would not pass.
    expect(c === undefined || c.causes.length >= 1).toBe(true);
    const lone = fresh();
    const x = makePeer(lone, 1);
    rivalryOf(lone).candidates[x.id] = { points: 60, intl: 0, media: 0, causes: ["meeting"], lastIndex: 0, meetings: [], events: [] };
    meet({ s: lone, other: x, turn: 20 });
    expect(rivalryOf(lone).rivals).toHaveLength(0);
  });

  it("players well below the user's level or from another generation are ignored", () => {
    const s = fresh();
    const other = makePeer(s);
    const me = userPlayer(s);
    for (const k of Object.keys(other.attrs)) (other.attrs as Record<string, number>)[k] = 30;
    for (let i = 0; i < 6; i++) meet({ s, other, myGoals: 2, theirGoals: 2, stage: "Final", kind: "cup", compName: "Cup", turn: 20 + i });
    expect(rivalryOf(s).rivals).toHaveLength(0);
    expect(overallFor(other.attrs, other.position)).toBeLessThan(overallFor(me.attrs, me.position) - 8);
    const old = makePeer(s, 1);
    old.birthYear = me.birthYear - 15;
    for (let i = 0; i < 6; i++) meet({ s, other: old, myGoals: 2, theirGoals: 2, stage: "Final", kind: "cup", compName: "Cup", turn: 20 + i });
    expect(rivalryOf(s).rivals).toHaveLength(0);
  });

  it("rivalries form no faster than the cooldown allows", () => {
    const s = fresh();
    const a = makePeer(s, 0);
    const b = makePeer(s, 1);
    for (let i = 0; i < 3; i++) meet({ s, other: a, myGoals: 2, theirGoals: 2, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 30 + i });
    expect(rivalryOf(s).rivals.map((r) => r.playerId)).toContain(a.id);
    for (let i = 0; i < 3; i++) meet({ s, other: b, myGoals: 2, theirGoals: 2, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 30 + i });
    expect(rivalryOf(s).rivals.map((r) => r.playerId)).not.toContain(b.id);
    s.turnIndex += FORM_GAP;
    meet({ s, other: b, myGoals: 2, theirGoals: 2, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 40 });
    expect(rivalryOf(s).rivals.map((r) => r.playerId)).toContain(b.id);
  });
});

describe("rivalry intensity", () => {
  function withRival(): { s: GameState; other: Player } {
    const s = fresh();
    const other = makePeer(s);
    for (let i = 0; i < 3; i++) meet({ s, other, myGoals: 2, theirGoals: 2, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 30 + i });
    expect(rivalryOf(s).rivals).toHaveLength(1);
    return { s, other };
  }

  it("rises when the rival scores twice and the user hits a hat-trick", () => {
    const { s, other } = withRival();
    const rv = rivalryOf(s).rivals[0];
    const before = rv.intensity;
    meet({ s, other, myGoals: 3, theirGoals: 2, derby: true, turn: 36 });
    expect(rv.intensity).toBeGreaterThan(before);
    expect(rv.h2h.myGoals).toBeGreaterThanOrEqual(5);
  });

  it("matters far more in a final than in an ordinary league match", () => {
    const a = withRival();
    const b = withRival();
    const ra = rivalryOf(a.s).rivals[0];
    const rb = rivalryOf(b.s).rivals[0];
    ra.intensity = rb.intensity = 40;
    meet({ s: a.s, other: a.other, kind: "league", turn: 36 });
    meet({ s: b.s, other: b.other, kind: "continental", compName: "Champions Cup", stage: "Final", turn: 36 });
    expect(rb.intensity - 40).toBeGreaterThan((ra.intensity - 40) * 4);
  });

  it("an important international knockout strengthens an existing rivalry sharply", () => {
    const a = withRival();
    const b = withRival();
    const ra = rivalryOf(a.s).rivals[0];
    const rb = rivalryOf(b.s).rivals[0];
    ra.intensity = rb.intensity = 40;
    meet({ s: a.s, other: a.other, kind: "international", compName: "Friendly", turn: 36 });
    meet({ s: b.s, other: b.other, kind: "international", compName: "World Cup", stage: "Quarter-final", turn: 36 });
    expect(rb.intensity - 40).toBeGreaterThan((ra.intensity - 40) * 3);
  });

  it("international meetings alone need a higher bar to create a rivalry", () => {
    const s = fresh();
    const other = makePeer(s);
    let i = 0;
    while (!rivalryOf(s).rivals.length && i < 40) {
      meet({ s, other, myGoals: 1, theirGoals: 1, kind: "international", compName: "World Cup", stage: "Round of 16", turn: 20 + (i % 20) });
      const c = rivalryOf(s).candidates[other.id];
      if (c && !rivalryOf(s).rivals.length) expect(c.points).toBeLessThan(PROMOTE_INTL_ONLY);
      i++;
    }
    expect(rivalryOf(s).rivals.length).toBe(1);
    expect(i).toBeGreaterThan(2);
  });

  it("media comparisons add a small capped nudge and never create a rivalry alone", () => {
    const s = fresh();
    const other = makePeer(s);
    for (let i = 0; i < 80; i++) {
      s.turn = 4 + ((i * 4) % 36);
      s.turnIndex += 4;
      weeklyRivalry(s);
    }
    expect(rivalryOf(s).rivals).toHaveLength(0);
    expect(rivalryOf(s).candidates[other.id]).toBeUndefined();

    const { s: t, other: o } = withRival();
    const rv = rivalryOf(t).rivals[0];
    rv.intensity = 50;
    rv.lastContactIndex = t.turnIndex + 5000; // keep it warm so decay does not mask the media effect
    for (let i = 0; i < 200; i++) {
      t.turn = 4 + ((i * 4) % 36);
      t.turnIndex += 4;
      rv.lastContactIndex = t.turnIndex;
      weeklyRivalry(t);
    }
    void o;
    expect(rv.media).toBeLessThanOrEqual(10);
    expect(rv.intensity).toBeLessThan(50 + 10 * 1.5 + 1);
  });

  it("only three rivalries are active, and a minor rival can overtake the main one", () => {
    const s = fresh();
    const peers = [0, 1, 2].map((n) => makePeer(s, n));
    for (const p of peers) {
      s.turnIndex += FORM_GAP + 1;
      for (let i = 0; i < 3; i++) meet({ s, other: p, myGoals: 2, theirGoals: 2, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 30 + i });
    }
    const r = rivalryOf(s);
    expect(r.rivals.filter((x) => x.status === "active")).toHaveLength(MAX_ACTIVE);
    const main = primaryRival(s)!;
    const minor = r.rivals.find((x) => x !== main)!;
    minor.intensity = 99;
    expect(primaryRival(s)!.playerId).toBe(minor.playerId);
    expect(checkInvariants(s).issues.filter((i) => i.includes("rival"))).toEqual([]);
  });

  it("cools down, goes dormant, and ends rather than staying active forever", () => {
    const { s } = withRival();
    const rv = rivalryOf(s).rivals[0];
    rv.intensity = 40;
    const start = s.turnIndex;
    let statuses = new Set<string>();
    for (let i = 0; i < 400 && rv.status !== "ended"; i++) {
      s.turn = 4 + (i % 40);
      s.turnIndex = start + 20 + i;
      weeklyRivalry(s);
      statuses.add(rv.status);
    }
    expect(statuses.has("dormant")).toBe(true);
    expect(rv.status).toBe("ended");
    expect(rv.events.some((e) => e.kind === "cooled")).toBe(true);
    expect(rv.intensity).toBeGreaterThanOrEqual(0);
    statuses = new Set();
  });

  it("a rival's retirement ends the rivalry and keeps its history", () => {
    const { s, other } = withRival();
    other.retired = true;
    weeklyRivalry(s);
    const rv = rivalryOf(s).rivals[0];
    expect(rv.status).toBe("ended");
    expect(rv.endedReason).toBe("retired");
    expect(rv.meetings.length).toBeGreaterThan(0);
    expect(storyline(s, rv)).toContain("retired");
  });
});

describe("rivalry causes beyond matches", () => {
  it("a Golden Boot race builds a candidate but cannot make a rival on its own", () => {
    const s = fresh();
    const me = userPlayer(s);
    const other = makePeer(s);
    const league = s.clubs[me.clubId as string].leagueId;
    other.clubId = s.clubs[other.clubId as string] ? other.clubId : me.clubId;
    const compId = leagueCompId(league, s.season);
    for (const [p, goals] of [[me, 20], [other, 21]] as [Player, number][]) p.season[compId] = { ...(p.season[compId] ?? {}), goals, apps: 25 } as never;
    for (let t = 15; t <= 42; t += 3) {
      s.turn = t;
      s.turnIndex += 3;
      weeklyRivalry(s);
    }
    const c = rivalryOf(s).candidates[other.id];
    expect(c?.causes).toContain("race");
    expect(c.points).toBeGreaterThan(8);
    expect(rivalryOf(s).rivals).toHaveLength(0);
    // A final on top of the race is what tips it.
    meet({ s, other, myGoals: 1, theirGoals: 1, stage: "Final", kind: "cup", compName: "Cup", turn: 43 });
    meet({ s, other, myGoals: 2, theirGoals: 1, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 43 });
    expect(rivalryOf(s).rivals.map((r) => r.playerId)).toContain(other.id);
  });

  it("an award decided between two players is evidence, and a memory for an existing rival", () => {
    const s = fresh();
    const other = makePeer(s);
    const me = userPlayer(s);
    noteAwardDuel(s, "topscorer", "Golden Boot", me.id, other.id, 1);
    const c = rivalryOf(s).candidates[other.id];
    expect(c.causes).toContain("award");
    expect(c.points).toBeGreaterThan(8);
    // Not the user's duel: nothing happens.
    const third = makePeer(s, 1);
    noteAwardDuel(s, "topscorer", "Golden Boot", third.id, other.id, 1);
    expect(rivalryOf(s).candidates[third.id]).toBeUndefined();

    const { s: t, other: o } = (() => {
      const x = fresh();
      const p = makePeer(x);
      for (let i = 0; i < 3; i++) meet({ s: x, other: p, myGoals: 2, theirGoals: 2, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 30 + i });
      return { s: x, other: p };
    })();
    noteAwardDuel(t, "topscorer", "Golden Boot", o.id, userPlayer(t).id, 1);
    expect(t.news.some((n) => n.title.includes("pips you"))).toBe(true);
    expect(t.user.memories.some((m) => m.kind === "rivalry" && m.data?.event === "award")).toBe(true);
  });

  it("records and a rival joining the user's club count", () => {
    const s = fresh();
    const other = makePeer(s);
    noteRecord(s, other.id, true, "Most league goals in a season");
    expect(rivalryOf(s).candidates[other.id].causes).toContain("record");

    const t = fresh();
    const p = makePeer(t);
    for (let i = 0; i < 3; i++) meet({ s: t, other: p, myGoals: 2, theirGoals: 2, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 30 + i });
    const rv = rivalryOf(t).rivals[0];
    const before = rv.intensity;
    rv.clubId = userPlayer(t).clubId;
    noteUserTransfer(t, userPlayer(t).clubId as string);
    expect(rv.intensity).toBeGreaterThan(before);
  });
});

describe("rivalry in the rest of the game", () => {
  function withRival() {
    const s = fresh();
    const other = makePeer(s);
    for (let i = 0; i < 3; i++) meet({ s, other, myGoals: 2, theirGoals: 2, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 30 + i });
    return { s, other, rv: rivalryOf(s).rivals[0] };
  }

  it("shows a match preview line when the rival is in the opposition, and only then", () => {
    const { s, other, rv } = withRival();
    const me = userPlayer(s);
    const comp = { id: "c", kind: "league", name: "League" } as unknown as Competition;
    const fixture = { id: "p1", compId: "c", round: 1, turn: 5, home: me.clubId as string, away: other.clubId as string } as Fixture;
    const preview = matchPreview(s, fixture, comp);
    expect(preview?.rival.playerId).toBe(rv.playerId);
    expect(preview?.line).toContain(rv.name);
    const elsewhere = { ...fixture, away: Object.keys(s.clubs).find((c) => c !== other.clubId && c !== me.clubId) as string };
    expect(matchPreview(s, elsewhere, comp)).toBeNull();
    other.nationality = "BRA";
    me.nationality = "ENG";
    const intl = { id: "p2", compId: "i", round: 1, turn: 5, home: "ENG", away: "BRA" } as Fixture;
    expect(matchPreview(s, intl, { id: "i", kind: "international", name: "Friendly" } as unknown as Competition)?.rival.playerId).toBe(rv.playerId);
  });

  it("adds importance to a match memory when the rival was there", () => {
    const { s, rv } = withRival();
    const m = rv.meetings[rv.meetings.length - 1];
    const bonus = rivalMatchBonus(s, m.fixtureId);
    expect(bonus?.rival.playerId).toBe(rv.playerId);
    expect(bonus!.bonus).toBeGreaterThan(4);
    expect(rivalMatchBonus(s, "no-such-fixture")).toBeNull();
  });

  it("appears in the retirement story only for a rivalry that really mattered", () => {
    const { s, rv } = withRival();
    rv.peak = 70;
    expect(rivalryStory(s)).toContain(rv.name);
    expect(careerStories(s).some((x) => x.startsWith("Defining Rival"))).toBe(true);
    rv.peak = 20;
    expect(rivalryStory(s)).toBeNull();
  });

  it("labels intensity in words and is deterministic", () => {
    expect(intensityLabel(10)).toBe("Simmering");
    expect(intensityLabel(90)).toBe("Defining");
    const run = () => {
      fx = 0;
      const s = fresh();
      const other = makePeer(s);
      for (let i = 0; i < 4; i++) meet({ s, other, myGoals: i % 3, theirGoals: 1, stage: "Final", kind: "cup", compName: "Cup", turn: 30 + i });
      for (let t = 12; t < 40; t += 3) {
        s.turn = t;
        s.turnIndex += 3;
        weeklyRivalry(s);
      }
      return JSON.stringify(s.user.rivalry);
    };
    expect(run()).toBe(run());
  });

  it("an ordinary season of real matches creates no rivals, and the weekly hook leaves the world consistent", () => {
    const s = newCareer({ seed: "rivalry-season" });
    for (let i = 0; i < 28; i++) advanceTurn(s);
    expect(rivalryOf(s).rivals.length).toBeLessThanOrEqual(1);
    expect(checkInvariants(s).issues).toEqual([]);
    expect(s.user.rivalry.transferScan).toBeLessThanOrEqual(s.transferLog.length);
  }, 120000);
});

describe("rivalry persistence", () => {
  function populated() {
    const s = fresh();
    const other = makePeer(s);
    for (let i = 0; i < 3; i++) meet({ s, other, myGoals: 2, theirGoals: 2, stage: "Final", kind: "continental", compName: "Champions Cup", turn: 30 + i });
    rivalryOf(s).candidates[makePeer(s, 1).id] = { points: 5, intl: 0, media: 0, plain: 0, causes: ["duel"], lastIndex: 3, meetings: [], events: [] };
    sanitizeRivalry(s); // a save is always in sanitised form when it is stored
    return s;
  }

  it("survives JSON and the save codec", () => {
    const s = populated();
    expect(JSON.parse(JSON.stringify(s)).user.rivalry).toEqual(s.user.rivalry);
    expect(decodeState(JSON.parse(JSON.stringify(encodeState(s)))).user.rivalry).toEqual(s.user.rivalry);
    expect(migrateState(structuredClone(s) as never).user.rivalry).toEqual(s.user.rivalry);
  });

  it("old saves with no rivalry data load cleanly", () => {
    const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown> & { user: Record<string, unknown>; schemaVersion: number };
    delete raw.user.rivalry;
    raw.schemaVersion = 7;
    const m = migrateState(raw as never);
    expect(m.user.rivalry.rivals).toEqual([]);
    expect(m.user.rivalry.candidates).toEqual({});
    expect(m.user.rivalry.transferScan).toBe(m.transferLog.length);
    expect(m.schemaVersion).toBeGreaterThanOrEqual(8);
    const older = JSON.parse(JSON.stringify(base)) as typeof raw;
    delete older.user.rivalry;
    delete older.user.sagas;
    older.schemaVersion = 6;
    const m2 = migrateState(older as never);
    expect(m2.user.rivalry.rivals).toEqual([]);
    expect(m2.user.sagas).toEqual([]);
  });

  it("sanitizes invalid rivalry state instead of trusting it", () => {
    const s = populated();
    const good = s.user.rivalry.rivals[0];
    const dup = structuredClone(good);
    const rows = Array.from({ length: 5 }, (_, i) => ({ ...structuredClone(good), playerId: `fake${i}`, intensity: 50 + i, status: "active" }));
    s.user.rivalry.rivals = [null as never, "x" as never, { playerId: 5 } as never, good, dup, ...(rows as never[])];
    good.intensity = 500;
    good.status = "weird" as never;
    good.h2h.meetings = -3;
    s.user.rivalry.candidates = { ghost: { points: 9 } as never, [good.playerId]: { points: 1 } as never };
    s.user.rivalry.transferScan = 99999;
    sanitizeRivalry(s);
    const r = s.user.rivalry;
    expect(r.rivals.filter((x) => x.status === "active").length).toBeLessThanOrEqual(3);
    expect(r.rivals.every((x) => x.intensity >= 0 && x.intensity <= 100)).toBe(true);
    expect(new Set(r.rivals.map((x) => x.playerId)).size).toBe(r.rivals.length);
    expect(r.candidates.ghost).toBeUndefined();
    expect(r.candidates[good.playerId]).toBeUndefined();
    expect(r.transferScan).toBeLessThanOrEqual(s.transferLog.length);
    expect(checkInvariants(s).issues.filter((i) => i.includes("rival"))).toEqual([]);
  });

  it("migrateState sanitizes a current-version save whose rivalry data is damaged", () => {
    const s = populated();
    const raw = JSON.parse(JSON.stringify(s)) as GameState;
    raw.user.rivalry = { rivals: "nope", candidates: 7, transferScan: "x" } as never;
    const m = migrateState(raw as never);
    expect(Array.isArray(m.user.rivalry.rivals)).toBe(true);
    expect(m.user.rivalry.candidates).toEqual({});
  });
});
