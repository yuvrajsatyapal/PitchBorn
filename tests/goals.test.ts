import { describe, expect, it } from "vitest";
import { ACTIVE_GOALS, COSMETICS, cosmeticsOf, equipCosmetic, goalProgress, goalsWeekly, mergeOwned, STARTER_COSMETICS } from "../src/engine/career/goals";
import type { MatchLogEntry } from "../src/engine/types";
import { newCareer } from "./helpers";

const entry = (s: ReturnType<typeof newCareer>, turn: number, over: Partial<MatchLogEntry> = {}): MatchLogEntry => ({
  season: s.season, turn, fixtureId: `f${turn}`, compId: "x", compKind: "league", team: "a", opponent: "b", home: true, score: [1, 0], result: "W", slot: "ST", started: true, minutes: 90, rating: 7.6, goals: 1, assists: 1, cleanSheet: true, ...over,
});

describe("weekly goals and cosmetics", () => {
  it("keeps three goals running and completing one unlocks its reward", () => {
    const s = newCareer();
    goalsWeekly(s);
    expect(s.user.goals?.active).toHaveLength(ACTIVE_GOALS);
    const g = s.user.goals!.active[0];
    s.user.matchLog = [1, 2, 3, 4, 5].map((t) => entry(s, s.turn + t, { goals: 2 }));
    expect(goalProgress(s, g)).toBe(g.target);
    const done = goalsWeekly(s);
    expect(done.length).toBeGreaterThan(0);
    expect(s.user.goals!.completed).toBe(done.length);
    if (done[0].reward) expect(cosmeticsOf(s).owned).toContain(done[0].reward);
    expect(s.user.goals!.active).toHaveLength(ACTIVE_GOALS);
  });

  it("matches before a goal was set do not count, and goals expire", () => {
    const s = newCareer();
    s.user.matchLog = [entry(s, 0, { goals: 5 })];
    s.turn = 5;
    goalsWeekly(s);
    for (const g of s.user.goals!.active) expect(goalProgress(s, g)).toBe(0);
    s.turnIndex += 20;
    const before = s.user.goals!.active.map((g) => g.id);
    goalsWeekly(s);
    expect(s.user.goals!.active.some((g) => before.includes(g.id))).toBe(false);
  });

  it("equips only owned cosmetics and merges unlocks from other careers", () => {
    const s = newCareer();
    expect(cosmeticsOf(s).owned).toEqual(STARTER_COSMETICS);
    expect(equipCosmetic(s, "boots-gold").ok).toBe(false);
    mergeOwned(s, ["boots-gold", "not-a-thing"]);
    expect(equipCosmetic(s, "boots-gold").ok).toBe(true);
    expect(s.user.cosmetics!.equipped.boots).toBe("boots-gold");
    expect(COSMETICS.filter((c) => c.kind === "celebration").length).toBeGreaterThanOrEqual(6);
  });

  it("a new career can start with cosmetics from the browser profile", () => {
    const s = newCareer({ cosmetics: { owned: ["cel-flip"], equipped: { celebration: "cel-flip" } } });
    expect(s.user.cosmetics?.equipped.celebration).toBe("cel-flip");
  });
});
