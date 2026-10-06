# Football data pipeline

```
approved sources (scripts/data/sources.ts)
  → fetch (npm run data:fetch)          → data/raw/  (committed snapshots; builds never hit the network)
  → parse  (wikidata.ts, openfootball.ts)
  → normalise (normalize.ts: name keys, short names, colours, abbreviations)
  → resolve league membership + dedupe (latest membership start wins; dissolved/reserve/season items excluded; surplus demoted to the tier below)
  → curation overrides (data/curated/overrides.json)
  → stable ids (country-slug) + stadium dedupe
  → historical tables from football.json results, matched via OpenFootball aliases
  → Pitchborn prestige (own formula: weighted recent finishes + tier + stadium size + league depth factor)
  → validate (zod + cross-references: duplicate clubs/ids/wikidata, invalid countries, missing stadiums/leagues, league sizes, impossible founding years, W+D+L=P)
  → src/data/world.json + data/reports/build-report.md
```

Add a country: add its leagues to `LEAGUE_SOURCES`, its OpenFootball club file, its country entry in `data/curated/countries.json`, then `npm run data:fetch && npm run data:build`.

**Real players**: deliberately not imported. Using real names in an ad-supported game raises personality/image-rights questions (a legal/business decision). The world uses generated players; the pipeline could add a Wikidata squad import behind a flag if licensing is resolved.
