import { writeFileSync } from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { renderRotationReport, ROTATION_VARIANTS } from "./midweek-rotation-report";
import { DEFAULT_SIM, evaluateTargets, runSimulation } from "./midweek-world";

// The weekly archetype rotation (MM 2.0 checkpoint C0, answering Q8 and Q9 for
// PR 7): every rotation variant over the same seasons, side by side. Run
// through `node scripts/midweek/rotation.mjs`, which sets MIDWEEK_SIM_ROTATION;
// a plain `npm run sim:midweek` skips it. MIDWEEK_SIM_SEASONS gives a quicker
// exploratory run; docs/archive/MIDWEEK_ROTATION.md is written only for a full
// run; an exploratory run prints it, or writes it to MIDWEEK_SIM_OUT.
it.skipIf(!process.env.MIDWEEK_SIM_ROTATION)("compares the archetype rotation variants", () => {
  const seasons = Number(process.env.MIDWEEK_SIM_SEASONS ?? DEFAULT_SIM.seasons);
  const started = Date.now();
  const runs = ROTATION_VARIANTS.map((variant) => {
    const stats = runSimulation({ ...DEFAULT_SIM, seasons, rotation: variant.rotation });
    const targets = evaluateTargets(stats);
    console.log(
      `${variant.name}: ${targets.map((t) => `${t.pass ? "ok" : "MISS"} ${t.value}`).join(" | ")}`,
    );
    return { variant, stats, targets };
  });
  const seconds = (Date.now() - started) / 1000;
  const report = renderRotationReport(runs, seconds);
  if (seasons >= DEFAULT_SIM.seasons) {
    writeFileSync(
      path.resolve(import.meta.dirname, "../../docs/archive/MIDWEEK_ROTATION.md"),
      report,
    );
  } else if (process.env.MIDWEEK_SIM_OUT) {
    writeFileSync(process.env.MIDWEEK_SIM_OUT, report);
  } else {
    console.log(report);
  }
});
