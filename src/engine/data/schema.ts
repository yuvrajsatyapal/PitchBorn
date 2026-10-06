import { z } from "zod";

/**
 * Canonical Pitchborn static world dataset. Produced at build time by
 * scripts/data/build.ts and bundled with the app. All gameplay numbers
 * (prestige, strength) are Pitchborn's own values derived from factual
 * inputs — never copied from commercial games.
 */

export const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

export const CountrySchema = z.object({
  code: z.string().regex(/^[A-Z]{3}$/),
  name: z.string().min(2),
  /** flag-icons code, e.g. "gb-eng", "es" */
  flag: z.string().min(2),
  confederation: z.enum(["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"]),
  /** Pitchborn national-team baseline strength 1-100 (own value). */
  strength: z.number().min(1).max(100),
  namePool: z.string(),
  /** Has simulated domestic leagues. */
  hasLeagues: z.boolean(),
});
export type Country = z.infer<typeof CountrySchema>;

export const StadiumSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  capacity: z.number().int().min(500).max(130000),
  city: z.string(),
  countryCode: z.string(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  sources: z.array(z.string()),
});
export type Stadium = z.infer<typeof StadiumSchema>;

export const ClubSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  shortName: z.string().min(2),
  abbreviation: z.string().regex(/^[A-Z0-9]{3}$/),
  city: z.string(),
  countryCode: z.string(),
  founded: z.number().int().min(1850).max(2026).optional(),
  stadiumId: z.string(),
  colors: z.object({ primary: HexColor, secondary: HexColor }),
  leagueId: z.string(),
  /** Pitchborn prestige 1-100 derived from historical results, tier and stadium size. */
  prestige: z.number().min(1).max(100),
  wikidata: z.string().optional(),
  sources: z.array(z.string()),
});
export type Club = z.infer<typeof ClubSchema>;

export const LeagueSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  countryCode: z.string(),
  tier: z.number().int().min(1).max(5),
  size: z.number().int().min(10).max(30),
  promoted: z.number().int().min(0),
  relegated: z.number().int().min(0),
  abstraction: z.boolean(),
});
export type League = z.infer<typeof LeagueSchema>;

export const HistoricalRowSchema = z.object({
  team: z.string(),
  clubId: z.string().optional(),
  pos: z.number().int(),
  played: z.number().int(),
  won: z.number().int(),
  drawn: z.number().int(),
  lost: z.number().int(),
  gf: z.number().int(),
  ga: z.number().int(),
  points: z.number().int(),
});

export const HistoricalSeasonSchema = z.object({
  leagueId: z.string(),
  season: z.string(),
  matches: z.number().int(),
  goals: z.number().int(),
  table: z.array(HistoricalRowSchema),
});
export type HistoricalSeason = z.infer<typeof HistoricalSeasonSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  license: z.string(),
  licenseUrl: z.string(),
  usage: z.string(),
  redistributable: z.boolean(),
});

export const DatasetSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  snapshotSeason: z.number().int(),
  countries: z.array(CountrySchema),
  stadiums: z.array(StadiumSchema),
  clubs: z.array(ClubSchema),
  leagues: z.array(LeagueSchema),
  history: z.array(HistoricalSeasonSchema),
  sources: z.array(SourceSchema),
});
export type Dataset = z.infer<typeof DatasetSchema>;

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

/** Cross-reference validation beyond what the schema can express. */
export function validateDataset(data: Dataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const countryCodes = new Set(data.countries.map((c) => c.code));
  const stadiumIds = new Set<string>();
  for (const s of data.stadiums) {
    if (stadiumIds.has(s.id)) err(`duplicate stadium id ${s.id}`);
    stadiumIds.add(s.id);
    if (!countryCodes.has(s.countryCode)) err(`stadium ${s.id} has invalid country ${s.countryCode}`);
  }
  const leagueIds = new Set<string>();
  for (const l of data.leagues) {
    if (leagueIds.has(l.id)) err(`duplicate league id ${l.id}`);
    leagueIds.add(l.id);
    if (!countryCodes.has(l.countryCode)) err(`league ${l.id} has invalid country ${l.countryCode}`);
  }
  const clubIds = new Set<string>();
  const clubNames = new Set<string>();
  const wikidataIds = new Set<string>();
  const perLeague = new Map<string, number>();
  for (const c of data.clubs) {
    if (clubIds.has(c.id)) err(`duplicate club id ${c.id}`);
    clubIds.add(c.id);
    const nameKey = `${c.countryCode}:${c.name.toLowerCase()}`;
    if (clubNames.has(nameKey)) err(`duplicate club name ${c.name}`);
    clubNames.add(nameKey);
    if (c.wikidata) {
      if (wikidataIds.has(c.wikidata)) err(`duplicate club wikidata ${c.wikidata}`);
      wikidataIds.add(c.wikidata);
    }
    if (!countryCodes.has(c.countryCode)) err(`club ${c.id} has invalid country ${c.countryCode}`);
    if (!stadiumIds.has(c.stadiumId)) err(`club ${c.id} references missing stadium ${c.stadiumId}`);
    if (!leagueIds.has(c.leagueId)) err(`club ${c.id} references missing league ${c.leagueId}`);
    if (c.founded && c.founded > data.snapshotSeason) err(`club ${c.id} founded in the future (${c.founded})`);
    perLeague.set(c.leagueId, (perLeague.get(c.leagueId) ?? 0) + 1);
  }
  for (const l of data.leagues) {
    const n = perLeague.get(l.id) ?? 0;
    if (n !== l.size) err(`league ${l.id} has ${n} clubs, expected ${l.size}`);
    const league = data.clubs.filter((c) => c.leagueId === l.id);
    if (league.some((c) => c.countryCode !== l.countryCode)) err(`league ${l.id} contains a foreign club`);
  }
  for (const h of data.history) {
    if (!leagueIds.has(h.leagueId)) err(`history references missing league ${h.leagueId}`);
    for (const row of h.table) {
      if (row.clubId && !clubIds.has(row.clubId)) {
        issues.push({ level: "warning", message: `history ${h.season} ${h.leagueId}: club ${row.clubId} not in current world` });
      }
      if (row.won + row.drawn + row.lost !== row.played) err(`history ${h.season} ${row.team}: W+D+L != P`);
      if (row.points !== row.won * 3 + row.drawn) {
        // Points deductions exist in real football; record as warning only.
        issues.push({ level: "warning", message: `history ${h.season} ${row.team}: points adjusted` });
      }
    }
  }
  return issues;
}
