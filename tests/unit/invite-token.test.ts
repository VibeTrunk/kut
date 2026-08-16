import { describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken, isValidInviteToken } from "@/lib/invites/token";

describe("invite tokens", () => {
  it("creates a URL-safe 256-bit token and stores only its SHA-256 hash", () => {
    const { token, tokenHash } = createInviteToken();

    expect(isValidInviteToken(token)).toBe(true);
    expect(token).toHaveLength(43);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).toBe(hashInviteToken(token));
    expect(tokenHash).not.toContain(token);
  });

  it("rejects malformed token input", () => {
    expect(isValidInviteToken("")).toBe(false);
    expect(isValidInviteToken("not an invite token")).toBe(false);
    expect(isValidInviteToken("a".repeat(44))).toBe(false);
  });
});
