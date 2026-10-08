import { clamp } from "../rng";
import type { GameState, Relationships } from "../types";

/** Smallest change worth remembering as a reason; routine drift is applied but not logged. */
const LOG_MIN = 1.2;
const LOG_CAP = 60;

/**
 * Move one of the four relationship bars and, when the move is big enough to matter, remember why. The Club page
 * explains each bar from this list, so a reason is always something that really happened.
 */
export function adjustRel(state: GameState, rel: keyof Relationships, delta: number, cause: string): void {
  const r = state.user.relationships;
  const before = r[rel];
  r[rel] = clamp(before + delta, 0, 100);
  const applied = r[rel] - before;
  if (Math.abs(applied) < LOG_MIN || rel === "agent") return;
  const log = (state.user.relLog ??= []);
  log.push({ index: state.turnIndex, season: state.season, turn: state.turn, rel, delta: Math.round(applied * 10) / 10, cause });
  if (log.length > LOG_CAP) log.splice(0, log.length - LOG_CAP);
}

/** The most recent logged causes for a bar, newest first, with the same cause on consecutive weeks merged. */
export function relReasons(state: GameState, rel: keyof Relationships, n = 3): { delta: number; cause: string; season: number; turn: number }[] {
  const out: { delta: number; cause: string; season: number; turn: number }[] = [];
  for (const e of [...(state.user.relLog ?? [])].reverse()) {
    if (e.rel !== rel) continue;
    out.push({ delta: e.delta, cause: e.cause, season: e.season, turn: e.turn });
    if (out.length >= n) break;
  }
  return out;
}
