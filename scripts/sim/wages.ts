/**
 * Contract-renewal wage sanity simulation.
 *
 *   npx tsx scripts/sim/wages.ts [--seasons 12] [--seed wages-sim]
 *
 * Runs a lite world with the autopilot and watches every renewal (NPC and user): the wage change against the old contract,
 * the renewal wage against the market wage, acceptance versus departure, and whether wages or club wage bills drift upward
 * over the years. Offers come from the shared retention model; importance is computed there.
 */
import { generateAppearance } from "../../src/engine/appearance/generate";
import { autopilotStep } from "../../src/engine/career/autopilot";
import { LOYALTY_DISCOUNT_MAX, loyaltyPull, reservationWage, wageBillRatio } from "../../src/engine/career/wages";
import { marketWage } from "../../src/engine/players/economy";
import { ageOf } from "../../src/engine/players/generate";
import { overallFor } from "../../src/engine/players/attributes";
import { Rng } from "../../src/engine/rng";
import { advanceTurn } from "../../src/engine/season/advance";
import { hasTrait } from "../../src/engine/traits/effects";
import type { GameState, Player } from "../../src/engine/types";
import { createWorld } from "../../src/engine/world/create";

const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const SEASONS = Number(arg("seasons", "12"));
const SEED = arg("seed", "wages-sim");

const state: GameState = createWorld({
  saveName: "sim", firstName: "Sim", lastName: "Wage", nationality: "ENG", birthCountry: "ENG", position: "CM", foot: "R", height: 180,
  look: generateAppearance("sim-look"), clubId: "eng-ipswich-town", path: "late", seed: SEED, countries: ["ENG"],
});

interface Seen { clubId: string; signed: number; wage: number; expires: number; ovr: number }
interface Renewal { wage: number; prev: number; market: number; ovrDelta: number; age: number; role: string; loyal: boolean; oneClub: boolean; tenure: number; pull: number; user: boolean; reservation: number }

const live = (s: GameState) => Object.values(s.players).filter((p) => !p.virtual && !p.retired);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : "-");
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "-");
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN);

const seen = new Map<string, Seen>();
const renewals: Renewal[] = [];
let expiredRenewed = 0, expiredLeft = 0;
const yearly: { season: number; avgWage: Record<string, number>; ratioTop: number; ratioLow: number; billTotal: number; overBudget: number; eliteN: number; eliteOvr: number }[] = [];

function record(p: Player) {
  if (p.contract && p.clubId) {
    const prev = seen.get(p.id);
    // The overall is kept from the day the current contract was signed, so a renewal can be compared with the player's growth since.
    const ovr = prev && prev.signed === p.contract.signed && prev.clubId === p.contract.clubId ? prev.ovr : overallFor(p.attrs, p.position);
    seen.set(p.id, { clubId: p.contract.clubId, signed: p.contract.signed, wage: p.contract.wage, expires: p.contract.expires, ovr });
  }
  else seen.delete(p.id);
}
for (const p of live(state)) record(p);

const rng = Rng.fromSeed(`wages-sim:${SEED}`);
const start = state.season;
while (state.season < start + SEASONS && !state.user.retired) {
  const season = state.season;
  // Reservation and pull must be read before the renewal rewrites the contract.
  const pre = new Map<string, { reservation: number; pull: number; market: number }>();
  for (const [id, s] of seen) {
    if (s.expires <= state.season) {
      const p = state.players[id];
      if (p && p.clubId) pre.set(id, { reservation: reservationWage(state, p), pull: loyaltyPull(state, p), market: marketWage(p, state.season) });
    }
  }
  const up = Object.values(state.players).find((x) => x.isUser);
  if (up && up.clubId) pre.set(up.id, { reservation: reservationWage(state, up), pull: loyaltyPull(state, up), market: marketWage(up, state.season) });
  autopilotStep(state, rng);
  advanceTurn(state);
  for (const p of live(state)) {
    const was = seen.get(p.id);
    // The user's renewal arrives a season before expiry; NPC renewals happen when the contract runs out.
    if (was && (was.expires <= season || (p.isUser && p.contract && p.contract.signed !== was.signed))) {
      if (p.contract && p.contract.clubId === was.clubId && p.contract.signed !== was.signed) {
        expiredRenewed++;
        const info = pre.get(p.id);
        renewals.push({
          wage: p.contract.wage, prev: was.wage, market: info?.market ?? marketWage(p, season), ovrDelta: overallFor(p.attrs, p.position) - was.ovr, age: ageOf(p, season),
          role: p.contract.role, loyal: (info?.pull ?? 0) >= 0.6, oneClub: hasTrait(p, "club_oriented"), tenure: p.stay?.seasons ?? 0, pull: info?.pull ?? 0, user: !!p.isUser,
          reservation: info?.reservation ?? 0,
        });
      } else if (!p.contract || p.contract.clubId !== was.clubId) expiredLeft++;
    }
    record(p);
  }
  if (state.season > season) {
    const ps = live(state).filter((p) => p.contract && p.clubId);
    const avgWage: Record<string, number> = {};
    for (const [lo, hi] of [[55, 62], [63, 70], [71, 76], [77, 82], [83, 99]]) {
      avgWage[`${lo}-${hi}`] = mean(ps.filter((p) => { const o = overallFor(p.attrs, p.position); return o >= lo && o <= hi && ageOf(p, state.season) <= 31; }).map((p) => p.contract!.wage));
    }
    const ratios = Object.values(state.clubs).map((c) => ({ rep: c.reputation, r: wageBillRatio(state, c) }));
    yearly.push({
      season: state.season, avgWage,
      ratioTop: mean(ratios.filter((x) => x.rep >= 70).map((x) => x.r)), ratioLow: mean(ratios.filter((x) => x.rep < 45).map((x) => x.r)),
      billTotal: ps.reduce((a, p) => a + p.contract!.wage, 0), overBudget: ratios.filter((x) => x.r > 0.75).length,
      eliteN: ps.filter((p) => overallFor(p.attrs, p.position) >= 83).length, eliteOvr: mean(ps.filter((p) => overallFor(p.attrs, p.position) >= 83).map((p) => overallFor(p.attrs, p.position))),
    });
  }
}

console.log(`\nWage sim · seed ${SEED} · ${SEASONS} seasons · ${renewals.length} renewals (${renewals.filter((r) => r.user).length} user)`);
console.log(`expiring contracts: renewed ${expiredRenewed}, left ${expiredLeft} → renewal rate ${pct(expiredRenewed / Math.max(1, expiredRenewed + expiredLeft))}`);

function row(label: string, rs: Renewal[]) {
  if (!rs.length) return console.log(`${label.padEnd(28)} n=0`);
  const ch = rs.map((r) => r.wage / r.prev);
  console.log(
    `${label.padEnd(28)} n=${String(rs.length).padStart(4)} · wage/prev median ${f1(median(ch))} mean ${f1(mean(ch))} · raises ${pct(ch.filter((x) => x > 1.02).length / rs.length)} cuts ${pct(ch.filter((x) => x < 0.98).length / rs.length)}`
      + ` · wage/market ${f1(mean(rs.map((r) => r.wage / r.market)))} · reservation/market ${f1(mean(rs.map((r) => r.reservation / r.market)))}`,
  );
}
console.log("\n-- by overall movement since last contract");
row("improved (≥ +2)", renewals.filter((r) => r.ovrDelta >= 2));
row("stagnant (−1…+1)", renewals.filter((r) => r.ovrDelta > -2 && r.ovrDelta < 2));
row("declined (≤ −2)", renewals.filter((r) => r.ovrDelta <= -2));
console.log("\n-- by role");
for (const role of ["star", "first", "rotation", "backup", "prospect"]) row(role, renewals.filter((r) => r.role === role));
console.log("\n-- by age");
row("≤ 21 (young potential)", renewals.filter((r) => r.age <= 21));
row("22–28", renewals.filter((r) => r.age >= 22 && r.age <= 28));
row("29–32", renewals.filter((r) => r.age >= 29 && r.age <= 32));
row("33+ (aging)", renewals.filter((r) => r.age >= 33));
console.log("\n-- loyalty");
row("loyal (pull ≥ 0.6)", renewals.filter((r) => r.loyal));
row("not loyal", renewals.filter((r) => !r.loyal));
row("One-Club Minded", renewals.filter((r) => r.oneClub));
row("user", renewals.filter((r) => r.user));
console.log(`max loyalty discount (loyalty only): ${pct(Math.max(0, ...renewals.map((r) => LOYALTY_DISCOUNT_MAX * r.pull)))}; reservation below market by up to ${pct(Math.max(0, ...renewals.map((r) => (r.market - r.reservation) / r.market)))} incl. no-suitor slack`);

console.log("\n-- wage inflation (mean wage, age ≤ 31, by overall band) and club wage bills");
for (const y of yearly) {
  console.log(`${y.season}  elite n=${y.eliteN} ovr ${y.eliteOvr.toFixed(1)} · ${Object.entries(y.avgWage).map(([k, v]) => `${k}:${Number.isFinite(v) ? Math.round(v / 100) / 10 + "k" : "-"}`).join("  ")}  | wage/revenue top ${pct(y.ratioTop)} low ${pct(y.ratioLow)} · clubs>75% ${y.overBudget} · total ${(y.billTotal / 1e6).toFixed(1)}M/wk`);
}
