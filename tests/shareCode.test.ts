import { describe, expect, it } from "vitest";
import { CHALLENGES, startChallenge, weeklyChallenge } from "../src/engine/career/challenges";
import { challengeTag, decodeShare, encodeShare, rankShares, shareCodeFor } from "../src/engine/career/shareCode";
import { newCareer } from "./helpers";

describe("weekly challenge share codes", () => {
  it("round-trips and rejects typos", () => {
    const code = encodeShare({ week: "2026-W48", challengeId: "underdog", status: "won", score: 2345, name: "Alex Tester" });
    expect(code).toMatch(/^PB-26W48-UN-W-[0-9A-Z]+-ALEXTESTER-[0-9A-Z]{2}$/);
    expect(decodeShare(code)).toEqual({ week: "2026-W48", challengeId: "underdog", status: "won", score: 2345, name: "ALEXTESTER" });
    expect(decodeShare(code.replace("UN", "OC"))).toBeNull();
    expect(decodeShare("hello")).toBeNull();
    expect(decodeShare(code.toLowerCase())).not.toBeNull();
  });

  it("every challenge has a distinct tag", () => {
    const tags = CHALLENGES.map((c) => challengeTag(c.id));
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("a weekly career gets a code, and the board ranks wins first", () => {
    const s = newCareer();
    const w = weeklyChallenge(new Date("2026-11-26"));
    startChallenge(s, w.def.id, w.week);
    const mine = shareCodeFor(s)!;
    expect(decodeShare(mine)?.week).toBe(w.week);
    const winner = encodeShare({ week: w.week, challengeId: w.def.id, status: "won", score: 10, name: "Friend" });
    const board = rankShares([mine, winner, winner, "junk"]);
    expect(board).toHaveLength(2);
    expect(board[0].r.name).toBe("FRIEND");
  });
});
