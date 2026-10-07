import { ageOf } from "../players/generate";
import type { GameState, Memory, MemoryKind } from "../types";
import { userPlayer } from "../world/helpers";
import { Factors, importanceFrom, rarityMultiplier, reputationMultiplier } from "./score";

export const MAX_MEMORIES = 300;
/** Below this importance a moment is not worth keeping (milestone "firsts" opt out with `keepAlways`). */
export const MIN_IMPORTANCE = 40;

export interface MemoryDraft extends Omit<Memory, "id" | "importance" | "factors" | "age" | "season" | "turn" | "tags"> {
  factors: Factors;
  tags?: string[];
  /** Skip the rarity/reputation multipliers (e.g. fixed historical backfills). */
  raw?: boolean;
  keepAlways?: boolean;
  /** Extra discriminator when one fixture/turn can produce several memories of one kind. */
  key?: string;
}

/** Score a draft from its context and store it. Returns the memory, or null if it didn't matter enough. */
export function recordMemory(state: GameState, draft: MemoryDraft): Memory | null {
  const p = userPlayer(state);
  const { factors, tags, raw, keepAlways, key, ...rest } = draft;
  // Match memories are one per fixture; keyed ones (trophy, award, transfer…) are one per key per season.
  const id = rest.fixtureId ? `${rest.kind}-${rest.fixtureId}` : `${rest.kind}-${state.season}-${key ?? state.turn}`;
  if (state.user.memories.some((m) => m.id === id)) return null;
  const mult = raw ? 1 : rarityMultiplier(state, rest.kind) * reputationMultiplier(p.reputation);
  const total = factors.total * mult;
  const importance = importanceFrom(total);
  if (importance < MIN_IMPORTANCE && !keepAlways) return null;
  const list = [...factors.list];
  if (Math.abs(mult - 1) > 0.02) list.push([mult < 1 ? "Seen it before" : "Underdog story", Math.round((total - factors.total) * 10) / 10]);
  const memory: Memory = { ...rest, id, season: state.season, turn: state.turn, age: ageOf(p, state.season), importance, factors: list, tags: tags ?? [] };
  state.user.memories.push(memory);
  prune(state);
  return memory;
}

function prune(state: GameState): void {
  const ms = state.user.memories;
  if (ms.length <= MAX_MEMORIES) return;
  // Keep everything big; drop the weakest, oldest first.
  const droppable = ms.filter((m) => m.importance < 70).sort((a, b) => a.importance - b.importance || a.season - b.season || a.turn - b.turn);
  const drop = new Set(droppable.slice(0, ms.length - MAX_MEMORIES).map((m) => m.id));
  state.user.memories = ms.filter((m) => !drop.has(m.id));
}

export function memoriesByImportance(state: GameState, kinds?: MemoryKind[]): Memory[] {
  return state.user.memories
    .filter((m) => !kinds || kinds.includes(m.kind))
    .sort((a, b) => b.importance - a.importance || b.season - a.season || b.turn - a.turn);
}
