import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    ".codex/**",
    ".release-evidence/**",
    ".private-backups/**",
    // Independently tracked retained worktrees are outside this checkout's source.
    "work/fix-fixture-lifecycle/**",
    "work/fix-production-gate/**",
    "work/release-soft-graphite/**",
  ]),
  {
    // Design-package build scripts written as CommonJS (design/flut/build)
    // load their tools with require(); that is the module system, not a lapse.
    files: ["design/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
