/**
 * Who may have which trait: position eligibility, attribute requirements, conflicts and limits.
 * Pure functions over a player's identity so they work the same for the user, rivals and NPCs.
 */
import type { Attributes, OwnedTrait, Position, TraitId } from "../types";
import { overallFor } from "../players/attributes";
import { DRAW_LIFT, favours } from "../players/focus";
import { TRAIT_BY_ID, traitsForPosition } from "./registry";
import { stageOf, coreFit } from "./effects";
import { STAGE_XP, type ConflictKind, type TraitDef } from "./types";

export interface Identity {
  position: Position;
  secondary: readonly Position[];
  attrs: Attributes;
  traits?: readonly OwnedTrait[];
  /** The player's aspiration and how much of it is still alive: tilts which natural trait a draw favours, nothing more. */
  lift?: { focus: string; strength: number };
}

/** How naturally a position develops this trait: 1 primary, 0.5 secondary, 0 not at all (× affinity). */
export function positionWeight(id: Identity, def: TraitDef): number {
  const aff = (pos: Position) => def.affinity?.[pos] ?? 1;
  if (def.positions.includes(id.position)) return aff(id.position);
  for (const s of id.secondary) if (def.positions.includes(s)) return 0.5 * aff(s);
  return 0;
}

export function meetsRequirements(def: TraitDef, attrs: Attributes): boolean {
  return (!def.req || def.req.every((r) => attrs[r.attr] >= r.min)) && (!def.cap || def.cap.every((c) => attrs[c.attr] <= c.max));
}

/** Conflict between holding `owned` and acquiring `def` (symmetric). Exclusive blocks; unlikely makes it much harder. */
export function conflictWith(def: TraitDef, owned: readonly TraitId[]): ConflictKind | null {
  let found: ConflictKind | null = null;
  for (const id of owned) {
    const other = TRAIT_BY_ID.get(id);
    const a = def.conflicts?.find((c) => c.id === id)?.kind;
    const b = other?.conflicts?.find((c) => c.id === def.id)?.kind;
    if (a === "exclusive" || b === "exclusive") return "exclusive";
    if (a === "unlikely" || b === "unlikely") found = "unlikely";
  }
  return found;
}

const isStyle = (d: TraitDef) => d.category === "playstyle" || d.category === "technical";
const isMindBody = (d: TraitDef) => (d.category === "mental" || d.category === "physical") && !d.flaw;
const isPersonality = (d: TraitDef) => d.category === "personality" && !d.flaw;

export interface Limits {
  /** Playing traits (style + mind/body) together: a footballer is recognisable for a few things, not a long list. */
  playing: number;
  style: number;
  mindBody: number;
  personality: number;
  flaws: number;
  signature: number;
}

/** Soft ceilings on a footballer's identity: a recognisable game, not a pile of badges. */
export function limitsFor(ovr: number, age: number): Limits {
  const style = ovr < 62 ? 1 : ovr < 70 ? 2 : ovr < 78 ? 3 : ovr < 86 ? 4 : 5;
  const signature = age < 22 || ovr < 76 ? 0 : ovr < 84 ? 1 : 2;
  const playing = Math.max(1, (ovr < 62 ? 2 : ovr < 70 ? 3 : ovr < 78 ? 4 : ovr < 86 ? 5 : 6) - (age < 21 ? 1 : 0));
  return { playing, style, mindBody: 3, personality: 3, flaws: 2, signature };
}

export interface Counts {
  style: number;
  mindBody: number;
  personality: number;
  flaws: number;
  signature: number;
}

export function countTraits(traits: readonly OwnedTrait[] | undefined): Counts {
  const c: Counts = { style: 0, mindBody: 0, personality: 0, flaws: 0, signature: 0 };
  for (const t of traits ?? []) {
    const d = TRAIT_BY_ID.get(t.id);
    if (!d || t.xp < STAGE_XP.owned) continue;
    if (d.flaw) c.flaws++;
    else if (isStyle(d)) c.style++;
    else if (isMindBody(d)) c.mindBody++;
    else if (isPersonality(d)) c.personality++;
    if (stageOf(t.xp) === "signature") c.signature++;
  }
  return c;
}

/** Whether another trait of this kind fits within the player's limits. */
export function hasRoom(def: TraitDef, traits: readonly OwnedTrait[] | undefined, ovr: number, age: number): boolean {
  const c = countTraits(traits);
  const l = limitsFor(ovr, age);
  if (def.flaw) return c.flaws < l.flaws;
  if (isStyle(def)) return c.style < l.style && c.style + c.mindBody < l.playing;
  if (isMindBody(def)) return c.mindBody < l.mindBody && c.style + c.mindBody < l.playing;
  return c.personality < l.personality;
}

export function canBeSignature(traits: readonly OwnedTrait[] | undefined, ovr: number, age: number, currentlySignature: boolean): boolean {
  const l = limitsFor(ovr, age);
  return currentlySignature || countTraits(traits).signature < l.signature;
}

/**
 * Natural candidates for a player: eligible by position, attributes and not blocked by what he already has.
 * `draw` is set when picking at random (creation, NPC drift): earned traits are then left out.
 */
export function candidateTraits(id: Identity, draw = false): { def: TraitDef; weight: number }[] {
  const owned = id.traits?.map((t) => t.id) ?? [];
  const pool = new Map<TraitId, TraitDef>();
  for (const pos of [id.position, ...id.secondary]) for (const d of traitsForPosition(pos)) pool.set(d.id, d);
  const out: { def: TraitDef; weight: number }[] = [];
  for (const def of pool.values()) {
    // Temperament comes from the profile, never from behaviour. Record-based traits (Comeback Specialist…) are never *drawn*,
    // but they are candidates for match evidence.
    if (owned.includes(def.id) || def.derive || def.category === "personality" || (draw && def.earned)) continue;
    const pw = positionWeight(id, def);
    if (pw <= 0 || !meetsRequirements(def, id.attrs)) continue;
    const fit = coreFit(def, id.attrs);
    if (fit < 0.45) continue;
    const conflict = conflictWith(def, owned);
    if (conflict === "exclusive") continue;
    const lift = id.lift && favours(id.lift.focus, def.id) ? 1 + DRAW_LIFT * id.lift.strength : 1;
    out.push({ def, weight: pw * fit * fit * lift * (conflict === "unlikely" ? 0.2 : 1) / Math.pow(def.rarity, 1.1) });
  }
  return out;
}

export const overallOf = (id: Identity): number => overallFor(id.attrs, id.position);
