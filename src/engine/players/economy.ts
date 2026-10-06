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
  let v = economy.valueBase * Math.exp((ovr - 60) / economy.valueCurve) * ageValueFactor(age, gap);
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
  const w = economy.wageBase * Math.exp((ovr - 60) / economy.wageCurve) * (0.5 + clubReputation / 110) * roleMul;
  return roundMoney(clamp(w, 600, 650_000));
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
  const tierMul = tier === 1 ? 1 : tier === 2 ? 0.32 : 0.12;
  const base = economy.revenuePerPrestige * Math.pow(reputation, 1.9) * tierMul;
  const gate = capacity * 19 * 40 * (tier === 1 ? 1 : tier === 2 ? 0.55 : 0.3);
  return Math.round(base + gate);
}
