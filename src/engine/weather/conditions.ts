/**
 * Deterministic weather and pitch for a fixture. The roll uses a stream of its own (world seed + fixture id), so it
 * never reads or moves the world RNG, and nothing else in the save can change it.
 */
import { BALANCE } from "../balance";
import { turnDate } from "../calendar";
import { country, stadium, staticClub } from "../data/world";
import { Rng } from "../rng";
import type { Fixture, GameState, MatchConditions, PitchKind, WeatherKind } from "../types";
import { climateFor, climateMonth } from "./climate";

const W = BALANCE.weather;

/** Where a match is played, as far as the weather is concerned. */
export interface Venue {
  countryCode?: string;
  lat?: number;
}

export function venueOf(fixture: Pick<Fixture, "home">): Venue {
  const club = staticClub(fixture.home);
  if (club) {
    const st = stadium(club.stadiumId);
    return { countryCode: st?.countryCode ?? club.countryCode, lat: st?.lat };
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
  return { weather, tempC, pitch };
}

/** The conditions a fixture is played in. */
export function conditionsFor(state: Pick<GameState, "seed" | "season">, fixture: Pick<Fixture, "id" | "home" | "turn">): MatchConditions {
  // The week's date, not the match day: days are assigned during the week and must never change the weather.
  const month = turnDate(state.season, fixture.turn).getUTCMonth();
  return rollConditions(state.seed, fixture.id, venueOf(fixture), month);
}

/** Clear weather on a good pitch: the baseline, with no effect at all. */
export function isNeutral(c: MatchConditions | undefined): boolean {
  return !c || (c.weather === "clear" && c.pitch === "good");
}
