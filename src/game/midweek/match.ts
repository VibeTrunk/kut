import type { Archetype } from "@/game/archetypes";
import { CHANCE_TYPES, MIDWEEK, PPM, type ChanceType, type MidweekConfig } from "./config";
import { idiv, mulPpm, powerSharePpm } from "./fixed";
import { dayRollPpm } from "./power";
import { pickWeighted, uniform, type Rng } from "./rng";
import { keeperStrengthPpm, type LineMults } from "./shape";

/**
 * One match, played as chances (BUILD_SPEC §44.5). Every draw is tagged under
 * the match's prefix, so the SQL twin can reproduce it draw for draw.
 */

export type MatchCard = { archetype: Archetype; weekPowerPpm: number; lines: LineMults };

/** Five cards, one of which plays in goal. */
export type MatchSide = { cards: readonly MatchCard[]; keeperSlot: number; keeperless: boolean };

export type Side = 0 | 1;
export type ChanceOutcome = "goal" | "save" | "block" | "woodwork" | "wide";
export type PenaltyOutcome = "goal" | "save" | "woodwork" | "wide";

export type ChanceEvent = {
  kind: "chance";
  minute: number;
  side: Side;
  creator: number;
  shooter: number;
  chanceType: ChanceType;
  outcome: ChanceOutcome;
  pGoalPpm: number;
  /** The keeper for a save; the defender for a block or a shot forced wide; else null. */
  defender: number | null;
};

export type PenaltyEvent = {
  kind: "penalty";
  round: number;
  side: Side;
  kicker: number;
  keeper: number;
  outcome: PenaltyOutcome;
  pGoalPpm: number;
};

/** A shoot-out still level after the sudden-death cap is settled by a draw. */
export type TossEvent = { kind: "toss"; side: Side };

export type MatchEvent = ChanceEvent | PenaltyEvent | TossEvent;

export type MatchOutcome = {
  goals: [number, number];
  penalties: [number, number] | null;
  winnerSide: Side;
  /** Side 0's pre-match win chance. */
  winChancePpm: number;
  dayRollsPpm: [number[], number[]];
  events: MatchEvent[];
};

type Contributions = {
  att: number[];
  mid: number[];
  def: number[];
  keeper: number;
  midTotal: number;
  defTotal: number;
};

function contributions(side: MatchSide, powers: readonly number[], cfg: MidweekConfig) {
  const result: Contributions = {
    att: [],
    mid: [],
    def: [],
    keeper: 0,
    midTotal: 0,
    defTotal: 0,
  };
  side.cards.forEach((card, slot) => {
    const power = powers[slot];
    result.att.push(mulPpm(power, card.lines.attPpm));
    result.mid.push(mulPpm(power, card.lines.midPpm));
    result.def.push(mulPpm(power, card.lines.defPpm));
    if (slot === side.keeperSlot) {
      result.keeper = keeperStrengthPpm(power, card.lines, side.keeperless, cfg);
    } else {
      result.midTotal += result.mid[slot];
      result.defTotal += result.def[slot];
    }
  });
  return result;
}

/** A side's week-long rating: outfield attack, midfield and defence plus the keeper. */
export function sideRatingPpm(side: MatchSide, cfg: MidweekConfig = MIDWEEK): number {
  const c = contributions(
    side,
    side.cards.map((card) => card.weekPowerPpm),
    cfg,
  );
  let outfieldAttack = 0;
  c.att.forEach((value, slot) => {
    if (slot !== side.keeperSlot) outfieldAttack += value;
  });
  return outfieldAttack + c.midTotal + c.defTotal + c.keeper;
}

/** Closed-form pre-match win chance for side 0, from week-long factors only (no day roll). */
export function winChancePpm(a: MatchSide, b: MatchSide, cfg: MidweekConfig = MIDWEEK): number {
  return powerSharePpm(sideRatingPpm(a, cfg), sideRatingPpm(b, cfg), cfg.winChanceContrast);
}

function chanceTypeWeights(
  creator: Archetype,
  shooter: Archetype,
  solo: boolean,
  cfg: MidweekConfig,
): number[] {
  const t = cfg.chanceTypes;
  return CHANCE_TYPES.map((type) => {
    if (solo && !t.solo.includes(type)) return 0;
    return (
      t.base[type] + (t.creatorBonus[creator][type] ?? 0) + (t.shooterBonus[shooter][type] ?? 0)
    );
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The order a side takes its penalties: outfielders by attack, strongest first, then the keeper. */
function penaltyOrder(side: MatchSide, att: readonly number[]): number[] {
  const outfield = side.cards.map((_, slot) => slot).filter((slot) => slot !== side.keeperSlot);
  outfield.sort((x, y) => att[y] - att[x] || x - y);
  return [...outfield, side.keeperSlot];
}

export function playMatch(
  rng: Rng,
  prefix: string,
  a: MatchSide,
  b: MatchSide,
  cfg: MidweekConfig = MIDWEEK,
): MatchOutcome {
  const sides = [a, b] as const;
  const dayRolls = sides.map((side, s) =>
    side.cards.map((_, slot) => dayRollPpm(rng, `${prefix}:day:${s}:${slot}`, cfg)),
  ) as [number[], number[]];
  const c = sides.map((side, s) =>
    contributions(
      side,
      side.cards.map((card, slot) => mulPpm(card.weekPowerPpm, dayRolls[s][slot])),
      cfg,
    ),
  );

  const m = cfg.match;
  const events: MatchEvent[] = [];
  const goals: [number, number] = [0, 0];
  const midShare0 = powerSharePpm(c[0].midTotal, c[1].midTotal, m.midfieldContrast);

  for (let slot = 0; slot < m.chanceSlots; slot += 1) {
    const tag = `${prefix}:c:${slot}`;
    if (uniform(rng, `${tag}:occ`, PPM) >= m.chanceRatePpm) continue;

    const side: Side = uniform(rng, `${tag}:side`, PPM) < midShare0 ? 0 : 1;
    const opp: Side = side === 0 ? 1 : 0;
    const attacking = sides[side];
    const defending = sides[opp];

    const creator = pickWeighted(
      rng,
      `${tag}:creator`,
      c[side].mid.map((value, i) =>
        i === attacking.keeperSlot ? mulPpm(value, cfg.keeperCreatorWeightPpm) : value,
      ),
    );
    const shooter = pickWeighted(
      rng,
      `${tag}:shooter`,
      c[side].att.map((value, i) =>
        i === attacking.keeperSlot ? mulPpm(value, cfg.keeperShooterWeightPpm) : value,
      ),
    );
    const chanceType =
      CHANCE_TYPES[
        pickWeighted(
          rng,
          `${tag}:type`,
          chanceTypeWeights(
            attacking.cards[creator].archetype,
            attacking.cards[shooter].archetype,
            creator === shooter,
            cfg,
          ),
        )
      ];

    const outfieldCount = defending.cards.length - 1;
    const resistance = idiv(idiv(c[opp].defTotal, outfieldCount) + c[opp].keeper, 2);
    const finishing = 2 * powerSharePpm(c[side].att[shooter], resistance, m.finishingContrast);
    const base = mulPpm(m.goalBasePpm, cfg.chanceTypes.difficultyPpm[chanceType]);
    const pGoalPpm = clamp(mulPpm(base, finishing), m.goalMinPpm, m.goalMaxPpm);

    let outcome: ChanceOutcome = "goal";
    let defender: number | null = null;
    if (uniform(rng, `${tag}:goal`, PPM) < pGoalPpm) {
      goals[side] += 1;
    } else {
      const w = m.missWeights;
      outcome = (["save", "block", "woodwork", "wide"] as const)[
        pickWeighted(rng, `${tag}:miss`, [w.save, w.block, w.woodwork, w.wide])
      ];
      if (outcome === "save") {
        defender = defending.keeperSlot;
      } else if (outcome === "block" || outcome === "wide") {
        defender = pickWeighted(
          rng,
          `${tag}:defender`,
          c[opp].def.map((value, i) => (i === defending.keeperSlot ? 0 : value)),
        );
      }
    }

    const low = idiv(slot * m.minutes, m.chanceSlots) + 1;
    const high = idiv((slot + 1) * m.minutes, m.chanceSlots);
    const minute = low + uniform(rng, `${tag}:minute`, high - low + 1);

    events.push({
      kind: "chance",
      minute,
      side,
      creator,
      shooter,
      chanceType,
      outcome,
      pGoalPpm,
      defender,
    });
  }

  let penalties: [number, number] | null = null;
  let winnerSide: Side;
  if (goals[0] !== goals[1]) {
    winnerSide = goals[0] > goals[1] ? 0 : 1;
  } else {
    const shootout = playShootout(rng, prefix, sides, c, cfg, events);
    penalties = shootout.score;
    winnerSide = shootout.winner;
  }

  return {
    goals,
    penalties,
    winnerSide,
    winChancePpm: winChancePpm(a, b, cfg),
    dayRollsPpm: dayRolls,
    events,
  };
}

/**
 * Five kicks each, stopping once a side cannot be caught, then sudden death.
 * Past `maxSuddenDeathRounds` a seeded draw decides, so a winner is certain.
 */
function playShootout(
  rng: Rng,
  prefix: string,
  sides: readonly [MatchSide, MatchSide],
  c: readonly Contributions[],
  cfg: MidweekConfig,
  events: MatchEvent[],
): { score: [number, number]; winner: Side } {
  const p = cfg.penalties;
  const orders = sides.map((side, s) => penaltyOrder(side, c[s].att));
  const first: Side = uniform(rng, `${prefix}:p:first`, 2) === 0 ? 0 : 1;
  const kickOrder: Side[] = first === 0 ? [0, 1] : [1, 0];
  const score: [number, number] = [0, 0];
  const taken: [number, number] = [0, 0];

  const kick = (round: number, side: Side) => {
    const opp: Side = side === 0 ? 1 : 0;
    const kicker = orders[side][(round - 1) % orders[side].length];
    const tag = `${prefix}:p:${round}:${side}`;
    const pGoalPpm = clamp(
      mulPpm(p.basePpm, 2 * powerSharePpm(c[side].att[kicker], c[opp].keeper, p.contrast)),
      p.minPpm,
      p.maxPpm,
    );
    let outcome: PenaltyOutcome = "goal";
    if (uniform(rng, `${tag}:goal`, PPM) < pGoalPpm) {
      score[side] += 1;
    } else {
      const w = p.missWeights;
      outcome = (["save", "woodwork", "wide"] as const)[
        pickWeighted(rng, `${tag}:miss`, [w.save, w.woodwork, w.wide])
      ];
    }
    taken[side] += 1;
    events.push({
      kind: "penalty",
      round,
      side,
      kicker,
      keeper: sides[opp].keeperSlot,
      outcome,
      pGoalPpm,
    });
  };

  const decidedInRegulation = () => {
    const left0 = p.kicks - taken[0];
    const left1 = p.kicks - taken[1];
    return score[0] + left0 < score[1] || score[1] + left1 < score[0];
  };

  for (let round = 1; round <= p.kicks; round += 1) {
    for (const side of kickOrder) {
      kick(round, side);
      if (decidedInRegulation()) return { score, winner: score[0] > score[1] ? 0 : 1 };
    }
  }
  if (score[0] !== score[1]) return { score, winner: score[0] > score[1] ? 0 : 1 };

  for (let round = p.kicks + 1; round <= p.kicks + p.maxSuddenDeathRounds; round += 1) {
    for (const side of kickOrder) kick(round, side);
    if (score[0] !== score[1]) return { score, winner: score[0] > score[1] ? 0 : 1 };
  }

  const winner: Side = uniform(rng, `${prefix}:p:toss`, 2) === 0 ? 0 : 1;
  events.push({ kind: "toss", side: winner });
  return { score, winner };
}
