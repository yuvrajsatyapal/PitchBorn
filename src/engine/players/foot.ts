/**
 * Footedness. Every player has a dominant foot (left or right) and, separately, a weak-foot rating (0–100) that grows
 * slowly with age, minutes and the right kind of training. A near-perfect weak foot is the rare AMBIDEXTROUS trait:
 * it removes the weak-foot penalty, it never removes the dominant foot and it adds no attribute of its own.
 *
 * The match engine reads this through `footMultiplier`: how often a role has to use its weaker foot, and how much that
 * costs, relative to a typical player (so league-wide scoring is unchanged and only differences between players show).
 */
import { clamp, Rng } from "../rng";
import type { Attributes, Player, Position } from "../types";

export type Foot = "L" | "R";
export type FootUse = "shoot" | "cross" | "pass" | "dribble";

/** Registry id of the trait (see traits/registry.ts). */
export const AMBIDEXTROUS = "ambidextrous";
/** Weak-foot rating from which the trait is earned (the trait's own derive() in the registry uses the same threshold). */
export const AMBI_MIN = 88;
export const AMBI_KEEP = 84;
/** A typical weak foot, the baseline the engine measures everyone against. */
const REF_WEAK_FOOT = 60;
/** How much of the gap between the weak and strong foot reaches the player's attributes (a few percent at most). */
const PENALTY_K = 0.45;

export const isFoot = (v: unknown): v is Foot => v === "L" || v === "R";

const TECH_KEYS = ["firstTouch", "dribbling", "passing", "finishing", "crossing"] as const;
const techAvg = (a: Attributes) => TECH_KEYS.reduce((s, k) => s + a[k], 0) / TECH_KEYS.length;

/** The best a player's weak foot can become: only a really technical player can ever get close to two-footed. */
export function weakFootCeiling(id: string, attrs: Attributes): number {
  const bias = Rng.fromSeed(`wfbias:${id}`).normal(0, 6);
  return clamp(1.2 * techAvg(attrs) - 2 + bias, 25, 98);
}

/** Starting weak-foot rating for a generated or newly created player. Deterministic and independent of the world stream. */
export function initialWeakFoot(id: string, attrs: Attributes, age: number): number {
  const rng = Rng.fromSeed(`wf:${id}`);
  const share = clamp(rng.normal(0.72, 0.12), 0.35, 1) * (age < 20 ? 0.9 : 1);
  return Math.round(clamp(weakFootCeiling(id, attrs) * share, 8, 98));
}

const ageGain = (age: number) => (age <= 21 ? 1 : age <= 25 ? 0.6 : age <= 29 ? 0.3 : 0.1);

/** One monthly step of natural improvement through playing; slows as the ceiling approaches. */
export function developWeakFoot(p: Pick<Player, "id" | "attrs" | "weakFoot" | "hidden">, age: number, scale = 1 / 12): void {
  const wf = p.weakFoot ?? 50;
  const gap = weakFootCeiling(p.id, p.attrs) - wf;
  if (gap <= 0) return;
  p.weakFoot = Math.min(wf + gap, Math.round((wf + gap * 0.2 * ageGain(age) * p.hidden.developmentRate * scale) * 100) / 100);
}

/** A weekly session aimed at this: shooting, passing, dribbling and set-piece work all exercise the weaker foot. */
export const WEAK_FOOT_FOCUS: readonly string[] = ["finishing", "passing", "dribbling", "setPieces"];

export function trainWeakFoot(p: Pick<Player, "id" | "attrs" | "weakFoot">, age: number, amount: number): void {
  const wf = p.weakFoot ?? 50;
  const gap = weakFootCeiling(p.id, p.attrs) - wf;
  if (gap <= 0) return;
  p.weakFoot = Math.min(wf + gap, Math.round((wf + amount * ageGain(age) * clamp(gap / 20, 0.1, 1)) * 100) / 100);
}

/** Share (0–1) of the weak foot's ability that is actually available: 1 = as good as the strong foot. */
export function weakFootEffect(weakFoot: number, ambidextrous: boolean): number {
  const e = 0.5 + 0.47 * clamp(weakFoot, 0, 100) / 100;
  return ambidextrous ? Math.max(e, 0.985) : e;
}

/** Whether the slot is on the side of the pitch the player's strong foot does not favour (left-footed right-back…). */
export function offFlank(slot: Position, foot: Foot): boolean {
  return ((slot === "RB" || slot === "RW") && foot === "L") || ((slot === "LB" || slot === "LW") && foot === "R");
}

const WIDE = (s: Position) => s === "RW" || s === "LW";
const FULLBACK = (s: Position) => s === "RB" || s === "LB";

/** How often a role has to use the weaker foot for this kind of action (0–1). */
export function weakShare(slot: Position, foot: Foot, use: FootUse): number {
  if (slot === "GK") return 0;
  const off = offFlank(slot, foot);
  switch (use) {
    case "shoot":
      // Inverted wingers cut inside onto their strong foot; everyone else takes shots from any angle.
      if (WIDE(slot)) return off ? 0.14 : 0.3;
      return slot === "ST" ? 0.35 : slot === "AM" ? 0.32 : slot === "CB" ? 0.25 : 0.3;
    case "cross":
      // Delivery from the byline: the off-flank winger or full-back has to use the weaker foot.
      if (WIDE(slot) || FULLBACK(slot)) return off ? 0.55 : 0.08;
      return 0.2;
    case "pass":
      return FULLBACK(slot) && off ? 0.3 : slot === "CB" ? 0.18 : slot === "AM" ? 0.26 : 0.23;
    case "dribble":
      return WIDE(slot) ? 0.12 : 0.22;
  }
}

/** Multiplier on the attribute behind an action, relative to a typical player in the same role (≈0.92–1.04). */
export function footMultiplier(foot: Foot, weakFoot: number, ambidextrous: boolean, slot: Position, use: FootUse): number {
  const share = weakShare(slot, foot, use);
  if (share <= 0) return 1;
  const raw = 1 - PENALTY_K * share * (1 - weakFootEffect(weakFoot, ambidextrous));
  const ref = 1 - PENALTY_K * share * (1 - weakFootEffect(REF_WEAK_FOOT, false));
  return clamp(raw / ref, 0.9, 1.04);
}

/** Per-attribute multipliers for a player in a slot; absent attributes are unaffected. */
export function footAttrMultipliers(foot: Foot, weakFoot: number, ambidextrous: boolean, slot: Position): Partial<Record<keyof Attributes, number>> {
  const m = (use: FootUse) => footMultiplier(foot, weakFoot, ambidextrous, slot, use);
  const shoot = m("shoot");
  const pass = m("pass");
  return { finishing: shoot, longShots: shoot, crossing: m("cross"), passing: pass, vision: pass, dribbling: m("dribble") };
}

/** Small selection penalty (rating points) for a full-back or winger placed on the wrong flank for a one-footed player. */
export function flankFitPenalty(p: Pick<Player, "foot" | "weakFoot" | "traits">, slot: Position): number {
  if (!isFoot(p.foot) || !(FULLBACK(slot) || WIDE(slot)) || !offFlank(slot, p.foot)) return 0;
  const ambi = !!p.traits?.some((t) => t.id === AMBIDEXTROUS && t.xp >= 30);
  return (FULLBACK(slot) ? 5 : 1.5) * (1 - weakFootEffect(p.weakFoot ?? 50, ambi));
}

/**
 * Old saves stored "B" (both feet). It becomes a left or right dominant foot (decided by the player's identity, with the
 * usual left-sided bias for left-backs and left wingers) and a weak foot that keeps the spirit of the old choice:
 * the user's player stays two-footed, an NPC becomes very good with the weaker foot.
 */
export function migrateFoot(p: Pick<Player, "id" | "foot" | "position" | "attrs" | "weakFoot" | "isUser" | "birthYear">): void {
  const raw = p.foot as string;
  if (raw === "B" || !isFoot(raw)) {
    const leftBias = p.position === "LB" || p.position === "LW" ? 0.55 : p.position === "RW" ? 0.35 : 0.25;
    p.foot = Rng.fromSeed(`foot:${p.id}`).next() < leftBias ? "L" : "R";
    const wasBoth = raw === "B";
    if (typeof p.weakFoot !== "number" || !Number.isFinite(p.weakFoot)) {
      const base = initialWeakFoot(p.id, p.attrs, 25);
      p.weakFoot = wasBoth ? (p.isUser || techAvg(p.attrs) >= 74 ? 90 : Math.max(base, 78)) : base;
    }
  }
  if (typeof p.weakFoot !== "number" || !Number.isFinite(p.weakFoot)) p.weakFoot = initialWeakFoot(p.id, p.attrs, 25);
  p.weakFoot = Math.round(clamp(p.weakFoot, 0, 100) * 100) / 100;
}

/** Wording for the profile. */
export function weakFootLabel(wf: number): string {
  return wf >= AMBI_MIN ? "Near-perfect" : wf >= 75 ? "Excellent" : wf >= 60 ? "Good" : wf >= 45 ? "Decent" : wf >= 30 ? "Weak" : "Very weak";
}
