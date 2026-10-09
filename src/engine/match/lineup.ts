import { overallFor, positionGroup } from "../players/attributes";
import { flankFitPenalty } from "../players/foot";
import type { Rng } from "../rng";
import { hasTrait, traitFit } from "../traits/effects";
import type { FormationId, Player, Position } from "../types";

export const FORMATIONS: Record<FormationId, Position[]> = {
  "4-3-3": ["GK", "RB", "CB", "CB", "LB", "DM", "CM", "CM", "RW", "ST", "LW"],
  "4-4-2": ["GK", "RB", "CB", "CB", "LB", "RW", "CM", "CM", "LW", "ST", "ST"],
  "4-2-3-1": ["GK", "RB", "CB", "CB", "LB", "DM", "DM", "RW", "AM", "LW", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "RB", "DM", "CM", "LB", "AM", "ST", "ST"],
  "5-3-2": ["GK", "RB", "CB", "CB", "CB", "LB", "CM", "DM", "CM", "ST", "ST"],
  "4-1-4-1": ["GK", "RB", "CB", "CB", "LB", "DM", "RW", "CM", "CM", "LW", "ST"],
};

/** How well a player fits a slot (ability in that role minus unfamiliarity). */
export function fitFor(p: Player, slot: Position): number {
  return baseFit(p, slot) - flankFitPenalty(p, slot);
}

function baseFit(p: Player, slot: Position): number {
  if (p.position === slot) return overallFor(p.attrs, slot);
  if (p.secondary.includes(slot)) return overallFor(p.attrs, slot) - 2;
  if (slot === "GK" || p.position === "GK") return overallFor(p.attrs, slot) - 35;
  const sameGroup = positionGroup(p.position) === positionGroup(slot);
  // A genuinely versatile player loses a third less when asked to fill in elsewhere.
  return overallFor(p.attrs, slot) - (sameGroup ? 6 : 14) * (hasTrait(p, "versatile") ? 0.65 : 1);
}

export function availability(p: Player): boolean {
  return !p.injury && p.suspension <= 0 && !p.retired;
}

export interface PlayStyle {
  pressing: number;
  tempo: number;
  directness: number;
}

/**
 * How well a player's attributes suit a style of play, 20–95 (60 is neutral). A pressing side wants engines and
 * tacklers, a quick side wants pace and passing, a direct side wants height and finishing; the opposite style asks for
 * composure, vision and short passing. Goalkeepers are neutral.
 */
export function tacticalFit(p: Player, style: PlayStyle): number {
  if (p.position === "GK") return 60;
  const a = p.attrs;
  const hi = {
    pressing: a.stamina * 0.4 + a.tackling * 0.3 + a.acceleration * 0.15 + a.strength * 0.15,
    tempo: a.pace * 0.3 + a.passing * 0.3 + a.firstTouch * 0.2 + a.vision * 0.2,
    directness: a.heading * 0.25 + a.strength * 0.2 + a.longShots * 0.15 + a.finishing * 0.2 + a.pace * 0.2,
  };
  const lo = {
    pressing: a.positioning * 0.5 + a.composure * 0.3 + a.tackling * 0.2,
    tempo: a.vision * 0.4 + a.composure * 0.3 + a.passing * 0.3,
    directness: a.passing * 0.4 + a.firstTouch * 0.3 + a.vision * 0.3,
  };
  let sum = 0;
  for (const d of ["pressing", "tempo", "directness"] as const) {
    const v = style[d];
    sum += v > 0.5 ? (v - 0.5) * 2 * (hi[d] - 60) : (0.5 - v) * 2 * (lo[d] - 60);
  }
  // Habits that suit the manager's style count for a little (a pressing side likes a Pressing Machine). Capped, and well below
  // the weight of ability, fitness and form in the selection score.
  return Math.max(20, Math.min(95, 60 + sum * 0.5 + traitFit(p, style)));
}

export interface SelectionOpts {
  rotate?: boolean;
  managerBias?: number;
  style?: PlayStyle;
}

/** The pieces a selection score is made of, so the manager's choice can be explained from the same numbers. */
export interface ScoreParts {
  /** Ability in the slot (position overall, minus unfamiliarity). */
  ability: number;
  /** What tiredness takes off. */
  fitness: number;
  form: number;
  sharpness: number;
  rotation: number;
  /** The manager's trust, which only matters for the user. */
  trust: number;
  tactical: number;
}

export function scoreParts(p: Player, fit: number, opts: SelectionOpts): ScoreParts {
  return {
    ability: fit,
    fitness: fit * (0.8 + 0.2 * (p.fitness / 100)) - fit,
    form: (p.form - 6.6) * 2.2,
    sharpness: (p.sharpness - 70) / 40,
    rotation: opts.rotate ? (p.fitness < 92 ? -4 : 0) + (p.contract?.role === "prospect" || p.contract?.role === "backup" ? 8 : 0) : 0,
    trust: p.isUser && opts.managerBias ? opts.managerBias : 0,
    tactical: opts.style ? (tacticalFit(p, opts.style) - 60) / 25 : 0,
  };
}

export const partsTotal = (x: ScoreParts) => x.ability + x.fitness + x.form + x.sharpness + x.rotation + x.trust + x.tactical;

/** Selection score blends ability with condition, form, style fit and small manager noise. */
export function selectionScore(p: Player, slot: Position, rng: Rng | null, opts: SelectionOpts = {}): number {
  return scoreWith(p, fitFor(p, slot), opts) + (rng ? rng.normal(0, 1.2) : 0);
}

function scoreWith(p: Player, fit: number, opts: SelectionOpts): number {
  return partsTotal(scoreParts(p, fit, opts));
}

export interface Selection {
  starters: { player: Player; slot: Position }[];
  bench: Player[];
}

/** Greedy XI selection: scarce slots first (GK, then defence...). */
export function selectTeam(
  squad: Player[],
  formation: FormationId,
  rng: Rng | null,
  opts: SelectionOpts & { benchSize?: number } = {},
): Selection {
  const slots = FORMATIONS[formation];
  const order = slots
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => slotPriority(a.slot) - slotPriority(b.slot));
  const available = squad.filter(availability);
  const used = new Set<string>();
  const starters: { player: Player; slot: Position; i: number }[] = [];
  // One noise draw per player and one fit evaluation per (player, distinct slot).
  const noise = available.map(() => (rng ? (rng.next() + rng.next() + rng.next() - 1.5) * 2 : 0));
  const cache = new Map<Position, number[]>();
  const scoresFor = (slot: Position) => {
    let arr = cache.get(slot);
    if (!arr) {
      arr = available.map((p, idx) => scoreWith(p, fitFor(p, slot), opts) + noise[idx]);
      cache.set(slot, arr);
    }
    return arr;
  };
  for (const { slot, i } of order) {
    let best: Player | undefined;
    let bestScore = -Infinity;
    const scores = scoresFor(slot);
    for (let idx = 0; idx < available.length; idx++) {
      const p = available[idx];
      if (used.has(p.id)) continue;
      const sc = scores[idx];
      if (sc > bestScore) {
        bestScore = sc;
        best = p;
      }
    }
    if (best) {
      used.add(best.id);
      starters.push({ player: best, slot, i });
    }
  }
  starters.sort((a, b) => a.i - b.i);
  const rest = available
    .filter((p) => !used.has(p.id))
    .map((p) => ({ p, o: overallFor(p.attrs, p.position) }))
    .sort((a, b) => b.o - a.o)
    .map((x) => x.p);
  const benchSize = opts.benchSize ?? 9;
  const bench: Player[] = [];
  const gk = rest.find((p) => p.position === "GK");
  if (gk) bench.push(gk);
  for (const p of rest) {
    if (bench.length >= benchSize) break;
    if (!bench.includes(p)) bench.push(p);
  }
  return { starters: starters.map(({ player, slot }) => ({ player, slot })), bench };
}

function slotPriority(p: Position): number {
  return { GK: 0, ST: 1, CB: 2, DM: 3, RB: 4, LB: 4, CM: 5, AM: 6, RW: 7, LW: 7 }[p];
}

/** Pick the formation that best suits a squad. */
export function bestFormation(squad: Player[]): FormationId {
  let best: FormationId = "4-3-3";
  let bestScore = -Infinity;
  for (const f of Object.keys(FORMATIONS) as FormationId[]) {
    const sel = selectTeam(squad, f, null);
    const score = sel.starters.reduce((s, x) => s + fitFor(x.player, x.slot), 0) + (f === "4-3-3" || f === "4-2-3-1" ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}
