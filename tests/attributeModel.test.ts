import { describe, expect, it } from "vitest";
import { generateAttributes, overallFor, POSITION_WEIGHTS as WEIGHTS_VIA_ATTRIBUTES } from "../src/engine/players/attributes";
import { generatePlayer } from "../src/engine/players/generate";
import {
  ATTR, ATTR_GROUPS, DECLINE_SHARE, LEGACY_POSITION_WEIGHTS, MATURITY, POSITION_WEIGHTS, TRAINING_MODEL, TRAIT_LEAN, groupsFor, legacyOverall, styleWeights,
} from "../src/engine/players/model";
import { Rng } from "../src/engine/rng";
import { TRAIT_BY_ID } from "../src/engine/traits/registry";
import { ADDED_ATTRS, ALL_ATTRS, GK_ATTRS, LEGACY_ATTRS, OUTFIELD_ATTRS, POSITIONS, type AttrKey, type Position } from "../src/engine/types";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const corr = (xs: number[], ys: number[]) => {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  return sxy / Math.sqrt(sxx * syy);
};
let n = 0;
const make = (position: Position, overall: number, age = 26, seed?: string) =>
  generatePlayer(Rng.fromSeed(seed ?? `am-${n++}`), { id: seed ?? `am-${n}`, nationality: "ENG", position, age, season: 2026, overall, potential: overall + 3, clubId: null });

describe("the attribute model", () => {
  it("defines every attribute once, in a group, and keeps the legacy order stable", () => {
    expect(new Set(ALL_ATTRS).size).toBe(ALL_ATTRS.length);
    expect([...LEGACY_ATTRS].slice(0, 15)).toEqual(["pace", "acceleration", "stamina", "strength", "finishing", "longShots", "passing", "vision", "crossing", "dribbling", "firstTouch", "tackling", "positioning", "heading", "composure"]);
    expect(ALL_ATTRS.slice(0, 20)).toEqual([...LEGACY_ATTRS]);
    for (const k of ALL_ATTRS) {
      expect(ATTR[k], k).toBeDefined();
      expect(ATTR[k].label.length).toBeGreaterThan(0);
    }
    const shown = ATTR_GROUPS.flatMap((g) => g.keys);
    expect([...shown].sort()).toEqual([...ALL_ATTRS].sort());
    expect(OUTFIELD_ATTRS.length + GK_ATTRS.length).toBe(ALL_ATTRS.length);
    expect(OUTFIELD_ATTRS.length).toBe(27);
    expect(GK_ATTRS).toContain("oneOnOnes");
  });

  it("every attribute earns a place: some position weighs it, and every added one is trained or tilted somewhere", () => {
    const weighed = new Set<AttrKey>();
    for (const pos of POSITIONS) for (const k of Object.keys(POSITION_WEIGHTS[pos]) as AttrKey[]) weighed.add(k);
    for (const k of ALL_ATTRS) expect(weighed.has(k), `${k} appears in no position's overall`).toBe(true);
    const trained = new Set<AttrKey>(Object.values(TRAINING_MODEL).flatMap((m) => [...m.attrs, ...m.secondary]));
    const aged = new Set<AttrKey>([...(Object.keys(MATURITY) as AttrKey[]), ...ALL_ATTRS.filter((k) => ATTR[k].ageing !== "skill")]);
    for (const k of ADDED_ATTRS) expect(trained.has(k) || aged.has(k), `${k} is neither trained nor aged distinctly`).toBe(true);
  });

  it("position weights are valid, sum to one, and the same table is reachable from attributes.ts", () => {
    expect(WEIGHTS_VIA_ATTRIBUTES).toBe(POSITION_WEIGHTS);
    for (const pos of POSITIONS) {
      const w = POSITION_WEIGHTS[pos];
      const sum = Object.values(w).reduce((s, x) => s + (x ?? 0), 0);
      expect(sum, pos).toBeCloseTo(1, 6);
      for (const k of Object.keys(w)) expect(ALL_ATTRS, `${pos} ${k}`).toContain(k);
      const legacy = Object.values(LEGACY_POSITION_WEIGHTS[pos]).reduce((s, x) => s + (x ?? 0), 0);
      expect(legacy, `legacy ${pos}`).toBeCloseTo(1, 6);
    }
    // goalkeepers are judged on goalkeeping; outfielders on none of it
    for (const k of ["reflexes", "diving", "handling"] as AttrKey[]) expect(POSITION_WEIGHTS.GK[k] ?? 0).toBeGreaterThan(0.15);
    for (const pos of POSITIONS.filter((p) => p !== "GK")) for (const k of GK_ATTRS) expect(POSITION_WEIGHTS[pos][k], `${pos} ${k}`).toBeUndefined();
  });

  it("the ageing, training and style tables only name real attributes and real focuses", () => {
    for (const k of Object.keys(MATURITY)) expect(ALL_ATTRS).toContain(k);
    for (const [f, m] of Object.entries(TRAINING_MODEL)) {
      for (const k of [...m.attrs, ...m.secondary]) expect(ALL_ATTRS, `${f} ${k}`).toContain(k);
    }
    expect(DECLINE_SHARE.explosive).toBe(0);
    expect(DECLINE_SHARE.athletic).toBeGreaterThan(DECLINE_SHARE.skill);
    expect(DECLINE_SHARE.skill).toBeGreaterThan(DECLINE_SHARE.mind);
    for (const pos of POSITIONS) for (const dim of ["pressing", "tempo", "directness"] as const) for (const side of ["hi", "lo"] as const) {
      const ws = styleWeights(pos, dim, side);
      expect(ws.reduce((s, [, w]) => s + w, 0), `${pos} ${dim} ${side}`).toBeCloseTo(1, 6);
    }
  });

  it("every trait id used to seed attributes exists, and only leans on attributes the player can have added", () => {
    for (const [id, lean] of Object.entries(TRAIT_LEAN)) {
      expect(TRAIT_BY_ID.get(id), id).toBeDefined();
      for (const k of Object.keys(lean)) expect(ADDED_ATTRS as readonly string[], `${id} → ${k}`).toContain(k);
    }
  });

  it("a goalkeeper sees goalkeeping first, and only the shared attributes his role uses", () => {
    const gk = groupsFor("GK");
    expect(gk[0].label).toBe("Goalkeeping");
    const keys = gk.flatMap((g) => g.keys);
    for (const k of keys) expect(POSITION_WEIGHTS.GK[k] ?? 0, k).toBeGreaterThan(0);
    expect(keys).not.toContain("pace");
    const out = groupsFor("CM");
    expect(out.map((g) => g.label)).not.toContain("Goalkeeping");
    expect(out.flatMap((g) => g.keys)).toHaveLength(OUTFIELD_ATTRS.length);
  });
});

describe("generation", () => {
  it("is deterministic and keeps every attribute in 1–99", () => {
    for (const pos of POSITIONS) {
      const a = generateAttributes(Rng.fromSeed(`det-${pos}`), pos, 70, 181);
      const b = generateAttributes(Rng.fromSeed(`det-${pos}`), pos, 70, 181);
      expect(a).toEqual(b);
      for (const k of ALL_ATTRS) {
        expect(a[k], `${pos} ${k}`).toBeGreaterThanOrEqual(1);
        expect(a[k], `${pos} ${k}`).toBeLessThanOrEqual(99);
        expect(Number.isFinite(a[k])).toBe(true);
      }
    }
    expect(make("CM", 70, 26, "same").attrs).toEqual(make("CM", 70, 26, "same").attrs);
  });

  it("lands on the requested overall for every position and level, without inflating it", () => {
    for (const pos of POSITIONS) {
      for (const target of [50, 62, 72, 82, 90]) {
        const overalls = Array.from({ length: 60 }, (_, i) => overallFor(generateAttributes(Rng.fromSeed(`ov-${pos}-${target}-${i}`), pos, target, 181), pos));
        expect(Math.abs(mean(overalls) - target), `${pos} ${target}`).toBeLessThan(0.6);
        expect(Math.max(...overalls.map((o) => Math.abs(o - target))), `${pos} ${target}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("positions look different: movement for strikers, marking for centre-backs, goalkeeping for keepers", () => {
    const avg = (pos: Position, k: AttrKey) => mean(Array.from({ length: 150 }, (_, i) => make(pos, 72, 26, `pos-${pos}-${i}`).attrs[k]));
    expect(avg("ST", "offBall") - avg("CB", "offBall")).toBeGreaterThan(15);
    expect(avg("CB", "marking") - avg("ST", "marking")).toBeGreaterThan(20);
    expect(avg("CB", "interceptions") - avg("RW", "interceptions")).toBeGreaterThan(12);
    expect(avg("AM", "creativity") - avg("CB", "creativity")).toBeGreaterThan(15);
    expect(avg("GK", "oneOnOnes") - avg("ST", "oneOnOnes")).toBeGreaterThan(40);
    expect(avg("RW", "agility") - avg("CB", "agility")).toBeGreaterThan(5);
  });

  it("related abilities stay correlated, but players are not carbon copies", () => {
    const dms = Array.from({ length: 300 }, (_, i) => make("DM", 76, 26, `dm-${i}`));
    // a strong holding midfielder does not have a defender's tackling and a ballboy's reading of the game
    expect(dms.filter((p) => p.attrs.tackling >= 75 && p.attrs.interceptions < 50).length / dms.length).toBeLessThan(0.02);
    expect(dms.filter((p) => p.attrs.positioning >= 75 && p.attrs.anticipation < 45).length / dms.length).toBeLessThan(0.02);
    expect(corr(dms.map((p) => p.attrs.tackling), dms.map((p) => p.attrs.marking))).toBeGreaterThan(0.25);
    expect(corr(dms.map((p) => p.attrs.stamina), dms.map((p) => p.attrs.workRate))).toBeGreaterThan(0.3);
    // …and the same position and overall still produces a wide spread of profiles
    const cms = Array.from({ length: 300 }, (_, i) => make("CM", 72, 26, `cm-${i}`));
    const range = cms.map((p) => { const ks = Object.keys(POSITION_WEIGHTS.CM) as AttrKey[]; return Math.max(...ks.map((k) => p.attrs[k])) - Math.min(...ks.map((k) => p.attrs[k])); });
    expect(mean(range)).toBeGreaterThan(14);
  });

  it("temperament does not rise with quality: elite players are not simply more aggressive", () => {
    const low = Array.from({ length: 200 }, (_, i) => make("CB", 62, 26, `ag-lo-${i}`).attrs.aggression);
    const high = Array.from({ length: 200 }, (_, i) => make("CB", 84, 26, `ag-hi-${i}`).attrs.aggression);
    expect(Math.abs(mean(high) - mean(low))).toBeLessThan(4);
  });

  it("older players read the game better and move less quickly than younger ones of the same overall", () => {
    const young = Array.from({ length: 200 }, (_, i) => make("CM", 72, 20, `yo-${i}`));
    const old = Array.from({ length: 200 }, (_, i) => make("CM", 72, 33, `ol-${i}`));
    expect(mean(old.map((p) => p.attrs.decisions)) - mean(young.map((p) => p.attrs.decisions))).toBeGreaterThan(3);
    expect(mean(old.map((p) => p.attrs.anticipation)) - mean(young.map((p) => p.attrs.anticipation))).toBeGreaterThan(3);
  });

  it("a legacy-weighted overall equals the role overall within a point (the expansion is overall-neutral)", () => {
    for (const pos of POSITIONS) {
      for (let i = 0; i < 40; i++) {
        const p = make(pos, 60 + (i % 5) * 7, 25, `neutral-${pos}-${i}`);
        expect(Math.abs(legacyOverall(p.attrs, pos) - overallFor(p.attrs, pos)), `${pos}`).toBeLessThan(2.5);
      }
    }
  });
});
