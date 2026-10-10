import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { evaluate } = require("../../scripts/safety/command-policy.cjs");
const agents = ["codex", "claude"] as const;
const tools = ["Bash", "PowerShell", "exec_command", "functions.exec_command"];
const runtime = (agent: string) =>
  require(path.resolve(`.${agent}/hooks/block-dangerous-commands.cjs`));
const payload = (command: string, tool_name = "Bash") =>
  JSON.stringify({ tool_name, tool_input: { command } });
const decisionOf = (result: { hookSpecificOutput: { permissionDecision: string } } | null) =>
  result?.hookSpecificOutput.permissionDecision ?? null;

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("shared agent hook payloads", () => {
  it("permits ordinary literal file removal while keeping destructive denies", () => {
    for (const agent of agents)
      for (const tool_name of tools) {
        const named = JSON.stringify({
          tool_name,
          tool_input: {
            cmd: "Remove-Item -LiteralPath 'C:\\named-folder\\one.txt' -ErrorAction Stop",
          },
        });
        expect(runtime(agent).evaluate(named, agent)).toBeNull();
        expect(
          decisionOf(runtime(agent).evaluate(payload("Remove-Item old -Recurse -Force"), agent)),
        ).toBe("deny");
      }
  });

  it("uses identical guard bodies for both agents and denies unknown agents", () => {
    const guards = agents.map((agent) =>
      fs.readFileSync(`.${agent}/hooks/block-dangerous-commands.cjs`, "utf8"),
    );
    expect(guards[0].replace('run("codex");', 'run("AGENT");')).toBe(
      guards[1].replace('run("claude");', 'run("AGENT");'),
    );
    for (const agent of agents)
      expect(decisionOf(runtime(agent).evaluate(payload("git status"), "unknown"))).toBe("deny");
  });

  it("does not load an injected editable policy next to either actual hook", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "hook-injection-"));
    temps.push(project);
    const injected = path.join(project, "scripts", "safety");
    const marker = path.join(project, "injected-policy-loaded.txt");
    fs.mkdirSync(injected, { recursive: true });
    fs.writeFileSync(
      path.join(injected, "command-policy.cjs"),
      `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'loaded'); module.exports = { run() { process.stdout.write('{"hookSpecificOutput":{"permissionDecision":"allow"}}'); } };`,
    );
    for (const agent of agents) {
      const entry = path.join(project, `.${agent}`, "hooks", "block-dangerous-commands.cjs");
      fs.mkdirSync(path.dirname(entry), { recursive: true });
      fs.copyFileSync(`.${agent}/hooks/block-dangerous-commands.cjs`, entry);
      for (const input of ["{", payload("git reset --hard")]) {
        const result = spawnSync(process.execPath, [entry], {
          input,
          cwd: project,
          windowsHide: true,
          timeout: 10000,
        });
        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout.toString()).hookSpecificOutput.permissionDecision).toBe(
          "deny",
        );
      }
    }
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("keeps both self-contained runtime policies consistent with the review reference", () => {
    const commands = [
      "git status",
      "git reset --hard",
      "git push --force",
      "Remove-Item old -Recurse -Force",
      "node scripts/tidy.mjs --branch old",
      "node scripts/tidy.mjs --apply --branch old=abc",
    ];
    for (const agent of agents)
      for (const input of ["{", ...tools.flatMap((tool) => commands.map((c) => payload(c, tool)))])
        expect(runtime(agent).evaluate(input, agent)).toEqual(evaluate(input, agent));
  });

  it("runs both actual repository hook entry files with fail-closed payload handling", () => {
    for (const agent of agents)
      for (const input of ["{", payload("git reset --hard")]) {
        const result = spawnSync(
          process.execPath,
          [`.${agent}/hooks/block-dangerous-commands.cjs`],
          { input, windowsHide: true, timeout: 10000 },
        );
        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout.toString()).hookSpecificOutput.permissionDecision).toBe(
          "deny",
        );
      }
  });

  it.each(tools)("covers supported %s command input", (tool_name) => {
    const key = tool_name.includes("exec_command") ? "cmd" : "command";
    const raw = JSON.stringify({ tool_name, tool_input: { [key]: "git reset --hard" } });
    for (const agent of agents) expect(decisionOf(evaluate(raw, agent))).toBe("deny");
  });

  it.each([
    "",
    "{",
    "{}",
    '{"tool_name":"unknown","tool_input":{"command":"safe"}}',
    '{"tool_name":"Bash","tool_input":{"command":42}}',
  ])("fails closed on ambiguous payload %s", (raw) => {
    expect(decisionOf(evaluate(raw, "codex"))).toBe("deny");
  });

  it("blocks direct removal of Git state and leaves tidy to the approval rules", () => {
    for (const command of [
      "git worktree remove old",
      "git worktree prune",
      "git branch -D old",
      "git push origin --delete old",
      "git push --force",
      "git clean -fd",
      "Remove-Item old -Recurse -Force",
    ])
      expect(decisionOf(evaluate(payload(command), "codex"))).toBe("deny");
    // The hook stays silent so the ask/prompt rules below decide.
    for (const command of [
      "node scripts/tidy.mjs",
      "node scripts/tidy.mjs --apply --branch old=0123456789abcdef0123456789abcdef01234567",
    ])
      expect(evaluate(payload(command), "claude")).toBeNull();
  });
});

describe("tidy approval rules", () => {
  it("asks before every tidy apply in Claude and Codex", () => {
    const settings = JSON.parse(fs.readFileSync(".claude/settings.json", "utf8"));
    expect(settings.permissions.ask).toEqual(
      expect.arrayContaining([
        "Bash(node scripts/tidy.mjs --apply*)",
        "PowerShell(node scripts/tidy.mjs --apply*)",
      ]),
    );
    expect(JSON.stringify(settings.permissions.allow)).not.toMatch(/tidy/);
    const rules = fs.readFileSync(".codex/rules/project.rules", "utf8");
    expect(rules).toMatch(
      /pattern = \["node", "scripts\/tidy\.mjs", "--apply"\],\s*decision = "prompt"/,
    );
  });

  it("wires only the dangerous-command hook for both agents", () => {
    const claude = fs.readFileSync(".claude/settings.json", "utf8");
    const codex = fs.readFileSync(".codex/hooks.json", "utf8");
    for (const config of [claude, codex]) {
      expect(config).toMatch(/block-dangerous-commands\.cjs/);
      expect(config).not.toMatch(/block-young-packages/);
    }
  });

  // Codex lets the command through when a hook crashes, so the launcher must
  // start cleanly. A nested PowerShell with `$root` exited 1 inside Codex.
  it("launches the Codex hook on Windows with a plain relative node command", () => {
    const codex = JSON.parse(fs.readFileSync(".codex/hooks.json", "utf8"));
    const launcher = codex.hooks.PreToolUse[0].hooks[0].commandWindows;
    expect(launcher).toBe("node .codex/hooks/block-dangerous-commands.cjs");
    const result = spawnSync(launcher, {
      shell: true,
      input: "{",
      windowsHide: true,
      timeout: 10000,
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout.toString()).hookSpecificOutput.permissionDecision).toBe("deny");
  });
});
