import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { noLinks } from "./paths.mjs";

const stores = new WeakMap();
const phases = new Set(["links", "git", "git-running", "leftovers", "refused", "complete"]);

// This stores progress, never consent. The calling fixture session separately
// holds its simulated owner decision. Keys are ephemeral and never written out;
// process restart cannot turn saved checkpoints into execution authority.
export function newCheckpointStore(directory) {
  noLinks(directory, { missing: true });
  fs.mkdirSync(directory);
  const store = Object.freeze({});
  stores.set(store, { directory, key: randomBytes(32), records: [] });
  return store;
}

function runtimeFor(store) {
  const runtime = stores.get(store);
  if (!runtime) throw Error("checkpoint_session_required");
  noLinks(runtime.directory);
  return runtime;
}

const signature = (runtime, record) =>
  createHmac("sha256", runtime.key).update(JSON.stringify(record)).digest("hex");

export function readCheckpoints(store, target = undefined) {
  const runtime = runtimeFor(store);
  const names = fs.readdirSync(runtime.directory).sort();
  const expectedNames = runtime.records.map((_, index) => `${String(index).padStart(8, "0")}.json`);
  if (names.some((name) => !expectedNames.includes(name))) throw Error("checkpoint_record_added");
  const latest = new Map();
  for (let index = 0; index < runtime.records.length; index++) {
    // The original in-memory mapping identifies the affected item even when a
    // saved record's path is tampered with. Other approved items can continue.
    if (target && runtime.records[index].path !== target) continue;
    if (!names.includes(expectedNames[index])) throw Error("checkpoint_record_missing");
    const file = noLinks(path.join(runtime.directory, expectedNames[index]));
    let saved;
    try {
      saved = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      throw Error("checkpoint_record_unreadable");
    }
    if (!saved || typeof saved.record !== "object" || !saved.record)
      throw Error("checkpoint_record_unreadable");
    const { record, seal } = saved;
    const expected = signature(runtime, record);
    if (
      typeof seal !== "string" ||
      seal.length !== expected.length ||
      !timingSafeEqual(Buffer.from(seal), Buffer.from(expected)) ||
      seal !== runtime.records[index].seal ||
      !phases.has(record.phase)
    )
      throw Error("checkpoint_record_changed");
    latest.set(record.path, { phase: record.phase, digest: record.digest });
  }
  return latest;
}

export function saveCheckpoint(store, target, journal) {
  const runtime = runtimeFor(store);
  readCheckpoints(store, target);
  if (!phases.has(journal.phase) || !/^[a-f0-9]{64}$/.test(journal.digest))
    throw Error("invalid_checkpoint");
  const record = { path: target, phase: journal.phase, digest: journal.digest };
  const seal = signature(runtime, record);
  fs.writeFileSync(
    path.join(runtime.directory, `${String(runtime.records.length).padStart(8, "0")}.json`),
    JSON.stringify({ record, seal }) + "\n",
    { flag: "wx" },
  );
  runtime.records.push({ seal, path: target });
}
