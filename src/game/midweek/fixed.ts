import { PPM } from "./config";

/**
 * Integer fixed-point helpers (ADR-090).
 *
 * Every operation takes and returns non-negative integers, so `Math.floor(a / b)`
 * here and bigint `a / b` in Postgres (which truncates) agree exactly. Products
 * stay below 2^53, the largest integer a JavaScript number holds exactly.
 */

function assertSafe(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Midweek fixed-point value out of range: ${value}`);
  }
  return value;
}

/** floor(a / b) for a ≥ 0 and b > 0. */
export function idiv(a: number, b: number): number {
  assertSafe(a);
  if (!(b > 0)) throw new Error(`Midweek division by ${b}`);
  return Math.floor(a / b);
}

/** a × b in parts per million, floored. */
export function mulPpm(a: number, b: number): number {
  return idiv(assertSafe(a * b), PPM);
}

/**
 * a^k / (a^k + b^k) in ppm, for a, b ≥ 0 and a small integer exponent k.
 *
 * Both values are divided by the same power of ten until the powers stay far
 * below 2^53, which keeps the result reproducible in SQL. Equal inputs give
 * exactly half.
 */
export function powerSharePpm(a: number, b: number, k: number): number {
  let divisor = 1;
  const limit = 9_000_000_000; // (x^k) × PPM stays below 2^53
  while (Math.max(idiv(a, divisor), idiv(b, divisor)) ** k > limit) divisor *= 10;
  const x = idiv(a, divisor) ** k;
  const y = idiv(b, divisor) ** k;
  if (x + y === 0) return PPM / 2;
  return idiv(x * PPM, x + y);
}
