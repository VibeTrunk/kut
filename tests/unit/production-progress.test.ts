import { spawn } from "node:child_process";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  rmdir,
  copyFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import Reporter, {
  createRunnerProgress,
  formatProjectProgress,
} from "../../scripts/release/production-e2e-progress.mjs";
import {
  RELEASE_PROJECTS,
  validateReleaseReport,
} from "../../scripts/release/production-e2e-contract.mjs";
import { runBufferedChild } from "../../scripts/release/production-e2e-child.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const secret = "fictional-private-output";
const jwt = "eyJmaWN0aW9uYWw.payload.signature";
const pack = "a pack's summary names the slots it fills and the copies it adds (ADR-114)";
async function removeFixture(directory: string, fixtureRoot = directory) {
  // Only our uniquely created fictional fixture tree, never preserved evidence.
  const target = path.resolve(directory);
  const base = path.resolve(fixtureRoot);
  if (
    path.dirname(base) !== path.resolve(os.tmpdir()) ||
    !path.basename(base).startsWith("kut-fictional-") ||
    (target !== base && !target.startsWith(`${base}${path.sep}`))
  ) {
    throw new Error("Refusing cleanup outside the unique fictional fixture directory.");
  }
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await removeFixture(file, fixtureRoot);
    else await unlink(file);
  }
  await rmdir(directory);
}
function observe(command: string, args: string[], env = process.env) {
  const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  let closed = false;
  const waiters: { match: (text: string) => boolean; resolve: () => void }[] = [];
  const check = () => {
    for (const waiter of waiters) if (waiter.match(stdout + stderr)) waiter.resolve();
  };
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    check();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    check();
  });
  const done = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      closed = true;
      resolve(code);
    });
  });
  return {
    child,
    done,
    get closed() {
      return closed;
    },
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    until(match: (text: string) => boolean) {
      return new Promise<void>((resolve) => {
        waiters.push({ match, resolve });
        check();
      });
    },
  };
}

describe("safe production E2E progress", () => {
  it("reconstructs only allowlisted labels and integer scalars from IPC", () => {
    const message = {
      kind: "kut-release-project",
      project: RELEASE_PROJECTS[0],
      event: "done",
      elapsed_ms: 7,
      passed: 2,
      finished: 3,
      total: 3,
    };
    const line = formatProjectProgress(
      { ...message, title: secret, error: jwt, stdout: secret },
      9,
    );
    expect(line).toContain("passed=2 finished=3 total=3");
    expect(line).not.toContain(secret);
    expect(line).not.toContain(jwt);
    for (const invalid of [
      null,
      { ...message, project: secret },
      { ...message, event: secret },
      { ...message, passed: secret },
      { ...message, elapsed_ms: -1 },
      { ...message, total: 2 },
      { ...message, passed: 4 },
      { ...message, finished: 2 },
    ]) {
      expect(formatProjectProgress(invalid, 9)).toBeNull();
    }
  });

  it("counts only expected first-attempt passes, never expected failures, skips or duplicates", () => {
    const messages: Record<string, unknown>[] = [];
    const reporter = new Reporter({}, (message: Record<string, unknown>) => messages.push(message));
    const test = (id: string, expectedStatus = "passed") => ({
      id,
      expectedStatus,
      parent: { project: () => ({ name: RELEASE_PROJECTS[0] }) },
      title: secret,
    });
    const tests = [
      test("pass"),
      test("skip", "skipped"),
      test("expected-failure", "failed"),
      test("unexpected-pass", "failed"),
      test("retry"),
    ];
    reporter.onBegin({}, { allTests: () => tests });
    for (const [index, item] of tests.entries()) {
      reporter.onTestBegin(item);
      const result = {
        status: ["passed", "skipped", "failed", "passed", "passed"][index],
        retry: index === 4 ? 1 : 0,
        error: secret,
      };
      reporter.onTestEnd(item, result);
      reporter.onTestEnd(item, result);
    }
    reporter.onEnd();
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ event: "done", passed: 1, finished: 5, total: 5 });
    expect(JSON.stringify(messages)).not.toContain(secret);
    const partial: Record<string, unknown>[] = [];
    const interrupted = new Reporter({}, (message: Record<string, unknown>) =>
      partial.push(message),
    );
    interrupted.onBegin({}, { allTests: () => tests });
    interrupted.onTestBegin(tests[0]);
    interrupted.onTestEnd(tests[0], { status: "timedOut", retry: 0 });
    interrupted.onEnd();
    expect(partial[1]).toMatchObject({ event: "stopped", passed: 0, finished: 1, total: 5 });
  });

  it.each([false, true, "teardown"])(
    "receives real Playwright project progress before completion; failure=%s",
    async (failure) => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "kut-fictional-progress-"));
      let observed: ReturnType<typeof observe> | undefined;
      try {
        const testImport = new URL("../../node_modules/@playwright/test/index.mjs", import.meta.url)
          .href;
        const reporterPath = path.join(root, "scripts/release/production-e2e-progress.mjs");
        const base = {
          testDir: directory,
          workers: 1,
          retries: 0,
          maxFailures: 1,
          globalTimeout: 15000,
          projects: RELEASE_PROJECTS.map((name: string) => ({ name })),
          ...(failure === "teardown"
            ? { globalTeardown: path.join(directory, "teardown.mjs") }
            : {}),
        };
        await writeFile(
          path.join(directory, "teardown.mjs"),
          `export default () => { throw new Error('${secret} ${jwt}'); };`,
        );
        for (const name of ["inventory", "run"]) {
          const reporter = [
            [
              "json",
              {
                outputFile: path.join(directory, name === "run" ? "report.json" : "inventory.json"),
              },
            ],
            [reporterPath],
          ];
          await writeFile(
            path.join(directory, `${name}.config.mjs`),
            `export default ${JSON.stringify({ ...base, reporter })};`,
          );
        }
        await writeFile(
          path.join(directory, "build.mjs"),
          `process.stdout.write('${secret.slice(0, 10)}'); setTimeout(() => { process.stdout.write('${secret.slice(10)}'); process.stderr.write('${jwt}'); }, 10);`,
        );
        await writeFile(
          path.join(directory, "progress.spec.mjs"),
          `
        import { test, expect } from ${JSON.stringify(testImport)};
        import fs from 'node:fs';
        test('member ${secret}', async () => { console.log('${secret}'); console.error('${jwt}'); });
        test(${JSON.stringify(pack)}, async ({}, info) => { test.skip(info.project.name !== 'authenticated-320'); });
        test('admin ${secret}', async ({}, info) => {
          if (info.project.name === 'authenticated-webkit') {
            while (!fs.existsSync(${JSON.stringify(path.join(directory, "continue"))})) await new Promise(r => setTimeout(r, 20));
            expect(${failure === true}).toBe(false);
          }
        });
      `,
        );
        observed = observe(process.execPath, [
          path.join(root, "tests/fixtures/production-progress-harness.mjs"),
          directory,
        ]);
        await observed.until(
          (text) =>
            text.includes("project=authenticated-pixel7 event=done") &&
            text.includes("project=authenticated-webkit event=started"),
        );
        expect(observed.closed).toBe(false);
        expect(observed.stdout).toBe("");
        expect(observed.stderr).toContain("passed=2 finished=3 total=3");
        await writeFile(path.join(directory, "continue"), "fictional fixture latch");
        expect(await observed.done).toBe(failure ? 1 : 0);
        expect(JSON.parse(observed.stdout)).toEqual({ result: failure ? "failed" : "passed" });
        const lines = observed.stderr.trim().split(/\r?\n/);
        expect(lines).toHaveLength(8);
        expect(lines[0]).toMatch(
          /^\[production-e2e\] stage=production-build event=started elapsed_ms=\d+$/,
        );
        expect(lines[1]).toMatch(/event=done elapsed_ms=\d+ stage_elapsed_ms=\d+$/);
        if (failure === "teardown") {
          expect(
            lines.find((line) => line.includes("project=authenticated-webkit event=done")),
          ).toContain("passed=2 finished=3 total=3");
        }
        const report = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"));
        const inventory = JSON.parse(
          await readFile(path.join(directory, "inventory.json"), "utf8"),
        );
        if (failure) expect(() => validateReleaseReport(report, inventory)).toThrow();
        else {
          const counts = validateReleaseReport(report, inventory);
          for (const name of RELEASE_PROJECTS)
            expect(lines.find((line) => line.includes(`project=${name} event=done`))).toContain(
              `passed=${counts[name].passed} finished=3 total=3`,
            );
        }
        expect(observed.stdout + observed.stderr).not.toContain(secret);
        expect(observed.stdout + observed.stderr).not.toContain(jwt);
        for (const name of ["build", "tests"]) {
          const log = await readFile(path.join(directory, `${name}.log`), "utf8");
          expect(log).not.toContain(secret);
          expect(log).not.toContain(jwt);
          if (name === "build") expect(log).toContain("[REDACTED]");
        }
      } finally {
        if (observed && !observed.closed) {
          observed.child.kill();
          await observed.done;
        }
        await removeFixture(directory);
      }
    },
    30000,
  );

  it("rejects child failure and preserves redacted diagnostics without a false build completion", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kut-fictional-child-"));
    try {
      const lines: string[] = [];
      const progress = createRunnerProgress((line: string) => lines.push(line));
      const cli = path.join(directory, "fail.mjs");
      await writeFile(cli, `process.stderr.write('${secret} ${jwt}'); process.exitCode=7;`);
      progress.buildStarted();
      await expect(
        runBufferedChild({
          root: directory,
          cli,
          args: [],
          env: process.env,
          logPath: path.join(directory, "build.log"),
          secretValues: [secret],
        }).then(() => progress.buildDone()),
      ).rejects.toThrow("child failed");
      expect(lines).toHaveLength(1);
      expect(await readFile(path.join(directory, "build.log"), "utf8")).toBe(
        "[REDACTED] [REDACTED JWT]",
      );
    } finally {
      await removeFixture(directory);
    }
  });

  it("never treats raw output or malformed IPC as operator progress", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kut-fictional-ipc-"));
    try {
      const lines: string[] = [];
      const progress = createRunnerProgress((line: string) => lines.push(line));
      const cli = path.join(directory, "ipc.mjs");
      await writeFile(
        cli,
        `
        process.stdout.write('[production-e2e] ${secret}');
        process.stderr.write('${jwt}');
        process.send({ kind: 'kut-release-project', project: '${secret}', event: 'done', elapsed_ms: 1, passed: 1, finished: 1, total: 1 });
        process.send({ kind: 'kut-release-project', project: 'authenticated-320', event: 'done', elapsed_ms: 1, passed: '${secret}', finished: 1, total: 1 });
        process.send({ kind: 'kut-release-project', project: 'authenticated-320', event: 'done', elapsed_ms: 1, passed: 1, finished: 1, total: 1, error: '${secret}' });
      `,
      );
      await runBufferedChild({
        root: directory,
        cli,
        args: [],
        env: process.env,
        logPath: path.join(directory, "ipc.log"),
        secretValues: [secret],
        onProgress: progress.project,
      });
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("project=authenticated-320 event=done");
      expect(lines[0]).not.toContain(secret);
      const log = await readFile(path.join(directory, "ipc.log"), "utf8");
      expect(log).not.toContain(secret);
      expect(log).not.toContain(jwt);
    } finally {
      await removeFixture(directory);
    }
  });

  it.each(["success", "nonzero", "unexpected-stderr", "invalid-json"])(
    "keeps Windows PowerShell Stop semantics and JSON separation: %s",
    async (mode) => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "kut-fictional-powershell-progress-"));
      let observed: ReturnType<typeof observe> | undefined;
      try {
        const scripts = path.join(directory, "scripts/release");
        await mkdir(scripts, { recursive: true });
        const helper = path.join(scripts, "invoke-production-e2e.ps1");
        await copyFile(path.join(root, "scripts/release/invoke-production-e2e.ps1"), helper);
        await writeFile(
          path.join(scripts, "run-production-e2e.mjs"),
          `
        import fs from 'node:fs';
        process.stderr.write('[production-e2e] stage=production-build event=started elapsed_ms=0\\n');
        while (!fs.existsSync(${JSON.stringify(path.join(directory, "continue"))})) await new Promise(r => setTimeout(r, 20));
        ${mode === "unexpected-stderr" ? `process.stderr.write('${secret}\\n');` : ""}
        console.log(${mode === "invalid-json" ? JSON.stringify(secret) : `'${JSON.stringify({ result: "passed", candidate_sha: "a".repeat(40) })}'`});
        process.exitCode=${mode === "nonzero" ? 7 : 0};
      `,
        );
        const wrapper = path.join(directory, "wrapper.ps1");
        await writeFile(
          wrapper,
          `$ErrorActionPreference='Stop'\ntry { $json = & '${helper.replaceAll("'", "''")}' -CandidateSha ('a' * 40); $result = $json | ConvertFrom-Json; if ($result.result -ne 'passed' -or $ErrorActionPreference -ne 'Stop') { throw 'Invalid result or error policy' }; Write-Output 'JSON passed; Stop preserved' } catch { Write-Output 'Safe failure'; exit 1 }`,
        );
        observed = observe(process.platform === "win32" ? "powershell.exe" : "pwsh", [
          "-NoProfile",
          "-File",
          wrapper,
        ]);
        await observed.until((text) => text.includes("event=started"));
        expect(observed.closed).toBe(false);
        await writeFile(path.join(directory, "continue"), "fictional fixture latch");
        expect(await observed.done).toBe(mode === "success" ? 0 : 1);
        expect(observed.stdout).toContain(
          mode === "success" ? "JSON passed; Stop preserved" : "Safe failure",
        );
        expect(observed.stdout + observed.stderr).not.toContain(secret);
      } finally {
        if (observed && !observed.closed) {
          observed.child.kill();
          await observed.done;
        }
        await removeFixture(directory);
      }
    },
    30000,
  );
});
