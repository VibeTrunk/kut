#!/usr/bin/env node
// Regenerates sim-output/MIDWEEK_ROTATION.md (gitignored), the C0 harness report on the
// weekly rotation of unclaimed Players' archetypes (MM 2.0, Q8 and Q9): every
// rotation variant over the same simulated seasons. About half an hour:
//
//   node scripts/midweek/rotation.mjs
//
// Set MIDWEEK_SIM_SEASONS for a quicker exploratory run, which prints the
// report instead of writing it. The engine is TypeScript behind the `@/` path
// alias, which plain Node cannot resolve, so the comparison runs inside Vitest
// (tests/sim/midweek-rotation.sim.ts).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync(
  "npx",
  ["vitest", "run", "--config", "vitest.sim.config.mts", "tests/sim/midweek-rotation.sim.ts"],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, MIDWEEK_SIM_ROTATION: "1" },
  },
);
process.exit(result.status ?? 1);
