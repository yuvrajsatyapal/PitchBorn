/**
 * Multi-season economy simulation for the club ownership system.
 *
 *   npx tsx scripts/sim/ownership-economy.ts [--seasons 15] [--seeds 2] [--off]
 *
 * Runs full-world careers (autopilot user) and reports, per ownership type: balances, transfer spend, wages, owner
 * injections, elite-player concentration and chronically indebted clubs. `--off` treats every club as standard (baseline).
 */
import ownershipJson from "../../src/data/ownership.json";
import { generateAppearance } from "../../src/engine/appearance/generate";
import { autopilotStep } from "../../src/engine/career/autopilot";
import { annualRevenue, OWNERSHIP_TYPES, setOwnershipEnabled, type OwnershipType } from "../../src/engine/club/ownership";
import { WORLD } from "../../src/engine/data/world";
import { overallFor } from "../../src/engine/players/attributes";
import { Rng } from "../../src/engine/rng";
import { advanceTurn } from "../../src/engine/season/advance";
import type { GameState } from "../../src/engine/types";
import { createWorld } from "../../src/engine/world/create";

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const SEASONS = Number(arg("seasons", "15"));
const SEEDS = Number(arg("seeds", "2"));
const OFF = process.argv.includes("--off");
if (OFF) setOwnershipEnabled(false);

const M = 1e6;
/** Real classification, independent of the --off switch, so baseline and ownership runs bucket the same clubs. */
const ownershipOf = (id: string): OwnershipType => ((ownershipJson.clubs as Record<string, string>)[id] as OwnershipType | undefined) ?? "standard";
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

interface Row { balance: number; negPct: number; spend: number; wages: number; injected: number; elite: number; clubs: number; deepDebt: number }
type Season = Record<string, Row> & { all: Row; fees: number; deals: number; avgFee: number; avgWage: number; top1Elite: number };

function run(seed: string): { seasons: Season[]; chronic: string[]; maxInjection: { club: string; perRev: number } } {
  const rng = Rng.fromSeed(`own:${seed}`);
  const club = WORLD.clubs.find((c) => c.id === "eng-brighton")!;
  const state: GameState = createWorld({
    saveName: "sim", firstName: "Sim", lastName: seed, nationality: "ENG", birthCountry: "ENG", position: "ST", foot: "R", height: 180,
    look: generateAppearance("sim-look"), clubId: club.id, path: "academy", seed,
  });
  const seen = new Set<string>();
  const out: Season[] = [];
  const negStreak: Record<string, number> = {};
  const chronic = new Set<string>();
  let spendBy: Record<string, number> = {};
  let fees = 0;
  let deals = 0;
  const prevFunding: Record<string, number> = {};
  let maxInj = { club: "", perRev: 0 };
  const start = state.season;
  let lastSeason = start;
  while (state.season < start + SEASONS && !state.user.retired) {
    autopilotStep(state, rng);
    for (const t of state.transferLog) {
      const key = `${t.playerId}|${t.season}|${t.turn}|${t.fee}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (t.fee > 0) {
        fees += t.fee;
        deals++;
        spendBy[t.to] = (spendBy[t.to] ?? 0) + t.fee;
      }
    }
    advanceTurn(state);
    if (state.season !== lastSeason) {
      lastSeason = state.season;
      const rows = {} as Season;
      const buckets: Record<string, string[]> = { all: Object.keys(state.clubs) };
      for (const t of OWNERSHIP_TYPES) buckets[t] = Object.keys(state.clubs).filter((id) => ownershipOf(id) === t);
      const eliteHolders: Record<string, number> = {};
      for (const p of Object.values(state.players)) {
        if (p.virtual || p.retired || !p.clubId || overallFor(p.attrs, p.position) < 82) continue;
        eliteHolders[p.clubId] = (eliteHolders[p.clubId] ?? 0) + 1;
      }
      for (const [name, ids] of Object.entries(buckets)) {
        const cs = ids.map((id) => state.clubs[id]).filter(Boolean);
        const wages = cs.map((c) => c.squad.reduce((s, id) => s + (state.players[id]?.contract?.wage ?? 0), 0) * 50);
        rows[name] = {
          balance: mean(cs.map((c) => c.balance)) / M,
          negPct: (cs.filter((c) => c.balance < 0).length / Math.max(1, cs.length)) * 100,
          spend: mean(ids.map((id) => spendBy[id] ?? 0)) / M,
          wages: mean(wages) / M,
          injected: mean(cs.map((c) => (c.ownerFunding ?? 0) - (prevFunding[c.id] ?? 0))) / M,
          elite: ids.reduce((s, id) => s + (eliteHolders[id] ?? 0), 0),
          clubs: cs.length,
          deepDebt: cs.filter((c) => c.balance < -annualRevenue(c) * 0.5).length,
        };
      }
      for (const c of Object.values(state.clubs)) {
        negStreak[c.id] = c.balance < 0 ? (negStreak[c.id] ?? 0) + 1 : 0;
        if (negStreak[c.id] >= 4) chronic.add(`${c.id} (${ownershipOf(c.id)})`);
        const inj = (c.ownerFunding ?? 0) - (prevFunding[c.id] ?? 0);
        const per = inj / annualRevenue(c);
        if (per > maxInj.perRev) maxInj = { club: c.id, perRev: per };
        prevFunding[c.id] = c.ownerFunding ?? 0;
      }
      const sortedElite = Object.values(eliteHolders).sort((a, b) => b - a);
      const totalElite = sortedElite.reduce((a, b) => a + b, 0);
      rows.fees = fees as never;
      rows.deals = deals as never;
      rows.avgFee = (deals ? fees / deals / M : 0) as never;
      const allWages = Object.values(state.players).filter((p) => p.contract && !p.virtual).map((p) => p.contract!.wage);
      rows.avgWage = mean(allWages) as never;
      rows.top1Elite = (totalElite ? (sortedElite.slice(0, 5).reduce((a, b) => a + b, 0) / totalElite) * 100 : 0) as never;
      out.push(rows);
      spendBy = {};
      fees = 0;
      deals = 0;
    }
  }
  return { seasons: out, chronic: [...chronic], maxInjection: maxInj };
}

const results = Array.from({ length: SEEDS }, (_, i) => run(`s${i}`));
const f = (n: number, d = 1) => n.toFixed(d);
console.log(`\n=== ${OFF ? "BASELINE (ownership off)" : "OWNERSHIP ON"}  seasons=${SEASONS} seeds=${SEEDS} ===`);
const types: (OwnershipType | "all")[] = ["all", ...OWNERSHIP_TYPES];
for (const sIdx of [0, Math.floor(SEASONS / 2) - 1, SEASONS - 1]) {
  const rs = results.map((r) => r.seasons[sIdx]).filter(Boolean);
  if (!rs.length) continue;
  console.log(`\n-- season ${sIdx + 1} (avg of ${rs.length} seeds)`);
  console.log("type            clubs  balance€M  neg%  deepDebt  spend€M/club  wages€M/club  owner€M/club  elite(82+)");
  for (const t of types) {
    const g = (k: keyof Row) => mean(rs.map((r) => (r[t] as Row)[k]));
    console.log(`${t.padEnd(15)} ${String(rs[0][t].clubs).padStart(5)} ${f(g("balance")).padStart(10)} ${f(g("negPct"), 0).padStart(5)} ${f(g("deepDebt"), 1).padStart(9)} ${f(g("spend")).padStart(13)} ${f(g("wages")).padStart(13)} ${f(g("injected")).padStart(13)} ${f(g("elite"), 1).padStart(10)}`);
  }
  const pick = (k: "fees" | "deals" | "avgFee" | "avgWage" | "top1Elite") => mean(rs.map((r) => r[k] as unknown as number));
  console.log(`world: transfer fees €${f(pick("fees") / M, 0)}M over ${f(pick("deals"), 0)} deals (avg €${f(pick("avgFee"))}M) · avg weekly wage €${f(pick("avgWage"), 0)} · top-5 clubs hold ${f(pick("top1Elite"), 0)}% of 82+ players`);
}
console.log("\nwage growth (avg weekly wage by season):", results[0].seasons.map((s) => Math.round(s.avgWage)).join(" "));
console.log("transfer spend per season €M:", results[0].seasons.map((s) => Math.round((s.fees as unknown as number) / M)).join(" "));
console.log("all-clubs mean balance €M:", results[0].seasons.map((s) => f(s.all.balance, 0)).join(" "));
console.log("state-backed owner €M/club/season:", results[0].seasons.map((s) => f(s["state-backed"].injected, 1)).join(" "));
console.log("billionaire owner €M/club/season:", results[0].seasons.map((s) => f(s.billionaire.injected, 1)).join(" "));
console.log("chronic debt (4+ negative seasons):", results.flatMap((r) => r.chronic).join(", ") || "none");
console.log("largest single-season injection / revenue:", results.map((r) => `${r.maxInjection.club} ${f(r.maxInjection.perRev * 100, 0)}%`).join(", "));
