/** Match engine calibration: run many matches between generated teams and print aggregate stats. */
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../../src/engine/match/engine";
import { FORMATIONS } from "../../src/engine/match/lineup";
import { generatePlayer } from "../../src/engine/players/generate";
import { Rng } from "../../src/engine/rng";
import type { MatchConditions } from "../../src/engine/types";

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
run("equal 72", 72, 72);
run("equal 84", 84, 84);
run("82 vs 74", 82, 74);
run("74 vs 82", 74, 82);
run("86 vs 66", 86, 66);
console.log("ms per match", (Date.now() - t0) / 7500);

/** Weather: the same two sides in each condition (docs/WEATHER.md). Clear weather is the baseline. */
const WH = team("WH", 76), WA = team("WA", 76);
function weather(label: string, conditions: MatchConditions | undefined, N = 1200) {
  const h = WH, a = WA;
  let goals = 0, shots = 0, inj = 0, energy = 0, fin = 0, subMin = 0, subs = 0, passes = 0, passesOk = 0, detailN = 0;
  for (let i = 0; i < N; i++) {
    // One match in six is played in detail, for passing numbers.
    const detail = i % 6 === 0;
    const eng = new MatchEngine({ home: h, away: a, importance: 1, detail, ...(conditions ? { conditions } : {}) }, Rng.fromSeed(`wx:${i}`));
    const r = eng.runToEnd();
    goals += r.homeGoals + r.awayGoals;
    shots += r.stats.shots[0] + r.stats.shots[1];
    inj += r.injuries.length;
    if (detail) {
      detailN++;
      passes += (r.stats.passes?.[0] ?? 0) + (r.stats.passes?.[1] ?? 0);
      passesOk += (r.stats.passesOk?.[0] ?? 0) + (r.stats.passesOk?.[1] ?? 0);
    }
    for (const l of r.lines) {
      if (l.started && !l.offReason) { energy += eng.energyOf(l.id) ?? 0; fin++; }
      if (!l.started) { subMin += l.minuteOn; subs++; }
    }
  }
  console.log(`${label.padEnd(22)} goals/m ${(goals / N).toFixed(2)} shots ${(shots / N).toFixed(1)} pass% ${(passes ? (passesOk / passes) * 100 : 0).toFixed(1)} (${detailN} detailed) inj ${(inj / N).toFixed(3)} end energy ${(energy / Math.max(1, fin)).toFixed(1)} sub min ${(subMin / Math.max(1, subs)).toFixed(1)}`);
}
console.log("\nWeather (76 v 76):");
weather("no conditions", undefined);
weather("clear / good", { weather: "clear", pitch: "good", tempC: 14 });
weather("rain / good", { weather: "rain", pitch: "good", tempC: 10 });
weather("heavy rain / heavy", { weather: "heavy-rain", pitch: "heavy", tempC: 9 });
weather("wind / good", { weather: "wind", pitch: "good", tempC: 8 });
weather("snow / frozen", { weather: "snow", pitch: "frozen", tempC: -3 });
weather("heat 30 / dry", { weather: "heat", pitch: "dry", tempC: 30 });
weather("heat 36 / dry", { weather: "heat", pitch: "dry", tempC: 36 });
