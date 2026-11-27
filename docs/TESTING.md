# Testing

## Unit & simulation (Vitest) — `npm test`
`tests/`: RNG determinism; dataset schema + cross-reference validation; match engine determinism, stat/event reconciliation, scoreline sanity, knockout winners, interactive decisions; fixtures (double round-robin), table points/sorting/tie-breaks, calendar fitting; a full single-country season (all fixtures played, points = 3×matches − draws, invariants, player goals = goal events, cups resolved, promotion/relegation + rollover); determinism of whole worlds; pending user matches; development/decline; market value; transfers keep squads consistent; negotiation completes transfers; retirement/legacy; codec round-trip and size; migrations (v1→v2, future refusal); IndexedDB save/list/load/delete, backup recovery, export/import.

Trait systems have their own files: `traits.test.ts`, `traitsExpansion.test.ts`, `foot.test.ts`, `oneClub.test.ts` (the loyalty record, eligibility, leaving the club, persistence, and a ten-season world that must produce some holders and few) and `developmentFocus.test.ts` (options per position, creation budget, fading, evidence boundaries, NPCs, persistence/migration). Attribute model tests: `attributeModel.test.ts` (the model tables are consistent and reachable, role overalls land on target, generation is deterministic and correlated but not copied, aggression does not rise with quality, goalkeepers see a goalkeeping-first profile), `attributeMigration.test.ts` (opening a schema-14 save and a schema-13 save: the thirteen new attributes exist, the original attributes and identity are unchanged, no trait changes, overall stays within one point, deterministic, idempotent, codec round trip), `attributeSystems.test.ts` (playstyle options and leans, the fixed training budget, ageing classes, tactical fit and selection, recruitment, the trait overlay) and `attributeEngine.test.ts` (the match engine moves in the intended direction for each new attribute; these run whole matches and take up to a minute each).

Sanity sims: `npm run sim:traits`, `npx tsx scripts/sim/loyalty.ts`, `npx tsx scripts/sim/focus.ts`, `npm run sim:wages` (renewal and wage sanity; see `docs/CAREER_SYSTEMS.md` §10). `tests/wages.test.ts` covers the wage model: no automatic raise, retention premium bands, the loyalty discount cap, loyalty pull, rival poaching, NPC renewals and determinism.

## E2E (Playwright) — `npm run e2e`
Runs against the static export on desktop (1440×900) and mobile (Pixel 7): new career, advancing weeks and match days, live match to full time, persistence across reloads, a full season to rollover, retirement/legacy, sponsor labels/placement rules (sections never in nav, never on transfers or training, four in the rail on wide screens and one per page on phones), gameplay with ad requests blocked, main column width with the rail, no horizontal overflow, layout shift under 0.15, offline play after first load.

`e2e/systems.spec.ts` plays the newer systems through the real UI: a youth start at 15 through to the first professional contract, injury choices (rush back; surgery for a serious injury) and the Body report, a row with the manager over several weeks, a bidding war and a deadline-day bid on the Transfers page, the timeline poster and WebM video downloads, and handing the save to the next generation. Where a natural run would take seasons, `src/game/testHooks.ts` (dev and E2E builds only, as `window.__pitchbornTest`) sets the state up with the same engine calls a played week makes, and the decisions that follow are answered in the UI. Helpers answer decision pop-ups (`answerDecisions`) and wait for the store to go idle (`settled`) so autosaves land before a page load.

## Stress simulation — `npm run sim:careers -- --count N [--workers 8] [--full]`
Simulates complete careers with the autopilot policy in worker threads and reports distributions (seasons, retirement age, apps, goals, peak overall, clubs, trophies, awards, caps, injuries, legacy) plus world metrics (goals/match, home-win/draw %, extreme scorelines, top-scorer extremes, club balances, player counts, invariant issues) and balance flags. Default "lite" world simulates only the career's country so 1,000-career runs are practical; `--full` simulates all five. Reports in `data/reports/sim-N.md`.

## Sponsor balance — `npm run sim:sponsors -- [--seeds 5] [--seasons 5] [--workers N]`
Plays careers with the autopilot and accepts every sponsor offer, across three cohorts (late starters, established pros
and stars, from the game's own start paths) and all eight positions, `--seeds` careers each. Reports season-target hit
rates by cohort, position and squad role, form-clause warnings and terminations, and how deals end. Writes
`data/reports/sponsors-<careers>x<seasons>.md`. Re-run after changing `BALANCE.sponsors` or `targetKindFor`.

## Newer systems — `npm run sim:systems -- [--seeds 4] [--seasons 5] [--managers 4] [--workers N] [--only players|managers] [--cohorts a,b]`
Autopilot player careers in four cohorts (academy, late starter, established, star) and all eight positions, each with a
spending policy (frugal, sensible, lavish, investor) and, in half of them, asking the manager for both set-piece duties
every season; plus manager careers in each English tier running the transfer market with a simple policy. Reports what a
home costs in weeks of wages, upkeep against wages and forced sales, investment returns, penalty and free-kick duty rates by
position and cohort, and the managed club's spending, squad size and balance against AI clubs in the same league. Writes
`data/reports/systems-<careers>x<seasons>.md`. Re-run after changing `BALANCE.lifestyle`, `setPieces.ts` or `coachMarket.ts`.

It also covers the systems from §20–25 of `CAREER_SYSTEMS.md`: every career follows one recovery policy (rush, plan, rest,
clinic; serious injuries map to conservative or surgery) and the report gives weeks out per injury and how often the player
breaks down again within ten weeks of the return; drama beats are answered at random and the report counts stories per
season, by kind and cohort, with their outcomes; the "asks" half also leaks interest once a window, and bidding wars and
deadline-day bids are counted. Two more cohorts start on the youth path at 15 (half go on every trial) and as late starters
in the six newer countries (first-team minutes in season one, by club). Managers promote two academy prospects after intake
day, and the report adds the board's objectives, ultimatums, sackings in season and at the review, bids blocked by the wage
cap, and how often AI clubs around them change manager. `--only` and `--cohorts` narrow a run while tuning; narrowed runs
don't overwrite the report.

## UI render cost — `npm run bench:ui` and `npm run bench:render`
`bench:ui [seasons]` plays a long autopilot career and times the derived data the dashboard and stats pages compute
(milliseconds per call, early and late). With `BENCH_OUT=<file>` it also writes the career as JSON, which
`bench:render <file>` renders server-side through the real pages (`BENCH_PAGES=dashboard,club` to pick) to find render hot
spots. Server renders count first draws (portraits included); client re-renders are cheaper, since portraits are memoised.

## Calibration — `npm run sim:match`
Aggregate goals, results, shots, cards, injuries for equal and mismatched teams.

## Attribute model sims
- `npm run sim:attributes`: attribute distributions by position and age, overall stability, specialisation, and the team-level reference values the engine centres its new effects on.
- `npm run sim:attributes-world -- --seasons 10`: ageing and overall by age in a living world, tactical fit spread, recruitment fit, trait counts.
- `npm run sim:attribute-effects`: one attribute moved at a time (+30, equal sides, shared seeds), change in the metric it is meant to move. Results: `docs/SIMULATION.md`, *Attribute effects*.
- `npm run sim:pairs`: goals, results, cards and shots over many team pairings, for comparing before and after a change to the engine.

## Performance notes
~0.3 ms per world match; ~115 ms per simulated week (full world, Node); browser ~150–250 ms per week including autosave (string save ≈ 60 ms).
