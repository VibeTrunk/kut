import { afterEach, describe, expect, it } from "vitest";
import { assertLocalTarget } from "../support/local-target";

const OVERRIDE_ENV = "KUT_ALLOW_NONLOCAL_TEST_TARGET";

afterEach(() => {
  delete process.env[OVERRIDE_ENV];
});

describe("assertLocalTarget", () => {
  it.each([
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgresql://postgres:postgres@127.9.9.9:5432/postgres",
    "http://localhost:54321",
    "http://LOCALHOST:54321",
    "http://[::1]:54321",
  ])("accepts the loopback target %s", (target) => {
    expect(assertLocalTarget(target, "TEST_URL")).toBe(target);
  });

  it.each([
    "postgresql://postgres:hunter2@db.fictional-project.supabase.co:5432/postgres",
    "https://fictional-project.supabase.co",
    "http://10.0.0.5:54321",
    "http://127.0.0.1.fictional.example:54321",
  ])("refuses the non-loopback target %s", (target) => {
    expect(() => assertLocalTarget(target, "TEST_URL")).toThrow(/Refusing to run destructive/);
  });

  it("never echoes the credential from a refused connection string", () => {
    const target = "postgresql://postgres:hunter2@db.fictional.supabase.co:5432/postgres";
    expect(() => assertLocalTarget(target, "DB_URL")).toThrow(/db\.fictional\.supabase\.co/);
    try {
      assertLocalTarget(target, "DB_URL");
      expect.unreachable("expected a refusal");
    } catch (error) {
      expect((error as Error).message).not.toContain("hunter2");
      expect((error as Error).message).not.toContain(target);
    }
  });

  it("allows a non-loopback target only for the exact acknowledgement phrase", () => {
    const target = "postgresql://postgres:postgres@db.fictional.example:5432/postgres";
    process.env[OVERRIDE_ENV] = "true";
    expect(() => assertLocalTarget(target, "DB_URL")).toThrow();
    process.env[OVERRIDE_ENV] = "yes-i-am-writing-to-that-database";
    expect(assertLocalTarget(target, "DB_URL")).toBe(target);
  });

  it("refuses a value that is not a URL at all", () => {
    expect(() => assertLocalTarget("not a url", "DB_URL")).toThrow(/not a parsable URL/);
  });
});
