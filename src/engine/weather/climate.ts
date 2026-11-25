/**
 * A compact climate model: for each league country, monthly mean temperature (°C), the chance of rain or snow
 * during a match, and the chance of a strong wind, at a reference latitude. Venues further north than the reference
 * are colder (BALANCE.weather.tempPerLatitude). Every national side has a regional table too; anything else gets a temperate
 * default (a few southern-hemisphere nations with the seasons reversed). Rounded long-term averages, not a forecast.
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

// The national sides' home climates, by region, at the capital or main football city. All in calendar months, southern
// hemisphere included (their tables already run summer in January).
const c = (refLat: number, temp: Twelve, precip: Twelve, wind: Twelve): Climate => ({ refLat, temp, precip, wind });
const CELTIC = c(55, [4, 4.5, 6, 8, 11, 13.5, 15.5, 15, 13, 10, 6.5, 4.5], [0.48, 0.42, 0.42, 0.36, 0.35, 0.35, 0.38, 0.4, 0.4, 0.46, 0.48, 0.5], [0.18, 0.17, 0.15, 0.11, 0.09, 0.07, 0.07, 0.08, 0.1, 0.13, 0.16, 0.18]);
const LOWLANDS = c(52, [3.5, 4, 7, 10, 13.5, 16.5, 18.5, 18.5, 15.5, 11.5, 7, 4], [0.42, 0.36, 0.36, 0.32, 0.32, 0.32, 0.33, 0.35, 0.36, 0.4, 0.43, 0.44], [0.16, 0.15, 0.13, 0.1, 0.08, 0.07, 0.07, 0.07, 0.09, 0.12, 0.14, 0.16]);
const ALPINE = c(47.5, [-0.5, 1, 5, 9, 13.5, 17, 19, 18.5, 14.5, 9.5, 4, 0.5], [0.3, 0.28, 0.32, 0.34, 0.4, 0.42, 0.42, 0.4, 0.33, 0.3, 0.32, 0.32], [0.07, 0.07, 0.07, 0.06, 0.05, 0.04, 0.04, 0.04, 0.04, 0.05, 0.06, 0.07]);
const NORDIC = c(59, [-3, -3, 1, 6, 11, 15, 17, 16, 11.5, 6.5, 2, -2], [0.35, 0.3, 0.3, 0.28, 0.3, 0.32, 0.36, 0.38, 0.36, 0.38, 0.38, 0.36], [0.12, 0.11, 0.1, 0.08, 0.06, 0.05, 0.05, 0.05, 0.07, 0.09, 0.11, 0.12]);
const DANISH = c(55.7, [1, 1, 3, 7, 11.5, 15, 17.5, 17, 14, 9.5, 5.5, 2.5], [0.4, 0.33, 0.33, 0.28, 0.28, 0.3, 0.34, 0.36, 0.38, 0.4, 0.42, 0.42], [0.18, 0.16, 0.15, 0.11, 0.09, 0.08, 0.08, 0.08, 0.11, 0.14, 0.16, 0.18]);
const EASTERN = c(50.5, [-2, -1, 3, 9, 14, 17.5, 19.5, 19, 14, 8.5, 3.5, -0.5], [0.32, 0.3, 0.3, 0.3, 0.34, 0.36, 0.36, 0.32, 0.28, 0.28, 0.32, 0.34], [0.09, 0.09, 0.09, 0.07, 0.06, 0.05, 0.05, 0.05, 0.06, 0.07, 0.08, 0.09]);
const ADRIATIC = c(45.8, [1, 3, 7.5, 12, 16.5, 20.5, 22.5, 22, 17, 12, 7, 2], [0.3, 0.28, 0.3, 0.32, 0.34, 0.32, 0.26, 0.26, 0.28, 0.32, 0.36, 0.34], [0.08, 0.08, 0.08, 0.07, 0.05, 0.04, 0.04, 0.04, 0.05, 0.07, 0.08, 0.08]);
const IBERIAN_ATLANTIC = c(38.7, [11.5, 12.5, 14.5, 15.5, 18, 21, 23, 23.5, 22, 19, 15, 12.5], [0.32, 0.28, 0.24, 0.26, 0.2, 0.08, 0.03, 0.04, 0.12, 0.26, 0.32, 0.34], [0.1, 0.1, 0.1, 0.09, 0.08, 0.08, 0.09, 0.09, 0.07, 0.08, 0.09, 0.1]);
const BOSPHORUS = c(41, [6, 6, 8, 12, 17, 21.5, 24, 24, 20.5, 16, 11.5, 8], [0.4, 0.35, 0.3, 0.24, 0.18, 0.12, 0.08, 0.08, 0.14, 0.26, 0.34, 0.4], [0.12, 0.12, 0.11, 0.08, 0.07, 0.08, 0.1, 0.1, 0.08, 0.09, 0.11, 0.12]);
const US = c(40, [1, 3, 7.5, 13, 18.5, 23.5, 26, 25, 21, 14.5, 8.5, 3], [0.3, 0.28, 0.32, 0.32, 0.32, 0.3, 0.3, 0.28, 0.26, 0.26, 0.28, 0.3], [0.1, 0.1, 0.1, 0.09, 0.07, 0.06, 0.05, 0.05, 0.06, 0.07, 0.09, 0.1]);
const CANADA = c(45, [-6, -5, 0, 7, 13.5, 18.5, 21, 20, 15.5, 9, 3, -3], [0.34, 0.3, 0.3, 0.3, 0.32, 0.34, 0.32, 0.3, 0.3, 0.32, 0.34, 0.36], [0.1, 0.1, 0.1, 0.09, 0.07, 0.06, 0.05, 0.05, 0.06, 0.08, 0.09, 0.1]);
const HIGHLAND_MEXICO = c(19.4, [14, 15.5, 17.5, 19, 19.5, 18.5, 17.5, 17.5, 17, 16, 15, 14], [0.04, 0.04, 0.06, 0.12, 0.25, 0.5, 0.6, 0.58, 0.5, 0.25, 0.08, 0.04], [0.05, 0.05, 0.06, 0.05, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.05, 0.05]);
const SAO_PAULO = c(-23.5, [23, 23.5, 22.5, 21, 18.5, 17.5, 17, 18, 19, 20.5, 21.5, 22.5], [0.6, 0.55, 0.5, 0.35, 0.25, 0.18, 0.15, 0.15, 0.3, 0.4, 0.48, 0.58], [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.06, 0.06, 0.05, 0.05]);
const ANDEAN = c(4.6, [14, 14.5, 14.5, 14.5, 14.5, 14, 13.5, 13.5, 14, 14, 14, 14], [0.25, 0.3, 0.4, 0.5, 0.45, 0.35, 0.3, 0.3, 0.4, 0.55, 0.5, 0.35], [0.04, 0.04, 0.04, 0.04, 0.04, 0.05, 0.05, 0.05, 0.04, 0.04, 0.04, 0.04]);
const RIO_PLATA = c(-34.6, [24.5, 23.5, 21.5, 17.5, 14.5, 11.5, 11, 12.5, 14.5, 17.5, 20.5, 23], [0.28, 0.26, 0.3, 0.28, 0.22, 0.2, 0.2, 0.2, 0.24, 0.3, 0.28, 0.28], [0.1, 0.1, 0.09, 0.09, 0.09, 0.1, 0.1, 0.11, 0.11, 0.11, 0.1, 0.1]);
const WEST_AFRICA = c(6, [27.5, 28.5, 28.5, 28, 27.5, 26.5, 25.5, 25.5, 26, 26.5, 27.5, 27.5], [0.05, 0.08, 0.15, 0.3, 0.45, 0.6, 0.5, 0.45, 0.55, 0.45, 0.2, 0.06], [0.04, 0.04, 0.04, 0.04, 0.04, 0.05, 0.05, 0.05, 0.04, 0.04, 0.04, 0.04]);
const SAHEL_COAST = c(14.7, [21.5, 21, 21, 21.5, 23, 26, 27.5, 27.5, 28, 27.5, 25.5, 23], [0.01, 0.01, 0.01, 0.01, 0.02, 0.1, 0.35, 0.5, 0.45, 0.15, 0.02, 0.01], [0.08, 0.08, 0.09, 0.09, 0.08, 0.06, 0.05, 0.05, 0.05, 0.06, 0.07, 0.08]);
const MAGHREB = c(34, [12, 13, 15, 16.5, 19, 22, 25, 25.5, 23, 20, 16, 13], [0.25, 0.24, 0.22, 0.2, 0.12, 0.04, 0.01, 0.02, 0.06, 0.15, 0.24, 0.26], [0.07, 0.07, 0.08, 0.08, 0.07, 0.06, 0.06, 0.06, 0.06, 0.06, 0.07, 0.07]);
const NILE = c(30, [14, 15.5, 18, 21.5, 25, 27.5, 28.5, 28.5, 26.5, 23.5, 19, 15.5], [0.04, 0.03, 0.03, 0.01, 0.01, 0, 0, 0, 0, 0.01, 0.02, 0.03], [0.06, 0.07, 0.08, 0.08, 0.07, 0.06, 0.05, 0.05, 0.05, 0.05, 0.06, 0.06]);
const JAPAN = c(35.7, [5.5, 6, 9, 14, 18.5, 21.5, 25, 26.5, 23, 17.5, 12.5, 8], [0.18, 0.22, 0.3, 0.32, 0.34, 0.45, 0.42, 0.32, 0.4, 0.36, 0.26, 0.18], [0.07, 0.07, 0.08, 0.07, 0.06, 0.05, 0.05, 0.06, 0.08, 0.07, 0.07, 0.07]);
const KOREA = c(37.5, [-2, 0.5, 6, 12.5, 18, 22.5, 25.5, 26, 21.5, 15, 7.5, 0.5], [0.15, 0.15, 0.22, 0.25, 0.28, 0.35, 0.55, 0.5, 0.32, 0.2, 0.22, 0.17], [0.07, 0.07, 0.08, 0.07, 0.06, 0.05, 0.05, 0.05, 0.05, 0.06, 0.07, 0.07]);
const SYDNEY = c(-33.8, [23, 23, 21.5, 18.5, 15.5, 13, 12.5, 13.5, 16, 18.5, 20, 22], [0.35, 0.38, 0.38, 0.33, 0.3, 0.32, 0.27, 0.22, 0.24, 0.28, 0.32, 0.32], [0.08, 0.08, 0.07, 0.07, 0.07, 0.08, 0.08, 0.09, 0.09, 0.09, 0.09, 0.08]);

const TABLES: Record<string, Climate> = {
  ENG, ESP, ITA, GER, FRA,
  SCO: CELTIC, WAL: CELTIC, NIR: CELTIC, IRL: CELTIC,
  NED: LOWLANDS, BEL: LOWLANDS, SUI: ALPINE, AUT: ALPINE,
  NOR: NORDIC, SWE: NORDIC, DEN: DANISH,
  POL: EASTERN, CZE: EASTERN, SRB: EASTERN, UKR: EASTERN, CRO: ADRIATIC,
  POR: IBERIAN_ATLANTIC, TUR: BOSPHORUS,
  USA: US, CAN: CANADA, MEX: HIGHLAND_MEXICO,
  BRA: SAO_PAULO, COL: ANDEAN, ARG: RIO_PLATA, URU: RIO_PLATA,
  CIV: WEST_AFRICA, NGA: WEST_AFRICA, GHA: WEST_AFRICA, CMR: WEST_AFRICA, SEN: SAHEL_COAST,
  MAR: MAGHREB, ALG: MAGHREB, EGY: NILE,
  JPN: JAPAN, KOR: KOREA, AUS: SYDNEY,
};

/** Nations without a table of their own whose seasons run the other way round (they borrow the temperate one, shifted). */
const SOUTHERN = new Set(["CHI", "PAR", "NZL", "RSA"]);

export function climateFor(countryCode: string | undefined): Climate {
  return (countryCode && TABLES[countryCode]) || TEMPERATE;
}

export function hasClimate(countryCode: string | undefined): boolean {
  return !!countryCode && !!TABLES[countryCode];
}

/** The climate month to read for a calendar month (0-11): southern nations on the borrowed table are six months out. */
export function climateMonth(countryCode: string | undefined, month: number): number {
  return countryCode && SOUTHERN.has(countryCode) && !TABLES[countryCode] ? (month + 6) % 12 : month;
}
