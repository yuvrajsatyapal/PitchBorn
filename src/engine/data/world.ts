import worldJson from "../../data/world.json";
import type { Club, Country, Dataset, League, Stadium } from "./schema";

/** Static world dataset bundled at build time. */
export const WORLD = worldJson as Dataset;

const clubById = new Map<string, Club>(WORLD.clubs.map((c) => [c.id, c]));
const leagueById = new Map<string, League>(WORLD.leagues.map((l) => [l.id, l]));
const countryByCode = new Map<string, Country>(WORLD.countries.map((c) => [c.code, c]));
const stadiumById = new Map<string, Stadium>(WORLD.stadiums.map((s) => [s.id, s]));

export const REST_OF_WORLD = "row";

export function staticClub(id: string): Club | undefined {
  return clubById.get(id);
}
export function staticLeague(id: string): League | undefined {
  return leagueById.get(id);
}
export function country(code: string): Country | undefined {
  return countryByCode.get(code);
}
export function stadium(id: string): Stadium | undefined {
  return stadiumById.get(id);
}
export function leaguesOf(countryCode: string): League[] {
  return WORLD.leagues.filter((l) => l.countryCode === countryCode).sort((a, b) => a.tier - b.tier);
}
export const LEAGUE_COUNTRIES = [...new Set(WORLD.leagues.map((l) => l.countryCode))];

/** Leagues simulated in a given save (stress tests can run a single-country world). */
export function leaguesInPlay(state: { settings: { countries?: string[] } }): League[] {
  const only = state.settings.countries;
  return only?.length ? WORLD.leagues.filter((l) => only.includes(l.countryCode)) : WORLD.leagues;
}

export function countriesInPlay(state: { settings: { countries?: string[] } }): string[] {
  return [...new Set(leaguesInPlay(state).map((l) => l.countryCode))];
}

export function clubName(id: string | null | undefined, short = false): string {
  if (!id) return "Free agent";
  if (id === REST_OF_WORLD) return "Abroad";
  const c = clubById.get(id);
  if (c) return short ? c.shortName : c.name;
  const nation = countryByCode.get(id);
  return nation ? nation.name : id;
}

export function countryName(code: string | undefined): string {
  return (code && countryByCode.get(code)?.name) || code || "—";
}
