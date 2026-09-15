#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseDotenv, validateBootstrapValues } from "./lib/dotenv.mjs";

if (!process.argv.includes("--from-env-local") || !process.argv.includes("--confirm-import")) {
  console.error(
    "Refusing implicit secret import. Re-run with --from-env-local --confirm-import [--replace].",
  );
  process.exit(2);
}
if (process.platform !== "win32") {
  console.error("The KUT credential bootstrap requires Windows DPAPI.");
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const values = validateBootstrapValues(
  parseDotenv(readFileSync(path.join(root, ".env.local"), "utf8")),
);
const worker = path.join(root, "scripts", "internal", "store-kut-credential.ps1");
const replace = process.argv.includes("--replace");

for (const item of values) {
  const args = ["-NoProfile", "-File", worker, "-Locator", item.locator];
  if (replace) args.push("-Replace");
  const result = spawnSync("powershell.exe", args, {
    input: item.value,
    stdio: ["pipe", "inherit", "inherit"],
  });
  item.value = "";
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Bootstrap complete. Runtime scripts will use locators, never .env.local.");
