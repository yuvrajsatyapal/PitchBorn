/**
 * Views of the one stream of match events: everything, the user's own involvement, and the moments that matter. The same events are
 * filtered; nothing is stored twice and nothing here draws a random number.
 */
import type { MatchEvent } from "./engine";

export type FeedFilter = "all" | "you" | "key";

const KEY_TYPES: ReadonlySet<MatchEvent["type"]> = new Set(["goal", "red", "yellow", "injury", "sub", "penalty", "woodwork", "halftime", "fulltime", "extratime", "shootout", "decision"]);

/** Whether an event is about the user's player (his actions, a duel with him, his substitution, a status line about his match). */
export function isYou(e: MatchEvent, uid: string | undefined): boolean {
  return !!e.user || (!!uid && (e.playerId === uid || e.otherId === uid));
}

/** Goals, cards, injuries, substitutions, penalties, big chances and saves, the user's key-moment prompts, and the whistles. */
export function isKey(e: MatchEvent): boolean {
  return KEY_TYPES.has(e.type) || !!e.big;
}

export function filterEvents(events: readonly MatchEvent[], filter: FeedFilter, uid: string | undefined): MatchEvent[] {
  if (filter === "all") return events.slice();
  return events.filter((e) => (filter === "you" ? isYou(e, uid) : isKey(e) || (isYou(e, uid) && e.type === "goal")));
}
