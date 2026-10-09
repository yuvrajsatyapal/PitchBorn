/**
 * One-Club Minded sanity simulation.
 *
 *   npx tsx scripts/sim/loyalty.ts [--seasons 15] [--seed loyalty-sim]
 *
 * Runs a lite world with the autopilot and, at every season boundary, reports how many players hold One-Club Minded, what
 * their careers look like (years, minutes, extensions, approaches refused, loyalty), how often they leave compared with
 * other long-serving players, and how the trait ends once a holder does leave.
 */
import { generateAppearance } from "../../src/engine/appearance/generate";
import { autopilotStep } from "../../src/engine/career/autopilot";
import { Rng } from "../../src/engine/rng";
import { advanceTurn } from "../../src/engine/season/advance";
import { stageOf } from "../../src/engine/traits/effects";
import { clubTenure } from "../../src/engine/traits/tenure";
import type { GameState, Player } from "../../src/engine/types";
import { createWorld } from "../../src/engine/world/create";

const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const SEASONS = Number(arg("seasons", "15"));
const SEED = arg("seed", "loyalty-sim");
const ID = "club_oriented";

const state: GameState = createWorld({
  saveName: "sim", firstName: "Sim", lastName: "Loyal", nationality: "ENG", birthCountry: "ENG", position: "CM", foot: "R", height: 180,
  look: generateAppearance("sim-look"), clubId: "eng-ipswich-town", path: "late", seed: SEED, countries: ["ENG"],
});

const live = (s: GameState) => Object.values(s.players).filter((p) => !p.virtual && !p.retired && p.clubId);
const holds = (p: Player) => stageOf(p.traits?.find((t) => t.id === ID)?.xp ?? 0);
const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "-");

const everHeld = new Set<string>();
let prevHolders = new Map<string, string>(); // player → club when the season began
let prevLong = new Map<string, string>(); // long-serving players who do NOT hold the trait, for comparison
let leftWhileHolding = 0, stayedWhileHolding = 0, leftLong = 0, stayedLong = 0;
const stageCounts: Record<string, number> = {};
const acquired: { tenure: number; seasons: number; avgMin: number; renewals: number; freeStays: number; declined: number; loyalty: number; age: number; user: boolean }[] = [];

function snapshot(label: string) {
  const ps = live(state);
  const holders = ps.filter(holds);
  const long = ps.filter((p) => clubTenure(p, state.season) >= 6);
  console.log(`\n=== ${label} · season ${state.season} · ${ps.length} players ===`);
  console.log(`holders ${holders.length} (${((100 * holders.length) / ps.length).toFixed(2)}%) · with tenure ≥6: ${long.length} · of them holders ${long.length ? ((100 * long.filter(holds).length) / long.length).toFixed(1) : 0}%`);
  const byStage: Record<string, number> = {};
  for (const p of holders) byStage[holds(p) as string] = (byStage[holds(p) as string] ?? 0) + 1;
  console.log(`stages ${JSON.stringify(byStage)} · tenure mean ${mean(holders.map((p) => clubTenure(p, state.season)))} · age mean ${mean(holders.map((p) => state.season - p.birthYear))}`);
  console.log(`holders' stays: renewals ${mean(holders.map((p) => p.stay?.renewals ?? 0))} · free stays ${mean(holders.map((p) => p.stay?.freeStays ?? 0))} · approaches refused ${mean(holders.map((p) => p.stay?.declined ?? 0))} · loyalty ${mean(holders.map((p) => p.hidden.loyalty))}`);
}

const rng = Rng.fromSeed(`loyalty-sim:${SEED}`);
const start = state.season;
const checkpoints = new Set([5, 10, 15, 20, 25].filter((n) => n <= SEASONS));
while (state.season < start + SEASONS && !state.user.retired) {
  const season = state.season;
  autopilotStep(state, rng);
  advanceTurn(state);
  if (state.season > season) {
    // Season boundary: compare holders at the start of the season with where they are now.
    for (const p of live(state)) {
      const was = prevHolders.get(p.id);
      if (was !== undefined) {
        if (was === p.clubId) stayedWhileHolding++;
        else leftWhileHolding++;
      }
      const wasLong = prevLong.get(p.id);
      if (wasLong !== undefined) {
        if (wasLong === p.clubId) stayedLong++;
        else leftLong++;
      }
      if (holds(p) && !everHeld.has(p.id) && p.stay) {
        everHeld.add(p.id);
        acquired.push({ tenure: clubTenure(p, state.season), seasons: p.stay.seasons, avgMin: Math.round(p.stay.minutes / Math.max(1, p.stay.seasons)), renewals: p.stay.renewals, freeStays: p.stay.freeStays, declined: p.stay.declined, loyalty: p.hidden.loyalty, age: state.season - p.birthYear, user: !!p.isUser });
      }
    }
    prevHolders = new Map(live(state).filter(holds).map((p) => [p.id, p.clubId as string]));
    prevLong = new Map(live(state).filter((p) => !holds(p) && clubTenure(p, state.season) >= 8 && p.hidden.loyalty >= 60).map((p) => [p.id, p.clubId as string]));
    for (const p of live(state)) { const s = holds(p); if (s) stageCounts[s] = (stageCounts[s] ?? 0) + 1; }
    if (checkpoints.has(state.season - start)) snapshot(`after ${state.season - start} seasons`);
  }
}
console.log(`Comparison — long-serving (8+ yrs) loyal-minded players without the trait: ${leftLong} left vs ${stayedLong} stayed (${((100 * leftLong) / Math.max(1, leftLong + stayedLong)).toFixed(1)}% leave per year)`);
console.log(`\nEver held: ${everHeld.size} players. At acquisition: tenure ${mean(acquired.map((a) => a.tenure))} · recorded seasons ${mean(acquired.map((a) => a.seasons))} · avg minutes ${mean(acquired.map((a) => a.avgMin))} · renewals ${mean(acquired.map((a) => a.renewals))} · free stays ${mean(acquired.map((a) => a.freeStays))} · refused ${mean(acquired.map((a) => a.declined))} · loyalty ${mean(acquired.map((a) => a.loyalty))} · age ${mean(acquired.map((a) => a.age))}`);
console.log(`Holders who left their club in a season: ${leftWhileHolding} vs stayed ${stayedWhileHolding} (${((100 * leftWhileHolding) / Math.max(1, leftWhileHolding + stayedWhileHolding)).toFixed(1)}% leave per year)`);
const u = state.players[state.user.playerId];
console.log(`user: ${holds(u) ?? "no"} One-Club Minded, tenure ${clubTenure(u, state.season)}, stay ${JSON.stringify(u.stay)}`);
