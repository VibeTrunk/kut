import type { Archetype } from "@/game/archetypes";
import { MIDWEEK, PPM, type MidweekConfig } from "./config";
import { mulPpm } from "./fixed";

/**
 * Squad shape (BUILD_SPEC §44.4, ADR-116). Each archetype's plusses (0–3 per
 * line) decide how its power splits across attack, midfield and defence, and
 * the weakest-line rule scales a squad whose outfield lines fall short.
 */

export type LineMults = { attPpm: number; midPpm: number; defPpm: number };

/** [attack, midfield, defence] plusses. */
export type Plusses = readonly [number, number, number];

export function plussesOf(archetype: Archetype, cfg: MidweekConfig = MIDWEEK): Plusses {
  const plusses = cfg.shape.plusses[archetype];
  if (!plusses) throw new Error(`Unknown archetype ${archetype}`);
  return plusses;
}

export function lineMultsPpm(archetype: Archetype, cfg: MidweekConfig = MIDWEEK): LineMults {
  const [att, mid, def] = plussesOf(archetype, cfg);
  return {
    attPpm: cfg.shape.attPpm[att],
    midPpm: cfg.shape.midPpm[mid],
    defPpm: cfg.shape.defPpm[def],
  };
}

export type SquadBalance = {
  /** The outfielders' plusses per line. */
  lines: [number, number, number];
  /** How far each line falls short of `minPlusses`. */
  short: [number, number, number];
  balancePpm: number;
};

/**
 * The weakest-line rule: the outfielders' plusses per line, how many each line
 * falls short of `minPlusses`, and the squad factor, `shortfallPpm` once per
 * plus short, floored after each step.
 */
export function squadBalance(
  archetypes: readonly Archetype[],
  keeperSlot: number,
  cfg: MidweekConfig = MIDWEEK,
): SquadBalance {
  const lines: [number, number, number] = [0, 0, 0];
  archetypes.forEach((archetype, slot) => {
    if (slot === keeperSlot) return;
    const plusses = plussesOf(archetype, cfg);
    for (let line = 0; line < 3; line += 1) lines[line] += plusses[line];
  });
  const short = lines.map((sum) => Math.max(0, cfg.balance.minPlusses - sum)) as [
    number,
    number,
    number,
  ];
  let balancePpm = PPM;
  for (let step = 0; step < short[0] + short[1] + short[2]; step += 1) {
    balancePpm = mulPpm(balancePpm, cfg.balance.shortfallPpm);
  }
  return { lines, short, balancePpm };
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

/**
 * Keeper strength from a (match) power: `keeperPpm`, times the keeperless
 * factor when an outfielder stands in. The stand-in's plusses don't change
 * it; they only decide who stands in.
 */
export function keeperStrengthPpm(
  powerPpm: number,
  keeperless: boolean,
  cfg: MidweekConfig = MIDWEEK,
): number {
  const strength = mulPpm(powerPpm, cfg.keeperPpm);
  return keeperless ? mulPpm(strength, cfg.keeperlessFactorPpm) : strength;
}
