import { describe, expect, it } from "vitest";
import { CHALLENGES, challengeFits, challengeView, checkChallenge, weekKey, weeklyChallenge } from "../src/engine/career/challenges";
import { hallOfFameEntry } from "../src/engine/career/hallOfFame";
import { retireUser } from "../src/engine/season/advance";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

describe("challenge scenarios", () => {
  it("weekly challenge is the same for a whole ISO week and changes between weeks", () => {
    expect(weekKey(new Date("2026-11-26T10:00:00Z"))).toBe("2026-W48");
    expect(weekKey(new Date("2027-01-01T10:00:00Z"))).toBe("2026-W53");
    const a = weeklyChallenge(new Date("2026-11-23T00:00:00Z"));
    const b = weeklyChallenge(new Date("2026-11-29T23:00:00Z"));
    expect(a).toEqual(b);
    const keys = new Set(Array.from({ length: 12 }, (_, i) => weeklyChallenge(new Date(Date.UTC(2026, 0, 5 + i * 7))).def.id));
    expect(keys.size).toBeGreaterThan(1);
  });

  it("only starts when the career meets the challenge's start", () => {
    const fits = newCareer({ seed: "ch-1", path: "late", challenge: { id: "late-bloomer" } });
    expect(fits.user.challenge?.status).toBe("active");
    const wrong = newCareer({ seed: "ch-2", path: "academy", challenge: { id: "late-bloomer" } });
    expect(wrong.user.challenge).toBeUndefined();
    const underdog = CHALLENGES.find((c) => c.id === "underdog");
    expect(underdog && challengeFits(underdog, { path: "late", tier: 2, position: "ST" }).ok).toBe(false);
  });

  it("is won when the goal is met and failed past its deadline", () => {
    const s = newCareer({ seed: "ch-3", challenge: { id: "century-24" } });
    userPlayer(s).career.goals = 100;
    checkChallenge(s);
    expect(s.user.challenge?.status).toBe("won");
    const t = newCareer({ seed: "ch-4", challenge: { id: "century-24" } });
    t.season += 10;
    checkChallenge(t);
    expect(t.user.challenge?.status).toBe("failed");
    expect(challengeView(t)?.state.note).toMatch(/deadline/);
  });

  it("one-club runs break on a permanent move, and retirement settles what's left", () => {
    const s = newCareer({ seed: "ch-5", challenge: { id: "one-club" } });
    s.user.transfers.push({ season: s.season, turn: 10, from: s.user.startClubId, to: "eng-arsenal", fee: 1, kind: "transfer" });
    checkChallenge(s);
    expect(s.user.challenge?.status).toBe("failed");
    const t = newCareer({ seed: "ch-6", challenge: { id: "globetrotter" } });
    retireUser(t);
    expect(t.user.challenge?.status).toBe("failed");
    expect(hallOfFameEntry(t)?.challenge?.title).toBe("Globetrotter");
  });
});
