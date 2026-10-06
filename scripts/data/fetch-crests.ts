/**
 * Official club crests from Wikimedia Commons (via Wikidata P154 "logo image").
 *
 *   npm run data:crests
 *
 * Only files whose Commons licence permits redistribution (public domain,
 * CC0, CC BY, CC BY-SA) are downloaded. Every bundled file gets a provenance
 * record in src/data/crests.json (source page, licence, author, restrictions).
 * Clubs without an acceptable file keep the generated Pitchborn emblem.
 *
 * Note: a free copyright licence does not grant trademark rights. Crests are
 * shown only to identify the real club; see docs/DATA_SOURCES.md.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { USER_AGENT, WIKIDATA_ENDPOINT } from "./sources";

interface Club {
  id: string;
  wikidata?: string;
  name: string;
}
interface CrestRecord {
  file: string;
  title: string;
  sourcePage: string;
  license: string;
  licenseUrl?: string;
  artist?: string;
  restrictions?: string;
  width?: number;
  height?: number;
}

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "public", "crests");
const REGISTRY = join(ROOT, "src", "data", "crests.json");
const ACCEPT = /^(public domain|pd[- ]|cc0|cc[- ]by(-sa)?[- ]?\d|cc by(-sa)? \d)/i;
const REJECT_FILE = /(white|wordmark|text|kit|shirt|stadium|old|former|19\d\d|historic)/i;

const world = JSON.parse(readFileSync(join(ROOT, "src", "data", "world.json"), "utf8")) as { clubs: Club[] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, attempt = 1): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    await sleep(2000 * attempt);
    return get(url, attempt + 1);
  }
  return res;
}

async function logosByQid(qids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < qids.length; i += 80) {
    const values = qids.slice(i, i + 80).map((q) => `wd:${q}`).join(" ");
    const q = `SELECT ?club ?logo WHERE { VALUES ?club { ${values} } ?club wdt:P154 ?logo . }`;
    const res = await get(`${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(q)}&format=json`);
    const json = (await res.json()) as { results: { bindings: { club: { value: string }; logo: { value: string } }[] } };
    for (const b of json.results.bindings) {
      const qid = b.club.value.split("/").pop() as string;
      const file = decodeURIComponent(b.logo.value.split("/Special:FilePath/")[1] ?? "");
      if (!file) continue;
      out.set(qid, [...(out.get(qid) ?? []), file]);
    }
    await sleep(800);
  }
  return out;
}

const strip = (s?: string) => s?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function commonsInfo(file: string) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=256&titles=${encodeURIComponent(`File:${file}`)}`;
  const json = (await (await get(url)).json()) as {
    query: { pages: Record<string, { imageinfo?: { url: string; thumburl?: string; mime: string; size: number; width: number; height: number; descriptionurl: string; extmetadata: Record<string, { value: string }> }[] }> };
  };
  const page = Object.values(json.query.pages)[0];
  return page?.imageinfo?.[0];
}

async function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const clubs = world.clubs.filter((c) => c.wikidata);
  const logos = await logosByQid(clubs.map((c) => c.wikidata as string));
  const registry: Record<string, CrestRecord> = {};
  let rejected = 0;
  for (const club of clubs) {
    const files = (logos.get(club.wikidata as string) ?? []).sort((a, b) => Number(REJECT_FILE.test(a)) - Number(REJECT_FILE.test(b)));
    for (const file of files) {
      const info = await commonsInfo(file);
      await sleep(250);
      if (!info) continue;
      const license = strip(info.extmetadata.LicenseShortName?.value) ?? "";
      if (!ACCEPT.test(license)) {
        rejected++;
        continue;
      }
      const svg = info.mime === "image/svg+xml" && info.size < 250_000;
      const src = svg ? info.url : info.thumburl ?? info.url;
      const res = await get(src);
      if (!res.ok) continue;
      const ext = svg ? "svg" : "png";
      const name = `${club.id}.${ext}`;
      writeFileSync(join(OUT_DIR, name), Buffer.from(await res.arrayBuffer()));
      registry[club.id] = {
        file: `/crests/${name}`,
        title: file,
        sourcePage: info.descriptionurl,
        license,
        licenseUrl: info.extmetadata.LicenseUrl?.value,
        artist: strip(info.extmetadata.Artist?.value),
        restrictions: strip(info.extmetadata.Restrictions?.value),
        width: info.width,
        height: info.height,
      };
      console.log(`  ✓ ${club.name}: ${license}`);
      break;
    }
  }
  writeFileSync(REGISTRY, JSON.stringify({ fetchedAt: new Date().toISOString(), source: "Wikimedia Commons via Wikidata P154", crests: registry }, null, 1));
  console.log(`\n${Object.keys(registry).length}/${clubs.length} clubs have redistributable crests (${rejected} files rejected for licence).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
