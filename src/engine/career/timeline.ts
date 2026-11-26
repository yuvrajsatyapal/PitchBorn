/**
 * The career timeline recap: one frame per season (club, age, overall, apps, goals, assists, rating, trophies and awards),
 * from the season history plus the season in progress. Pure data for the animated recap and its export.
 */
import { seasonLabel } from "../calendar";
import { clubName, staticClub } from "../data/world";
import { overallFor } from "../players/attributes";
import { ageOf, avgRating } from "../players/generate";
import type { GameState } from "../types";
import { totalSeason } from "../season/awards";
import { fullName, userPlayer } from "../world/helpers";

export interface TimelineFrame {
  season: number;
  label: string;
  club: string;
  colors: { primary: string; secondary: string };
  age: number;
  overall: number;
  apps: number;
  goals: number;
  assists: number;
  rating: number | null;
  trophies: string[];
  awards: string[];
  current: boolean;
}

export interface TimelineRecap {
  name: string;
  position: string;
  frames: TimelineFrame[];
  totals: { apps: number; goals: number; assists: number; trophies: number; peak: number };
}

const FALLBACK = { primary: "#6d4aa8", secondary: "#ffc62b" };

export function timelineRecap(state: GameState): TimelineRecap {
  const p = userPlayer(state);
  const u = state.user;
  const frames: TimelineFrame[] = p.history.map((h) => ({
    season: h.season,
    label: seasonLabel(h.season),
    club: h.clubId ? clubName(h.clubId, true) : "Free agent",
    colors: (h.clubId && staticClub(h.clubId)?.colors) || FALLBACK,
    age: h.age,
    overall: h.overall,
    apps: h.stats.apps,
    goals: h.stats.goals,
    assists: h.stats.assists,
    rating: h.stats.apps ? Math.round(avgRating(h.stats) * 100) / 100 : null,
    trophies: u.trophies.filter((t) => t.season === h.season).map((t) => t.name),
    awards: u.awards.filter((a) => a.season === h.season && a.playerId === p.id).map((a) => a.name),
    current: false,
  }));
  const now = totalSeason(p);
  if (!u.retired && !p.history.some((h) => h.season === state.season)) {
    frames.push({
      season: state.season,
      label: seasonLabel(state.season),
      club: p.clubId ? clubName(p.clubId, true) : "Free agent",
      colors: (p.clubId && staticClub(p.clubId)?.colors) || FALLBACK,
      age: ageOf(p, state.season),
      overall: Math.round(overallFor(p.attrs, p.position)),
      apps: now.apps,
      goals: now.goals,
      assists: now.assists,
      rating: now.apps ? Math.round(avgRating(now) * 100) / 100 : null,
      trophies: u.trophies.filter((t) => t.season === state.season).map((t) => t.name),
      awards: [],
      current: true,
    });
  }
  return {
    name: fullName(p),
    position: p.position,
    frames,
    totals: {
      apps: frames.reduce((s, f) => s + f.apps, 0),
      goals: frames.reduce((s, f) => s + f.goals, 0),
      assists: frames.reduce((s, f) => s + f.assists, 0),
      trophies: u.trophies.length,
      peak: Math.max(u.peakOverall, ...frames.map((f) => f.overall)),
    },
  };
}
