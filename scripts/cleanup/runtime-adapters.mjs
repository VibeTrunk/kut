// This module is loaded by a trusted host, never from a CLI-supplied adapter path.
// Its callbacks are a trust boundary: JSON, tool output and local receipts cannot
// instantiate an authenticated owner UI, a sandbox or durable host storage.
import { approvalView, validatePlan } from "./plan.mjs";
import { objectDigest } from "./inspect.mjs";

const runtimes = new WeakMap();

export function operationScope(item) {
  return {
    network: false,
    write: [item.path, item.admin],
    read: [item.recovery.archive.path, item.recovery.recoveryReceipt.path],
  };
}

export function codexPermissions(scope) {
  return {
    fileSystem: {
      entries: [
        ...scope.read.map((path) => ({ access: "read", path: { type: "path", path } })),
        ...scope.write.map((path) => ({ access: "write", path: { type: "path", path } })),
      ],
    },
    network: { enabled: false },
  };
}

/**
 * Host callbacks must live outside agent-writable state. ownerDecision returns
 * an original host event (owner-chat or owner-ui), not an approval assertion
 * reconstructed from a file. load/save retain decisions AND progress through
 * restart, detect missing/tampered records and serialize concurrent callers.
 * withScope must enforce the requested scope, not merely return a receipt.
 * assertCoverage must verify the live route for this agent and fail closed.
 */
export function createHostRuntime(agent, services) {
  if (!["codex", "claude"].includes(agent)) throw Error("unsupported_agent");
  for (const name of ["assertCoverage", "ownerDecision", "load", "save", "withScope", "exclusive"])
    if (typeof services?.[name] !== "function") throw Error("trusted_host_connection_required");
  const runtime = Object.freeze({});
  runtimes.set(runtime, { agent, services });
  return runtime;
}

export function runtimeServices(runtime) {
  const value = runtimes.get(runtime);
  if (!value) throw Error("trusted_host_connection_required");
  return value;
}

export async function authorizeItem(runtime, plan, item, saved) {
  const { agent, services } = runtimeServices(runtime);
  validatePlan(plan);
  const contract = { path: item.path, digest: item.approvalDigest };
  // An existing refusal is never converted into approval by resume.
  if (saved) {
    if (objectDigest(saved.contract) !== objectDigest(contract))
      throw Error("resume_contract_changed");
    if (
      !["owner-chat", "owner-ui"].includes(saved.owner?.source) ||
      typeof saved.owner.id !== "string" ||
      !saved.owner.id ||
      objectDigest(saved.owner.contract) !== objectDigest(contract)
    )
      throw Error("checkpoint_invalid");
    if (saved.owner?.decision !== "approve") throw Error("specific_owner_consent_refused");
    return saved;
  }
  const request = {
    agent,
    contract,
    explanation:
      approvalView(plan, [item.path]) +
      "\nChecked before this owner decision: independent recovery passed for the exact listed local files and committed history. The current files, index, links and evidence match. Clean Git status alone does not establish that the work is finished; approve this copy only if you no longer need it here.",
    scope: operationScope(item),
    codexPermissions: agent === "codex" ? codexPermissions(operationScope(item)) : undefined,
  };
  // Only the host's direct authenticated event channel supplies this result.
  const event = await services.ownerDecision(request);
  if (
    !event ||
    !["owner-chat", "owner-ui"].includes(event.source) ||
    typeof event.id !== "string" ||
    !event.id ||
    !["approve", "refuse"].includes(event.decision) ||
    objectDigest(event.contract) !== objectDigest(contract)
  )
    throw Error("specific_owner_consent_missing");
  const record = {
    contract,
    owner: event,
    phase: event.decision === "approve" ? "links" : "owner-refused",
  };
  await services.save(contract, null, record);
  if (event.decision !== "approve") throw Error("specific_owner_consent_refused");
  return record;
}

// Wire these only inside the actual client's authenticated owner response
// handler. The transport supplies source/id; model/tool JSON never supplies it.
export function codexOwnerEvent(request, response, identity) {
  if (
    response?.decision !== "accept" &&
    response?.decision !== "decline" &&
    response?.decision !== "cancel"
  )
    throw Error("unsupported_owner_response");
  return {
    ...identity,
    contract: request.contract,
    decision: response.decision === "accept" ? "approve" : "refuse",
  };
}

export function claudeOwnerEvent(request, response, identity) {
  if (!["allow", "deny"].includes(response?.behavior)) throw Error("unsupported_owner_response");
  if (
    response.updatedInput &&
    objectDigest(response.updatedInput) !== objectDigest(request.contract)
  )
    throw Error("owner_scope_changed");
  return {
    ...identity,
    contract: request.contract,
    decision: response.behavior === "allow" ? "approve" : "refuse",
  };
}
