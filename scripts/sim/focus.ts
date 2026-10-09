/**
 * Development focus sanity simulation.
 *
 *   npx tsx scripts/sim/focus.ts [--seasons 10] [--seed focus-sim] [--users 6]
 *
 * A. Starting attributes: for each position and focus, the mean overall and the attributes it leans on, over many created players.
 * B. A lite world over several seasons: how NPC aspirations are spread, how often their careers produce the traits their focus
 *    favours (against players with no preference), and how often careers end up somewhere else entirely.
 * C. (--users N) the user's own career with each striker focus, driven by the autopilot: the traits that actually emerge.
 */
import { generateAppearance } from "../../src/engine/appearance/generate";
import { autopilotStep } from "../../src/engine/career/autopilot";
import { generateAttributes, overallFor } from "../../src/engine/players/attributes";
import { NO_FOCUS, focusFor, focusOptions, leanAttributes } from "../../src/engine/players/focus";
import { Rng } from "../../src/engine/rng";
import { advanceTurn } from "../../src/engine/season/advance";
import { stageOf } from "../../src/engine/traits/effects";
import { focusReading } from "../../src/engine/traits/identity";
import { TRAIT_BY_ID } from "../../src/engine/traits/registry";
import { ALL_ATTRS, POSITIONS, type AttrKey, type GameState, type Player, type Position } from "../../src/engine/types";
import { createWorld } from "../../src/engine/world/create";

const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const SEASONS = Number(arg("seasons", "10"));
const SEED = arg("seed", "focus-sim");
const USERS = Number(arg("users", "0"));
const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) : "-") + "%";
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ── A ──────────────────────────────────────────────────────────────────────
console.log("A. STARTING ATTRIBUTES (500 created players per position and focus, overall 65)");
for (const pos of POSITIONS) {
  const rows: string[] = [];
  const baseline = new Map<AttrKey, number>();
  for (const o of focusOptions(pos)) {
    const overalls: number[] = [];
    const sums: number[] = [];
    const lean: Record<string, number[]> = {};
    for (let i = 0; i < 500; i++) {
      const attrs = generateAttributes(Rng.fromSeed(`A:${pos}:${i}`), pos, 65, 180);
      leanAttributes(attrs, pos, o.id);
      overalls.push(overallFor(attrs, pos));
      sums.push(Object.values(attrs).reduce((s, v) => s + v, 0));
      for (const k of Object.keys(o.attrs)) (lean[k] ??= []).push(attrs[k as AttrKey]);
    }
    if (o.id === NO_FOCUS) {
      for (const k of ALL_ATTRS) {
        baseline.set(k, mean(Array.from({ length: 500 }, (_, i) => generateAttributes(Rng.fromSeed(`A:${pos}:${i}`), pos, 65, 180)[k])));
      }
    }
    const shifts = Object.entries(lean).map(([k, v]) => `${k} ${(mean(v) - (baseline.get(k as AttrKey) ?? mean(v))).toFixed(1)}`).join(", ");
    rows.push(`  ${o.name.padEnd(24)} overall ${mean(overalls).toFixed(2)} · Σattrs ${mean(sums).toFixed(0)} · ${shifts || "—"}`);
  }
  console.log(`${pos}\n${rows.join("\n")}`);
}

// ── B ──────────────────────────────────────────────────────────────────────
const world = (position: Position, focus: string | undefined, seed: string): GameState =>
  createWorld({ saveName: "sim", firstName: "Sim", lastName: "Focus", nationality: "ENG", birthCountry: "ENG", position, foot: "R", height: 180, look: generateAppearance("sim-look"), clubId: "eng-ipswich-town", path: "academy", seed, countries: ["ENG"], focus });

const state = world("CM", undefined, SEED);
const start = state.season;
const youngAtStart = new Set(Object.values(state.players).filter((p) => !p.virtual && !p.isUser && start - p.birthYear <= 21).map((p) => p.id));
const focusAtStart = new Map(Object.values(state.players).map((p) => [p.id, p.focus ?? NO_FOCUS]));
const rng = Rng.fromSeed(`focus-sim:${SEED}`);
const t0 = Date.now();
while (state.season < start + SEASONS && !state.user.retired) {
  autopilotStep(state, rng);
  advanceTurn(state);
}
console.log(`\nB. NPC WORLD · ${SEASONS} seasons (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
const cohort = Object.values(state.players).filter((p) => youngAtStart.has(p.id) && !p.retired && p.clubId);
console.log(`cohort: ${cohort.length} players aged ≤21 at the start, still playing`);
const ownedStyle = (p: Player) => (p.traits ?? []).filter((t) => stageOf(t.xp) && TRAIT_BY_ID.get(t.id) && !TRAIT_BY_ID.get(t.id)!.flaw && !TRAIT_BY_ID.get(t.id)!.derive && TRAIT_BY_ID.get(t.id)!.category !== "personality").map((t) => t.id);
const stat = (label: string, group: Player[]) => {
  const fav = (p: Player) => new Set(focusFor(p.position, focusAtStart.get(p.id))?.traits);
  const withStyle = group.filter((p) => ownedStyle(p).length);
  const hit = withStyle.filter((p) => ownedStyle(p).some((id) => fav(p).has(id)));
  const share = group.length ? mean(group.map((p) => { const o = ownedStyle(p); return o.length ? o.filter((id) => fav(p).has(id)).length / o.length : 0; })) : 0;
  console.log(`${label.padEnd(26)} n=${String(group.length).padStart(4)} · with a style trait ${pct(withStyle.length, group.length)} · hold ≥1 trait their focus favours ${pct(hit.length, withStyle.length)} · mean share of their traits that fit ${(100 * share).toFixed(1)}%`);
};
stat("No preference", cohort.filter((p) => focusAtStart.get(p.id) === NO_FOCUS));
stat("Has a focus", cohort.filter((p) => focusAtStart.get(p.id) !== NO_FOCUS));
// The control for the above: how much of that is just "players' attributes already pointed there"? Compare each focused player with
// the traits of a stranger with the same position and a different focus.
for (const pos of POSITIONS) {
  const group = cohort.filter((p) => p.position === pos);
  const byFocus = new Map<string, Player[]>();
  for (const p of group) (byFocus.get(focusAtStart.get(p.id) as string) ?? byFocus.set(focusAtStart.get(p.id) as string, []).get(focusAtStart.get(p.id) as string)!).push(p);
  const rows = [...byFocus.entries()].filter(([, v]) => v.length >= 8).map(([id, v]) => {
    const fav = new Set(focusFor(pos, id)?.traits);
    const holders = v.filter((p) => ownedStyle(p).length);
    const fit = holders.filter((p) => ownedStyle(p).some((t) => fav.has(t)));
    const other = group.filter((p) => focusAtStart.get(p.id) !== id && ownedStyle(p).length);
    const otherFit = other.filter((p) => ownedStyle(p).some((t) => fav.has(t)));
    return `${(focusFor(pos, id)?.name ?? id).slice(0, 14)} ${pct(fit.length, holders.length)} vs others ${pct(otherFit.length, other.length)}`;
  });
  console.log(`  ${pos}: ${rows.join(" · ")}`);
}
const readings = cohort.map((p) => focusReading(p, state.season).verdict);
const count = (v: string) => readings.filter((x) => x === v).length;
console.log(`verdicts over the cohort: open ${pct(count("open"), readings.length)} · aligned ${pct(count("aligned"), readings.length)} · mixed ${pct(count("mixed"), readings.length)} · diverged ${pct(count("diverged"), readings.length)} · early ${pct(count("early"), readings.length)}`);

// ── C ──────────────────────────────────────────────────────────────────────
if (USERS > 0) {
  console.log(`\nC. USER CAREERS · ST · ${USERS} seed(s) per focus · ${SEASONS} seasons`);
  for (const o of focusOptions("ST")) {
    const lines: string[] = [];
    let aligned = 0, mixed = 0, diverged = 0, early = 0, open = 0;
    for (let i = 0; i < USERS; i++) {
      const s = world("ST", o.id, `focus-user:${o.id}:${i}`);
      const r = Rng.fromSeed(`focus-user-rng:${o.id}:${i}`);
      const begin = s.season;
      while (s.season < begin + SEASONS && !s.user.retired) {
        autopilotStep(s, r);
        advanceTurn(s);
      }
      const u = s.players[s.user.playerId];
      const rd = focusReading(u, s.season);
      ({ aligned, mixed, diverged, early, open } = { aligned: aligned + +(rd.verdict === "aligned"), mixed: mixed + +(rd.verdict === "mixed"), diverged: diverged + +(rd.verdict === "diverged"), early: early + +(rd.verdict === "early"), open: open + +(rd.verdict === "open") });
      lines.push(`    ovr ${overallFor(u.attrs, u.position)} · ${rd.current.slice(0, 4).map((t) => t.def.name).join(", ") || "no style yet"}`);
    }
    console.log(`  ${o.name}: aligned ${aligned} · mixed ${mixed} · diverged ${diverged} · early ${early} · open ${open}\n${lines.join("\n")}`);
  }
}
