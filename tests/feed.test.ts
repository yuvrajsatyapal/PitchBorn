import { beforeAll, describe, expect, it } from "vitest";
import { FEED_CAP, feedAfterMatch, feedNewestFirst, feedWeekly, sanitizeFeed } from "../src/engine/career/feed";
import type { MatchResult, PlayerLine } from "../src/engine/match/engine";
import { advanceTurn } from "../src/engine/season/advance";
import type { Competition, Fixture, GameState } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer, strongUser } from "./helpers";

function ctx(s: GameState, id: string, goals: number, rating: number, mine: number, theirs: number) {
  const ln = { id: s.user.playerId, side: "home", slot: "ST", goals, assists: 0, rating } as PlayerLine;
  return {
    comp: { id: "c", kind: "league", name: "Championship" } as Competition,
    fixture: { id, compId: "c", home: userPlayer(s).clubId, away: "eng-norwich-city" } as Fixture,
    res: { goals: [], lines: [ln] } as unknown as MatchResult,
    line: ln, mine, theirs, myTeam: userPlayer(s).clubId as string, opponent: "eng-norwich-city", nat: false,
  };
}

describe("social feed", () => {
  it("reacts to a match once, deterministically, without touching the world RNG", () => {
    const a = newCareer({ seed: "feed-1" });
    const b = newCareer({ seed: "feed-1" });
    const rng = [...a.rng];
    feedAfterMatch(a, ctx(a, "f1", 3, 9.1, 4, 0));
    feedAfterMatch(b, ctx(b, "f1", 3, 9.1, 4, 0));
    feedAfterMatch(a, ctx(a, "f1", 3, 9.1, 4, 0));
    expect(a.rng).toEqual(rng);
    expect(a.user.feed?.map((p) => p.text)).toEqual(b.user.feed?.map((p) => p.text));
    expect(a.user.feed?.length).toBeGreaterThanOrEqual(2);
    expect(a.user.feed?.some((p) => p.kind === "pundit")).toBe(true);
    expect(a.user.feed?.[0].mood).toBe("pos");
  });

  it("reacts to transfers and trophies once and stays capped", () => {
    const s = newCareer({ seed: "feed-2" });
    s.user.transfers.push({ season: s.season, turn: 3, from: "eng-ipswich-town", to: "eng-norwich-city", fee: 12_500_000, kind: "transfer" });
    s.user.trophies.push({ season: s.season, compId: "x", name: "FA Cup", kind: "cup", clubId: "eng-norwich-city" });
    feedWeekly(s);
    const n = s.user.feed?.length ?? 0;
    expect(s.user.feed?.some((p) => p.topic === "transfer" && p.text.includes("€12.5m"))).toBe(true);
    expect(s.user.feed?.some((p) => p.topic === "trophy" && p.kind === "club")).toBe(true);
    feedWeekly(s);
    expect(s.user.feed?.length).toBe(n);
    for (let i = 0; i < 60; i++) feedAfterMatch(s, ctx(s, `m${i}`, 1, 7.5, 1, 0));
    expect(s.user.feed?.length).toBe(FEED_CAP);
    expect(feedNewestFirst(s, 1)[0].id).toContain("m59");
  });

  it("does not flood an older save with its whole history", () => {
    const s = newCareer({ seed: "feed-3" });
    s.user.trophies.push({ season: s.season, compId: "x", name: "League", kind: "league", clubId: "eng-ipswich-town" });
    delete s.user.feedSeen;
    sanitizeFeed(s);
    feedWeekly(s);
    expect(s.user.feed ?? []).toHaveLength(0);
  });

  describe("over part of a season", () => {
    let s: GameState;
    beforeAll(() => {
      s = newCareer({ seed: "feed-run" });
      for (let i = 0; i < 18; i++) {
        strongUser(s);
        advanceTurn(s);
      }
    }, 300_000);
    it("fills up with posts about the player's matches", () => {
      expect((s.user.feed ?? []).filter((p) => p.topic === "match").length).toBeGreaterThan(0);
      expect(new Set(s.user.feed?.map((p) => p.id)).size).toBe(s.user.feed?.length);
    });
  });
});
