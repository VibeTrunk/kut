#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { evaluateMigrationPolicy, parseNameStatusZ } from "./migration-policy.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const base = valueAfter("--base");
if (!base) {
  console.error("Usage: node scripts/policy/check-migration-policy.mjs --base <git-ref>");
  process.exit(2);
}

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const exemptionsPath = path.join(root, "policy", "migration-test-exemptions.json");
const exemptions = JSON.parse(readFileSync(exemptionsPath, "utf8"));
const diff = execFileSync(
  "git",
  ["diff", "--name-status", "-z", "--find-renames", `${base}...HEAD`],
  { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
);
const changes = parseNameStatusZ(diff);
const result = evaluateMigrationPolicy(changes, exemptions);

if (result.errors.length) {
  for (const error of result.errors) console.error(`::error::${error}`);
  process.exit(1);
}

console.log(
  result.added.length === 0
    ? "Migration policy passed: no migration added or altered."
    : `Migration policy passed: ${result.added[0]} is isolated and tested/exempted.`,
);
