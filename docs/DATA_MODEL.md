# Data model

Static (bundled, `src/data/world.json`, schema `src/engine/data/schema.ts`): `Country`, `Stadium`, `Club`, `League`, `HistoricalSeason`, `Source`.

Runtime (`src/engine/types.ts`), all inside one serialisable `GameState`:
- `players: Record<id, Player>` — attributes, hidden traits, contract/loan, condition (fitness, morale, form, sharpness), injury, suspension, reputation, per-competition season stats, career totals, season history (NPCs keep 4), international record, appearance.
- `clubs: Record<id, ClubState>` — league, dynamic reputation, balance, formation, manager, academy/facilities, squad ids, form, expectation.
- `competitions: Record<id, Competition>` — leagues, cups, continental, international; fixtures with results (goal events; full detail for user matches), tables/groups, knockout state, winner.
- `leagueClubs`, `nationalTeams`, `user: UserCareer` (timeline, offers, decisions, awards, trophies, transfers, relationships, training, boosts…), `news`, `archive` (per-season champions, tables, top scorers, awards, promotions), `records`, `legends` (retired notable NPCs), `transferLog`, `settings`, `pending` user matches, `rng` state.

IDs: clubs use stable slugs (`eng-arsenal`); players/fixtures use a per-save counter. Competition ids embed the season (`eng-1-2026`, `cup-eng-2026`, `ccup-2026`).
