/**
 * Step 2 of the data pipeline: raw snapshots -> canonical Pitchborn dataset.
 *
 *   raw (data/raw) -> parse -> normalise -> dedupe -> stable ids -> validate
 *   -> src/data/world.json  (+ data/reports/build-report.md)
 *
 *   npm run data:build            (fails on validation errors)
 *   npm run data:build -- --list  (print league assignments for curation)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Club,
  type Country,
  type Dataset,
  DatasetSchema,
  type HistoricalSeason,
  type League,
  type Stadium,
  validateDataset,
} from "../../src/engine/data/schema";
import { computeTable, type FootballJsonMatch, parseOpenFootballClubs } from "./lib/openfootball";
import { colorToHex, displayName, makeAbbreviation, nameKey, pickColors, slugify } from "./lib/normalize";
import { reduceWikidata, type WikidataClub } from "./lib/wikidata";
import { DATA_SOURCES, FOOTBALL_JSON_SEASONS, LEAGUE_SOURCES, OPENFOOTBALL_CLUB_FILES } from "./sources";

const ROOT = process.cwd();
const RAW = join(ROOT, "data", "raw");
const SNAPSHOT_SEASON = 2026;

interface Overrides {
  exclude: string[];
  assign: Record<string, string>;
  names: Record<string, { name?: string; shortName?: string; abbreviation?: string }>;
  colors: Record<string, [string, string]>;
  stadiums: Record<string, { name: string; capacity: number }>;
  historyAliases: Record<string, string[]>;
}

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const overrides = readJson<Overrides>(join(ROOT, "data", "curated", "overrides.json"));
const countries = readJson<{ countries: Country[] }>(join(ROOT, "data", "curated", "countries.json")).countries;

const RESERVE_RE = /(\bB$|\bII$|Atl[eè]tic$|U-?2[13]$|Next Gen|Promesas|Mestalla|Castilla|Deportivo Fabril|\bC$)/i;
const report: string[] = [];
const log = (s: string) => {
  report.push(s);
};

// ---------------------------------------------------------------- Wikidata
const candidates = new Map<string, WikidataClub[]>();
for (const league of LEAGUE_SOURCES) {
  const file = join(RAW, "wikidata", `clubs-${league.id}.json`);
  const raw = readJson<{ results: { bindings: [] } }>(file);
  for (const club of reduceWikidata(league.id, raw.results.bindings)) {
    const list = candidates.get(club.qid) ?? [];
    list.push(club);
    candidates.set(club.qid, list);
  }
}

const tierOf = (leagueId: string) => LEAGUE_SOURCES.find((l) => l.id === leagueId)?.tier ?? 9;

/** Resolve each club to a single league: explicit override > latest membership start > higher tier. */
const assigned = new Map<string, WikidataClub>();
for (const [qid, list] of candidates) {
  if (overrides.exclude.includes(qid)) continue;
  const label = list[0].label;
  if (list.some((c) => c.dissolved)) {
    log(`- excluded dissolved club ${label} (${qid})`);
    continue;
  }
  if (/\bseason\b/i.test(label) || /Under-?\d\d/i.test(label) || /\d{4}[-–]\d{2,4}$/.test(label)) {
    log(`- excluded non-club item ${label} (${qid})`);
    continue;
  }
  if (RESERVE_RE.test(label.trim())) {
    log(`- excluded reserve team ${label} (${qid})`);
    continue;
  }
  const forced = overrides.assign[qid];
  let chosen: WikidataClub | undefined;
  if (forced) chosen = list.find((c) => c.leagueId === forced) ?? { ...list[0], leagueId: forced };
  else {
    chosen = [...list].sort(
      (a, b) => (b.membershipStart ?? "").localeCompare(a.membershipStart ?? "") || tierOf(a.leagueId) - tierOf(b.leagueId),
    )[0];
  }
  assigned.set(qid, chosen);
}

/** Trim oversized divisions: prefer recent membership, then bigger stadium (proxy for established clubs). */
const byLeague = new Map<string, WikidataClub[]>();
for (const c of assigned.values()) {
  const list = byLeague.get(c.leagueId) ?? [];
  list.push(c);
  byLeague.set(c.leagueId, list);
}
const sortedLeagues = [...LEAGUE_SOURCES].sort((a, b) => a.countryCode.localeCompare(b.countryCode) || a.tier - b.tier);
for (const league of sortedLeagues) {
  const list = byLeague.get(league.id) ?? [];
  const forcedHere = (c: WikidataClub) => overrides.assign[c.qid] === league.id;
  list.sort(
    (a, b) =>
      Number(forcedHere(b)) - Number(forcedHere(a)) ||
      (b.membershipStart ?? "").localeCompare(a.membershipStart ?? "") ||
      (b.venue?.capacity ?? 0) - (a.venue?.capacity ?? 0),
  );
  if (list.length > league.size) {
    const dropped = list.splice(league.size);
    // Surplus clubs that also claim the division below are demoted rather than dropped.
    const below = LEAGUE_SOURCES.find((l) => l.countryCode === league.countryCode && l.tier === league.tier + 1);
    const demoted: string[] = [];
    const removed: string[] = [];
    for (const d of dropped) {
      const claim = below && candidates.get(d.qid)?.find((c) => c.leagueId === below.id);
      if (below && claim) {
        const target = byLeague.get(below.id) ?? [];
        target.push({ ...claim, membershipStart: undefined });
        byLeague.set(below.id, target);
        demoted.push(d.label);
      } else removed.push(d.label);
    }
    if (demoted.length) log(`- ${league.id}: demoted ${demoted.length} surplus clubs to ${below?.id}: ${demoted.join(", ")}`);
    if (removed.length) log(`- ${league.id}: trimmed ${removed.length} stale entries: ${removed.join(", ")}`);
  }
  byLeague.set(league.id, list);
}

if (process.argv.includes("--list")) {
  for (const league of LEAGUE_SOURCES) {
    const list = byLeague.get(league.id) ?? [];
    console.log(`\n${league.id} (${list.length}/${league.size})`);
    for (const c of list) console.log(`  ${c.qid.padEnd(11)} ${c.membershipStart ?? "----------"} ${c.label}  [${c.venue?.name ?? "?"} ${c.venue?.capacity ?? "?"}]`);
  }
  process.exit(0);
}

// ---------------------------------------------------------- OpenFootball
const aliasIndex = new Map<string, { country: string; canonical: string; aliases: string[] }>();
for (const [country, file] of Object.entries(OPENFOOTBALL_CLUB_FILES)) {
  void file;
  const path = join(RAW, "openfootball", "clubs", `${country}.txt`);
  if (!existsSync(path)) continue;
  for (const club of parseOpenFootballClubs(readFileSync(path, "utf8"))) {
    const entry = { country, canonical: club.name, aliases: club.aliases };
    for (const n of [club.name, ...club.aliases]) {
      const k = `${country}:${nameKey(n)}`;
      if (!aliasIndex.has(k)) aliasIndex.set(k, entry);
    }
  }
}

// ---------------------------------------------------------------- Clubs
const stadiums = new Map<string, Stadium>();
const clubs: Club[] = [];
const takenAbbr = new Map<string, Set<string>>();
const clubIdByKey = new Map<string, string>();
const primaryKeys: [string, string, string[]][] = [];
const aliasKeys: [string, string, string[]][] = [];

const AFFIX = /^(F\.?C\.?|A\.?F\.?C\.?|A\.?C\.?|A\.?S\.?|R\.?C\.?|S\.?C\.?|E\.?S\.?|U\.?S\.?|U\.?C\.?|S\.?S\.?C?\.?|S\.?D\.?|C\.?D\.?|U\.?D\.?|C\.?F\.?|S\.?V\.?|V\.?f\.?[BL]\.?|T\.?S\.?G\.?|R\.?C\.?D\.?|1\.|O\.?G\.?C\.?|L\.?R\.?|SpVgg|Calcio|Delfino|SCO|Stade|Olympique|Real|Club|Unione Sportiva|Associazione Sportiva)$/i;
/** "R.C. Lens" -> "Lens", "1. FSV Mainz 05" -> "FSV Mainz". Keeps at least one word. */
function shortDisplay(name: string): string {
  const words = name.split(/\s+/);
  const kept = words.filter((w, i) => !(AFFIX.test(w) && words.length > 1) && !(/^\d{2,4}$/.test(w) && i > 0));
  const out = (kept.length ? kept : words).join(" ");
  return out.replace(/\s+(Calcio|Fußball|Football Club)$/i, "").trim();
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
  used.add(id);
  return id;
}
const usedClubIds = new Set<string>();
const usedStadiumIds = new Set<string>();

for (const league of LEAGUE_SOURCES) {
  for (const w of byLeague.get(league.id) ?? []) {
    const ov = overrides.names[w.qid] ?? {};
    const name = ov.name ?? displayName(w.label);
    const of = aliasIndex.get(`${league.countryCode}:${nameKey(w.label)}`) ?? aliasIndex.get(`${league.countryCode}:${nameKey(name)}`);
    const sources = ["wikidata"];
    if (of) sources.push("openfootball-clubs");
    const stripped = shortDisplay(name);
    const shortAlias = (of?.aliases ?? [])
      .filter((a) => a.length >= 4 && a.length <= 14 && !a.includes(".") && !/\b(FC|CF|AFC|Football|Club)\b/.test(a))
      .sort((a, b) => b.length - a.length)[0];
    const shortName = ov.shortName ?? (stripped.length <= 16 ? stripped : shortAlias ?? stripped.split(" ").slice(0, 2).join(" "));
    const abbrSet = takenAbbr.get(league.countryCode) ?? new Set<string>();
    takenAbbr.set(league.countryCode, abbrSet);
    const wdShort = w.shortNames.find((s) => /^[A-Z]{3}$/.test(s) && !abbrSet.has(s));
    const abbreviation = ov.abbreviation ?? (wdShort ? (abbrSet.add(wdShort), wdShort) : makeAbbreviation(name, abbrSet));
    const id = uniqueId(`${league.countryCode.toLowerCase()}-${slugify(shortName)}`, usedClubIds);

    const city = w.city ?? of?.aliases[0] ?? name;
    const stadOv = overrides.stadiums[w.qid];
    const venueName = stadOv?.name ?? w.venue?.name ?? `${shortName} Ground`;
    const capacity = stadOv?.capacity ?? w.venue?.capacity ?? (league.tier === 1 ? 25000 : league.tier === 2 ? 15000 : 8000);
    let stadium = [...stadiums.values()].find((s) => s.name === venueName && s.countryCode === league.countryCode);
    if (!stadium) {
      stadium = {
        id: uniqueId(slugify(venueName) || `${id}-ground`, usedStadiumIds),
        name: venueName,
        capacity: Math.min(130000, Math.max(500, capacity)),
        city: city,
        countryCode: league.countryCode,
        lat: w.venue?.lat,
        lon: w.venue?.lon,
        sources: w.venue ? ["wikidata"] : ["pitchborn-generated"],
      };
      stadiums.set(stadium.id, stadium);
    }
    const colHex = w.colors.map((c) => colorToHex(c.label, c.hex)).filter((x): x is string => Boolean(x));
    const colors = overrides.colors[w.qid]
      ? { primary: overrides.colors[w.qid][0], secondary: overrides.colors[w.qid][1] }
      : pickColors(colHex, name);
    clubs.push({
      id,
      name,
      shortName,
      abbreviation,
      city,
      countryCode: league.countryCode,
      founded: w.founded && w.founded <= SNAPSHOT_SEASON ? w.founded : undefined,
      stadiumId: stadium.id,
      colors,
      leagueId: league.id,
      prestige: 0,
      wikidata: w.qid,
      sources,
    });
    primaryKeys.push([id, league.countryCode, [w.label, name, shortName]]);
    aliasKeys.push([id, league.countryCode, [...(overrides.historyAliases[w.qid] ?? []), ...(of ? [of.canonical, ...of.aliases] : [])]]);
  }
}

// Exact names win over OpenFootball aliases; never let a later alias steal a key.
for (const [id, cc, names] of [...primaryKeys, ...aliasKeys]) {
  for (const n of names) {
    const k = `${cc}:${nameKey(n)}`;
    if (!clubIdByKey.has(k)) clubIdByKey.set(k, id);
  }
}

// --------------------------------------------------------------- History
const history: HistoricalSeason[] = [];
for (const season of FOOTBALL_JSON_SEASONS) {
  const dir = join(RAW, "openfootball", "results", season);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    const code = file.replace(/\.json$/, "");
    const league = LEAGUE_SOURCES.find((l) => l.footballJson === code);
    if (!league) continue;
    const data = readJson<{ matches?: FootballJsonMatch[]; rounds?: { matches: FootballJsonMatch[] }[] }>(join(dir, file));
    const matches = data.matches ?? data.rounds?.flatMap((r) => r.matches) ?? [];
    const { rows, matches: played, goals } = computeTable(matches);
    if (rows.length < 10) continue;
    let unmatched = 0;
    const usedInTable = new Set<string>();
    history.push({
      leagueId: league.id,
      season,
      matches: played,
      goals,
      table: rows.map((r, i) => {
        const clubId =
          clubIdByKey.get(`${league.countryCode}:${nameKey(r.team)}`) ??
          (() => {
            const alias = aliasIndex.get(`${league.countryCode}:${nameKey(r.team)}`);
            return alias ? clubIdByKey.get(`${league.countryCode}:${nameKey(alias.canonical)}`) : undefined;
          })();
        const unique = clubId && !usedInTable.has(clubId) ? clubId : undefined;
        if (unique) usedInTable.add(unique);
        else unmatched++;
        return { ...r, team: r.team, clubId: unique, pos: i + 1 };
      }),
    });
    if (unmatched) log(`- history ${season} ${code}: ${unmatched} teams not in current world (relegated/renamed)`);
  }
}

// -------------------------------------------------------------- Prestige
/**
 * Pitchborn prestige (own formula): recent finishing positions converted to
 * a pyramid score, blended with tier baseline and stadium capacity.
 */
const tierBase: Record<number, number> = { 1: 66, 2: 46, 3: 30 };
/** Pitchborn's editorial view of relative league depth (own values). */
const LEAGUE_FACTOR: Record<string, number> = { ENG: 1.0, ESP: 0.975, GER: 0.96, ITA: 0.96, FRA: 0.93 };
const leagueTierById = new Map(LEAGUE_SOURCES.map((l) => [l.id, l.tier]));
for (const club of clubs) {
  const tier = leagueTierById.get(club.leagueId) ?? 3;
  const results: { weight: number; score: number }[] = [];
  history.forEach((h) => {
    const row = h.table.find((r) => r.clubId === club.id);
    if (!row) return;
    const hTier = leagueTierById.get(h.leagueId) ?? 3;
    const frac = 1 - (row.pos - 1) / Math.max(1, h.table.length - 1); // 1 = champion
    const score = (tierBase[hTier] ?? 25) + frac * (hTier === 1 ? 34 : 22);
    const age = FOOTBALL_JSON_SEASONS.length - 1 - FOOTBALL_JSON_SEASONS.indexOf(h.season);
    results.push({ weight: Math.pow(0.7, age), score });
  });
  const stadium = stadiums.get(club.stadiumId);
  const capScore = Math.log10(Math.max(1000, stadium?.capacity ?? 5000)) * 12 - 36; // ~12 for 10k, ~20 for 50k, ~23 for 80k
  const hist = results.length
    ? results.reduce((s, r) => s + r.score * r.weight, 0) / results.reduce((s, r) => s + r.weight, 0)
    : (tierBase[tier] ?? 25) + 8;
  const histWeight = Math.min(0.85, 0.35 + results.length * 0.1);
  const base = (tierBase[tier] ?? 25) + 10 + capScore * 0.6;
  let prestige = (hist * histWeight + base * (1 - histWeight)) * (LEAGUE_FACTOR[club.countryCode] ?? 0.9);
  // A club in a lower tier cannot be more prestigious than the tier allows.
  const cap = tier === 1 ? 99 : tier === 2 ? 78 : 60;
  prestige = Math.max(8, Math.min(cap, prestige));
  club.prestige = Math.round(prestige);
  if (process.env.DEBUG_PRESTIGE === club.id) console.log(club.id, results, hist, base, histWeight);
}

// ---------------------------------------------------------------- Output
const leagues: League[] = LEAGUE_SOURCES.map((l) => {
  const below = LEAGUE_SOURCES.find((x) => x.countryCode === l.countryCode && x.tier === l.tier + 1);
  return {
    id: l.id,
    name: l.name,
    shortName: l.shortName,
    countryCode: l.countryCode,
    tier: l.tier,
    size: Math.min(l.size, (byLeague.get(l.id) ?? []).length),
    promoted: l.tier === 1 ? 0 : 3,
    relegated: below ? 3 : 3,
    abstraction: Boolean(l.abstraction),
  };
});

const usedCountries = new Set(clubs.map((c) => c.countryCode));
const dataset: Dataset = {
  version: `${SNAPSHOT_SEASON}.1`,
  generatedAt: readFileSync(join(RAW, "FETCHED_AT.txt"), "utf8").trim(),
  snapshotSeason: SNAPSHOT_SEASON,
  countries,
  stadiums: [...stadiums.values()].filter((s) => clubs.some((c) => c.stadiumId === s.id)),
  clubs: clubs.sort((a, b) => a.leagueId.localeCompare(b.leagueId) || b.prestige - a.prestige || a.name.localeCompare(b.name)),
  leagues,
  history: history.sort((a, b) => a.leagueId.localeCompare(b.leagueId) || a.season.localeCompare(b.season)),
  sources: DATA_SOURCES,
};
void usedCountries;

const parsed = DatasetSchema.safeParse(dataset);
if (!parsed.success) {
  console.error(parsed.error.issues.slice(0, 20));
  process.exit(1);
}
const issues = validateDataset(dataset);
const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");

mkdirSync(join(ROOT, "src", "data"), { recursive: true });
mkdirSync(join(ROOT, "data", "reports"), { recursive: true });
writeFileSync(join(ROOT, "src", "data", "world.json"), JSON.stringify(dataset));

const summary = [
  `# Dataset build report`,
  ``,
  `Generated from raw snapshot fetched ${dataset.generatedAt}.`,
  ``,
  `| League | Clubs | Avg prestige |`,
  `|---|---|---|`,
  ...leagues.map((l) => {
    const lc = clubs.filter((c) => c.leagueId === l.id);
    return `| ${l.name} (${l.id}) | ${lc.length}/${l.size} | ${(lc.reduce((s, c) => s + c.prestige, 0) / Math.max(1, lc.length)).toFixed(1)} |`;
  }),
  ``,
  `Stadiums: ${dataset.stadiums.length}. Historical seasons: ${history.length}.`,
  `Validation: ${errors.length} errors, ${warnings.length} warnings.`,
  ``,
  `## Pipeline decisions`,
  ...report,
  ``,
  `## Errors`,
  ...errors.map((e) => `- ${e.message}`),
];
writeFileSync(join(ROOT, "data", "reports", "build-report.md"), summary.join("\n") + "\n");
console.log(summary.slice(0, 26).join("\n"));
if (errors.length) {
  console.error(errors.map((e) => e.message).join("\n"));
  process.exit(1);
}
