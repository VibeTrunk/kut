import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runBufferedChild } from "../../scripts/release/production-e2e-child.mjs";
import { createRunnerProgress } from "../../scripts/release/production-e2e-progress.mjs";
import { validateReleaseReport } from "../../scripts/release/production-e2e-contract.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const directory = process.argv[2];
const progress = createRunnerProgress();
const run = (cli, args, name, onProgress) =>
  runBufferedChild({
    root: directory,
    cli,
    args,
    env: process.env,
    logPath: path.join(directory, `${name}.log`),
    secretValues: ["fictional-private-output"],
    onProgress,
  });
let result = "failed";
try {
  await run(
    path.join(root, "node_modules/playwright/cli.js"),
    ["test", "--list", "--config", path.join(directory, "inventory.config.mjs")],
    "inventory",
  );
  progress.buildStarted();
  await run(path.join(directory, "build.mjs"), [], "build");
  progress.buildDone();
  await run(
    path.join(root, "node_modules/playwright/cli.js"),
    ["test", "--config", path.join(directory, "run.config.mjs")],
    "tests",
    progress.project,
  );
  const report = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"));
  const inventory = JSON.parse(await readFile(path.join(directory, "inventory.json"), "utf8"));
  validateReleaseReport(report, inventory);
  result = "passed";
} catch {
  process.exitCode = 1;
}
console.log(JSON.stringify({ result }));
