/**
 * Midweek Madness tunables (BUILD_SPEC §44, §145; ADR-089, ADR-090).
 *
 * Every factor is an integer in parts per million, so the TypeScript engine and
 * its SQL twin compute bit-identical results (ADR-090). A change here is a
 * change to the game: it must also change the SQL engine, regenerate the golden
 * vectors (`node scripts/midweek/golden.mjs`), re-run `npm run sim:midweek`, and
 * update BUILD_SPEC §44 / §145.
 */

export const PPM = 1_000_000;

export const CHANCE_TYPES = [
  "breakaway",
  "wing_run",
  "chase",
  "volley",
  "first_time",
  "overhead",
  "through_ball",
  "free_kick",
  "curler",
  "header",
  "scramble",
  "long_shot",
  "long_throw",
  "cutback",
  "one_two",
] as const;

export type ChanceType = (typeof CHANCE_TYPES)[number];

type TypeWeights = Partial<Record<ChanceType, number>>;

export const MIDWEEK = {
  squadSize: 5,
  minEntrants: 4,
  /** A champion's total over every round (MIDWEEK_CHAMPION_TOTAL). */
  championTotal: 250,
  /** Owner counts below this are never published (ADR-091). */
  ownerCountMin: 3,

  schedule: {
    /** Days after the ISO Monday: Wednesday. */
    lockDayOffset: 2,
    lockHourLocal: 20,
    revealIntervalMinutes: 30,
  },

  ovr: { min: 30, max: 83, factorMaxPpm: 1_100_000 },

  /**
   * Weekly form roll: the mean of `dice` uniform draws, mapped piecewise so the
   * mode is `modePpm` and the tails reach `minPpm` and `maxPpm`.
   */
  form: { minPpm: 800_000, modePpm: 1_000_000, maxPpm: 1_250_000, dice: 2 },

  pick: {
    /** Piecewise linear pick factor over the smoothed share, as [share, factor]. */
    points: [
      [0, 1_250_000],
      [400_000, 1_000_000],
      [1_000_000, 875_000],
    ] as ReadonlyArray<readonly [number, number]>,
    smoothingPicks: 1,
    smoothingOwners: 3,
    neutralPpm: 1_000_000,
  },

  /** `day_roll` is uniform in [PPM − spread, PPM + spread]. */
  dayRollSpreadPpm: 120_000,
  injuredFitnessPpm: 950_000,
  autoFactorPpm: 575_000,

  trialist: { ovr: 30, factorPpm: 825_000 },

  shape: {
    /** Line multiplier gained per 10 points of mean archetype offset. */
    scalePpm: 500_000,
    minMultPpm: 100_000,
  },
  keeperlessFactorPpm: 450_000,
  /** The keeper's weight in the creator and shooter draws, relative to an outfielder. */
  keeperCreatorWeightPpm: 150_000,
  keeperShooterWeightPpm: 5_000,

  match: {
    /** The calibration target for two equal sides; the engine does not read it. */
    intendedGoalsPerMatch: 2.5,
    chanceSlots: 14,
    chanceRatePpm: 686_000,
    /** Exponent sharpening the midfield battle for chances. */
    midfieldContrast: 1,
    goalBasePpm: 300_000,
    /** Exponent sharpening shooter against defence and keeper. */
    finishingContrast: 1,
    goalMinPpm: 20_000,
    goalMaxPpm: 850_000,
    minutes: 90,
    /** Weights of a non-goal outcome. */
    missWeights: { save: 45, block: 25, woodwork: 8, wide: 22 },
  },

  penalties: {
    kicks: 5,
    basePpm: 750_000,
    contrast: 1,
    minPpm: 400_000,
    maxPpm: 950_000,
    maxSuddenDeathRounds: 20,
    missWeights: { save: 60, woodwork: 15, wide: 25 },
  },

  /** Exponent of the closed-form pre-match win chance. */
  winChanceContrast: 3,

  chanceTypes: {
    /** Chances a shooter can make alone, when the creator is also the shooter. */
    solo: ["breakaway", "wing_run", "long_shot", "curler", "scramble", "free_kick"] as ChanceType[],
    base: {
      breakaway: 3,
      wing_run: 3,
      chase: 2,
      volley: 2,
      first_time: 4,
      overhead: 0,
      through_ball: 4,
      free_kick: 2,
      curler: 3,
      header: 3,
      scramble: 4,
      long_shot: 3,
      long_throw: 0,
      cutback: 5,
      one_two: 4,
    } as Record<ChanceType, number>,
    creatorBonus: {
      all_rounder: {},
      speedster: { wing_run: 5, cutback: 3 },
      finisher: { one_two: 2 },
      playmaker: { through_ball: 6, free_kick: 3, one_two: 3 },
      defender: { header: 2, scramble: 2 },
      tank: { header: 2, scramble: 2 },
      goalkeeper: { long_throw: 8, breakaway: 3 },
    } as Record<string, TypeWeights>,
    shooterBonus: {
      all_rounder: {},
      speedster: { breakaway: 6, chase: 6, wing_run: 2 },
      finisher: { volley: 5, first_time: 6, overhead: 1 },
      playmaker: { curler: 5, free_kick: 4 },
      defender: { header: 6, scramble: 4, long_shot: 3 },
      tank: { header: 6, scramble: 4, long_shot: 4 },
      goalkeeper: { long_shot: 2 },
    } as Record<string, TypeWeights>,
    /** How much easier (above PPM) or harder (below) a chance type is to score. */
    difficultyPpm: {
      breakaway: 1_200_000,
      wing_run: 850_000,
      chase: 1_000_000,
      volley: 800_000,
      first_time: 1_000_000,
      overhead: 400_000,
      through_ball: 1_100_000,
      free_kick: 550_000,
      curler: 700_000,
      header: 900_000,
      scramble: 1_150_000,
      long_shot: 450_000,
      long_throw: 900_000,
      cutback: 1_250_000,
      one_two: 1_100_000,
    } as Record<ChanceType, number>,
  },
};

export type MidweekConfig = typeof MIDWEEK;
