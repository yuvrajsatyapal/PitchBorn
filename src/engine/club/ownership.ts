/**
 * Club ownership: the one place that turns "who owns this club" into financial behaviour.
 *
 * Ownership MODIFIES the existing money model (reputation, balance, revenue, wages), it never replaces it. Everything the
 * rest of the engine needs comes from the functions below; no other file should branch on an ownership type. Classifications
 * live in data/ownership.json (anything unlisted is `standard`, which reproduces the pre-ownership behaviour exactly), so they
 * can be corrected without touching simulation code.
 *
 * Every effect is bounded: backed clubs get a bigger, steadier budget and owner top-ups that stop once the books are
 * healthy, scaled by the club's own revenue, so reputation and real finances still decide how far any club can go.
 */
import ownershipJson from "../../data/ownership.json";
import { stadium, staticClub, staticLeague } from "../data/world";
import { clubRevenue } from "../players/economy";
import { clamp } from "../rng";
import type { ClubState } from "../types";

export const OWNERSHIP_TYPES = ["fan-owned", "billionaire", "state-backed", "corporate", "private-equity", "standard"] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export interface OwnershipProfile {
  label: string;
  /** One line shown on the club page. */
  blurb: string;
  /** Share of annual revenue the owner stands behind as extra spending power (counts even when the bank is empty). */
  creditShare: number;
  /** Weight on the club's actual cash when sizing its transfer budget (standard: 0.6). */
  cashWeight: number;
  /** Multiplier on the reputation-driven part of the budget (standard: 1). */
  baseMul: number;
  /** Hard cap on the budget, in multiples of the reputation-driven base (standard: 2.2). */
  ceiling: number;
  /** Multiplier on how readily the club chases a target it can afford (standard: 1). */
  willingness: number;
  /** Multiplier on the wages the club will stretch to for stars (standard: 1). */
  wageMul: number;
  /** Balance the owner tops the club up towards at season end, as a share of revenue. 0 means no owner funding. */
  topUpFloor: number;
  /** Most the owner puts in per season, as a share of revenue. */
  topUpCap: number;
  /** Debt, as a share of revenue, the club can carry before a forced restructuring (standard: 0.6). */
  debtTolerance: number;
  /** How hard poor finances push the club into selling (standard: 1). */
  sellPressure: number;
  /** Chance a healthy club turns down a rival's bid for a key player. */
  retention: number;
}

const PROFILES: Record<OwnershipType, OwnershipProfile> = {
  standard: {
    label: "Independent", blurb: "Runs on its own revenue.",
    creditShare: 0, cashWeight: 0.6, baseMul: 1, ceiling: 2.2, willingness: 1, wageMul: 1, topUpFloor: 0, topUpCap: 0, debtTolerance: 0.6, sellPressure: 1, retention: 0,
  },
  "fan-owned": {
    label: "Fan owned", blurb: "Spending is closely tied to the club's own finances.",
    creditShare: 0, cashWeight: 0.75, baseMul: 1, ceiling: 2.3, willingness: 0.95, wageMul: 1, topUpFloor: 0, topUpCap: 0, debtTolerance: 0.55, sellPressure: 1.3, retention: 0.2,
  },
  billionaire: {
    label: "Billionaire backed", blurb: "A wealthy owner covers losses and funds big signings.",
    creditShare: 0.3, cashWeight: 0.6, baseMul: 1.1, ceiling: 2.7, willingness: 1.35, wageMul: 1.12, topUpFloor: 0.05, topUpCap: 0.18, debtTolerance: 0.9, sellPressure: 0.45, retention: 0.35,
  },
  "state-backed": {
    label: "State backed", blurb: "Strong external financial backing.",
    creditShare: 0.55, cashWeight: 0.6, baseMul: 1.2, ceiling: 3, willingness: 1.2, wageMul: 1.2, topUpFloor: 0.1, topUpCap: 0.3, debtTolerance: 1.3, sellPressure: 0.25, retention: 0.5,
  },
  corporate: {
    label: "Corporate owned", blurb: "Backed by a parent company, with steady, disciplined budgets.",
    creditShare: 0.12, cashWeight: 0.55, baseMul: 1, ceiling: 2.3, willingness: 0.9, wageMul: 1, topUpFloor: 0, topUpCap: 0.1, debtTolerance: 0.8, sellPressure: 0.8, retention: 0.15,
  },
  "private-equity": {
    label: "Investment owned", blurb: "Run for returns: careful spending and quick to sell when it pays.",
    creditShare: 0.05, cashWeight: 0.45, baseMul: 0.9, ceiling: 1.9, willingness: 0.8, wageMul: 0.92, topUpFloor: 0, topUpCap: 0, debtTolerance: 0.7, sellPressure: 1.4, retention: 0,
  },
};

const OWNERS = (ownershipJson as { clubs: Record<string, string> }).clubs;

let enabled = true;
/** Simulation A/B switch: when off every club behaves as `standard`. Not used by the game itself. */
export function setOwnershipEnabled(on: boolean): void {
  enabled = on;
}

export function ownershipOf(clubId: string): OwnershipType {
  const t = enabled ? OWNERS[clubId] : undefined;
  return t !== undefined && (OWNERSHIP_TYPES as readonly string[]).includes(t) ? (t as OwnershipType) : "standard";
}

export function ownershipProfile(clubId: string): OwnershipProfile {
  return PROFILES[ownershipOf(clubId)];
}

export function profileFor(type: OwnershipType): OwnershipProfile {
  return PROFILES[type];
}

/** Annual revenue estimate for a club (the same model the weekly books use). */
export function annualRevenue(club: Pick<ClubState, "id" | "leagueId" | "reputation">): number {
  const st = staticClub(club.id);
  const tier = staticLeague(club.leagueId)?.tier ?? 3;
  const cap = stadium(st?.stadiumId ?? "")?.capacity ?? 10000;
  return clubRevenue(club.reputation, tier, cap);
}

/** True when an owner stands behind the club's spending. */
export function isBacked(clubId: string): boolean {
  return ownershipProfile(clubId).creditShare > 0;
}

/**
 * The most a club will spend on transfer fees. `base` is the reputation-driven figure the market already computes.
 * A standard club in the red spends nothing; a backed one still has its owner's credit, but never beyond `ceiling` x base,
 * so a low-reputation club cannot out-spend a bigger one just because of who owns it.
 */
export function transferBudget(club: ClubState, base: number, revenue: number): number {
  const p = ownershipProfile(club.id);
  const credit = revenue * p.creditShare;
  if (club.balance < 0) {
    // Backed clubs keep a reduced line of credit while in debt, shrinking as the debt approaches what the owner tolerates.
    if (credit <= 0) return 0;
    const room = clamp(1 + club.balance / (revenue * p.debtTolerance), 0, 1);
    return Math.min(credit * room + base * 0.1 * room, base * p.ceiling);
  }
  return Math.max(0, Math.min(club.balance * p.cashWeight + credit + base * 0.4 * p.baseMul, base * p.ceiling));
}

/** Probability multiplier for chasing an affordable target. */
export function spendWillingness(clubId: string): number {
  return ownershipProfile(clubId).willingness;
}

/** What the club will stretch to on a star's wages, relative to the standard rate. Debt trims it unless an owner is covering. */
export function wageTolerance(club: ClubState, revenue: number): number {
  const p = ownershipProfile(club.id);
  if (club.balance >= 0) return p.wageMul;
  const stress = clamp(-club.balance / (revenue * p.debtTolerance), 0, 1);
  return Math.min(p.wageMul, 1) * (1 - 0.1 * stress);
}

/** Cash a club can commit up front (signing bonuses): its bank plus a slice of what its owner stands behind. */
export function spendableCash(club: ClubState, revenue: number): number {
  const p = ownershipProfile(club.id);
  const owner = revenue * p.creditShare * 0.1;
  return Math.max(0, club.balance) + (club.balance < 0 ? owner * clamp(1 + club.balance / (revenue * p.debtTolerance), 0, 1) : owner);
}

/** 0-1 financial distress, scaled by how readily this ownership sells under pressure. */
export function distress(club: ClubState, revenue: number): number {
  const p = ownershipProfile(club.id);
  const raw = clamp((revenue * 0.05 - club.balance) / (revenue * p.debtTolerance), 0, 1);
  return clamp(raw * p.sellPressure, 0, 1);
}

/** Share knocked off a listed player's fee when his club is under financial pressure. */
export function distressDiscount(club: ClubState, revenue: number): number {
  return 0.18 * distress(club, revenue);
}

/** Chance the seller refuses a rival's bid for a key player. A bigger club can always overcome it; distress removes it. */
export function refusalChance(seller: ClubState, buyer: ClubState, revenue: number): number {
  const p = ownershipProfile(seller.id);
  if (p.retention <= 0 || buyer.reputation > seller.reputation + 12) return 0;
  return p.retention * (1 - distress(seller, revenue));
}

/** How many of a club's best-paid, least essential players it puts up for sale. */
export function forcedSales(club: ClubState, revenue: number): number {
  const d = distress(club, revenue);
  return d < 0.25 ? 0 : Math.ceil(d * 3);
}

export interface OwnerSupport {
  /** Euros the owner injects at season end. */
  amount: number;
}

/**
 * Season-end owner funding: tops the books up towards `topUpFloor` x revenue, no further, and never more than `topUpCap`
 * x revenue in a year. Once the club is healthy the owner stops paying, so injections cannot accumulate into a hoard.
 */
export function ownerTopUp(club: ClubState, revenue: number): number {
  const p = ownershipProfile(club.id);
  if (p.topUpCap <= 0) return 0;
  const target = revenue * p.topUpFloor;
  if (club.balance >= target) return 0;
  return Math.round(Math.min(target - club.balance, revenue * p.topUpCap));
}

/** Balance a club is reset to after a forced restructuring. */
export function restructuredBalance(club: ClubState, revenue: number): number {
  const backed = ownershipProfile(club.id).creditShare > 0;
  return Math.round(-revenue * (backed ? 0.1 : 0.25));
}

/** Reputation lost in a restructuring: an owner's bail-out is less of a disgrace. */
export function restructurePenalty(club: ClubState): number {
  return isBacked(club.id) ? 1 : 2;
}
