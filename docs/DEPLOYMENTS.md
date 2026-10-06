# Hosted deployment log

Every gated Vercel release and migration applied to the hosted `kut` schema,
plus documentation-only production-lag records, **newest first**: what it
changed, its risk tier, the backup it rode, the `migration list --linked`
counts before and after, the hosted smoke test, and how to roll it back.

Hosted migrations are catalogued and pushed only from
[`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase); the process is
the risk-tiered checklist in `OPERATIONS.md`. This file is KUT's record of what
landed and how it was checked. `CLAUDE.md` names only the latest applied
migration and links here.

Deploys before 2026-08-30 (the 2026-08-17 alpha, the roster and formula
updates, the admin roster RPCs, the ADR-027..030 batch) are recorded in the
dated "Hosted deployment…" entries in `PROGRESS.md`.

**Adding an entry:** put it at the top as `## <date> — <migration> <what> (ADR)`,
then bump the "Latest hosted migration" line in `CLAUDE.md`. Record the tier,
backup id, pre/post `migration list` counts, the smoke row, and the rollback.
For a Vercel release, record the exact SHA, gate/approval/assertion ordering,
deployment identity and domain-verification time; do not change the latest
migration line when no migration was applied. Records accompany the next PR
opened for other work, never a standalone record PR.

## 2026-10-05 — gated release of read-only preflight #200 (ADR-124 / ADR-129)

MartinFloris merged #200 at 15:38:21 UTC (17:38:21 Europe/Amsterdam), producing
exactly `d6c602b72fb28ce04656427464e9ec59573d16e0`. The merged tree matches
reviewed publication `7f9b17837e397a09384c75543b6301f51f64200a`. This tooling
slice adds optional read-only release preflight and carries #199's closeout;
no application, migration, RPC or Part L invariant changed.

- Predeployment authenticated verification at 15:40:23.916 UTC found no
  candidate deployments in a complete lookup. Production still bound to READY
  #198, `dpl_8JpizqmeD24eeaZ9NC7sGBZoDZX9`, exact SHA
  `7dafa40552654778acad88ece5fcc7abb6be500a`. The main auto-deployment hold
  remained active in the candidate's vercel.json.
- All seven required main CI checks passed for the exact merged SHA. The last
  completed at 15:41:01 UTC; no required check was skipped. After starting the
  existing full local stack, all ten read-only preflight checks passed in 6.669s.
- Version-2 `gate-20261005-175432.json` passed at 15:54:32.775 UTC in the clean
  ordinary checkout with real dependencies. Catalogue parity covered 87 KUT
  migrations, aggregate SHA-256
  `337b807448fd329e414a9c8c73fbffff6817e7a15be2e9748483cb601b3d25f5`.
  Existing backup `kut-backup-20261005-121852.sql.enc`, created at 10:19:25.990
  UTC, was within 24 hours and independently decrypted/hash-verified again.
- The locked production runner ran 15:44:22.097–15:54:32.521 UTC (650.424s).
  Its fresh build ran 15:44:24.392–15:44:58.423 UTC (34.031s). All 130 required
  authenticated cases passed: Pixel 7 43, narrow Chromium 44, WebKit 43. Only
  the two approved duplicate-device pack skips remained; zero retries and no
  unexpected failures or weakened assertions.
- The verified owner merge supplied release/deployment authorization. Approval
  was recorded at 15:56:19.454 UTC; evidence assertion passed inside the
  deployment step before the external create request. That step also rechecked
  the owner merge, exact current main, project/repository linkage and prior
  production binding.
- Production deployment `dpl_AdhPmFay1HwVVaLNiCdJSy7fLoC8` was created from
  the exact Git source SHA; its creation response was recorded at 15:56:56.452
  UTC. READY and exact provenance were verified at 15:57:46.785 UTC.
  Independent authenticated verification at 15:59:06.090 UTC (17:59:06.090
  Europe/Amsterdam) returned `candidate_live` with complete candidate lookup
  and confirmed `kut.vibetrunk.com` binds to that deployment and SHA. Public
  `/` and `/login` returned HTTP 200 at 15:59:19.367 UTC.
- Local read-only cleanup verification at 15:57:58.272 UTC found zero fixture
  users, Players, active weeks, rotations or ownership instrumentation;
  Midweek was disabled. Normal stack stop completed at 15:58:45.842 UTC with
  data and backups preserved. No hosted database/function/secret/protection
  mutation occurred; no hosted migration-list counts are claimed for this run.
- Rollback reference is READY #198, deployment
  `dpl_8JpizqmeD24eeaZ9NC7sGBZoDZX9`, SHA
  `7dafa40552654778acad88ece5fcc7abb6be500a`. Rollback was not executed and
  needs separate authorization.
- Topic A remains unresolved; Topic B/KB-037 remain monitoring only; ADR-125
  reboot persistence remains unverified. This release does not establish a repair.

Private gate/approval and authenticated evidence are under
`.release-evidence/gates/d6c602b72fb28ce04656427464e9ec59573d16e0/` and
`.release-evidence/authenticated/d6c602b72fb28ce04656427464e9ec59573d16e0/`.
Deployment/domain/smoke/cleanup records are under
`.release-evidence/deployments/d6c602b72fb28ce04656427464e9ec59573d16e0/`.
Gate SHA-256: `9ac9498984395bc8c0adde80c6664eb7e5b73b9eeb6aeee49f466fe376d2280c`.
The binding observation above is dated #200 closeout evidence, not a fresh
live-domain check during slice 3b. This record accompanies that normal slice;
no release or deployment was repeated.

## 2026-10-05 — documentation-only merge of #199; intentional production lag (ADR-124 / ADR-126)

MartinFloris merged #199 at 13:59:21 UTC (15:59:21 Europe/Amsterdam), producing
exactly `02668326146623befa659bca99de0e2b2cc40916`. Its tree matches reviewed
publication commit `e08455244db9692b42d8895134e521fef2478ff7`: 12 Markdown
files only. It aligns shared instructions, records the docs-only release
exception and ADR-123–128 statuses, and includes #196/#197/#198's records once.

- Full main CI passed on that exact SHA: fast, e2e, database, migrations,
  security, merge-gate and scan, without skipped required jobs. The changes
  classifier also succeeded. The last required job completed at 14:01:16 UTC.
- No release gate or production deployment was run, under the approved
  documentation-only exception. Production intentionally lagged main by this
  docs-only commit at closeout.
- Authenticated read-only verification at 14:02:19.411 UTC (16:02:19
  Europe/Amsterdam) returned `candidate_not_live`, complete candidate lookup
  and zero #199 deployments. The domain bound to READY deployment
  `dpl_8JpizqmeD24eeaZ9NC7sGBZoDZX9`, exact #198 SHA
  `7dafa40552654778acad88ece5fcc7abb6be500a`. Automatic main deployment remained
  held (`git.deploymentEnabled.main = false`). This is the dated #199 closeout
  observation, not a fresh domain check in the preflight implementation session.
- Private evidence: `.release-evidence/deployments/02668326146623befa659bca99de0e2b2cc40916/docs-only-domain-2026-10-05T14-02-19-411Z.json`.
- The ordinary checkout was fast-forwarded cleanly to the merged SHA; policy
  parity passed. Seven protected stashes, 17 worktrees, backups, recordings and
  unrelated pack-luck material were preserved; no cleanup, restore or hosted
  mutation occurred.
- ADR-125 reboot persistence remains unverified. Topic A is unresolved;
  Topic B/KB-037 remain monitoring only. No incident repair is claimed.

## 2026-10-05 — gated agent-policy release of #198 (ADR-124)

The owner merged #198 at 12:31:11 UTC as
`7dafa40552654778acad88ece5fcc7abb6be500a`, authorizing its gated Vercel
production release. The slice changes three Codex rule decisions and adds
their CI unit test; no application, schema, RPC or game rule changes.

- **Predeployment:** authenticated Vercel verification at 12:33:51 UTC found
  no candidate deployment in the complete lookup. Production still served #197,
  `ff7cef8d2a22ad26509f9caaa871569df5b7fbe5`, deployment
  `dpl_3aaqgcBqNgKex3tJqJssywU9qGPZ`. The main deployment hold stayed active.
- **Gate:** version-2 `gate-20261005-145006.json` passed at 12:50:06 UTC
  in the clean ordinary checkout. All seven exact-SHA GitHub checks passed.
  Catalogue parity covered 87 KUT migrations, aggregate SHA-256
  `337b807448fd329e414a9c8c73fbffff6817e7a15be2e9748483cb601b3d25f5`.
  Existing backup `kut-backup-20261005-121852.sql.enc` was within 24 hours
  and independently decrypted/hash-verified again. The fresh locked production
  build passed 130 required authenticated cases with only the two permitted
  duplicate-device skips, zero retries and no weakened assertions.
- **Approval:** the verified owner merge was recorded at 12:50:55 UTC.
  Evidence assertion passed before deployment.
- **Deployment:** `dpl_8JpizqmeD24eeaZ9NC7sGBZoDZX9` was created
  at 12:51:30 UTC and verified READY with exact provenance at 12:52:16 UTC.
  Independent authenticated verification at 12:52:58 UTC confirmed
  `kut.vibetrunk.com` binds to this deployment and SHA, with a complete
  lookup. Public root and login returned HTTP 200. Domain verification was
  at 14:52:58 Europe/Amsterdam.
- **Cleanup:** local read-only checks found zero fixture users, Players,
  active weeks, rotations or ownership instrumentation; Midweek was disabled.
  Normal stack stop preserved its volumes and backups.
- **Evidence:** private gate, approval and deployment records are under
  `.release-evidence/gates/7dafa40552654778acad88ece5fcc7abb6be500a/` and
  `.release-evidence/deployments/7dafa40552654778acad88ece5fcc7abb6be500a/`.
  Passive monitors started late after a Windows AuthorizationManager refusal;
  their recordings are retained. No Topic A, Topic B or KB-037 repair is claimed.
- **Scope:** no hosted migration, function, secret or protection mutation.
  Dirty #196/#197 records were archived, stashed and restored byte-identically.
  Protected stashes and worktrees remain. This record accompanies handoff
  item 2's shared-guidance PR; no standalone deployment-record PR.

## 2026-10-05 — gated frontend release of #197 (ADR-124 / ADR-128)

MartinFloris merged #197 at 11:16:17 UTC, producing exactly
`ff7cef8d2a22ad26509f9caaa871569df5b7fbe5`. The owner's merge authorized this
SHA's gated Vercel production release.

- **Predeployment:** the authenticated Vercel audit found no deployment for the
  candidate; `kut.vibetrunk.com` still served #196's
  `84ed754efcbcdb801bbc2ee8108bb328a05a542e`. The `main` auto-deployment hold
  remained active: `vercel.json` sets
  `git.deploymentEnabled.main = false`, and the complete predeployment
  candidate lookup was empty.
- **Gate:** version-2 `gate-20261005-133137.json` passed at 11:31:37 UTC. All
  seven exact-SHA GitHub checks passed. Central catalogue parity covered 87 KUT
  migrations with aggregate SHA-256
  `337b807448fd329e414a9c8c73fbffff6817e7a15be2e9748483cb601b3d25f5`.
  Backup `kut-backup-20261005-121852.sql.enc` was cold-verified at creation and
  independently decrypted and hash-verified again by the gate. The fresh locked
  Next 16.3.6 / Playwright 1.63.0 production build passed 130 authenticated
  mobile cases across Pixel 7, 320 px Chromium and WebKit, with the two approved
  duplicate pack-device skips, zero retries and zero unexpected failures. E2E
  duration was 580.8 s.
- **Approval and ordering:** merge-based release approval was recorded at
  11:33:36 UTC and the full evidence assertion succeeded before deployment.
  Private gate and E2E evidence remain under
  `.release-evidence/gates/ff7cef8d2a22ad26509f9caaa871569df5b7fbe5/` and
  `.release-evidence/authenticated/ff7cef8d2a22ad26509f9caaa871569df5b7fbe5/`.
- **Deployment and verification:** Vercel created production deployment
  `dpl_3aaqgcBqNgKex3tJqJssywU9qGPZ` at 11:38:02 UTC. READY state and exact Git
  provenance were confirmed at 11:38:36 UTC. At 11:39:12 UTC the authenticated
  domain checker returned `candidate_live` for `kut.vibetrunk.com`, with a
  complete candidate lookup. Public `/` and `/login` both returned HTTP 200.
  Deployment evidence is retained under
  `.release-evidence/deployments/ff7cef8d2a22ad26509f9caaa871569df5b7fbe5/`.
- **Database and rollback:** no hosted migration, Supabase function, secret or
  protection change occurred. Previous production deployment
  `dpl_GRxojPLCjq99B4nvvgqi6B88p9RT`, SHA
  `84ed754efcbcdb801bbc2ee8108bb328a05a542e`, is the rollback reference;
  rollback was not executed and needs separate authorization.

## 2026-10-05 — gated frontend release of #196 (ADR-124)

MartinFloris merged #196 at 10:05:38 UTC, producing exactly
`84ed754efcbcdb801bbc2ee8108bb328a05a542e`. The owner's merge authorized this
SHA's gated Vercel production release.

- **Predeployment:** the read-only Vercel audit found no deployment for the
  candidate; `kut.vibetrunk.com` still served #195's
  `ed3076cdf8a9ccb6d2f383d2ff754ac90cf4db6e`. The `main` auto-deployment hold
  remained set in `vercel.json`.
- **Gate:** version-2 `gate-20261005-123234.json` passed at 10:32:34 UTC. All
  seven exact-SHA GitHub contexts passed. Central catalogue parity covered 87
  KUT migrations with aggregate SHA-256
  `337b807448fd329e414a9c8c73fbffff6817e7a15be2e9748483cb601b3d25f5`.
  Backup `kut-backup-20261005-121852.sql.enc` was cold-verified at creation
  and independently decrypted/hash-verified again by the gate. The fresh
  locked Next 16.3.6 / Playwright 1.63.0 production build passed 130
  authenticated mobile cases across Pixel 7, 320 px Chromium and WebKit, with
  only the two approved duplicate pack-device skips, zero retries, zero
  unexpected failures and zero flaky results. E2E duration was 561.224 s.
- **Approval and ordering:** merge-based release approval was recorded at
  10:33:23 UTC and the full evidence assertion succeeded before deployment.
  Private gate and E2E evidence remain under
  `.release-evidence/gates/84ed754efcbcdb801bbc2ee8108bb328a05a542e/` and
  `.release-evidence/authenticated/84ed754efcbcdb801bbc2ee8108bb328a05a542e/`.
  The first attempt stopped before browser tests because a dependency junction
  outside the candidate root made Turbopack reject the build; the corrected
  run used the locked dependencies inside the ordinary checkout and passed.
- **Deployment and verification:** Vercel created production deployment
  `dpl_GRxojPLCjq99B4nvvgqi6B88p9RT` at 10:36:49 UTC. READY state and exact Git
  provenance were confirmed at 10:37:48 UTC. At 10:39:03 UTC the authenticated
  domain checker returned `candidate_live` for `kut.vibetrunk.com`, with a
  complete candidate lookup. Public `/` and `/login` both returned HTTP 200.
  Deployment evidence is retained under
  `.release-evidence/deployments/84ed754efcbcdb801bbc2ee8108bb328a05a542e/`.
- **Database and rollback:** no hosted migration, Supabase function, secret or
  protection change occurred. Previous production deployment
  `dpl_Dz9TgBJpR5sArVkRKkXYKJqKLnVJ`, SHA
  `ed3076cdf8a9ccb6d2f383d2ff754ac90cf4db6e`, remains the rollback reference;
  rollback was not executed and needs separate authorization.

## 2026-10-05 — gated frontend release of #195 (ADR-124 / ADR-127)

MartinFloris merged #195 into main at 09:16:53 UTC, producing exactly
`ed3076cdf8a9ccb6d2f383d2ff754ac90cf4db6e`. The owner's merge instruction
authorized this SHA's gated Vercel production release.

- **Predeployment checks:** Vercel access succeeded; the production domain still
  served #189 and the complete candidate lookup found no deployments. The clean
  main checkout was fast-forwarded to the exact candidate. The Git main deployment
  hold remains enabled (`git.deploymentEnabled.main = false`).
- **Gate:** the sole full run passed at 09:30:37 UTC (11:30 Amsterdam), with
  version-2 `gate-20261005-113037.json`. All seven exact-SHA GitHub checks passed,
  including database/concurrency/finalizer readiness, dependency and secret scans.
  Central parity covered 87 KUT migrations, aggregate SHA-256
  `337b807448fd329e414a9c8c73fbffff6817e7a15be2e9748483cb601b3d25f5`.
  Backup `kut-backup-20261005-104031.sql.enc` was within 24 hours and independently
  decrypted/hash-verified again at gate time. The fresh locked Next 16.3.6 /
  Playwright 1.63.0 production build passed 130 authenticated mobile cases,
  with only the two approved duplicate pack-device skips, zero retries, zero
  unexpected failures and zero flaky results. E2E report duration was 550.015 s.
- **Approval and ordering:** the verified owner-merge authorization was recorded,
  release approval was recorded at 09:31:36 UTC, and the full evidence assertion
  succeeded before deployment creation. Private evidence remains under
  `.release-evidence/gates/ed3076cdf8a9ccb6d2f383d2ff754ac90cf4db6e/`,
  `.release-evidence/authenticated/ed3076cdf8a9ccb6d2f383d2ff754ac90cf4db6e/0479d19f-0e20-4c4a-8114-c204c8f3c4b7/`
  and `.release-evidence/deployments/ed3076cdf8a9ccb6d2f383d2ff754ac90cf4db6e/32751074-0fa0-459c-bbc1-db407cd65fc1/`.
- **Deployment and verification:** Vercel production deployment
  `dpl_Dz9TgBJpR5sArVkRKkXYKJqKLnVJ` was created at 09:31:49 UTC
  (11:31 Amsterdam), with READY and exact Git provenance confirmed at
  09:32:27 UTC. At 09:33:17 UTC, authenticated alias/deployment reads and a
  repeated binding check returned `candidate_live`: `kut.vibetrunk.com` serves
  this exact SHA's ready production deployment; candidate lookup was complete.
  Public `/` and `/login` returned HTTP 200 at 09:33:10–11 UTC.
- **Database and rollback:** no hosted migration, function, secret or protection
  change occurred. Previous production deployment
  `dpl_cm1RXc4wcfUCNe7MkSHBBKRHfYPq`, SHA
  `13bf6ad5e821532debe5c4237df75bcc54cc5b57`, remains the rollback reference;
  rollback was not executed and needs separate authorization. Passive thread
  sampler and stall-monitor diagnostics were left untouched.

## 2026-10-04 — gated frontend release of #189 (ADR-124)

Owner merge of #189 produced `13bf6ad5e821532debe5c4237df75bcc54cc5b57`.
The owner's explicit merge-as-deployment instruction authorized its Vercel release
after the full gate. No migration, function, secret or protection change occurred.

- **Predeployment evidence:** version-2 `gate-20261004-172619.json` passed at
  15:26:19 UTC, followed by approval recording and evidence assertion. All seven
  exact-SHA GitHub checks passed. The fresh locked production build passed 130
  authenticated mobile cases; only two approved duplicate pack-device skips,
  zero retries and zero flaky results. Central parity covered 87 KUT migrations,
  aggregate `337b807448fd329e414a9c8c73fbffff6817e7a15be2e9748483cb601b3d25f5`.
  Backup `kut-backup-20261004-032324.sql.enc` was within 24 hours and independently
  decrypted/hash-verified again by the gate.
- **Failed evidence preserved:** first full run had one WebKit geometry timeout
  (125 passes, two skips, four not run). The unchanged focused case passed before
  a new complete gate passed. No assertions or timeouts were weakened; the
  intermittent timeout's cause remains unproven. All evidence remains private.
- **Deployment:** created at 15:29:03 UTC (17:29 Amsterdam) from the exact Git SHA,
  ID `dpl_cm1RXc4wcfUCNe7MkSHBBKRHfYPq`, URL
  `https://kut-im2j7x7kr-vibetrunk.vercel.app`. Ready state confirmed at 15:29:57 UTC.
  Authenticated alias/deployment reads confirmed `kut.vibetrunk.com` points to
  this ready production build with matching Git provenance. Public `/` and
  `/login` returned HTTP 200. The Git main deployment hold stays enabled.
- **Database and rollback:** no hosted SQL was applied and no fresh hosted
  migration-ledger audit is claimed. The preceding migration record below is
  unchanged. Previous Vercel production deployment
  `dpl_ALTcwQAUR2hpMDmNewfbYZup13u3` at
  `b99db188c6e0993552747c6f6d84a3779a480e71` remains the rollback reference;
  rollback was not executed and requires its own authorization.

## 2026-10-04 — `20261018000000` frozen Special tiers (ADR-121 / KB-038)

Applied with the owner's separate hosted-application authorization, only from
**VibeTrunk/supabase**, at **2026-10-04 02:00 UTC (04:00 Amsterdam)**.
**Tier: additive / projection-only.** Four
`create or replace view` definitions read Specials' `snapshot_rarity_tier`
directly; Live behavior and missing-state floors remain. No DML, issuance,
snapshot rewrite, rating/pricing/economy change or RPC signature change.

- **Candidate and catalogue:** KUT PR #184 merged as
  `13185dc8000970ee5d42b54503973c17aa50327f`; central PR #79 merged as
  `6c08eb0e84325a40185cf38034a6192c8dc4e78f`. All seven required GitHub checks passed
  for the exact KUT candidate, including the clean-lockfile build, database,
  integration, security and secret scan. Source verification covers 88 shared
  migrations; KUT parity covers 87, with aggregate SHA-256
  `337b807448fd329e414a9c8c73fbffff6817e7a15be2e9748483cb601b3d25f5`.
- **Backup and gate:** fresh encrypted backup `kut-backup-20261004-032324.sql.enc`,
  independently cold-verified at creation and again by the release gate.
  The canonical gate passed (`gate-20261004-035939.json`), using the
  unchanged authenticated suite against a local production build: **130 passed,
  two deliberate duplicate pack-test skips**, across Chromium and WebKit.
  Pack coverage passed once at 320 px; skips are not counted as passes.
  All 39 new share/rating/layout cases passed. Every fixture targeted loopback.
- **Failed attempts retained:** the first full gate against Next development
  mode failed (125 passed, five WebKit preview/layout timeouts, two skips).
  An unchanged focused development-mode rerun passed three and failed two.
  All five passed against the production build before the full gate was rerun.
  The timeout cause remains unconfirmed; no code, tests, timeouts or skips were
  changed to obtain the passing gate. Installed Next.js 16.3.5 was used locally;
  exact-candidate CI passed with the locked 16.3.6 install.
- **Hosted ledger:** 88 catalogue entries before, 87 remote, with only
  `20261018000000_special_snapshot_tiers.sql` pending and no unrelated drift.
  The final dry run named only that file. After applying from central merged
  `main`, all 88 local/remote versions match and the dry run has zero pending
  migrations. Vault updates were explicitly skipped.
- **Read-only hosted smoke:** the migration is recorded; all four view
  definitions exactly match the tested local definitions. Column order/types,
  owners, ACLs, security modes and barriers match the pre-application snapshot.
  Frozen Special count/hash is unchanged (**zero Specials**; none issued).
  An existing ordinary active member can read collection, market, saved pack
  results and trade offers; collection tiers match the Live-state/frozen-tier
  contract. No hosted fixture rows or users were created. Special value cases
  are demonstrated by the 51 local pgTAP assertions, not hosted issuance.

- **Rollback:** re-create the prior four views from their named immutable
  sources: collection `20260911000000`, market `20261010000000`, pack results
  `20261002000000`, trade offers `20260928000000`. No drop, snapshot rewrite or
  grant change. Prepared rollback SQL was not executed; rollback needs its own
  authorization. KB-037 still needs the affected real phone/OS/browser and
  real-device sharing evidence; passing emulation does not close it.

### Frontend deployment verification addendum — 2026-10-04

Read-only GitHub deployment evidence confirms the final KUT candidate
`13185dc8000970ee5d42b54503973c17aa50327f` was successfully deployed to **Production**
(deployment id `6835330096`, created `2026-10-04T01:18:43Z`, Vercel status
success). This merged candidate contains frontend PR #183 and migration source
PR #184. The existing public login returns HTTP 200 with Next assets, CSP and
HSTS present. No new app deployment was triggered for this check.

KB-035/036 are deployed, with their local Chromium/WebKit geometry checks
recorded above. KB-037 recovery is deployed, but the actual phone/OS/browser,
30 September exception/payload and real-device sharing evidence remain
unconfirmed. Public availability and deployment success do not close KB-037.

## 2026-10-03 — `20261017000000` predictions for members who are out (ADR-118)

Deployed 2026-10-03 from `VibeTrunk/supabase` (catalogue PR #77 there), on its
own data-changing `db push`:

- `20261017000000_midweek_predictions.sql` (BUILD_SPEC §44.7, §44.9, §44.13,
  §44.14, §145, Part L #28, ADR-118 amending ADR-096, owner Q2 interview, KUT
  PR #175, tier data-changing) &mdash; MM 2.0 D, the backend.
  - **What changed.** A member whose own match has ended in defeat can pick the
    winner of each later match before its kick-off, once both its feeders have
    ended (`kut.save_midweek_prediction`, `kut.midweek_predictions` with its
    Part L #28 guard trigger). Correct picks pay at the payout, 30 split over
    the matches after round 1 (`kut._mm_prediction_coins`: 2 a pick at 17–32
    entrants), one guarded row per (week, member) in
    `kut.midweek_prediction_rewards`, ledger reason `midweek_prediction` (the
    ledger constraint re-created). `kut._mm_pay_tournament` is re-created with
    the wins step unchanged, then the picks, then the result message with "You
    called {n} of {m} right[: +{coins} KUT Coins]." for a member who predicted.
    Three gated views: `my_midweek_predictions`,
    `my_midweek_prediction_rewards`, `midweek_prediction_splits_public`.
  - **No DML at the push.** Data-changing because it widens what the ledger
    accepts, adds a faucet and changes what the worker writes when it pays a
    week.
  - **Before the push.** Fresh backup `20261003-134420`, cold-verified, no
    cards in escrow. `migration list --linked` showed 87 entries, 86 remote,
    with `20261017000000` the only local-only one and no remote-only drift; the
    dry run named exactly that file, and again from the catalogue's merged main
    (`aa52104`) just before the push; the catalogue check reported 87 approved
    source migrations. The production gate **passed** for `9a029e6`
    (2026-10-03 13:54 Amsterdam: CI checks, catalogue parity, the backup
    re-verified, finalizer readiness, authenticated E2E 49 passed, 1 expected
    skip). Its first run at 13:46 failed closed: 13 E2E tests saw PostgREST
    refuse their tokens as "JWT issued at future" (`PGRST303`), a passing
    clock skew between Windows and the Docker VM. The clocks agreed again
    minutes later and the rerun passed with no such error. No evening was
    running (Saturday). After the push `migration list --linked` showed 87
    local and 87 remote, no drift.
  - **Smoke test on hosted:** passed (the owner's run, 2026-10-03):
    `true | true | {30,10,4,2} | true | false | 2 | true | 0 | 2026-10-05`,
    matching the local run (`t | t | {30,10,4,2} | t | f | 2 | t | 0 |`, no
    week open there) plus the open week (recorded; the ledger reason; the coin
    rates for 2 to 5 rounds; members may call the save; members can't read the
    table; both guard triggers; the payout pays picks; no picks yet):

    ```sql
    select
      exists (select 1 from supabase_migrations.schema_migrations where version = '20261017000000') as recorded,
      (select pg_get_constraintdef(oid) like '%''midweek_prediction''%' from pg_constraint
        where conname = 'wallet_ledger_reason_check' and conrelid = 'kut.wallet_ledger'::regclass) as ledger,
      (select array_agg(kut._mm_prediction_coins(r) order by r) from generate_series(2, 5) r)::text as coins,
      has_function_privilege('authenticated', 'kut.save_midweek_prediction(uuid,integer,integer,uuid)', 'execute') as member_saves,
      has_table_privilege('authenticated', 'kut.midweek_predictions', 'select') as member_reads_table,
      (select count(*) from pg_trigger where tgname in ('midweek_predictions_guard', 'midweek_prediction_rewards_guard')) as guards,
      position('midweek_prediction' in pg_get_functiondef('kut._mm_pay_tournament(uuid)'::regprocedure)) > 0 as pays_picks,
      (select count(*) from kut.midweek_predictions) as picks,
      (select week_start from kut.midweek_tournaments where status = 'open' order by week_start limit 1) as open_week;
    ```
  - **Deploy ordering** was safe: no page reads any of it yet (the pages
    follow the DR3 design mock), so nobody can save a pick and the Wed 7 Oct
    payout runs the new function with no picks, its messages unchanged.
  - Rollback: in the migration's header. Re-create `kut._mm_pay_tournament`
    from `20261013000000_midweek_result_for_everyone.sql`; drop the three
    views, `kut.midweek_prediction_rewards`, `kut.midweek_predictions`,
    `kut.save_midweek_prediction`, both guard functions and
    `kut._mm_prediction_coins`; re-create the ledger constraint from
    `20261006000000_midweek_payouts.sql` once no ledger row has reason
    `midweek_prediction`.

## 2026-10-03 — `20261016000000` balanced squads beat All-rounders (ADR-116)

Deployed 2026-10-03 from `VibeTrunk/supabase` (catalogue PR #75 there), on its
own data-changing `db push`:

- `20261016000000_midweek_balance.sql` (BUILD_SPEC §44.3–§44.5, §44.12,
  §44.14, §145, ADR-116 amending ADR-089 and ADR-092, owner Q13 interview and
  tuning sign-off R2, KUT PR #172, tier data-changing) &mdash; MM 2.0 PR 8 (C2).
  - **What changed.** Each archetype's plusses per line (attack, midfield,
    defence, 0–3; All-rounder 1/1/1, every outfield specialist four, Tank
    0/2/2) are the engine's input: `kut._mm_config()`, `kut._mm_lines`,
    `kut._mm_play_match`, `kut._mm_simulate` and `kut._mm_lock_tournament` are
    re-created, and the new `kut._mm_balance(text[], integer)` applies the
    weakest-line rule (each outfield line needs 3 plusses, ×0.88 per plus
    short). The lock step stores it in the new nullable
    `kut.midweek_entries.balance_ppm`, appended to
    `kut.midweek_entries_public`. Outfield defence counts 0.8 of a shot's
    resistance, a Goalkeeper keeps at 1.65 × power and a stand-in 0.45 of
    that; OVR factor at 83 1.12, auto factor 0.55.
  - **No DML at the push.** Data-changing because it changes what the lock
    step computes and so who is paid.
  - **Before the push.** Fresh backup `20261003-122258`, cold-verified, no
    cards in escrow. `migration list --linked` showed 86 entries, 85 remote,
    with `20261016000000` the only local-only one and no remote-only drift; the
    dry run named exactly that file, and again from the catalogue's merged main
    (`0832f6f`) just before the push; the catalogue check reported 86 approved
    source migrations. The production gate **passed** for `b96ee52`
    (2026-10-03 12:36 Amsterdam: CI checks, catalogue parity, the backup
    re-verified, finalizer readiness, authenticated E2E 49 passed, 1 expected
    skip). No evening was running (Saturday). After the push
    `migration list --linked` showed 86 local and 86 remote, no drift.
  - **Smoke-tested on hosted.** The owner ran the one-row query below in the
    SQL editor and confirmed it matched: the local run returned
    `t | 3 | [0, 2, 2] | 1120000 | 681472 | [2000000, 1000000, 200000] | balance_ppm | f | 0 |`,
    and hosted ends in the open week, `2026-10-05` (recorded; the rule's
    threshold; the Tank's plusses; the OVR factor; a one-line Finisher stack
    at 0.88³ = 0.681472; a Finisher's lines; the view's new last column; no
    member execute grant on the rule; no balanced entries yet):

    ```sql
    select
      exists (select 1 from supabase_migrations.schema_migrations where version = '20261016000000') as recorded,
      kut._mm_config()#>>'{balance,minPlusses}' as min_plusses,
      kut._mm_config()#>>'{shape,plusses,tank}' as tank,
      kut._mm_config()#>>'{ovr,factorMaxPpm}' as ovr_max,
      (kut._mm_balance(array['goalkeeper','finisher','finisher','finisher','finisher'], 0)->>'balancePpm')::int as stack_balance,
      (select jsonb_build_array(att_ppm, mid_ppm, def_ppm)::text from kut._mm_lines('finisher')) as finisher_lines,
      (select attname::text from pg_attribute where attrelid = 'kut.midweek_entries_public'::regclass
        and attnum = (select max(attnum) from pg_attribute where attrelid = 'kut.midweek_entries_public'::regclass and attnum > 0)) as view_last,
      has_function_privilege('authenticated', 'kut._mm_balance(text[],integer)', 'execute') as members_call,
      (select count(*) from kut.midweek_entries where balance_ppm is not null) as balanced_entries,
      (select week_start from kut.midweek_tournaments where status = 'open') as open_week;
    ```
  - **Deploy ordering** was safe: #172's pages read `midweek_entries_public`
    with `select("*")` and treat a missing or null `balance_ppm` as no chip,
    and how-it-works described the rule from the Vercel deploy. **Switch at the
    push** (owner): the week open at the push, **Wed 7 Oct** (`week_start`
    2026-10-05), is the first played and paid under the new balance; weeks
    already locked keep their stored results and a null `balance_ppm`.
  - Rollback: in the migration's header. Drop and re-create
    `kut.midweek_entries_public` from `20261012000000_midweek_draw_from_lock.sql`;
    re-create `kut._mm_lock_tournament` and `kut._mm_config` from
    `20261011000000_midweek_evening_timing.sql`; re-create `kut._mm_lines`,
    `kut._mm_play_match` and `kut._mm_simulate` from
    `20261005000000_midweek_engine.sql`; drop `kut._mm_balance(text[], integer)`
    and `kut.midweek_entries.balance_ppm`. Weeks locked on the new engine keep
    their stored results.

## 2026-10-03 — `20261015000000` unclaimed Players' archetypes rotate weekly (ADR-110)

Deployed 2026-10-03 from `VibeTrunk/supabase` (catalogue PR #73 there), on its
own data-changing `db push`:

- `20261015000000_midweek_archetype_rotation.sql` (BUILD_SPEC §44.2, §44.11,
  §44.14, Part L #27, ADR-110 amending ADR-027 and ADR-099, owner decisions Q8
  and Q9, KUT PR #170, tier data-changing) &mdash; MM 2.0 PR 7 (C1).
  - **What changed.** `kut._mm_open_next` now takes a transaction advisory
    lock, checks again for a running week, and before the tournament insert
    runs `kut._mm_rotate_archetypes` with the new week's secret seed: every
    active, collectible Player with no linked account takes
    `kut._mm_rotation_archetype(seed, player)` (any of the seven, uniformly),
    the active season is rebuilt once, and each change is logged in
    `kut.midweek_archetype_rotations` (service role only). The ADR-099
    snapshot freezes the rotated archetypes for the week. A clash on
    `week_start` now raises instead of `on conflict do nothing`.
  - **No DML at the push.** Data-changing because, from the next open, the
    worker rewrites `kut.players.archetype` and the season's stats every week.
  - **Before the push.** Fresh backup `20261003-020935`, cold-verified, no
    cards in escrow. `migration list --linked` showed 84 remote entries with
    `20261015000000` the only local-only one and no remote-only drift; the dry
    run named exactly that file, and again from the catalogue's merged main
    (`eba80ae`) just before the push; the catalogue check reported 85 approved
    source migrations. The production gate **passed** for `d8d5739`
    (2026-10-03 02:14 Amsterdam: CI checks, catalogue parity, the backup
    re-verified, finalizer readiness, authenticated E2E 47 passed). No evening
    was running (Saturday). After the push `migration list --linked` showed 85
    local and 85 remote, no drift.
  - **Smoke-tested on hosted.** The owner ran the one-row query below in the
    SQL editor and confirmed it matched: the local run returned
    `t | t | f | t | tank | t | f | 0 |`, and hosted ends in the open week,
    `2026-10-05` (recorded; the log has RLS, members can't read it and the
    service role can; a fixed seed and Player draw `tank`; the open step
    locks, rotates and logs; nobody can call the rotation directly; nothing
    logged yet):

    ```sql
    select
      exists (select 1 from supabase_migrations.schema_migrations where version = '20261015000000') as recorded,
      (select relrowsecurity from pg_class where oid = 'kut.midweek_archetype_rotations'::regclass) as log_rls,
      has_table_privilege('authenticated', 'kut.midweek_archetype_rotations', 'select') as members_read_log,
      has_table_privilege('service_role', 'kut.midweek_archetype_rotations', 'select') as service_reads_log,
      kut._mm_rotation_archetype(decode(repeat('ab', 32), 'hex'), '00000000-0000-4000-8000-000000000001') as draw,
      pg_get_functiondef('kut._mm_open_next()'::regprocedure) like '%pg_advisory_xact_lock%_mm_rotate_archetypes%midweek_archetype_rotations%' as open_rotates,
      has_function_privilege('authenticated', 'kut._mm_rotate_archetypes(bytea)', 'execute')
        or has_function_privilege('service_role', 'kut._mm_rotate_archetypes(bytea)', 'execute') as rotate_callable,
      (select count(*) from kut.midweek_archetype_rotations) as logged,
      (select string_agg(week_start::text, ',') from kut.midweek_tournaments where status = 'open') as open_week;
    ```
  - **Deploy ordering** was safe: #170 changed only how-it-works and
    `/settings/card` copy, which reads nothing new. The week open at the push
    (Wed 7 Oct, `week_start` 2026-10-05) keeps its archetypes. **The first
    rotation runs on Wed 7 Oct after that evening's payout, when the worker
    opens the week of Wed 14 Oct.**
  - Rollback: in the migration's header. Re-create `kut._mm_open_next` from
    `20261011000000_midweek_evening_timing.sql` section 5, then drop
    `kut._mm_rotate_archetypes(bytea)`, `kut._mm_rotation_archetype(bytea, uuid)`
    and `kut.midweek_archetype_rotations`. Rotated archetypes stay; each log
    row's `from_archetype` restores one.

## 2026-10-03 — `20261014000000` the Midweek evening unfolds event by event (ADR-106)

Deployed 2026-10-03 from `VibeTrunk/supabase` (catalogue PR #70 there), on its
own additive `db push`:

- `20261014000000_midweek_live_reveal.sql` (BUILD_SPEC §44.9, §44.14, ADR-106
  amending ADR-095 and ADR-105, owner decision Q7, KUT PR #166, tier additive)
  &mdash; MM 2.0 PR 4 (B3): a member's own reads follow the evening's clock.
  Views only.
  - **What changed.** `kut.midweek_matches_public` keeps the pairing, kick-off,
    win chance and day rolls from kick-off, but shows goals, penalties,
    `winner_side` and `winner_user_id` only once the match has ended; it
    appends `ends_at` (null until passed, since a late end gives a shoot-out
    away) and `in_play`. `kut.midweek_events_public` shows each event from its
    own `reveal_at` and appends it. `kut.midweek_tournaments_public` names the
    champion from the end of the final. Weeks simulated before ADR-104 still
    show whole matches at kick-off.
  - **No DML.**
  - **Before the push.** Fresh backup `20261003-001237`, cold-verified, no
    cards in escrow. `migration list --linked` showed 83 remote entries with
    `20261014000000` the only local-only one and no remote-only drift; the dry
    run named exactly that file, and again from the catalogue's merged main
    (`aa734d0`) just before the push; the catalogue check reported 84 approved
    source migrations. The production gate **passed** for `bf21601`
    (2026-10-03 00:21 Amsterdam: CI checks, catalogue parity, the backup
    re-verified, authenticated E2E 47 passed). No evening was running
    (Saturday). After the push `migration list --linked` showed 84 local and
    84 remote, no drift.
  - **Smoke-tested on hosted.** The owner ran the one-row query below in the
    SQL editor and confirmed it matched the local run,
    `t | in_play,ends_at | 22 | reveal_at | 18 | t | t | security_invoker=false,security_barrier=true | t | f`
    (recorded; `in_play` and `ends_at` the matches view's last columns, 22 of
    them; `reveal_at` the events view's last, 18; the event and champion gates
    in place; still a definer view with a barrier; members read it, anon
    doesn't):

    ```sql
    select
      exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000000') as recorded,
      (select string_agg(column_name::text, ',' order by ordinal_position desc) from (select column_name, ordinal_position from information_schema.columns where table_schema = 'kut' and table_name = 'midweek_matches_public' order by ordinal_position desc limit 2) c) as matches_last,
      (select count(*) from information_schema.columns where table_schema = 'kut' and table_name = 'midweek_matches_public') as matches_cols,
      (select column_name::text from information_schema.columns where table_schema = 'kut' and table_name = 'midweek_events_public' order by ordinal_position desc limit 1) as events_last,
      (select count(*) from information_schema.columns where table_schema = 'kut' and table_name = 'midweek_events_public') as events_cols,
      pg_get_viewdef('kut.midweek_events_public'::regclass) ilike '%coalesce(event.reveal_at, played.reveal_at) <= now()%' as events_gated,
      pg_get_viewdef('kut.midweek_tournaments_public'::regclass) ilike '%coalesce(final.ends_at, final.reveal_at) <= now()%' as champion_gated,
      (select array_to_string(reloptions, ',') from pg_class where oid = 'kut.midweek_matches_public'::regclass) as matches_options,
      has_table_privilege('authenticated', 'kut.midweek_matches_public', 'select') as members_read,
      has_table_privilege('anon', 'kut.midweek_matches_public', 'select') as anon_reads;
    ```
  - **Deploy ordering** was safe: KUT PR #165 (F6, ADR-115) deployed first and
    already masks matches in play on the pages from each match's stored end,
    so the pages read the same before and after the push; #166 added no page
    code. The first evening under it is Wed 7 Oct.
  - Rollback: in the migration's header. Drop and re-create
    `kut.midweek_matches_public` and `kut.midweek_events_public` from
    `20261005000000_midweek_engine.sql` section 5 with their grants and
    comments; re-create `kut.midweek_tournaments_public` from
    `20261012000000_midweek_draw_from_lock.sql` section 3.

## 2026-10-02 — `20261013000000` a Midweek result message for every entrant (ADR-109)

Deployed 2026-10-02 from `VibeTrunk/supabase` (catalogue PR #68 there), on its
own `db push`:

- `20261013000000_midweek_result_for_everyone.sql` (BUILD_SPEC §44.7, §44.14,
  ADR-109 amending ADR-096, owner decision DR1-3, KUT PR #161, tier
  data-changing) &mdash; MM 2.0 PR 5: every entrant hears how their week ended,
  not only those paid.
  - **What changed.** `kut._mm_pay_tournament(uuid)` is re-created with the
    same signature, still security definer and still internal (no execute for
    public, anon, authenticated or the service role). The payment part is
    unchanged word for word (Part L #26). Its message step now writes one
    `midweek_result` per entrant who is not disabled, titled by finish ("You
    won Midweek Madness", "You went out in the semi-finals"), with who beat
    them and how, their coins if any, the champion (not on the runner-up's),
    and "Your auto squad played for you." for an auto squad. Idempotent through
    the inbox's unique index, as before.
  - **No DML.** A week paid before the push keeps its old messages; the first
    week paid under it is Wed 7 Oct.
  - **Before the push.** Fresh backup `20261002-232536`, cold-verified, no
    cards in escrow. `migration list --linked` showed 82 entries with
    `20261013000000` the only local-only one and no remote-only drift; the dry
    run named exactly that file, and again from the catalogue's merged main
    just before the push; the catalogue check reported 83 approved source
    migrations. The production gate **passed** for `b468a48` (2026-10-02 23:34
    Amsterdam: CI checks, catalogue parity, the backup re-verified,
    authenticated E2E). No evening was running (Friday).
  - **Smoke-tested on hosted.** The owner ran the one-row query below in the
    SQL editor and confirmed it matched the local run, `t | t | t | t | f | f`
    (recorded, every entrant's line in the function, titled by finish, definer,
    no execute for members, none for the service role):

    ```sql
    select
      exists (select 1 from supabase_migrations.schema_migrations where version = '20261013000000') as recorded,
      pg_get_functiondef('kut._mm_pay_tournament(uuid)'::regprocedure) like '%Your auto squad played for you.%' as every_entrant,
      pg_get_functiondef('kut._mm_pay_tournament(uuid)'::regprocedure) like '%You went out in %' as titled_by_finish,
      (select prosecdef from pg_proc where oid = 'kut._mm_pay_tournament(uuid)'::regprocedure) as definer,
      has_function_privilege('authenticated', 'kut._mm_pay_tournament(uuid)', 'execute') as members_can_call,
      has_function_privilege('service_role', 'kut._mm_pay_tournament(uuid)', 'execute') as service_can_call;
    ```
  - **Deploy ordering** was safe: no page reads the message text, and KUT PR
    #161 deployed on merge with nothing depending on the push.
  - Rollback: re-create `kut._mm_pay_tournament` from
    `20261006000000_midweek_payouts.sql` section 4 and re-apply its revoke.

## 2026-10-02 — `20261012000000` Midweek draw from the lock (ADR-105)

Deployed 2026-10-02 from `VibeTrunk/supabase` (catalogue PR #66 there), on its
own additive `db push`:

- `20261012000000_midweek_draw_from_lock.sql` (BUILD_SPEC §44.9, §44.14,
  ADR-105, KUT PR #152, tier additive) &mdash; MM 2.0 B2: what members may read
  of a Midweek week from the lock. Views only.
  - **What changed.** New `kut.midweek_draw_public` (round 1's pairings and
    byes, both managers and `kickoff_at`, from the lock, no result column).
    `kut.midweek_entries_public` shows from the lock instead of round 1, with
    `form_roll_ppm`, `pick_factor_ppm` and `power_ppm` null until round 1 kicks
    off. `kut.midweek_current` and `kut.midweek_tournaments_public` show
    `final_reveal_at` only once it has passed (since ADR-104 it is the end of
    the final, which at the lock told an API reader whether the final goes to
    penalties). `kut.midweek_current` appends `evening_live`, which the Compete
    badge (KUT PR #153, ADR-107) reads.
  - **No DML.**
  - **Before the push.** Fresh backup `20261002-110621`, cold-verified, no
    cards in escrow. `migration list --linked` showed 82 entries with
    `20261012000000` the only local-only one and no remote-only drift; the dry
    run named exactly that file; the catalogue check reported 82 approved
    source migrations (81 of them KUT's). The production gate **passed** for
    `2f3a94a` (#153 on top of #152; 2026-10-02 12:52 Amsterdam: CI checks,
    catalogue parity, the backup re-verified, authenticated E2E, a
    hook-attested Opus session). The post-push `migration list` was not
    re-run; the smoke row's first column confirms the version is recorded.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `true | security_invoker=false,security_barrier=true | true | 10 | 26 | true | evening_live | true`,
    matched the local run exactly and confirmed:
    - `20261012000000` is recorded in the migration history;
    - the draw view is a definer view with a barrier, readable by members and
      not by anon, with its 10 columns;
    - the entries view keeps its 26 columns and withholds the dice until
      kick-off;
    - `evening_live` is `midweek_current`'s last column;
    - `final_reveal_at` is gated in both tournament views.
  - **Deploy ordering** was safe: KUT PRs #152 and #153 deployed first; they
    read every view with `select("*")`, and the badge falls back to
    `final_reveal_at` while `evening_live` is absent.
  - Rollback: in the migration's header. Drop the draw view, re-create the
    entries view from `20261005000000`, drop and re-create `midweek_current`
    and `midweek_tournaments_public` from `20261011000000` (re-applying their
    grants from `20261003000000`).

## 2026-10-02 — `20261011000000` Midweek evening timing (ADR-104)

Deployed 2026-10-02 from `VibeTrunk/supabase` (catalogue PR #64 there), on its
own data-changing `db push`:

- `20261011000000_midweek_evening_timing.sql` (BUILD_SPEC §44.1, §44.7, §44.11,
  §44.14, §145, Part L #25, ADR-104, KUT PR #147, tier data-changing) &mdash;
  MM 2.0 B1: squads lock Wednesday 19:55, a round every 15 minutes from 20:00,
  and the payout waits for the end of the final.
  - **What changed.** `kut._mm_config()` holds a versioned schedule (`current`
    2, versions 1 and 2); new internal clock functions (`_mm_schedule`,
    `_mm_lock_at(date, int)`, `_mm_round_start_at`, `_mm_match_timing`),
    `_mm_reveal_at` dropped. `kut.midweek_tournaments.schedule_version`
    (existing rows 1, default 2, fixed once a week locks),
    `kut.midweek_matches.ends_at`, `kut.midweek_match_events.reveal_at`. The
    lock step stores every start, end and event time and sets
    `final_reveal_at` to the end of the final; the open step names the current
    version; the rehearsal uses the week's clock. `kut.midweek_current` and
    `kut.midweek_tournaments_public` append `schedule_version`.
  - **DML:** the open week of 5 Oct moved to version 2: its lock from Wed
    7 Oct 20:00 to **19:55**. Nothing simulated was touched.
  - **Before the push.** Fresh backup `20261002-091630`, cold-verified, no
    cards in escrow. `migration list --linked` showed 81 entries with
    `20261011000000` the only local-only one and no remote-only drift; the dry
    run named exactly that file; the catalogue check reported 81 approved
    source migrations. The production gate for `199b126` (#147) failed closed
    twice on the authenticated E2E: `/club/collection` was 323 px wide at
    320 px (KB-032). KUT #148 fixed that, and the gate **passed** for
    `5da5dd8` (2026-10-02 09:46 Amsterdam: CI checks, catalogue parity, the
    backup re-verified, authenticated E2E, a hook-attested Opus session).
    Afterwards `migration list --linked` showed 81 entries, all present
    locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `2 | 3 | true | 2 | 2026-10-05 v2 Wed 19:55 | 1 | 0 | 0 | schedule_version`,
    matched the local run apart from the one past week, and confirmed:
    - new weeks open on version 2, which is also the column default;
    - the three new columns exist and the old reveal function is gone;
    - the open week of 5 Oct is on version 2 and locks Wednesday 19:55;
    - the one past week (28 Sep) stays on version 1, none on another version;
    - no match has a stored end yet (none locked since);
    - `schedule_version` is the tournament list's last column.
  - **Deploy ordering** was safe: KUT PR #147 deployed first and reads a row
    without `schedule_version` as version 1, which every hosted week was until
    this push.
  - **First week on the new clock:** the week of 5 Oct, lock **Wed 7 Oct
    19:55**, final of a 17–32 field at 21:00. ADR-104 had named the 14 Oct week
    as the target; the push came earlier, between the 30 Sep payout and the
    7 Oct lock.
  - Rollback: in the migration's header. Move an open version-2 week back
    first (`lock_at = kut._mm_lock_at(week_start, 1), schedule_version = 1`),
    then re-create the two views and the functions from `20261003000000` /
    `20261005000000`, drop the four new functions and the three columns.

## 2026-09-30 — `20261010000000` market discard value (ADR-103)

Deployed 2026-09-30 from `VibeTrunk/supabase` (catalogue PR #62 there), on its
own additive `db push`:

- `20261010000000_market_listing_discard_value.sql` (BUILD_SPEC §36, ADR-103,
  KB-027, KUT PR #140, tier additive) &mdash; the listing detail page shows a
  listed card's discard value under the asking price, as its floor.
  - **What changed.** `create or replace view kut.active_market_listings`,
    its `20261002000000` body verbatim plus a trailing `discard_value` that
    calls `kut.card_discard_value(card.id)` when the card has a rating and is
    null otherwise. The view stays a security-barrier definer view gated on
    `kut.is_active_member()`, grants unchanged. `grant execute on function
    kut.card_discard_value(uuid) to authenticated, service_role`: function
    privileges are checked against the caller even inside a definer view.
  - **DML:** none. Additive tier, so it could ride on the previous backup; a
    fresh one was taken anyway, `20260930-163158`, cold-verified, no cards in
    escrow. Pre-push `migration list --linked` showed 80 entries with
    `20261010000000` the only local-only one and no remote-only drift, the dry
    run named exactly that file, and the catalogue check reported 80 approved
    source migrations. Afterwards it showed 80 entries, all present locally and
    remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor as `service_role`, one row,
    `discard_value | {security_invoker=false,security_barrier=true} | true | false | 15 | 0 | 0`,
    matched the local run apart from the live listing count, and confirmed:
    - `discard_value` is the view's last column;
    - the view is still `security_invoker=false`, `security_barrier=true`;
    - `authenticated` can execute `card_discard_value` and `anon` cannot;
    - all 15 live listings have a value, and none disagrees with the function.
  - **Deploy ordering** was safe: KUT PR #140 deployed first and renders no
    discard line while the column is absent.
  - Rollback (optional; the column is harmless to every reader): drop
    `kut.my_wanted_cards` and `kut.active_market_listings`, re-run the
    `kut.active_market_listings` block of `20261002000000` (with its
    revoke/grant) and the whole of `20260920060000`, then revoke execute on
    `kut.card_discard_value(uuid)` from `authenticated, service_role`.

## 2026-09-27 — `20261009000000` goals + assists notice wording (ADR-101)

Deployed 2026-09-27 from `VibeTrunk/supabase` (catalogue PR #60 there), on its
own additive `db push`, the day before the first G+A session (Mon 28 Sep):

- `20261009000000_goals_assists_notice_copy.sql` (BUILD_SPEC §8, §15.2 and the
  2026-09-27 amendment, ADR-101, KUT PR #137, tier additive) &mdash; from the
  football week beginning 2026-09-28 the notices SQL writes say G+A (goals +
  assists) for a session dated on or after the cutover and keep "goals"
  before it.
  - **What changed.** New immutable `kut._uses_combined_count(date)`
    (`service_role` only). `create or replace` of `kut._open_session_survey`
    (report-open title), `kut._finalize_one_session` (results and kudos
    bodies) and `kut.admin_correct_session_goals` (correction title and
    body), each its latest body plus a date lookup and a wording branch.
    Scoring, locking, idempotency, security definer, `search_path` and grants
    unchanged.
  - **DML:** none. Additive tier, so it could ride on the previous backup; a
    fresh one was taken anyway, `20260927-180300`, cold-verified (one card
    escrowed in an open offer, recorded in the backup log). Pre-push
    `migration list --linked` showed 79 entries with `20261009000000` the only
    local-only one and no remote-only drift, the dry run named exactly that
    file, and the catalogue check reported 79 approved source migrations.
    Afterwards it showed 79 entries, all present locally and remotely, no
    drift.
  - **Smoke-tested on hosted.** In the SQL editor as `service_role`, one row,
    `false | true | true | true | true | true | true | true | false | false | false`, identical to the local run, confirmed:
    - 27 Sep is not G+A and 28 Sep is;
    - the report-open, finalization and correction functions carry the new
      wording and are still security definer;
    - the `match_sessions_open_survey` trigger is enabled;
    - `authenticated` can run the admin correction but neither
      `_finalize_one_session` nor the helper, and `anon` cannot run the
      correction.
  - **Deploy ordering** was safe: KUT PR #137 deployed first and needs nothing
    new from the database. The push landed on 27 Sep, the day before the Mon
    28 Sep session, the first whose report-open notice uses the new wording.
  - Rollback: re-run the `kut._finalize_one_session` block from
    `20260925000000` and the `kut._open_session_survey` and
    `kut.admin_correct_session_goals` blocks from `20260920000000` as
    `create or replace`, then drop `kut._uses_combined_count(date)`. Notices
    written in the meantime keep their wording.

## 2026-09-26 — `20261008000000` Midweek archetypes frozen at the open (ADR-099)

Deployed 2026-09-26 from `VibeTrunk/supabase` (catalogue PR #58 there), on its
own data-changing `db push`, before the first lock (Wed 30 Sep 20:00):

- `20261008000000_midweek_archetype_snapshot.sql` (BUILD_SPEC §44.2, §44.11,
  ADR-099, KUT PR #133, tier data-changing) &mdash; a member can no longer
  reshape others' squads by changing their archetype just before the lock.
  - **What changed.** New `kut.midweek_archetype_snapshots`, filled by the
    `after insert` trigger `midweek_tournament_archetype_snapshot` on
    `kut.midweek_tournaments`; `kut._mm_field` plays the snapshot (live
    archetype for a Player without a row); the picker reads the new gated view
    `kut.midweek_archetypes`. OVR, injuries and ownership are still read live
    at the lock.
  - **DML:** backfilled the open week, 2026-09-28, with every Player's
    archetype at the push (into the new table only). Fresh backup
    `20260926-154520`, cold-verified. Pre-push `migration list --linked`
    showed 78 entries with `20261008000000` the only local-only one and no
    remote-only drift, the dry run named exactly that file, and the catalogue
    check reported 78 approved source migrations. Afterwards it showed 78
    entries, all present locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor as `service_role`, one row,
    `2026-09-28 | true | true | true | true | true | false | false | 1`,
    identical to the local run, confirmed:
    - the open week is 2026-09-28 and every Player has a snapshot row for it,
      matching their live archetype;
    - the trigger is enabled and `_mm_field` reads the snapshot;
    - `authenticated` reads the view but not the table, and `anon` reads
      neither;
    - there is one tournament.
  - **Deploy ordering** was safe: KUT PR #133 deployed first, and the picker
    falls back to the live archetype while the view is missing, which is what
    the lock read until the push.
  - Rollback: re-create `kut._mm_field` from `20261005000000` section 4, then
    drop `kut.midweek_archetypes`, the trigger, `kut._mm_snapshot_archetypes()`
    and `kut.midweek_archetype_snapshots`. The lock then reads live
    archetypes again.

## 2026-09-26 — Midweek Madness switched on (operational, no migration)

The launch of Midweek Madness (PR 9 of the build, BUILD_SPEC §44.8): no
migration, an external mutation of production, performed by the owner.

- **Rehearsal first.** The owner ran `admin_midweek_rehearsal` three times on
  `/admin/midweek` with the switch off and no week open (it writes nothing).
  Each run: a field of **22**, matching an independent SQL count of members
  not disabled, not opted out (0 opted out) and owning an unburned card; 0
  picked and 22 auto squads; a **32-slot, 5-round** bracket with **10 byes and
  6 matches** in round 1, then 8 · 4 · 2 · 1; pay per win 17 · 33 · 50 · 67 ·
  83; reveals 20:30 to 22:30. A different real champion each run (Jurie,
  Melle, Cedric). Warnings, info only: no tournament open (everyone auto) and
  the switch paused. No club-break warning: the session of 2026-09-21 is
  published.
- **Backup.** A fresh cold-verified backup, `20260926-102414`, before the
  switch, because switching on starts the coin faucet (ADR-096; the first
  final pays up to 953 coins).
- **The switch failed on the first try:** KB-024, fixed by `20261007000000`
  (entry below) before the launch went on.
- **Switched on 2026-09-26 by the owner** in `/admin/midweek`. The next page
  visit ran the lazy trigger, which opened the first week: **week_start
  2026-09-28, locking Wed 30 Sep 20:00 Amsterdam**, status `open`, the seed
  secret and a 64-character seal published. Checked: `/admin/midweek` shows
  it open, Home shows "Pick your five · Wed 30 Sept", and an ordinary member
  sees the picker on `/club/midweek`; in the SQL editor (tables, not the gated
  views) the switch is on and one tournament exists, as expected.
- **Rollback, in order of severity:** pause the switch (no new weeks; an open
  week still runs, §44.8); void an open or simulated week before payout at
  `/admin/midweek?void=1`, with a reason members read; after payout, correct a
  member with the audited `admin_adjust_wallet`. Nothing re-runs a week. The
  backup above is the last resort.

## 2026-09-26 — `20261007000000` the Midweek switch names its row (KB-024)

Deployed 2026-09-26 from `VibeTrunk/supabase` (catalogue PR #56 there), on its
own additive `db push`:

- `20261007000000_midweek_switch_where.sql` (BUILD_SPEC §44.8, ADR-095,
  KB-024, KUT PR #131, tier additive) &mdash; the launch switch through the API.
  - **What changed.** `kut.admin_set_midweek_enabled` re-created with `where
    id`. Its `UPDATE` of the single-row `kut.midweek_config` had no `WHERE`,
    and PostgREST's `authenticator` role preloads `safeupdate`, which rejects
    that (21000), so the owner's first flip on `/admin/midweek` failed.
    Otherwise identical: checks, errors, grants, return value.
  - **No DML.** It rode the fresh backup taken for the launch,
    `20260926-102414`, cold-verified. Pre-push `migration list --linked`
    showed 77 entries with `20261007000000` the only local-only one and no
    remote-only drift, the dry run named exactly that file, and the catalogue
    check reported 77 approved source migrations. Afterwards it showed 77
    entries, all present locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `true | 0 | false | true | true | false | 0`, identical to the local run,
    confirmed:
    - the function names its row;
    - no `kut` function updates or deletes without a `WHERE`;
    - `anon` cannot execute it, `authenticated` can, and it is still
      security definer;
    - the switch was still off, with no tournament.

    The owner's flip then succeeded (entry above).
  - **Deploy ordering** was safe: KUT PR #131 changes no app code.
  - Rollback: re-create the function from `20261005000000` section 6 (the
    switch is then unusable through the API again).

## 2026-09-26 — `20261006000000` Midweek Madness payouts (ADR-096)

Deployed 2026-09-26 from `VibeTrunk/supabase` (catalogue PR #54 there), on its
own data-changing `db push`:

- `20261006000000_midweek_payouts.sql` (BUILD_SPEC §44.7, §44.14, Part L #26,
  ADR-096, KUT PR #127, tier data-changing) &mdash; Midweek Madness migration
  D: the coins.
  - **What changed.** `wallet_ledger_reason_check` re-created with
    `midweek_win` and `user_notifications_event_type_check` with
    `midweek_result`; the guard table `kut.midweek_rewards` (RLS on, only
    `service_role` select) with its Part L #26 trigger; the internal payout
    `kut._mm_pay_tournament`; `kut._mm_complete_tournament` re-created to pay
    before a week completes; the member view `kut.my_midweek_rewards`.
  - **No DML.** Nothing pays until a tournament exists, which needs the switch,
    still off. Data-changing because it adds a coin faucet and widens the
    ledger, so it took a fresh backup, `20260926-052453`, cold-verified in a
    separate process. Pre-push `migration list --linked` showed 76 entries with
    `20261006000000` the only local-only one and no remote-only drift, the dry
    run named exactly that file, and the catalogue check reported 76 approved
    source migrations. Afterwards it showed 76 entries, all present locally and
    remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `true | tournament_id,week_start,round_no,match_id,bye,amount,paid_at | true | true | 1 | true | false | false | true | 17,33,50,67,83 | false | 0 | 0`,
    identical to the local run, confirmed:
    - RLS is on for the rewards table, and the member view has its columns in
      order;
    - both constraints carry the new value after every earlier one;
    - the guard trigger is in place and the complete step calls the payout;
    - members can neither pay nor read the table, but can read the view;
    - the hosted payout for five rounds is `17 · 33 · 50 · 67 · 83`;
    - the switch is off, no tournament exists, and no `midweek_win` row.
  - **Deploy ordering** was safe: KUT PR #127 only labels `midweek_result` in
    the inbox and adds a constant.
  - Rollback: as in the migration header, with the switch off and nothing
    simulated or completed since.

## 2026-09-26 — `20261005000000` Midweek Madness engine (ADR-090, ADR-091, ADR-095)

Deployed 2026-09-26 from `VibeTrunk/supabase` (catalogue PR #52 there), on its
own additive `db push`:

- `20261005000000_midweek_engine.sql` (BUILD_SPEC §44.3–§44.11, §44.14, Part L
  #25, ADR-095, KUT PR #125, tier additive) &mdash; Midweek Madness migration C:
  the engine, the lazy worker, the stored result, the reveal views and the
  admin controls. No coins yet.
  - **What changed.** The engine as internal `kut._mm_*` functions; six result
    tables (entries, entry cards, pick shares, matches, match events, the
    worker log) with RLS on and only `service_role` select; eight Part L #25
    guard triggers; `voided_at` and `voided_by` on `kut.midweek_tournaments`;
    the service-role worker `kut.run_midweek_due`; five gated views
    (`midweek_matches_public`, `midweek_events_public`,
    `midweek_entries_public`, `midweek_pick_shares_public`,
    `midweek_admin_overview`); `champion_user_id` and `champion_name` appended
    to `midweek_tournaments_public`; the admin RPCs
    `admin_set_midweek_enabled`, `admin_void_midweek` and
    `admin_midweek_rehearsal`.
  - **No DML.** The worker writes only once a tournament exists, which needs
    the switch, still off. It rode the latest scheduled backup
    (`20260923-112450`, cold-verified). Pre-push `migration list --linked`
    showed 75 entries with `20261005000000` the only local-only one and no
    remote-only drift, the dry run named exactly that file, and the catalogue
    check reported 75 approved source migrations. Afterwards it showed 75
    entries, all present locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `6/6 | 5/5 | champion_name | 8/8 | false:false:true | false | true | true | false | 0`,
    identical to the local run, confirmed:
    - the six tables and five views exist;
    - the tournament list ends with `champion_name`;
    - all eight guard triggers are in place;
    - only `service_role` can run the worker, and members cannot run the engine;
    - the hosted engine reproduces a golden draw and the golden lock time for
      the week of 2026-10-26, so the time zone data agrees with the TypeScript
      twin;
    - the switch is off and no tournament exists.
  - **Deploy ordering** was safe: KUT PR #125 has no UI.
  - Rollback: as in the migration header, with the switch off and no
    tournament simulated.

## 2026-09-25 — `20261004000000` archetype cooldown (ADR-089, ADR-094)

Deployed 2026-09-25 from `VibeTrunk/supabase` (catalogue PR #50 there), on its
own additive `db push`:

- `20261004000000_archetype_cooldown.sql` (BUILD_SPEC §44.2, §44.14, ADR-094,
  KUT PR #122, tier additive) &mdash; Midweek Madness migration B: a member may
  change their own Player's archetype at most once every 14 days.
  - **What changed.** A nullable column, `kut.players.archetype_changed_at`,
    with no default. `kut.set_own_player_archetype(text)` now locks the Player
    row, refuses a change within 336 hours of the stamp (`22023`, next allowed
    moment in the DETAIL) and stamps `now()` on an actual change. Grants
    unchanged. The admin path is untouched.
  - **No DML**, nothing backfilled, so every member's first change is allowed.
    It rode the latest scheduled backup (`20260923-112450`, cold-verified).
    Pre-push `migration list --linked` showed 74 entries with `20261004000000`
    the only local-only one, and the dry run named exactly that file.
    Afterwards it showed 74 entries, all present locally and remotely, no
    drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `timestamp with time zone:YES:none | 0 | true | true | false | true`,
    confirmed:
    - the column is a nullable timestamptz with no default;
    - no Player is stamped yet;
    - the function is definer and carries the guard and the row lock;
    - `anon` cannot execute it and `authenticated` can.
  - **Deploy ordering** was safe: `/settings/card` reads the column in its own
    query and treats a missing one as "never changed", so the merge deployed
    ahead of the push harmlessly. The rule applies from the push.
  - Rollback: re-create `kut.set_own_player_archetype` from `20260906000000`,
    then drop the column, as in the migration header.

## 2026-09-25 — `20261003000000` Midweek Madness squad entry (ADR-089, ADR-091)

Deployed 2026-09-25 from `VibeTrunk/supabase` (catalogue PR #48 there), on its
own additive `db push`:

- `20261003000000_midweek_entry.sql` (BUILD_SPEC §44.14, ADR-089, ADR-091, KUT
  PR #120, tier additive) &mdash; Midweek Madness migration A, what a member
  needs to enter a weekly squad knockout. The engine, worker, reveal views and
  payouts follow as their own migrations.
  - **What changed.** Six new tables, each with RLS on and readable by
    `service_role` only:
    - `kut.midweek_config`, the launch switch, off;
    - `kut.midweek_tournaments`;
    - `kut.midweek_tournament_secrets`, the seed (ADR-091);
    - `kut.midweek_squads` and `kut.midweek_squad_cards`;
    - `kut.midweek_opt_outs`.

    Two definer RPCs for `authenticated`: `kut.save_midweek_squad(uuid[])` and
    `kut.set_midweek_opt_out(boolean)`. Three definer views gated on
    `kut.is_active_member()` (ADR-079): `kut.midweek_current`,
    `kut.midweek_tournaments_public` and `kut.my_midweek_squad`.
  - **The only DML** is the switch row in the new `kut.midweek_config`. It rode
    the latest scheduled backup (`20260923-112450`, cold-verified). Pre-push
    `migration list --linked` showed 73 entries with `20261003000000` the only
    local-only one, and the dry run named exactly that file. Afterwards it
    showed 73 entries, all present locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row confirmed:
    - all six tables have RLS on;
    - the switch row is present and off;
    - no tournament exists;
    - `anon` and `authenticated` can read none of the tables, and `anon` none
      of the views;
    - `anon` can execute neither RPC;
    - all three views are definer and gated.

    There is nothing to see in the app yet: no page reads these objects, and
    no tournament exists until the engine migration's worker ships.
  - **Deploy ordering** didn't matter here: no page reads these objects, so
    the merge deployed ahead of the push harmlessly.
  - Rollback: drop the three views, the two functions and the six tables, as
    in the migration header.

## 2026-09-23 — `20261002000000` cast on the market and pack openings (ADR-086)

Deployed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #46 there, marked
applied in #47), on its own additive `db push`:

- `20261002000000_cast_on_market_and_packs.sql` (ADR-086, KUT PR #108, tier
  additive) &mdash; the market and pack openings carry the card's Player, so an
  injured Player's Live card shows the plaster cast there too. With PR #107
  (ADR-085), every card screen now follows one rule: a Live card of a Player in
  injury mode right now.
  - **What changed.** `kut.active_market_listings` and
    `kut.my_pack_opening_results` gain `player_id` and `is_live` as their last
    two columns. Each body is copied from its latest version. Access is
    unchanged: the market keeps its `kut.is_active_member()` gate, and the pack
    view stays a `security_invoker` view over the member's own openings. It was
    never ADR-079 gated and doesn't need to be: ADR-086 explains why a disabled
    member reading their own pack history is not a gap.
  - **Zero DML**, so it rode the latest scheduled backup (`20260923-112450`,
    cold-verified). Pre-push `migration list --linked` showed 72 entries with
    `20261002000000` the only local-only one, and the dry run named exactly that
    file. Afterwards it showed 72 entries, all present locally and remotely, no
    drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row confirmed:
    - both views end in `player_id, is_live`
    - the market view is still definer and gated
    - the pack view is still invoker
    - no `anon` select on either
    - `kut.my_wanted_cards` still resolves

    In the app, `/market` loads normally. No Player is in injury mode on hosted
    today, so the cast itself hasn't been seen there. Locally it was checked on
    the market list, a listing page and a pack result.
  - **Deploy ordering held.** The pages read both views with `select("*")` and
    shipped on merge, before the push. Checked locally against the old views,
    they render with no cast and no error in that window.
  - Rollback (optional, the columns are harmless): drop and re-run
    `kut.my_wanted_cards` and `kut.active_market_listings` from
    `20260928000000` / `20260920060000`, and `kut.my_pack_opening_results` from
    `20260902000000` block 5, as in the migration header.

## 2026-09-23 — `20261001000000` Comeback Form (ADR-083)

Deployed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #44 there, marked
applied in #45), on its own `db push`:

- `20261001000000_injury_comeback_form.sql` (ADR-083, KUT PR #102, tier
  data-changing) &mdash; **Comeback Form**, the second slice of injury mode. The
  first published v2 session a Player attends after an injury period with at
  least 3 protected weeks carries `least(2, 0.25 × protected_weeks)` Form,
  ageing like a session input under the Form cap of 8. Only weeks before the
  return week count, only the first return counts, and periods ending in the
  same return are summed once.
  - **New objects.** `kut.comeback_form_inputs` holds derived rows:
    `kut._rebuild_season_core` deletes and re-derives them from check-ins and
    attendance on every rebuild, like `player_rating_snapshots`. Members read it
    under `kut.is_active_member()`. The rebuild is re-emitted with that
    derivation and a union into the v2 session inputs.
    `kut.player_form_contributions` unions the comeback rows in, with `source`
    and `protected_weeks` appended. The rating story lists a comeback as its own
    row, and the pages read the view with `select("*")`.
  - **Zero DML.** Pushed on a fresh cold-verified backup (`20260923-112450`,
    0 escrowed cards). Pre-push `migration list --linked` showed 71 entries with
    `20261001000000` the only local-only one, and the dry run named exactly that
    file. Afterwards it showed 71 entries, all present locally and remotely, no
    drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row confirmed:
    - the table exists, with RLS on and its one policy
    - no `anon` select
    - zero rows
    - both engine guards
    - both appended view columns

    In the app, Freek's "Why this rating" story still lists three sessions that
    sum to the stated 2.31 Form and +2 OVR, read through the new `select("*")`.
    No comeback row can appear until someone on hosted returns from injury mode
    with 3+ protected weeks.
  - Rollback: `drop view kut.player_form_contributions`, because
    `create or replace` cannot drop the appended columns. Then re-run its
    `20260926000000` block, re-run the `20260930000000` rebuild body, drop the
    table and rebuild the active season.

## 2026-09-23 — `20260930000000` injury mode (ADR-082)

Deployed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #42 there, marked
applied in #43), on its own `db push`:

- `20260930000000_injury_protection.sql` (ADR-082, KUT PR #100, tier
  data-changing) &mdash; **injury mode**. An admin puts a Player with an active
  account into injury mode from `/admin/roster`. Each football week the Player
  sits out, the member does a rehab check-in from Home: +100 KUT Coins, and that
  week's Activity carries over instead of decaying &times;0.90. Form still
  fades, a 🩹 chip marks the Player's Live cards, and injury mode ends by itself
  when the Player attends a published session dated after the injury date.
  Protection is never backdated (owner decision).
  - **New objects.** Tables `kut.injury_periods` (admin-read only; the note may
    hold medical detail) and `kut.injury_check_ins` (primary key
    `(player_id, week_start)`: the stipend's idempotency guard and the only fact
    the rebuild reads). Six functions, the `kut.injured_players` projection gated
    on `kut.is_active_member()`, and a notice trigger on `kut.match_sessions`.
    `wallet_ledger` gains the `injury_stipend` reason and `user_notifications`
    the `injury_check_in` type. Part L #24.
  - **`kut._rebuild_season_core` was re-emitted** with one protected-week guard.
    Its output does not change until a check-in row exists: on the local data a
    rebuild before and after gave zero differences.
  - **Zero DML.** Pushed on a fresh cold-verified backup (`20260923-105756`,
    0 escrowed cards), as the tier requires. Pre-push
    `migration list --linked` showed 70 entries with `20260930000000` the only
    local-only one, and the dry run named exactly that file. Afterwards it showed
    70 entries, all present locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row confirmed:
    - both tables, with RLS on
    - all six functions, the view and the trigger
    - both widened check constraints
    - the engine guard
    - no `anon` execute on `kut.injury_check_in`
    - zero injury periods

    In the app, `/admin/roster` shows the Injury column and Home renders
    normally. The code had shipped ahead of the schema (Vercel deploys on merge),
    and every new read is written to degrade gracefully, so there was no PR #86
    style breakage in between.
  - **Operator note.** Like the ADR-079 views, `kut.injured_players` is gated on
    `kut.is_active_member()`, so a bare `postgres` session in the SQL editor
    reads zero rows from it. Query `kut.injury_periods` directly instead.
  - Rollback: the reverse DDL is in the migration header. It drops the trigger,
    view, functions and both tables, re-runs the `20260920000000` rebuild body,
    and narrows both check constraints after deleting rows that use the new
    values. Once those check-in rows are gone, protected weeks decay again on
    the next rebuild.

## 2026-09-23 — `20260929000000` rating-rules RLS (ADR-081)

Deployed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #40 there), on its
own additive `db push`:

- `20260929000000_season_rating_rules_rls.sql` (ADR-081, KUT PR #98, tier
  additive/access-only) &mdash; `kut.season_rating_rules` gets RLS and one
  policy, `"active members read rating rules"`: `for select to authenticated
  using (kut.is_active_member())`. This was the last `kut` table with RLS off,
  and the last open item from the 2026-09-16 Security Advisor review. Grants
  are unchanged and there is no write policy, so writes stay refused by the
  missing grant.
  - **No `FORCE`.** The three `security definer` paths (the season rebuild and
    the publish-versioning and season-seeding triggers) run as the table's owner
    and keep working through the owner bypass. Measured locally, `FORCE` would
    not break them either, because `postgres` has `BYPASSRLS`. It is left off
    anyway, so those paths rest on ownership rather than on a platform role
    attribute.
  - **Zero DML**, so it rode the latest scheduled backup, `20260922-214356`,
    cold-verified. Pre-push `migration list --linked` showed 68 entries with
    `20260929000000` the only local-only one, and the dry run named exactly that
    file. Afterwards it showed 69 entries, all present locally and remotely, no
    drift.
  - **Smoke-tested on hosted.** In the SQL editor: `relrowsecurity = true`,
    `relforcerowsecurity = false`, the one policy exactly as written, and grants
    unchanged (`SELECT` for `authenticated` and `service_role`, nothing for
    `anon`). The schema-wide check returned no `kut` table without RLS. In the
    app, a superadmin on `/admin/attendance` still sees "This date uses member
    reports" for a post-cutover date. That check is discriminating:
    `sessionUsesMemberReports()` returns `false` when the cutover is missing, so
    a hidden row would have shown the admin-goals wording instead of an error.
    The remaining check, that the next session publishes and finalizes normally,
    waits for a real session.
  - **Operator note.** Like the ADR-079 views, a denied read here returns zero
    rows, not an error. A bare `postgres` psql session is unaffected, because
    that role bypasses RLS.
  - Rollback: `drop policy "active members read rating rules" on
    kut.season_rating_rules; alter table kut.season_rating_rules disable row
    level security;`. Grants are unchanged, so none need re-granting.

## 2026-09-22 — `20260928000000` active-member projection gate (ADR-079)

Deployed 2026-09-22 from `VibeTrunk/supabase` (catalogue PR #36 there, marked
applied in #39), on its own additive `db push` immediately after the one below:

- `20260928000000_active_member_projection_gate.sql` (ADR-079, closing KB-017,
  tier additive/projection-only) &mdash; every member-only definer projection
  now proves an active KUT profile. New `kut.is_active_member()`
  (`stable security definer`, `search_path = kut, pg_catalog`) gates all ten
  `security_invoker = false` views. `security definer` is required: `kut.profiles`
  RLS lets a member read only their own row, so an invoker-rights probe could
  never prove a *foreign* caller has no profile. The service role passes through
  two disjuncts, one per transport &mdash; `auth.role()` for a service-key JWT,
  which carries no `sub`, and `current_setting('role', true)` for a bare
  `set role service_role` session. `current_user` and
  `pg_has_role(session_user, 'service_role', 'member')` are recorded in ADR-079
  as traps: the first is the function *owner* inside a definer body and the
  second is true for everyone, so either would have shipped a no-op that looked
  fixed.
  - **Nothing was flipped to `security_invoker = true`.** That is the Security
    Advisor's generic remedy and it is how KB-013 blacked out the Chronicle;
    these are deliberate cross-RLS club projections.
  - Each view body is copied byte-identically and wrapped as
    `select * from ( &hellip; ) gated where kut.is_active_member()`, because the
    risk was transcription across ten bodies and six source files rather than
    semantics &mdash; and a wrapper makes it structurally impossible for
    `create or replace view` to change a column's name, order or type. `EXPLAIN`
    shows `One-Time Filter`, so a denied caller never executes the body.
  - **Zero DML**, so it rode the backup taken for `20260927000000`
    (`20260922-204443`). Afterwards `migration list --linked` showed 68 entries,
    none pending, no remote-only drift.
  - **Smoke-tested as an ordinary member, which is the only test that counts
    here**: the failure mode is an empty screen, not an error. Home (activity
    feed, Club Value, leaderboard), `/market`, `/leaderboard`, `/club/value`,
    `/market/offers` and a finalized Chronicle issue all rendered populated.
    Under `set role service_role`, `kut.activity_feed` returned 21 rows and
    `kut.chronicle_session_reports` 66 &mdash; the latter consistent with three
    finalized surveys across the roster, so the projection the KB-013 fix
    restored is still whole.
  - **Operator note.** `kut.is_active_member()` is false for a bare psql session
    with no JWT and no `SET ROLE`. An ad-hoc query against any of these ten views
    needs `set role service_role;` first, or it reads zero rows and looks exactly
    like data loss.
  - Rollback: re-emit the ten bodies without the wrapper as
    `create or replace view` &mdash; never `drop view`, because
    `kut.my_club_value` depends on `kut.my_club_value_editions` &mdash; then
    `drop function kut.is_active_member();`. Grants are unchanged, so none need
    re-granting. Fully reversible; no data involved.

## 2026-09-22 — `20260927000000` session-report status is monotonic (ADR-078)

Deployed 2026-09-22 from `VibeTrunk/supabase` (catalogue PR #37 there, marked
applied in #38), on its own `db push`:

- `20260927000000_session_report_status_is_monotonic.sql` (ADR-078, fixing
  KB-020, tier data-changing) &mdash; a submitted session report can no longer
  regress to `draft`. `kut.submit_session_report` derives an effective intent
  from the stored row **before** any validation runs
  (`v_intent := case when v_report.status='submitted' then 'submit' else
  p_intent end`), so a `draft` call against a submitted report is an *edit that
  stays submitted*, held to the same completeness rules that earned the status.
  A guard inside the `on conflict do update` was rejected: it would have held
  the status while letting the row be rewritten under the weaker draft
  validation, leaving a submitted report with a null goal count or an
  incomplete ballot. With the intent promoted first the `on conflict` clause
  needed no change at all &mdash; the BEFORE trigger normalises
  `excluded.status`, `submitted_at` stays
  `coalesce(session_reports.submitted_at, now())`, and the table's
  `check ((status='submitted') = (submitted_at is not null))` holds in all four
  transitions. The reward insert is still `on conflict do nothing`, so nothing
  is ever paid twice.
  - **The backfill matched zero rows on hosted.** Both reconnaissance queries
    run before the push came back empty: no report sat at `status='draft'`
    beside a `session_report_rewards` row, and no survey was open. The reported
    "Draft &middot; Reward paid" row had evidently been re-submitted in the
    meantime, which restores the status and leaves the reward alone. So on
    hosted this shipped as **preventive, not corrective** &mdash; it closed the
    path rather than repairing damage. No false negative was possible: the
    query inner-joins `session_surveys` and `players`, and both keys are
    `not null` with `on delete restrict` foreign keys.
  - **Already-finalized sessions are deliberately never replayed** (owner
    decision, 2026-09-22). `kut._finalize_one_session` is re-runnable and
    `admin_correct_session_goals` calls it exactly that way, but replaying
    would move live OVR retroactively and push `finalized_at` forward. Moot in
    the event, since nothing needed repair, but the decision stands for any
    future occurrence.
  - Pushed on a fresh cold-verified backup (`20260922-204443`) rather than the
    scheduled one, because the tier follows what the file *can* do rather than
    what it happens to do on the day. Afterwards `migration list --linked`
    showed 67 entries, none pending, no remote-only drift.
  - **The UI half shipped ahead of the schema and that was safe**, unlike the
    PR #86 ordering trap: PR #91 removed the "Save draft" button once a report
    is submitted, which degrades gracefully with or without the migration. It
    also gave both buttons an explicit `type="submit"` &mdash; "Save draft" had
    none, so it was the form's default submit button and **Enter in the goals
    field regressed a submitted report with no click at all**.
  - Rollback: re-emit the pre-KB-020 body of `kut.submit_session_report`
    verbatim from `20260920000000_session_reports_rating_v2.sql:242-308`. The
    backfill is not reversible &mdash; nothing records which rows were draft
    beforehand &mdash; but it changed nothing, so there is nothing to reverse.

## 2026-09-16 — `20260926000000` trade log, rating story, listing duration (ADR-072–074)

Deployed 2026-09-16 from `VibeTrunk/supabase` (catalogue PR #34 there), on its
own additive `db push` after everything below:

- `20260926000000_trade_log_rating_story_listing_duration.sql`
  (ADR-072 + ADR-073 + ADR-074, additive) &mdash; **three features in one
  migration**, which is exceptional and authorized once (ADR-075) so the hosted
  schema was pushed once rather than three times. Zero DML: no table created or
  altered, no backfill, no economy or rating formula changed. Each section has
  its own ADR, database test and reverse DDL, and the three touch disjoint
  objects.
  - **ADR-072** &mdash; `kut.create_listing` gains `p_duration_hours`, a 24-or-72
    allow-list, default 24. The two-argument signature is **dropped** first: a
    defaulted third parameter creates an *overload*, not a replacement, which
    would have left a permanently 24-hour entry point alive. Body rebased on the
    `20260911000000` definition so the ADR-042 `held_by_offer_id` escrow guard
    survives. `expires_at` and its 24h column default already existed, and
    expiry was always enforced lazily by `expires_at > now()` predicates &mdash;
    only the value written at insert time moved, and nothing sweeps expired
    listings still.
  - **ADR-073** &mdash; `kut.activity_feed` reports a trade's whole
    consideration. The trade branch reported `coins_to_seller` while every other
    branch reports gross, so it now reports `offered_coins`; **existing trades
    display ~5% higher as a result**, with no row rewritten. `trade_offer_cards`
    was never joined, so a `left join lateral` `array_agg` adds
    `offered_card_names text[]` as the **ninth and last** column &mdash; append
    only, since `create or replace view` cannot reorder.
  - **ADR-074** &mdash; `kut.player_rating_breakdown` and
    `kut.player_form_contributions`, both `security_invoker = true` so
    `session_report_results` stays gated to finalized surveys by
    `kut.is_survey_finalized` (ADR-066); definer views would have bypassed that.
    The OVR split is derived (`live_ovr - floor(form_score + 0.5)`), not
    recomputed, so the halves reconstruct the card face by construction. The
    decay ladder is mirrored from `_rebuild_season_core` and **pinned** by
    `rating_breakdown.test.sql`, which runs the real engine and asserts the
    summed contributions equal `form_score`. Neither view may join
    `kut.session_kudos` (nominator identity) or `kut.session_surveys` (KB-013).
  - Pushed on a fresh cold-verified backup (`20260916-005721`) rather than the
    scheduled one the additive tier allows. Smoke-tested on hosted: a card lists
    for 72 hours with its real expiry, the activity feed returns rows, and a Live
    card renders its rating buildup. Rollback per section is in the migration
    header.
  - **KB-017 overlaps this.** It names `kut.activity_feed` among the definer
    projections granting `SELECT` to `authenticated` without proving an active
    KUT profile. This migration neither caused nor worsened that, but its fix
    must rebase on **this** version of the view or it will silently revert the
    gross-coins change and drop the ninth column.
  - **Deploy-ordering lesson.** Vercel production deploys on merge to `main`, so
    PR #86 shipped code expecting this schema ~2 hours before the schema
    existed: creating a listing failed (`p_duration_hours` against the old
    signature) and the activity feed rendered empty (non-critical by design).
    Nothing crashed, but a migration-bearing PR whose code cannot degrade
    gracefully needs a flag, a tolerant read, or a catalogue push ready to
    follow the merge immediately.

## 2026-09-08 — `20260925000000` kudos award notice detail (ADR-069)

Deployed 2026-09-08 from `VibeTrunk/supabase` (catalogue PR #33 there), on its
own additive `db push` after the batch below:

- `20260925000000_kudos_award_notice_detail.sql` (ADR-069, additive) &mdash;
  the `kudos_awarded` notice from ADR-063 names the categories and says where
  the OVR came from. New immutable `kut._join_names(text[])` renders a list as
  `A` / `A and B` / `A, B and C` (execute to `service_role` only; it is called
  from inside a `security definer` function). `kut._finalize_one_session` is
  `create or replace`d so that body names every recognised category in *ballot*
  order (`array_position` over `session_surveys.category_ids`, not
  `category_id`) and credits this session's goals *and* kudos for the movement
  &mdash; naming the goal count when `effective_goals > 0` ("Your 2 goals and
  these kudos lifted your card rating +3 OVR this week") and claiming no goals
  when it is not ("These kudos lifted&hellip;"). A movement of `<= 0` still adds
  no rating sentence, and no nominator is ever named. Scoring, the season
  rebuild, the `session_results` notice and the idempotency key are untouched;
  no table, constraint, grant or rating-maths change and no DML. Notices already
  written keep the old wording (the existing `on conflict &hellip; do nothing`),
  so the club sees a mix until the next session finalizes. Rollback drops the
  helper and re-runs the ADR-063 finalizer block.

## 2026-09-08 — `20260923000000` + `20260924000000` Chronicle visibility, early finalize (ADR-066, ADR-067)

Deployed 2026-09-08 from `VibeTrunk/supabase` (PR #31 + #32 there) in one
`db push`, both additive and neither changing data:

- `20260923000000_chronicle_results_visibility.sql` (ADR-066, additive) &mdash;
  fixes a live blackout (KB-013) in which only a session's attendees and admins
  could read its finalized Chronicle results; everyone who missed the session
  saw "Results finalized. No report results were recorded."
  `kut.chronicle_session_reports` ran with `security_invoker=true` and
  inner-joins `kut.session_surveys`, whose policy admits only `kut.is_admin()`
  or a member holding a `session_survey_eligibility` row, and the
  `"members read finalized results"` policy failed the same way because
  Postgres applies a referenced table's RLS inside a policy expression. The
  projection becomes `security_invoker=false`, matching its sibling
  `kut.chronicle_session_report_status`, and the policy proves finalization
  through a new `security definer` `kut.is_survey_finalized(uuid)`. Also repairs
  `submitted_reports` / `eligible_accounts` / `attendee_count`, RLS-scoped
  sub-selects that made an attendee compute "1 of 1 reports submitted". The join
  on `status='finalized'` is now the only guard keeping an open session out of
  the projection &mdash; do not drop it. Rollback restores the invoker view and
  the inline-`exists()` policy and drops the function, reinstating the blackout.
- `20260924000000_admin_finalize_session_survey.sql` (ADR-067, additive) &mdash;
  `kut.admin_finalize_session_survey(uuid, text)` lets an admin close a report
  window before its 24 hours elapse, from
  `/admin/attendance/[sessionId]/reports`. A gated front door to
  `kut._finalize_one_session`: same scoring, same `_rebuild_season_core`, same
  `session_results` / `kudos_awarded` notices &mdash; only the timing moves.
  Gated on `kut.is_admin()`, requires a 3&ndash;500 character reason, refuses a
  cancelled survey, returns `already_finalized` instead of raising on a second
  press. `kut.session_surveys` gains nullable `finalized_by` &rarr;
  `kut.profiles(id)` and `finalized_reason`; both stay null on the automatic
  path and on the re-finalization `admin_correct_session_goals` triggers, so
  null means "closed at its deadline". `closes_at` is deliberately not moved
  (the table's `check (closes_at = opened_at + interval '24 hours')` would force
  rewriting `opened_at`), so an early close reads as
  `finalized_at < closes_at`. A member who had not submitted loses the window
  and the 50-coin completion reward; rewards already earned are untouched.
  Rollback drops the function and both columns.

## `20260922000000` kudos cap and award notice (ADR-063), on the 2026-09-06 rating-v2 batch

On top of the rating-v2 / member-reporting batch (`20260916000000` &hellip;
`20260920090000`, deployed 2026-09-06 from `VibeTrunk/supabase`):

- `20260922000000_kudos_cap_two_and_award_notice.sql` (ADR-063, data-changing)
  &mdash; kudos Form ladder becomes 0 / 1 / 1.5 / 2 for 0 / 1 / 2 / 3 recognised
  categories; the combined per-session Form input cap rises 3 &rarr; 3.5
  (`session_report_results.session_input` check widened to `0..3.5`); goals and
  the +8 v2 ceiling unchanged. `user_notifications.event_type` gains
  `kudos_awarded`; `kut._finalize_one_session` is `create or replace`d to apply
  the ladder, snapshot each player's OVR before the season rebuild, and send a
  nominator-free `kudos_awarded` notice stating the OVR change. Existing
  `session_report_results` rows are re-scored and affected seasons replayed;
  raw reports, ballots, rewards, transactions and survey audit times are
  untouched. Rollback restores the narrower ladder/cap and drops the notice.

## 2026-09-04 — `20260914000000` admin self wallet grant (ADR-052)

The hosted `kut` schema was previously applied through
`20260914000000_admin_self_wallet_grant.sql` &mdash; a second,
superadmin-only coin faucet (ADR-052), deployed 2026-09-04 from
`VibeTrunk/supabase` (PR #24 + #25 there):

- `20260914000000_admin_self_wallet_grant.sql` (ADR-052, additive) &mdash;
  `kut.admin_grant_self_wallet(bigint, text, uuid)` credits/claws back the
  *caller's own* wallet (`auth.uid()`), gated to `role = 'superadmin'`.
  `kut.admin_adjust_wallet` (ADR-035) is untouched and still refuses to touch
  the caller's own wallet for every role. New audit tags
  (`wallet_ledger.reason 'admin_self_grant'`,
  `admin_account_events.action 'self_wallet_grant'`) keep self-grants
  distinguishable from admin-to-member grants; a real `p_idempotency_key`
  (backed by a partial unique index) closes a gap `admin_adjust_wallet`
  itself has. Same cap/guards as `admin_adjust_wallet` (`abs(amount) &le;
  100000`, never below zero, 1&ndash;200 char reason). No data change; rollback
  drops the function, the index, and restores the two narrower check
  constraints.

## 2026-09-02 — `20260913000000` Chronicle views (ADR-049)

On top of the TFH Chronicle read projections (ADR-049), deployed 2026-09-02
from `VibeTrunk/supabase` (PR #22 there):

- `20260913000000_chronicle_views.sql` (ADR-049, additive) &mdash; two computed
  read projections behind the Chronicle. `kut.chronicle_weeks` aggregates
  published sessions into one row per football week (session / appearance /
  attendee / goal counts); `kut.chronicle_tier_changes` runs a `lag()` over
  `kut.player_rating_snapshots` to find consecutive weeks where a player's
  rarity tier differs. Both `security_invoker = true, security_barrier = true`,
  `revoke all from public`, `grant select to authenticated, service_role`. No
  data change; rollback is two `drop view`s. Shipped alongside the Panini album
  (ADR-048) and the rating history graph (ADR-047), neither of which needed a
  migration.

## 2026-09-01 — `20260912000000` tester feedback round 2 (ADR-044)

On top of tester feedback round 2, deployed 2026-09-01 in one `db push` from
`VibeTrunk/supabase` (PR #20 there):

- `20260912000000_tester_feedback_round_2.sql` (ADR-044, data-changing for the
  backfill only) &mdash; one migration for four defects + three ideas.
  `create or replace kut.grant_bibs_reward` with the notification body reworded
  ("washing the bibs after" &rarr; "bringing the bibs to") + a scoped,
  reversible backfill of existing `bibs_bonus` `kut.user_notifications` rows;
  new `kut.set_own_club_name(text)` self-service RPC over the dormant
  `kut.profiles.club_name` column (own row, trim, blank&rarr;NULL, &le;80, no
  control chars, not unique); `kut.club_value_leaderboard` `create or replace`d
  to `coalesce` that column with the synthesised `"<name>'s Club"` default
  (`club_value` / `rank` unchanged); new additive `kut.published_sessions`
  summary view backing `/sessions`.

## 2026-08-31 — `20260909000000`–`20260911000000` tester follow-up trio (ADR-040–042)

On top of the tester follow-up trio (ADR-040/041/042), deployed 2026-08-31 in
one `db push` from `VibeTrunk/supabase` (PR #19 there), on top of Batch E:

- `20260909000000_market_listing_card_art.sql` (ADR-040, additive) &mdash;
  `kut.active_market_listings` gains `photo_path` + `seller_id` so `/market`
  renders player card art and hides Buy/Offer on the viewer's own listings.
- `20260910000000_club_value_v2.sql` (ADR-041, data-changing) &mdash; Club
  Value becomes `coins + sum(owned-card discard value) + 4 &times;
  personal-card discard-equivalent`. `kut.my_club_value` dropped + recreated
  (`card_value` &rarr; `owned_cards_value` + personal-card columns);
  `kut.club_value_leaderboard` `create or replace`d. `market_reference_value`
  kept, but only for `get_listing_bounds`.
- `20260911000000_trade_offers.sql` (ADR-042, data-changing) &mdash;
  coin + card escrow trade offers on listings. New `kut.trade_offers` /
  `kut.trade_offer_cards` tables + `kut.user_cards.held_by_offer_id`;
  `propose_trade` / `respond_to_trade` / `withdraw_trade` /
  `expire_trade_offers`; guards added to `create_listing`, `discard_card`,
  `prevent_burning_listed_card`, `cancel_listing`, `buy_listing`,
  `admin_reset_account`, `admin_prepare_account_deletion`.
  `wallet_ledger.reason` += `trade_escrow` / `trade_unescrow` /
  `trade_sale`; `user_notifications.event_type` += `trade_offer` /
  `trade_response`; `kut.activity_feed` gains a `trade` row; new
  `kut.my_trade_offers` view. Accepted trades are never written to
  `kut.market_sales` (invariant #23).

## 2026-08-31 — Batch E, `20260906000000`–`20260908000000` (ADR-036–038)

Batch E migrations (deployed 2026-08-31):

- `20260906000000_goalkeeper_archetype.sql` (ADR-036, E1 / #4) &mdash; a
  seventh `goalkeeper` archetype reusing the six shared attributes with its
  own offset row (sums to 0); widens the `kut.players` archetype `check` and
  `create or replace`s `admin_add_player` / `set_own_player_archetype` /
  `_rebuild_season_core`. No player pre-assigned.
- `20260907000000_bibs_bonus.sql` (ADR-037, E2 / #5) &mdash; a `+100` KUT
  Coins bonus for the session's bibs washer (coins only). Adds
  `kut.match_sessions.bibs_washed_by`, the `kut.bibs_rewards` guard table,
  `kut.grant_bibs_reward`, `bibs_bonus` in the `wallet_ledger.reason` and
  `user_notifications.event_type` checks, and a trailing `p_bibs_washed_by`
  on `publish_attendance_session` / `correct_published_attendance_session`
  (old signatures dropped + recreated).
- `20260908000000_activity_feed.sql` (ADR-038, E3 / #10) &mdash; a read-only
  member-wide `kut.activity_feed` view (sales + listings + pack opens +
  published sessions; sale rows expose the buyer name club-wide).

## 2026-08-30 / 31 — Batches B–D and `20260902000000` (ADR-031, ADR-033–035)

Before Batch E, also deployed 2026-08-31:
`20260905000000_admin_economy_tools.sql` (ADR-035, batch D &mdash;
`admin_adjust_wallet` audited coin faucet + `admin_reset_account` soft club
reset + the `admin_account_events` audit table),
`20260904000000_canonical_coin_name.sql` (ADR-034, batch C &mdash; "KUT
Coins" is the one currency name) and `20260903000000_drop_is_tradeable.sql`
(ADR-033, batch B &mdash; every card tradeable, `is_tradeable` dropped); and,
`20260902000000_starter_reveal_and_rating_snapshots.sql` (ADR-031, deployed
2026-08-30).
