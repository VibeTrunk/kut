import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  inspectTarget,
  inventory,
  fileDigest,
  objectDigest,
  protectedState,
  repository,
  directoryIdentity,
} from "./inspect.mjs";
import { approvalView, validatePlan } from "./plan.mjs";
import { exists, noLinks, same, within } from "./paths.mjs";
import { authorizeItem, operationScope, runtimeServices } from "./runtime-adapters.mjs";

const phases = new Set([
  "links",
  "git",
  "git-running",
  "leftovers",
  "refused",
  "complete",
  "owner-refused",
]);

function subset(folder, expected, shared) {
  noLinks(folder, { missing: true });
  if (!exists(folder)) return [];
  const actual = inventory(folder, shared);
  const original = new Map(expected.map((e) => [e.path, JSON.stringify(e)]));
  if (actual.some((e) => original.get(e.path) !== JSON.stringify(e)))
    throw Error("leftover_changed");
  return actual;
}

function evidence(item) {
  for (const locator of [item.recovery.archive, item.recovery.recoveryReceipt]) {
    noLinks(locator.path);
    if (fileDigest(locator.path) !== locator.sha256) throw Error("recovery_evidence_changed");
  }
}

function boundaries(repo, item) {
  noLinks(item.path, { missing: true });
  noLinks(item.admin, { missing: true });
  if (!item.identity) throw Error("path_identity_required");
  for (const [folder, identity] of [
    [item.path, item.identity.working],
    [item.admin, item.identity.administration],
    [path.join(repo.root, "node_modules"), item.identity.shared],
  ])
    if (exists(folder) && objectDigest(directoryIdentity(folder)) !== objectDigest(identity))
      throw Error("path_identity_changed");
  if (!same(path.dirname(item.admin), path.join(repo.common, "worktrees")))
    throw Error("unsafe_admin_path");
  for (const protectedPath of [repo.root, repo.common, path.join(repo.root, "node_modules")]) {
    if (same(protectedPath, item.path) || within(item.path, protectedPath))
      throw Error("protected_target");
  }
  if (within(repo.common, item.path)) throw Error("protected_target");
  for (const name of [".private-backups", ".codex", ".agents"])
    if (within(path.join(repo.root, name), item.path)) throw Error("protected_target");
  if (
    within(path.join(repo.root, ".release-evidence"), item.path) &&
    !within(path.join(repo.root, ".release-evidence", "worktrees"), item.path)
  )
    throw Error("protected_evidence");
  for (const other of repo.registrations) {
    if (
      !same(other.path, item.path) &&
      !same(other.path, repo.root) &&
      (within(other.path, item.path) || within(item.path, other.path))
    )
      throw Error("overlapping_worktrees");
  }
  if (repo.registrations.find((r) => same(r.path, item.path))?.locked)
    throw Error("locked_worktree");
}

function survivingState(repo, item, phase) {
  const current = inspectTarget(repo, item.path, {
    archive: item.recovery.archive.path,
    recoveryReceipt: item.recovery.recoveryReceipt.path,
    limitations: item.recovery.limitations,
  });
  for (const name of ["path", "admin", "head", "branch", "status", "index"])
    if (current[name] !== item[name]) throw Error("target_state_changed");
  const links = item.files.filter((e) => e.type === "link");
  const actualLinks = current.files.filter((e) => e.type === "link");
  if (phase === "git" && actualLinks.length) throw Error("target_state_changed");
  if (
    actualLinks.some(
      (e) => !links.some((original) => JSON.stringify(e) === JSON.stringify(original)),
    )
  )
    throw Error("target_state_changed");
  if (
    JSON.stringify(current.files.filter((e) => e.type !== "link")) !==
      JSON.stringify(item.files.filter((e) => e.type !== "link")) ||
    JSON.stringify(current.adminFiles) !== JSON.stringify(item.adminFiles)
  )
    throw Error("target_state_changed");
}

function normalGitRemoval(root, target) {
  const result = spawnSync("git", ["worktree", "remove", "--", target], {
    cwd: root,
    windowsHide: true,
    timeout: 30000,
    stdio: "pipe",
  });
  if (result.error || result.signal || result.status === null)
    throw Error("normal_git_outcome_unknown_no_fallback");
  return result.status === 0;
}

/** Real engine: no fixture root, caller-defined deletion callback or force mode.
 * The host enforces consent, live route coverage, isolated scope and durable
 * compare-and-swap progress. Recovery is mandatory and independent of receipts.
 * faultPoint is for interruption testing; it cannot grant consent or remove.
 * @param {object} runtime
 * @param {object} plan
 * @param {string[]} selected
 * @param {{verifyRecovery?: (item: ReturnType<typeof inspectTarget>) => string | false | Promise<string | false>, faultPoint?: (stage: string, item: ReturnType<typeof inspectTarget>) => void | Promise<void>}} options
 * @returns {Promise<{path: string, status: string, reason?: string, message: string}[]>}
 */
export async function executeCleanup(
  runtime,
  plan,
  selected,
  { verifyRecovery, faultPoint = () => {} } = {},
) {
  if (
    Object.keys(process.env).some((name) =>
      /^GIT_(DIR|WORK_TREE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|INDEX_FILE|CONFIG_COUNT|CONFIG_KEY_|CONFIG_VALUE_)/.test(
        name,
      ),
    )
  )
    throw Error("git_environment_override");
  validatePlan(plan);
  approvalView(plan, selected);
  const { agent, services } = runtimeServices(runtime);
  await services.assertCoverage(agent);
  if (typeof verifyRecovery !== "function") throw Error("independent_recovery_required");
  return services.exclusive(plan.repository.common, async () => {
    const results = [];
    for (const item of plan.items.filter((i) => selected.includes(i.path))) {
      try {
        if (!item.executable || !item.recovery) throw Error("dirty_or_missing_preservation");
        const contract = { path: item.path, digest: item.approvalDigest };
        let journal = await services.load(contract);
        if (journal && !phases.has(journal.phase)) throw Error("checkpoint_invalid");
        const guard = () => {
          const repo = repository(plan.repository.root);
          if (!same(repo.common, plan.repository.common))
            throw Error("repository_boundary_changed");
          if (objectDigest(protectedState(repo)) !== objectDigest(plan.protected))
            throw Error("protected_state_changed");
          boundaries(repo, item);
          evidence(item);
          return repo;
        };
        const repo = guard();
        // Recovery precedes the owner prompt. Even restart must cold-verify it.
        if ((await verifyRecovery(item)) !== item.stateDigest)
          throw Error("independent_recovery_required");
        guard();
        if (!journal) {
          const current = inspectTarget(repo, item.path, {
            archive: item.recovery.archive.path,
            recoveryReceipt: item.recovery.recoveryReceipt.path,
            limitations: item.recovery.limitations,
          });
          if (current.stateDigest !== item.stateDigest) throw Error("target_state_changed");
        }
        journal = await authorizeItem(runtime, plan, item, journal);
        const save = async (phase) => {
          const next = { ...journal, phase };
          await services.save(contract, journal, next);
          journal = next;
        };
        // No command-level/global escape: host runs this body in exactly the
        // named working/admin scope or refuses before any mutation.
        await services.withScope(operationScope(item), async () => {
          const shared = noLinks(path.join(repo.root, "node_modules"));
          if (journal.phase === "links") {
            survivingState(guard(), item, "links");
            for (const link of item.files.filter((e) => e.type === "link")) {
              const full = path.join(item.path, link.path);
              if (exists(full)) {
                survivingState(guard(), item, "links");
                noLinks(full, { leafLink: true });
                fs.unlinkSync(full);
                await faultPoint("link", item);
              }
            }
            await save("git");
          }
          if (journal.phase === "git") {
            await faultPoint("before-git", item);
            survivingState(guard(), item, "git");
            await save("git-running");
            const success = normalGitRemoval(repo.root, item.path);
            await save(success ? "leftovers" : "refused");
            await faultPoint(success ? "after-git" : "git-refused", item);
          }
          if (journal.phase === "refused") throw Error("normal_git_refused_no_fallback");
          if (journal.phase === "git-running") {
            guard();
            if (
              exists(item.path) ||
              exists(item.admin) ||
              repository(repo.root).registrations.some((r) => same(r.path, item.path))
            )
              throw Error("normal_git_outcome_unknown_no_fallback");
            await save("complete");
          }
          if (journal.phase === "leftovers") {
            // A known successful Git result permits only named unchanged leaves,
            // then empty directories. Refused/unknown results never reach here.
            for (const [folder, expected, dependencies] of [
              [item.path, item.files.filter((e) => e.type !== "link"), shared],
              [item.admin, item.adminFiles, null],
            ]) {
              guard();
              const actual = subset(folder, expected, dependencies);
              for (const entry of actual.filter((e) => e.type !== "directory")) {
                guard();
                subset(folder, expected, dependencies);
                if (entry.type !== "file") throw Error("unexpected_leftover_link");
                fs.unlinkSync(noLinks(path.join(folder, entry.path)));
                await faultPoint("leftover-file", item);
              }
              for (const entry of actual
                .filter((e) => e.type === "directory")
                .sort((a, b) => b.path.length - a.path.length)) {
                guard();
                subset(folder, expected, dependencies);
                fs.rmdirSync(noLinks(path.join(folder, entry.path)));
                await faultPoint("leftover-folder", item);
              }
              if (exists(folder)) {
                guard();
                subset(folder, expected, dependencies);
                fs.rmdirSync(noLinks(folder));
                await faultPoint("leftover-root", item);
              }
            }
            await save("complete");
          }
          guard();
          if (
            exists(item.path) ||
            exists(item.admin) ||
            repository(repo.root).registrations.some((r) => same(r.path, item.path))
          )
            throw Error("unfinished_removal");
        });
        results.push({
          path: item.path,
          status: "removed",
          message:
            "The named old copy, shortcut and Git records are gone. Recovery passed; saved work and shared files remain.",
        });
      } catch (error) {
        // Never disclose tool stderr, file content or credential values.
        const reason = /^[a-z][a-z0-9_]+$/.test(error.message) ? error.message : "cleanup_stopped";
        results.push({
          path: item.path,
          status: "stopped",
          reason,
          message:
            "This copy stopped. No broader removal was attempted; check the unfinished part before resuming.",
        });
      }
    }
    return results;
  });
}
