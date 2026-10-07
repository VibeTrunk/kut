import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { canonical } from "../../scripts/cleanup/paths.mjs";
import {
  inspectTarget,
  objectDigest,
  repository,
  protectedState,
} from "../../scripts/cleanup/inspect.mjs";
import { approvalView, createPlan, validatePlan, writePlan } from "../../scripts/cleanup/plan.mjs";
import { plainReview, reviewPlan } from "../../scripts/cleanup/review.mjs";
import { readCheckpoints } from "../../scripts/cleanup/checkpoints.mjs";
import {
  disposeFixture,
  executeFixture,
  fixtureConsent,
  newFixture,
} from "../../scripts/cleanup/fixture-executor.mjs";

const require = createRequire(import.meta.url);
const { evaluate } = require("../../scripts/safety/command-policy.cjs");
const fixtures: ReturnType<typeof newFixture>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) disposeFixture(fixture);
});

function setup() {
  const fixture = newFixture();
  fixtures.push(fixture);
  return fixture;
}

function planFor(fixture: ReturnType<typeof newFixture>, targets = fixture.targets) {
  const repo = repository(fixture.root);
  const request = targets.map((target: string, index: number) => {
    const item = inspectTarget(repo, target);
    const archive = path.join(fixture.base, `archive-${index}.json`),
      recoveryReceipt = path.join(fixture.base, `receipt-${index}.json`);
    const bytes = [
      ...item.files.map((e) => ({ entry: e, root: target })),
      ...item.adminFiles.map((e) => ({ entry: e, root: item.admin })),
    ]
      .filter(({ entry }) => entry.type === "file")
      .map(({ entry, root }) => ({
        sha256: entry.sha256,
        content: fs.readFileSync(path.join(root, entry.path)).toString("base64"),
      }));
    const bundlePath = path.join(fixture.base, `history-${index}.bundle`);
    const bundleResult = spawnSync("git", ["bundle", "create", bundlePath, "--all"], {
      cwd: fixture.root,
      windowsHide: true,
      timeout: 10000,
    });
    if (bundleResult.status !== 0) throw Error("fixture_bundle_failed");
    const bundle = fs.readFileSync(bundlePath).toString("base64");
    fs.writeFileSync(
      archive,
      JSON.stringify({
        stateDigest: item.stateDigest,
        files: item.files,
        adminFiles: item.adminFiles,
        head: item.head,
        bytes,
        bundle,
      }),
    );
    fs.writeFileSync(recoveryReceipt, JSON.stringify({ recordOnly: true }));
    return {
      path: target,
      preservation: {
        archive,
        recoveryReceipt,
        limitations: "Artificial fixture data only; real encrypted recovery is not certified.",
      },
    };
  });
  return createPlan(fixture.root, request);
}

function recover(item: ReturnType<typeof inspectTarget>) {
  const result = spawnSync(
    process.execPath,
    [path.resolve("tests/fixtures/cleanup-recovery.mjs")],
    {
      input: JSON.stringify({
        archive: item.recovery!.archive.path,
        stateDigest: item.stateDigest,
        files: item.files,
        adminFiles: item.adminFiles,
        head: item.head,
      }),
      windowsHide: true,
      timeout: 10000,
    },
  );
  if (result.status !== 0) return false;
  return result.stdout.toString().trim();
}

describe("bounded cleanup fixtures (never real owner worktrees)", { timeout: 20000 }, () => {
  it("plans without changing files, refs, index or worktree registration", () => {
    const fixture = setup(),
      repo = repository(fixture.root);
    const before = JSON.stringify({
      repo,
      protected: protectedState(repo),
      target: inspectTarget(repo, fixture.targets[0]),
    });
    const plan = createPlan(fixture.root, [{ path: fixture.targets[0] }]);
    expect(plan.items[0].executable).toBe(false);
    expect(approvalView(plan)).toContain("Recovery has not been established");
    expect(
      JSON.stringify({
        repo: repository(fixture.root),
        protected: protectedState(repo),
        target: inspectTarget(repo, fixture.targets[0]),
      }),
    ).toBe(before);
  });

  it("refuses consent flags/records and cannot run with a caller-made real capability", async () => {
    const fixture = setup(),
      plan = planFor(fixture);
    const result = await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
    });
    expect(result.every((r) => r.reason === "specific_owner_consent_missing")).toBe(true);
    await expect(executeFixture({ root: fixture.root }, plan, fixture.targets)).rejects.toThrow(
      "fixture_capability_required",
    );
    const cli = spawnSync(
      process.execPath,
      ["scripts/cleanup/execute-cleanup.mjs", "--approved", "receipt.json"],
      { windowsHide: true },
    );
    expect(cli.status).toBe(1);
    expect(cli.stderr.toString()).toContain("independent owner consent");
    expect(fixture.targets.every(fs.existsSync)).toBe(true);
  });

  it("removes approved clean copies with normal Git and preserves refs and shared dependencies", async () => {
    const fixture = setup(),
      plan = planFor(fixture),
      before = objectDigest(protectedState(repository(fixture.root)));
    fixtureConsent(fixture, plan, fixture.targets);
    const results = await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
    });
    expect(results.map((r) => r.status)).toEqual(["removed", "removed"]);
    expect(objectDigest(protectedState(repository(fixture.root)))).toBe(before);
    expect(fs.readFileSync(path.join(fixture.root, "node_modules", "sentinel.txt"), "utf8")).toBe(
      "shared fixture dependencies",
    );
  });

  it.each(["tracked", "untracked", "ignored", "index", "head"])(
    "invalidates only the %s-changed item",
    async (kind) => {
      const fixture = setup(),
        plan = planFor(fixture);
      fixtureConsent(fixture, plan, fixture.targets);
      const target = fixture.targets[0];
      if (kind === "tracked") fs.appendFileSync(path.join(target, "content.txt"), "changed");
      if (kind === "untracked") fs.writeFileSync(path.join(target, "new.txt"), "unfinished");
      if (kind === "ignored") {
        fs.mkdirSync(path.join(target, "cache"));
        fs.writeFileSync(path.join(target, "cache", "manual.txt"), "private work");
      }
      if (kind === "index") fs.appendFileSync(path.join(plan.items[0].admin, "index"), "changed");
      if (kind === "head")
        fs.writeFileSync(
          path.join(plan.items[0].admin, "HEAD"),
          "0000000000000000000000000000000000000000\n",
        );
      const results = await executeFixture(fixture, plan, fixture.targets, {
        verifyRecovery: recover,
      });
      expect(results[0].status).toBe("stopped");
      expect(fs.existsSync(target)).toBe(true);
      expect(results[1].status).toBe("removed");
    },
  );

  it("refuses dirty work even with preservation; no force/discard is available", async () => {
    const fixture = setup();
    fs.appendFileSync(path.join(fixture.targets[0], "content.txt"), "unfinished");
    const plan = planFor(fixture, [fixture.targets[0]]);
    expect(plan.items[0].executable).toBe(false);
    fixtureConsent(fixture, plan, [fixture.targets[0]]);
    expect(
      (await executeFixture(fixture, plan, [fixture.targets[0]], { verifyRecovery: recover }))[0]
        .reason,
    ).toBe("dirty_or_missing_preservation");
  });

  it("requires independently recovered bytes, not a good-looking receipt", async () => {
    const fixture = setup(),
      plan = planFor(fixture);
    fixtureConsent(fixture, plan, fixture.targets);
    const missing = await executeFixture(fixture, plan, fixture.targets);
    expect(missing.every((r) => r.reason === "independent_recovery_required")).toBe(true);
    fs.appendFileSync(plan.items[0].recovery!.archive.path, "changed");
    const changed = await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
    });
    expect(changed[0].reason).toBe("recovery_evidence_changed");
    expect(changed[1].status).toBe("removed");
  });

  it("refuses a missing archive and corrupt recovery despite a newly sealed plan", async () => {
    const fixture = setup(),
      original = planFor(fixture);
    const archive = original.items[0].recovery!.archive.path;
    const contents = JSON.parse(fs.readFileSync(archive, "utf8"));
    contents.bytes[0].content = Buffer.from("corrupt fixture bytes").toString("base64");
    fs.writeFileSync(archive, JSON.stringify(contents));
    const plan = createPlan(
      fixture.root,
      original.items.map((item) => ({
        path: item.path,
        preservation: {
          archive: item.recovery!.archive.path,
          recoveryReceipt: item.recovery!.recoveryReceipt.path,
          limitations: item.recovery!.limitations,
        },
      })),
    );
    fixtureConsent(fixture, plan, fixture.targets);
    const corrupt = await executeFixture(fixture, plan, [fixture.targets[0]], {
      verifyRecovery: recover,
    });
    expect(corrupt[0].reason).toBe("independent_recovery_required");
    fs.unlinkSync(archive);
    expect(
      (await executeFixture(fixture, plan, [fixture.targets[0]], { verifyRecovery: recover }))[0]
        .status,
    ).toBe("stopped");
    expect(fs.existsSync(fixture.targets[0])).toBe(true);
  });

  it("retains unchanged item approval when only the other item's contract is replanned", async () => {
    const fixture = setup(),
      original = planFor(fixture);
    fixtureConsent(fixture, original, fixture.targets);
    fs.appendFileSync(path.join(fixture.targets[0], "content.txt"), "new work");
    const updated = createPlan(
      fixture.root,
      original.items.map((item) => ({
        path: item.path,
        preservation: {
          archive: item.recovery!.archive.path,
          recoveryReceipt: item.recovery!.recoveryReceipt.path,
          limitations: item.recovery!.limitations,
        },
      })),
    );
    expect(updated.items[1].approvalDigest).toBe(original.items[1].approvalDigest);
    const result = await executeFixture(fixture, updated, fixture.targets, {
      verifyRecovery: recover,
    });
    expect(result[0].reason).toBe("specific_owner_consent_missing");
    expect(result[1].status).toBe("removed");
  });

  it("refuses ordinary checkout, dependency target, traversal, device/ADS paths and unknown items", () => {
    const fixture = setup();
    for (const target of [
      fixture.root,
      path.join(fixture.root, "node_modules"),
      fixture.base,
      path.join(fixture.root, ".release-evidence"),
    ]) {
      expect(() => createPlan(fixture.root, [{ path: target }])).toThrow();
    }
    expect(() => canonical(fixture.targets[0] + path.sep + ".." + path.sep + "two")).toThrow(
      "unsafe_path",
    );
    if (process.platform === "win32")
      for (const p of ["\\\\?\\C:\\fixture", "C:\\fixture:stream", "C:\\fixture. "])
        expect(() => canonical(p)).toThrow();
    const plan = planFor(fixture);
    expect(() => approvalView(plan, [fixture.base])).toThrow("invalid_selection");
    expect(() => approvalView(plan, [fixture.targets[0], fixture.targets[0]])).toThrow(
      "invalid_selection",
    );
  });

  it("requires the complete operation and separate explanations for each cleanup type", () => {
    const fixture = setup();
    fs.symlinkSync(
      path.join(fixture.root, "node_modules"),
      path.join(fixture.targets[0], "node_modules"),
      "junction",
    );
    const plan = planFor(fixture),
      item = plan.items[0];
    expect(item.explanations.map((e: { type: string }) => e.type)).toEqual([
      "project-copy",
      "dependency-link",
      "git-records",
    ]);
    expect(item.operation.git).toEqual(["git", "worktree", "remove", "--", item.path]);
    const edited = structuredClone(plan);
    edited.items[0].operation.git.push("--force");
    expect(() => validatePlan(edited)).toThrow("plan_changed");
    expect(() => writePlan(plan, path.join(fixture.targets[0], "plan.json"))).toThrow(
      "plan_inside_removal_scope",
    );
    const saved = path.join(fixture.base, "plan.json");
    writePlan(plan, saved);
    expect(() => writePlan(plan, saved)).toThrow();
  });

  it("unlinks the named dependency junction and resumes without a second simulated approval", async () => {
    const fixture = setup(),
      target = fixture.targets[0];
    fs.symlinkSync(
      path.join(fixture.root, "node_modules"),
      path.join(target, "node_modules"),
      "junction",
    );
    const plan = planFor(fixture, [target]);
    // CI uses POSIX symlinks; Windows uses junctions. Both must be ignored by
    // the fixture without weakening refusal of genuinely untracked files.
    expect(plan.items[0].status).toBe("");
    expect(plan.items[0].executable).toBe(true);
    fixtureConsent(fixture, plan, [target]);
    const interrupted = await executeFixture(fixture, plan, [target], {
      verifyRecovery: recover,
      checkpoint(stage: string) {
        if (stage === "link") throw Error("interrupted");
      },
    });
    expect(interrupted[0].reason).toBe("interrupted");
    expect(fs.existsSync(path.join(target, "node_modules"))).toBe(false);
    expect(
      (await executeFixture(fixture, plan, [target], { verifyRecovery: recover }))[0].status,
    ).toBe("removed");
    expect(fs.existsSync(path.join(fixture.root, "node_modules", "sentinel.txt"))).toBe(true);
  });

  it("refuses changed link destinations and links elsewhere in the working or administration tree", async () => {
    const fixture = setup(),
      target = fixture.targets[0],
      link = path.join(target, "node_modules");
    fs.symlinkSync(path.join(fixture.root, "node_modules"), link, "junction");
    const plan = planFor(fixture, [target]);
    fixtureConsent(fixture, plan, [target]);
    fs.unlinkSync(link);
    const elsewhere = path.join(fixture.base, "elsewhere");
    fs.mkdirSync(elsewhere);
    fs.symlinkSync(elsewhere, link, "junction");
    expect(
      (await executeFixture(fixture, plan, [target], { verifyRecovery: recover }))[0].status,
    ).toBe("stopped");
    expect(() => createPlan(fixture.root, [{ path: target }])).toThrow("unapproved_link");
    fs.unlinkSync(link);
    fs.symlinkSync(elsewhere, path.join(target, "shortcut"), "junction");
    expect(() => createPlan(fixture.root, [{ path: target }])).toThrow("unapproved_link");
  });

  it("stops on a Git/Windows refusal without partial fallback deletion", async () => {
    const fixture = setup(),
      plan = planFor(fixture);
    fixtureConsent(fixture, plan, fixture.targets);
    const results = await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
      gitRemoval: () => false,
    });
    expect(results.every((r) => r.reason === "normal_git_refused_no_fallback")).toBe(true);
    expect(fixture.targets.every(fs.existsSync)).toBe(true);
  });

  it("retains refusal across interruption without granting leftover permission", async () => {
    const fixture = setup(),
      plan = planFor(fixture, [fixture.targets[0]]);
    fixtureConsent(fixture, plan, [fixture.targets[0]]);
    await executeFixture(fixture, plan, [fixture.targets[0]], {
      verifyRecovery: recover,
      gitRemoval: () => false,
      checkpoint(stage: string) {
        if (stage === "git-refused") throw Error("interrupted");
      },
    });
    const resumed = await executeFixture(fixture, plan, [fixture.targets[0]], {
      verifyRecovery: recover,
    });
    expect(resumed[0].reason).toBe("normal_git_refused_no_fallback");
    expect(fs.existsSync(fixture.targets[0])).toBe(true);
  });

  it("keeps an uncertain Git outcome stopped while other approved copies can finish", async () => {
    const fixture = setup(),
      plan = planFor(fixture);
    fixtureConsent(fixture, plan, fixture.targets);
    const first = await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
      gitRemoval(root: string, target: string) {
        if (target === fixture.targets[0]) throw Error("lost_git_result");
        return (
          spawnSync("git", ["worktree", "remove", "--", target], {
            cwd: root,
            windowsHide: true,
          }).status === 0
        );
      },
    });
    expect(first.map((item) => item.status)).toEqual(["stopped", "removed"]);
    const resumed = await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
    });
    expect(resumed[0].reason).toBe("normal_git_outcome_unknown_no_fallback");
    expect(resumed[1].status).toBe("removed");
    expect(fs.existsSync(fixture.targets[0])).toBe(true);
    expect(fs.existsSync(path.join(fixture.targets[0], "content.txt"))).toBe(true);
  });

  it("recognizes a completed normal Git operation after its subprocess result is lost", async () => {
    const fixture = setup(),
      target = fixture.targets[0],
      plan = planFor(fixture, [target]);
    fixtureConsent(fixture, plan, [target]);
    const first = await executeFixture(fixture, plan, [target], {
      verifyRecovery: recover,
      gitRemoval(root: string, exact: string) {
        const removal = spawnSync("git", ["worktree", "remove", "--", exact], {
          cwd: root,
          windowsHide: true,
        });
        if (removal.status !== 0) throw Error("fixture_git_failed");
        throw Error("lost_success_result");
      },
    });
    expect(first[0].reason).toBe("lost_success_result");
    expect(fs.existsSync(target)).toBe(false);
    const resumed = await executeFixture(fixture, plan, [target], {
      verifyRecovery: recover,
      gitRemoval() {
        throw Error("must_not_repeat_completed_git");
      },
    });
    expect(resumed[0].status).toBe("removed");
  });

  it("rejects altered progress records rather than granting leftover handling", async () => {
    const fixture = setup(),
      target = fixture.targets[0],
      plan = planFor(fixture, [target]);
    fixtureConsent(fixture, plan, [target]);
    await executeFixture(fixture, plan, [target], {
      verifyRecovery: recover,
      gitRemoval: () => false,
    });
    const folder = path.join(fixture.base, "progress");
    const file = path.join(folder, fs.readdirSync(folder).sort().at(-1)!);
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    record.record.phase = "leftovers";
    fs.writeFileSync(file, JSON.stringify(record));
    const stopped = await executeFixture(fixture, plan, [target], { verifyRecovery: recover });
    expect(stopped[0].reason).toBe("checkpoint_record_changed");
    expect(fs.existsSync(path.join(target, "content.txt"))).toBe(true);
    expect(() => readCheckpoints({})).toThrow("checkpoint_session_required");
  });

  it("refuses missing progress records even with unchanged simulated consent", async () => {
    const fixture = setup(),
      target = fixture.targets[0],
      plan = planFor(fixture, [target]);
    fixtureConsent(fixture, plan, [target]);
    await executeFixture(fixture, plan, [target], {
      verifyRecovery: recover,
      checkpoint(stage: string) {
        if (stage === "before-git") throw Error("interrupted");
      },
    });
    fs.unlinkSync(path.join(fixture.base, "progress", "00000000.json"));
    const stopped = await executeFixture(fixture, plan, [target], { verifyRecovery: recover });
    expect(stopped[0].reason).toBe("checkpoint_record_missing");
    expect(fs.existsSync(target)).toBe(true);
  });

  it("keeps altered item progress from stopping another unchanged approved item", async () => {
    const fixture = setup(),
      plan = planFor(fixture);
    fixtureConsent(fixture, plan, fixture.targets);
    await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
      checkpoint(stage: string) {
        if (stage === "before-git") throw Error("interrupted");
      },
    });
    const record = path.join(fixture.base, "progress", "00000000.json");
    const saved = JSON.parse(fs.readFileSync(record, "utf8"));
    saved.record.path = fixture.targets[1];
    saved.record.phase = "leftovers";
    fs.writeFileSync(record, JSON.stringify(saved));
    const resumed = await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
    });
    expect(resumed[0].reason).toBe("checkpoint_record_changed");
    expect(resumed[1].status).toBe("removed");
    expect(fs.existsSync(fixture.targets[0])).toBe(true);
  });

  it("rechecks saved plans read-only and isolates changed items without implying approval", () => {
    const fixture = setup(),
      plan = planFor(fixture),
      before = objectDigest(protectedState(repository(fixture.root)));
    const unchanged = reviewPlan(plan);
    expect(unchanged.mode).toBe("read-only");
    expect(unchanged.grantsApproval).toBe(false);
    expect(unchanged.items.map((item) => item.status)).toEqual(["unchanged", "unchanged"]);
    expect(plainReview(unchanged)).toContain("Nothing has been removed");
    fs.writeFileSync(path.join(fixture.targets[0], "new.txt"), "new owner work");
    const checked = reviewPlan(plan);
    expect(checked.items.map((item) => item.status)).toEqual(["blocked", "unchanged"]);
    expect(checked.items[0].reason).toBe("target_state_changed");
    expect(objectDigest(protectedState(repository(fixture.root)))).toBe(before);
    expect(fixture.targets.every(fs.existsSync)).toBe(true);
  });

  it("blocks an unchanged dirty plan and changed preservation on only the affected item", () => {
    const fixture = setup();
    fs.writeFileSync(path.join(fixture.targets[0], "content.txt"), "unfinished tracked work");
    const plan = planFor(fixture);
    expect(reviewPlan(plan).items[0].reason).toBe("local_work_present");
    fs.appendFileSync(plan.items[1].recovery!.archive.path, "corrupt archive");
    const checked = reviewPlan(plan);
    expect(checked.items[0].reason).toBe("local_work_present");
    expect(checked.items[1].reason).toBe("recovery_evidence_changed");
    expect(fixture.targets.every(fs.existsSync)).toBe(true);
  });

  it("checks a saved plan through the real read-only CLI and rejects removal flags", () => {
    const fixture = setup(),
      plan = planFor(fixture),
      saved = path.join(fixture.base, "review-plan.json");
    writePlan(plan, saved);
    const result = spawnSync(
      process.execPath,
      ["scripts/cleanup/review-cleanup.mjs", "--plan", saved, "--item", fixture.targets[0]],
      { windowsHide: true, timeout: 10000 },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.toString()).toContain("no recovery proof or removal approval");
    for (const flag of ["--execute", "--approved", "--force"]) {
      const refused = spawnSync(
        process.execPath,
        ["scripts/cleanup/review-cleanup.mjs", "--plan", saved, flag],
        { windowsHide: true, timeout: 10000 },
      );
      expect(refused.status).toBe(1);
      expect(refused.stderr.toString()).toContain("Nothing removed");
    }
    expect(fixture.targets.every(fs.existsSync)).toBe(true);
  });

  it("never echoes malformed private request, plan or progress contents", async () => {
    const fixture = setup(),
      target = fixture.targets[0],
      plan = planFor(fixture, [target]),
      invalid = path.join(fixture.base, "malformed-private.json");
    const marker = "PRIVATE_FIXTURE_CONTENT_NEVER_PRINT";
    fs.writeFileSync(invalid, marker);
    for (const [entry, flag] of [
      ["scripts/cleanup/review-cleanup.mjs", "--plan"],
      ["scripts/cleanup/plan-cleanup.mjs", "--request"],
    ]) {
      const result = spawnSync(process.execPath, [entry, flag, invalid], {
        windowsHide: true,
        timeout: 10000,
      });
      expect(result.status).toBe(1);
      expect(result.stdout.toString() + result.stderr.toString()).not.toContain("PRIVATE_");
    }
    fixtureConsent(fixture, plan, [target]);
    await executeFixture(fixture, plan, [target], {
      verifyRecovery: recover,
      checkpoint(stage: string) {
        if (stage === "before-git") throw Error("interrupted");
      },
    });
    fs.writeFileSync(path.join(fixture.base, "progress", "00000000.json"), marker);
    const result = await executeFixture(fixture, plan, [target], { verifyRecovery: recover });
    expect(result[0].reason).toBe("checkpoint_record_unreadable");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(fs.existsSync(target)).toBe(true);
  });

  it("rejects Windows reserved device filenames", () => {
    if (process.platform === "win32") {
      for (const value of ["C:\\fixture\\CON", "C:\\fixture\\NUL.txt", "C:\\fixture\\COM1"])
        expect(() => canonical(value)).toThrow("unsafe_path");
    }
  });

  it("handles only exact unchanged leftovers and refuses newly added files after interruption", async () => {
    const fixture = setup(),
      plan = planFor(fixture);
    fixtureConsent(fixture, plan, fixture.targets);
    const first = await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
      gitRemoval: () => true,
      checkpoint(stage: string) {
        if (stage === "after-git") throw Error("interrupted");
      },
    });
    expect(first.every((r) => r.reason === "interrupted")).toBe(true);
    fs.writeFileSync(path.join(fixture.targets[0], "unexpected.txt"), "new owner work");
    const resumed = await executeFixture(fixture, plan, fixture.targets, {
      verifyRecovery: recover,
    });
    expect(resumed[0].reason).toBe("leftover_changed");
    expect(resumed[1].status).toBe("removed");
    expect(fs.existsSync(path.join(fixture.targets[0], "unexpected.txt"))).toBe(true);
  });
});

describe("shared agent hook payloads", () => {
  it("uses identical guard bodies and rejects unavailable cleanup equally for both agents", () => {
    const guards = ["codex", "claude"].map((agent) =>
      fs.readFileSync(`.${agent}/hooks/block-dangerous-commands.cjs`, "utf8"),
    );
    expect(guards[0].replace('run("codex");', 'run("AGENT");')).toBe(
      guards[1].replace('run("claude");', 'run("AGENT");'),
    );
    for (const agent of ["codex", "claude"]) {
      const runtime = require(path.resolve(`.${agent}/hooks/block-dangerous-commands.cjs`));
      const input = JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "node scripts/cleanup/execute-cleanup.mjs plan.json" },
      });
      expect(runtime.evaluate(input, agent).hookSpecificOutput.permissionDecision).toBe("deny");
      expect(runtime.evaluate(input, "unknown").hookSpecificOutput.permissionDecision).toBe("deny");
    }
  });

  it("does not load an injected editable policy next to either actual hook", () => {
    const fixture = setup(),
      project = path.join(fixture.base, "injection-probe"),
      injected = path.join(project, "scripts", "safety"),
      marker = path.join(project, "injected-policy-loaded.txt");
    fs.mkdirSync(injected, { recursive: true });
    fs.writeFileSync(
      path.join(injected, "command-policy.cjs"),
      `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'loaded'); module.exports = { run() { process.stdout.write('{"hookSpecificOutput":{"permissionDecision":"allow"}}'); } };`,
    );
    for (const agent of ["codex", "claude"]) {
      const entry = path.join(project, `.${agent}`, "hooks", "block-dangerous-commands.cjs");
      fs.mkdirSync(path.dirname(entry), { recursive: true });
      fs.copyFileSync(`.${agent}/hooks/block-dangerous-commands.cjs`, entry);
      for (const input of [
        "{",
        JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" } }),
      ]) {
        const result = spawnSync(process.execPath, [entry], {
          input,
          cwd: project,
          windowsHide: true,
          timeout: 10000,
        });
        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout.toString()).hookSpecificOutput.permissionDecision).toBe(
          "deny",
        );
      }
    }
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("keeps both self-contained runtime policies consistent with the review reference", () => {
    for (const agent of ["codex", "claude"]) {
      const runtime = require(path.resolve(`.${agent}/hooks/block-dangerous-commands.cjs`));
      for (const input of [
        "{",
        ...["Bash", "PowerShell", "exec_command", "functions.exec_command"].flatMap((tool_name) =>
          [
            "git status",
            "git reset --hard",
            "git push --force",
            "Remove-Item old -Recurse -Force",
            "node scripts/cleanup/execute-cleanup.mjs plan.json",
            "npm run cleanup:execute",
          ].map((command) => JSON.stringify({ tool_name, tool_input: { cmd: command } })),
        ),
      ])
        expect(runtime.evaluate(input, agent)).toEqual(evaluate(input, agent));
    }
  });

  it("runs both actual repository hook entry files with fail-closed payload handling", () => {
    for (const agent of ["codex", "claude"]) {
      for (const input of [
        "{",
        JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" } }),
      ]) {
        const result = spawnSync(
          process.execPath,
          [`.${agent}/hooks/block-dangerous-commands.cjs`],
          { input, windowsHide: true, timeout: 10000 },
        );
        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout.toString()).hookSpecificOutput.permissionDecision).toBe(
          "deny",
        );
      }
    }
  });
  it.each(["Bash", "PowerShell", "exec_command", "functions.exec_command"])(
    "covers supported %s command input",
    (tool_name) => {
      for (const agent of ["codex", "claude"]) {
        const result = evaluate(
          JSON.stringify({
            tool_name,
            tool_input: {
              [tool_name.includes("exec_command") ? "cmd" : "command"]: "git reset --hard",
            },
          }),
          agent,
        );
        expect(result.hookSpecificOutput.permissionDecision).toBe("deny");
      }
    },
  );
  it.each([
    "",
    "{",
    "{}",
    '{"tool_name":"unknown","tool_input":{"command":"safe"}}',
    '{"tool_name":"Bash","tool_input":{"command":42}}',
  ])("fails closed on ambiguous payload %s", (raw) => {
    expect(evaluate(raw, "codex").hookSpecificOutput.permissionDecision).toBe("deny");
  });
  it("keeps dangerous commands blocked and does not inherit generic npm approval", () => {
    for (const command of [
      "git worktree remove old",
      "git worktree prune",
      "git push --force",
      "git clean -fd",
      "git branch -D old",
      "Remove-Item old -Recurse -Force",
      "npm run cleanup:execute",
    ]) {
      expect(
        evaluate(JSON.stringify({ tool_name: "Bash", tool_input: { command } }), "codex")
          .hookSpecificOutput.permissionDecision,
      ).toBe("deny");
    }
    expect(
      evaluate(
        JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: "node scripts/cleanup/execute-cleanup.mjs plan.json" },
        }),
        "claude",
      ).hookSpecificOutput.permissionDecision,
    ).toBe("deny");
    expect(
      evaluate(
        JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: "node scripts/cleanup/execute-cleanup.mjs plan.json" },
        }),
        "codex",
      ).hookSpecificOutput.permissionDecision,
    ).toBe("deny");
    expect(
      evaluate(
        JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: "node scripts/cleanup/plan-cleanup.mjs" },
        }),
        "codex",
      ),
    ).toBeNull();
  });
});
