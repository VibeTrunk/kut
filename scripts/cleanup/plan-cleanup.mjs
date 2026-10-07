#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { inspect } from "./inspect.mjs";
import { approvalView, createPlan, writePlan } from "./plan.mjs";

// Default is read-only. Saving a plan is opt-in and refuses overwrite.
try {
  const args = process.argv.slice(2);
  if (!args.length) console.log(JSON.stringify(inspect(process.cwd()), null, 2));
  else if (
    args[0] === "--request" &&
    (args.length === 2 || (args.length === 4 && args[2] === "--output"))
  ) {
    const saved = fs.readFileSync(path.resolve(args[1]), "utf8");
    let request;
    try {
      request = JSON.parse(saved);
    } catch {
      throw Error("The request could not be read as JSON.");
    }
    const plan = createPlan(process.cwd(), request.items);
    console.log(approvalView(plan));
    if (args.length === 4) writePlan(plan, path.resolve(args[3]));
  } else throw Error("usage: plan-cleanup.mjs [--request request.json [--output new-plan.json]]");
} catch (error) {
  console.error(`Cleanup inspection stopped: ${error.message}`);
  process.exitCode = 1;
}
