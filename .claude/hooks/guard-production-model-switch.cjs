#!/usr/bin/env node
// PreModelSwitch guard for a production-sensitive Claude session.
//
// Unlike SessionStart, this event can genuinely block: exit code 2 denies the
// switch, and the reason is read from permissionDecision.reason or stderr. That
// makes this the one place in the Claude runtime where the Opus requirement is
// actually enforced rather than merely recorded — it stops a production session
// being downgraded to a cheaper model partway through a release check.
//
// It also refuses to let the switch pass silently when the payload is
// unparsable: in a production session, an unreadable switch is a denied switch.

const fs = require("fs");

if (process.env.KUT_PRODUCTION_SESSION !== "1") process.exit(0);

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreModelSwitch",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
      // The reason is also written to stderr because exit code 2 falls back to
      // stderr when no decision reason is present.
    }),
  );
  process.stderr.write(reason);
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {
  deny("KUT production session: the model-switch payload could not be parsed, so it is denied.");
}

const to = typeof payload.to_model === "string" ? payload.to_model : "";
if (!/opus/i.test(to)) {
  deny(
    `KUT production session: refusing to switch to '${to || "an unnamed model"}'. ` +
      "Production release work runs on Opus. End this session and start a new one through " +
      "scripts/start-production-claude.ps1 if you need a different model.",
  );
}

// An Opus-to-Opus switch is allowed, but the receipt must stop claiming the
// model this session started on.
const receiptPath = process.env.KUT_PRODUCTION_SESSION_RECEIPT;
if (receiptPath) {
  try {
    const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    receipt.observed_model = to;
    receipt.model_attestation = "hook";
    receipt.model_switched_at = new Date().toISOString();
    const pending = `${receiptPath}.${process.pid}.switch`;
    fs.writeFileSync(pending, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "w" });
    fs.renameSync(pending, receiptPath);
  } catch {
    deny(
      "KUT production session: the launcher receipt could not be updated for this model switch, " +
        "so the switch is denied rather than leaving stale evidence.",
    );
  }
}

process.exit(0);
