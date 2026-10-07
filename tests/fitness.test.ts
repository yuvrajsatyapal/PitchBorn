import { describe, expect, it } from "vitest";
import { advanceTurn, canRequestRest, requestRest } from "../src/engine/season/advance";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

function starter(seed: string, intensity: "light" | "normal" | "intense") {
  const s = newCareer({ seed, clubId: "eng-lincoln-city", position: "CM" });
  const u = userPlayer(s);
  for (const k in u.attrs) u.attrs[k as keyof typeof u.attrs] = Math.max(u.attrs[k as keyof typeof u.attrs], 72);
  s.user.training = { focus: "passing", intensity };
  return s;
}

describe("fitness balance", () => {
  it("regular starters on normal training stay match fit", () => {
    const s = starter("fit-normal", "normal");
    const samples: number[] = [];
    for (let i = 0; i < 24; i++) {
      advanceTurn(s);
      // Injuries cap fitness by design; this test is about match/training load.
      if (s.turn > 6 && !userPlayer(s).injury && !s.user.injuryHistory.some((i) => i.season === s.season)) samples.push(userPlayer(s).fitness);
    }
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(avg).toBeGreaterThan(82);
    expect(Math.min(...samples)).toBeGreaterThan(65);
  });

  it("intense training costs fitness but never collapses it", () => {
    const s = starter("fit-intense", "intense");
    const samples: number[] = [];
    for (let i = 0; i < 24; i++) {
      advanceTurn(s);
      if (s.turn > 6) samples.push(userPlayer(s).fitness);
    }
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(45);
  });

  it("asking to be rested skips club matches and aids recovery", () => {
    const s = starter("fit-rest-b", "normal");
    while (!canRequestRest(s) && s.turn < 15) advanceTurn(s);
    expect(canRequestRest(s)).toBe(true);
    const u = userPlayer(s);
    u.fitness = 70;
    const before = s.user.relationships.manager;
    requestRest(s);
    expect(s.user.relationships.manager).toBeLessThan(before);
    expect(canRequestRest(s)).toBe(false);
    advanceTurn(s);
    expect(s.user.lastMatchTurn).not.toBe(s.turn - 1);
    expect(u.fitness).toBeGreaterThan(85);
  });
});
