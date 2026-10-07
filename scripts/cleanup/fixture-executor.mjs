// Disposable execution proof only. There is deliberately no caller-supplied
// repository parameter: the capability is minted for a fresh temporary repo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { inspectTarget, inventory, objectDigest, protectedState, repository } from "./inspect.mjs";
import { approvalView, validatePlan } from "./plan.mjs";
import { exists, noLinks, same, within } from "./paths.mjs";
import { newCheckpointStore, readCheckpoints, saveCheckpoint } from "./checkpoints.mjs";

const capabilities = new WeakMap();

function fixtureGit(root, args) {
  const result = spawnSync(
    "git",
    ["-c", "user.name=Cleanup Fixture", "-c", "user.email=fixture@invalid", ...args],
    {
      cwd: root,
      windowsHide: true,
      timeout: 30000,
      stdio: "pipe",
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
    },
  );
  if (result.status !== 0) throw Error("fixture_git_failed");
}

export function newFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "kut-cleanup-fixture-"));
  const root = path.join(base, "ordinary");
  fs.mkdirSync(root);
  fixtureGit(root, ["init", "-q"]);
  fs.writeFileSync(path.join(root, "content.txt"), "Disposable fixture, never owner data.\n");
  // A trailing slash excludes directories only; POSIX directory symlinks are
  // separate Git entries. Ignore either representation in this artificial repo.
  fs.writeFileSync(path.join(root, ".gitignore"), "node_modules\ncache/\n");
  fixtureGit(root, ["add", "content.txt", ".gitignore"]);
  fixtureGit(root, ["commit", "-q", "-m", "disposable fixture"]);
  fs.mkdirSync(path.join(root, "node_modules"));
  fs.writeFileSync(path.join(root, "node_modules", "sentinel.txt"), "shared fixture dependencies");
  const targets = ["one", "two"].map((name) => {
    const target = path.join(base, name);
    fixtureGit(root, ["worktree", "add", "-q", "--detach", target]);
    return target;
  });
  const capability = Object.freeze({ root, base, targets });
  capabilities.set(capability, {
    root,
    base,
    authority: new Map(),
    checkpoints: newCheckpointStore(path.join(base, "progress")),
  });
  return capability;
}

// A simulated UI event for fixture testing, NOT an owner-approval facility.
// This cannot authorize a real repository; there is no receipt/env/flag loader.
export function fixtureConsent(capability, plan, selected) {
  const runtime = capabilities.get(capability);
  if (!runtime || !same(plan.repository.root, runtime.root))
    throw Error("fixture_capability_required");
  approvalView(plan, selected);
  for (const item of plan.items.filter((i) => selected.includes(i.path)))
    runtime.authority.set(item.path, item.approvalDigest);
}

function assertSubset(root, expected, shared) {
  if (!exists(root)) return [];
  const actual = inventory(root, shared);
  const original = new Map(expected.map((e) => [e.path, JSON.stringify(e)]));
  if (actual.some((e) => original.get(e.path) !== JSON.stringify(e)))
    throw Error("leftover_changed");
  return actual;
}

// Exact files, then empty directories. No recursive/forced filesystem deletion,
// ACL manipulation, command wrapper or traversal into a dependency target.
function removeManifest(root, expected, shared, checkpoint) {
  const actual = assertSubset(root, expected, shared);
  if (!exists(root)) return;
  for (const entry of actual.filter((e) => e.type !== "directory")) {
    const full = path.join(root, entry.path);
    noLinks(full, { leafLink: entry.type === "link" });
    // Revalidate the whole remaining manifest before every mutation.
    assertSubset(root, expected, shared);
    if (entry.type === "link") throw Error("unexpected_leftover_link");
    fs.unlinkSync(full);
    checkpoint("leftover-file");
  }
  for (const entry of actual
    .filter((e) => e.type === "directory")
    .sort((a, b) => b.path.length - a.path.length)) {
    const full = noLinks(path.join(root, entry.path));
    fs.rmdirSync(full);
    checkpoint("leftover-folder");
  }
  noLinks(root);
  fs.rmdirSync(root);
  checkpoint("leftover-root");
}

/**
 * @param {object} capability
 * @param {object} plan
 * @param {string[]} selected
 * @param {{verifyRecovery?: (item: ReturnType<typeof inspectTarget>) => string | false | Promise<string | false>, checkpoint?: (stage: string) => void, gitRemoval?: (root: string, target: string) => boolean}} options
 */
export async function executeFixture(
  capability,
  plan,
  selected,
  { verifyRecovery, checkpoint = () => {}, gitRemoval } = {},
) {
  const runtime = capabilities.get(capability);
  if (!runtime || !same(plan?.repository?.root, runtime.root))
    throw Error("fixture_capability_required");
  validatePlan(plan);
  approvalView(plan, selected);
  const repo = repository(runtime.root),
    shared = path.join(repo.root, "node_modules");
  const protectedBefore = objectDigest(protectedState(repo)),
    results = [];
  for (const item of plan.items.filter((i) => selected.includes(i.path))) {
    try {
      if (runtime.authority.get(item.path) !== item.approvalDigest)
        throw Error("specific_owner_consent_missing");
      if (!item.executable) throw Error("dirty_or_missing_preservation");
      if (
        !within(runtime.base, item.path) ||
        same(item.path, runtime.base) ||
        !within(path.join(repo.common, "worktrees"), item.admin)
      )
        throw Error("outside_fixture");
      if (objectDigest(protectedState(repo)) !== protectedBefore)
        throw Error("protected_state_changed");
      for (const locator of [item.recovery.archive, item.recovery.recoveryReceipt]) {
        noLinks(locator.path);
        const { fileDigest } = await import("./inspect.mjs");
        if (fileDigest(locator.path) !== locator.sha256) throw Error("recovery_evidence_changed");
      }
      if (typeof verifyRecovery !== "function" || (await verifyRecovery(item)) !== item.stateDigest)
        throw Error("independent_recovery_required");
      let journal = readCheckpoints(runtime.checkpoints, item.path).get(item.path);
      if (!journal) {
        const current = inspectTarget(repository(repo.root), item.path, {
          archive: item.recovery.archive.path,
          recoveryReceipt: item.recovery.recoveryReceipt.path,
          limitations: item.recovery.limitations,
        });
        if (
          current.stateDigest !== item.stateDigest ||
          JSON.stringify(current.recovery) !== JSON.stringify(item.recovery)
        )
          throw Error("target_state_changed");
        journal = { phase: "links", digest: item.approvalDigest };
        saveCheckpoint(runtime.checkpoints, item.path, journal);
      }
      if (journal.digest !== item.approvalDigest) throw Error("resume_contract_changed");
      const linkNames = item.files.filter((e) => e.type === "link").map((e) => e.path);
      if (journal.phase === "links") {
        // Only an approved absent link is an expected interruption here; all other
        // content, HEAD and index must still be present and match exactly.
        const actual = assertSubset(item.path, item.files, shared);
        const expected = item.files.filter((e) => !linkNames.includes(e.path));
        if (
          JSON.stringify(actual.filter((e) => !linkNames.includes(e.path))) !==
            JSON.stringify(expected) ||
          JSON.stringify(inventory(item.admin)) !== JSON.stringify(item.adminFiles)
        )
          throw Error("target_state_changed");
        for (const entry of item.files.filter((e) => e.type === "link")) {
          const full = path.join(item.path, entry.path);
          if (exists(full)) {
            noLinks(full, { leafLink: true });
            fs.unlinkSync(full);
            checkpoint("link");
          }
        }
        journal.phase = "git";
        saveCheckpoint(runtime.checkpoints, item.path, journal);
      }
      if (journal.phase === "git") {
        checkpoint("before-git");
        // Recheck after an interruption point and immediately before Git.
        if (
          JSON.stringify(inventory(item.path)) !==
            JSON.stringify(item.files.filter((e) => e.type !== "link")) ||
          JSON.stringify(inventory(item.admin)) !== JSON.stringify(item.adminFiles)
        )
          throw Error("target_state_changed");
        // A lost/throwing Git subprocess has an unknown outcome, not permission
        // to proceed to filesystem leftovers. Record intent before starting it.
        journal.phase = "git-running";
        saveCheckpoint(runtime.checkpoints, item.path, journal);
        const remove =
          gitRemoval ??
          ((root, target) => {
            const result = spawnSync("git", ["worktree", "remove", "--", target], {
              cwd: root,
              windowsHide: true,
              timeout: 30000,
            });
            return result.status === 0;
          });
        const success = remove(repo.root, item.path);
        journal.phase = success ? "leftovers" : "refused";
        saveCheckpoint(runtime.checkpoints, item.path, journal);
        checkpoint(success ? "after-git" : "git-refused");
        // A Windows/policy refusal is not an invitation to fallback. Fallback is
        // tested only for an explicitly simulated partial Git operation below.
        if (!success) {
          throw Error("normal_git_refused_no_fallback");
        }
      }
      if (journal.phase === "git-running") {
        // Only total absence plus removed registration proves completion after
        // loss of the subprocess result. Remaining files never trigger fallback.
        if (
          exists(item.path) ||
          exists(item.admin) ||
          repository(repo.root).registrations.some((entry) => same(entry.path, item.path))
        )
          throw Error("normal_git_outcome_unknown_no_fallback");
        journal.phase = "complete";
        saveCheckpoint(runtime.checkpoints, item.path, journal);
      }
      if (journal.phase === "refused") throw Error("normal_git_refused_no_fallback");
      if (journal.phase === "leftovers") {
        // No registry pruning: only the exact administration directory named in
        // the plan. Its unchanged remaining HEAD/index/pointers are hash checked.
        removeManifest(
          item.path,
          item.files.filter((e) => e.type !== "link"),
          shared,
          checkpoint,
        );
        removeManifest(item.admin, item.adminFiles, null, checkpoint);
        journal.phase = "complete";
        saveCheckpoint(runtime.checkpoints, item.path, journal);
      }
      if (exists(item.path) || exists(item.admin)) throw Error("unfinished_removal");
      if (objectDigest(protectedState(repo)) !== protectedBefore)
        throw Error("protected_state_changed");
      if (repository(repo.root).registrations.some((r) => same(r.path, item.path)))
        throw Error("registration_remains");
      results.push({
        path: item.path,
        status: "removed",
        message:
          "The old copy and its named Git records were removed. Recovery passed; branches, stashes and shared files remain.",
      });
    } catch (error) {
      results.push({
        path: item.path,
        status: "stopped",
        reason: error.message,
        message:
          "This item stopped. Saved work and shared files remain protected; inspect the unfinished part before resuming.",
      });
    }
  }
  return results;
}

// Test teardown also refuses real paths. Walks only this newly minted fixture,
// unlinks leaf links without visiting them, and never uses recursive rm/force.
export function disposeFixture(capability) {
  const runtime = capabilities.get(capability);
  if (!runtime) throw Error("fixture_capability_required");
  noLinks(runtime.base);
  function walk(folder) {
    for (const name of fs.readdirSync(folder)) {
      const full = path.join(folder, name),
        stat = fs.lstatSync(full);
      if (stat.isDirectory() && !stat.isSymbolicLink()) walk(full);
      else fs.unlinkSync(full);
    }
    fs.rmdirSync(folder);
  }
  walk(runtime.base);
  capabilities.delete(capability);
}
