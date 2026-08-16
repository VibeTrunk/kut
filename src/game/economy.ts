import { calculateLiveDiscardValue, type RarityTier } from "@/game/rating-engine";

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
