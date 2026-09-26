import { MIDWEEK } from "@/game/midweek/config";
import { mulPpm } from "@/game/midweek/fixed";
import { ovrFactorPpm } from "@/game/midweek/power";

/**
 * One pick tile per Player (§44.2: one Player fills one slot), and the copy a
 * save sends for it. Server only: the engine's `power.ts` imports `rng.ts`,
 * which needs `node:crypto`.
 *
 * "Strongest" is the part of the week's power a copy decides before the lock:
 * the OVR factor times fitness (§44.3). Form, pick and day are per Player or
 * per match and the same for every copy. So a Special edition that kept a
 * higher OVR beats the Live copy, and an injured Player's Special edition,
 * which never goes into the cast (ADR-085), beats a Live copy of equal OVR.
 */

export type CopyCandidate = {
  card_id: string;
  player_id: string;
  is_live: boolean;
  ovr: number;
};

export function copyStrengthPpm(
  card: CopyCandidate,
  injuredPlayerIds: ReadonlySet<string>,
): number {
  const injured = card.is_live && injuredPlayerIds.has(card.player_id);
  return mulPpm(ovrFactorPpm(card.ovr), injured ? MIDWEEK.injuredFitnessPpm : 1_000_000);
}

/**
 * Groups owned copies by Player and picks the strongest of each, ties broken
 * by the higher OVR and then the card id, so the choice is stable between
 * page loads. Keeps the input order of each Player's first appearance.
 */
export function strongestCopies<T extends CopyCandidate>(
  cards: readonly T[],
  injuredPlayerIds: ReadonlySet<string>,
): { card: T; copies: number }[] {
  const byPlayer = new Map<string, { card: T; copies: number; strength: number }>();
  for (const card of cards) {
    const strength = copyStrengthPpm(card, injuredPlayerIds);
    const best = byPlayer.get(card.player_id);
    if (!best) {
      byPlayer.set(card.player_id, { card, copies: 1, strength });
      continue;
    }
    best.copies += 1;
    const stronger =
      strength > best.strength ||
      (strength === best.strength &&
        (card.ovr > best.card.ovr ||
          (card.ovr === best.card.ovr && card.card_id < best.card.card_id)));
    if (stronger) {
      best.card = card;
      best.strength = strength;
    }
  }
  return [...byPlayer.values()].map(({ card, copies }) => ({ card, copies }));
}
