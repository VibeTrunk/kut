import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { buildSample, sampleMarkdown } from "./midweek-sample";

// Writes design/midweek/sample-tournament.{json,md}. Run through
// `node scripts/midweek/sample.mjs`, which sets MIDWEEK_WRITE_SAMPLE; a plain
// `npm run sim:midweek` skips it.
it.skipIf(!process.env.MIDWEEK_WRITE_SAMPLE)("writes the Midweek sample tournament", () => {
  const dir = path.resolve(import.meta.dirname, "../../design/midweek");
  mkdirSync(dir, { recursive: true });
  const sample = buildSample();
  writeFileSync(path.join(dir, "sample-tournament.json"), `${JSON.stringify(sample, null, 2)}\n`);
  writeFileSync(path.join(dir, "sample-tournament.md"), sampleMarkdown(sample));
});
