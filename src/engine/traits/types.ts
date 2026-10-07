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
  | "chanceCross" | "chanceThrough" | "chanceOpen" | "intercept" | "block" | "save1v1" | "claim" | "lateGoal";

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
}

/** Keys that are additive; everything else multiplies. */
export const ADDITIVE_FX: ReadonlySet<keyof MatchFx> = new Set<keyof MatchFx>([
  "freqHeader", "freqLong", "freq1v1", "teamMid", "teamAtt", "teamDef", "bigMatch", "clutch", "composure", "fast",
]);

/** Keys describing how WELL something is done: they scale with the player's attributes. Everything else is preference. */
export const EFFECT_FX: ReadonlySet<keyof MatchFx> = new Set<keyof MatchFx>([
  "xgOpen", "xgHeader", "xgLong", "xg1v1", "xgFree", "xgPen", "xgCreated", "save", "save1v1", "claim", "penSave",
  "zoneMid", "zoneAtt", "zoneDef", "composure", "teamMid", "teamAtt", "teamDef",
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
}

/** What a personality trait can be derived from. */
export interface DeriveInput {
  hidden: import("../types").Hidden;
  attrs: import("../types").Attributes;
  age: number;
  reputation: number;
  /** Seasons at the current club (0 when unknown). */
  tenure: number;
}

export interface AttrReq {
  attr: AttrKey;
  min: number;
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
