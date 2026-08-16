import { describe, expect, it } from "vitest";
import { calculateExpectedPackEconomy, getPackReturnStatus } from "@/game/economy";

describe("pack economy", () => {
  it("calculates an all-common pack from the documented discard formula", () => {
    const result = calculateExpectedPackEconomy([{ liveOvr: 30, rarityTier: "common" }], 3, 250);
    expect(result.expectedDiscardPerSlot).toBe(10);
    expect(result.expectedDiscardPerPack).toBe(30);
    expect(result.expectedDiscardReturnRatio).toBeCloseTo(0.12);
  });

  it("uses rarity weights instead of treating high-value cards as equally likely", () => {
    const result = calculateExpectedPackEconomy([{ liveOvr: 30, rarityTier: "common" }, { liveOvr: 80, rarityTier: "elite" }], 3, 250);
    expect(result.expectedDiscardPerSlot).toBeCloseTo((1000 + 469) / 101);
    expect(result.expectedDiscardReturnRatio).toBeLessThan(0.2);
  });

  it("rejects incomplete economy inputs", () => {
    expect(() => calculateExpectedPackEconomy([], 3, 250)).toThrow();
    expect(() => calculateExpectedPackEconomy([{ liveOvr: 30, rarityTier: "common" }], 0, 250)).toThrow();
  });

  it("uses the documented target, warning, and critical thresholds", () => {
    expect(getPackReturnStatus(0.75)).toBe("target");
    expect(getPackReturnStatus(0.76)).toBe("watch");
    expect(getPackReturnStatus(0.81)).toBe("warning");
    expect(getPackReturnStatus(0.95)).toBe("critical");
  });
});
