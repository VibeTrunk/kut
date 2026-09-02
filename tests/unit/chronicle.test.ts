import { describe, expect, it } from "vitest";
import { isMonday, issueStandfirst, weekStart } from "@/lib/chronicle";

describe("Chronicle helpers", () => {
  it("uses Monday keys and labels weekly totals", () => {
    expect(isMonday("2026-08-31")).toBe(true); expect(isMonday("2026-09-01")).toBe(false);
    expect(weekStart("2026-09-06")).toBe("2026-08-31"); expect(issueStandfirst(2, 25, 40)).toBe("2 sessions, 25 appearances and 40 goals.");
  });
});
