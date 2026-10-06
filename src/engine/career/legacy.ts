import { clubName, staticLeague } from "../data/world";
import { positionGroup } from "../players/attributes";
import { ageOf } from "../players/generate";
import type { GameState, LegacyResult } from "../types";
import { userPlayer } from "../world/helpers";

export const LEGACY_TIERS: [number, string][] = [
  [650, "All-Time Great"],
  [450, "Legend"],
  [300, "Icon"],
  [200, "Star"],
  [120, "Club Hero"],
  [60, "Respected Professional"],
  [0, "Journeyman Pro"],
];

export function legacyTier(score: number): string {
  return LEGACY_TIERS.find(([min]) => score >= min)?.[1] ?? "Journeyman Pro";
}

function clubSpans(state: GameState): { clubId: string; seasons: number }[] {
  const p = userPlayer(state);
  const spans = new Map<string, number>();
  for (const h of p.history) if (h.clubId && h.stats.apps > 0) spans.set(h.clubId, (spans.get(h.clubId) ?? 0) + 1);
  return [...spans.entries()].map(([clubId, seasons]) => ({ clubId, seasons })).sort((a, b) => b.seasons - a.seasons);
}

/** Emergent career narratives derived from what actually happened. */
export function careerStories(state: GameState): string[] {
  const p = userPlayer(state);
  const u = state.user;
  const stories: string[] = [];
  const hist = p.history;
  const spans = clubSpans(state);
  const peak = u.peakOverall;
  const peakAge = ageOf(p, u.peakSeason);
  const early = hist.find((h) => h.age <= 20 && h.stats.apps >= 20 && h.stats.ratingSum / Math.max(1, h.stats.apps) >= 7);
  const golden = u.awards.filter((a) => a.id === "golden-pitch").length;
  const tierAtStart = u.startTier;
  const reachedTop = hist.some((h) => h.leagueId && staticLeague(h.leagueId)?.tier === 1 && h.stats.apps >= 10);
  const majorTournament = u.trophies.some((t) => t.kind === "international");
  const serious = u.injuryHistory.filter((i) => i.weeks >= 12);

  if (early || u.awards.some((a) => a.id === "rising-star")) stories.push("Wonderkid — a teenage sensation who announced themselves early.");
  if (peakAge >= 28 && hist.length >= 6 && peak - (hist[2]?.overall ?? peak) >= 10) stories.push("Late Bloomer — the best came after most had written them off.");
  if (spans[0] && spans[0].seasons >= 10 && spans.length <= 2) stories.push(`One-Club Legend — ${spans[0].seasons} seasons in the colours of ${clubName(spans[0].clubId)}.`);
  if (spans.length >= 6) stories.push(`Journeyman — ${spans.length} clubs, a career lived out of a suitcase.`);
  if (serious.length && hist.some((h) => h.season > serious[0].season && h.stats.apps >= 25 && h.stats.ratingSum / Math.max(1, h.stats.apps) >= 7)) stories.push("Injury Comeback — fought back from a career-threatening injury.");
  if (golden >= 1 || p.reputation >= 92) stories.push(golden >= 3 ? `Superstar — ${golden} Golden Pitch awards; one of the faces of the sport.` : "Superstar — the world knew the name.");
  if (p.hidden.potential >= 86 && peak < 72) stories.push("Failed Prospect — the potential was there, the career never quite followed.");
  if (majorTournament || p.intl.caps >= 100 || p.intl.goals >= 40) stories.push(majorTournament ? "International Hero — lifted a major international trophy." : `International Hero — ${p.intl.caps} caps for ${p.intl.tiedTo ?? p.nationality}.`);
  if (tierAtStart >= 3 && reachedTop) stories.push("Lower-League Rise — from the third tier to the top flight.");
  const lastSeasons = hist.slice(-3);
  if (lastSeasons.length === 3 && lastSeasons.every((h) => h.age >= 33 && h.stats.apps >= 18)) stories.push("Veteran Leader — still starting week in, week out deep into their thirties.");
  if (!stories.length) stories.push("A professional career — earned every minute on the pitch.");
  return stories;
}

export function computeLegacy(state: GameState): LegacyResult {
  const p = userPlayer(state);
  const u = state.user;
  const c = p.career;
  const def = ["GK", "DEF"].includes(positionGroup(p.position));
  const parts: { label: string; points: number }[] = [];
  const add = (label: string, points: number) => {
    if (points > 0.5) parts.push({ label, points: Math.round(points) });
  };
  add(`${c.apps} appearances`, c.apps * 0.08);
  add(`${c.goals} goals`, c.goals * (def ? 0.45 : 0.22));
  add(`${c.assists} assists`, c.assists * 0.13);
  if (def) add(`${c.cleanSheets} clean sheets`, c.cleanSheets * 0.12);
  let trophyPts = 0;
  for (const t of u.trophies) {
    if (t.kind === "league") trophyPts += t.compId.match(/-1-/) ? 12 : 4;
    else if (t.kind === "continental") trophyPts += t.compId.startsWith("ccup") ? 20 : 8;
    else if (t.kind === "international") trophyPts += t.compId.startsWith("world") ? 30 : 22;
    else trophyPts += 5;
  }
  add(`${u.trophies.length} trophies`, trophyPts);
  const awardPts: Record<string, number> = {
    "golden-pitch": 40, "golden-pitch-podium": 12, "rising-star": 10, pots: 10, ypots: 4, topscorer: 8, topassist: 4, goldenglove: 6,
    "world-glove": 15, tots: 3, potm: 1, totw: 0.15,
  };
  const awards = u.awards.reduce((s, a) => s + (awardPts[a.id] ?? 1), 0);
  add(`${u.awards.filter((a) => a.id !== "totw").length} individual awards`, awards);
  add(`${p.intl.caps} international caps`, p.intl.caps * 0.3 + p.intl.goals * 0.4);
  add(`Peak ability ${u.peakOverall}`, Math.max(0, u.peakOverall - 60) * 2.2);
  const seasons = p.history.filter((h) => h.stats.apps > 0).length;
  add(`${seasons} seasons`, seasons * 1.5);
  const spans = clubSpans(state);
  if (spans[0] && spans[0].seasons >= 8) add(`Loyalty: ${spans[0].seasons} seasons at ${clubName(spans[0].clubId)}`, (spans[0].seasons - 7) * 4);
  add(`Reputation ${Math.round(p.reputation)}`, p.reputation * 0.3);
  const records = state.records.filter((r) => r.playerId === p.id).length;
  add(`${records} world records`, records * 15);
  const score = parts.reduce((s, x) => s + x.points, 0);
  const tier = legacyTier(score);
  const stories = careerStories(state);
  const headline = `${p.firstName} ${p.lastName}: ${tier}`;
  return { score, tier, breakdown: parts.sort((a, b) => b.points - a.points), stories, headline };
}
