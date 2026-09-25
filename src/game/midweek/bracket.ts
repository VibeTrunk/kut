import { shuffle, type Rng } from "./rng";

/**
 * The seeded knockout draw (BUILD_SPEC §44.6).
 *
 * `P` is the smallest power of two ≥ N and round 1 has P/2 pairings. A seeded
 * shuffle picks the P − N pairings that hold a single entrant (a bye), and a
 * second shuffle seats the entrants in pairing order. Because N > P/2, every
 * pairing holds at least one entrant. The winners of pairings 2k and 2k + 1
 * (0-based) meet in the next round.
 */

export type Bracket = {
  size: number;
  rounds: number;
  /** Round-1 pairings in order; the second seat is null for a bye. */
  pairings: Array<[string, string | null]>;
};

export function bracketShape(entrants: number): { size: number; rounds: number } {
  if (!Number.isInteger(entrants) || entrants < 2) {
    throw new Error("A bracket needs at least two entrants");
  }
  let size = 1;
  let rounds = 0;
  while (size < entrants) {
    size *= 2;
    rounds += 1;
  }
  return { size, rounds };
}

export function drawBracket(rng: Rng, entrantIds: readonly string[]): Bracket {
  const { size, rounds } = bracketShape(entrantIds.length);
  const pairingCount = size / 2;
  const byeCount = size - entrantIds.length;

  const pairingOrder = shuffle(
    rng,
    "bracket:bye",
    Array.from({ length: pairingCount }, (_, index) => index),
  );
  const byePairings = new Set(pairingOrder.slice(0, byeCount));
  const seated = shuffle(rng, "bracket:seat", entrantIds);

  const pairings: Array<[string, string | null]> = [];
  let next = 0;
  for (let pairing = 0; pairing < pairingCount; pairing += 1) {
    if (byePairings.has(pairing)) {
      pairings.push([seated[next], null]);
      next += 1;
    } else {
      pairings.push([seated[next], seated[next + 1]]);
      next += 2;
    }
  }
  return { size, rounds, pairings };
}
