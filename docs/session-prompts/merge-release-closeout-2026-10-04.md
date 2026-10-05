# Merge-approved release closeout — 4 October 2026

**Historical handover, superseded after #190:** this slice is merged and was
included in #195's gated release. The paste-in publication authorization and
starting state below are historical, not permission for a new change. Current
shared authority is `CLAUDE.md` and `PRODUCTION_SAFETY.md`: documentation-only
merges need no gate/deployment unless requested, full main CI remains required,
and any release gate runs only in the ordinary, non-linked checkout with real
`node_modules`. Preserve the worktree and evidence; do not replay this prompt.

This handover supersedes the **current-status and action instructions** in
`match-report-release-handover-2026-10-04.md`. That older document remains useful
historical evidence; its dirty-workspace and missing-current-gate statements are
no longer current. Do not reimplement the match report or redeploy an old SHA.

## Paste into a fresh session

Read `AGENTS.md`, `CLAUDE.md` and the required project documents, then read
`.release-evidence/worktrees/vercel-closeout/docs/session-prompts/merge-release-closeout-2026-10-04.md`
from the ordinary KUT checkout. Resume the existing `fix/merge-release-followup`
branch in `.release-evidence/worktrees/vercel-closeout`; preserve its uncommitted
work and all private evidence. Close out the prepared Vercel checker fix,
merge-approval guidance and release records. Review the complete diff, correct
anything needed, run appropriate checks, then commit, push and open its PR. This
prompt authorizes publication of that follow-up slice; I will merge the PR myself.

My instruction is: **my merge into main is release and Vercel deployment approval
for the exact resulting SHA. Run the full gate yourself automatically, record
approval after it passes, assert the evidence, deploy and verify the production
domain without asking me for another release/deployment confirmation.** Keep the
Git main deployment hold enabled so deployment follows the gate. Failed or stale
evidence stops deployment. Do not apply hosted migrations, deploy Supabase
functions, change secrets or branch protection under this authorization.

The currently released SHA `13bf6ad5e821532debe5c4237df75bcc54cc5b57`
already passed its full gate and was deployed. Verify current remote/main and
live state before acting; do not rerun its full suite merely for this handover.
After publishing the follow-up, keep the primary checkout clean and report the
PR, exact checks and remaining operator action. Do not merge the PR for me.
When I report it merged, run a new exact-merged-SHA gate and deployment using
the approval rule above; old evidence cannot certify a new commit.

Also assess the remaining intermittent WebKit timeout and historical SQL timing
failure using retained evidence. Keep this separate from the publication slice.
Use a bounded, controlled reproduction only if it can distinguish a concrete
hypothesis. Give a checkpoint within 10 minutes and a diagnosis or explicit
blocker within 30 minutes of starting that investigation. Do not repeat full
suites without new evidence, weaken assertions/timeouts/skip rules, or claim
the root cause is fixed because an unchanged rerun passed. Prepare any justified
new fix separately and report its scope before publication. KB-037 is monitoring
only at my request; do not resume active phone-share investigation unless it recurs.

## Verified starting state

- Ordinary checkout: clean `main` at
  `13bf6ad5e821532debe5c4237df75bcc54cc5b57`, owner-merged PR #189.
- Existing review checkout: `.release-evidence/worktrees/vercel-closeout`,
  branch `fix/merge-release-followup`, same base SHA. Before this handover it
  contained nine modified files, uncommitted and unpublished. This handover is
  the tenth review file. No new follow-up commit, push or PR has occurred.
- The owner personally merged #189 as GitHub account `MartinFloris`.
  PRs #187, #188 and #189 are already merged.
- Production deployment `dpl_cm1RXc4wcfUCNe7MkSHBBKRHfYPq`, URL
  `https://kut-im2j7x7kr-vibetrunk.vercel.app`, created 15:29:03 UTC
  (17:29 Amsterdam), ready at 15:29:57 UTC on 4 October.
- Corrected read-only checker at 15:44:32 UTC returned `candidate_live` for
  `kut.vibetrunk.com`, exact SHA above, ready production target and a complete
  candidate lookup. Public root/login returned HTTP 200 after deployment.
- Full version-2 gate passed at 15:26:19 UTC **before** deployment: all seven
  exact-SHA GitHub contexts, catalogue parity, cold backup verification and
  130 authenticated mobile passes with only the two approved duplicate
  pack-device skips. Zero retries, flaky results or runner errors in that run.
- At 15:46:33 UTC, a read-only local check found zero active weeks, fixture
  players/users, rotations or ownership schema; the original disabled setting
  was restored. The owned production test server on port 3101 is stopped.
- `verify:fast` passed in the follow-up checkout: 53 unit files / 505 tests,
  lint, typecheck, formatting and generated policy parity. After the final
  documentation additions, policy/format/diff checks also passed; recheck the
  complete final publication diff as appropriate.

## Prepared follow-up

1. `scripts/release/vercel-deployment-contract.mjs`: actual official CLI list
   rows can contain a deployment hostname but no ID. Resolve a validated
   `*.vercel.app` hostname through authenticated `/v13/deployments/<hostname>`,
   verify resolved project, commit and target against the listed row, deduplicate
   by actual ID and re-read the production binding. Do not fetch arbitrary URLs
   or use hostname recovery to bypass conflicting nonempty IDs.
2. `tests/unit/vercel-deployment.test.ts`: 15 regressions, including the actual
   URL-only shape, unsafe/missing hostnames, project/SHA/target mismatch and
   conflicting listed identities. The corrected helper passed against real
   production; the helper on merged main still lacks this fix.
3. `policy/PRODUCTION_INVARIANTS.md`, generated `AGENTS.md`/`CLAUDE.md`,
   `docs/PRODUCTION_SAFETY.md`, ADR-124 in `docs/decisions.md`: persist the owner's
   merge-as-approval rule. Run `npm run policy:sync` after source policy changes;
   do not manually edit generated invariant copies. The existing gate and
   approval artifacts still do not themselves grant deployment authority.
4. `docs/DEPLOYMENTS.md` and `docs/PROGRESS.md`: record the actual gated release,
   failed evidence, current checker correction and clean fixture closeout.

No migration, lockfile, application UI, economy invariant or production SQL
changed in this follow-up. Old ADR/status entries are historical; ADR-124
supersedes the extra Vercel deployment-confirmation requirement.

## Private evidence to preserve

Paths below are relative to the **ordinary checkout**, not the review worktree:

- `.release-evidence/latest-workspace-reconciliation.json`: current pointer to
  archive, original stash, review worktree, deployed SHA and evidence.
- `.release-evidence/owner-release-instructions.md`: owner's exact instruction.
- `.release-evidence/gates/13bf6ad5e821532debe5c4237df75bcc54cc5b57/gate-20261004-172619.json`
  and adjacent `.approval.json`: passing gate and release approval.
- `.release-evidence/deployments/13bf6ad5e821532debe5c4237df75bcc54cc5b57/ddc37202-0fd9-442c-bd68-03e078f31e98/`:
  authorization, request/result, ready, `production-domain.json` and
  `fixture-cleanup.json` records.
- Passing authenticated run:
  `.release-evidence/authenticated/13bf6ad5e821532debe5c4237df75bcc54cc5b57/9ece0101-0806-4c54-b8e6-36bc3a33e98c/`.
- Failed authenticated run:
  `.release-evidence/authenticated/13bf6ad5e821532debe5c4237df75bcc54cc5b57/e7a78256-5496-43ef-a160-1deb95cfdc00/`.
- Unchanged focused WebKit pass:
  `.release-evidence/diagnosis/13bf6ad5e821532debe5c4237df75bcc54cc5b57/2ab734bd-0fea-41f6-97ee-92683862d1d1/`.
- Original 24-file verified archive:
  `.release-evidence/workspace-reconciliation/2026-10-04T13-56-38.186Z-f54a9173-4047-42f0-b668-d1f65542c216/`;
  named stash OID `6e336b6f85c3e80b648bece98beac01de2d0cb37`.
  Do not drop it, delete the archive or disturb unrelated worktrees.

Private authenticated traces/reports may contain member data. Do not upload
raw artifacts or output credentials. Gate backup evidence is time-limited:
`kut-backup-20261004-032324.sql.enc` was valid for the released candidate, not
a promise of freshness in a later session. Credentials use the canonical DPAPI
locators; `.env.local` is not a runtime fallback. Hosted migrations originate
only from `VibeTrunk/supabase` and remain separately authorized.

## Remaining diagnostic uncertainty

The first full run on current released SHA had 125 passes, two permitted skips,
one 90-second WebKit timeout in the repeated completed-share geometry case and
four cases not run. The trace showed 534 HTTP 200 responses, repeated successful
assertions and progressively slow navigation, ending during the twelfth of
sixteen navigations. The unchanged focused case and a fresh full run passed.
This supports intermittency, not a proven cause or permanent performance fix.

Historical `PGRST303` / JWT clock failures and the database timing NULL assertion
are documented in the original handover. They were not reproduced or proven
causes of this release's timeout. Do not conflate them, retry the already-complete
historical residue repair, or broadly reset/delete local weeks. Any reproduction
must use guarded loopback fixtures and complete their owned cleanup.
