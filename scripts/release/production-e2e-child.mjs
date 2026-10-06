import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

export function redactChildOutput(value, secretValues) {
  return secretValues
    .filter(Boolean)
    .reduce((text, secret) => text.replaceAll(secret, "[REDACTED]"), value)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED JWT]");
}

/**
 * @param {{ root: string, cli: string, args: string[], env: NodeJS.ProcessEnv,
 * logPath: string, secretValues: string[], onProgress?: (message: unknown) => void }} options
 */
export async function runBufferedChild({
  root,
  cli,
  args,
  env,
  logPath,
  secretValues,
  onProgress = undefined,
}) {
  // Buffer before redacting: credentials may span output chunks. Progress uses
  // a separate IPC pipe, never stdout/stderr parsing or forwarding.
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe", ...(onProgress ? ["ipc"] : [])],
    });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    if (onProgress) child.on("message", onProgress);
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, log: Buffer.concat(chunks).toString("utf8") }));
  });
  await writeFile(logPath, redactChildOutput(result.log, secretValues), { flag: "wx" });
  if (result.code !== 0)
    throw new Error("Production E2E child failed; private diagnostics retained.");
}
