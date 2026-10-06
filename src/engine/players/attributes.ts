import { clamp, r2, type Rng } from "../rng";
import { ALL_ATTRS, type AttrKey, type Attributes, type Position, type PositionGroup } from "../types";

type Weights = Partial<Record<AttrKey, number>>;

/** Pitchborn position models: how much each attribute matters to a role. */
export const POSITION_WEIGHTS: Record<Position, Weights> = {
  GK: { reflexes: 0.25, handling: 0.2, diving: 0.2, command: 0.12, kicking: 0.08, positioning: 0.1, composure: 0.05 },
  CB: { tackling: 0.2, positioning: 0.18, heading: 0.16, strength: 0.14, pace: 0.08, composure: 0.08, passing: 0.06, acceleration: 0.04, firstTouch: 0.03, stamina: 0.03 },
  RB: { tackling: 0.15, positioning: 0.12, pace: 0.14, acceleration: 0.08, stamina: 0.12, crossing: 0.12, passing: 0.08, dribbling: 0.07, strength: 0.04, firstTouch: 0.04, composure: 0.04 },
  LB: { tackling: 0.15, positioning: 0.12, pace: 0.14, acceleration: 0.08, stamina: 0.12, crossing: 0.12, passing: 0.08, dribbling: 0.07, strength: 0.04, firstTouch: 0.04, composure: 0.04 },
  DM: { tackling: 0.17, positioning: 0.16, passing: 0.15, stamina: 0.1, strength: 0.1, vision: 0.07, composure: 0.08, firstTouch: 0.07, heading: 0.05, pace: 0.05 },
  CM: { passing: 0.2, vision: 0.14, firstTouch: 0.1, stamina: 0.1, positioning: 0.08, tackling: 0.08, composure: 0.08, dribbling: 0.08, longShots: 0.07, strength: 0.04, pace: 0.03 },
  AM: { passing: 0.14, vision: 0.17, dribbling: 0.15, firstTouch: 0.13, composure: 0.1, longShots: 0.1, finishing: 0.1, acceleration: 0.06, pace: 0.05 },
  RW: { pace: 0.16, acceleration: 0.12, dribbling: 0.17, crossing: 0.12, firstTouch: 0.1, finishing: 0.1, passing: 0.07, composure: 0.06, stamina: 0.05, vision: 0.05 },
  LW: { pace: 0.16, acceleration: 0.12, dribbling: 0.17, crossing: 0.12, firstTouch: 0.1, finishing: 0.1, passing: 0.07, composure: 0.06, stamina: 0.05, vision: 0.05 },
  ST: { finishing: 0.24, composure: 0.12, positioning: 0.12, firstTouch: 0.1, heading: 0.1, pace: 0.1, acceleration: 0.07, dribbling: 0.07, strength: 0.08 },
};

export const POSITION_LABEL: Record<Position, string> = {
  GK: "Goalkeeper", RB: "Right Back", CB: "Centre Back", LB: "Left Back", DM: "Defensive Midfielder",
  CM: "Central Midfielder", AM: "Attacking Midfielder", RW: "Right Winger", LW: "Left Winger", ST: "Striker",
};

export const ATTR_LABEL: Record<AttrKey, string> = {
  pace: "Pace", acceleration: "Acceleration", stamina: "Stamina", strength: "Strength", finishing: "Finishing",
  longShots: "Long Shots", passing: "Passing", vision: "Vision", crossing: "Crossing", dribbling: "Dribbling",
  firstTouch: "First Touch", tackling: "Tackling", positioning: "Positioning", heading: "Heading", composure: "Composure",
  reflexes: "Reflexes", handling: "Handling", diving: "Diving", kicking: "Kicking", command: "Command of Area",
};

export const ATTR_GROUPS: { label: string; keys: AttrKey[] }[] = [
  { label: "Physical", keys: ["pace", "acceleration", "stamina", "strength"] },
  { label: "Attacking", keys: ["finishing", "longShots", "heading", "composure"] },
  { label: "Technical", keys: ["passing", "vision", "crossing", "dribbling", "firstTouch"] },
  { label: "Defending", keys: ["tackling", "positioning"] },
  { label: "Goalkeeping", keys: ["reflexes", "handling", "diving", "kicking", "command"] },
];

export const PHYSICAL: AttrKey[] = ["pace", "acceleration", "stamina", "strength"];

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

/** Best overall across main and secondary positions. */
export function bestOverall(attrs: Attributes, positions: Position[]): number {
  return Math.max(...positions.map((p) => overallFor(attrs, p)));
}

/** Generate a coherent attribute set for a role at a target overall. */
export function generateAttributes(rng: Rng, position: Position, target: number, height: number): Attributes {
  const w = POSITION_WEIGHTS[position];
  const attrs = {} as Attributes;
  const tall = (height - 182) / 10; // -1..+1
  for (const k of ALL_ATTRS) {
    const weight = w[k] ?? 0;
    const relevance = weight > 0 ? 1 : 0;
    let base: number;
    if (position === "GK") {
      base = relevance ? target + rng.normal(0, 4) : (["reflexes", "handling", "diving", "kicking", "command"].includes(k) ? target - 6 : target * 0.45 + rng.normal(0, 6));
    } else if (["reflexes", "handling", "diving", "kicking", "command"].includes(k)) {
      base = rng.int(5, 18);
    } else {
      base = relevance ? target + weight * 20 + rng.normal(0, 5) : target - 10 + rng.normal(0, 7);
    }
    if (k === "heading" || k === "strength") base += tall * 6;
    if (k === "pace" || k === "acceleration") base -= tall * 4;
    if (k === "command") base += tall * 4;
    attrs[k] = clamp(Math.round(base), 1, 99);
  }
  // Nudge relevant attributes so the role overall hits the target.
  for (let i = 0; i < 6; i++) {
    const diff = target - overallFor(attrs, position);
    if (Math.abs(diff) < 1) break;
    for (const k in w) {
      const key = k as AttrKey;
      attrs[key] = clamp(Math.round(attrs[key] + diff), 1, 99);
    }
  }
  return attrs;
}

/** Apply growth points to attributes, distributing by role weights and an optional focus set. */
export function applyGrowth(
  rng: Rng,
  attrs: Attributes,
  position: Position,
  points: number,
  focus?: AttrKey[],
  physicalDecline = 0,
): void {
  const w = POSITION_WEIGHTS[position];
  const keys = Object.keys(w) as AttrKey[];
  if (points !== 0) {
    // Convert overall points into attribute increments (role weights sum to 1).
    const steps = Math.max(1, Math.round(Math.abs(points) * 4));
    const per = points / steps;
    for (let i = 0; i < steps; i++) {
      const pool = focus && focus.length && rng.chance(0.55) ? focus : keys;
      const key = rng.weighted(pool, (k) => (w[k] ?? 0.05) + 0.05);
      const ceilingDrag = attrs[key] > 88 && per > 0 ? 0.5 : 1;
      attrs[key] = r2(clamp(attrs[key] + per * 4 * ceilingDrag * (1 + rng.normal(0, 0.15)), 1, 99));
    }
  }
  if (physicalDecline > 0) {
    for (const k of PHYSICAL) attrs[k] = r2(clamp(attrs[k] - physicalDecline * rng.range(0.6, 1.4), 1, 99));
  }
}

/** Round attributes for storage/display. */
export function roundAttrs(attrs: Attributes): void {
  for (const k of ALL_ATTRS) attrs[k] = Math.round(attrs[k] * 10) / 10;
}

export function displayAttr(v: number): number {
  return Math.round(v);
}
