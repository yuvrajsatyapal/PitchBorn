import { ceremonyPending } from "../awards/ceremony";
import { worldCeremonyPending } from "../awards/world";
import { BALANCE } from "../balance";
import type { GameState } from "../types";
import { userPlayer } from "../world/helpers";

export type InterruptReason = "retired" | "new-season" | "match" | "awards" | "world-awards" | "decision" | "offer" | "injury";

export const INTERRUPT_LABEL: Record<InterruptReason, string> = {
  retired: "Career over",
  "new-season": "New season",
  match: "Match day",
  awards: "Awards night",
  "world-awards": "Golden Pitch gala",
  decision: "Decision needed",
  offer: "New offer",
  injury: "Injury",
};

/** What was already open before a run started: only things that appear afterwards interrupt it. */
export interface AttentionSnapshot {
  decisions: Set<string>;
  offers: Set<string>;
  ceremony: boolean;
  worldCeremony: boolean;
  injured: boolean;
}

export function snapshotAttention(state: GameState): AttentionSnapshot {
  return {
    decisions: new Set(state.user.decisions.map((d) => d.id)),
    offers: new Set(state.user.offers.map((o) => o.id)),
    ceremony: ceremonyPending(state),
    worldCeremony: worldCeremonyPending(state),
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
  opts: { newSeason: boolean; stopOnMatch: boolean; stopForNews?: boolean },
): InterruptReason | null {
  if (state.user.retired) return "retired";
  // The gala is held on the first day of the new season, so it outranks the new-season stop it arrives with.
  if (!before.worldCeremony && worldCeremonyPending(state)) return "world-awards";
  if (opts.newSeason) return "new-season";
  if (opts.stopOnMatch && state.pending.length > 0) return "match";
  if (!before.ceremony && ceremonyPending(state) && state.turn > BALANCE.calendar.endOfSeasonTurn) return "awards";
  // A skip of a set length (the » menu) runs to its date: decisions fall back to their default and offers lapse on the
  // way, as that menu says. Only "Continue" stops for them.
  if (opts.stopForNews === false) return null;
  if (state.user.decisions.some((d) => !before.decisions.has(d.id))) return "decision";
  if (state.user.offers.some((o) => !before.offers.has(o.id) && o.status === "terms")) return "offer";
  if (!before.injured && userPlayer(state).injury) return "injury";
  return null;
}
