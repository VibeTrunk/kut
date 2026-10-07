import fs from "node:fs";
import { inspect, objectDigest } from "./inspect.mjs";
import { noLinks, within } from "./paths.mjs";

export function itemContract(item) {
  const links = item.files.filter((entry) => entry.type === "link");
  const types = ["project-copy", ...(links.length ? ["dependency-link"] : []), "git-records"];
  const preservationKey = objectDigest(item.recovery);
  const explanations = types.map((type) => ({
    type,
    items: [item.path],
    preservationKey,
    what:
      type === "project-copy"
        ? `Remove the old project copy at ${item.path}, including all files listed in the appendix.`
        : type === "dependency-link"
          ? `Remove only the node_modules shortcut inside ${item.path}.`
          : `Remove only the old Git records at ${item.admin}.`,
    why: item.executable
      ? "Git found no local edits or new files. Finished work and independent recovery still need verification before approval."
      : "This item is blocked: unfinished work or independent preservation evidence is missing.",
    saved:
      type === "dependency-link"
        ? "The shared files used by the ordinary project stay in place."
        : "Saved branches, stashes, evidence and archives stay in place; the recovery check must cover the listed files and history.",
    downside:
      (type === "dependency-link"
        ? "Reusing this old copy would require recreating its shortcut. "
        : type === "git-records"
          ? "Git will no longer list this old copy; recreating it may take time. "
          : "Recreating this copy may take time. ") +
      (item.recovery?.limitations ?? "Recovery has not been established."),
  }));
  const operation = {
    git: ["git", "worktree", "remove", "--", item.path],
    unlink: links.map((link) => ({
      path: item.path + "/" + link.path,
      target: link.target,
      resolved: link.resolved,
    })),
    leftovers: {
      working: item.path,
      administration: item.admin,
      entries: "only unchanged entries in the sealed manifests; empty folders last",
    },
  };
  const value = { ...item, operation, explanations };
  return { ...value, approvalDigest: objectDigest(value) };
}

export function createPlan(root, targets) {
  const inspected = inspect(root, targets);
  if (!inspected.items?.length) throw Error("named_items_required");
  const value = {
    version: 1,
    repository: inspected.repository,
    protected: inspected.protected,
    items: inspected.items.map(itemContract),
  };
  return { ...value, planDigest: objectDigest(value) };
}

export function validatePlan(plan) {
  if (!plan || plan.version !== 1 || !Array.isArray(plan.items) || !plan.items.length)
    throw Error("invalid_plan");
  const { planDigest, ...value } = plan;
  if (objectDigest(value) !== planDigest) throw Error("plan_changed");
  for (const item of plan.items) {
    const { approvalDigest, ...value } = item;
    if (objectDigest(value) !== approvalDigest) throw Error("item_contract_changed");
    // Recompute the exact operation; extra flags/paths cannot be slipped into a sealed JSON plan.
    const state = { ...item };
    delete state.operation;
    delete state.explanations;
    delete state.approvalDigest;
    if (JSON.stringify(itemContract(state)) !== JSON.stringify(item))
      throw Error("operation_or_explanation_changed");
  }
  return plan;
}

export function writePlan(plan, output) {
  validatePlan(plan);
  noLinks(output, { missing: true });
  if (plan.items.some((i) => within(i.path, output) || within(i.admin, output)))
    throw Error("plan_inside_removal_scope");
  fs.writeFileSync(output, JSON.stringify(plan, null, 2) + "\n", { flag: "wx" });
}

export function approvalView(plan, selected = plan.items.map((i) => i.path)) {
  validatePlan(plan);
  if (
    !selected.length ||
    new Set(selected).size !== selected.length ||
    selected.some((p) => !plan.items.some((i) => i.path === p))
  )
    throw Error("invalid_selection");
  return plan.items
    .filter((item) => selected.includes(item.path))
    .map((item) =>
      [
        `${item.path} — operation ${item.approvalDigest}`,
        ...item.explanations.map(
          (e) =>
            `${e.type === "project-copy" ? "Old project copy" : e.type === "dependency-link" ? "Shortcut to shared files" : "Git records for this copy"}: ${e.what} ${e.why} ${e.saved} ${e.downside}`,
        ),
        `Exact operation: ${JSON.stringify(item.operation)}`,
        `Status: ${item.executable ? "needs independent recovery and owner consent" : "blocked"}`,
      ].join("\n"),
    )
    .join("\n\n");
}
