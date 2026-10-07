#!/usr/bin/env node
// Trusted host integration imports this entry. A shell launch cannot reconstruct
// a host callback from flags, environment, stdin, a transcript or a local file.
import { pathToFileURL } from "node:url";
export { executeCleanup } from "./executor.mjs";
export { createHostRuntime } from "./runtime-adapters.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error(
    "Cleanup removal needs a trusted host connection for independent owner consent, live tool coverage and exact filesystem scope. This standalone shell route has no such connection. See docs/CLEANUP.md.",
  );
  process.exitCode = 1;
}
