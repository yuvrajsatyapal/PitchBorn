import type { Competition, GameState, MemoryKind, MemoryTier } from "../types";

/** Raw context points are squashed onto 0–100 so scores spread out and never pile up at 100. */
export const IMPORTANCE_K = 34;

export function importanceFrom(raw: number): number {
  return Math.round(100 * (1 - Math.exp(-Math.max(0, raw) / IMPORTANCE_K)));
}

export function tierOf(importance: number): MemoryTier {
  return importance >= 75 ? "iconic" : importance >= 55 ? "major" : importance >= 35 ? "notable" : "minor";
}

/** Collects the named points a memory's importance is built from. */
export class Factors {
  readonly list: [string, number][] = [];
  add(label: string, points: number): this {
    if (points > 0.01) this.list.push([label, Math.round(points * 10) / 10]);
    return this;
  }
  get total(): number {
    return this.list.reduce((s, [, p]) => s + p, 0);
  }
}

/** Points for where a match was played: finals and knockouts of big competitions weigh most. */
export function stagePoints(comp: Competition, stage?: string): number {
  if (comp.kind === "league" || comp.kind === "friendly") return 0;
  const s = (stage ?? "").toLowerCase();
  const stageW = s.includes("final") && !s.includes("semi") && !s.includes("quarter") ? 16 : s.includes("semi") ? 9 : s.includes("quarter") ? 6 : s.includes("play") ? 8 : s.includes("round") || s.includes("knock") ? 3 : 2;
  const kindW = comp.kind === "international" ? 1.5 : comp.kind === "continental" ? 1.3 : 1;
  return stageW * kindW * (0.7 + Math.min(10, comp.prestige) / 25);
}

export function agePoints(age: number): number {
  return age <= 19 ? 10 : age <= 21 ? 6 : age >= 34 ? 6 : 0;
}

/** Repeating the same kind of moment is worth less each time. */
export function rarityMultiplier(state: GameState, kind: MemoryKind): number {
  const n = state.user.memories.filter((m) => m.kind === kind && !m.backfilled).length;
  return Math.max(0.55, 1 / (1 + 0.16 * n));
}

/** Unknown players' big moments make bigger stories than an established star's routine ones. */
export function reputationMultiplier(reputation: number): number {
  return Math.min(1.2, Math.max(0.9, 1 + (60 - reputation) / 300));
}
