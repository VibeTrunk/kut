// The members' address since the FLUT rename (ADR-137, slice 3). The legacy host
// is a second alias of the same production deployment; the app itself, not
// Vercel, redirects it, so both aliases must bind with no Vercel redirect.
const DOMAIN = "flut.vibetrunk.com";
const LEGACY_DOMAIN = "kut.vibetrunk.com";
// Any path proves the catch-all redirect; the query proves it is carried over.
const REDIRECT_PROBE_PATH = "/release-probe/legacy-host?check=1";
// 307 until the owner accepts the new domain, then 308 (ADR-137 slice 5).
const REDIRECT_STATUSES = [307, 308];

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

/**
 * Ask the legacy host for a fixed path without following redirects. A missing
 * or wrong redirect is reported, not thrown: before the release that adds it,
 * production rightly has none, and the binding evidence still matters then.
 */
async function probeLegacyRedirect(probe) {
  let response;
  try {
    response = await probe(`https://${LEGACY_DOMAIN}${REDIRECT_PROBE_PATH}`);
  } catch {
    return { verified: false, reason: "probe_failed", status: null };
  }
  const status = Number.isInteger(response?.status) ? response.status : null;
  if (!REDIRECT_STATUSES.includes(status))
    return { verified: false, reason: "unexpected_status", status };
  if (response.location !== `https://${DOMAIN}${REDIRECT_PROBE_PATH}`) {
    return { verified: false, reason: "wrong_location", status };
  }
  return { verified: true, status };
}

/** Read the live domain, not the newest preview or merely the newest ready build. */
export async function inspectVercelDeployment(candidate, get, list, probe) {
  if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error("An exact candidate SHA is required.");
  const project = await get("/v9/projects/kut");
  if (project.name !== "kut" || !/^prj_[a-zA-Z0-9]+$/.test(project.id)) {
    throw new Error("Unexpected Vercel project.");
  }
  const binding = async (domain) => {
    const alias = await get(`/v4/aliases/${domain}`);
    if (alias.alias !== domain || alias.projectId !== project.id || alias.redirect) {
      throw new Error("Production domain has unexpected ownership or routing.");
    }
    return alias.deploymentId;
  };
  const id = await binding(DOMAIN);
  if ((await binding(LEGACY_DOMAIN)) !== id) {
    throw new Error("Legacy domain does not serve the production deployment.");
  }
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
  const entries = await Promise.all(
    pages
      .flatMap((page) => page.deployments)
      .map(async (deployment) => {
        // CLI list output can omit IDs. Resolve only a Vercel hostname through
        // the authenticated API; never fetch a URL supplied by a list row.
        if (!deployment.id && !deployment.uid) {
          if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.vercel\.app$/.test(deployment.url)) {
            throw new Error("Candidate lookup lacks a safe deployment hostname.");
          }
          const resolved = await get(`/v13/deployments/${deployment.url}`);
          const listed = deploymentSummary({ ...deployment, id: resolved.id });
          const detail = deploymentSummary(resolved);
          if (
            resolved.projectId !== project.id ||
            listed.sha !== detail.sha ||
            listed.target !== detail.target ||
            (deployment.projectId && deployment.projectId !== project.id)
          ) {
            throw new Error("Candidate lookup returned mismatched provenance.");
          }
          deployment = resolved;
        }
        const summary = deploymentSummary(deployment);
        if (
          summary.sha !== candidate ||
          (deployment.projectId && deployment.projectId !== project.id)
        ) {
          throw new Error("Candidate lookup returned mismatched provenance.");
        }
        return [summary.id, summary];
      }),
  );
  const candidates = [...new Map(entries).values()];
  const legacyRedirect = await probeLegacyRedirect(probe);
  // Re-read both bindings, so the probe answered from the deployment checked.
  for (const domain of [DOMAIN, LEGACY_DOMAIN]) {
    let confirmed;
    try {
      confirmed = await binding(domain);
    } catch {
      confirmed = null;
    }
    if (confirmed !== id) {
      throw new Error("Production domain changed while verification was running.");
    }
  }
  return {
    source: "vercel",
    checked_at: new Date().toISOString(),
    candidate_sha: candidate,
    domain: DOMAIN,
    legacy_domain: LEGACY_DOMAIN,
    result: production.sha === candidate ? "candidate_live" : "candidate_not_live",
    legacy_redirect: legacyRedirect,
    production,
    candidate_deployments: candidates,
    candidate_lookup_complete: pages.every((page) => page.pagination?.next == null),
    deployment_authorized: false,
  };
}
