# Kelderklasse Ultimate Team (KUT)

A browser-based collectible football-card game for Terrible Football
Haarlem (TFH): real attendance and match performance drive a card economy
players collect, open packs of, and trade. Part of the
[VibeTrunk](https://vibetrunk.com) hub.

Start with [`CLAUDE.md`](CLAUDE.md) for project context, then
[`docs/README.md`](docs/README.md) — the documentation map: what each document
is for and the order to read them (`BUILD_SPEC.md`, `PROGRESS.md`,
`decisions.md`, then `ROADMAP.md` for what's next).

## Status

The MVP is feature-complete: attendance rewards, Live Cards, invite-only
accounts, starter assets, packs, discard, the transfer market, Club Value, a
private message inbox, and a club-wide activity feed on the home page. Later
tester-feedback batches added the "KUT Coins" currency name, a Goalkeeper
archetype, a bibs-washing coin bonus, and admin economy tools. KUT is live at
[kut.vibetrunk.com](https://kut.vibetrunk.com), deployed from its own Vercel
project using the shared VibeTrunk Supabase project's `kut` schema. Hosted
migrations are catalogued and deployed only from the central
[VibeTrunk/supabase](https://github.com/VibeTrunk/supabase) repository.

## Current foundation

KUT now has a Next.js application, local Supabase configuration, Vitest,
Playwright, database smoke testing, and CI. Read [CLAUDE.md](CLAUDE.md),
[docs/BUILD_SPEC.md](docs/BUILD_SPEC.md), and [docs/PROGRESS.md](docs/PROGRESS.md)
before implementation work.

## Local development

Prerequisites: Node.js 20.9+ and Docker Desktop running.

```powershell
npm ci
npx supabase start
npx supabase migration up --local
npm run dev
```

The local Supabase stack is independent from the shared hosted project. Use
the local stack for migrations and tests; do not point automated tests at the
production database.

## Verification

```powershell
npm run verify:fast  # lint, typecheck, unit tests
npm run test:e2e     # requires Playwright Chromium once installed
npm run test:db      # requires `npx supabase start`
npm run test:market-race # two concurrent local PostgreSQL buyers; requires `npx supabase start`
npm run verify:full  # all checks plus production build
```

Install the local browser once with:

```powershell
npx playwright install chromium
```

## Operations

[docs/OPERATIONS.md](docs/OPERATIONS.md) is the deploy / migration runbook
(shared-migration authority, the risk-tiered hosted-migration checklist,
preview-deploy preflight); [docs/BACKUP.md](docs/BACKUP.md) is the
backup / restore runbook; [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md)
records the reviewed security boundaries. None of these authorize a hosted
Supabase migration or Vercel deployment on their own. The completed MVP
hardening plan is archived in
[docs/archive/](docs/archive/MVP_HARDENING_PLAN.md).

## Environment

Copy `.env.example` to `.env.local` and add only the browser-safe Supabase
URL/publishable key when the app begins using Supabase. Keep the service-role
key server-only, never commit it, and never expose it through a
`NEXT_PUBLIC_` variable.

Invite onboarding also needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
For local development, obtain it from `npx supabase status -o env`; it is used
only by the server action that creates an invited user's Auth record, never by
browser code.

## Local admin access

Public registration is disabled. To create a local-only admin for development,
start the local Supabase stack and apply any new local migrations after pulling
changes:

```powershell
npx supabase start
npx supabase migration up --local
```

Then open Supabase Studio at `http://127.0.0.1:54323`, add an email/password
user under Authentication, and run this in the Studio SQL editor with that
user's UUID:

```sql
insert into kut.profiles (id, display_name, role)
values ('<auth-user-id>', 'Local Admin', 'admin')
on conflict (id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    is_disabled = false;
```

Sign in at `http://localhost:3000/login`. Admin attendance is published only
through a server action and a database function; the browser does not receive
permission to write attendance or ratings directly.

Published sessions can be corrected from the lower section of
`http://localhost:3000/admin/attendance`. A correction requires a short
reason, records the previous and replacement attendance in an admin-only audit
log, and rebuilds all Live Ratings.

From that same correction page, an admin can cancel a published session. This
is intentionally not a delete: the session and cancellation reason remain in
the audit trail, while its attendance stops affecting Live Ratings after the
automatic rebuild. Cancelled sessions remain visible in the admin list, can be
corrected while inactive, and can be reactivated with a reason. Their date and
session type are available for a new draft or published session while they are
cancelled.

## Invite onboarding

After signing in as an admin, open `http://localhost:3000/admin/invites`,
choose an unlinked Player, and create an invite. Copy the generated link and
share it manually. The recipient opens that link, supplies an email/password,
and receives a normal KUT account linked to that Player. The raw token is
shown only once and expires after 14 days.

Password recovery is not configured for local development or production yet.
Until custom SMTP is added, an admin must assist a member who loses access.

An enabled KUT admin can set a member's temporary password at
`http://localhost:3000/admin/accounts`. Enter a reason and share the password
through a secure channel. The password is sent only to Supabase Auth and is
never stored in KUT's database; the admin, target, reason, time, and result
are recorded. Ordinary admins may reset normal member accounts only;
superadmins may also reset administrator accounts. No administrator can reset
their own password through this tool.

## How the game works

The player-facing walkthrough — attendance rewards, Live Ratings, rarity,
cards, packs, discard, the transfer market, Club Value, trade offers, and the
message inbox — is the in-app **How KUT works** page (`/how-it-works`). The
authoritative rules are `docs/BUILD_SPEC.md` Parts IV–XIII; canonical numbers
(reward amounts, pack price, market tax) are `BUILD_SPEC.md` Part 145 and
`src/game/economy.ts`. `docs/PROGRESS.md` is the dated build history.
