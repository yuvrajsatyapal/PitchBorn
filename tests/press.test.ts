import { describe, expect, it } from "vitest";
import type { MatchResult, PlayerLine } from "../src/engine/match/engine";
import { answerPress, expirePress, maybePressConference, pendingPress, sanitizePress, skipPress, type PressContext } from "../src/engine/career/press";
import { advanceTurn } from "../src/engine/season/advance";
import type { Competition, Fixture, GameState } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer, strongUser } from "./helpers";

function line(id: string, over: Partial<PlayerLine> = {}): PlayerLine {
  return { id, side: "home", slot: "ST", started: true, minuteOn: 0, minuteOff: null, rating: 7, goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0, ...over };
}

function postCtx(s: GameState, l: Partial<PlayerLine>, mine: number, theirs: number, opponentId = "eng-norwich-city", stage?: string): PressContext {
  const uid = s.user.playerId;
  const ln = line(uid, l);
  const res = { homeGoals: mine, awayGoals: theirs, goals: [], lines: [ln], motm: "x" } as unknown as MatchResult;
  const comp = { id: "c", kind: "league", name: "Championship" } as Competition;
  const fixture = { id: `f-${mine}-${theirs}-${l.rating}`, compId: "c", round: 1, turn: 6, home: userPlayer(s).clubId as string, away: opponentId, stage } as Fixture;
  return { kind: "post", comp, fixture, opponentId, myTeam: fixture.home, line: ln, res, mine, theirs };
}

describe("press conferences", () => {
  it("follows a standout display, with a result question first", () => {
    const s = newCareer({ seed: "press-1" });
    const c = maybePressConference(s, postCtx(s, { goals: 3, rating: 9 }, 3, 1));
    expect(c).not.toBeNull();
    expect(c?.questions[0].topic).toBe("result");
    expect(c?.questions.some((q) => q.topic === "personal")).toBe(true);
    for (const q of c?.questions ?? []) {
      expect(q.answers.length).toBe(3);
      expect(new Set(q.answers.map((a) => a.tone)).size).toBe(3);
      expect(q.reporter.length).toBeGreaterThan(3);
    }
  });

  it("is deterministic for a fixture and leaves the world RNG alone", () => {
    const a = newCareer({ seed: "press-2" });
    const b = newCareer({ seed: "press-2" });
    const before = [...a.rng];
    const ca = maybePressConference(a, postCtx(a, { goals: 2, rating: 8.4 }, 2, 0));
    const cb = maybePressConference(b, postCtx(b, { goals: 2, rating: 8.4 }, 2, 0));
    expect(ca?.questions.map((q) => q.text)).toEqual(cb?.questions.map((q) => q.text));
    expect(a.rng).toEqual(before);
  });

  it("applies answers, writes a headline once every question is answered", () => {
    const s = newCareer({ seed: "press-3" });
    const c = maybePressConference(s, postCtx(s, { goals: 0, rating: 5.2 }, 0, 3));
    expect(c).not.toBeNull();
    const before = { ...s.user.relationships };
    const conf = c as NonNullable<typeof c>;
    const blame = conf.questions[0].answers.find((a) => a.id === "blame");
    expect(blame).toBeDefined();
    const r = answerPress(s, conf.questions[0].id, "blame");
    expect(r.ok).toBe(true);
    expect(s.user.relationships.teammates).toBeLessThan(before.teammates);
    expect(answerPress(s, conf.questions[0].id, "own").ok).toBe(false);
    for (const q of conf.questions.slice(1)) answerPress(s, q.id, q.answers[0].id);
    expect(s.user.press?.done).toBe(true);
    expect(pendingPress(s)).toBeNull();
    expect(s.user.pressLog?.at(-1)?.headline).toBeTruthy();
    expect(s.news[0].title).toContain("🎙️");
  });

  it("lapses unanswered, and repeated skipping costs a little with the board", () => {
    const s = newCareer({ seed: "press-4" });
    maybePressConference(s, postCtx(s, { goals: 2, rating: 8.2 }, 2, 0));
    s.turnIndex += 5;
    expirePress(s);
    expect(s.user.press).toBeUndefined();
    const board = s.user.relationships.board;
    for (let i = 0; i < 3; i++) {
      maybePressConference(s, postCtx(s, { goals: 2, rating: 8 + i / 10 }, 2, i));
      skipPress(s);
    }
    expect(s.user.relationships.board).toBeLessThan(board);
  });

  it("sanitizes bad saved data", () => {
    const s = newCareer({ seed: "press-5" });
    (s.user as unknown as Record<string, unknown>).press = { questions: "nope" };
    (s.user as unknown as Record<string, unknown>).pressLog = [null, { headline: "ok" }];
    sanitizePress(s);
    expect(s.user.press).toBeUndefined();
    expect(s.user.pressLog).toHaveLength(1);
  });

  it("happens naturally over a stretch of a season", () => {
    const s = newCareer({ seed: "press-run" });
    let seen = 0;
    for (let i = 0; i < 20; i++) {
      strongUser(s);
      advanceTurn(s);
      if (s.user.press) seen++;
    }
    expect(seen).toBeGreaterThan(0);
  }, 300_000);
});
