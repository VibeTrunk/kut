#!/usr/bin/env node
// SessionStart attestation for a production-sensitive Claude session.
//
// What this hook can and cannot do, per the Claude Code hooks reference:
//
//   * It CANNOT abort the session. `"continue": false` is not honoured for
//     SessionStart and exit code 2 is a non-blocking error there. An earlier
//     version of this file returned `continue:false` and was believed to be a
//     hard stop; it never was.
//   * It CAN observe `model`, but only sometimes — the reference states that
//     "Claude Code doesn't always include it". Treating an absent `model` as a
//     violation would have blocked every launcher session (had blocking
//     worked), so absence is recorded, not punished.
//
// So this hook's real job is evidence: it writes what it actually observed into
// the launcher receipt, and `scripts/release/request-production-gate.ps1` is
// what fails closed on that evidence. Blocking a *mid-session* downgrade is
// handled separately by guard-production-model-switch.cjs, which runs on
// PreModelSwitch where exit code 2 does block.

const fs = require("fs");

function emit(object) {
  process.stdout.write(JSON.stringify(object));
  process.exit(0);
}

function warn(message) {
  emit({
    systemMessage: message,
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: message },
  });
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {
  payload = {};
}

if (process.env.KUT_PRODUCTION_SESSION !== "1") process.exit(0);

const receiptPath = process.env.KUT_PRODUCTION_SESSION_RECEIPT;
if (!receiptPath) {
  warn(
    "KUT production session flagged but no launcher receipt path is set. The release gate will " +
      "refuse this session. Restart through scripts/start-production-claude.ps1.",
  );
}

let receipt;
try {
  receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
} catch {
  warn(
    `KUT production-session receipt at ${receiptPath} is missing or unreadable. The release gate ` +
      "will refuse this session.",
  );
}

// `model` is optional on SessionStart. Record which of the three cases held so
// the gate can distinguish "verified Opus" from "could not be checked here"
// from "checked and wrong".
const observed = typeof payload.model === "string" ? payload.model : null;
let attestation;
if (observed === null) attestation = "unavailable";
else if (/opus/i.test(observed)) attestation = "hook";
else attestation = "rejected";

receipt.observed_model = observed;
receipt.model_attestation = attestation;
receipt.session_id = payload.session_id || null;
receipt.permission_mode = payload.permission_mode || null;
receipt.hook_verified_at = new Date().toISOString();

const pending = `${receiptPath}.${process.pid}.pending`;
try {
  fs.writeFileSync(pending, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(pending, receiptPath);
} catch {
  try {
    fs.unlinkSync(pending);
  } catch {
    /* the pending file may never have been created */
  }
  warn(
    "KUT production-session hook could not write its receipt atomically. The release gate will " +
      "refuse this session.",
  );
}

if (attestation === "rejected") {
  warn(
    `KUT production session observed model '${observed}', which is not an Opus model. The release ` +
      "gate will refuse this session; restart through scripts/start-production-claude.ps1.",
  );
}

const modelNote =
  attestation === "hook"
    ? `Model verified at session start: ${observed}.`
    : "Claude Code did not report a model to this hook, so the Opus requirement is enforced by the " +
      "launcher, not runtime-attested.";

emit({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext:
      "This is a production-sensitive KUT session. " +
      modelNote +
      " Release approval is separate from deployment or any other external mutation, and a passing " +
      "gate authorizes neither.",
  },
});
