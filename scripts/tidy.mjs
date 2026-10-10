#!/usr/bin/env node
// Archive-first tidy for local Git state (process reset S7, ADR-142).
//
// A dry run by default: it lists local branches, worktrees (detached ones
// included) and stashes by commit ID, plus each worktree's untracked and
// ignored files, which it never deletes. With `--apply` it first bundles every
// selected item into the archive, proves the bundle by fetching it into an
// empty repository, then rechecks each item and removes only the unchanged
// ones. Dirty worktrees are refused; the owner decides those.
//
// `--apply` must be the first argument and every selection must carry the SHA
// the dry run printed, so the agents' approval rules match the exact command.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const PROTECTED_BRANCHES = new Set(["main"]);
const SHA = /^[0-9a-f]{40}$/;
const ZERO = "0".repeat(40);

export function git(cwd, args, { allowFail = false } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFail)
    throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`);
  return result;
}

const read = (cwd, args) => git(cwd, args).stdout.replace(/\r?\n$/, "");
const lines = (text) => text.split(/\r?\n/).filter(Boolean);

function samePath(a, b) {
  const norm = (p) => {
    let full = path.resolve(p);
    try {
      full = fs.realpathSync.native(full);
    } catch {
      // A missing directory keeps its resolved path.
    }
    return process.platform === "win32" ? full.toLowerCase() : full;
  };
  return norm(a) === norm(b);
}

function worktreeStatus(dir) {
  const raw = read(dir, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=normal",
    "--ignored=traditional",
  ]);
  const status = { changed: [], untracked: [], ignored: [] };
  const entries = raw.split("\0");
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const code = entry.slice(0, 2);
    const file = entry.slice(3);
    if (code === "??") status.untracked.push(file);
    else if (code === "!!") status.ignored.push(file);
    else {
      status.changed.push(file);
      if (/[RC]/.test(code)) i++; // the original path follows a rename or copy
    }
  }
  return status;
}

function listWorktrees(root) {
  const records = [];
  let current = null;
  for (const field of read(root, ["worktree", "list", "--porcelain", "-z"]).split("\0")) {
    if (!field) {
      if (current) records.push(current);
      current = null;
      continue;
    }
    const [key, ...rest] = field.split(" ");
    const value = rest.join(" ");
    if (key === "worktree") current = { path: path.resolve(value), branch: null, detached: false };
    else if (key === "HEAD") current.sha = value;
    else if (key === "branch") current.branch = value.replace(/^refs\/heads\//, "");
    else if (key === "detached") current.detached = true;
    else if (key === "bare") current.bare = true;
    else if (key === "locked") current.locked = value || true;
    else if (key === "prunable") current.prunable = value || true;
  }
  if (current) records.push(current);
  return records.map((wt, index) => ({
    ...wt,
    main: index === 0,
    status: wt.bare || wt.prunable ? null : worktreeStatus(wt.path),
  }));
}

function listStashes(root) {
  return lines(read(root, ["stash", "list", "--format=%H%x09%gd%x09%gs"])).map((line) => {
    const [sha, ref, ...message] = line.split("\t");
    return { sha, ref, message: message.join("\t") };
  });
}

export function inventory(repo, { remote = false, remoteName = "origin" } = {}) {
  const root = path.resolve(read(repo, ["rev-parse", "--show-toplevel"]));
  const baseRef = [`refs/remotes/${remoteName}/main`, "refs/heads/main"].find(
    (ref) => git(root, ["rev-parse", "--verify", "--quiet", ref], { allowFail: true }).status === 0,
  );
  const branches = lines(
    read(root, [
      "for-each-ref",
      "--format=%(refname)%00%(objectname)%00%(upstream:short)%00%(upstream:track)",
      "refs/heads",
    ]),
  ).map((line) => {
    const [ref, sha, upstream, track] = line.split("\0");
    const ahead = baseRef
      ? Number(read(root, ["rev-list", "--count", `${baseRef}..${sha}`]))
      : null;
    return {
      name: ref.slice("refs/heads/".length),
      sha,
      upstream: upstream || null,
      upstreamGone: track === "[gone]",
      aheadOfMain: ahead,
    };
  });
  const remoteBranches = remote
    ? lines(read(root, ["ls-remote", "--heads", remoteName])).map((line) => {
        const [sha, ref] = line.split("\t");
        return { name: ref.slice("refs/heads/".length), sha };
      })
    : null;
  return {
    root,
    baseRef: baseRef ?? null,
    remoteName,
    branches,
    worktrees: listWorktrees(root),
    stashes: listStashes(root),
    remoteBranches,
  };
}

function splitSpec(spec) {
  const at = spec.lastIndexOf("=");
  if (at <= 0) return { key: spec, expected: null };
  return { key: spec.slice(0, at), expected: spec.slice(at + 1).toLowerCase() };
}

function dirty(status) {
  if (!status) return "directory missing or unreadable";
  const parts = [];
  if (status.changed.length) parts.push(`${status.changed.length} changed`);
  if (status.untracked.length) parts.push(`${status.untracked.length} untracked`);
  if (status.ignored.length) parts.push(`${status.ignored.length} ignored`);
  return parts.length ? `not clean (${parts.join(", ")}); the owner decides` : null;
}

/**
 * @typedef {{ branches?: string[], worktrees?: string[], stashes?: string[], remoteBranches?: string[] }} Selection
 * @typedef {{ kind: string, name: string, expected?: string | null, sha?: string,
 *   branch?: string | null, message?: string, ref?: string, refused?: string,
 *   stopped?: string | null, removed?: boolean }} Item
 */

// Turns the requested selection into items that are either ok or refused.
/** @returns {Item[]} */
export function check(
  /** @type {ReturnType<typeof inventory>} */ inv,
  /** @type {Selection} */ selection,
  { apply = false } = {},
) {
  /** @type {Item[]} */
  const items = [];
  const shaProblem = (expected, current) => {
    if (expected === null) return apply ? "give the SHA from the dry run (name=<sha>)" : null;
    if (!SHA.test(expected)) return "expected a full 40-character SHA";
    if (expected !== current) return `changed since the inventory (now ${current})`;
    return null;
  };
  const selectedWorktrees = [];
  for (const spec of selection.worktrees ?? []) {
    const { key, expected } = splitSpec(spec);
    const wt = inv.worktrees.find((w) => samePath(w.path, key));
    const item = { kind: "worktree", name: path.resolve(key), expected };
    if (!wt) item.refused = "no such worktree";
    else {
      Object.assign(item, { name: wt.path, sha: wt.sha, branch: wt.branch });
      item.refused = wt.main
        ? "the main worktree is never removed"
        : wt.prunable
          ? "worktree directory is missing; the owner decides"
          : wt.locked
            ? "worktree is locked"
            : (shaProblem(expected, wt.sha) ?? dirty(wt.status));
      if (!item.refused) selectedWorktrees.push(wt);
    }
    items.push(item);
  }
  for (const spec of selection.branches ?? []) {
    const { key, expected } = splitSpec(spec);
    const branch = inv.branches.find((b) => b.name === key);
    const item = { kind: "branch", name: key, expected };
    if (!branch) item.refused = "no such local branch";
    else {
      item.sha = branch.sha;
      const holder = inv.worktrees.find((w) => w.branch === key && !selectedWorktrees.includes(w));
      item.refused = PROTECTED_BRANCHES.has(key)
        ? "protected branch"
        : holder
          ? `checked out in ${holder.path}`
          : shaProblem(expected, branch.sha);
    }
    items.push(item);
  }
  for (const spec of selection.stashes ?? []) {
    const sha = spec.toLowerCase();
    const stash = inv.stashes.find((s) => s.sha === sha);
    const item = { kind: "stash", name: sha, sha, expected: sha };
    if (!SHA.test(sha)) item.refused = "a stash is selected by its full commit ID";
    else if (!stash) item.refused = "no stash with that commit ID";
    else item.message = stash.message;
    items.push(item);
  }
  for (const spec of selection.remoteBranches ?? []) {
    const { key, expected } = splitSpec(spec);
    const item = { kind: "remote-branch", name: key, expected };
    const remoteBranch = inv.remoteBranches?.find((b) => b.name === key);
    if (!inv.remoteBranches) item.refused = "remote branches need --remote";
    else if (!remoteBranch) item.refused = `no such branch on ${inv.remoteName}`;
    else {
      item.sha = remoteBranch.sha;
      item.refused = PROTECTED_BRANCHES.has(key)
        ? "protected branch"
        : shaProblem(expected, remoteBranch.sha);
    }
    items.push(item);
  }
  for (const item of items) if (!item.refused) delete item.refused;
  return items;
}

function stampNow() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}

function refFor(ns, item, index) {
  if (item.kind === "branch") return `${ns}/heads/${item.name}`;
  if (item.kind === "remote-branch") return `${ns}/remote/${item.name}`;
  if (item.kind === "stash") return `${ns}/stashes/${item.sha}`;
  return `${ns}/worktrees/${index}`;
}

// Bundles every ok item and proves the bundle in an empty repository.
export function preserve(inv, items, archiveDir) {
  const ok = items.filter((item) => !item.refused);
  if (!ok.length) return null;
  const stamp = stampNow();
  const ns = `refs/tidy/${stamp}`;
  const created = [];
  try {
    ok.forEach((item, index) => {
      item.ref = refFor(ns, item, index);
      if (item.kind === "remote-branch") {
        // The remote tip may hold commits this repository never fetched.
        git(inv.root, [
          "fetch",
          "--no-tags",
          "--quiet",
          inv.remoteName,
          `refs/heads/${item.name}:${item.ref}`,
        ]);
        created.push(item.ref);
        const fetched = read(inv.root, ["rev-parse", item.ref]);
        if (fetched !== item.sha) item.refused = `changed while fetching (now ${fetched})`;
      } else {
        git(inv.root, ["update-ref", item.ref, item.sha, ZERO]);
        created.push(item.ref);
      }
    });
    const kept = ok.filter((item) => !item.refused);
    if (!kept.length) return null;
    fs.mkdirSync(archiveDir, { recursive: true });
    const name = `tidy-${path.basename(inv.root)}-${stamp}`;
    const bundle = path.join(archiveDir, `${name}.bundle`);
    const manifestPath = path.join(archiveDir, `${name}.json`);
    if (fs.existsSync(bundle) || fs.existsSync(manifestPath))
      throw new Error(`archive file already exists: ${bundle}`);
    git(inv.root, ["bundle", "create", "--quiet", bundle, ...kept.map((item) => item.ref)]);
    verifyBundle(bundle, kept);
    const manifest = {
      createdAt: new Date().toISOString(),
      repository: inv.root,
      bundle: path.basename(bundle),
      sha256: createHash("sha256").update(fs.readFileSync(bundle)).digest("hex"),
      items: kept.map(({ kind, name, sha, ref, branch, message }) => ({
        kind,
        name,
        sha,
        ref,
        ...(branch ? { branch } : {}),
        ...(message ? { message } : {}),
      })),
      restore: [
        `git fetch "<path>/${path.basename(bundle)}" "${ns}/*:${ns}/*"`,
        "Branch: git branch <name> <sha>. Stash: git stash store -m <message> <sha>.",
        "Worktree: git worktree add <path> <sha>. Remote branch: push <sha> to it.",
      ],
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    return { bundle, manifest: manifestPath };
  } finally {
    for (const ref of created) git(inv.root, ["update-ref", "-d", ref], { allowFail: true });
  }
}

export function verifyBundle(bundle, items) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tidy-verify-"));
  try {
    git(temp, ["init", "--bare", "--quiet", "."]);
    git(temp, ["bundle", "verify", "--quiet", bundle]);
    git(temp, ["fetch", "--quiet", bundle, ...items.map((item) => `${item.ref}:${item.ref}`)]);
    for (const item of items) {
      const sha = read(temp, ["rev-parse", item.ref]);
      if (sha !== item.sha) throw new Error(`bundle check failed for ${item.kind} ${item.name}`);
    }
    git(temp, ["fsck", "--connectivity-only", "--no-dangling", "--no-progress"]);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

// Rechecks each preserved item against the live state, then removes it.
export function remove(inv, items) {
  const ok = items.filter((item) => !item.refused && item.ref);
  const order = ["worktree", "branch", "stash", "remote-branch"];
  ok.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const item of ok) {
    try {
      item.stopped = removeOne(inv, item);
    } catch (error) {
      item.stopped = error.message;
    }
    if (!item.stopped) item.removed = true;
    else delete item.removed;
  }
  for (const item of ok) if (!item.stopped) delete item.stopped;
}

function removeOne(inv, item) {
  if (item.kind === "worktree") {
    const wt = listWorktrees(inv.root).find((w) => samePath(w.path, item.name));
    if (!wt) return "worktree is gone";
    if (wt.sha !== item.sha) return `changed since the inventory (now ${wt.sha})`;
    if (wt.branch !== item.branch) return "checked-out branch changed since the inventory";
    if (wt.locked) return "worktree is locked";
    const why = dirty(wt.status);
    if (why) return why;
    git(inv.root, ["worktree", "remove", wt.path]);
    return null;
  }
  if (item.kind === "branch") {
    const holder = listWorktrees(inv.root).find((w) => w.branch === item.name);
    if (holder) return `checked out in ${holder.path}`;
    // update-ref deletes only if the branch still points at the bundled SHA.
    const result = git(inv.root, ["update-ref", "-d", `refs/heads/${item.name}`, item.sha], {
      allowFail: true,
    });
    if (result.status !== 0) return "changed since the inventory";
    git(inv.root, ["config", "--remove-section", `branch.${item.name}`], { allowFail: true });
    return null;
  }
  if (item.kind === "stash") {
    // Stash indexes shift; find this commit's current position.
    const stash = listStashes(inv.root).find((s) => s.sha === item.sha);
    if (!stash) return "stash is gone";
    const output = read(inv.root, ["stash", "drop", stash.ref]);
    const dropped = /\(([0-9a-f]{40})\)/.exec(output)?.[1];
    if (dropped !== item.sha) {
      if (dropped)
        git(inv.root, ["stash", "store", "-m", "restored by tidy", dropped], { allowFail: true });
      return "stash position moved during the drop; restored it";
    }
    return null;
  }
  const live = read(inv.root, ["ls-remote", inv.remoteName, `refs/heads/${item.name}`]);
  const liveSha = live.split("\t")[0] || null;
  if (liveSha !== item.sha) return `remote changed since the inventory (now ${liveSha ?? "gone"})`;
  git(inv.root, ["push", "--quiet", inv.remoteName, "--delete", item.name]);
  return null;
}

/**
 * @param {{ repo?: string, archive?: string, apply?: boolean, remote?: boolean,
 *   remoteName?: string, selection?: Selection, beforeRemove?: () => void }} [options]
 * @returns {{ inventory: ReturnType<typeof inventory>, items: Item[],
 *   archive: { bundle: string, manifest: string } | null }}
 */
export function tidy({
  repo = process.cwd(),
  archive,
  apply = false,
  remote = false,
  remoteName = "origin",
  selection = {},
  beforeRemove,
} = {}) {
  const inv = inventory(repo, { remote, remoteName });
  const items = check(inv, selection, { apply });
  if (!apply) return { inventory: inv, items, archive: null };
  const archived = preserve(inv, items, archive ?? defaultArchive());
  if (archived) {
    beforeRemove?.();
    remove(inv, items);
  }
  return { inventory: inv, items, archive: archived };
}

function defaultArchive() {
  return path.join(os.homedir(), "kut-archive", new Date().toISOString().slice(0, 10));
}

const quote = (value) => (/[\s"']/.test(value) ? `"${value}"` : value);

export function applyCommand(options, items) {
  const parts = ["node", "scripts/tidy.mjs", "--apply"];
  if (options.repo) parts.push("--repo", quote(options.repo));
  if (options.archive) parts.push("--archive", quote(options.archive));
  if (options.remote) parts.push("--remote");
  if (options.remoteName && options.remoteName !== "origin")
    parts.push("--remote-name", options.remoteName);
  const flag = {
    worktree: "--worktree",
    branch: "--branch",
    stash: "--stash",
    "remote-branch": "--remote-branch",
  };
  for (const item of items.filter((i) => !i.refused))
    parts.push(
      flag[item.kind],
      quote(item.kind === "stash" ? item.sha : `${item.name}=${item.sha}`),
    );
  return parts.join(" ");
}

function printReport({ inventory: inv, items, archive }, options) {
  const log = (text = "") => console.log(text);
  log(`Repository: ${inv.root}`);
  log(`\nLocal branches (compared with ${inv.baseRef ?? "nothing: no main"}):`);
  for (const b of inv.branches) {
    const notes = [];
    if (b.aheadOfMain === 0) notes.push("contained in main");
    else if (b.aheadOfMain)
      notes.push(`${b.aheadOfMain} commit${b.aheadOfMain === 1 ? "" : "s"} not in main`);
    if (b.upstreamGone) notes.push("upstream gone");
    else if (b.upstream) notes.push(`tracks ${b.upstream}`);
    log(`  ${b.name}  ${b.sha}  ${notes.join(", ")}`);
  }
  log("\nWorktrees:");
  for (const wt of inv.worktrees) {
    const head = wt.branch ?? (wt.detached ? "detached" : wt.bare ? "bare" : "?");
    const flags = [wt.main && "main", wt.locked && "locked", wt.prunable && "missing"]
      .filter(Boolean)
      .join(", ");
    log(`  ${wt.path}  ${wt.sha ?? ""}  ${head}${flags ? `  (${flags})` : ""}`);
    if (!wt.status) continue;
    for (const [label, list] of Object.entries(wt.status))
      if (list.length) log(`    ${label} (${list.length}): ${list.join(", ")}`);
  }
  log("\nStashes (by commit ID):");
  for (const s of inv.stashes) log(`  ${s.sha}  ${s.ref}  ${s.message}`);
  if (!inv.stashes.length) log("  none");
  if (inv.remoteBranches) {
    log(`\nRemote branches on ${inv.remoteName}:`);
    for (const b of inv.remoteBranches) log(`  ${b.name}  ${b.sha}`);
  }
  log("\nUntracked and ignored files are listed only; tidy never deletes them.");
  if (!items.length) {
    log("\nNothing selected. Select with --branch, --worktree, --stash or --remote-branch.");
    return;
  }
  log("\nSelected:");
  for (const item of items) {
    const state = item.refused
      ? `REFUSED: ${item.refused}`
      : item.stopped
        ? `STOPPED: ${item.stopped}`
        : item.removed
          ? "removed"
          : options.apply
            ? "kept"
            : "ok";
    log(`  ${item.kind} ${item.name}${item.sha ? ` @ ${item.sha}` : ""}  ${state}`);
  }
  if (!options.apply) {
    if (items.some((i) => !i.refused))
      log(`\nTo archive and remove the ok items:\n  ${applyCommand(options, items)}`);
    return;
  }
  if (archive) log(`\nArchived and proven: ${archive.bundle}\nManifest: ${archive.manifest}`);
  else log("\nNothing archived, so nothing was removed.");
}

const USAGE = `Usage: node scripts/tidy.mjs [--apply] [options]

  --repo <path>              repository to inspect (default: current directory)
  --archive <dir>            bundle folder (default: ~/kut-archive/<date>)
  --branch <name>[=<sha>]    select a local branch
  --worktree <path>[=<sha>]  select a linked worktree (must be clean)
  --stash <sha>              select a stash by its commit ID
  --remote                   list remote branches and allow --remote-branch
  --remote-branch <name>[=<sha>]
  --remote-name <name>       default: origin

Dry run by default. --apply must come first and every selection needs the
SHA the dry run printed.`;

export function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        apply: { type: "boolean" },
        repo: { type: "string" },
        archive: { type: "string" },
        branch: { type: "string", multiple: true },
        worktree: { type: "string", multiple: true },
        stash: { type: "string", multiple: true },
        remote: { type: "boolean" },
        "remote-branch": { type: "string", multiple: true },
        "remote-name": { type: "string" },
        help: { type: "boolean" },
      },
    });
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  const { values } = parsed;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (values.apply && argv[0] !== "--apply") {
    console.error("--apply must be the first argument, so the approval rule sees it.");
    return 2;
  }
  if (values.apply && process.env.npm_lifecycle_event) {
    console.error("Run --apply as `node scripts/tidy.mjs --apply ...`, not through npm.");
    return 2;
  }
  if (values["remote-branch"] && !values.remote) {
    console.error("--remote-branch needs --remote.");
    return 2;
  }
  const options = {
    repo: values.repo,
    archive: values.archive,
    apply: Boolean(values.apply),
    remote: Boolean(values.remote),
    remoteName: values["remote-name"] ?? "origin",
    selection: {
      branches: values.branch,
      worktrees: values.worktree,
      stashes: values.stash,
      remoteBranches: values["remote-branch"],
    },
  };
  const selected = Object.values(options.selection).some((list) => list?.length);
  if (options.apply && !selected) {
    console.error("--apply needs at least one selection.");
    return 2;
  }
  const result = tidy({ ...options, repo: options.repo ?? process.cwd() });
  printReport(result, options);
  const failed = result.items.some((item) => item.refused || item.stopped);
  return failed || (options.apply && !result.archive) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`tidy stopped: ${error.message}`);
    process.exitCode = 1;
  }
}
