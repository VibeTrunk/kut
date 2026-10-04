import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("rejects tampered, reused-server, retried, stale and SHA-mismatched release evidence", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const directory = mkdtempSync(path.join(os.tmpdir(), "kut-fictional-evidence-"));
  try {
    const result = spawnSync(
      process.platform === "win32" ? "powershell.exe" : "pwsh",
      ["-NoProfile", "-File", path.join(root, "tests/fixtures/production-evidence.ps1")],
      {
        encoding: "utf8",
        env: { ...process.env, KUT_TEST_EVIDENCE_DIR: directory, KUT_TEST_REPO: root },
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("11 scenarios passed");
  } finally {
    for (const name of readdirSync(directory)) unlinkSync(path.join(directory, name));
    rmdirSync(directory);
  }
}, 30_000);
