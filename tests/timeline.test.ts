import { describe, expect, it } from "vitest";
import { timelineRecap } from "../src/engine/career/timeline";
import { advanceTurn, simUserMatch } from "../src/engine/season/advance";
import { newCareer, strongUser } from "./helpers";

describe("career timeline recap", () => {
  it("has a frame per season, including the one in progress, and totals that add up", () => {
    const s = newCareer({ seed: "tl-1" });
    strongUser(s);
    for (let i = 0; i < 56; i++) {
      for (const m of [...s.pending]) simUserMatch(s, m.fixtureId);
      advanceTurn(s);
    }
    const r = timelineRecap(s);
    expect(r.frames.length).toBe(2);
    expect(r.frames[r.frames.length - 1].current).toBe(true);
    expect(r.totals.apps).toBe(r.frames.reduce((a, f) => a + f.apps, 0));
    expect(r.frames[0].apps).toBeGreaterThan(0);
    expect(r.frames[0].label).toMatch(/\d{4}/);
  });
});
