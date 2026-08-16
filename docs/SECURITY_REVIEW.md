# MVP security and integrity review

Reviewed: 2026-08-17

## Confirmed controls

- Every exposed KUT table has RLS enabled and database tests exercise
  anonymous, normal-member, and administrator boundaries.
- Browser code does not receive the service-role key. It is used only by the
  server-side invitation and password-recovery flows.
- Wallet balances, ledger entries, Card Copies, market listings/sales, pack
  results, and attendance rewards have no general browser write policy.
- Economy mutations use database functions with server-side validation,
  idempotency keys where retries can occur, and transaction-local locks.
- `buy_listing` locks the listing and wallets in a stable UUID order, then
  records ownership, wallet/ledger entries, and buyer/seller notifications in
  one transaction.
- Security-definer functions explicitly set a restricted search path.
- Private read projections (`my_collection_cards`, `my_club_value`, messages)
  filter by the authenticated user. The leaderboard exposes only the intended
  public competition fields.
- Route errors now show a generic recovery screen rather than a raw database
  or internal error.

## Regression coverage

The local pgTAP suite covers direct wallet-mint denial, own-vs-other member
reads, admin-only operations, listing/card locks, double-buy idempotency,
market ledger reconciliation, and message ownership/read-state boundaries.

## Remaining pre-alpha check

A true two-client simultaneous-purchase test is still recommended before a
hosted alpha. The current tests prove one sale cannot be completed twice and
the function uses deterministic locking, but do not yet open two independent
authenticated database connections at the same instant. Run that test against
the local stack before adding real members; do not test the race against the
shared hosted project.

## Out of scope

This review is an implementation-level hardening pass, not a third-party
penetration test. Hosted Supabase Auth settings, SMTP, Vercel configuration,
and domain configuration must be reviewed separately during deployment.
