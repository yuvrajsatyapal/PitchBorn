import { describe, expect, it } from "vitest";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS, fitFor } from "../src/engine/match/lineup";
import { TRAIT_BY_ID } from "../src/engine/traits/registry";
import { hasTrait } from "../src/engine/traits/effects";
import { derivedTraits } from "../src/engine/traits/assign";
import { AMBI_MIN, AMBIDEXTROUS, developWeakFoot, flankFitPenalty, footAttrMultipliers, footMultiplier, initialWeakFoot, isFoot, trainWeakFoot, weakFootCeiling, weakFootEffect } from "../src/engine/players/foot";
import { runTraining } from "../src/engine/players/development";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import { userPlayer } from "../src/engine/world/helpers";
import { migrateState } from "../src/persistence/migrations";
import { newCareer } from "./helpers";

const norm = (x: unknown) => JSON.parse(JSON.stringify(x));

describe("player creation", () => {
  it("only offers a left or right dominant foot and rates the weak foot separately", () => {
    for (const foot of ["L", "R"] as const) {
      const s = newCareer({ seed: `foot-${foot}`, foot });
      const u = userPlayer(s);
      expect(u.foot).toBe(foot);
      expect(u.weakFoot).toBeGreaterThan(0);
      expect(u.weakFoot).toBeLessThan(AMBI_MIN);
      expect(hasTrait(u, AMBIDEXTROUS)).toBe(false);
    }
  });

  it("gives every generated player a dominant foot, and two-footedness is rare", () => {
    const s = newCareer({ seed: "foot-world", countries: ["ENG", "ESP"] });
    const all = Object.values(s.players);
    expect(all.length).toBeGreaterThan(500);
    for (const p of all) {
      expect(isFoot(p.foot)).toBe(true);
      expect(p.weakFoot).toBeGreaterThanOrEqual(0);
      expect(p.weakFoot).toBeLessThanOrEqual(100);
    }
    const ambi = all.filter((p) => hasTrait(p, AMBIDEXTROUS));
    expect(ambi.length / all.length).toBeLessThan(0.02);
    for (const p of ambi) expect(p.weakFoot).toBeGreaterThanOrEqual(AMBI_MIN);
    // A rare trait, not an empty one: it has to be reachable.
    const rng = Rng.fromSeed("ambi-reach");
    let reached = 0;
    for (let i = 0; i < 4000; i++) {
      const p = generatePlayer(rng, { id: `r${i}`, nationality: "ENG", position: "RW", age: 27, season: 2026, overall: 88, potential: 88, clubId: null });
      if (derivedTraits(p, 27, 2026).some((t) => t.id === AMBIDEXTROUS)) reached++;
    }
    expect(reached).toBeGreaterThan(0);
    expect(reached / 4000).toBeLessThan(0.1);
  });
});

describe("weak foot and the Ambidextrous trait", () => {
  it("is a registered technical trait for outfield players", () => {
    const def = TRAIT_BY_ID.get(AMBIDEXTROUS);
    expect(def?.positions).not.toContain("GK");
    expect(def?.match).toBeUndefined(); // no generic attribute boost: the effect is the missing weak-foot penalty
  });

  it("removes the weak-foot penalty rather than adding ability", () => {
    expect(weakFootEffect(20, true)).toBeGreaterThan(0.98);
    for (const slot of ["ST", "RW", "LB", "CM"] as const) {
      for (const use of ["shoot", "cross", "pass", "dribble"] as const) {
        const poor = footMultiplier("L", 15, false, slot, use);
        const typical = footMultiplier("L", 60, false, slot, use);
        const ambi = footMultiplier("L", 95, true, slot, use);
        expect(poor).toBeLessThanOrEqual(typical);
        expect(typical).toBeCloseTo(1, 5);
        expect(ambi).toBeGreaterThanOrEqual(typical);
        expect(ambi).toBeLessThan(1.05);
      }
    }
  });

  it("makes the weak foot matter most where a role forces it", () => {
    // A right-footed left-back has to cross with his left; a left-footed one does not.
    expect(footMultiplier("R", 20, false, "LB", "cross")).toBeLessThan(footMultiplier("L", 20, false, "LB", "cross"));
    // An inverted winger cuts in to shoot on his strong foot, so a poor weak foot costs him less than a natural winger.
    expect(footMultiplier("L", 20, false, "RW", "shoot")).toBeGreaterThan(footMultiplier("L", 20, false, "LW", "shoot"));
    // Only the actions that use a foot are touched, and goalkeepers are untouched.
    expect(Object.keys(footAttrMultipliers("R", 20, false, "ST")).sort()).toEqual(["crossing", "dribbling", "finishing", "longShots", "passing", "vision"]);
    expect(footMultiplier("R", 0, false, "GK", "pass")).toBe(1);
  });

  it("affects which flank a one-footed full-back or winger is picked for", () => {
    const s = newCareer({ seed: "flank" });
    const p = userPlayer(s);
    p.position = "LB";
    p.foot = "R";
    p.weakFoot = 20;
    const wrong = fitFor(p, "LB");
    p.foot = "L";
    const right = fitFor(p, "LB");
    expect(right).toBeGreaterThan(wrong);
    expect(flankFitPenalty({ foot: "R", weakFoot: 96, traits: [{ id: AMBIDEXTROUS, xp: 100, since: 2026 }] }, "LB")).toBeLessThan(0.1);
    expect(flankFitPenalty({ foot: "R", weakFoot: 20 }, "CB")).toBe(0);
  });

  it("develops gradually and never beyond what the player's touch allows", () => {
    const s = newCareer({ seed: "wf-dev" });
    const p = userPlayer(s);
    for (const k of ["firstTouch", "dribbling", "passing", "finishing", "crossing"] as const) p.attrs[k] = 45;
    p.weakFoot = 30;
    const ceiling = weakFootCeiling(p.id, p.attrs);
    expect(ceiling).toBeLessThan(AMBI_MIN);
    const lastYear = p.weakFoot;
    for (let y = 0; y < 12; y++) {
      for (let m = 0; m < 12; m++) developWeakFoot(p, 19 + y, 1 / 12);
      if (y === 0) expect(p.weakFoot - lastYear).toBeLessThan(10);
    }
    expect(p.weakFoot).toBeGreaterThan(30);
    expect(p.weakFoot).toBeLessThanOrEqual(ceiling);
    for (let i = 0; i < 2000; i++) trainWeakFoot(p, 20, 0.2);
    expect(p.weakFoot).toBeLessThanOrEqual(ceiling + 0.01);
  });

  it("improves a little through the right training, and not through the wrong kind", () => {
    const s = newCareer({ seed: "wf-train", path: "academy" });
    const p = userPlayer(s);
    p.weakFoot = 40;
    for (const k of ["firstTouch", "dribbling", "passing", "finishing", "crossing"] as const) p.attrs[k] = 78;
    const rng = Rng.fromSeed("train");
    for (let i = 0; i < 30; i++) runTraining(s, rng, p, { focus: "physical", intensity: "normal" });
    expect(p.weakFoot).toBe(40);
    const before = p.weakFoot;
    for (let i = 0; i < 30; i++) runTraining(s, rng, p, { focus: "finishing", intensity: "normal" });
    expect(p.weakFoot).toBeGreaterThan(before);
    expect(p.weakFoot - before).toBeLessThan(5);
  });

  it("earns the trait at a near-perfect weak foot and loses it as the foot fades", () => {
    const s = newCareer({ seed: "wf-trait" });
    const p = userPlayer(s);
    p.weakFoot = 95;
    expect(derivedTraits(p, 26, 2026).some((t) => t.id === AMBIDEXTROUS)).toBe(true);
    p.weakFoot = 70;
    expect(derivedTraits(p, 26, 2026).some((t) => t.id === AMBIDEXTROUS)).toBe(false);
  });
});

describe("match engine", () => {
  const mk = (id: string, slot: MatchPlayerInput["slot"], extra: Partial<MatchPlayerInput>): MatchPlayerInput => {
    const g = generatePlayer(Rng.fromSeed(id), { id, nationality: "ENG", position: slot, age: 26, season: 2026, overall: 74, potential: 74, clubId: null });
    return { id, name: id, slot, attrs: g.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 60, ...extra };
  };
  const side = (name: string, extra: Partial<MatchPlayerInput>): TeamInput => ({
    id: name, name, short: name, mentality: 0, color: "#000",
    starters: FORMATIONS["4-3-3"].map((slot, i) => mk(`${name}${i}`, slot, extra)),
    bench: (["GK", "CB", "CM", "ST", "RW"] as const).map((slot, i) => mk(`${name}b${i}`, slot, extra)),
  });

  it("runs deterministically with footedness and responds to it", () => {
    const awkward = side("H", { foot: "R", weakFoot: 5 });
    const plain = side("H", {});
    const opp = side("A", {});
    const play = (h: TeamInput, seed: string) => new MatchEngine({ home: h, away: opp, importance: 1, detail: false }, Rng.fromSeed(seed)).runToEnd();
    expect(norm(play(awkward, "m1"))).toEqual(norm(play(awkward, "m1")));
    let differs = false;
    for (let i = 0; i < 12 && !differs; i++) differs = JSON.stringify(play(awkward, `d${i}`)) !== JSON.stringify(play(plain, `d${i}`));
    expect(differs).toBe(true);
  });
});

describe("old saves", () => {
  it("migrates 'both' to a left or right foot, safely and deterministically", () => {
    const s = norm(newCareer({ seed: "mig-foot" }));
    s.schemaVersion = 11;
    const ids = Object.keys(s.players).slice(0, 60);
    ids.forEach((id, i) => {
      const p = s.players[id];
      if (i % 2 === 0) p.foot = "B";
      delete p.weakFoot;
    });
    const user = s.players[s.user.playerId];
    user.foot = "B";
    delete user.weakFoot;
    const once = migrateState(norm(s));
    const twice = migrateState(norm(s));
    for (const p of Object.values(once.players)) {
      expect(isFoot(p.foot)).toBe(true);
      expect(Number.isFinite(p.weakFoot)).toBe(true);
    }
    for (const id of ids) expect(once.players[id].foot).toBe(twice.players[id].foot);
    // The user chose to be two-footed: that survives as the trait, with a real dominant foot underneath.
    const mu = once.players[once.user.playerId];
    expect(mu.weakFoot).toBeGreaterThanOrEqual(AMBI_MIN);
    expect(hasTrait(mu, AMBIDEXTROUS)).toBe(true);
    // Most NPCs who were "both" do not all become ambidextrous.
    const formerBoth = ids.filter((_, i) => i % 2 === 0 && ids[i] !== s.user.playerId).map((id) => once.players[id]);
    expect(formerBoth.filter((p) => hasTrait(p, AMBIDEXTROUS)).length).toBeLessThan(formerBoth.length);
  });

  it("repairs a missing or invalid foot on every load", () => {
    const s = norm(newCareer({ seed: "mig-foot-2" }));
    const id = Object.keys(s.players)[3];
    s.players[id].foot = "X";
    s.players[id].weakFoot = null;
    const m = migrateState(s);
    expect(isFoot(m.players[id].foot)).toBe(true);
    expect(Number.isFinite(m.players[id].weakFoot)).toBe(true);
  });

  it("initial weak foot is deterministic", () => {
    const s = newCareer({ seed: "wf-det" });
    const p = userPlayer(s);
    expect(initialWeakFoot(p.id, p.attrs, 22)).toBe(initialWeakFoot(p.id, p.attrs, 22));
  });
});
