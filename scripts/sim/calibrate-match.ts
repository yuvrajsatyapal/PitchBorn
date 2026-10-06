/** Match engine calibration: run many matches between generated teams and print aggregate stats. */
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../../src/engine/match/engine";
import { FORMATIONS } from "../../src/engine/match/lineup";
import { generatePlayer } from "../../src/engine/players/generate";
import { Rng } from "../../src/engine/rng";

const rng = Rng.fromSeed("calib");
let n = 0;
function team(name: string, ovr: number): TeamInput {
  const mk = (slot: (typeof FORMATIONS)["4-3-3"][number]): MatchPlayerInput => {
    const p = generatePlayer(rng, { id: `p${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr + rng.normal(0, 3), potential: ovr, clubId: null });
    return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55 };
  };
  return { id: name, name, short: name, starters: FORMATIONS["4-3-3"].map(mk), bench: (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map(mk), mentality: 0, color: "#000" };
}
function run(label: string, ho: number, ao: number, N = 1500) {
  let hg = 0, ag = 0, hw = 0, d = 0, shots = 0, sot = 0, big = 0, reds = 0, yel = 0, inj = 0, xg = 0, pens = 0;
  const h = team("H", ho), a = team("A", ao);
  for (let i = 0; i < N; i++) {
    const r = new MatchEngine({ home: h, away: a, importance: 1, detail: false }, rng.fork(i)).runToEnd();
    hg += r.homeGoals; ag += r.awayGoals; if (r.homeGoals > r.awayGoals) hw++; else if (r.homeGoals === r.awayGoals) d++;
    shots += r.stats.shots[0] + r.stats.shots[1]; sot += r.stats.onTarget[0] + r.stats.onTarget[1];
    if (r.homeGoals + r.awayGoals >= 7) big++; reds += r.stats.reds[0] + r.stats.reds[1]; yel += r.stats.yellows[0] + r.stats.yellows[1];
    inj += r.injuries.length; xg += r.stats.xg[0] + r.stats.xg[1]; pens += r.goals.filter(g=>g.penalty).length;
  }
  console.log(`${label}: goals/m ${((hg + ag) / N).toFixed(2)} (H ${(hg / N).toFixed(2)} A ${(ag / N).toFixed(2)}) HW ${(hw / N * 100).toFixed(0)}% D ${(d / N * 100).toFixed(0)}% AW ${((N - hw - d) / N * 100).toFixed(0)}% shots ${(shots / N).toFixed(1)} sot ${(sot / N).toFixed(1)} xg ${(xg/N).toFixed(2)} 7+ ${(big / N * 100).toFixed(1)}% yel ${(yel / N).toFixed(1)} red ${(reds / N).toFixed(2)} inj ${(inj / N).toFixed(2)} penG ${(pens/N).toFixed(2)}`);
}
const t0 = Date.now();
run("equal 70", 70, 70);
run("equal 82", 82, 82);
run("80 vs 70", 80, 70);
run("70 vs 80", 70, 80);
run("85 vs 60", 85, 60);
console.log("ms per match", (Date.now() - t0) / 7500);
