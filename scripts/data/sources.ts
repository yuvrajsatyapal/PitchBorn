/**
 * Registry of every external data source the pipeline is allowed to read.
 * Adding a source here is a licensing decision — record the license and why
 * it is acceptable before using it in an import step.
 */
export interface DataSource {
  id: string;
  name: string;
  url: string;
  license: string;
  licenseUrl: string;
  /** What Pitchborn takes from this source. */
  usage: string;
  redistributable: boolean;
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: "wikidata",
    name: "Wikidata",
    url: "https://www.wikidata.org/",
    license: "CC0 1.0 (structured data)",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    usage: "Current league membership, stadium names, capacities, founding years, club colours, cities, coordinates, and current head coaches of clubs and national teams.",
    redistributable: true,
  },
  {
    id: "openfootball-clubs",
    name: "OpenFootball clubs",
    url: "https://github.com/openfootball/clubs",
    license: "CC0 1.0",
    licenseUrl: "https://github.com/openfootball/clubs/blob/master/LICENSE.md",
    usage: "Canonical club names, alternative names/short names used for name matching across sources.",
    redistributable: true,
  },
  {
    id: "openfootball-football-json",
    name: "OpenFootball football.json",
    url: "https://github.com/openfootball/football.json",
    license: "CC0 1.0",
    licenseUrl: "https://github.com/openfootball/football.json",
    usage: "Real historical league results (2020-21 onward) used to compute historical tables, champions and to seed club prestige.",
    redistributable: true,
  },
  {
    id: "flag-icons",
    name: "flag-icons (lipis/flag-icons)",
    url: "https://github.com/lipis/flag-icons",
    license: "MIT",
    licenseUrl: "https://github.com/lipis/flag-icons/blob/main/LICENSE",
    usage: "Country flag SVGs (npm dependency, served from the package).",
    redistributable: true,
  },
];

export const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
export const USER_AGENT = "PitchbornDataPipeline/1.0 (open-source football career simulator; build-time import)";

export interface LeagueSourceDef {
  id: string;
  countryCode: string;
  tier: number;
  name: string;
  shortName: string;
  wikidata: string;
  /** Target number of clubs for the simulated division. */
  size: number;
  /** football.json file code, e.g. "en.1" */
  footballJson?: string;
  /** True when the real division is split into groups and Pitchborn simulates a single-table abstraction. */
  abstraction?: boolean;
}

export const LEAGUE_SOURCES: LeagueSourceDef[] = [
  { id: "eng-1", countryCode: "ENG", tier: 1, name: "Premier League", shortName: "PL", wikidata: "Q9448", size: 20, footballJson: "en.1" },
  { id: "eng-2", countryCode: "ENG", tier: 2, name: "EFL Championship", shortName: "CHA", wikidata: "Q19510", size: 24, footballJson: "en.2" },
  { id: "eng-3", countryCode: "ENG", tier: 3, name: "EFL League One", shortName: "L1", wikidata: "Q19565", size: 24, footballJson: "en.3" },
  { id: "esp-1", countryCode: "ESP", tier: 1, name: "LaLiga", shortName: "LL", wikidata: "Q324867", size: 20, footballJson: "es.1" },
  { id: "esp-2", countryCode: "ESP", tier: 2, name: "LaLiga 2", shortName: "LL2", wikidata: "Q35615", size: 22, footballJson: "es.2" },
  { id: "esp-3", countryCode: "ESP", tier: 3, name: "Primera Federación", shortName: "1RF", wikidata: "Q100146559", size: 20, abstraction: true },
  { id: "ger-1", countryCode: "GER", tier: 1, name: "Bundesliga", shortName: "BL", wikidata: "Q82595", size: 18, footballJson: "de.1" },
  { id: "ger-2", countryCode: "GER", tier: 2, name: "2. Bundesliga", shortName: "BL2", wikidata: "Q152665", size: 18, footballJson: "de.2" },
  { id: "ger-3", countryCode: "GER", tier: 3, name: "3. Liga", shortName: "3L", wikidata: "Q154069", size: 20, footballJson: "de.3" },
  { id: "ita-1", countryCode: "ITA", tier: 1, name: "Serie A", shortName: "SA", wikidata: "Q15804", size: 20, footballJson: "it.1" },
  { id: "ita-2", countryCode: "ITA", tier: 2, name: "Serie B", shortName: "SB", wikidata: "Q194052", size: 20, footballJson: "it.2" },
  { id: "ita-3", countryCode: "ITA", tier: 3, name: "Serie C", shortName: "SC", wikidata: "Q607965", size: 20, abstraction: true },
  { id: "fra-1", countryCode: "FRA", tier: 1, name: "Ligue 1", shortName: "L1F", wikidata: "Q13394", size: 18, footballJson: "fr.1" },
  { id: "fra-2", countryCode: "FRA", tier: 2, name: "Ligue 2", shortName: "L2F", wikidata: "Q217374", size: 18, footballJson: "fr.2" },
  { id: "fra-3", countryCode: "FRA", tier: 3, name: "National", shortName: "NAT", wikidata: "Q864298", size: 18, abstraction: true },
];

export const OPENFOOTBALL_CLUB_FILES: Record<string, string> = {
  ENG: "europe/england/eng.clubs.txt",
  ESP: "europe/spain/es.clubs.txt",
  GER: "europe/germany/de.clubs.txt",
  ITA: "europe/italy/it.clubs.txt",
  FRA: "europe/france/fr.clubs.txt",
};

export const FOOTBALL_JSON_SEASONS = ["2020-21", "2021-22", "2022-23", "2023-24", "2024-25"];

/** English Wikipedia titles for national teams whose article isn't "<Country> national football team". */
export const NATIONAL_TEAM_TITLES: Record<string, string> = {
  IRL: "Republic of Ireland national football team",
  CZE: "Czech Republic national football team",
  TUR: "Turkey national football team",
  CIV: "Ivory Coast national football team",
  USA: "United States men's national soccer team",
  CAN: "Canada men's national soccer team",
  AUS: "Australia men's national soccer team",
};
