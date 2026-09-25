import { describe, expect, it } from "vitest";
import { DEFAULT_SIM, evaluateTargets, runSimulation } from "../sim/midweek-world";

/**
 * A fast smoke version of the Midweek Madness targets (BUILD_SPEC §44.12), so a
 * later tweak cannot silently break the balance. The sign-off numbers come from
 * `npm run sim:midweek` over 5,000 seasons; this runs a few hundred short
 * seasons with a sampling tolerance.
 */
describe("midweek balance smoke test", () => {
  // About 3 s on its own, but it can pass Vitest's 5 s default when the whole
  // suite runs in parallel, so it gets an explicit budget.
  it("keeps every target within tolerance", { timeout: 30_000 }, () => {
    const stats = runSimulation({ ...DEFAULT_SIM, seasons: 200, weeksPerSeason: 3, seed: 77 });
    const failures = evaluateTargets(stats, 0.05).filter((target) => !target.pass);
    expect(failures.map((f) => `${f.name}: ${f.value}`)).toEqual([]);
  });
});
