import { describe, expect, it } from "vitest";
import { inspectVercelDeployment } from "../../scripts/release/vercel-deployment-contract.mjs";

const candidate = "a".repeat(40);
const previous = "b".repeat(40);
function fixture() {
  const project = { id: "prj_test", name: "kut" };
  const alias = { alias: "kut.vibetrunk.com", projectId: project.id, deploymentId: "dpl_live" };
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
  let aliases = 0;
  let moved = false;
  const get = async (endpoint: string) => {
    if (endpoint === "/v9/projects/kut") return project;
    if (endpoint.startsWith("/v4/aliases/")) {
      aliases++;
      return moved && aliases > 1 ? { ...alias, deploymentId: "dpl_other" } : alias;
    }
    if (endpoint === "/v13/deployments/dpl_live") return live;
    throw new Error("Unexpected read endpoint");
  };
  return {
    project,
    alias,
    live,
    page,
    get,
    list: async () => page,
    move: () => {
      moved = true;
    },
  };
}

describe("direct Vercel production verification", () => {
  it("does not confuse a successful candidate preview with the live production domain", async () => {
    const f = fixture();
    const result = await inspectVercelDeployment(candidate, f.get, f.list);
    expect(result.result).toBe("candidate_not_live");
    expect(result.production.sha).toBe(previous);
    expect(result.candidate_deployments[0].target).toBe("preview");
    expect(result.deployment_authorized).toBe(false);
  });
  it("confirms the exact candidate through the ready production domain binding", async () => {
    const f = fixture();
    f.live.meta.githubCommitSha = candidate;
    expect((await inspectVercelDeployment(candidate, f.get, f.list)).result).toBe("candidate_live");
  });
  it("recognizes explicit CLI deployment metadata and deduplicates the two metadata lookups", async () => {
    const f = fixture();
    f.live.meta.githubCommitSha = "";
    Object.assign(f.live.meta, { gitCommitSha: candidate });
    const result = await inspectVercelDeployment(candidate, f.get, f.list);
    expect(result.result).toBe("candidate_live");
    expect(result.candidate_deployments).toHaveLength(1);
  });
  it("refuses a wrong project, missing SHA, and conflicting SHA metadata", async () => {
    const f = fixture();
    f.alias.projectId = "prj_other";
    await expect(inspectVercelDeployment(candidate, f.get, f.list)).rejects.toThrow("ownership");
    f.alias.projectId = f.project.id;
    f.live.meta.githubCommitSha = "";
    await expect(inspectVercelDeployment(candidate, f.get, f.list)).rejects.toThrow("provenance");
    f.live.meta.githubCommitSha = previous;
    Object.assign(f.live, { gitSource: { sha: candidate } });
    await expect(inspectVercelDeployment(candidate, f.get, f.list)).rejects.toThrow("provenance");
  });
  it("refuses alias reassignment while checking instead of mixing two snapshots", async () => {
    const f = fixture();
    f.move();
    await expect(inspectVercelDeployment(candidate, f.get, f.list)).rejects.toThrow("changed");
  });
  it("refuses unknown builds and candidate results from another commit", async () => {
    const f = fixture();
    f.live.readyState = "BUILDING";
    await expect(inspectVercelDeployment(candidate, f.get, f.list)).rejects.toThrow("ready");
    f.live.readyState = "READY";
    f.page.deployments[0].meta.githubCommitSha = previous;
    await expect(inspectVercelDeployment(candidate, f.get, f.list)).rejects.toThrow("mismatched");
  });
  it("does not claim a truncated candidate history is a complete lookup", async () => {
    const f = fixture();
    f.page.pagination.next = 123;
    expect(
      (await inspectVercelDeployment(candidate, f.get, f.list)).candidate_lookup_complete,
    ).toBe(false);
  });
  it("keeps secrets and arbitrary metadata out of the returned evidence", async () => {
    const f = fixture();
    Object.assign(f.live.meta, { token: "fictional-secret" });
    Object.assign(f.alias, { protectionBypass: "fictional-bypass" });
    const result = JSON.stringify(await inspectVercelDeployment(candidate, f.get, f.list));
    expect(result).not.toContain("fictional-secret");
    expect(result).not.toContain("fictional-bypass");
  });
});
