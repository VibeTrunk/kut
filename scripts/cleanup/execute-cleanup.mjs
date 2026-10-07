#!/usr/bin/env node
// Intentionally no --approved flag, receipt lookup, environment override or
// production filesystem adapter. This installation has no proven independent
// owner-consent channel covering this tool. Never manufacture one in a wrapper.
console.error(
  "Cleanup removal is unavailable: independent owner consent and runtime tool coverage have not been established. Plans and receipts grant no removal permission. See docs/CLEANUP.md.",
);
process.exitCode = 1;
