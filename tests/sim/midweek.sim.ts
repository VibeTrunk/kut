import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { DEFAULT_SIM, evaluateTargets, runSimulation } from "./midweek-world";
import { renderTuningReport } from "./midweek-report";

// `npm run sim:midweek` — the full target table (BUILD_SPEC §44.12) over at
// least 5,000 seasons, and the tuning sign-off artifact. Set
// MIDWEEK_SIM_SEASONS for a quicker exploratory run; the report is written
// only for a full run, to the gitignored sim-output/MIDWEEK_TUNING.md.
it("Midweek Madness hits every simulation target", () => {
  const seasons = Number(process.env.MIDWEEK_SIM_SEASONS ?? DEFAULT_SIM.seasons);
  const started = Date.now();
  const stats = runSimulation({ ...DEFAULT_SIM, seasons });
  const seconds = (Date.now() - started) / 1000;
  const targets = evaluateTargets(stats);

  console.table(
    targets.map((t) => ({ target: t.name, goal: t.goal, value: t.value, pass: t.pass })),
  );
  console.log(
    `goals/match ${stats.goalsPerMatch.toFixed(2)}, chances/match ${stats.chancesPerMatch.toFixed(2)}, ` +
      `shoot-outs ${(stats.shootoutRate * 100).toFixed(1)}%, keeper goals/season ${stats.keeperGoalsPerSeason.toFixed(2)}, ` +
      `brier ${stats.brier.toFixed(4)}, ${seconds.toFixed(0)} s`,
  );

  if (seasons >= DEFAULT_SIM.seasons) {
    const dir = path.resolve(import.meta.dirname, "../../sim-output");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "MIDWEEK_TUNING.md"), renderTuningReport(stats, targets, seconds));
  }
  expect(targets.filter((t) => !t.pass).map((t) => t.name)).toEqual([]);
});
