/**
 * Giving a player the attributes added in schema 15 (agility, balance, jumping, technique, off-the-ball movement, creativity, marking,
 * interceptions, decisions, anticipation, work rate, aggression, and a keeper's one-on-ones).
 *
 * Used when an older save is opened. It never regenerates anyone: the original twenty attributes, potential, traits, identity and
 * history are untouched. The new ones are derived from what the player already is (his attributes, position, age, height,
 * temperament, habits and aspiration) with a variation seeded by his id, then fitted so his overall is what it was. It is deterministic
 * and idempotent: a player who already has all of them is left alone, and running it twice gives the same player.
 */
import { Rng } from "../rng";
import type { AttrKey, GameState, Player } from "../types";
import { ADDED_ATTRS } from "../types";
import { TRAIT_BY_ID } from "../traits/registry";
import { focusFor } from "./focus";
import { ADDED_KEYS, fitToOverall, legacyOverall, seedAddedAttributes } from "./model";

const has = (p: Player, k: AttrKey) => Number.isFinite((p.attrs as Partial<Record<AttrKey, number>>)[k]);

export function lacksAddedAttributes(p: Player): boolean {
  return ADDED_ATTRS.some((k) => !has(p, k));
}

/** Returns true if anything was added. */
export function expandAttributes(p: Player, season: number): boolean {
  const missing = ADDED_KEYS.filter((k) => !has(p, k));
  if (!missing.length) return false;
  // The overall he had before: measured on the original twenty only, so a partly filled record is judged the same way.
  const target = legacyOverall(p.attrs, p.position);
  const rng = Rng.fromSeed(`attrs15:${p.id}`);
  const focus = focusFor(p.position, p.focus);
  seedAddedAttributes(
    p.attrs,
    { position: p.position, level: target, age: season - p.birthYear, height: p.height, professionalism: p.hidden?.professionalism, traits: p.traits, focusAttrs: focus?.attrs },
    () => rng.normal(0, 1),
    missing,
  );
  // A trait he already holds must still be one he qualifies for: lift any new attribute it requires to its minimum, then fit the rest
  // around those, so the overall is still what it was.
  const pinned = new Set<AttrKey>();
  for (const t of p.traits ?? []) {
    const def = TRAIT_BY_ID.get(t.id);
    for (const r of def?.req ?? []) {
      if (!missing.includes(r.attr) || p.attrs[r.attr] >= r.min) continue;
      p.attrs[r.attr] = Math.min(99, r.min);
      pinned.add(r.attr);
    }
  }
  fitToOverall(p.attrs, p.position, target, missing.filter((k) => !pinned.has(k)));
  // Fitting can pull an unpinned attribute under a floor again; those are lifted last (a fraction of a point of overall at most).
  for (const t of p.traits ?? []) for (const r of TRAIT_BY_ID.get(t.id)?.req ?? []) if (missing.includes(r.attr) && p.attrs[r.attr] < r.min) p.attrs[r.attr] = Math.min(99, r.min);
  return true;
}

export function expandAllAttributes(state: GameState): void {
  for (const p of Object.values(state.players ?? {})) expandAttributes(p, state.season);
}
