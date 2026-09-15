import { describe, expect, it } from "vitest";
import {
  evaluateMigrationPolicy,
  parseNameStatusZ,
} from "../../scripts/policy/migration-policy.mjs";

describe("migration policy", () => {
  it("parses ordinary and rename records", () => {
    expect(
      parseNameStatusZ(
        "A\0supabase/migrations/new.sql\0R100\0supabase/migrations/old.sql\0supabase/migrations/renamed.sql\0",
      ),
    ).toEqual([
      { status: "A", kind: "A", path: "supabase/migrations/new.sql" },
      {
        status: "R100",
        kind: "R",
        oldPath: "supabase/migrations/old.sql",
        path: "supabase/migrations/renamed.sql",
      },
    ]);
  });

  it.each(["M", "D"])("rejects %s of an existing migration", (kind) => {
    const result = evaluateMigrationPolicy([
      { status: kind, kind, path: "supabase/migrations/20260101000000_existing.sql" },
    ]);
    expect(result.errors).toContainEqual(expect.stringContaining("immutable"));
  });

  it("rejects migration renames", () => {
    const result = evaluateMigrationPolicy([
      {
        status: "R100",
        kind: "R",
        oldPath: "supabase/migrations/20260101000000_existing.sql",
        path: "supabase/migrations/20260102000000_renamed.sql",
      },
    ]);
    expect(result.errors).toContainEqual(expect.stringContaining("immutable"));
  });

  it.each(["R100", "C100"])("treats %s into the migration directory as an addition", (status) => {
    const kind = status[0];
    const result = evaluateMigrationPolicy([
      {
        status,
        kind,
        oldPath: "staging/one.sql",
        path: "supabase/migrations/one.sql",
      },
    ]);
    expect(result.added).toEqual(["supabase/migrations/one.sql"]);
    expect(result.errors).toContainEqual(expect.stringContaining("database test"));
  });

  it("rejects copying an existing migration even when the destination is new", () => {
    const result = evaluateMigrationPolicy([
      {
        status: "C100",
        kind: "C",
        oldPath: "supabase/migrations/existing.sql",
        path: "supabase/migrations/new.sql",
      },
      { status: "A", kind: "A", path: "supabase/tests/database/new.test.sql" },
    ]);
    expect(result.added).toEqual(["supabase/migrations/new.sql"]);
    expect(result.errors).toContainEqual(expect.stringContaining("immutable"));
  });

  it("rejects more than one added migration", () => {
    const result = evaluateMigrationPolicy([
      { status: "A", kind: "A", path: "supabase/migrations/one.sql" },
      { status: "A", kind: "A", path: "supabase/migrations/two.sql" },
    ]);
    expect(result.errors).toContainEqual(expect.stringContaining("at most one"));
  });

  it("requires a database-test companion", () => {
    const result = evaluateMigrationPolicy([
      { status: "A", kind: "A", path: "supabase/migrations/one.sql" },
    ]);
    expect(result.errors).toContainEqual(expect.stringContaining("database test"));
  });

  it("accepts a migration with a changed database test", () => {
    const result = evaluateMigrationPolicy([
      { status: "A", kind: "A", path: "supabase/migrations/one.sql" },
      { status: "M", kind: "M", path: "supabase/tests/database/one.test.sql" },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("accepts an explicit reviewed test exemption", () => {
    const result = evaluateMigrationPolicy(
      [{ status: "A", kind: "A", path: "supabase/migrations/one.sql" }],
      {
        "one.sql": {
          rationale: "Documentation-only SQL with no executable change.",
          reviewed_by: "owner",
        },
      },
    );
    expect(result.errors).toEqual([]);
  });
});
