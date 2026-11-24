/**
 * Centralised balancing values. Tuned by the stress simulations in
 * scripts/sim (see docs/TESTING.md). These are Pitchborn's own numbers.
 */
export const BALANCE = {
  match: {
    /** Probability that a possession phase produces a chance, before strength ratios. */
    chanceBase: 0.106,
    /** Exponent applied to attack/defence ratio when deciding chances. */
    chanceExponent: 2.1,
    possessionExponent: 2.0,
    homeAdvantage: 1.06,
    penaltyPerChance: 0.012,
    foulPerMinute: 0.24,
    yellowPerFoul: 0.13,
    redPerFoul: 0.0008,
    /** Non-contact injury chance per player per 90 minutes, scaled by proneness and fitness. */
    injuryPerPlayerMatch: 0.016,
    /** Sd of each player's per-match form swing, as a fraction of ability (≈ ±3–4 overall points). */
    dayFormSd: 0.04,
    /** Who takes the shot / makes the pass: weight ∝ (attribute/60)^exp. Higher = stars dominate more. */
    pickExponent: 1.4,
    /** Shot quality: xG ∝ e^((finishing quality − 73) / slope). Lower = better finishers convert more. */
    xgSlope: 62,
    /** Match-rating model. */
    rating: {
      base: 6.0,
      /** Rating points per overall point above/below the opposition's starters (capped). */
      qualityPerPoint: 0.045,
      qualityCap: [-0.7, 1.2] as [number, number],
      /** Rating points per xG of team dominance, shared by outfield players. */
      dominance: 0.28,
      /** Goalkeepers: rating per xG saved (xG faced − goals conceded), and per clean sheet. */
      keeperPrevented: 0.4,
      keeperCleanSheet: 0.6,
      /** Rating points per unit of day form (0.04 ≈ ±0.2). */
      dayForm: 5,
    },
    extraTimeMinutes: 30,
    subsMin: 3,
    subsMax: 5,
  },
  fitness: {
    /** Fitness cost per minute played (scaled by stamina): ~12–15 for 90 minutes. */
    matchDrainPerMinute: 0.17,
    /** Weekly recovery: base + stamina bonus (~+19–23 for typical players). */
    weeklyRecoveryBase: 10,
    weeklyRecoveryStaminaDiv: 12,
    /** Floor after a match so one heavy week can't cripple a player. */
    matchFloor: 45,
    /** Below these levels injury risk rises. */
    riskHigh: 60,
    riskMild: 70,
    /** Extra recovery when the player asks to be rested. */
    restBonus: 12,
  },
  injuries: {
    trainingBase: 0.004,
    intenseMultiplier: 2.2,
    lowFitnessMultiplier: 1.8,
    pronenessScale: 1.6,
    /** Cap on serious+ injuries per user season to avoid frustration. */
    maxSeriousPerSeason: 1,
  },
  development: {
    /** Points of overall gained per season at max gap for an average-rate youngster. */
    youthGrowth: 9.0,
    primeAge: 27,
    declineStart: 30,
    declinePerYear: 1.0,
    /** Monthly growth ranges from (1 - w) for an unused sub to (1 + w) for an ever-present. */
    minutesWeight: 0.45,
    /** Monthly growth swing from recent form (match ratings). */
    formWeight: 0.15,
    /** How much the last few training weeks move monthly growth (normal training = ×1). */
    trainingWeight: 0.3,
    seasonNoise: 1.4,
    /** Speed training works fully up to this age, then slowly. */
    speedTrainingAge: 28,
    /** Pace and acceleration start to fade from this age. */
    speedDeclineAge: 32,
  },
  training: {
    /** Direct attribute gain per focused drill week (before intensity, age and potential gap). */
    drillGain: 0.03,
    /** Weak-foot rating gained per week of shooting, passing, dribbling or set-piece work (before age and the ceiling). */
    weakFootGain: 0.06,
    /** Consecutive intense weeks before overload raises injury risk. */
    overloadFrom: 3,
    overloadStep: 0.3,
    overloadMax: 2.0,
  },
  /** Experience from playing: overall points per 90 minutes at a 7.3 rating (age ≤21). */
  matchGrowth: 0.035,
  economy: {
    /** Weekly wage for an overall-70 player at a mid-prestige club (reference point). */
    wageRef: 70,
    wageBase: 9000,
    wageCurve: 6.5,
    valueRef: 70,
    valueBase: 1_200_000,
    valueCurve: 5.0,
    revenuePerPrestige: 26000,
  },
  agents: {
    /** Weekly fee ≈ feeBase × e^((rating − 30) / feeCurve), discounted for higher commission. */
    feeBase: 50,
    feeCurve: 11,
    commission: [0.03, 0.08] as [number, number],
    minReputation: { none: 0, rookie: 0, established: 20, top: 45, super: 65 },
    /** Under-21s with high potential get top agents' attention this much earlier. */
    prospectDiscount: 15,
    depositWeeks: 4,
    unpaidWeeksBeforeLeaving: 4,
    startingBank: 5000,
    /**
     * Personality (docs/CAREER_SYSTEMS.md, agents): skill bonuses on top of the agent's own skills, a multiplier on the
     * commission they take, and how many unpaid weeks they put up with before walking.
     */
    styles: {
      greedy: { skills: { negotiation: 8, connections: 3, media: 0, care: -6 }, commission: 1.3, unpaidWeeks: 2 },
      loyal: { skills: { negotiation: 0, connections: -5, media: 0, care: 10 }, commission: 0.75, unpaidWeeks: 8 },
      connected: { skills: { negotiation: -4, connections: 10, media: 4, care: 0 }, commission: 1, unpaidWeeks: 4 },
    },
  },
  sponsors: {
    /** A season target pays this share of the deal's yearly value as a one-off bonus. */
    bonusShare: 0.25,
    /** Brands needing at least this much appeal write a form clause into the deal. */
    formClauseAppeal: 40,
    /** Form clause: weeks below `poorForm` (in season, while fit) before a warning, and before the brand walks. */
    // Form is an average of ratings (≈6.6 typical); in season it sits below 5.6 about one week in ten.
    poorForm: 5.6,
    recoveredForm: 6.0,
    warnWeeks: 6,
    dropWeeks: 12,
    /** A season's target, before pro-rating for the weeks left: the player's own last season if he played enough, else these. */
    defaultTarget: { goals: 8, assists: 5, involvements: 8, cleanSheets: 8, apps: 20 },
    /** Without a full last season to go on, the default is scaled by the player's squad role (a backup plays far less). */
    roleScale: { star: 1.1, first: 1, rotation: 0.6, backup: 0.35, prospect: 0.3 },
    minTarget: { goals: 2, assists: 2, involvements: 2, cleanSheets: 2, apps: 4 },
    /** Appearances are capped by the fixture list, so they are never stretched beyond this many in a season. */
    maxApps: 36,
    /** Last season counts as a guide once it had this many appearances. */
    minAppsForHistory: 10,
    /** Goal, assist and clean-sheet targets aim a little higher than last season (appearances do not). */
    stretch: 1.1,
  },
  squad: {
    min: 22,
    target: 25,
    max: 30,
    maxTransfersPerWindow: 3,
  },
  morale: {
    winBoost: 2.2,
    lossPenalty: 2.6,
    benchPenalty: 1.6,
  },
  retirement: {
    /** age -> base retirement probability at season end */
    curve: [
      [32, 0.04],
      [33, 0.1],
      [34, 0.2],
      [35, 0.35],
      [36, 0.52],
      [37, 0.7],
      [38, 0.85],
      [40, 1],
    ] as [number, number][],
    userForcedAge: 42,
  },
  calendar: {
    turnsPerSeason: 50,
    preseasonTurns: [1, 2, 3],
    seasonStart: 4,
    seasonEnd: 43,
    internationalTurns: [9, 14, 19, 33],
    // Real dates: turn 1 is 1 July and every turn is a week. The summer window is 1 Jul–31 Aug (turns 1–9, the last
    // week of which ends 26 Aug) and the January window 1–31 Jan (turns 28–31, from 6 Jan). Outside them nobody
    // under contract can move; free agents can sign at any time, and renewals are always possible.
    januaryWindow: [28, 29, 30, 31],
    summerWindow: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    endOfSeasonTurn: 44,
    cupTurns: [7, 12, 17, 26, 36, 42],
    continentalGroupTurns: [6, 8, 11, 16, 18, 22],
    continentalKnockoutTurns: { QF: 29, SF: 38, F: 43 },
    tournamentTurns: { group: [45, 46, 47], QF: 48, SF: 49, F: 50 },
    monthLength: 4,
  },
  /** Weather and pitch conditions (docs/WEATHER.md). Only the user's matches feel them; clear weather on a good pitch is neutral. */
  weather: {
    /** Temperature noise around the monthly mean (°C, sd). */
    tempSd: 3.2,
    /** °C per degree of latitude away from the country's reference latitude (further north = colder). */
    tempPerLatitude: 0.55,
    /** At or above this temperature the weather is "heat"; heat severity reaches 1 at `heatMaxC`. */
    heatC: 28,
    heatMaxC: 36,
    /** Precipitation falls as snow at or below this temperature. */
    snowMaxC: 1,
    /** A pitch can only freeze at or below this temperature, and does so with this chance (always when it snows this cold). */
    frozenMaxC: -1,
    frozenChance: 0.55,
    /** Share of precipitation that is heavy rain; chance light rain still leaves a heavy pitch. */
    heavyRainShare: 0.28,
    rainHeavyPitch: 0.35,
    /** A warm, dry summer day leaves a dry pitch from this temperature. */
    dryPitchC: 24,
    /** Energy drain multiplier in the heat, from mild to severe heat; share of the extra drain high stamina removes. */
    heatDrain: [1.15, 1.25] as [number, number],
    staminaRelief: 0.6,
    /** Stamina where heat relief starts and where it is full. */
    staminaReliefRange: [55, 90] as [number, number],
    /** Fraction off first touch, passing, dribbling and technique. Weather and pitch add up to `techCap`. */
    tech: { rain: 0.02, "heavy-rain": 0.035, snow: 0.025, heavyPitch: 0.02, frozenPitch: 0.025 },
    techCap: 0.05,
    /** Share of the technical penalty strength + balance can remove, and the strength/balance range it builds over. */
    physicalRelief: 0.5,
    physicalReliefRange: [60, 85] as [number, number],
    /** Fraction off crossing, long shots and keeper kicking in the wind. */
    wind: 0.06,
    /** Snow or a frozen pitch: attack strength (tempo) down by this fraction, and this extra chance per phase of a defensive mistake. */
    tempo: 0.03,
    lapse: 0.006,
    /** Injury multipliers (challenges and non-contact). */
    injury: { heavy: 1.2, frozen: 1.3 },
  },
  rewards: {
    trainingBoost: { amount: 0.12, durationTurns: 6, cooldownTurns: 6 },
    recoveryBoost: { amount: 12, durationTurns: 1, cooldownTurns: 4 },
    moraleBoost: { amount: 6, durationTurns: 1, cooldownTurns: 6 },
  },
} as const;

export type Balance = typeof BALANCE;
