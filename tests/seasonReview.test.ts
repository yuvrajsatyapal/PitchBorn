import { describe, expect, it } from "vitest";
import { reviewAvailable, seasonReview, snapshotChemistry } from "../src/engine/career/seasonReview";
import { BALANCE } from "../src/engine/balance";
import { advanceTurn } from "../src/engine/season/advance";
import { squadOf, userPlayer } from "../src/engine/world/helpers";
import { newCareer, strongUser } from "./helpers";

describe("season review", () => {
  it("recaps the season from the match log and shows bond changes", () => {
    const s = newCareer({ seed: "rev-1" });
    for (let i = 0; i < 14; i++) {
      strongUser(s);
      advanceTurn(s);
    }
    const mate = squadOf(s, userPlayer(s).clubId as string).find((p) => !p.isUser) as { id: string };
    s.user.chemistrySnap = { season: s.season, values: { [mate.id]: 0 } };
    s.user.chemistry = { ...(s.user.chemistry ?? {}), [mate.id]: { v: 40, games: 10, links: 2, since: s.season } };
    const r = seasonReview(s);
    const log = (s.user.matchLog ?? []).filter((m) => m.season === s.season);
    expect(r.apps).toBe(log.length);
    expect(r.apps).toBeGreaterThan(0);
    expect(r.goals).toBe(log.reduce((a, m) => a + m.goals, 0));
    expect(r.record.w + r.record.d + r.record.l).toBe(r.apps);
    expect(r.best.length).toBeLessThanOrEqual(3);
    expect(r.bonds.some((b) => b.from === 0 && b.to === 40)).toBe(true);
    expect(reviewAvailable(s)).toBe(false);
    s.turn = BALANCE.calendar.seasonEnd + 1;
    expect(reviewAvailable(s)).toBe(true);
  });

  it("snapshots bonds once a season", () => {
    const s = newCareer({ seed: "rev-2" });
    snapshotChemistry(s);
    const first = s.user.chemistrySnap;
    s.user.chemistry = { x: { v: 50, games: 1, links: 0, since: s.season } };
    snapshotChemistry(s);
    expect(s.user.chemistrySnap).toBe(first);
  });
});
