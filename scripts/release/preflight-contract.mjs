export const REQUIRED_CHECKS = [
  "fast",
  "e2e",
  "database",
  "migrations",
  "security",
  "merge-gate",
  "scan",
];

const remedies = {
  checkout_invalid: "Use the ordinary checkout with its own real node_modules (ADR-128).",
  candidate_invalid: "Supply one exact 40-character lowercase SHA equal to HEAD.",
  checkout_dirty:
    "Preserve and review local work; use a clean exact-candidate checkout for release.",
  cli_unavailable: "Locate the existing installed CLI; preflight never installs packages.",
  network_denied:
    "Retry this read-only command with supported per-command sandbox approval; do not bootstrap login.",
  network_unavailable:
    "Check connectivity and retry the read-only probe; login state is unverified.",
  timed_out:
    "The read-only probe exceeded its deadline; check service/network availability before retrying.",
  login_required: "Complete the service's official interactive login in the owner's terminal.",
  login_expired: "The service explicitly reports expiration; renew its official interactive login.",
  authentication_rejected:
    "The service rejected authentication; check the official CLI session in the owner's terminal.",
  access_unverified:
    "Access is unverified; inspect privately or retry with per-command approval before deciding login expired.",
  invalid_evidence:
    "Evidence is malformed or incomplete; refresh it through the ordinary authorized workflow.",
  ci_incomplete:
    "Wait for all seven exact-SHA main checks to succeed; skipped, duplicate or partial evidence cannot pass.",
  ci_stale: "Obtain successful exact-SHA CI within 72 hours; future-dated evidence also fails.",
  backup_incomplete:
    "Prepare a cold-verified encrypted backup through the separately authorized backup workflow.",
  backup_stale:
    "Prepare a backup within 24 hours through the separately authorized backup workflow.",
  credentials_unavailable:
    "Check the Windows DPAPI locators backup-encryption-v1 and hosted-db-v1; no .env.local fallback.",
  catalogue_unavailable:
    "Set KUT_CENTRAL_SUPABASE_REPO to the existing central catalogue checkout.",
  catalogue_mismatch:
    "Reconcile the central catalogue through its own review workflow; never push hosted migrations from KUT.",
  docker_unavailable: "Check Docker Desktop in the owner's session; preflight does not start it.",
  stack_unavailable:
    "Start the existing local Supabase stack only in an authorized session, with output captured privately.",
  local_target_invalid:
    "Use only the local loopback Supabase stack; fixtures must never target hosted data.",
  port_unavailable:
    "Check port 3101 and explicitly stop its owner if appropriate; preflight stops no existing process.",
};

export function checkResult(name, reason = "passed") {
  // Only fixed vocabulary leaves a probe, never raw errors or account data.
  const safe =
    reason === "passed" || Object.hasOwn(remedies, reason) ? reason : "access_unverified";
  return {
    name,
    result: safe === "passed" ? "passed" : "failed",
    reason: safe,
    ...(safe === "passed" ? {} : { remedy: remedies[safe] }),
  };
}

export function classifyAccess(result) {
  if (result.ok) return "passed";
  if (result.timedOut) return "timed_out";
  if (result.code === "ENOENT") return "cli_unavailable";
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (
    ["EACCES", "EPERM"].includes(result.code) ||
    /permission denied|operation not permitted|forbidden by its access permissions|WSAEACCES|\b10013\b/i.test(
      output,
    )
  )
    return "network_denied";
  if (
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|no such host|network is unreachable/i.test(
      output,
    )
  )
    return "network_unavailable";
  let reason;
  try {
    reason = JSON.parse(result.stdout).reason;
  } catch {
    /* Raw output stays private. */
  }
  if (
    reason === "login_required" ||
    /not logged (?:in|into)|no existing credentials found/i.test(output)
  )
    return "login_required";
  if (
    reason === "token_expired" ||
    /(?:token|session|credentials?) (?:has |have |is |are )?expired/i.test(output)
  )
    return "login_expired";
  if (/HTTP 401|bad credentials|invalid (?:authentication )?token/i.test(output))
    return "authentication_rejected";
  return "access_unverified";
}

function ageWithin(timestamp, hours, now) {
  if (typeof timestamp !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(timestamp)) return false;
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= hours * 3_600_000;
}

export function assessChecks(evidence, sha, now = Date.now()) {
  const checks = evidence?.check_runs;
  if (!Array.isArray(checks) || evidence.total_count !== checks.length) return "ci_incomplete";
  for (const name of REQUIRED_CHECKS) {
    const named = checks.filter((check) => check?.name === name);
    if (
      named.length !== 1 ||
      named[0].head_sha !== sha ||
      named[0].status !== "completed" ||
      named[0].conclusion !== "success"
    )
      return "ci_incomplete";
    if (!ageWithin(named[0].completed_at, 72, now)) return "ci_stale";
  }
  return "passed";
}

export function assessBackup(evidence, fileExists, now = Date.now()) {
  if (
    evidence?.cold_verification !== "passed" ||
    evidence.credential_locator !== "backup-encryption-v1" ||
    !/^[a-f0-9]{64}$/i.test(evidence.plaintext_sha256 ?? "") ||
    typeof evidence.backup_path !== "string" ||
    !fileExists(evidence.backup_path)
  )
    return "backup_incomplete";
  return ageWithin(evidence.created_at, 24, now) ? "passed" : "backup_stale";
}

export function assessLocalStack(evidence) {
  if (
    !evidence ||
    !["API_URL", "DB_URL", "ANON_KEY", "SERVICE_ROLE_KEY"].every(
      (key) => typeof evidence[key] === "string" && evidence[key].length > 0,
    )
  )
    return "stack_unavailable";
  for (const key of ["API_URL", "DB_URL"]) {
    try {
      const url = new URL(evidence[key]);
      const host = url.hostname.replace(/^\[|\]$/g, "");
      if (
        !(["localhost", "::1"].includes(host) || /^127(?:\.\d{1,3}){3}$/.test(host)) ||
        !(key === "API_URL" ? ["http:", "https:"] : ["postgres:", "postgresql:"]).includes(
          url.protocol,
        )
      )
        return "local_target_invalid";
    } catch {
      return "local_target_invalid";
    }
  }
  return "passed";
}

export async function collectPreflight(candidate, probes) {
  const checks = [];
  // Refuse ADR-128 violations before touching credentials or other services.
  const ordinary = await probes.ordinary();
  checks.push(checkResult("ordinary_checkout", ordinary));
  if (ordinary !== "passed") return { candidate_sha: candidate, result: "failed", checks };
  const names = [
    "candidate_checkout",
    "github_ci",
    "vercel_access",
    "docker",
    "local_supabase",
    "backup_pointer",
    "dpapi_credentials",
    "central_catalogue",
    "port_3101",
  ];
  checks.push(
    ...(await Promise.all(
      names.map(async (name) => {
        try {
          return checkResult(name, await probes[name]());
        } catch {
          return checkResult(name, "access_unverified");
        }
      }),
    )),
  );
  return {
    candidate_sha: candidate,
    result: checks.every((check) => check.result === "passed") ? "passed" : "failed",
    checks,
  };
}
