import type { StatLine } from "../types";

export interface KeeperMetrics {
  /** Share of appearances without conceding (0–1). */
  cleanSheetRate: number;
  /** Saves ÷ shots on target faced (saves + goals conceded), 0–1. */
  savePct: number;
  /** Goals conceded per 90 minutes. */
  concededPer90: number;
  /** Saves per game. */
  savesPerGame: number;
}

/** Goalkeepers are judged on what they stop, not on goals and assists. */
export function keeperMetrics(s: StatLine): KeeperMetrics {
  const faced = s.saves + s.conceded;
  return {
    cleanSheetRate: s.apps ? s.cleanSheets / s.apps : 0,
    savePct: faced ? s.saves / faced : 0,
    concededPer90: s.minutes ? (s.conceded / s.minutes) * 90 : 0,
    savesPerGame: s.apps ? s.saves / s.apps : 0,
  };
}

/** One number for ranking keepers: clean sheets first, then how few they let in and how many they stop. */
export function keeperScore(s: StatLine): number {
  const m = keeperMetrics(s);
  return s.cleanSheets * 1.0 + m.savePct * 12 - m.concededPer90 * 6 + s.saves * 0.02;
}
