import { describe, expect, it } from "vitest";
import { Commentary, pickLine, regionOf } from "../src/engine/match/commentary";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS } from "../src/engine/match/lineup";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";

const gen = Rng.fromSeed("cm-teams");
let n = 0;
function team(name: string, ovr: number): TeamInput {
  const mk = (slot: MatchPlayerInput["slot"]): MatchPlayerInput => {
    const p = generatePlayer(gen, { id: `c${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr, potential: ovr, clubId: null });
    return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55 };
  };
  return { id: name, name, short: name, starters: FORMATIONS["4-3-3"].map(mk), bench: (["GK", "CB", "CM", "ST"] as const).map(mk), mentality: 0, color: "#000" };
}

describe("commentary variety", () => {
  it("never changes the football: same seed, same result with or without flavour", () => {
    for (let i = 0; i < 6; i++) {
      const h = team("H", 72);
      const a = team("A", 72);
      const plain = new MatchEngine({ home: h, away: a, importance: 1, detail: true }, Rng.fromSeed(`cm-${i}`)).runToEnd();
      const flav = new MatchEngine({ home: h, away: a, importance: 1, detail: true, flavour: { seed: `f${i}`, country: "BRA" } }, Rng.fromSeed(`cm-${i}`)).runToEnd();
      expect([flav.homeGoals, flav.awayGoals, flav.stats.shots, flav.stats.xg]).toEqual([plain.homeGoals, plain.awayGoals, plain.stats.shots, plain.stats.xg]);
    }
  });

  it("is deterministic and local", () => {
    expect(pickLine(["a", "b", "c"], "k")).toBe(pickLine(["a", "b", "c"], "k"));
    expect(regionOf("BRA")).toBe("pt");
    expect(regionOf("ARG")).toBe("es");
    expect(regionOf(undefined)).toBe("en");
    const a = new Commentary({ seed: "x", country: "GER" });
    const b = new Commentary({ seed: "x", country: "GER" });
    expect([a.goalCry(10), a.save(11)]).toEqual([b.goalCry(10), b.save(11)]);
  });

  it("talks about the weather when it is bad", () => {
    const c = new Commentary({ seed: "wx", conditions: { weather: "snow", pitch: "frozen", tempC: -2 } as never });
    expect(c.ambient(25)).toMatch(/froz|ic|grip|bobble/i);
  });
});
