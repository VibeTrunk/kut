# Next features: review and operator handoff

Local implementation only, 2026-09-06. This document is deliberately split by
the repository's migration/RPC/invariant review boundary. No PR, push, hosted
Supabase mutation, deployment or scheduler installation has occurred.

## A — Special scaffolding

- Review: `20260916000000_special_edition_scaffolding.sql`,
  `special_editions.test.sql`, `src/game/card-editions.ts`.
- Confirm required frozen snapshot fields and immutable Special rows.
- Operator action: none. Verify the hosted preflight remains zero Special
  editions/copies. A future issuance proposal needs its own migration/review.

## B — Duplicate Club Value

- Review: `20260917000000_duplicate_club_value.sql`, compatibility grant
  `20260920020000_club_value_projection_permission.sql`, `club_value.test.sql`
  and the Collection/Club Value screens.
- Confirm 100% / 20% / 5% / 0% is grouped per edition, while discard remains
  full value.
- Operator action: apply migrations in order; do not recalculate or mutate
  historical ownership manually.

## C — Basic packs

- Review: `20260918000000_basic_pack_175.sql`, pack actions/UI,
  `next-features-race.test.ts`, `scripts/measure-pack-ev.mjs`.
- Confirm price=175, exact three-card packing, expected-price rejection before
  debit, and idempotency replay.
- Operator action: immediately before hosted activation run
  `node scripts/measure-pack-ev.mjs` against a fresh hosted roster and retain
  its output. Local result (87.46 / 49.98%) is not release evidence. An
  unmeasured or critical hosted EV is an activation blocker, not permission to
  alter the requested price or odds.

## D — Wants and availability

- Review: `20260919000000_wants_trade_availability.sql`, compatibility
  `20260920030000_want_edition_availability_columns.sql`, listing visibility
  `20260920060000_wanted_market_listing_visibility.sql`, collection screens
  and `next_features_contracts.test.sql`.
- Confirm owner RLS, 100/30 caps, automatic availability cleanup and no
  reciprocal matching/escrow transfer path.
- Operator action: no job is needed. Members use the generated prompt to contact
  each other through their chosen channel and existing Market/Offers routes for any exchange.

## E — Reports, ratings and finalization

- Review: `20260920000000_session_reports_rating_v2.sql`, hardening migrations
  `20260920010000`, `20260920040000`, `20260920050000`, `20260920060000`,
  `20260920070000`, `20260920080000`, `20260920090000`, report/admin/Chronicle
  screens, rating unit tests and pgTAP contracts.
- Confirm 24-hour survey, 50 coins once per player/session, explicit zero/skip
  validity, audit-only corrections, v2 cutover and snapshots.
- Operator action: install a bounded service-role scheduler calling
  `kut.finalize_session_surveys(20)` on the agreed cadence; monitor failed jobs
  and use the same RPC as a manual bounded fallback. Do not grant member roles
  access to the finalizer.

## Local evidence and outstanding release gates

- `npm run test:db`: PASS, 14 files / 444 assertions.
- Focused local race suite: PASS (pack replay/stale price/report reward).
- `npm run verify:fast`: PASS (lint, typecheck, 110 unit tests); `npm run build`:
  PASS. The repository's Playwright auth-boundary runner produced no completion
  report locally, so it is not counted as evidence.
- Hosted preflight: encrypted backup round-trip passed at
  `%USERPROFILE%\\backups\\kut\\kut-backup-20260906-212310.sql.enc`
  (SHA-256 `D57E2E45DFCFAE05EB21AFFA06E59902915F5E201DDB6AA4326BEEF5B0646559`),
  and hosted-roster EV measured 32 live cards, 108.62 expected discard coins
  per pack, 62.07% return at the requested price of 175.
- Remaining before release: central catalogue PR/dry-run, bounded finalizer
  scheduler setup, and the authenticated browser/mobile walkthrough. Hosted
  Supabase activation and application merge remain separately reviewable
  operator actions; no hosted mutation has occurred.
