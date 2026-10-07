import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { createPlan } from "../../scripts/cleanup/plan.mjs";
import { newFixture, disposeFixture } from "../../scripts/cleanup/fixture-executor.mjs";
import { executeCleanup } from "../../scripts/cleanup/execute-cleanup.mjs";
import { fixtureHost } from "../fixtures/cleanup-real-host.mjs";
import { preserveTarget } from "../../scripts/cleanup/recovery.mjs";

const fixtures: ReturnType<typeof newFixture>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) disposeFixture(fixture);
});
function setup(link = false) {
  const fixture = newFixture();
  fixtures.push(fixture);
  fs.appendFileSync(path.join(fixture.root, "content.txt"), "artificial retained stash");
  expect(
    spawnSync("git", ["stash", "push", "-m", "artificial retained stash"], {
      cwd: fixture.root,
      windowsHide: true,
    }).status,
  ).toBe(0);
  if (link)
    fs.symlinkSync(
      path.join(fixture.root, "node_modules"),
      path.join(fixture.targets[0], "node_modules"),
      "junction",
    );
  const request = fixture.targets.map((target, index) => {
    fs.mkdirSync(path.join(target, "cache", "empty"), { recursive: true });
    const archive = path.join(fixture.base, `mock-${index}.archive`),
      recoveryReceipt = path.join(fixture.base, `mock-${index}.receipt`);
    fs.writeFileSync(archive, "mock preservation for state-machine tests only");
    fs.writeFileSync(recoveryReceipt, "not proof");
    return {
      path: target,
      preservation: {
        archive,
        recoveryReceipt,
        limitations:
          "Mock verifier in this state-machine test. Encrypted restoration tested separately.",
      },
    };
  });
  return { fixture, plan: createPlan(fixture.root, request) };
}

describe(
  "portable real-entry state machine (simulated host and recovery)",
  { timeout: 60000 },
  () => {
    it("removes only its failed new preservation candidate", async () => {
      const { fixture } = setup();
      const archive = path.join(fixture.base, "failed-new.enc");
      const original = path.join(fixture.base, "existing.enc");
      fs.writeFileSync(original, "existing archive sentinel");
      await expect(
        preserveTarget(fixture.root, fixture.targets[0], archive, {
          encrypt: (_mode, input) => {
            fs.writeFileSync(input.path, "artificial ciphertext", { flag: "wx" });
            return Buffer.alloc(0);
          },
          verify: () => {
            throw Error("independent_recovery_failed");
          },
        }),
      ).rejects.toThrow("independent_recovery_failed");
      expect(fs.existsSync(archive + ".pending")).toBe(false);
      expect(fs.existsSync(archive)).toBe(false);
      expect(fs.readFileSync(original, "utf8")).toBe("existing archive sentinel");
      expect(fs.existsSync(path.join(fixture.targets[0], "content.txt"))).toBe(true);
    });
    it.each(["codex", "claude"])(
      "uses normal Git with %s and does not follow the dependency link",
      async (agent) => {
        const { fixture, plan } = setup(true),
          host = fixtureHost(fixture, { agent });
        expect(plan.items[0].status).toBe("");
        const results = await executeCleanup(host.runtime, plan, fixture.targets, {
          verifyRecovery: (item) => item.stateDigest,
        });
        expect(results.map((r) => r.status)).toEqual(["removed", "removed"]);
        expect(
          fs.readFileSync(path.join(fixture.root, "node_modules", "sentinel.txt"), "utf8"),
        ).toBe("shared fixture dependencies");
        expect(
          spawnSync("git", ["stash", "list", "--format=%H"], {
            cwd: fixture.root,
            windowsHide: true,
          })
            .stdout.toString()
            .trim(),
        ).toMatch(/^[a-f0-9]{40}$/);
      },
    );
    it("retains owner refusal through a new host instance", async () => {
      const { fixture, plan } = setup();
      const first = fixtureHost(fixture, { decision: "refuse" });
      await executeCleanup(first.runtime, plan, fixture.targets, {
        verifyRecovery: (item) => item.stateDigest,
      });
      const restart = fixtureHost(fixture);
      const result = await executeCleanup(restart.runtime, plan, fixture.targets, {
        verifyRecovery: (item) => item.stateDigest,
      });
      expect(result.every((r) => r.reason === "specific_owner_consent_refused")).toBe(true);
      expect(restart.requests).toHaveLength(0);
      expect(fixture.targets.every(fs.existsSync)).toBe(true);
    });
    it("records an actual normal Git refusal and never falls back after restart", async () => {
      const { fixture, plan } = setup();
      const host = fixtureHost(fixture);
      const save = host.services.save;
      host.services.save = async (contract, previous, record) => {
        await save(contract, previous, record);
        // Controlled disposable race immediately before the real Git subprocess.
        if (record.phase === "git-running")
          fs.writeFileSync(path.join(contract.path, "new.txt"), "unfinished fixture work");
      };
      const result = await executeCleanup(host.runtime, plan, [fixture.targets[0]], {
        verifyRecovery: (item) => item.stateDigest,
      });
      expect(result[0].reason).toBe("normal_git_refused_no_fallback");
      const restarted = fixtureHost(fixture);
      expect(
        (
          await executeCleanup(restarted.runtime, plan, [fixture.targets[0]], {
            verifyRecovery: (item) => item.stateDigest,
          })
        )[0].reason,
      ).toBe("normal_git_refused_no_fallback");
      expect(fs.existsSync(path.join(fixture.targets[0], "content.txt"))).toBe(true);
    });
    it.each(["git-running", "leftovers"])(
      "cannot infer success from %s progress",
      async (phase) => {
        const { fixture, plan } = setup();
        const item = plan.items[0],
          host = fixtureHost(fixture);
        const contract = { path: item.path, digest: item.approvalDigest },
          owner = { source: "owner-ui", id: "simulated-progress", contract, decision: "approve" };
        await host.services.save(contract, null, { contract, owner, phase });
        if (phase === "leftovers")
          fs.appendFileSync(path.join(item.path, "content.txt"), "changed after Git");
        const result = await executeCleanup(host.runtime, plan, [item.path], {
          verifyRecovery: (i) => i.stateDigest,
        });
        expect(result[0].status).toBe("stopped");
        expect(fs.existsSync(path.join(item.path, "content.txt"))).toBe(true);
      },
    );
    it("recognizes actual completed Git removal when its result checkpoint was lost", async () => {
      const { fixture, plan } = setup();
      const host = fixtureHost(fixture),
        save = host.services.save;
      host.services.save = async (contract, previous, record) => {
        if (record.phase === "leftovers") throw Error("lost_git_result");
        await save(contract, previous, record);
      };
      const first = await executeCleanup(host.runtime, plan, [fixture.targets[0]], {
        verifyRecovery: (item) => item.stateDigest,
      });
      expect(first[0].reason).toBe("lost_git_result");
      const restarted = fixtureHost(fixture);
      const second = await executeCleanup(restarted.runtime, plan, [fixture.targets[0]], {
        verifyRecovery: (item) => item.stateDigest,
      });
      expect(second[0].status).toBe("removed");
      expect(restarted.requests).toHaveLength(0);
    });
    it.each(["leftover-file", "leftover-folder"])(
      "resumes only unchanged narrow leftovers after %s interruption",
      async (stage) => {
        const { fixture, plan } = setup();
        const item = plan.items[0],
          host = fixtureHost(fixture);
        const contract = { path: item.path, digest: item.approvalDigest },
          owner = {
            source: "owner-ui",
            id: "simulated-known-git-success",
            contract,
            decision: "approve",
          };
        // Simulate the known partial-success checkpoint on untouched disposable
        // directories. No production Git-result adapter is replaced or bypassed.
        await host.services.save(contract, null, { contract, owner, phase: "leftovers" });
        let interrupted = false;
        const first = await executeCleanup(host.runtime, plan, [item.path], {
          verifyRecovery: (i) => i.stateDigest,
          faultPoint(point) {
            if (!interrupted && point === stage) {
              interrupted = true;
              throw Error("interrupted");
            }
          },
        });
        const restart = fixtureHost(fixture);
        const second = await executeCleanup(restart.runtime, plan, [item.path], {
          verifyRecovery: (i) => i.stateDigest,
        });
        expect(second[0].status).toBe("removed");
        expect(restart.requests).toHaveLength(0);
        expect(first[0].reason).toBe("interrupted");
      },
    );
  },
);
