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

const DAY = 86_400_000;

/** Weeks to advance so the displayed date lands as close as possible to `target` (at least one week). */
export function weeksToDate(season: number, turn: number, target: Date): number {
  const now = turnDate(season, turn).getTime();
  return Math.max(1, Math.round((target.getTime() - now) / (7 * DAY)));
}

/** The same day next month (19 Sep -> 19 Oct), as a weekly-turn count. */
export function weeksToNextMonth(season: number, turn: number): number {
  const d = turnDate(season, turn);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  return weeksToDate(season, turn, next);
}

/** Weeks to the turn dated closest to 1 January of the season's second calendar year, or null once it has passed. */
export function weeksToNewYear(season: number, turn: number): number | null {
  const newYear = new Date(Date.UTC(season + 1, 0, 1));
  if (turnDate(season, turn).getTime() >= newYear.getTime() - 3 * DAY) return null;
  return weeksToDate(season, turn, newYear);
}

/** The weeks just before a window opens, when a transfer story can start brewing (enquiries, agents) before bids are allowed. */
export const RUMOUR_WEEKS = 4;

export function upcomingWindow(turn: number): "summer" | "january" | null {
  const summerOpens = C.summerWindow[0];
  const janOpens = C.januaryWindow[0];
  if (turn < summerOpens && turn >= summerOpens - RUMOUR_WEEKS && turn < C.endOfSeasonTurn) return "summer";
  if (turn < janOpens && turn >= janOpens - RUMOUR_WEEKS) return "january";
  return null;
}

/**
 * The last turn on which a transfer saga begun now still lets the player act. Sagas never run across the season
 * rollover: the summer window is cut at the last week of the season, and the pre-season weeks end at week 3.
 */
export function sagaDeadlineTurn(turn: number, free: boolean): number {
  if (turn >= C.endOfSeasonTurn) return C.turnsPerSeason;
  if (turn < C.seasonStart) return C.preseasonTurns[C.preseasonTurns.length - 1];
  const jan = C.januaryWindow as readonly number[];
  if (!free && (jan.includes(turn) || upcomingWindow(turn) === "january")) return jan[jan.length - 1];
  if (!free && upcomingWindow(turn) === "summer") return C.turnsPerSeason;
  return Math.min(turn + 5, C.endOfSeasonTurn - 1);
}
