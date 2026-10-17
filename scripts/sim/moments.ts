/**
 * Key-moment balance: plays many interactive matches with the user's player in one slot and rating, answering every moment with a mix of
 * policies (first option, random, a sensible risk-aware pick), and prints how many moments he gets, of what kind and how they are paced.
 *
 *   tsx scripts/sim/moments.ts ST 62,76,91 500            -> one JSON line per rating
 *   tsx scripts/sim/moments.ts report out1.jsonl out2.jsonl ...  -> tables
 */
import { readFileSync } from "node:fs";
import { MatchEngine, MAX_DECISIONS, type MatchPlayerInput, type TeamInput } from "../../src/engine/match/engine";
import { FORMATIONS } from "../../src/engine/match/lineup";
import { ATTACK_SCENES, DEFEND_SCENES, SHOOT_SCENES, chanceTier, type Tier } from "../../src/engine/match/scenarios";
import { generatePlayer } from "../../src/engine/players/generate";
import { Rng } from "../../src/engine/rng";
import type { Position } from "../../src/engine/types";

const gen = Rng.fromSeed("moments-teams");
let n = 0;
function mk(slot: Position, ovr: number, id?: string, user = false): MatchPlayerInput {
  const p = generatePlayer(gen, { id: id ?? `x${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr, potential: ovr, clubId: null });
  return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55, isUser: user };
}
function team(name: string, ovr: number, user?: { slot: Position; ovr: number }): TeamInput {
  const shape = FORMATIONS[user?.slot === "AM" ? "4-2-3-1" : "4-3-3"];
  let placed = false;
  const starters = shape.map((slot) => {
    if (user && !placed && slot === user.slot) {
      placed = true;
      return mk(slot, user.ovr, "USER", true);
    }
    return mk(slot, ovr);
  });
  const bench = (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map((s) => mk(s, ovr));
  return { id: name, name, short: name, starters, bench, mentality: 0, color: "#000" };
}

// What each scenario is, looked up from the prompt the user sees.
const tierOf = new Map<string, Tier>();
for (const pool of [...Object.values(ATTACK_SCENES), ...Object.values(DEFEND_SCENES)]) for (const s of pool) tierOf.set(s.prompt, s.tier);
const shootType = new Map<string, string>();
for (const [type, lines] of Object.entries(SHOOT_SCENES)) for (const l of lines) shootType.set(l, type);
const statOf = new Map<string, string>();
for (const pool of [...Object.values(ATTACK_SCENES), ...Object.values(DEFEND_SCENES)]) for (const s of pool) for (const o of s.options) statOf.set(o.id, o.defending ? "defend" : o.stat);
const poolSize: Record<string, number> = {};
for (const [k, v] of Object.entries(ATTACK_SCENES)) poolSize[`atk-${k}`] = v.length;
for (const [k, v] of Object.entries(DEFEND_SCENES)) poolSize[`def-${k}`] = v.length;

const CATEGORY_OF_STAT: Record<string, string> = { dribble: "dribble", cross: "cross", pass: "pass", aerial: "aerial", run: "run", none: "other", duel: "defend", lane: "defend", defend: "defend" };

type Policy = "first" | "random" | "sensible";
function choose(policy: Policy, options: { id: string; odds: number }[], r: Rng): string {
  if (policy === "first") return options[0].id;
  if (policy === "random") return options[Math.floor(r.next() * options.length)].id;
  // Weighted towards the safer calls, but willing to gamble.
  const w = options.map((o) => o.odds * o.odds);
  let x = r.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    x -= w[i];
    if (x < 0) return options[i].id;
  }
  return options[options.length - 1].id;
}

interface Rec { minute: number; cat: string; tier: Tier; state: -1 | 0 | 1; prompt: string; offered: string[] }

function playOne(slot: Position, ovr: number, i: number): Rec[] {
  const policy = (process.env.POLICY as Policy | undefined) ?? (["first", "random", "sensible"] as const)[i % 3];
  const eng = new MatchEngine({ home: team("H", 72, { slot, ovr }), away: team("A", 72), importance: 1, detail: true, interactive: true }, Rng.fromSeed(`mom-${slot}-${ovr}-${i}`));
  const pr = Rng.fromSeed(`pol-${slot}-${ovr}-${i}`);
  const out: Rec[] = [];
  let guard = 0;
  while (!eng.finished && guard++ < 1200) {
    const d = eng.pending;
    if (!d) {
      eng.step();
      continue;
    }
    const pick = choose(policy, d.options, pr);
    const ctx = eng.userContext();
    const state = ctx ? (ctx.goalsFor > ctx.goalsAgainst ? 1 : ctx.goalsFor < ctx.goalsAgainst ? -1 : 0) : 0;
    let cat = "other";
    let tier: Tier = "routine";
    if (d.kind === "shoot") {
      const t = shootType.get(d.prompt) ?? "open";
      cat = t === "oneonone" ? "one-on-one" : "shot";
      tier = chanceTier("shoot", t);
    } else if (d.kind === "create") {
      cat = "key pass";
      tier = chanceTier("create");
    } else if (d.kind === "keep" || d.kind === "claim" || d.kind === "defend") {
      cat = d.kind === "defend" ? "defend duel" : "keeper";
      tier = chanceTier(d.kind, d.kind === "keep" ? "oneonone" : undefined);
    } else if (d.kind === "knock") {
      cat = "injury";
    } else {
      cat = CATEGORY_OF_STAT[statOf.get(pick) ?? "none"] ?? "other";
      tier = tierOf.get(d.prompt) ?? "routine";
    }
    out.push({ minute: d.minute, cat, tier, state, prompt: d.prompt, offered: d.options.map((o) => CATEGORY_OF_STAT[statOf.get(o.id) ?? "none"] ?? "other") });
    eng.resolve(pick);
  }
  return out;
}

function summarise(slot: Position, ovr: number, N: number) {
  const counts: number[] = [];
  const tiers: Record<Tier, number> = { routine: 0, threat: 0, clearcut: 0 };
  const cats: Record<string, number> = {};
  const offers: Record<string, number> = {};
  const gaps: number[] = [];
  const prompts = new Set<string>();
  let h1 = 0, late = 0, total = 0, atCap = 0, behind = 0, ahead = 0, level = 0, repeats = 0, firstGap = 0;
  const firstMinutes: number[] = [];
  const perMatchTiers: number[] = [];
  for (let i = 0; i < N; i++) {
    const rec = playOne(slot, ovr, i);
    counts.push(rec.length);
    if (rec.length >= MAX_DECISIONS) atCap++;
    const seen = new Set<string>();
    let dec = 0;
    rec.forEach((r, k) => {
      tiers[r.tier]++;
      if (r.tier !== "routine") dec++;
      cats[r.cat] = (cats[r.cat] ?? 0) + 1;
      for (const o of new Set(r.offered)) offers[o] = (offers[o] ?? 0) + 1;
      if (k > 0) gaps.push(r.minute - rec[k - 1].minute);
      if (r.minute <= 45) h1++;
      if (r.minute >= 76) late++;
      if (r.state < 0) behind++;
      else if (r.state > 0) ahead++;
      else level++;
      if (seen.has(r.prompt)) repeats++;
      seen.add(r.prompt);
      prompts.add(r.prompt);
      total++;
    });
    perMatchTiers.push(dec);
    if (rec.length) firstMinutes.push(rec[0].minute);
    firstGap += rec.length ? 0 : 1;
  }
  return { slot, ovr, N, counts, perMatchTiers, tiers, cats, offers, gaps, total, h1, late, atCap, behind, ahead, level, repeats, distinctPrompts: prompts.size, noMoment: firstGap, firstMinutes };
}

const q = (a: number[], p: number) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))] : 0);
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const f = (x: number, d = 1) => x.toFixed(d);

function report(files: string[]) {
  const rows = files.flatMap((file) => readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as ReturnType<typeof summarise>));
  const order = ["ST", "RW", "LW", "AM", "CM", "DM", "CB", "RB", "LB", "GK"];
  rows.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot) || a.ovr - b.ovr);
  console.log("slot ovr |  avg  med  p10  p90  max | routine threat clear | nonRoutine/m | capHit% none% | 1stHalf% late% | gap avg  ≤3min% | behind/level/ahead% | repeats distinct");
  for (const r of rows) {
    const m = r.N;
    const nonR = r.tiers.threat + r.tiers.clearcut;
    console.log(
      `${r.slot.padEnd(4)} ${r.ovr}  | ${f(avg(r.counts))} ${f(q(r.counts, 0.5), 0).padStart(4)} ${f(q(r.counts, 0.1), 0).padStart(4)} ${f(q(r.counts, 0.9), 0).padStart(4)} ${f(Math.max(...r.counts), 0).padStart(4)} | ` +
        `${f(r.tiers.routine / m)} ${f(r.tiers.threat / m)} ${f(r.tiers.clearcut / m)} | ${f(nonR / m)} | ${f((r.atCap / m) * 100, 1)} ${f((r.noMoment / m) * 100, 1)} | ` +
        `${f((r.h1 / Math.max(1, r.total)) * 100, 0)} ${f((r.late / Math.max(1, r.total)) * 100, 0)} | ${f(avg(r.gaps))} ${f((r.gaps.filter((g) => g <= 3).length / Math.max(1, r.gaps.length)) * 100, 0)} | ` +
        `${f((r.behind / Math.max(1, r.total)) * 100, 0)}/${f((r.level / Math.max(1, r.total)) * 100, 0)}/${f((r.ahead / Math.max(1, r.total)) * 100, 0)} | ${r.repeats} ${r.distinctPrompts}`,
    );
  }
  console.log("\nWhat the moments were (per match): " + [...new Set(rows.flatMap((r) => Object.keys(r.cats)))].sort().join(", "));
  const allCats = [...new Set(rows.flatMap((r) => Object.keys(r.cats)))].sort();
  console.log("slot ovr | " + allCats.map((c) => c.padStart(10)).join(" "));
  for (const r of rows) console.log(`${r.slot.padEnd(4)} ${r.ovr}  | ` + allCats.map((c) => f((r.cats[c] ?? 0) / r.N).padStart(10)).join(" "));
  console.log("\nChoices on offer (share of moments where at least one option of the kind was available):");
  const offerCats = ["dribble", "cross", "pass", "aerial", "run", "other", "defend"];
  console.log("slot ovr | " + offerCats.map((c) => c.padStart(8)).join(" "));
  for (const r of rows) console.log(`${r.slot.padEnd(4)} ${r.ovr}  | ` + offerCats.map((c) => `${f(((r.offers[c] ?? 0) / Math.max(1, r.total)) * 100, 0)}%`.padStart(8)).join(" "));
}

const [, , a, b, c] = process.argv;
if (a === "report") report(process.argv.slice(3));
else {
  const slot = a as Position;
  const ratings = (b ?? "62,76,91").split(",").map(Number);
  const N = Number(c ?? 500);
  for (const ovr of ratings) console.log(JSON.stringify(summarise(slot, ovr, N)));
}
void poolSize;
