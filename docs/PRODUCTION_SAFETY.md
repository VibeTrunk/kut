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
to `main` always runs every job, so its SHA has complete CI evidence if a
release is requested; the gate refuses skipped evidence (ADR-126). The
documentation-only release exception below does not waive main CI. Code
changes need successful fast/build, E2E, database/pgTAP/concurrency, migration-policy, and
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

**Documentation-only exception (owner decision, 2026-10-05):** a merge changing
only documentation needs no release gate or deployment unless the owner asks
for that release. Production may lag `main` by documentation-only commits.
State the exception and production lag explicitly in the PR and
`docs/DEPLOYMENTS.md`, with the last verified production SHA and observation
time; do not imply a historical observation is a fresh domain check. Review the
complete diff rather than trusting a label, filename or CI shortcut: executable
and configuration changes are not documentation-only. Full main CI still runs
under ADR-126. If the owner asks to release a docs-only SHA, all ordinary
exact-SHA gate, approval, assertion and deployment-verification requirements
apply. This exception grants no waiver for unreleased executable changes.

Deployment records ride with the next PR opened for other work, never a
standalone record PR. Preserve unpublished records and their private evidence
until they can be included in that slice.

"Main checkout" means the ordinary checkout, not necessarily the `main`
branch. Checkout identity, real dependencies, the exact SHA and cleanliness
are separate requirements. A repair worktree cannot run the gate.

For a release, use the ordinary, non-linked checkout (never a linked git
worktree), clean at the exact candidate commit, with its own `node_modules`
from `npm ci` (ADR-128), the
local full Supabase stack running and its `API_URL`,
`ANON_KEY`, `SERVICE_ROLE_KEY`, and `DB_URL` exported for the full gate.

Before expensive work, run the optional read-only preflight (ADR-129):

```powershell
$env:KUT_CENTRAL_SUPABASE_REPO = 'C:\path\to\VibeTrunk\supabase'
npm run release:preflight -- --candidate <40-character-sha>
```

It checks ADR-128 checkout identity and real dependencies, exact HEAD and clean
status, all seven exact-SHA successful CI checks within 72 hours, GitHub and
Vercel project access, Docker and the local Supabase services, the ordinary
checkout's backup pointer within 24 hours, independently retrievable DPAPI
locators, central checkout/catalogue parity and free loopback port 3101.
Missing, duplicate, partial, skipped, cancelled, mismatched, stale and
future-dated evidence fails closed. It captures CLI output privately in memory
and emits only fixed check names, reasons, remedies and elapsed time. Each
child command has a 10-second deadline and a one-MiB combined-output bound;
independent probes run concurrently. Normal runs finish in seconds; sequential
probes may consume up to three command deadlines including the initial checkout
check. Deadline cleanup targets only the probe's own process tree.

The preflight never starts a stack, exports or creates a backup, builds, creates
fixtures, approves a release or deploys. A passing backup-pointer check is
**not independent recovery proof**: only the full gate freshly decrypts and
hash-checks the ciphertext in another process. Likewise, a free port is a
point-in-time observation that the E2E runner rechecks before building.

`network_denied` means explicit access/sandbox denial; retry the authorized
read-only command with supported per-command approval. `network_unavailable`
and `timed_out` leave login status unverified. `login_required` means the CLI
explicitly requires sign-in; `login_expired` requires explicit expiration
evidence; `authentication_rejected` means an authentication rejection, not
proof of expiration. A generic failure, including one during Vercel's
authentication stage, is `access_unverified`. Never re-bootstrap login from
that alone. Confirmed sign-in needs use the official operator terminal flow
below. Preflight reads the existing installed CLIs and DPAPI locators only;
it never downloads a package or falls back to `.env.local`.

After prerequisite failures are resolved within the applicable authorization,
run the unchanged full gate:

```powershell
$env:KUT_CENTRAL_SUPABASE_REPO = 'C:\path\to\VibeTrunk\supabase'
powershell -NoProfile -File scripts/release/request-production-gate.ps1 `
  -CandidateSha <40-character-sha>
```

The gate reads GitHub check evidence for that SHA, checks byte-identical central
migration catalogue parity, requires a cold-verified backup less than 24 hours
old, and freshly decrypts and hash-checks that ciphertext in another process.
For a merge-authorized release, the owner's merge also covers taking that fresh
backup; it needs no separate approval (ADR-124, owner amendment of 2026-10-09).
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

The runner keeps stdout exclusively for its final JSON result (ADR-130).
Build started/done and project started/done progress is emitted during execution
to stderr with fixed labels, monotonic integer elapsed milliseconds and scalar
pass/finished/total counts. Skips and expected failures are not passes. A project
`done` notice is not release evidence; final report validation and integrity
checks still decide the result, including teardown failures. Incomplete started
projects report `stopped`. Raw child output is buffered and redacted privately;
project progress comes through a separate structured IPC channel, never by
streaming browser or fixture output.

The gate invokes `invoke-production-e2e.ps1` to capture stdout and display safe
progress with .NET Process rather than PowerShell's native stderr adapter.
This works with Windows PowerShell 5.1 and `ErrorActionPreference = 'Stop'`
unchanged. Unexpected stderr, a nonzero exit or invalid/mismatched JSON still
stops the gate. When invoking the Node runner directly, capture stdout and
stderr separately; do not merge progress into the JSON stream.

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
Except for the documentation-only exception above, an owner merge of a reviewed
PR into main supplies per-change release and Vercel production deployment
authorization for the exact resulting SHA.
Confirm the owner and merge SHA through GitHub, run the full gate automatically
on that clean commit, then record approval using the command below. The agent
may supply its exact-SHA confirmation from that verified authorization without
asking the owner again. A failed gate stops deployment; changed candidates need
their own passing evidence and authorized owner merge.

### One release-preparation command (slice 3c / ADR-132)

For a personally merged owner PR, the ordinary clean checkout can run the
same preflight, full gate, approval and assertion through one command:

```powershell
npm run release:prepare -- --candidate <40-character-lowercase-sha> --pull-request <number>
```

Use the existing local-stack environment and central-catalogue setup above.
The command does not start services, generate backups or export credentials.
It verifies GitHub's actual owner (`MartinFloris`), merged PR, `main` base,
exact merge SHA and current remote main, and reads the complete merged diff.
A documentation-only merge returns `not_required` without a gate or approval.
Executable/configuration changes under `docs/` cannot use that exception;
the automatic exemption conservatively accepts only Markdown paths. Other
documentation formats need the complete-diff operator review before choosing
the separate manual workflow; CI's broader docs shortcut is not release authority.
For an owner-requested documentation release, add `--explicit-release` in an
interactive owner terminal and confirm that specific release/deployment request
by typing its full SHA. This flag alone supplies no approval, and ordinary
owner-merge releases need no extra prompt. The command deliberately refuses
other merge identities or a changed main rather than inventing authority.

The candidate never changes. Preflight must pass every existing check; the full
gate returns only the new manifest it created, with no latest-file discovery or
reuse of an earlier passing run. Authorization is queried again after the gate,
before supplying the existing approval command's exact-SHA confirmation.
Gate/approval hashes bind the stages, and the existing evidence assertion still
validates E2E/report/inventory integrity and freshness. Missing, failed, stale,
skipped, cancelled, mismatched, future-dated or altered evidence stops the chain.

Fixed stage progress, the existing safe build/project progress, and the final
executable handoff commands use stderr; stdout contains one final JSON result
with the same commands as string fields. Raw PowerShell/native child records are
captured privately and never echoed. Windows PowerShell 5.1 works without
changing `ErrorActionPreference = 'Stop'`. Failure returns nonzero with fixed
reasons and, for preflight failures, its fixed check/remedy vocabulary.

`prepared` means evidence assertion passed, not that production changed.
Its `commands.deployment` and `commands.verification` contain literal executable
PowerShell here-strings piped to Node. Execute them separately only under the
applicable owner merge or explicit per-change deployment instruction. The
preparation command never evaluates either string, runs a Vercel create request,
or installs anything. Adding deployment execution to it needs a separate ADR
and explicit owner approval.

The printed deployment command rechecks the same owner merge/current main,
bound evidence hashes, full assertion and exact Vercel project/GitHub linkage
before its separate API create request. It uses `gitSource` with both `ref` and
`sha` equal to the candidate, rather than an upload or a mutable `main` ref.
The installed official CLI uses its existing login; no credential enters an
argument or log. API output stays buffered; only the created deployment ID and
candidate are printed. The [Vercel create-deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
supports Git-source deployments, and [CLI API input](https://vercel.com/docs/cli/api)
accepts the JSON request on stdin using `--input -`.
The verification command uses the existing authenticated checker and requires
`candidate_live`, the same SHA, a complete candidate lookup and a verified
legacy-host redirect (ADR-139). Run it after
Vercel is READY; an incomplete build/binding returns nonzero. Keep the final
preparation/deployment/verification results as private release evidence and
record the release in the next normal PR. No broad gate is needed just to test
this orchestration: focused fictional-service/subprocess tests cover it.

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
When a release is required under the policy above, run the gate on that exact
clean SHA, record the owner's merge approval, and run
`assert-production-evidence.ps1` with its gate and approval manifests before
the Vercel production deployment already authorized by that owner merge.
Verify the deployed SHA and production domain binding afterwards. Do not request
another release/deployment confirmation. New commits/pushes, hosted migrations,
Supabase functions, secrets and branch-protection changes still require their
own authorization. A passing postdeploy
gate cannot retroactively establish predeployment ordering.

## Browser incident monitoring (ADR-134)

On 2026-10-07 the owner selected monitoring only for Topic A, the unresolved
Windows WebKit Drawing stalls / slow spells. Dedicated diagnostics stop for
now. The demonstrated impact is intermittent test/release reliability;
matching real-user impact remains unconfirmed. ADR-133's matrix split and
passing gates do not establish an initiating-cause repair.

Continue ordinary authorized validation with all existing assertions,
coverage, preview waits, worker/retry limits and production deadlines. A
failed required gate still blocks deployment. Do not use retries or larger
timeouts to make an incident disappear from release evidence.

A related failure in ordinary work or a credible matching user report is
the trigger to revisit diagnosis. Preserve the original failed run, trace
and available timings before clearing state. Identify the browser, OS and
affected surface for real-device reports. Keep Topic B's storage stall,
KB-037's phone-preview report and #201's login timeout separate unless new
evidence demonstrates a relationship.

Before a new diagnostic experiment, state a hypothesis that distinguishes
remaining candidates and use a 30-minute diagnosis time-box within the
applicable authorization. Reuse the retained evidence and validated capture
method where appropriate; no machine-setting change or native profiling is
automatically authorized by monitoring. If no useful discriminator emerges,
record the limitation and return to monitoring. Do not repeat excluded stress
probes or run broad release gates solely to hunt a recurrence.

## Planned approval-based cleanup (ADR-135)

The owner selected a shared cleanup workflow for Codex and Claude; it has not
been implemented. ROADMAP carries the implementation scope. Existing command
guards, filesystem restrictions and per-change publication/production
authorization remain active. Recording this decision supplies no new removal
approval or permission to bypass a blocked command.

The planned workflow defaults to read-only inspection and requires verified
preservation plus specific owner approval of named cleanup items. Before
approval, explain each cleanup type briefly in non-technical language: what
will be removed, why the checks support removal, what remains saved or
untouched, and any practical downside or unresolved uncertainty. Same-type
items may share an explanation only when their preservation conditions match.
Changed contents or scope require renewed review of the changed items.

The four approved worktree removals are complete; twelve extras remain
protected with no further removal approved. Windows deletion capability and
actual enforcement for both installed agents must be proved in disposable
fixtures before further real cleanup. Neither a receipt written by an agent
nor a helper wrapper supplies owner consent or filesystem permission.

## Direct deployment verification and CLI access

Check Vercel access at the start of release work, before promising a direct
deployment audit:

```powershell
node scripts/release/check-vercel-deployment.mjs --candidate <40-character-sha>
```

The read-only checker resolves `flut.vibetrunk.com` to its bound Vercel
deployment, checks the project, production target, ready state and exact Git
SHA, and reads candidate deployments separately. The legacy `kut.vibetrunk.com`
alias must belong to the same project and bind the same deployment. Neither
alias may carry a Vercel-level redirect: the app redirects the legacy host
(ADR-139). A successful preview or an unpromoted ready build is not proof of
what the production domain serves. CLI list rows without IDs are resolved by
their validated Vercel hostname through the authenticated deployment API, with
project and commit provenance checked against the list row.

The checker then requests one fixed path on the legacy host without following
redirects. It reports `legacy_redirect.verified` only for a 307 or 308 whose
`Location` is the same path and query on `https://flut.vibetrunk.com`. Any
other status, location or a network failure is reported with a reason, not
thrown, because production before the release that adds the redirect rightly
has none. Re-reading both bindings afterwards detects reassignment during the
check. A partial candidate-history page is identified as incomplete. The
printed post-deployment verification command requires `candidate_live`, a
complete lookup and a verified legacy redirect. No release approval or
deployment is authorized.

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
