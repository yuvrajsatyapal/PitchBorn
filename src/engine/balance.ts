/**
 * Centralised balancing values. Tuned by the stress simulations in
 * scripts/sim (see docs/TESTING.md). These are Pitchborn's own numbers.
 */
export const BALANCE = {
  match: {
    /** Probability that a possession phase produces a chance, before strength ratios. */
    chanceBase: 0.11,
    /** Exponent applied to attack/defence ratio when deciding chances. */
    chanceExponent: 2.1,
    possessionExponent: 2.0,
    homeAdvantage: 1.06,
    penaltyPerChance: 0.012,
    foulPerMinute: 0.24,
    yellowPerFoul: 0.13,
    redPerFoul: 0.0008,
    injuryPerPlayerMatch: 0.0042,
    extraTimeMinutes: 30,
    subsMin: 3,
    subsMax: 5,
  },
  injuries: {
    trainingBase: 0.0035,
    intenseMultiplier: 2.1,
    lowFitnessMultiplier: 1.8,
    pronenessScale: 1.6,
    /** Cap on serious+ injuries per user season to avoid frustration. */
    maxSeriousPerSeason: 1,
  },
  development: {
    /** Points of overall gained per season at max gap for an average-rate youngster. */
    youthGrowth: 7.0,
    primeAge: 27,
    declineStart: 30,
    declinePerYear: 1.0,
    minutesWeight: 0.35,
    trainingWeight: 0.25,
    seasonNoise: 1.4,
  },
  economy: {
    /** Weekly wage for an overall-60 player at a prestige-60 club. */
    wageBase: 9000,
    wageCurve: 8.5,
    valueBase: 1_200_000,
    valueCurve: 7.2,
    revenuePerPrestige: 26000,
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
    januaryWindow: [21, 22, 23, 24],
    summerWindow: [45, 46, 47, 48, 49, 50, 1, 2, 3],
    endOfSeasonTurn: 44,
    cupTurns: [7, 12, 17, 26, 36, 42],
    continentalGroupTurns: [6, 8, 11, 16, 18, 22],
    continentalKnockoutTurns: { QF: 29, SF: 38, F: 43 },
    tournamentTurns: { group: [45, 46, 47], QF: 48, SF: 49, F: 50 },
    monthLength: 4,
  },
  rewards: {
    trainingBoost: { amount: 0.12, durationTurns: 2, cooldownTurns: 6 },
    recoveryBoost: { amount: 12, durationTurns: 1, cooldownTurns: 4 },
    moraleBoost: { amount: 6, durationTurns: 1, cooldownTurns: 6 },
  },
} as const;

export type Balance = typeof BALANCE;
