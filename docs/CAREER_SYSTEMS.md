# Career systems added in the "seven areas" pass

Everything here extends an existing system. Nothing replaces the match engine, the transfer/saga flow, the competition
setup or the save format; each piece reads the canonical `GameState` and (where it must remember something) adds an
optional field that older saves simply lack (schema 10, see Persistence).

## 1. Club overview (`engine/club/*`, `components/game/ClubPanels.tsx`)
- `standing.ts`: league position, points, GD, form, and the zone (title / continental / promotion / relegation) read from the live table. Before a league game is played the screen says "Preseason": no position is invented.
- `overview.ts`: identity (formation, style labels), department strength (best XI per area, ranked against the league), finances and recent moves (from `transferLog`, the only transfer record), real vs simulated history, relationship insights.
- `role.ts`: the user's role is the contract's own `SquadRole` (same labels as the contract screen). Expectation = share of club games to start by role; the selection trend is read from the match log. `rolePromiseBroken` (star/first role, not starting) costs manager trust weekly and adds to the transfer-saga score.
- `objectives.ts`: ambitions derived from club expectation rank, division and academy (title / continental / promotion / top half / survive / cup run / youth minutes). Progress is live; they are settled once at season end and move board confidence.
- `career/relationships.ts`: `adjustRel` is the one way the four bars move now; changes of 1.2+ are logged with their cause (capped list) and the Club page explains each bar from that log. Nothing is explained that did not happen.
- Club style (`ClubState.style`: pressing / tempo / directness) already existed but did nothing. It now (a) shifts the three match zones by a few percent either way (`match/engine.ts`, symmetrical about neutral, bounded), (b) adds a small tactical-fit term to selection (`lineup.ts: tacticalFit`), and (c) is re-rolled when a manager is sacked and replaced.

## 2. Match Day (`season/selection.ts`, `season/preview.ts`, `components/game/MatchBriefing.tsx`)
- The user's club line-up is picked from an RNG stream seeded by the fixture, so the screen's status and reasons are exactly what quick-sim and live play use.
- Reasons come from `scoreParts` (ability, fitness, form, sharpness, trust, tactical fit, rotation): the same terms the selection score sums.
- Actions follow the status: starting → play live; bench → watch/play live; not selected / injured / suspended / resting → watch. Rest requests only exist when the user would actually play.
- Pre-match requests (ask for a start, accept the bench, promise a 7.0+ display, discuss your role) have cooldowns (`PREMATCH_COOLDOWN`) and real effects (a selection bias for that fixture, manager trust, a promise settled once after the match).
- Context labels (derby, title decider, relegation/promotion/continental battle, cup tie/final) come from the table, the run-in and `rivalries.json`; ordinary matches get none.

## 3. Competitions (`competitions/bracket.ts`, `components/game/Bracket.tsx`, `KnockoutView.tsx`)
- A bracket is derived from saved fixtures: each tie's two teams are linked to the earlier tie they won (or none for byes / group qualifiers). Rounds larger than `BRACKET_MAX_TIES` stay collapsible lists; later rounds are a connected SVG bracket with empty "to be decided" rounds down to the final. Phones default to round-by-round.
- Penalty and extra-time results are described separately from the match score. Aggregate (two-leg) scores are not shown: the game's knockouts are single-leg.

## 4. Contracts (`career/contracts.ts`, `career/bonuses.ts`, `career/money.ts`, `career/offers.ts`)
- Terms: signing bonus, release clause, appearance / goal / assist / clean-sheet bonuses, trophy and promotion bonuses, annual wage rise. Position decides which clauses make sense (`relevantClauses`).
- One budget: `packageWeekly` (wage + amortised signing bonus + expected bonuses + a release-clause adjustment) is compared with the club's ceiling, so more bonus leaves less wage room. A low clause costs the club (it gives the player mobility); a high one is a concession it pays back.
- Signing bonuses are capped by the club's bank and the player's standing and are paid once, at signing (`payOnce`, key `sign:<offerId>`).
- Bonuses are paid by the club (its balance is debited) from the real match line, once per fixture / competition / season. Keys live in `user.pay.paid`; reloads and replays cannot pay again.
- Release clause: a bid that meets it opens personal terms and the club cannot block it, but the player must still agree terms and the window rules still apply. Nothing transfers automatically. A clause a club can afford raises its interest.

## 5. National team (`national/identity.ts`, `national/allegiance.ts`)
- Birth country is not allegiance. `nationality` = citizenship, `altNationality` = second eligibility, `intl.allegiance` = the chosen team (absent = nationality), `intl.tiedTo` = cap-tied (binding).
- The user is only ever selected by the nation they represent. Other eligible nations may *invite* the player (check turns three weeks before each international window, one invitation at a time, cooldowns, a material-change rule after a decline). Accept / decline / decide later; silence never accepts, a deferred invitation lapses after `MAX_DEFERRALS`.
- Abstraction: one switch only, before the first competitive senior cap, and with at most three friendly caps. Friendlies count as caps but do not bind; qualifiers and tournaments do. Accepting awards no cap.

## 6–7. Statistics and the Dashboard chart (`stats/matchlog.ts`, `stats/analytics.ts`, `components/game/{RatingChart,RecentRatings,StatsPanels}.tsx`)
- `user.matchLog` records every senior match (capped); development-squad games are in `user.reserveLog`. The two are never averaged together.
- Everything on the Statistics page is derived from the match log, season lines and archives. Rate stats state their minimum sample (`PER90_MIN_MINUTES`, `RANK_MIN_MINUTES`, `BEST_MIN_MINUTES`); trends need six rated games.
- The earnings ledger (`user.pay`) splits wages, signing bonuses and each bonus type; income earned before it existed is kept as one "earlier" line.

## 8. Manager history (`engine/managers/*`)
- Every manager has a stable id (`ClubState.manager.id`, `PoolManager.id`) and one `ManagerRecord` in `GameState.managers`: only tenures (club, from/to, reason, league position, honours). A tenure is closed before another opens, so nobody runs two clubs; completed tenures are never rewritten.
- Movement (`movement.ts`): mid-season sackings stay as before and now write tenures. At the season boundary every manager is reviewed once: standing (`manager.quality`) moves by at most ±2.5 from results, older managers retire, a poor season can cost a job (sacked/resigned, capped at 7% of clubs), and vacancies go to an available coach or to an overachiever from a smaller club (who leaves a vacancy behind, filled from the pool).
- The user's history (`user.mgr`): a stint per club-and-manager with appearances, starts, goals, honours, a few structured events (breakthrough, captain, disputes, fallout) and the relationship when it began and ended. `playedUnder` = at least one senior appearance in a stint. The historical relationship lives on the stint; the active bar (`relationships.manager`) belongs to whoever is in charge and resets when he goes. A reunion starts the active bar nudged by the shared past (bounded) and is free to move.
- Uses: Match Day "Former manager" panel and "Former boss" tag, first-meeting memory and news, "Back together" / departure memories (only past a real importance bar, deduped by key), a bounded multiplier on transfer interest (+20% at best, −30% at worst, never an offer on its own), saga reasons, the Club card, Career History, and the retirement documentary (a defining manager only above an evidence threshold).
- Old saves begin tracking at migration: ids and tenures are created for the current managers, a first stint opens today, and nothing about earlier seasons is invented.

## 9. Squad numbers (`engine/jersey/*`)
- One abstraction: club numbers 1–99, unique among the club's registered players, belonging to the current registration (`Player.squadNo`). `repairSquad` enforces uniqueness in the engine (on creation, after transfer windows, at rollover and on load); a valid number is never changed. National numbers are separate (`NationalTeamState.numbers`), assigned to a picked squad and kept while the player stays in it.
- Initial and arrival numbers are position-aware and role-aware; prospects get 30–49, rotation 12–29, and 7/9/10 are not handed out to prospects. The user's previous number is suggested first if free; a transfer never fails over a number.
- Changes happen when joining a club (a free choice) or in the first weeks of a season, once per season; a free prestige or preferred number may be offered as a one-off decision at season start. The preferred number is derived from the longest-worn number (2+ seasons).
- History is compact club/number tenures. Retirement derives an iconic number only after 5+ seasons and real success; a club retires a number only for 8+ seasons in it, 300+ club apps, 3+ trophies, 2+ awards and top supporter standing.

## 10. Contract renewals and wages (`career/wages.ts`, `players/economy.ts`)
- **One wage model.** `playerWage(p, season, clubReputation, role)` prices a player for a club: `wageFor` on the priced overall (up to +3 for players 25 and under with potential to spare), cut 4% a year after 31 (floor 80%). `marketWage` is the same figure at the club level that matches his overall. Transfers, free-agent and youth deals, fill-ins, NPC renewals and the user's renewal all come from it.
- **The club decides what it will pay** (`retentionOffer`). It starts from the market wage × a premium of 0.85–1.25 set by squad importance (role, level against the team, form, standing, promise, captaincy). A squeeze trims the premium when wages pass 62% of revenue, and it is capped at 0.95 while the club is in debt. Cuts are bounded: 0.72 of the current wage, or 0.55 if the market has collapsed, he is 33 or over, or he matters little to the squad. Nothing is raised automatically: the figure comes from market value, not the old contract. The club is never willing to pay more than 110% of what it would pay him as a star, and its walk-away sits up to 4–16% above the opening offer (never above 1.3× market).
- **The player decides what he will accept** (`reservationWage`). It starts from the market wage, less up to 18% when few clubs want him (`marketDemand`). A loyalty discount takes off at most 8%, scaled by `loyaltyPull` (0–1): years at the club, renewals, the loyalty trait, hidden loyalty, his bond with the supporters and manager (your relationships; NPCs are neutral), and One-Club Minded. Money and ambition weaken it, and a club in crisis cuts it to a quarter. A money-minded player asks up to 4% more.
- **NPC renewals** (`processExpiringContracts`) use the same two sides. If the club rates him at 0.3 importance or more and his ask fits its walk-away, the club meets the ask. He stays with a base chance from `stayBonus`, scaled down as the club's offer falls short of his reservation (no chance at 12% short).
- **Loyalty in transfers.** `playerWillJoin` now charges a rival `loyaltyPull × 5` against the move, so a tied player needs a much bigger move to be won over.
- **Consequences for you.** Signing more than 3% below your reservation costs 3 morale and only gives +3 board confidence (not +8). A visible cut (more than 10% below your previous wage) costs another 3 morale. Refusing a renewal below your market value costs 2 board confidence, not 6.
- **Legacy saves** keep the wages on their contracts. Nothing is recalculated on load, so an old contract keeps its wage until the next renewal, which uses this model.
- **Checking the numbers:** `npm run sim:wages -- --seasons 12` (`scripts/sim/wages.ts`) reports renewal wage against the old contract and market, raise and cut rates, loyalty bands, and wage inflation by overall band and club wage-to-revenue.

## Known limitations
- Sell-on clauses (club-to-club), loyalty bonuses and extension options are not implemented: their triggers are not modelled.
- Former managers are not tracked, so "former manager" never appears in the match preview.
- Match logs start from the first match played after upgrading: older saves keep their last 60 ratings (no minutes, scores or venues) and charts say so.
- International eligibility is a documented simplification of the real cap-tie rules (above).
- Manager movement is lightweight: no contracts, wages or managerial reputation market beyond the single quality value; national-team managers have no history.
- Squad numbers do not model per-competition registration rules; the retired-number honour is user-only.
