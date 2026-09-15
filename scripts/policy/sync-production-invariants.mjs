#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = path.join(root, "policy", "PRODUCTION_INVARIANTS.md");
const targets = [path.join(root, "AGENTS.md"), path.join(root, "CLAUDE.md")];
const begin = "<!-- BEGIN:KUT-PRODUCTION-INVARIANTS -->";
const end = "<!-- END:KUT-PRODUCTION-INVARIANTS -->";

function normalize(value) {
  return value.replace(/\r\n/g, "\n");
}

const source = normalize(readFileSync(sourcePath, "utf8")).trim();
const expected = `${begin}\n${source}\n${end}`;
const write = process.argv.includes("--write");
let failed = false;

for (const target of targets) {
  const original = readFileSync(target, "utf8");
  const content = normalize(original);
  const start = content.indexOf(begin);
  const finish = content.indexOf(end);
  if (start === -1 || finish === -1 || finish < start) {
    console.error(`${path.basename(target)} is missing the generated production-invariants block.`);
    failed = true;
    continue;
  }
  const actual = content.slice(start, finish + end.length);
  if (actual === expected) continue;
  if (!write) {
    console.error(`${path.basename(target)} has drifted from ${path.relative(root, sourcePath)}.`);
    failed = true;
    continue;
  }
  const updated = `${content.slice(0, start)}${expected}${content.slice(finish + end.length)}`;
  writeFileSync(target, original.includes("\r\n") ? updated.replace(/\n/g, "\r\n") : updated);
  console.log(`Updated ${path.basename(target)}.`);
}

if (failed) {
  console.error("Run: npm run policy:sync");
  process.exit(1);
}
if (!write) console.log("Production invariant copies are byte-identical.");
