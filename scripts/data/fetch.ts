/**
 * Step 1 of the data pipeline: download raw snapshots from approved sources
 * into data/raw/. Raw snapshots are committed so builds never need network
 * access; rerun this script to refresh the football world.
 *
 *   npm run data:fetch
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  FOOTBALL_JSON_SEASONS,
  LEAGUE_SOURCES,
  NATIONAL_TEAM_TITLES,
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

const coachFields = `
  OPTIONAL {
    ?team p:P286 ?st . ?st ps:P286 ?coach .
    FILTER NOT EXISTS { ?st pq:P582 ?end }
    OPTIONAL { ?st pq:P580 ?start }
    OPTIONAL { ?coach wdt:P27 ?cit }
    OPTIONAL { ?coachArticle schema:about ?coach ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?coachTitle }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }`;

/** Current head coaches (Wikidata P286) for every club candidate and national team. */
async function fetchManagers() {
  console.log("Wikidata head coaches…");
  const qids = new Set<string>();
  for (const league of LEAGUE_SOURCES) {
    const raw = JSON.parse(await readFile(join(RAW_DIR, "wikidata", `clubs-${league.id}.json`), "utf8")) as { results: { bindings: { club?: { value: string } }[] } };
    for (const b of raw.results.bindings) if (b.club) qids.add(b.club.value.split("/").pop() as string);
  }
  const all = [...qids];
  const bindings: unknown[] = [];
  for (let i = 0; i < all.length; i += 80) {
    const values = all.slice(i, i + 80).map((q) => `wd:${q}`).join(" ");
    const q = `SELECT ?team ?coach ?coachLabel ?coachTitle ?start ?citLabel WHERE { VALUES ?team { ${values} } ${coachFields} }`;
    const body = await fetchText(`${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(q)}`, { headers: { Accept: "application/sparql-results+json" } });
    bindings.push(...(JSON.parse(body) as { results: { bindings: unknown[] } }).results.bindings);
    await new Promise((r) => setTimeout(r, 1200));
  }
  await save("wikidata/managers-clubs.json", JSON.stringify({ results: { bindings } }));

  const countries = (JSON.parse(await readFile(join(process.cwd(), "data", "curated", "countries.json"), "utf8")) as { countries: { code: string; name: string }[] }).countries;
  const titles = countries.map((c) => `"${(NATIONAL_TEAM_TITLES[c.code] ?? `${c.name} national football team`).replace(/"/g, '\\"')}"@en`).join(" ");
  const nq = `SELECT ?teamTitle ?team ?coach ?coachLabel ?coachTitle ?start ?citLabel WHERE {
  VALUES ?teamTitle { ${titles} }
  ?teamArticle schema:name ?teamTitle ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?team .
  ${coachFields}
}`;
  const nbody = await fetchText(`${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(nq)}`, { headers: { Accept: "application/sparql-results+json" } });
  await save("wikidata/managers-national.json", nbody);
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
  if (process.argv.includes("--managers-only")) {
    await fetchManagers();
    return;
  }
  await fetchWikidata();
  await fetchManagers();
  if (!process.argv.includes("--wikidata-only")) await fetchOpenFootballClubs();
  if (!process.argv.includes("--wikidata-only")) await fetchFootballJson();
  await save("FETCHED_AT.txt", new Date().toISOString() + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
