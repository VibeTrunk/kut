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

The only way past it is setting `KUT_ALLOW_NONLOCAL_TEST_TARGET` to the exact
acknowledgement phrase named in the failure message. CI never sets it and no
repository script sets it. Refusals name the host only, never the connection
string.

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
skipped only for a mechanically classified docs-only diff. Code changes need
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
It provisions Chromium and WebKit and runs authenticated member + admin mobile
Playwright tests, including share recovery and geometry. Missing, skipped, cancelled, stale,
duplicated, or mismatched evidence fails closed. Its manifest explicitly
records that release approval is absent and deployment is unauthorized.

Release approval is a second, interactive command:

```powershell
powershell -NoProfile -File scripts/release/approve-production-release.ps1 `
  -GateManifest <gate.json> -CandidateSha <sha> -ApprovedBy <name>
```

Even a passing gate plus approval does not authorize or perform a deployment.
There is no deployment command in this tooling. Vercel auto-deploy behaviour
must remain unchanged until the owner separately authorizes the external
cutover and any associated branch-protection change.
