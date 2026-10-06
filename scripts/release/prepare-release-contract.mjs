import { readFile, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { checkResult } from "./preflight-contract.mjs";

export const evidenceHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const parse = (bytes) => JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
const fresh = (time, earliest, now) =>
  Number.isFinite(Date.parse(time)) && Date.parse(time) >= earliest && Date.parse(time) <= now;

export async function readGate(root, file, sha, startedAt, now = Date.now()) {
  // Accept only the manifest returned by this run, inside this candidate's
  // ordinary-checkout evidence directory. Never discover the latest old gate.
  const directory = await realpath(path.join(root, ".release-evidence/gates", sha));
  const resolved = await realpath(file);
  if (
    path.dirname(resolved) !== directory ||
    !/^gate-\d{8}-\d{6}\.json$/.test(path.basename(resolved))
  )
    throw Error("gate_invalid");
  const bytes = await readFile(resolved);
  const gate = parse(bytes);
  if (
    gate.version !== 2 ||
    gate.result !== "passed" ||
    gate.candidate_sha !== sha ||
    gate.release_approval !== "not_granted" ||
    gate.deployment_authorized !== false ||
    !fresh(gate.created_at, startedAt, now)
  )
    throw Error("gate_invalid");
  return { path: resolved, hash: evidenceHash(bytes), created_at: gate.created_at };
}

export async function readApproval(gate, sha, owner, now = Date.now()) {
  const file = gate.path + ".approval.json";
  const bytes = await readFile(file);
  const approval = parse(bytes);
  if (
    approval.version !== 1 ||
    approval.candidate_sha !== sha ||
    approval.approved_by !== owner ||
    approval.release_approved !== true ||
    approval.deployment_authorized !== false ||
    approval.gate_manifest !== gate.path ||
    !fresh(approval.approved_at, Date.parse(gate.created_at), now)
  )
    throw Error("approval_invalid");
  return { path: file, hash: evidenceHash(bytes) };
}

export async function assertUnchanged(...records) {
  for (const record of records)
    if (evidenceHash(await readFile(record.path)) !== record.hash) throw Error("evidence_changed");
}

export async function prepareRelease(sha, number, explicitRelease, services) {
  let stage = "authorization";
  let preflightChecks;
  const startedAt = Date.now();
  const progressStartedAt = performance.now();
  const progress = (event) =>
    services.progress?.(
      `[release-prepare] stage=${stage} event=${event} elapsed_ms=${Math.max(0, Math.round(performance.now() - progressStartedAt))}`,
    );
  try {
    if (!/^[a-f0-9]{40}$/.test(sha) || !Number.isSafeInteger(number) || number < 1)
      throw Error("candidate_invalid");
    let authorization = await services.authorization(sha, number);
    if (
      authorization.candidate_sha !== sha ||
      authorization.source !== "owner_merge" ||
      authorization.approved_by !== "MartinFloris"
    )
      throw Error("authorization_invalid");
    if (authorization.documentation_only && !explicitRelease)
      return {
        result: "not_required",
        candidate_sha: sha,
        reason: "documentation_only",
        deployment_authorized: false,
      };
    if (explicitRelease && !(await services.confirm(sha))) throw Error("authorization_invalid");
    authorization = { ...authorization, explicit_release: explicitRelease };
    stage = "preflight";
    progress("started");
    const preflight = await services.preflight(sha);
    const names = [
      "ordinary_checkout",
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
    if (Array.isArray(preflight.checks))
      preflightChecks = preflight.checks
        .filter((c) => names.includes(c?.name))
        .map((c) =>
          checkResult(
            c.name,
            c.result === "passed" && c.reason === "passed"
              ? "passed"
              : c.reason === "passed" || typeof c.reason !== "string"
                ? "invalid_evidence"
                : c.reason,
          ),
        );
    if (preflight.result !== "passed" || preflight.candidate_sha !== sha)
      throw Error("preflight_failed");
    if (
      preflight.checks?.length !== names.length ||
      preflightChecks?.length !== names.length ||
      names.some(
        (n) => preflightChecks.filter((c) => c.name === n && c.result === "passed").length !== 1,
      )
    )
      throw Error("preflight_failed");
    progress("done");
    stage = "gate";
    progress("started");
    const gateResult = await services.stage("gate", sha);
    if (
      gateResult?.result !== "passed" ||
      gateResult.candidate_sha !== sha ||
      typeof gateResult.gate_manifest !== "string"
    )
      throw Error("gate_invalid");
    const gate = await services.readGate(gateResult.gate_manifest, sha, startedAt);
    progress("done");
    stage = "approval";
    progress("started");
    // Requery owner merge/current main after expensive work. A newer main
    // stops this run; it never becomes a replacement candidate.
    const current = await services.authorization(sha, number);
    if (
      JSON.stringify(current) !== JSON.stringify({ ...authorization, explicit_release: undefined })
    )
      throw Error("authorization_changed");
    await services.unchanged(gate);
    const approved = await services.stage("approval", sha, {
      gate: gate.path,
      approvedBy: authorization.approved_by,
    });
    if (approved?.result !== "passed" || approved.candidate_sha !== sha)
      throw Error("approval_invalid");
    const approval = await services.readApproval(gate, sha, authorization.approved_by);
    await services.unchanged(gate, approval);
    progress("done");
    stage = "assertion";
    progress("started");
    const asserted = await services.stage("assertion", sha, { gate: gate.path });
    if (asserted?.result !== "passed" || asserted.candidate_sha !== sha)
      throw Error("assertion_failed");
    await services.unchanged(gate, approval);
    progress("done");
    stage = "handoff";
    const commands = await services.commands({ sha, authorization, gate, approval });
    return {
      result: "prepared",
      candidate_sha: sha,
      authorization,
      gate_manifest: gate.path,
      approval_manifest: approval.path,
      evidence_assertion: "passed",
      deployment_authorized: false,
      deployment_performed: false,
      commands,
    };
  } catch (error) {
    const reasons = [
      "candidate_invalid",
      "authorization_invalid",
      "authorization_changed",
      "preflight_failed",
      "gate_invalid",
      "approval_invalid",
      "assertion_failed",
      "evidence_changed",
    ];
    return {
      result: "failed",
      candidate_sha: /^[a-f0-9]{40}$/.test(sha ?? "") ? sha : null,
      stage,
      ...(stage === "preflight" && preflightChecks ? { checks: preflightChecks } : {}),
      reason: reasons.includes(error?.message) ? error.message : "stage_failed",
      deployment_authorized: false,
      deployment_performed: false,
    };
  }
}
