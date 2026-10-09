import { clamp, r2, type Rng } from "../rng";
import { ADDED_ATTRS, LEGACY_ATTRS, type AttrKey, type Attributes, type Position, type PositionGroup } from "../types";
import {
  ATTR, DECLINE_SHARE, EXPLOSIVE, LEGACY_POSITION_WEIGHTS, PHYSICAL_DECLINE, POSITION_WEIGHTS, SPEED_ATTRS, fitToOverall, seedAddedAttributes,
} from "./model";

// The model (what each attribute is, position weights, ageing, training, tactical profiles) lives in model.ts.
export { ATTR_GROUPS, ATTR_LABEL, POSITION_WEIGHTS } from "./model";

export const POSITION_LABEL: Record<Position, string> = {
  GK: "Goalkeeper", RB: "Right Back", CB: "Centre Back", LB: "Left Back", DM: "Defensive Midfielder",
  CM: "Central Midfielder", AM: "Attacking Midfielder", RW: "Right Winger", LW: "Left Winger", ST: "Striker",
};

/** The athletic attributes that wear down with age (the general physical decline); speed has its own curve. */
export const PHYSICAL: AttrKey[] = Object.keys(PHYSICAL_DECLINE) as AttrKey[];
export const SPEED: AttrKey[] = SPEED_ATTRS;

export function positionGroup(p: Position): PositionGroup {
  if (p === "GK") return "GK";
  if (p === "CB" || p === "RB" || p === "LB") return "DEF";
  if (p === "DM" || p === "CM" || p === "AM") return "MID";
  return "ATT";
}

/** Flattened weights for the hot path (overall is computed thousands of times per turn). */
const WEIGHT_PAIRS: Record<Position, { keys: AttrKey[]; weights: number[]; total: number }> = Object.fromEntries(
  (Object.keys(POSITION_WEIGHTS) as Position[]).map((pos) => {
    const entries = Object.entries(POSITION_WEIGHTS[pos]) as [AttrKey, number][];
    return [pos, { keys: entries.map((e) => e[0]), weights: entries.map((e) => e[1]), total: entries.reduce((s, e) => s + e[1], 0) }];
  }),
) as Record<Position, { keys: AttrKey[]; weights: number[]; total: number }>;

export function overallFor(attrs: Attributes, position: Position): number {
  const w = WEIGHT_PAIRS[position];
  let sum = 0;
  for (let i = 0; i < w.keys.length; i++) sum += attrs[w.keys[i]] * w.weights[i];
  return Math.round(sum / w.total);
}

/** The same, unrounded: for comparisons that need the fraction (tactical fit measures the profile against it). */
export function overallExact(attrs: Attributes, position: Position): number {
  const w = WEIGHT_PAIRS[position];
  let sum = 0;
  for (let i = 0; i < w.keys.length; i++) sum += attrs[w.keys[i]] * w.weights[i];
  return sum / w.total;
}

/** Best overall across main and secondary positions. */
export function bestOverall(attrs: Attributes, positions: Position[]): number {
  return Math.max(...positions.map((p) => overallFor(attrs, p)));
}

const ATHLETIC_FAMILY: AttrKey[] = ["pace", "acceleration", "stamina", "strength"];
const TECHNICAL_FAMILY: AttrKey[] = ["passing", "firstTouch", "dribbling", "vision", "crossing"];
const ATTACKING_FAMILY: AttrKey[] = ["finishing", "longShots", "dribbling", "crossing", "vision"];
const DEFENDING_FAMILY: AttrKey[] = ["tackling", "positioning", "heading"];
const LEAN_ATTACK_DEFENCE: Position[] = ["DM", "CM", "AM", "RB", "LB"];
/** Standard deviations of the two latent leans, in attribute points. */
const PROFILE_SPREAD = { athletic: 6, attacking: 5 } as const;

export interface GenerateContext {
  /** Hidden professionalism (work rate follows it a little). */
  professionalism?: number;
  age?: number;
  traits?: readonly { id: string; xp: number }[];
}

/**
 * Generate a coherent attribute set for a role at a target overall. The core skills are drawn first (a role's relevant skills sit above
 * the rest), the reading-of-the-game and movement attributes are then derived from them with personal variation, and finally those are
 * fitted so the position overall lands on the target. Related abilities therefore stay correlated and unusual profiles still happen.
 */
export function generateAttributes(rng: Rng, position: Position, target: number, height: number, ctx: GenerateContext = {}): Attributes {
  const w = LEGACY_POSITION_WEIGHTS[position];
  const attrs = {} as Attributes;
  const tall = (height - 182) / 10; // -1..+1
  const isGkKey = (k: AttrKey) => ATTR[k].group === "goalkeeping";
  // Footballers are not all the same shape: some are athletes who got by on legs, some are technicians, and in midfield some lean to
  // the attack and some to the defence. Two latent leans move whole families of skills together (the nudge below restores the overall),
  // so the same position and overall produce genuinely different profiles.
  const athletic = position === "GK" ? 0 : rng.normal(0, PROFILE_SPREAD.athletic);
  const attacking = LEAN_ATTACK_DEFENCE.includes(position) ? rng.normal(0, PROFILE_SPREAD.attacking) : 0;
  for (const k of LEGACY_ATTRS) {
    const weight = w[k] ?? 0;
    const relevance = weight > 0 ? 1 : 0;
    let base: number;
    if (position === "GK") {
      base = relevance ? target + rng.normal(0, 4) : (isGkKey(k) ? target - 6 : target * 0.45 + rng.normal(0, 6));
    } else if (isGkKey(k)) {
      base = rng.int(5, 18);
    } else {
      base = relevance ? target + weight * 20 + rng.normal(0, 5) : target - 10 + rng.normal(0, 7);
    }
    if (relevance && position !== "GK") {
      if (ATHLETIC_FAMILY.includes(k)) base += athletic;
      else if (TECHNICAL_FAMILY.includes(k)) base -= athletic * 0.8;
      if (ATTACKING_FAMILY.includes(k)) base += attacking;
      else if (DEFENDING_FAMILY.includes(k)) base -= attacking;
    }
    if (k === "heading" || k === "strength") base += tall * 6;
    if (k === "pace" || k === "acceleration") base -= tall * 4;
    if (k === "command") base += tall * 4;
    attrs[k] = clamp(Math.round(base), 1, 99);
  }
  // Nudge relevant attributes so the (legacy) role overall hits the target.
  for (let i = 0; i < 6; i++) {
    const diff = target - legacyRound(attrs, position);
    if (Math.abs(diff) < 1) break;
    for (const k in w) {
      const key = k as AttrKey;
      attrs[key] = clamp(Math.round(attrs[key] + diff), 1, 99);
    }
  }
  seedAddedAttributes(attrs, { position, level: target, age: ctx.age ?? 26, height, professionalism: ctx.professionalism, traits: ctx.traits }, () => rng.normal(0, 1));
  fitToOverall(attrs, position, target, ADDED_ATTRS);
  return attrs;
}

function legacyRound(attrs: Attributes, position: Position): number {
  const w = LEGACY_POSITION_WEIGHTS[position];
  let sum = 0;
  let total = 0;
  for (const k in w) {
    sum += attrs[k as AttrKey] * (w[k as AttrKey] ?? 0);
    total += w[k as AttrKey] ?? 0;
  }
  return Math.round(sum / total);
}

/**
 * Growth and decline are delivered as steps drawn by weight, so the overall a step is worth depends on how the weights are spread: with
 * thirty-odd attributes sharing a role, a step lands on lighter attributes than it did with twenty, and the same "points" would be worth
 * less overall (and decline, which spares the mind attributes, would be worth less again). These factors restore the expected overall
 * change per point to what the twenty-attribute model delivered, so careers keep the same arc: only who changes, not how much.
 */
function expectedStep(weights: Partial<Record<AttrKey, number>>, share: (k: AttrKey) => number): number {
  let num = 0;
  let den = 0;
  for (const k of Object.keys(weights) as AttrKey[]) {
    const w = weights[k] ?? 0;
    const p = (w + 0.05) * share(k);
    num += p * w;
    den += p;
  }
  return den > 0 ? num / den : 1;
}
const declineShare = (k: AttrKey) => (EXPLOSIVE.includes(k) ? 0 : DECLINE_SHARE[ATTR[k].ageing]);
const GROWTH_NORM = {} as Record<Position, number>;
const DECLINE_NORM = {} as Record<Position, number>;
for (const pos of Object.keys(POSITION_WEIGHTS) as Position[]) {
  const was = expectedStep(LEGACY_POSITION_WEIGHTS[pos], () => 1);
  GROWTH_NORM[pos] = was / expectedStep(POSITION_WEIGHTS[pos], () => 1);
  DECLINE_NORM[pos] = was / expectedStep(POSITION_WEIGHTS[pos], declineShare);
}

/** Apply growth points to attributes, distributing by role weights and an optional focus set. */
export function applyGrowth(
  rng: Rng,
  attrs: Attributes,
  position: Position,
  points: number,
  focus?: AttrKey[],
  physicalDecline = 0,
  /** Attributes that neither lose points to general decline nor to `physicalDecline`. */
  protect: AttrKey[] = [],
  /** A small lean towards some attributes (a development focus); the same single draw per step, so no focus changes nothing. */
  tilt?: { weights: Readonly<Partial<Record<AttrKey, number>>>; k: number },
): void {
  const w = POSITION_WEIGHTS[position];
  const all = Object.keys(w) as AttrKey[];
  // Decline lands on the athletic and skill attributes; the reading of the game fades far more slowly (see DECLINE_SHARE).
  const keys = points < 0 ? all.filter((k) => !protect.includes(k) && !EXPLOSIVE.includes(k) && DECLINE_SHARE[ATTR[k].ageing] > 0) : all;
  if (points !== 0 && keys.length) {
    // Convert overall points into attribute increments (role weights sum to 1).
    const steps = Math.max(1, Math.round(Math.abs(points) * 4));
    const per = (points < 0 ? points * DECLINE_NORM[position] : points * GROWTH_NORM[position]) / steps;
    for (let i = 0; i < steps; i++) {
      const pool = focus && focus.length && rng.chance(0.55) ? focus : keys;
      const key = rng.weighted(pool, (k) => ((w[k] ?? 0.05) + 0.05) * (points < 0 ? DECLINE_SHARE[ATTR[k].ageing] : 1) + (tilt && points > 0 ? tilt.k * (tilt.weights[k] ?? 0) : 0));
      const ceilingDrag = attrs[key] > 88 && per > 0 ? 0.5 : 1;
      attrs[key] = r2(clamp(attrs[key] + per * 4 * ceilingDrag * (1 + rng.normal(0, 0.15)), 1, 99));
    }
  }
  if (physicalDecline > 0) {
    for (const k of PHYSICAL) if (!protect.includes(k)) attrs[k] = r2(clamp(attrs[k] - physicalDecline * (PHYSICAL_DECLINE[k] ?? 0) * rng.range(0.6, 1.4), 1, 99));
  }
}

/** Round attributes for storage/display. */
export function roundAttrs(attrs: Attributes): void {
  for (const k of Object.keys(attrs) as AttrKey[]) attrs[k] = Math.round(attrs[k] * 10) / 10;
}

export function displayAttr(v: number): number {
  return Math.round(v);
}
