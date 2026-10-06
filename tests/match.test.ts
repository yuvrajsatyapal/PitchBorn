import { describe, expect, it } from "vitest";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS } from "../src/engine/match/lineup";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";

const gen = Rng.fromSeed("teams");
let n = 0;
function team(name: string, ovr: number, user = false): TeamInput {
  const mk = (slot: (typeof FORMATIONS)["4-3-3"][number], i: number): MatchPlayerInput => {
    const p = generatePlayer(gen, { id: `${name}${n++}`, nationality: "ENG", position: slot, age: 25, season: 2026, overall: ovr, potential: ovr, clubId: null });
    return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 60, isUser: user && i === 9 };
  };
  return { id: name, name, short: name, starters: FORMATIONS["4-3-3"].map(mk), bench: (["GK", "CB", "CM", "ST", "RW"] as const).map((s, i) => mk(s, 20 + i)), mentality: 0, color: "#000" };
}
const H = team("H", 75, true);
const A = team("A", 72);

describe("match engine", () => {
  it("is deterministic for a seed", () => {
    const r1 = new MatchEngine({ home: H, away: A, importance: 1, detail: true }, Rng.fromSeed("m")).runToEnd();
    const r2 = new MatchEngine({ home: H, away: A, importance: 1, detail: true }, Rng.fromSeed("m")).runToEnd();
    expect(r2).toEqual(r1);
  });
  it("produces stats that reconcile with events", () => {
    for (let i = 0; i < 60; i++) {
      const r = new MatchEngine({ home: H, away: A, importance: 1, detail: false }, Rng.fromSeed(`s${i}`)).runToEnd();
      expect(r.goals.filter((g) => g.side === "home").length).toBe(r.homeGoals);
      expect(r.goals.filter((g) => g.side === "away").length).toBe(r.awayGoals);
      const lineGoals = r.lines.reduce((s, l) => s + l.goals, 0);
      expect(lineGoals).toBe(r.homeGoals + r.awayGoals);
      expect(r.stats.onTarget[0]).toBeGreaterThanOrEqual(r.homeGoals);
      expect(r.stats.shots[0]).toBeGreaterThanOrEqual(r.stats.onTarget[0]);
      expect(r.stats.possession[0] + r.stats.possession[1]).toBe(100);
      for (const l of r.lines) {
        expect(l.rating).toBeGreaterThanOrEqual(3);
        expect(l.rating).toBeLessThanOrEqual(10);
      }
      expect(r.motm).not.toBe("");
    }
  });
  it("has believable aggregate scorelines", () => {
    let goals = 0;
    let maxG = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const r = new MatchEngine({ home: H, away: A, importance: 1, detail: false }, Rng.fromSeed(`agg${i}`)).runToEnd();
      goals += r.homeGoals + r.awayGoals;
      maxG = Math.max(maxG, r.homeGoals + r.awayGoals);
    }
    expect(goals / N).toBeGreaterThan(1.8);
    expect(goals / N).toBeLessThan(3.6);
    expect(maxG).toBeLessThan(12);
  });
  it("resolves knockouts with a winner", () => {
    for (let i = 0; i < 30; i++) {
      const r = new MatchEngine({ home: H, away: team("B", 75), importance: 2, detail: false, knockout: true }, Rng.fromSeed(`ko${i}`)).runToEnd();
      const level = r.homeGoals === r.awayGoals;
      if (level) expect(r.penalties).toBeDefined();
      if (r.penalties) expect(r.penalties[0]).not.toBe(r.penalties[1]);
    }
  });
  it("pauses for user decisions in interactive mode and resumes", () => {
    const eng = new MatchEngine({ home: H, away: A, importance: 1, detail: true, interactive: true }, Rng.fromSeed("int"));
    let decisions = 0;
    let guard = 0;
    while (!eng.finished && guard++ < 500) {
      if (eng.pending) {
        decisions++;
        expect(eng.pending.options.length).toBeGreaterThan(0);
        eng.resolve(eng.pending.options[0].id);
      } else eng.step();
    }
    expect(eng.finished).toBe(true);
    expect(decisions).toBeLessThanOrEqual(8);
  });
});
