import { describe, expect, it } from "vitest";
import { isMonday, issueStandfirst, weekStart } from "@/lib/chronicle";

describe("Chronicle helpers", () => {
  it("uses Monday keys and labels weekly totals", () => {
    expect(isMonday("2026-08-31")).toBe(true);
    expect(isMonday("2026-09-01")).toBe(false);
    expect(weekStart("2026-09-06")).toBe("2026-08-31");
    expect(issueStandfirst(2, 25, 40, "2026-08-31")).toBe(
      "2 sessions, 25 appearances and 40 goals.",
    );
  });

  // ADR-101: the week's count is G+A from the football week of 28 Sep 2026.
  it("names the week's count in the terms of its own week", () => {
    expect(issueStandfirst(1, 12, 9, "2026-09-21")).toBe(
      "One session, 12 appearances and 9 goals.",
    );
    expect(issueStandfirst(1, 12, 9, "2026-09-28")).toBe("One session, 12 appearances and 9 G+A.");
  });
});
