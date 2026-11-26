/**
 * Full-world sanity check: builds a career in every league country, plays a season with the autopilot and reports
 * the time per simulated week, the continental competitions and any invariant issues.
 *
 *   npx tsx scripts/sim/world-check.ts [--weeks 50] [--club bra-flamengo]
 */
import { generateAppearance } from "../../src/engine/appearance/generate";
import { WORLD } from "../../src/engine/data/world";
import { advanceTurn, simUserMatch } from "../../src/engine/season/advance";
import { createWorld } from "../../src/engine/world/create";
import { checkInvariants } from "../../src/engine/validate";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const weeks = Number(arg("weeks", "50"));
const clubId = arg("club", WORLD.clubs.find((c) => c.leagueId === "bra-1")?.id ?? WORLD.clubs[0].id);
const t0 = Date.now();
const only = arg("countries", "");
const s = createWorld({ countries: only ? only.split(",") : undefined, saveName: "check", firstName: "Ana", lastName: "Check", nationality: "BRA", birthCountry: "BRA", position: "ST", foot: "R", height: 180, look: generateAppearance("x"), clubId, path: "late", seed: "world-check" });
console.log(`world: ${Object.keys(s.clubs).length} clubs, ${Object.keys(s.players).length} players, created in ${Date.now() - t0} ms`);
const t1 = Date.now();
for (let w = 0; w < weeks; w++) {
  for (const p of [...s.pending]) simUserMatch(s, p.fixtureId);
  s.user.decisions = [];
  advanceTurn(s);
}
const per = (Date.now() - t1) / weeks;
console.log(`${weeks} weeks: ${per.toFixed(0)} ms/week`);
const comps = Object.values(s.competitions).filter((c) => c.kind === "continental");
for (const c of comps) console.log(`${c.name} ${c.season}: ${c.teams.length} teams, winner ${c.winner ?? "—"}`);
const inv = checkInvariants(s);
console.log(`invariant issues: ${inv.issues.length}`, inv.issues.slice(0, 5));
for (const l of WORLD.leagues) {
  const c = s.competitions[`${l.id}-${s.season}`];
  if (!c) console.log(`  ${l.id}: no competition this season`);
}
