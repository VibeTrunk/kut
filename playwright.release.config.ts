import { defineConfig } from "@playwright/test";
import authenticated from "./playwright.authenticated.config";

// Only run through scripts/release/run-production-e2e.mjs: it owns the fresh
// build, exact-SHA checks and a unique evidence directory. CI cannot select dev,
// a reused server, retry-only tracing, or retry a failed release assertion.
if (!process.env.KUT_RELEASE_RUN_DIR || !process.env.KUT_RELEASE_CANDIDATE) {
  throw new Error("Use the production E2E runner with an exact candidate SHA.");
}

export default defineConfig({
  ...authenticated,
  retries: 0,
  forbidOnly: true,
  workers: 1,
  maxFailures: 1,
  globalTimeout: 30 * 60 * 1000,
  outputDir: `${process.env.KUT_RELEASE_RUN_DIR}/test-results`,
  reporter: [
    [
      "json",
      {
        outputFile:
          process.env.KUT_RELEASE_REPORT_PATH ?? `${process.env.KUT_RELEASE_RUN_DIR}/report.json`,
      },
    ],
  ],
  use: { ...authenticated.use, trace: "retain-on-failure" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --port 3101 --hostname 127.0.0.1",
    url: "http://127.0.0.1:3101/login",
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  },
});
