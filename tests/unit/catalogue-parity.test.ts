import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compareCatalogue } from "../../scripts/policy/check-catalogue-parity.mjs";

const roots: string[] = [];

// Two migration directories filled with the given files.
function dirs(source: Record<string, string>, catalogue: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), "catalogue-parity-"));
  roots.push(root);
  const fill = (name: string, files: Record<string, string>) => {
    const dir = path.join(root, name);
    mkdirSync(dir);
    for (const [file, text] of Object.entries(files)) writeFileSync(path.join(dir, file), text);
    return dir;
  };
  return [fill("source", source), fill("catalogue", catalogue)] as const;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("catalogue parity", () => {
  it("passes when every migration is in the catalogue, ignoring other tools' files", () => {
    const [source, catalogue] = dirs(
      { "20261019000000_a.sql": "select 1;\n", "README.md": "not a migration" },
      { "20261019000000_a.sql": "select 1;\n", "202608160001_other_tool.sql": "select 2;\n" },
    );
    const result = compareCatalogue(source, catalogue);
    expect(result.problems).toEqual([]);
    expect(result.count).toBe(1);
    expect(result.aggregate).toMatch(/^[0-9a-f]{64}$/);
  });

  it("names a migration the catalogue lacks", () => {
    const [source, catalogue] = dirs({ "20261020000000_new.sql": "select 1;\n" }, {});
    const [problem] = compareCatalogue(source, catalogue).problems;
    expect(problem).toContain("20261020000000_new.sql is not in the catalogue");
  });

  it("rejects a copy that differs by one byte, line endings included", () => {
    const [source, catalogue] = dirs(
      { "20261020000000_new.sql": "select 1;\n" },
      { "20261020000000_new.sql": "select 1;\r\n" },
    );
    const [problem] = compareCatalogue(source, catalogue).problems;
    expect(problem).toContain("20261020000000_new.sql differs from the catalogue copy");
  });
});
