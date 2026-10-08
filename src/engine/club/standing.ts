/**
 * A club's place in the season, read from the live standings. Nothing here is stored.
 */
import { BALANCE } from "../balance";
import { staticClub, staticLeague } from "../data/world";
import { leagueCompId } from "../competitions/setup";
import type { Competition, GameState, TableRow } from "../types";

export type Zone = "title" | "continental" | "promotion" | "safe" | "relegation" | "preseason";

export interface Standing {
  leagueId: string;
  leagueName: string;
  tier: number;
  size: number;
  comp: Competition | undefined;
  row: TableRow | undefined;
  position: number | null;
  points: number;
  played: number;
  goalDifference: number;
  form: ("W" | "D" | "L")[];
  zone: Zone;
  /** One honest sentence on what the position means right now. */
  situation: string;
  /** Places that qualify for each continental competition in this league. */
  slots: { champions: number; continental: number };
  promoted: number;
  relegated: number;
  preseason: boolean;
  leader: { team: string; points: number } | null;
}

/** Continental places by country, matching continentalQualifiers() in competitions/setup.ts. */
export function continentalSlots(countryCode: string, tier: number): { champions: number; continental: number } {
  if (tier !== 1) return { champions: 0, continental: 0 };
  if (countryCode === "ENG") return { champions: 4, continental: 2 };
  if (countryCode === "ESP" || countryCode === "ITA") return { champions: 3, continental: 4 };
  return { champions: 3, continental: 3 };
}

export function standingOf(state: GameState, clubId: string): Standing | null {
  const club = state.clubs[clubId];
  if (!club) return null;
  const lg = staticLeague(club.leagueId);
  if (!lg) return null;
  const comp = state.competitions[leagueCompId(club.leagueId, state.season)];
  const table = comp?.table ?? [];
  const idx = table.findIndex((r) => r.team === clubId);
  const row = idx >= 0 ? table[idx] : undefined;
  const slots = continentalSlots(lg.countryCode, lg.tier);
  const preseason = !row || row.played === 0;
  const position = row && !preseason ? idx + 1 : null;
  const n = table.length || lg.size;
  let zone: Zone = "safe";
  let situation = "";
  if (preseason) {
    zone = "preseason";
    situation = state.turn >= BALANCE.calendar.seasonStart ? "The season is under way: no league games played yet." : "Preseason: the table fills in once the league starts.";
  } else if (position !== null) {
    const leader = table[0];
    if (position === 1) {
      zone = lg.tier === 1 ? "title" : "promotion";
      situation = `Top of the table${table[1] ? `, ${row!.points - table[1].points} point${row!.points - table[1].points === 1 ? "" : "s"} clear` : ""}.`;
    } else if (lg.tier === 1 && position <= slots.champions + slots.continental) {
      zone = "continental";
      situation = position <= slots.champions ? `In a Champions Cup place (${slots.champions} qualify).` : `In a Continental Cup place (places ${slots.champions + 1}–${slots.champions + slots.continental}).`;
    } else if (lg.tier > 1 && position <= lg.promoted) {
      zone = "promotion";
      situation = `In an automatic promotion place (top ${lg.promoted}).`;
    } else if (lg.relegated > 0 && position > n - lg.relegated) {
      zone = "relegation";
      const safe = table[n - lg.relegated - 1];
      situation = `In the relegation zone${safe ? `, ${safe.points - row!.points} point${safe.points - row!.points === 1 ? "" : "s"} from safety` : ""}.`;
    } else {
      const firstDown = lg.relegated > 0 ? table[n - lg.relegated] : undefined;
      const cushion = firstDown ? row!.points - firstDown.points : null;
      const promoLine = lg.tier > 1 ? table[lg.promoted - 1] : undefined;
      if (lg.tier === 1 && position === slots.champions + slots.continental + 1) situation = "Just outside the continental places.";
      else if (lg.tier > 1 && position <= lg.promoted + 2 && promoLine) situation = `${promoLine.points - row!.points} point${promoLine.points - row!.points === 1 ? "" : "s"} off the automatic promotion places.`;
      else if (cushion !== null && cushion <= 4) situation = `Only ${cushion} point${cushion === 1 ? "" : "s"} above the relegation zone.`;
      else if (cushion !== null && position > n / 2) situation = `Lower half, ${cushion} points clear of the relegation zone.`;
      else situation = position <= n / 2 ? "In the top half, clear of danger." : "Lower half of the table.";
    }
    void leader;
  }
  return {
    leagueId: club.leagueId,
    leagueName: lg.name,
    tier: lg.tier,
    size: n,
    comp,
    row,
    position,
    points: row?.points ?? 0,
    played: row?.played ?? 0,
    goalDifference: row ? row.gf - row.ga : 0,
    form: row?.form ?? [],
    zone,
    situation,
    slots,
    promoted: lg.promoted,
    relegated: lg.relegated,
    preseason,
    leader: table[0] ? { team: table[0].team, points: table[0].points } : null,
  };
}

/** Last five results of the club in any competition this season, newest last. */
export function recentFiveForm(state: GameState, clubId: string): ("W" | "D" | "L")[] {
  return (state.clubs[clubId]?.form ?? []).slice(-5);
}

export { staticClub };
