import scenarios from "../fixtures/rating-scenarios.json";
import { describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  calculateActivityOvr,
  calculateAttributes,
  calculateLiveDiscardValue,
  calculateLiveOvr,
  calculateWeeklyPerformance,
  getRarityTier,
  rebuildRatingState,
  type Archetype,
  type FootballWeek,
  type RarityTier,
} from "@/game/rating-engine";

type Scenario = {
  name: string;
  archetype: Archetype;
  weeks: FootballWeek[];
  expected: {
    activityScore: number;
    formScore: number;
    liveOvr: number;
    rarityTier: RarityTier;
  };
};

describe("rating engine fixtures", () => {
  for (const scenario of scenarios as Scenario[]) {
    it(scenario.name, () => {
      const state = rebuildRatingState(scenario.weeks, scenario.archetype);

      expect(state.activityScore).toBeCloseTo(scenario.expected.activityScore, 4);
      expect(state.formScore).toBeCloseTo(scenario.expected.formScore, 4);
      expect(state.liveOvr).toBe(scenario.expected.liveOvr);
      expect(state.rarityTier).toBe(scenario.expected.rarityTier);
    });
  }
});

describe("rating engine invariants", () => {
  it("never lowers activity OVR as activity rises", () => {
    let previous = calculateActivityOvr(0);

    for (let activity = 1; activity <= 100; activity += 1) {
      const current = calculateActivityOvr(activity);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it("caps all attributes for every archetype", () => {
    for (const archetype of ARCHETYPES) {
      for (const liveOvr of [30, 83]) {
        const attributes = calculateAttributes(liveOvr, archetype, 4);

        for (const attribute of Object.values(attributes)) {
          expect(attribute).toBeGreaterThanOrEqual(1);
          expect(attribute).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it("keeps Live OVR within the documented bounds", () => {
    for (let activity = 0; activity <= 100; activity += 1) {
      for (let form = 0; form <= 8; form += 1) {
        const liveOvr = calculateLiveOvr(calculateActivityOvr(activity), form);
        expect(liveOvr).toBeGreaterThanOrEqual(30);
        expect(liveOvr).toBeLessThanOrEqual(83);
      }
    }
  });

  it("uses the documented rarity boundaries", () => {
    expect(getRarityTier(39)).toBe("common");
    expect(getRarityTier(40)).toBe("bronze");
    expect(getRarityTier(50)).toBe("silver");
    expect(getRarityTier(60)).toBe("gold");
    expect(getRarityTier(70)).toBe("holo");
    expect(getRarityTier(80)).toBe("elite");
  });

  it("caps weekly goal points and gives the hat-trick bonus", () => {
    expect(calculateWeeklyPerformance(0)).toBe(0);
    expect(calculateWeeklyPerformance(2)).toBe(2.5);
    expect(calculateWeeklyPerformance(3)).toBe(4.75);
    expect(calculateWeeklyPerformance(9)).toBe(6);
  });

  it("never lowers discard value as OVR rises", () => {
    let previous = calculateLiveDiscardValue(30);

    for (let ovr = 31; ovr <= 83; ovr += 1) {
      const current = calculateLiveDiscardValue(ovr);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it("uses the documented Live discard examples", () => {
    expect(calculateLiveDiscardValue(30)).toBe(10);
    expect(calculateLiveDiscardValue(40)).toBe(22);
    expect(calculateLiveDiscardValue(50)).toBe(47);
    expect(calculateLiveDiscardValue(60)).toBe(101);
    expect(calculateLiveDiscardValue(70)).toBe(217);
    expect(calculateLiveDiscardValue(80)).toBe(469);
  });
});
