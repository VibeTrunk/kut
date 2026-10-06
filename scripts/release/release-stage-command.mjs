import { spawn } from "node:child_process";
import path from "node:path";

export const safeReleaseProgress = (line) =>
  /^\[production-e2e\] stage=production-build event=(started elapsed_ms=\d+|done elapsed_ms=\d+ stage_elapsed_ms=\d+)$/.test(
    line,
  ) ||
  /^\[production-e2e\] stage=authenticated-e2e project=authenticated-(pixel7|320|webkit) event=(started|done|stopped) elapsed_ms=\d+ project_elapsed_ms=\d+ passed=\d+ finished=\d+ total=\d+$/.test(
    line,
  );

/**
 * @param {string} root
 * @param {string} stage
 * @param {string} sha
 * @param {{gate?: string, approvedBy?: string, progress?: (line: string) => void, powerShell?: string}} options
 */
export function runReleaseStage(
  root,
  stage,
  sha,
  {
    gate,
    approvedBy,
    progress = () => {},
    powerShell = process.platform === "win32" ? "powershell.exe" : "pwsh",
  } = {},
) {
  return new Promise((resolve, reject) => {
    const args = [
      "-NoProfile",
      "-File",
      path.join(root, "scripts/release/invoke-release-stage.ps1"),
      "-Stage",
      stage,
      "-CandidateSha",
      sha,
    ];
    if (gate) args.push("-GateManifest", gate);
    if (approvedBy) args.push("-ApprovedBy", approvedBy);
    const child = spawn(powerShell, args, {
      cwd: root,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "",
      pending = "",
      unexpected = false,
      bytes = 0;
    // Existing gate/runner deadlines still own the expensive work; this adapter
    // adds no retry or shortened deadline that could interrupt fixture cleanup.
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes <= 1024 * 1024) stdout += chunk.toString();
      else unexpected = true;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      pending += chunk;
      let end;
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end).replace(/\r$/, "");
        pending = pending.slice(end + 1);
        if (safeReleaseProgress(line)) progress(line);
        else unexpected = true;
      }
      if (pending.length > 4096) {
        unexpected = true;
        pending = "";
      }
    });
    child.on("error", () => reject(new Error("stage_failed")));
    child.stdin.on("error", () => {}); // An early rejected child may close stdin.
    child.stdin.end(stage === "approval" ? sha + "\n" : "");
    child.on("close", (code) => {
      if (code !== 0 || unexpected || pending) return reject(new Error("stage_failed"));
      try {
        const result = JSON.parse(stdout.replace(/^\uFEFF/, ""));
        if (result.result !== "passed" || result.candidate_sha !== sha) throw Error();
        resolve(result);
      } catch {
        reject(new Error("stage_invalid"));
      }
    });
  });
}
