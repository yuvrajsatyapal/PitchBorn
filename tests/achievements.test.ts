import { beforeAll, describe, expect, it } from "vitest";
import { ACHIEVEMENTS, achievementScore, checkCareerAchievements, checkMatchAchievements, hasAchievement, sanitizeAchievements, type MatchContext } from "../src/engine/career/achievements";
import type { MatchResult, PlayerLine } from "../src/engine/match/engine";
import { advanceTurn } from "../src/engine/season/advance";
import type { Competition, Fixture, GameState } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer, strongUser } from "./helpers";

function line(id: string, over: Partial<PlayerLine> = {}): PlayerLine {
  return {
    id, side: "home", slot: "ST", started: true, minuteOn: 0, minuteOff: null, rating: 7, goals: 0, assists: 0, shots: 0, onTarget: 0,
    keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0, ...over,
  };
}

function ctx(s: GameState, goals: MatchResult["goals"], l: Partial<PlayerLine> = {}, stage?: string): MatchContext {
  const uid = s.user.playerId;
  const mine = goals.filter((g) => g.side === "home").length;
  const theirs = goals.length - mine;
  const ln = line(uid, { goals: goals.filter((g) => g.scorer === uid).length, ...l });
  const res = { homeGoals: mine, awayGoals: theirs, extraTime: false, goals, lines: [ln], events: [], stats: {} as MatchResult["stats"], motm: uid, injuries: [] } as MatchResult;
  const comp = { id: "c", kind: "league", name: "Test League", shortName: "TL" } as Competition;
  const fixture = { id: "f", compId: "c", round: 1, turn: 5, home: "a", away: "b", stage } as Fixture;
  return { comp, fixture, res, line: ln, mine, theirs, myTeam: "a", opponent: "b", nat: false };
}

describe("achievement catalogue", () => {
  it("has unique ids and every entry can be checked", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) expect(!!a.match || !!a.career).toBe(true);
  });
});

describe("match achievements", () => {
  it("unlocks a hat-trick on debut, once", () => {
    const s = newCareer({ seed: "ach-1" });
    const uid = s.user.playerId;
    userPlayer(s).career.apps = 1;
    const goals = [10, 40, 70].map((minute) => ({ minute, side: "home" as const, scorer: uid }));
    const got = checkMatchAchievements(s, ctx(s, goals));
    expect(got).toEqual(expect.arrayContaining(["hat-trick", "debut-hat-trick", "dream-debut", "motm"]));
    expect(checkMatchAchievements(s, ctx(s, goals))).toEqual([]);
    expect(s.user.achievements?.filter((a) => a.id === "hat-trick")).toHaveLength(1);
    expect(s.news[0].title).toContain("Achievement unlocked");
  });

  it("only counts a late goal as a winner when it decides the match", () => {
    const s = newCareer({ seed: "ach-2" });
    const uid = s.user.playerId;
    userPlayer(s).career.apps = 20;
    const opp = "someone";
    // 1-1 then the user wins it in the 90th minute.
    checkMatchAchievements(s, ctx(s, [{ minute: 20, side: "away", scorer: opp }, { minute: 50, side: "home", scorer: "mate" }, { minute: 90, side: "home", scorer: uid }]));
    expect(hasAchievement(s, "last-gasp")).toBe(true);
    expect(hasAchievement(s, "comeback")).toBe(true);
    // A 90th-minute goal in a 3-0 win is not the winner.
    const t = newCareer({ seed: "ach-3" });
    userPlayer(t).career.apps = 20;
    checkMatchAchievements(t, ctx(t, [{ minute: 5, side: "home", scorer: "mate" }, { minute: 30, side: "home", scorer: "mate" }, { minute: 90, side: "home", scorer: t.user.playerId }]));
    expect(hasAchievement(t, "last-gasp")).toBe(false);
  });

  it("rewards a goal in a final", () => {
    const s = newCareer({ seed: "ach-4" });
    userPlayer(s).career.apps = 30;
    checkMatchAchievements(s, ctx(s, [{ minute: 12, side: "home", scorer: s.user.playerId }], {}, "Final"));
    expect(hasAchievement(s, "big-game")).toBe(true);
  });
});

describe("career achievements", () => {
  it("reads trophies: the double and three league-winning clubs", () => {
    const s = newCareer({ seed: "ach-5" });
    s.user.trophies.push(
      { season: 2030, compId: "l1", name: "League", kind: "league", clubId: "x" },
      { season: 2030, compId: "c1", name: "Cup", kind: "cup", clubId: "x" },
      { season: 2032, compId: "l1", name: "League", kind: "league", clubId: "y" },
    );
    checkCareerAchievements(s);
    expect(hasAchievement(s, "double")).toBe(true);
    expect(hasAchievement(s, "champions")).toBe(true);
    expect(hasAchievement(s, "three-clubs")).toBe(false);
    s.user.trophies.push({ season: 2034, compId: "l2", name: "League", kind: "league", clubId: "z" });
    checkCareerAchievements(s);
    expect(hasAchievement(s, "three-clubs")).toBe(true);
    expect(hasAchievement(s, "treble")).toBe(false);
    const score = achievementScore(s);
    expect(score.count).toBe(s.user.achievements?.length);
    expect(score.points).toBeGreaterThan(0);
  });

  it("backfills an older save silently and cleans bad entries", () => {
    const s = newCareer({ seed: "ach-6" });
    userPlayer(s).career.goals = 60;
    s.user.achievements = [{ id: "nope", season: 2030, turn: 1 }, { id: "motm", season: 2030, turn: 1 }, { id: "motm", season: 2030, turn: 2 }];
    const news = s.news.length;
    sanitizeAchievements(s);
    const ids = s.user.achievements.map((a) => a.id);
    expect(ids).not.toContain("nope");
    expect(ids.filter((i) => i === "motm")).toHaveLength(1);
    expect(ids).toEqual(expect.arrayContaining(["off-the-mark", "goals-50"]));
    expect(s.user.achievements.find((a) => a.id === "goals-50")?.backfilled).toBe(true);
    expect(s.news.length).toBe(news);
  });
});

describe("achievements in a real career", () => {
  let s: GameState;
  beforeAll(() => {
    s = newCareer({ seed: "ach-run" });
    for (let i = 0; i < 30 && !s.user.retired; i++) {
      strongUser(s);
      advanceTurn(s);
    }
  }, 300_000);

  it("unlocks early-career achievements from play and survives a save round trip", () => {
    const ids = (s.user.achievements ?? []).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    if (userPlayer(s).career.goals > 0) expect(ids).toContain("off-the-mark");
    const back = migrateState(decodeState(encodeState(s)) as unknown as Record<string, unknown>);
    expect(back.user.achievements).toEqual(s.user.achievements);
  });
});
