import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { executeCleanup } from "../../scripts/cleanup/execute-cleanup.mjs";
import { fixtureHost } from "./cleanup-real-host.mjs";

try {
  const request = JSON.parse(fs.readFileSync(0, "utf8"));
  const recovery = await import(pathToFileURL(request.recoveryModule).href);
  const host = fixtureHost(request.fixture, { agent: request.agent, decision: "refuse" });
  const result = await executeCleanup(host.runtime, request.plan, request.selected, {
    verifyRecovery: recovery.verifyPreservedItem,
  });
  process.stdout.write(JSON.stringify({ result, newOwnerPrompts: host.requests.length }));
} catch {
  console.error("fixture_restart_failed");
  process.exitCode = 1;
}
