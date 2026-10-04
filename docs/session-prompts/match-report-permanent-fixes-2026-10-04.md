# Permanent local release fixes — 4 October 2026

Current status: the owner merged both independently reviewed fixes (#187 and
#188). Main is `0d82bf1d2d2ee05747d457133803f79a7cef3ca2`, its required CI
passes, and its configuration holds automatic main deployment. After operator
sign-in, direct Vercel verification at 14:31:31 UTC confirmed the production
domain serves #187's `b99db188c6e0993552747c6f6d84a3779a480e71` and found no
deployments for #188's final main SHA. No full production gate certificate
or manual production deployment exists for that candidate. The ordinary
checkout is now clean, with original work preserved as recorded in the final
closeout section. The sections below retain the implementation/publication
timeline; earlier pending statuses are historical.

## Fixture recovery (ADR-122)

Local checkout: `work/fix-fixture-lifecycle`.

- [Ownership helper](../../tests/e2e-authenticated/fixture-ownership.ts)
  journals fixture roots and the worker's exact successor UUID in the worker's
  transaction, including an owner-side successor list that detects missing
  child records. It refuses non-loopback databases and ambiguous ownership.
- [Lifecycle helpers](../../tests/e2e-authenticated/midweek-fixture.ts)
  validate ownership before cleanup, unwind only owned rotations/payouts and
  delete exact owned weeks atomically. They preserve unrelated later weeks and
  restore the original enabled switch. Successful global teardown removes the
  private local instrumentation; interrupted recovery retains it.
- [Database regressions](../../tests/integration/fixture-lifecycle.test.ts)
  exercise process termination after worker commit, recovery through a new
  connection, repeated cleanup, unrelated later weeks, interrupted rollback,
  missing ownership and an originally enabled switch. A refused test preflight
  cannot tear down another runner's fixtures.

No production function, immutable migration, product API or Part L rule changed.
Legacy residue without this journal is preserved for reviewed recovery.

Validation: `verify:fast` passed (50 files / 475 unit tests), all five database
lifecycle tests passed, and the locked Next 16.3.6 production build passed.

## Release ordering and build evidence (ADR-123)

Local checkout: `work/fix-production-gate`.

- [Production runner](../../scripts/release/run-production-e2e.mjs)
  accepts one clean exact candidate, requires loopback and locked runtimes,
  provisions its recorded installed browsers, creates a fresh build and starts
  an owned production server. It refuses an occupied port and remote browser
  overrides. No test filters are accepted.
- [Release config](../../playwright.release.config.ts)
  keeps all member/admin assertions, three projects, one worker, zero retries,
  first-failure traces, no server reuse, no focused tests, one-failure stop and
  a 30-minute deadline. CI cannot switch server or retry modes.
- The report must match a fresh unfiltered inventory, including parameterized
  tests sharing a source line. Missing/filtered/flaky coverage and unexpected
  skips fail. The existing pack-summary case still runs once on narrow Chromium;
  only its two duplicate-device skips are allowed.
- Version-2 gate evidence binds a unique private runtime/build manifest and
  report/inventory hashes. Gate completion, approval and evidence assertion
  recheck backup/check freshness; altered or SHA-mismatched evidence is rejected.
  Obsolete gate records must be rerun. Logs redact known keys/passwords/JWTs;
  raw authenticated traces remain private, ignored artifacts.
- [Vercel config](../../vercel.json) prepares
  `git.deploymentEnabled.main = false`, with no overlapping allow rule.
  [Vercel documents this setting](https://vercel.com/docs/project-configuration/git-configuration).
  This has **not been published or activated**. Live automatic deployment
  remains an open ordering gap until separately authorized cutover is verified.

Validation: final `verify:fast` passed (51 files / 489 unit tests); fifteen
focused checks include eleven fictional PowerShell evidence scenarios.
PowerShell parsing and diff checks passed. The real config lists 132 tests
under `CI=true`, with zero retries. Its real inventory was also checked with
synthetic statuses (44 cases per project); that is not a browser-suite pass.

## Focused integration evidence and final local state

Two Windows WebKit cases passed against the new fixture helpers and copied
production config on the fresh locked app build: **after the final: the
champion, your ratings and the way to past weeks**, and **poster-only layout
and loading rows stay aligned**. Two passed, zero retries/flaky/failures/skips.
No broad browser suite or full gate was run.

Private report/logs:
`work/fix-fixture-lifecycle/.release-evidence/implementation-smoke-31db6ca59b18487883ce2bf095d8e398/`.
Earlier smoke-only loader errors (two Playwright installations, then ESM/default
interop) stopped before fixtures started; their logs were retained. The smoke
harness then used one installation and Playwright's TypeScript loader.

Final read-only local counts: zero active weeks, fixture Players, fixture auth
users, rotation rows and ownership schema; Midweek enabled is restored to
false. No listener remains on 3101. Original Supabase services remain running.
All 21 retained historical Windows Markdown contexts match their saved hashes.

The intermittent Windows WebKit/JWT cause and stochastic SQL timing failure
still lack a controlled failing reproduction. No PostgREST replacement,
assertion weakening or claimed environment cure is included. The runner records
actual runtime versions rather than inferring them from the Supabase CLI.

## Remaining publication/release work

On the owner's continuation, created two separate local commits:

- `fix/authenticated-fixture-recovery`:
  `b375ae0cdc01d18d99895c83bf87644266cc8dc9`.
- `fix/production-release-evidence`:
  `7895b597a6ba519fd6332b2fea14f4859c270e63`.

Both worktrees are clean. Reviewed both complete PR diffs against refreshed
`origin/main`, still `70de2f1c654db81967dc3c4f1df01170c7dde894`; no primary
dirty files or ignored evidence were included. Prepared PR descriptions in
each worktree's `.release-evidence/pr-body.md`.

Automatic approval review initially rejected the first push because trusted
user content did not explicitly authorize publishing to the remote destination.
The owner then explicitly instructed: "Yes, push and open the PRs". Both
branches were pushed to `VibeTrunk/kut`, and separate PRs opened against main:

- [Fixture recovery #187](https://github.com/VibeTrunk/kut/pull/187), head
  `b375ae0cdc01d18d99895c83bf87644266cc8dc9`.
- [Production release evidence #188](https://github.com/VibeTrunk/kut/pull/188),
  head `7895b597a6ba519fd6332b2fea14f4859c270e63`.

All seven required checks (`fast`, `e2e`, `database`, `migrations`, `security`,
`merge-gate`, `scan`) completed successfully on each exact head. Both PRs are
open with clean merge status. Automatic branch previews completed; neither PR
was merged and the main hold is not active. Merge and deployment remain
separate actions. Publish and verify the hold before relying on the new
final-squash-SHA release ordering. Keep the fixture and release-control changes
separately reviewable.

Once authorized changes produce their final commit SHA and successful CI,
run the full gate on that exact clean checkout, with current catalogue parity
and a fresh independently cold-verified backup. Release approval and deployment
are separate decisions; the gate never deploys. No new full-gate certificate
exists, and the historical Soft graphite deployment remains ungated.

## PR #188 conflict resolution after #187 merged

The owner merged fixture recovery #187 as
`b99db188c6e0993552747c6f6d84a3779a480e71` and requested resolution of #188.
Merged refreshed `origin/main` into `fix/production-release-evidence`, retaining
history. Only `docs/PROGRESS.md` and `docs/decisions.md` conflicted: both complete
additions were preserved, fixture recovery first and release evidence second.
Verified all 20 release files retain their intended content and fixture code
matches merged main. No application or release behavior changed in the resolution.

`npm run verify:fast` passed on the combined tree (52 files / 490 unit tests),
including policy parity, formatting, lint and typecheck. Pushed merge commit
`b689aaaadbf16c718de5e368e354713e3dfe41a5` and updated #188's validation record.
GitHub now reports #188 as mergeable with clean merge status; all seven required
checks passed on the exact new head. PR #188 remains open. The deployment hold
still requires its separately
authorized merge/cutover and integration verification; no manual deployment
or full production gate occurred.

## Post-merge audit of #188

The owner merged #188 as `0d82bf1d2d2ee05747d457133803f79a7cef3ca2`
at 2026-10-04 13:18:47 UTC. All seven required checks passed on that final
main SHA. The merged Vercel configuration contains only the `main: false`
deployment rule. GitHub has no deployment record or Vercel commit status for
this SHA at the audit; the latest successful Production deployment remains
fixture recovery #187's `b99db188c6e0993552747c6f6d84a3779a480e71`.
This is observed behavior consistent with the hold, not an authenticated audit
of all Vercel account controls.

No full gate manifest for the final merged SHA exists in the primary or three
owned release/fix worktrees. Before any manual production deployment, run the
full version-2 gate on a clean checkout of that exact SHA, including current
catalogue parity and fresh independent cold verification of an eligible backup;
then obtain separate release approval and deployment instruction. The historical
WebKit/JWT and stochastic SQL timing causes remain unresolved. Primary dirty
work and local handover/evidence files remain uncommitted and preserved.

## Workspace and verification closeout

On the owner's follow-up, reconciled the ordinary VS Code checkout onto merged
main. The 24 pending files comprised nine tracked edits, three new handovers,
and twelve generated previews/patches. Three independently tracked nested
worktrees were also visible to the parent repository. The report source and
its spec/decision edits were already on main; the KB-037 monitoring notes and
eight unique progress sections had not been published.

All 24 originals have a hash-verified private snapshot under
`.release-evidence/workspace-reconciliation/`; the pointer is
`.release-evidence/latest-workspace-reconciliation.json`. The twelve source/doc
files are also preserved in Git stash `6e336b6f85c3e80b648bece98beac01de2d0cb37`.
Generated files are archived there, and the three clean worktrees are locally
excluded only from their parent's status. Their own Git tracking is unchanged.
The primary checkout is clean on main. Unpublished notes and the read-only
Vercel verification helper are prepared separately in
`.release-evidence/worktrees/vercel-closeout`, branch
`fix/vercel-verification-closeout`; source links here now reference tracked files.

The new direct checker and preserved documentation passed `verify:fast`
(53 files / 498 unit tests, formatting, lint, typecheck, policy parity).
The logged-out preflight returned `unverified/authentication_required`
without exposing credentials or making a deployment claim. The owner then
completed official CLI sign-in. The authenticated audit at 14:31:31 UTC confirmed
the ready production domain binding to deployment `dpl_ALTcwQAUR2hpMDmNewfbYZup13u3`
and #187's exact SHA, with no candidate deployments for merged #188. Both metadata
lookups were complete and the domain binding was unchanged on re-read.
Sanitized evidence is saved in the primary checkout at
`.release-evidence/vercel/0d82bf1d2d2ee05747d457133803f79a7cef3ca2/2026-10-04T14-31-31.604Z.json`.
No deployment, credential replacement or settings mutation was performed.
