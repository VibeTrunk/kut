import { GAME_CONFIG } from "@/game/config";
import { ARCHETYPES, type Archetype } from "@/game/archetypes";

export { ARCHETYPES, type Archetype };

/**
 * Display-side rating helpers.
 *
 * The rating engine itself is server-authoritative and lives in SQL
 * (`kut._rebuild_season_core`, BUILD_SPEC Part XX). This module deliberately
 * holds only the pieces the browser needs to *render* a rating — the tier
 * boundaries, the activity curve and the discard curve used by the
 * "How KUT works" explainer and the rating history graph.
 *
 * It is not a second implementation of the engine. The TypeScript mirrors of
 * the Form/OVR formulas were removed in ADR-064: nothing in `src/` called them,
 * and their tests asserted TypeScript against TypeScript, so SQL could drift
 * without turning a test red. Add a function here only when a screen needs it.
 */

export type RarityTier =
  | "common"
  | "bronze"
  | "silver"
  | "gold"
  | "holo"
  | "elite";

/**
 * Live OVR range for each rarity tier. Derived from `getRarityTier` below and
 * the Live OVR bounds (30..83); kept as data so the "How KUT works" page can
 * render the tiers without re-deriving the boundaries.
 */
export const RARITY_BANDS: { tier: RarityTier; min: number; max: number }[] = [
  { tier: "common", min: 30, max: 39 },
  { tier: "bronze", min: 40, max: 49 },
  { tier: "silver", min: 50, max: 59 },
  { tier: "gold", min: 60, max: 69 },
  { tier: "holo", min: 70, max: 79 },
  { tier: "elite", min: 80, max: 83 },
];

export type Attributes = {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
};

export const ARCHETYPE_OFFSETS: Record<Archetype, Attributes> = {
  all_rounder: { pac: 0, sho: 0, pas: 0, dri: 0, def: 0, phy: 0 },
  speedster: { pac: 10, sho: -1, pas: -2, dri: 4, def: -6, phy: -5 },
  finisher: { pac: 2, sho: 10, pas: -3, dri: 3, def: -8, phy: -4 },
  playmaker: { pac: -2, sho: -2, pas: 10, dri: 5, def: -6, phy: -5 },
  defender: { pac: -2, sho: -7, pas: -1, dri: -4, def: 10, phy: 4 },
  tank: { pac: -8, sho: -2, pas: -2, dri: -4, def: 4, phy: 12 },
  // Shot-stopper: strong DEF/PHY, weak SHO/DRI. Sums to 0 like the other six
  // (BUILD_SPEC §589 — no large hidden OVR advantage). See ADR-036.
  goalkeeper: { pac: -6, sho: -12, pas: 0, dri: -8, def: 14, phy: 12 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The attendance curve behind the OVR explainer. Mirrors the SQL expression. */
export function calculateActivityOvr(activityScore: number): number {
  const boundedActivity = clamp(activityScore, 0, 100);

  return (
    GAME_CONFIG.activityOvrFloor +
    GAME_CONFIG.activityOvrRange *
      (boundedActivity / 100) ** GAME_CONFIG.activityOvrExponent
  );
}

export function getRarityTier(liveOvr: number): RarityTier {
  if (liveOvr >= 80) return "elite";
  if (liveOvr >= 70) return "holo";
  if (liveOvr >= 60) return "gold";
  if (liveOvr >= 50) return "silver";
  if (liveOvr >= 40) return "bronze";
  return "common";
}

export function calculateLiveDiscardValue(liveOvr: number): number {
  return Math.round(10 * 1.08 ** (liveOvr - GAME_CONFIG.liveOvrMin));
}
