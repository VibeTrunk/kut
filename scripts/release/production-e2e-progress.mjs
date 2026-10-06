import { RELEASE_PROJECTS } from "./production-e2e-contract.mjs";

const scalar = (value) => Number.isSafeInteger(value) && value >= 0;
const elapsed = (start) => Math.max(0, Math.round(performance.now() - start));

// An IPC message is data, never an output line. Reconstruct the line from an
// exact allowlist; titles, errors, paths, attachments and stdio are never used.
export function formatProjectProgress(message, elapsedMs) {
  if (
    !message ||
    message.kind !== "kut-release-project" ||
    !RELEASE_PROJECTS.includes(message.project) ||
    !["started", "done", "stopped"].includes(message.event) ||
    ![elapsedMs, message.elapsed_ms, message.passed, message.finished, message.total].every(
      scalar,
    ) ||
    message.passed > message.finished ||
    message.finished > message.total ||
    (message.event === "started" && (message.finished !== 0 || message.elapsed_ms !== 0)) ||
    (message.event === "done" && message.finished !== message.total)
  ) {
    return null;
  }
  return `[production-e2e] stage=authenticated-e2e project=${message.project} event=${message.event} elapsed_ms=${elapsedMs} project_elapsed_ms=${message.elapsed_ms} passed=${message.passed} finished=${message.finished} total=${message.total}`;
}

export function createRunnerProgress(
  write = (line) => {
    process.stderr.write(`${line}\n`);
  },
) {
  const start = performance.now();
  let buildStart;
  return {
    buildStarted() {
      buildStart = performance.now();
      write(`[production-e2e] stage=production-build event=started elapsed_ms=${elapsed(start)}`);
    },
    buildDone() {
      write(
        `[production-e2e] stage=production-build event=done elapsed_ms=${elapsed(start)} stage_elapsed_ms=${elapsed(buildStart)}`,
      );
    },
    project(message) {
      const line = formatProjectProgress(message, elapsed(start));
      if (line) write(line);
    },
  };
}

// This reporter uses the control channel only. Raw worker/server output still
// belongs to the JSON report and the parent's buffered, redacted private log.
export default class ProductionE2EProgressReporter {
  constructor(
    _options,
    send = (message) => {
      process.send?.(message);
    },
  ) {
    this.send = send;
    this.projects = new Map();
    this.ended = new Set();
  }

  printsToStdio() {
    // Own the operator channel so Playwright does not add a terminal reporter.
    return true;
  }

  onBegin(_config, suite) {
    for (const test of suite.allTests()) {
      const name = test.parent.project()?.name;
      if (!RELEASE_PROJECTS.includes(name)) continue;
      const state = this.projects.get(name) ?? { total: 0, finished: 0, passed: 0 };
      state.total += 1;
      this.projects.set(name, state);
    }
  }

  emit(name, event) {
    const state = this.projects.get(name);
    this.send({
      kind: "kut-release-project",
      project: name,
      event,
      elapsed_ms: event === "started" ? 0 : elapsed(state.start),
      passed: state.passed,
      finished: state.finished,
      total: state.total,
    });
  }

  onTestBegin(test) {
    const name = test.parent.project()?.name;
    const state = this.projects.get(name);
    if (!state || state.start !== undefined) return;
    state.start = performance.now();
    this.emit(name, "started");
  }

  onTestEnd(test, result) {
    const name = test.parent.project()?.name;
    const state = this.projects.get(name);
    // Retried/duplicate results cannot inflate pass or completion counts.
    if (!state || this.ended.has(test.id)) return;
    this.onTestBegin(test);
    this.ended.add(test.id);
    state.finished += 1;
    if (result.status === "passed" && test.expectedStatus === "passed" && result.retry === 0) {
      state.passed += 1;
    }
    if (state.finished === state.total) this.emit(name, "done");
  }

  onEnd() {
    for (const [name, state] of this.projects) {
      if (state.start !== undefined && state.finished < state.total) this.emit(name, "stopped");
    }
  }
}
