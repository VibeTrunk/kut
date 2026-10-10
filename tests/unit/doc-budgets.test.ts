import { describe, expect, it } from "vitest";
import { BUDGETS, adrSections, checkBudgets } from "../../scripts/policy/check-doc-budgets.mjs";

const limit = (name: string) => BUDGETS.find((budget) => budget.name === name)!.maxBytes;

// Baseline contents that sit well inside every limit.
function docs(overrides: Record<string, string> = {}) {
  return {
    "docs/PRODUCT.md": "# Product\n",
    "docs/decisions.md": "# Decisions\n",
    "AGENTS.md": "# AGENTS.md\n",
    "CLAUDE.md": "@AGENTS.md\n",
    ...overrides,
  };
}

const adr = (lines: number) =>
  ["## ADR-142 — Example", ...Array.from({ length: lines - 1 }, (_, i) => `line ${i}`)].join("\n");

describe("doc size budgets", () => {
  it.each([
    ["docs/PRODUCT.md", "docs/PRODUCT.md"],
    ["docs/decisions.md", "docs/decisions.md"],
  ])("accepts %s under and at its limit and rejects it one byte over", (name, file) => {
    const max = limit(name);
    expect(checkBudgets(docs({ [file]: "x".repeat(max - 1) }))).toEqual([]);
    expect(checkBudgets(docs({ [file]: "x".repeat(max) }))).toEqual([]);
    const [problem] = checkBudgets(docs({ [file]: "x".repeat(max + 1) }));
    expect(problem).toContain(`over its limit of ${max}`);
  });

  it("counts AGENTS.md and CLAUDE.md together against the start-up budget", () => {
    const max = limit("AGENTS.md + CLAUDE.md");
    const claude = "@AGENTS.md\n";
    const agents = (size: number) => "x".repeat(size - claude.length);
    expect(checkBudgets(docs({ "AGENTS.md": agents(max - 1), "CLAUDE.md": claude }))).toEqual([]);
    expect(checkBudgets(docs({ "AGENTS.md": agents(max), "CLAUDE.md": claude }))).toEqual([]);
    const [problem] = checkBudgets(docs({ "AGENTS.md": agents(max + 1), "CLAUDE.md": claude }));
    expect(problem).toMatch(/^AGENTS\.md \+ CLAUDE\.md is \d+ bytes/);
  });

  it("measures CRLF files as LF, so a Windows checkout gets the same answer", () => {
    const max = limit("docs/PRODUCT.md");
    const lf = `${"x".repeat(max - 2)}\n`;
    expect(checkBudgets(docs({ "docs/PRODUCT.md": lf.replace("\n", "\r\n") }))).toEqual([]);
  });

  it("allows an ADR of 25 lines and rejects one of 26 with what to do", () => {
    const at = `# Decisions\n\n${adr(25)}\n\n## ADR-143 — Next\n\nshort\n`;
    expect(checkBudgets(docs({ "docs/decisions.md": at }))).toEqual([]);
    const over = `# Decisions\n\n${adr(26)}\n`;
    const [problem] = checkBudgets(docs({ "docs/decisions.md": over }));
    expect(problem).toContain('"ADR-142 — Example" is 26 lines, over 25');
    expect(problem).toContain("docs-archive-YYYY-MM");
  });

  it("splits ADR sections at the next level-2 heading and ignores trailing blanks", () => {
    const text = `# Decisions\n\nintro\n\n${adr(3)}\n\n\n## Not an ADR\n\nmore\n`;
    expect(adrSections(text)).toEqual([{ title: "ADR-142 — Example", lines: 3 }]);
  });

  it("tells the author to rewrite PRODUCT.md, never append", () => {
    const [problem] = checkBudgets(
      docs({ "docs/PRODUCT.md": "x".repeat(limit("docs/PRODUCT.md") + 1) }),
    );
    expect(problem).toContain("never appended to");
  });
});
