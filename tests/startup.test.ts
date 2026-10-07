import { describe, expect, it } from "vitest";
import { turnDate, weeksToNewYear, weeksToNextMonth } from "../src/engine/calendar";
import { teamRun } from "../src/engine/competitions/run";
import { advanceTurn } from "../src/engine/season/advance";
import { overallFor } from "../src/engine/players/attributes";
import { userPlayer } from "../src/engine/world/helpers";
import type { Competition, Fixture } from "../src/engine/types";
import { newCareer } from "./helpers";

const fx = (id: string, home: string, away: string, stage: string, hg?: number, ag?: number, extra: Partial<Fixture> = {}): Fixture => ({
  id, compId: "c", round: 1, turn: 1, home, away, stage, ...(hg === undefined ? {} : { result: { hg, ag: ag as number, goals: [] } }), ...extra,
});
const comp = (fixtures: Fixture[], extra: Partial<Competition> = {}): Competition => ({
  id: "c", kind: "cup", name: "Cup", shortName: "Cup", season: 2026, teams: ["A", "B", "C", "D"], fixtures, prestige: 5, complete: false, ...extra,
});

describe("tournament run", () => {
  it("reports where a team was knocked out, and who is still alive", () => {
    const c = comp([fx("1", "A", "B", "Quarter-final", 0, 2), fx("2", "C", "D", "Quarter-final", 1, 0), fx("3", "B", "C", "Semi-final")]);
    expect(teamRun(c, "A")).toMatchObject({ status: "eliminated", stage: "Quarter-final" });
    expect(teamRun(c, "B")).toMatchObject({ status: "alive" });
    expect(teamRun(c, "Z").status).toBe("none");
  });

  it("knows finalists and winners", () => {
    const c = comp([fx("1", "A", "B", "Final", 1, 2)], { winner: "B", runnerUp: "A", complete: true });
    expect(teamRun(c, "B").status).toBe("won");
    expect(teamRun(c, "A").text).toMatch(/final/i);
  });

  it("reports group-stage exits", () => {
    const c = comp([fx("1", "A", "B", "Group A", 0, 1, { group: 0 }), fx("2", "C", "D", "Group A", 0, 1, { group: 0 }), fx("3", "B", "D", "Quarter-final")], { groups: [{ name: "A", teams: ["A", "B"], table: [] }] });
    expect(teamRun(c, "A")).toMatchObject({ status: "eliminated", stage: "Group stage" });
  });
});

describe("custom start", () => {
  it("honours the chosen age, overall and potential", () => {
    const s = newCareer({ seed: "custom-1", path: "custom", custom: { age: 29, overall: 78, potential: 80 } });
    const u = userPlayer(s);
    expect(s.season - u.birthYear).toBe(29);
    expect(Math.abs(overallFor(u.attrs, u.position) - 78)).toBeLessThanOrEqual(2);
    expect(u.hidden.potential).toBe(80);
    expect(s.user.startAge).toBe(29);
  });

  it("clamps nonsense and keeps potential at or above overall", () => {
    const s = newCareer({ seed: "custom-2", path: "custom", custom: { age: 5, overall: 99, potential: 10 } });
    const u = userPlayer(s);
    expect(s.season - u.birthYear).toBe(16);
    expect(u.hidden.potential).toBeGreaterThanOrEqual(overallFor(u.attrs, u.position) - 2);
  });

  it("plays on without trouble", () => {
    const s = newCareer({ seed: "custom-3", path: "custom", custom: { age: 33, overall: 70, potential: 70 } });
    for (let i = 0; i < 12; i++) advanceTurn(s);
    expect(userPlayer(s).clubId).toBeTruthy();
  });
});

describe("simulate-ahead targets", () => {
  it("lands on 1 January and a month later by the displayed date", () => {
    const w = weeksToNewYear(2026, 5) as number;
    const d = turnDate(2026, 5 + w);
    expect(Math.abs(d.getTime() - Date.UTC(2027, 0, 1))).toBeLessThanOrEqual(4 * 86_400_000);
    expect(weeksToNewYear(2026, 30)).toBeNull();
    for (const t of [11, 12, 20]) {
      const start = turnDate(2026, t);
      const end = turnDate(2026, t + weeksToNextMonth(2026, t));
      const days = (end.getTime() - start.getTime()) / 86_400_000;
      expect(days).toBeGreaterThanOrEqual(26);
      expect(days).toBeLessThanOrEqual(35);
    }
  });
});
