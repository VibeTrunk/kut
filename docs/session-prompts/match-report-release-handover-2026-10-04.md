# Soft graphite release and gate investigation handover — 4 October 2026

**Status:** the approved match-report change is merged and live. Required GitHub checks passed, but the full local production release gate did **not** pass. Vercel automatically deployed the squash commit before that gate completed. The long session became a broad WebKit/test-environment investigation after the release had already happened. Do not reimplement or redeploy the UI to resolve this handover.

This record distinguishes observed results from hypotheses. It is a troubleshooting handover, not a passing release certificate. Local evidence paths below must be preserved; several are ignored and will not travel with a Git checkout.

## Prompt for the fresh session

> Read `AGENTS.md`, `CLAUDE.md`, the mandatory project documents, and `docs/session-prompts/match-report-release-handover-2026-10-04.md`. The Soft graphite change in PR #186 is already live at SHA `70de2f1c654db81967dc3c4f1df01170c7dde894`, but its full release gate never passed. Investigate why the previous session took so long, identify the WebKit/environment or fixture failure with a bounded, controlled reproduction, and propose or implement a narrowly justified local fix. Preserve all existing dirty work and retained evidence. Give a status checkpoint within 10 minutes and a diagnosis or explicit blocker within 30 minutes. Do not repeat full suites without new evidence. Address the exact-SHA gate versus automatic deployment gap with a concrete proposal; external configuration changes, new commits/pushes/merges/deployments, credentials and hosted SQL need their own per-change authorization. Do not weaken gates or claim the past deployment had predeployment approval. Explain what is proven, what remains uncertain, and how to prevent a repeat.

For implementation, follow the current canonical guidance, including BUILD_SPEC Part L, the production safety runbook and local Next.js documentation. This prompt authorizes investigation and reversible local work; the previous deploy instruction was for the already delivered UI slice.

## What the owner requested and what shipped

The owner requested four visual options before changing the screenshot's circled elements. The initial comparison artifact showed only one option conveniently; it was corrected to a standalone HTML selector and a four-panel PNG. The owner chose **Soft graphite**, requested implementation, then explicitly requested deployment, opening and merging the PR.

The implemented scope was:

- Neutral player names within Why squad rows; team headings retain their colors.
- One gray fill for individual power bars; their lengths and reference ticks remain meaningful.
- One graphite treatment for Save, Block, Woodwork and Wide; **Goal remains gold**.
- Existing commentary names, scoreboard, odds split, strength number badges and expanded factors keep their approved colors. Duplicate names retain screen-reader owner labels.

Six files changed, 72 insertions and 25 deletions:

| File | Change |
| --- | --- |
| `src/app/globals.css` | Report tokens: ink `#d0d0cb`, bar `#9c9c99`, tag `#30302e`. |
| `src/components/midweek/why-list.tsx` | Neutral row names and bars; legend distinguishes bar length from badge colors. |
| `src/components/midweek/report.tsx` | Shared neutral non-goal tags, retained brass Goal. |
| `docs/BUILD_SPEC.md` | §44.10 presentation scope. |
| `docs/decisions.md` | Refinement of ADR-111/119. |
| `docs/PROGRESS.md` | Implementation record. |

No migration, dependency-lock change, game/economy rule or privacy behavior changed. The shared components cover live and completed reports.

## Release identity and timeline

| Item | Verified value |
| --- | --- |
| PR | [VibeTrunk/kut #186](https://github.com/VibeTrunk/kut/pull/186) |
| Base | `1e0b712beb046093109f76eaa5039b68f57c7d97` |
| PR head | `214d17c1dff0c1c370f3e02d9f120a38cbc0e5c9` |
| Squash/main candidate | `70de2f1c654db81967dc3c4f1df01170c7dde894` |
| Production deployment | GitHub deployment `6838989819`, success |
| Deployment URL | <https://kut-lw9yqeh77-vibetrunk.vercel.app> |
| Public site | <https://kut.vibetrunk.com> |
| Preview | Deployment `6838838033`, <https://kut-n73zvc9pp-vibetrunk.vercel.app> |
| PR verification workflow | Run `37189691023`, initially failed database job, unchanged rerun passed |
| Secret scan workflow | Run `37189691084`, passed |

Times below are **Europe/Amsterdam (UTC+2)** on 4 October. Test runs without retained timestamps are listed in order rather than assigned invented times.

1. Implemented and visually checked the approved UI. `verify:fast` passed. Created an isolated checkout, committed, pushed and opened PR #186 under the owner's instruction.
2. PR database CI failed in an existing timing fixture. Eight unchanged local runs passed; the unchanged CI rerun passed. No assertion or SQL was weakened.
3. Started the full local production gate. Encountered a shared-dependency junction/build problem, then Windows WebKit failures. Installed locked dependencies and continued debugging.
4. **10:58:09:** the owner personally merged the PR, as confirmed in their subsequent clarification. GitHub records the squash merge under account **MartinFloris**. The agent did not issue the merge command.
5. **10:58:45:** Vercel automatic production deployment succeeded. No manual production deployment was issued by the agent.
6. **About 11:08:32:** the agent discovered the merge/deployment while checking main. The PR and main trees were byte-identical; switched the clean isolated checkout to the exact squash SHA for further checks.
7. Continued production-server and development-server authenticated suites, then tried Linux-hosted browsers. The two selected Linux WebKit tests passed, but no full Linux-browser gate ran.
8. Owner challenged the elapsed time. Reported that the UI was already live, acknowledged that troubleshooting had expanded too far, updated the PR evidence and stopped owned helpers.
9. Owner requested this handover. No additional suite or deployment was run to prepare it.

All seven external contexts were successful on the PR and main: fast, e2e, database, migrations, security, merge-gate and scan. GitHub CI success is distinct from the full local authenticated release gate. Read-only public `/login` checks returned HTTP 200 and served the three approved CSS values/classes; this is availability and asset evidence, not authenticated hosted-layout verification.

## Test evidence: preserve the conditions

The exact-main attempts used candidate `70de2f1c654db81967dc3c4f1df01170c7dde894`. Earlier attempts used the PR head. Expected skips below do not establish completion of the production gate; no passing gate manifest was emitted.

| Attempt | Conditions and result | Interpretation |
| --- | --- | --- |
| Presentation/fast checks | Actual React/Tailwind in Chromium at 320, 736, 1280 px; no overflow, correct colors, bar widths and owner labels. 49 unit files / 474 tests passed. | Approved UI verified within this scope. |
| Initial full gate | Windows, shared dependencies, Next 16.3.5, webpack production build: 129 passed, 1 failed, 2 skipped. `share-regression.spec.ts:297` timed out at 90 s, expected two `#share img`, received zero. | Browser/server/fixture cause unresolved. A separate retry stalled in navigation with “Loading KUT”. |
| Locked dependencies | `npm ci`; Next 16.3.6 normal production build passed. Same standalone share-layout WebKit test passed in 51.5 s. | Environment difference matters; one pass is insufficient to identify cause. |
| Interrupted gate | Branch run cancelled after discovering merge. First exact-main setup then failed because an interrupted fixture left an open next week. | Fixture crash cleanup defect; see below. |
| Exact-main production server | Windows: **128 passed, 2 failed, 2 expected skips**, about 8.5 min. Both failed at Sign in click waiting for visible/enabled/stable: `mobile.spec.ts:389` and `share-regression.spec.ts:397`. Share layout at :297 passed in 30.5 s. | Failures occurred before the layout assertions. No proven Soft graphite regression. |
| Invalid CI-mode attempt | Setting `CI=true` enabled retry and started the managed dev server. Missing `SUPABASE_SERVICE_ROLE_KEY` alias caused invite-onboarding errors; cancelled. | Agent configuration mistake. Exclude this run from root-cause comparisons. |
| Corrected CI-mode dev server | Windows: **118 passed, 3 flaky, 9 failed, 2 expected skips**, about **21.4 min**, including configured retry. All final failures were WebKit. | Changing CI mode also changed server mode; this was not a controlled browser comparison. |
| Linux browser experiment | Same locked production app, Windows runner, Playwright 1.63.0 browser server in official Linux image, no CI flag/retries. Bracket/report test passed 16.0 s; share-layout test passed 51.8 s. **2 passed, 1.3 min.** | Promising transport/platform lead. **No full gate pass and no proven Windows root cause.** |

The corrected development-server failures covered:

- `mobile.spec.ts:408`: Bracket click left URL at `/midweek`, rather than completed-week URL, through retry.
- `mobile.spec.ts:868`: calls scenario sign-in/navigation timeout.
- `mobile.spec.ts:1063`: desktop Download preview image missing.
- `share-regression.spec.ts:154`, :415: expected Retry UI missing.
- `share-regression.spec.ts:297`, :397: share/poster images missing.
- Two :507 cases: navigation/cleanup after rendering and during decode.

Retry passed three other cases: past weeks sign-in (:547), invalid URL heading (:561), between-rounds heading (:642). Line numbers are historical at the candidate; locate by test title after subsequent edits.

Logs included intermittent `PGRST303` / “JWT issued at future” and early-closed destination streams. Their relationship to failures is unproven. Do not suppress them or call them harmless without tracing the failing request. Equally, do not declare the Windows failures pre-existing without a controlled base comparison.

### Separate database CI flake

`supabase/tests/database/midweek_evening_timing.test.sql` produced NULL for a `bool_and` assertion over non-chance/shootout/draw events (assertion 22 of 42). Eight unchanged local runs and the unchanged CI rerun passed. Initial job `111399125754`; successful rerun `111400159687`.

A hypothesis is that `_mm_open_next` randomly rotates unclaimed archetypes (ADR-110), changing the six unlinked fixture players before later fixed-seed matches, leaving the tested event set empty. This was not reproduced or proven. Investigate separately. If the test expects events, construct deterministic nonempty coverage and assert event presence; replacing NULL with unconditional success would hide the problem. Existing migration files remain immutable.

## Workspace and evidence inventory

The primary checkout is intentionally dirty. At handover:

- Branch `docs/special-tier-release-record`, HEAD `443787bc66ecda14735ba8a18218b57763cf5742`.
- Existing changes: `docs/BUG_FIX_PLAN.md`, `docs/KNOWN_BUGS.md`, `docs/BUILD_SPEC.md`, `docs/PROGRESS.md`, `docs/decisions.md`, the three report source files and untracked `work/`.
- KB-037 monitoring documentation predates this UI task. The approved UI edits remain dirty against the older local branch even though their independent PR is merged. Preserve both. Do not blanket reset, stash, clean or discard.
- Clean release checkout: `work/release-soft-graphite`, detached at the exact main candidate above. Its tracked tree was clean when inspected before this handover.
- Other registered worktrees exist outside this directory; do not touch them.

Local artifacts, relative to the repository root:

| Path | Contents / limitation |
| --- | --- |
| `work/match-report-comparison.html` | Standalone four-option selector. |
| `work/match-report-four-options.png` | Four-panel comparison. |
| `work/match-report-implemented-320.png`, `work/match-report-implemented-1280.png` | Approved implementation render evidence. |
| `work/release-soft-graphite/.release-evidence/prs/soft-graphite.md` | PR description updated with release and test outcomes. |
| `work/release-soft-graphite/.release-evidence/windows-webkit-failures/` | 21 retained Markdown error contexts from the later Windows run. Keep local; inspect for member information before sharing. |
| `work/release-soft-graphite/test-results/` | Most recently overwritten by the passing targeted Linux experiment; not the original failure archive. |
| `work/release-soft-graphite/.release-evidence/dependencies/node_modules-shared` | Moved junction pointing to original dependencies, not a second copied install. Never recursively delete its target. |
| `work/release-soft-graphite/.private-backups/latest-backup-evidence.json` | Local pointer to previous encrypted backup evidence; verify freshness independently. |

Only failure Markdown contexts were copied before the later run; do not claim complete trace/video/raw-log preservation. Earlier failures may have been overwritten. Hosted CI logs and the conversation supplement the retained evidence. No passing gate manifest exists for either the PR head or the squash SHA.

The original checkout's installed Next was 16.3.5 and Supabase CLI 2.117.0; the lockfile selected Next 16.3.6 and CLI 2.118.0. Playwright was 1.63.0. The isolated checkout initially shared `node_modules` via junction, which failed Turbopack's filesystem-root check. It subsequently received its own lockfile install and built successfully. No dependency manifests changed. Inspect actual versions again before reproduction.

Owned app server on port 3101 and browser-server container on port 3219 were stopped. Handover preparation found no listeners on those ports or remaining named helper container. Docker image cache remains; unrelated services and local Supabase were not stopped.

## Interrupted fixture cleanup

The authenticated suite mutates **local** database/auth fixtures. Never point it at hosted data or set `KUT_ALLOW_NONLOCAL_TEST_TARGET` to evade its guard.

`global-setup.ts` recreates test users and fixtures; `global-teardown.ts` removes them. `midweek-fixture.ts` uses deterministic fixed-seed weeks (archived 2001-01-15 and then-current 2026-10-05) and fixture IDs prefixed `00000097-`. A worker can open a randomly seeded next week. `removeMidweekFixture` removes fixed-seed weeks; `endFixtureEvening` reverses rewards/rotations and cleans the next week while the owning fixture still exists.

An interrupted run removed the fixed fixture before undoing its next-week side effects. This left an open 2026-10-12 week and 22 rotation logs, blocking the next setup. The agent performed a narrowly guarded local repair: restored each affected archetype from its logged prior value, rebuilt the active season and deleted only identified week `ed81aa84-ff34-404c-8a5d-7ac0c9ed01e1`, validating ID/date/status and zero remaining rows. **That historical week is already deleted; do not repeat the historical repair.**

A durable fix should establish ownership and idempotent interruption recovery, undoing rotations before removing the owning fixture. Prove it with an intentionally interrupted local fixture lifecycle. Do not broadly delete open weeks or reset the database. The last targeted run completed normal teardown; inspect current residue rather than assuming it is empty.

## Why the process took too long

The agent completed the visible change, then let full-app release validation become an open-ended investigation. Specific mistakes:

1. Did not identify the squash-SHA/automatic-production-deployment conflict early enough.
2. Did not promptly detect and communicate the owner's merge and live deployment; subsequent work was postdeployment gate diagnosis, not “pushing a PR”.
3. Repeated long suites while changing dependencies, production/dev server mode, retries and browser transport, obscuring causal comparisons.
4. Started one managed-server attempt without the app's required local service-role alias.
5. Cancelled a fixture-mutating run without completing its owned lifecycle cleanup before the next setup.
6. Preserved diagnostics too late; retained contexts are incomplete.
7. Continued beyond a reasonable troubleshooting checkpoint without a bounded decision and clear status.

The agent acknowledged this to the owner. No merge command, manual production deployment, hosted SQL, secret mutation, Vercel configuration or branch-protection change was performed by the agent. Vercel CLI 59.23.2 was installed but unauthenticated; browser inventory supplied no usable Vercel session. A login request was later withdrawn because the automatic deployment had already occurred. No automatic approval rejection caused the delay.

## Bounded resolution plan

### First 10 minutes: establish the current state

Read the canonical guidance, inspect git/worktree status without discarding changes, confirm the existing PR/deployment read-only, inventory retained diagnostics and check local fixture residue. Choose a clean owned checkout. Report: UI live or changed since handover; gate evidence present or absent; exact candidate being investigated; one selected failure and reproduction conditions.

### By 30 minutes: isolate one failure

Use the locked dependencies and production build, matching the successful Linux experiment. Pick one reproducible WebKit failure. Capture sanitized trace/console/network diagnostics immediately, including sign-in state, navigation, missing images and any JWT clock discrepancy. Record OS, browser build, Node, Next, Playwright, server mode, retries and DB fixture state.

Compare Windows and Linux browsers while keeping the runner, production app, test, fixture and retry setting constant. Compare the base commit only if needed to establish regression. Run a single focused case, then a justified repeat/paired control; stop if it does not reproduce and state the uncertainty. Do not start another broad suite to manufacture a signal. Report a supported diagnosis, the next discriminating check or the concrete blocker at the timebox.

Changing `CI=true` alters both Playwright retry behavior and server reuse, so it cannot be treated as only “one extra retry”. Check `playwright.authenticated.config.ts` before running. Run only one fixture-mutating suite at a time.

### Once there is a supported fix or stable environment

Implement the smallest justified slice and an appropriate regression check. Keep browser/environment, fixture lifecycle and stochastic SQL-test fixes independently reviewable. Run focused verification first. Run the full exact-candidate production gate **once** when the cause/environment and prerequisites are resolved. Another failed gate requires new diagnostic evidence before another full run.

For a changed candidate, obtain per-change commit/push authorization and use its final exact 40-character SHA. A gate for another SHA, stale backup or successful targeted test cannot substitute. A historical postdeployment pass would validate the deployed tree retrospectively, not repair its missing predeployment ordering.

## Release ordering gap requiring a concrete proposal

Observed repository configuration allowed only squash merges; branch protection required `merge-gate` and `scan`, strict mode false, zero required reviews. Vercel automatically deployed main on merge. These are observations at the incident, not instructions to change settings.

The final squash SHA does not exist as main until merge, yet auto-deployment begins immediately. Consequently, the current process does not provide a reliable interval to run the full exact-final-SHA gate before production deployment. The owner merged while the local gate was still running. Their clarification establishes merge attribution; the ordering gap and incomplete gate evidence remain unresolved.

Design a reviewed process that stages the final candidate and promotes/deploys only after all exact-SHA evidence succeeds. Investigate supported Vercel/GitHub controls and account permissions. Possible designs include an explicitly paused automatic production path with deliberate post-gate deployment, or a durable staged promotion/check pipeline. These are alternatives to investigate, not approved configuration changes. Do not remove exact-SHA requirements or weaken security checks to fit the present automation. The gate script does not deploy; release approval does not authorize deployment or settings mutations.

Relevant sources/runbooks:

- [Production safety](../PRODUCTION_SAFETY.md), [operations](../OPERATIONS.md), [backup](../BACKUP.md), [production release prompt](production-release.md).
- `scripts/release/request-production-gate.ps1`, `approve-production-release.ps1`, `assert-production-evidence.ps1`.
- [Playwright Docker](https://playwright.dev/docs/docker), [browser network exposure](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-option-expose-network).
- [Vercel deployment promotion](https://vercel.com/docs/deployments/promoting-a-deployment), [deployment checks](https://vercel.com/docs/deployment-checks). Verify current capabilities before choosing a design.

The gate requires a clean tree at the named SHA, seven successful same-SHA external checks within 72 hours, central migration catalogue parity, a cold-verified backup younger than 24 hours and local DB/browser prerequisites. It emits passing JSON only after the whole suite succeeds. The prior backup evidence was created at 2026-10-04 01:23:55 UTC; it may be expired in a fresh session. Retrieve credentials only through the authorized stable DPAPI locators. Do not print credentials, environment dumps, member data or raw authenticated traces in committed logs.

## Reproduction reference: Linux browser experiment

The official image used Playwright 1.63.0 with digest:

`mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`

It ran `node /pw/node_modules/playwright/cli.js run-server --port 3219 --host 0.0.0.0`, with only the host `playwright` and `playwright-core` package directories mounted read-only under `/pw/node_modules/`, user `pwuser`, working directory `/home/pwuser`, `--init --ipc=host --rm`, and host binding **`127.0.0.1:3219:3219`**. No workspace or credentials were mounted. Container name was `kut-soft-graphite-browsers-70de2f1`.

The host runner used:

```powershell
$env:PW_TEST_CONNECT_WS_ENDPOINT = 'ws://127.0.0.1:3219/'
$env:PW_TEST_CONNECT_EXPOSE_NETWORK = '<loopback>'
npx playwright test --config playwright.authenticated.config.ts --project authenticated-webkit --grep 'completed week.*bracket and a match report|share rows and rating links align'
```

This relied on an already running production server on 3101 and correctly configured **local** Supabase aliases, including `SUPABASE_SERVICE_ROLE_KEY`. Installed Playwright supports both connection environment variables. Confirm current package/image versions match before reuse. The invocation creates local fixtures; perform the local-target checks first. Stop only owned helpers and clear task-specific connection variables afterward.

## Completion and prevention criteria

- Root cause is supported by controlled evidence, or remaining uncertainty/blocker is explicitly recorded. Two selected Linux passes alone are insufficient.
- Any fixture recovery is narrowly owned, idempotent and tested across interruption; no unexplained local residue remains.
- The SQL timing flake has separate deterministic evidence before being declared fixed.
- Full gate evidence names the exact candidate, with fresh cold-recovery backup and all required checks. No invented or reused pass manifest.
- A concrete release-ordering design is reviewed; external changes occur only with explicit authorization. Existing invariants remain intact.
- Future updates state separately: PR opened, CI results, merged SHA, deployment status and pending full-gate validation. Detect merge/deploy promptly. Give troubleshooting checkpoints at least every 10 minutes, with concise progress during active work.
- Keep the UI delivery and subsequent infrastructure fixes separate. After a failed full suite, capture evidence and diagnose a focused case before repeating it. Set a 30-minute diagnosis checkpoint rather than continuing silently for an hour.
- Preserve the primary checkout and ignored local evidence. Record final results and limitations in the PR/docs; do not call the historical deployment gated when it was not.

## Fresh-session follow-up — 4 October 2026

The bounded investigation is recorded in
[match-report-release-diagnosis-2026-10-04.md](match-report-release-diagnosis-2026-10-04.md).
The selected unchanged poster case passed in a controlled Windows/Linux
WebKit pair. An interrupted-cleanup probe proved that removing the owner
leaves one successor week and 22 rotation rows; rollback and normal recovery
restored non-fixture archetypes and left zero fixture residue. PostgREST 14.5
is a concrete environment lead, but eight fresh tokens passed on both 14.5
and a separate 14.18 sidecar, so no browser/environment fix is proven.

The follow-up proposes separate fixture-ownership, environment and release
ordering slices. It recommends holding main's automatic deployment before
merging, running the gate on the final SHA, and deploying only under a separate
instruction after its evidence passes. No full suite/gate, tracked source change,
commit, push, merge, hosted SQL or external configuration change occurred.
All owned helpers were stopped; old evidence and dirty work were retained.
