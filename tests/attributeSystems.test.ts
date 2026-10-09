import { describe, expect, it } from "vitest";
import { fitDrivers, fitFor, scoreParts, selectTeam, tacticalFit, TACTICAL_CAP, type PlayStyle } from "../src/engine/match/lineup";
import { applyGrowth, overallFor, overallExact } from "../src/engine/players/attributes";
import { developPlayer, runTraining, TRAINING_FOCUS, trainingShares } from "../src/engine/players/development";
import { focusFor, focusOf, focusOptions, focusTilt, NO_FOCUS } from "../src/engine/players/focus";
import { generatePlayer } from "../src/engine/players/generate";
import { DECLINE_SHARE, POSITION_WEIGHTS, TRAINING_MODEL, styleWeights } from "../src/engine/players/model";
import { Rng } from "../src/engine/rng";
import { styleBonus } from "../src/engine/transfers/market";
import { EXTRA_CORE, EXTRA_REQ, withAttributeModel } from "../src/engine/traits/attributeModel";
import { candidateTraits, meetsRequirements } from "../src/engine/traits/rules";
import { TRAIT_BY_ID, TRAITS } from "../src/engine/traits/registry";
import { ALL_ATTRS, POSITIONS, type AttrKey, type Player, type Position, type TrainingFocus } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const corr = (xs: number[], ys: number[]) => {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  return sxy / Math.sqrt(sxx * syy);
};
let n = 0;
const make = (position: Position, overall: number, age = 26, seed?: string): Player =>
  generatePlayer(Rng.fromSeed(seed ?? `sys-${n++}`), { id: seed ?? `sys-${n}`, nationality: "ENG", position, age, season: 2026, overall, potential: overall + 3, clubId: null });
const withAttrs = (p: Player, over: Partial<Record<AttrKey, number>>): Player => ({ ...p, attrs: { ...p.attrs, ...over } });

// ───────────────────────────────────────────────────────────────────────── desired playstyles

describe("desired playstyles", () => {
  const counts: Record<Position, number> = { GK: 5, RB: 5, LB: 5, CB: 5, DM: 5, CM: 5, AM: 5, RW: 5, LW: 5, ST: 5 };

  it("every position offers No preference plus its options, with one more for GK, full-backs, CB, DM, CM and AM", () => {
    for (const pos of POSITIONS) expect(focusOptions(pos).length, pos).toBe(counts[pos] + 1);
    const names = (p: Position) => focusOptions(p).map((o) => o.name);
    expect(names("GK")).toContain("Line Keeper");
    expect(names("RB")).toContain("Complete Full-Back");
    expect(names("LB")).toEqual(names("RB"));
    expect(names("CB")).toContain("Aggressive Stopper");
    expect(names("DM")).toContain("Half-Back");
    expect(names("CM")).toContain("Advanced No. 8");
    expect(names("AM")).toContain("Shadow Striker");
  });

  it("each card shows three key attributes and names only real ones", () => {
    for (const pos of POSITIONS) for (const o of focusOptions(pos).filter((x) => x.id !== NO_FOCUS)) {
      expect(o.areas, `${pos} ${o.id}`).toHaveLength(3);
      for (const k of Object.keys(o.attrs)) expect(ALL_ATTRS, `${o.id} ${k}`).toContain(k);
    }
  });

  it("no two options for a position ask for almost the same thing", () => {
    const cosine = (a: Partial<Record<AttrKey, number>>, b: Partial<Record<AttrKey, number>>) => {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)] as AttrKey[]);
      let dot = 0, na = 0, nb = 0;
      for (const k of keys) { const x = a[k] ?? 0, y = b[k] ?? 0; dot += x * y; na += x * x; nb += y * y; }
      return dot / Math.sqrt(na * nb);
    };
    for (const pos of POSITIONS) {
      const opts = focusOptions(pos).filter((o) => o.id !== NO_FOCUS);
      for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) {
        expect(cosine(opts[i].attrs, opts[j].attrs), `${pos}: ${opts[i].name} vs ${opts[j].name}`).toBeLessThan(0.85);
      }
    }
  });

  it("the attacking midfield roles are different jobs: creating, the final ball, beating players, arriving late, and attacking the box", () => {
    const am = (id: string) => focusFor("AM", id)!;
    const top = (id: string) => Object.entries(am(id).attrs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
    expect(top("am_playmaker")).toContain("passing");
    expect(top("am_creator")).toContain("creativity");
    expect(top("am_dribbler")).toContain("dribbling");
    expect(top("am_scorer")).toContain("longShots");
    expect(top("am_shadow")).toEqual(expect.arrayContaining(["finishing", "offBall"]));
    expect(am("am_scorer").attrs.stamina).toBeGreaterThan(0.5);
    expect(am("am_shadow").attrs.acceleration).toBeGreaterThan(0.5);
    expect(am("am_scorer").attrs.longShots ?? 0).toBeGreaterThan(am("am_shadow").attrs.longShots ?? 0);
    expect(am("am_shadow").attrs.finishing).toBeGreaterThan(am("am_scorer").attrs.finishing ?? 0);
  });

  it("the new options lean the starting attributes, without changing the overall", () => {
    const cases: [Position, string, AttrKey][] = [["GK", "gk_line", "positioning"], ["RB", "fb_complete", "workRate"], ["CB", "cb_aggressive", "aggression"], ["DM", "dm_halfback", "anticipation"], ["CM", "cm_eight", "offBall"], ["AM", "am_shadow", "offBall"]];
    for (const [pos, id, key] of cases) {
      const base = userPlayer(newCareer({ seed: `sys-lean-${pos}`, position: pos }));
      const p = userPlayer(newCareer({ seed: `sys-lean-${pos}`, position: pos, focus: id }));
      expect(p.attrs[key], `${id} ${key}`).toBeGreaterThan(base.attrs[key] + 0.9);
      expect(Math.abs(overallFor(p.attrs, pos) - overallFor(base.attrs, pos)), id).toBeLessThanOrEqual(1);
      expect(focusOf(p).id).toBe(id);
    }
  });

  it("growth leans towards the aspiration but never exclusively", () => {
    const base = make("CB", 60, 18, "sys-tilt");
    const run = (focus: string | undefined) => {
      const attrs = { ...base.attrs };
      const rng = Rng.fromSeed("sys-tilt-growth");
      const tilt = focusTilt({ birthYear: 2008, position: "CB", focus, career: base.career }, 2026);
      for (let i = 0; i < 120; i++) applyGrowth(rng, attrs, "CB", 0.2, undefined, 0, [], tilt);
      return attrs;
    };
    const plain = run(undefined);
    const stopper = run("cb_aggressive");
    expect(stopper.aggression - base.attrs.aggression).toBeGreaterThan(plain.aggression - base.attrs.aggression);
    expect(stopper.tackling).toBeGreaterThan(base.attrs.tackling);
    expect(stopper.passing).toBeGreaterThan(base.attrs.passing - 0.01);
  });
});

// ───────────────────────────────────────────────────────────────────────── training

describe("training", () => {
  const session = (p: Player, focus: TrainingFocus, times = 40) => {
    const s = newCareer({ seed: "sys-train" });
    const u = s.players[s.user.playerId];
    const rng = Rng.fromSeed(`sys-train-${focus}`);
    Object.assign(u, { position: p.position, birthYear: s.season - 19, injury: null, fitness: 100 });
    u.attrs = { ...p.attrs };
    u.hidden = { ...u.hidden, potential: 95 };
    for (let i = 0; i < times; i++) {
      u.fitness = 100;
      runTraining(s, rng, u, { focus, intensity: "normal" });
    }
    return { before: p.attrs, after: u.attrs };
  };

  it("a focus spends a fixed budget on its own attributes: widening it never makes it a faster way to grow", () => {
    const p = make("CM", 70);
    for (const f of Object.keys(TRAINING_MODEL) as TrainingFocus[]) {
      const model = TRAINING_MODEL[f];
      const shares = trainingShares(p, model);
      if (f === "recovery") { expect(shares).toEqual([]); continue; }
      if (f === "balanced") {
        // worth the same overall as balanced work always was
        const w = POSITION_WEIGHTS.CM;
        expect(shares.reduce((s, [k, x]) => s + (w[k] ?? 0) * x, 0)).toBeCloseTo(0.45, 2);
        continue;
      }
      expect(shares.reduce((s, [, x]) => s + x, 0), f).toBeCloseTo(model.budget, 6);
      const primary = shares.filter(([k]) => model.attrs.includes(k)).map(([, x]) => x);
      const secondary = shares.filter(([k]) => model.secondary.includes(k)).map(([, x]) => x);
      if (secondary.length) expect(mean(primary), f).toBeGreaterThan(mean(secondary) * 1.9);
    }
  });

  it("each focus builds the attributes it names, the related ones more slowly, and little else", () => {
    const cases: [Position, TrainingFocus][] = [["ST", "finishing"], ["CM", "passing"], ["RW", "dribbling"], ["RW", "pace"], ["CB", "physical"], ["CB", "defending"], ["RB", "setPieces"], ["GK", "goalkeeping"]];
    for (const [pos, focus] of cases) {
      const p = make(pos, 62, 19, `sys-tr-${pos}-${focus}`);
      const { before, after } = session(p, focus);
      const model = TRAINING_MODEL[focus];
      const gain = (k: AttrKey) => after[k] - before[k];
      for (const k of model.attrs) expect(gain(k), `${focus} ${k}`).toBeGreaterThan(0.2);
      for (const k of model.secondary) if ((POSITION_WEIGHTS[pos][k] ?? 0) >= 0 || pos === "GK") expect(gain(k), `${focus} secondary ${k}`).toBeGreaterThan(0.05);
      const named = new Set<AttrKey>([...model.attrs, ...model.secondary]);
      const others = ALL_ATTRS.filter((k) => !named.has(k));
      expect(mean(others.map(gain)), focus).toBeLessThan(0.01);
      if (model.secondary.length) expect(mean(model.attrs.map(gain)), focus).toBeGreaterThan(mean(model.secondary.map(gain)) - 1e-9);
    }
  });

  it("the new attributes are trained: finishing builds movement and composure, defending builds marking, goalkeeping one-on-ones", () => {
    const f = session(make("ST", 62, 19, "sys-trn-1"), "finishing");
    expect(f.after.offBall).toBeGreaterThan(f.before.offBall);
    expect(f.after.composure).toBeGreaterThan(f.before.composure);
    const d = session(make("CB", 62, 19, "sys-trn-2"), "defending");
    expect(d.after.marking).toBeGreaterThan(d.before.marking);
    expect(d.after.interceptions).toBeGreaterThan(d.before.interceptions);
    const g = session(make("GK", 62, 19, "sys-trn-3"), "goalkeeping");
    expect(g.after.oneOnOnes).toBeGreaterThan(g.before.oneOnOnes);
    const sp = session(make("RW", 62, 19, "sys-trn-4"), "pace");
    expect(sp.after.agility).toBeGreaterThan(sp.before.agility);
  });

  it("recovery is rest, not a way to farm attributes", () => {
    const { before, after } = session(make("CM", 66, 19, "sys-rec"), "recovery", 80);
    for (const k of ALL_ATTRS) expect(after[k], k).toBe(before[k]);
  });

  it("every training label and card is still real", () => {
    for (const f of Object.keys(TRAINING_FOCUS) as TrainingFocus[]) {
      expect(TRAINING_FOCUS[f].label.length).toBeGreaterThan(0);
      expect(TRAINING_FOCUS[f].attrs.length).toBeLessThanOrEqual(3);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────── ageing and development

describe("ageing and development", () => {
  it("a general decline lands on athletic and skill attributes far more than on reading of the game", () => {
    const attrs = Object.fromEntries(ALL_ATTRS.map((k) => [k, 70])) as Record<AttrKey, number>;
    const rng = Rng.fromSeed("sys-decline");
    for (let i = 0; i < 120; i++) applyGrowth(rng, attrs, "CM", -0.04, undefined, 0.04, ["pace", "acceleration", "agility"]);
    const drop = (k: AttrKey) => 70 - attrs[k];
    expect(drop("stamina")).toBeGreaterThan(drop("decisions") + 2);
    expect(drop("stamina")).toBeGreaterThan(drop("anticipation") + 2);
    expect(drop("strength")).toBeLessThan(drop("stamina"));
    expect(DECLINE_SHARE.mind).toBeLessThan(DECLINE_SHARE.skill);
    // speed has its own curve and is protected here
    expect(drop("pace")).toBe(0);
  });

  it("over a few seasons past thirty, speed goes before touch, and the mind holds", () => {
    const s = newCareer({ seed: "sys-age" });
    const rng = Rng.fromSeed("sys-age-rng");
    const ps = Array.from({ length: 24 }, (_, i) => {
      const p = make("CM", 74, 32, `sys-age-${i}`);
      p.hidden = { ...p.hidden, peakAge: 28, professionalism: 55 };
      return p;
    });
    const before = ps.map((p) => ({ ...p.attrs }));
    for (const p of ps) for (let season = 0; season < 4; season++) {
      const state = { ...s, season: 2026 + season };
      for (let t = 0; t < 12; t++) developPlayer(state, rng, p, { club: null, trainingMultiplier: 1 });
    }
    const change = (k: AttrKey) => mean(ps.map((p, i) => p.attrs[k] - before[i][k]));
    expect(change("pace")).toBeLessThan(change("passing") - 1);
    expect(change("acceleration")).toBeLessThan(change("technique") - 1);
    expect(change("stamina")).toBeLessThan(change("decisions") - 1.5);
    expect(change("decisions")).toBeGreaterThan(-3.5);
    expect(change("anticipation")).toBeGreaterThan(-3.5);
  });

  it("young players do not grow everywhere at once: the profile specialises", () => {
    const s = newCareer({ seed: "sys-spec" });
    const rng = Rng.fromSeed("sys-spec-rng");
    const ranges: number[] = [];
    for (let i = 0; i < 20; i++) {
      const p = make("CM", 62, 18, `sys-spec-${i}`);
      p.hidden = { ...p.hidden, potential: 88 };
      for (let season = 0; season < 5; season++) {
        const state = { ...s, season: 2026 + season };
        for (let t = 0; t < 12; t++) developPlayer(state, rng, p, { club: null, trainingMultiplier: 1 });
      }
      const ks = Object.keys(POSITION_WEIGHTS.CM) as AttrKey[];
      ranges.push(Math.max(...ks.map((k) => p.attrs[k])) - Math.min(...ks.map((k) => p.attrs[k])));
    }
    expect(mean(ranges)).toBeGreaterThan(12);
  });
});

// ───────────────────────────────────────────────────────────────────────── tactical fit, selection, recruitment

const PRESS: PlayStyle = { pressing: 1, tempo: 0.5, directness: 0.5 };
const SIT: PlayStyle = { pressing: 0, tempo: 0.5, directness: 0.5 };
const POSSESSION: PlayStyle = { pressing: 0.5, tempo: 0, directness: 0 };
const DIRECT: PlayStyle = { pressing: 0.5, tempo: 0.7, directness: 1 };

describe("tactical fit", () => {
  const cm = make("CM", 72, 26, "sys-fit-cm");
  const presser = withAttrs(cm, { workRate: 88, stamina: 86, aggression: 78, anticipation: 80, tackling: 76, passing: 60, technique: 58, firstTouch: 62, decisions: 58, vision: 58 });
  const technician = withAttrs(cm, { workRate: 52, stamina: 60, aggression: 40, anticipation: 62, tackling: 52, passing: 86, technique: 86, firstTouch: 84, decisions: 82, vision: 80, composure: 80 });

  it("styles prefer different profiles", () => {
    expect(tacticalFit(presser, PRESS)).toBeGreaterThan(tacticalFit(technician, PRESS) + 8);
    expect(tacticalFit(technician, POSSESSION)).toBeGreaterThan(tacticalFit(presser, POSSESSION) + 8);
    const quick = withAttrs(make("ST", 72, 26, "sys-fit-st"), { pace: 90, acceleration: 88, offBall: 86, anticipation: 78, heading: 55, jumping: 55, strength: 55 });
    const aerial = withAttrs(make("ST", 72, 26, "sys-fit-st"), { pace: 58, acceleration: 56, offBall: 70, heading: 88, jumping: 88, strength: 86 });
    expect(tacticalFit(quick, DIRECT)).not.toBe(tacticalFit(aerial, DIRECT));
    const cb = make("CB", 72, 26, "sys-fit-cb");
    const reader = withAttrs(cb, { positioning: 86, marking: 84, interceptions: 82, anticipation: 82, workRate: 50, aggression: 45 });
    const hunter = withAttrs(cb, { positioning: 62, marking: 62, interceptions: 60, anticipation: 62, workRate: 86, aggression: 84, stamina: 86 });
    expect(tacticalFit(reader, SIT)).toBeGreaterThan(tacticalFit(hunter, SIT) + 8);
    expect(tacticalFit(hunter, PRESS)).toBeGreaterThan(tacticalFit(reader, PRESS) + 8);
  });

  it("it measures the shape of a game, not its size: two players of the same overall differ, and quality alone does not raise it", () => {
    expect(Math.abs(overallFor(presser.attrs, "CM") - overallFor(technician.attrs, "CM"))).toBeLessThan(8);
    const players = POSITIONS.flatMap((pos) => Array.from({ length: 70 }, (_, i) => make(pos, 55 + ((i * 7) % 35), 26, `sys-fit-${pos}-${i}`)));
    const style: PlayStyle = { pressing: 0.9, tempo: 0.2, directness: 0.15 };
    const fits = players.map((p) => tacticalFit(p, style));
    expect(Math.abs(corr(fits, players.map((p) => overallExact(p.attrs, p.position))))).toBeLessThan(0.3);
    expect(sd(fits)).toBeGreaterThan(5);
  });

  it("is bounded for every player and every style, and neutral styles ask for nothing", () => {
    const rng = Rng.fromSeed("sys-fit-bounds");
    for (let i = 0; i < 800; i++) {
      const pos = POSITIONS[i % POSITIONS.length];
      const p = make(pos, 40 + (i % 55), 26, `sys-fb-${i}`);
      const fit = tacticalFit(p, { pressing: rng.next(), tempo: rng.next(), directness: rng.next() });
      expect(fit).toBeGreaterThanOrEqual(20);
      expect(fit).toBeLessThanOrEqual(95);
    }
    expect(tacticalFit(cm, { pressing: 0.5, tempo: 0.5, directness: 0.5 })).toBeCloseTo(60 + 0, 0);
  });

  it("goalkeepers fit too: a sweeper suits a high line, a line keeper a deep one", () => {
    const gk = make("GK", 72, 26, "sys-fit-gk");
    const sweeper = withAttrs(gk, { command: 88, anticipation: 88, oneOnOnes: 86, kicking: 80, positioning: 62, handling: 66, reflexes: 70 });
    const line = withAttrs(gk, { command: 60, anticipation: 58, oneOnOnes: 62, kicking: 60, positioning: 88, handling: 88, reflexes: 86 });
    expect(tacticalFit(sweeper, PRESS)).toBeGreaterThan(tacticalFit(line, PRESS) + 8);
    expect(tacticalFit(line, SIT)).toBeGreaterThan(tacticalFit(sweeper, SIT) + 8);
  });

  it("names what helps and what holds a player back", () => {
    const d = fitDrivers(presser, PRESS);
    expect(d.helps.length).toBeGreaterThan(0);
    expect(d.helps.every((k) => ALL_ATTRS.includes(k))).toBe(true);
    const bad = fitDrivers(technician, PRESS);
    expect(bad.hurts.length).toBeGreaterThan(0);
  });

  it("style weights are cached per position and dial, and muted where a role does not use the attribute", () => {
    expect(styleWeights("CB", "directness", "hi")).toBe(styleWeights("CB", "directness", "hi"));
    const cbWeight = (k: AttrKey) => styleWeights("CB", "directness", "hi").find(([a]) => a === k)?.[1] ?? 0;
    const stWeight = (k: AttrKey) => styleWeights("ST", "directness", "hi").find(([a]) => a === k)?.[1] ?? 0;
    expect(cbWeight("finishing")).toBeLessThan(stWeight("finishing"));
    expect(cbWeight("jumping")).toBeGreaterThan(styleWeights("ST", "directness", "hi").find(([a]) => a === "longShots")?.[1] ?? 0);
  });
});

describe("selection", () => {
  it("fit can break a close decision but sits well under ability", () => {
    const a = withAttrs(make("CM", 72, 26, "sys-sel-a"), { workRate: 88, stamina: 86, aggression: 78, anticipation: 80, tackling: 76 });
    const slot: Position = "CM";
    const styles = [PRESS, SIT, POSSESSION, DIRECT];
    for (const style of styles) {
      const t = scoreParts(a, overallFor(a.attrs, slot), { style }).tactical;
      expect(t).toBeGreaterThanOrEqual(-TACTICAL_CAP);
      expect(t).toBeLessThanOrEqual(TACTICAL_CAP);
    }
    // Two equal players: the one who suits the manager's style is picked.
    const b = withAttrs(a, { workRate: 50, stamina: 62, aggression: 38, anticipation: 58, tackling: 50, passing: 84, technique: 84, firstTouch: 82, decisions: 80 });
    const equalised = withAttrs(b, {});
    const pa = scoreParts(a, 72, { style: PRESS });
    const pb = scoreParts(equalised, 72, { style: PRESS });
    expect(pa.tactical).toBeGreaterThan(pb.tactical);
  });

  it("never lets style beat a clearly better player, whatever the style", () => {
    const rng = Rng.fromSeed("sys-sel-gap");
    let flipped = 0;
    let trials = 0;
    for (let i = 0; i < 600; i++) {
      const pos = (["CM", "CB", "ST", "RW", "DM"] as Position[])[i % 5];
      const weak = make(pos, 70, 26, `sys-gap-w-${i}`);
      const strong = make(pos, 76, 26, `sys-gap-s-${i}`);
      const style: PlayStyle = { pressing: rng.next(), tempo: rng.next(), directness: rng.next() };
      trials++;
      const w = scoreParts(weak, overallFor(weak.attrs, pos), { style });
      const s = scoreParts(strong, overallFor(strong.attrs, pos), { style });
      const totalW = w.ability + w.tactical;
      const totalS = s.ability + s.tactical;
      if (totalW > totalS) flipped++;
    }
    expect(flipped / trials).toBe(0);
  });

  it("across whole squads, style costs the XI almost nothing in quality", () => {
    const rng = Rng.fromSeed("sys-sel-squads");
    const shape: Position[] = ["GK", "GK", "RB", "RB", "CB", "CB", "CB", "LB", "LB", "DM", "DM", "CM", "CM", "CM", "AM", "RW", "RW", "LW", "LW", "ST", "ST", "ST"];
    const total = (xi: ReturnType<typeof selectTeam>) => xi.starters.reduce((sum, x) => sum + fitFor(x.player, x.slot), 0);
    const drops: number[] = [];
    for (let sq = 0; sq < 40; sq++) {
      const squad = shape.map((pos, i) => make(pos, 62 + Math.round(rng.range(0, 14)), 26, `sys-squad-${sq}-${i}`));
      const base = total(selectTeam(squad, "4-3-3", null));
      for (let k = 0; k < 6; k++) {
        const style: PlayStyle = { pressing: rng.next(), tempo: rng.next(), directness: rng.next() };
        drops.push(base - total(selectTeam(squad, "4-3-3", null, { style })));
      }
    }
    drops.sort((a, b) => a - b);
    // Summed over eleven slots: it moves close calls and costs about a point in all, as the old formula did, and it is capped per player.
    expect(mean(drops)).toBeLessThan(2);
    expect(drops[Math.floor(drops.length * 0.9)]).toBeLessThan(9);
  });

  it("a style never costs more than the cap in any single score", () => {
    for (const style of [PRESS, SIT, POSSESSION, DIRECT]) for (const pos of POSITIONS) {
      const p = make(pos, 70, 26, `sys-cap-${pos}`);
      expect(Math.abs(scoreParts(p, 70, { style }, pos).tactical)).toBeLessThanOrEqual(TACTICAL_CAP + 1e-9);
    }
  });
});

describe("recruitment", () => {
  it("a club's style adds a bounded credit, in overall points", () => {
    const rng = Rng.fromSeed("sys-bonus");
    for (let i = 0; i < 600; i++) {
      const p = make(POSITIONS[i % POSITIONS.length], 50 + (i % 40), 26, `sys-rb-${i}`);
      const b = styleBonus(p, { style: { pressing: rng.next(), tempo: rng.next(), directness: rng.next() } });
      expect(Math.abs(b)).toBeLessThanOrEqual(2 + 1e-9);
    }
  });

  it("clubs with different identities prefer different players at the same position and level", () => {
    const cm = make("CM", 72, 26, "sys-rec-cm");
    const presser = withAttrs(cm, { workRate: 88, stamina: 86, aggression: 78, anticipation: 80, tackling: 76, passing: 60, technique: 58, firstTouch: 62, decisions: 58, vision: 58 });
    const technician = withAttrs(cm, { workRate: 52, stamina: 60, aggression: 40, anticipation: 62, tackling: 52, passing: 86, technique: 86, firstTouch: 84, decisions: 82, vision: 80, composure: 80 });
    const pressClub = { style: PRESS };
    const possClub = { style: POSSESSION };
    expect(styleBonus(presser, pressClub)).toBeGreaterThan(styleBonus(technician, pressClub));
    expect(styleBonus(technician, possClub)).toBeGreaterThan(styleBonus(presser, possClub));
    const winger = (extra: Partial<Record<AttrKey, number>>) => withAttrs(make("RW", 72, 26, "sys-rec-w"), extra);
    const quickW = winger({ pace: 90, acceleration: 90, offBall: 82, dribbling: 80, technique: 62, decisions: 58 });
    const slowW = winger({ pace: 60, acceleration: 58, offBall: 62, dribbling: 80, technique: 84, decisions: 82, passing: 82, firstTouch: 82 });
    const counter: PlayStyle = { pressing: 0.6, tempo: 0.9, directness: 0.9 };
    expect(styleBonus(quickW, { style: counter })).toBeGreaterThan(styleBonus(slowW, { style: counter }));
  });

  it("style never ranks a clearly weaker player first", () => {
    const rng = Rng.fromSeed("sys-rec-gap");
    let flipped = 0;
    for (let i = 0; i < 600; i++) {
      const pos = (["CM", "CB", "ST", "RW", "DM", "RB"] as Position[])[i % 6];
      const weak = make(pos, 70, 26, `sys-rg-w-${i}`);
      const strong = make(pos, 75, 26, `sys-rg-s-${i}`);
      const club = { style: { pressing: rng.next(), tempo: rng.next(), directness: rng.next() } };
      const sw = overallFor(weak.attrs, pos) + styleBonus(weak, club);
      const ss = overallFor(strong.attrs, pos) + styleBonus(strong, club);
      if (sw > ss) flipped++;
    }
    expect(flipped).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────── traits

describe("traits and the new attributes", () => {
  it("the overlay only names real traits and real attributes", () => {
    for (const [id, ks] of Object.entries(EXTRA_CORE)) {
      expect(TRAIT_BY_ID.get(id), id).toBeDefined();
      for (const k of ks) expect(ALL_ATTRS, `${id} ${k}`).toContain(k);
    }
    for (const [id, reqs] of Object.entries(EXTRA_REQ)) {
      expect(TRAIT_BY_ID.get(id), id).toBeDefined();
      for (const r of reqs) { expect(ALL_ATTRS).toContain(r.attr); expect(r.min).toBeGreaterThan(40); expect(r.min).toBeLessThan(70); }
    }
    // applying it twice is the same as once
    expect(withAttributeModel(TRAITS).map((t) => t.core.length)).toEqual(TRAITS.map((t) => t.core.length));
  });

  it("the traits are made of the right things", () => {
    const core = (id: string) => TRAIT_BY_ID.get(id)!.core;
    expect(core("pressing_machine")).toEqual(expect.arrayContaining(["workRate", "aggression", "stamina"]));
    expect(core("man_marker")).toContain("marking");
    expect(core("clinical_finisher")).toEqual(expect.arrayContaining(["finishing", "composure", "decisions"]));
    expect(core("playmaker")).toEqual(expect.arrayContaining(["passing", "vision", "decisions", "creativity"]));
    expect(core("poacher")).toContain("offBall");
    expect(core("aerial_dominator")).toContain("jumping");
  });

  it("a floor on a new attribute separates natural fits from mismatches, and attributes alone are not evidence", () => {
    const presserDef = TRAIT_BY_ID.get("pressing_machine")!;
    const cm = make("CM", 74, 26, "sys-trait-cm");
    expect(meetsRequirements(presserDef, withAttrs(cm, { workRate: 40, stamina: 95, tackling: 90 }).attrs)).toBe(false);
    expect(meetsRequirements(presserDef, withAttrs(cm, { workRate: 80, stamina: 85, tackling: 80 }).attrs)).toBe(true);
    // Record-based traits are never drawn at random, however good the attributes are.
    const star = withAttrs(make("ST", 80, 26, "sys-trait-st"), { finishing: 95, composure: 95, decisions: 95, offBall: 95 });
    const drawn = candidateTraits({ position: "ST", secondary: [], attrs: star.attrs }, true).map((c) => c.def);
    expect(drawn.filter((d) => d.earned)).toEqual([]);
  });
});
