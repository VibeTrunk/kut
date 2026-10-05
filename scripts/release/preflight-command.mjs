import { execFile, spawn } from "node:child_process";
import path from "node:path";

// Buffer both pipes in memory. Neither raw output nor exception messages are
// printed or persisted. Kill only this probe's process tree on its deadline.
export function runReadOnly(file, args, { cwd, timeoutMs = 10_000 } = {}) {
  return new Promise((resolve) => {
    let child;
    let settled = false;
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, ...result });
    };
    const stop = () => {
      if (!child?.pid || child.exitCode !== null) return;
      if (process.platform === "win32") {
        execFile(
          path.join(process.env.SystemRoot ?? "C:\\Windows", "System32/taskkill.exe"),
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true, timeout: 1_500 },
          () => {
            child.kill();
          },
        );
      } else child.kill("SIGKILL");
    };
    try {
      child = spawn(file, args, {
        cwd,
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GH_PROMPT_DISABLED: "1", NO_COLOR: "1" },
      });
      for (const [stream, target] of [
        [child.stdout, "stdout"],
        [child.stderr, "stderr"],
      ]) {
        stream.on("data", (chunk) => {
          if (settled) return;
          bytes += chunk.length;
          if (bytes > 1024 * 1024) {
            stop();
            finish({ ok: false, code: "output_limit", stdout: "", stderr: "" });
          } else if (target === "stdout") stdout += chunk.toString();
          else stderr += chunk.toString();
        });
      }
      child.on("error", (error) => finish({ ok: false, code: error.code }));
      child.on("close", (code) => finish({ ok: code === 0, code }));
      timer = setTimeout(() => {
        stop();
        finish({ ok: false, timedOut: true, stdout: "", stderr: "" });
      }, timeoutMs);
    } catch {
      finish({ ok: false, code: "spawn_failed" });
    }
  });
}
