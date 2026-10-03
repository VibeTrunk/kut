import { describe, expect, it } from "vitest";
import { bracketShape } from "@/game/midweek/bracket";
import { PREDICTION_COINS_CAP, predictionCoins } from "@/game/midweek/rewards";

describe("midweek prediction coins (ADR-118)", () => {
  it("matches kut._mm_prediction_coins for every bracket", () => {
    // Pinned against the SQL twin in midweek_predictions.test.sql.
    expect([2, 3, 4, 5, 6].map(predictionCoins)).toEqual([30, 10, 4, 2, 0]);
    expect(predictionCoins(1)).toBe(0);
  });

  it("never lets a night's predictions pay more than the cap", () => {
    for (let entrants = 4; entrants <= 32; entrants += 1) {
      const { rounds } = bracketShape(entrants);
      const afterRoundOne = 2 ** (rounds - 1) - 1;
      expect(predictionCoins(rounds) * afterRoundOne, `${entrants}`).toBeLessThanOrEqual(
        PREDICTION_COINS_CAP,
      );
      expect(predictionCoins(rounds) * afterRoundOne, `${entrants}`).toBeGreaterThanOrEqual(28);
    }
  });
});
