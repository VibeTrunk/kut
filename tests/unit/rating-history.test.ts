import { describe, expect, it } from "vitest";
import { ratingDomain } from "@/components/rating-history";

describe("rating chart tier domain", () => {
  it("adds one rarity band around a Gold series", () => {
    expect(ratingDomain([61, 67, 69]).map((band) => band.tier)).toEqual(["silver", "gold", "holo"]);
  });

  it("does not render a tier below Common at the engine floor", () => {
    expect(ratingDomain([30]).map((band) => band.tier)).toEqual(["common", "bronze"]);
  });
});
