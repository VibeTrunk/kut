#!/usr/bin/env node
// Regenerates design/midweek/sample-tournament.{json,md}, an invented sample
// tournament with rendered reports for the Midweek design pass. Run after an
// engine or phrasebook change:
//
//   node scripts/midweek/sample.mjs
//
// The engine is TypeScript behind the `@/` path alias, which plain Node cannot
// resolve, so the builder runs inside Vitest (tests/sim/midweek-sample.sim.ts).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync(
  "npx",
  ["vitest", "run", "--config", "vitest.sim.config.mts", "tests/sim/midweek-sample.sim.ts"],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, MIDWEEK_WRITE_SAMPLE: "1" },
  },
);
process.exit(result.status ?? 1);
