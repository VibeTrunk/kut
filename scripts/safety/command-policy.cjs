// Hooks use CommonJS because both runtimes launch .cjs before project loading.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");

// Policy reference for review/tests only. Runtime hooks contain their own copy
// and must never load this agent-editable file to make enforcement decisions.
const dangers = [
  [/\brm\s+(-\S+\s+)*-\S*[rf]\S*[rf]?/i, "recursive or forced delete"],
  [/\bgit\s+push\b[^\n]*(?:--force\b|--force-with-lease\b|\s-f\b)/i, "force push"],
  [
    /\bgit\s+push\b[^\n]*(?:--delete\b|\s:[A-Za-z0-9._/-]+)/i,
    "remote branch deletion; use node scripts/tidy.mjs --remote",
  ],
  [/\bgit\s+reset\s+--hard\b/i, "hard reset"],
  [/\bgit\s+clean\s+-\S*f/i, "forced git clean"],
  [/\bgit\s+checkout\s+(--\s|\.$|\.\s)/i, "broad checkout discard"],
  [
    /\b(?:curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\n]*\|[^\n]*\b(?:sh|bash|pwsh|powershell|python|node|iex)\b/i,
    "download piped into interpreter",
  ],
  [
    /\biex\b[^\n]*\biwr\b|\biwr\b[^\n]*\|[^\n]*\biex\b|\binvoke-expression\b[^\n]*\binvoke-webrequest\b/i,
    "download executed directly",
  ],
  [
    /\bremove-item\b[^\n]*-recurse[^\n]*-force|\bremove-item\b[^\n]*-force[^\n]*-recurse/i,
    "forced recursive PowerShell deletion",
  ],
  [
    /\bgit\b[^\n]*\bworktree\s+(?:remove|prune)\b/i,
    "direct worktree removal or broad pruning; use node scripts/tidy.mjs",
  ],
  [/\bgit\s+branch\s+-[dD]\b/i, "direct branch deletion; use node scripts/tidy.mjs"],
  [
    /\btidy\.mjs\b[^\n]*--apply\b/i,
    "tidy --apply by an agent; the owner runs the printed command in their own terminal",
  ],
];

function decision(value, reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: value,
      permissionDecisionReason: reason,
    },
  };
}
function evaluate(raw, agent) {
  if (agent !== "codex" && agent !== "claude")
    return decision("deny", "Unsupported agent; no approval can be inferred.");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return decision("deny", "Safety payload is unreadable; no consent can be inferred.");
  }
  const supported = ["Bash", "PowerShell", "exec_command", "functions.exec_command"];
  if (!payload || !supported.includes(payload.tool_name))
    return decision(
      "deny",
      "Unsupported safety tool name; coverage must be established before proceeding.",
    );
  const input = payload.tool_input;
  const command = input?.command ?? input?.cmd;
  if (typeof command !== "string" || !command.trim())
    return decision("deny", "Missing shell command; fail closed.");
  for (const [pattern, reason] of dangers)
    if (pattern.test(command))
      return decision(
        "deny",
        "Repository safety policy blocks " + reason + ". A wrapper is not an exception.",
      );
  return null;
}

function run(agent) {
  let result;
  try {
    result = evaluate(fs.readFileSync(0, "utf8"), agent);
  } catch {
    result = decision("deny", "Safety check could not read its input; fail closed.");
  }
  if (result) process.stdout.write(JSON.stringify(result));
}
module.exports = { evaluate, run };
