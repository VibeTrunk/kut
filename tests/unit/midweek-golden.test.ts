import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Archetype } from "@/game/archetypes";
import { MIDWEEK } from "@/game/midweek/config";
import { powerSharePpm } from "@/game/midweek/fixed";
import { playMatch, type MatchSide } from "@/game/midweek/match";
import {
  dayRollPpm,
  formRollPpm,
  ovrFactorPpm,
  pickFactorPpm,
  pickSharePpm,
} from "@/game/midweek/power";
import { roundPayouts } from "@/game/midweek/rewards";
import { seedHash, shaRng } from "@/game/midweek/rng";
import { lockAt, matchTiming, roundStartAt } from "@/game/midweek/schedule";
import { lineMultsPpm, squadBalance } from "@/game/midweek/shape";
import { simulateTournament, type EntrantInput } from "@/game/midweek/tournament";

/**
 * The shared golden vectors (ADR-090). The SQL engine must reproduce the same
 * file; this test pins the TypeScript side. After a deliberate engine or tuning
 * change, regenerate with `node scripts/midweek/golden.mjs` and review the diff.
 */
const golden = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../fixtures/midweek-golden.json"), "utf8"),
);

describe("midweek golden vectors", () => {
  it("were generated from the current configuration", () => {
    expect(golden.config).toEqual(JSON.parse(JSON.stringify(MIDWEEK)));
  });

  it("reproduce every draw and factor", () => {
    for (const d of golden.draws) expect(shaRng(d.seed)(d.tag)).toBe(d.draw);
    for (const o of golden.ovrFactors) expect(ovrFactorPpm(o.ovr)).toBe(o.ppm);
    for (const f of golden.formRolls) expect(formRollPpm(shaRng(f.seed), f.tag)).toBe(f.ppm);
    for (const d of golden.dayRolls) expect(dayRollPpm(shaRng(d.seed), d.tag)).toBe(d.ppm);
    for (const p of golden.pickShares) {
      expect(pickSharePpm(p.picks, p.owners)).toBe(p.sharePpm);
      expect(pickFactorPpm(p.sharePpm)).toBe(p.pickFactorPpm);
    }
    for (const [archetype, lines] of Object.entries(golden.lineMults)) {
      expect(lineMultsPpm(archetype as Archetype)).toEqual(lines);
    }
    for (const b of golden.balances) {
      expect(squadBalance(b.archetypes as Archetype[], b.keeperSlot)).toEqual(b.balance);
    }
    for (const s of golden.powerShares) expect(powerSharePpm(s.a, s.b, s.k)).toBe(s.ppm);
    for (const p of golden.payouts) expect(roundPayouts(p.rounds)).toEqual(p.pays);
    for (const s of golden.schedule) {
      const lock = lockAt(s.weekStart, s.version);
      expect(lock.toISOString()).toBe(s.lockAt);
      expect(
        s.roundStarts.map((_: string, index: number) =>
          roundStartAt(lock, index + 1, s.version).toISOString(),
        ),
      ).toEqual(s.roundStarts);
    }
    expect(new Set(golden.schedule.map((s: { version: number }) => s.version))).toEqual(
      new Set(Object.keys(MIDWEEK.schedule.versions).map(Number)),
    );
    for (const t of golden.timings) {
      expect(matchTiming(golden.matches[t.match].outcome.events, t.version)).toEqual(t.timing);
    }
  });

  it("reproduce every match", () => {
    expect(golden.matches.length).toBeGreaterThanOrEqual(8);
    expect(
      golden.matches.some((m: { outcome: { penalties: unknown } }) => m.outcome.penalties),
    ).toBe(true);
    for (const m of golden.matches) {
      const sides = m.sides as [MatchSide, MatchSide];
      expect(playMatch(shaRng(m.seed), m.prefix, sides[0], sides[1]), m.name).toEqual(m.outcome);
    }
  });

  it("reproduce every tournament", () => {
    expect(golden.tournaments.length).toBeGreaterThanOrEqual(8);
    for (const t of golden.tournaments) {
      expect(seedHash(t.seed)).toBe(t.seedHash);
      expect(simulateTournament(shaRng(t.seed), t.entrants as EntrantInput[]), t.name).toEqual(
        t.result,
      );
    }
  });
});
