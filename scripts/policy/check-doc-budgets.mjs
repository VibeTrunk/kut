#!/usr/bin/env node
// Size limits for the docs agents read (process reset S7, ADR-142). Written
// rules alone let the old docs grow past a megabyte; this makes the new shape
// mechanical. Raising a limit is a one-line change here, visible in review.
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const KB = 1024;

// Start-up budget: about 5k tokens at ~4 bytes per token is 20 KB. The global
// instructions and Claude's memory index took ~9.5 KB of that in S6, which
// leaves 11 KB for the repository's own start-up files.
export const BUDGETS = [
  { name: "docs/PRODUCT.md", files: ["docs/PRODUCT.md"], maxBytes: 25 * KB },
  {
    name: "docs/decisions.md",
    files: ["docs/decisions.md"],
    maxBytes: 30 * KB,
    maxAdrLines: 25,
  },
  { name: "AGENTS.md + CLAUDE.md", files: ["AGENTS.md", "CLAUDE.md"], maxBytes: 11 * KB },
];

const FIX = {
  "docs/PRODUCT.md": "Rewrite the section to the current state; PRODUCT.md is never appended to.",
  "docs/decisions.md":
    "Shorten the ADR to its current rule, or move superseded ADRs out under a new docs-archive-YYYY-MM tag (as S4 and S6 did).",
  "AGENTS.md + CLAUDE.md":
    "Move detail into the doc it belongs to (PRODUCT.md, decisions.md, an issue) and keep only start-up rules here.",
};

// Splits markdown into `## ADR-` sections, each running to the next `## `.
export function adrSections(text) {
  const sections = [];
  let current = null;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = line.startsWith("## ADR-") ? { title: line.slice(3), lines: [] } : null;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections.map(({ title, lines }) => {
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    return { title, lines: lines.length };
  });
}

// `contents` maps each file to its text. Returns one message per breach.
export function checkBudgets(contents, budgets = BUDGETS) {
  const problems = [];
  for (const budget of budgets) {
    const bytes = budget.files.reduce(
      (sum, file) => sum + Buffer.byteLength(contents[file].replace(/\r\n/g, "\n"), "utf8"),
      0,
    );
    if (bytes > budget.maxBytes)
      problems.push(
        `${budget.name} is ${bytes} bytes, over its limit of ${budget.maxBytes}. ${FIX[budget.name] ?? ""}`.trim(),
      );
    if (budget.maxAdrLines)
      for (const file of budget.files)
        for (const adr of adrSections(contents[file]))
          if (adr.lines > budget.maxAdrLines)
            problems.push(
              `${file}: "${adr.title}" is ${adr.lines} lines, over ${budget.maxAdrLines}. ${FIX[budget.name] ?? ""}`.trim(),
            );
  }
  return problems;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const contents = {};
  for (const file of BUDGETS.flatMap((budget) => budget.files))
    contents[file] = readFileSync(path.join(root, file), "utf8");
  const problems = checkBudgets(contents);
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exit(1);
  console.log("Docs are within their size limits.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main();
