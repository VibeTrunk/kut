// A docs-only shortcut is a pull-request convenience only. Every main push
// runs full CI (ADR-126), so each deployed SHA has a complete run on record.
export function isDocsOnlyChange({ event, changed }) {
  if (event !== "pull_request") return false;
  return (
    changed.length > 0 && changed.every((file) => file.endsWith(".md") || file.startsWith("docs/"))
  );
}
