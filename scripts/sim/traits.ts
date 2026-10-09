/**
 * Trait sanity simulation.
 *
 *   npx tsx scripts/sim/traits.ts [--seasons 8] [--seed trait-sim]
 *
 * Runs a lite world for several seasons with the autopilot and reports how traits distribute: by position, per player,
 * by category, how many are gained and lost, and anything that looks broken (outfield traits on keepers, trait piles).
 */
import { generateAppearance } from "../../src/engine/appearance/generate";
import { autopilotStep } from "../../src/engine/career/autopilot";
import { overallFor } from "../../src/engine/players/attributes";
import { Rng } from "../../src/engine/rng";
import { advanceTurn } from "../../src/engine/season/advance";
import { STAGE_LABEL, stageOf } from "../../src/engine/traits/effects";
import { groupTraits } from "../../src/engine/traits/identity";
import { TRAIT_BY_ID, TRAITS } from "../../src/engine/traits/registry";
import type { GameState, Player, Position } from "../../src/engine/types";
import { createWorld } from "../../src/engine/world/create";

const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const SEASONS = Number(arg("seasons", "8"));
const SEED = arg("seed", "trait-sim");
const POS: Position[] = ["GK", "CB", "RB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];

const state: GameState = createWorld({
  saveName: "sim", firstName: "Sim", lastName: "Traits", nationality: "ENG", birthCountry: "ENG", position: "CM", foot: "R", height: 180,
  look: generateAppearance("sim-look"), clubId: "eng-ipswich-town", path: "late", seed: SEED, countries: ["ENG"],
});

const live = (s: GameState) => Object.values(s.players).filter((p) => !p.virtual && !p.retired && p.clubId);
const owned = (p: Player) => (p.traits ?? []).filter((t) => stageOf(t.xp));

function report(s: GameState, label: string, prev?: Map<string, Set<string>>): Map<string, Set<string>> {
  const ps = live(s);
  console.log(`\n=== ${label} · season ${s.season} · ${ps.length} players ===`);
  const per = (n: number) => ((100 * n) / ps.length).toFixed(1);
  const counts = ps.map((p) => owned(p).length);
  const avg = counts.reduce((a, b) => a + b, 0) / ps.length;
  console.log(`avg traits/player ${avg.toFixed(2)} · max ${Math.max(...counts)} · >8: ${counts.filter((c) => c > 8).length} · zero: ${per(counts.filter((c) => c === 0).length)}%`);
  const g = ps.map((p) => groupTraits(p));
  const mean = (f: (x: ReturnType<typeof groupTraits>) => number) => (g.reduce((a, x) => a + f(x), 0) / g.length).toFixed(2);
  console.log(`style ${mean((x) => x.style.length)} · mind/body ${mean((x) => x.mindBody.length)} · personality ${mean((x) => x.personality.length)} · flaws ${mean((x) => x.flaws.length)}`);
  console.log(`with a flaw ${per(g.filter((x) => x.flaws.length).length)}% · with 2 flaws ${per(g.filter((x) => x.flaws.length >= 2).length)}% · signature ${per(ps.filter((p) => owned(p).some((t) => stageOf(t.xp) === "signature")).length)}%`);
  const elite = ps.filter((p) => overallFor(p.attrs, p.position) >= 82);
  if (elite.length) console.log(`elite (${elite.length}): avg traits ${(elite.reduce((a, p) => a + owned(p).length, 0) / elite.length).toFixed(2)}`);

  // Position-inappropriate traits.
  let bad = 0;
  const badEx: string[] = [];
  for (const p of ps)
    for (const t of owned(p)) {
      const d = TRAIT_BY_ID.get(t.id);
      if (!d) continue;
      if (!d.positions.includes(p.position) && !p.secondary.some((x) => d.positions.includes(x))) {
        bad++;
        if (badEx.length < 6) badEx.push(`${d.name}/${p.position}`);
      }
    }
  console.log(`off-position traits: ${bad} ${badEx.join(", ")}`);

  // Top traits per position.
  for (const pos of POS) {
    const group = ps.filter((p) => p.position === pos);
    const tally = new Map<string, number>();
    for (const p of group) for (const t of owned(p)) tally.set(t.id, (tally.get(t.id) ?? 0) + 1);
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([id, n]) => `${TRAIT_BY_ID.get(id)?.name ?? id} ${((100 * n) / group.length).toFixed(0)}%`);
    console.log(`${pos.padEnd(2)} (${String(group.length).padStart(3)}): ${top.join(" · ")}`);
  }

  // Global frequency, to spot all-pervasive and never-appearing traits.
  const all = new Map<string, number>();
  for (const p of ps) for (const t of owned(p)) all.set(t.id, (all.get(t.id) ?? 0) + 1);
  const rows = [...all.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`most common: ${rows.slice(0, 14).map(([id, n]) => `${TRAIT_BY_ID.get(id)?.name} ${per(n)}%`).join(" · ")}`);
  const flawRows = rows.filter(([id]) => TRAIT_BY_ID.get(id)?.flaw).map(([id, n]) => `${TRAIT_BY_ID.get(id)?.name} ${per(n)}%`);
  console.log(`flaws: ${flawRows.join(" · ")}`);
  const never = TRAITS.filter((t) => !all.has(t.id)).map((t) => t.name);
  console.log(`not owned by anyone (${never.length}): ${never.join(", ")}`);
  const rare = rows.filter(([, n]) => n <= 3).map(([id, n]) => `${TRAIT_BY_ID.get(id)?.name} ${n}`);
  console.log(`very rare (≤3 holders): ${rare.join(", ")}`);

  // Turnover since the last snapshot.
  const now = new Map(ps.map((p) => [p.id, new Set(owned(p).map((t) => t.id))]));
  if (prev) {
    let gained = 0, lost = 0;
    const ages: number[] = [];
    for (const p of ps) {
      const before = prev.get(p.id);
      if (!before) continue;
      for (const id of now.get(p.id) ?? []) if (!before.has(id)) { gained++; ages.push(s.season - p.birthYear); }
      for (const id of before) if (!now.get(p.id)?.has(id)) lost++;
    }
    const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "-";
    console.log(`since last snapshot: +${gained} gained (mean age ${avgAge}) · -${lost} lost`);
  }
  const u = s.players[s.user.playerId];
  console.log(`user ${u.position} ${overallFor(u.attrs, u.position)}: ${owned(u).map((t) => `${TRAIT_BY_ID.get(t.id)?.name} (${STAGE_LABEL[stageOf(t.xp)!]})`).join(", ") || "none"}`);
  return now;
}

const rng = Rng.fromSeed(`traits-sim:${SEED}`);
let prev = report(state, "start");
const start = state.season;
let goals = 0, matches = 0;
while (state.season < start + SEASONS && !state.user.retired) {
  autopilotStep(state, rng);
  advanceTurn(state);
  if (state.turn === 1 && state.season > start && (state.season - start) % Math.max(1, Math.floor(SEASONS / 2)) === 0) prev = report(state, `after ${state.season - start} seasons`, prev);
}
for (const comp of Object.values(state.competitions)) {
  if (comp.kind !== "league") continue;
  for (const f of comp.fixtures) if (f.result) { matches++; goals += f.result.hg + f.result.ag; }
}
console.log(`\nlast season league goals/match ${(goals / Math.max(1, matches)).toFixed(2)} over ${matches} matches`);
