# Production safety and release evidence

This runbook defines the repository-side safety controls. It does not change
GitHub branch protection, Vercel, Supabase, credentials, or any hosted state.

## Agent sessions

Production-sensitive work, the release gate included, runs in the owner's
ordinary agent session. Until ADR-108 it had to start through a launcher script
that wrote a session receipt, which the gate checked to certify the model. That
check guarded no data and cost a separate session per release, so the launchers,
receipts and session hooks were removed. What protects hosted data is unchanged:
the checks below, and the owner's explicit instruction for every merge, push and
hosted mutation.

## Test targets

`tests/support/local-target.ts` refuses any non-loopback database or API URL.
This matters because the authenticated browser fixtures **delete and recreate
auth users**, and the release gate itself requires `API_URL`, `DB_URL`,
`ANON_KEY` and `SERVICE_ROLE_KEY` to be exported — so without the guard an
operator with hosted values in their shell would point destructive fixtures at
production. The guard covers the integration suites, the Playwright global
setup and teardown, and the authenticated Playwright config, which fails before
a browser starts.

The general test guard's override is setting `KUT_ALLOW_NONLOCAL_TEST_TARGET` to the exact
acknowledgement phrase named in the failure message. CI never sets it and no
repository script sets it. Refusals name the host only, never the connection
string.

The production E2E runner is stricter: it always requires loopback and refuses
remote browser overrides, regardless of that acknowledgement.

## Credentials

Runtime scripts use two stable, nonsecret locators:

- `backup-encryption-v1`
- `hosted-db-v1`

The current Windows user stores their DPAPI-protected records under
`%LOCALAPPDATA%\VibeTrunk\kut\credentials`. To import the two values from an
existing `.env.local` exactly once:

```powershell
node scripts/bootstrap-kut-credentials.mjs --from-env-local --confirm-import
```

Use `--replace` only for an intentional replacement. `.env.local` may continue
to contain the values as the operator requested, but it is never a runtime
fallback or proof of durable credential storage. Keep that local file protected;
production scripts use only the independently retrievable DPAPI records.

## Pull-request gates

The `verify` workflow runs on every PR and `main` push, including docs-only
changes. `merge-gate` is always present; it permits expensive jobs to be
skipped only for a mechanically classified docs-only **pull request**. A push
to `main` always runs every job, because its SHA is the release candidate and
the gate refuses skipped evidence (ADR-126). Code changes need
successful fast/build, E2E, database/pgTAP/concurrency, migration-policy, and
dependency-audit jobs. Gitleaks runs separately with an immutable container
digest.

After these files land and produce a green run, configure GitHub branch
protection to require both **`merge-gate`** and **`scan`**. That is an external
administrative change and is intentionally not automated here.

Use those exact names. GitHub Actions reports a check run under its *job* name,
not `workflow / job`, so requiring `verify / merge-gate` or `gitleaks / scan`
would pin a context that never reports and leave every PR permanently pending —
the same never-starts failure this workflow's always-present aggregator exists
to prevent. Confirm the current names before changing protection:

```powershell
gh api "repos/VibeTrunk/kut/commits/main/check-runs?per_page=100" --jq '.check_runs[].name' | Sort-Object -Unique
```

Migration policy rejects modifying, deleting, copying, or renaming an existing
`supabase/migrations/*.sql`; permits at most one added migration; and requires a
changed pgTAP file or a reviewed entry in
`policy/migration-test-exemptions.json`. A reviewer still classifies the
migration under `docs/OPERATIONS.md` and reviews Part L/RPC semantics.

## Feature and migration isolation

Every migration- or invariant-bearing feature is its own reviewable slice and
normally its own PR. Its handoff declares the predecessor migration, ordering
dependencies, affected Part L invariants, tests, rollback, and central-
catalogue work. Do not create a local commit unless the user has explicitly
authorized that feature slice; a broad implementation request is not implicit
authorization to collapse multiple slices into one commit.

CI can enforce immutable migration history, one new migration, companion test
evidence, and the aggregate integration checks. It cannot reliably infer where
one product feature ends, whether an invariant changed, whether a dependency
declaration is semantically complete, or whether the operator authorized a
commit. Those remain explicit author/reviewer checks. Integration review begins
only after each individual slice has passed its own tests.

Neither agent rule set auto-allows `git commit`, `git push`, or
`supabase functions deploy` any more. The repository cannot prove conversational
authorization, but it can stop treating a standing permission as though it were
authorization: each of those now surfaces an approval prompt, and a direct push
to `main` is denied outright.

## Production gate and approval

From a clean checkout at the exact candidate commit, with the local full
Supabase stack running and its `API_URL`,
`ANON_KEY`, `SERVICE_ROLE_KEY`, and `DB_URL` exported:

```powershell
$env:KUT_CENTRAL_SUPABASE_REPO = 'C:\path\to\VibeTrunk\supabase'
powershell -NoProfile -File scripts/release/request-production-gate.ps1 `
  -CandidateSha <40-character-sha>
```

The gate reads GitHub check evidence for that SHA, checks byte-identical central
migration catalogue parity, requires a cold-verified backup less than 24 hours
old, and freshly decrypts and hash-checks that ciphertext in another process.
It invokes `scripts/release/run-production-e2e.mjs --candidate <sha>`, which
verifies installed Next/Playwright versions against the lockfile, provisions
Chromium and WebKit, builds the candidate afresh and starts an owned production
server on loopback 3101. An occupied port fails; an existing server is never
reused. All three authenticated mobile projects run with zero retries, traces
retained on their first failure, one failure stopping the run and a 30-minute
deadline. CI does not change these conditions. Member/admin, share recovery and
geometry assertions are unchanged. Missing, skipped, cancelled, stale,
duplicated, or mismatched evidence fails closed. Its manifest explicitly
records that release approval is absent and deployment is unauthorized.

The sole existing coverage exception is the pack-summary case running once
on narrow Chromium: its two duplicate-device skips are accepted only by exact
title/project, while narrow Chromium must pass. Every other skip fails closed.
The report must match an unfiltered inventory from the same configuration.

Each run preserves private diagnostics under a unique
`.release-evidence/authenticated/<sha>/<run-id>/`. Do not upload raw reports,
traces or screenshots: they may contain authenticated local member data.
The manifest records runtime versions, actual PostgREST image/version when
available, build identity and artifact hashes. The gate now emits version 2;
old gate records must be rerun. Approval/assertion check the nested E2E
manifest and report/inventory integrity and recheck the 24-hour backup and
72-hour external-check limits. A checkout changed during the run fails.

On 2026-10-04 the owner explicitly instructed: "Consider me merging the PR as
the approval. Run the full gate automatically youself. Merge = deployment approval."
An owner merge of a reviewed PR into main therefore supplies per-change release
and Vercel production deployment authorization for the exact resulting SHA.
Confirm the owner and merge SHA through GitHub, run the full gate automatically
on that clean commit, then record approval using the command below. The agent
may supply its exact-SHA confirmation from that verified authorization without
asking the owner again. A failed gate stops deployment; changed candidates need
their own passing evidence and authorized owner merge.

Approval remains a separate record created only after the gate passes:

```powershell
powershell -NoProfile -File scripts/release/approve-production-release.ps1 `
  -GateManifest <gate.json> -CandidateSha <sha> -ApprovedBy <name>
```

The gate and approval artifacts do not themselves authorize or perform a
deployment; authorization comes from the owner's merge instruction (ADR-124).
The approval schema's `deployment_authorized: false` remains unchanged.
There is no deployment command in the gate tooling. PR #188 published
`git.deploymentEnabled.main = false` with no overlapping true rule. At
2026-10-04 14:31:31 UTC, authenticated Vercel verification found no deployments
for its merged SHA `0d82bf1d2d2ee05747d457133803f79a7cef3ca2`; the production
domain still served #187's `b99db188c6e0993552747c6f6d84a3779a480e71`.
This confirms the hold for that merge; recheck it for each release. See
[Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

If the hold is changed, publish it through an authorized PR and verify read-only
that the Vercel Git integration honors it. With the hold active, an authorized
squash merge creates the final candidate without automatically deploying it.
Run the gate on that exact clean SHA, record the owner's merge approval, and
run `assert-production-evidence.ps1` with its gate and approval manifests before
the Vercel production deployment already authorized by that owner merge.
Verify the deployed SHA and production domain binding afterwards. Do not request
another release/deployment confirmation. New commits/pushes, hosted migrations,
Supabase functions, secrets and branch-protection changes still require their
own authorization. A passing postdeploy
gate cannot retroactively establish predeployment ordering.

## Direct deployment verification and CLI access

Check Vercel access at the start of release work, before promising a direct
deployment audit:

```powershell
node scripts/release/check-vercel-deployment.mjs --candidate <40-character-sha>
```

The read-only checker resolves `kut.vibetrunk.com` to its bound Vercel deployment,
checks the project, production target, ready state and exact Git SHA, and reads
candidate deployments separately. A successful preview or an unpromoted ready
build is not proof of what the production domain serves. CLI list rows without
IDs are resolved by their validated Vercel hostname through the authenticated
deployment API, with project and commit provenance checked against the list row.
Re-reading the domain
binding detects reassignment during the check. A partial candidate-history page
is identified as incomplete. No release approval or deployment is authorized.

Authentication failures produce `unverified`, never a deployment conclusion.
The operator can run `node scripts/release/check-vercel-deployment.mjs --login`
in their own interactive terminal and complete Vercel's browser sign-in. The
official CLI manages its existing saved session; do not copy tokens into chat,
arguments, repository files, or a new credential store. The checker reuses the
already installed Vercel CLI 59.23.2; it never installs a package. An explicit
`KUT_VERCEL_CLI_PATH` may locate that CLI if the usual Windows npm locations
are unavailable. Raw API responses and credential-bearing logs are not emitted.

Endpoint contracts: [Vercel alias lookup](https://vercel.com/docs/rest-api/aliases/get-an-alias)
and [deployment metadata filtering](https://vercel.com/docs/cli/list).
