import { chromium, expect, test } from "@playwright/test";
import {
  chromiumLaunchOptions,
  KUT_DISABLED_FEATURES,
  PLAYWRIGHT_DISABLED_FEATURES,
} from "../support/chromium-launch";

// Chromium reports its command line only with --enable-automation, which
// Playwright leaves off; it changes no feature state.
async function effectiveDisabledFeatures(args: string[]) {
  const browser = await chromium.launch({ args: [...args, "--enable-automation"] });
  try {
    const session = await browser.newBrowserCDPSession();
    const { arguments: argv } = await session.send("Browser.getBrowserCommandLine");
    // Chromium keeps the last occurrence of a switch.
    const last = argv.filter((arg) => arg.startsWith("--disable-features=")).at(-1);
    return last ? last.slice("--disable-features=".length).split(",") : [];
  } finally {
    await browser.close();
  }
}

test("Playwright's own disabled Chromium features are the ones KUT repeats (ADR-127)", async () => {
  expect(await effectiveDisabledFeatures([])).toEqual(PLAYWRIGHT_DISABLED_FEATURES);
});

test("KUT's Chromium launch keeps Playwright's features and disables port randomization", async () => {
  expect(await effectiveDisabledFeatures(chromiumLaunchOptions.args)).toEqual([
    ...PLAYWRIGHT_DISABLED_FEATURES,
    ...KUT_DISABLED_FEATURES,
  ]);
});
