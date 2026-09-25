import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildParitySql } from "../sim/midweek-parity-sql";

/**
 * The SQL engine's parity test is generated from the golden vectors (ADR-090).
 * If the fixture changes without regenerating it, the database suite would
 * pin the SQL to stale values; this test catches that. Regenerate both with
 * `node scripts/midweek/golden.mjs`.
 */
const root = path.resolve(import.meta.dirname, "../..");

describe("midweek SQL parity test", () => {
  it("is current against the golden fixture", () => {
    const golden = JSON.parse(
      readFileSync(path.join(root, "tests/fixtures/midweek-golden.json"), "utf8"),
    );
    const committed = readFileSync(
      path.join(root, "supabase/tests/database/midweek_engine_parity.test.sql"),
      "utf8",
    );
    expect(committed.replace(/\r\n/g, "\n")).toBe(buildParitySql(golden));
  });
});
