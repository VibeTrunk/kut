// Independent fixture recovery process. All data is artificial and non-secret.
// Restore bytes to a fresh folder, compare each restored hash plus exact history
// and index bytes, then return the bound state digest. A receipt alone is ignored.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const hash = (data) => createHash("sha256").update(data).digest("hex");
const request = JSON.parse(fs.readFileSync(0, "utf8"));
const archive = JSON.parse(fs.readFileSync(request.archive, "utf8"));
const restored = fs.mkdtempSync(path.join(os.tmpdir(), "kut-cleanup-recovery-"));
try {
  const bundle = path.join(restored, "history.bundle");
  fs.writeFileSync(bundle, Buffer.from(archive.bundle, "base64"));
  const recoveredRepo = path.join(restored, "recovered");
  const clone = spawnSync("git", ["clone", "--bare", "--quiet", bundle, recoveredRepo], {
    windowsHide: true,
    timeout: 10000,
  });
  if (clone.status !== 0) throw Error("history_restore_failed");
  const history = spawnSync("git", ["cat-file", "-e", request.head + "^{commit}"], {
    cwd: recoveredRepo,
    windowsHide: true,
    timeout: 10000,
  });
  if (history.status !== 0) throw Error("head_not_recovered");
  for (const [index, record] of archive.bytes.entries()) {
    const file = path.join(restored, String(index));
    fs.writeFileSync(file, Buffer.from(record.content, "base64"));
    if (hash(fs.readFileSync(file)) !== record.sha256) throw Error("recovery_hash_mismatch");
  }
  // Compare the archive's independently recovered evidence to the planned scope.
  if (
    archive.stateDigest !== request.stateDigest ||
    JSON.stringify(archive.files) !== JSON.stringify(request.files) ||
    JSON.stringify(archive.adminFiles) !== JSON.stringify(request.adminFiles) ||
    archive.head !== request.head
  )
    throw Error("recovery_scope_mismatch");
  for (const entry of [...archive.files, ...archive.adminFiles].filter((e) => e.type === "file")) {
    if (!archive.bytes.some((b) => b.sha256 === entry.sha256)) throw Error("recovery_file_missing");
  }
  console.log(archive.stateDigest);
} finally {
  function removeFreshFixture(folder) {
    for (const name of fs.readdirSync(folder)) {
      const full = path.join(folder, name),
        stat = fs.lstatSync(full);
      if (stat.isDirectory() && !stat.isSymbolicLink()) removeFreshFixture(full);
      else fs.unlinkSync(full);
    }
    fs.rmdirSync(folder);
  }
  removeFreshFixture(restored);
}
