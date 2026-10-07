# Simulation engine

## World
`createWorld()` instantiates ClubState for every dataset club, generates a 25-man fictional squad per club scaled to club prestige (`clubLevel = 54.6 + 0.316 × prestige`; first XIs ≈ elite 85–87, bottom of a top flight 75–78, second tier 74–81, third tier 68–76), national-team depth pools ("virtual" players representing unsimulated leagues), the user's player, and the season's competitions. ~8,500 players.

## Match engine (`src/engine/match/engine.ts`)
Event-based, minute by minute (+stoppage, +extra time, +penalties):
1. **Possession** – share from midfield zone strength (passing, vision, first touch, positioning, stamina by slot weight) with home advantage.
2. **Chance creation** – probability from attack-vs-defence zone gap (soft-limited with tanh so mismatches stay believable).
3. **Chance type** – open play, header, long shot, one-on-one, penalty, free kick (with base xG).
4. **Shooter/creator** – weighted by position role and the relevant attribute.
5. **Resolution** – xG adjusted by shooter quality, defensive pressure, keeper quality and big-match temperament → goal / save / woodwork / block / miss.
6. **Other events** – fouls, yellow/red cards, injuries, substitutions (fatigue- and rating-driven), half-time changes.
7. **Ratings** – accumulated from involvement (goals, assists, key passes, saves, tackles, mistakes), result and clean sheets, plus consistency-based noise.

Every goal, assist and stat comes from these events (tests reconcile stats with events). Calibrated to ~2.6–2.8 goals per match, ~45% home wins, ~25% draws.

**User key moments**: in interactive mode, when the user is the shooter, creator, last defender or keeper, the engine pauses with options whose odds come from the user's attributes (shoot first time / take a touch / round the keeper / square it; through ball / cross / shoot / recycle; slide / jockey / tactical foul; rush out / stay). Max ~7 per match, ≥4 minutes apart. Quick sim auto-chooses by expected value.

**Fidelity**: user matches run with commentary; the rest of the world runs the same engine without text (~0.3 ms/match).

## Career engine (`season/advance.ts`)
Weekly: world fixtures → tables/knockout progression → trophies → Team of the Week → recovery/condition → user training → finances → monthly development & market values → Player of the Month → manager sackings → transfer windows (AI + user offers + bids) → contract renewals → events → season end (turn 44) → world awards + rollover (turn 50).

Season end: league completion, awards, archive, promotion/relegation (3 up/3 down; tier-3 clubs are not relegated — regional leagues are not simulated), club reputation and prize money, season histories, records, tournament setup.

Rollover: NPC contract decisions, retirements (age/ability curve), international retirements, promotion/relegation applied (with relegation wage clauses), user contract/loan resolution, stat reset, youth intake, depth-pool refresh, minimum-squad guarantees, new fixtures.

## Progression (`players/development.ts`)
Monthly (12.5/season): `growth = youthGrowth × ageFactor × min(1, gap/10) × developmentRate × environment × professionalism × minutes × morale × form × seasonSwing × training`. After the personal peak age: per-season decline ≈ (1.0 + 0.42 × years past peak) × professionalism factor, stamina and strength fastest. Pace and acceleration are exempt from that decline and instead fade on their own curve from 32: ≈(1 + 0.7 × years past 32) per season. `minutes` = 0.55 → 1.45 by share of available minutes, `form` = ±15%, `training` = 0.7 + 0.3 × average intensity growth of the last 4 weeks (normal = 1). Weekly focused training adds small direct gains (`BALANCE.training.drillGain`) scaled by intensity, age and gap to potential (speed training works fully until 28, then at a quarter rate). Each user match adds match experience: `matchGrowth × minutes/90 × clamp((rating − 5.8)/1.5, 0, 1.5) × age × gap`. Probe: `npx tsx scripts/sim/training-probe.ts [seeds] [seasons]`.

## Transfers (`transfers/market.ts`, `career/offers.ts`)
- **Club AI**: each window turn some clubs act; needs = positions below minimum count or starter quality below the club's level, plus ageing cover. Targets from a position index within quality band and budget (from balance and prestige); sellers demand premiums for key players, accept release clauses; players accept based on reputation gain, wage gain, loyalty and ambition. Free agents first; bloated squads release surplus.
- **User offers**: interest probability from upgrade value at the position, reputation, form, agent quality, transfer request, contract status and "outgrowing" a weaker league. Bids go to the user's club (asking price from value, importance, contract length; release clauses bind), rejected bids may be improved, then personal terms are negotiated against a hidden maximum with limited patience.
- **Transfer sagas** (`career/saga/`): a rare, multi-week story layered on the offer flow for the user's player. `eligibility.ts` scores a candidate offer from standing, value, buyer, rivalry, former clubs, unrest, contract, finances and the clock; below `SAGA_MIN_SCORE` (42) it can never be a saga, above it the chance is modest and capped. One saga at a time, a gap between sagas, a per-window limit, and a per-club cooldown that only a material change (reputation, value, a new request, a contract running down, a move) overrides. `engine.ts` is the state machine (interest → scouting/agent → enquiry → bid → rejected/improved → unsettled → manager talk → request → rival bid → deadline pressure → terms → done), moving once a week and faster near the deadline, never across the season rollover. It opens ordinary `TransferOffer`s (tagged `sagaId`); the move itself still goes through `negotiate → completeOffer`, so money, squads and the log have one implementation. Decisions reuse `CareerDecision`; finished dramatic sagas become `transfer-saga` Football Memories. Saga state is sanitised on every load (`sanitize.ts`, schema v7).
- **Finances**: weekly revenue (prestige, tier, stadium) minus operating costs and wages; prize money; restructuring when debt is extreme; reinvestment when reserves are huge.


## Ratings, form and who scores (tuned from stress tests)
- **Day form:** every player gets a per-match swing (`BALANCE.match.dayFormSd`, ≈ ±3–4 overall points) that changes how they actually play, so good and bad days show up in goals and ratings together.
- **Who shoots / creates:** weight ∝ (attribute/60)^`pickExponent`, so stars take a bigger share of their team's chances; shot quality ∝ e^((finishing − 73)/`xgSlope`). Reference (equal 76-rated sides, per 38 games): a 78 striker scores ≈ 14, 85 ≈ 23, 90 ≈ 29, 95 ≈ 35; a 90 winger ≈ 16 goals + 9 assists. League top scorers stay ≈ 38–47.
- **Match rating** = 6.0 + match events + result (±0.3) + **quality vs the opposition's XI** (`qualityPerPoint`, capped) + team dominance (xG difference, shared by outfield players) + day form + consistency noise. A 90 midfielder now averages ≈ 7.4 and a 70 ≈ 6.1, with ≈ 1.0 sd game to game.
- **Goalkeepers** are rated on clean sheets (+0.6), saves, and goals prevented (expected goals on target faced − conceded). Metrics shown: clean-sheet %, save %, conceded per 90, saves per game; Golden Glove and player awards rank by `keeperScore`.
