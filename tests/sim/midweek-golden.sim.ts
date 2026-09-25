import { writeFileSync } from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { buildGolden } from "./midweek-golden";

// Writes tests/fixtures/midweek-golden.json. Run through
// `node scripts/midweek/golden.mjs`, which sets MIDWEEK_WRITE_GOLDEN; a plain
// `npm run sim:midweek` skips it.
it.skipIf(!process.env.MIDWEEK_WRITE_GOLDEN)("writes the Midweek golden vectors", () => {
  const file = path.resolve(import.meta.dirname, "../fixtures/midweek-golden.json");
  writeFileSync(file, `${JSON.stringify(buildGolden(), null, 2)}\n`);
});
