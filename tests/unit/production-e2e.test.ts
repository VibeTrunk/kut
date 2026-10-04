import net from "node:net";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertCandidate,
  assertLockedRuntime,
  assertPortAvailable,
  releaseEnvironment,
  RELEASE_PROJECTS,
  validateReleaseReport,
} from "../../scripts/release/production-e2e-contract.mjs";

const sha = "a".repeat(40);
const local = {
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://fictional:fictional@127.0.0.1:54322/postgres",
  ANON_KEY: "fictional-anon",
  SERVICE_ROLE_KEY: "fictional-service",
};
function evidence() {
  const spec = (title: string, line: number) => ({
    title,
    file: "mobile.spec.ts",
    line,
    column: 1,
    tests: RELEASE_PROJECTS.map((projectName: string) => ({
      projectName,
      expectedStatus: "passed",
      status: "expected",
      results: [{ status: "passed", retry: 0 }],
    })),
  });
  const report = {
    errors: [],
    config: {
      workers: 1,
      projects: RELEASE_PROJECTS.map((name: string) => ({ name, retries: 0 })),
    },
    suites: [
      { specs: [spec("sign-in and member layout", 1), spec("admin and share recovery", 2)] },
    ],
  };
  return { report, inventory: structuredClone(report) };
}

describe("production release E2E contract", () => {
  it("refuses stale installed runtimes rather than testing another Next or browser version", () => {
    const lock = {
      packages: {
        "node_modules/next": { version: "16.3.6" },
        "node_modules/playwright-core": { version: "1.63.0" },
      },
    };
    expect(() => assertLockedRuntime(lock, { next: "16.3.5" })).toThrow("npm ci");
    expect(() => assertLockedRuntime(lock, { "playwright-core": "1.62.0" })).toThrow("npm ci");
    expect(() =>
      assertLockedRuntime(lock, { next: "16.3.6", "playwright-core": "1.63.0" }),
    ).not.toThrow();
  });
  it("rejects a different HEAD, dirty checkout, and an abbreviated SHA", () => {
    expect(() => assertCandidate(".", sha, () => "b".repeat(40))).toThrow("differs from HEAD");
    expect(() =>
      assertCandidate(".", sha, (command: string) => (command === "rev-parse" ? sha : " M file")),
    ).toThrow("clean candidate");
    expect(() => assertCandidate(".", "aaaaaaa", () => sha)).toThrow("exact lowercase");
  });
  it("maps local aliases and refuses hosted targets even with the acknowledgement override", () => {
    const env = releaseEnvironment(local);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(local.SERVICE_ROLE_KEY);
    expect(env.KUT_LOCAL_DATABASE_URL).toBe(local.DB_URL);
    for (const name of ["API_URL", "DB_URL"]) {
      expect(() =>
        releaseEnvironment({
          ...local,
          [name]: "https://hosted.invalid",
          KUT_ALLOW_NONLOCAL_TEST_TARGET: "yes-i-am-writing-to-that-database",
        }),
      ).toThrow("loopback");
    }
    expect(() =>
      releaseEnvironment({ ...local, PW_TEST_CONNECT_WS_ENDPOINT: "ws://127.0.0.1:3219" }),
    ).toThrow("remote browser");
  });
  it("refuses an occupied server port without contacting or terminating its owner", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as net.AddressInfo).port;
    try {
      await expect(assertPortAvailable(port)).rejects.toThrow("occupied");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await expect(assertPortAvailable(port)).resolves.toBeUndefined();
  });
  it("accepts complete first-attempt coverage", () => {
    const { report, inventory } = evidence();
    expect(validateReleaseReport(report, inventory)["authenticated-webkit"].passed).toBe(2);
  });
  it("keeps parameterized tests at the same source line distinct", () => {
    const { report } = evidence();
    report.suites[0].specs[1].line = report.suites[0].specs[0].line;
    expect(
      validateReleaseReport(report, structuredClone(report))["authenticated-webkit"].passed,
    ).toBe(2);
  });
  it.each(["failure", "retry", "skip", "missing-project", "filtered-report", "runner-error"])(
    "fails closed on %s",
    (fault) => {
      const { report, inventory } = evidence();
      const test = report.suites[0].specs[0].tests[0];
      if (fault === "failure") test.results[0].status = "failed";
      if (fault === "retry") test.results.push({ status: "passed", retry: 1 });
      if (fault === "skip") {
        test.expectedStatus = "skipped";
        test.results[0].status = "skipped";
      }
      if (fault === "missing-project") report.config.projects.pop();
      if (fault === "filtered-report") report.suites[0].specs.pop();
      if (fault === "runner-error")
        Object.assign(report, { errors: [{ message: "teardown failed" }] });
      expect(() => validateReleaseReport(report, inventory)).toThrow();
    },
  );
  it("permits only the two existing duplicate-device pack skips, with narrow Chromium passing", () => {
    const { report } = evidence();
    const spec = report.suites[0].specs[1];
    spec.title = "a pack's summary names the slots it fills and the copies it adds (ADR-114)";
    for (const test of spec.tests.filter(
      (test: { projectName: string }) => test.projectName !== "authenticated-320",
    )) {
      test.expectedStatus = "skipped";
      test.results[0].status = "skipped";
    }
    expect(
      validateReleaseReport(report, structuredClone(report))["authenticated-webkit"].skipped,
    ).toBe(1);
    spec.tests[1].expectedStatus = "skipped";
    spec.tests[1].results[0].status = "skipped";
    expect(() => validateReleaseReport(report, structuredClone(report))).toThrow("skipped");
  });
  it("holds main without a conflicting deployment allow rule", () => {
    const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
    expect(config.git.deploymentEnabled).toEqual({ main: false });
    expect(config.headers.length).toBeGreaterThan(0);
  });
});
