import type { Side } from "@/game/midweek/match";
import type { ReportInput } from "./types";

/**
 * The facts a report can tell (BUILD_SPEC §44.10). Each is detected from the
 * stored events and the lock-time factors, so every claim in a report traces
 * back to a number.
 */

export const FACT_KINDS = [
  "hat_trick",
  "upset",
  "cheap_standout",
  "contrarian_hero",
  "injured_hero",
  "form_hero",
  "three_keeper_gamble",
  "keeperless_side",
  "thrashing",
  "brace",
] as const;

export type FactKind = (typeof FACT_KINDS)[number];

export type Fact = {
  kind: FactKind;
  side: Side;
  /** The card the fact is about, if any. */
  slot: number | null;
  /** A number the line quotes: goals, margin, a factor or a win chance. */
  value: number | null;
};

/** A contrarian or form hero needs a factor at least this high, in ppm. */
export const HERO_FACTOR_PPM = 1_150_000;
/** The winner's pre-match chance below which a win is an upset, in ppm. */
export const UPSET_BELOW_PPM = 350_000;
/** Below this OVR a card is Common or Bronze. */
export const CHEAP_OVR_BELOW = 50;

export type CardStats = { goals: number; assists: number; standout: number };

/** Goals, assists and a standout score per card: goal 3, assist 2, save 1, block 1, penalty scored 1, penalty saved 2. */
export function cardStats(input: ReportInput): [CardStats[], CardStats[]] {
  const stats = input.sides.map((side) =>
    side.cards.map(() => ({ goals: 0, assists: 0, standout: 0 })),
  ) as [CardStats[], CardStats[]];
  for (const event of input.outcome.events) {
    if (event.kind === "chance") {
      const opp = event.side === 0 ? 1 : 0;
      if (event.outcome === "goal") {
        stats[event.side][event.shooter].goals += 1;
        stats[event.side][event.shooter].standout += 3;
        if (event.creator !== event.shooter) {
          stats[event.side][event.creator].assists += 1;
          stats[event.side][event.creator].standout += 2;
        }
      } else if (
        (event.outcome === "save" || event.outcome === "block") &&
        event.defender !== null
      ) {
        stats[opp][event.defender].standout += 1;
      }
    } else if (event.kind === "penalty") {
      const opp = event.side === 0 ? 1 : 0;
      if (event.outcome === "goal") stats[event.side][event.kicker].standout += 1;
      if (event.outcome === "save") stats[opp][event.keeper].standout += 2;
    }
  }
  return stats;
}

/** The match's standout card: the highest score, the winning side first on a tie, then the lower slot. */
export function standout(input: ReportInput): { side: Side; slot: number } {
  const stats = cardStats(input);
  const winner = input.outcome.winnerSide;
  let best = { side: winner, slot: 0, score: -1 };
  for (const side of [winner, winner === 0 ? 1 : 0] as Side[]) {
    stats[side].forEach((card, slot) => {
      if (card.standout > best.score) best = { side, slot, score: card.standout };
    });
  }
  return { side: best.side, slot: best.slot };
}

function keeperCount(input: ReportInput, side: Side): number {
  return input.sides[side].cards.filter((c) => !c.trialist && c.archetype === "goalkeeper").length;
}

/** Every fact the match supports, in the order a report prefers them. */
export function detectFacts(input: ReportInput): Fact[] {
  const { outcome, sides } = input;
  const winner = outcome.winnerSide;
  const loser: Side = winner === 0 ? 1 : 0;
  const stats = cardStats(input);
  const star = standout(input);
  const facts: Fact[] = [];
  const add = (kind: FactKind, side: Side, slot: number | null, value: number | null) =>
    facts.push({ kind, side, slot, value });

  const decisive = (side: Side, slot: number) =>
    stats[side][slot].goals > 0 || (star.side === side && star.slot === slot);

  for (const side of [winner, loser] as Side[]) {
    stats[side].forEach((card, slot) => {
      if (card.goals >= 3) add("hat_trick", side, slot, card.goals);
    });
  }

  const winnerChance = winner === 0 ? outcome.winChancePpm : 1_000_000 - outcome.winChancePpm;
  if (winnerChance < UPSET_BELOW_PPM) add("upset", winner, null, winnerChance);

  const starCard = sides[star.side].cards[star.slot];
  if (!starCard.trialist && starCard.ovr < CHEAP_OVR_BELOW) {
    add("cheap_standout", star.side, star.slot, starCard.ovr);
  }

  sides[winner].cards.forEach((card, slot) => {
    if (!card.trialist && card.pickFactorPpm >= HERO_FACTOR_PPM && decisive(winner, slot)) {
      add("contrarian_hero", winner, slot, card.pickFactorPpm);
    }
  });

  for (const side of [winner, loser] as Side[]) {
    sides[side].cards.forEach((card, slot) => {
      if (card.injured && decisive(side, slot)) add("injured_hero", side, slot, null);
    });
  }

  sides[winner].cards.forEach((card, slot) => {
    if (card.formRollPpm >= HERO_FACTOR_PPM && decisive(winner, slot)) {
      add("form_hero", winner, slot, card.formRollPpm);
    }
  });

  for (const side of [winner, loser] as Side[]) {
    if (keeperCount(input, side) >= 3)
      add("three_keeper_gamble", side, null, side === winner ? 1 : 0);
  }
  for (const side of [winner, loser] as Side[]) {
    if (sides[side].keeperless) add("keeperless_side", side, sides[side].keeperSlot, null);
  }

  const margin = Math.abs(outcome.goals[0] - outcome.goals[1]);
  if (margin >= 3) add("thrashing", winner, null, margin);

  for (const side of [winner, loser] as Side[]) {
    stats[side].forEach((card, slot) => {
      if (card.goals === 2) add("brace", side, slot, 2);
    });
  }
  return facts;
}
