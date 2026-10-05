import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertMainCheckout } from "../../scripts/release/production-e2e-contract.mjs";

const scratch: string[] = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]) {
  execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@invalid", ...args], {
    cwd,
    stdio: "ignore",
  });
}

// A real repository with one linked worktree, so the check is exercised against
// git's own output rather than a stub.
function repositoryWithWorktree() {
  const base = mkdtempSync(path.join(os.tmpdir(), "kut-gate-checkout-"));
  scratch.push(base);
  const main = path.join(base, "main");
  const worktree = path.join(base, "worktree");
  mkdirSync(main);
  git(main, "init", "-q");
  git(main, "commit", "-q", "--allow-empty", "-m", "fixture");
  git(main, "worktree", "add", "-q", "--detach", worktree);
  mkdirSync(path.join(main, "node_modules"));
  return { base, main, worktree };
}

describe("release gate checkout (ADR-128)", () => {
  it("accepts the main checkout with its own node_modules", () => {
    const { main } = repositoryWithWorktree();
    expect(() => assertMainCheckout(main)).not.toThrow();
  });

  it("refuses a linked worktree, which has no backup evidence of its own", () => {
    const { worktree } = repositoryWithWorktree();
    mkdirSync(path.join(worktree, "node_modules"));
    expect(() => assertMainCheckout(worktree)).toThrow("main checkout, not a git worktree");
  });

  it("refuses node_modules borrowed through a link, which Turbopack will not build", () => {
    const { base, main } = repositoryWithWorktree();
    rmSync(path.join(main, "node_modules"), { recursive: true });
    const elsewhere = path.join(base, "shared-modules");
    mkdirSync(elsewhere);
    // "junction" is honoured on Windows and ignored elsewhere; Node reports both as links.
    symlinkSync(elsewhere, path.join(main, "node_modules"), "junction");
    expect(() => assertMainCheckout(main)).toThrow("not a link or junction");
  });

  it("refuses a checkout without node_modules", () => {
    const { main } = repositoryWithWorktree();
    rmSync(path.join(main, "node_modules"), { recursive: true });
    expect(() => assertMainCheckout(main)).toThrow("node_modules is missing");
  });
});
