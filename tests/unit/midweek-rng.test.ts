import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { idiv, mulPpm, powerSharePpm } from "@/game/midweek/fixed";
import { DRAW_SPACE, pickWeighted, seedHash, shaRng, shuffle, uniform } from "@/game/midweek/rng";

const SEED = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

describe("midweek rng", () => {
  it("is sha256(seed ‖ tag), first 6 bytes, big-endian", () => {
    const rng = shaRng(SEED);
    const expected = createHash("sha256")
      .update(Buffer.concat([Buffer.from(SEED, "hex"), Buffer.from("form:p:x", "utf8")]))
      .digest()
      .readUIntBE(0, 6);
    expect(rng("form:p:x")).toBe(expected);
    expect(rng("form:p:x")).toBe(expected);
    expect(rng("form:p:y")).not.toBe(expected);
    expect(expected).toBeLessThan(DRAW_SPACE);
  });

  it("publishes the seed's hash, not the seed", () => {
    expect(seedHash(SEED)).toBe(
      createHash("sha256").update(Buffer.from(SEED, "hex")).digest("hex"),
    );
    expect(() => shaRng("not-a-seed")).toThrow();
    expect(() => shaRng(SEED.toUpperCase())).toThrow();
  });

  it("draws uniformly (chi-square over 100,000 draws)", () => {
    const rng = shaRng(SEED);
    const buckets = 20;
    const counts = new Array(buckets).fill(0);
    const draws = 100_000;
    for (let i = 0; i < draws; i += 1) counts[uniform(rng, `u:${i}`, buckets)] += 1;
    const expected = draws / buckets;
    const chiSquare = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
    // 19 degrees of freedom: the 0.999 quantile is 43.8.
    expect(chiSquare).toBeLessThan(43.8);
  });

  it("chooses by weight and never picks a zero weight", () => {
    const rng = shaRng(SEED);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i += 1) counts[pickWeighted(rng, `w:${i}`, [1, 0, 3])] += 1;
    expect(counts[1]).toBe(0);
    expect(counts[2] / counts[0]).toBeGreaterThan(2.7);
    expect(counts[2] / counts[0]).toBeLessThan(3.3);
    expect(() => pickWeighted(rng, "w", [0, 0])).toThrow();
  });

  it("shuffles deterministically into a permutation", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    const once = shuffle(shaRng(SEED), "s", items);
    expect(shuffle(shaRng(SEED), "s", items)).toEqual(once);
    expect([...once].sort()).toEqual(items);
  });
});

describe("midweek fixed-point arithmetic", () => {
  it("floors non-negative integer division and refuses unsafe values", () => {
    expect(idiv(7, 2)).toBe(3);
    expect(mulPpm(1_350_000, 1_000_000)).toBe(1_350_000);
    expect(mulPpm(1_234_567, 876_543)).toBe(Math.floor((1_234_567 * 876_543) / 1_000_000));
    expect(() => idiv(-1, 2)).toThrow();
    expect(() => idiv(1, 0)).toThrow();
    expect(() => mulPpm(2 ** 40, 2 ** 20)).toThrow();
  });

  it("splits power shares, half for equal sides", () => {
    expect(powerSharePpm(1_000_000, 1_000_000, 2)).toBe(500_000);
    expect(powerSharePpm(0, 0, 3)).toBe(500_000);
    expect(powerSharePpm(2_000_000, 1_000_000, 1)).toBe(666_666);
    expect(powerSharePpm(2_000_000, 1_000_000, 2)).toBe(800_000);
    expect(powerSharePpm(9_000_000, 1_000, 4)).toBe(1_000_000);
  });
});
