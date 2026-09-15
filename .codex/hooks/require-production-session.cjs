#!/usr/bin/env node
const fs = require("fs");

function stop(reason) {
  process.stdout.write(
    JSON.stringify({ continue: false, stopReason: reason, systemMessage: reason }),
  );
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {
  stop("Production-session hook could not parse its input.");
}

if (process.env.KUT_PRODUCTION_SESSION !== "1") process.exit(0);
const receiptPath = process.env.KUT_PRODUCTION_SESSION_RECEIPT;
if (!receiptPath) stop("Production session has no launcher receipt path.");

let receipt;
try {
  receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
} catch {
  stop("Production session receipt is missing or unreadable.");
}

const observed = String(payload.model || "");
const codexAllowed = ["gpt-6-astra", "gpt-5.6-sol"];
const providerMatches =
  (receipt.provider === "codex" && codexAllowed.includes(observed)) ||
  (receipt.provider === "claude" && /opus/i.test(observed));
const requestMatches =
  receipt.requested_model === observed ||
  (receipt.provider === "claude" && receipt.requested_model === "opus" && /opus/i.test(observed));
if (!providerMatches || !requestMatches) {
  stop(
    `Production model mismatch: launcher requested ${receipt.requested_model}, hook observed ${observed || "nothing"}.`,
  );
}
if (receipt.provider === "codex" && receipt.reasoning_effort !== "high") {
  stop("Codex production receipt does not attest high reasoning effort.");
}

receipt.observed_model = observed;
// Codex's payload does carry the slug, so this is a real attestation. The
// field name matches the Claude hook's so the gate manifest is uniform.
receipt.model_attestation = "hook";
receipt.session_id = payload.session_id || null;
receipt.hook_verified_at = new Date().toISOString();
const pending = `${receiptPath}.${process.pid}.pending`;
try {
  fs.writeFileSync(pending, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(pending, receiptPath);
} catch {
  try {
    fs.unlinkSync(pending);
  } catch {}
  stop("Production-session hook could not atomically attest its receipt.");
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        "This is a production-sensitive KUT session. Release approval is separate from deployment or any external mutation.",
    },
  }),
);
