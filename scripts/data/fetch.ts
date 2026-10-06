/**
 * Step 1 of the data pipeline: download raw snapshots from approved sources
 * into data/raw/. Raw snapshots are committed so builds never need network
 * access; rerun this script to refresh the football world.
 *
 *   npm run data:fetch
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  FOOTBALL_JSON_SEASONS,
  LEAGUE_SOURCES,
  OPENFOOTBALL_CLUB_FILES,
  USER_AGENT,
  WIKIDATA_ENDPOINT,
} from "./sources";

const RAW_DIR = join(process.cwd(), "data", "raw");

async function save(rel: string, body: string) {
  const path = join(RAW_DIR, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  console.log(`  saved ${rel} (${body.length} bytes)`);
}

async function fetchText(url: string, init?: RequestInit, attempt = 1): Promise<string> {
  const res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) } });
  if (!res.ok) {
    if (attempt < 4 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return fetchText(url, init, attempt + 1);
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

function clubQuery(leagueQid: string): string {
  return `
SELECT ?club ?clubLabel ?start ?venue ?venueLabel ?venueStart ?venueEnd ?cap ?inception ?color ?colorLabel ?hex ?short ?cityLabel ?coord ?dissolved WHERE {
  ?club p:P118 ?st . ?st ps:P118 wd:${leagueQid} .
  FILTER NOT EXISTS { ?st pq:P582 ?end }
  OPTIONAL { ?st pq:P580 ?start }
  ?club wdt:P31/wdt:P279* wd:Q476028 .
  OPTIONAL {
    ?club p:P115 ?vs . ?vs ps:P115 ?venue .
    OPTIONAL { ?vs pq:P580 ?venueStart }
    OPTIONAL { ?vs pq:P582 ?venueEnd }
    OPTIONAL { ?venue wdt:P1083 ?cap }
    OPTIONAL { ?venue wdt:P625 ?coord }
  }
  OPTIONAL { ?club wdt:P571 ?inception }
  OPTIONAL { ?club wdt:P6364 ?color . OPTIONAL { ?color wdt:P465 ?hex } }
  OPTIONAL { ?club wdt:P1813 ?short . FILTER(LANG(?short) IN ("en", "es", "de", "it", "fr", "mul")) }
  OPTIONAL { ?club wdt:P159 ?city }
  OPTIONAL { ?club wdt:P576 ?dissolved }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es,de,it,fr,mul". }
}`;
}

async function fetchWikidata() {
  console.log("Wikidata clubs per league…");
  for (const league of LEAGUE_SOURCES) {
    const body = await fetchText(`${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(clubQuery(league.wikidata))}`, {
      headers: { Accept: "application/sparql-results+json" },
    });
    await save(`wikidata/clubs-${league.id}.json`, body);
    await new Promise((r) => setTimeout(r, 1200));
  }
}

async function fetchOpenFootballClubs() {
  console.log("OpenFootball clubs…");
  for (const [country, path] of Object.entries(OPENFOOTBALL_CLUB_FILES)) {
    const body = await fetchText(`https://raw.githubusercontent.com/openfootball/clubs/master/${path}`);
    await save(`openfootball/clubs/${country}.txt`, body);
  }
}

async function fetchFootballJson() {
  console.log("OpenFootball football.json historical results…");
  const codes = LEAGUE_SOURCES.flatMap((l) => (l.footballJson ? [l.footballJson] : []));
  for (const season of FOOTBALL_JSON_SEASONS) {
    for (const code of codes) {
      try {
        const body = await fetchText(`https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${code}.json`);
        await save(`openfootball/results/${season}/${code}.json`, body);
      } catch (err) {
        console.warn(`  skipped ${season}/${code}: ${(err as Error).message}`);
      }
    }
  }
}

async function main() {
  await fetchWikidata();
  if (!process.argv.includes("--wikidata-only")) await fetchOpenFootballClubs();
  if (!process.argv.includes("--wikidata-only")) await fetchFootballJson();
  await save("FETCHED_AT.txt", new Date().toISOString() + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
