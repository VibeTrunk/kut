import { afterEach, describe, expect, it, vi } from "vitest";
import { enabledProfile, MEMBERSHIP_READ_FAILED } from "@/lib/auth/profile-read";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("profile read in the signed-in guards (KB-040)", () => {
  it("returns an enabled member's profile", () => {
    const profile = { display_name: "Member", is_disabled: false };
    expect(enabledProfile({ data: profile, error: null }, "nav")).toBe(profile);
  });

  it("treats a missing profile as not a member", () => {
    expect(enabledProfile({ data: null, error: null }, "nav")).toBeNull();
  });

  it("treats a disabled profile as not a member", () => {
    expect(
      enabledProfile({ data: { display_name: "Member", is_disabled: true }, error: null }, "nav"),
    ).toBeNull();
  });

  it("fails loudly on a read error instead of looking signed out, logging only the code", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { code: "PGRST303", message: "JWT issued at future", details: null, hint: null };

    expect(() => enabledProfile({ data: null, error }, "nav")).toThrow(MEMBERSHIP_READ_FAILED);
    expect(log).toHaveBeenCalledWith("profile read failed", { guard: "nav", code: "PGRST303" });
  });
});
