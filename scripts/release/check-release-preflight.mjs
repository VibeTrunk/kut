import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectPreflight } from "./preflight-contract.mjs";
import { createPreflightProbes } from "./preflight-probes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const candidate = args.length === 2 && args[0] === "--candidate" ? args[1] : null;
if (!/^[a-f0-9]{40}$/.test(candidate ?? "")) {
  console.error(
    "Usage: node scripts/release/check-release-preflight.mjs --candidate <40-character lowercase SHA>",
  );
  process.exit(2);
}

const started = Date.now();
try {
  const report = await collectPreflight(candidate, createPreflightProbes(root, candidate));
  console.log(
    JSON.stringify(
      {
        ...report,
        elapsed_ms: Date.now() - started,
        backup_recovery_proof: "full_gate_required",
        release_approval: "not_granted",
        deployment_authorized: false,
      },
      null,
      2,
    ),
  );
  process.exitCode = report.result === "passed" ? 0 : 1;
} catch {
  console.log(
    JSON.stringify({
      candidate_sha: candidate,
      result: "failed",
      reason: "access_unverified",
      elapsed_ms: Date.now() - started,
      deployment_authorized: false,
    }),
  );
  process.exitCode = 1;
}
