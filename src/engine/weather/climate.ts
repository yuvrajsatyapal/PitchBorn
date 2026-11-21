/**
 * A compact climate model: for each league country, monthly mean temperature (°C), the chance of rain or snow
 * during a match, and the chance of a strong wind, at a reference latitude. Venues further north than the reference
 * are colder (BALANCE.weather.tempPerLatitude). Anything else gets a temperate default; a handful of southern-hemisphere
 * nations use it with the seasons reversed. Rounded long-term averages, not a forecast.
 */
type Twelve = readonly [number, number, number, number, number, number, number, number, number, number, number, number];

export interface Climate {
  /** Latitude the table is measured at. */
  refLat: number;
  temp: Twelve;
  precip: Twelve;
  wind: Twelve;
}

const ENG: Climate = {
  refLat: 52.5,
  temp: [4, 4.5, 6.5, 8.5, 12, 15, 17, 17, 14.5, 11, 7, 4.5],
  precip: [0.42, 0.36, 0.36, 0.33, 0.32, 0.3, 0.3, 0.32, 0.33, 0.4, 0.43, 0.44],
  wind: [0.14, 0.13, 0.12, 0.09, 0.07, 0.05, 0.05, 0.05, 0.07, 0.1, 0.12, 0.14],
};

const ESP: Climate = {
  refLat: 40.4,
  temp: [6.5, 8, 11, 13, 17, 22.5, 26, 25.5, 21, 15, 10, 7],
  precip: [0.22, 0.2, 0.18, 0.22, 0.2, 0.1, 0.04, 0.05, 0.12, 0.22, 0.24, 0.24],
  wind: [0.08, 0.08, 0.09, 0.08, 0.06, 0.05, 0.05, 0.05, 0.05, 0.07, 0.08, 0.08],
};

const ITA: Climate = {
  refLat: 42,
  temp: [8, 9, 11.5, 14, 18, 22.5, 25.5, 25.5, 21.5, 17, 12, 9],
  precip: [0.25, 0.24, 0.22, 0.24, 0.2, 0.12, 0.07, 0.1, 0.18, 0.26, 0.3, 0.28],
  wind: [0.08, 0.08, 0.08, 0.07, 0.05, 0.04, 0.04, 0.04, 0.05, 0.07, 0.08, 0.08],
};

const GER: Climate = {
  refLat: 51,
  temp: [0.5, 1.5, 5, 9, 13.5, 16.5, 18.5, 18, 14, 9.5, 4.5, 1.5],
  precip: [0.4, 0.35, 0.35, 0.32, 0.35, 0.36, 0.36, 0.34, 0.3, 0.32, 0.38, 0.42],
  wind: [0.13, 0.12, 0.11, 0.08, 0.06, 0.05, 0.05, 0.05, 0.07, 0.1, 0.12, 0.13],
};

const FRA: Climate = {
  refLat: 47,
  temp: [4.5, 5.5, 8.5, 11, 15, 18.5, 21, 20.5, 17, 13, 8, 5],
  precip: [0.34, 0.3, 0.3, 0.3, 0.3, 0.24, 0.18, 0.2, 0.24, 0.32, 0.36, 0.36],
  wind: [0.11, 0.1, 0.1, 0.08, 0.06, 0.05, 0.05, 0.05, 0.06, 0.09, 0.1, 0.11],
};

/** Mid-latitude, maritime-to-continental: used for every nation without its own table. */
export const TEMPERATE: Climate = {
  refLat: 48,
  temp: [3, 4, 7.5, 11, 15, 18.5, 20.5, 20, 16.5, 12, 7, 4],
  precip: [0.34, 0.31, 0.3, 0.3, 0.3, 0.27, 0.24, 0.25, 0.27, 0.32, 0.36, 0.36],
  wind: [0.11, 0.1, 0.1, 0.08, 0.06, 0.05, 0.05, 0.05, 0.06, 0.09, 0.1, 0.11],
};

const TABLES: Record<string, Climate> = { ENG, ESP, ITA, GER, FRA };

/** Nations whose seasons run the other way round. */
const SOUTHERN = new Set(["BRA", "ARG", "URU", "CHI", "PAR", "AUS", "NZL", "RSA"]);

export function climateFor(countryCode: string | undefined): Climate {
  return (countryCode && TABLES[countryCode]) || TEMPERATE;
}

/** The climate month to read for a calendar month (0-11): southern nations are six months out. */
export function climateMonth(countryCode: string | undefined, month: number): number {
  return countryCode && SOUTHERN.has(countryCode) ? (month + 6) % 12 : month;
}
