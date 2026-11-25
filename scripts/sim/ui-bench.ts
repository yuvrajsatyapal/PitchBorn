/**
 * Times the derived data the dashboard and stats pages compute on every render, on a long autopilot career.
 *
 *   npx tsx scripts/sim/ui-bench.ts [seasons=15]
 *
 * Prints milliseconds per call (median of 20) for each function, early in the career and after `seasons` seasons.
 */
import { writeFileSync } from "node:fs";
import { generateAppearance } from "../../src/engine/appearance/generate";
import { autopilotStep } from "../../src/engine/career/autopilot";
import { loanAdvice } from "../../src/engine/career/loanAdvice";
import { positionGroup } from "../../src/engine/players/attributes";
import { Rng } from "../../src/engine/rng";
import { advanceTurn } from "../../src/engine/season/advance";
import * as A from "../../src/engine/stats/analytics";
import type { GameState } from "../../src/engine/types";
import { createWorld } from "../../src/engine/world/create";
import { seasonTotal, user, userFixtures, userLeague } from "../../src/game/selectors";

const seasons = Number(process.argv[2] ?? 15);
const s = createWorld({ saveName: "b", firstName: "B", lastName: "Ench", nationality: "ENG", birthCountry: "ENG", position: "ST", foot: "R", height: 181, look: generateAppearance("b"), clubId: "eng-aston-villa", path: "custom", custom: { age: 18, overall: 70, potential: 88 }, seed: "ui-bench", countries: ["ENG"] });
const rng = Rng.fromSeed("ui-bench:pilot");

const probes: [string, (g: GameState) => unknown][] = [
  ["userFixtures", userFixtures],
  ["userLeague", userLeague],
  ["seasonTotal", (g) => seasonTotal(user(g))],
  ["loanAdvice", loanAdvice],
  ["ratedMatches", A.ratedMatches],
  ["reserveForm", (g) => A.reserveForm(g, 30)],
  ["logForSeason(all)", (g) => A.logForSeason(g, "all")],
  ["leagueRankings", A.leagueRankings],
  ["comparables", A.comparables],
  ["per90Rows", (g) => A.per90Rows(user(g).career, positionGroup(user(g).position))],
  ["personalBests", A.personalBests],
  ["milestones", A.milestones],
  ["seasonLines", A.seasonLines],
];

function bench(label: string): void {
  console.log(`\n${label}: season ${s.season}, ${s.user.matchLog?.length ?? 0} logged matches, ${s.news.length} news, ${Object.keys(s.players).length} players`);
  for (const [name, fn] of probes) {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      fn(s);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    console.log(`  ${name.padEnd(20)} ${times[10].toFixed(2)} ms`);
  }
}

for (let t = 0; t < 50; t++) { autopilotStep(s, rng); advanceTurn(s); }
bench("After 1 season");
for (let t = 0; t < 50 * (seasons - 1) && !s.user.retired; t++) { autopilotStep(s, rng); advanceTurn(s); }
bench(`After ${seasons} seasons`);
if (process.env.BENCH_OUT) writeFileSync(process.env.BENCH_OUT, JSON.stringify(s));
