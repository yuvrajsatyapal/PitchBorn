/**
 * Does each new attribute change football in the intended direction? One team's players get +/-30 on an attribute (everyone it
 * applies to), everything else equal and every match seed shared, so the difference is the attribute.
 *
 *   npx tsx scripts/sim/attribute-effects.ts [--matches 3000]
 *
 * Prints the change in the metric the attribute is meant to move, as a percentage of the baseline (or in absolute terms for rates).
 */
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../../src/engine/match/engine";
import { FORMATIONS } from "../../src/engine/match/lineup";
import { generatePlayer } from "../../src/engine/players/generate";
import { Rng } from "../../src/engine/rng";
import type { AttrKey, Position } from "../../src/engine/types";

const arg = (n: string, d: number) => (process.argv.includes(`--${n}`) ? Number(process.argv[process.argv.indexOf(`--${n}`) + 1]) : d);
const N = arg("matches", 3000);
const rng0 = Rng.fromSeed("attr-effects");
let n = 0;
function build(name: string, ovr: number): MatchPlayerInput[] {
  return FORMATIONS["4-3-3"].map((slot) => {
    const p = generatePlayer(rng0, { id: `${name}${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr, potential: ovr, clubId: null });
    return { id: p.id, name: p.lastName, slot, attrs: { ...p.attrs }, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55 };
  });
}
const teamOf = (name: string, starters: MatchPlayerInput[]): TeamInput => ({ id: name, name, short: name, starters, bench: [], mentality: 0, color: "#000" });
const home0 = build("h", 74);
const away0 = build("a", 74);

type Totals = { xgFor: number; xgAgainst: number; shotsFor: number; shotsAgainst: number; fouls: number; yellows: number; reds: number; poss: number; goalsFor: number; goalsAgainst: number };
function play(home: MatchPlayerInput[], away: MatchPlayerInput[]): Totals {
  const t: Totals = { xgFor: 0, xgAgainst: 0, shotsFor: 0, shotsAgainst: 0, fouls: 0, yellows: 0, reds: 0, poss: 0, goalsFor: 0, goalsAgainst: 0 };
  for (let i = 0; i < N; i++) {
    const r = new MatchEngine({ home: teamOf("H", home), away: teamOf("A", away), importance: 1, detail: false, neutral: true }, Rng.fromSeed(`m${i}`)).runToEnd();
    t.xgFor += r.stats.xg[0]; t.xgAgainst += r.stats.xg[1]; t.shotsFor += r.stats.shots[0]; t.shotsAgainst += r.stats.shots[1];
    t.fouls += r.stats.fouls[0]; t.yellows += r.stats.yellows[0]; t.reds += r.stats.reds[0]; t.poss += r.stats.possession[0]; t.goalsFor += r.homeGoals; t.goalsAgainst += r.awayGoals;
  }
  for (const k of Object.keys(t) as (keyof Totals)[]) t[k] /= N;
  return t;
}
const mutate = (xs: MatchInput[], keys: AttrKey[], delta: number, slots?: Position[]): MatchPlayerInput[] =>
  xs.map((p) => (slots && !slots.includes(p.slot) ? p : { ...p, attrs: Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, keys.includes(k as AttrKey) ? Math.max(1, Math.min(99, v + delta)) : v])) as MatchPlayerInput["attrs"] }));
type MatchInput = MatchPlayerInput;

const ATT: Position[] = ["ST", "RW", "LW", "AM"];
const MID: Position[] = ["CM", "DM", "AM"];
const DEF: Position[] = ["CB", "RB", "LB", "DM"];
const ALL: Position[] = ["CB", "RB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];
const base = play(home0, away0);
const pct = (a: number, b: number) => `${(100 * (a / b - 1)).toFixed(1).padStart(6)}%`;
console.log(`baseline (equal sides, ${N} matches): xG ${base.xgFor.toFixed(2)}-${base.xgAgainst.toFixed(2)} fouls ${base.fouls.toFixed(1)} yellow ${base.yellows.toFixed(2)} possession ${base.poss.toFixed(1)}%\n`);
const row = (label: string, v: string) => console.log(`${label.padEnd(54)} ${v}`);

const test = (label: string, attrs: AttrKey[], slots: Position[], delta: number, side: "home" | "away", read: (t: Totals) => string) => {
  const t = side === "home" ? play(mutate(home0, attrs, delta, slots), away0) : play(home0, mutate(away0, attrs, delta, slots));
  row(`${label} ${delta > 0 ? "+" : ""}${delta}`, read(t));
};
// Attacking side (home) improves in a way the attribute should help turn into chances.
test("offBall (attackers)         → own xG", ["offBall"], ATT, 30, "home", (t) => pct(t.xgFor, base.xgFor));
test("creativity (creators)       → own xG", ["creativity"], MID.concat(ATT), 30, "home", (t) => pct(t.xgFor, base.xgFor));
test("decisions (all)             → own xG", ["decisions"], ALL, 30, "home", (t) => pct(t.xgFor, base.xgFor));
test("technique (all)             → own xG", ["technique"], ALL, 30, "home", (t) => pct(t.xgFor, base.xgFor));
test("jumping (attack + back line)→ own xG", ["jumping"], ["ST", "CB", "RW", "LW"], 30, "home", (t) => pct(t.xgFor, base.xgFor));
test("agility (attack)            → own xG", ["agility"], ATT, 30, "home", (t) => pct(t.xgFor, base.xgFor));
// Defensive attributes move the OPPONENT's chances.
test("marking (back line)         → xG against", ["marking"], DEF, 30, "home", (t) => pct(t.xgAgainst, base.xgAgainst));
test("interceptions (back/mid)    → shots against", ["interceptions"], DEF.concat(["CM"]), 30, "home", (t) => pct(t.shotsAgainst, base.shotsAgainst));
test("anticipation (back/mid)     → shots against", ["anticipation"], DEF.concat(["CM"]), 30, "home", (t) => pct(t.shotsAgainst, base.shotsAgainst));
test("jumping (back line)         → xG against", ["jumping", "heading"], DEF, 30, "home", (t) => pct(t.xgAgainst, base.xgAgainst));
test("oneOnOnes (GK)              → xG against", ["oneOnOnes"], ["GK"], 40, "home", (t) => pct(t.xgAgainst, base.xgAgainst));
test("command (GK)                → xG against", ["command", "handling"], ["GK"], 40, "home", (t) => pct(t.xgAgainst, base.xgAgainst));
test("anticipation (GK)           → shots against", ["anticipation", "command", "oneOnOnes"], ["GK"], 40, "home", (t) => pct(t.shotsAgainst, base.shotsAgainst));
// Temperament.
test("aggression (defenders)      → own fouls", ["aggression"], DEF, 30, "home", (t) => pct(t.fouls, base.fouls));
test("aggression (defenders)      → own yellows", ["aggression"], DEF, 30, "home", (t) => pct(t.yellows, base.yellows));
test("decisions (all)             → own yellows", ["decisions"], ALL, 30, "home", (t) => pct(t.yellows, base.yellows));
// Pressing against resisting: set one side's press, then the other's resistance.
test("workRate+aggr+anticip (home) → possession", ["workRate", "aggression", "anticipation"], ALL, 30, "home", (t) => `${(t.poss - base.poss).toFixed(1)} pts`);
test("workRate+aggr+anticip (away) → home possession", ["workRate", "aggression", "anticipation"], ALL, 30, "away", (t) => `${(t.poss - base.poss).toFixed(1)} pts`);
test("balance+agility+touch (home) → possession", ["balance", "agility", "firstTouch"], ALL, 30, "home", (t) => `${(t.poss - base.poss).toFixed(1)} pts`);
