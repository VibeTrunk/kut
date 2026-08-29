import { describe, expect, it } from "vitest";
import {
  USERNAME_EMAIL_DOMAIN,
  isValidUsername,
  loginIdentifierToEmail,
  normalizeUsername,
  usernameToEmail,
} from "@/lib/auth/username";

describe("username helpers", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeUsername("  BasVDberg ")).toBe("basvdberg");
  });

  it("accepts 3–30 chars of letters, numbers, underscore and rejects the rest", () => {
    expect(isValidUsername("bas")).toBe(true);
    expect(isValidUsername("Bas_99")).toBe(true);
    expect(isValidUsername("a".repeat(30))).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("a".repeat(31))).toBe(false);
    expect(isValidUsername("has space")).toBe(false);
    expect(isValidUsername("has-dash")).toBe(false);
    expect(isValidUsername("bas@x")).toBe(false);
  });

  it("maps a username to a synthetic address", () => {
    expect(usernameToEmail("Bas")).toBe(`bas@${USERNAME_EMAIL_DOMAIN}`);
  });

  it("passes an email through unchanged but synthesizes for a bare username", () => {
    expect(loginIdentifierToEmail("someone@real.example")).toBe("someone@real.example");
    expect(loginIdentifierToEmail("  Bas ")).toBe(`bas@${USERNAME_EMAIL_DOMAIN}`);
  });
});
