# Operations and deployment checklist

KUT is live at `https://kut.vibetrunk.com`. This document covers alpha
operations; following it does **not** itself authorize a hosted schema change.

## Shared migration authority

The shared Supabase project has one global migration ledger. Hosted schema
changes must be catalogued, reviewed, backed up, dry-run, and applied only
from [`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase). KUT keeps
matching migration files only so its local stack and database tests reproduce
the hosted schema. Do not run a hosted `supabase db push` from this repository.

## Hosted migration process (risk-tiered)

There is **no PITR and no managed backup** on the shared project's plan
(`docs/BACKUP.md`), so the encrypted logical dump is the only way back to a
known-good state. That makes a pre-migration backup load-bearing — but only
for migrations that can actually lose data. Classify every migration first,
then run the matching checklist. When unsure, treat it as data-changing.

- **Additive** — new table / view / function, `create or replace` of a
  function or view, a new column with a default or nullable, a new index, a
  new `check`/enum value. Nothing existing is rewritten or dropped.
- **Data-changing** — a backfill `update`/`delete`, `drop`/`rename`/retype of
  a column, anything that triggers a rating rebuild (e.g. reassigning an
  existing player's archetype), or any change to `wallets`, `wallet_ledger`,
  `user_cards`, `market_listings`, or `market_sales` semantics.

Always, both tiers:

1. Confirm the shared Supabase project and database branch in scope. KUT uses
   the `kut` schema and must not affect other VibeTrunk schemas.
2. Matching reviewed migration files exist in **this** repo and in the
   `VibeTrunk/supabase` catalogue (ADR-021); catalogue parity check passes.
3. `npx supabase db push --dry-run` reviewed line by line.
4. Local `npm run verify:fast && npm run test:db` passes. CI's `verify`
   workflow runs the rest on every PR (`build`, `test:e2e`, and `test:db`
   against a fresh local stack) — running `verify:full` locally per migration
   is not required.
5. Explicit sign-off, then the real push from `VibeTrunk/supabase` only.

Data-changing tier also requires, before the push:

6. A **fresh** `scripts/backup-kut-hosted.ps1` run (not just the last
   scheduled one), its timestamp recorded in `.private-backups/BACKUP_LOG.md`.
7. Write the migration to be reversible in SQL where practical — add a column
   instead of mutating one, or snapshot pre-state into a scratch table in the
   same migration — so a bad outcome is a one-line rollback, not a restore.

Additive tier relies on the most recent **scheduled** backup instead of a
fresh one. Keep that cadence tight (see `docs/BACKUP.md` — at least weekly
once members trade, ideally right before each session) so "most recent
scheduled backup" is never stale. Residual risk accepted: an additive
migration that breaks in a way a follow-up migration cannot cleanly fix would
fall back to that scheduled backup, losing whatever happened since.

The restore drill (`docs/BACKUP.md`) is **periodic, not per-migration** — run
it before the first real invite, then roughly monthly or whenever the schema
changes shape significantly.

Git migrations are necessary but are **not** a backup of user accounts,
wallets, cards, sessions, or market history.

## Preview deployment preflight

1. Run `npm run verify:full` locally with Docker running.
2. Review `docs/SECURITY_REVIEW.md` and resolve or consciously accept the
   remaining local two-client market-race check.
3. In the central migration repository only, link the intended hosted
   Supabase project after confirming its project reference. Run the catalogue
   parity check and `npx supabase db push --dry-run`; review every listed
   migration. Do not run the real push without explicit approval and a fresh
   backup.
4. In Vercel, configure Preview and Production environment values separately:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `APP_URL`. The service-role key is server
   only and must never use a `NEXT_PUBLIC_` prefix.
5. _Stale._ The CSP now lives in `src/proxy.ts`, not `vercel.json`
   (`vercel.json` no longer has a `Content-Security-Policy` header at all).
   `src/proxy.ts` derives `connect-src` / `img-src` from
   `NEXT_PUBLIC_SUPABASE_URL` at request time, with a hosted-project fallback,
   so no manual host substitution is needed — just make sure the updated
   `src/proxy.ts` ships with any change that adds a new CSP source (e.g. the
   `img-src blob: <supabase>` addition for player-card photos).
6. Confirm hosted Supabase Auth disables public self-sign-up and configure
   approved redirect URLs for the preview and production domains.
7. Deploy a preview only after explicit authorization. Do not make preview
   deploys run database migrations automatically.
8. Smoke-test invite claim, member sign-in, admin attendance publish, pack
   opening, discard, market buy/sell, messages, and mobile navigation using
   fictional accounts before inviting real members.

## Follow-ups

- Confirmed 2026-08-19: hosted Supabase Auth has public self-sign-up disabled
  and the Site URL is `https://kut.vibetrunk.com`. The redirect URL allow-list
  includes `https://*-vibetrunk.vercel.app/**`, which is scoped to the whole
  `vibetrunk` Vercel team rather than just KUT's own previews — any preview
  deployment under that team is currently a valid auth-redirect target for
  KUT sessions. Not a blocker for inviting real members to the production
  URL, but narrow it to KUT's own preview pattern (e.g.
  `https://kut-*-vibetrunk.vercel.app/**`) when convenient.

## Alpha operations

- Start with 5–10 trusted members and one or two weeks of sessions.
- Monitor the admin economy view, failed-action logs, market liquidity, and
  member feedback; do not change formulas after a single unusual outcome.
- Keep the local migration/test workflow working. Every hosted schema change
  must first exist as matching reviewed files in KUT and the central catalogue,
  and pass locally before central deployment. Run it through the risk-tiered
  checklist above.
- Run `scripts/backup-kut-hosted.ps1` on a regular schedule appropriate to the
  group’s activity (at least weekly once members trade). A **fresh** run is
  additionally required before a data-changing migration; an additive
  migration rides on the last scheduled backup. Run the
  [`docs/BACKUP.md`](BACKUP.md) restore drill once before the first real
  invite, then periodically — not per migration.
