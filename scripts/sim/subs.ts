/**
 * Substitution behaviour: plays many interactive matches with the user's player at one slot and rating and reports when (and why)
 * the manager takes him off, split by fatigue, performance, scoreline and starting role.
 *
 *   tsx scripts/sim/subs.ts ST 62,76,91 500 [stamina=-20|0|20] [role=start|bench]   -> one JSON line per rating
 *   tsx scripts/sim/subs.ts report out1.jsonl out2.jsonl ...                          -> tables
 */
import { readFileSync } from "node:fs";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../../src/engine/match/engine";
import { FORMATIONS } from "../../src/engine/match/lineup";
import { ATTACK_SCENES, DEFEND_SCENES, type Tier } from "../../src/engine/match/scenarios";
import { generatePlayer } from "../../src/engine/players/generate";
import { Rng } from "../../src/engine/rng";
import type { Position } from "../../src/engine/types";

const gen = Rng.fromSeed("subs-teams");
let n = 0;
function mk(slot: Position, ovr: number, id?: string, user = false, stamina = 0): MatchPlayerInput {
  const p = generatePlayer(gen, { id: id ?? `x${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr, potential: ovr, clubId: null });
  const attrs = stamina ? { ...p.attrs, stamina: Math.max(1, Math.min(99, p.attrs.stamina + stamina)) } : p.attrs;
  return { id: user ? "USER" : p.id, name: p.lastName, slot, attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55, isUser: user };
}
function team(name: string, ovr: number, user?: { slot: Position; ovr: number; stamina: number; bench: boolean }): TeamInput {
  const shape = FORMATIONS[user?.slot === "AM" ? "4-2-3-1" : "4-3-3"];
  let placed = false;
  const starters = shape.map((slot) => {
    if (user && !user.bench && !placed && slot === user.slot) {
      placed = true;
      return mk(slot, user.ovr, "USER", true, user.stamina);
    }
    return mk(slot, ovr);
  });
  const bench = (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map((s) => mk(s, ovr));
  if (user?.bench) {
    // He is the substitute for his own slot; the starter he would replace is an ordinary player.
    const at = bench.findIndex((b) => b.slot === user.slot);
    const u = mk(user.slot, user.ovr, "USER", true, user.stamina);
    if (at >= 0) bench[at] = u;
    else bench.push(u);
  }
  return { id: name, name, short: name, starters, bench, mentality: 0, color: "#000" };
}

const tierOf = new Map<string, Tier>();
for (const pool of [...Object.values(ATTACK_SCENES), ...Object.values(DEFEND_SCENES)]) for (const s of pool) tierOf.set(s.prompt, s.tier);

interface Rec {
  off: number | null;
  reason: string | null;
  on: number;
  mins: number;
  r60: number | null;
  e60: number | null;
  rOff: number | null;
  eOff: number | null;
  diffOff: number | null;
  started: boolean;
  played: boolean;
  decisions: number;
  decisive: number;
  late: number;
  lateDecisive: number;
  teamSubs: number;
}

function playOne(slot: Position, ovr: number, i: number, stamina: number, bench: boolean, teamOvr: number): Rec {
  const eng = new MatchEngine({ home: team("H", teamOvr, { slot, ovr, stamina, bench }), away: team("A", teamOvr), importance: 1, detail: true, interactive: true }, Rng.fromSeed(`sub-${slot}-${ovr}-${stamina}-${bench}-${i}`));
  const pol = Rng.fromSeed(`pol-${slot}-${ovr}-${i}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teams = (eng as any).teams as Record<"home" | "away", { players: any[]; bench: any[]; goals: number; subsUsed: number }>;
  const find = () => [...teams.home.players, ...teams.home.bench].find((p) => p.input.id === "USER");
  let guard = 0;
  let decisions = 0, decisive = 0, late = 0, lateDecisive = 0;
  let r60: number | null = null, e60: number | null = null, rOff: number | null = null, eOff: number | null = null, diffOff: number | null = null;
  let seenOff = false;
  while (!eng.finished && guard++ < 1500) {
    const d = eng.pending;
    if (d) {
      const w = d.options.map((o) => o.odds * o.odds);
      let x = pol.next() * w.reduce((a, b) => a + b, 0), pick = d.options[d.options.length - 1].id;
      for (let k = 0; k < d.options.length; k++) { x -= w[k]; if (x < 0) { pick = d.options[k].id; break; } }
      decisions++;
      const tier: Tier = d.kind === "shoot" ? "clearcut" : d.kind === "create" || d.kind === "keep" || d.kind === "claim" || d.kind === "defend" ? "threat" : tierOf.get(d.prompt) ?? "routine";
      const dec = tier !== "routine";
      if (dec) decisive++;
      if (d.minute >= 75) { late++; if (dec) lateDecisive++; }
      eng.resolve(pick);
      continue;
    }
    // the player's energy/rating are read just before the step that may take him off
    const u = find();
    if (u && u.onPitch && eng.minute === 59) { r60 = u.line.rating; e60 = u.energy; }
    if (u && u.onPitch) { rOff = u.line.rating; eOff = u.energy; diffOff = teams.home.goals - teams.away.goals; }
    eng.step();
    const u2 = find();
    if (!seenOff && u2 && u2.line.minuteOn >= 0 && !u2.onPitch) { seenOff = true; }
  }
  const res = eng.result();
  const l = res.lines.find((x) => x.id === "USER");
  const played = !!l && l.minuteOn >= 0;
  const off = l && l.offReason ? l.minuteOff : null;
  return {
    off, reason: l?.offReason ?? null, on: l?.minuteOn ?? -1, mins: l && played ? (l.minuteOff ?? 90) - l.minuteOn : 0,
    r60, e60, rOff, eOff, diffOff, started: !!l?.started, played, decisions, decisive, late, lateDecisive, teamSubs: teams.home.subsUsed,
  };
}

function summarise(slot: Position, ovr: number, N: number, stamina: number, bench: boolean, teamOvr: number) {
  const recs: Rec[] = [];
  for (let i = 0; i < N; i++) recs.push(playOne(slot, ovr, i, stamina, bench, teamOvr));
  return { slot, ovr, N, stamina, bench, teamOvr, recs };
}

const q = (a: number[], p: number) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))] : NaN);
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const f = (x: number, d = 1) => (Number.isNaN(x) ? "  - " : x.toFixed(d));
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "-");

type Row = ReturnType<typeof summarise>;
function line(label: string, recs: Rec[]) {
  const sub = recs.filter((r) => r.reason === "sub");
  const inj = recs.filter((r) => r.reason === "injury");
  const red = recs.filter((r) => r.reason === "red");
  const mins = sub.map((r) => r.off as number);
  const full = recs.filter((r) => r.played && r.reason === null);
  const played = recs.filter((r) => r.played);
  return (
    `${label.padEnd(26)} n=${String(played.length).padStart(4)} | sub ${pct(sub.length, played.length).padStart(4)} inj ${pct(inj.length, played.length).padStart(3)} red ${pct(red.length, played.length).padStart(3)} full90 ${pct(full.length, played.length).padStart(4)} | ` +
    `min avg ${f(avg(mins))} med ${f(q(mins, 0.5), 0)} p10 ${f(q(mins, 0.1), 0)} p90 ${f(q(mins, 0.9), 0)} | played ${f(avg(played.map((r) => r.mins)))}m | dec ${f(avg(played.map((r) => r.decisions)))} decisive ${f(avg(played.map((r) => r.decisive)))} late(75+) ${f(avg(played.map((r) => r.late)), 2)}`
  );
}

function report(files: string[]) {
  const rows = files.flatMap((file) => readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));
  const order = ["ST", "RW", "LW", "AM", "CM", "DM", "CB", "RB", "LB", "GK"];
  rows.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot) || a.ovr - b.ovr || a.stamina - b.stamina);
  for (const r of rows) console.log(line(`${r.slot} ${r.ovr} sta${r.stamina >= 0 ? "+" : ""}${r.stamina} ${r.bench ? "bench" : "start"}`, r.recs));
  // Cuts across everything, starters only
  const starters = rows.filter((r) => !r.bench);
  const all = starters.flatMap((r) => r.recs.filter((x) => x.played));
  if (all.length) {
    console.log("\n-- by performance (rating at 60') --");
    const rs = all.filter((r) => r.r60 !== null).map((r) => r.r60 as number);
    const lo = q(rs, 1 / 3), hi = q(rs, 2 / 3);
    for (const [name, pick] of [["poor", (x: number) => x <= lo], ["average", (x: number) => x > lo && x < hi], ["strong", (x: number) => x >= hi]] as const) {
      const g = all.filter((r) => r.r60 !== null && pick(r.r60 as number));
      console.log(line(`${name} (r60 ${f(avg(g.map((r) => r.r60 as number)), 2)})`, g));
    }
    console.log("\n-- by fatigue (energy at 60') --");
    const es = all.filter((r) => r.e60 !== null).map((r) => r.e60 as number);
    const elo = q(es, 1 / 3), ehi = q(es, 2 / 3);
    for (const [name, pick] of [["tired", (x: number) => x <= elo], ["mid", (x: number) => x > elo && x < ehi], ["fresh", (x: number) => x >= ehi]] as const) {
      const g = all.filter((r) => r.e60 !== null && pick(r.e60 as number));
      console.log(line(`${name} (e60 ${f(avg(g.map((r) => r.e60 as number)), 1)})`, g));
    }
    console.log("\n-- by scoreline when the manager acted (or at 60') --");
    for (const [name, pick] of [["trailing", (d: number) => d < 0], ["level", (d: number) => d === 0], ["leading", (d: number) => d > 0]] as const) {
      const g = all.filter((r) => r.diffOff !== null && pick(r.diffOff as number));
      console.log(line(name, g));
    }
  }
}

const [, , a, b, c, d, e] = process.argv;
if (a === "report") report(process.argv.slice(3));
else {
  const slot = a as Position;
  const ratings = (b ?? "62,76,91").split(",").map(Number);
  const N = Number(c ?? 500);
  const opt = (k: string, dflt: string) => [d, e].find((x) => x?.startsWith(`${k}=`))?.slice(k.length + 1) ?? dflt;
  const stamina = Number(opt("stamina", "0"));
  const bench = opt("role", "start") === "bench";
  const teamOvr = Number(opt("team", "72"));
  for (const ovr of ratings) console.log(JSON.stringify(summarise(slot, ovr, N, stamina, bench, teamOvr)));
}
