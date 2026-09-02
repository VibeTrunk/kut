import { describe, expect, it } from "vitest";
import { weekEnd, weekStart } from "@/game/football-week";

describe("football week", () => {
  it("uses ISO Mondays independently of the local timezone", () => {
    expect(weekStart("2026-01-01")).toBe("2025-12-29");
    expect(weekStart("2024-02-29")).toBe("2024-02-26");
    expect(weekStart("2026-08-30")).toBe("2026-08-24");
    expect(weekStart("2026-08-31")).toBe("2026-08-31");
    expect(weekEnd("2026-08-31")).toBe("2026-09-06");
  });
});
