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

See [`docs/BACKUP.md`](BACKUP.md) for the `kut`-schema backup script
(`scripts/backup-kut-hosted.ps1`), the restore drill, and the cadence. The
steps below are the schema-change-specific checklist.

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
  and pass locally before central deployment.
- Run `scripts/backup-kut-hosted.ps1` on a regular schedule appropriate to the
  group’s activity and before any material change. Take a fresh backup and run
  the [`docs/BACKUP.md`](BACKUP.md) restore drill once before the first real
  invite.
