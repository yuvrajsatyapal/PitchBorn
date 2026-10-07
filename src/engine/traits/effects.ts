/**
 * Turning a player's traits into numbers the engines can use.
 * Preferences (who shoots, who crosses) apply at the trait's stage strength. Effectiveness
 * (how well it is done) is additionally scaled by how well the player's attributes support
 * the trait, so the same trait helps a gifted player and barely helps a poor one.
 */
import type { Attributes, OwnedTrait, Player, TraitId, TraitStage } from "../types";
import { clamp } from "../rng";
import { TRAIT_BY_ID } from "./registry";
import { ADDITIVE_FX, EFFECT_FX, STAGE_XP, type CareerFx, type MatchFx, type TraitDef } from "./types";

export const STAGE_STRENGTH: Record<TraitStage, number> = { emerging: 0.5, established: 0.85, signature: 1.15 };
export const STAGE_LABEL: Record<TraitStage, string> = { emerging: "Emerging", established: "Established", signature: "Signature" };

export function stageOf(xp: number): TraitStage | null {
  return xp < STAGE_XP.owned ? null : xp < STAGE_XP.established ? "emerging" : xp < STAGE_XP.signature ? "established" : "signature";
}

/** 0.3–1: how well the player's attributes support what the trait asks of him. */
export function coreFit(def: TraitDef, attrs: Attributes): number {
  let f = 1;
  if (def.core.length) {
    let sum = 0;
    for (const k of def.core) sum += attrs[k];
    f = clamp((sum / def.core.length - 48) / 34, 0.3, 1);
  }
  if (def.req) for (const r of def.req) if (attrs[r.attr] < r.min) f *= 0.6;
  return f;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Merged match effects for a player, or undefined when none of his traits touches a match. */
export function resolveMatchFx(traits: readonly OwnedTrait[] | undefined, attrs: Attributes): MatchFx | undefined {
  if (!traits?.length) return undefined;
  const acc: Mutable<MatchFx> = {};
  let any = false;
  for (const t of traits) {
    const def = TRAIT_BY_ID.get(t.id);
    const stage = stageOf(t.xp);
    if (!def?.match || !stage) continue;
    const s = STAGE_STRENGTH[stage];
    const fit = coreFit(def, attrs);
    for (const k of Object.keys(def.match) as (keyof MatchFx)[]) {
      const v = def.match[k] as number;
      const strength = EFFECT_FX.has(k) ? s * fit : s;
      if (ADDITIVE_FX.has(k)) acc[k] = (acc[k] ?? 0) + v * strength;
      else acc[k] = (acc[k] ?? 1) * (1 + (v - 1) * strength);
      any = true;
    }
  }
  if (!any) return undefined;
  for (const k of Object.keys(acc) as (keyof MatchFx)[]) {
    const v = acc[k] as number;
    acc[k] = ADDITIVE_FX.has(k) ? clamp(v, -0.5, 0.6) : EFFECT_FX.has(k) ? clamp(v, 0.82, 1.2) : clamp(v, 0.4, 2.8);
  }
  return acc;
}

export interface CareerProfile {
  training: number;
  moraleSwing: number;
  media: number;
  loyalty: number;
  ambition: number;
  money: number;
  home: number;
  leader: number;
  friction: number;
  adapt: number;
  mentor: number;
  team: number;
}

export const NEUTRAL_CAREER: Readonly<CareerProfile> = { training: 1, moraleSwing: 1, media: 1, loyalty: 0, ambition: 0, money: 0, home: 0, leader: 0, friction: 0, adapt: 0, mentor: 0, team: 0 };
const MULT_CAREER: ReadonlySet<keyof CareerFx> = new Set<keyof CareerFx>(["training", "moraleSwing", "media"]);

/** Merged career-side effects (training, morale, loyalty, ambition…). Cheap: a handful of traits at most. */
export function careerProfile(p: Pick<Player, "traits">): CareerProfile {
  if (!p.traits?.length) return NEUTRAL_CAREER;
  const acc: Mutable<CareerProfile> = { ...NEUTRAL_CAREER };
  for (const t of p.traits) {
    const def = TRAIT_BY_ID.get(t.id);
    const stage = stageOf(t.xp);
    if (!def?.career || !stage) continue;
    const s = STAGE_STRENGTH[stage];
    for (const k of Object.keys(def.career) as (keyof CareerFx)[]) {
      const v = def.career[k] as number;
      if (MULT_CAREER.has(k)) acc[k as "training"] *= 1 + (v - 1) * s;
      else acc[k as "loyalty"] += v * s;
    }
  }
  acc.loyalty = clamp(acc.loyalty, 0, 1);
  acc.ambition = clamp(acc.ambition, 0, 1);
  acc.money = clamp(acc.money, 0, 1);
  acc.home = clamp(acc.home, 0, 1);
  acc.leader = clamp(acc.leader, 0, 1);
  acc.mentor = clamp(acc.mentor, 0, 1);
  acc.friction = clamp(acc.friction, -1, 1);
  acc.adapt = clamp(acc.adapt, -1, 1);
  acc.team = clamp(acc.team, -1, 1);
  return acc;
}

export function traitXp(p: Pick<Player, "traits">, id: TraitId): number {
  return p.traits?.find((t) => t.id === id)?.xp ?? 0;
}

export const hasTrait = (p: Pick<Player, "traits">, id: TraitId): boolean => traitXp(p, id) >= STAGE_XP.owned;

export function traitStage(p: Pick<Player, "traits">, id: TraitId): TraitStage | null {
  return stageOf(traitXp(p, id));
}

/** Match-engine injury risk multiplier from traits (Durable / Injury Prone). */
export function injuryTraitFactor(p: Pick<Player, "traits" | "attrs">): number {
  return resolveMatchFx(p.traits, p.attrs)?.injury ?? 1;
}
