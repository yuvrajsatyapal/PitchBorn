/**
 * Frozen-pitch postponements. Before the user's week begins, a league match of his on an unplayable pitch (frozen, with
 * snow falling or a deep frost) is called off and moved to the first later week of the season in which neither side has a
 * game. A match is only ever postponed once; the rearranged game gets weather of its own. Only the user's fixtures have
 * conditions, so the rest of the world plays exactly as before.
 */
import { BALANCE } from "../balance";
import { isInternationalTurn } from "../calendar";
import type { Fixture, GameState } from "../types";
import { conditionsFor, unplayable } from "../weather/conditions";
import { addNews } from "../world/helpers";
import { involvesUserTeam, teamName } from "./matchday";

function busy(state: GameState, turn: number, team: string): boolean {
  return Object.values(state.competitions).some((c) => c.season === state.season && c.fixtures.some((f) => f.turn === turn && (f.home === team || f.away === team)));
}

/** The week a called-off match moves to, or null when the season has no room left. */
export function rearrangeTurn(state: GameState, f: Fixture): number | null {
  for (let t = state.turn + 1; t <= BALANCE.calendar.seasonEnd; t++) {
    if (isInternationalTurn(t)) continue;
    if (!busy(state, t, f.home) && !busy(state, t, f.away)) return t;
  }
  return null;
}

/** Returns whether any fixture moved (match days then need assigning again). */
export function postponeFrozenFixtures(state: GameState): boolean {
  let moved = false;
  for (const comp of Object.values(state.competitions)) {
    if (comp.season !== state.season || comp.kind !== "league") continue;
    for (const f of comp.fixtures) {
      if (f.turn !== state.turn || f.result || f.postponed || !involvesUserTeam(state, f)) continue;
      const c = conditionsFor(state, f);
      if (!unplayable(c)) continue;
      const to = rearrangeTurn(state, f);
      if (to === null) continue;
      const from = f.turn;
      f.turn = to;
      f.day = undefined;
      f.postponed = 1;
      moved = true;
      addNews(state, {
        kind: "match",
        title: `❄️ Postponed: ${teamName(state, f.home, true)} v ${teamName(state, f.away, true)}`,
        body: `The pitch is frozen solid (${Math.round(c.tempC)}°C). The match is rearranged for ${to - from} week${to - from === 1 ? "" : "s"} later.`,
        important: true,
      });
    }
  }
  return moved;
}
