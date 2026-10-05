import { describe, expect, it } from "vitest";
import { isDocsOnlyChange } from "../../scripts/policy/ci-change-policy.mjs";

const docs = ["README.md", "docs/PROGRESS.md", "docs/design/sketch.png"];

describe("CI change classification", () => {
  it("lets a pull request with only docs skip the expensive jobs", () => {
    expect(isDocsOnlyChange({ event: "pull_request", changed: docs })).toBe(true);
  });

  it("never classifies a main push as docs-only, because its SHA is a release candidate", () => {
    expect(isDocsOnlyChange({ event: "push", changed: docs })).toBe(false);
  });

  it.each(["", "workflow_dispatch", "merge_group"])(
    "fails closed for an unknown or missing event %j",
    (event) => {
      expect(isDocsOnlyChange({ event, changed: docs })).toBe(false);
    },
  );

  it("requires full evidence when a pull request touches anything executable", () => {
    expect(
      isDocsOnlyChange({ event: "pull_request", changed: [...docs, "supabase/config.toml"] }),
    ).toBe(false);
  });

  it("requires full evidence for an empty diff", () => {
    expect(isDocsOnlyChange({ event: "pull_request", changed: [] })).toBe(false);
  });
});
