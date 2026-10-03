import { PPM } from "@/game/midweek/config";
import type { Side } from "@/game/midweek/match";
import { shaRng, uniform } from "@/game/midweek/rng";
import { RATING_LINES, type RatingStory } from "./phrasebook/ratings";
import { compose } from "./render";
import type { ReportInput, Segment } from "./types";

/**
 * Card ratings after a Midweek night (BUILD_SPEC §44.10, ADR-117). Like the
 * report renderer, a pure function of the stored events and the published
 * seed hash: it decides nothing, needs no SQL twin and never reads the secret
 * seed (ADR-093). Every point traces back to an event, weighted by the
 * engine's goal chance, so a goal from nothing counts for more than a tap-in
 * and a save counts for more the bigger the chance it denied. A miss costs the
 * shooter nothing, as the phrasebook never blames a shooter.
 */

export const RATING = {
  /** Where every card starts. */
  base: 6,
  /** Event points are multiplied by this before they are added. */
  scale: 0.75,
  floor: 4,
  cap: 10,
  /** Added for a win, taken off for a loss, shoot-outs included. */
  result: 0.4,
  /** Taken off per goal conceded: the keeper, and each outfielder. */
  concededKeeper: 0.3,
  concededOutfield: 0.1,
  /** Points are `base + chance × weight`, with `chance` the goal chance or its complement. */
  goal: { base: 1, weight: 1.5 },
  assist: { base: 0.6, weight: 0.6 },
  /** Making a chance that didn't go in. */
  created: 0.15,
  save: { base: 0.3, weight: 1.5 },
  block: { base: 0.3, weight: 1.2 },
  forcedWide: { base: 0.15, weight: 0.5 },
  penaltyScored: 0.3,
  penaltySaved: 0.8,
} as const;

/** What one card did in a match, the inputs of its rating and its line. */
export type CardTally = {
  goals: number;
  assists: number;
  /** Chances made that didn't end in a goal. */
  created: number;
  saves: number;
  blocks: number;
  forcedWide: number;
  penaltiesScored: number;
  penaltiesSaved: number;
  /** Goals the card's side conceded in open play. */
  conceded: number;
  inGoal: boolean;
  won: boolean;
};

export type CardRating = {
  /** One decimal, from `RATING.floor` to `RATING.cap`. */
  rating: number;
  tally: CardTally;
};

const emptyTally = (inGoal: boolean, won: boolean, conceded: number): CardTally => ({
  goals: 0,
  assists: 0,
  created: 0,
  saves: 0,
  blocks: 0,
  forcedWide: 0,
  penaltiesScored: 0,
  penaltiesSaved: 0,
  conceded,
  inGoal,
  won,
});

const oneDecimal = (value: number) => Math.round(value * 10) / 10;
const clampRating = (value: number) => Math.min(RATING.cap, Math.max(RATING.floor, value));

/** Every card's rating in one match, side 0 first, in slot order. */
export function matchRatings(
  input: Pick<ReportInput, "sides" | "outcome">,
): [CardRating[], CardRating[]] {
  const { sides, outcome } = input;
  const points = sides.map((side) => side.cards.map(() => 0));
  const tallies = sides.map((side, s) =>
    side.cards.map((_, slot) =>
      emptyTally(
        slot === side.keeperSlot,
        outcome.winnerSide === s,
        outcome.goals[s === 0 ? 1 : 0],
      ),
    ),
  );

  for (const event of outcome.events) {
    if (event.kind === "chance") {
      const opp: Side = event.side === 0 ? 1 : 0;
      const p = event.pGoalPpm / PPM;
      if (event.outcome === "goal") {
        points[event.side][event.shooter] += RATING.goal.base + RATING.goal.weight * (1 - p);
        tallies[event.side][event.shooter].goals += 1;
        if (event.creator !== event.shooter) {
          points[event.side][event.creator] += RATING.assist.base + RATING.assist.weight * (1 - p);
          tallies[event.side][event.creator].assists += 1;
        }
        continue;
      }
      points[event.side][event.creator] += RATING.created;
      tallies[event.side][event.creator].created += 1;
      if (event.defender === null) continue;
      if (event.outcome === "save") {
        points[opp][event.defender] += RATING.save.base + RATING.save.weight * p;
        tallies[opp][event.defender].saves += 1;
      } else if (event.outcome === "block") {
        points[opp][event.defender] += RATING.block.base + RATING.block.weight * p;
        tallies[opp][event.defender].blocks += 1;
      } else if (event.outcome === "wide") {
        points[opp][event.defender] += RATING.forcedWide.base + RATING.forcedWide.weight * p;
        tallies[opp][event.defender].forcedWide += 1;
      }
    } else if (event.kind === "penalty") {
      const opp: Side = event.side === 0 ? 1 : 0;
      if (event.outcome === "goal") {
        points[event.side][event.kicker] += RATING.penaltyScored;
        tallies[event.side][event.kicker].penaltiesScored += 1;
      } else if (event.outcome === "save") {
        points[opp][event.keeper] += RATING.penaltySaved;
        tallies[opp][event.keeper].penaltiesSaved += 1;
      }
    }
  }

  return sides.map((side, s) =>
    side.cards.map((_, slot): CardRating => {
      const tally = tallies[s][slot];
      const conceded = tally.inGoal ? RATING.concededKeeper : RATING.concededOutfield;
      const raw =
        RATING.base +
        RATING.scale * points[s][slot] +
        (tally.won ? RATING.result : -RATING.result) -
        conceded * tally.conceded;
      return { rating: clampRating(oneDecimal(raw)), tally };
    }),
  ) as [CardRating[], CardRating[]];
}

/** One of a member's matches: the report input and which side was theirs. */
export type NightMatch = { input: ReportInput; side: Side };

export type NightCard = {
  slot: number;
  /** The card's name as a segment on the member's side, as the report names it. */
  label: Segment;
  /** The mean of its match ratings, one decimal. */
  rating: number;
  /** Each match's rating, in the order played. */
  matchRatings: number[];
  /** The night's totals. `won` is true if the side won at least one match. */
  tally: CardTally;
  story: RatingStory;
  /** The line under the rating, as text and as segments. */
  line: string;
  lineParts: Segment[];
};

/** The card's biggest contribution over the night, which picks its line. */
export function nightStory(tally: CardTally): RatingStory {
  const defending = tally.blocks + tally.forcedWide;
  if (tally.goals >= 3) return "hat_trick";
  if (tally.goals === 2) return "brace";
  if (tally.goals >= 1 && tally.assists >= 1) return "goal_and_assist";
  if (tally.penaltiesSaved >= 1) return "shootout_save";
  if (tally.goals === 1) return "goal";
  if (tally.assists >= 2) return "assists";
  if (tally.assists === 1) return "assist";
  if (tally.inGoal && tally.saves >= 3) return "keeper_wall";
  if (tally.inGoal && tally.saves >= 1) return "keeper";
  if (defending >= 2) return "blocks";
  if (defending === 1) return "block";
  if (tally.created >= 2) return "creator";
  return tally.won ? "quiet_win" : "quiet";
}

const sumTallies = (tallies: readonly CardTally[]): CardTally =>
  tallies.reduce((total, tally) => ({
    goals: total.goals + tally.goals,
    assists: total.assists + tally.assists,
    created: total.created + tally.created,
    saves: total.saves + tally.saves,
    blocks: total.blocks + tally.blocks,
    forcedWide: total.forcedWide + tally.forcedWide,
    penaltiesScored: total.penaltiesScored + tally.penaltiesScored,
    penaltiesSaved: total.penaltiesSaved + tally.penaltiesSaved,
    conceded: total.conceded + tally.conceded,
    inGoal: total.inGoal || tally.inGoal,
    won: total.won || tally.won,
  }));

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

/** The card names on one side, as the report spells them: a trialist is the manager's. */
function cardNames(input: ReportInput, side: Side): string[] {
  const own = input.sides[side];
  const trialists = own.cards.filter((card) => card.name === null).length;
  let seen = 0;
  return own.cards.map((card) => {
    if (card.name !== null) return card.name;
    const ordinal = trialists > 1 ? `${ORDINALS[seen]} ` : "";
    seen += 1;
    return `${own.manager}'s ${ordinal}trialist`;
  });
}

/**
 * A member's five after the night: each card's rating as the mean of its
 * matches (a bye is not a match), its totals, and one line from the
 * phrasebook, keyed on the seed hash and the member so it never changes and
 * no two cards of the five share a line. `matches` is every match the member
 * played, in round order; the squad is the same in each.
 */
export function rateNight(input: {
  seedHash: string;
  userId: string;
  matches: readonly NightMatch[];
}): NightCard[] {
  if (input.matches.length === 0) return [];
  const perMatch = input.matches.map(({ input: match, side }) => matchRatings(match)[side]);
  const first = input.matches[0];
  const names = cardNames(first.input, first.side);
  const rng = shaRng(input.seedHash);
  const used = new Set<string>();

  return names.map((name, slot) => {
    const ratings = perMatch.map((match) => match[slot].rating);
    const tally = sumTallies(perMatch.map((match) => match[slot].tally));
    const story = nightStory(tally);
    const pool = RATING_LINES[story];
    const fresh = pool.filter((template) => !used.has(template));
    const candidates = fresh.length > 0 ? fresh : pool;
    const template = candidates[uniform(rng, `rating:${input.userId}:${slot}`, candidates.length)];
    used.add(template);
    const label: Segment = { text: name, side: first.side };
    const line = compose(template, {
      name: label,
      goals: String(tally.goals),
      assists: String(tally.assists),
      saves: String(tally.saves),
    });
    const mean = ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
    return {
      slot,
      label,
      rating: clampRating(oneDecimal(mean)),
      matchRatings: ratings,
      tally,
      story,
      line: line.text,
      lineParts: line.parts,
    };
  });
}
