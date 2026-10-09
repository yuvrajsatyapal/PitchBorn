# Attributes (the player model)

Canonical source: `src/engine/players/model.ts`. Everything that reasons about attributes reads from it: overall, generation, the migration of older saves, development and training, the match engine's role weighting, tactical fit and recruitment. `attributes.ts`, `expansion.ts`, `development.ts`, `focus.ts`, `match/lineup.ts`, `match/engine.ts`, `transfers/market.ts` and `traits/attributeModel.ts` apply these tables. The tables are repeated below for reference; if they disagree with `model.ts`, the code wins. Schema 15 (`SCHEMA_VERSION` in `world/helpers.ts`).

There are 33 visible attributes: 27 outfield (physical 7, technical 6, attacking 5, defending 3, mental 6) and 6 goalkeeping. A goalkeeper also uses the shared positioning, composure, anticipation and decisions. Thirteen were added in schema 15 (marked **new**). Stored order is `ALL_ATTRS` = the twenty legacy attributes first, then the thirteen new ones (see PERSISTENCE.md).

## Meaning, ageing and training

| Attribute | Group | Meaning | Ageing | Trained by (primary / related) |
|---|---|---|---|---|
| Pace | Physical | Sustained top speed. Runs in behind, recovery over distance. | explosive | Speed (primary) |
| Acceleration | Physical | First steps and short bursts. Reaching a loose ball, closing down, breaking from a standing start. | explosive | Speed (primary) |
| Agility **new** | Physical | Turning and changing direction. Dribbling past a man, staying with a winger, recovering after a feint. | explosive | Speed, Dribbling (primary) |
| Stamina | Physical | How long the player lasts. Match fatigue and fitness recovery. | athletic | Physical (primary) |
| Strength | Physical | Winning physical contests, shielding, holding off a challenge. | athletic | Physical (primary) |
| Balance **new** | Physical | Staying on your feet under contact. Keeping the ball when pressed, riding a tackle (not about winning duels). | athletic | Physical (related), Dribbling (related) |
| Jumping **new** | Physical | Reach in the air. Who gets to a cross first (heading is what you do once there). | athletic | Physical (primary) |
| Passing | Technical | Pass execution: weight, accuracy, range. | skill | Passing (primary) |
| First Touch | Technical | Receiving: killing a pass, controlling it under pressure, turning in one movement. | skill | Dribbling (primary) · Passing (related) |
| Technique **new** | Technical | Difficult execution: curling, dipping, volleys, bent and driven balls, awkward deliveries. | skill | Passing (primary) · Dribbling, Set Pieces (related) |
| Dribbling | Technical | Carrying the ball past an opponent. | skill | Dribbling (primary) |
| Crossing | Technical | Wide delivery. | skill | Set Pieces (primary) |
| Tackling | Technical | Winning the ball by challenging for it (a skill; temperament is Aggression). | skill | Defending (primary) |
| Finishing | Attacking | Converting a chance from inside the area. | skill | Finishing (primary) |
| Long Shots | Attacking | Shooting from distance, direct free kicks. | skill | Set Pieces (primary) · Finishing (related) |
| Heading | Attacking | Attacking and clearing headers once the player has got there. | skill | Set Pieces (primary) |
| Off-the-Ball Movement **new** | Attacking | The run, the late arrival, finding space between defenders. | mind | Finishing (primary) |
| Creativity **new** | Attacking | The unusual chance: the pass or move others do not see coming (Vision is the obvious one). | mind | Passing (related) |
| Positioning | Defending | Defensive shape: where to stand, blocking shots, covering the zone. | mind | Defending (primary) · Goalkeeping (related) |
| Marking **new** | Defending | Tracking a man and staying with a runner. | mind | Defending (primary) |
| Interceptions **new** | Defending | Cutting out a pass without making contact. | mind | Defending (related) |
| Composure | Mental | Execution under pressure: the finish with the keeper out, the pass with a man closing. | mind | Finishing (primary) |
| Vision | Mental | Noticing the options that are on. | mind | Passing (primary) |
| Decisions **new** | Mental | Choosing the right action: when to shoot, when to pass, when not to foul. | mind | none (developed monthly and by balanced work) |
| Anticipation **new** | Mental | Reading what happens next: the second ball, the counter, the pass about to be played. | mind | Defending (related) |
| Work Rate **new** | Mental | How much ground the player chooses to cover: pressing, tracking back, repeated sprints. | athletic | none (developed monthly and by balanced work) |
| Aggression **new** | Mental | Willingness to challenge: duels, press triggers, and the booking risk that goes with them. | athletic | none (developed monthly and by balanced work) |
| Reflexes | Goalkeeping | Shot stopping: reaction. | skill | Goalkeeping (primary) |
| Diving | Goalkeeping | Shot stopping: reach. | skill | Goalkeeping (primary) |
| Handling | Goalkeeping | Shot stopping: security. | skill | Goalkeeping (primary) |
| Command of Area | Goalkeeping | Claiming crosses and organising the box; coming off the line. | mind | Goalkeeping (related) |
| Kicking | Goalkeeping | Distribution. | skill | Goalkeeping (related) |
| One-on-Ones **new** | Goalkeeping | Closing down and winning a one-on-one. | mind | Goalkeeping (related) |

Ageing classes (`ATTR[k].ageing`): **explosive** (pace, acceleration, agility) follow their own curve from 32 and are protected from the general decline; **athletic** (stamina, strength, balance, jumping, work rate, aggression) take the full general decline; **skill** takes 60% of it; **mind** takes 20%. Training: the table lists the focus that builds the attribute at full rate (primary) or at half rate (related).

## Overall weights

Each row sums to 1 (`POSITION_WEIGHTS`, percent shown). Attackers' off-the-ball movement stands where positioning used to be in the overall: defensive shape is a defender's concern, the striker's is the run.

| Position | Weights (percent) |
|---|---|
| GK | Reflexes 22, Diving 17, Handling 17, Command 10, Positioning 10, One-on-Ones 8, Kicking 6, Composure 4, Anticipation 4, Decisions 2 |
| CB | Positioning 14, Tackling 12, Strength 12, Heading 10, Marking 8, Pace 7, Anticipation 6, Composure 6, Passing 5, Decisions 5, Interceptions 4, Jumping 4, Acceleration 3, Aggression 2, First Touch 2 |
| RB / LB | Pace 12, Crossing 11, Tackling 10, Positioning 9, Stamina 8, Acceleration 7, Passing 7, Work Rate 5, Dribbling 5, Marking 4, Technique 4, Interceptions 3, Agility 3, Strength 3, First Touch 3, Decisions 3, Anticipation 3 |
| DM | Positioning 11, Passing 11, Tackling 10, Interceptions 7, Strength 7, Anticipation 6, Decisions 6, Composure 6, Stamina 6, First Touch 5, Marking 4, Vision 4, Work Rate 4, Technique 4, Aggression 3, Heading 3, Pace 3 |
| CM | Passing 14, Vision 9, Stamina 8, Technique 7, First Touch 7, Decisions 7, Composure 6, Dribbling 6, Positioning 5, Tackling 5, Long Shots 5, Creativity 4, Work Rate 4, Anticipation 3, Off-the-Ball 3, Strength 3, Interceptions 2, Pace 2 |
| AM | Dribbling 11, Passing 10, Vision 10, First Touch 9, Creativity 8, Technique 8, Finishing 8, Composure 7, Long Shots 7, Off-the-Ball 5, Acceleration 5, Decisions 4, Agility 3, Pace 3, Anticipation 2 |
| RW / LW | Dribbling 14, Pace 13, Acceleration 11, Crossing 10, Finishing 9, First Touch 7, Technique 6, Off-the-Ball 6, Agility 5, Passing 5, Composure 4, Vision 3, Stamina 3, Creativity 2, Work Rate 2 |
| ST | Finishing 22, Off-the-Ball 12, Composure 10, Heading 8, Pace 8, First Touch 7, Acceleration 7, Strength 7, Dribbling 5, Technique 4, Decisions 3, Anticipation 3, Jumping 2, Balance 2 |

The old twenty-attribute weights are kept as `LEGACY_POSITION_WEIGHTS`. They are read only to seed generation and to recover the overall a player had before the expansion (`legacyOverall`), so migrated players keep their number. Nothing else reads them.

## Match engine

Each row lists where the attribute is read in `match/engine.ts` (automatic play unless marked *user moment*, the odds shown in an interactive key moment). Weights are the blend weights in the code.

| Attribute | Read by |
|---|---|
| Pace | Attack and defence zone strength; attacker's jockey odds (user moment) |
| Acceleration | Attacker's jockey odds (user moment) only. Not read by automatic play. |
| Agility | Attack zone strength; press resistance (0.15); dribble and jockey odds (user moment) |
| Stamina | Midfield zone; energy drain every three minutes; press intensity (0.2); weekly fitness recovery (development) |
| Strength | Defence zone; back-line aerial defence (0.2); header shot quality (0.25) |
| Balance | Press resistance (0.25); touch and dribble odds, slide odds for the attacker (user moment) |
| Jumping | Back-line aerial defence (0.45); header shot quality (0.25); header taker (0.25) |
| Passing | Midfield zone; creator selection (0.15); pass and through odds (user moment) |
| First Touch | Midfield and attack zones; press resistance (0.35); open-play shot quality (0.10); touch odds (user moment) |
| Technique | Shot quality (open 0.10, long shot and free kick 0.25, penalty 0.20, one-on-one 0.10); long-shot taker (0.25); crosser (0.30) |
| Dribbling | Attack zone; dribble and slide odds (user moment) |
| Crossing | Crosser selection (0.70); cross odds (user moment) |
| Tackling | Defence zone; tackler (0.75) and foul selection (0.40); slide odds (user moment) |
| Positioning | Midfield and defence zones; blocker (0.70); keeper rating (0.6 weight); keeper's header defence (0.2); jockey odds (user moment) |
| Heading | Defence zone; back-line aerial defence (0.35); header shot quality (0.50) |
| Composure | Attack zone; shot quality (open 0.15, penalty 0.40, one-on-one 0.30, free kick 0.15); press resistance (0.25); keeper build-up (0.3); touch odds and the attacker's composure in rush odds (user moment) |
| Reflexes | Keeper rating; one-on-one keeper defence (0.2); stay odds (user moment) |
| Diving | Keeper rating |
| Handling | Keeper rating; keeper's header defence (0.3) |
| Kicking | Keeper launch and build-up (distribution); build-up nudge to midfield (0.4) |
| Command of Area | Keeper rating (0.5); back-line sweep (0.3); keeper's header defence (0.5); rush odds (user moment, 0.4) |
| One-on-Ones | Keeper sweep (0.3); one-on-one keeper defence (0.6); rush odds (user moment, 0.4) |
| Finishing | Shooter selection (0.7); shot quality (open 0.55, one-on-one 0.50, penalty 0.40); attack zone |
| Long Shots | Long-shot taker (0.75); free-kick shot quality (0.60) |
| Off-the-Ball Movement | Shooter selection (0.3; header 0.2); runner's movement against the back line's marking (skill xG); attack zone |
| Creativity | Creator selection (0.3); creator's quality on open, one-on-one and header chances (-3% to +5%); through odds (user moment) |
| Vision | Midfield zone; creator selection (0.4); pass and through odds (user moment) |
| Decisions | Midfield zone; shot quality (open 0.10, one-on-one 0.10); shooter's choice of moment (±3–4%); booking risk; creator selection (0.15); pass odds (user moment); keeper build-up (0.3) |
| Anticipation | Defence zone; interception taker (0.4); blocker (0.30); counter after a won ball (up to +0.02); back-line lane and marking; keeper sweep (0.4); press (0.2) |
| Work Rate | Midfield zone; energy drain; press intensity (0.4) |
| Aggression | Team aggression (foul rate, booking risk); foul selection (0.6); tackler (0.25); press (0.2) |
| Marking | Back-line marking (0.7 with anticipation 0.3): the runner's movement and chances conceded |
| Interceptions | Defence zone; interception taker (0.6); back-line lane reading (0.6): fewer chances created |

Design notes:

- **Vision and Creativity are kept separate.** Vision is who gets involved: it is the largest part of creator selection and a midfield zone term. Automatic play has no per-pass completion roll; pass odds use vision only in a user's key moment. Creativity is the quality of the chance the creator makes: it multiplies the shot's quality (the creator's effect is bounded, -3% to +5%). Creativity also enters creator selection (0.3), so the separation is not total: a creative player is picked more often *and* his chances are better.
- **Balance is kept.** It is press resistance and the touch and dribble odds, which are different from strength (winning a contest, aerial defence, header quality) and agility (turning and staying with a man).
- **No Aerial Reach for keepers.** Aerial control of a cross is Command of Area and Handling: that is the only aerial event a keeper has (the header defence term and the command rating). Jumping is the outfield player's attribute for reaching a cross.

Effects are specialisms measured against the player's own level (the `REF` constants in `engine.ts`), so a better side is not counted twice. The reference team means at overall 72 (`npx tsx scripts/sim/attributes.ts`) are marking 0.0, aerial -3.4, lane -1.3, press -5.4, resistance -1.5, aggression 52, sweep 1.0, build-up 0.2, and the constants are set to match.

## Tactical style profile

What each end of each style dial asks of a player (`STYLE_PROFILE`, each row sums to 1; `GK_STYLE_PROFILE` for keepers). A position uses the profile masked by what it does (`styleWeights`: an attribute the role does not weigh keeps 25% of its profile weight, and full weight from a 5% role weight), then renormalised.

| Dial | High end | Low end |
|---|---|---|
| Pressing | Work Rate 26, Stamina 22, Aggression 14, Anticipation 14, Tackling 10, Acceleration 8, Interceptions 6 | Positioning 26, Marking 20, Interceptions 16, Anticipation 14, Strength 12, Composure 6, Tackling 6 |
| Tempo | Pace 20, Acceleration 14, Passing 17, First Touch 16, Off-the-Ball 13, Decisions 10, Technique 10 | Passing 22, First Touch 18, Technique 18, Decisions 18, Composure 14, Vision 10 |
| Directness | Pace 16, Acceleration 10, Off-the-Ball 14, Finishing 14, Heading 12, Strength 12, Long Shots 8, Anticipation 8, Jumping 6 | Passing 24, First Touch 20, Technique 18, Vision 14, Decisions 14, Creativity 10 |

Keeper profile: pressing high = Command 30, Anticipation 30, One-on-Ones 20, Kicking 10, Decisions 10; pressing low = Positioning 30, Handling 30, Reflexes 25, Diving 15. Tempo high = Kicking 45, Decisions 30, Anticipation 25; tempo low = Composure 30, Handling 30, Positioning 20, Decisions 20. Directness high = Kicking 60, Command 20, Decisions 20; directness low = Composure 35, Kicking 30, Decisions 35.

## Generation

`generateAttributes` (`attributes.ts`) runs in three steps:

1. **Core twenty.** Each legacy attribute is drawn around the target overall: a role's relevant attributes sit above the rest (`target + weight × 20 + noise`), the others below. Height shifts heading and strength up and pace and acceleration down. The set is then nudged so the legacy-weighted overall equals the target.
2. **Added thirteen** (`seedAddedAttributes`). Each is a blend of the core attributes (below), plus role bias, height, age, professionalism, traits and a personal variation (`SPREAD`). Aggression is set relative to the player's own level (`54 + 0.45·(tackling − level) + 0.35·(strength − level) − 0.2·(composure − level)`), so good and ordinary sides are equally combative on average. Work rate follows professionalism a little; decisions and anticipation grow with age.
3. **Fit.** `fitToOverall` moves only the added attributes until the position overall equals the target. The core twenty are never touched, so the overall lands on the target to within `fitToOverall`'s tolerance (0.05).

Blends for the added attributes (`MIX`; goalkeepers use `MIX_GK` for decisions and anticipation):

| New attribute | Blend |
|---|---|
| Agility | Acceleration 45, Dribbling 25, Pace 15, First Touch 15 |
| Balance | Agility 30, Strength 25, Composure 25, First Touch 20 |
| Jumping | Heading 50, Strength 30, Acceleration 20 |
| Technique | First Touch 30, Dribbling 25, Passing 20, Finishing 10, Long Shots 10, Crossing 5 |
| Off-the-Ball | Positioning 35, Finishing 20, Acceleration 20, Composure 15, Vision 10 |
| Creativity | Vision 45, Dribbling 20, Passing 15, First Touch 10, Long Shots 10 |
| Marking | Tackling 45, Positioning 40, Strength 15 |
| Interceptions | Positioning 45, Vision 25, Tackling 20, Composure 10 |
| Decisions | Composure 35, Vision 30, Positioning 20, Passing 15 |
| Anticipation | Positioning 35, Vision 25, Composure 20, Acceleration 10, Tackling 10 |
| Work Rate | Stamina 60, Composure 15, Tackling 15, Strength 10 |
| Aggression | Relative to level (above) |
| One-on-Ones | Reflexes 35, Command 25, Diving 20, Handling 10, Composure 10 |

Role bias (`ROLE_BIAS`) adds what a role tends to be beyond its core: a centre-back marks and jumps better than his tackling alone implies; a striker marks and intercepts far less. Height moves jumping (+3.5 per 10 cm over 182), agility (−2.5) and balance (−1.5).

## Ageing

Constants in `model.ts`, applied in `development.ts`:

- **Explosive** (pace, acceleration, agility): no general decline and their own curve. Speed holds until 32, then loses about 1 point a season at 32, rising by 0.7 a season for each year past it (about 3–4 by 36 at typical professionalism).
- **General decline** (`DECLINE_SHARE`): athletic 1, skill 0.6, mind 0.2. `DECLINE_NORM` scales a decline so that it costs the stated number of overall points, even though mind attributes take a smaller share. Athletic attributes take the physical multiplier (`PHYSICAL_DECLINE`): stamina 1.1, jumping 0.9, strength 0.8, balance 0.5, work rate 0.3, aggression 0.2.
- **Maturity** (`MATURITY`): reading-of-the-game attributes gain each season from age 20, fading to nothing by 31. The multiplier per attribute is decisions and anticipation 1, positioning and composure 0.7, marking and interceptions 0.5, vision 0.4, applied to a base of about 0.4 attribute points a season at 20 (scaled a little by professionalism). Only attributes the role weighs gain, and only below 90.

## Training

Each named focus has primary attributes (full rate, shown on the card) and related attributes (half rate), and a budget per session (`TRAINING_MODEL`, `trainingShares`). The share of a primary attribute is `budget × 1 / total weight`, of a related one `budget × 0.5 / total weight`, so a focus that trains five attributes is not a faster way to grow than one that trains three.

| Focus | Primary | Related | Budget |
|---|---|---|---|
| Finishing | Finishing, Composure, Off-the-Ball | Long Shots | 3 |
| Passing | Passing, Vision, Technique | First Touch, Creativity | 3 |
| Dribbling | Dribbling, Agility, First Touch | Balance, Technique | 3 |
| Speed | Pace, Acceleration, Agility | none | 2 (full effect up to 21, at least 70% to 28, then 25%) |
| Physical | Strength, Stamina, Jumping | Balance | 2 |
| Defending | Tackling, Marking, Positioning | Interceptions, Anticipation | 3 |
| Set Pieces | Crossing, Long Shots, Heading | Technique | 3 |
| Goalkeeping | Reflexes, Handling, Diving | Command, Kicking, One-on-Ones, Positioning | 5 |
| Balanced | the role's own weights (no fixed list) | | 0.45 × weight ÷ Σ weight² per attribute |
| Recovery | none: restores fitness (+14) and morale (+1.5) only | | 0 |

No named focus trains Decisions, Work Rate or Aggression; they grow only through monthly development and balanced work. There is no Mental focus on purpose. Balanced work is scaled to keep the session's worth as it was before the expansion (the comment in `development.ts` says so; this was not re-measured). The balanced entry's budget (6.75) is only checked to be above zero.

## Display

The profile's Attributes card (`app/play/profile/page.tsx`) groups attributes with `groupsFor(position)` in `model.ts`: Physical, Technical, Attacking, Defending, Mental. A goalkeeper sees Goalkeeping first, then only the shared attributes his role weighs (for example positioning, composure, anticipation, decisions). The groups are two columns from the `sm` breakpoint and stacked below it. Playstyle cards still show three key attributes; training cards show the focus's primary attributes.

## Schema 15 (older saves)

Covered in `docs/PERSISTENCE.md`. In short: migration 14 → 15 and a repair pass on every load call `expandAllAttributes`. A player missing any new attribute gets them derived from his original twenty (`expansion.ts`) with a per-player seeded stream, fitted to his pre-expansion overall (`tests/attributeMigration.test.ts` checks that every player stays within one point). It never touches the original twenty, potential, traits, identity or history. A new attribute an owned trait requires is raised to that floor. It is deterministic and idempotent.

## Related docs

- Desired playstyles, traits and the trait overlay: `docs/TRAITS.md`.
- Engine, selection and recruitment numbers: `docs/SIMULATION.md`.
- Save format: `docs/PERSISTENCE.md`.

## Calibration notes (schema 15)

- **Growth and decline are normalised.** Steps are drawn by role weight, so with 33 attributes a step lands on lighter attributes and would be worth less overall (measured: 1.3–1.7× less in growth). `GROWTH_NORM` and `DECLINE_NORM` in `players/attributes.ts` restore the expected overall change per point to what the twenty-attribute model delivered. Checked with `npm run sim:careers`: a 30-career run peaks at the same overall (86 mean) and potential (89) as before the change.
- **Shot quality is re-centred** (`Q_CENTRE` 72 in `match/engine.ts`), because the quality blend sits a little under finishing alone. `npm run sim:pairs` (100 team pairs × 60 matches) matches the old engine to within about 1% on goals, shots, xG, cards and fouls at every quality level.
- **Tactical fit is cached** per player, role and style (a cheap fingerprint of his attributes invalidates it) and its selection score is capped at ±1.5 (`TACTICAL_CAP`). Fit is only evaluated when a manager picks a side or a club shortlists targets in a transfer window, never as a world scan.
- **Specialist readings** (marking, aerial, lane-cutting, pressing, resistance) are computed once per player when he takes the pitch (`LivePlayer.sp`), not per cache refresh.
