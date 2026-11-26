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

// ------------------------------------------------------------------ comparing careers

/** A stat from an entry's card as a number (absent or "–" counts as 0). */
export function statValue(e: HallOfFameEntry, label: string): number {
  const v = e.stats.find((s) => s.label === label)?.value;
  const n = v === undefined ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export interface CompareRow {
  label: string;
  a: number;
  b: number;
  /** Which side is better: "a", "b" or "tie". */
  better: "a" | "b" | "tie";
  decimals?: number;
}

const ROW_LABELS: { label: string; get: (e: HallOfFameEntry) => number; decimals?: number }[] = [
  { label: "Legacy", get: (e) => e.legacyScore },
  { label: "Peak overall", get: (e) => e.peak },
  { label: "Apps", get: (e) => statValue(e, "Apps") },
  { label: "Goals", get: (e) => statValue(e, "Goals") },
  { label: "Assists", get: (e) => statValue(e, "Assists") },
  { label: "Clean sheets", get: (e) => statValue(e, "Clean sheets") },
  { label: "Avg rating", get: (e) => statValue(e, "Avg rating"), decimals: 2 },
  { label: "Caps", get: (e) => statValue(e, "Caps") },
  { label: "Trophies", get: (e) => e.trophyCount },
  { label: "Season awards", get: (e) => e.awards.length },
];

/** Side by side: every row both careers have something in, with the better side marked. */
export function compareEntries(a: HallOfFameEntry, b: HallOfFameEntry): CompareRow[] {
  return ROW_LABELS.map((r) => {
    const x = r.get(a);
    const y = r.get(b);
    return { label: r.label, a: x, b: y, better: x === y ? "tie" : x > y ? "a" : "b", decimals: r.decimals } as CompareRow;
  }).filter((r) => r.a > 0 || r.b > 0);
}

export interface AllTimeRecord {
  label: string;
  value: string;
  name: string;
  saveId: string;
}

/** The best mark in the Hall for each stat. */
export function allTimeRecords(entries: HallOfFameEntry[]): AllTimeRecord[] {
  const out: AllTimeRecord[] = [];
  for (const r of ROW_LABELS) {
    let best: HallOfFameEntry | undefined;
    for (const e of entries) if (r.get(e) > 0 && (!best || r.get(e) > r.get(best))) best = e;
    if (best) out.push({ label: r.label, value: r.decimals ? r.get(best).toFixed(r.decimals) : String(Math.round(r.get(best))), name: best.name, saveId: best.saveId });
  }
  return out;
}

/** 4-3-3 slots, with the positions that can fill each one in order of preference. */
const XI_SLOTS: { slot: string; fits: string[] }[] = [
  { slot: "GK", fits: ["GK"] },
  { slot: "RB", fits: ["RB", "LB", "CB"] },
  { slot: "CB", fits: ["CB", "DM"] },
  { slot: "CB", fits: ["CB", "DM", "RB", "LB"] },
  { slot: "LB", fits: ["LB", "RB", "CB"] },
  { slot: "CM", fits: ["CM", "DM", "AM"] },
  { slot: "CM", fits: ["CM", "AM", "DM"] },
  { slot: "AM", fits: ["AM", "CM", "RW", "LW"] },
  { slot: "RW", fits: ["RW", "LW", "AM", "ST"] },
  { slot: "ST", fits: ["ST", "RW", "LW", "AM"] },
  { slot: "LW", fits: ["LW", "RW", "AM", "ST"] },
];

/** The greatest XI from the Hall: natural positions are filled first by highest legacy, then gaps by the best fit left. */
export function greatestXI(entries: HallOfFameEntry[]): { slot: string; entry?: HallOfFameEntry; natural: boolean }[] {
  const used = new Set<string>();
  const ranked = rankHallOfFame(entries);
  const out: { slot: string; entry?: HallOfFameEntry; natural: boolean }[] = XI_SLOTS.map(({ slot }) => ({ slot, natural: false }));
  XI_SLOTS.forEach(({ fits }, i) => {
    const e = ranked.find((x) => !used.has(x.saveId) && x.position === fits[0]);
    if (e) {
      used.add(e.saveId);
      out[i] = { slot: out[i].slot, entry: e, natural: true };
    }
  });
  XI_SLOTS.forEach(({ fits }, i) => {
    if (out[i].entry) return;
    for (const pos of fits.slice(1)) {
      const e = ranked.find((x) => !used.has(x.saveId) && x.position === pos);
      if (e) {
        used.add(e.saveId);
        out[i] = { slot: out[i].slot, entry: e, natural: false };
        return;
      }
    }
  });
  return out;
}
