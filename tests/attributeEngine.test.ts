import { beforeAll, describe, expect, it } from "vitest";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS } from "../src/engine/match/lineup";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import type { AttrKey, Position } from "../src/engine/types";

/**
 * Does each new attribute change football the way it is meant to? One side's players get a big change on an attribute, everything else
 * and every match seed identical, so the difference between the two runs is the attribute. The changes are exaggerated (±30–40) so
 * that the direction is unmistakable over a few thousand matches; the effects on real squads, where players differ by a few points, are
 * proportionally small (see scripts/sim/attribute-effects.ts).
 */
const N = 3000;
const rng0 = Rng.fromSeed("attr-engine-test");
let n = 0;
const build = (name: string, ovr: number): MatchPlayerInput[] =>
  FORMATIONS["4-3-3"].map((slot) => {
    const p = generatePlayer(rng0, { id: `${name}${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr, potential: ovr, clubId: null });
    return { id: p.id, name: p.lastName, slot, attrs: { ...p.attrs }, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55 };
  });
const home0 = build("h", 74);
const away0 = build("a", 74);
const teamOf = (name: string, starters: MatchPlayerInput[]): TeamInput => ({ id: name, name, short: name, starters, bench: [], mentality: 0, color: "#000" });

interface Totals { xgFor: number; xgAgainst: number; shotsFor: number; shotsAgainst: number; fouls: number; yellows: number; poss: number }
function play(home: MatchPlayerInput[], away: MatchPlayerInput[]): Totals {
  const t: Totals = { xgFor: 0, xgAgainst: 0, shotsFor: 0, shotsAgainst: 0, fouls: 0, yellows: 0, poss: 0 };
  for (let i = 0; i < N; i++) {
    const r = new MatchEngine({ home: teamOf("H", home), away: teamOf("A", away), importance: 1, detail: false, neutral: true }, Rng.fromSeed(`m${i}`)).runToEnd();
    t.xgFor += r.stats.xg[0]; t.xgAgainst += r.stats.xg[1]; t.shotsFor += r.stats.shots[0]; t.shotsAgainst += r.stats.shots[1];
    t.fouls += r.stats.fouls[0]; t.yellows += r.stats.yellows[0]; t.poss += r.stats.possession[0];
  }
  for (const k of Object.keys(t) as (keyof Totals)[]) t[k] /= N;
  return t;
}
const mutate = (xs: MatchPlayerInput[], keys: AttrKey[], delta: number, slots: Position[]): MatchPlayerInput[] =>
  xs.map((p) => (!slots.includes(p.slot) ? p : { ...p, attrs: Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, keys.includes(k as AttrKey) ? Math.max(1, Math.min(99, v + delta)) : v])) as MatchPlayerInput["attrs"] }));

const ATT: Position[] = ["ST", "RW", "LW", "AM"];
const MID: Position[] = ["CM", "DM", "AM"];
const BACK: Position[] = ["CB", "RB", "LB", "DM"];
const ALL: Position[] = ["CB", "RB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];

describe("the new attributes change football in the intended direction", () => {
  let base: Totals;
  beforeAll(() => { base = play(home0, away0); }, 120_000);
  const own = (keys: AttrKey[], slots: Position[], delta: number) => play(mutate(home0, keys, delta, slots), away0);
  const rel = (a: number, b: number) => a / b - 1;

  it("off-the-ball movement turns into chances", () => { expect(rel(own(["offBall"], ATT, 30).xgFor, base.xgFor)).toBeGreaterThan(0.03); }, 60_000);
  it("creativity makes better chances", () => { expect(rel(own(["creativity"], MID.concat(ATT), 40).xgFor, base.xgFor)).toBeGreaterThan(0.01); }, 60_000);
  it("decisions improve shot selection", () => { expect(rel(own(["decisions"], ALL, 30).xgFor, base.xgFor)).toBeGreaterThan(0.03); }, 60_000);
  it("technique improves the quality of shots", () => { expect(rel(own(["technique"], ALL, 30).xgFor, base.xgFor)).toBeGreaterThan(0.03); }, 60_000);
  it("agility helps attackers beat the line", () => { expect(rel(own(["agility"], ATT, 30).xgFor, base.xgFor)).toBeGreaterThan(0.01); }, 60_000);
  it("marking suppresses the opposition's chances", () => { expect(rel(own(["marking"], BACK, 30).xgAgainst, base.xgAgainst)).toBeLessThan(-0.03); }, 60_000);
  it("interceptions cut out attacks before they start", () => { expect(rel(own(["interceptions"], BACK.concat(["CM"]), 30).shotsAgainst, base.shotsAgainst)).toBeLessThan(-0.03); }, 60_000);
  it("anticipation does the same, by reading what happens next", () => { expect(rel(own(["anticipation"], BACK.concat(["CM"]), 30).shotsAgainst, base.shotsAgainst)).toBeLessThan(-0.03); }, 60_000);
  it("aerial strength at the back concedes fewer headed chances", () => { expect(rel(own(["jumping", "heading"], BACK, 30).xgAgainst, base.xgAgainst)).toBeLessThan(-0.015); }, 60_000);
  it("a keeper who wins one-on-ones concedes less", () => { expect(rel(own(["oneOnOnes"], ["GK"], 40).xgAgainst, base.xgAgainst)).toBeLessThan(-0.01); }, 60_000);
  it("a commanding keeper concedes fewer headed chances", () => { expect(rel(own(["command", "handling"], ["GK"], 40).xgAgainst, base.xgAgainst)).toBeLessThan(-0.03); }, 60_000);
  it("a keeper who reads the through-ball faces fewer one-on-ones", () => { expect(rel(own(["anticipation", "command", "oneOnOnes"], ["GK"], 40).xgAgainst, base.xgAgainst)).toBeLessThan(-0.03); }, 60_000);
  it("aggression brings fouls and cards", () => {
    const t = own(["aggression"], BACK, 30);
    expect(rel(t.fouls, base.fouls)).toBeGreaterThan(0.03);
    expect(rel(t.yellows, base.yellows)).toBeGreaterThan(0.1);
  }, 60_000);
  it("a clear head means fewer bookings", () => { expect(rel(own(["decisions"], ALL, 30).yellows, base.yellows)).toBeLessThan(-0.05); }, 60_000);
  it("pressing wins possession, and composure under pressure keeps it", () => {
    const press = ["workRate", "aggression", "anticipation"] as AttrKey[];
    expect(own(press, ALL, 30).poss).toBeGreaterThan(base.poss + 1);
    expect(play(home0, mutate(away0, press, 30, ALL)).poss).toBeLessThan(base.poss - 1);
    expect(own(["balance", "agility", "firstTouch"], ALL, 30).poss).toBeGreaterThan(base.poss + 1);
  }, 60_000);
});
