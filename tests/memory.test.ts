import { describe, expect, it } from "vitest";
import type { MatchResult } from "../src/engine/match/engine";
import { describeMemory } from "../src/engine/memory/describe";
import { detectMatchMemory } from "../src/engine/memory/detect";
import { baseRivalry, rivalryLevel } from "../src/engine/memory/rivalry";
import { importanceFrom, tierOf } from "../src/engine/memory/score";
import { MAX_MEMORIES, recordMemory } from "../src/engine/memory/store";
import { Factors } from "../src/engine/memory/score";
import { migrateState } from "../src/persistence/migrations";
import type { Fixture, GameState } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

interface Goal { minute: number; mine: boolean; user?: boolean }

/** A hand-built match for the user's side (home) against `opp`. */
function match(state: GameState, opts: { opp: string; goals: Goal[]; line?: Partial<MatchResult["lines"][number]>; stage?: string; compId?: string }) {
  const u = userPlayer(state);
  const home = u.clubId as string;
  const fixture: Fixture = { id: `fx-${Math.random()}`, compId: opts.compId ?? Object.keys(state.competitions).find((k) => state.competitions[k].kind === "league")!, round: 1, turn: 10, home, away: opts.opp, stage: opts.stage };
  const comp = state.competitions[fixture.compId];
  const goals = opts.goals.map((g) => ({ minute: g.minute, side: g.mine ? ("home" as const) : ("away" as const), scorer: g.user ? u.id : g.mine ? "mate" : "them" }));
  const mine = goals.filter((g) => g.side === "home").length;
  const theirs = goals.length - mine;
  const userGoals = opts.goals.filter((g) => g.user).length;
  const res = {
    homeGoals: mine, awayGoals: theirs, extraTime: false, goals,
    lines: [{ id: u.id, side: "home", slot: u.position, started: true, minuteOn: 0, minuteOff: null, rating: 8, goals: userGoals, assists: 0, ...opts.line }],
    events: [], stats: {}, motm: u.id, injuries: [],
  } as unknown as MatchResult;
  return { state, fixture, comp, res, line: res.lines[0] };
}

function veteran(seed: string, age = 27) {
  const s = newCareer({ seed, clubId: "eng-ipswich-town" });
  const u = userPlayer(s);
  u.birthYear = s.season - age;
  u.career.apps = 40;
  u.career.goals = 12;
  u.intl.caps = 3;
  u.reputation = 50;
  return s;
}

describe("importance scoring", () => {
  it("spreads context points over 0-100 and never reaches it", () => {
    expect(importanceFrom(0)).toBe(0);
    expect(importanceFrom(40)).toBeGreaterThan(60);
    expect(importanceFrom(500)).toBeLessThan(101);
    expect(tierOf(94)).toBe("iconic");
    expect(tierOf(60)).toBe("major");
    expect(tierOf(40)).toBe("notable");
  });

  it("the age-19 derby brace with a 90+3 winner is iconic (~94)", () => {
    const s = veteran("mem-example", 19);
    const m = detectMatchMemory(...(Object.values(match(s, { opp: "eng-norwich-city", goals: [{ minute: 10, mine: false }, { minute: 30, mine: true, user: true }, { minute: 50, mine: false }, { minute: 70, mine: true }, { minute: 93, mine: true, user: true }] })) as [GameState, Fixture, never, MatchResult, never]));
    expect(m).not.toBeNull();
    expect(m!.kind).toBe("derby-winner");
    expect(m!.importance).toBeGreaterThanOrEqual(88);
    expect(m!.importance).toBeLessThanOrEqual(99);
    expect(m!.tags).toEqual(expect.arrayContaining(["derby", "late", "brace", "winner"]));
    expect(m!.minute).toBe(93);
    expect(m!.score).toEqual([3, 2]);
    expect(m!.factors.some(([l]) => /derby|rival/i.test(l))).toBe(true);
    const view = describeMemory(s, m!);
    expect(view.title).toContain("90+3'");
    expect(view.tier).toBe("iconic");
  });
});

describe("detection", () => {
  const run = (s: GameState, opts: Parameters<typeof match>[1]) => {
    const x = match(s, opts);
    return detectMatchMemory(x.state, x.fixture, x.comp, x.res, x.line);
  };

  it("ignores a routine goal in a comfortable win", () => {
    const s = veteran("mem-routine");
    expect(run(s, { opp: "eng-reading", goals: [{ minute: 20, mine: true, user: true }, { minute: 60, mine: true }] })).toBeNull();
    expect(s.user.memories).toHaveLength(0);
  });

  it("remembers a hat-trick and a late winner", () => {
    const s = veteran("mem-hat");
    const hat = run(s, { opp: "eng-reading", goals: [{ minute: 10, mine: true, user: true }, { minute: 40, mine: true, user: true }, { minute: 77, mine: true, user: true }] });
    expect(hat?.kind).toBe("hat-trick");
    expect(hat!.importance).toBeGreaterThanOrEqual(50);
    const late = run(s, { opp: "eng-oxford-united", goals: [{ minute: 20, mine: false }, { minute: 60, mine: true }, { minute: 91, mine: true, user: true }] });
    expect(late?.kind).toBe("late-winner");
  });

  it("a debut is always kept, even in a quiet game", () => {
    const s = veteran("mem-debut", 18);
    const u = userPlayer(s);
    u.career.apps = 1;
    u.career.goals = 0;
    const m = run(s, { opp: "eng-reading", goals: [], line: { minuteOn: 60, rating: 6.4 } });
    expect(m?.kind).toBe("debut");
  });

  it("a final goal beats a league goal of the same size", () => {
    const s = veteran("mem-final");
    const cup = Object.keys(s.competitions).find((k) => s.competitions[k].kind === "cup");
    if (!cup) return;
    const league = run(s, { opp: "eng-reading", goals: [{ minute: 40, mine: false }, { minute: 60, mine: true }, { minute: 88, mine: true, user: true }] });
    const final = run(s, { opp: "eng-wycombe", compId: cup, stage: "Final", goals: [{ minute: 50, mine: false }, { minute: 70, mine: true }, { minute: 88, mine: true, user: true }] });
    expect(final!.importance).toBeGreaterThan(league?.importance ?? 0);
  });

  it("repeating the same kind of moment is worth less", () => {
    const s = veteran("mem-rare");
    const mk = (opp: string) => run(s, { opp, goals: [{ minute: 40, mine: false }, { minute: 60, mine: true }, { minute: 92, mine: true, user: true }] });
    const first = mk("eng-reading");
    const second = mk("eng-oxford-united");
    const third = mk("eng-wycombe");
    expect(first!.importance).toBeGreaterThan(second!.importance);
    expect(second!.importance).toBeGreaterThan(third!.importance);
  });
});

describe("rivalries", () => {
  it("knows famous derbies, same-city clubs and the grudges you create", () => {
    expect(baseRivalry("eng-man-united", "eng-man-city")).toBeGreaterThan(0.9);
    expect(baseRivalry("esp-barcelona", "esp-real-madrid")).toBe(1);
    expect(baseRivalry("eng-arsenal", "eng-fulham")).toBeGreaterThan(0); // both London
    expect(baseRivalry("eng-ipswich-town", "esp-barcelona")).toBe(0);
    const s = veteran("mem-rival");
    const before = rivalryLevel(s, "eng-ipswich-town", "eng-reading");
    s.user.rivalHeat = { "eng-reading": 0.2 };
    expect(rivalryLevel(s, "eng-ipswich-town", "eng-reading")).toBeCloseTo(before + 0.2);
  });
});

describe("storage", () => {
  it("caps the list but never drops the big memories", () => {
    const s = veteran("mem-cap");
    for (let i = 0; i < MAX_MEMORIES + 60; i++) {
      s.season = 2030 + Math.floor(i / 40);
      recordMemory(s, { kind: "winner-goal", tags: [], factors: new Factors().add("x", i === 5 ? 200 : 30), key: `k${i}`, raw: true });
    }
    expect(s.user.memories.length).toBeLessThanOrEqual(MAX_MEMORIES);
    expect(s.user.memories.some((m) => m.importance >= 95)).toBe(true);
  });
});

describe("old saves", () => {
  it("rebuild debut, trophies and retirement when migrating v3 → v4", () => {
    const s = veteran("mem-old");
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown> & { user: Record<string, unknown>; schemaVersion: number };
    raw.schemaVersion = 3;
    delete raw.user.memories;
    raw.user.timeline = [{ season: s.season, turn: 5, kind: "debut", title: "Professional debut" }];
    raw.user.trophies = [{ season: s.season, compId: "x", name: "FA Cup", kind: "cup", clubId: "eng-ipswich-town" }];
    const m = migrateState(raw as never);
    const kinds = m.user.memories.map((x) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(["debut", "trophy"]));
    expect(m.user.memories.every((x) => x.backfilled)).toBe(true);
    expect(m.schemaVersion).toBe(4);
  });
});
