/**
 * Starting traits for a player (world generation, new youth, old saves). Deterministic: the
 * draws come from a generator seeded with the player's own identity, never from the world's
 * main random stream, so adding or changing traits cannot disturb match results.
 */
import { overallFor } from "../players/attributes";
import { Rng, clamp } from "../rng";
import type { Hidden, OwnedTrait, Player } from "../types";
import { STAGE_XP } from "./types";
import { TRAITS } from "./registry";
import { candidateTraits, canBeSignature, conflictWith, hasRoom, limitsFor, meetsRequirements } from "./rules";
import type { DeriveInput } from "./types";

type Subject = Pick<Player, "id" | "position" | "secondary" | "attrs" | "hidden" | "birthYear" | "reputation" | "isUser"> & { traits?: OwnedTrait[] };

const sum = (a: Record<string, number>) => Object.values(a).reduce((s, v) => s + v, 0);

export function traitRng(p: Subject): Rng {
  return Rng.fromSeed(`traits:${p.id}:${p.birthYear}:${Math.round(sum(p.attrs))}`);
}

/** Starting xp for a derived (personality) trait from how strongly the profile points to it. */
function derivedXp(score: number, age: number, canSign: boolean): number {
  if (score >= 1 && age >= 25 && canSign) return STAGE_XP.signature + 4;
  if (score >= 0.6) return STAGE_XP.established + 8;
  return STAGE_XP.owned + 4 + Math.round(clamp(score, 0, 0.6) * 20);
}

/** Traits implied by a player's temperament and profile. These do not need on-pitch evidence. */
export function derivedTraits(p: Subject, age: number, season: number, tenure = 0): OwnedTrait[] {
  const input: DeriveInput = { hidden: p.hidden as Hidden, attrs: p.attrs, age, reputation: p.reputation, tenure };
  const ovr = overallFor(p.attrs, p.position);
  const out: OwnedTrait[] = [];
  const scored = TRAITS.filter((d) => d.derive)
    .map((def) => ({ def, score: def.derive!(input) }))
    .filter((x) => x.score >= (x.def.flaw ? 0.35 : 0.25) && (!x.def.req || meetsRequirements(x.def, p.attrs)))
    .sort((a, b) => b.score - a.score);
  for (const { def, score } of scored) {
    if (conflictWith(def, out.map((t) => t.id))) continue;
    if (!hasRoom(def, out, ovr, age)) continue;
    // Behavioural personality traits that matter on the pitch need a playing role (a young prospect has not earned a reputation).
    out.push({ id: def.id, xp: derivedXp(score, age, canBeSignature(out, ovr, age, false) && !def.flaw), since: season });
  }
  return out;
}

/** Number of playing-style traits a player of this level and age would plausibly show. */
function styleCount(ovr: number, age: number, rng: Rng): number {
  const youth = age <= 18 ? -1.4 : age <= 20 ? -0.7 : 0;
  const n = (ovr - 56) / 8.5 + youth + rng.normal(0, 0.55);
  return clamp(Math.round(n), 0, limitsFor(ovr, age).style);
}

/** Full starting set for an NPC (or a generated youngster). */
export function initialTraits(p: Subject, season: number, opts: { tier?: "npc" | "user" } = {}): OwnedTrait[] {
  const age = season - p.birthYear;
  const ovr = overallFor(p.attrs, p.position);
  const rng = traitRng(p);
  const out = derivedTraits(p, age, season);
  if (opts.tier === "user") return out.slice(0, 3);
  // Playing style: weighted draws from what the position and attributes make natural.
  const want = styleCount(ovr, age, rng);
  for (let i = 0; i < want; i++) {
    const pool = candidateTraits({ ...p, traits: out }).filter((c) => !c.def.flaw && hasRoom(c.def, out, ovr, age));
    if (!pool.length) break;
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let r = rng.next() * total;
    let pick = pool[pool.length - 1];
    for (const c of pool) {
      r -= c.weight;
      if (r <= 0) {
        pick = c;
        break;
      }
    }
    // Stage: mostly emerging/established; signature is rare and needs a proven player.
    const strong = clamp((ovr - 72) / 22, 0, 1) * clamp((age - 20) / 8, 0.3, 1);
    const roll = rng.next();
    const signature = i === 0 && roll < 0.14 * strong && canBeSignature(out, ovr, age, false);
    const xp = signature ? STAGE_XP.signature + rng.int(0, 25) : roll < 0.15 + 0.5 * strong ? STAGE_XP.established + rng.int(0, 60) : STAGE_XP.owned + rng.int(0, 40);
    out.push({ id: pick.def.id, xp, since: season - rng.int(0, Math.max(0, Math.min(6, age - 18))) });
  }
  // A flaw now and then: genuine trade-offs, never a pile of them.
  if (rng.chance(0.22)) {
    const flaws = candidateTraits({ ...p, traits: out }).filter((c) => c.def.flaw && hasRoom(c.def, out, ovr, age));
    if (flaws.length) out.push({ id: rng.pick(flaws).def.id, xp: STAGE_XP.owned + rng.int(0, 35), since: season });
  }
  return out;
}
