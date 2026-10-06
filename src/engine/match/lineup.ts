import { overallFor, positionGroup } from "../players/attributes";
import type { Rng } from "../rng";
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
  if (p.position === slot) return overallFor(p.attrs, slot);
  if (p.secondary.includes(slot)) return overallFor(p.attrs, slot) - 2;
  if (slot === "GK" || p.position === "GK") return overallFor(p.attrs, slot) - 35;
  const sameGroup = positionGroup(p.position) === positionGroup(slot);
  return overallFor(p.attrs, slot) - (sameGroup ? 6 : 14);
}

export function availability(p: Player): boolean {
  return !p.injury && p.suspension <= 0 && !p.retired;
}

/** Selection score blends ability with condition, form and small manager noise. */
export function selectionScore(p: Player, slot: Position, rng: Rng | null, opts: { rotate?: boolean; managerBias?: number } = {}): number {
  return scoreWith(p, fitFor(p, slot), opts) + (rng ? rng.normal(0, 1.2) : 0);
}

function scoreWith(p: Player, fit: number, opts: { rotate?: boolean; managerBias?: number }): number {
  let s = fit;
  s *= 0.8 + 0.2 * (p.fitness / 100);
  s += (p.form - 6.6) * 2.2;
  s += (p.sharpness - 70) / 40;
  if (opts.rotate) {
    s -= p.fitness < 92 ? 4 : 0;
    if (p.contract?.role === "prospect" || p.contract?.role === "backup") s += 5;
  }
  if (p.isUser && opts.managerBias) s += opts.managerBias;
  return s;
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
  opts: { rotate?: boolean; managerBias?: number; benchSize?: number } = {},
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
