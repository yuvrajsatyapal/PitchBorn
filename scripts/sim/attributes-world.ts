/**
 * What the attribute model does over time in a living world.
 *
 *   npx tsx scripts/sim/attributes-world.ts [--seasons 10] [--seed attrs-world]
 *
 *  1. Ageing: mean of selected attributes by age (physical should fall earlier than technical and mental).
 *  2. Overall by age, and how specialised the squad players are (spread of their role attributes).
 *  3. Tactical fit: spread among players, and whether managers' starters fit better than bench players at the same position.
 *  4. Recruitment: the fit of signings with the buying club's style against comparable players elsewhere.
 *  5. Trait counts.
 */
import { generateAppearance } from "../../src/engine/appearance/generate";
import { autopilotStep } from "../../src/engine/career/autopilot";
import { selectTeam, tacticalFit } from "../../src/engine/match/lineup";
import { overallFor, POSITION_WEIGHTS } from "../../src/engine/players/attributes";
import { ATTR } from "../../src/engine/players/model";
import { Rng } from "../../src/engine/rng";
import { advanceTurn } from "../../src/engine/season/advance";
import { stageOf } from "../../src/engine/traits/effects";
import { squadOf } from "../../src/engine/world/helpers";
import { createWorld } from "../../src/engine/world/create";
import type { AttrKey, Player, Position } from "../../src/engine/types";

const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const SEASONS = Number(arg("seasons", "10"));
const SEED = arg("seed", "attrs-world");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

const state = createWorld({ saveName: "sim", firstName: "Sim", lastName: "Attrs", nationality: "ENG", birthCountry: "ENG", position: "CM", foot: "R", height: 180, look: generateAppearance("sim-look"), clubId: "eng-ipswich-town", path: "academy", seed: SEED, countries: ["ENG"] });
const rng = Rng.fromSeed(`attrs-world:${SEED}`);
const start = state.season;
const snapshot = new Map(Object.values(state.players).filter((p) => !p.virtual && !p.isUser).map((p) => [p.id, { age: start - p.birthYear, attrs: { ...p.attrs }, position: p.position }]));
const t0 = Date.now();
const signings: { playerId: string; to: string }[] = [];
let seen = state.transferLog.length;
while (state.season < start + SEASONS && !state.user.retired) {
  autopilotStep(state, rng);
  advanceTurn(state);
  while (seen < state.transferLog.length) { const t = state.transferLog[seen++]; if (t.to) signings.push({ playerId: t.playerId, to: t.to }); }
}
console.log(`World: ${SEASONS} seasons in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${Object.keys(state.players).length} players, ${signings.length} signings tracked`);

const real = Object.values(state.players).filter((p) => !p.virtual && !p.retired && p.clubId && !p.isUser);

// 1. Ageing — the same players, SEASONS later: mean change by age at the start, outfield players who are still playing.
const bands: [number, number][] = [[17, 19], [20, 22], [23, 25], [26, 28], [29, 31], [32, 34]];
const watch: AttrKey[] = ["pace", "acceleration", "agility", "stamina", "strength", "jumping", "passing", "technique", "finishing", "decisions", "anticipation", "positioning", "composure", "workRate", "aggression"];
console.log(`\n1. AGEING: mean change over ${SEASONS} seasons by age at the start (outfield, still playing)`);
console.log("              " + bands.map(([a, b]) => `${a}-${b}`.padStart(7)).join(""));
const survivors = real.filter((p) => snapshot.has(p.id) && p.position !== "GK");
const change = (k: AttrKey, a: number, b: number) => {
  const xs = survivors.filter((p) => { const s0 = snapshot.get(p.id)!; return s0.age >= a && s0.age <= b; }).map((p) => p.attrs[k] - snapshot.get(p.id)!.attrs[k]);
  return xs.length >= 8 ? mean(xs).toFixed(1).padStart(7) : "      -";
};
for (const k of watch) console.log(`${ATTR[k].label.slice(0, 12).padEnd(14)}${bands.map(([a, b]) => change(k, a, b)).join("")}`);
const ovrChange = (a: number, b: number) => {
  const xs = survivors.filter((p) => { const s0 = snapshot.get(p.id)!; return s0.age >= a && s0.age <= b; }).map((p) => overallFor(p.attrs, p.position) - overallFor(snapshot.get(p.id)!.attrs, p.position));
  return xs.length >= 8 ? mean(xs).toFixed(1).padStart(7) : "      -";
};
console.log("overall       " + bands.map(([a, b]) => ovrChange(a, b)).join(""));

// 2. Specialisation
const range = real.filter((p) => p.position !== "GK").map((p) => { const ks = Object.keys(POSITION_WEIGHTS[p.position]) as AttrKey[]; const vs = ks.map((k) => p.attrs[k]); return Math.max(...vs) - Math.min(...vs); });
console.log(`\n2. SPECIALISATION: mean spread between a player's best and worst role attribute ${mean(range).toFixed(1)} (sd ${sd(range).toFixed(1)}); share of players with a ≥25 spread ${(100 * range.filter((r) => r >= 25).length / range.length).toFixed(0)}%`);

// 3. Tactical fit: the selected XI against its own squad, with and without the manager's style.
const fits: number[] = [];
const xiFit: number[] = [];
const xiFitNoStyle: number[] = [];
const xiQuality: number[] = [];
for (const club of Object.values(state.clubs)) {
  const squad = squadOf(state, club.id).filter((p) => !p.virtual);
  if (squad.length < 16) continue;
  for (const p of squad) fits.push(tacticalFit(p, club.style));
  const rel = (p: Player, slot: Position) => tacticalFit(p, club.style, slot) - mean(squad.filter((q) => q.position === p.position).map((q) => tacticalFit(q, club.style, slot)));
  const withStyle = selectTeam(squad, club.formation, null, { style: club.style });
  const without = selectTeam(squad, club.formation, null, {});
  for (const x of withStyle.starters) xiFit.push(rel(x.player, x.slot));
  for (const x of without.starters) xiFitNoStyle.push(rel(x.player, x.slot));
  const q = (sel: ReturnType<typeof selectTeam>) => mean(sel.starters.map((x) => overallFor(x.player.attrs, x.slot)));
  xiQuality.push(q(withStyle) - q(without));
}
console.log(`\n3. TACTICAL FIT at own club: mean ${mean(fits).toFixed(1)}, sd ${sd(fits).toFixed(1)}, range ${Math.min(...fits).toFixed(0)}–${Math.max(...fits).toFixed(0)}`);
console.log(`   XI starters' fit relative to same-position squad mates: with the manager's style ${mean(xiFit).toFixed(2)}, ignoring it ${mean(xiFitNoStyle).toFixed(2)}`);
console.log(`   XI average ability cost of using the style: ${mean(xiQuality).toFixed(3)} overall points (per player, mean over ${xiQuality.length} clubs)`);

// 4. Recruitment
const signed = signings.map((s) => ({ p: state.players[s.playerId], club: state.clubs[s.to] })).filter((x) => x.p && x.club && !x.p.virtual);
const lift = signed.map(({ p, club }) => {
  const peers = real.filter((q) => q.position === p.position && Math.abs(overallFor(q.attrs, q.position) - overallFor(p.attrs, p.position)) <= 3 && q.id !== p.id);
  return tacticalFit(p, club.style) - mean(peers.map((q) => tacticalFit(q, club.style)));
});
console.log(`\n4. RECRUITMENT: ${signed.length} signings; fit with the buying club's style vs same-position, similar-ability players: ${mean(lift).toFixed(2)} points (0 = style ignored)`);

// 5. Traits
const traitCounts = real.map((p) => (p.traits ?? []).filter((t) => stageOf(t.xp)).length);
console.log(`\n5. TRAITS: mean owned per player ${mean(traitCounts).toFixed(2)}; share with none ${(100 * traitCounts.filter((c) => c === 0).length / traitCounts.length).toFixed(0)}%`);
