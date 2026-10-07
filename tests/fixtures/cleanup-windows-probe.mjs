// Only fresh disposable repositories. Never accepts a target path from argv.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { newFixture, disposeFixture } from "../../scripts/cleanup/fixture-executor.mjs";

const parent = path.resolve(".release-evidence/cleanup-enablement-local-20261007");
const fixture = newFixture({ parent });
const result = spawnSync("git", ["worktree", "remove", "--", fixture.targets[0]], {
  cwd: fixture.root,
  windowsHide: true,
  timeout: 30000,
  stdio: "pipe",
});
const record = {
  kind: "disposable-onedrive-normal-git",
  base: fixture.base,
  exitCode: result.status,
  errorCode: result.error?.code ?? null,
  stderr: result.stderr?.toString(),
  targetExists: fs.existsSync(fixture.targets[0]),
};
fs.writeFileSync(
  path.join(parent, "windows-disposable-probe.json"),
  JSON.stringify(record, null, 2),
  { flag: "wx" },
);
if (result.status === 0) disposeFixture(fixture);
// Preserve a failed probe intact. Never use a second interpreter as fallback.
console.log(
  JSON.stringify({
    exitCode: record.exitCode,
    targetExists: record.targetExists,
    failurePreserved: result.status !== 0,
  }),
);
