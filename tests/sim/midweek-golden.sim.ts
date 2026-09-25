import { writeFileSync } from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { buildGolden } from "./midweek-golden";
import { buildParitySql } from "./midweek-parity-sql";

// Writes tests/fixtures/midweek-golden.json and the SQL parity test generated
// from it. Run through `node scripts/midweek/golden.mjs`, which sets
// MIDWEEK_WRITE_GOLDEN; a plain `npm run sim:midweek` skips it.
it.skipIf(!process.env.MIDWEEK_WRITE_GOLDEN)("writes the Midweek golden vectors", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const serialized = `${JSON.stringify(buildGolden(), null, 2)}\n`;
  writeFileSync(path.join(root, "tests/fixtures/midweek-golden.json"), serialized);
  writeFileSync(
    path.join(root, "supabase/tests/database/midweek_engine_parity.test.sql"),
    buildParitySql(JSON.parse(serialized)),
  );
});
