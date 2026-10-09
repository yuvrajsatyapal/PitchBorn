/**
 * Involvement distribution: what a player at each position and quality actually does in a detailed match, and whether being
 * involved (and being asked) leaves the football around him unchanged. Run: npx tsx scripts/sim/involvement.ts [matches]
 */
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../../src/engine/match/engine";
import { FORMATIONS } from "../../src/engine/match/lineup";
import { generatePlayer } from "../../src/engine/players/generate";
import { Rng } from "../../src/engine/rng";
import type { Position } from "../../src/engine/types";

const N = Number(process.argv[2] ?? 150);
const CMP = Number(process.argv[3] ?? 4);
const rng = Rng.fromSeed("involve");
let n = 0;
function mk(slot: Position, ovr: number, user = false): MatchPlayerInput {
  const p = generatePlayer(rng, { id: `p${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr + rng.normal(0, 2), potential: ovr, clubId: null });
  return { id: user ? "USER" : p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55, isUser: user };
}
function team(name: string, ovr: number, user?: { slot: Position; ovr: number }): TeamInput {
  const shape = FORMATIONS[user?.slot === "AM" ? "4-2-3-1" : "4-3-3"];
  const starters = shape.map((slot, i) => (user && slot === user.slot && !shape.slice(0, i).includes(slot) ? mk(slot, user.ovr, true) : mk(slot, ovr)));
  return { id: name, name, short: name, starters, bench: (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map((s) => mk(s, ovr)), mentality: 0, color: "#000" };
}
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const sd = (a: number[]) => Math.sqrt(avg(a.map((x) => (x - avg(a)) ** 2)));

console.log(`position/quality involvement over ${N} matches (user team 72 avg vs 72)`);
console.log("slot  ovr | touches passes pass% drb won duels won intc clear recov | rating sd | asked");
for (const slot of ["GK", "CB", "RB", "DM", "CM", "AM", "RW", "ST"] as Position[]) {
  for (const q of [55, 70, 85]) {
    const t = { touches: [] as number[], passes: [] as number[], ok: [] as number[], drb: [] as number[], drbW: [] as number[], duels: [] as number[], duelsW: [] as number[], intc: [] as number[], clr: [] as number[], rec: [] as number[], rating: [] as number[], asked: [] as number[] };
    for (let i = 0; i < N; i++) {
      const home = team("H", 72, { slot, ovr: q });
      const away = team("A", 72);
      const eng = new MatchEngine({ home, away, importance: 1, detail: true, interactive: true }, rng.fork(`${slot}${q}${i}`));
      const res = eng.runToEnd();
      const l = res.lines.find((x) => x.id === "USER");
      if (!l?.inv) continue;
      t.touches.push(l.inv.touches); t.passes.push(l.inv.passes); t.ok.push(l.inv.passesOk); t.drb.push(l.inv.dribbles); t.drbW.push(l.inv.dribblesWon);
      t.duels.push(l.inv.duels); t.duelsW.push(l.inv.duelsWon); t.intc.push(l.inv.interceptions); t.clr.push(l.inv.clearances); t.rec.push(l.inv.recoveries);
      t.rating.push(l.rating); t.asked.push(res.events.filter((e) => e.type === "decision").length);
    }
    const f = (a: number[]) => avg(a).toFixed(1).padStart(5);
    console.log(`${slot.padEnd(3)}   ${q}  | ${f(t.touches)} ${f(t.passes)} ${((avg(t.ok) / Math.max(1, avg(t.passes))) * 100).toFixed(0).padStart(4)}% ${f(t.drb)} ${f(t.drbW)} ${f(t.duels)} ${f(t.duelsW)} ${f(t.intc)} ${f(t.clr)} ${f(t.rec)} | ${avg(t.rating).toFixed(2)} ${sd(t.rating).toFixed(2)} | ${f(t.asked)}`);
  }
}

// The same seeds with and without the flow-of-play layer: the football must not move.
function compare(label: string, interactive: boolean) {
  let goals = 0, shots = 0, xg = 0, cards = 0, fouls = 0, poss = 0, big = 0, hxg = 0, axg = 0;
  const ratings: number[] = [];
  for (let i = 0; i < N * CMP; i++) {
    const home = team("H", 74, { slot: "CM", ovr: 72 });
    const away = team("A", 72);
    const r = new MatchEngine({ home, away, importance: 1, detail: label !== "fast", interactive }, rng.fork(`cmp${i}`)).runToEnd();
    goals += r.homeGoals + r.awayGoals; shots += r.stats.shots[0] + r.stats.shots[1]; xg += r.stats.xg[0] + r.stats.xg[1];
    cards += r.stats.yellows[0] + r.stats.yellows[1] + r.stats.reds[0] + r.stats.reds[1]; fouls += r.stats.fouls[0] + r.stats.fouls[1]; poss += r.stats.possession[0];
    hxg += r.stats.xg[0]; axg += r.stats.xg[1];
    if (r.homeGoals + r.awayGoals >= 7) big++;
    for (const l of r.lines) if (l.started) ratings.push(l.rating);
  }
  const M = N * CMP;
  console.log(`${label.padEnd(22)} goals ${(goals / M).toFixed(2)} shots ${(shots / M).toFixed(1)} xg ${(xg / M).toFixed(2)} (user ${(hxg / M).toFixed(2)} opp ${(axg / M).toFixed(2)}) cards ${(cards / M).toFixed(2)} fouls ${(fouls / M).toFixed(1)} poss ${(poss / M).toFixed(1)} 7+ ${((big / M) * 100).toFixed(1)}% | starter rating ${avg(ratings).toFixed(2)} sd ${sd(ratings).toFixed(2)}`);
}
console.log("\nfootball around the user: fast sim vs detailed vs interactive (auto-resolved)");
compare("fast", false);
compare("detailed", false);
compare("interactive (auto)", true);
