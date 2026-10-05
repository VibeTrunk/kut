import { defineConfig, devices } from "@playwright/test";
import { chromiumLaunchOptions } from "./tests/support/chromium-launch";
import { assertLocalTarget } from "./tests/support/local-target";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.ANON_KEY;
if (!anonKey) throw new Error("Authenticated E2E requires ANON_KEY from `supabase status -o env`.");
// Fail before Playwright starts anything: the global setup deletes and
// recreates auth users on whatever API_URL names.
assertLocalTarget(apiUrl, process.env.API_URL ? "API_URL" : "the built-in default");

export default defineConfig({
  testDir: "./tests/e2e-authenticated",
  fullyParallel: false,
  // One worker: all projects sign in as the same two fixture accounts, and
  // the global setup owns those rows.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e-authenticated/global-setup.ts",
  globalTeardown: "./tests/e2e-authenticated/global-teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "on-first-retry",
  },
  // Two widths, because they fail differently: the Pixel 7 is the realistic
  // club phone, and 320x568 is the narrowest screen still in use — it is what
  // catches a table or a button row that cannot shrink. WebKit covers a second
  // browser engine, including font/canvas recovery; it is not a real iPhone.
  // Chromium launches without Windows TCP port randomization (ADR-127).
  projects: [
    {
      name: "authenticated-pixel7",
      use: { ...devices["Pixel 7"], browserName: "chromium", launchOptions: chromiumLaunchOptions },
    },
    {
      name: "authenticated-320",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        launchOptions: chromiumLaunchOptions,
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: "authenticated-webkit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3101",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
    },
    url: "http://127.0.0.1:3101",
    reuseExistingServer: !process.env.CI,
  },
});
