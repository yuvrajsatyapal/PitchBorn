/**
 * Attribute model sanity: distributions by position and age, overall stability, specialisation, and the team-level reference levels the
 * match engine centres its new effects on.   npm run sim:attributes
 */
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../../src/engine/match/engine";
import { FORMATIONS } from "../../src/engine/match/lineup";
import { overallFor, POSITION_WEIGHTS } from "../../src/engine/players/attributes";
import { generatePlayer } from "../../src/engine/players/generate";
import { ATTR } from "../../src/engine/players/model";
import { Rng } from "../../src/engine/rng";
import { ALL_ATTRS, POSITIONS, type AttrKey, type Player, type Position } from "../../src/engine/types";

const rng = Rng.fromSeed("attrs-sim");
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
let n = 0;
const make = (position: Position, ovr: number, age = 26): Player => generatePlayer(rng, { id: `a${n++}`, nationality: "ENG", position, age, season: 2026, overall: ovr, potential: ovr, clubId: null });

// 1. Means / sd per attribute for role-relevant attributes, at overall 72.
console.log("== Mean (sd) of each role-weighted attribute, overall 72 ==");
for (const pos of POSITIONS) {
  const ps = Array.from({ length: 600 }, () => make(pos, 72));
  const keys = Object.keys(POSITION_WEIGHTS[pos]) as AttrKey[];
  console.log(`${pos}: ` + keys.map((k) => `${ATTR[k].label.split(" ")[0]} ${mean(ps.map((p) => p.attrs[k])).toFixed(0)}(${sd(ps.map((p) => p.attrs[k])).toFixed(0)})`).join("  "));
  const ovrs = ps.map((p) => overallFor(p.attrs, pos));
  if (Math.abs(mean(ovrs) - 72) > 0.6) console.log(`   !! overall mean ${mean(ovrs).toFixed(2)}`);
}

// 2. How different do players of the same position and overall look? (the share of attribute variance that is not just overall)
console.log("\n== Spread of the non-role attributes (should not collapse to one number) ==");
for (const pos of ["CB", "CM", "ST", "GK"] as Position[]) {
  const ps = Array.from({ length: 600 }, () => make(pos, 72));
  const off = ALL_ATTRS.filter((k) => !(POSITION_WEIGHTS[pos][k] ?? 0));
  console.log(`${pos}: off-role mean ${mean(off.flatMap((k) => ps.map((p) => p.attrs[k]))).toFixed(0)}`);
}

// 3. Archetype spread: how often does a profile have a >=15 gap between its best and worst role attribute?
for (const pos of ["CM", "RW", "CB"] as Position[]) {
  const ps = Array.from({ length: 600 }, () => make(pos, 72));
  const keys = Object.keys(POSITION_WEIGHTS[pos]) as AttrKey[];
  console.log(`${pos}: mean role-attribute range ${mean(ps.map((p) => Math.max(...keys.map((k) => p.attrs[k])) - Math.min(...keys.map((k) => p.attrs[k])))).toFixed(1)}`);
}

// 4. Team reference levels (what an ordinary side measures at in the engine), per quality.
function team(ovr: number): TeamInput {
  const mk = (slot: Position): MatchPlayerInput => {
    const p = make(slot, ovr + rng.normal(0, 3));
    return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55 };
  };
  return { id: "t", name: "t", short: "t", starters: FORMATIONS["4-3-3"].map(mk), bench: [], mentality: 0, color: "#000" };
}
for (const q of [62, 72, 82]) {
  const acc: Record<string, number[]> = {};
  for (let i = 0; i < 300; i++) {
    const e = new MatchEngine({ home: team(q), away: team(q), importance: 1, detail: false }, rng.fork(i)) as unknown as { strength(t: unknown): Record<string, number>; teams: { home: unknown } };
    const c = e.strength(e.teams.home);
    for (const k of ["mark", "air", "lane", "press", "resist", "aggr", "sweep", "build"]) (acc[k] ??= []).push(c[k]);
  }
  console.log(`team ${q}: ` + Object.entries(acc).map(([k, v]) => `${k} ${mean(v).toFixed(1)}(${sd(v).toFixed(1)})`).join("  "));
}
