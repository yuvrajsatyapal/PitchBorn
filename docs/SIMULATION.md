# Simulation engine

## World
`createWorld()` instantiates ClubState for every dataset club, generates a 25-man fictional squad per club scaled to club prestige (`clubLevel = 54.6 + 0.316 × prestige`; first XIs ≈ elite 85–87, bottom of a top flight 75–78, second tier 74–81, third tier 68–76), national-team depth pools ("virtual" players representing unsimulated leagues), the user's player, and the season's competitions. ~8,500 players.

## Match engine (`src/engine/match/engine.ts`)
Event-based, minute by minute (+stoppage, +extra time, +penalties):
1. **Possession** – share from midfield zone strength (passing, vision, first touch, positioning, stamina, decisions, work rate by slot weight) with home advantage. Pressing against press resistance scales each side's midfield strength by at most ±3%.
2. **Chance creation** – probability from attack-vs-defence zone gap (soft-limited with tanh so mismatches stay believable). A back line that reads the game (interceptions, anticipation) cuts chance creation by up to 7%.
3. **Chance type** – open play, header, long shot, one-on-one, penalty, free kick (with base xG: open 0.12, header 0.095, long 0.04, one-on-one 0.34, penalty 0.76, free kick 0.065). A keeper who sweeps behind the line (anticipation, command, one-on-ones) reduces one-on-ones by up to 12%; a weak one raises them by up to 8%.
4. **Shooter/creator** – chosen with weight = slot weight × (blend rate ÷ 60)^1.4 (`pickExponent`), where the blend is the action's attribute mix: shooter finishing 0.7 and off-the-ball 0.3; header heading 0.55, jumping 0.25, off-the-ball 0.2; long shot long shots 0.75, technique 0.25; creator vision 0.4, creativity 0.3, passing 0.15, decisions 0.15; crosser crossing 0.7, technique 0.3. Stars therefore take a bigger share of their side's chances.
5. **Resolution** – xG = base × e^((q − 72) / 62) × defensive pressure × big-match factor × keeper factor × skill factors, where q is the shooter's quality blend (open play: finishing 0.55, composure 0.15, first touch 0.10, technique 0.10, decisions 0.10; header, long shot, free kick and penalty blends are in `shooterQuality`). Skill factors are bounded multipliers for off-the-ball movement against the back line's marking, aerial contests, the creator's creativity, the shooter's decisions, and the keeper's one-on-ones or command. Outcome → goal / save / woodwork / block / miss.
6. **Other events** – fouls, yellow/red cards, injuries, substitutions (fatigue- and rating-driven), half-time changes. The team's average aggression sets the foul rate (up to +25% / −20% around 52); a booking is more likely for an aggressive player and less likely for one with good decisions.
7. **Ratings** – accumulated from involvement (goals, assists, key passes, saves, tackles, mistakes), result and clean sheets, plus consistency-based noise.

Every goal, assist and stat comes from these events (tests reconcile stats with events). Calibrated to ~2.6–2.8 goals per match, ~45% home wins, ~25% draws.

**User key moments**: in interactive mode, when the user is the shooter, creator, last defender or keeper, the engine pauses with options whose odds come from the user's attributes (shoot first time / take a touch / round the keeper / square it; through ball / cross / shoot / recycle; slide / jockey / tactical foul; rush out / stay). Max ~7 per match, ≥4 minutes apart. Quick sim auto-chooses by expected value.

**Fidelity**: user matches run with commentary; the rest of the world runs the same engine without text (~0.3 ms/match).

## Career engine (`season/advance.ts`)
Weekly: world fixtures → tables/knockout progression → trophies → Team of the Week → recovery/condition → user training → finances → monthly development & market values → Player of the Month → manager sackings → transfer windows (AI + user offers + bids) → contract renewals → events → season end (turn 44) → world awards + rollover (turn 50).

Season end: league completion, awards, archive, promotion/relegation (3 up/3 down; tier-3 clubs are not relegated — regional leagues are not simulated), club reputation and prize money, season histories, records, tournament setup.

Rollover: NPC contract decisions, retirements (age/ability curve), international retirements, promotion/relegation applied (with relegation wage clauses), user contract/loan resolution, stat reset, youth intake, depth-pool refresh, minimum-squad guarantees, new fixtures.

## Progression (`players/development.ts`)
Monthly (12.5/season): `growth = youthGrowth × ageFactor × min(1, gap/10) × developmentRate × environment × professionalism × minutes × morale × form × seasonSwing × training`. After the personal peak age: per-season decline ≈ (1.0 + 0.42 × years past peak) × professionalism factor. It lands by attribute class (`DECLINE_SHARE`: athletic 1, skill 0.6, mind 0.2; physical multipliers stamina 1.1, jumping 0.9, strength 0.8, balance 0.5, work rate 0.3, aggression 0.2). Pace, acceleration and agility are exempt and fade on their own curve from 32: ≈(1 + 0.7 × years past 32) per season. Reading-of-the-game attributes gain a little to about 30 (`MATURITY`). See `docs/ATTRIBUTES.md`. `minutes` = 0.55 → 1.45 by share of available minutes, `form` = ±15%, `training` = 0.7 + 0.3 × average intensity growth of the last 4 weeks (normal = 1). Weekly focused training adds small direct gains (`BALANCE.training.drillGain`) split by the focus's primary and related attributes (`docs/ATTRIBUTES.md`), scaled by intensity, age and gap to potential (speed training is full up to 21, at least 70% to 28, then 25%). Each user match adds match experience: `matchGrowth × minutes/90 × clamp((rating − 5.8)/1.5, 0, 1.5) × age × gap`. Probe: `npx tsx scripts/sim/training-probe.ts [seeds] [seasons]`.

## Transfers (`transfers/market.ts`, `career/offers.ts`)
- **Club AI**: each window turn some clubs act; needs = positions below minimum count or starter quality below the club's level, plus ageing cover. Targets from a position index within quality band and budget (from balance and prestige); sellers demand premiums for key players, accept release clauses; players accept based on reputation gain, wage gain, loyalty (`loyaltyPull`) and ambition. Free agents first; bloated squads release surplus. Wages for every deal come from the shared model in `players/economy.ts`; renewals are covered in `docs/CAREER_SYSTEMS.md` §10 and checked by `npm run sim:wages`.
- **User offers**: interest probability from upgrade value at the position, reputation, form, agent quality, transfer request, contract status and "outgrowing" a weaker league. Bids go to the user's club (asking price from value, importance, contract length; release clauses bind), rejected bids may be improved, then personal terms are negotiated against a hidden maximum with limited patience.
- **Transfer sagas** (`career/saga/`): a rare, multi-week story layered on the offer flow for the user's player. `eligibility.ts` scores a candidate offer from standing, value, buyer, rivalry, former clubs, unrest, contract, finances and the clock; below `SAGA_MIN_SCORE` (42) it can never be a saga, above it the chance is modest and capped. One saga at a time, a gap between sagas, a per-window limit, and a per-club cooldown that only a material change (reputation, value, a new request, a contract running down, a move) overrides. `engine.ts` is the state machine (interest → scouting/agent → enquiry → bid → rejected/improved → unsettled → manager talk → request → rival bid → deadline pressure → terms → done), moving once a week and faster near the deadline, never across the season rollover. It opens ordinary `TransferOffer`s (tagged `sagaId`); the move itself still goes through `negotiate → completeOffer`, so money, squads and the log have one implementation. Decisions reuse `CareerDecision`; finished dramatic sagas become `transfer-saga` Football Memories. Saga state is sanitised on every load (`sanitize.ts`, schema v7).
- **Emergent player rivalries** (`career/rivalry/`): nobody is a rival by default. After each of the user's matches, and in the weekly turn, other players collect candidate points for meaningful things only: finals, derbies, title deciders, knockouts, goal-for-goal duels, a Golden Boot race, an award decided between two players, a fight for the same shirt, a record, a red card. Ordinary meetings are capped, media comparisons are a small separate capped bucket, and international-only evidence needs a higher bar. A candidate becomes a rival only with enough points, at least two kinds of cause (one meaningful), a gap since the last rivalry formed, and a peer's level and age. One main rival (the hottest) plus up to two minor ones; intensity 0–100 moves with context, fades with idle time and distance, and rivalries go dormant or end (retirement). Feeds match previews, news, match-memory importance, `rivalry` Football Memories, stats, career history and the retirement story. Draws no random numbers. State is `user.rivalry`, sanitised on load (schema v8).
- **Season awards and Awards Night** (`awards/`): when the league season is final (turn 44) the awards are calculated once from the real statistics and stored in `state.ceremony`; the ceremony only presents them. The Golden Boot and Playmaker are pure statistics (tie-breaks: the other attacking stat, then fewer minutes). Player of the Season, Young Player, Goalkeeper and Breakthrough use a role-relative index: rating and role contribution are z-scored within the position group, plus availability, the team's season and cup/continental form, with participation bars and central age rules in `AWARD_RULES`. Team of the Season is a real 4-3-3 filled slot by slot. Watching and skipping end in `completeCeremony`, which applies every consequence once from the stored results (reputation, bounded and scaled down for stars; career history and nominations; relationships; memories; rivalry via `noteAwardDuel`; award records from the archive; news). Carrying on without choosing counts as skipping. The judged awards (`awards/podium.ts`: Player of the Season, Young Player, Goalkeeper, Breakthrough) reveal 3rd, then 2nd, then 1st on a timer after one press, from the stored ranking; it is presentation only and restarts from 3rd if the scene is shown again. State is sanitised on load (schema v9).
- **Finances**: weekly revenue (prestige, tier, stadium) minus operating costs and wages; prize money; restructuring when debt is extreme; reinvestment when reserves are huge.


## Ratings, form and who scores (tuned from stress tests)
- **Day form:** every player gets a per-match swing (`BALANCE.match.dayFormSd`, ≈ ±3–4 overall points) that changes how they actually play, so good and bad days show up in goals and ratings together.
- **Who shoots / creates:** weight ∝ (blend rate/60)^`pickExponent`, so stars take a bigger share of their team's chances; shot quality ∝ e^((q − 72)/`xgSlope`) with q the shooter's blend (see *Match engine* 4–5). The goal-scoring figures below were measured before the attribute model (schema 14) and have not been re-measured: reference (equal 76-rated sides, per 38 games): a 78 striker scores ≈ 14, 85 ≈ 23, 90 ≈ 29, 95 ≈ 35; a 90 winger ≈ 16 goals + 9 assists. League top scorers stay ≈ 38–47.
- **Match rating** = 6.0 + match events + result (±0.3) + **quality vs the opposition's XI** (`qualityPerPoint`, capped) + team dominance (xG difference, shared by outfield players) + day form + consistency noise. A 90 midfielder now averages ≈ 7.4 and a 70 ≈ 6.1, with ≈ 1.0 sd game to game.
- **Goalkeepers** are rated on clean sheets (+0.6), saves, and goals prevented (expected goals on target faced − conceded). Metrics shown: clean-sheet %, save %, conceded per 90, saves per game; Golden Glove and player awards rank by `keeperScore`.

## Tactical fit and recruitment (schema 15)

`tacticalFit(p, style, slot)` (`match/lineup.ts`) scores how well a player's profile suits a style, 20–95 with 60 neutral. For each style dial away from the middle, the attributes that style asks of the slot (`styleWeights`, `players/model.ts`) are compared with the player's own level in that slot and with the role reference: the mean of each attribute above or below overall for the role, measured once per position over 120 generated players at overall 72 (so it tracks the generator, and an average player of any position sits near 60). The excess is scaled by 2.4 (`FIT_SCALE`), added to 60, plus a small habit bonus from traits (`traitFit`, at most ±6), then clamped. Fit is measured for the slot a player would fill, so a midfielder who suits a style gets no credit as a centre-back. Goalkeepers have a fit too, from `GK_STYLE_PROFILE`.

- **Selection** (`selectTeam`): fit is one term in the score, `(fit − 60) ÷ 16` (`FIT_PER_POINT`) capped at ±1.5 (`TACTICAL_CAP`), measured for the slot he would play, beside ability, fitness, form, sharpness, rotation and the manager's trust. It breaks close decisions and cannot override a clearly better player.
- **Explanations**: `fitDrivers` names up to two attributes that help and two that hold a player back, shown as "Your fit" in the club panels and the match briefing.
- **Recruitment** (`transfers/market.ts`): `styleBonus = clamp((fit − 60) ÷ 12, −2, +2)` overall points. It orders a shortlist of up to 30 comparable targets (cut by ability first, then ranked by overall plus the bonus) and chooses among free agents. `squadNeeds` adds 0.6 urgency when a club's best starter at a position fits its style badly (below 42). AI transfers run only in windows (`season/advance.ts`): at intensity 0.3 in summer and 0.15 in January; there is no weekly world scan.

## Attribute effects (schema 15)

The attribute model (`docs/ATTRIBUTES.md`) enters the engine as specialisms: each term compares an attribute with the player's own level or the side's reference, so a better side is not counted twice and an ordinary side is unaffected. Measured with `npx tsx scripts/sim/attribute-effects.ts` (3,000 matches per row, equal sides, identical match seeds, one team's players moved by +30 unless noted, so the difference is the attribute):

| Change (own side unless noted) | Measured effect |
|---|---|
| Off-the-ball movement (attackers) → own xG | +8.8% |
| Creativity (creators) → own xG | +2.8% |
| Decisions (all) → own xG | +9.6% |
| Technique (all) → own xG | +9.6% |
| Jumping (attack and back line) → own xG | +0.6% |
| Agility (attack) → own xG | +3.7% |
| Marking (back line) → xG against | −8.7% |
| Interceptions (back and midfield) → shots against | −8.8% |
| Anticipation (back and midfield) → shots against | −7.5% |
| Jumping (back line) → xG against | −5.4% |
| One-on-ones (keeper, +40) → xG against | −2.7% |
| Command (keeper, +40) → xG against | −9.4% |
| Anticipation (keeper, +40) → shots against | +0.1% |
| Aggression (defenders) → own fouls | +7.2% |
| Aggression (defenders) → own yellow cards | +24.9% |
| Decisions (all) → own yellow cards | −14.7% |
| Work rate, aggression, anticipation (home side) → home possession | +3.9 points |
| Work rate, aggression, anticipation (away side) → home possession | −3.4 points |
| Balance, agility, first touch (home side) → home possession | +3.7 points |

Baseline in the same run: equal sides, xG 1.22–1.34, 9.6 fouls, 1.46 yellow cards and 48.9% possession per side. Every row moves in the intended direction except keeper anticipation on shots against (+0.1%, flat), and jumping on own xG (+0.6%) is small. Keeper anticipation therefore does not show up in the shot count; its sweeping effect is on one-on-ones.

**Calibration** (`npx tsx scripts/sim/calibrate-pairs.ts`, 60 matches per pairing, goals per match; "before" is the same script on the pre-change tree, schema 14):

| Pairing (overall) | Goals per match before | after | Yellow cards per match before → after |
|---|---|---|---|
| 62 vs 62 | 2.81 | 2.81 (0%) | 2.98 → 2.99 |
| 72 vs 72 | 2.65 | 2.69 (+1.5%) | 3.04 → 2.96 |
| 84 vs 84 | 2.48 | 2.49 (+0.4%) | 3.01 → 2.97 |
| 78 vs 70 | 2.93 | 2.95 (+0.7%) | 2.95 → 2.91 |
| 70 vs 78 | 2.73 | 2.67 (−2.2%) | 2.99 → 3.03 |
| 86 vs 66 | 3.68 | 3.69 (+0.3%) | 2.94 → 2.92 |

Goals per match stay within about 2% of the pre-change figures; yellow cards are unchanged within sampling noise; red cards are 0.20–0.24 per match in both runs. The reference team means behind the `REF` constants come from `npx tsx scripts/sim/attributes.ts` (team reference at overall 72: marking 0.0, aerial −3.4, lane −1.3, press −5.4, resistance −1.5, aggression 51.9, sweep 1.0, build-up 0.2).

Other sanity sims: `npm run sim:attributes` (distributions, specialisation, team references), `npm run sim:attributes-world -- --seasons 10` (ageing, overall by age, tactical fit and recruitment in a living world, trait counts), `npm run sim:pairs`, `npm run sim:attribute-effects`.
