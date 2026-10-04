const DOMAIN = "kut.vibetrunk.com";

function deploymentSummary(deployment) {
  const ids = [deployment.id, deployment.uid].filter(Boolean);
  if (!ids.length || ids.some((id) => !/^dpl_[a-zA-Z0-9]+$/.test(id) || id !== ids[0])) {
    throw new Error("Invalid deployment identity.");
  }
  const shas = [
    deployment.meta?.githubCommitSha,
    deployment.meta?.gitCommitSha,
    deployment.gitSource?.sha,
  ].filter(Boolean);
  if (!shas.length || shas.some((sha) => !/^[a-f0-9]{40}$/.test(sha) || sha !== shas[0])) {
    throw new Error("Deployment has missing or conflicting commit provenance.");
  }
  return {
    id: ids[0],
    sha: shas[0],
    target: deployment.target ?? "preview",
    state: deployment.readyState ?? deployment.state,
  };
}

/** Read the live domain, not the newest preview or merely the newest ready build. */
export async function inspectVercelDeployment(candidate, get, list) {
  if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error("An exact candidate SHA is required.");
  const project = await get("/v9/projects/kut");
  if (project.name !== "kut" || !/^prj_[a-zA-Z0-9]+$/.test(project.id)) {
    throw new Error("Unexpected Vercel project.");
  }
  const aliasEndpoint = `/v4/aliases/${DOMAIN}`;
  const alias = await get(aliasEndpoint);
  if (alias.alias !== DOMAIN || alias.projectId !== project.id || alias.redirect) {
    throw new Error("Production domain has unexpected ownership or routing.");
  }
  const id = alias.deploymentId;
  if (!/^dpl_[a-zA-Z0-9]+$/.test(id)) throw new Error("Production domain lacks a deployment.");
  const current = await get(`/v13/deployments/${id}`);
  const production = deploymentSummary(current);
  if (
    production.id !== id ||
    current.projectId !== project.id ||
    production.target !== "production" ||
    production.state !== "READY"
  ) {
    throw new Error("Production domain does not resolve to a ready production build.");
  }
  // Git integration and explicit CLI deployments use different metadata keys.
  const pages = await Promise.all([
    list(candidate, "githubCommitSha"),
    list(candidate, "gitCommitSha"),
  ]);
  if (pages.some((page) => !Array.isArray(page.deployments)))
    throw new Error("Incomplete candidate deployment lookup.");
  const candidates = [
    ...new Map(
      pages
        .flatMap((page) => page.deployments)
        .map((deployment) => {
          const summary = deploymentSummary(deployment);
          if (
            summary.sha !== candidate ||
            (deployment.projectId && deployment.projectId !== project.id)
          ) {
            throw new Error("Candidate lookup returned mismatched provenance.");
          }
          return [summary.id, summary];
        }),
    ).values(),
  ];
  const confirmation = await get(aliasEndpoint);
  if (
    confirmation.alias !== DOMAIN ||
    confirmation.projectId !== project.id ||
    confirmation.deploymentId !== id ||
    confirmation.redirect
  ) {
    throw new Error("Production domain changed while verification was running.");
  }
  return {
    source: "vercel",
    checked_at: new Date().toISOString(),
    candidate_sha: candidate,
    domain: DOMAIN,
    result: production.sha === candidate ? "candidate_live" : "candidate_not_live",
    production,
    candidate_deployments: candidates,
    candidate_lookup_complete: pages.every((page) => page.pagination?.next == null),
    deployment_authorized: false,
  };
}
