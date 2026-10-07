import path from "node:path";
import { fileDigest, inspectTarget, repository } from "./inspect.mjs";
import { approvalView, validatePlan } from "./plan.mjs";
import { noLinks, same } from "./paths.mjs";

// Read-only revalidation. This deliberately returns no executable capability,
// owner approval or recovery certification, even when every hash still matches.
/**
 * @returns {{mode: "read-only", grantsApproval: false, items: {path: string, status: "unchanged" | "blocked", message: string, next?: string, reason?: string}[]}}
 */
export function reviewPlan(plan, selected = plan.items.map((item) => item.path)) {
  validatePlan(plan);
  approvalView(plan, selected);
  const repo = repository(plan.repository.root);
  if (!same(repo.common, plan.repository.common)) throw Error("repository_boundary_changed");
  const items = plan.items
    .filter((item) => selected.includes(item.path))
    .map((item) => {
      try {
        if (!item.recovery) throw Error("preservation_missing");
        for (const record of [item.recovery.archive, item.recovery.recoveryReceipt]) {
          noLinks(record.path);
          if (fileDigest(record.path) !== record.sha256) throw Error("recovery_evidence_changed");
        }
        const current = inspectTarget(repo, item.path, {
          archive: item.recovery.archive.path,
          recoveryReceipt: item.recovery.recoveryReceipt.path,
          limitations: item.recovery.limitations,
        });
        if (current.stateDigest !== item.stateDigest) throw Error("target_state_changed");
        if (!current.executable) throw Error("local_work_present");
        return {
          path: item.path,
          status: "unchanged",
          message: "The listed files and saved evidence still match. Nothing has been removed.",
          next: "Verify finished work and independent recovery, then obtain specific owner approval.",
        };
      } catch (error) {
        return {
          path: item.path,
          status: "blocked",
          reason: error.message,
          message: "This item needs another inspection. Nothing has been removed.",
        };
      }
    });
  return { mode: "read-only", grantsApproval: false, items };
}

export function plainReview(result) {
  return result.items
    .map(
      (item) =>
        `${path.basename(item.path)}: ${item.message} ${item.next ?? "Check: " + item.reason}`,
    )
    .join("\n");
}
