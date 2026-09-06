import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/integration/next-features-race.test.ts"], environment: "node", testTimeout: 30_000, hookTimeout: 30_000 } });
