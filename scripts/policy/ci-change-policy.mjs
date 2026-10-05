// A docs-only shortcut is a pull-request convenience only. A main push names
// the exact SHA an owner merge authorizes for release (ADR-124), and the gate
// refuses skipped jobs, so every main SHA must earn complete evidence (ADR-126).
export function isDocsOnlyChange({ event, changed }) {
  if (event !== "pull_request") return false;
  return (
    changed.length > 0 && changed.every((file) => file.endsWith(".md") || file.startsWith("docs/"))
  );
}
