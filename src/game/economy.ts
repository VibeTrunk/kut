import { calculateLiveDiscardValue, type RarityTier } from "@/game/rating-engine";

/**
 * Canonical economy constants (BUILD_SPEC.md Part 145). Server-side SQL keeps
 * its own literals for the values it enforces; these mirror them so display
 * copy (e.g. the "How KUT works" page) stays in sync. If a value changes here
 * it must also change in the relevant migration and BUILD_SPEC Part 145.
 */
export const ECONOMY = {
  attendanceCoinReward: 250,
  // One-off bonus for the member who washed the bibs after a session
  // (kut.grant_bibs_reward, ADR-037). Mirrored by the SQL `v_amount` constant
  // in 20260907000000_bibs_bonus.sql and BUILD_SPEC Part 145.
  bibsCoinBonus: 100,
  starterCoinGrant: 250,
  basicPackPrice: 250,
  basicPackCardCount: 3,
  marketTaxPercent: 5,
  listingDurationHours: 24,
  // Per-call fat-finger cap on abs(amount) for the admin coin faucet
  // (kut.admin_adjust_wallet, ADR-035). Mirrored by the SQL guard in
  // 20260905000000_admin_economy_tools.sql.
  adminWalletAdjustMax: 100_000,
} as const;

export const LIVE_PACK_WEIGHTS: Record<RarityTier, number> = {
  common: 100, bronze: 60, silver: 30, gold: 12, holo: 4, elite: 1,
};

export type WeightedLiveCard = { liveOvr: number; rarityTier: RarityTier };
export type PackEconomy = {
  expectedDiscardPerSlot: number;
  expectedDiscardPerPack: number;
  expectedDiscardReturnRatio: number;
};

export function calculateExpectedPackEconomy(cards: WeightedLiveCard[], cardsPerPack: number, packPrice: number): PackEconomy {
  if (cards.length === 0 || cardsPerPack <= 0 || packPrice <= 0) {
    throw new Error("A pack economy calculation needs cards, slots, and a positive price.");
  }

  const weighted = cards.reduce((total, card) => {
    const weight = LIVE_PACK_WEIGHTS[card.rarityTier];
    return { weight: total.weight + weight, value: total.value + weight * calculateLiveDiscardValue(card.liveOvr) };
  }, { weight: 0, value: 0 });
  const expectedDiscardPerSlot = weighted.value / weighted.weight;
  const expectedDiscardPerPack = expectedDiscardPerSlot * cardsPerPack;

  return { expectedDiscardPerSlot, expectedDiscardPerPack, expectedDiscardReturnRatio: expectedDiscardPerPack / packPrice };
}

export function getPackReturnStatus(ratio: number): "target" | "watch" | "warning" | "critical" {
  if (ratio >= 0.95) return "critical";
  if (ratio > 0.8) return "warning";
  if (ratio > 0.75) return "watch";
  return "target";
}
