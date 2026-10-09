import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectVercelDeployment } from "./vercel-deployment-contract.mjs";
import { resolveVercelCli } from "./vercel-cli.mjs";

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

let stage = "cli-discovery";
try {
  const cli = resolveVercelCli(root);
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
    async (url) => {
      // Never follow the redirect: its status and Location are the evidence.
      const response = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      await response.body?.cancel();
      return { status: response.status, location: response.headers.get("location") };
    },
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
