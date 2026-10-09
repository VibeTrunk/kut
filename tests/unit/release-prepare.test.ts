import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import {
  prepareRelease,
  readGate,
  readApproval,
  assertUnchanged,
  evidenceHash,
} from "../../scripts/release/prepare-release-contract.mjs";
import {
  validateOwnerMerge,
  documentationOnly,
  inspectAuthorization,
} from "../../scripts/release/release-authorization.mjs";
import { handoffCommands, nodeCommand } from "../../scripts/release/release-handoff-commands.mjs";
import { runReleaseStage } from "../../scripts/release/release-stage-command.mjs";

it("executes emitted commands against fictional services and refuses tampering before the external create step", () => {
  const dir = temp(),
    scripts = path.join(dir, "scripts/release");
  mkdirSync(scripts, { recursive: true });
  const gateFile = path.join(dir, "gate.json"),
    approvalFile = path.join(dir, "approval.json");
  writeFileSync(gateFile, "fictional gate");
  writeFileSync(approvalFile, "fictional approval");
  const auth = authorization(),
    gate = { path: gateFile, hash: evidenceHash(readFileSync(gateFile)) },
    approval = { path: approvalFile, hash: evidenceHash(readFileSync(approvalFile)) };
  const log = path.join(dir, "operations.jsonl");
  writeFileSync(
    path.join(scripts, "release-authorization.mjs"),
    `export async function inspectAuthorization(){return ${JSON.stringify(auth)};}`,
  );
  writeFileSync(
    path.join(scripts, "prepare-release-contract.mjs"),
    `export {assertUnchanged} from ${JSON.stringify(pathToFileURL(path.join(root, "scripts/release/prepare-release-contract.mjs")).href)};`,
  );
  writeFileSync(
    path.join(scripts, "release-stage-command.mjs"),
    `import {appendFileSync} from 'node:fs';export async function runReleaseStage(){appendFileSync(${JSON.stringify(log)},'assertion\\n');}`,
  );
  const cli = path.join(dir, "fictional-vercel.mjs");
  writeFileSync(
    path.join(scripts, "vercel-cli.mjs"),
    `export function resolveVercelCli(){return ${JSON.stringify(cli)};}`,
  );
  writeFileSync(
    cli,
    `import {readFileSync,appendFileSync} from 'node:fs';
const endpoint=process.argv[3];
if(endpoint==='/v9/projects/kut') console.log(JSON.stringify({id:'prj_26aP5n78r1uCGWZBWiTw1HeO0yKp',name:'kut',link:{type:'github',repoId:1335996257,org:'VibeTrunk',repo:'kut'},privateValue:${JSON.stringify(privateValue)}}));
else if(endpoint.startsWith('/v13/deployments?')){const request=JSON.parse(readFileSync(0,'utf8'));if(request.gitSource.sha!==${JSON.stringify(sha)}||request.gitSource.ref!==${JSON.stringify(sha)}||request.gitSource.type!=='github'||request.target!=='production')process.exit(1);appendFileSync(${JSON.stringify(log)},'POST\\n');console.log(JSON.stringify({id:'dpl_fictional',target:'production',privateValue:${JSON.stringify(privateValue)}}));}
else process.exit(1);`,
  );
  writeFileSync(
    path.join(scripts, "check-vercel-deployment.mjs"),
    `console.log(JSON.stringify({result:'candidate_live',candidate_sha:${JSON.stringify(sha)},candidate_lookup_complete:true,legacy_redirect:{verified:true,status:307}}));`,
  );
  const commands = handoffCommands(dir, { sha, authorization: auth, gate, approval });
  const invoke = (command: string) => {
    const file = path.join(dir, "command.ps1");
    writeFileSync(file, command);
    return spawnSync(
      process.platform === "win32" ? "powershell.exe" : "pwsh",
      ["-NoProfile", "-File", file],
      { encoding: "utf8", timeout: 15000 },
    );
  };
  const deployed = invoke(commands.deployment);
  expect(deployed.status, deployed.stderr).toBe(0);
  expect(JSON.parse(deployed.stdout).deployment_id).toBe("dpl_fictional");
  expect(deployed.stdout + deployed.stderr).not.toContain(privateValue);
  expect(readFileSync(log, "utf8")).toBe("assertion\nPOST\n");
  const verified = invoke(commands.verification);
  expect(verified.status, verified.stderr).toBe(0);
  expect(JSON.parse(verified.stdout).candidate_sha).toBe(sha);
  writeFileSync(gateFile, "tampered");
  const refused = invoke(commands.deployment);
  expect(refused.status).not.toBe(0);
  expect(readFileSync(log, "utf8")).toBe("assertion\nPOST\n");
  writeFileSync(
    path.join(scripts, "check-vercel-deployment.mjs"),
    `console.log(JSON.stringify({result:'candidate_not_live',candidate_sha:${JSON.stringify(sha)},candidate_lookup_complete:true,legacy_redirect:{verified:true,status:307}}));`,
  );
  expect(invoke(commands.verification).status).not.toBe(0);
  // The candidate is live, but the legacy host does not redirect to the new one.
  writeFileSync(
    path.join(scripts, "check-vercel-deployment.mjs"),
    `console.log(JSON.stringify({result:'candidate_live',candidate_sha:${JSON.stringify(sha)},candidate_lookup_complete:true,legacy_redirect:{verified:false,reason:'unexpected_status',status:200}}));`,
  );
  expect(invoke(commands.verification).status).not.toBe(0);
}, 30000);

const sha = "a".repeat(40),
  other = "b".repeat(40),
  privateValue = "fictional-secret-must-stay-private";
const root = path.resolve(import.meta.dirname, "../..");
const scratch: string[] = [];
function temp() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kut-prepare-fictional-"));
  scratch.push(dir);
  return dir;
}
// Only exact fixture files/directories under the unique temporary root are removed.
function remove(dir: string) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, name.name);
    if (name.isDirectory()) remove(file);
    else unlinkSync(file);
  }
  rmdirSync(dir);
}
afterEach(() => scratch.splice(0).forEach(remove));
function authorization() {
  return {
    source: "owner_merge",
    candidate_sha: sha,
    approved_by: "MartinFloris",
    pull_request: 202,
    merged_at: new Date(Date.now() - 1000).toISOString(),
    documentation_only: false,
    parent_sha: other,
  };
}
const checkNames = [
  "ordinary_checkout",
  "candidate_checkout",
  "github_ci",
  "vercel_access",
  "docker",
  "local_supabase",
  "backup_pointer",
  "dpapi_credentials",
  "central_catalogue",
  "port_3101",
];
function services() {
  const auth = authorization();
  return {
    authorization: vi.fn(async () => auth),
    confirm: vi.fn(async () => true),
    preflight: vi.fn(async () => ({
      result: "passed",
      candidate_sha: sha,
      checks: checkNames.map((name) => ({ name, result: "passed", reason: "passed" })),
    })),
    stage: vi.fn(async (stage: string, candidate: string) => ({
      result: "passed",
      candidate_sha: candidate,
      ...(stage === "gate" ? { gate_manifest: "fictional-gate" } : {}),
    })),
    readGate: vi.fn(async () => ({
      path: "fictional-gate",
      hash: "1".repeat(64),
      created_at: new Date().toISOString(),
    })),
    readApproval: vi.fn(async () => ({ path: "fictional-approval", hash: "2".repeat(64) })),
    unchanged: vi.fn(async () => {}),
    commands: vi.fn(async () => ({ deployment: "fictional", verification: "fictional" })),
    progress: vi.fn(),
  };
}
it("chains preflight, one full gate, authorized approval and assertion with the same exact candidate", async () => {
  const s = services();
  const r = await prepareRelease(sha, 202, false, s);
  expect(r.result).toBe("prepared");
  expect(r.deployment_performed).toBe(false);
  expect(s.stage.mock.calls.map((c) => c[0])).toEqual(["gate", "approval", "assertion"]);
  for (const call of s.stage.mock.calls) expect(call[1]).toBe(sha);
  expect(s.stage.mock.invocationCallOrder[0]).toBeGreaterThan(
    s.preflight.mock.invocationCallOrder[0],
  );
  expect(s.commands.mock.invocationCallOrder[0]).toBeGreaterThan(
    s.stage.mock.invocationCallOrder[2],
  );
  expect(s.authorization).toHaveBeenCalledTimes(2);
});
it.each(["preflight", "gate", "approval", "assertion"] as const)(
  "stops immediately on %s failure and prints no deployment command",
  async (failing) => {
    const s = services();
    if (failing === "preflight") s.preflight.mockRejectedValue(Error(privateValue));
    else
      s.stage.mockImplementation(async (stage) => {
        if (stage === failing) throw Error(privateValue);
        return { result: "passed", candidate_sha: sha, gate_manifest: "fictional-gate" };
      });
    const r = await prepareRelease(sha, 202, false, s);
    expect(r.result).toBe("failed");
    expect("stage" in r ? r.stage : null).toBe(failing);
    expect(JSON.stringify(r)).not.toContain(privateValue);
    expect(s.commands).not.toHaveBeenCalled();
    expect(s.stage.mock.calls.map((c) => c[0])).toEqual(
      ["gate", "approval", "assertion"].slice(
        0,
        failing === "preflight" ? 0 : ["gate", "approval", "assertion"].indexOf(failing) + 1,
      ),
    );
  },
);
it.each(["absent", "mismatch", "skipped", "cancelled", "stale", "tampered"])(
  "refuses %s evidence without approval or command output",
  async (mode) => {
    const s = services();
    if (mode === "absent") s.stage.mockResolvedValue(undefined as never);
    else if (mode === "mismatch")
      s.stage.mockResolvedValue({
        result: "passed",
        candidate_sha: other,
        gate_manifest: "fictional-gate",
      });
    else if (["skipped", "cancelled"].includes(mode))
      s.stage.mockResolvedValue({
        result: mode,
        candidate_sha: sha,
        gate_manifest: "fictional-gate",
      });
    else if (mode === "stale") s.readGate.mockRejectedValue(Error("gate_invalid"));
    else s.unchanged.mockRejectedValue(Error("evidence_changed"));
    expect((await prepareRelease(sha, 202, false, s)).result).toBe("failed");
    expect(s.stage.mock.calls.some((c) => c[0] === "approval")).toBe(false);
    expect(s.commands).not.toHaveBeenCalled();
  },
);
it("refuses newer main or changed authorization after the gate, without switching candidates", async () => {
  const s = services();
  s.authorization
    .mockResolvedValueOnce(authorization())
    .mockRejectedValueOnce(Error("authorization_invalid"));
  const r = await prepareRelease(sha, 202, false, s);
  expect(r.result).toBe("failed");
  expect(r.candidate_sha).toBe(sha);
  expect(s.stage.mock.calls.map((c) => c[0])).toEqual(["gate"]);
});
it("honors docs-only exception and requires explicit per-change confirmation for a requested docs release", async () => {
  const s = services();
  s.authorization.mockResolvedValue({ ...authorization(), documentation_only: true });
  expect((await prepareRelease(sha, 202, false, s)).result).toBe("not_required");
  expect(s.preflight).not.toHaveBeenCalled();
  expect(s.stage).not.toHaveBeenCalled();
  s.confirm.mockResolvedValue(false);
  expect((await prepareRelease(sha, 202, true, s)).result).toBe("failed");
  expect(s.stage).not.toHaveBeenCalled();
  s.confirm.mockResolvedValue(true);
  expect((await prepareRelease(sha, 202, true, s)).result).toBe("prepared");
});
it.each(["short", "HEAD", other.toUpperCase()])(
  "rejects invalid candidate %s before any stage",
  async (candidate) => {
    const s = services();
    expect((await prepareRelease(candidate, 202, false, s)).result).toBe("failed");
    expect(s.authorization).not.toHaveBeenCalled();
  },
);
it("requires complete preflight evidence and preserves fixed safe remedies", async () => {
  const s = services();
  s.preflight.mockResolvedValue({ result: "passed", candidate_sha: sha, checks: [] });
  expect((await prepareRelease(sha, 202, false, s)).result).toBe("failed");
  s.preflight.mockResolvedValue({
    result: "passed",
    candidate_sha: sha,
    checks: checkNames.map((name) => ({ name, result: "failed", reason: "passed" })),
  });
  expect((await prepareRelease(sha, 202, false, s)).result).toBe("failed");
  s.preflight.mockResolvedValue({
    result: "failed",
    candidate_sha: sha,
    checks: [{ name: "local_supabase", result: "failed", reason: "stack_unavailable" }],
  });
  const r = await prepareRelease(sha, 202, false, s);
  expect("checks" in r ? r.checks?.[0].remedy : null).toContain("existing local Supabase");
});
it("requires the actual owner, reviewed main PR and exact merge/current main; docs executables are not docs-only", () => {
  const pr = {
    number: 202,
    state: "MERGED",
    baseRefName: "main",
    mergeCommit: { oid: sha },
    mergedBy: { login: "MartinFloris" },
    mergedAt: new Date(Date.now() - 1000).toISOString(),
  };
  expect(validateOwnerMerge(pr, sha, sha, 202).approved_by).toBe("MartinFloris");
  for (const change of [
    { state: "OPEN" },
    { baseRefName: "dev" },
    { mergedBy: { login: "someone" } },
    { mergeCommit: { oid: other } },
    { number: 203 },
    { mergedAt: "invalid" },
  ])
    expect(() => validateOwnerMerge({ ...pr, ...change }, sha, sha, 202)).toThrow();
  expect(() => validateOwnerMerge(pr, other, sha, 202)).toThrow();
  expect(documentationOnly(["docs/PROGRESS.md", "CLAUDE.md"])).toBe(true);
  for (const files of [
    [],
    ["docs/example.mjs"],
    ["docs/settings.json"],
    ["CLAUDE.md", "package.json"],
  ])
    expect(documentationOnly(files)).toBe(false);
});
it("reads the full merged diff and refuses incomplete GitHub/Git authorization", async () => {
  const calls: string[][] = [];
  const pr = {
    number: 202,
    state: "MERGED",
    baseRefName: "main",
    mergeCommit: { oid: sha },
    mergedBy: { login: "MartinFloris" },
    mergedAt: new Date(Date.now() - 1000).toISOString(),
  };
  const execute = async (_file: string, args: string[]) => {
    calls.push(args);
    return {
      ok: true,
      stdout:
        args[0] === "pr"
          ? JSON.stringify(pr)
          : args[0] === "api"
            ? sha
            : args[0] === "rev-list"
              ? `${sha} ${other}`
              : args.includes("--name-only")
                ? "docs/example.mjs\0"
                : "full diff",
    };
  };
  expect((await inspectAuthorization(root, sha, 202, execute)).documentation_only).toBe(false);
  expect(calls.some((c) => c.includes("--no-textconv"))).toBe(true);
  await expect(
    inspectAuthorization(root, sha, 202, async () => ({ ok: false, stdout: privateValue })),
  ).rejects.toThrow("authorization_unverified");
});
it("rejects stale/future/other-SHA/missing gate and approval, and detects any byte tampering", async () => {
  const dir = temp(),
    gateDir = path.join(dir, ".release-evidence/gates", sha);
  mkdirSync(gateDir, { recursive: true });
  const file = path.join(gateDir, "gate-20261007-010000.json"),
    now = Date.now();
  const good = {
    version: 2,
    result: "passed",
    candidate_sha: sha,
    release_approval: "not_granted",
    deployment_authorized: false,
    created_at: new Date(now).toISOString(),
  };
  const save = (obj: object) => writeFileSync(file, "\ufeff" + JSON.stringify(obj));
  save(good);
  const gate = await readGate(dir, file, sha, now - 1000, now + 1000);
  await assertUnchanged(gate);
  for (const change of [
    { candidate_sha: other },
    { result: "skipped" },
    { version: 1 },
    { deployment_authorized: true },
    { created_at: new Date(now - 2000).toISOString() },
    { created_at: new Date(now + 2000).toISOString() },
  ]) {
    save({ ...good, ...change });
    await expect(readGate(dir, file, sha, now - 1000, now + 1000)).rejects.toThrow();
  }
  await expect(readGate(dir, file + "missing", sha, now - 1000, now + 1000)).rejects.toThrow();
  save(good);
  const approval = {
    version: 1,
    candidate_sha: sha,
    approved_by: "MartinFloris",
    release_approved: true,
    deployment_authorized: false,
    gate_manifest: gate.path,
    approved_at: new Date(now).toISOString(),
  };
  const approvalFile = file + ".approval.json";
  writeFileSync(approvalFile, JSON.stringify(approval));
  const record = await readApproval(gate, sha, "MartinFloris", now + 1000);
  await assertUnchanged(gate, record);
  for (const change of [
    { candidate_sha: other },
    { approved_by: "someone" },
    { gate_manifest: "other" },
    { release_approved: false },
    { approved_at: new Date(now - 2000).toISOString() },
  ]) {
    writeFileSync(approvalFile, JSON.stringify({ ...approval, ...change }));
    await expect(readApproval(gate, sha, "MartinFloris", now + 1000)).rejects.toThrow();
  }
  save({ ...good, extra: "tampered" });
  await expect(assertUnchanged(gate)).rejects.toThrow("evidence_changed");
});
it("captures real Windows PowerShell stage output, forwards progress live, and buffers private output", async () => {
  const dir = temp(),
    scripts = path.join(dir, "scripts/release");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(
    path.join(scripts, "invoke-release-stage.ps1"),
    readFileSync(path.join(root, "scripts/release/invoke-release-stage.ps1")),
  );
  writeFileSync(
    path.join(scripts, "request-production-gate.ps1"),
    `param($CandidateSha,[switch]$PassThru)\nWrite-Host '${privateValue}'\nWrite-Host '[production-e2e] stage=production-build event=started elapsed_ms=0'\nStart-Sleep -Milliseconds 300\n[pscustomobject]@{result='passed';candidate_sha=$CandidateSha;gate_manifest='fictional'}\n`,
  );
  const lines: string[] = [];
  let completed = false;
  const task = runReleaseStage(dir, "gate", sha, {
    progress: (line: string) => {
      expect(completed).toBe(false);
      lines.push(line);
    },
  });
  expect((await task).result).toBe("passed");
  completed = true;
  expect(lines).toEqual(["[production-e2e] stage=production-build event=started elapsed_ms=0"]);
  writeFileSync(
    path.join(scripts, "approve-production-release.ps1"),
    `param($GateManifest,$CandidateSha,$ApprovedBy)\n$confirm=Read-Host 'Sensitive prompt'\nif($confirm -ne $CandidateSha){throw 'bad phrase'}\nWrite-Host 'approved'\n`,
  );
  expect(
    (await runReleaseStage(dir, "approval", sha, { gate: "fictional", approvedBy: "MartinFloris" }))
      .result,
  ).toBe("passed");
  for (const bad of [
    `throw '${privateValue}'`,
    `Write-Output '${privateValue}'`,
    `[Console]::Error.WriteLine('${privateValue}'); exit 1`,
  ]) {
    writeFileSync(
      path.join(scripts, "request-production-gate.ps1"),
      `param($CandidateSha,[switch]$PassThru)\n${bad}\n`,
    );
    await expect(runReleaseStage(dir, "gate", sha)).rejects.toThrow(/stage_failed|stage_invalid/);
  }
}, 15000);
it("prints executable PowerShell/Node Git-source commands with no credential arguments and reasserts before POST", () => {
  const input = {
    sha,
    authorization: authorization(),
    gate: { path: "C:/fictional owner/o'brien/gate.json", hash: "1".repeat(64) },
    approval: { path: "C:/fictional/approval.json", hash: "2".repeat(64) },
  };
  const commands = handoffCommands(root, input);
  expect(commands.deployment).toContain(
    'gitSource:{type:"github",repoId:project.link.repoId,ref:data.sha,sha:data.sha}',
  );
  expect(commands.deployment.indexOf("await runReleaseStage")).toBeLessThan(
    commands.deployment.indexOf('"POST"'),
  );
  expect(commands.verification).toContain("candidate_lookup_complete!==true");
  for (const command of Object.values(commands)) {
    expect(command).toContain(sha);
    expect(command).not.toMatch(
      /--token|Bearer |SERVICE_ROLE_KEY|DB_URL|\.env.local|withLatestCommit|--prod/,
    );
    expect(command.startsWith("@'\n")).toBe(true);
  }
  expect(() => nodeCommand("code\n'@\nmalicious")).toThrow();
  // Parse the actual emitted here-string in Windows PowerShell, feed Node a
  // syntax check, and verify apostrophes/spaces retain exact candidate data.
  const dir = temp(),
    script = path.join(dir, "parse-command.ps1");
  const parseCommand = commands.deployment.replace(
    "| & node --input-type=module",
    "| & node --input-type=module --check",
  );
  writeFileSync(script, parseCommand);
  const result = spawnSync(
    process.platform === "win32" ? "powershell.exe" : "pwsh",
    ["-NoProfile", "-File", script],
    { encoding: "utf8", timeout: 10000 },
  );
  expect(result.status, result.stderr).toBe(0);
});
