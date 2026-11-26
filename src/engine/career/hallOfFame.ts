/**
 * Hall of Fame: one entry per retired career, across every save in this browser. The entry is a small, self-contained
 * snapshot (no ids into the save), so it stays readable after the save itself is deleted. Pure: storage lives in
 * persistence/hallOfFame.ts.
 */
import { seasonLabel } from "../calendar";
import { clubName, staticClub } from "../data/world";
import { ageOf } from "../players/generate";
import type { Appearance, GameState } from "../types";
import { userPlayer } from "../world/helpers";
import { careerCardData, type CardStat } from "./card";
import { challengeView } from "./challenges";

export interface HallOfFameEntry {
  /** The save the career came from (one entry per save). */
  saveId: string;
  name: string;
  position: string;
  positionLong: string;
  nationality: string;
  nation: string;
  look: Appearance;
  /** The club he played most games for. */
  clubId: string | null;
  club: string;
  clubColors: { primary: string; secondary: string };
  span: string;
  retiredSeason: number;
  retiredAge: number;
  peak: number;
  legacyScore: number;
  legacyTier: string;
  identity?: string;
  stats: CardStat[];
  honours: string[];
  trophyCount: number;
  awards: string[];
  /** The challenge the career chased, and whether it was completed. */
  challenge?: { title: string; icon: string; won: boolean; weekly?: string };
  /** When the entry was first written (ISO). */
  inductedAt: string;
}

/** The entry for a retired career, or null while the career is still going (or has no legacy yet). */
export function hallOfFameEntry(state: GameState, inductedAt = new Date().toISOString()): HallOfFameEntry | null {
  const u = state.user;
  if (!u.retired || !u.legacy) return null;
  const p = userPlayer(state);
  const card = careerCardData(state);
  const cv = challengeView(state);
  const retiredSeason = u.retiredSeason ?? state.season;
  // A career that never reached a first-team game is remembered at the club it started with, not as a free agent.
  const clubId = card.clubId ?? u.startClubId;
  const colors = card.clubId ? card.clubColors : staticClub(clubId)?.colors ?? card.clubColors;
  return {
    // Each generation of a family save is its own career in the Hall.
    saveId: state.generation && state.generation > 1 ? `${state.id}~g${state.generation}` : state.id,
    name: card.name,
    position: card.position,
    positionLong: card.positionLong,
    nationality: p.intl.allegiance ?? p.nationality,
    nation: card.nation,
    look: p.look,
    clubId,
    club: card.clubId ? card.club : clubName(clubId),
    clubColors: colors,
    span: `${seasonLabel(u.startSeason)} – ${seasonLabel(retiredSeason)}`,
    retiredSeason,
    retiredAge: ageOf(p, retiredSeason),
    peak: u.peakOverall,
    legacyScore: Math.round(u.legacy.score),
    legacyTier: u.legacy.tier,
    identity: u.legacy.identity?.label,
    stats: card.stats,
    honours: card.honours.slice(0, 6),
    trophyCount: card.trophyCount,
    awards: card.awards.slice(0, 4),
    ...(cv ? { challenge: { title: cv.def.title, icon: cv.def.icon, won: cv.state.status === "won", weekly: cv.state.weekly } } : {}),
    inductedAt,
  };
}

/** Best legacy first; ties go to the earlier inductee. */
export function rankHallOfFame(entries: HallOfFameEntry[]): HallOfFameEntry[] {
  return [...entries].sort((a, b) => b.legacyScore - a.legacyScore || a.inductedAt.localeCompare(b.inductedAt));
}

/** Insert or refresh a career's entry, keeping the date it was first inducted. */
export function upsertEntry(entries: HallOfFameEntry[], entry: HallOfFameEntry): HallOfFameEntry[] {
  const old = entries.find((e) => e.saveId === entry.saveId);
  const next = entries.filter((e) => e.saveId !== entry.saveId);
  next.push(old ? { ...entry, inductedAt: old.inductedAt } : entry);
  return next;
}
