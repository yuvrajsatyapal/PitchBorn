import { generateAppearance } from "../../src/engine/appearance/generate";
/**
 * Small probe: how much do training intensity and playing time each move the
 * user's development, and what does intensity do to injuries?
 * Usage: npx tsx scripts/sim/training-probe.ts [seeds=6] [seasons=2]
 */
import { BALANCE } from "../../src/engine/balance";
import { autopilotStep } from "../../src/engine/career/autopilot";
import { overallFor } from "../../src/engine/players/attributes";
import { Rng } from "../../src/engine/rng";
import { advanceTurn } from "../../src/engine/season/advance";
import type { GameState, TrainingPlan } from "../../src/engine/types";
import { createWorld } from "../../src/engine/world/create";

const SEEDS = Number(process.argv[2] ?? 6);
const SEASONS = Number(process.argv[3] ?? 2);

function probe(intensity: TrainingPlan["intensity"], clubId: string, seed: string) {
  const state: GameState = createWorld({
    saveName: "probe", firstName: "P", lastName: seed, nationality: "ENG", birthCountry: "ENG", position: "ST", foot: "R", height: 180,
    look: generateAppearance("sim-look"), clubId, path: "academy", seed, countries: ["ENG"],
  });
  const rng = Rng.fromSeed(`probe:${seed}`);
  const p = state.players[state.user.playerId];
  const start = overallFor(p.attrs, p.position);
  let fitSum = 0;
  let weeks = 0;
  let lowFit = 0;
  const trainingInj = () => state.user.injuryHistory.length;
  let tInj = 0;
  while (state.season < state.user.startSeason + SEASONS) {
    autopilotStep(state, rng);
    state.user.training = { focus: "finishing", intensity };
    const injBefore = trainingInj();
    const hadInjury = !!p.injury;
    advanceTurn(state);
    if (!hadInjury && trainingInj() > injBefore && state.user.lastTraining?.injured) tInj++;
    fitSum += p.fitness;
    weeks++;
    if (p.fitness < BALANCE.fitness.riskMild) lowFit++;
  }
  const end = overallFor(p.attrs, p.position);
  const hist = p.history.slice(-SEASONS);
  const apps = hist.reduce((s, h) => s + h.stats.apps, 0);
  const mins = hist.reduce((s, h) => s + h.stats.minutes, 0);
  const rating = hist.reduce((s, h) => s + h.stats.ratingSum, 0) / Math.max(1, apps) || 0;
  return { gain: end - start, apps, mins, rating, injuries: state.user.injuryHistory.length, tInj, fit: fitSum / weeks, lowFit: lowFit / weeks };
}

const clubs = process.argv[4] ? [process.argv[4]] : ["eng-ipswich-town", "eng-cambridge-united"];
for (const clubId of clubs) {
  console.log(`\n${clubId} · academy ST · ${SEEDS} seeds × ${SEASONS} seasons`);
  console.log("intensity | ovr gain/season | apps/season | mins/season | avg rating | injuries/season (training) | avg fitness | weeks <70");
  for (const intensity of ["light", "normal", "intense"] as const) {
    const rows = Array.from({ length: SEEDS }, (_, i) => probe(intensity, clubId, `tp-${i}`));
    const avg = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
    console.log(
      [
        intensity.padEnd(9),
        (avg((r) => r.gain) / SEASONS).toFixed(2),
        (avg((r) => r.apps) / SEASONS).toFixed(1),
        (avg((r) => r.mins) / SEASONS).toFixed(0),
        avg((r) => r.rating).toFixed(2),
        `${(avg((r) => r.injuries) / SEASONS).toFixed(2)} (${(avg((r) => r.tInj) / SEASONS).toFixed(2)})`,
        avg((r) => r.fit).toFixed(1),
        `${(avg((r) => r.lowFit) * 100).toFixed(0)}%`,
      ].join(" | "),
    );
  }
}
