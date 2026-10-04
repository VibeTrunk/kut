import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectVercelDeployment } from "./vercel-deployment-contract.mjs";

const VERSION = "59.23.2";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const login = args.length === 1 && args[0] === "--login";
const candidate = args.length === 2 && args[0] === "--candidate" ? args[1] : null;
if (!login && !/^[a-f0-9]{40}$/.test(candidate ?? "")) {
  console.error(
    "Usage: node scripts/release/check-vercel-deployment.mjs --candidate <40-character SHA> | --login",
  );
  process.exit(2);
}

function resolveCli() {
  // Reuse an already installed official CLI. Never download a package or read credentials.
  const packages = [path.join(root, "node_modules/vercel")];
  if (process.env.KUT_VERCEL_CLI_PATH) {
    packages.unshift(path.resolve(path.dirname(process.env.KUT_VERCEL_CLI_PATH), ".."));
  }
  if (process.env.APPDATA) packages.push(path.join(process.env.APPDATA, "npm/node_modules/vercel"));
  const cache =
    process.env.npm_config_cache ??
    (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "npm-cache") : null);
  if (cache && existsSync(path.join(cache, "_npx"))) {
    for (const entry of readdirSync(path.join(cache, "_npx"), { withFileTypes: true })) {
      if (entry.isDirectory())
        packages.push(path.join(cache, "_npx", entry.name, "node_modules/vercel"));
    }
  }
  for (const directory of packages) {
    try {
      const metadata = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
      const cli = path.join(directory, "dist/vc.js");
      if (
        metadata.name === "vercel" &&
        metadata.version === VERSION &&
        metadata.bin?.vercel === "./dist/vc.js" &&
        existsSync(cli)
      )
        return cli;
    } catch {
      /* A missing cache entry is not authentication evidence. */
    }
  }
  throw new Error("cli_unavailable");
}

let stage = "cli-discovery";
try {
  const cli = resolveCli();
  if (login) {
    // Operator-only terminal flow. No agent enters credentials or stores a new token itself.
    if (!process.stdin.isTTY || !process.stdout.isTTY)
      throw new Error("interactive_login_required");
    const result = spawnSync(process.execPath, [cli, "login"], { cwd: root, stdio: "inherit" });
    process.exit(result.status ?? 1);
  }
  function call(command) {
    const response = spawnSync(
      process.execPath,
      [cli, ...command, "--no-color", "--non-interactive"],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (response.error || response.status !== 0) {
      let reason;
      try {
        reason = JSON.parse(response.stdout).reason;
      } catch {
        /* Never echo raw output. */
      }
      throw new Error(
        reason === "login_required" ? "authentication_required" : "verification_failed",
      );
    }
    return response.stdout;
  }
  stage = "authentication";
  call(["whoami"]);
  stage = "production-provenance";
  const evidence = await inspectVercelDeployment(
    candidate,
    async (endpoint) =>
      JSON.parse(call(["api", endpoint, "--method", "GET", "--raw", "--scope", "vibetrunk"])),
    async (sha, key) =>
      JSON.parse(
        call([
          "list",
          "kut",
          "--scope",
          "vibetrunk",
          "--meta",
          `${key}=${sha}`,
          "--format",
          "json",
          "--limit",
          "100",
        ]),
      ),
  );
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  // Raw API/CLI output can contain account data or credentials. Only controlled reasons leave the process.
  const reason = [
    "cli_unavailable",
    "authentication_required",
    "interactive_login_required",
  ].includes(error.message)
    ? error.message
    : "verification_failed";
  console.log(
    JSON.stringify({
      result: "unverified",
      reason,
      stage,
      candidate_sha: candidate,
      login_command: "node scripts/release/check-vercel-deployment.mjs --login",
      deployment_authorized: false,
    }),
  );
  process.exitCode = reason === "authentication_required" ? 2 : 1;
}
