// Since Chromium 139, on Windows 11 22H2 and later, `TcpPortRandomizationWin`
// gives every new TCP connection a random local port (`SO_RANDOMIZE_PORT`).
// When that port collides, the connect fails at once with
// net::ERR_NO_BUFFER_SPACE. On the owner's machine 4 of 20,000 fresh loopback
// connects failed that way, and 0 of 20,000 with only this feature disabled;
// on 5 October 2026 one such failure stopped a release-gate sign-in (ADR-127).
// The switch has no effect on other platforms, so CI on Linux is unchanged.
//
// Chromium keeps only the last `--disable-features` switch, and Playwright
// passes its own, so this repeats Playwright's list rather than replacing it.
// tests/e2e/chromium-launch.spec.ts fails when a Playwright upgrade changes
// that list, so neither half can be dropped silently.
export const PLAYWRIGHT_DISABLED_FEATURES = [
  "AvoidUnnecessaryBeforeUnloadCheckSync",
  "DestroyProfileOnBrowserClose",
  "DialMediaRouteProvider",
  "GlobalMediaControls",
  "HttpsUpgrades",
  "LensOverlay",
  "MediaRouter",
  "PaintHolding",
  "ThirdPartyStoragePartitioning",
  "BlockOriginHeaderModificationOnRedirect",
  "Translate",
  "AutoDeElevate",
  "OptimizationHints",
  "msForceBrowserSignIn",
  "msEdgeUpdateLaunchServicesPreferredVersion",
];

export const KUT_DISABLED_FEATURES = ["TcpPortRandomizationWin"];

export const chromiumLaunchOptions = {
  args: [
    `--disable-features=${[...PLAYWRIGHT_DISABLED_FEATURES, ...KUT_DISABLED_FEATURES].join(",")}`,
  ],
};
