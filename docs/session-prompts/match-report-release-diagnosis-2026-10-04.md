# Soft graphite: bounded release-gate diagnosis — 4 October 2026

This is the fresh-session follow-up to
[the release handover](match-report-release-handover-2026-10-04.md).
Investigation started at about **12:12 Amsterdam**. The first state checkpoint
and the diagnosis below were reported within the handover's timeboxes.

**Result:** interrupted fixture cleanup is demonstrably defective. The selected
Windows/Linux WebKit failure did not reproduce. There is a concrete, separate
PostgREST environment lead, but no proven browser fix. The historical release
still has no passing full gate or predeployment gate approval.

## Release and workspace checkpoint

Read-only GitHub checks confirmed:

- PR #186 remains merged; main is
  `70de2f1c654db81967dc3c4f1df01170c7dde894`.
- Latest Production deployment is `6838989819`, created and successful at
  **10:58:45 Amsterdam**, for that exact SHA. Its URL remains
  <https://kut-lw9yqeh77-vibetrunk.vercel.app>.
- All seven gate-required check names report success for that SHA. These are
  CI results, not a substitute for the local authenticated production gate.
- Main protection still requires `merge-gate` and `scan`, with strict mode
  false and zero required reviews. GitHub reports administrative permission
  for the current account; no protection settings were changed.

The primary checkout's existing dirty work was preserved. All diagnostics ran
in the existing clean detached `work/release-soft-graphite` checkout at the
exact candidate. Its tracked tree remained clean. The 21 old failure contexts
and previous `test-results` were retained; new runs use distinct ignored paths.
Only the regenerable `.next` build was replaced with a fresh build.

Initially and after the diagnostic lifecycles, local counts were zero for
active Midweek tournaments, `00000097-` Players, release auth users and
archetype rotation rows. No historical repair was repeated.

## Controlled browser reproduction

The single selected test was the unchanged
`poster-only layout and loading rows stay aligned` case in
`tests/e2e-authenticated/share-regression.spec.ts`. It previously failed at
sign-in or preview readiness. It checks four viewports and a deliberately
stalled font-loading API.

| Condition | Held constant |
| --- | --- |
| App / candidate | Clean exact SHA above; fresh successful production build |
| Dependencies | Next 16.3.6, Playwright 1.63.0, Supabase CLI 2.118.0 |
| Runner | Windows 10.0.26200, Node v24.18.0 |
| Browser | WebKit revision 2359, version 26.6; iPhone 13 emulation |
| Server | `next start`, loopback port 3101; one owned hidden process |
| Fixtures | Same guarded local Supabase stack, fresh global setup per invocation |
| Retries / CI | Zero retries; CI unset; one worker |
| Diagnostics | Trace on; unique output directory and JSON report per invocation |

Only the browser transport/platform changed. Linux used the handover's pinned
official Playwright image digest and read-only package mounts, no workspace or
credentials, loopback port 3219, and `<loopback>` network exposure.

| Run | Start, Amsterdam | Result / total invocation duration |
| --- | --- | --- |
| Windows WebKit | 12:18:55 | 1 passed, no skips/retries; 20.50 seconds |
| Linux WebKit | 12:20:42 | 1 passed, no skips/retries; 24.89 seconds |

Trace summaries show successful sign-in clicks (Windows about 198 ms; Linux
about 1,636 ms), completed navigation actions and no failed assertions.
Browser-visible network responses were 200, except one Linux request recorded
without a response (`-1`). Backend-to-PostgREST requests are outside this
browser trace: these counts do not clear the backend of authentication errors.

One earlier anchored title filter selected zero tests. It ran no fixtures and
is retained as an invalid invocation, excluded from this comparison.

**Limit:** one passing pair cannot establish platform equivalence, rule out
intermittency or a full-suite sequence effect, or attribute the original
failures to the UI. No base comparison, broad suite or gate was run. A fix to
browser timing, timeouts, skips or assertions is unjustified by these results.

## PostgREST environment lead, bounded comparison

The Windows browser run's server log includes
`midweek current read failed PGRST303 JWT issued at future`. The failing read
site is `src/lib/midweek/load.ts`, reading `kut.midweek_current`; it returns
null on error, so this class of error can remove Midweek state from a page.
The log does not identify the precise token/request, so it cannot establish
that this caused any historical timeout. Early-closed stream errors also
occurred during passing runs and remain unattributed.

Docker inspection identified **PostgREST 14.5** and Auth **v2.196.0**. Installing
the locked CLI did not update these already-running service containers. Clock
sampling found the database and Auth in the same second, with host/database
offset under a second in that sample; this does not measure PostgREST's cached
validation clock.

PostgREST's upstream fix removed the cached time implementation and uses the
system clock directly. The release notes list the sporadic future-JWT fix in
14.18 and 16.3. This supports an environment hypothesis, not a diagnosis of
our browser failures. [Upstream fix](https://github.com/PostgREST/postgrest/pull/5208),
[release notes](https://github.com/PostgREST/postgrest/blob/main/CHANGELOG.md).

A separate PostgREST 14.18 sidecar copied the original local PostgREST settings
in memory, with credentials supplied through environment variable names, and
used the same Docker network/database. It listened only on host loopback port
3220. No existing service, schema, credential or configuration was replaced.
The official image digest was
`sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf`.

Eight fresh local Auth logins supplied the same token to both endpoints,
reading `midweek_current` with a zero-row limit. **All 16 responses were 200**;
no future-JWT rejection reproduced. Only numerical issue/host/database times,
HTTP status and error classification were saved. The probe's passing test
means it collected its samples; it is not a product regression certification.

**Proposed environment slice:** establish supported local-stack image versions
with the upstream clock fix, independently from fixture changes. Before
adopting that environment for a release gate, capture a rejected request on
14.5 and run the same token/request and unchanged browser case against the
fixed version. Existing shared services must not be replaced casually. Do not
add sleeps, authentication retries or clock-validation exceptions to hide the
symptom. This comparison did not prove that upgrading resolves it.

## Proven interruption defect and narrow fixture proposal

`global-setup.ts` and `global-teardown.ts` call `removeMidweekFixture`. That
function removes only the fixed-seed owner weeks. `endFixtureEvening` reverses
the next week's rotation during normal per-test cleanup, but teardown does
not invoke that recovery before removing the owner.

One diagnostic lifecycle seeded the fixture, completed its evening and let the
worker open its successor. It then called the current removal function inside
a transaction, simulating the interruption path without persisting the broken
cleanup. The result was:

- **One orphan successor tournament and 22 rotation rows remained.**
- **Zero fixture Players remained:** the owner had already been removed.
- Rolling back restored the recovery context; normal recovery removed the
  successor and restored the hash of non-fixture Player archetypes.
- Normal global teardown then left all four residue counts at zero.

The diagnostic passed in 2.31 seconds, with one lifecycle and no browser.
This proves the teardown defect, including its effect on non-fixture Players.
It does not prove that a durable recovery fix has been implemented.

**Proposed independent fixture slice:**

1. Retain an explicit run identity and durable journal of the owning fixed-seed
   weeks and successor UUIDs before destructive cleanup. Associate each record
   with the owner and validate the expected lifecycle/rotation records. A
   missing or incomplete ownership record must fail closed while preserving
   the owner and logs for inspection; a date comparison is not ownership.
2. Recover recorded successors before removing owning fixtures or auth users.
   Restore rotations and rebuild the active season, reverse exactly their
   rewards/ledger effects, then delete only recorded UUIDs. Perform database
   recovery atomically; a second call must change nothing.
3. Replace `endFixtureEvening`'s broad `week_start > owner_week` selectors with
   validated owned IDs. A one-line call to the existing helper from teardown
   would inherit that unsafe selection and is not a complete fix.
4. Regression checks must exercise interruption after the worker opens a
   successor, recovery twice, a crash during recovery, and an unrelated later
   week that survives untouched. Compare wallet/ledger effects and archetype
   state, and assert zero owned residue. Include the crash window between
   successor creation and journal persistence; absent evidence must preserve
   rows, not guess ownership.

The existing SQL CI timing flake remains a separate unproven hypothesis. No SQL
suite, migration or assertion was changed or rerun during this investigation.

## Concrete release-ordering proposal — awaiting review

**Recommended first cut:** disable Git-triggered deployment for `main`, retain
preview automation, merge under separately authorized review, then run the
full gate against the newly existing squash SHA and deliberately deploy only
after exact-SHA evidence passes. This prevents deployment creation as well as
early traffic assignment, preserving the existing invariant without inventing
a staging exemption.

Vercel supports branch-specific `git.deploymentEnabled`; the proposed setting
is `"git": { "deploymentEnabled": { "main": false } }`, merged into the
existing configuration with no matching allow-rule override. The setting and
its external activation require their own authorized change and read-back
test before another production merge. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

The reviewed operating sequence would be:

1. Establish and verify the production hold while the current site continues
   serving its existing deployment. Verify account/project access and the
   effective branch configuration. Vercel CLI access was not available here;
   actual Vercel permissions and plan capabilities remain unverified.
2. Merge with explicit authorization; immediately record the exact final SHA,
   CI states and deployment state. A merge is not permission to deploy.
3. In a clean checkout of that SHA, use locked dependencies and a production
   app built from that checkout. Record its SHA/build identity and own its
   server; prevent accidental reuse of an unrelated process on port 3101.
   The current runner defaults to development mode or reuses an existing
   server, so server provenance needs a separate reviewed tooling slice.
4. Run `request-production-gate.ps1` once after its prerequisites and diagnostic
   issues are resolved. Require all existing checks, catalogue parity, local
   database/browser evidence and a fresh independently verified backup.
5. Obtain the separate release approval, then a separate explicit deployment
   instruction. Immediately before deployment, run
   `assert-production-evidence.ps1` for the same SHA/gate/approval and recheck
   evidence freshness. Deploy from that clean candidate, not a moving branch.
6. Read back the resulting deployment's Git SHA and domain assignment; record
   the deployment and smoke-test result. If the candidate changes or evidence
   expires, stop and obtain valid evidence before deploying.

An alternative is Vercel's staged production-build promotion or imported
Deployment Checks. The former holds domain assignment and can promote without
rebuilding; the latter waits for selected checks but automatically aliases
when they pass and allows a force-promote bypass. Either needs explicit
authorization controls as well as gate evidence; importing the seven existing
CI checks alone would repeat the gap. Building a staged production deployment
before the gate would also need an explicit reviewed interpretation of the
deployment invariant. [Staged promotion](https://vercel.com/docs/deployments/promoting-a-deployment),
[Deployment Checks](https://vercel.com/docs/deployment-checks).

No Vercel/GitHub configuration, status, credential, hosted SQL, commit, push,
merge or deployment was mutated. The historical deployment remains ungated;
a future retrospective pass would not repair its ordering.

## Evidence, stopping condition and next decision

New private evidence is under
`work/release-soft-graphite/.release-evidence/diagnosis-20261004/`:
browser JSON reports and complete traces, sanitized `trace-summary.json`,
server logs, diagnostic source/configs, `fixture-probe-summary.json` and
`auth-probe-summary.json`. Raw authenticated traces stay local and must be
inspected/redacted before sharing; no tokens or private member data were added
to tracked documentation.

Owned app, browser and PostgREST helpers were stopped at closeout. The original
local Supabase services remain running. The retained backup pointer is dated
2026-10-04 01:23:55 UTC (less than 24 hours old at investigation time); its
ciphertext was not independently recovered in this session, so it establishes
no new backup or gate pass.

**Diagnosis checkpoint:** the fixture failure is proven and a narrowly scoped
recovery design is available for review. The browser/platform cause is blocked
on an actual failing controlled request/trace or evidence of a sequence effect;
the bounded reproduction produced passes. Another full suite would not resolve
that uncertainty efficiently, so none was launched. No durable fixture fix or
supported environment fix is claimed complete, and no full-gate pass exists.

To prevent another open-ended session: announce merged SHA and deployment
separately from gate status, collect diagnostics on the first failure, hold
test/fixture/server/retry conditions fixed, and stop at the diagnostic checkpoint
before authorizing a new independently reviewable slice.

The owner subsequently instructed implementation. The permanent local
fixture/release-control changes, verification and pending publication are in
[the implementation handover](match-report-permanent-fixes-2026-10-04.md).
This diagnosis remains the record of the bounded investigation above.
