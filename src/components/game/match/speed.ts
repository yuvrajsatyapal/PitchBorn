/** Milliseconds per match minute for each speed (0 = paused). */
export const SPEED_MS = [0, 650, 220, 60] as const;

/**
 * How often the match should advance: never while a key moment is waiting for the user or once it is over, and otherwise at the speed
 * he chose. The chosen speed is kept apart from this, so play resumes at the same pace after a decision.
 */
export function tickInterval(speed: number, finished: boolean, paused: boolean): number {
  if (finished || paused) return 0;
  return SPEED_MS[speed] ?? 0;
}
