import { defineConfig, devices } from "@playwright/test";
import { chromiumLaunchOptions } from "./tests/support/chromium-launch";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      // Without Windows TCP port randomization (ADR-127).
      use: { ...devices["Desktop Chrome"], launchOptions: chromiumLaunchOptions },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    env: {
      // Auth-boundary tests do not need a real Supabase project, but Proxy
      // initializes the public client for every request.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_test",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
  },
});
