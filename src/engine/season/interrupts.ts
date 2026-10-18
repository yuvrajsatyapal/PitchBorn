import { ceremonyPending } from "../awards/ceremony";
import { BALANCE } from "../balance";
import type { GameState } from "../types";
import { userPlayer } from "../world/helpers";

export type InterruptReason = "retired" | "new-season" | "match" | "awards" | "decision" | "offer" | "injury";

export const INTERRUPT_LABEL: Record<InterruptReason, string> = {
  retired: "Career over",
  "new-season": "New season",
  match: "Match day",
  awards: "Awards night",
  decision: "Decision needed",
  offer: "New offer",
  injury: "Injury",
};

/** What was already open before a run started: only things that appear afterwards interrupt it. */
export interface AttentionSnapshot {
  decisions: Set<string>;
  offers: Set<string>;
  ceremony: boolean;
  injured: boolean;
}

export function snapshotAttention(state: GameState): AttentionSnapshot {
  return {
    decisions: new Set(state.user.decisions.map((d) => d.id)),
    offers: new Set(state.user.offers.map((o) => o.id)),
    ceremony: ceremonyPending(state),
    injured: !!userPlayer(state).injury,
  };
}

/**
 * Whether the run must stop on the turn the game has just arrived at. The game state is already on that turn, so the
 * date shown when the run stops is the date of the event itself; nothing is ever resolved behind the animation.
 */
export function interruptReason(
  state: GameState,
  before: AttentionSnapshot,
  opts: { newSeason: boolean; stopOnMatch: boolean },
): InterruptReason | null {
  if (state.user.retired) return "retired";
  if (opts.newSeason) return "new-season";
  if (opts.stopOnMatch && state.pending.length > 0) return "match";
  if (!before.ceremony && ceremonyPending(state) && state.turn > BALANCE.calendar.endOfSeasonTurn) return "awards";
  if (state.user.decisions.some((d) => !before.decisions.has(d.id))) return "decision";
  if (state.user.offers.some((o) => !before.offers.has(o.id) && o.status === "terms")) return "offer";
  if (!before.injured && userPlayer(state).injury) return "injury";
  return null;
}
