import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "@/game/archetypes";
import { ECONOMY } from "@/game/economy";
import { MIDWEEK, PPM } from "@/game/midweek/config";
import {
  cardPowerPpm,
  dayRollPpm,
  formRollPpm,
  ovrFactorPpm,
  pickFactorPpm,
  pickSharePpm,
} from "@/game/midweek/power";
import { roundPayouts } from "@/game/midweek/rewards";
import { shaRng } from "@/game/midweek/rng";
import { chooseKeeper, lineMultsPpm } from "@/game/midweek/shape";

const SEED = "a".repeat(64);

describe("midweek card power", () => {
  it("flattens OVR from 1.00 at 30 to the configured maximum at 83", () => {
    expect(ovrFactorPpm(30)).toBe(PPM);
    expect(ovrFactorPpm(10)).toBe(PPM);
    expect(ovrFactorPpm(83)).toBe(MIDWEEK.ovr.factorMaxPpm);
    expect(ovrFactorPpm(99)).toBe(MIDWEEK.ovr.factorMaxPpm);
    for (let ovr = 30; ovr < 83; ovr += 1) {
      expect(ovrFactorPpm(ovr + 1)).toBeGreaterThanOrEqual(ovrFactorPpm(ovr));
    }
  });

  it("rolls form inside its range, mostly near the mode", () => {
    const rng = shaRng(SEED);
    const rolls = Array.from({ length: 20_000 }, (_, i) => formRollPpm(rng, `form:p:${i}`));
    const { minPpm, maxPpm, modePpm } = MIDWEEK.form;
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(minPpm);
    expect(Math.max(...rolls)).toBeLessThanOrEqual(maxPpm);
    const nearMode = rolls.filter((r) => Math.abs(r - modePpm) <= (maxPpm - minPpm) / 4).length;
    expect(nearMode / rolls.length).toBeGreaterThan(0.5);
  });

  it("keeps the day roll within its spread", () => {
    const rng = shaRng(SEED);
    for (let i = 0; i < 5_000; i += 1) {
      const roll = dayRollPpm(rng, `d:${i}`);
      expect(Math.abs(roll - PPM)).toBeLessThanOrEqual(MIDWEEK.dayRollSpreadPpm);
    }
  });

  it("smooths pick shares by +1 / +3", () => {
    expect(pickSharePpm(1, 1)).toBe(500_000); // a sole owner who picks
    expect(pickSharePpm(1, 10)).toBe(153_846); // one of ten owners
    expect(pickSharePpm(9, 10)).toBe(769_230); // nine of ten
    expect(() => pickSharePpm(3, 2)).toThrow();
  });

  it("rewards the unpopular pick, and a sole owner lands just below neutral", () => {
    const points = MIDWEEK.pick.points;
    expect(pickFactorPpm(0)).toBe(points[0][1]);
    expect(pickFactorPpm(PPM)).toBe(points[points.length - 1][1]);
    for (let share = 0; share < PPM; share += 10_000) {
      expect(pickFactorPpm(share + 10_000)).toBeLessThanOrEqual(pickFactorPpm(share));
    }
    expect(pickFactorPpm(pickSharePpm(1, 1))).toBeLessThan(MIDWEEK.pick.neutralPpm);
    expect(pickFactorPpm(pickSharePpm(1, 10))).toBeGreaterThan(MIDWEEK.pick.neutralPpm);
  });

  it("multiplies the factors left to right", () => {
    expect(
      cardPowerPpm({
        ovrFactorPpm: PPM,
        formRollPpm: PPM,
        pickFactorPpm: PPM,
        fitnessPpm: PPM,
        handicapPpm: PPM,
      }),
    ).toBe(PPM);
    const base = {
      ovrFactorPpm: 1_200_000,
      formRollPpm: 1_100_000,
      pickFactorPpm: 950_000,
      fitnessPpm: PPM,
      handicapPpm: PPM,
    };
    expect(cardPowerPpm({ ...base, fitnessPpm: MIDWEEK.injuredFitnessPpm })).toBeLessThan(
      cardPowerPpm(base),
    );
    expect(cardPowerPpm({ ...base, handicapPpm: MIDWEEK.autoFactorPpm })).toBeLessThan(
      cardPowerPpm(base),
    );
  });

  it("never makes a trialist better than the worst real card", () => {
    const lowestPick = MIDWEEK.pick.points[MIDWEEK.pick.points.length - 1][1];
    const worstCard = cardPowerPpm({
      ovrFactorPpm: ovrFactorPpm(MIDWEEK.ovr.min),
      formRollPpm: PPM,
      pickFactorPpm: lowestPick,
      fitnessPpm: MIDWEEK.injuredFitnessPpm,
      handicapPpm: PPM,
    });
    const trialist = cardPowerPpm({
      ovrFactorPpm: ovrFactorPpm(MIDWEEK.trialist.ovr),
      formRollPpm: PPM,
      pickFactorPpm: MIDWEEK.pick.neutralPpm,
      fitnessPpm: PPM,
      handicapPpm: MIDWEEK.trialist.factorPpm,
    });
    expect(trialist).toBeLessThan(worstCard);
  });
});

describe("midweek squad shape", () => {
  it("makes All-rounders average and specialists lean their way", () => {
    expect(lineMultsPpm("all_rounder")).toEqual({ attPpm: PPM, midPpm: PPM, defPpm: PPM });
    expect(lineMultsPpm("finisher").attPpm).toBeGreaterThan(PPM);
    expect(lineMultsPpm("playmaker").midPpm).toBeGreaterThan(PPM);
    expect(lineMultsPpm("goalkeeper").defPpm).toBeGreaterThan(lineMultsPpm("tank").defPpm);
    for (const archetype of ARCHETYPES) {
      const lines = lineMultsPpm(archetype);
      for (const value of Object.values(lines)) expect(value).toBeGreaterThan(0);
    }
  });

  const card = (archetype: (typeof ARCHETYPES)[number], powerPpm: number) => ({
    archetype,
    powerPpm,
    lines: lineMultsPpm(archetype),
  });

  it("puts the best Goalkeeper in goal", () => {
    expect(
      chooseKeeper([
        card("finisher", 1_300_000),
        card("goalkeeper", 1_000_000),
        card("goalkeeper", 1_100_000),
        card("goalkeeper", 1_050_000),
        card("tank", 1_200_000),
      ]),
    ).toEqual({ slot: 2, keeperless: false });
    expect(
      chooseKeeper([card("all_rounder", PPM), card("goalkeeper", 900_000), card("tank", PPM)]),
    ).toEqual({ slot: 1, keeperless: false });
  });

  it("without a Goalkeeper, puts the biggest defensive contribution in goal", () => {
    // Tank DEF+PHY = +16 edges Defender's +14 at equal power.
    expect(
      chooseKeeper([
        card("finisher", 1_300_000),
        card("defender", 1_000_000),
        card("tank", 1_000_000),
        card("all_rounder", 1_000_000),
      ]),
    ).toEqual({ slot: 2, keeperless: true });
    expect(chooseKeeper([card("all_rounder", 1_000_000), card("all_rounder", 1_000_000)])).toEqual({
      slot: 0,
      keeperless: true,
    });
  });
});

describe("midweek rewards", () => {
  it("pays a champion exactly the total, increasing by round", () => {
    for (let rounds = 1; rounds <= 6; rounds += 1) {
      const pays = roundPayouts(rounds);
      expect(pays).toHaveLength(rounds);
      expect(pays.reduce((sum, pay) => sum + pay, 0)).toBe(MIDWEEK.championTotal);
      for (let r = 1; r < rounds; r += 1) expect(pays[r]).toBeGreaterThan(pays[r - 1]);
    }
  });

  it("matches the §44.7 table", () => {
    expect(roundPayouts(2)).toEqual([83, 167]);
    expect(roundPayouts(3)).toEqual([42, 83, 125]);
    expect(roundPayouts(4)).toEqual([25, 50, 75, 100]);
    expect(roundPayouts(5)).toEqual([17, 33, 50, 67, 83]);
  });

  it("pays the champion the economy's Midweek total (ADR-096)", () => {
    expect(MIDWEEK.championTotal).toBe(ECONOMY.midweekChampionTotal);
  });
});
