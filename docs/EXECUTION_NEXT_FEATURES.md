# Five-feature implementation execution record

This is the resumable local execution log for
`IMPLEMENTATION_PLAN_NEXT_FEATURES.md`. It distinguishes implementation from
later hosted activation. Nothing in this log authorizes a push, PR, hosted
Supabase mutation, or deployment.

## Starting point — 2026-09-06

- Revision: `56d1474` on local `main`.
- Preserved pre-existing changes: modified `docs/PROGRESS.md`, `docs/README.md`,
  `docs/ROADMAP.md`, `docs/design/README.md`; untracked `design/features/`,
  `docs/design/features/`, `docs/IMPLEMENTATION_PLAN_NEXT_FEATURES.md`,
  `docs/RATING_BALANCE_REVIEW.md`, `docs/SPEC_NEXT_FEATURES.md`, and
  `docs/START_NEXT_FEATURES.md`.
- Required repository, product, implementation, operations, rating-balance,
  framework, and screen-design references read before editing.
- Baseline `npm run verify:fast`: passed (lint, typecheck, 100 tests / 14 files).
- The existing local Supabase stack points to loopback. Its database is not a
  clean migration target: `npx supabase migration up --local` reports
  `20260912000000` pending while `kut.published_sessions` already exists.
  Existing local data will not be reset or discarded; database work will use an
  isolated local target and this drift remains an explicit baseline condition.

## Slice checkpoints

- [x] A — frozen Special-edition scaffolding; zero issuance.
- [x] B — duplicate-sensitive Club Value.
- [x] C — quoted/replay-safe 175-coin basic packs and EV report.
- [x] D — private wants, explicit availability, channel-neutral contact handoff, direct Settings.
- [x] E1–E3 — reports, exactly-once reward, admin/guest corrections.
- [x] E4 — versioned rating rebuild and historical snapshot parity.
- [x] E5–E6 — finalization, observability, member/admin/Chronicle journeys.
- [ ] Integrated unit, pgTAP, concurrency, authenticated browser, build and visual gates.
- [x] Five review/operator handoffs and activation blockers recorded.

## Hosted state

Local implementation only. No catalogue copy, hosted migration, push, PR,
merge, deployment, scheduler installation, or production-data mutation has
been performed.

## Completed local checkpoints — 2026-09-06

- Applied migrations `20260916000000` through `20260920050000` to the local
  stack only after repairing its pre-existing local migration ledger drift;
  no hosted project was contacted.
- Local pack EV measurement: 29 eligible Live editions, 29.15 expected discard
  per card, 87.46 per pack, 49.98% expected return at the required 175 price.
  This is evidence for local code only, not a hosted activation measurement.
- `npm run test:db` passes: 14 pgTAP files, 435 assertions. Coverage includes
  zero Special issuance, duplicate projections, quoted packs, want privacy and
  cleanup, exactly-once rewards, finalization, guest corrections, SQL/TS v2
  Form fixture parity and history snapshots.
- Focused local concurrency test passed: same-key pack replay debits 175 once;
  insufficient/stale quotes debit nothing; simultaneous report submissions pay
  the 50-coin reward once.
- `npm run verify:fast` passes (lint, TypeScript, 108 unit tests) and
  `npm run build` compiles successfully. The existing Playwright auth-boundary
  runner did not return a report or open its configured local port in two local
  attempts; its orphaned local Node processes were stopped. Authenticated
  mobile journey validation remains an explicit release gate.

## Mobile walkthrough findings resolved — 2026-09-06

- Unified wanted editions and available owned copies on one Trading preferences
  screen with consistent selectors; the former trade-cards URL now redirects to
  the Available section. Conversation copy is channel-neutral.
- Added `20260920060000_wanted_market_listing_visibility.sql`: wanted cards use
  the public Market projection, so an active admin-owned listing is visible
  without weakening card-ownership RLS.
- Restored the Settings Admin destination for both `admin` and `superadmin`.
- Attendance now has an explicit calendar button and displays the frozen season
  cutover. Legacy dates retain admin goal entry; v2 dates explain that publishing
  opens member reports for 24 hours. Publication redirects with the session ID,
  and eligible session routes prefer the report over Chronicle.
- Rebuilt Chronicle promotion rows so tier text sits beside, not inside, the
  fixed-size colour swatches.
- Added `20260920070000_rating_rules_read_permission.sql` so authenticated Admin
  screens can read the non-sensitive cutover date.
- Verification after feedback: `npm run verify:fast` passes 17 files / 110 tests;
  pgTAP passes 14 files / 438 assertions; the focused concurrency suite passes
  3 tests; production build passes. The browser connection was unavailable and
  the repository Playwright process hung before producing any test output, so
  the signed-in visual retest remains user-observed rather than claimed here.

## Chronicle open-state and kudos feedback — 2026-09-06

- Chronicle now uses a privacy-safe aggregate projection for open surveys. It
  shows the real open deadline, submitted/eligible count, aggregate goals so far
  and the current member's Add/View report action; individual provisional goals
  and ballots remain private.
- Open goals also feed the weekly Chronicle standfirst and matchday total. Only
  finalized effective results and recognized categories are shown per player.
- Local ballot inspection for session `7221416a-4568-4b9c-b7c9-3872ac3969cd`
  confirmed four Difference Maker votes for Alex Example and three Playmaker
  votes for Charlie Fixture. Both were one qualified category under the stored
  ballots.
- Adopted the feedback ladder 0 / 1 / 1.25 / 1.5 kudos Form for 0 / 1 / 2 / 3
  recognized categories. The +1.5 kudos and +3 combined session caps remain.
- Migrations `20260920080000_chronicle_open_progress_and_kudos_ladder.sql` and
  `20260920090000_chronicle_database_deadline.sql` update the projection and
  finalizer, keep deadline state database-authoritative, and deterministically
  replay derived results without changing raw reports, ballots, reward receipts
  or transaction history.
- Verification: fast gate passes 17 files / 110 tests; pgTAP passes 14 files /
  444 assertions; focused concurrency passes 3 tests; production build passes.
