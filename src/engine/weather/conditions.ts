/**
 * Deterministic weather and pitch for a fixture. The roll uses a stream of its own (world seed + fixture id), so it
 * never reads or moves the world RNG, and nothing else in the save can change it.
 */
import { BALANCE } from "../balance";
import { turnDate } from "../calendar";
import { country, stadium, staticClub } from "../data/world";
import { Rng } from "../rng";
import type { Competition, Fixture, GameState, MatchConditions, PitchKind, WeatherKind } from "../types";
import { climateFor, climateMonth } from "./climate";

const W = BALANCE.weather;

/** Where a match is played, as far as the weather is concerned. */
export interface Venue {
  countryCode?: string;
  lat?: number;
  /** The stadium has a retractable roof, closed in bad weather. */
  roof?: boolean;
}

/** Real stadiums with a retractable roof. */
export const ROOF_STADIUMS: ReadonlySet<string> = new Set(["bernabeu", "arena-aufschalke", "merkur-spiel-arena", "pierre-mauroy-stadium"]);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The country hosting an international tournament: fixed by the competition alone, so old saves agree with new ones. */
export function hostOf(comp: Pick<Competition, "id" | "teams">): string | undefined {
  const teams = [...comp.teams].sort();
  return teams.length ? teams[hash(comp.id) % teams.length] : undefined;
}

export function venueOf(fixture: Pick<Fixture, "home"> & Partial<Pick<Fixture, "neutral">>, comp?: Pick<Competition, "id" | "kind" | "teams">): Venue {
  const club = staticClub(fixture.home);
  if (fixture.neutral) {
    // Tournament games are played in the host nation; a domestic final at the national stadium (the country's climate).
    if (comp && (comp.kind === "international" || comp.kind === "friendly") && !club) return { countryCode: hostOf(comp) };
    if (club) return { countryCode: club.countryCode };
  }
  if (club) {
    const st = stadium(club.stadiumId);
    return { countryCode: st?.countryCode ?? club.countryCode, lat: st?.lat, roof: ROOF_STADIUMS.has(club.stadiumId) };
  }
  // A national team at home: that country's climate at its reference latitude.
  return { countryCode: country(fixture.home)?.code ?? fixture.home };
}

/** The pure roll: same inputs, same conditions. `month` is 0-11. */
export function rollConditions(seed: string, fixtureId: string, venue: Venue, month: number): MatchConditions {
  const rng = Rng.fromSeed(`${seed}:wx:${fixtureId}`);
  const climate = climateFor(venue.countryCode);
  const m = climateMonth(venue.countryCode, ((month % 12) + 12) % 12);
  const latShift = venue.lat !== undefined ? (climate.refLat - venue.lat) * W.tempPerLatitude : 0;
  // Every draw is taken in the same order whatever happens, so changing one threshold never reshuffles the rest.
  const noise = rng.normal(0, W.tempSd);
  const precipRoll = rng.next();
  const heavyRoll = rng.next();
  const windRoll = rng.next();
  const pitchRoll = rng.next();
  const tempC = Math.round((climate.temp[m] + latShift + noise) * 10) / 10;

  let weather: WeatherKind;
  if (tempC >= W.heatC) weather = "heat";
  else if (precipRoll < climate.precip[m]) weather = tempC <= W.snowMaxC ? "snow" : heavyRoll < W.heavyRainShare ? "heavy-rain" : "rain";
  else if (windRoll < climate.wind[m]) weather = "wind";
  else weather = "clear";

  let pitch: PitchKind = "good";
  if (tempC <= W.frozenMaxC && (weather === "snow" || pitchRoll < W.frozenChance)) pitch = "frozen";
  else if (weather === "heavy-rain" || (weather === "rain" && pitchRoll < W.rainHeavyPitch)) pitch = "heavy";
  else if (weather === "heat" || (weather === "clear" && tempC >= W.dryPitchC)) pitch = "dry";
  // Under a closed roof the game plays in the dry and the warmth, whatever it's doing outside.
  if (venue.roof && (weather === "rain" || weather === "heavy-rain" || weather === "snow" || weather === "wind" || tempC < W.roofC - 6 || pitch === "frozen")) return { weather: "clear", tempC: W.roofC, pitch: "good", roof: { outside: weather, tempC } };
  return { weather, tempC, pitch };
}

/** The conditions a fixture is played in. */
export function conditionsFor(
  state: Pick<GameState, "seed" | "season"> & { competitions?: GameState["competitions"] },
  fixture: Pick<Fixture, "id" | "home" | "turn"> & Partial<Pick<Fixture, "neutral" | "compId" | "postponed">>,
): MatchConditions {
  // The week's date, not the match day: days are assigned during the week and must never change the weather.
  const month = turnDate(state.season, fixture.turn).getUTCMonth();
  const comp = fixture.compId ? state.competitions?.[fixture.compId] : undefined;
  // A rearranged match gets fresh weather of its own.
  const key = fixture.postponed ? `${fixture.id}:pp${fixture.postponed}` : fixture.id;
  return rollConditions(state.seed, key, venueOf(fixture, comp), month);
}

/** A frozen pitch with snow falling or a deep frost is unplayable. */
export function unplayable(c: MatchConditions): boolean {
  return c.pitch === "frozen" && (c.weather === "snow" || c.tempC <= W.postponeC);
}

/** Clear weather on a good pitch: the baseline, with no effect at all. */
export function isNeutral(c: MatchConditions | undefined): boolean {
  return !c || (c.weather === "clear" && c.pitch === "good");
}
