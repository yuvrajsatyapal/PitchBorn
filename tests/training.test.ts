import { describe, expect, it } from "vitest";
import { developPlayer, INTENSITY, matchExperience, overloadMultiplier, runTraining, trainingGrowthMultiplier } from "../src/engine/players/development";
import { emptyStat } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import type { GameState, Player } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

const attrSum = (p: Player) => Object.values(p.attrs).reduce((s, v) => s + v, 0);

/** One season of growth for the user's player under a given situation. */
function season(opts: { minutesShare: number; form: number; intensity: keyof typeof INTENSITY; rating?: number }) {
  const s: GameState = newCareer({ seed: "train-balance", path: "academy" });
  const p = userPlayer(s);
  s.turn = 30;
  const stat = emptyStat();
  stat.minutes = opts.minutesShare * 27 * 90 * 0.85;
  p.season = { league: stat };
  p.form = opts.form;
  const before = attrSum(p);
  const rng = Rng.fromSeed("train-balance-rng");
  const trainingMultiplier = trainingGrowthMultiplier(Array(4).fill(INTENSITY[opts.intensity].growth));
  for (let i = 0; i < 12; i++) developPlayer(s, rng, p, { club: s.clubs[p.clubId!], trainingMultiplier }, 12);
  if (opts.rating) for (let i = 0; i < 34; i++) matchExperience(s, rng, p, 90 * opts.minutesShare, opts.rating);
  return attrSum(p) - before;
}

describe("training vs playing balance", () => {
  it("normal training is the neutral point; intensity only nudges monthly growth", () => {
    expect(trainingGrowthMultiplier([1, 1, 1, 1])).toBeCloseTo(1);
    expect(trainingGrowthMultiplier(Array(4).fill(INTENSITY.intense.growth))).toBeLessThan(1.1);
    expect(trainingGrowthMultiplier(Array(4).fill(INTENSITY.light.growth))).toBeGreaterThan(0.9);
  });

  it("a regular who plays well outgrows a bench player who trains intensely", () => {
    const regular = season({ minutesShare: 0.9, form: 7.2, intensity: "normal", rating: 7.2 });
    const benchGrinder = season({ minutesShare: 0.05, form: 6.4, intensity: "intense" });
    expect(regular).toBeGreaterThan(benchGrinder * 1.4);
  });

  it("good performances teach more than quiet ones", () => {
    const s = newCareer({ seed: "match-exp", path: "academy" });
    const p = userPlayer(s);
    const good = matchExperience(s, Rng.fromSeed("a"), structuredClone(p), 90, 7.8);
    const quiet = matchExperience(s, Rng.fromSeed("a"), structuredClone(p), 90, 6.2);
    const poor = matchExperience(s, Rng.fromSeed("a"), structuredClone(p), 90, 5.5);
    expect(good).toBeGreaterThan(quiet * 3);
    expect(poor).toBe(0);
  });

  it("back-to-back intense weeks overload the body and raise injury risk", () => {
    expect(overloadMultiplier(0)).toBe(1);
    expect(overloadMultiplier(2)).toBe(1);
    expect(overloadMultiplier(3)).toBeGreaterThan(1);
    expect(overloadMultiplier(20)).toBe(2);
    const s = newCareer({ seed: "overload" });
    const p = userPlayer(s);
    const rng = Rng.fromSeed("overload-rng");
    for (let i = 0; i < 4; i++) {
      p.injury = null;
      runTraining(s, rng, p, { focus: "finishing", intensity: "intense" });
    }
    expect(s.user.intenseStreak).toBeGreaterThanOrEqual(3);
    p.injury = null;
    runTraining(s, rng, p, { focus: "recovery", intensity: "light" });
    expect(s.user.intenseStreak).toBe(0);
  });
});
