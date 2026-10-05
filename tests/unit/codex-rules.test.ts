import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Codex project rules", () => {
  it("uses only supported decision values in the actual rule file", () => {
    // CI has no Codex CLI. Local execpolicy checks validate the full Starlark syntax.
    const rules = readFileSync(
      new URL("../../.codex/rules/project.rules", import.meta.url),
      "utf8",
    );
    const decisions = rules.split(/\r?\n/).filter((line) => /^\s*decision\s*=/.test(line));

    expect(decisions.length).toBeGreaterThan(0);
    for (const decision of decisions) {
      expect(decision).toMatch(
        /^\s*decision\s*=\s*(["'])(allow|prompt|forbidden)\1\s*,?\s*(?:#.*)?$/,
      );
    }
  });
});
