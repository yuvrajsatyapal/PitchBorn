# Player traits

Attributes say **how good** a player is. Traits say **how the player tends to play**.

## Where things live
`src/engine/traits/`
- `registry.ts` – the original catalogue (revised in place) plus `EXTENSIONS`: ~165 traits (id, name, blurb, category, positions, requirements/ceilings, conflicts, evidence signals, effects, rarity, evolution). Add a trait = add a `def(...)`.
- `catalogue/` – the added traits by area (`attack`, `midfield`, `defence`, `keeper`, `mind`, `personality`, `flaws`), the shared `def`/position helpers, and `derive.ts`: every score computed from a profile or a record (with the sample sizes it needs).
- `tenure.ts` – seasons at the current club (`Player.clubSince`; NPC season history is capped at four years so a long stay cannot be read from it).
- `sanitize.ts` – load-time repair of trait data and the one-off v13 upgrade seeding.
- `types.ts` – `TraitDef`, `MatchFx` (match behaviour/effectiveness modifiers), `CareerFx` (personality effects), `DeriveInput`.
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

## Principles
- **Style traits change behaviour** (which action is chosen: more long shots, crosses, tackles, headers) and nudge effectiveness a little; quality still comes from attributes. Effects scale by stage (Taking shape 0.5 / Established 0.85 / Signature 1.15; "Taking shape" is the internal `emerging` stage) and, for effectiveness, by how well the attributes back the trait (`coreFit`).
- **Acquired, never clicked.** The user starts without playing style. Evidence from matches (shots by type, chances created, interceptions…), plus capped training, fills a per-trait progress counter; crossing 30 xp earns Taking shape, 80 Established, 160 Signature (rare, at most 2).
- **Loss and evolution.** Requirements failing, age, disuse and replacement weaken traits; e.g. Speed Runner can evolve into Inside Threat / Inverted Creator.
- **Limits.** Playing traits (style + mind/body together) 1–6 by overall (one fewer under 21), style 1–5, mind/body 3, personality 3, flaws 2, signature 0–2. Personality and flaws are counted separately from the playing identity.
- **NPCs** get traits on creation; everyone gets a cheap annual review; only the user and players in the user's matches collect per-match evidence.
- **Determinism.** Trait draws use an RNG seeded from player identity and season, never the world stream.
- **Persistence.** Stored as `"id:xp:since;…"` per player; schema v5 migration seeds traits for old saves. Schema v13 adds `Player.clubSince` and seeds the new record- and temperament-based traits for NPCs (deterministic, additive, never re-rolls what a player already has); every load runs `sanitizeTraits`.
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
- **Record (everyone, from the season review):** `derive` scores read the player's career statistics and per-season history: Iron Man (four full seasons, clean injury record), Super Sub (bench appearances and output), Card Magnet (cards per 90 against the norm for the position, minimum ~30 matches), Captain Material / Dressing-Room Leader (appearances, standing, age, professionalism), Fan Favourite (the user's real supporter relationship; for NPCs tenure and standing), One-Club Minded (seven+ seasons at one club), Consistent Performer (the user's rating record when there are 20+ rated matches), Versatile (two secondary positions in different areas of the pitch).
- **Training** adds a little to behaviour already seen and can never unlock a trait on its own.
- **Evolution and loss.** Failing requirements, age, disuse and (for flaws) a growing attribute weaken a trait; some evolve into another (Recovery Defender → Cover Defender, Speed Runner → Inside Forward …). Derived traits fade by 10 xp a year when the record or profile no longer supports them, so nothing flips back and forth.

### New engine levers (all neutral at 1/0, so a side without them is unchanged)
`lapse` (a defensive error can hand over a chance), `againstStar` (man-marking the opposition's best finisher), `counter` (ball won → straight break), `subBoost` (fresh legs after coming on), `trailing` (shot quality while behind), `cardBehind` (cards while behind). `fast` can be negative (Slow Starter). Lapse and counter are capped per team.

### Career levers
`resilience`, `ego`, `controversy`, `contract`, `fan`, `amp` join the existing ones. Consumers: weekly personality (supporters, resilience, ego sulking, amplification), match morale (defeats sting less for the resilient), NPC contract decisions (`stayBonus`: loyalty and the stands keep players, ambition, money and awkward negotiators let them go), the club's patience in the user's contract talks, captaincy (`captainScore`), transfers (`moveScoreDelta`), manager selection (`traitFit`: a pressing side likes a Pressing Machine, at most ±6 tactical-fit points; Versatile players lose a third less when played out of position), career events (Media Controversy appears only with a profile and a poor spell).

### Balance (see `npm run sim:traits -- --seasons 10`)
A 1,700-player world over ten seasons: 3.5–3.8 traits per player (6–7 for elite players, none above 11, ~10% with none), 35–43% of players with a flaw (about 9% with two), no trait held by more than ~11% of the world, no off-position trait, none of the record-based traits above ~3%, and league goals per match unchanged at ~2.76 (home wins 46%, draws 23%). One-Club Minded appears only after a decade at a club and is deliberately rare; Comeback Specialist is earned from the user's own matches, so NPCs seldom have it.

## Limitations
- There is no wing-back or centre-forward position, so those traits live on RB/LB and ST.
- The match engine is chance-based, not positional: man-marking, counters and lapses are expressed as probabilities on chances, not as tracked movement.
- Only the user and players in the user's matches collect match evidence; NPCs get traits from creation, the annual review and the record-based rules.
- Reputation-based temperament traits (Charismatic, Ego…) follow the game's reputation scale, which falls for most players over time, so they thin out as seasons pass.
