import { describe, expect, it } from "vitest";
import type { Archetype } from "@/game/archetypes";
import { MIDWEEK, PPM, type MidweekConfig } from "@/game/midweek/config";
import { playMatch, winChancePpm, type MatchSide } from "@/game/midweek/match";
import { shaRng } from "@/game/midweek/rng";
import { lineMultsPpm } from "@/game/midweek/shape";

function side(
  archetypes: Archetype[],
  powerPpm = PPM,
  keeperSlot = 0,
  keeperless = false,
): MatchSide {
  return {
    cards: archetypes.map((archetype) => ({
      archetype,
      weekPowerPpm: powerPpm,
      lines: lineMultsPpm(archetype),
    })),
    keeperSlot,
    keeperless,
  };
}

const balanced = side(["goalkeeper", "defender", "playmaker", "speedster", "finisher"]);
const allRounders = side(new Array(5).fill("all_rounder"), PPM, 0, true);
const seed = (n: number) => n.toString(16).padStart(64, "0");

describe("midweek match", () => {
  it("is a pure function of the seed and the sides", () => {
    const a = playMatch(shaRng(seed(1)), "m:1:0", balanced, allRounders);
    const b = playMatch(shaRng(seed(1)), "m:1:0", balanced, allRounders);
    expect(a).toEqual(b);
    expect(playMatch(shaRng(seed(1)), "m:1:1", balanced, allRounders)).not.toEqual(a);
  });

  it("scores about the intended goals per match between equal sides", () => {
    let goals = 0;
    const matches = 1_500;
    for (let n = 0; n < matches; n += 1) {
      const outcome = playMatch(shaRng(seed(n)), "m:1:0", balanced, balanced);
      goals += outcome.goals[0] + outcome.goals[1];
    }
    expect(Math.abs(goals / matches - MIDWEEK.match.intendedGoalsPerMatch)).toBeLessThan(0.25);
  });

  it("always produces a winner, going to penalties only from a draw", () => {
    for (let n = 0; n < 600; n += 1) {
      const outcome = playMatch(shaRng(seed(n)), "m:2:3", balanced, balanced);
      const [a, b] = outcome.goals;
      if (a !== b) {
        expect(outcome.penalties).toBeNull();
        expect(outcome.winnerSide).toBe(a > b ? 0 : 1);
        continue;
      }
      expect(outcome.penalties).not.toBeNull();
      const [pa, pb] = outcome.penalties!;
      const toss = outcome.events.find((event) => event.kind === "toss");
      if (toss) expect(outcome.winnerSide).toBe(toss.side);
      else expect(outcome.winnerSide).toBe(pa > pb ? 0 : 1);
    }
  });

  it("settles a shoot-out still level at the sudden-death cap with a seeded draw", () => {
    const cfg: MidweekConfig = structuredClone(MIDWEEK);
    cfg.penalties.kicks = 1;
    cfg.penalties.maxSuddenDeathRounds = 0;
    let tosses = 0;
    for (let n = 0; n < 400; n += 1) {
      const outcome = playMatch(shaRng(seed(n)), "m:1:0", balanced, balanced, cfg);
      const toss = outcome.events.find((event) => event.kind === "toss");
      if (!toss) continue;
      tosses += 1;
      expect(outcome.penalties![0]).toBe(outcome.penalties![1]);
      expect(outcome.winnerSide).toBe(toss.side);
    }
    expect(tosses).toBeGreaterThan(0);
  });

  it("records chances in minute order with valid slots and credits", () => {
    for (let n = 0; n < 200; n += 1) {
      const outcome = playMatch(shaRng(seed(n)), "m:1:0", balanced, allRounders);
      let lastMinute = 0;
      for (const event of outcome.events) {
        if (event.kind !== "chance") continue;
        expect(event.minute).toBeGreaterThan(lastMinute);
        expect(event.minute).toBeLessThanOrEqual(MIDWEEK.match.minutes);
        lastMinute = event.minute;
        const defending = event.side === 0 ? allRounders : balanced;
        if (event.outcome === "save") expect(event.defender).toBe(defending.keeperSlot);
        if (event.outcome === "block" || event.outcome === "wide") {
          expect(event.defender).not.toBeNull();
          expect(event.defender).not.toBe(defending.keeperSlot);
        }
        if (event.outcome === "goal" || event.outcome === "woodwork") {
          expect(event.defender).toBeNull();
        }
        if (event.creator === event.shooter) {
          expect(MIDWEEK.chanceTypes.solo).toContain(event.chanceType);
        }
        expect(event.pGoalPpm).toBeGreaterThanOrEqual(MIDWEEK.match.goalMinPpm);
        expect(event.pGoalPpm).toBeLessThanOrEqual(MIDWEEK.match.goalMaxPpm);
      }
    }
  });

  it("gives the stronger side the better odds and more wins", () => {
    const strong = side(
      ["goalkeeper", "defender", "playmaker", "speedster", "finisher"],
      1_300_000,
    );
    expect(winChancePpm(strong, balanced)).toBeGreaterThan(PPM / 2);
    expect(winChancePpm(balanced, balanced)).toBe(PPM / 2);
    let wins = 0;
    for (let n = 0; n < 600; n += 1) {
      if (playMatch(shaRng(seed(n)), "m:1:0", strong, balanced).winnerSide === 0) wins += 1;
    }
    expect(wins).toBeGreaterThan(330);
  });

  it("makes a proper keeper worth having", () => {
    const keeperless = side(
      ["tank", "defender", "playmaker", "speedster", "finisher"],
      PPM,
      0,
      true,
    );
    let wins = 0;
    for (let n = 0; n < 600; n += 1) {
      if (playMatch(shaRng(seed(n)), "m:1:0", balanced, keeperless).winnerSide === 0) wins += 1;
    }
    expect(wins).toBeGreaterThan(312);
  });
});
