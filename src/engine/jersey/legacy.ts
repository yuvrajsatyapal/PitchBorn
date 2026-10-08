import { clubName } from "../data/world";
import type { GameState, LegacyResult } from "../types";
import { addNews, userPlayer } from "../world/helpers";
import { jerseyOf, tenureSeasons } from "./numbers";

/** Seasons a number needs before it can be called iconic, together with real success. */
export const ICONIC_MIN_SEASONS = 5;
/** Seasons in one number at one club, with the rest below, before the club may retire it. Deliberately hard. */
export const RETIRE_MIN_SEASONS = 8;

interface NumberUse {
  no: number;
  seasons: number;
  clubs: string[];
  perClub: Map<string, number>;
}

function usage(state: GameState): NumberUse[] {
  const now = { season: state.season, turn: state.turn };
  const by = new Map<number, NumberUse>();
  for (const t of jerseyOf(state).history) {
    const u = by.get(t.no) ?? { no: t.no, seasons: 0, clubs: [], perClub: new Map<string, number>() };
    const s = tenureSeasons(t, now);
    u.seasons += s;
    if (!u.clubs.includes(t.clubId)) u.clubs.push(t.clubId);
    u.perClub.set(t.clubId, (u.perClub.get(t.clubId) ?? 0) + s);
    by.set(t.no, u);
  }
  return [...by.values()].sort((a, b) => b.seasons - a.seasons);
}

/** The shirt most tied to the career, only when long use and real success both support calling it iconic. */
export function iconicNumber(state: GameState): LegacyResult["iconicNumber"] | undefined {
  const p = userPlayer(state);
  const top = usage(state)[0];
  if (!top || top.seasons < ICONIC_MIN_SEASONS) return undefined;
  const success = p.career.apps >= 150 || state.user.trophies.length >= 2 || state.user.awards.some((a) => a.id !== "totw") || p.reputation >= 75;
  if (!success) return undefined;
  const lines = [`Worn for ${top.seasons} seasons`];
  const home = [...top.perClub.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top.clubs.length > 1) lines.push(`Clubs: ${top.clubs.map((c) => clubName(c, true)).join(", ")}`);
  if (home && home[1] >= ICONIC_MIN_SEASONS && state.user.relationships.supporters >= 70) lines.push(`The #${top.no} shirt became synonymous with ${p.firstName} ${p.lastName} during the years at ${clubName(home[0])}.`);
  return { no: top.no, seasons: top.seasons, clubs: top.clubs, lines };
}

/** A club retires a number only for an exceptional, long career with it: rare by construction. */
export function retireNumberHonour(state: GameState): { no: number; clubId: string } | undefined {
  const p = userPlayer(state);
  const clubId = p.clubId;
  if (!clubId || p.squadNo === undefined) return undefined;
  const club = state.clubs[clubId];
  const here = usage(state).find((u) => u.no === p.squadNo);
  const seasons = here?.perClub.get(clubId) ?? 0;
  const clubApps = p.history.filter((h) => h.clubId === clubId).reduce((n, h) => n + h.stats.apps, 0);
  const trophies = state.user.trophies.filter((t) => t.clubId === clubId).length;
  const awards = state.user.awards.filter((a) => a.id !== "totw" && a.id !== "potm").length;
  if (seasons < RETIRE_MIN_SEASONS || clubApps < 300 || trophies < 3 || awards < 2 || state.user.relationships.supporters < 85) return undefined;
  if (club.retiredNumbers?.some((r) => r.no === p.squadNo)) return undefined;
  (club.retiredNumbers ??= []).push({ no: p.squadNo, playerId: p.id, season: state.season });
  addNews(state, { kind: "career", title: "Shirt retired", body: `${clubName(clubId)} will never again issue the #${p.squadNo} shirt in honour of ${p.firstName} ${p.lastName}.`, important: true });
  return { no: p.squadNo, clubId };
}
