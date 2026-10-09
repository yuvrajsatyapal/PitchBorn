/**
 * Scores for traits that come from a player's profile or record rather than from one match.
 * Each returns roughly −1…1 (≥ 0.25 starts the trait, ≥ 0.6 starts it established). Record-based ones need a real sample
 * (minutes, seasons, appearances): a player generated with no history never has them from day one, they grow out of the career.
 */
import { overallFor, positionGroup } from "../../players/attributes";
import type { StatLine } from "../../types";
import type { DeriveInput } from "../types";

/** A career with no football played yet (a generated player starts with no record to read). */
export const NO_RECORD: StatLine = {
  apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, conceded: 0, yellow: 0, red: 0, ratingSum: 0, motm: 0, shots: 0, shotsOnTarget: 0, keyPasses: 0, tackles: 0, saves: 0,
};

const mean = (...n: number[]) => n.reduce((s, v) => s + v, 0) / n.length;

export const SAMPLE = {
  /** Minutes before a disciplinary record means anything (≈30 full matches). */
  discipline: 2700,
  /** Minutes before big-match reputation is believed (≈20 full matches). */
  bigGames: 1800,
  /** Appearances before a player is trusted as a dressing-room figure. */
  standing: 120,
  /** Rated matches before consistency is read from results. */
  ratings: 20,
};

/** Cards per 90 minutes (a red counts for more than one yellow). */
export function cardRate(p: DeriveInput): number {
  const c = p.career;
  return c.minutes > 0 ? ((c.yellow + 2.5 * c.red) / c.minutes) * 90 : 0;
}

/** Typical cards per 90 for a regular in each position (measured on simulated careers); a Card Magnet is far above his own position's norm. */
const CARD_NORM: Record<string, number> = { GK: 0.01, CB: 0.28, RB: 0.14, LB: 0.16, DM: 0.3, CM: 0.11, AM: 0.06, RW: 0.04, LW: 0.04, ST: 0.02 };

export function ironMan(p: DeriveInput): number {
  const seasons = p.history.filter((h) => h.stats.minutes > 0);
  if (seasons.length < 4 || p.hidden.injuryProneness >= 60) return -1;
  const recent = seasons.slice(-5);
  const avg = recent.reduce((s, h) => s + h.stats.minutes, 0) / recent.length;
  // Injuries are only counted for the career as a whole, so spread them over every season the minutes imply.
  const years = Math.max(seasons.length + 1, p.career.minutes / 3000);
  return Math.min((avg - 3500) / 900, (0.8 - p.injuries / years) / 0.8);
}

export function superSub(p: DeriveInput): number {
  const c = p.career;
  const sub = c.apps - c.starts;
  if (c.apps < 40 || sub < 30) return -1;
  const share = sub / c.apps;
  const per90 = ((c.goals + c.assists) / Math.max(1, c.minutes)) * 90;
  return Math.min((share - 0.55) / 0.2, (per90 - 0.4) / 0.3);
}

export function cardMagnet(p: DeriveInput): number {
  if (p.career.minutes < SAMPLE.discipline || p.position === "GK") return -1;
  const norm = CARD_NORM[p.position] ?? 0.1;
  const threshold = Math.max(norm * 2.1, norm + 0.1);
  return 0.25 + (cardRate(p) - threshold) / (0.5 * threshold);
}

/** Competent in several positions: at least two secondary positions where his ability barely drops. */
export function versatile(p: DeriveInput): number {
  if (p.secondary.length < 2 || p.age < 21) return -1;
  const home = overallFor(p.attrs, p.position);
  const ok = p.secondary.filter((s) => overallFor(p.attrs, s) >= home - 3);
  // Neighbouring roles (centre-mid, defensive mid, attacking mid) are easy; a real utility player works across the pitch.
  const groups = new Set([p.position, ...ok].map(positionGroup));
  return ok.length >= 2 && groups.size >= 2 ? 0.4 : -1;
}

export function consistentRecord(p: DeriveInput): number {
  const r = p.ratings;
  if (r && r.n >= SAMPLE.ratings) return Math.min((0.8 - r.sd) / 0.45, (r.mean - 6.55) / 0.5);
  return (p.hidden.consistency - 72) / 22;
}

export function bigGameRecord(p: DeriveInput): number {
  return p.career.minutes >= SAMPLE.bigGames || p.career.apps === 0 ? (p.hidden.bigMatch - 72) / 22 : -1;
}

export function bigMatchNerves(p: DeriveInput): number {
  // Needs a record: a youngster is not written off for a few bad finals.
  return p.career.minutes >= SAMPLE.bigGames ? (30 - p.hidden.bigMatch) / 14 : -1;
}

export function captainMaterial(p: DeriveInput): number {
  if (p.career.apps < SAMPLE.standing || p.age < 24) return -1;
  return (p.captain ? 0.4 : 0) + (p.reputation - 44) / 36 + (p.hidden.professionalism - 60) / 100 + Math.min(0.2, (p.age - 26) / 30) - 0.2;
}

export function dressingRoomLeader(p: DeriveInput): number {
  if (p.career.apps < SAMPLE.standing || p.age < 26 || p.hidden.professionalism < 55) return -1;
  return (p.reputation - 44) / 28 + (p.age - 26) / 30 + (p.hidden.professionalism - 60) / 100;
}

export function fanFavourite(p: DeriveInput): number {
  if (p.supporters !== undefined) return p.tenure >= 2 ? (p.supporters - 74) / 18 + Math.min(0.3, (p.tenure - 2) * 0.08) : -1;
  return p.tenure >= 5 ? Math.min((p.tenure - 4) / 6, (p.reputation - 22) / 30) + (p.hidden.loyalty - 50) / 150 : -1;
}

/** Rare by design: a decade at one club, and a player whose loyalty is real, not just a long contract. */
export function oneClub(p: DeriveInput): number {
  return p.tenure >= 10 ? Math.min((p.tenure - 9) / 4, (p.hidden.loyalty - 58) / 28) : -1;
}

export const driven = (p: DeriveInput) => (mean(p.hidden.ambition, p.hidden.professionalism) - 66) / 24;
export const determined = (p: DeriveInput) => (mean(p.hidden.bigMatch, p.hidden.consistency, p.hidden.professionalism) - 63) / 24;
export const confident = (p: DeriveInput) => (p.reputation >= 15 ? (mean(p.hidden.bigMatch, p.hidden.ambition) - 66) / 24 : -1);
export const humble = (p: DeriveInput) => Math.min((p.hidden.professionalism - 66) / 24, (62 - p.hidden.ambition) / 22);
export const charismatic = (p: DeriveInput) => (p.reputation - 46) / 28 + (p.hidden.adaptability - 55) / 150;
export const fiery = (p: DeriveInput) => Math.min((mean(p.hidden.ambition, p.hidden.bigMatch) - 62) / 24, (58 - p.hidden.professionalism) / 24);
export const bigPersonality = (p: DeriveInput) => Math.min((p.reputation - 45) / 30, (p.hidden.ambition - 58) / 22);
export const quietProfessional = (p: DeriveInput) => Math.min((p.hidden.professionalism - 70) / 24, (58 - p.reputation) / 30);
export const easilyFrustrated = (p: DeriveInput) => (42 - mean(p.hidden.bigMatch, p.hidden.professionalism)) / 24;
export const contractDifficulties = (p: DeriveInput) => Math.min((p.hidden.ambition - 56) / 22, (42 - p.hidden.loyalty) / 22);
export const unsettledEasily = (p: DeriveInput) => Math.min((42 - p.hidden.adaptability) / 24, (52 - p.hidden.consistency) / 24);
export const ego = (p: DeriveInput) => Math.min((p.reputation - 34) / 30, (46 - p.hidden.professionalism) / 22);
export const mediaControversy = (p: DeriveInput) => Math.min((p.reputation - 40) / 30, (48 - p.hidden.professionalism) / 26);
/** A habit of never working on the weaker foot: needs a poor weak foot and a poor attitude to training. */
export const avoidsWeakFoot = (p: DeriveInput) => (p.weakFoot >= 24 ? Math.min((38 - p.weakFoot) / 16, (55 - p.hidden.professionalism) / 20) : -1);
