import { describe, expect, it } from "vitest";
import {
  isValidVoidNote,
  rehearsalRounds,
  statusWord,
  voidError,
  type MidweekRehearsal,
} from "@/lib/midweek/admin";

const LOCK = "2026-10-07T18:00:00.000Z";

describe("midweek admin: void", () => {
  it("accepts a trimmed reason of 3 to 200 characters, as admin_void_midweek does", () => {
    expect(isValidVoidNote("ab")).toBe(false);
    expect(isValidVoidNote("  ab  ")).toBe(false);
    expect(isValidVoidNote("abc")).toBe(true);
    expect(isValidVoidNote("x".repeat(200))).toBe(true);
    expect(isValidVoidNote("x".repeat(201))).toBe(false);
  });

  it("puts each refusal into words, telling the two P0001 cases apart", () => {
    expect(voidError("42501", "admin role required", LOCK)).toBe(
      "Only admins can void a Midweek week.",
    );
    expect(voidError("22023", undefined, LOCK)).toMatch(/3 to 200 characters/);
    expect(voidError("P0002", "no such Midweek tournament", LOCK)).toMatch(/no longer exists/);
    expect(voidError("P0001", "this week has been paid, so it cannot be voided", LOCK)).toBe(
      "Wed 7 Oct has been paid, so it can't be voided. Correct a member's coins with a wallet adjustment in Economy.",
    );
    expect(voidError("P0001", "this week did not run, so there is nothing to void", LOCK)).toBe(
      "Wed 7 Oct didn't run, so there is nothing to void.",
    );
    expect(voidError("XX000", "boom", LOCK)).toBe("Something went wrong. Please try again.");
  });

  it("names every status", () => {
    expect(
      ["open", "simulated", "complete", "skipped", "void", null].map((s) => statusWord(s as never)),
    ).toEqual(["Open", "Running tonight", "Complete", "Skipped", "Void", "None yet"]);
  });
});

describe("midweek admin: rehearsal", () => {
  it("summarises each round: matches, byes, the pay and the reveal", () => {
    const pairing = (n: number, bye: boolean) => ({
      pairing: n,
      bye,
      side_0: "A",
      side_1: bye ? null : "B",
      goals: bye ? null : ([1, 0] as [number, number]),
      penalties: null,
      winner: "A",
    });
    const rehearsal: MidweekRehearsal = {
      ran_at: LOCK,
      tournament_id: null,
      week_start: "2026-10-05",
      lock_at: LOCK,
      status: "simulated",
      would_skip: null,
      field: 6,
      picked: 4,
      auto: 2,
      opted_out: 1,
      auto_managers: ["E", "F"],
      size: 8,
      rounds: 3,
      by_round: [
        {
          round: 1,
          reveal_at: "2026-10-07T18:30:00.000Z",
          pairings: [pairing(0, true), pairing(1, false), pairing(2, true), pairing(3, false)],
        },
        {
          round: 2,
          reveal_at: "2026-10-07T19:00:00.000Z",
          pairings: [pairing(0, false), pairing(1, false)],
        },
        { round: 3, reveal_at: "2026-10-07T19:30:00.000Z", pairings: [pairing(0, false)] },
      ],
      champion: { user_id: "a", name: "A" },
      warnings: [],
    };
    expect(rehearsalRounds(rehearsal)).toEqual([
      { round: 1, matches: 2, byes: 2, pays: 42, revealAt: "2026-10-07T18:30:00.000Z" },
      { round: 2, matches: 2, byes: 0, pays: 83, revealAt: "2026-10-07T19:00:00.000Z" },
      { round: 3, matches: 1, byes: 0, pays: 125, revealAt: "2026-10-07T19:30:00.000Z" },
    ]);
  });
});
