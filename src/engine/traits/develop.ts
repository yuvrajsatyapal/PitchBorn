/**
 * How traits emerge, strengthen, weaken and evolve.
 *
 * - Match evidence (the user, and everyone in the user's own matches): the engine counts relevant
 *   actions; repeated, successful behaviour that the player's attributes support builds progress.
 * - Training reinforces behaviour a player already shows. It can never unlock a trait on its own.
 * - Season review (everyone): requirements slipping, age and disuse weaken traits; a trait that can
 *   no longer be sustained may evolve into a better-suited one. NPCs are handled here in one cheap
 *   annual pass using season stats as a proxy for behaviour.
 */
import type { PlayerLine } from "../match/engine";
import { overallFor } from "../players/attributes";
import { clamp, r1, Rng } from "../rng";
import type { GameState, OwnedTrait, Player, TraitEvent, TraitId, TrainingFocus } from "../types";
import { addNews } from "../world/helpers";
import { rememberIdentity } from "../memory/detect";
import { coreFit, stageOf } from "./effects";
import { TRAIT_BY_ID, TRAITS } from "./registry";
import { candidateTraits, canBeSignature, conflictWith, hasRoom, meetsRequirements } from "./rules";
import { derivedTraits } from "./assign";
import { STAGE_XP, type SignalKey, type TraitDef } from "./types";

const PER_MATCH_CAP = 3.5;
const TRAINING_BUDGET = 22;
const TRAINING_GATE = 6;
const REMOVE_BELOW = STAGE_XP.owned;

export interface MatchCtx {
  /** Match importance (1 normal … 3 final). */
  importance: number;
}

/** Evidence of what a player did in one match: line stats plus the engine's own action counts. */
export function signalValues(line: PlayerLine, ctx: MatchCtx): Partial<Record<SignalKey, number>> {
  const mins = Math.max(0, (line.minuteOff ?? 90) - line.minuteOn);
  const sig: Partial<Record<SignalKey, number>> = { ...(line.acts ?? {}) };
  sig.goals = line.goals;
  sig.assists = line.assists;
  sig.shots = line.shots;
  sig.keyPasses = line.keyPasses;
  sig.tackles = line.tackles;
  sig.saves = line.saves;
  sig.yellow = line.yellow;
  sig.red = line.red;
  sig.full90 = mins / 90;
  if (line.conceded === 0 && mins >= 60 && ["GK", "CB", "RB", "LB", "DM"].includes(line.slot)) sig.cleanSheet = 1;
  if (line.rating >= 7.4) sig.highRating = 1;
  if (ctx.importance >= 1.6 && line.rating >= 7.2) sig.bigGame = 1;
  return sig;
}

function logEvent(state: GameState, p: Player, e: Omit<TraitEvent, "season" | "turn">): void {
  if (!p.isUser) return;
  state.user.traitLog.push({ ...e, season: state.season, turn: state.turn });
  if (state.user.traitLog.length > 80) state.user.traitLog.shift();
}

function ageOf(state: GameState, p: Player): number {
  return state.season - p.birthYear;
}

/** Add a newly earned trait (if the player has room and no hard conflict). Returns true when added. */
export function gainTrait(state: GameState, p: Player, id: TraitId, xp: number, kind: TraitEvent["kind"] = "gained", from?: TraitId): boolean {
  const def = TRAIT_BY_ID.get(id);
  if (!def) return false;
  p.traits ??= [];
  if (p.traits.some((t) => t.id === id)) return false;
  const age = ageOf(state, p);
  const ovr = overallFor(p.attrs, p.position);
  if (conflictWith(def, p.traits.map((t) => t.id)) === "exclusive" || !hasRoom(def, p.traits, ovr, age)) return false;
  const capped = canBeSignature(p.traits, ovr, age, false) ? xp : Math.min(xp, STAGE_XP.signature - 1);
  p.traits.push({ id, xp: r1(capped), since: state.season });
  if (p.traitProgress) delete p.traitProgress[id];
  logEvent(state, p, { id, kind, stage: stageOf(capped) ?? "emerging", from });
  if (p.isUser) {
    const stage = stageOf(capped);
    addNews(state, { kind: "career", title: kind === "evolved" ? `Your game evolves: ${def.name}` : `A new side to your game: ${def.name}`, body: def.blurb, important: stage !== "emerging" });
    if (kind === "evolved") rememberIdentity(state, id, "evolved", from);
  }
  return true;
}

function removeTrait(state: GameState, p: Player, id: TraitId, kind: "lost" | "evolved" = "lost"): void {
  if (!p.traits) return;
  const i = p.traits.findIndex((t) => t.id === id);
  if (i < 0) return;
  const [t] = p.traits.splice(i, 1);
  // What was learned isn't forgotten overnight: it falls back to a tendency that can regrow.
  if (kind === "lost" && p.isUser) (p.traitProgress ??= {})[id] = Math.max(0, STAGE_XP.owned - 8);
  logEvent(state, p, { id, kind: kind === "lost" ? "lost" : "evolved", stage: stageOf(t.xp) ?? "emerging" });
}

/** Apply `gain` of evidence to one trait (owned or still a tendency). */
function applyEvidence(state: GameState, p: Player, def: TraitDef, gain: number): void {
  if (gain <= 0) return;
  const owned = p.traits?.find((t) => t.id === def.id);
  if (owned) {
    const before = stageOf(owned.xp);
    const age = ageOf(state, p);
    const ovr = overallFor(p.attrs, p.position);
    const ceiling = canBeSignature(p.traits, ovr, age, before === "signature") ? STAGE_XP.max : STAGE_XP.signature - 1;
    owned.xp = r1(Math.min(ceiling, owned.xp + gain * 0.5));
    const after = stageOf(owned.xp);
    if (after !== before && after) {
      logEvent(state, p, { id: def.id, kind: "upgraded", stage: after });
      if (p.isUser) {
        addNews(state, { kind: "career", title: `${def.name}: now ${after}`, body: def.blurb, important: after === "signature" });
        if (after === "signature") rememberIdentity(state, def.id, "signature");
      }
    }
    return;
  }
  const prog = (p.traitProgress ??= {});
  prog[def.id] = (prog[def.id] ?? 0) + gain;
  if (prog[def.id] >= STAGE_XP.owned) gainTrait(state, p, def.id, STAGE_XP.owned + (prog[def.id] - STAGE_XP.owned));
}

/** Behaviour evidence from one match. Run for the user and for everyone who played in the user's matches. */
export function recordMatchEvidence(state: GameState, p: Player, line: PlayerLine, ctx: MatchCtx): void {
  const sig = signalValues(line, ctx);
  const ownedIds = p.traits?.map((t) => t.id) ?? [];
  const seen = new Set<TraitId>();
  const consider = (def: TraitDef, conflictMul: number) => {
    if (!def.signals || seen.has(def.id)) return;
    seen.add(def.id);
    let ev = 0;
    for (const k of Object.keys(def.signals) as SignalKey[]) ev += (sig[k] ?? 0) * (def.signals[k] ?? 0);
    if (ev <= 0) return;
    const fit = coreFit(def, p.attrs) * (meetsRequirements(def, p.attrs) ? 1 : 0.5);
    const gain = (Math.min(ev, PER_MATCH_CAP) * (0.55 + 0.9 * fit) * conflictMul) / (0.8 + 0.2 * def.rarity);
    applyEvidence(state, p, def, gain);
  };
  for (const id of ownedIds) {
    const def = TRAIT_BY_ID.get(id);
    if (def) consider(def, 1);
  }
  for (const c of candidateTraits({ position: p.position, secondary: p.secondary, attrs: p.attrs, traits: p.traits })) {
    const conflict = conflictWith(c.def, ownedIds);
    consider(c.def, conflict === "unlikely" ? 0.3 : 1);
  }
}

/** Weekly training: reinforces behaviour the player already shows, within a seasonal budget. */
export function trainingTick(state: GameState, p: Player, focus: TrainingFocus, intensity: "light" | "normal" | "intense"): void {
  if (focus === "balanced" || focus === "recovery" || p.injury) return;
  const u = state.user;
  if (!u.traitTraining || u.traitTraining.season !== state.season) u.traitTraining = { season: state.season, used: {} };
  const used = u.traitTraining.used;
  const mult = intensity === "light" ? 0.6 : intensity === "intense" ? 1.3 : 1;
  const ownedIds = p.traits?.map((t) => t.id) ?? [];
  const defs: TraitDef[] = [];
  for (const id of ownedIds) {
    const d = TRAIT_BY_ID.get(id);
    if (d?.trained?.includes(focus)) defs.push(d);
  }
  for (const c of candidateTraits({ position: p.position, secondary: p.secondary, attrs: p.attrs, traits: p.traits })) {
    // Only behaviour already seen in matches can be trained: no behaviour, no progress.
    if (c.def.trained?.includes(focus) && (p.traitProgress?.[c.def.id] ?? 0) >= TRAINING_GATE && meetsRequirements(c.def, p.attrs)) defs.push(c.def);
  }
  for (const d of defs) {
    if ((used[d.id] ?? 0) >= TRAINING_BUDGET) continue;
    const gain = 0.32 * mult * (0.4 + 0.6 * coreFit(d, p.attrs));
    used[d.id] = (used[d.id] ?? 0) + gain;
    applyEvidence(state, p, d, gain);
  }
}

/** Gentle monthly fade of tendencies that are no longer being reinforced (tracked players). */
export function fadeProgress(p: Player): void {
  const prog = p.traitProgress;
  if (!prog) return;
  for (const k of Object.keys(prog)) {
    prog[k] *= 0.96;
    if (prog[k] < 1.5) delete prog[k];
  }
}

/** Season-end review: weakening, evolution, disuse; and the cheap proxy progression for NPCs. */
export function reviewTraits(state: GameState, p: Player, rng: Rng, tracked: boolean): void {
  const age = ageOf(state, p);
  const ovr = overallFor(p.attrs, p.position);
  let minutes = 0;
  for (const k in p.season) minutes += p.season[k].minutes;
  const traits = p.traits ?? [];
  const lost: OwnedTrait[] = [];
  for (const t of traits) {
    const def = TRAIT_BY_ID.get(t.id);
    if (!def) {
      lost.push(t);
      continue;
    }
    if (def.derive) continue; // temperament traits are re-derived below
    const before = stageOf(t.xp);
    if (!meetsRequirements(def, p.attrs)) t.xp -= 14;
    if (def.ageOut && age > def.ageOut) t.xp -= 8 * (age - def.ageOut);
    if (def.signals && minutes < 300) t.xp -= 5;
    // NPCs: a season of regular football stands in for the evidence the user's matches provide.
    if (!tracked && def.signals && minutes >= 1200 && meetsRequirements(def, p.attrs)) t.xp += 5 * coreFit(def, p.attrs) * (0.6 + rng.next() * 0.8);
    const ceiling = canBeSignature(traits, ovr, age, before === "signature") ? STAGE_XP.max : STAGE_XP.signature - 1;
    t.xp = r1(clamp(t.xp, 0, ceiling));
    const after = stageOf(t.xp);
    if (after !== before) {
      if (!after) lost.push(t);
      else if (p.isUser && (before === "signature" || (before === "established" && after === "emerging"))) logEvent(state, p, { id: t.id, kind: "weakened", stage: after });
    }
  }
  // Traits that can no longer be sustained may become something the player's game now suits.
  for (const t of lost) {
    const def = TRAIT_BY_ID.get(t.id);
    const oldXp = t.xp;
    removeTrait(state, p, t.id, "lost");
    if (!def?.evolves) continue;
    const next = def.evolves.find((e) => age >= e.minAge && TRAIT_BY_ID.has(e.to) && candidateFor(p, e.to));
    if (next && oldXp >= 12) gainTrait(state, p, next.to, Math.min(90, 34 + oldXp * 0.5), "evolved", t.id);
  }
  // Temperament follows the profile (reputation, age and so on).
  reviewDerived(state, p, age, ovr);
  // NPCs drift into new habits: a cheap stand-in for the evidence the user's own career provides.
  if (!p.isUser && !p.virtual && age <= 33 && rng.chance(0.2 + (minutes >= 1500 ? 0.12 : 0))) {
    const pool = candidateTraits({ position: p.position, secondary: p.secondary, attrs: p.attrs, traits: p.traits }).filter((c) => hasRoom(c.def, p.traits, ovr, age) && (!c.def.flaw || rng.chance(0.25)));
    if (pool.length) {
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
      gainTrait(state, p, pick.def.id, STAGE_XP.owned + rng.int(0, 12));
    }
  }
  if (tracked) fadeProgress(p);
  else if (p.traitProgress && !p.isUser) delete p.traitProgress;
}

function candidateFor(p: Player, id: TraitId): boolean {
  const def = TRAIT_BY_ID.get(id);
  if (!def) return false;
  if (!meetsRequirements(def, p.attrs)) return false;
  if (p.traits?.some((t) => t.id === id)) return false;
  return !def.positions || def.positions.includes(p.position) || p.secondary.some((s) => def.positions.includes(s));
}

/** Personality and temperament traits: appear, fade or strengthen as the profile (reputation, age) changes. */
export function reviewDerived(state: GameState, p: Player, age: number, ovr: number): void {
  const wanted = derivedTraits(p, age, state.season, p.clubId ? p.history.filter((h) => h.clubId === p.clubId).length + 1 : 0);
  const wantedIds = new Set(wanted.map((t) => t.id));
  p.traits ??= [];
  for (const w of wanted) {
    const have = p.traits.find((t) => t.id === w.id);
    if (!have) {
      if (hasRoom(TRAIT_BY_ID.get(w.id)!, p.traits, ovr, age)) gainTrait(state, p, w.id, w.xp);
    } else if (w.xp > have.xp) have.xp = r1(Math.min(w.xp, have.xp + 12));
  }
  for (const t of [...p.traits]) {
    const def = TRAIT_BY_ID.get(t.id);
    if (!def?.derive || wantedIds.has(t.id)) continue;
    // Reputation- and age-based traits can fade; temperament built into the profile is steadier.
    t.xp = r1(t.xp - 10);
    if (t.xp < REMOVE_BELOW) removeTrait(state, p, t.id, "lost");
  }
}

/** Season-end pass over every player (the user and tracked players get the full treatment, everyone else the cheap one). */
export function reviewAllTraits(state: GameState): void {
  const rng = Rng.fromSeed(`${state.seed}:trait-review:${state.season}`);
  for (const p of Object.values(state.players)) {
    if (p.retired || p.virtual) continue;
    reviewTraits(state, p, rng, !!p.isUser || !!p.traitProgress);
  }
}

/** All trait definitions (used by tests and the UI). */
export const ALL_TRAITS = TRAITS;
