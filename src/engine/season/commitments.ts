import { adjustRel } from "../career/relationships";
import type { GameState } from "../types";
import { userPlayer } from "../world/helpers";

/** The rating a performance promise to the manager is judged by. */
export const COMMIT_RATING = 7;

/** After a match: a promised performance is paid off in trust, or costs it. Called once from the match record. */
export function settleCommitment(state: GameState, fixtureId: string, rating: number | null): void {
  const c = state.user.preMatch?.commitment;
  if (!c || c.fixtureId !== fixtureId) return;
  state.user.preMatch!.commitment = undefined;
  if (rating === null) return;
  if (rating >= (c.rating ?? COMMIT_RATING)) {
    adjustRel(state, "manager", 3, `Kept your promise with a ${rating.toFixed(1)} display`);
    const u = userPlayer(state);
    u.morale = Math.min(100, u.morale + 2);
  } else adjustRel(state, "manager", -3, `Broke your promise with a ${rating.toFixed(1)} display`);
}
