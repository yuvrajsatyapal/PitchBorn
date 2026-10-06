# Architecture

```
Next.js App Router pages (src/app)          ← static export, all client-rendered game screens
        │
Game UI components (src/components)          ← design system, generated art, game widgets
        │
Application layer (src/game)                 ← Zustand store: actions, autosave, live match handle
        │
Simulation engine (src/engine)               ← pure TypeScript, no React/DOM; deterministic RNG
        │
Persistence (src/persistence)                ← codec, migrations, Dexie/IndexedDB, import/export
        │
IndexedDB
```

Advertising (`src/ads`) is a presentation concern wired into page layouts only; the engine never imports it.

## Directory map
| Path | Purpose |
|---|---|
| `src/engine/types.ts` | All runtime state types (`GameState`, `Player`, `Competition`…) |
| `src/engine/rng.ts` | sfc32 seeded RNG with serialisable state |
| `src/engine/balance.ts` | Every balancing constant in one place |
| `src/engine/data/` | Dataset schema/validation, world lookups, name pools |
| `src/engine/players/` | Attributes, generation, development/training, injuries, economy |
| `src/engine/match/` | Lineups/formations and the event-based match engine |
| `src/engine/competitions/` | Fixtures, tables, season setup, knockout progression |
| `src/engine/season/` | Matchday application, awards, the weekly orchestrator (`advance.ts`) |
| `src/engine/transfers/` | Club AI market, contracts, retirements, youth intake |
| `src/engine/career/` | User offers/negotiation, events, legacy, autopilot (tests) |
| `src/engine/national/` | Call-ups, international windows, tournaments |
| `src/engine/world/` | World creation and state helpers |
| `src/engine/validate.ts` | Save-shape schema and game invariants |
| `src/persistence/` | Codec, migrations, Dexie DB, save service |
| `src/game/` | Zustand store and UI selectors |
| `src/ads/` | Ad config, provider abstraction, consent, slot components |
| `scripts/data/` | Data pipeline |
| `scripts/sim/` | Calibration and stress simulation |
| `scripts/pwa/` | Icon rendering and service-worker generation |

## Key decisions
- **Static export** (`output: "export"`): zero hosting cost, works on any static host/CDN, enables offline PWA.
- **Mutable engine state + version counter**: the engine mutates `GameState` in place (fast for ~9k players); the store bumps `version` after each action. UI derives values every render — never memoise on the game object.
- **Determinism**: all randomness goes through `Rng` stored in the state; live matches fork a stream per fixture. Same seed + same choices ⇒ same career.
- **Main-thread simulation**: profiling shows ~115 ms per simulated week in Node and ~150–250 ms in the browser including autosave. A busy indicator covers it; multi-week sims yield between weeks. A Web Worker would require moving state ownership across threads; the measured cost did not justify it yet (see PERFORMANCE in TESTING.md).
- **No WASM/Rust**: not needed per profiling.
