/** How long a player has been at his current club. NPC season history is capped, so the join season is kept on the player. */
import type { Player } from "../types";

type Stay = Pick<Player, "clubId" | "history" | "clubSince">;

/** Consecutive recorded seasons at `clubId`, newest first (history only goes back a few years for NPCs). */
function recordedSeasons(p: Stay, season: number): { n: number; includesCurrent: boolean } {
  let n = 0;
  for (let i = p.history.length - 1; i >= 0 && p.history[i].clubId === p.clubId; i--) n++;
  return { n, includesCurrent: p.history.length > 0 && p.history[p.history.length - 1].season === season };
}

/** Seasons at the current club, counting the current one (0 for a free agent). */
export function clubTenure(p: Stay, season: number): number {
  if (!p.clubId) return 0;
  if (p.clubSince && p.clubSince.clubId === p.clubId) return Math.max(1, season - p.clubSince.season + 1);
  const r = recordedSeasons(p, season);
  return r.includesCurrent ? r.n : r.n + 1;
}

/** Keeps the join season in step with the player's club. Run once a season, so a mid-season move is dated to the season it happened in. */
export function trackClub(p: Stay, season: number): void {
  if (!p.clubId) {
    delete p.clubSince;
    return;
  }
  if (p.clubSince?.clubId === p.clubId) return;
  const r = recordedSeasons(p, season);
  // A new arrival has no recorded seasons here; a long-serving player seen for the first time is dated from his history.
  p.clubSince = { clubId: p.clubId, season: season - (r.includesCurrent ? r.n - 1 : r.n) };
}
