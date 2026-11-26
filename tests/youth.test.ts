import { describe, expect, it } from "vitest";
import { resolveDecision } from "../src/engine/career/events";
import { inAcademy, youthWeekly } from "../src/engine/career/youth";
import { ageOf } from "../src/engine/players/generate";
import { BALANCE } from "../src/engine/balance";
import { newCareer } from "./helpers";

describe("youth start", () => {
  it("starts at 15 on a scholarship in the academy", () => {
    const s = newCareer({ path: "youth" });
    const p = s.players[s.user.playerId];
    expect(ageOf(p, s.season)).toBe(15);
    expect(inAcademy(s)).toBe(true);
    expect(p.contract?.youth).toBe(true);
    expect(p.contract!.expires).toBe(s.season + 1);
    const late = newCareer({ path: "late" });
    expect(p.contract!.wage).toBeLessThan(late.players[late.user.playerId].contract!.wage);
  });

  it("trials can impress, and at 17 the player chooses where to turn professional", () => {
    const s = newCareer({ path: "youth" });
    const p = s.players[s.user.playerId];
    s.user.reserves = { season: s.season, apps: 10, goals: 6, assists: 3, ratingSum: 80 };
    let invited = false;
    for (let t = 10; t <= 38 && !invited; t++) {
      s.turn = t;
      s.turnIndex = t;
      youthWeekly(s);
      invited = s.user.decisions.some((d) => d.eventId === "youth-trial");
    }
    expect(invited).toBe(true);
    const d = s.user.decisions.find((x) => x.eventId === "youth-trial")!;
    s.user.youth!.trials = [];
    resolveDecision(s, d.id, "go");
    expect(s.user.youth!.trials).toHaveLength(1);
    // Fast-forward to the end of the season he turns 16, with an impressed club on record.
    const other = Object.values(s.clubs).find((c) => c.id !== p.clubId)!;
    s.user.youth!.trials.push({ clubId: other.id, season: s.season, impressed: true });
    s.season += 1;
    s.turn = BALANCE.calendar.endOfSeasonTurn;
    youthWeekly(s);
    const pro = s.user.decisions.find((x) => x.eventId === "youth-pro")!;
    expect(pro.options.map((o) => o.id)).toContain(`club:${other.id}`);
    resolveDecision(s, pro.id, `club:${other.id}`);
    expect(p.clubId).toBe(other.id);
    expect(p.contract?.youth).toBeFalsy();
    expect(inAcademy(s)).toBe(false);
  });

  it("signing with the academy extends the contract as a professional", () => {
    const s = newCareer({ path: "youth" });
    const p = s.players[s.user.playerId];
    const home = p.clubId;
    s.season += 1;
    s.turn = BALANCE.calendar.endOfSeasonTurn;
    s.user.relationships.manager = 70;
    youthWeekly(s);
    const pro = s.user.decisions.find((x) => x.eventId === "youth-pro")!;
    resolveDecision(s, pro.id, "home");
    expect(p.clubId).toBe(home);
    expect(p.contract!.expires).toBeGreaterThan(s.season + 1);
  });
});
