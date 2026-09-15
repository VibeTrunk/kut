# Production safety and release evidence

This runbook defines the repository-side safety controls. It does not change
GitHub branch protection, Vercel, Supabase, credentials, or any hosted state.

## Production agent sessions

Start production-sensitive work through one of these launchers:

```powershell
powershell -NoProfile -File scripts/start-production-codex.ps1
powershell -NoProfile -File scripts/start-production-claude.ps1
```

Codex requests `gpt-6-astra` with `model_reasoning_effort="high"`; pass
`-Model gpt-5.6-sol` for the approved fallback. Claude requests the current
`opus` alias. Each `SessionStart` hook writes what it observed into a local
receipt under `.release-evidence/sessions/`.

What each runtime can actually prove differs, and the tooling says so rather
than implying a uniform guarantee:

| Control | Codex | Claude Code |
|---|---|---|
| Model at session start | Hook-attested — the payload carries the slug | Attested *when* the payload carries `model`; the reference says it "doesn't always" include it |
| Reasoning / thinking level | Launcher-enforced, not exposed to hooks | Launcher-enforced |
| Aborting a disallowed session from the hook | Supported by the Codex runtime | **Not possible** — `continue: false` is not honoured at `SessionStart` and exit code 2 is non-blocking there |
| Blocking a mid-session downgrade | — | Enforced: `PreModelSwitch` denies any non-Opus target with exit code 2 |

Because `SessionStart` cannot stop a Claude session, the hook does not pretend
to. It records one of three outcomes — `hook` (an Opus model was seen),
`unavailable` (no model was reported), or `rejected` (a non-Opus model was
seen) — and `request-production-gate.ps1` is what fails closed: `rejected` or
a missing attestation is refused, and `unavailable` is accepted only as
launcher-enforced and labelled that way in the gate manifest. A missing or
unreadable receipt fails the gate outright.

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
protection to require both `verify / merge-gate` and `gitleaks / scan`. That is
an external administrative change and is intentionally not automated here.

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

From a clean checkout at the exact candidate commit, inside a production agent
session, with the local full Supabase stack running and its `API_URL`,
`ANON_KEY`, `SERVICE_ROLE_KEY`, and `DB_URL` exported:

```powershell
$env:KUT_CENTRAL_SUPABASE_REPO = 'C:\path\to\VibeTrunk\supabase'
powershell -NoProfile -File scripts/release/request-production-gate.ps1 `
  -CandidateSha <40-character-sha>
```

The gate reads GitHub check evidence for that SHA, checks byte-identical central
migration catalogue parity, requires a cold-verified backup less than 24 hours
old, and freshly decrypts and hash-checks that ciphertext in another process.
It also validates the production-session receipt and runs authenticated member
+ admin mobile Playwright tests. Missing, skipped, cancelled, stale,
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
