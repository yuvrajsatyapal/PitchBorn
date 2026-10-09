/**
 * The canonical player model: what every attribute means, how much each position cares about it, how each ages, which
 * training focus builds it, how it is seeded for players that do not have it yet, and what each tactical style asks of it.
 *
 * Everything that reasons about attributes (overall, generation, migration, development, training, tactical fit, the match
 * engine's role weighting, recruitment) reads from here, so there is one place to change a formula. This file imports
 * nothing but types: it is safe to use from anywhere in the engine.
 *
 * Semantics (each one is used by a different part of the simulation; if two ever stop being distinguishable, merge them):
 *  Physical
 *   pace          sustained top speed. Runs in behind, recovery over distance.
 *   acceleration  first steps and short bursts. Reaching a loose ball, closing down, breaking from a standing start.
 *   agility       turning and changing direction. Dribbling past a man, staying with a winger, recovering after a feint.
 *   stamina       how long the player lasts. Drives match fatigue and fitness recovery.
 *   strength      winning physical contests, shielding, holding off a challenge.
 *   balance       staying on your feet under contact. Keeping the ball when pressed, riding a tackle (not about winning duels).
 *   jumping       reach in the air. Decides who gets to a cross first (heading is what you do once there).
 *  Technical
 *   passing       pass execution: weight, accuracy, range.
 *   firstTouch    receiving: killing a pass, controlling it under pressure, turning on the ball in one movement.
 *   technique     difficult execution: curling, dipping, volleys, bent and driven balls, delivery from awkward positions.
 *   dribbling     carrying the ball past an opponent.
 *   crossing      wide delivery.
 *   tackling      winning the ball by challenging for it (a skill, not a temperament: see aggression).
 *  Attacking
 *   finishing     converting a chance from inside the area.
 *   longShots     shooting from distance, direct free kicks.
 *   heading       attacking and clearing headers once the player has got there.
 *   offBall       movement without the ball: the run, the late arrival, finding space between defenders.
 *   creativity    producing the unusual chance: the pass or move others do not see coming (vision is seeing the obvious one).
 *  Defending
 *   positioning   defensive shape: where to stand, blocking shots, covering the zone.
 *   marking       tracking a man and staying with a runner.
 *   interceptions cutting out a pass without making contact.
 *  Mental
 *   composure     execution under pressure: the finish with the keeper out, the pass with a man closing.
 *   vision        noticing the options that are on.
 *   decisions     choosing the right action: when to shoot, when to pass, when not to foul.
 *   anticipation  reading what happens next: the second ball, the counter, the pass about to be played.
 *   workRate      how much ground the player chooses to cover: pressing, tracking back, repeated sprints.
 *   aggression    willingness to challenge: duels, press triggers, and the booking risk that goes with them.
 *  Goalkeeping
 *   reflexes, diving, handling   shot stopping (reaction, reach, security).
 *   command       claiming crosses and organising the box; coming off the line.
 *   kicking       distribution.
 *   oneOnOnes     closing down and winning a one-on-one.
 *   (A goalkeeper also has positioning, composure, anticipation and decisions from the shared set.)
 */
import type { AttrKey, Attributes, Position, TrainingFocus } from "../types";

type Weights = Partial<Record<AttrKey, number>>;

export type AttrGroup = "physical" | "technical" | "attacking" | "defending" | "mental" | "goalkeeping";

/** How an attribute ages. */
export type Ageing = "explosive" | "athletic" | "skill" | "mind";

export interface AttrInfo {
  label: string;
  group: AttrGroup;
  ageing: Ageing;
}

export const ATTR: Record<AttrKey, AttrInfo> = {
  pace: { label: "Pace", group: "physical", ageing: "explosive" },
  acceleration: { label: "Acceleration", group: "physical", ageing: "explosive" },
  agility: { label: "Agility", group: "physical", ageing: "explosive" },
  stamina: { label: "Stamina", group: "physical", ageing: "athletic" },
  strength: { label: "Strength", group: "physical", ageing: "athletic" },
  balance: { label: "Balance", group: "physical", ageing: "athletic" },
  jumping: { label: "Jumping", group: "physical", ageing: "athletic" },
  passing: { label: "Passing", group: "technical", ageing: "skill" },
  firstTouch: { label: "First Touch", group: "technical", ageing: "skill" },
  technique: { label: "Technique", group: "technical", ageing: "skill" },
  dribbling: { label: "Dribbling", group: "technical", ageing: "skill" },
  crossing: { label: "Crossing", group: "technical", ageing: "skill" },
  tackling: { label: "Tackling", group: "technical", ageing: "skill" },
  finishing: { label: "Finishing", group: "attacking", ageing: "skill" },
  longShots: { label: "Long Shots", group: "attacking", ageing: "skill" },
  heading: { label: "Heading", group: "attacking", ageing: "skill" },
  offBall: { label: "Off-the-Ball Movement", group: "attacking", ageing: "mind" },
  creativity: { label: "Creativity", group: "attacking", ageing: "mind" },
  positioning: { label: "Positioning", group: "defending", ageing: "mind" },
  marking: { label: "Marking", group: "defending", ageing: "mind" },
  interceptions: { label: "Interceptions", group: "defending", ageing: "mind" },
  composure: { label: "Composure", group: "mental", ageing: "mind" },
  vision: { label: "Vision", group: "mental", ageing: "mind" },
  decisions: { label: "Decisions", group: "mental", ageing: "mind" },
  anticipation: { label: "Anticipation", group: "mental", ageing: "mind" },
  workRate: { label: "Work Rate", group: "mental", ageing: "athletic" },
  aggression: { label: "Aggression", group: "mental", ageing: "athletic" },
  reflexes: { label: "Reflexes", group: "goalkeeping", ageing: "skill" },
  diving: { label: "Diving", group: "goalkeeping", ageing: "skill" },
  handling: { label: "Handling", group: "goalkeeping", ageing: "skill" },
  command: { label: "Command of Area", group: "goalkeeping", ageing: "mind" },
  kicking: { label: "Kicking", group: "goalkeeping", ageing: "skill" },
  oneOnOnes: { label: "One-on-Ones", group: "goalkeeping", ageing: "mind" },
};

export const ATTR_LABEL: Record<AttrKey, string> = Object.fromEntries(Object.entries(ATTR).map(([k, v]) => [k, v.label])) as Record<AttrKey, string>;

const GROUP_ORDER: { group: AttrGroup; label: string }[] = [
  { group: "physical", label: "Physical" },
  { group: "technical", label: "Technical" },
  { group: "attacking", label: "Attacking" },
  { group: "defending", label: "Defending" },
  { group: "mental", label: "Mental" },
  { group: "goalkeeping", label: "Goalkeeping" },
];

/** Display order inside each group. */
const IN_GROUP: Partial<Record<AttrGroup, AttrKey[]>> = {
  physical: ["pace", "acceleration", "agility", "stamina", "strength", "balance", "jumping"],
  technical: ["passing", "firstTouch", "technique", "dribbling", "crossing", "tackling"],
  attacking: ["finishing", "longShots", "heading", "offBall", "creativity"],
  defending: ["positioning", "marking", "interceptions"],
  mental: ["composure", "vision", "decisions", "anticipation", "workRate", "aggression"],
  goalkeeping: ["reflexes", "handling", "diving", "command", "kicking", "oneOnOnes"],
};

export const ATTR_GROUPS: { label: string; keys: AttrKey[] }[] = GROUP_ORDER.map((g) => ({ label: g.label, keys: IN_GROUP[g.group] ?? [] }));

// ─────────────────────────────────────────────────────────────── position models

/**
 * How much each attribute matters to a position's overall. Each row sums to 1. Attackers' off-the-ball movement stands where
 * their positioning used to: defensive shape is a defender's concern, and a striker's is the run.
 */
export const POSITION_WEIGHTS: Record<Position, Weights> = {
  GK: { reflexes: 0.22, diving: 0.17, handling: 0.17, command: 0.1, kicking: 0.06, oneOnOnes: 0.08, positioning: 0.1, composure: 0.04, anticipation: 0.04, decisions: 0.02 },
  CB: { tackling: 0.12, marking: 0.08, positioning: 0.14, interceptions: 0.04, anticipation: 0.06, heading: 0.1, jumping: 0.04, strength: 0.12, pace: 0.07, composure: 0.06, passing: 0.05, decisions: 0.05, acceleration: 0.03, aggression: 0.02, firstTouch: 0.02 },
  RB: { tackling: 0.1, marking: 0.04, positioning: 0.09, interceptions: 0.03, pace: 0.12, acceleration: 0.07, stamina: 0.08, workRate: 0.05, crossing: 0.11, passing: 0.07, technique: 0.04, dribbling: 0.05, agility: 0.03, strength: 0.03, firstTouch: 0.03, decisions: 0.03, anticipation: 0.03 },
  LB: { tackling: 0.1, marking: 0.04, positioning: 0.09, interceptions: 0.03, pace: 0.12, acceleration: 0.07, stamina: 0.08, workRate: 0.05, crossing: 0.11, passing: 0.07, technique: 0.04, dribbling: 0.05, agility: 0.03, strength: 0.03, firstTouch: 0.03, decisions: 0.03, anticipation: 0.03 },
  DM: { tackling: 0.1, marking: 0.04, interceptions: 0.07, positioning: 0.11, anticipation: 0.06, passing: 0.11, decisions: 0.06, vision: 0.04, composure: 0.06, stamina: 0.06, workRate: 0.04, strength: 0.07, firstTouch: 0.05, aggression: 0.03, heading: 0.03, pace: 0.03, technique: 0.04 },
  CM: { passing: 0.14, vision: 0.09, technique: 0.07, firstTouch: 0.07, decisions: 0.07, creativity: 0.04, stamina: 0.08, workRate: 0.04, positioning: 0.05, tackling: 0.05, interceptions: 0.02, anticipation: 0.03, composure: 0.06, dribbling: 0.06, longShots: 0.05, offBall: 0.03, strength: 0.03, pace: 0.02 },
  AM: { passing: 0.1, vision: 0.1, creativity: 0.08, technique: 0.08, dribbling: 0.11, firstTouch: 0.09, agility: 0.03, composure: 0.07, decisions: 0.04, longShots: 0.07, finishing: 0.08, offBall: 0.05, acceleration: 0.05, pace: 0.03, anticipation: 0.02 },
  RW: { pace: 0.13, acceleration: 0.11, agility: 0.05, dribbling: 0.14, crossing: 0.1, technique: 0.06, firstTouch: 0.07, finishing: 0.09, offBall: 0.06, passing: 0.05, composure: 0.04, vision: 0.03, creativity: 0.02, stamina: 0.03, workRate: 0.02 },
  LW: { pace: 0.13, acceleration: 0.11, agility: 0.05, dribbling: 0.14, crossing: 0.1, technique: 0.06, firstTouch: 0.07, finishing: 0.09, offBall: 0.06, passing: 0.05, composure: 0.04, vision: 0.03, creativity: 0.02, stamina: 0.03, workRate: 0.02 },
  ST: { finishing: 0.22, composure: 0.1, offBall: 0.12, firstTouch: 0.07, technique: 0.04, heading: 0.08, jumping: 0.02, pace: 0.08, acceleration: 0.07, dribbling: 0.05, strength: 0.07, decisions: 0.03, anticipation: 0.03, balance: 0.02 },
};

/**
 * The position weights of schema 14 and earlier (twenty attributes). Used only to seed generation and to recover the overall a
 * player had before the expansion, so migrated players keep it. Nothing else reads this.
 */
export const LEGACY_POSITION_WEIGHTS: Record<Position, Weights> = {
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

export function weightedMean(attrs: Readonly<Partial<Record<AttrKey, number>>>, w: Weights): number {
  let sum = 0;
  let total = 0;
  for (const k in w) {
    const wt = w[k as AttrKey] ?? 0;
    sum += (attrs[k as AttrKey] ?? 0) * wt;
    total += wt;
  }
  return total ? sum / total : 0;
}

/** The overall a player had under the old twenty-attribute model, unrounded. */
export const legacyOverall = (attrs: Readonly<Partial<Record<AttrKey, number>>>, position: Position): number => weightedMean(attrs, LEGACY_POSITION_WEIGHTS[position]);

// ─────────────────────────────────────────────────────────────── ageing

/**
 * How much of a general decline each attribute takes (1 = the full share its role weight implies). Explosive attributes follow their
 * own curve (see development.ts) and are protected from this one. Skill fades slowly, and the reading of the game barely at all.
 */
export const DECLINE_SHARE: Record<Ageing, number> = { explosive: 0, athletic: 1, skill: 0.4, mind: 0.15 };

/** Attributes that follow the early-onset speed curve instead of the general one. */
export const EXPLOSIVE: AttrKey[] = (Object.keys(ATTR) as AttrKey[]).filter((k) => ATTR[k].ageing === "explosive");
/** Speed pair that has its own training window. */
export const SPEED_ATTRS: AttrKey[] = ["pace", "acceleration", "agility"];

/** How hard the general physical decline hits each athletic attribute (strength holds on longest, stamina goes first). */
export const PHYSICAL_DECLINE: Partial<Record<AttrKey, number>> = { stamina: 1.1, jumping: 0.9, strength: 0.8, balance: 0.5, workRate: 0.3, aggression: 0.2 };

/**
 * Reading-of-the-game attributes keep improving into the late twenties as the player sees more football: a small gain per season,
 * fading to nothing by 31. It is deliberately tiny next to the physical decline that follows, and it never raises the ceiling.
 */
export const MATURITY: Partial<Record<AttrKey, number>> = { decisions: 1, anticipation: 1, positioning: 0.7, composure: 0.7, marking: 0.5, interceptions: 0.5, vision: 0.4 };

// ─────────────────────────────────────────────────────────────── training

export interface TrainingDef {
  label: string;
  /** What the card shows, and the attributes that gain at full rate. */
  attrs: AttrKey[];
  /** Related attributes that gain at half rate. */
  secondary: AttrKey[];
  /** Total units of gain per session, so widening a focus never makes it a faster way to grow (3 for most; see TRAINING). */
  budget: number;
  blurb: string;
}

export const TRAINING_MODEL: Record<TrainingFocus, TrainingDef> = {
  balanced: { label: "Balanced", attrs: [], secondary: [], budget: 6.75, blurb: "Spread work across your role's key attributes." },
  finishing: { label: "Finishing", attrs: ["finishing", "composure", "offBall"], secondary: ["longShots"], budget: 3, blurb: "Shooting drills, composure and movement in front of goal." },
  passing: { label: "Passing", attrs: ["passing", "vision", "technique"], secondary: ["firstTouch", "creativity"], budget: 3, blurb: "Rondos, switches of play, weight of pass." },
  dribbling: { label: "Dribbling", attrs: ["dribbling", "agility", "firstTouch"], secondary: ["balance", "technique"], budget: 3, blurb: "Close control and 1v1 work." },
  pace: { label: "Speed", attrs: ["pace", "acceleration", "agility"], secondary: [], budget: 2, blurb: "Sprint mechanics. Gains slow after 28." },
  physical: { label: "Physical", attrs: ["strength", "stamina", "jumping"], secondary: ["balance"], budget: 2, blurb: "Gym and conditioning — tiring." },
  defending: { label: "Defending", attrs: ["tackling", "marking", "positioning"], secondary: ["interceptions", "anticipation"], budget: 3, blurb: "Shape, duels and reading the game." },
  setPieces: { label: "Set Pieces", attrs: ["crossing", "longShots", "heading"], secondary: ["technique"], budget: 3, blurb: "Deliveries, free kicks and attacking corners." },
  goalkeeping: { label: "Goalkeeping", attrs: ["reflexes", "handling", "diving"], secondary: ["command", "kicking", "oneOnOnes", "positioning"], budget: 5, blurb: "Shot-stopping, command and distribution." },
  recovery: { label: "Recovery", attrs: [], secondary: [], budget: 0, blurb: "Rest and physio. Restores fitness and morale; builds nothing." },
};

// ─────────────────────────────────────────────────────────────── tactical styles

export type StyleDim = "pressing" | "tempo" | "directness";
export type StyleSide = "hi" | "lo";

/**
 * What each end of each style dial asks of a player. "hi pressing" is a side that hunts the ball; "lo pressing" sits in a
 * compact block. "hi tempo" attacks quickly; "lo tempo" keeps the ball and waits. "hi directness" goes long and vertical; "lo
 * directness" builds short. Each row sums to 1. For a position these are masked by what the position actually does (below).
 */
export const STYLE_PROFILE: Record<StyleDim, Record<StyleSide, Weights>> = {
  pressing: {
    hi: { workRate: 0.26, stamina: 0.22, aggression: 0.14, anticipation: 0.14, tackling: 0.1, acceleration: 0.08, interceptions: 0.06 },
    lo: { positioning: 0.26, marking: 0.2, interceptions: 0.16, anticipation: 0.14, strength: 0.12, composure: 0.06, tackling: 0.06 },
  },
  tempo: {
    hi: { pace: 0.2, acceleration: 0.14, passing: 0.17, firstTouch: 0.16, offBall: 0.13, decisions: 0.1, technique: 0.1 },
    lo: { passing: 0.22, firstTouch: 0.18, technique: 0.18, decisions: 0.18, composure: 0.14, vision: 0.1 },
  },
  directness: {
    hi: { pace: 0.16, acceleration: 0.1, offBall: 0.14, finishing: 0.14, heading: 0.12, strength: 0.12, jumping: 0.06, longShots: 0.08, anticipation: 0.08 },
    lo: { passing: 0.24, firstTouch: 0.2, technique: 0.18, vision: 0.14, decisions: 0.14, creativity: 0.1 },
  },
};

/** Goalkeepers answer to the same dials with their own attributes. */
export const GK_STYLE_PROFILE: Record<StyleDim, Record<StyleSide, Weights>> = {
  pressing: {
    hi: { command: 0.3, anticipation: 0.3, oneOnOnes: 0.2, kicking: 0.1, decisions: 0.1 },
    lo: { positioning: 0.3, handling: 0.3, reflexes: 0.25, diving: 0.15 },
  },
  tempo: {
    hi: { kicking: 0.45, decisions: 0.3, anticipation: 0.25 },
    lo: { composure: 0.3, handling: 0.3, positioning: 0.2, decisions: 0.2 },
  },
  directness: {
    hi: { kicking: 0.6, command: 0.2, decisions: 0.2 },
    lo: { composure: 0.35, kicking: 0.3, decisions: 0.35 },
  },
};

/** Weight an attribute keeps in a style profile when the position barely uses it (a centre-back's finishing for a direct side). */
const OFF_ROLE = 0.25;
const ON_ROLE_AT = 0.05;

type StyleTable = Record<StyleDim, Record<StyleSide, readonly [AttrKey, number][]>>;
const STYLE_CACHE: Partial<Record<Position, Partial<StyleTable>>> = {};

/**
 * The style profile as it applies to a position: attributes the role does not use are muted, then the weights are renormalised.
 * Cached; this runs inside team selection.
 */
export function styleWeights(position: Position, dim: StyleDim, side: StyleSide): readonly [AttrKey, number][] {
  const byPos = (STYLE_CACHE[position] ??= {});
  const byDim = (byPos[dim] ??= {} as StyleTable[StyleDim]);
  const cached = byDim[side];
  if (cached) return cached;
  const profile = (position === "GK" ? GK_STYLE_PROFILE : STYLE_PROFILE)[dim][side];
  const role = POSITION_WEIGHTS[position];
  const raw: [AttrKey, number][] = [];
  let total = 0;
  for (const k in profile) {
    const used = Math.min(1, (role[k as AttrKey] ?? 0) / ON_ROLE_AT);
    const w = (profile[k as AttrKey] ?? 0) * (OFF_ROLE + (1 - OFF_ROLE) * used);
    raw.push([k as AttrKey, w]);
    total += w;
  }
  const out = raw.map(([k, w]) => [k, w / total] as [AttrKey, number]);
  byDim[side] = out;
  return out;
}

// ─────────────────────────────────────────────────────────────── seeding the attributes a player does not have yet

/** The attributes added after schema 14; every one is derived from the original twenty plus role, age and height. */
type Mix = readonly (readonly [AttrKey, number])[];

/** Each new attribute as a blend of the old ones. Rows sum to 1, so a derived value sits where its parents do. */
const MIX: Partial<Record<AttrKey, Mix>> = {
  agility: [["acceleration", 0.45], ["dribbling", 0.25], ["pace", 0.15], ["firstTouch", 0.15]],
  balance: [["strength", 0.25], ["composure", 0.25], ["firstTouch", 0.2], ["agility", 0.3]],
  jumping: [["heading", 0.5], ["strength", 0.3], ["acceleration", 0.2]],
  technique: [["firstTouch", 0.3], ["dribbling", 0.25], ["passing", 0.2], ["finishing", 0.1], ["longShots", 0.1], ["crossing", 0.05]],
  offBall: [["positioning", 0.35], ["finishing", 0.2], ["acceleration", 0.2], ["vision", 0.1], ["composure", 0.15]],
  creativity: [["vision", 0.45], ["dribbling", 0.2], ["passing", 0.15], ["firstTouch", 0.1], ["longShots", 0.1]],
  marking: [["tackling", 0.45], ["positioning", 0.4], ["strength", 0.15]],
  interceptions: [["positioning", 0.45], ["vision", 0.25], ["tackling", 0.2], ["composure", 0.1]],
  decisions: [["composure", 0.35], ["vision", 0.3], ["passing", 0.15], ["positioning", 0.2]],
  anticipation: [["positioning", 0.35], ["vision", 0.25], ["composure", 0.2], ["tackling", 0.1], ["acceleration", 0.1]],
  workRate: [["stamina", 0.6], ["tackling", 0.15], ["strength", 0.1], ["composure", 0.15]],
  oneOnOnes: [["reflexes", 0.35], ["command", 0.25], ["diving", 0.2], ["handling", 0.1], ["composure", 0.1]],
};

/** A goalkeeper's mental attributes come from his own game, not from the outfield skills he barely has. */
const MIX_GK: Partial<Record<AttrKey, Mix>> = {
  decisions: [["composure", 0.5], ["command", 0.3], ["positioning", 0.2]],
  anticipation: [["positioning", 0.4], ["command", 0.3], ["reflexes", 0.3]],
};

/** Spread of the personal variation around the blend (temperament varies more than technique does). */
const SPREAD: Partial<Record<AttrKey, number>> = {
  agility: 3.5, balance: 4, jumping: 3.5, technique: 3, offBall: 4.5, creativity: 4.5, marking: 4, interceptions: 4,
  decisions: 4.5, anticipation: 4, workRate: 6, aggression: 8, oneOnOnes: 4,
};

/** What a role tends to be, beyond what the old attributes already say: a centre-back is better at marking than his tackling alone implies. */
const ROLE_BIAS: Record<Position, Partial<Record<AttrKey, number>>> = {
  GK: { decisions: 2, anticipation: 2 },
  CB: { marking: 5, interceptions: 3, jumping: 3, aggression: 4, workRate: -2, offBall: -12, creativity: -10, technique: -3, decisions: 2, anticipation: 2 },
  RB: { marking: 3, interceptions: 1, workRate: 3, aggression: 1, offBall: -4, creativity: -3, technique: -1 },
  LB: { marking: 3, interceptions: 1, workRate: 3, aggression: 1, offBall: -4, creativity: -3, technique: -1 },
  DM: { marking: 4, interceptions: 5, workRate: 3, aggression: 5, offBall: -8, creativity: -4, technique: -1, decisions: 3, anticipation: 3, agility: -2 },
  CM: { marking: -1, interceptions: 1, workRate: 4, aggression: 1, offBall: -3, creativity: 1, technique: 2, decisions: 2, anticipation: 2 },
  AM: { marking: -8, interceptions: -6, workRate: -1, aggression: -3, offBall: 3, creativity: 5, technique: 4, agility: 3, decisions: 1, anticipation: 1 },
  RW: { marking: -10, interceptions: -8, aggression: -3, offBall: 2, creativity: 3, technique: 2, agility: 3, decisions: -1 },
  LW: { marking: -10, interceptions: -8, aggression: -3, offBall: 2, creativity: 3, technique: 2, agility: 3, decisions: -1 },
  ST: { marking: -14, interceptions: -12, offBall: 4, creativity: -2, jumping: 2, balance: 1 },
};

/** Habits a player already has leave a mark on the attributes behind them. Scaled by how established the trait is. */
export const TRAIT_LEAN: Record<string, Partial<Record<AttrKey, number>>> = {
  pressing_machine: { workRate: 8, aggression: 4, anticipation: 3 },
  midfield_engine: { workRate: 7 },
  relentless_runner: { workRate: 6 },
  box_to_box: { workRate: 5 },
  ball_hunter: { aggression: 7, workRate: 3, interceptions: 2 },
  aggressive: { aggression: 8 },
  clean_tackler: { aggression: -5, marking: 2 },
  reckless_tackler: { aggression: 9, decisions: -4 },
  card_magnet: { aggression: 8, decisions: -3 },
  hot_head: { aggression: 6 },
  man_marker: { marking: 9, aggression: 2 },
  defensive_leader: { marking: 3, decisions: 3, anticipation: 3 },
  lane_reader: { interceptions: 9, anticipation: 6 },
  cover_defender: { anticipation: 5, interceptions: 3, marking: 2 },
  recovery_defender: { anticipation: 4, workRate: 3 },
  front_foot: { aggression: 5, anticipation: 3, marking: 2 },
  anchor: { marking: 3, interceptions: 5, decisions: 3 },
  defensive_screen: { interceptions: 6, marking: 4 },
  last_line: { aggression: 3, marking: 3 },
  aerial_dominator: { jumping: 8 },
  aerial_presence: { jumping: 7, balance: 2 },
  set_piece_threat: { jumping: 5 },
  target_forward: { jumping: 6, balance: 3 },
  hold_up: { balance: 7 },
  strong_on_ball: { balance: 7 },
  press_resistant: { balance: 6, decisions: 3 },
  close_control: { agility: 4, balance: 3, technique: 4 },
  isolation_dribbler: { agility: 6, balance: 3 },
  direct_winger: { agility: 4 },
  flair: { creativity: 7, technique: 5, agility: 3 },
  creative: { creativity: 8 },
  creative_spark: { creativity: 7, agility: 2 },
  playmaker: { creativity: 4, decisions: 5 },
  advanced_creator: { creativity: 7 },
  killer_pass: { creativity: 6, decisions: 3 },
  through_ball_specialist: { creativity: 5, decisions: 2 },
  line_breaker: { creativity: 5, decisions: 3 },
  free_roamer: { creativity: 5, offBall: 3 },
  half_space: { offBall: 5, creativity: 3 },
  inverted_creator: { creativity: 4 },
  tempo_controller: { decisions: 6, technique: 3 },
  metronome: { decisions: 5, technique: 3 },
  deep_controller: { decisions: 5, interceptions: 3 },
  one_touch_passer: { technique: 4, decisions: 3 },
  switcher: { technique: 4, creativity: 2 },
  long_pass_specialist: { technique: 5, creativity: 2 },
  outside_foot: { technique: 7, creativity: 3 },
  finesse_finisher: { technique: 7 },
  distance_shooter: { technique: 3 },
  dead_ball_specialist: { technique: 8 },
  set_piece_specialist: { technique: 7 },
  crossing_specialist: { technique: 4 },
  early_crosser: { technique: 3, decisions: 2 },
  clinical_finisher: { decisions: 4, offBall: 3 },
  poacher: { offBall: 8, anticipation: 5 },
  box_predator: { offBall: 7, anticipation: 4 },
  second_striker: { offBall: 7, anticipation: 3 },
  late_box_runner: { offBall: 7, workRate: 3 },
  advanced_runner: { offBall: 7, anticipation: 3 },
  channel_runner: { offBall: 6, workRate: 3 },
  back_post_threat: { offBall: 6, jumping: 3 },
  counter_attack_threat: { offBall: 4, anticipation: 3 },
  one_on_one_runner: { offBall: 5 },
  speed_runner: { agility: 2 },
  transition_specialist: { anticipation: 5, workRate: 3 },
  explosive_starter: { agility: 3 },
  selfless: { workRate: 4, decisions: 2 },
  selfish: { decisions: -3 },
  poor_decision_maker: { decisions: -9 },
  holds_ball_too_long: { decisions: -6 },
  overcomplicates_play: { decisions: -5, creativity: 3 },
  poor_concentration: { anticipation: -7, marking: -3 },
  error_prone: { decisions: -5, anticipation: -4 },
  poor_positioning: { anticipation: -6, marking: -4, interceptions: -4 },
  defensive_liability: { marking: -6, interceptions: -4 },
  tires_easily: { workRate: -6 },
  risky_defender: { aggression: 4, decisions: -3 },
  vulnerable_under_press: { balance: -6, decisions: -3 },
  composed: { decisions: 3 },
  rushes_off_line: { decisions: -4 },
  sweeper_keeper: { anticipation: 8, oneOnOnes: 8 },
  one_on_one_specialist: { oneOnOnes: 10 },
  shot_stopper: { oneOnOnes: 4 },
  cross_commander: { decisions: 3 },
  build_up_keeper: { decisions: 5 },
  quick_distributor: { decisions: 3, anticipation: 3 },
};

/** Fixed per-trait stage scaling: a trait barely owned counts about half, a signature one in full. */
const stageScale = (xp: number) => Math.min(1, 0.5 + xp / 320);

/** The typical aggression of a player at his own level before role and temperament are added. */
const AGGRESSION_BASE = 54;

export interface SeedContext {
  position: Position;
  /** His overall under the original twenty attributes: what the relative traits (aggression) are measured against. */
  level: number;
  age: number;
  height: number;
  /** Hidden professionalism, 0–100 (0 is read as unknown → 55). Work rate follows it a little. */
  professionalism?: number;
  traits?: readonly { id: string; xp: number }[];
  /** An aspiration: leans the new attributes it names, a point or two. */
  focusAttrs?: Readonly<Partial<Record<AttrKey, number>>>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Fills in the attributes `a` lacks (any key in ADDED order that is undefined) from the ones it has. Deterministic given the
 * `noise` draws, which callers take from a per-player seeded stream. The result is not yet fitted to an overall: see fitToOverall.
 */
export function seedAddedAttributes(a: Attributes, ctx: SeedContext, noise: () => number, only?: readonly AttrKey[]): void {
  const tallness = ((Number.isFinite(ctx.height) ? ctx.height : 182) - 182) / 10;
  const prof = ctx.professionalism && ctx.professionalism > 0 ? ctx.professionalism : 55;
  const level = ctx.level;
  const bias = ROLE_BIAS[ctx.position];
  const order: AttrKey[] = ["agility", "balance", "jumping", "technique", "offBall", "creativity", "marking", "interceptions", "decisions", "anticipation", "workRate", "aggression", "oneOnOnes"];
  for (const k of order) {
    if (only && !only.includes(k)) continue;
    const mix = (ctx.position === "GK" ? MIX_GK[k] : undefined) ?? MIX[k] ?? [];
    let v = 0;
    for (const [src, w] of mix) v += (a[src] ?? 50) * w;
    // Temperament does not rise with quality: aggression is a player's bite relative to his own level, so good and ordinary sides
    // are equally combative on average (and elite players are not simply dirtier).
    if (k === "aggression") v = AGGRESSION_BASE + 0.45 * ((a.tackling ?? level) - level) + 0.35 * ((a.strength ?? level) - level) - 0.2 * ((a.composure ?? level) - level);
    v += bias[k] ?? 0;
    // Only a goalkeeper has one-on-one skill; everyone else keeps the low, unused figure the other goalkeeping slots always had.
    if (k === "oneOnOnes" && ctx.position !== "GK") v = 11;
    if (k === "jumping") v += tallness * 3.5;
    if (k === "agility") v -= tallness * 2.5;
    if (k === "balance") v -= tallness * 1.5;
    if (k === "workRate") v += (prof - 55) * 0.2;
    if (k === "decisions" || k === "anticipation") v += clamp((ctx.age - 25) * 0.5, -4, 5);
    if (k === "aggression") v -= clamp((ctx.age - 28) * 0.3, 0, 3);
    for (const t of ctx.traits ?? []) v += (TRAIT_LEAN[t.id]?.[k] ?? 0) * stageScale(t.xp);
    v += (ctx.focusAttrs?.[k] ?? 0) * 2;
    v += noise() * (SPREAD[k] ?? 4);
    a[k] = clamp(Math.round(v * 10) / 10, 1, 99);
  }
}

/** Overall under the current model, unrounded. */
export const overallRaw = (attrs: Readonly<Partial<Record<AttrKey, number>>>, position: Position): number => weightedMean(attrs, POSITION_WEIGHTS[position]);

/**
 * Moves only the given attributes (those that carry weight in the position) so the role overall equals `target`, keeping the
 * differences between them. This is what makes the expansion overall-neutral: the old attributes are never touched.
 */
export function fitToOverall(attrs: Attributes, position: Position, target: number, movable: readonly AttrKey[]): void {
  const w = POSITION_WEIGHTS[position];
  const keys = movable.filter((k) => (w[k] ?? 0) > 0);
  if (!keys.length) return;
  const total = Object.values(w).reduce((s, x) => s + (x ?? 0), 0);
  for (let i = 0; i < 8; i++) {
    const diff = target - overallRaw(attrs, position);
    if (Math.abs(diff) < 0.05) break;
    // Attributes at a bound cannot move, so the share that can is recomputed each pass.
    const free = keys.filter((k) => (diff > 0 ? attrs[k] < 99 : attrs[k] > 1));
    const share = free.reduce((s, k) => s + (w[k] ?? 0), 0) / total;
    if (share <= 0) break;
    const shift = diff / share;
    for (const k of free) attrs[k] = clamp(Math.round((attrs[k] + shift) * 10) / 10, 1, 99);
  }
}

/** Keys of the attributes that were added after schema 14. */
export const ADDED_KEYS: readonly AttrKey[] = ["agility", "balance", "jumping", "technique", "offBall", "creativity", "marking", "interceptions", "decisions", "anticipation", "workRate", "aggression", "oneOnOnes"];

/** The groups to show for a position: a goalkeeper sees goalkeeping plus the few shared attributes his role uses; an outfielder sees everything but goalkeeping. */
export function groupsFor(position: Position): { label: string; keys: AttrKey[] }[] {
  const w = POSITION_WEIGHTS[position];
  if (position === "GK") {
    return ATTR_GROUPS.map((g) => ({ label: g.label, keys: g.keys.filter((k) => (w[k] ?? 0) > 0) })).filter((g) => g.keys.length).sort((a, b) => (a.label === "Goalkeeping" ? -1 : b.label === "Goalkeeping" ? 1 : 0));
  }
  return ATTR_GROUPS.filter((g) => g.label !== "Goalkeeping");
}
