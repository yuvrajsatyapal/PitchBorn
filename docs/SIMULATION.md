# Simulation engine

## World
`createWorld()` instantiates ClubState for every dataset club, generates a 25-man fictional squad per club scaled to club prestige (`clubLevel = 40 + 0.44 × prestige` average first-XI overall), national-team depth pools ("virtual" players representing unsimulated leagues), the user's player, and the season's competitions. ~8,500 players.

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
Monthly (12.5/season): `growth = youthGrowth × ageFactor × min(1, gap/10) × developmentRate × environment × professionalism × minutes × morale × form × seasonSwing × training`. After the personal peak age: per-season decline ≈ (1.0 + 0.42 × years past peak) × professionalism factor, physical attributes fastest. Weekly focused training adds small direct gains with age-scaled effectiveness (speed training weak after 24).

## Transfers (`transfers/market.ts`, `career/offers.ts`)
- **Club AI**: each window turn some clubs act; needs = positions below minimum count or starter quality below the club's level, plus ageing cover. Targets from a position index within quality band and budget (from balance and prestige); sellers demand premiums for key players, accept release clauses; players accept based on reputation gain, wage gain, loyalty and ambition. Free agents first; bloated squads release surplus.
- **User offers**: interest probability from upgrade value at the position, reputation, form, agent quality, transfer request, contract status and "outgrowing" a weaker league. Bids go to the user's club (asking price from value, importance, contract length; release clauses bind), rejected bids may be improved, then personal terms are negotiated against a hidden maximum with limited patience.
- **Finances**: weekly revenue (prestige, tier, stadium) minus operating costs and wages; prize money; restructuring when debt is extreme; reinvestment when reserves are huge.
