/**
 * The rating rule's constants (BUILD_SPEC §44.10, ADR-117), on their own so
 * client components can quote them: `ratings.ts` itself needs `node:crypto`.
 */
export const RATING = {
  /** Where every card starts. */
  base: 6,
  /** Event points are multiplied by this before they are added. */
  scale: 0.75,
  floor: 4,
  cap: 10,
  /** Added for a win, taken off for a loss, shoot-outs included. */
  result: 0.4,
  /** Taken off per goal conceded: the keeper, and each outfielder. */
  concededKeeper: 0.3,
  concededOutfield: 0.1,
  /** Points are `base + chance × weight`, with `chance` the goal chance or its complement. */
  goal: { base: 1, weight: 1.5 },
  assist: { base: 0.6, weight: 0.6 },
  /** Making a chance that didn't go in. */
  created: 0.15,
  save: { base: 0.3, weight: 1.5 },
  block: { base: 0.3, weight: 1.2 },
  forcedWide: { base: 0.15, weight: 0.5 },
  penaltyScored: 0.3,
  penaltySaved: 0.8,
} as const;
