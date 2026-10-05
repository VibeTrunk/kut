// Run first by request-production-gate.ps1, before any GitHub, backup or
// catalogue read: the gate must start from the main checkout (ADR-128).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertMainCheckout } from "./production-e2e-contract.mjs";

try {
  assertMainCheckout(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
