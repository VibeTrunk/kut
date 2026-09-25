import { createHash } from "node:crypto";

/**
 * Seeded randomness for Midweek Madness (BUILD_SPEC §44.8, ADR-090).
 *
 * A draw is `sha256(seed ‖ tag)` with its first 6 bytes read as an unsigned
 * big-endian integer in [0, 2^48). The tag names the draw, so every draw is
 * independent of the order the engine happens to compute things in. The SQL
 * twin is
 *
 *   ('x' || encode(substring(sha256(seed || convert_to(tag, 'UTF8')) from 1 for 6), 'hex'))::bit(48)::bigint
 *
 * The engine takes an `Rng` rather than a seed, so the simulation harness can
 * pass a fast non-cryptographic generator with the same distribution.
 */

export const DRAW_SPACE = 2 ** 48;

export type Rng = (tag: string) => number;

const SEED_PATTERN = /^[0-9a-f]{64}$/;

export function assertSeed(seedHex: string): void {
  if (!SEED_PATTERN.test(seedHex)) throw new Error("A Midweek seed is 32 bytes of lowercase hex");
}

export function shaRng(seedHex: string): Rng {
  assertSeed(seedHex);
  const seed = Buffer.from(seedHex, "hex");
  return (tag) => createHash("sha256").update(seed).update(tag, "utf8").digest().readUIntBE(0, 6);
}

/** The published commitment: sha256 of the seed's bytes, as hex. */
export function seedHash(seedHex: string): string {
  assertSeed(seedHex);
  return createHash("sha256").update(Buffer.from(seedHex, "hex")).digest("hex");
}

/**
 * A uniform integer in [0, n): the draw modulo n. The bias is below n / 2^48,
 * which is negligible for every n the engine uses.
 */
export function uniform(rng: Rng, tag: string, n: number): number {
  if (!Number.isSafeInteger(n) || n < 1 || n > 2 ** 32) {
    throw new Error(`Midweek uniform range out of bounds: ${n}`);
  }
  return rng(tag) % n;
}

/**
 * Index of a weighted choice. Weights are non-negative integers with a
 * positive total; the draw walks the cumulative sum in array order.
 */
export function pickWeighted(rng: Rng, tag: string, weights: readonly number[]): number {
  let total = 0;
  for (const weight of weights) total += weight;
  if (total <= 0) throw new Error("Midweek weighted choice with no weight");
  let target = uniform(rng, tag, total);
  for (let index = 0; index < weights.length; index += 1) {
    if (target < weights[index]) return index;
    target -= weights[index];
  }
  throw new Error("unreachable");
}

/** Fisher–Yates with one tagged draw per position, from the back. */
export function shuffle<T>(rng: Rng, tag: string, items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = uniform(rng, `${tag}:${index}`, index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
