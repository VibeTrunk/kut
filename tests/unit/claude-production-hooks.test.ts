import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) rmSync(file, { force: true });
});

function receipt() {
  const file = path.join(tmpdir(), `kut-claude-receipt-${crypto.randomUUID()}.json`);
  files.push(file);
  writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      provider: "claude",
      requested_model: "opus",
      reasoning_effort: "vendor-managed",
    }),
  );
  return file;
}

function run(hook: string, payload: unknown, receiptPath: string | null, production = true) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.KUT_PRODUCTION_SESSION;
  delete env.KUT_PRODUCTION_SESSION_RECEIPT;
  if (production) env.KUT_PRODUCTION_SESSION = "1";
  if (receiptPath) env.KUT_PRODUCTION_SESSION_RECEIPT = receiptPath;
  return spawnSync("node", [`.claude/hooks/${hook}`], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: JSON.stringify(payload),
    env,
  });
}

function readReceipt(file: string) {
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("Claude SessionStart attestation", () => {
  it("does nothing outside a production session", () => {
    const result = run("require-production-session.cjs", { model: "claude-sonnet-5" }, null, false);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("records a verified Opus model", () => {
    const file = receipt();
    const result = run(
      "require-production-session.cjs",
      { model: "claude-opus-5", session_id: "fictional-session", permission_mode: "default" },
      file,
    );
    expect(JSON.parse(result.stdout).hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(readReceipt(file)).toMatchObject({
      observed_model: "claude-opus-5",
      model_attestation: "hook",
      session_id: "fictional-session",
    });
  });

  // The documented behaviour is that Claude Code "doesn't always include"
  // model on SessionStart. The hook must stay usable, and must say so honestly
  // in the receipt rather than claiming an attestation it never made.
  it("records an absent model as unavailable instead of failing the session", () => {
    const file = receipt();
    const result = run(
      "require-production-session.cjs",
      { session_id: "fictional-session", hook_event_name: "SessionStart", source: "startup" },
      file,
    );
    expect(result.status).toBe(0);
    const record = readReceipt(file);
    expect(record.model_attestation).toBe("unavailable");
    expect(record.observed_model).toBeNull();
    expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain(
      "enforced by the launcher",
    );
  });

  it("marks a non-Opus model rejected so the gate refuses it", () => {
    const file = receipt();
    const result = run("require-production-session.cjs", { model: "claude-haiku-4-5" }, file);
    expect(readReceipt(file).model_attestation).toBe("rejected");
    expect(JSON.parse(result.stdout).systemMessage).toContain("not an Opus model");
  });

  it("warns when the receipt is unreadable", () => {
    const result = run(
      "require-production-session.cjs",
      { model: "claude-opus-5" },
      path.join(tmpdir(), "kut-missing-receipt.json"),
    );
    expect(JSON.parse(result.stdout).systemMessage).toContain("missing or unreadable");
  });
});

describe("Claude PreModelSwitch guard", () => {
  it("ignores switches outside a production session", () => {
    const result = run(
      "guard-production-model-switch.cjs",
      { to_model: "claude-haiku-4-5" },
      null,
      false,
    );
    expect(result.status).toBe(0);
  });

  // Exit code 2 is what actually denies a PreModelSwitch.
  it("denies a downgrade with exit code 2", () => {
    const result = run(
      "guard-production-model-switch.cjs",
      { from_model: "claude-opus-5", to_model: "claude-sonnet-5" },
      receipt(),
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("refusing to switch");
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("denies a switch whose target model is missing", () => {
    const result = run("guard-production-model-switch.cjs", { from_model: "x" }, receipt());
    expect(result.status).toBe(2);
  });

  it("allows an Opus-to-Opus switch and re-points the receipt", () => {
    const file = receipt();
    const result = run(
      "guard-production-model-switch.cjs",
      { from_model: "claude-opus-4-6", to_model: "claude-opus-5" },
      file,
    );
    expect(result.status).toBe(0);
    expect(readReceipt(file)).toMatchObject({
      observed_model: "claude-opus-5",
      model_attestation: "hook",
    });
  });
});
