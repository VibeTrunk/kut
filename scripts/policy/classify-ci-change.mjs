#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import process from "node:process";

const baseIndex = process.argv.indexOf("--base");
let base = baseIndex === -1 ? "" : process.argv[baseIndex + 1];
if (!base || /^0+$/.test(base)) base = "HEAD^";
const changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);
const docsOnly =
  changed.length > 0 && changed.every((file) => file.endsWith(".md") || file.startsWith("docs/"));
const output = `docs_only=${docsOnly}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
else process.stdout.write(output);
