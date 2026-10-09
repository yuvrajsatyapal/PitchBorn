# Pitchborn — Project State (compaction-safe)

Read this first after any context reset. Keep it short and current.

## Stack / decisions
- Next.js 16 (App Router, **static export** `output: 'export'`) + React 19 + TS + Tailwind 4. No server; deploy anywhere static ($0).
- Engine: `src/engine/**` pure TS, no React. Persistence: Dexie (`src/persistence`). App layer: Zustand (`src/game`). Ads: `src/ads` (presentation only).
- Data pipeline: `scripts/data/fetch.ts` (Wikidata SPARQL + OpenFootball clubs + football.json → `data/raw/`, committed) → `scripts/data/build.ts` → `src/data/world.json` (validated with zod + cross-ref checks). Curation: `data/curated/overrides.json`, `countries.json`.
- Players are **fictional/generated** by default (right-of-publicity risk for real names in an ad-supported game). Clubs, leagues, stadiums, capacities, founding years, colours and historical results are real (CC0).
- No official crests/logos bundled (trademark); generated crests/kits/portraits. Flags from `flag-icons` (MIT).
- Continental/international comps + awards use original Pitchborn names (Champions Cup, Golden Pitch...).
- Design: neo-retro — cream paper, ink outlines, hard offset shadows, chunky display type, pixel scoreboard font (inspired by huggaplanet.com / riddlebox / shoppu.mochi).

## Status
- [x] Scaffold, deps, data pipeline, world.json (15 leagues, 3 tiers × 5 countries, 300 clubs, 44 historical seasons)
- [x] Engine core (rng, types, generation, match engine, season/advance) — src/engine/**
- [x] Career systems (dev, training, transfers, contracts, injuries, national, awards, events, legacy, autopilot)
- [x] Persistence (codec, Dexie db, migrations, import/export) — src/persistence/**
- [x] Stress tools: scripts/sim/calibrate-match.ts, scripts/sim/careers.mts (worker threads, --count, --full)
- [x] Zustand store / app layer (src/game)
- [x] UI screens: landing, new, saves, credits, privacy, /play/{dashboard, match, schedule, profile, training, club, league, transfers, national, stats, awards, history, world, settings, legacy}
- [x] Ads architecture (src/ads) — placeholder in dev, none in prod by default
- [x] PWA/offline (manifest, icons, generated sw.js)
- [x] Tests: vitest (see docs/TESTING.md), Playwright e2e (desktop+mobile), stress sims (100 careers done; rebalanced after)
- [x] Docs (docs/*.md, README)

## Key engine entry points
- createWorld(NewCareerInput) → GameState (world/create.ts)
- beginTurn / advanceTurn / simUserMatch / completeUserMatch / liveMatchRng / retireUser (season/advance.ts)
- Wages: playerWage / marketWage (players/economy.ts, the one model); retentionOffer / reservationWage (career/wages.ts) for renewals. Sim: `npm run sim:wages`. Design: docs/CAREER_SYSTEMS.md §10.
- prepareMatch(state, fixture, rng, {interactive, detail}) → MatchEngine (step/resolve/runToEnd) (season/matchday.ts, match/engine.ts)
- negotiate / setTransferRequest (career/offers.ts), resolveDecision (career/events.ts), retireFromInternational (national/national.ts)
- Calendar: 50 turns/season; season turns 4–43; season end 44; summer 45–50 (tournaments in even years)
- Perf: ~115ms/turn full world (node). Lite world via settings.countries for stress tests.

## Attribute model (schema 15)
`SCHEMA_VERSION` is 15. Players have 33 attributes (27 outfield, 6 goalkeeping); the canonical model is `src/engine/players/model.ts` (meanings, position weights, ageing, training, style profiles, seeding). Older saves are expanded on load by `players/expansion.ts` (migration 14 → 15, fitted to the old overall). The codec stores attributes in `ALL_ATTRS` order: legacy twenty first, new ones appended; never reorder. The match engine reads the new attributes as specialisms (`match/engine.ts`, `REF`); tactical fit is `match/lineup.ts`; recruitment `transfers/market.ts`; trait overlay `traits/attributeModel.ts`. Full reference: `docs/ATTRIBUTES.md`.

## Career systems pass (schema 10)
Club overview/relationships, Match Day briefing + selection reasons, knockout brackets, contract clauses and bonuses, national-team allegiance and invitations, match log + analytics, dashboard rating chart. Design and limits: `docs/CAREER_SYSTEMS.md`.

## Known issues / TODO
- Reds slightly high (~0.2/match); 9+ goal games ~0.5% (acceptable)
- Academy prospects at elite clubs rarely play — UI should surface loan advice
- UI derives from the mutable GameState on every render; never useMemo on the game object (identity never changes).
- Acceleration's automatic-play use is small (a share of the counter-attack chance after a won ball, plus the overall, ageing and the interactive jockey odds); keeper anticipation has no measurable effect on shots against (see docs/ATTRIBUTES.md, docs/SIMULATION.md).
