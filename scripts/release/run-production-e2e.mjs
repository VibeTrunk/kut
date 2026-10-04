import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  assertCandidate,
  assertLockedRuntime,
  assertPortAvailable,
  releaseEnvironment,
  validateReleaseReport,
} from "./production-e2e-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [flag, sha, ...extra] = process.argv.slice(2);
if (flag !== "--candidate" || !sha || extra.length) {
  throw new Error(
    "Usage: node scripts/release/run-production-e2e.mjs --candidate <40-character SHA>. Test filters are not accepted.",
  );
}
assertCandidate(root, sha);
const env = releaseEnvironment(process.env);
const lockfile = await readFile(path.join(root, "package-lock.json"));
const runtime = {};
for (const name of ["next", "@playwright/test", "playwright", "playwright-core"]) {
  runtime[name] = JSON.parse(
    await readFile(path.join(root, "node_modules", name, "package.json"), "utf8"),
  ).version;
}
assertLockedRuntime(JSON.parse(lockfile), runtime);
await assertPortAvailable();
const runDir = path.join(root, ".release-evidence", "authenticated", sha, randomUUID());
await mkdir(runDir, { recursive: true });
env.KUT_RELEASE_RUN_DIR = runDir;
env.KUT_RELEASE_CANDIDATE = sha;

const secretValues = [
  env.ANON_KEY,
  env.SERVICE_ROLE_KEY,
  env.DB_URL,
  decodeURIComponent(new URL(env.DB_URL).password),
].filter(Boolean);
const scrub = (value) =>
  secretValues
    .reduce((text, secret) => text.replaceAll(secret, "[REDACTED]"), value)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED JWT]");
async function run(relativeCli, args, name) {
  // Buffer before redacting so a credential split across output chunks cannot
  // escape into a durable log. Never stream child output to the operator.
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, relativeCli), ...args], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, log: Buffer.concat(chunks).toString("utf8") }));
  });
  await writeFile(path.join(runDir, `${name}.log`), scrub(result.log), { flag: "wx" });
  if (result.code !== 0)
    throw new Error(`${name} failed; retained private diagnostics in ${runDir}.`);
}
const metadata = {
  version: 1,
  candidate_sha: sha,
  result: "running",
  started_at: new Date().toISOString(),
  os: { platform: os.platform(), release: os.release(), arch: os.arch() },
  node: process.version,
  next: runtime.next,
  playwright: runtime["@playwright/test"],
  lockfile_sha256: createHash("sha256").update(lockfile).digest("hex"),
  browsers: JSON.parse(
    await readFile(path.join(root, "node_modules/playwright-core/browsers.json"), "utf8"),
  ).browsers.filter((browser) => ["chromium", "webkit"].includes(browser.name)),
  config: "playwright.release.config.ts",
  config_sha256: createHash("sha256")
    .update(await readFile(path.join(root, "playwright.release.config.ts")))
    .digest("hex"),
  production_server: {
    command: "node node_modules/next/dist/bin/next start --port 3101 --hostname 127.0.0.1",
    reuse_existing_server: false,
  },
  retries: 0,
  trace: "retain-on-failure",
};
const manifestPath = path.join(runDir, "manifest.json");
await writeFile(manifestPath, JSON.stringify(metadata, null, 2), { flag: "wx" });
let stage = "runtime-metadata";
try {
  // Read only the runtime version/image, never Docker's credential-bearing
  // environment. An unavailable container is recorded, not guessed from CLI.
  try {
    const options = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
    metadata.postgrest = {
      version: execFileSync(
        "docker",
        ["exec", "supabase_rest_kut", "postgrest", "--version"],
        options,
      ).trim(),
      image: execFileSync(
        "docker",
        ["inspect", "--format", "{{.Config.Image}}", "supabase_rest_kut"],
        options,
      ).trim(),
    };
  } catch {
    metadata.postgrest = { version: "unavailable", image: "unavailable" };
  }
  const database = new pg.Client({ connectionString: env.DB_URL });
  stage = "database-preflight";
  try {
    await database.connect();
    metadata.postgres = (await database.query("show server_version")).rows[0].server_version;
  } finally {
    await database.end();
  }
  // Provision exactly the locked Playwright browsers, then build this checkout.
  stage = "browser-provisioning";
  await run(
    "node_modules/playwright/cli.js",
    ["install", "chromium", "webkit"],
    "browser-provisioning",
  );
  env.KUT_RELEASE_REPORT_PATH = path.join(runDir, "inventory.json");
  stage = "test-inventory";
  await run(
    "node_modules/playwright/cli.js",
    ["test", "--list", "--config", "playwright.release.config.ts"],
    "inventory",
  );
  env.KUT_RELEASE_REPORT_PATH = path.join(runDir, "report.json");
  metadata.build_started_at = new Date().toISOString();
  stage = "production-build";
  await run("node_modules/next/dist/bin/next", ["build"], "build");
  metadata.build_completed_at = new Date().toISOString();
  metadata.build_id = (await readFile(path.join(root, ".next/BUILD_ID"), "utf8")).trim();
  stage = "pre-test-candidate-check";
  assertCandidate(root, sha);
  await assertPortAvailable();
  stage = "authenticated-e2e";
  await run(
    "node_modules/playwright/cli.js",
    ["test", "--config", "playwright.release.config.ts"],
    "authenticated-e2e",
  );
  const report = await readFile(path.join(runDir, "report.json"));
  stage = "report-validation";
  const inventory = await readFile(path.join(runDir, "inventory.json"));
  metadata.projects = validateReleaseReport(JSON.parse(report), JSON.parse(inventory));
  metadata.report_sha256 = createHash("sha256").update(report).digest("hex");
  metadata.inventory_sha256 = createHash("sha256").update(inventory).digest("hex");
  if ((await readFile(path.join(root, ".next/BUILD_ID"), "utf8")).trim() !== metadata.build_id)
    throw new Error("Production build changed during E2E.");
  assertCandidate(root, sha);
  metadata.result = "passed";
} catch {
  // Full failure details remain in the private logs/report/first-failure traces.
  // Do not print database exception text, environment values or auth artifacts.
  metadata.result = "failed";
  metadata.failure_stage = stage;
  process.exitCode = 1;
} finally {
  metadata.completed_at = new Date().toISOString();
  await writeFile(manifestPath, JSON.stringify(metadata, null, 2));
}
console.log(
  JSON.stringify({ result: metadata.result, candidate_sha: sha, manifest_path: manifestPath }),
);
