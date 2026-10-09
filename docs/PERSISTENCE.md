# Persistence

- **Database**: Dexie over IndexedDB (`pitchborn`), tables `meta` (save list), `saves` (current state), `backups` (rotating, max 3 per save), `kv` (active save id). Never localStorage for career data (localStorage only holds theme and ad-consent preferences).
- **Codec** (`codec.ts`): lossless compact encoding — player attribute/stat objects become arrays; stored as a JSON string (string clones into IndexedDB ~2× faster than object graphs). ~8 MB raw per world.
- **Autosave** after every week (toggle in Settings) and after user matches/transfers; backups on career start, manual saves, season starts, retirement and imports.
- **Schema versioning**: `GameState.schemaVersion` (engine `SCHEMA_VERSION`) with step migrations in `migrations.ts`; newer saves are refused with a clear message. Dexie structural versions are separate.
- **Validation on load**: zod shape check + `checkInvariants` (squads, contracts, leagues, fixtures, goal/score reconciliation).
- **Recovery**: if the primary record fails to decode/validate, the newest valid backup loads automatically and the user is told.
- **Export/import**: `.pbsave` (gzip via `CompressionStream` when available, else JSON) with a format header; imports are validated and migrated, and saved as a copy if the id exists.

## Schema 10 (career-systems pass)
Added, all optional so older saves load: `user.matchLog`, `user.reserveLog`, `user.relLog`, `user.pay` (income ledger + paid keys), `user.intl` (international invitations), `user.objectives`, `user.preMatch`, contract clauses on `Contract`/`ContractTerms`, `Player.intl.{allegiance,switches,compCaps}`. `engine/world/sanitize.ts` runs on every load: it rebuilds the ledger (earlier income kept as "earlier"), backfills the match log from the old recent-ratings list, drops malformed clauses, makes international fields consistent without inferring a switch from birthplace, and clamps club styles. See `docs/CAREER_SYSTEMS.md`.

## Schema 11 (manager history and squad numbers)
Added, all optional: `GameState.managers` (tenure registry), `ClubState.manager.id` / `PoolManager.id`, `ClubState.retiredNumbers`, `Player.squadNo`, `NationalTeamState.numbers`, `user.mgr` (stints, meetings, seen-keys), `user.jersey` (number tenures, national numbers). On every load `ensureManagerIds` / `sanitizeManagerState` / `sanitizeJersey` run: every manager gets an id and an open tenure at his club (a manager listed twice keeps one), the user's stints are validated with at most one open, squads are repaired deterministically (duplicates and malformed numbers get new ones, valid numbers are kept), and the user's history opens from the current state. Nothing is back-filled.

## Schema 14 (development focus and loyalty record)
Added, all optional: `Player.focus` (the development focus id; absent means no preference) and `Player.stay` (the loyalty counters behind One-Club Minded, tied to the club they were kept at). Migration 13 → 14 records the user's focus as "none" (a childhood aspiration is never inferred from today's traits) and changes no trait. `sanitizeTraits` runs on every load: a focus the position cannot choose becomes no preference, an NPC's explicit "none" is dropped, and a loyalty record for another club or with invalid numbers is discarded (it rebuilds from the recorded seasons at the next review). Nothing here is part of the codec's fixed-shape arrays; both fields ride along in the player record.
