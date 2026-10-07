import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { canonical, exists, key, noLinks, same, within } from "./paths.mjs";

export const digest = (value) => createHash("sha256").update(value).digest("hex");
export const objectDigest = (value) => digest(JSON.stringify(value));
export const fileDigest = (value) => digest(fs.readFileSync(value));
export const directoryIdentity = (value) => {
  const stat = fs.lstatSync(noLinks(value));
  if (!stat.isDirectory()) throw Error("directory_required");
  return { device: stat.dev, inode: stat.ino };
};

export function git(root, args) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], {
    cwd: root,
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.status !== 0) throw Error("read_only_git_failed");
  return result.stdout.toString("utf8").trim();
}

export function repository(root) {
  root = noLinks(root);
  if (!same(canonical(git(root, ["rev-parse", "--show-toplevel"])), root))
    throw Error("ordinary_root_required");
  const common = canonical(git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  const own = canonical(git(root, ["rev-parse", "--path-format=absolute", "--git-dir"]));
  if (!same(own, common) || !same(common, path.join(root, ".git")))
    throw Error("ordinary_checkout_required");
  noLinks(common);
  const registrations = git(root, ["worktree", "list", "--porcelain"])
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      return {
        path: canonical(lines[0].slice(9)),
        head: lines.find((l) => l.startsWith("HEAD "))?.slice(5),
        branch: lines.find((l) => l.startsWith("branch "))?.slice(7) ?? null,
        locked: lines.some((l) => l.startsWith("locked")),
      };
    });
  return { root, common, registrations };
}

export function protectedState(repo) {
  return {
    // Exclude only Codex's automatic bookkeeping refs, not owner refs.
    refs: git(repo.root, ["for-each-ref", "--format=%(refname) %(objectname)"])
      .split(/\r?\n/)
      .filter((line) => !/^refs\/codex\/turn-diffs\/(captures|checkpoints)\//.test(line)),
    stashes: git(repo.root, ["stash", "list", "--format=%H"]),
    ordinaryHead: git(repo.root, ["rev-parse", "HEAD"]),
    ordinaryIndex: exists(path.join(repo.common, "index"))
      ? fileDigest(path.join(repo.common, "index"))
      : null,
  };
}

// Includes ignored/private files and empty folders. Contents never enter the plan.
// No generated-cache exclusions: any exclusions would need a different reviewed contract.
export function inventory(root, sharedDependencies = null) {
  noLinks(root);
  const entries = [];
  function walk(folder) {
    for (const name of fs.readdirSync(folder).sort()) {
      const full = path.join(folder, name),
        stat = fs.lstatSync(full),
        relative = path.relative(root, full);
      canonical(full);
      if (stat.isSymbolicLink()) {
        const target = fs.readlinkSync(full);
        if (
          relative !== "node_modules" ||
          !sharedDependencies ||
          !same(fs.realpathSync(full), sharedDependencies)
        ) {
          throw Error("unapproved_link");
        }
        entries.push({ path: relative, type: "link", target, resolved: fs.realpathSync(full) });
      } else if (stat.isDirectory()) {
        entries.push({ path: relative, type: "directory" });
        walk(full);
      } else if (stat.isFile()) {
        if (stat.nlink !== 1) throw Error("hardlinked_file");
        entries.push({ path: relative, type: "file", size: stat.size, sha256: fileDigest(full) });
      } else throw Error("unsupported_file_type");
    }
  }
  walk(root);
  return entries;
}

export function evidence(locator, target, admin, shared) {
  if (!locator) return null;
  const result =
    /** @type {{archive: {path: string, sha256: string}, recoveryReceipt: {path: string, sha256: string}, limitations: string}} */ ({});
  for (const name of ["archive", "recoveryReceipt"]) {
    const full = noLinks(locator[name]);
    if (within(target, full) || within(admin, full) || within(shared, full))
      throw Error("preservation_inside_removal_scope");
    if (!fs.lstatSync(full).isFile()) throw Error("preservation_not_file");
    result[name] = { path: full, sha256: fileDigest(full) };
  }
  // A receipt is bound evidence, not consent or a substitute for an independent restore.
  if (typeof locator.limitations !== "string" || !locator.limitations.trim())
    throw Error("recovery_limits_required");
  result.limitations = locator.limitations;
  return result;
}

export function inspectTarget(repo, target, preservation = null) {
  target = noLinks(target);
  const registration = repo.registrations.find((r) => same(r.path, target));
  if (!registration || same(target, repo.root)) throw Error("registered_extra_required");
  if (registration.locked) throw Error("locked_worktree");
  const shared = noLinks(path.join(repo.root, "node_modules"));
  if (!fs.lstatSync(shared).isDirectory()) throw Error("shared_dependencies_not_directory");
  for (const protectedPath of [
    repo.common,
    shared,
    path.join(repo.root, ".private-backups"),
    path.join(repo.root, ".codex"),
    path.join(repo.root, ".agents"),
  ]) {
    if (within(protectedPath, target) || within(target, protectedPath))
      throw Error("protected_target");
  }
  const privateRoot = path.join(repo.root, ".release-evidence");
  if (within(privateRoot, target) && !within(path.join(privateRoot, "worktrees"), target))
    throw Error("protected_evidence");
  for (const other of repo.registrations) {
    if (
      !same(other.path, target) &&
      !same(other.path, repo.root) &&
      (within(target, other.path) || within(other.path, target))
    )
      throw Error("overlapping_worktrees");
  }
  const admin = noLinks(
    canonical(git(target, ["rev-parse", "--path-format=absolute", "--git-dir"])),
  );
  if (!same(path.dirname(admin), path.join(repo.common, "worktrees")))
    throw Error("unsafe_admin_path");
  if (
    !same(
      canonical(git(target, ["rev-parse", "--path-format=absolute", "--git-common-dir"])),
      repo.common,
    )
  )
    throw Error("different_repository");
  const pointer = fs.readFileSync(path.join(target, ".git"), "utf8").trim();
  if (
    !same(canonical(pointer.replace(/^gitdir: /, "")), admin) ||
    !same(
      canonical(fs.readFileSync(path.join(admin, "gitdir"), "utf8").trim()),
      path.join(target, ".git"),
    )
  )
    throw Error("git_pointer_mismatch");
  const stage = git(target, ["ls-files", "--stage"]),
    flags = git(target, ["ls-files", "-v"]);
  if (/^160000 /m.test(stage)) throw Error("submodules_unsupported");
  if (/^[a-zS]/m.test(flags)) throw Error("hidden_index_changes");
  const status = git(target, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const files = inventory(target, shared),
    adminFiles = inventory(admin);
  const state = {
    path: target,
    admin,
    identity: {
      working: directoryIdentity(target),
      administration: directoryIdentity(admin),
      shared: directoryIdentity(shared),
    },
    worktreeId: path.basename(admin),
    head: git(target, ["rev-parse", "HEAD"]),
    branch: registration.branch,
    status,
    index: fileDigest(path.join(admin, "index")),
    files,
    adminFiles,
  };
  const recovery = evidence(preservation, target, admin, shared);
  return {
    ...state,
    recovery,
    executable: !status && !!recovery,
    stateDigest: objectDigest(state),
  };
}

export function inspect(root, targets = []) {
  const repo = repository(root);
  if (!targets.length) return { repository: repo, protected: protectedState(repo) };
  const items = targets.map((t) => inspectTarget(repo, t.path, t.preservation));
  if (new Set(items.map((i) => key(i.path))).size !== items.length) throw Error("duplicate_target");
  return { repository: repo, protected: protectedState(repo), items };
}
