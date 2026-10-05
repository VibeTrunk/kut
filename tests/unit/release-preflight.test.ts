import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assessBackup,
  assessChecks,
  assessLocalStack,
  classifyAccess,
  collectPreflight,
  REQUIRED_CHECKS,
} from "../../scripts/release/preflight-contract.mjs";
import { runReadOnly } from "../../scripts/release/preflight-command.mjs";
import { resolveVercelCli } from "../../scripts/release/vercel-cli.mjs";
import { createPreflightProbes } from "../../scripts/release/preflight-probes.mjs";

const sha = "a".repeat(40);
const now = Date.parse("2026-10-05T15:00:00Z");
const recent = "2026-10-05T14:00:00Z";
const secret = "fictional-private-value-do-not-emit";
const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function checks() {
  return {
    total_count: REQUIRED_CHECKS.length,
    check_runs: REQUIRED_CHECKS.map((name: string) => ({
      name,
      head_sha: sha,
      status: "completed",
      conclusion: "success",
      completed_at: recent,
    })),
  };
}
function backup() {
  return {
    created_at: recent,
    cold_verification: "passed",
    credential_locator: "backup-encryption-v1",
    plaintext_sha256: "b".repeat(64),
    backup_path: "fictional.sql.enc",
  };
}
function probes() {
  return Object.fromEntries(
    [
      "ordinary",
      "candidate_checkout",
      "github_ci",
      "vercel_access",
      "docker",
      "local_supabase",
      "backup_pointer",
      "dpapi_credentials",
      "central_catalogue",
      "port_3101",
    ].map((name) => [name, vi.fn(async () => "passed")]),
  ) as Record<string, ReturnType<typeof vi.fn>>;
}

describe("bounded read-only preflight", () => {
  it("accepts complete fresh prerequisites and reports each probe", async () => {
    const input = probes();
    const report = await collectPreflight(sha, input);
    expect(report.result).toBe("passed");
    expect(report.candidate_sha).toBe(sha);
    expect(report.checks).toHaveLength(10);
    for (const probe of Object.values(input)) expect(probe).toHaveBeenCalledOnce();
  });

  it("stops before service/credential probes on an ADR-128 refusal", async () => {
    const input = probes();
    input.ordinary.mockResolvedValue("checkout_invalid");
    const report = await collectPreflight(sha, input);
    expect(report.result).toBe("failed");
    expect(report.checks).toHaveLength(1);
    for (const [name, probe] of Object.entries(input))
      if (name !== "ordinary") expect(probe).not.toHaveBeenCalled();
  });

  it.each([
    "candidate_invalid",
    "checkout_dirty",
    "backup_stale",
    "stack_unavailable",
    "port_unavailable",
  ])("fails closed on an unmet requirement (%s)", async (reason) => {
    const input = probes();
    input.candidate_checkout.mockResolvedValue(reason);
    const report = await collectPreflight(sha, input);
    expect(report.result).toBe("failed");
    expect(report.checks[1].reason).toBe(reason);
    expect(report.checks[1].remedy).toBeTruthy();
  });

  it("never echoes private probe exceptions or unknown reasons", async () => {
    const input = probes();
    input.github_ci.mockRejectedValue(new Error(secret));
    input.vercel_access.mockResolvedValue(secret);
    const report = await collectPreflight(sha, input);
    expect(report.result).toBe("failed");
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(
      report.checks
        .slice(2, 4)
        .every((check: { reason: string }) => check.reason === "access_unverified"),
    ).toBe(true);
  });

  it("bounds a genuinely unresponsive child process", async () => {
    const start = Date.now();
    const response = await runReadOnly(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      timeoutMs: 200,
    });
    expect(response.timedOut).toBe(true);
    expect(Date.now() - start).toBeLessThan(3000);
  });

  it("buffers sensitive child output and exposes only fixed reasons in a report", async () => {
    const response = await runReadOnly(process.execPath, [
      "-e",
      `process.stderr.write(${JSON.stringify(secret)});process.exit(1)`,
    ]);
    expect(response.stderr).toBe(secret);
    const input = probes();
    input.github_ci.mockResolvedValue(classifyAccess(response));
    expect(JSON.stringify(await collectPreflight(sha, input))).not.toContain(secret);
  });

  it("fails safely for a missing executable", async () => {
    const response = await runReadOnly(path.join(os.tmpdir(), "kut-absent-preflight-cli"), []);
    expect(classifyAccess(response)).toBe("cli_unavailable");
  });
});

describe("access diagnosis", () => {
  it.each([
    [{ ok: true }, "passed"],
    [{ ok: false, timedOut: true }, "timed_out"],
    [{ ok: false, code: "EPERM" }, "network_denied"],
    [{ ok: false, stderr: "socket forbidden by its access permissions" }, "network_denied"],
    [{ ok: false, stderr: "connect ETIMEDOUT" }, "network_unavailable"],
    [{ ok: false, stderr: "getaddrinfo ENOTFOUND api.example.invalid" }, "network_unavailable"],
    [{ ok: false, stdout: '{"reason":"login_required"}' }, "login_required"],
    [{ ok: false, stderr: "token has expired" }, "login_expired"],
    [{ ok: false, stderr: "HTTP 401: Bad credentials" }, "authentication_rejected"],
    [{ ok: false, stderr: "authentication stage failed" }, "access_unverified"],
    [
      { ok: false, stdout: '{"reason":"verification_failed","stage":"authentication"}' },
      "access_unverified",
    ],
    [{ ok: false, stdout: secret, stderr: secret }, "access_unverified"],
    [
      {
        ok: false,
        stdout: '{"reason":"login_required"}',
        stderr: "connect EPERM permission denied",
      },
      "network_denied",
    ],
  ])("classifies evidence without exposing CLI data (%j)", (input, expected) => {
    expect(classifyAccess(input)).toBe(expected);
  });
});

describe("exact-SHA CI and backup pointer", () => {
  it("accepts all seven fresh successes and a fresh cold-verified pointer", () => {
    expect(assessChecks(checks(), sha, now)).toBe("passed");
    expect(assessBackup(backup(), () => true, now)).toBe("passed");
    expect(assessBackup({ ...backup(), plaintext_sha256: "B".repeat(64) }, () => true, now)).toBe(
      "passed",
    );
  });
  it.each(["skipped", "cancelled", "failure", null])("refuses CI conclusion %s", (conclusion) => {
    const data = checks();
    Object.assign(data.check_runs[0], { conclusion });
    expect(assessChecks(data, sha, now)).toBe("ci_incomplete");
  });
  it("refuses missing, duplicate, running, mismatched and partial CI", () => {
    let data = checks();
    data.check_runs.pop();
    data.total_count--;
    expect(assessChecks(data, sha, now)).toBe("ci_incomplete");
    data = checks();
    data.check_runs.push({ ...data.check_runs[0] });
    data.total_count++;
    expect(assessChecks(data, sha, now)).toBe("ci_incomplete");
    data = checks();
    data.check_runs[0].status = "in_progress";
    expect(assessChecks(data, sha, now)).toBe("ci_incomplete");
    data = checks();
    data.check_runs[0].head_sha = "c".repeat(40);
    expect(assessChecks(data, sha, now)).toBe("ci_incomplete");
    data = checks();
    data.total_count = 101;
    expect(assessChecks(data, sha, now)).toBe("ci_incomplete");
  });
  it.each(["2026-10-02T14:59:59Z", "2026-10-05T15:00:01Z", "garbage", "2026-10-05T14:00:00"])(
    "refuses stale/future/unzoned CI timestamp %s",
    (completed_at) => {
      const data = checks();
      data.check_runs[0].completed_at = completed_at;
      expect(assessChecks(data, sha, now)).toBe("ci_stale");
    },
  );
  it.each(["2026-10-04T14:59:59Z", "2026-10-05T15:00:01Z", "garbage"])(
    "refuses stale/future/malformed backup timestamp %s",
    (created_at) => {
      expect(assessBackup({ ...backup(), created_at }, () => true, now)).toBe("backup_stale");
    },
  );
  it("uses the gate's inclusive 24-hour/72-hour boundaries", () => {
    const data = checks();
    data.check_runs[0].completed_at = "2026-10-02T15:00:00Z";
    expect(assessChecks(data, sha, now)).toBe("passed");
    expect(assessBackup({ ...backup(), created_at: "2026-10-04T15:00:00Z" }, () => true, now)).toBe(
      "passed",
    );
  });
  it("refuses absent ciphertext, wrong locators and absent cold verification/hash", () => {
    expect(assessBackup(backup(), () => false, now)).toBe("backup_incomplete");
    for (const change of [
      { credential_locator: "other" },
      { cold_verification: "pending" },
      { plaintext_sha256: "" },
    ])
      expect(assessBackup({ ...backup(), ...change }, () => true, now)).toBe("backup_incomplete");
    expect(assessBackup(null, () => true, now)).toBe("backup_incomplete");
  });
  it("keeps the required check list aligned with the production gate", () => {
    const gate = readFileSync("scripts/release/request-production-gate.ps1", "utf8");
    const names = gate
      .match(/\$requiredChecks = @\(([^)]+)\)/)?.[1]
      .match(/'([^']+)'/g)
      ?.map((name) => name.slice(1, -1));
    expect(names).toEqual(REQUIRED_CHECKS);
  });
});

describe("local Supabase status", () => {
  const local = {
    API_URL: "http://127.0.0.1:54321",
    DB_URL: "postgresql://fictional@localhost:54322/postgres",
    ANON_KEY: secret,
    SERVICE_ROLE_KEY: secret,
  };
  it("accepts loopback metadata without returning its credentials", () => {
    expect(assessLocalStack(local)).toBe("passed");
  });
  it("refuses incomplete, hosted, malformed and wrong-protocol targets", () => {
    expect(assessLocalStack({ ...local, SERVICE_ROLE_KEY: "" })).toBe("stack_unavailable");
    for (const API_URL of [
      "https://hosted.example",
      "http://127.0.0.1.example",
      "file://localhost",
      "bad",
    ])
      expect(assessLocalStack({ ...local, API_URL })).toBe("local_target_invalid");
  });
});

describe("shared installed Vercel CLI discovery", () => {
  it("reuses a validated installed CLI and refuses runtime/version drift", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "kut-preflight-vercel-"));
    scratch.push(root);
    const pkg = path.join(root, "node_modules/vercel");
    mkdirSync(path.join(pkg, "dist"), { recursive: true });
    const cli = path.join(pkg, "dist/vc.js");
    writeFileSync(cli, "// fictional executable; never run\n");
    const metadata = { name: "vercel", version: "59.23.2", bin: { vercel: "./dist/vc.js" } };
    writeFileSync(path.join(pkg, "package.json"), JSON.stringify(metadata));
    expect(resolveVercelCli(root, { NODE_ENV: "test" })).toBe(cli);
    writeFileSync(
      path.join(pkg, "package.json"),
      JSON.stringify({ ...metadata, version: "0.0.0" }),
    );
    expect(() => resolveVercelCli(root, { NODE_ENV: "test" })).toThrow("cli_unavailable");
  });
});

describe("preflight probe wiring without service mutations", () => {
  function fixture() {
    const root = mkdtempSync(path.join(os.tmpdir(), "kut-preflight-probes-"));
    scratch.push(root);
    const central = path.join(root, "central");
    mkdirSync(central);
    const cli = path.join(root, "node_modules/vercel/dist/vc.js");
    mkdirSync(path.dirname(cli), { recursive: true });
    writeFileSync(cli, "// fixture, never executed");
    writeFileSync(
      path.join(root, "node_modules/vercel/package.json"),
      JSON.stringify({
        name: "vercel",
        version: "59.23.2",
        bin: { vercel: "./dist/vc.js" },
      }),
    );
    const platform = process.platform === "win32" ? "windows" : process.platform;
    const binary = path.join(
      root,
      `node_modules/@supabase/cli-${platform}-${process.arch}/bin`,
      `supabase${process.platform === "win32" ? ".exe" : ""}`,
    );
    mkdirSync(path.dirname(binary), { recursive: true });
    writeFileSync(binary, "fixture, never executed");
    mkdirSync(path.join(root, ".private-backups"));
    const ciphertext = path.join(root, ".private-backups/fixture.enc");
    writeFileSync(ciphertext, "fictional ciphertext");
    writeFileSync(
      path.join(root, ".private-backups/latest-backup-evidence.json"),
      JSON.stringify({
        ...backup(),
        created_at: new Date(Date.now() - 60_000).toISOString(),
        backup_path: ciphertext,
      }),
    );
    const services = Array.from({ length: 5 }, () =>
      JSON.stringify({
        Running: true,
        Paused: false,
        Restarting: false,
        Health: { Status: "healthy" },
      }),
    ).join("\n");
    const calls: { file: string; args: string[] }[] = [];
    const responses: Record<string, { ok: boolean; stdout: string; stderr?: string }> = {
      head: { ok: true, stdout: sha },
      status: { ok: true, stdout: "" },
      github: {
        ok: true,
        stdout: JSON.stringify({
          ...checks(),
          check_runs: checks().check_runs.map((check) => ({
            ...check,
            completed_at: new Date(Date.now() - 60_000).toISOString(),
          })),
        }),
      },
      whoami: { ok: true, stdout: secret },
      project: { ok: true, stdout: '{"name":"kut","id":"prj_fixture"}' },
      docker: { ok: true, stdout: "fictional-version" },
      services: { ok: true, stdout: services },
      supabase: {
        ok: true,
        stdout: JSON.stringify({
          API_URL: "http://127.0.0.1:54321",
          DB_URL: "postgresql://fictional@localhost:54322/postgres",
          ANON_KEY: secret,
          SERVICE_ROLE_KEY: secret,
        }),
      },
      credentials: { ok: true, stdout: '{"result":"passed"}' },
      catalogue: { ok: true, stdout: '{"result":"passed"}' },
    };
    const execute = async (file: string, args: string[]) => {
      calls.push({ file, args });
      if (file === "git") {
        if (args.includes("--git-common-dir"))
          return { ok: true, stdout: `${root}/.git\n${root}/.git` };
        if (args.includes("--show-toplevel")) return { ok: true, stdout: central };
        if (args.includes("HEAD")) return responses.head;
        if (args.includes("status")) return responses.status;
      }
      if (file === "gh" && args[0] === "api") return responses.github;
      if (file === process.execPath && args[0] === cli) {
        if (args[1] === "whoami") return responses.whoami;
        if (args[1] === "api" && args.includes("GET")) return responses.project;
      }
      if (file === "docker" && args[0] === "version") return responses.docker;
      if (file === "docker" && args[0] === "inspect") return responses.services;
      if (file === binary && args.join(" ") === "status -o json") return responses.supabase;
      if (file === "powershell") {
        if (args.some((arg) => arg.endsWith("preflight-credentials.ps1")))
          return responses.credentials;
        if (args.some((arg) => arg.endsWith("test-catalogue-parity.ps1")))
          return responses.catalogue;
      }
      throw new Error("Unexpected probe command");
    };
    const input = createPreflightProbes(root, sha, {
      execute,
      env: { NODE_ENV: "test", KUT_CENTRAL_SUPABASE_REPO: central },
    });
    // Actual port refusal/free behavior is covered by production-e2e.test.ts.
    // Do not depend on the owner's real 3101 listener in this wiring fixture.
    input.port_3101 = async () => "passed";
    // The DPAPI transport exists only on Windows; the Windows path above is
    // exercised there. Other platforms still test all portable probe wiring.
    if (process.platform !== "win32") input.dpapi_credentials = async () => "passed";
    return { input, calls, responses };
  }

  it("passes the complete wired path with private CLI/backup fixtures", async () => {
    const { input, calls } = fixture();
    const report = await collectPreflight(sha, input);
    expect(report.result).toBe("passed");
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(calls.length).toBeGreaterThan(0);
    expect(JSON.stringify(calls)).not.toContain(secret);
  });

  it.each([
    ["head", { ok: true, stdout: "c".repeat(40) }, "candidate_invalid"],
    ["status", { ok: true, stdout: " M fictional.txt" }, "checkout_dirty"],
    ["github", { ok: false, stdout: "", stderr: "permission denied" }, "network_denied"],
    [
      "whoami",
      { ok: false, stdout: "", stderr: "authentication stage failed" },
      "access_unverified",
    ],
    ["project", { ok: true, stdout: '{"name":"wrong","id":"prj_fixture"}' }, "access_unverified"],
    ["services", { ok: true, stdout: '{"Running":false}' }, "stack_unavailable"],
    ["supabase", { ok: true, stdout: secret }, "invalid_evidence"],
    ["catalogue", { ok: false, stdout: "", stderr: secret }, "catalogue_mismatch"],
  ])("refuses a failing wired probe (%s)", async (name, response, reason) => {
    const { input, responses } = fixture();
    responses[name as string] = response as { ok: boolean; stdout: string };
    const report = await collectPreflight(sha, input);
    expect(report.result).toBe("failed");
    expect(report.checks.some((check: { reason: string }) => check.reason === reason)).toBe(true);
    expect(JSON.stringify(report)).not.toContain(secret);
  });
});
