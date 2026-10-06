# Pitchborn

**A free, browser-based football career simulator.** Live one footballer's entire life — academy prospect, debut, breakthrough, transfers, trophies, international caps, prime, decline, retirement and legacy — inside a living football world built on real clubs, leagues and stadiums.

- Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Zustand · Dexie (IndexedDB) · Zod · Vitest · Playwright
- Fully client-side static export: no backend, no account, no paid services. Installable PWA that plays offline.
- 298 real clubs in 15 leagues (3 tiers × England, Spain, Germany, Italy, France) from CC0 open data. All players are fictional; all ratings are Pitchborn's own.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. Other scripts:

| Script | What it does |
|---|---|
| `npm run build` | Static production export to `out/` + service worker generation |
| `npm run preview` | Serve `out/` on http://localhost:4173 |
| `npm test` | Vitest unit/simulation tests |
| `npm run e2e` | Builds an E2E export and runs Playwright (desktop + mobile) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run data:fetch` / `npm run data:build` | Refresh raw open data / rebuild `src/data/world.json` |
| `npm run sim:careers -- --count 100` | Career stress simulator (writes `data/reports/sim-100.md`) |
| `npm run sim:match` | Match-engine calibration |

## How to play

1. **Start a career** — name, nationality (a different birth country gives dual eligibility), position, foot, height and look. Choose *Academy prospect* (17) or *Late starter* (20) and pick any real club. Bigger clubs mean fewer early minutes.
2. **Each week** set your training focus and intensity, then press **Continue**. When your team plays you get a **Match Day**: *Play live* to make key-moment decisions (shoot, take a touch, square it, slide in, rush out…) or *Quick sim*.
3. **Grow** — minutes, ratings, training, environment, morale and personality drive development. You peak, plateau and eventually decline.
4. **Move** — in the summer and January windows clubs bid for you. Your club can reject bids; you negotiate wage, role and length. Ask for loans, hand in transfer requests, renew contracts, or leave as a free agent.
5. **Win** — leagues, domestic cups, the Champions Cup, national-team tournaments, Player of the Month, Golden Boots and the Golden Pitch.
6. **Retire** (from 32, forced eventually) and see your **legacy** — a score, tier and the stories your career actually told.

## Documentation

See [`docs/`](docs/): game design, architecture, simulation (match/career/transfers/progression), data model, persistence, data pipeline, data sources & licences, advertising, privacy, testing, deployment and development. Current status: [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md).
