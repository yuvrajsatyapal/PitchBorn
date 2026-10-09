/**
 * Pitchborn player traits. Attributes say HOW GOOD a player is; traits say HOW HE TENDS TO PLAY.
 * Traits mostly change what a player *chooses* to do (selection weights, chance frequencies);
 * where they also change how well something is done, that effect is small and scaled by the
 * player's underlying attributes, so a trait can never turn a poor player into an elite one.
 */
import type { AttrKey, Position, TrainingFocus, TraitId } from "../types";

export type TraitCategory = "playstyle" | "technical" | "mental" | "physical" | "personality";

/** Kinds of evidence a match (or a season) can give towards a trait. */
export type SignalKey =
  // from the match line
  | "goals" | "assists" | "shots" | "keyPasses" | "tackles" | "saves" | "cleanSheet" | "full90" | "highRating" | "bigGame" | "yellow" | "red"
  // counted by the match engine
  | "shotOpen" | "goalOpen" | "shotHeader" | "goalHeader" | "shotLong" | "goalLong" | "shot1v1" | "goal1v1"
  | "chanceCross" | "chanceThrough" | "chanceOpen" | "intercept" | "block" | "save1v1" | "claim" | "lateGoal"
  // a keeper starting his side's attacks: over the top, or short and patient
  | "launch" | "buildUp"
  // counted from the whole match result (see develop.ts)
  | "comeback";

/** The match-engine levers a trait can pull. Missing = neutral (×1, or +0 for additive keys). */
export interface MatchFx {
  // ── preferences: who does what (multiplies selection weight) ──
  shoot?: number; shootHeader?: number; shootLong?: number; shoot1v1?: number;
  create?: number; createCross?: number; createThrough?: number; createOpen?: number;
  tackle?: number; intercept?: number; foul?: number; card?: number;
  // ── preferences: how often a kind of chance arises for the attacking side (additive, summed over the XI) ──
  freqHeader?: number; freqLong?: number; freq1v1?: number;
  // ── when defending (multiplies the opposition's chance frequency / quality, product over the XI) ──
  againstFreqHeader?: number; againstFreqLong?: number; againstFreq1v1?: number;
  againstXgOpen?: number; againstXgHeader?: number; againstXgLong?: number; againstXg1v1?: number;
  // ── effectiveness (small; scaled by how well the player's attributes support the trait) ──
  xgOpen?: number; xgHeader?: number; xgLong?: number; xg1v1?: number; xgFree?: number; xgPen?: number;
  /** Quality of the chances this player creates (multiplies their xG). */
  xgCreated?: number;
  /** Goalkeepers: multiplier on xG faced (lower = better). */
  save?: number; save1v1?: number; claim?: number; penSave?: number;
  zoneMid?: number; zoneAtt?: number; zoneDef?: number;
  // ── team-level nudges while on the pitch (additive fractions, e.g. 0.01 = +1%) ──
  teamMid?: number; teamAtt?: number; teamDef?: number;
  // ── mental / physical ──
  /** Width of the match-to-match form swing (×). */
  variance?: number;
  /** Extra effect in big matches (additive; ±1 ≈ ±5% shot quality per importance step). */
  bigMatch?: number;
  /** Extra effect late in a close game (additive). */
  clutch?: number;
  /** Extra effect in one-on-ones and penalties (additive). */
  composure?: number;
  /** Boost to zone strength over the first 20 minutes (additive fraction). */
  fast?: number;
  /** Energy drain per minute (×). */
  drain?: number;
  /** Injury risk (×). */
  injury?: number;
  // ── situational levers (all additive/multiplicative around neutral, so a side without them is unchanged) ──
  /** Defensive lapses: probability per opposition phase that a mistake hands them a chance (summed over the XI; never negative). */
  lapse?: number;
  /** Multiplies the quality of chances taken by the opposition's most dangerous finisher (man-marking). */
  againstStar?: number;
  /** Chance that winning the ball back turns straight into a counter-attack (summed over the XI). */
  counter?: number;
  /** Extra zone strength for 30 minutes after coming on from the bench (additive fraction). */
  subBoost?: number;
  /** Extra effect on shot quality while the team is behind (additive; ±1 ≈ ±6%). */
  trailing?: number;
  /** Card risk while the team is behind (×). */
  cardBehind?: number;
}

/** Keys that are additive; everything else multiplies. */
export const ADDITIVE_FX: ReadonlySet<keyof MatchFx> = new Set<keyof MatchFx>([
  "freqHeader", "freqLong", "freq1v1", "teamMid", "teamAtt", "teamDef", "bigMatch", "clutch", "composure", "fast",
  "lapse", "counter", "subBoost", "trailing",
]);

/** Keys describing how WELL something is done: they scale with the player's attributes. Everything else is preference. */
export const EFFECT_FX: ReadonlySet<keyof MatchFx> = new Set<keyof MatchFx>([
  "xgOpen", "xgHeader", "xgLong", "xg1v1", "xgFree", "xgPen", "xgCreated", "save", "save1v1", "claim", "penSave",
  "zoneMid", "zoneAtt", "zoneDef", "composure", "teamMid", "teamAtt", "teamDef", "againstStar", "trailing", "subBoost",
]);

/** How a trait shapes a player's career, relationships and decisions. All small; none is absolute. */
export interface CareerFx {
  /** Multiplier on training progress. */
  training?: number;
  /** Multiplier on how hard results swing morale. */
  moraleSwing?: number;
  /** Reluctance to leave the club (0–1). */
  loyalty?: number;
  /** Hunger for bigger things (0–1): readier to move up, restless at a small club. */
  ambition?: number;
  /** Follows the money (0–1). */
  money?: number;
  /** Reluctance to move to another country (0–1). */
  home?: number;
  /** Multiplier on reputation gained from performances, and on sponsorship value. */
  media?: number;
  /** Dressing-room authority (0–1): captaincy odds, teammate relationships. */
  leader?: number;
  /** Friction with managers (−1…1; positive = more arguments). */
  friction?: number;
  /** Settling at a new club or country (−1…1). */
  adapt?: number;
  /** Helps younger teammates develop (0–1). */
  mentor?: number;
  /** Teammate relationship drift per week (−1…1). */
  team?: number;
  /** Bounce-back after setbacks (0–1): softens losses and lifts a low mood. */
  resilience?: number;
  /** Sense of entitlement (−1…1): friction and a sour mood when the role is below the player's level. */
  ego?: number;
  /** Chance of media rows (0–1), in context: needs a profile and a poor spell. */
  controversy?: number;
  /** Difficulty in contract talks (0–1): clubs run out of patience sooner, and renewals are less likely. */
  contract?: number;
  /** Supporter relationship drift per week (−1…1). */
  fan?: number;
  /** Amplifies the media and relationship consequences of everything else (multiplier). */
  amp?: number;
}

/** What a personality trait can be derived from. */
export interface DeriveInput {
  hidden: import("../types").Hidden;
  attrs: import("../types").Attributes;
  age: number;
  reputation: number;
  /** Weak-foot rating (0–100). */
  weakFoot: number;
  /** Seasons at the current club (0 when unknown). */
  tenure: number;
  position: import("../types").Position;
  secondary: readonly import("../types").Position[];
  /** Career totals and per-season records (empty before any football has been played: a generated veteran has none). */
  career: import("../types").StatLine;
  history: readonly import("../types").SeasonRecord[];
  /** Injuries suffered in the career so far. */
  injuries: number;
  /** User only: supporter relationship (0–100) and the match-rating record. */
  supporters?: number;
  ratings?: { n: number; mean: number; sd: number };
  /** Whether the player is (or has been) club captain. */
  captain?: boolean;
}

export interface AttrReq {
  attr: AttrKey;
  min: number;
}

/** An attribute ceiling: a flaw only fits a player whose attribute is not already strong (a strong positioner is never "Poor Positioning"). */
export interface AttrCap {
  attr: AttrKey;
  max: number;
}

export type ConflictKind = "exclusive" | "unlikely";

export interface TraitDef {
  id: TraitId;
  name: string;
  /** One sentence on what it does in play (shown in tooltips). */
  blurb: string;
  category: TraitCategory;
  /** A flaw: a genuine trade-off or weakness. */
  flaw?: boolean;
  /** Positions that can develop it (primary position, or a secondary one at reduced weight). */
  positions: readonly Position[];
  /** Natural affinity per position (default 1). */
  affinity?: Partial<Record<Position, number>>;
  /** Attributes that make it work (their average sets how well the trait is executed). */
  core: readonly AttrKey[];
  /** Minimum attributes to acquire and to keep. */
  req?: readonly AttrReq[];
  /** Flaws: ceilings that must hold to acquire and keep it. A flaw fades as the attribute grows past them. */
  cap?: readonly AttrCap[];
  /**
   * Earned from a record rather than drawn: never part of a generated player's starting set or an NPC's random drift.
   * It appears only from evidence (match signals or a derived score) once the sample is large enough.
   */
  earned?: boolean;
  /** Minutes of career football needed before evidence can award it (sample size). */
  minMinutes?: number;
  /**
   * Tactical fit: how much the player's habits suit each style dial (−1…1; positive likes a high setting, negative a low one).
   * A manager weighs this lightly when picking the side; it never outweighs quality, fitness, form or position.
   */
  tactic?: Partial<Record<"pressing" | "tempo" | "directness", number>>;
  conflicts?: readonly { id: TraitId; kind: ConflictKind }[];
  /** 1 common … 4 very rare. Higher = slower to acquire and to reach signature. */
  rarity: number;
  /** Behavioural evidence: xp per unit of each signal. */
  signals?: Partial<Record<SignalKey, number>>;
  /** Training focuses that can reinforce it (only once a player already shows the behaviour). */
  trained?: readonly TrainingFocus[];
  match?: MatchFx;
  career?: CareerFx;
  /** Age after which reliance on athleticism fades: weakens by this many xp per year beyond it. */
  ageOut?: number;
  /** Where the player's game goes when this trait can no longer be sustained. */
  evolves?: readonly { to: TraitId; minAge: number }[];
  /** Personality traits: a 0–1 score from the player's profile; the trait starts if high enough. */
  derive?: (p: DeriveInput) => number;
  /** For retirement summaries: the noun for this kind of player ("inside forward"). */
  role?: string;
}

/** xp needed for each stage. Below `owned` a trait is only a tendency (progress), not yet part of the player. */
export const STAGE_XP = { owned: 30, established: 80, signature: 160, max: 240 } as const;
