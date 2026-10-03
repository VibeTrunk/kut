import { describe, expect, it } from "vitest";
import type { MatchEvent } from "@/game/midweek/match";
import {
  simulateTournament,
  type EntrantInput,
  type SimulatedTournament,
} from "@/game/midweek/tournament";
import { reportInput, type Directory } from "@/lib/midweek/report/from-engine";
import { RATING_STORIES } from "@/lib/midweek/report/phrasebook/ratings";
import {
  matchRatings,
  nightStory,
  rateNight,
  RATING,
  type CardTally,
  type NightMatch,
} from "@/lib/midweek/report/ratings";
import type { ReportInput } from "@/lib/midweek/report/types";
import { fastRng, generateWorld } from "../sim/midweek-world";

const SEED_HASH = "7".repeat(64);
const directory: Directory = {
  player: (id) => `Player ${id.toUpperCase()}`,
  manager: (id) => `Manager ${id.toUpperCase()}`,
};

/** Simulated tournaments with every member's matches, as a page would gather them. */
function nights(tournaments: number) {
  const out: Array<{ userId: string; matches: NightMatch[] }> = [];
  const inputs: ReportInput[] = [];
  for (let t = 0; t < tournaments; t += 1) {
    const world = generateWorld(2000 + t);
    const entrants: EntrantInput[] = world.members.map((member, i) => {
      const distinct = [...new Map(member.owned.map((c) => [c.playerId, c])).values()];
      return {
        userId: member.userId,
        owned: member.owned,
        saved: i % 4 === 0 ? [] : distinct.slice(0, 5),
      };
    });
    const result = simulateTournament(fastRng(t), entrants) as SimulatedTournament;
    const byUser = new Map<string, NightMatch[]>();
    for (const match of result.matches) {
      const input = reportInput(result, match, SEED_HASH, directory);
      inputs.push(input);
      match.userIds.forEach((userId, side) => {
        const list = byUser.get(userId) ?? [];
        list.push({ input, side: side as 0 | 1 });
        byUser.set(userId, list);
      });
    }
    for (const [userId, matches] of byUser) out.push({ userId, matches });
  }
  return { out, inputs };
}

const { out: corpus, inputs } = nights(40);

/** A bare match between two sides of five, side 0 keeping goal in slot 0, side 1 in slot 4. */
function bareMatch(events: MatchEvent[], goals: [number, number], winnerSide: 0 | 1) {
  const card = {
    name: "X",
    trialist: false,
    injured: false,
    ovr: 50,
    archetype: "all_rounder" as const,
  };
  const side = (keeperSlot: number) => ({
    manager: "M",
    auto: false,
    keeperSlot,
    keeperless: false,
    balancePpm: 1_000_000,
    cards: Array.from({ length: 5 }, () => ({
      ...card,
      ovrFactorPpm: 1_000_000,
      formRollPpm: 1_000_000,
      pickFactorPpm: 1_000_000,
      fitnessPpm: 1_000_000,
      handicapPpm: 1_000_000,
      powerPpm: 1_000_000,
      picks: null,
      owners: null,
    })),
  });
  return {
    sides: [side(0), side(4)] as const,
    outcome: {
      goals,
      penalties: null,
      winnerSide,
      winChancePpm: 500_000,
      dayRollsPpm: [[], []] as [number[], number[]],
      events,
    },
  };
}

const chance = (
  side: 0 | 1,
  creator: number,
  shooter: number,
  outcome: "goal" | "save" | "block" | "woodwork" | "wide",
  pGoalPpm: number,
  defender: number | null = null,
): MatchEvent => ({
  kind: "chance",
  minute: 10,
  side,
  creator,
  shooter,
  chanceType: "through_ball",
  outcome,
  pGoalPpm,
  defender,
});

describe("midweek card ratings", () => {
  it("rates every card of every match between the floor and 10, to one decimal", () => {
    for (const input of inputs) {
      for (const side of matchRatings(input)) {
        expect(side).toHaveLength(5);
        for (const { rating } of side) {
          expect(rating).toBeGreaterThanOrEqual(RATING.floor);
          expect(rating).toBeLessThanOrEqual(RATING.cap);
          expect(Math.round(rating * 10) / 10).toBe(rating);
        }
      }
    }
  });

  it("gives a quiet card 6 plus or minus the result", () => {
    const ratings = matchRatings(bareMatch([], [0, 0], 0));
    // Goalless: nothing conceded, so only the result moves a quiet card.
    expect(ratings[0].map((c) => c.rating)).toEqual([6.4, 6.4, 6.4, 6.4, 6.4]);
    expect(ratings[1].map((c) => c.rating)).toEqual([5.6, 5.6, 5.6, 5.6, 5.6]);
  });

  it("weighs a goal by how unlikely it was, and credits the assist", () => {
    const longShot = matchRatings(bareMatch([chance(0, 1, 2, "goal", 100_000)], [1, 0], 0));
    const tapIn = matchRatings(bareMatch([chance(0, 1, 2, "goal", 800_000)], [1, 0], 0));
    expect(longShot[0][2].rating).toBeGreaterThan(tapIn[0][2].rating);
    expect(longShot[0][2].tally.goals).toBe(1);
    expect(longShot[0][1].tally.assists).toBe(1);
    // 6 + 0.75 × (1 + 1.5 × 0.9) + 0.4 = 8.1625
    expect(longShot[0][2].rating).toBe(8.2);
    // The keeper who conceded: 6 − 0.4 − 0.3 = 5.3; an outfielder 6 − 0.4 − 0.1 = 5.5.
    expect(longShot[1][4].rating).toBe(5.3);
    expect(longShot[1][0].rating).toBe(5.5);
  });

  it("weighs a save by the chance it denied, and never costs the shooter", () => {
    const big = matchRatings(bareMatch([chance(0, 1, 2, "save", 600_000, 4)], [0, 0], 1));
    const small = matchRatings(bareMatch([chance(0, 1, 2, "save", 50_000, 4)], [0, 0], 1));
    expect(big[1][4].rating).toBeGreaterThan(small[1][4].rating);
    expect(big[1][4].tally.saves).toBe(1);
    // The shooter is rated as a quiet card on the losing side.
    expect(big[0][2].rating).toBe(5.6);
    // The creator gets the small credit for making the chance.
    expect(big[0][1].tally.created).toBe(1);
    expect(big[0][1].rating).toBeGreaterThan(big[0][2].rating);
  });

  it("holds the floor of 4", () => {
    const events = Array.from({ length: 9 }, () => chance(0, 1, 2, "goal", 500_000));
    const ratings = matchRatings(bareMatch(events, [9, 0], 0));
    // The keeper concedes nine in a defeat: 6 − 0.4 − 2.7 = 2.9, held at 4.
    expect(ratings[1][4].rating).toBe(RATING.floor);
    expect(ratings[0][2].rating).toBe(RATING.cap);
  });

  it("rates a member's night as the mean of their matches", () => {
    for (const { userId, matches } of corpus.slice(0, 200)) {
      const night = rateNight({ seedHash: SEED_HASH, userId, matches });
      expect(night).toHaveLength(5);
      for (const card of night) {
        expect(card.matchRatings).toHaveLength(matches.length);
        const mean = card.matchRatings.reduce((a, b) => a + b, 0) / matches.length;
        expect(card.rating).toBeCloseTo(Math.round(mean * 10) / 10, 5);
      }
    }
  });

  it("gives the five five different lines, the same on every visit", () => {
    for (const { userId, matches } of corpus) {
      const night = rateNight({ seedHash: SEED_HASH, userId, matches });
      expect(new Set(night.map((card) => card.line)).size).toBe(5);
      expect(rateNight({ seedHash: SEED_HASH, userId, matches })).toEqual(night);
      for (const card of night) {
        expect(card.line).not.toMatch(/[{}]/);
        expect(card.line).not.toMatch(/\.\./);
        expect(card.lineParts.map((part) => part.text).join("")).toBeTruthy();
      }
    }
  });

  it("names a trialist as the manager's, as the report does", () => {
    const withTrialist = corpus.find(({ matches }) =>
      matches[0].input.sides[matches[0].side].cards.some((card) => card.trialist),
    )!;
    const night = rateNight({ seedHash: SEED_HASH, ...withTrialist });
    expect(
      night.some((card) =>
        /'s (first |second |third |fourth |fifth )?trialist/.test(card.label.text),
      ),
    ).toBe(true);
  });

  it("can tell every story", () => {
    const seen = new Set<string>();
    for (const { userId, matches } of corpus) {
      for (const card of rateNight({ seedHash: SEED_HASH, userId, matches })) seen.add(card.story);
    }
    const tally = (patch: Partial<CardTally>): CardTally => ({
      goals: 0,
      assists: 0,
      created: 0,
      saves: 0,
      blocks: 0,
      forcedWide: 0,
      penaltiesScored: 0,
      penaltiesSaved: 0,
      conceded: 0,
      inGoal: false,
      won: false,
      ...patch,
    });
    // The rare ones, directly.
    seen.add(nightStory(tally({ goals: 3 })));
    seen.add(nightStory(tally({ penaltiesSaved: 1, inGoal: true })));
    seen.add(nightStory(tally({ saves: 4, inGoal: true })));
    for (const story of RATING_STORIES) expect(seen, story).toContain(story);
  });
});
