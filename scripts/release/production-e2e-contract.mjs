import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
import net from "node:net";
import path from "node:path";

export const RELEASE_PROJECTS = [
  "authenticated-pixel7",
  "authenticated-320",
  "authenticated-webkit",
];
const PACK_ONCE = "a pack's summary names the slots it fills and the copies it adds (ADR-114)";

export function assertLockedRuntime(lock, installed) {
  for (const [name, version] of Object.entries(installed)) {
    if (lock.packages?.[`node_modules/${name}`]?.version !== version) {
      throw new Error(
        `Installed ${name} differs from the candidate lockfile; run npm ci in this checkout.`,
      );
    }
  }
}

function gitReader(root) {
  return (...args) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
}

// The gate reads its backup evidence from the main checkout's
// .private-backups/, which a linked worktree does not have, and a worktree
// that borrows node_modules through a junction makes Turbopack refuse the
// build. On 5 October such a run cost a needless hosted backup and a wasted
// full gate attempt, so both conditions stop the gate before any work.
export function assertMainCheckout(root, readGit = gitReader(root), inspect = lstatSync) {
  const [gitDir, commonDir] = readGit(
    "rev-parse",
    "--path-format=absolute",
    "--git-dir",
    "--git-common-dir",
  ).split(/\r?\n/);
  if (!gitDir || !commonDir || path.resolve(gitDir) !== path.resolve(commonDir)) {
    throw new Error("Run the release gate from the main checkout, not a git worktree.");
  }
  let modules;
  try {
    modules = inspect(path.join(root, "node_modules"));
  } catch {
    throw new Error("node_modules is missing; run npm ci in the main checkout.");
  }
  if (modules.isSymbolicLink() || !modules.isDirectory()) {
    throw new Error(
      "node_modules must be a real directory, not a link or junction; run npm ci in the main checkout.",
    );
  }
}

export function assertCandidate(root, sha, readGit) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("An exact lowercase candidate SHA is required.");
  const git = readGit ?? gitReader(root);
  if (git("rev-parse", "HEAD") !== sha) throw new Error("Candidate SHA differs from HEAD.");
  if (git("status", "--porcelain", "--untracked-files=all"))
    throw new Error("Production E2E requires a completely clean candidate checkout.");
}

export function releaseEnvironment(env) {
  for (const name of ["API_URL", "DB_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]) {
    if (!env[name]) throw new Error(`Production E2E requires local ${name}.`);
  }
  for (const name of ["API_URL", "DB_URL"]) {
    let target;
    try {
      target = new URL(env[name]);
    } catch {
      throw new Error(`${name} must be a loopback URL.`);
    }
    const host = target.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!(
      host === "localhost" ||
      host === "::1" ||
      /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
    )) {
      throw new Error(
        `${name} must be loopback; production release fixtures never accept a nonlocal override.`,
      );
    }
    if (
      !(name === "DB_URL" ? ["postgres:", "postgresql:"] : ["http:", "https:"]).includes(
        target.protocol,
      )
    ) {
      throw new Error(`${name} has an unsupported protocol.`);
    }
  }
  if (env.PW_TEST_CONNECT_WS_ENDPOINT)
    throw new Error(
      "Release E2E requires the recorded installed browsers; remote browser overrides are refused.",
    );
  return {
    ...env,
    KUT_ALLOW_NONLOCAL_TEST_TARGET: "",
    KUT_LOCAL_DATABASE_URL: env.DB_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: env.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.ANON_KEY,
  };
}

export async function assertPortAvailable(port = 3101) {
  // Playwright also refuses reuse. This catches an occupied port BEFORE the build.
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () =>
      reject(new Error("Release server port is occupied; stop the existing server explicitly.")),
    );
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(resolve));
  });
}

export function validateReleaseReport(report, inventory) {
  if (report.errors?.length || !report.suites?.length || report.config?.workers !== 1)
    throw new Error("Release report is incomplete or has runner errors.");
  const projects = report.config.projects;
  if (
    projects?.length !== RELEASE_PROJECTS.length ||
    RELEASE_PROJECTS.some((name) => !projects.some((p) => p.name === name && p.retries === 0))
  ) {
    throw new Error("Release report does not cover every required project without retries.");
  }
  const totals = Object.fromEntries(
    RELEASE_PROJECTS.map((name) => [name, { passed: 0, skipped: 0 }]),
  );
  const titles = new Map();
  const expected = new Map();
  const specKey = (parents, spec) =>
    JSON.stringify([...parents, spec.file, spec.line, spec.column, spec.title]);
  function list(suite, ancestors = []) {
    const parents = [...ancestors, suite.title ?? ""];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const key = `${specKey(parents, spec)}:${test.projectName}`;
        if (expected.has(key)) throw new Error("Duplicate release inventory.");
        expected.set(key, spec.title);
      }
    }
    for (const child of suite.suites ?? []) list(child, parents);
  }
  if (inventory?.errors?.length || !inventory?.suites?.length)
    throw new Error("Release inventory is missing or invalid.");
  inventory.suites.forEach((suite) => list(suite));
  function visit(suite, ancestors = []) {
    const parents = [...ancestors, suite.title ?? ""];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const count = totals[test.projectName];
        if (!count || test.results?.length !== 1 || test.results[0].retry !== 0)
          throw new Error("Release test is missing or was retried.");
        const key = specKey(parents, spec);
        const inventoryKey = `${key}:${test.projectName}`;
        if (expected.get(inventoryKey) !== spec.title)
          throw new Error("Release report differs from the unfiltered inventory.");
        expected.delete(inventoryKey);
        const covered = titles.get(key) ?? new Set();
        if (covered.has(test.projectName)) throw new Error("Duplicate release test evidence.");
        covered.add(test.projectName);
        titles.set(key, covered);
        const result = test.results[0];
        if (
          test.expectedStatus === "skipped" &&
          result.status === "skipped" &&
          spec.title === PACK_ONCE &&
          test.projectName !== "authenticated-320"
        ) {
          count.skipped += 1;
        } else if (
          test.expectedStatus === "passed" &&
          test.status === "expected" &&
          result.status === "passed"
        ) {
          count.passed += 1;
        } else {
          throw new Error("Release test failed, was flaky, or skipped required coverage.");
        }
      }
    }
    for (const child of suite.suites ?? []) visit(child, parents);
  }
  report.suites.forEach((suite) => visit(suite));
  if (
    expected.size ||
    !titles.size ||
    [...titles.values()].some((projects) => projects.size !== RELEASE_PROJECTS.length) ||
    Object.values(totals).some((count) => !count.passed)
  ) {
    throw new Error("Release report has missing project coverage.");
  }
  if (Object.values(totals).some((count) => count.skipped > 1))
    throw new Error("Release report skipped extra pack coverage.");
  return totals;
}
