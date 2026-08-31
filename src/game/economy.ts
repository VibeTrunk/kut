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
  // Club Value v2 (ADR-041): your linked player's Live-card discard value counts
  // this many times, on top of the plain discard value of every card you own.
  // Mirrored by the `4` literals in 20260910000000_club_value_v2.sql and
  // BUILD_SPEC Part XII.
  personalCardClubWeight: 4,
  // Trade offers (ADR-042). Mirrored by the SQL literals / guards in
  // 20260911000000_trade_offers.sql and BUILD_SPEC Part XXXIV.
  tradeOfferExpiryHours: 12,
  tradeOfferMaxCards: 3,
  tradeOfferMaxActivePerUser: 10,
} as const;

/**
 * Club Value v2 (ADR-041). A deliberately transparent sum so a member can
 * reconstruct their own number by hand: wallet coins, plus the plain discard
 * value of every card they own, plus their linked player's Live-card discard
 * value counted `personalCardClubWeight` times. Mirrors the arithmetic in
 * kut.my_club_value / kut.club_value_leaderboard.
 */
export function calculateClubValue(input: {
  coins: number;
  ownedCardDiscardValues: number[];
  personalCardBaseValue: number | null;
}): {
  ownedCardsValue: number;
  personalCardBonus: number;
  clubValue: number;
} {
  const ownedCardsValue = input.ownedCardDiscardValues.reduce((sum, value) => sum + value, 0);
  const personalCardBonus = (input.personalCardBaseValue ?? 0) * ECONOMY.personalCardClubWeight;
  return {
    ownedCardsValue,
    personalCardBonus,
    clubValue: input.coins + ownedCardsValue + personalCardBonus,
  };
}

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
