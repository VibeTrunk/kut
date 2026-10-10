import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { tidy } from "../../scripts/tidy.mjs";

// Every test works on disposable repositories under the OS temp folder.
const bases: string[] = [];
afterEach(() => {
  for (const base of bases.splice(0)) fs.rmSync(base, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function configure(repo: string) {
  git(repo, "config", "user.name", "Tidy Test");
  git(repo, "config", "user.email", "tidy@example.invalid");
  git(repo, "config", "commit.gpgsign", "false");
}

function commit(repo: string, file: string, content: string, message = `edit ${file}`) {
  fs.writeFileSync(path.join(repo, file), content);
  git(repo, "add", file);
  git(repo, "commit", "--quiet", "-m", message);
  return git(repo, "rev-parse", "HEAD");
}

function setup() {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "tidy-test-")));
  bases.push(base);
  const origin = path.join(base, "origin.git");
  const repo = path.join(base, "repo");
  git(base, "init", "--quiet", "--bare", "-b", "main", origin);
  git(base, "init", "--quiet", "-b", "main", repo);
  configure(repo);
  fs.writeFileSync(path.join(repo, ".gitignore"), "*.log\n");
  git(repo, "add", ".gitignore");
  commit(repo, "a.txt", "one\n");
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "--quiet", "-u", "origin", "main");
  return { base, origin, repo, archive: path.join(base, "archive") };
}

// Proves the bundle on its own: fetch everything into a new empty repository.
function bundleCommits(bundle: string) {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), "tidy-probe-"));
  bases.push(probe);
  git(probe, "init", "--quiet", "--bare");
  git(probe, "fetch", "--quiet", bundle, "refs/*:refs/*");
  return (sha: string) =>
    spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: probe }).status === 0;
}

const refs = (repo: string) => git(repo, "for-each-ref", "--format=%(refname) %(objectname)");

describe("tidy (disposable repositories only)", { timeout: 30000 }, () => {
  it("dry run changes nothing and lists untracked and ignored files separately", () => {
    const { repo, archive } = setup();
    git(repo, "branch", "feature");
    fs.writeFileSync(path.join(repo, "notes.txt"), "draft\n");
    fs.writeFileSync(path.join(repo, "debug.log"), "noise\n");
    const before = refs(repo);

    const result = tidy({ repo, archive, selection: { branches: ["feature"] } });

    expect(refs(repo)).toBe(before);
    expect(fs.existsSync(archive)).toBe(false);
    expect(result.inventory.worktrees[0].status?.untracked).toEqual(["notes.txt"]);
    expect(result.inventory.worktrees[0].status?.ignored).toEqual(["debug.log"]);
    expect(result.items).toEqual([
      expect.objectContaining({ kind: "branch", name: "feature", sha: expect.any(String) }),
    ]);
    expect(result.items[0].refused).toBeUndefined();
    expect(fs.existsSync(path.join(repo, "notes.txt"))).toBe(true);
  });

  it("archives a closed PR's branch with extra commits before deleting it", () => {
    const { repo, archive } = setup();
    git(repo, "switch", "--quiet", "-c", "feature");
    commit(repo, "b.txt", "pr\n");
    git(repo, "switch", "--quiet", "main");
    commit(repo, "b.txt", "pr\n", "squash merge of feature");
    git(repo, "push", "--quiet", "origin", "main");
    git(repo, "switch", "--quiet", "feature");
    const extra = commit(repo, "c.txt", "after the merge\n");
    git(repo, "switch", "--quiet", "main");

    const result = tidy({
      repo,
      archive,
      apply: true,
      selection: { branches: [`feature=${extra}`] },
    });

    expect(
      result.inventory.branches.find((b: { name: string }) => b.name === "feature")?.aheadOfMain,
    ).toBe(2);
    expect(result.items[0]).toMatchObject({ kind: "branch", removed: true });
    expect(git(repo, "branch", "--list", "feature")).toBe("");
    expect(bundleCommits(result.archive!.bundle)(extra)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(result.archive!.manifest, "utf8"));
    expect(manifest.items).toEqual([expect.objectContaining({ name: "feature", sha: extra })]);
    expect(git(repo, "for-each-ref", "refs/tidy")).toBe("");
  });

  it("deletes a remote branch that is behind local only after bundling both tips", () => {
    const { repo, archive } = setup();
    git(repo, "switch", "--quiet", "-c", "feature");
    const pushed = commit(repo, "b.txt", "pushed\n");
    git(repo, "push", "--quiet", "-u", "origin", "feature");
    const local = commit(repo, "b.txt", "local only\n");
    git(repo, "switch", "--quiet", "main");

    const result = tidy({
      repo,
      archive,
      apply: true,
      remote: true,
      selection: { branches: [`feature=${local}`], remoteBranches: [`feature=${pushed}`] },
    });

    expect(result.items.map((i) => [i.kind, i.removed])).toEqual([
      ["branch", true],
      ["remote-branch", true],
    ]);
    expect(git(repo, "ls-remote", "--heads", "origin", "feature")).toBe("");
    const has = bundleCommits(result.archive!.bundle);
    expect(has(pushed) && has(local)).toBe(true);
  });

  it("fetches a remote-only commit into the bundle", () => {
    const { base, origin, repo, archive } = setup();
    const other = path.join(base, "other");
    git(base, "clone", "--quiet", origin, other);
    configure(other);
    git(other, "switch", "--quiet", "-c", "elsewhere");
    const remoteOnly = commit(other, "d.txt", "never fetched here\n");
    git(other, "push", "--quiet", "origin", "elsewhere");

    const result = tidy({
      repo,
      archive,
      apply: true,
      remote: true,
      selection: { remoteBranches: [`elsewhere=${remoteOnly}`] },
    });

    expect(result.items[0].removed).toBe(true);
    expect(bundleCommits(result.archive!.bundle)(remoteOnly)).toBe(true);
  });

  it("stops a remote deletion when the remote moved after bundling", () => {
    const { base, origin, repo, archive } = setup();
    git(repo, "switch", "--quiet", "-c", "feature");
    const pushed = commit(repo, "b.txt", "pushed\n");
    git(repo, "push", "--quiet", "origin", "feature");
    git(repo, "switch", "--quiet", "main");
    const other = path.join(base, "other");

    const result = tidy({
      repo,
      archive,
      apply: true,
      remote: true,
      selection: { remoteBranches: [`feature=${pushed}`] },
      beforeRemove: () => {
        git(base, "clone", "--quiet", "-b", "feature", origin, other);
        configure(other);
        commit(other, "b.txt", "someone else\n");
        git(other, "push", "--quiet", "origin", "feature");
      },
    });

    expect(result.items[0].stopped).toMatch(/remote changed/);
    expect(git(repo, "ls-remote", "--heads", "origin", "feature")).not.toBe("");
  });

  it("removes a clean detached worktree and keeps its only commit in the bundle", () => {
    const { base, repo, archive } = setup();
    const wt = path.join(base, "wt");
    git(repo, "worktree", "add", "--quiet", "--detach", wt, "HEAD");
    const orphan = commit(wt, "e.txt", "only here\n");

    const dry = tidy({ repo, archive, selection: { worktrees: [wt] } });
    expect(dry.inventory.worktrees[1]).toMatchObject({ detached: true, sha: orphan });

    const result = tidy({
      repo,
      archive,
      apply: true,
      selection: { worktrees: [`${wt}=${orphan}`] },
    });

    expect(result.items[0].removed).toBe(true);
    expect(fs.existsSync(wt)).toBe(false);
    expect(git(repo, "worktree", "list", "--porcelain")).not.toContain("wt");
    expect(bundleCommits(result.archive!.bundle)(orphan)).toBe(true);
  });

  it("refuses dirty worktrees, including ones holding only ignored files", () => {
    const { base, repo, archive } = setup();
    const changed = path.join(base, "changed");
    const ignored = path.join(base, "ignored");
    git(repo, "worktree", "add", "--quiet", "-b", "one", changed);
    git(repo, "worktree", "add", "--quiet", "-b", "two", ignored);
    fs.writeFileSync(path.join(changed, "a.txt"), "edited\n");
    fs.writeFileSync(path.join(ignored, "run.log"), "local\n");
    const head = git(repo, "rev-parse", "HEAD");

    const result = tidy({
      repo,
      archive,
      apply: true,
      selection: {
        worktrees: [`${changed}=${head}`, `${ignored}=${head}`],
        branches: [`one=${head}`],
      },
    });

    expect(result.items.map((i) => i.refused)).toEqual([
      expect.stringMatching(/1 changed/),
      expect.stringMatching(/1 ignored/),
      expect.stringMatching(/checked out in/),
    ]);
    expect(result.archive).toBeNull();
    expect(fs.existsSync(changed) && fs.existsSync(ignored)).toBe(true);
    expect(fs.existsSync(archive)).toBe(false);
  });

  it("drops the selected stash by commit ID when indexes shift", () => {
    const { repo, archive } = setup();
    fs.writeFileSync(path.join(repo, "a.txt"), "first\n");
    git(repo, "stash", "push", "--quiet", "-m", "first");
    const first = git(repo, "rev-parse", "stash@{0}");
    fs.writeFileSync(path.join(repo, "a.txt"), "second\n");
    git(repo, "stash", "push", "--quiet", "-m", "second");
    // `first` is now stash@{1}; another stash arrives between bundle and drop.
    const result = tidy({
      repo,
      archive,
      apply: true,
      selection: { stashes: [first] },
      beforeRemove: () => {
        fs.writeFileSync(path.join(repo, "a.txt"), "third\n");
        git(repo, "stash", "push", "--quiet", "-m", "third");
      },
    });

    expect(result.items[0].removed).toBe(true);
    const left = git(repo, "stash", "list", "--format=%H %gs");
    expect(left).not.toContain(first);
    expect(left).toContain("second");
    expect(left).toContain("third");
    expect(bundleCommits(result.archive!.bundle)(first)).toBe(true);
  });

  it("stops items that changed since the inventory and keeps the rest", () => {
    const { repo, archive } = setup();
    const head = git(repo, "rev-parse", "HEAD");
    git(repo, "branch", "stale");
    git(repo, "branch", "moving");
    git(repo, "switch", "--quiet", "-c", "moved");
    const later = commit(repo, "f.txt", "new\n");
    git(repo, "switch", "--quiet", "main");

    const result = tidy({
      repo,
      archive,
      apply: true,
      selection: {
        branches: [`stale=${head}`, `moved=${head}`, `moving=${head}`, `main=${head}`],
      },
      beforeRemove: () => git(repo, "branch", "--force", "moving", later),
    });

    expect(result.items.map((i) => [i.name, i.removed ?? i.refused ?? i.stopped])).toEqual([
      ["stale", true],
      ["moved", expect.stringMatching(/changed since the inventory/)],
      ["moving", expect.stringMatching(/changed since the inventory/)],
      ["main", "protected branch"],
    ]);
    expect(git(repo, "rev-parse", "moving")).toBe(later);
  });

  it("requires SHAs, --apply first and no npm wrapper on the command line", () => {
    const { repo } = setup();
    git(repo, "branch", "feature");
    const cli = (args: string[], env: Record<string, string> = {}) => {
      // The test itself may run under npm; start from an environment without it.
      const base = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !/^npm_/i.test(key)),
      );
      return spawnSync(process.execPath, [path.resolve("scripts/tidy.mjs"), ...args], {
        cwd: repo,
        encoding: "utf8",
        windowsHide: true,
        env: { ...base, ...env } as NodeJS.ProcessEnv,
      });
    };

    const dry = cli(["--branch", "feature"]);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toMatch(/node scripts\/tidy\.mjs --apply --branch feature=[0-9a-f]{40}/);
    expect(cli(["--branch", "feature", "--apply"]).status).toBe(2);
    expect(cli(["--apply", "--branch", "feature"]).stdout).toMatch(/REFUSED: give the SHA/);
    expect(cli(["--apply", "--branch", "feature"], { npm_lifecycle_event: "tidy" }).status).toBe(2);
    expect(git(repo, "branch", "--list", "feature")).not.toBe("");
  });
});
