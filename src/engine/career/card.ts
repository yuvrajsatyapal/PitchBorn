/**
 * The facts on a shareable career card, gathered once so the picture, the caption and the tests agree.
 * Pure: no React, no DOM.
 */
import { achievementScore } from "./achievements";
import { seasonLabel } from "../calendar";
import { clubName, country, staticClub } from "../data/world";
import { overallFor, POSITION_LABEL } from "../players/attributes";
import { ageOf, avgRating } from "../players/generate";
import type { GameState } from "../types";
import { fullName, userPlayer } from "../world/helpers";

export interface CardStat {
  label: string;
  value: string;
}

export interface CareerCardData {
  name: string;
  position: string;
  positionLong: string;
  nation: string;
  age: number;
  overall: number;
  peak: number;
  clubId: string | null;
  club: string;
  clubColors: { primary: string; secondary: string };
  span: string;
  retired: boolean;
  headline: string;
  stats: CardStat[];
  /** Grouped honours, most first: "3× Premier League". */
  honours: string[];
  trophyCount: number;
  awards: string[];
  achievements: { count: number; total: number };
}

const FALLBACK = { primary: "#6d4aa8", secondary: "#ffc62b" };

export function careerCardData(state: GameState): CareerCardData {
  const p = userPlayer(state);
  const u = state.user;
  const retired = !!u.retired;
  const gk = p.position === "GK";
  const c = p.career;
  // A retired player is shown with the club he played most games for.
  const clubApps = new Map<string, number>();
  for (const h of p.history) if (h.clubId && h.stats.apps > 0) clubApps.set(h.clubId, (clubApps.get(h.clubId) ?? 0) + h.stats.apps);
  const mainClub = [...clubApps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const clubId = retired ? mainClub : p.clubId ?? mainClub;
  const colors = (clubId ? staticClub(clubId)?.colors : undefined) ?? FALLBACK;

  const grouped = new Map<string, number>();
  for (const t of u.trophies) grouped.set(t.name, (grouped.get(t.name) ?? 0) + 1);
  const honours = [...grouped.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n, k]) => (k > 1 ? `${k}× ${n}` : n));

  const awardNames = new Map<string, number>();
  for (const a of u.awards) if (a.id !== "totw" && a.id !== "potm") awardNames.set(a.name, (awardNames.get(a.name) ?? 0) + 1);
  const awards = [...awardNames.entries()].sort((a, b) => b[1] - a[1]).map(([n, k]) => (k > 1 ? `${k}× ${n}` : n));

  const stats: CardStat[] = [
    { label: "Apps", value: String(c.apps) },
    gk ? { label: "Clean sheets", value: String(c.cleanSheets) } : { label: "Goals", value: String(c.goals) },
    gk ? { label: "Saves", value: String(c.saves) } : { label: "Assists", value: String(c.assists) },
    { label: "Avg rating", value: c.apps ? avgRating(c).toFixed(2) : "–" },
    { label: "Caps", value: String(p.intl.caps) },
    { label: "Trophies", value: String(u.trophies.length) },
  ];
  const score = achievementScore(state);
  const end = retired ? u.retiredSeason ?? state.season : state.season;
  const code = p.intl.allegiance ?? p.nationality;
  const headline = retired && u.legacy ? `${u.legacy.tier} · Legacy ${Math.round(u.legacy.score)}` : `${seasonLabel(state.season)} · ${clubName(p.clubId)}`;
  return {
    name: fullName(p),
    position: p.position,
    positionLong: POSITION_LABEL[p.position],
    nation: country(code)?.name ?? code,
    age: ageOf(p, state.season),
    overall: Math.round(overallFor(p.attrs, p.position)),
    peak: u.peakOverall,
    clubId,
    club: clubId ? clubName(clubId) : "Free agent",
    clubColors: colors,
    span: `${seasonLabel(u.startSeason)} – ${retired ? seasonLabel(end) : "present"}`,
    retired,
    headline,
    stats,
    honours,
    trophyCount: u.trophies.length,
    awards,
    achievements: { count: score.count, total: score.total },
  };
}

/** A short text version for sharing alongside the image. */
export function careerCaption(d: CareerCardData, url?: string): string {
  const lines = [
    `${d.name} — ${d.positionLong}, ${d.nation}`,
    `${d.retired ? "Career" : "So far"}: ${d.stats.map((s) => `${s.value} ${s.value === "1" ? s.label.toLowerCase().replace(/s$/, "") : s.label.toLowerCase()}`).join(" · ")}`,
  ];
  if (d.honours.length) lines.push(`Honours: ${d.honours.slice(0, 4).join(", ")}`);
  lines.push(`My PitchBorn career${url ? `: ${url}` : ""}`);
  return lines.join("\n");
}
