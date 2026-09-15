import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) rmSync(file, { force: true });
});

function receipt(model: string, effort = "high") {
  const file = path.join(tmpdir(), `kut-receipt-${crypto.randomUUID()}.json`);
  files.push(file);
  writeFileSync(
    file,
    JSON.stringify({ provider: "codex", requested_model: model, reasoning_effort: effort }),
  );
  return file;
}

function run(model: string, receiptPath: string) {
  return spawnSync("node", [".codex/hooks/require-production-session.cjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: JSON.stringify({ model, session_id: "fictional-session" }),
    env: {
      ...process.env,
      KUT_PRODUCTION_SESSION: "1",
      KUT_PRODUCTION_SESSION_RECEIPT: receiptPath,
    },
  });
}

describe("production session hook", () => {
  it("attests an allowed Codex model", () => {
    const file = receipt("gpt-6-astra");
    const result = run("gpt-6-astra", file);
    expect(JSON.parse(result.stdout).hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(JSON.parse(readFileSync(file, "utf8"))).toMatchObject({
      observed_model: "gpt-6-astra",
      session_id: "fictional-session",
    });
  });

  it("stops a model mismatch", () => {
    const result = run("gpt-5.5", receipt("gpt-6-astra"));
    expect(JSON.parse(result.stdout)).toMatchObject({ continue: false });
  });

  it("stops unobservable reasoning evidence", () => {
    const result = run("gpt-5.6-sol", receipt("gpt-5.6-sol", "medium"));
    expect(JSON.parse(result.stdout)).toMatchObject({ continue: false });
  });
});
