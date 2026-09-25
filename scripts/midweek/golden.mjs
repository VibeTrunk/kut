#!/usr/bin/env node
// Regenerates tests/fixtures/midweek-golden.json, the golden vectors both
// Midweek engines must reproduce (ADR-090), and the SQL engine's parity test
// generated from it, supabase/tests/database/midweek_engine_parity.test.sql.
// Run after any deliberate engine or tuning change and review both diffs:
//
//   node scripts/midweek/golden.mjs
//
// The engine is TypeScript behind the `@/` path alias, which plain Node cannot
// resolve, so the builder runs inside Vitest (tests/sim/midweek-golden.sim.ts).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync(
  "npx",
  ["vitest", "run", "--config", "vitest.sim.config.mts", "tests/sim/midweek-golden.sim.ts"],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, MIDWEEK_WRITE_GOLDEN: "1" },
  },
);
process.exit(result.status ?? 1);
