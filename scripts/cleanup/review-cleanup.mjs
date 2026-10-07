#!/usr/bin/env node
import fs from "node:fs";
import { noLinks } from "./paths.mjs";
import { plainReview, reviewPlan } from "./review.mjs";

try {
  const args = process.argv.slice(2);
  const selected = [];
  let planPath;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--plan" && !planPath) planPath = args[++index];
    else if (args[index] === "--item") selected.push(args[++index]);
    else
      throw Error("Only --plan and optional exact --item paths are supported; this checks only.");
  }
  if (!planPath || selected.some((item) => !item)) throw Error("A saved plan path is required.");
  let plan;
  const saved = fs.readFileSync(noLinks(planPath), "utf8");
  try {
    plan = JSON.parse(saved);
  } catch {
    throw Error("The saved plan could not be read as JSON.");
  }
  console.log(plainReview(reviewPlan(plan, selected.length ? selected : undefined)));
  console.log(
    "Read-only check complete. This result supplies no recovery proof or removal approval.",
  );
} catch (error) {
  console.error("Nothing removed. " + error.message);
  process.exitCode = 1;
}
