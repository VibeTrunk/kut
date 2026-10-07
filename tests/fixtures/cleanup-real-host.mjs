// SIMULATED host, exclusively for freshly minted disposable fixtures.
// Never an installed-agent owner-consent source. No real repository accepted.
import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { createHostRuntime } from "../../scripts/cleanup/runtime-adapters.mjs";
import { objectDigest } from "../../scripts/cleanup/inspect.mjs";

export function fixtureHost(
  fixture,
  {
    agent = "codex",
    decision = "approve",
    source = "owner-ui",
    coverage = true,
    permission = true,
  } = {},
) {
  if (
    !/^kut-cleanup-fixture-/.test(path.basename(fixture.base)) ||
    fixture.root !== path.join(fixture.base, "ordinary") ||
    fixture.targets.some(
      (t) => !["one", "two"].includes(path.basename(t)) || path.dirname(t) !== fixture.base,
    )
  )
    throw Error("fixture_only_host");
  const directory = path.join(fixture.base, "host");
  if (!fs.existsSync(directory)) fs.mkdirSync(directory);
  const keyPath = path.join(directory, "key");
  if (!fs.existsSync(keyPath))
    fs.writeFileSync(keyPath, "artificial-host-progress-key", { flag: "wx" });
  const seal = (record) =>
    createHmac("sha256", fs.readFileSync(keyPath)).update(JSON.stringify(record)).digest("hex");
  const fileFor = (c) => path.join(directory, objectDigest(c) + ".json");
  const requests = [],
    scopes = [];
  const services = {
    async assertCoverage() {
      if (!coverage) throw Error("live_tool_coverage_missing");
    },
    async ownerDecision(request) {
      requests.push(request);
      return { source, id: "simulated-event", contract: request.contract, decision };
    },
    async load(contract) {
      const file = fileFor(contract),
        index = file + ".expected";
      if (!fs.existsSync(file)) {
        if (fs.existsSync(index)) throw Error("checkpoint_missing");
        return null;
      }
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        !fs.existsSync(index) ||
        seal(saved.record) !== saved.seal ||
        fs.readFileSync(index, "utf8") !== saved.seal
      )
        throw Error("checkpoint_changed");
      return saved.record;
    },
    async save(contract, previous, record) {
      const existing = await services.load(contract);
      if (objectDigest(existing) !== objectDigest(previous)) throw Error("checkpoint_conflict");
      fs.writeFileSync(fileFor(contract), JSON.stringify({ record, seal: seal(record) }));
      fs.writeFileSync(fileFor(contract) + ".expected", seal(record));
    },
    async withScope(scope, body) {
      if (!permission) throw Error("filesystem_scope_unavailable");
      if (
        scope.write.length !== 2 ||
        !fixture.targets.includes(scope.write[0]) ||
        path.dirname(scope.write[1]) !== path.join(fixture.root, ".git", "worktrees") ||
        scope.network !== false
      )
        throw Error("unsafe_scope");
      scopes.push(scope);
      return body(); // test scope validation, NOT an OS sandbox proof
    },
    async exclusive(_common, body) {
      return body();
    },
  };
  return { runtime: createHostRuntime(agent, services), requests, scopes, services, fileFor };
}
