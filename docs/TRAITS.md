# Player traits

Attributes say **how good** a player is. Traits say **how the player tends to play**.

## Where things live
`src/engine/traits/`
- `registry.ts` – the original catalogue (revised in place) plus `EXTENSIONS`: ~165 traits (id, name, blurb, category, positions, requirements/ceilings, conflicts, evidence signals, effects, rarity, evolution). Add a trait = add a `def(...)`.
- `catalogue/` – the added traits by area (`attack`, `midfield`, `defence`, `keeper`, `mind`, `personality`, `flaws`), the shared `def`/position helpers, and `derive.ts`: every score computed from a profile or a record (with the sample sizes it needs).
- `stay.ts` – the loyalty record behind One-Club Minded (a few counters per player, updated at contract and season checkpoints).
- `tenure.ts` – seasons at the current club (`Player.clubSince`; NPC season history is capped at four years so a long stay cannot be read from it).
- `sanitize.ts` – load-time repair of trait data (and of the loyalty record and development focus) and the one-off v13 upgrade seeding.
- `types.ts` – `TraitDef`, `MatchFx` (match behaviour/effectiveness modifiers), `CareerFx` (personality effects), `DeriveInput`.
- `attributeModel.ts` – the attribute overlay on the catalogue: extra `core` attributes and low `req` floors per trait (catalogue entries untouched). See *The attribute model* below and `docs/ATTRIBUTES.md`.
- `effects.ts` – stage strength, core-fit scaling, `resolveMatchFx`, `careerProfile`.
- `rules.ts` – eligibility, conflicts (exclusive / unlikely), limits, candidate weighting.
- `assign.ts` – creation-time traits (NPC), derived personality/flaws, deterministic trait RNG per player.
- `develop.ts` – evidence from matches, gated training contribution, annual review (weakening, evolution, NPC proxy growth).
- `career.ts` – loyalty/ambition in transfers and contracts, loyalty stands, weekly personality, settling abroad.
- `identity.ts` – grouped display, the position tag shown in the explanations, and the "play identity" label used in profile and retirement.

## Footedness and Ambidextrous
Every player has a dominant foot (`foot`: `"L"` or `"R"`, the only choices at creation) and a separate weak-foot rating (`weakFoot`, 0–100). Logic lives in `src/engine/players/foot.ts`.
- **Weak foot develops slowly** (monthly with age and `developmentRate`, plus a small gain from shooting/passing/dribbling/set-piece training) but is capped by a per-player ceiling derived from technical attributes, so only a really technical player can ever approach two-footed.
- **Ambidextrous** is a derived technical trait granted at a weak-foot rating of 88+ (≈0.7% of generated players). It has no `match` effects of its own: in the match engine the weak-foot penalty is removed, nothing is added. It never removes the dominant foot.
- **Match engine**: `effective()` scales finishing/long shots, crossing, passing/vision and dribbling by `footMultiplier` for the player's slot, how often that role forces the weaker foot (off-flank crossing, inverted-winger shooting…) and how good the weak foot is, relative to a typical weak foot (rating 60), clamped to 0.90–1.04.
- **Selection**: `fitFor` charges a small flank penalty to a full-back or winger on the wrong flank for a one-footed player.
- **One-Foot Reliant** (flaw) is now derived from a very poor weak foot.
- **Old saves** (schema v12): `"B"` becomes left or right (deterministic per player); the user's player keeps the trait, NPCs get a strong but not ambidextrous weak foot unless very technical. The load-time sanitiser also repairs a missing or invalid foot.

## One-Club Minded
A personality trait **earned by a career**, never drawn and never granted by time alone (`catalogue/derive.ts: oneClub`, record in `stay.ts`).

**Evidence** is kept as counters on `Player.stay` (`StayRecord`), reset by any move, and updated only where a stay is actually decided, so there is no history scan:
- *Seasons and minutes* at the club (season review): a regular, not a name on the squad list.
- *Extensions agreed* (NPC contract expiry in `processExpiringContracts`; the user's accepted renewals). An extension is the club's wish as much as the player's, so it counts for little on its own.
- *Free stays*: an extension signed while he was clearly better than the level his club fields (a bigger club would plausibly take him). This is how "leaving was realistically possible" is read for everyone.
- *Approaches declined*: a comparable or bigger club that came for him and was refused (the market's `playerWillJoin` for NPCs; the user rejecting an offer or committing in a saga), once a season.
- *Restlessness*: a transfer request or being listed counts against him and is forgiven slowly.
A season in which nobody wanted him adds years and minutes and **no commitment**.

**Eligibility** (all of): 8+ seasons at the club with 7+ recorded, 1,700+ minutes a season on average, hidden loyalty 60+, at least one free stay or declined approach, and commitment ≥ 2.5. For the user, also supporters ≥ 60 and manager/board ≥ 40. The score is the weakest of years, loyalty and commitment, so it starts as "Taking shape", reaches "Established" only with a turned-down approach on record, and "Signature" is rare. Evaluated once a season at the trait review, like every other derived trait.

**Effects**: loyalty 0.8 (scaled by stage) in `moveScoreDelta`/`stayBonus`, plus small supporter and dressing-room drift. It is a reluctance, not a lock: a club in crisis, a player frozen out or one who has outgrown the club still override most of it.

**Leaving**: the bond was to that badge. After a move the trait fades by 35 xp a season (Taking shape gone at the next review, Established in two to four seasons, Signature in about four). A loan does not strip it. While he stays, a restless spell only weakens it at the usual 10 xp a season.

## Development focus (Desired playstyle)
`players/focus.ts`. What a player is *trying* to become, chosen at creation from options for the position (every position also has **No preference**). It is an aspiration; traits are still what play, training and behaviour have shown.

| Position | Option | Leads on | Trains (recommended) |
|---|---|---|---|
| ST | Goalscorer | Finishing, Off-the-Ball, Composure | Finishing |
| ST | Complete Forward | Technique, First Touch, Finishing | Finishing, Passing |
| ST | Target Forward | Heading, Strength, Jumping | Physical, Finishing |
| ST | Mobile Forward | Pace, Acceleration, Off-the-Ball | Speed |
| ST | Creative Forward | Technique, First Touch, Passing | Passing, Dribbling |
| RW / LW | Inside Forward | Finishing, Dribbling, Agility | Finishing, Dribbling |
| RW / LW | Traditional Winger | Crossing, Pace, Stamina | Set Pieces, Speed |
| RW / LW | Creative Winger | Vision, Creativity, Passing | Passing |
| RW / LW | Direct Dribbler | Dribbling, Agility, Acceleration | Dribbling |
| RW / LW | Wide Goalscorer | Finishing, Off-the-Ball, Composure | Finishing |
| AM | Playmaker | Passing, Vision, Decisions | Passing |
| AM | Goalscoring Midfielder (arrives late) | Long Shots, Off-the-Ball, Stamina | Finishing |
| AM | Creative Dribbler | Dribbling, Agility, First Touch | Dribbling |
| AM | Advanced Creator | Creativity, Vision, Passing | Passing, Set Pieces |
| AM | Shadow Striker | Finishing, Off-the-Ball, Acceleration | Finishing, Speed |
| CM | Box-to-Box | Stamina, Work Rate, Tackling | Physical |
| CM | Playmaker | Passing, Vision, Technique | Passing |
| CM | Tempo Controller | Decisions, Composure, Passing | Passing |
| CM | Ball Winner | Tackling, Stamina, Work Rate | Defending, Physical |
| CM | Advanced No. 8 | Off-the-Ball, Technique, Dribbling | Dribbling, Passing |
| DM | Defensive Anchor | Positioning, Marking, Interceptions | Defending |
| DM | Ball Winner | Tackling, Aggression, Work Rate | Defending, Physical |
| DM | Deep-Lying Playmaker | Passing, Vision, Technique | Passing |
| DM | Defensive Controller | Interceptions, Anticipation, Decisions | Defending, Passing |
| DM | Half-Back | Positioning, Passing, Composure | Defending, Passing |
| CB | Stopper | Tackling, Pace, Acceleration | Defending, Pace |
| CB | Aggressive Stopper | Aggression, Strength, Tackling | Defending, Physical |
| CB | Ball-Playing Defender | Passing, Composure, Technique | Passing |
| CB | Cover Defender | Positioning, Anticipation, Pace | Defending, Pace |
| CB | Aerial Defender | Heading, Jumping, Strength | Defending, Physical |
| RB / LB | Defensive Full-Back | Tackling, Marking, Positioning | Defending |
| RB / LB | Attacking Full-Back | Dribbling, Crossing, Stamina | Dribbling, Set Pieces |
| RB / LB | Inverted Full-Back | Passing, Decisions, Vision | Passing |
| RB / LB | Overlapping Full-Back | Pace, Stamina, Acceleration | Speed, Physical |
| RB / LB | Complete Full-Back | Stamina, Work Rate, Tackling | Physical, Defending, Passing |
| GK | Shot Stopper | Reflexes, Diving, One-on-Ones | Goalkeeping |
| GK | Sweeper Keeper | Anticipation, Command, One-on-Ones | Goalkeeping |
| GK | Ball-Playing Keeper | Kicking, Composure, Decisions | Goalkeeping, Passing |
| GK | Commanding Keeper | Command, Handling, Decisions | Goalkeeping |
| GK | Line Keeper | Positioning, Handling, Reflexes | Goalkeeping |

Changed in schema 15: one new option each for GK (Line Keeper), RB/LB (Complete Full-Back), CB (Aggressive Stopper), DM (Half-Back), CM (Advanced No. 8) and AM (Shadow Striker). The Goalscoring Midfielder is now the late-arriving midfielder, and the CB Stopper is the quick front-foot defender. Every option was re-weighted on the new attributes. "Leads on" is the three heaviest weights in the option; "Trains" is what the training card recommends (`focus.ts`, `training`).

Each option names the attributes it leans on (weights 0–1), the traits it naturally grows into, and the training that builds it.

What it does, all of it small and all of it fading:
- **Starting attributes** (`leanAttributes`, user only, no random draws): the favoured attributes gain up to 3.2 points and the rest of the role gives up the same amount *measured in role overall*, capped at 2.5 per attribute, so the overall is unchanged by construction (the ±0.05 figure in the results section below was measured before schema 15 and not re-run). The raw attribute sum drifts by a few points either way; nothing is added to the budget.
- **Growth** (`focusTilt`): monthly development and match experience add `0.09 × strength × weight` to each favoured attribute's weight in the existing growth draw (role weights run 0.05–0.3, plus a 0.05 floor). Only the role's own attributes can take growth, so an attribute outside the role never grows from the aspiration. No extra random numbers.
- **Trait evidence** (`recordMatchEvidence`): behaviour that already happened counts up to 25% more towards a trait the focus favours. No signal, no progress; requirements (`candidateTraits`) and sample sizes (`minMinutes`, thresholds) are untouched.
- **NPC habits** (creation and the annual drift): a favoured trait is up to 50% more likely to be drawn. In an isolated test (same players with and without) this moves "starts with a favoured trait" from ~11–25% to ~15–32%.
- **Training page**: the focus, what your career shows beside it, suggested training and a "Suits your focus" badge. It never trains anything for you. Drills are the same for everyone; the focus only decides which attributes a drill builds (`docs/ATTRIBUTES.md`).

**Fading** (`focusStrength`): 1.0 up to 19, then 0.75, 0.55, 0.38, 0.22, 0.14, 0.1 at 20–25, 0 from 26; also multiplied by `1 − career minutes / 16000` (floor 0.08). A focus that has faded has no effect at all, and the Training page says so ("Behind you now").

**Career wins.** Nothing reads the focus once the evidence disagrees: a Goalscorer whose matches are all chances created and through-balls builds Playmaker/False Nine habits, and `focusReading` reports `open / early / aligned / mixed / diverged` against the traits actually owned. Managers and tactics still decide how a player is used, and so what he becomes.

**NPCs** get an aspiration at generation (80% choose one; `npcFocus`, seeded by the player, no world RNG): the option their attributes already lean towards, so it costs nothing at runtime. NPCs over 26 have none stored. **Persistence**: `Player.focus` (absent = no preference; the user's is always stored). Old saves: the user becomes "No preference", NPCs have none; nothing is inferred from existing traits.

**Not changeable.** The choice is fixed at creation. Re-picking would buy little (the lean is small and fades within a few seasons) and would invite switching to chase development, so it was left out; the career, not a menu, is what moves a player away from the aspiration.

## The attribute model
`attributeModel.ts` overlays the catalogue at load (`TRAITS = withAttributeModel(...)`), so the entries in `registry.ts` are unchanged. Each trait can have extra **core** attributes (what makes it work: their average sets how well its effects are carried out and how natural a candidate the player is) and low **req** floors (a minimum to gain and keep it). For example Pressing Machine adds work rate and aggression to its core and needs work rate 60; Poacher adds off-the-ball movement and anticipation and needs off-the-ball movement 62.

Nothing here grants a trait. Acquisition still needs behaviour in matches over a real sample (signals, minimum minutes, record rules). `TRAIT_LEAN` in `model.ts` leans the attributes a player is generated or migrated with towards habits he already has (scaled by how established the trait is), so a pressing player starts with the work rate that goes with it. Details and the full attribute model: `docs/ATTRIBUTES.md`.

## Principles
- **Style traits change behaviour** (which action is chosen: more long shots, crosses, tackles, headers) and nudge effectiveness a little; quality still comes from attributes. Effects scale by stage (Taking shape 0.5 / Established 0.85 / Signature 1.15; "Taking shape" is the internal `emerging` stage) and, for effectiveness, by how well the attributes back the trait (`coreFit`).
- **Acquired, never clicked.** The user starts without playing style. Evidence from matches (shots by type, chances created, interceptions…), plus capped training, fills a per-trait progress counter; crossing 30 xp earns Taking shape, 80 Established, 160 Signature (rare, at most 2).
- **Loss and evolution.** Requirements failing, age, disuse and replacement weaken traits; e.g. Speed Runner can evolve into Inside Threat / Inverted Creator.
- **Limits.** Playing traits (style + mind/body together) 1–6 by overall (one fewer under 21), style 1–5, mind/body 3, personality 3, flaws 2, signature 0–2. Personality and flaws are counted separately from the playing identity.
- **NPCs** get traits on creation; everyone gets a cheap annual review; only the user and players in the user's matches collect per-match evidence.
- **Determinism.** Trait draws use an RNG seeded from player identity and season, never the world stream.
- **Persistence.** Stored as `"id:xp:since;…"` per player; schema v5 migration seeds traits for old saves. Schema v13 adds `Player.clubSince` and seeds the new record- and temperament-based traits for NPCs (deterministic, additive, never re-rolls what a player already has). Schema v14 adds `Player.focus` and `Player.stay` (see above); it changes no trait. Every load runs `sanitizeTraits`, which also drops an invalid focus or a loyalty record that belongs to another club. Schema v15 changes no trait's evidence rules; it adds the attributes behind the overlay (`docs/ATTRIBUTES.md`). A new attribute that an owned trait requires is raised to that floor when the save is opened, and the normal review applies from then on.
- **Memory.** Only identity-defining developments (a Signature trait, an evolution, a loyalty stand) create memories.


## The expanded catalogue
Positions follow Pitchborn's model (GK, CB, RB/LB = FB/WB, DM, CM, AM, RW/LW = W, ST = ST/CF). A trait lists the positions that can develop it; `affinity` makes some positions primary and others secondary (a striker with a secondary AM weighs half). Attribute `req` floors and flaw `cap` ceilings still have to hold, to gain a trait and to keep it.

The brief's names map onto the registry as follows (the display name was updated where an existing trait was already the same idea, so saved ids never change):

| Brief | Registry |
|---|---|
| Aerial Threat / Long-Range Threat / Ball Winner / Interceptor / Stopper / Last-Ditch Defender | `aerial_presence` / `distance_shooter` / `ball_hunter` / `lane_reader` / `front_foot` / `last_line` |
| Flair Dribbler / Direct Dribbler / Touchline Winger / Inside Forward / Ball Carrier | `flair` / `direct_winger` / `touchline_runner` / `inside_threat` / `progressive_carrier` |
| Deep-Lying Playmaker / Final-Ball Specialist / Defensive Anchor / Full-Back Runner / Inverted Full-Back | `deep_distributor` / `killer_pass` / `anchor` / `overlapping_runner` / `inverted_fullback` |
| Aggressive Tackler / Ball-Playing Defender / Aerial Dominance / Calm Under Pressure | `aggressive` / `ball_progressor` / `aerial_dominator` / `composed` |
| Commanding Keeper / One-on-One Keeper / Ball-Playing Keeper / Penalty (keeper) | `cross_commander` / `one_on_one_specialist` / `build_up_keeper` / `penalty_reader` |
| Big-Game Player / Clutch Performer / Consistent Performer | `big_game_performer` / `clutch` / `consistent` |
| Model Professional / Mercenary / One-Club Minded / Homebody / Training Issues / Poor Adaptability | `professional` / `money_motivated` / `club_oriented` / `home_comfort` / `poor_trainer` / `low_adaptability` |
| One-Footed / Disappears in Big Matches | `one_foot_reliant` / `big_match_nerves` |

New traits: Clinical Finisher, Counter-Attack Threat, Close Control, Cut-In Threat, One-on-One Specialist (`one_on_one_runner`), Attacking Full-Back, Playmaker, Long-Pass Specialist, Quick Distributor, Creative Spark, Dead-Ball Specialist, Midfield Engine, Deep Controller, Transition Specialist, Pressing Machine, Clean Tackler, Man Marker, Defensive Leader, Recovery Defender, Reflex Keeper, Cross Claimer, Safe Hands, Comeback Specialist, Iron Man, Super Sub, Versatile, Captain Material, Fan Favourite, Driven, Determined, Quiet Professional, Dressing-Room Leader, Confident, Humble, Charismatic, Fiery Personality, Big Personality, and the flaws Wasteful Finisher, Avoids Weak Foot, Poor Decision Maker, Holds Ball Too Long, Overcomplicates Play, Slow Starter, Easily Frustrated, Reckless Tackler, Card Magnet, Tires Easily, Poor Positioning, Defensive Liability, Weak in the Air, Vulnerable Under Press, Poor Concentration, Error Prone, Reluctant Shooter, Poor Crosser, Poor Distributor, Rushes Off Line, Weak on Crosses, Contract Difficulties, Unsettled Easily, Ego, Media Controversy.

### How a trait is acquired
Not `position → random trait`, but position + role + attributes + hidden profile + behaviour + record + sample size:
- **Created with the player (NPC / youth):** playing style, drawn by position, attributes (`coreFit`) and rarity, as many as the player's level suggests; temperament and flaws that follow from the hidden profile; a few on-pitch flaws (13%). `earned` traits are never drawn.
- **Behaviour (user and anyone in the user's matches):** the engine counts relevant actions per match (`SignalKey`), capped per match; progress crosses the threshold only if the attributes support it. Record-based ones also need minutes of football behind them (`minMinutes`): Comeback Specialist counts goals/assists that turned a deficit into at least a draw (`comebackContributions`).
- **Record (everyone, from the season review):** `derive` scores read the player's career statistics and per-season history: Iron Man (four full seasons, clean injury record), Super Sub (bench appearances and output), Card Magnet (cards per 90 against the norm for the position, minimum ~30 matches), Captain Material / Dressing-Room Leader (appearances, standing, age, professionalism), Fan Favourite (the user's real supporter relationship; for NPCs tenure and standing), One-Club Minded (eight+ seasons at one club as a regular, stays that were a choice; see above), Consistent Performer (the user's rating record when there are 20+ rated matches), Versatile (two secondary positions in different areas of the pitch).
- **Training** adds a little to behaviour already seen and can never unlock a trait on its own.
- **Evolution and loss.** Failing requirements, age, disuse and (for flaws) a growing attribute weaken a trait; some evolve into another (Recovery Defender → Cover Defender, Speed Runner → Inside Forward …). Derived traits fade by 10 xp a year when the record or profile no longer supports them, so nothing flips back and forth.

### New engine levers (all neutral at 1/0, so a side without them is unchanged)
`lapse` (a defensive error can hand over a chance), `againstStar` (man-marking the opposition's best finisher), `counter` (ball won → straight break), `subBoost` (fresh legs after coming on), `trailing` (shot quality while behind), `cardBehind` (cards while behind). `fast` can be negative (Slow Starter). Lapse and counter are capped per team.

### Career levers
`resilience`, `ego`, `controversy`, `contract`, `fan`, `amp` join the existing ones. Consumers: weekly personality (supporters, resilience, ego sulking, amplification), match morale (defeats sting less for the resilient), NPC contract decisions (`stayBonus`: loyalty and the stands keep players, ambition, money and awkward negotiators let them go), the club's patience in the user's contract talks, captaincy (`captainScore`), transfers (`moveScoreDelta`), manager selection (`traitFit`: a pressing side likes a Pressing Machine, at most ±6 tactical-fit points; Versatile players lose a third less when played out of position), career events (Media Controversy appears only with a profile and a poor spell).

### Balance (see `npm run sim:traits -- --seasons 10`)
The figures below predate the attribute model (schema 15) and the new trait floors; they have not been re-run.
A 1,700-player world over ten seasons: 3.5–3.8 traits per player (6–7 for elite players, none above 11, ~10% with none), 35–43% of players with a flaw (about 9% with two), no trait held by more than ~11% of the world, no off-position trait, none of the record-based traits above ~3%, and league goals per match unchanged at ~2.76 (home wins 46%, draws 23%). One-Club Minded needs eight seasons as a regular and a recorded choice to stay: in 25-season simulations see the table under "One-Club Minded results" below; it is rare and never absent; Comeback Specialist is earned from the user's own matches, so NPCs seldom have it.

## Limitations
- There is no wing-back or centre-forward position, so those traits live on RB/LB and ST.
- The match engine is chance-based, not positional: man-marking, counters and lapses are expressed as probabilities on chances, not as tracked movement.
- Only the user and players in the user's matches collect match evidence; NPCs get traits from creation, the annual review and the record-based rules.
- One-Club Minded for NPCs infers "could have left" from quality relative to the club's level, except where a club was actually refused (rare); the game does not simulate outside interest. Its Established and Signature stages need a declined approach on record, which NPCs seldom have, so NPC holders are mostly "Taking shape".
- The development focus is fixed at creation. Its growth lean only covers attributes in the role's own weights (the starting lean can also touch outside ones, such as a Creative Forward's vision, passing and creativity); NPC aspirations are chosen once from attributes and do not change.
- Reputation-based temperament traits (Charismatic, Ego…) follow the game's reputation scale, which falls for most players over time, so they thin out as seasons pass.

## One-Club Minded results (`npx tsx scripts/sim/loyalty.ts --seasons 25`)
Measured before schema 15; not re-run.
A 1,700-player lite world (England only), autopilot user, 25 seasons:

| After | Holders | Of players with 6+ seasons at their club | Stages |
|---|---|---|---|
| 5 seasons | 0 | 0% | – (nobody can have eight years yet, and the 2026 squads all arrive in the same season) |
| 10 seasons | 48 (3.0%) | 8.3% | all Taking shape |
| 15 seasons | 18 (1.1%) | 3.0% | all Taking shape |
| 20 seasons | 13 (0.8%) | 2.3% | all Taking shape |

99 distinct players held it over the run. At the moment of earning it they averaged 10.7 seasons at the club (9.7 recorded), ~2,950 minutes a season, 3.8 extensions (3.0 of them signed as a player clearly above his club's level), hidden loyalty 72 and age 29. The ten-season bump is the start-up cohort ageing together; the 15–20 season figures (≈1%) are the steady state. Holders leave their club 8.4% of seasons against 6.8% for equally long-serving, loyal-minded players without it, so it does not make anyone immovable: the holders are, by construction, the players clubs want, and the trait's loyalty effect is a pull, not a lock.

## Development focus results (`npx tsx scripts/sim/focus.ts --seasons 8 --users 4`)
Measured before schema 15 (the attribute model and the focus options changed since); not re-run.
**Starting attributes** (500 created players per position and option at overall 65): the mean overall of every option is 65.00 ± 0.05; the favoured attributes gain 1–3.2 points on average (the lead attribute 3.2 for most options, 1.6 for a keeper's Shot Stopper) and the raw attribute sum is within about ±8 of No preference.

**Isolated effect on NPC creation** (the same 1,500 players per option, drawn with and without the aspiration, age 19, overall 70): having a favoured trait at creation goes from 23% to 30% (ST Goalscorer), 25% to 32% (Target Forward), 11% to 15% (Mobile Forward), 7% to 11% (Creative Forward), 16% to 21% (CM Playmaker), 22% to 27% (CB Stopper), 31% to 40% (Aerial Defender). Never close to certain.

**NPC world** (326 players aged 21 or under at the start, eight seasons): 52% of those with an aspiration hold at least one trait it favours, but only 22% of all their traits fit it; 39.6% of the cohort ended up "diverged" from their aspiration, 26.7% "mixed", 15.0% "aligned" and 15.0% had no preference. Where the cohort was large enough, a focus raised the odds of a matching trait only a little (ST Goalscorer 67% against 62% for other strikers, Target Forward 71% against 59%, DM Defensive Anchor 64% against 48%) and sometimes not at all (AM Playmaker 31% against 37%, which is noise at this sample size).

**The user's own career** (autopilot, striker, four seeds per option, eight seasons): every option produced mostly the same strikers (Poacher, Direct Dribbler, Box Predator, First-Time Finisher), with Target Forward appearing in all four careers that started as Target Forward (and in three of the four Creative Forward ones: each run is a different player and world, so four careers cannot separate the lean from luck). Complete, Mobile and Creative Forward careers were "diverged" from their aspiration in 11 of 12 cases. The aspiration colours the start; the engine and the match record decide the player.
