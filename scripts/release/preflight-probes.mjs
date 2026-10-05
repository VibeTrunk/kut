import { lstatSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { assertMainCheckout, assertPortAvailable } from "./production-e2e-contract.mjs";
import {
  assessBackup,
  assessChecks,
  assessLocalStack,
  classifyAccess,
} from "./preflight-contract.mjs";
import { runReadOnly } from "./preflight-command.mjs";
import { resolveVercelCli } from "./vercel-cli.mjs";

export function createPreflightProbes(
  root,
  candidate,
  { execute = runReadOnly, env = process.env } = {},
) {
  const run = (file, args) => execute(file, args, { cwd: root });
  const git = async (...args) => {
    const response = await run("git", ["-C", root, ...args]);
    if (!response.ok) throw new Error("git_unavailable");
    return response.stdout.trim();
  };
  const json = (output) => JSON.parse(output.replace(/^\uFEFF/, ""));
  const fileExists = (file) => {
    try {
      return statSync(file).isFile() && statSync(file).size > 0;
    } catch {
      return false;
    }
  };

  async function ordinary() {
    try {
      const directories = await git(
        "rev-parse",
        "--path-format=absolute",
        "--git-dir",
        "--git-common-dir",
      );
      assertMainCheckout(root, () => directories, lstatSync);
      return "passed";
    } catch {
      return "checkout_invalid";
    }
  }

  async function github() {
    // A successful authenticated API read checks both access and candidate CI.
    // Refuse a partial page instead of guessing about unseen duplicate checks.
    const response = await run("gh", [
      "api",
      `repos/VibeTrunk/kut/commits/${candidate}/check-runs?per_page=100`,
    ]);
    if (!response.ok) return classifyAccess(response);
    try {
      return assessChecks(json(response.stdout), candidate);
    } catch {
      return "invalid_evidence";
    }
  }

  async function vercel() {
    let cli;
    try {
      cli = resolveVercelCli(root, env);
    } catch {
      return "cli_unavailable";
    }
    const call = (...args) =>
      run(process.execPath, [cli, ...args, "--no-color", "--non-interactive"]);
    const whoami = await call("whoami");
    if (!whoami.ok) return classifyAccess(whoami);
    const project = await call(
      "api",
      "/v9/projects/kut",
      "--method",
      "GET",
      "--raw",
      "--scope",
      "vibetrunk",
    );
    if (!project.ok) return classifyAccess(project);
    try {
      const metadata = json(project.stdout);
      return metadata.name === "kut" && typeof metadata.id === "string"
        ? "passed"
        : "access_unverified";
    } catch {
      return "invalid_evidence";
    }
  }

  async function docker() {
    const response = await run("docker", ["version", "--format", "{{.Server.Version}}"]);
    if (response.ok && response.stdout.trim()) return "passed";
    const reason = classifyAccess(response);
    return reason === "access_unverified" ? "docker_unavailable" : reason;
  }

  async function localSupabase() {
    // Use the installed binary directly: no npx download or wrapper left behind
    // on timeout. Credentials in status output remain in memory only.
    const platform = process.platform === "win32" ? "windows" : process.platform;
    const directory = path.join(root, "node_modules/@supabase", `cli-${platform}-${process.arch}`);
    const executable = path.join(
      directory,
      "bin",
      `supabase${process.platform === "win32" ? ".exe" : ""}`,
    );
    if (!fileExists(executable)) return "cli_unavailable";
    const response = await run(executable, ["status", "-o", "json"]);
    if (!response.ok) {
      const reason = classifyAccess(response);
      return reason === "access_unverified" ? "stack_unavailable" : reason;
    }
    try {
      const reason = assessLocalStack(json(response.stdout));
      if (reason !== "passed") return reason;
      // Status variables alone don't prove Auth/Storage are running. Inspect only
      // service health, never container env or Config, and never start a service.
      const services = ["db", "kong", "auth", "rest", "storage"];
      const status = await run("docker", [
        "inspect",
        "--format",
        "{{json .State}}",
        ...services.map((service) => `supabase_${service}_kut`),
      ]);
      if (!status.ok) {
        const reason = classifyAccess(status);
        return reason === "access_unverified" ? "stack_unavailable" : reason;
      }
      const states = status.stdout.trim().split(/\r?\n/).map(json);
      return states.length === services.length &&
        states.every(
          (state) =>
            state.Running === true &&
            !state.Paused &&
            !state.Restarting &&
            (!state.Health || state.Health.Status === "healthy"),
        )
        ? "passed"
        : "stack_unavailable";
    } catch {
      return "invalid_evidence";
    }
  }

  async function credentials() {
    if (process.platform !== "win32") return "credentials_unavailable";
    const response = await run("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-File",
      path.join(root, "scripts/release/preflight-credentials.ps1"),
    ]);
    if (response.timedOut) return "timed_out";
    try {
      return response.ok && json(response.stdout).result === "passed"
        ? "passed"
        : "credentials_unavailable";
    } catch {
      return "credentials_unavailable";
    }
  }

  async function catalogue() {
    const central = env.KUT_CENTRAL_SUPABASE_REPO;
    if (
      !central ||
      !path.isAbsolute(central) ||
      central.startsWith("\\\\") ||
      central.startsWith("//")
    )
      return "catalogue_unavailable";
    const checkout = await run("git", ["-C", central, "rev-parse", "--show-toplevel"]);
    if (!checkout.ok || path.resolve(checkout.stdout.trim()) !== path.resolve(central))
      return "catalogue_unavailable";
    const response = await run("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-File",
      path.join(root, "scripts/release/test-catalogue-parity.ps1"),
      "-CentralRepository",
      central,
    ]);
    if (response.timedOut) return "timed_out";
    try {
      return response.ok && json(response.stdout).result === "passed"
        ? "passed"
        : "catalogue_mismatch";
    } catch {
      return "catalogue_mismatch";
    }
  }

  return {
    ordinary,
    candidate_checkout: async () => {
      if ((await git("rev-parse", "HEAD")) !== candidate) return "candidate_invalid";
      return (await git("status", "--porcelain", "--untracked-files=all"))
        ? "checkout_dirty"
        : "passed";
    },
    github_ci: github,
    vercel_access: vercel,
    docker,
    local_supabase: localSupabase,
    backup_pointer: () => {
      try {
        return assessBackup(
          json(
            readFileSync(path.join(root, ".private-backups/latest-backup-evidence.json"), "utf8"),
          ),
          fileExists,
        );
      } catch {
        return "backup_incomplete";
      }
    },
    dpapi_credentials: credentials,
    central_catalogue: catalogue,
    port_3101: async () => {
      try {
        await assertPortAvailable();
        return "passed";
      } catch {
        return "port_unavailable";
      }
    },
  };
}
