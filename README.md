# Kelderklasse Ultimate Team (KUT)

A browser-based collectible football-card game for Terrible Football
Haarlem (TFH): real attendance and match performance drive a card economy
players collect, open packs of, and trade. Part of the
[VibeTrunk](https://vibetrunk.com) hub.

This repo currently holds only the agent-safety/security scaffold — no
application code yet. Start with [`CLAUDE.md`](CLAUDE.md) for project
context, then [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) for the full
product and technical specification, and [`docs/decisions.md`](docs/decisions.md)
for why this repo looks the way it does (including open items still to be
resolved before implementation starts).

## Status

The local MVP is feature-complete through attendance, Live Cards, invite-only
accounts, starter assets, packs, discard, market, Club Value, and private
market messages. KUT is live at [kut.vibetrunk.com](https://kut.vibetrunk.com),
deployed from its own Vercel project using the shared VibeTrunk Supabase
project's `kut` schema. Hosted migrations are catalogued and deployed only
from the central [VibeTrunk/supabase](https://github.com/VibeTrunk/supabase)
repository. Historical target:
`kut.vibetrunk.com`, deployed as its own Vercel project, using the shared
VibeTrunk Supabase project's `kut` schema.

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

## MVP hardening and operations

The current local hardening plan is in
[docs/MVP_HARDENING_PLAN.md](docs/MVP_HARDENING_PLAN.md). See
[docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md) for the reviewed security
boundaries and [docs/OPERATIONS.md](docs/OPERATIONS.md) for backup and preview
deployment steps. These documents deliberately do not authorize a hosted
Supabase migration or Vercel deployment.

For the next Codex or Claude Code session, start with
[docs/HANDOFF.md](docs/HANDOFF.md).

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

## Economy foundation

New invite claims automatically receive 250 KUT Coins and three distinct
Live Cards. An existing local account created before this feature
will see a **Claim starter pack** button after signing in. This is a one-time,
server-authoritative operation.

Publishing attendance automatically awards 75 KUT Coins to each enabled user
linked to an attending Player. Rewards are recorded once per Player/session in
an immutable ledger, so publishing, correcting, or reactivating a session
cannot duplicate coins. A cancelled session does not claw back coins already
earned, per the MVP correction policy.

## My Club and card details

Any signed-in, enabled member can open **My Club** from Live Ratings at
`http://localhost:3000/club`. It shows only their own active card copies and
their own TF Coin balance. Selecting a card opens its detail page, including
its current Live rating and source. These are read-only views; no browser
route can alter a card or coins.

## Card discard

Any owned card copy can be discarded unless it has an active market listing.
Its detail page shows the current server-calculated value and requires
confirmation before the card is permanently burned. The atomic database
operation records a positive `discard` ledger entry and credits the same
amount to the owner’s wallet.

## Basic pack opening

**My Club** offers one TFH Pack for 250 KUT Coins. It contains three
server-selected Live Card copies; duplicate players are possible.
The purchase, wallet debit, card minting, and saved opening record are one
database transaction. Reloading a saved result page never rerolls the pack.

## Admin economy health

An admin can open **Admin attendance → Economy** to inspect the current pack
pool, expected discard value per slot and pack, expected return percentage,
and compact coin/card totals. The calculation uses the active Live-card pool
and the server-defined rarity weights. It is a read-only warning screen;
changing pack price or odds remains a deliberate future configuration change.

## Transfer market

Any card copy can be listed from its detail page for 24 hours at a
server-validated buy-now price. The card is locked while listed and may be
cancelled by its seller. Signed-in members browse `/market` and buy listings
with KUT Coins. A purchase atomically transfers the card, debits the buyer,
credits the seller, and burns the 5% tax (rounded up, minimum one coin).
