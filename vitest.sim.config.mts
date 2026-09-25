import path from "node:path";
import { defineConfig } from "vitest/config";

// The Midweek Madness simulation harness, run on demand by `npm run
// sim:midweek` (BUILD_SPEC §44.12). It takes minutes, so it is deliberately
// not reachable from `vitest.config.mts` / `npm test`; the unit suite runs a
// small smoke version of the same targets instead.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: ["tests/sim/**/*.sim.ts"],
    environment: "node",
    testTimeout: 60 * 60 * 1000,
  },
});
