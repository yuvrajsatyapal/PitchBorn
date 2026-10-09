/**
 * Trait data on load. Saves from earlier versions (and the odd corrupted one) must always open, and a player's established
 * traits must never be re-rolled by loading: this only repairs what is invalid and, once on upgrade, adds the record- and
 * temperament-based traits the earlier catalogue could not express.
 */
import { overallFor } from "../players/attributes";
import { NO_FOCUS, isValidFocus } from "../players/focus";
import { r1 } from "../rng";
import type { GameState, OwnedTrait, Player } from "../types";
import { derivedTraits } from "./assign";
import { TRAIT_BY_ID } from "./registry";
import { conflictWith, hasRoom } from "./rules";
import { cleanStay } from "./stay";
import { clubTenure, trackClub } from "./tenure";
import { STAGE_XP } from "./types";

/** Nobody carries more than this, whatever an old save or a bug put there. */
export const HARD_TRAIT_CAP = 14;

function cleanTraits(list: unknown): OwnedTrait[] {
  if (!Array.isArray(list)) return [];
  const best = new Map<string, OwnedTrait>();
  for (const t of list as Partial<OwnedTrait>[]) {
    if (!t || typeof t.id !== "string" || !TRAIT_BY_ID.has(t.id)) continue;
    const xp = Number(t.xp);
    if (!Number.isFinite(xp)) continue;
    const since = Number.isFinite(Number(t.since)) ? Number(t.since) : 0;
    const clean = { id: t.id, xp: r1(Math.min(STAGE_XP.max, Math.max(0, xp))), since };
    const have = best.get(t.id);
    if (!have || clean.xp > have.xp) best.set(t.id, clean);
  }
  const out = [...best.values()];
  // Two traits that cannot coexist: the stronger stays.
  out.sort((a, b) => b.xp - a.xp);
  const kept: OwnedTrait[] = [];
  for (const t of out) {
    const def = TRAIT_BY_ID.get(t.id);
    if (def && conflictWith(def, kept.map((k) => k.id)) === "exclusive") continue;
    kept.push(t);
  }
  return kept.slice(0, HARD_TRAIT_CAP);
}

/** A development focus has to be one this position can choose. Anything else, or an NPC's explicit "none", is no preference (absent); the user keeps an explicit one. */
function cleanFocus(p: Player): void {
  if (p.focus === undefined) return;
  if (!isValidFocus(p.position, p.focus)) p.focus = p.isUser ? NO_FOCUS : undefined;
  if (p.focus === undefined || (!p.isUser && p.focus === NO_FOCUS)) delete p.focus;
}

export function sanitizeTraits(state: GameState): void {
  for (const p of Object.values(state.players ?? {})) {
    if (p.traits !== undefined) p.traits = cleanTraits(p.traits);
    if (p.traits && !p.traits.length) delete p.traits;
    if (p.traitProgress) {
      for (const k of Object.keys(p.traitProgress)) {
        const v = p.traitProgress[k];
        if (!TRAIT_BY_ID.has(k) || !Number.isFinite(v) || v <= 0) delete p.traitProgress[k];
      }
      if (!Object.keys(p.traitProgress).length) delete p.traitProgress;
    }
    cleanStay(p);
    cleanFocus(p);
    const cs = p.clubSince;
    if (cs && (typeof cs.clubId !== "string" || !Number.isFinite(cs.season) || cs.clubId !== p.clubId)) delete p.clubSince;
  }
  if (state.user && !Array.isArray(state.user.traitLog)) state.user.traitLog = [];
}

/**
 * Upgrade step: give every NPC the temperament and record-based traits his profile and career already imply, and date
 * his stay at his club. Deterministic (derived from the player, never a draw), silent, and only ever adds.
 */
export function seedDerivedTraits(state: GameState): void {
  for (const p of Object.values(state.players ?? {})) {
    if (p.virtual || p.retired) continue;
    trackClub(p, state.season);
    if (p.isUser) continue;
    seedOne(state, p);
  }
}

function seedOne(state: GameState, p: Player): void {
  const age = state.season - p.birthYear;
  const wanted = derivedTraits(p, age, state.season, clubTenure(p, state.season), { captain: !!p.clubId && state.clubs[p.clubId]?.captain === p.id });
  if (!wanted.length) return;
  const traits = (p.traits ??= []);
  const ovr = overallFor(p.attrs, p.position);
  for (const w of wanted) {
    const def = TRAIT_BY_ID.get(w.id);
    if (!def || traits.some((t) => t.id === w.id)) continue;
    if (conflictWith(def, traits.map((t) => t.id)) || !hasRoom(def, traits, ovr, age)) continue;
    traits.push(w);
  }
  if (!traits.length) delete p.traits;
}
