# Persistence

- **Database**: Dexie over IndexedDB (`pitchborn`), tables `meta` (save list), `saves` (current state), `backups` (rotating, max 3 per save), `kv` (active save id). Never localStorage for career data (localStorage only holds theme and ad-consent preferences).
- **Codec** (`codec.ts`): lossless compact encoding — player attribute/stat objects become arrays; stored as a JSON string (string clones into IndexedDB ~2× faster than object graphs). ~8 MB raw per world.
- **Autosave** after every week (toggle in Settings) and after user matches/transfers; backups on career start, manual saves, season starts, retirement and imports.
- **Schema versioning**: `GameState.schemaVersion` (engine `SCHEMA_VERSION`) with step migrations in `migrations.ts`; newer saves are refused with a clear message. Dexie structural versions are separate.
- **Validation on load**: zod shape check + `checkInvariants` (squads, contracts, leagues, fixtures, goal/score reconciliation).
- **Recovery**: if the primary record fails to decode/validate, the newest valid backup loads automatically and the user is told.
- **Export/import**: `.pbsave` (gzip via `CompressionStream` when available, else JSON) with a format header; imports are validated and migrated, and saved as a copy if the id exists.
