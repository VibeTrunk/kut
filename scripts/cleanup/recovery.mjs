import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { gzipSync, gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import {
  digest,
  fileDigest,
  inspectTarget,
  objectDigest,
  repository,
  protectedState,
} from "./inspect.mjs";
import { canonical, exists, noLinks, within } from "./paths.mjs";

const worker = fileURLToPath(new URL("./recovery-worker.mjs", import.meta.url));
const cipherWorker = fileURLToPath(new URL("./cipher-worker.ps1", import.meta.url));

function run(command, args, options = {}) {
  const env = { ...process.env };
  if (command === "git") {
    for (const name of Object.keys(env))
      if (
        /^GIT_(DIR|WORK_TREE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG|INDEX_FILE)/.test(
          name,
        )
      )
        delete env[name];
    env.GIT_CONFIG_NOSYSTEM = "1";
    env.GIT_CONFIG_GLOBAL = process.platform === "win32" ? "NUL" : os.devNull;
    env.GIT_TERMINAL_PROMPT = "0";
  }
  const result = spawnSync(command, args, {
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 512 * 1024 * 1024,
    env,
    ...options,
  });
  if (result.status !== 0 || result.error) {
    const reasons = new Set([
      "recovery_hash_mismatch",
      "recovery_manifest_mismatch",
      "unsafe_recovery_path",
      "unapproved_link",
      "recovery_bytes_mismatch",
      "unsupported_file_type",
      "source_alternates_forbidden",
      "recovery_history_mismatch",
    ]);
    const reason = result.stderr?.toString().trim();
    throw Error(reasons.has(reason) ? reason : "independent_recovery_failed");
  }
  return result.stdout;
}

function objectNames(root) {
  return run("git", ["cat-file", "--batch-all-objects", "--batch-check=%(objectname)"], {
    cwd: root,
  })
    .toString()
    .trim()
    .split(/\r?\n/)
    .sort();
}

// Ciphertext/plaintext stay on private pipes. Passwords never enter argv/logs.
export function storedCipher(mode, input, expectedHash, locator) {
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(locator) || !/^[a-f0-9]{64}$/.test(expectedHash))
    throw Error("invalid_recovery_locator");
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-File",
    cipherWorker,
    "-Mode",
    mode,
    mode === "Encrypt" ? "-OutputPath" : "-InputPath",
    noLinks(input.path, { missing: mode === "Encrypt" }),
    "-ExpectedHash",
    expectedHash,
    "-CredentialLocator",
    locator,
  ];
  return run("powershell.exe", args, { input: input.bytes });
}

// Preparation supports a real registered extra. It writes only a new archive,
// then a separate cold recovery record. It never supplies cleanup consent.
export async function preserveTarget(
  root,
  target,
  output,
  {
    credentialLocator = "backup-encryption-v1",
    encrypt = storedCipher,
    verify = verifyRecoveryArchive,
  } = {},
) {
  const repo = repository(root),
    item = inspectTarget(repo, target);
  const protectedBefore = objectDigest(protectedState(repo));
  output = noLinks(output, { missing: true });
  if (
    exists(output) ||
    within(target, output) ||
    within(item.admin, output) ||
    within(path.join(root, "node_modules"), output) ||
    within(repo.common, output) ||
    repo.registrations.some((r) => r.path !== repo.root && within(r.path, output))
  )
    throw Error("unsafe_archive_output");
  const history = run("git", ["bundle", "create", "-", "--all", "HEAD"], { cwd: target });
  // A bundle of named tips alone misses unpublished reflog/index/dangling
  // objects. Snapshot every available object without changing source refs.
  const objects = objectNames(target);
  const objectPack = run("git", ["pack-objects", "--stdout"], {
    cwd: target,
    input: objects.join("\n") + "\n",
  });
  const entries = [
    ...item.files.map((e) => ({ ...e, group: "working" })),
    ...item.adminFiles.map((e) => ({ ...e, group: "admin" })),
  ].map((e) =>
    e.type === "file"
      ? {
          ...e,
          data: fs
            .readFileSync(path.join(e.group === "working" ? target : item.admin, e.path))
            .toString("base64"),
        }
      : e,
  );
  const payload = gzipSync(
    Buffer.from(
      JSON.stringify({
        version: 1,
        stateDigest: item.stateDigest,
        head: item.head,
        files: item.files,
        adminFiles: item.adminFiles,
        history: history.toString("base64"),
        objects,
        objectPack: objectPack.toString("base64"),
        entries,
      }),
    ),
  );
  const plaintextSha256 = digest(payload);
  const pending = output + ".pending";
  noLinks(pending, { missing: true });
  if (exists(pending)) throw Error("archive_candidate_exists");
  // Only this new candidate can be removed on failure. Existing archives are
  // never overwritten or removed; a replaced candidate is left untouched.
  encrypt("Encrypt", { path: pending, bytes: payload }, plaintextSha256, credentialLocator);
  const candidate = fs.lstatSync(pending);
  const removeCandidate = () => {
    noLinks(pending, { missing: true });
    if (!exists(pending)) return;
    const current = fs.lstatSync(pending);
    if (current.dev !== candidate.dev || current.ino !== candidate.ino)
      throw Error("archive_candidate_changed");
    fs.unlinkSync(pending);
  };
  try {
    const request = {
      archive: pending,
      ciphertextSha256: fileDigest(pending),
      plaintextSha256,
      credentialLocator,
      stateDigest: item.stateDigest,
      files: item.files,
      adminFiles: item.adminFiles,
      head: item.head,
      objects,
    };
    if ((await verify(request)) !== item.stateDigest) throw Error("independent_recovery_failed");
    if (inspectTarget(repository(root), target).stateDigest !== item.stateDigest)
      throw Error("source_changed_during_preservation");
    if (
      objectDigest(protectedState(repository(root))) !== protectedBefore ||
      objectDigest(objectNames(target)) !== objectDigest(objects)
    )
      throw Error("source_changed_during_preservation");
    fs.linkSync(pending, output); // exclusive finalization; never overwrite
    removeCandidate();
    return {
      archive: output,
      plaintextSha256,
      credentialLocator,
      stateDigest: item.stateDigest,
      ciphertextSha256: fileDigest(output),
      objects,
    };
  } catch (error) {
    removeCandidate();
    throw error;
  } finally {
    payload.fill(0);
  }
}

export function verifyRecoveryArchive(request) {
  noLinks(request.archive);
  if (fileDigest(request.archive) !== request.ciphertextSha256)
    throw Error("recovery_evidence_changed");
  const result = run(process.execPath, [worker], { input: JSON.stringify(request) });
  if (result.toString().trim() !== request.stateDigest) throw Error("independent_recovery_failed");
  return request.stateDigest;
}

export function verifyPreservedItem(item) {
  // Receipt metadata locates the expected plaintext and credential. It never
  // substitutes for a new decrypt+restore in a separate process.
  const receiptPath = noLinks(item.recovery.recoveryReceipt.path);
  if (fileDigest(receiptPath) !== item.recovery.recoveryReceipt.sha256)
    throw Error("recovery_evidence_changed");
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  } catch {
    throw Error("recovery_receipt_invalid");
  }
  if (receipt?.version !== 1 || receipt.stateDigest !== item.stateDigest)
    throw Error("recovery_receipt_invalid");
  return verifyRecoveryArchive({
    archive: item.recovery.archive.path,
    ciphertextSha256: item.recovery.archive.sha256,
    plaintextSha256: receipt.plaintextSha256,
    credentialLocator: receipt.credentialLocator,
    stateDigest: item.stateDigest,
    files: item.files,
    adminFiles: item.adminFiles,
    head: item.head,
    objects: receipt.objects,
  });
}

// Called only in an independent child. Restores exact local/private bytes and
// the bundled history to a newly minted temporary directory, never source Git.
export function restorePayload(payload, expected) {
  const data = JSON.parse(gunzipSync(payload).toString("utf8"));
  if (
    data.version !== 1 ||
    data.stateDigest !== expected.stateDigest ||
    data.head !== expected.head ||
    objectDigest(data.files) !== objectDigest(expected.files) ||
    objectDigest(data.adminFiles) !== objectDigest(expected.adminFiles) ||
    !Array.isArray(expected.objects) ||
    objectDigest(data.objects) !== objectDigest(expected.objects)
  )
    throw Error("recovery_manifest_mismatch");
  const original = [
    ...expected.files.map((e) => ({ ...e, group: "working" })),
    ...expected.adminFiles.map((e) => ({ ...e, group: "admin" })),
  ];
  if (data.entries.length !== original.length) throw Error("recovery_manifest_mismatch");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "kut-cleanup-recovery-"));
  let complete = false;
  try {
    for (let i = 0; i < original.length; i++) {
      const { data: bytes, ...metadata } = data.entries[i];
      if (objectDigest(metadata) !== objectDigest(original[i]))
        throw Error("recovery_manifest_mismatch");
      const entry = original[i];
      // Portable path check: reject absolute, traversal, ADS and redirect links.
      if (
        !entry.path ||
        /[\\]/.test(entry.path.replaceAll(path.sep, "/")) ||
        entry.path.split(/[\\/]/).some((p) => p === ".." || p === ".") ||
        /^[\\/]|:/.test(entry.path)
      )
        throw Error("unsafe_recovery_path");
      const destination = canonical(path.join(scratch, entry.group, entry.path));
      if (!within(path.join(scratch, entry.group), destination))
        throw Error("unsafe_recovery_path");
      if (entry.type === "link") {
        if (entry.group !== "working" || entry.path !== "node_modules")
          throw Error("unapproved_link");
        continue; // metadata only; shared dependencies are never activated
      }
      if (entry.type === "directory") fs.mkdirSync(destination, { recursive: true });
      else if (entry.type === "file") {
        const restored = Buffer.from(bytes, "base64");
        if (restored.length !== entry.size || digest(restored) !== entry.sha256)
          throw Error("recovery_bytes_mismatch");
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, restored, { flag: "wx" });
        if (fileDigest(destination) !== entry.sha256) throw Error("recovery_bytes_mismatch");
      } else throw Error("unsupported_file_type");
    }
    const bundle = path.join(scratch, "history.bundle"),
      gitRoot = path.join(scratch, "history.git");
    fs.writeFileSync(bundle, Buffer.from(data.history, "base64"), { flag: "wx" });
    run("git", ["init", "--bare", gitRoot]);
    run("git", ["index-pack", "--stdin"], {
      cwd: gitRoot,
      input: Buffer.from(data.objectPack, "base64"),
    });
    run("git", ["bundle", "verify", bundle], { cwd: gitRoot });
    run(
      "git",
      [
        "fetch",
        "--no-tags",
        "--no-write-fetch-head",
        bundle,
        "+refs/*:refs/*",
        "HEAD:refs/heads/recovered-target",
      ],
      { cwd: gitRoot },
    );
    if (exists(path.join(gitRoot, "objects", "info", "alternates")))
      throw Error("source_alternates_forbidden");
    run("git", ["fsck", "--full", "--strict"], { cwd: gitRoot });
    if (objectDigest(objectNames(gitRoot)) !== objectDigest(expected.objects))
      throw Error("recovery_history_mismatch");
    if (
      run("git", ["rev-parse", "refs/heads/recovered-target"], { cwd: gitRoot })
        .toString()
        .trim() !== expected.head
    )
      throw Error("recovery_history_mismatch");
    complete = true;
  } finally {
    // Only the fresh scratch root is walked. No recursive rm or source targets.
    const walk = (folder) => {
      noLinks(folder);
      for (const name of fs.readdirSync(folder)) {
        const full = path.join(folder, name),
          stat = fs.lstatSync(full);
        if (stat.isDirectory() && !stat.isSymbolicLink()) walk(full);
        else fs.unlinkSync(full);
      }
      fs.rmdirSync(folder);
    };
    walk(scratch);
  }
  if (!complete) throw Error("independent_recovery_failed");
  return expected.stateDigest;
}
