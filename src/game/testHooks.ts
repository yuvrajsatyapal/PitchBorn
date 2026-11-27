/**
 * Shortcuts for end-to-end tests (dev and E2E builds only): put the career into a state the systems react to, then let
 * the real UI take over. Each hook calls the same engine code a played week would, so the decisions that follow are the
 * ones a player meets.
 */
import { startDrama } from "@/engine/career/drama";
import { marketWeekly } from "@/engine/career/market";
import { makeTerms } from "@/engine/career/offers";
import { onUserInjury } from "@/engine/career/recovery";
import { BALANCE } from "@/engine/balance";
import { applyInjury } from "@/engine/players/injuries";
import { Rng } from "@/engine/rng";
import type { DramaKind, GameState, InjurySeverity } from "@/engine/types";
import { nextId, userPlayer } from "@/engine/world/helpers";

export const testHooks = {
  /** The user picks up an injury now, as in a match: moderate and worse raise the recovery decision. */
  injure(state: GameState, severity: InjurySeverity = "moderate"): void {
    const p = userPlayer(state);
    const weeks = severity === "moderate" ? 4 : severity === "serious" ? 10 : severity === "severe" ? 24 : 1;
    const injury = { type: severity === "moderate" ? "Hamstring strain" : "Knee ligament damage", area: severity === "moderate" ? "hamstring" : "knee", severity, weeksLeft: weeks, totalWeeks: weeks };
    applyInjury(Rng.fromSeed(`${state.seed}:test-injury`), p, injury);
    onUserInjury(state, injury);
  },
  /** Starts an off-pitch story of this kind if the career allows it. */
  drama(state: GameState, kind: DramaKind): boolean {
    return !!startDrama(state, kind);
  },
  /**
   * A club of similar standing bids for the user, then the market's weekly step runs (with the week counter nudged on,
   * so each try draws afresh) until a rival joins and a deadline-day bid lands. The calendar is left where it was.
   */
  transferDrama(state: GameState): { war: boolean; deadline: boolean } {
    const p = userPlayer(state);
    const home = state.clubs[p.clubId ?? ""];
    const club = Object.values(state.clubs).filter((c) => c.id !== home?.id).sort((a, b) => Math.abs(a.reputation - (home?.reputation ?? 60)) - Math.abs(b.reputation - (home?.reputation ?? 60)))[0];
    const { terms, maxWage } = makeTerms(state, Rng.fromSeed(`${state.seed}:test-bid`), club, p, "transfer");
    state.user.offers.unshift({ id: nextId(state, "o"), kind: "transfer", fromClubId: club.id, toPlayerClubId: p.clubId, fee: 4_000_000, terms, maxWage, patience: 2, status: "club-pending", createdTurn: state.turn, expiresTurn: state.turn + 6, season: state.season, history: [] });
    p.reputation = Math.max(p.reputation, 55);
    // Good enough for clubs of the bidder's standing to want him too.
    for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = Math.max((p.attrs as Record<string, number>)[k], 84);
    for (const c of Object.values(state.clubs)) c.balance = Math.max(c.balance, 200_000_000);
    const { turn, turnIndex } = state;
    let war = false;
    let deadline = false;
    for (let i = 1; i <= 40 && !(war && deadline); i++) {
      state.turnIndex = turnIndex + i;
      // Deadline day is the window's last week; the other weeks are ordinary window weeks.
      state.turn = war ? BALANCE.calendar.summerWindow[BALANCE.calendar.summerWindow.length - 1] : turn;
      marketWeekly(state);
      war ||= state.user.offers.some((o) => !!o.warWith);
      deadline ||= state.user.offers.some((o) => o.deadline);
    }
    state.turn = turn;
    state.turnIndex = turnIndex;
    for (const o of state.user.offers) if (o.deadline || o.warWith) o.expiresTurn = Math.max(o.expiresTurn, turn + 2);
    return { war, deadline };
  },
  /** A youth player is made a year older: he turns 16 this season, so the first professional contract comes at its end. */
  youthTurns16(state: GameState): void {
    userPlayer(state).birthYear = state.season - 16;
  },
};

export type TestHooks = typeof testHooks;
