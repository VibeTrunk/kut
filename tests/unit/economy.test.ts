import { describe, expect, it } from "vitest";
import { calculateClubValue, calculateExpectedPackEconomy, ECONOMY, getPackReturnStatus } from "@/game/economy";
import { calculateLiveDiscardValue } from "@/game/rating-engine";

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

describe("club value v2 (ADR-041)", () => {
  it("sums coins, owned-card discard value, and the weighted personal card", () => {
    const personalBase = calculateLiveDiscardValue(60); // 101
    const owned = [calculateLiveDiscardValue(40), calculateLiveDiscardValue(50)]; // 22 + 47
    const result = calculateClubValue({ coins: 500, ownedCardDiscardValues: owned, personalCardBaseValue: personalBase });

    expect(result.ownedCardsValue).toBe(owned[0] + owned[1]);
    expect(result.personalCardBonus).toBe(personalBase * ECONOMY.personalCardClubWeight);
    expect(result.clubValue).toBe(500 + owned[0] + owned[1] + personalBase * 4);
  });

  it("treats a missing linked player as a zero personal-card bonus", () => {
    const result = calculateClubValue({ coins: 100, ownedCardDiscardValues: [10], personalCardBaseValue: null });
    expect(result.personalCardBonus).toBe(0);
    expect(result.clubValue).toBe(110);
  });

  it("handles an empty collection", () => {
    const result = calculateClubValue({ coins: 250, ownedCardDiscardValues: [], personalCardBaseValue: calculateLiveDiscardValue(30) });
    expect(result.ownedCardsValue).toBe(0);
    expect(result.clubValue).toBe(250 + 10 * ECONOMY.personalCardClubWeight);
  });

  it("weights the personal card heavier than a single owned copy of the same rating", () => {
    const base = calculateLiveDiscardValue(55);
    const result = calculateClubValue({ coins: 0, ownedCardDiscardValues: [base], personalCardBaseValue: base });
    expect(result.personalCardBonus).toBeGreaterThan(result.ownedCardsValue);
  });
});
