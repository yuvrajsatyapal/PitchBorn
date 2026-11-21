# Weather & Pitch Conditions (V1)

Status: built (November 2026).

Every fixture has weather and a pitch condition, worked out from where and when it is played. Conditions change a few
things the match engine already simulates (fatigue, ball control, long-range delivery, tempo, mistakes, injury risk)
by small amounts. There is no separate weather simulation, no postponements, no stadium roofs and no coaching weather
tactics in V1.

## Decisions

| Question | Decision |
|---|---|
| Which matches feel the weather? | **Matches involving the user's team** (club or national). Their conditions are shown before kick-off, during the game and at full time. Every other fixture can be asked for its conditions (they are deterministic), but the AI-only matches of the world are played exactly as before. This keeps the world's calibration, results, awards and injuries untouched. |
| Randomness | `Rng.fromSeed(`${state.seed}:wx:${fixture.id}`)`. The world RNG is never read or advanced. Same seed + same fixture id = same conditions on every reload and every re-simulation; nothing else in the save changes them. |
| Storage | Not stored per fixture. The user's played matches keep a copy in `FixtureResult.detail.conditions` (the existing user-only detail block, saved as plain JSON), so the results screen shows exactly what was played in. No schema bump, no migration: results played before weather existed have no conditions, and the UI shows none for them rather than inventing what they were played in. |
| Baseline | A match with no `conditions` input runs exactly as before (no extra random draws). `clear` weather on a `good` pitch has all modifiers at 1, so it is identical to no conditions too. Modifiers scale probabilities and attributes; they never add random draws, except that snow/frozen matches may draw the existing defensive-lapse roll for sides that would otherwise skip it. |
| Tuning | Every number lives in `BALANCE.weather` (`src/engine/balance.ts`). |

## Data and model (`src/engine/weather/`)

- `climate.ts`: a compact monthly table for the five league countries (mean temperature, chance of precipitation,
  chance of wind) with a reference latitude, plus a temperate default for any other country (international venues).
  Temperature is adjusted by the stadium's latitude against the country's reference.
- `conditions.ts`: `rollConditions(seed, fixtureId, place, month)` (pure) and `conditionsFor(state, fixture)`.
  The venue is the home club's stadium (`world.json` stadiums have `lat`, `lon`, `countryCode`); a national team's
  home fixture uses that country's climate. The month comes from `fixtureDate`.
- Order of the roll: temperature (monthly mean + latitude + noise) → heat if hot enough → precipitation (snow when
  cold enough, otherwise rain or heavy rain) → otherwise occasional wind → otherwise clear. The pitch follows:
  heavy after heavy rain (and sometimes rain), frozen only below freezing, dry only in heat or a warm dry summer day,
  otherwise good.
- Impossible combinations are ruled out by construction: no snow above 2 °C, no heat below the heat threshold,
  no frozen pitch above 0 °C, no dry pitch in rain or snow.

## Match effects (`src/engine/weather/effects.ts`, applied in `match/engine.ts`)

| Condition | Effect | Where |
|---|---|---|
| Heat | Energy drain ×1.15–1.25 by severity; high stamina takes away up to 60% of the extra drain | `tickEnergy` |
| Rain / heavy rain / heavy pitch / frozen pitch | First touch, passing, dribbling, technique down 2–5% (capped); strength + balance take away up to half of it | per-player effective attributes |
| Wind | Crossing, long shots and keeper kicking down ~6%; nothing else | per-player effective attributes |
| Snow / frozen pitch | Attack strength (tempo) down ~3%; a small extra chance of a defensive mistake | team strength cache |
| Heavy / frozen pitch | Injury chance from challenges and non-contact injuries ×1.2 / ×1.3 | foul injuries, `applyMatchResult` |

Both sides play in the same weather, so the effect is relative: technical sides lose a little more on a heavy pitch,
physical ones a little less; tireless ones cope with heat.

## UI

- Match Day briefing: a forecast line (icon, weather, °C, pitch, a short practical note).
- Live match: a small conditions badge by the scoreboard.
- Full time / results: the conditions the match was played in.

## Integrations

- Commentary: a kick-off line and a half-time line in adverse conditions, and a "loses his footing" wording when snow or
  ice causes a defensive mistake. Lines are picked from the conditions alone, so no random draw is added.
- Social feed: a journalist's post after the user's match in heavy rain, snow, on a frozen pitch, in strong wind or 32 °C+ heat.
- Achievements: Mudlark (score in heavy rain or on a heavy pitch), Ice Cold (win in snow or on a frozen pitch),
  Desert Heat (score in the heat), Into the Wind (assist in wind).
- Press: no weather questions in V1 (the question builders are result- and story-led; a weather question would mostly
  be noise).

## Tests and calibration

`tests/weather.test.ts`: determinism, variation, climate plausibility, impossible combinations, world RNG untouched,
heat drain, technical penalties, wind scope, snow modesty, injury multipliers, physical and stamina mitigation, and
baseline equality (no conditions and clear/good conditions both reproduce the original match exactly).
`npm run sim:match` reports goals, shots, injuries, substitution timing and energy for each weather type.

### Calibration (76 v 76, 1,200 matches per row, `npm run sim:match`)

| Conditions | Goals/match | Pass % | Injuries/match | End energy | Sub minute |
|---|---|---|---|---|---|
| No conditions | 2.83 | 87.8 | 0.230 | 63.9 | 71.5 |
| Clear / good | 2.83 | 87.8 | 0.230 | 63.9 | 71.5 |
| Rain / good | 2.82 | 87.4 | 0.228 | 63.9 | 71.5 |
| Heavy rain / heavy | 2.77 | 86.8 | 0.263 | 63.9 | 71.4 |
| Wind / good | 2.82 | 87.8 | 0.228 | 63.9 | 71.5 |
| Snow / frozen | 2.80 | 86.8 | 0.291 | 64.0 | 71.2 |
| Heat 30 °C / dry | 2.82 | 87.8 | 0.224 | 59.9 | 71.0 |
| Heat 36 °C / dry | 2.84 | 87.7 | 0.221 | 58.2 | 70.9 |

## Known limits

- Only the user's matches (as a player) feel the weather. A coaching career's club is not affected in V1.
- The pitch does not remember earlier weeks' weather: a heavy pitch comes from that day's rain.
- International venues use the home nation's climate at its reference latitude (no stadium coordinates for nations).
