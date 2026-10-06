# Development

- Node 22+, `npm install`, `npm run dev`.
- Engine code must stay framework-free (no React/DOM imports in `src/engine`).
- All balancing numbers live in `src/engine/balance.ts`; re-run `npm run sim:match` and `npm run sim:careers -- --count 50` after changes.
- State changes that affect saves: bump `SCHEMA_VERSION` and add a step in `src/persistence/migrations.ts` with a test.
- UI: never `useMemo` on the game object — it is mutated in place; derive per render.
- Before committing: `npm run lint && npm run typecheck && npm test` (and `npm run e2e` for UI changes).
- In dev and E2E builds `window.__pitchborn` exposes the store for debugging/fast-forwarding.
