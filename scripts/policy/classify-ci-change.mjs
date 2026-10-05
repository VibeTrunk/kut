#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import process from "node:process";
import { isDocsOnlyChange } from "./ci-change-policy.mjs";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1];
};
let base = argument("--base");
if (!base || /^0+$/.test(base)) base = "HEAD^";
const event = argument("--event") || process.env.GITHUB_EVENT_NAME || "";
const changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);
const docsOnly = isDocsOnlyChange({ event, changed });
const output = `docs_only=${docsOnly}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
else process.stdout.write(output);
