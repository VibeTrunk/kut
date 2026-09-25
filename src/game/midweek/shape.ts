import type { Archetype } from "@/game/archetypes";
import { ARCHETYPE_OFFSETS } from "@/game/rating-engine";
import { MIDWEEK, PPM, type MidweekConfig } from "./config";
import { idiv, mulPpm } from "./fixed";

/**
 * Squad shape (BUILD_SPEC §44.4). A card's archetype offsets (§15.1) decide how
 * its power splits across attack (SHO, PAC, DRI), midfield (PAS, DRI) and
 * defence (DEF, PHY). Absolute attributes are never used.
 */

export type LineMults = { attPpm: number; midPpm: number; defPpm: number };

/** PPM + scale × (mean offset / 10), floored at `minMultPpm`. */
function lineMult(sum: number, count: number, cfg: MidweekConfig): number {
  const denominator = 10 * count;
  const numerator = denominator * PPM + cfg.shape.scalePpm * sum;
  const floor = denominator * cfg.shape.minMultPpm;
  return idiv(Math.max(numerator, floor), denominator);
}

export function lineMultsPpm(archetype: Archetype, cfg: MidweekConfig = MIDWEEK): LineMults {
  const o = ARCHETYPE_OFFSETS[archetype];
  return {
    attPpm: lineMult(o.sho + o.pac + o.dri, 3, cfg),
    midPpm: lineMult(o.pas + o.dri, 2, cfg),
    defPpm: lineMult(o.def + o.phy, 2, cfg),
  };
}

type KeeperCandidate = { archetype: Archetype; powerPpm: number; lines: LineMults };

/**
 * The card that plays in goal: the Goalkeeper with the highest power, or, in a
 * squad without one, the outfielder with the highest defence contribution.
 * Ties go to the lower slot.
 */
export function chooseKeeper(cards: readonly KeeperCandidate[]): {
  slot: number;
  keeperless: boolean;
} {
  let best = -1;
  let bestScore = -1;
  for (let slot = 0; slot < cards.length; slot += 1) {
    const card = cards[slot];
    if (card.archetype !== "goalkeeper") continue;
    if (card.powerPpm > bestScore) {
      best = slot;
      bestScore = card.powerPpm;
    }
  }
  if (best >= 0) return { slot: best, keeperless: false };

  for (let slot = 0; slot < cards.length; slot += 1) {
    const score = mulPpm(cards[slot].powerPpm, cards[slot].lines.defPpm);
    if (score > bestScore) {
      best = slot;
      bestScore = score;
    }
  }
  return { slot: best, keeperless: true };
}

/** Keeper strength from a (match) power: its defence line, times the keeperless factor if needed. */
export function keeperStrengthPpm(
  powerPpm: number,
  lines: LineMults,
  keeperless: boolean,
  cfg: MidweekConfig = MIDWEEK,
): number {
  const strength = mulPpm(powerPpm, lines.defPpm);
  return keeperless ? mulPpm(strength, cfg.keeperlessFactorPpm) : strength;
}
