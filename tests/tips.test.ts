import { describe, expect, it } from "vitest";
import { activeTip, dismissTip, setTipsEnabled, TIPS } from "../src/engine/career/tips";
import { BALANCE } from "../src/engine/balance";
import { newCareer } from "./helpers";

describe("first-season tips", () => {
  it("shows one relevant tip per screen until dismissed", () => {
    const s = newCareer({ seed: "tips-1" });
    s.pending = [];
    s.user.decisions = [];
    s.user.offers = [];
    const first = activeTip(s, "dashboard");
    expect(first?.id).toBe("dash-welcome");
    dismissTip(s, "dash-welcome");
    expect(activeTip(s, "dashboard")?.id).not.toBe("dash-welcome");
    expect(s.user.tipsSeen).toEqual(["dash-welcome"]);
    dismissTip(s, "dash-welcome");
    dismissTip(s, "made-up");
    expect(s.user.tipsSeen).toEqual(["dash-welcome"]);
  });

  it("puts the match-day tip first when a match is pending", () => {
    const s = newCareer({ seed: "tips-2" });
    s.pending = [{ fixtureId: "f", compId: "c" }];
    expect(activeTip(s, "dashboard")?.id).toBe("dash-match");
    expect(activeTip(s, "match")?.id).toBe("match-moments");
    s.pending = [];
    expect(activeTip(s, "match")).toBeNull();
  });

  it("stops after the first season and when switched off", () => {
    const s = newCareer({ seed: "tips-3" });
    setTipsEnabled(s, false);
    expect(activeTip(s, "training")).toBeNull();
    setTipsEnabled(s, true);
    expect(activeTip(s, "training")?.id).toBe("training-intensity");
    s.season = s.user.startSeason + 1;
    s.turn = BALANCE.calendar.seasonStart + 2;
    expect(activeTip(s, "training")).toBeNull();
    s.user.retired = true;
    s.season = s.user.startSeason;
    expect(activeTip(s, "training")).toBeNull();
  });

  it("has unique ids", () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
  });
});
