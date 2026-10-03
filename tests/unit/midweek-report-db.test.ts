import { describe, expect, it } from "vitest";
import type { MatchRow } from "@/lib/midweek/rows";
import { reportInputFromRows, renderStoredReport } from "@/lib/midweek/report/from-db";
import { reportInput } from "@/lib/midweek/report/from-engine";
import { renderMatchReport } from "@/lib/midweek/report/render";
import {
  directory,
  entryRows,
  eventRows,
  matchRow,
  simulated,
} from "../support/midweek-stored-rows";

/**
 * The database twin of the report adapter (ADR-098): a golden tournament,
 * stored the way `kut._mm_lock_tournament` stores it and read back the way the
 * views return it, renders exactly the report its engine run renders.
 */

describe("midweek report from stored rows", () => {
  it("covers golden tournaments with shoot-outs", () => {
    expect(simulated.length).toBeGreaterThanOrEqual(6);
    expect(simulated.some((t) => t.result.matches.some((m) => m.outcome.penalties))).toBe(true);
  });

  it("builds the same input and report as the engine run, for every golden match", () => {
    for (const { name, seedHash, result } of simulated) {
      const entries = entryRows(result, true);
      for (const match of result.matches) {
        const fromDb = reportInputFromRows({
          seedHash,
          rounds: result.rounds,
          match: matchRow(match),
          events: eventRows(match),
          entries,
          ownersPublished: true,
        });
        const fromEngine = reportInput(result, match, seedHash, directory);
        expect(fromDb, name).toEqual(fromEngine);
        expect(renderMatchReport(fromDb!), name).toEqual(renderMatchReport(fromEngine));
      }
    }
  });

  it("has no report for a bye", () => {
    const { seedHash, result } = simulated.find((t) => t.result.byes.length > 0)!;
    const bye = result.byes[0];
    const row: MatchRow = {
      ...matchRow(result.matches[0]),
      round: 1,
      pairing: bye.pairing,
      bye: true,
      side_0_user_id: bye.userId,
      side_1_user_id: null,
      side_1_name: null,
    };
    expect(
      reportInputFromRows({
        seedHash,
        rounds: result.rounds,
        match: row,
        events: [],
        entries: entryRows(result, true),
        ownersPublished: true,
      }),
    ).toBeNull();
  });

  it("has no report while the entries still withhold the week's dice (before round 1, ADR-105)", () => {
    const { seedHash, result } = simulated[0];
    const match = result.matches[0];
    const entries = entryRows(result, false);
    for (const column of ["form_roll_ppm", "pick_factor_ppm", "power_ppm"] as const) {
      const withheld = entries.map((row) =>
        row.user_id === match.userIds[1] ? { ...row, [column]: null } : row,
      );
      expect(
        reportInputFromRows({
          seedHash,
          rounds: result.rounds,
          match: matchRow(match),
          events: eventRows(match),
          entries: withheld,
          ownersPublished: false,
        }),
        column,
      ).toBeNull();
    }
  });

  it("keeps a report's text the same once the week completes, and only then labels owner counts", () => {
    let labelled = 0;
    for (const { seedHash, result } of simulated) {
      for (const match of result.matches) {
        const build = (complete: boolean) =>
          renderStoredReport(
            reportInputFromRows({
              seedHash,
              rounds: result.rounds,
              match: matchRow(match),
              events: eventRows(match),
              entries: entryRows(result, complete),
              ownersPublished: complete,
            })!,
          );
        const before = build(false);
        const after = build(true);
        expect(after.headline).toBe(before.headline);
        expect(after.facts).toEqual(before.facts);
        expect(after.timeline).toEqual(before.timeline);
        expect(after.shootout).toEqual(before.shootout);
        after.why.forEach((side, s) => {
          side.cards.forEach((card, slot) => {
            const earlier = before.why[s].cards[slot];
            expect({ ...card, pickLabel: null }).toEqual({ ...earlier, pickLabel: null });
            if (card.trialist) expect(card.pickLabel).toBeNull();
            else if (side.auto) expect(earlier.pickLabel).toBe("auto squad");
            else {
              expect(earlier.pickLabel).toBeNull();
              expect(card.pickLabel).toMatch(
                /^(fewer than 3 owners|\d+ of ([3-9]|\d{2,}) owners)$/,
              );
              labelled += 1;
            }
          });
        });
      }
    }
    expect(labelled).toBeGreaterThan(0);
  });
});
