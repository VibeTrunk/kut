import { describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  ARCHETYPE_OFFSETS,
  RARITY_BANDS,
  calculateActivityOvr,
  calculateLiveDiscardValue,
  getRarityTier,
} from "@/game/rating-engine";

// The rating engine itself is SQL (kut._rebuild_season_core) and is covered by
// the pgTAP suite. These cover only the display-side helpers this module still
// exports — see ADR-064 for why the TypeScript formula mirrors were removed.

describe("rating display helpers", () => {
  it("never lowers activity OVR as activity rises", () => {
    let previous = calculateActivityOvr(0);

    for (let activity = 1; activity <= 100; activity += 1) {
      const current = calculateActivityOvr(activity);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
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

  it("RARITY_BANDS covers every Live OVR exactly once and agrees with getRarityTier", () => {
    for (let ovr = 30; ovr <= 83; ovr += 1) {
      const matches = RARITY_BANDS.filter((band) => ovr >= band.min && ovr <= band.max);
      expect(matches).toHaveLength(1);
      expect(matches[0].tier).toBe(getRarityTier(ovr));
    }
    expect(RARITY_BANDS[0].min).toBe(30);
    expect(RARITY_BANDS[RARITY_BANDS.length - 1].max).toBe(83);
  });

  it("gives every archetype offsets that sum to zero", () => {
    // BUILD_SPEC §589 / ADR-036: an archetype redistributes attributes, it must
    // never hand out a hidden overall advantage.
    for (const archetype of ARCHETYPES) {
      const offsets = Object.values(ARCHETYPE_OFFSETS[archetype]);
      expect(offsets.reduce((total, value) => total + value, 0)).toBe(0);
    }
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
