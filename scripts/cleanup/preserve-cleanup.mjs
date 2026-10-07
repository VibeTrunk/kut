#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { preserveTarget } from "./recovery.mjs";
import { noLinks, within } from "./paths.mjs";
import { inspectTarget, repository } from "./inspect.mjs";

try {
  const args = process.argv.slice(2),
    values = new Map();
  if (!args.length) {
    console.log(
      "Read-only by default. To preserve a named extra, supply --target ABSOLUTE --archive NEW-ABSOLUTE --receipt NEW-ABSOLUTE. This creates saved recovery evidence, never cleanup approval.",
    );
  } else {
    for (let i = 0; i < args.length; i += 2) {
      if (
        !["--target", "--archive", "--receipt"].includes(args[i]) ||
        !args[i + 1] ||
        values.has(args[i])
      )
        throw Error("invalid_arguments");
      values.set(args[i], args[i + 1]);
    }
    if (values.size !== 3) throw Error("invalid_arguments");
    const target = noLinks(values.get("--target")),
      receipt = noLinks(values.get("--receipt"), { missing: true });
    const repo = repository(process.cwd()),
      item = inspectTarget(repo, target);
    if (
      within(target, receipt) ||
      within(item.admin, receipt) ||
      within(path.join(repo.root, "node_modules"), receipt) ||
      within(repo.common, receipt) ||
      repo.registrations.some((r) => r.path !== repo.root && within(r.path, receipt)) ||
      fs.existsSync(receipt)
    )
      throw Error("unsafe_receipt_output");
    const result = await preserveTarget(process.cwd(), target, values.get("--archive"));
    fs.writeFileSync(receipt, JSON.stringify({ version: 1, ...result }) + "\n", { flag: "wx" });
    console.log(
      "The named copy's history and local files passed independent encrypted recovery. Nothing was removed; review recovery limits before approval.",
    );
  }
} catch {
  console.error(
    "Preservation stopped. No cleanup authority was granted; inspect any new pending candidate privately.",
  );
  process.exitCode = 1;
}
