import { describe, expect, it } from "vitest";
import { sessionUsesMemberReports } from "@/game/session-reporting";
import { isAdminRole } from "@/lib/auth/roles";

describe("feature navigation and reporting cutover", () => {
  it("keeps both admin roles eligible for the visible Admin destination", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("superadmin")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
  });

  it("opens member reports on the stored cutover boundary, never before it", () => {
    expect(sessionUsesMemberReports("2026-09-27", "2026-09-28")).toBe(false);
    expect(sessionUsesMemberReports("2026-09-28", "2026-09-28")).toBe(true);
    expect(sessionUsesMemberReports("2026-10-02", "2026-09-28")).toBe(true);
  });
});
