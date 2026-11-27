import { describe, expect, it } from "vitest";
import { checkCareerAchievements, hasAchievement } from "../src/engine/career/achievements";
import { seasonReview } from "../src/engine/career/seasonReview";
import { activeTip, dismissTip } from "../src/engine/career/tips";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

describe("the newer systems tie into achievements, tips and the season review", () => {
  it("unlocks story, market, youth and family achievements from what the save records", () => {
    const s = newCareer({ seed: "links-ach" });
    s.user.drama = { log: [{ season: s.season, kind: "captaincy", title: "Captaincy race", outcome: "won the armband" }, { season: s.season, kind: "clique", title: "Dressing-room cliques", outcome: "united the squad" }], quietUntil: 0 };
    s.user.transfers.push({ season: s.season, turn: 9, from: "eng-ipswich-town", to: "eng-arsenal", fee: 5_000_000, kind: "transfer" });
    s.generation = 2;
    s.user.goals = { active: [], completed: 10, drawn: 13 };
    checkCareerAchievements(s);
    for (const id of ["armband-race", "peacemaker", "deadline-day", "second-generation", "goal-setter"]) expect(hasAchievement(s, id), id).toBe(true);
    expect(hasAchievement(s, "dynasty")).toBe(false);
    expect(hasAchievement(s, "hold-out")).toBe(false);
  });

  it("a youth start earns Made It only once the first professional contract is signed", () => {
    const s = newCareer({ seed: "links-youth", path: "youth" });
    checkCareerAchievements(s);
    expect(hasAchievement(s, "made-it")).toBe(false);
    const y = s.user.youth;
    const c = userPlayer(s).contract;
    expect(y && c).toBeTruthy();
    if (!y || !c) return;
    y.stage = "pro";
    y.proDecisionSeason = s.season;
    c.signed = s.season;
    checkCareerAchievements(s);
    expect(hasAchievement(s, "made-it")).toBe(true);
  });

  it("first-season tips point at weekly goals, running stories and tactical roles", () => {
    const s = newCareer({ seed: "links-tips" });
    s.pending = [];
    s.user.decisions = [];
    s.user.offers = [];
    s.turnIndex = 5;
    s.user.goals = { active: [{ id: "g", template: "score", label: "Score in 2 straight games", target: 2, season: s.season, turn: s.turn, expiresIndex: 20 }], completed: 0, drawn: 1 };
    for (const id of ["dash-welcome", "dash-training"]) dismissTip(s, id);
    expect(activeTip(s, "dashboard")?.id).toBe("dash-goals");
    dismissTip(s, "dash-goals");
    s.user.drama = { log: [], quietUntil: 0, active: { id: "dr1", kind: "clique", stage: 0, started: 0, next: 0, clubId: userPlayer(s).clubId ?? "" } };
    expect(activeTip(s, "dashboard")?.id).toBe("dash-story");
    expect(activeTip(s, "club")?.id).toBe("club-role");
    s.user.tacticalRole = { id: "poacher", clubId: userPlayer(s).clubId ?? "", season: s.season, askedTurn: s.turn, agreed: true };
    expect(activeTip(s, "club")?.id).toBe("club-relations");
  });

  it("the season review lists the weekly goals completed and the stories that ended", () => {
    const s = newCareer({ seed: "links-review" });
    s.user.goals = { active: [], completed: 1, drawn: 4, done: [{ season: s.season, label: "Score in 3 straight games", reward: "boots-gold" }, { season: s.season - 1, label: "Old goal" }] };
    s.user.drama = { log: [{ season: s.season, kind: "fallout", title: "Falling out with the manager", outcome: "apologised" }], quietUntil: 0 };
    const r = seasonReview(s);
    expect(r.goalsDone.map((g) => g.label)).toEqual(["Score in 3 straight games"]);
    expect(r.stories).toEqual([{ title: "Falling out with the manager", outcome: "apologised" }]);
  });
});
