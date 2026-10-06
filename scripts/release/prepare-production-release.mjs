import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { collectPreflight } from "./preflight-contract.mjs";
import { createPreflightProbes } from "./preflight-probes.mjs";
import { inspectAuthorization } from "./release-authorization.mjs";
import { runReleaseStage } from "./release-stage-command.mjs";
import {
  readGate,
  readApproval,
  assertUnchanged,
  prepareRelease,
} from "./prepare-release-contract.mjs";
import { handoffCommands } from "./release-handoff-commands.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
if (!(
  [4, 5].includes(args.length) &&
  args[0] === "--candidate" &&
  /^[a-f0-9]{40}$/.test(args[1]) &&
  args[2] === "--pull-request" &&
  /^[1-9]\d*$/.test(args[3]) &&
  (args.length === 4 || args[4] === "--explicit-release")
)) {
  console.log(
    JSON.stringify({
      result: "failed",
      reason: "usage",
      usage:
        "npm run release:prepare -- --candidate <40-character lowercase SHA> --pull-request <number> [--explicit-release]",
      deployment_authorized: false,
    }),
  );
  process.exitCode = 2;
} else {
  const progress = (line) => process.stderr.write(line + "\n");
  const report = await prepareRelease(args[1], Number(args[3]), args.length === 5, {
    authorization: (sha, number) => inspectAuthorization(root, sha, number),
    confirm: async (sha) => {
      if (!process.stdin.isTTY || !process.stderr.isTTY) return false;
      const terminal = createInterface({ input: process.stdin, output: process.stderr });
      try {
        return (
          (await terminal.question(
            "Confirm the owner explicitly requested release and deployment of this candidate; type its full SHA: ",
          )) === sha
        );
      } finally {
        terminal.close();
      }
    },
    preflight: (sha) => collectPreflight(sha, createPreflightProbes(root, sha)),
    stage: (stage, sha, options) => runReleaseStage(root, stage, sha, { ...options, progress }),
    readGate: (file, sha, started) => readGate(root, file, sha, started),
    readApproval,
    unchanged: assertUnchanged,
    commands: (input) => handoffCommands(root, input),
    progress,
  });
  if (report.result === "prepared") {
    process.stderr.write(
      `Deployment command (separate execution):\n${report.commands.deployment}\n\nVerification command (after READY):\n${report.commands.verification}\n`,
    );
  }
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = ["prepared", "not_required"].includes(report.result) ? 0 : 1;
}
