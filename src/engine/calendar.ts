import { BALANCE } from "./balance";

const C = BALANCE.calendar;

/** Turns on which domestic league rounds may be played. */
export function leagueTurns(): number[] {
  const out: number[] = [];
  for (let t = C.seasonStart; t <= C.seasonEnd; t++) if (!(C.internationalTurns as readonly number[]).includes(t)) out.push(t);
  return out;
}

/** Spread N rounds across league turns; when N exceeds turns, extra rounds become midweek doubles. */
export function roundTurns(rounds: number): number[] {
  const turns = leagueTurns();
  const result: number[] = [];
  if (rounds <= turns.length) {
    for (let i = 0; i < rounds; i++) {
      const idx = Math.round((i * (turns.length - 1)) / Math.max(1, rounds - 1));
      result.push(turns[idx]);
    }
    return result;
  }
  const extra = rounds - turns.length;
  const doubles = new Set<number>();
  for (let i = 0; i < extra; i++) doubles.add(turns[Math.round(((i + 0.5) * turns.length) / extra)] ?? turns[turns.length - 1 - i]);
  for (const t of turns) {
    result.push(t);
    if (doubles.has(t)) result.push(t);
  }
  return result.slice(0, rounds);
}

export function isTransferWindow(turn: number): boolean {
  return (C.summerWindow as readonly number[]).includes(turn) || (C.januaryWindow as readonly number[]).includes(turn);
}

export function windowName(turn: number): "summer" | "january" | null {
  if ((C.summerWindow as readonly number[]).includes(turn)) return "summer";
  if ((C.januaryWindow as readonly number[]).includes(turn)) return "january";
  return null;
}

export function isInternationalTurn(turn: number): boolean {
  return (C.internationalTurns as readonly number[]).includes(turn);
}

export type Phase = "preseason" | "season" | "end" | "summer";
export function phaseOf(turn: number): Phase {
  if (turn < C.seasonStart) return "preseason";
  if (turn <= C.seasonEnd) return "season";
  if (turn === C.endOfSeasonTurn) return "end";
  return "summer";
}

/** Approximate calendar date for a turn (season starts first week of July). */
export function turnDate(season: number, turn: number): Date {
  const d = new Date(Date.UTC(season, 6, 1));
  d.setUTCDate(d.getUTCDate() + (turn - 1) * 7);
  return d;
}

export function formatTurnDate(season: number, turn: number): string {
  return turnDate(season, turn).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}

/** Summer tournament held at the end of `season` (in calendar year season+1). */
export function tournamentFor(season: number): "world" | "euro" | null {
  const year = season + 1;
  if (year % 4 === 2) return "world";
  if (year % 4 === 0) return "euro";
  return null;
}

export function monthIndex(turn: number): number {
  return Math.floor((turn - 1) / C.monthLength);
}

export function isMonthEnd(turn: number): boolean {
  return turn >= C.seasonStart + 3 && turn <= C.seasonEnd && turn % C.monthLength === 3;
}
