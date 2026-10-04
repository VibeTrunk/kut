import type { Client } from "pg";
import { expect, it } from "vitest";
import { assertFixtureDatabase } from "../e2e-authenticated/fixture-ownership";

it("never permits installing the ownership journal outside loopback", () => {
  const connection = (host: string) => ({ connectionParameters: { host } }) as unknown as Client;
  for (const host of ["localhost", "127.0.0.1", "::1"]) {
    expect(() => assertFixtureDatabase(connection(host))).not.toThrow();
  }
  expect(() => assertFixtureDatabase(connection("db.hosted.invalid"))).toThrow("loopback");
});
