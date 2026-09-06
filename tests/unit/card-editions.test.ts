import { describe, expect, it } from "vitest";
import { resolveCardEdition } from "@/game/card-editions";

const stats = { pac: 61, sho: 62, pas: 63, dri: 64, def: 65, phy: 66 };

describe("edition resolution", () => {
  it("resolves a Live edition from current state", () => {
    expect(resolveCardEdition({
      isLive: true, editionId: "live", editionType: "live", title: "Alex Live",
      playerId: "alex", displayName: "Alex Example", archetype: "all_rounder",
      current: { liveOvr: 60, rarityTier: "gold", ...stats },
    })).toMatchObject({ isLive: true, ovr: 60, editionLabel: "Live edition" });
  });

  it("resolves a complete Special from frozen values", () => {
    expect(resolveCardEdition({
      isLive: false, editionId: "special", editionType: "totw", title: "Week 12 XI",
      playerId: "alex", displayName: "Alex Example", issuedAt: "2026-09-01T12:00:00Z",
      description: "A frozen football moment.", snapshotArchetype: "playmaker",
      snapshotRarityTier: "holo", snapshotOvr: 75, snapshot: { ovr: 75, ...stats },
      artworkKey: "special/totw-v1", artworkVersion: 1,
    })).toMatchObject({ isLive: false, ovr: 75, archetype: "playmaker", editionLabel: "Week 12 XI" });
  });

  it("fails closed for an incomplete Special", () => {
    expect(resolveCardEdition({
      isLive: false, editionId: "broken", editionType: "totw", title: "Broken",
      playerId: "alex", displayName: "Alex Example", issuedAt: null, description: null,
      snapshotArchetype: null, snapshotRarityTier: null, snapshotOvr: 75,
      snapshot: { ovr: 75, ...stats }, artworkKey: null, artworkVersion: null,
    })).toBeNull();
  });
});
