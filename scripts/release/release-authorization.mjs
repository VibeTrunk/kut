import { runReadOnly } from "./preflight-command.mjs";

export const RELEASE_OWNER = "MartinFloris";
export const RELEASE_REPOSITORY = "VibeTrunk/kut";

// Conservative release classification: an executable/configuration file under
// docs/ is still executable. CI's broader docs shortcut is not release authority.
export function documentationOnly(files) {
  return files.length > 0 && files.every((file) => file.endsWith(".md"));
}

export function validateOwnerMerge(pr, main, sha, number) {
  if (
    pr?.number !== number ||
    pr.state !== "MERGED" ||
    pr.baseRefName !== "main" ||
    pr.mergeCommit?.oid !== sha ||
    pr.mergedBy?.login !== RELEASE_OWNER ||
    !Number.isFinite(Date.parse(pr.mergedAt)) ||
    Date.parse(pr.mergedAt) > Date.now() ||
    main !== sha
  ) {
    throw new Error("authorization_invalid");
  }
  return {
    source: "owner_merge",
    pull_request: number,
    candidate_sha: sha,
    approved_by: RELEASE_OWNER,
    merged_at: pr.mergedAt,
  };
}

export async function inspectAuthorization(root, sha, number, execute = runReadOnly) {
  const call = async (file, args) => {
    const r = await execute(file, args, { cwd: root });
    if (!r.ok) throw new Error("authorization_unverified");
    return r.stdout;
  };
  const pr = JSON.parse(
    await call("gh", [
      "pr",
      "view",
      String(number),
      "--repo",
      RELEASE_REPOSITORY,
      "--json",
      "number,state,baseRefName,mergeCommit,mergedBy,mergedAt",
    ]),
  );
  const main = (
    await call("gh", ["api", `repos/${RELEASE_REPOSITORY}/commits/main`, "--jq", ".sha"])
  ).trim();
  const authorization = validateOwnerMerge(pr, main, sha, number);
  const parents = (await call("git", ["rev-list", "--parents", "-n", "1", sha]))
    .trim()
    .split(/\s+/);
  if (parents.length !== 2 || parents[0] !== sha || !/^[a-f0-9]{40}$/.test(parents[1]))
    throw new Error("authorization_invalid");
  // Read the complete merged diff, with no Git external diff/textconv execution.
  await call("git", ["diff", "--no-ext-diff", "--no-textconv", parents[1], sha]);
  const names = (await call("git", ["diff", "--name-only", "-z", parents[1], sha]))
    .split("\0")
    .filter(Boolean);
  if (!names.length) throw new Error("authorization_invalid");
  return { ...authorization, documentation_only: documentationOnly(names), parent_sha: parents[1] };
}
