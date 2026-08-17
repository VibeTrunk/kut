# Operations and deployment checklist

KUT is live at `https://kut.vibetrunk.com`. This document covers alpha
operations; following it does **not** itself authorize a hosted schema change.

## Shared migration authority

The shared Supabase project has one global migration ledger. Hosted schema
changes must be catalogued, reviewed, backed up, dry-run, and applied only
from [`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase). KUT keeps
matching migration files only so its local stack and database tests reproduce
the hosted schema. Do not run a hosted `supabase db push` from this repository.

## Backup before any hosted schema change

1. Confirm which shared Supabase project and database branch are in scope.
   KUT uses the `kut` schema and must not affect other VibeTrunk schemas.
2. Create or confirm a database backup using the hosted project's supported
   backup/export facility. Store its timestamp, project reference, and restore
   instructions in the private operator record.
3. Create a second encrypted logical export with access restricted to the
   project owners. Keep database connection strings and exports out of this
   repository, issue trackers, chat logs, and browser storage.
4. Verify a restore path in a non-production environment before relying on a
   backup for an alpha. A restore of the shared project can affect every
   VibeTrunk tool, so it needs explicit coordination.

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
5. Replace the placeholder Supabase host in `vercel.json`'s CSP
   `connect-src` directive with the exact hosted project hostname before
   deployment.
6. Confirm hosted Supabase Auth disables public self-sign-up and configure
   approved redirect URLs for the preview and production domains.
7. Deploy a preview only after explicit authorization. Do not make preview
   deploys run database migrations automatically.
8. Smoke-test invite claim, member sign-in, admin attendance publish, pack
   opening, discard, market buy/sell, messages, and mobile navigation using
   fictional accounts before inviting real members.

## Alpha operations

- Start with 5–10 trusted members and one or two weeks of sessions.
- Monitor the admin economy view, failed-action logs, market liquidity, and
  member feedback; do not change formulas after a single unusual outcome.
- Keep the local migration/test workflow working. Every hosted schema change
  must first exist as matching reviewed files in KUT and the central catalogue,
  and pass locally before central deployment.
- Review and perform a backup/export on a regular schedule appropriate to the
  group’s activity and before any material change.
