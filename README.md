PitchBorn
=========

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-5-433E38?style=flat-square)](https://zustand-demo.pmnd.rs/)
[![Dexie](https://img.shields.io/badge/Dexie-IndexedDB-FF6B6B?style=flat-square)](https://dexie.org/)
[![Zod](https://img.shields.io/badge/Zod-4-3E67B1?style=flat-square&logo=zod&logoColor=white)](https://zod.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-5-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev/)
[![PWA](https://img.shields.io/badge/PWA-offline-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://pitch-born.vercel.app)

**A free, browser-based football career simulator. Live one footballer's entire life, from academy prospect to retired legend, inside a living football world built on real clubs, leagues and stadiums.**

<br>

# 🔗 Live — [PitchBorn](https://pitch-born.vercel.app)

> Free · No account · No backend · Plays offline (installable PWA)

* * *

## Table of Contents

- [Screenshots](#screenshots)
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [How to Play](#how-to-play)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Weekly Turn Flow](#weekly-turn-flow)
- [Folder Structure](#folder-structure)
- [Data Pipeline](#data-pipeline)
- [Persistence](#persistence)
- [Local Development](#local-development)
- [Testing](#testing)
- [Simulation & Calibration Tools](#simulation--calibration-tools)
- [Deployment](#deployment)
- [Advertising & Privacy](#advertising--privacy)
- [Data Sources & Legal](#data-sources--legal)
- [Documentation](#documentation)
- [About](#about)

* * *

## Screenshots

> Every screen supports light and dark mode (toggle in the header, or follow the system setting).

### Landing Page

The pitch: a free career sim, the career arc from academy to legacy, and a scrolling ticker of the real clubs in the game.

**Light**

[![Landing page — light](docs/images/landing.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/landing.png)

**Dark**

[![Landing page — dark](docs/images/landing-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/landing-dark.png)

**Mobile**

<p align="center">
  <a href="https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/landing-mobile.png"><img src="docs/images/landing-mobile.png" alt="Landing page — mobile" width="320"></a>
</p>

### New Career — Create Your Player

Name, nationality (a different birth country gives dual eligibility), position, foot, height and look.

**Light**

[![New career, step 1 — light](docs/images/new-career-1.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/new-career-1.png)

**Dark**

[![New career, step 1 — dark](docs/images/new-career-1-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/new-career-1-dark.png)

### New Career — Position & Playstyle

**Light**

[![New career, step 2 — light](docs/images/new-career-2.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/new-career-2.png)

**Dark**

[![New career, step 2 — dark](docs/images/new-career-2-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/new-career-2-dark.png)

### New Career — Pick Your Club

Academy prospect (17) or late starter (20), then any of the real clubs. Bigger clubs mean fewer early minutes.

**Light**

[![New career, pick a club — light](docs/images/new-career-club.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/new-career-club.png)

**Dark**

[![New career, pick a club — dark](docs/images/new-career-club-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/new-career-club-dark.png)

### Dashboard

Your player card, open offers, the league table around your club, this season's numbers, a match-rating chart and your next fixtures.

**Light**

[![Dashboard — light](docs/images/dashboard.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/dashboard.png)

**Dark**

[![Dashboard — dark](docs/images/dashboard-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/dashboard-dark.png)

### Match Day — Briefing

Selection reasons and the match briefing before kick-off: play it live or quick-sim it.

**Light**

[![Match day briefing — light](docs/images/match-briefing.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/match-briefing.png)

**Dark**

[![Match day briefing — dark](docs/images/match-briefing-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/match-briefing-dark.png)

### Match Day — Live Match

Phase-by-phase commentary with speed controls, filters (All / You / Key) and live team stats. When the ball falls to you, you choose what to do.

**Light**

[![Live match — light](docs/images/match-live.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/match-live.png)

**Dark**

[![Live match — dark](docs/images/match-live-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/match-live-dark.png)

### Match Day — Full Time

Result, player ratings and the match log.

**Light**

[![Full time — light](docs/images/match-fulltime.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/match-fulltime.png)

**Dark**

[![Full time — dark](docs/images/match-fulltime-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/match-fulltime-dark.png)

### Schedule

**Light**

[![Schedule — light](docs/images/schedule.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/schedule.png)

**Dark**

[![Schedule — dark](docs/images/schedule-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/schedule-dark.png)

### My Player

Attributes, traits, development and form.

**Light**

[![My player — light](docs/images/profile.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/profile.png)

**Dark**

[![My player — dark](docs/images/profile-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/profile-dark.png)

### Training

Set your weekly focus and intensity.

**Light**

[![Training — light](docs/images/training.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/training.png)

**Dark**

[![Training — dark](docs/images/training-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/training-dark.png)

### Club & Squad

**Light**

[![Club and squad — light](docs/images/club.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/club.png)

**Dark**

[![Club and squad — dark](docs/images/club-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/club-dark.png)

### Competitions

Tables, cups and knockout brackets.

**Light**

[![Competitions — light](docs/images/league.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/league.png)

**Dark**

[![Competitions — dark](docs/images/league-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/league-dark.png)

### Career & Contract — Transfers

Offers, bids, loans, transfer requests and contract talks.

**Light**

[![Transfers — light](docs/images/transfers.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/transfers.png)

**Dark**

[![Transfers — dark](docs/images/transfers-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/transfers-dark.png)

### National Team

Allegiance, call-ups and international tournaments.

**Light**

[![National team — light](docs/images/national.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/national.png)

**Dark**

[![National team — dark](docs/images/national-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/national-dark.png)

### Statistics

**Light**

[![Statistics — light](docs/images/stats.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/stats.png)

**Dark**

[![Statistics — dark](docs/images/stats-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/stats-dark.png)

### Awards

**Light**

[![Awards — light](docs/images/awards.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/awards.png)

**Dark**

[![Awards — dark](docs/images/awards-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/awards-dark.png)

### Iconic Moments

The stories your career actually told.

**Light**

[![Iconic moments — light](docs/images/memories.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/memories.png)

**Dark**

[![Iconic moments — dark](docs/images/memories-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/memories-dark.png)

### History & Records

**Light**

[![History and records — light](docs/images/history.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/history.png)

**Dark**

[![History and records — dark](docs/images/history-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/history-dark.png)

### World News

**Light**

[![World news — light](docs/images/world.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/world.png)

**Dark**

[![World news — dark](docs/images/world-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/world-dark.png)

### Settings & Saves

Theme, backups and import/export.

**Light**

[![Settings — light](docs/images/settings.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/settings.png)

**Dark**

[![Settings — dark](docs/images/settings-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/settings-dark.png)

### My Saves

**Light**

[![My saves — light](docs/images/saves.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/saves.png)

**Dark**

[![My saves — dark](docs/images/saves-dark.png)](https://github.com/yuvrajsatyapal/PitchBorn/blob/main/docs/images/saves-dark.png)

* * *

## Project Overview

PitchBorn is for anyone who has played a football career mode and wished it were about *one person's life* rather than a club's trophy cabinet, and who would rather not pay for it or create an account.

| Problem | PitchBorn's answer |
|---|---|
| Career sims are paid, bloated and tied to one platform | Free, in the browser, installable, plays offline |
| Real-player databases mean licensing and likeness risk | Real clubs, leagues and stadiums from open data; **all players are fictional**, all ratings are PitchBorn's own |
| Matches are either watched passively or skipped | Every match is simulated phase by phase; when the ball falls to you, you choose: shoot, take a touch, square it, slide in, rush out |
| Careers feel scripted | Minutes, ratings, training, environment, morale and personality drive growth; you peak, plateau and decline, and the legacy screen tells the story that actually happened |
| Needs a server, an account, a subscription | Fully client-side static export. Saves live in your browser (IndexedDB) |

* * *

## Key Features

### A Living Football World
- **298 real clubs in 15 leagues**: three tiers across England, Spain, Germany, Italy and France
- Domestic cups, the Champions Cup, and national-team tournaments in even years
- Club AI that buys, sells, renews and retires thousands of simulated players around you
- 44 historical seasons of real results for context

### Match Engine With Decisions
- Event-based engine, simulated phase by phase
- **Play live** (key-moment decisions) or **Quick sim**
- Live commentary with speed controls, All / You / Key filters, and team stats (possession, shots, xG, passes, corners, fouls, cards)
- Match Day briefing with selection reasons, and a full-time ratings screen

### Player Development
- **33 attributes** (27 outfield, 6 goalkeeping) with position weights and ageing curves
- Weekly **training** focus and intensity, desired playstyles, and traits
- Injuries, form, fitness, sharpness and morale

### Career Decisions
- Summer and January transfer windows; clubs bid, and can reject, your offers
- Negotiate wage, role and length, with clauses and bonuses
- Ask for loans, hand in transfer requests, renew contracts, or leave as a free agent
- Club overview and relationships, managers, and national-team allegiance and invitations

### Honours & Legacy
- Leagues, domestic cups, the Champions Cup, Player of the Month, Golden Boots and the Golden Pitch
- Retire from 32 (forced eventually) and get a **legacy** score, tier and the **Iconic Moments** your career produced

### Theming
- Neo-retro design: cream paper, ink outlines, hard offset shadows, chunky display type and a pixel scoreboard font
- Light and dark themes, persisted per browser

### Offline & Private
- Installable PWA with a generated service worker that precaches the whole app
- No account, no backend; saves never leave your device. Export and import backups from Settings

* * *

## How to Play

1. **Start a career**: name, nationality, position, foot, height and look. Choose *Academy prospect* (17) or *Late starter* (20) and pick any real club.
2. **Each week** set your training focus and intensity, then press **Continue**. When your team plays you get a **Match Day**: *Play live* or *Quick sim*.
3. **Grow**: minutes, ratings, training, environment, morale and personality drive development.
4. **Move**: in the summer and January windows clubs bid for you. You negotiate wage, role and length.
5. **Win**: leagues, cups, the Champions Cup, national-team tournaments and individual awards.
6. **Retire** and see your **legacy**.

The season is 50 turns long: league turns 4–43, season end at 44, summer window 45–50.

* * *

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 16 (App Router, `output: "export"`) | Static site, routing, zero hosting cost |
| UI | React 19, Tailwind CSS 4 | Screens and the neo-retro design system |
| Language | TypeScript 5 | End-to-end types; the engine is pure TS |
| State | Zustand 5 | Application layer: actions, autosave, live-match handle |
| Persistence | Dexie 4 (IndexedDB) | Local saves, backups, import/export |
| Validation | Zod 4 | Dataset and save-shape validation |
| Flags | flag-icons | Country flags (MIT) |
| Analytics | Vercel Web Analytics | Page views only; kept out of the service-worker cache |
| Unit / sim tests | Vitest 5, fake-indexeddb | Engine, persistence and calibration tests |
| E2E | Playwright (desktop + mobile) | Full career flows against the static export |
| Imaging | sharp | Icon rendering and career-art optimisation |
| Scripting | tsx | Data pipeline and stress simulators |

* * *

## System Architecture

```mermaid
flowchart TB
    subgraph Browser
        Pages["Next.js App Router pages<br/>src/app"]
        UI["Game UI components<br/>src/components"]
        Store["Application layer (Zustand)<br/>src/game"]
        Engine["Simulation engine (pure TS)<br/>src/engine"]
        Persist["Persistence<br/>src/persistence"]
        IDB[("IndexedDB")]
        SW["Service worker<br/>offline precache"]
    end
    Ads["Ads / sponsor slots<br/>src/ads (presentation only)"]
    World[("world.json<br/>clubs, leagues, stadiums")]

    Pages --> UI --> Store --> Engine
    Store --> Persist --> IDB
    Engine --> World
    Pages -.-> Ads
    SW -.-> Pages
```

Key decisions:

| Decision | Rationale |
|---|---|
| Static export | $0 hosting, works on any static host or CDN, enables offline PWA |
| Engine is pure TypeScript, no React or DOM | Testable in Node, simulated in worker threads for stress tests, deterministic |
| Mutable `GameState` plus a version counter | Fast for ~9k players; the store bumps `version` after each action. UI derives values every render and never memoises on the game object |
| Seeded RNG stored in the state | Same seed and same choices give the same career; live matches fork a stream per fixture |
| Main-thread simulation | ~115 ms per week in Node, ~150–250 ms in the browser including autosave; a Web Worker did not justify moving state ownership across threads |
| Fictional players | Avoids right-of-publicity risk for an ad-supported game |
| No bundled crests or logos | Trademark safety: crests, kits and portraits are generated |
| Ads are presentation-only | The engine never imports `src/ads` |

* * *

## Weekly Turn Flow

```mermaid
flowchart LR
    A[Set training focus] --> B[Continue]
    B --> C{Match this week?}
    C -- No --> F[Advance world one week]
    C -- Yes --> D[Match Day briefing]
    D --> E1[Play live: key decisions]
    D --> E2[Quick sim]
    E1 --> F
    E2 --> F
    F --> G[Training, injuries, form, morale]
    G --> H[Transfer window and offers]
    H --> I{Season end?}
    I -- No --> A
    I -- Yes --> J[Awards, promotion and relegation, rollover]
    J --> A
```

* * *

## Folder Structure

```
PitchBorn/
├── src/
│   ├── app/                  # Next.js routes (landing, new, saves, credits, privacy, play/*)
│   ├── components/           # app shell, art, game widgets, landing, ui primitives
│   ├── game/                 # Zustand store and selectors
│   ├── engine/               # Pure TS simulation
│   │   ├── players/          # attribute model, generation, development, economy
│   │   ├── match/            # lineups, formations, event-based match engine
│   │   ├── competitions/     # fixtures, tables, knockouts
│   │   ├── season/           # matchday, awards, weekly orchestrator
│   │   ├── transfers/        # club AI market, contracts, retirements
│   │   ├── career/           # offers, negotiation, events, legacy
│   │   ├── national/         # call-ups and tournaments
│   │   ├── traits/ club/ managers/ memory/ stats/ appearance/ jersey/ ...
│   │   ├── balance.ts        # every balancing constant in one place
│   │   └── rng.ts            # seeded sfc32 RNG
│   ├── persistence/          # codec, migrations, Dexie db, save service
│   ├── ads/                  # ad config, providers, consent, sponsor slots
│   └── data/                 # generated world.json and asset manifests
├── scripts/
│   ├── data/                 # fetch + build the open-data pipeline
│   ├── sim/                  # calibration and stress simulators
│   ├── pwa/                  # icon rendering, service-worker generation
│   └── career/               # career-art optimisation
├── data/                     # raw open data (committed) and curated overrides
├── tests/                    # Vitest unit and simulation tests
├── e2e/                      # Playwright specs (desktop + mobile)
├── docs/                     # design, architecture and operations docs
│   └── images/               # README screenshots
├── public/                   # icons and images
└── out/                      # static export (build output, git-ignored)
```

* * *

## Data Pipeline

```mermaid
flowchart LR
    W[Wikidata SPARQL] --> F["scripts/data/fetch.ts"]
    O[OpenFootball clubs] --> F
    J[football.json] --> F
    F --> R[("data/raw (committed)")]
    R --> B["scripts/data/build.ts"]
    C["data/curated<br/>overrides, countries"] --> B
    B --> V{"zod + cross-reference checks"}
    V --> M[("src/data/world.json")]
```

Clubs, leagues, stadiums, capacities, founding years, colours and historical results are real and CC0. Everything else (players, ratings, potentials, market values and development curves) is PitchBorn's own.

* * *

## Persistence

- Autosave to IndexedDB through Dexie after every action
- Versioned save codec (`SCHEMA_VERSION` 15) with migrations; older saves are upgraded on load, and saves from a future version are refused
- Backup recovery, and export / import of saves from Settings
- Attributes are stored in a fixed order. New ones are appended and the order is never rearranged

* * *

## Local Development

### Prerequisites

- Node.js 20+ and npm

### Setup

```bash
git clone https://github.com/yuvrajsatyapal/PitchBorn.git
cd PitchBorn
npm install
npm run dev
```

Open http://localhost:3000.

### Development Commands

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Static production export to `out/` plus service-worker generation |
| `npm run preview` | Serve `out/` on http://localhost:4173 |
| `npm test` | Vitest unit and simulation tests |
| `npm run e2e` | Builds an E2E export and runs Playwright (desktop + mobile) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run data:fetch` / `npm run data:build` | Refresh raw open data / rebuild `src/data/world.json` |
| `npm run icons` | Re-render PWA icons |
| `npm run career:assets` | Optimise landing career art |

* * *

## Testing

| Suite | Covers |
|---|---|
| **Vitest** (`tests/`) | RNG determinism; dataset schema and cross-references; match engine determinism, stat/event reconciliation, scoreline sanity, knockout winners; fixtures, tables and tie-breaks; a full season with invariants; transfers keeping squads consistent; negotiation; retirement and legacy; codec round-trip; migrations; IndexedDB save, load, backup and import/export; attribute model, traits and wages |
| **Playwright** (`e2e/`) | Landing to new career to dashboard, advancing weeks, quick sim and live matches, persistence across reloads, club flows, offline, ads |
| **Stress sims** | Hundreds of full careers run in worker threads (see below) |

E2E runs against the static production export (what users get) in desktop and mobile projects. See [`docs/TESTING.md`](docs/TESTING.md).

* * *

## Simulation & Calibration Tools

| Command | Purpose |
|---|---|
| `npm run sim:careers -- --count 100` | Career stress simulator; writes `data/reports/sim-100.md` |
| `npm run sim:match` | Match-engine calibration |
| `npm run sim:pairs` | Pairing calibration |
| `npm run sim:traits` | Trait distribution sanity |
| `npm run sim:wages` | Renewal and wage sanity |
| `npm run sim:attributes` / `sim:attribute-effects` / `sim:attributes-world` | Attribute model checks |

* * *

## Deployment

`npm run build` produces a static site in `out/`. Host it anywhere static: Vercel, Cloudflare Pages, GitHub Pages, Netlify or S3 + CDN.

- Build command `npm run build`, output directory `out`
- `trailingSlash: true`, so routes are `/play/`, `/play/league/` and so on, with no rewrites needed
- Serve `sw.js` with `Cache-Control: no-cache` so updates roll out; hashed `/_next/static` assets can be cached immutably
- Data refresh: `npm run data:fetch && npm run data:build`, commit `data/raw` and `src/data/world.json`, then rebuild

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

* * *

## Advertising & Privacy

- Ads are presentation-only and never touch the simulation
- `NEXT_PUBLIC_AD_PROVIDER` selects `none`, `placeholder` or `adsense` (default: placeholder in dev, none in production)
- A consent integration point is available via `NEXT_PUBLIC_ADS_REQUIRE_CONSENT`
- Never commit real ad IDs

See [`docs/ADVERTISING.md`](docs/ADVERTISING.md) and [`docs/PRIVACY.md`](docs/PRIVACY.md).

* * *

## Data Sources & Legal

Club, stadium and league facts come from open data (Wikidata, OpenFootball). All players are fictional and all ratings are PitchBorn's own. PitchBorn is not affiliated with or endorsed by any club, league or federation. Full licences and attribution: [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) and the in-app [Credits](https://pitch-born.vercel.app/credits/) page.

* * *

## Documentation

| Doc | Topic |
|---|---|
| [`GAME_DESIGN.md`](docs/GAME_DESIGN.md) | Game design |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, directory map, key decisions |
| [`SIMULATION.md`](docs/SIMULATION.md) | Match, career, transfers and progression |
| [`CAREER_SYSTEMS.md`](docs/CAREER_SYSTEMS.md) | Clubs, contracts, national team, wages |
| [`ATTRIBUTES.md`](docs/ATTRIBUTES.md) / [`TRAITS.md`](docs/TRAITS.md) | Attribute and trait models |
| [`DATA_MODEL.md`](docs/DATA_MODEL.md) | Runtime state types |
| [`PERSISTENCE.md`](docs/PERSISTENCE.md) | Saves, codec, migrations |
| [`DATA_PIPELINE.md`](docs/DATA_PIPELINE.md) / [`DATA_SOURCES.md`](docs/DATA_SOURCES.md) | Open-data pipeline and licences |
| [`TESTING.md`](docs/TESTING.md) / [`DEVELOPMENT.md`](docs/DEVELOPMENT.md) / [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Tests, dev workflow, hosting |
| [`PROJECT_STATE.md`](docs/PROJECT_STATE.md) | Current status |

* * *

## About

**PitchBorn** is built by [Yuvraj Satyapal](https://github.com/yuvrajsatyapal).

🔗 **Play it:** [pitch-born.vercel.app](https://pitch-born.vercel.app)
