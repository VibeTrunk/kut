import fs from "node:fs";
import { digest } from "./inspect.mjs";
import { restorePayload, storedCipher } from "./recovery.mjs";

let plaintext;
try {
  const request = JSON.parse(fs.readFileSync(0, "utf8"));
  plaintext = storedCipher(
    "Decrypt",
    { path: request.archive },
    request.plaintextSha256,
    request.credentialLocator,
  );
  if (digest(plaintext) !== request.plaintextSha256) throw Error("recovery_hash_mismatch");
  process.stdout.write(restorePayload(plaintext, request));
} catch (error) {
  const reasons = new Set([
    "recovery_hash_mismatch",
    "recovery_manifest_mismatch",
    "unsafe_recovery_path",
    "unapproved_link",
    "recovery_bytes_mismatch",
    "unsupported_file_type",
    "source_alternates_forbidden",
    "recovery_history_mismatch",
    "independent_recovery_failed",
  ]);
  console.error(reasons.has(error.message) ? error.message : "independent_recovery_failed");
  process.exitCode = 1;
} finally {
  plaintext?.fill(0);
}
