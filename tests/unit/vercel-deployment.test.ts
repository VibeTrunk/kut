import { describe, expect, it } from "vitest";
import { inspectVercelDeployment } from "../../scripts/release/vercel-deployment-contract.mjs";

const candidate = "a".repeat(40);
const previous = "b".repeat(40);
const probePath = "/release-probe/legacy-host?check=1";
function fixture() {
  const project = { id: "prj_test", name: "kut" };
  const alias = { alias: "flut.vibetrunk.com", projectId: project.id, deploymentId: "dpl_live" };
  const legacy: Record<string, unknown> = {
    alias: "kut.vibetrunk.com",
    projectId: project.id,
    deploymentId: "dpl_live",
  };
  const redirect = {
    status: 307 as number | undefined,
    location: `https://flut.vibetrunk.com${probePath}` as string | null,
    fails: false,
  };
  const probes: string[] = [];
  const live = {
    id: "dpl_live",
    projectId: project.id,
    target: "production",
    readyState: "READY",
    meta: { githubCommitSha: previous },
  };
  const page = {
    deployments: [
      {
        uid: "dpl_preview",
        target: "preview",
        readyState: "READY",
        meta: { githubCommitSha: candidate },
      },
    ],
    pagination: { next: null as number | null },
  };
  // Each check reads both bindings once, then both again to confirm.
  let aliases = 0;
  let moved: "flut.vibetrunk.com" | "kut.vibetrunk.com" | null = null;
  const get = async (endpoint: string) => {
    if (endpoint === "/v9/projects/kut") return project;
    if (endpoint.startsWith("/v4/aliases/")) {
      aliases++;
      const domain = endpoint.slice("/v4/aliases/".length);
      const bound =
        domain === "flut.vibetrunk.com" ? alias : domain === legacy.alias ? legacy : null;
      if (!bound) throw new Error("Unexpected alias");
      return moved === domain && aliases > 2 ? { ...bound, deploymentId: "dpl_other" } : bound;
    }
    if (endpoint === "/v13/deployments/dpl_live") return live;
    throw new Error("Unexpected read endpoint");
  };
  const probe = async (url: string) => {
    probes.push(url);
    if (redirect.fails) throw new Error("fictional network failure");
    return { status: redirect.status, location: redirect.location };
  };
  return {
    project,
    alias,
    legacy,
    redirect,
    probes,
    live,
    page,
    get,
    list: async () => page,
    probe,
    move: (domain: "flut.vibetrunk.com" | "kut.vibetrunk.com" = "flut.vibetrunk.com") => {
      moved = domain;
    },
  };
}

describe("direct Vercel production verification", () => {
  function urlFixture() {
    const f = fixture();
    f.live.meta.githubCommitSha = candidate;
    const row = {
      url: "kut-reviewed.vercel.app",
      target: "production",
      state: "READY",
      meta: { githubCommitSha: candidate },
    };
    const resolved = { ...f.live, meta: { ...f.live.meta } };
    const get = async (endpoint: string) =>
      endpoint === `/v13/deployments/${row.url}` ? resolved : f.get(endpoint);
    return { ...f, row, resolved, get, list: async () => ({ deployments: [row] }) };
  }
  it("resolves URL-only CLI rows and deduplicates the returned deployment identity", async () => {
    const f = urlFixture();
    const result = await inspectVercelDeployment(candidate, f.get, f.list, f.probe);
    expect(result.result).toBe("candidate_live");
    expect(result.candidate_deployments).toEqual([result.production]);
  });
  it.each(["", "https://kut-reviewed.vercel.app", "attacker.example", "kut.vercel.app/path"])(
    "refuses an unsafe or missing list hostname: %s",
    async (url) => {
      const f = urlFixture();
      f.row.url = url;
      await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
        "hostname",
      );
    },
  );
  it("rejects resolved project, SHA and target mismatches", async () => {
    const f = urlFixture();
    f.resolved.projectId = "prj_other";
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "mismatched",
    );
    f.resolved.projectId = f.project.id;
    f.resolved.meta.githubCommitSha = previous;
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "mismatched",
    );
    f.resolved.meta.githubCommitSha = candidate;
    f.row.target = "preview";
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "mismatched",
    );
  });
  it("does not use URL recovery to bypass conflicting listed identities", async () => {
    const f = urlFixture();
    Object.assign(f.row, { id: "dpl_one", uid: "dpl_two" });
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "identity",
    );
  });
  it("does not confuse a successful candidate preview with the live production domain", async () => {
    const f = fixture();
    const result = await inspectVercelDeployment(candidate, f.get, f.list, f.probe);
    expect(result.result).toBe("candidate_not_live");
    expect(result.production.sha).toBe(previous);
    expect(result.candidate_deployments[0].target).toBe("preview");
    expect(result.deployment_authorized).toBe(false);
  });
  it("confirms the exact candidate through the ready production domain binding", async () => {
    const f = fixture();
    f.live.meta.githubCommitSha = candidate;
    expect((await inspectVercelDeployment(candidate, f.get, f.list, f.probe)).result).toBe(
      "candidate_live",
    );
  });
  it("recognizes explicit CLI deployment metadata and deduplicates the two metadata lookups", async () => {
    const f = fixture();
    f.live.meta.githubCommitSha = "";
    Object.assign(f.live.meta, { gitCommitSha: candidate });
    const result = await inspectVercelDeployment(candidate, f.get, f.list, f.probe);
    expect(result.result).toBe("candidate_live");
    expect(result.candidate_deployments).toHaveLength(1);
  });
  it("refuses a wrong project, missing SHA, and conflicting SHA metadata", async () => {
    const f = fixture();
    f.alias.projectId = "prj_other";
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "ownership",
    );
    f.alias.projectId = f.project.id;
    f.live.meta.githubCommitSha = "";
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "provenance",
    );
    f.live.meta.githubCommitSha = previous;
    Object.assign(f.live, { gitSource: { sha: candidate } });
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "provenance",
    );
  });
  it("refuses alias reassignment while checking instead of mixing two snapshots", async () => {
    const f = fixture();
    f.move();
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "changed",
    );
  });
  it("refuses unknown builds and candidate results from another commit", async () => {
    const f = fixture();
    f.live.readyState = "BUILDING";
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "ready",
    );
    f.live.readyState = "READY";
    f.page.deployments[0].meta.githubCommitSha = previous;
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "mismatched",
    );
  });
  it("does not claim a truncated candidate history is a complete lookup", async () => {
    const f = fixture();
    f.page.pagination.next = 123;
    expect(
      (await inspectVercelDeployment(candidate, f.get, f.list, f.probe)).candidate_lookup_complete,
    ).toBe(false);
  });
  it("keeps secrets and arbitrary metadata out of the returned evidence", async () => {
    const f = fixture();
    Object.assign(f.live.meta, { token: "fictional-secret" });
    Object.assign(f.alias, { protectionBypass: "fictional-bypass" });
    const result = JSON.stringify(await inspectVercelDeployment(candidate, f.get, f.list, f.probe));
    expect(result).not.toContain("fictional-secret");
    expect(result).not.toContain("fictional-bypass");
  });
});

describe("FLUT primary domain and the legacy redirect (ADR-137 slice 3)", () => {
  it("checks flut as the primary domain and verifies the legacy redirect live", async () => {
    const f = fixture();
    f.live.meta.githubCommitSha = candidate;
    const result = await inspectVercelDeployment(candidate, f.get, f.list, f.probe);
    expect(result.result).toBe("candidate_live");
    expect(result.domain).toBe("flut.vibetrunk.com");
    expect(result.legacy_domain).toBe("kut.vibetrunk.com");
    expect(result.legacy_redirect).toEqual({ verified: true, status: 307 });
    expect(f.probes).toEqual([`https://kut.vibetrunk.com${probePath}`]);
  });
  it("accepts the permanent 308 for slice 5", async () => {
    const f = fixture();
    f.redirect.status = 308;
    const result = await inspectVercelDeployment(candidate, f.get, f.list, f.probe);
    expect(result.legacy_redirect).toEqual({ verified: true, status: 308 });
  });
  it.each([
    [200, `https://flut.vibetrunk.com${probePath}`, "unexpected_status"],
    [301, `https://flut.vibetrunk.com${probePath}`, "unexpected_status"],
    [undefined, null, "unexpected_status"],
    [307, "https://flut.vibetrunk.com/", "wrong_location"],
    [307, "https://flut.vibetrunk.com/release-probe/legacy-host", "wrong_location"],
    [307, `http://flut.vibetrunk.com${probePath}`, "wrong_location"],
    [307, `https://attacker.example${probePath}`, "wrong_location"],
    [307, null, "wrong_location"],
  ])(
    "reports, without throwing, a legacy response %s to %s as %s",
    async (status, location, reason) => {
      const f = fixture();
      Object.assign(f.redirect, { status, location });
      const result = await inspectVercelDeployment(candidate, f.get, f.list, f.probe);
      expect(result.result).toBe("candidate_not_live");
      expect(result.legacy_redirect.verified).toBe(false);
      expect(result.legacy_redirect.reason).toBe(reason);
    },
  );
  it("reports a failed probe as unverified rather than live", async () => {
    const f = fixture();
    f.redirect.fails = true;
    const result = await inspectVercelDeployment(candidate, f.get, f.list, f.probe);
    expect(result.legacy_redirect).toEqual({
      verified: false,
      reason: "probe_failed",
      status: null,
    });
    expect(JSON.stringify(result)).not.toContain("fictional network failure");
  });
  it("refuses a legacy alias bound to another deployment", async () => {
    const f = fixture();
    f.legacy.deploymentId = "dpl_other";
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "Legacy domain",
    );
  });
  it("refuses a Vercel-level redirect or a foreign project on either alias", async () => {
    const f = fixture();
    f.legacy.redirect = "flut.vibetrunk.com";
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "routing",
    );
    delete f.legacy.redirect;
    f.legacy.projectId = "prj_other";
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "ownership",
    );
    f.legacy.projectId = f.project.id;
    Object.assign(f.alias, { redirect: "kut.vibetrunk.com" });
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "routing",
    );
  });
  it("refuses a legacy alias reassigned while checking", async () => {
    const f = fixture();
    f.move("kut.vibetrunk.com");
    await expect(inspectVercelDeployment(candidate, f.get, f.list, f.probe)).rejects.toThrow(
      "changed",
    );
  });
});
