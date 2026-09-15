import { defineConfig } from "vitest/config";

// The database-backed concurrency suites, run by `npm run test:integration`.
// They are deliberately NOT reachable from `vitest.config.mts` / `npm test`,
// which must stay unit-only and database-free: the CI `fast` job runs
// `verify:fast` with no Postgres at all.
//
// To run a single file: npm run test:integration -- tests/integration/trade-race.test.ts
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Each suite already namespaces every id it writes onto its own UUID
    // prefix, so the three files are safe to interleave. This is the belt to
    // that braces: these suites mutate shared database state instead of
    // rolling back the way pgTAP does, so the *next* suite someone adds
    // cannot introduce a cross-file race by forgetting that convention. It
    // costs about a second on a suite that runs in two.
    fileParallelism: false,
  },
});
