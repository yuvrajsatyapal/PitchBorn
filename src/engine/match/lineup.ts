import { generateAttributes, overallExact, overallFor, positionGroup } from "../players/attributes";
import { styleWeights } from "../players/model";
import { flankFitPenalty } from "../players/foot";
import { Rng } from "../rng";
import { hasTrait, traitFit } from "../traits/effects";
import { ALL_ATTRS, type AttrKey, type FormationId, type Player, type Position } from "../types";

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
 * How well a player's profile suits a style of play, 20–95 (60 is neutral).
 *
 * It measures the shape of his game, not its size: for each style dial, the attributes that style asks of his position (a press wants
 * work rate, stamina and anticipation; a possession side wants technique, first touch and decisions; a low block wants positioning
 * and marking; a direct side wants movement, pace and aerial threat) are compared with his general level in the role, and with what is
 * ordinary for that role. Two players of the same overall can therefore fit very differently, and a better player does not
 * automatically fit better. A dial near the middle asks for nothing. Habits that suit the manager's style count for a little (a pressing
 * side likes a Pressing Machine). The whole is capped and kept well under ability, fitness and form in the selection score.
 * Measured for the role he would play (`slot`, his own position by default), so a style-fitting midfielder gets no credit as a centre-back.
 */
export function tacticalFit(p: Player, style: PlayStyle, slot: Position = p.position): number {
  const a = p.attrs;
  // Managers pick sides every week from squads whose attributes change monthly: remember the answer for a player, a role and a style,
  // and recompute only when his attributes (a cheap fingerprint), his habits or the style differ.
  const styleSig = style.pressing * 1e6 + style.tempo * 1e3 + style.directness;
  const attrSig = a.pace + 3 * a.stamina + 7 * a.finishing + 11 * a.passing + 13 * a.tackling + 17 * a.workRate + 19 * a.technique + 23 * a.decisions + 29 * a.offBall + 31 * a.marking + 37 * a.anticipation + 41 * a.reflexes + 43 * a.positioning + (p.traits?.length ?? 0) * 101;
  let memo = FIT_MEMO.get(p);
  if (!memo) FIT_MEMO.set(p, (memo = {}));
  const hit = memo[slot];
  if (hit && hit.styleSig === styleSig && hit.attrSig === attrSig) return hit.value;
  const level = overallExact(a, slot);
  const role = roleReference(slot);
  let sum = 0;
  for (let d = 0; d < STYLE_DIMS.length; d++) {
    const dim = STYLE_DIMS[d];
    const v = style[dim];
    const pull = Math.abs(v - 0.5) * 2;
    if (pull < 0.01) continue;
    const hi = v > 0.5;
    const ws = styleWeights(slot, dim, hi ? "hi" : "lo");
    let score = 0;
    for (let i = 0; i < ws.length; i++) score += a[ws[i][0]] * ws[i][1];
    // The weights sum to 1, so "profile above level, above what is ordinary" is the weighted score less the level less the reference's own score.
    sum += pull * (score - level - role.terms[dim][hi ? "hi" : "lo"]);
  }
  const value = Math.max(20, Math.min(95, 60 + sum * FIT_SCALE + traitFit(p, style)));
  memo[slot] = { styleSig, attrSig, value };
  return value;
}

const FIT_MEMO = new WeakMap<Player, Partial<Record<Position, { styleSig: number; attrSig: number; value: number }>>>();
const STYLE_DIMS = ["pressing", "tempo", "directness"] as const;
/** Fit points per attribute point of profile-over-ordinary, for a style dial at its extreme. */
const FIT_SCALE = 2.4;
/** Selection score points per fit point: a perfect-versus-awful pair of players is worth about two points of ability, no more. */
export const FIT_PER_POINT = 16;
/** The most a manager's style can add to or take from a player's selection score, in ability points: enough to settle a close call, never a big gap. */
export const TACTICAL_CAP = 1.5;

interface RoleReference {
  ref: Record<AttrKey, number>;
  /** The reference's own weighted score for each dial end. */
  terms: Record<(typeof STYLE_DIMS)[number], { hi: number; lo: number }>;
}
const ROLE_REFERENCE = new Map<Position, RoleReference>();
/**
 * What is ordinary for a role: the mean of each attribute above or below the player's own overall, over a fixed sample made by the
 * same generator that makes every player. Fit is measured against it, so an average player of any position fits an average style at
 * about 60, and the number tracks the generator instead of a table that could drift from it.
 */
function roleReference(position: Position): RoleReference {
  const cached = ROLE_REFERENCE.get(position);
  if (cached) return cached;
  const sum = {} as Record<AttrKey, number>;
  for (const k of ALL_ATTRS) sum[k] = 0;
  const samples = 120;
  for (let i = 0; i < samples; i++) {
    const attrs = generateAttributes(Rng.fromSeed(`fit-ref:${position}:${i}`), position, 72, 181, { age: 26, professionalism: 55 });
    const level = overallExact(attrs, position);
    for (const k of ALL_ATTRS) sum[k] += attrs[k] - level;
  }
  for (const k of ALL_ATTRS) sum[k] /= samples;
  const termOf = (dim: (typeof STYLE_DIMS)[number], side: "hi" | "lo") => styleWeights(position, dim, side).reduce((s, [k, w]) => s + w * sum[k], 0);
  const out: RoleReference = { ref: sum, terms: { pressing: { hi: termOf("pressing", "hi"), lo: termOf("pressing", "lo") }, tempo: { hi: termOf("tempo", "hi"), lo: termOf("tempo", "lo") }, directness: { hi: termOf("directness", "hi"), lo: termOf("directness", "lo") } } };
  ROLE_REFERENCE.set(position, out);
  return out;
}

/** The attributes that most help or hold back a player's fit with a style, for display: [helping, hurting]. */
export function fitDrivers(p: Player, style: PlayStyle): { helps: AttrKey[]; hurts: AttrKey[] } {
  const a = p.attrs;
  const level = overallExact(a, p.position);
  const ref = roleReference(p.position).ref;
  const contrib = new Map<AttrKey, number>();
  for (const dim of STYLE_DIMS) {
    const v = style[dim];
    const pull = Math.abs(v - 0.5) * 2;
    if (pull < 0.15) continue;
    for (const [k, w] of styleWeights(p.position, dim, v > 0.5 ? "hi" : "lo")) contrib.set(k, (contrib.get(k) ?? 0) + pull * w * (a[k] - level - ref[k]));
  }
  const ranked = [...contrib.entries()].sort((x, y) => y[1] - x[1]);
  return { helps: ranked.filter(([, c]) => c > 0.6).slice(0, 2).map(([k]) => k), hurts: ranked.filter(([, c]) => c < -0.6).slice(-2).reverse().map(([k]) => k) };
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

export function scoreParts(p: Player, fit: number, opts: SelectionOpts, slot: Position = p.position): ScoreParts {
  return {
    ability: fit,
    fitness: fit * (0.8 + 0.2 * (p.fitness / 100)) - fit,
    form: (p.form - 6.6) * 2.2,
    sharpness: (p.sharpness - 70) / 40,
    rotation: opts.rotate ? (p.fitness < 92 ? -4 : 0) + (p.contract?.role === "prospect" || p.contract?.role === "backup" ? 8 : 0) : 0,
    trust: p.isUser && opts.managerBias ? opts.managerBias : 0,
    tactical: opts.style ? Math.max(-TACTICAL_CAP, Math.min(TACTICAL_CAP, (tacticalFit(p, opts.style, slot) - 60) / FIT_PER_POINT)) : 0,
  };
}

export const partsTotal = (x: ScoreParts) => x.ability + x.fitness + x.form + x.sharpness + x.rotation + x.trust + x.tactical;

/** Selection score blends ability with condition, form, style fit and small manager noise. */
export function selectionScore(p: Player, slot: Position, rng: Rng | null, opts: SelectionOpts = {}): number {
  return scoreWith(p, fitFor(p, slot), opts, slot) + (rng ? rng.normal(0, 1.2) : 0);
}

function scoreWith(p: Player, fit: number, opts: SelectionOpts, slot: Position): number {
  return partsTotal(scoreParts(p, fit, opts, slot));
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
      arr = available.map((p, idx) => scoreWith(p, fitFor(p, slot), opts, slot) + noise[idx]);
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
