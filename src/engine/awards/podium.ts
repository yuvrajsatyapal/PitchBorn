/**
 * Podium reveal for judged individual awards: 3rd, a pause, 2nd, a longer pause, then the winner.
 *
 * Presentation only. The ranking is the stored order of `AwardResult.nominees`; nothing here computes or changes a
 * result, and nothing here touches game state.
 */
import type { AwardResult } from "../types";

/** Awards that opt into the podium reveal. Statistical and team awards never do. */
export const PODIUM_AWARDS: readonly string[] = ["pots", "ypots", "goldenglove", "breakthrough"];

export const hasPodiumReveal = (r: Pick<AwardResult, "id" | "tier">): boolean => r.tier !== "statistical" && PODIUM_AWARDS.includes(r.id);

export interface PodiumTiming {
  /** A beat before the first announcement, so the scene settles. */
  lead: number;
  /** After 3rd, before 2nd. */
  afterThird: number;
  /** After 2nd, before the winner: slightly longer, with only two left. */
  afterSecond: number;
}

export const PODIUM_TIMING: PodiumTiming = { lead: 500, afterThird: 1500, afterSecond: 1800 };
/** With reduced motion the order is still shown, but with no theatrical waiting. */
export const PODIUM_TIMING_REDUCED: PodiumTiming = { lead: 0, afterThird: 450, afterSecond: 450 };

/** The places announced, in order: [3, 2, 1], or fewer when there are fewer finalists. */
export function podiumPlaces(nomineeCount: number): number[] {
  const n = Math.min(3, Math.max(1, nomineeCount));
  return Array.from({ length: n }, (_, i) => n - i);
}

/** Which nominees (by rank index, 0 = winner) are still in contention once `revealed` announcements have been made. */
export function inContention(nomineeCount: number, revealed: number): number[] {
  const places = podiumPlaces(nomineeCount);
  const announced = new Set(places.slice(0, revealed).map((p) => p - 1));
  const out: number[] = [];
  for (let i = 0; i < Math.min(3, nomineeCount); i++) if (!announced.has(i)) out.push(i);
  return out;
}

/**
 * Runs the reveal on timers: calls `onReveal(1)`, `onReveal(2)`, ... and `onDone` once the winner is shown.
 * Returns a cancel function (used when the player skips, goes back, or leaves).
 */
export function schedulePodium(places: number, timing: PodiumTiming, onReveal: (revealed: number) => void, onDone: () => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let at = timing.lead;
  for (let i = 1; i <= places; i++) {
    const n = i;
    timers.push(setTimeout(() => onReveal(n), at));
    if (i < places) at += i === 1 && places === 3 ? timing.afterThird : timing.afterSecond;
  }
  timers.push(setTimeout(onDone, at));
  return () => timers.forEach(clearTimeout);
}
