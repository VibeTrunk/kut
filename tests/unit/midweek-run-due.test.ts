import { describe, expect, it } from "vitest";
import { hasDueMidweekWork } from "@/lib/midweek/run-due";

/** The lazy trigger's count-first check (ADR-098): call the worker only when it has work. */
describe("midweek lazy trigger", () => {
  const now = new Date("2026-10-07T18:01:00.000Z");
  const open = (lock: string) => ({ status: "open", lock_at: lock, final_reveal_at: null });
  const simulated = (final: string) => ({
    status: "simulated",
    lock_at: "2026-10-07T18:00:00.000Z",
    final_reveal_at: final,
  });

  it("locks an open week once its lock has passed, not before", () => {
    expect(hasDueMidweekWork([open("2026-10-07T18:00:00.000Z")], true, now)).toBe(true);
    expect(hasDueMidweekWork([open("2026-10-07T18:01:00.000Z")], true, now)).toBe(true);
    expect(hasDueMidweekWork([open("2026-10-07T18:02:00.000Z")], true, now)).toBe(false);
  });

  it("completes a simulated week once its final is out", () => {
    expect(hasDueMidweekWork([simulated("2026-10-07T18:00:00.000Z")], true, now)).toBe(true);
    expect(hasDueMidweekWork([simulated("2026-10-07T20:30:00.000Z")], true, now)).toBe(false);
  });

  it("opens a week only while the switch is on and none is running", () => {
    expect(hasDueMidweekWork([], true, now)).toBe(true);
    expect(hasDueMidweekWork([], false, now)).toBe(false);
    // Paused: an open week still runs (§44.8).
    expect(hasDueMidweekWork([open("2026-10-07T18:00:00.000Z")], false, now)).toBe(true);
  });
});
