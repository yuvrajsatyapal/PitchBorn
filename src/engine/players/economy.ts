import { BALANCE } from "../balance";
import { clamp } from "../rng";
import type { Player, SquadRole } from "../types";
import { ageOf, overall } from "./generate";

const { economy } = BALANCE;

function ageValueFactor(age: number, potentialGap: number): number {
  if (age <= 21) return 1.25 + clamp(potentialGap, 0, 30) / 22;
  if (age <= 24) return 1.2 + clamp(potentialGap, 0, 20) / 40;
  if (age <= 27) return 1.1;
  if (age <= 29) return 0.92;
  if (age === 30) return 0.72;
  if (age === 31) return 0.56;
  if (age === 32) return 0.42;
  if (age === 33) return 0.3;
  return 0.18;
}

/** Pitchborn market value in euros (own model). */
export function marketValue(p: Player, season: number): number {
  const ovr = overall(p);
  const age = ageOf(p, season);
  const gap = p.hidden.potential - ovr;
  let v = economy.valueBase * Math.exp((ovr - economy.valueRef) / economy.valueCurve) * ageValueFactor(age, gap);
  v *= 0.85 + p.reputation / 330;
  if (p.contract) {
    const yearsLeft = p.contract.expires - season;
    if (yearsLeft <= 0) v *= 0.45;
    else if (yearsLeft === 1) v *= 0.75;
  } else v *= 0.35;
  if (p.position === "GK") v *= 0.72;
  if (p.injury && p.injury.weeksLeft > 8) v *= 0.8;
  return roundMoney(clamp(v, 25_000, 250_000_000));
}

/** Weekly wage the player commands at a club of the given reputation. */
export function wageFor(ovr: number, clubReputation: number, role: SquadRole = "first"): number {
  const roleMul = { star: 1.35, first: 1, rotation: 0.78, backup: 0.6, prospect: 0.4 }[role];
  const w = economy.wageBase * Math.exp((ovr - economy.wageRef) / economy.wageCurve) * (0.3 + clubReputation / 95) * roleMul;
  return roundMoney(clamp(w, 600, 650_000));
}

/** Club level ↔ reputation: the overall a club's first team plays at (elite ≈85, bottom of a top flight ≈75). */
export function clubLevel(prestige: number): number {
  return 54.6 + prestige * 0.316;
}

/** The reputation of a club whose first team plays at the given overall. */
export function repForLevel(level: number): number {
  return clamp((level - 54.6) / 0.316, 15, 100);
}

/**
 * The overall a wage is priced on. Young players with room to grow are paid partly for what they will become;
 * a few points at most, so a prospect never out-earns a proven player of the same standing.
 */
export function pricedOvr(p: Player, season: number): number {
  const o = overall(p);
  const age = ageOf(p, season);
  const k = age <= 20 ? 0.12 : age <= 23 ? 0.08 : age <= 25 ? 0.04 : 0;
  return o + Math.min(3, k * clamp(p.hidden.potential - o, 0, 25));
}

/** Clubs pay less for players on the way down. */
function ageWageFactor(age: number): number {
  return age > 31 ? Math.max(0.8, 1 - 0.04 * (age - 31)) : 1;
}

/**
 * What a club of the given reputation pays this player for the given role. The one wage model: transfer offers, free-agent
 * deals, NPC renewals and the market benchmark below all come from here.
 */
export function playerWage(p: Player, season: number, clubReputation: number, role: SquadRole = "first"): number {
  return roundMoney(clamp(wageFor(pricedOvr(p, season), clubReputation, role) * ageWageFactor(ageOf(p, season)), 600, 650_000));
}

/** What the open market pays him: a first-team wage at the club whose level matches his. Club-independent. */
export function marketWage(p: Player, season: number): number {
  return playerWage(p, season, repForLevel(pricedOvr(p, season)), "first");
}

export function roundMoney(v: number): number {
  if (v >= 10_000_000) return Math.round(v / 500_000) * 500_000;
  if (v >= 1_000_000) return Math.round(v / 100_000) * 100_000;
  if (v >= 100_000) return Math.round(v / 10_000) * 10_000;
  if (v >= 10_000) return Math.round(v / 1000) * 1000;
  return Math.round(v / 100) * 100;
}

export function formatMoney(v: number): string {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${sign}€${(a / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `${sign}€${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}€${Math.round(a / 1000)}K`;
  return `${sign}€${Math.round(a)}`;
}

/** Club annual revenue estimate (euros) used for budgets. */
export function clubRevenue(reputation: number, tier: number, capacity: number): number {
  const tierMul = tier === 1 ? 1 : tier === 2 ? 0.45 : 0.25;
  const base = economy.revenuePerPrestige * Math.pow(reputation, 1.9) * tierMul;
  const gate = capacity * 19 * 40 * (tier === 1 ? 1 : tier === 2 ? 0.55 : 0.3);
  return Math.round(base + gate);
}
