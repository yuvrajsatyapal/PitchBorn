import { describe, expect, it } from "vitest";
import { hallOfFameEntry, rankHallOfFame, upsertEntry } from "../src/engine/career/hallOfFame";
import { advanceTurn, retireUser } from "../src/engine/season/advance";
import { newCareer, strongUser } from "./helpers";

function retired(seed: string, turns = 6) {
  const s = newCareer({ seed });
  for (let i = 0; i < turns; i++) {
    strongUser(s);
    advanceTurn(s);
  }
  retireUser(s);
  return s;
}

describe("Hall of Fame", () => {
  it("has no entry for a career still going", () => {
    expect(hallOfFameEntry(newCareer({ seed: "hof-0" }))).toBeNull();
  });

  it("captures a retired career as a self-contained snapshot", () => {
    const s = retired("hof-1");
    const e = hallOfFameEntry(s, "2026-01-01T00:00:00.000Z");
    expect(e).not.toBeNull();
    expect(e).toMatchObject({ saveId: s.id, legacyTier: s.user.legacy?.tier, legacyScore: Math.round(s.user.legacy!.score), inductedAt: "2026-01-01T00:00:00.000Z" });
    expect(e!.name).toMatch(/\S+ \S+/);
    expect(e!.stats.length).toBeGreaterThan(3);
    expect(e!.look).toEqual(s.players[s.user.playerId].look);
    // Plain data only: it must survive JSON on its own, with the save gone.
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  }, 120_000);

  it("ranks by legacy, keeps one entry per save and the first induction date", () => {
    const a = hallOfFameEntry(retired("hof-2"), "2026-01-01T00:00:00.000Z")!;
    const b = { ...a, saveId: "other", legacyScore: a.legacyScore + 50, inductedAt: "2026-02-01T00:00:00.000Z" };
    let list = upsertEntry([], a);
    list = upsertEntry(list, b);
    list = upsertEntry(list, { ...a, legacyScore: a.legacyScore + 1, inductedAt: "2027-01-01T00:00:00.000Z" });
    expect(list).toHaveLength(2);
    expect(list.find((e) => e.saveId === a.saveId)?.inductedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(rankHallOfFame(list).map((e) => e.saveId)).toEqual(["other", a.saveId]);
  }, 120_000);
});
