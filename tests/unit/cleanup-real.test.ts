import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { newFixture, disposeFixture } from "../../scripts/cleanup/fixture-executor.mjs";
import { createPlan } from "../../scripts/cleanup/plan.mjs";
import { protectedState, repository, objectDigest } from "../../scripts/cleanup/inspect.mjs";
import { executeCleanup, createHostRuntime } from "../../scripts/cleanup/execute-cleanup.mjs";
import {
  codexOwnerEvent,
  claudeOwnerEvent,
  codexPermissions,
} from "../../scripts/cleanup/runtime-adapters.mjs";
import { preserveTarget } from "../../scripts/cleanup/recovery.mjs";
import { fixtureHost } from "../fixtures/cleanup-real-host.mjs";

const fixtures: ReturnType<typeof newFixture>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) disposeFixture(fixture);
});

async function setup({ link = false, dirty = false, fullStrength = false } = {}) {
  const fixture = newFixture();
  fixtures.push(fixture);
  if (link)
    fs.symlinkSync(
      path.join(fixture.root, "node_modules"),
      path.join(fixture.targets[0], "node_modules"),
      "junction",
    );
  if (dirty) {
    fs.appendFileSync(path.join(fixture.targets[0], "content.txt"), "unfinished local work");
    expect(
      spawnSync("git", ["add", "content.txt"], { cwd: fixture.targets[0], windowsHide: true })
        .status,
    ).toBe(0);
    fs.appendFileSync(path.join(fixture.targets[0], "content.txt"), "more unstaged work");
  }
  const unpublished = spawnSync("git", ["hash-object", "-w", "--stdin"], {
    cwd: fixture.targets[0],
    input: "artificial unpublished object outside named history",
    windowsHide: true,
  });
  expect(unpublished.status).toBe(0);
  // Exact production worker/modules, with only the disposable credential
  // module returning an artificial password. Never read/write real DPAPI state.
  const copy = path.join(fixture.base, "recovery-code");
  fs.mkdirSync(copy);
  for (const file of [
    "recovery.mjs",
    "recovery-worker.mjs",
    "inspect.mjs",
    "paths.mjs",
    "cipher-worker.ps1",
  ])
    fs.copyFileSync(path.resolve("scripts/cleanup", file), path.join(copy, file));
  // The separate full-strength case retains exact production source. Matrix
  // cases reduce only the KDF work factor in this copied disposable worker;
  // there is no production flag, environment override or changed algorithm.
  if (!fullStrength) {
    const cipherPath = path.join(copy, "cipher-worker.ps1");
    const source = fs.readFileSync(cipherPath, "utf8");
    expect(source).toContain("$iterations = 600000");
    fs.writeFileSync(cipherPath, source.replace("$iterations = 600000", "$iterations = 1000"));
  }
  // Cipher worker uses ../lib, and this path is entirely in the new fixture.
  fs.mkdirSync(path.join(fixture.base, "lib"));
  fs.writeFileSync(
    path.join(fixture.base, "lib", "KutCredentialStore.psm1"),
    "function Get-KutStoredCredential { param([string]$Locator) ConvertTo-SecureString 'artificial-disposable-password' -AsPlainText -Force }; Export-ModuleMember -Function Get-KutStoredCredential",
  );
  const recovery = await import(pathToFileURL(path.join(copy, "recovery.mjs")).href);
  const request = [];
  for (const [index, target] of fixture.targets.entries()) {
    const archive = path.join(fixture.base, `real-${index}.enc`),
      receipt = path.join(fixture.base, `recovery-${index}.json`);
    const saved = await preserveTarget(fixture.root, target, archive, {
      encrypt: recovery.storedCipher,
      verify: recovery.verifyRecoveryArchive,
    });
    expect(saved.objects).toContain(unpublished.stdout.toString().trim());
    fs.writeFileSync(receipt, JSON.stringify({ version: 1, ...saved }));
    request.push({
      path: target,
      preservation: {
        archive,
        recoveryReceipt: receipt,
        limitations:
          "Artificial password only; same-machine real DPAPI/off-device recovery not verified. All inventoried local files retained; links restored as metadata only.",
      },
    });
  }
  const plan = createPlan(fixture.root, request);
  return { fixture, plan, recovery, recoveryModule: path.join(copy, "recovery.mjs") };
}

const windows = process.platform === "win32";
describe.skipIf(!windows)(
  "real cleanup engine with encrypted disposable preservation",
  { timeout: 180000 },
  () => {
    it("cold-recovers with the exact full-strength cipher worker source", async () => {
      const { plan, recovery } = await setup({ fullStrength: true });
      expect(recovery.verifyPreservedItem(plan.items[0])).toBe(plan.items[0].stateDigest);
    });
    it.each(["codex", "claude"])(
      "executes the real entry for %s through an exact simulated host decision",
      async (agent) => {
        const { fixture, plan, recovery } = await setup({ link: true });
        const before = objectDigest(protectedState(repository(fixture.root)));
        const host = fixtureHost(fixture, { agent });
        const result = await executeCleanup(host.runtime, plan, fixture.targets, {
          verifyRecovery: recovery.verifyPreservedItem,
        });
        expect(result.map((r) => r.status)).toEqual(["removed", "removed"]);
        expect(host.requests).toHaveLength(2);
        expect(host.requests[0].explanation).toContain("Shortcut to shared files");
        expect(host.scopes[0].write).toEqual([plan.items[0].path, plan.items[0].admin]);
        expect(objectDigest(protectedState(repository(fixture.root)))).toBe(before);
        expect(
          fs.readFileSync(path.join(fixture.root, "node_modules", "sentinel.txt"), "utf8"),
        ).toBe("shared fixture dependencies");
      },
    );

    it.each(["refuse", "auto-review", "coverage", "permission", "recovery"])(
      "refuses %s without removing named content",
      async (kind) => {
        const { fixture, plan, recovery } = await setup();
        fs.writeFileSync(
          path.join(fixture.base, "approval-looking.json"),
          JSON.stringify({ approved: true, owner: true }),
        );
        const host = fixtureHost(fixture, {
          decision: kind === "refuse" ? "refuse" : "approve",
          source: kind === "auto-review" ? "auto-review" : "owner-ui",
          coverage: kind !== "coverage",
          permission: kind !== "permission",
        });
        if (kind === "coverage")
          await expect(
            executeCleanup(host.runtime, plan, fixture.targets, {
              verifyRecovery: recovery.verifyPreservedItem,
            }),
          ).rejects.toThrow("live_tool_coverage_missing");
        else {
          const result = await executeCleanup(host.runtime, plan, fixture.targets, {
            verifyRecovery: kind === "recovery" ? () => false : recovery.verifyPreservedItem,
          });
          expect(result.every((r) => r.status === "stopped")).toBe(true);
          if (kind === "recovery") expect(host.requests).toHaveLength(0);
        }
        expect(fixture.targets.every(fs.existsSync)).toBe(true);
      },
    );

    it.each(["tracked", "untracked", "ignored", "index", "head", "archive", "link"])(
      "invalidates only %s-changed work",
      async (kind) => {
        const { fixture, plan, recovery } = await setup({ link: kind === "link" });
        const target = fixture.targets[0];
        if (kind === "tracked") fs.appendFileSync(path.join(target, "content.txt"), "changed");
        if (kind === "untracked") fs.writeFileSync(path.join(target, "new.txt"), "new work");
        if (kind === "ignored") {
          fs.mkdirSync(path.join(target, "cache"));
          fs.writeFileSync(path.join(target, "cache", "private.txt"), "changed");
        }
        if (kind === "index") fs.appendFileSync(path.join(plan.items[0].admin, "index"), "changed");
        if (kind === "head")
          fs.writeFileSync(
            path.join(plan.items[0].admin, "HEAD"),
            "0000000000000000000000000000000000000000\n",
          );
        if (kind === "archive") fs.appendFileSync(plan.items[0].recovery!.archive.path, "changed");
        if (kind === "link") {
          const link = path.join(target, "node_modules");
          fs.unlinkSync(link);
          fs.symlinkSync(fixture.base, link, "junction");
        }
        const host = fixtureHost(fixture);
        const result = await executeCleanup(host.runtime, plan, fixture.targets, {
          verifyRecovery: recovery.verifyPreservedItem,
        });
        expect(result.map((r) => r.status)).toEqual(["stopped", "removed"]);
        expect(fs.existsSync(path.join(target, "content.txt"))).toBe(true);
      },
    );

    it("preserves dirty work but refuses to remove it, and requires cold recovery rather than a receipt", async () => {
      const { fixture, plan, recovery } = await setup({ dirty: true });
      const host = fixtureHost(fixture);
      expect(
        (
          await executeCleanup(host.runtime, plan, [fixture.targets[0]], {
            verifyRecovery: recovery.verifyPreservedItem,
          })
        )[0].reason,
      ).toBe("dirty_or_missing_preservation");
      expect(host.requests).toHaveLength(0);
    });

    it.each(["link", "before-git", "after-git"])(
      "resumes %s interruption in a new process without a new owner decision",
      async (stage) => {
        const { fixture, plan, recovery, recoveryModule } = await setup({ link: true });
        const selected = [fixture.targets[0]],
          host = fixtureHost(fixture);
        const result = await executeCleanup(host.runtime, plan, selected, {
          verifyRecovery: recovery.verifyPreservedItem,
          faultPoint(point) {
            if (point === stage) throw Error("interrupted");
          },
        });
        expect(result[0].status).toBe("stopped");
        const child = spawnSync(process.execPath, ["tests/fixtures/cleanup-real-restart.mjs"], {
          input: JSON.stringify({ fixture, plan, selected, recoveryModule, agent: "codex" }),
          windowsHide: true,
          timeout: 30000,
        });
        expect(child.status, child.stderr.toString()).toBe(0);
        const resumed = JSON.parse(child.stdout.toString());
        expect(resumed.result[0].status).toBe("removed");
        expect(resumed.newOwnerPrompts).toBe(0);
      },
    );

    it.each(["missing", "tampered"])(
      "stops %s host progress and resumes an unaffected item",
      async (kind) => {
        const { fixture, plan, recovery } = await setup();
        const host = fixtureHost(fixture);
        await executeCleanup(host.runtime, plan, [fixture.targets[0]], {
          verifyRecovery: recovery.verifyPreservedItem,
          faultPoint(point) {
            if (point === "before-git") throw Error("interrupted");
          },
        });
        const file = host.fileFor({
          path: plan.items[0].path,
          digest: plan.items[0].approvalDigest,
        });
        if (kind === "missing") fs.unlinkSync(file);
        else fs.writeFileSync(file, '{"record":{"phase":"complete"},"seal":"forged"}');
        const resumed = fixtureHost(fixture);
        const result = await executeCleanup(resumed.runtime, plan, fixture.targets, {
          verifyRecovery: recovery.verifyPreservedItem,
        });
        expect(result.map((r) => r.status)).toEqual(["stopped", "removed"]);
        expect(resumed.requests).toHaveLength(1);
      },
    );
  },
);

describe("host interfaces fail closed", () => {
  it("requires host callbacks and refuses copied consent flags", () => {
    expect(() => createHostRuntime("codex", { approved: true })).toThrow(
      "trusted_host_connection_required",
    );
    expect(() => createHostRuntime("unknown", {})).toThrow("unsupported_agent");
  });
  it("maps supported owner responses and rejects session-wide or changed input", () => {
    const request = { contract: { path: "named", digest: "exact" } },
      identity = { source: "owner-ui", id: "host-event" };
    expect(codexOwnerEvent(request, { decision: "accept" }, identity).decision).toBe("approve");
    expect(codexOwnerEvent(request, { decision: "decline" }, identity).decision).toBe("refuse");
    expect(() => codexOwnerEvent(request, { decision: "acceptForSession" }, identity)).toThrow();
    expect(claudeOwnerEvent(request, { behavior: "deny" }, identity).decision).toBe("refuse");
    expect(() =>
      claudeOwnerEvent(request, { behavior: "allow", updatedInput: { scope: "all" } }, identity),
    ).toThrow("owner_scope_changed");
    expect(() => claudeOwnerEvent(request, null, identity)).toThrow();
  });
  it("requests only explicit paths with no network capability", () => {
    expect(codexPermissions({ read: ["archive", "receipt"], write: ["working", "admin"] })).toEqual(
      {
        fileSystem: {
          entries: [
            { access: "read", path: { type: "path", path: "archive" } },
            { access: "read", path: { type: "path", path: "receipt" } },
            { access: "write", path: { type: "path", path: "working" } },
            { access: "write", path: { type: "path", path: "admin" } },
          ],
        },
        network: { enabled: false },
      },
    );
  });
});
