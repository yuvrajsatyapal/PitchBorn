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

Add a country: add its leagues to `LEAGUE_SOURCES`, its OpenFootball club file, its country entry in `data/curated/countries.json` (with `hasLeagues: true`), then `npm run data:fetch -- --leagues=<ids> && npm run data:build`. The Wikidata Query Service sometimes throttles to one request a minute; `WD_DELAY_MS=62000` keeps under it and the fetcher retries 429s after 65 s.

**Eleven countries (Nov 2026).** England, Spain, Germany, Italy and France have three tiers; Portugal, the Netherlands, Brazil, Argentina and the US have two; Mexico has one (Liga MX). `closed: true` on a league source means no promotion or relegation between it and the tier above (USL Championship under MLS, and Liga MX, which has no relegation); the build writes `promoted: 0` / `relegated: 0` and the season rollover moves nobody.

**Curated rosters.** Wikidata membership is stale for some leagues (open-ended memberships from decades ago, and Boca Juniors missing from the Argentine top flight). `data/curated/rosters.json` lists the clubs for those leagues by English Wikipedia title (`|` separates alternative titles); `npm run data:fetch -- --rosters` resolves them in one query to `wikidata/roster-<league>.json`, and the build uses the roster instead of membership for that league. Rosters exist for `bra-1`, `bra-2`, `arg-1`, `arg-2`, `usa-2` and `mex-1`; Argentina's and MLS's big single tables are abstractions of the 20 best-known clubs. Toluca's article moved to "Toluca FC" (the old title is kept as an alternative), which is why Liga MX briefly had 17 clubs.

**Curated assignments (`overrides.json` → `assign`, `exclude`).** Where Wikidata membership lags a season, a club's league is set by hand: the 2025-26 Eredivisie (Heracles, NAC Breda and Volendam up; Cambuur, ADO Den Haag and Willem II in the Eerste Divisie). A curated assignment also skips the reserve-team filter, which otherwise reads Willem II's "II" as a second team. MLS is the United States league here: Toronto FC and Vancouver Whitecaps are excluded and Inter Miami and Columbus Crew take their places. Clubs that leave the dataset go into `src/data/legacy-clubs.json` (club and stadium records copied from the last world they were in): older saves still simulate them, so their names, colours and grounds stay readable, but a new world never includes them.

**Prestige without history.** football.json has no Brazilian, Argentine or US tables. Outside the big five, a club with no historical seasons takes its prestige from its tier and stadium capacity (`(tierBase + 8 + (capScore − 15) × 1.8) × league factor`), which spreads Flamengo and River Plate above smaller clubs. The stadium alone can't tell Santos from Mirassol, so `overrides.json` → `standing` gives these clubs an editorial size from honours and support (0 small, 1 typical, 2 big, 3 giant; unlisted clubs count as 1), worth 3 prestige points a step around 1.5 so a league's average stays put. Big-five clubs are unchanged by this rule. Série B 2026 follows the 2025 Série A relegations (Ceará, Fortaleza, Juventude, Sport) and the Série C promotions (Londrina, Náutico, Ponte Preta, São Bernardo); the clubs relegated from Série B to Série C are the least certain part of the list.

**Real managers**: current head coaches (Wikidata P286, no end date, latest start wins) are imported for clubs and national teams (`npm run data:fetch -- --managers-only`, then `npm run data:build`). Names come from the coach's English Wikipedia article title (more patrolled than Wikidata labels), with filters for vacancies and keyboard-mash vandalism; citizenship maps to a Pitchborn country when it is one of our nations, otherwise no flag is shown. Corrections go in `data/curated/managers.json` (keyed by club QID or country code; `null` falls back to a generated coach). Real free-agent coaches live in `managers.json` → `freeAgents` (name, nationality, birth year, Pitchborn's own `stature`). In-game, a sacked manager joins a pool with these free agents; the club then usually (75%) hires the best-fitting pool coach whose stature is within −25/+8 of its reputation, otherwise a generated coach. Coaches already employed at snapshot time are skipped until they become free; coaches retire from the pool at 75 (`src/engine/world/managers.ts`). They are real public figures shown factually by name; as with players below, using real names in an ad-supported game carries some image-rights risk, so this is easy to switch off by emptying the raw files or nulling entries.

**Real players**: deliberately not imported. Using real names in an ad-supported game raises personality/image-rights questions (a legal/business decision). The world uses generated players; the pipeline could add a Wikidata squad import behind a flag if licensing is resolved.
