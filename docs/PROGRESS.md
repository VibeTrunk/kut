# Current phase

Hosted alpha — feature-complete MVP live at `https://kut.vibetrunk.com` (see
the "Hosted alpha deployment" entry below). The sections immediately below
describe the original Phase 0 foundation; read the dated entries further down
for the full history through the current hosted state.

# Completed

- Next.js 16 App Router application with strict TypeScript, Tailwind CSS, and
  ESLint.
- Local Supabase CLI configuration, an initial `kut` schema migration, and a
  pgTAP schema smoke test.
- Vitest unit-test and Playwright end-to-end-test foundations.
- `verify:fast` and `verify:full` scripts.
- GitHub Actions verification workflow alongside the existing gitleaks scan.
- Local development, environment, and verification instructions in README.

# In progress

Vercel preview deployment is pending explicit authorization and project setup.

# Tests currently passing

- `npm run verify:fast`
- `npm run test:e2e` (Chromium)
- `npm run test:db` (local pgTAP)
- `npm run verify:full`

# Known failures

- None known.

# Local environment notes

- The host's npm safety policy reports deferred install scripts for `esbuild`,
  `supabase`, and `unrs-resolver`. All Phase 0 checks pass without approving
  them. Do not approve package scripts without reviewing them first.

# Next recommended task

Phase 1A, first slice: implement the players, seasons, profiles,
match-sessions, attendance, and player-season-state migrations with RLS and
fictional test fixtures. Do not begin invitation onboarding or the economy
until those data/security foundations and the rating engine pass tests.

# Manual setup still required

- Link this repository to the shared Supabase project only when ready to
  inspect/deploy migrations. Never run a real `supabase db push` without
  deliberate approval.
- Replace the placeholder Supabase host in `vercel.json` after the project
  reference is known.
- Create/link the Vercel project and deploy a preview only with explicit
  authorization.

# Database migrations added

- `20260816000000_create_kut_schema.sql`

# Environment variables added

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; pre-existing contract retained)

## Phase 1A update — 2026-08-16

This update supersedes the Phase 0 status above. The first Phase 1A slice is
complete: players, profiles, seasons, sessions, attendance, and derived
player-season state are migrated in the `kut` schema; RLS denies anonymous
roster access and limits writes to enabled admins; the deterministic rating
engine has 13 unit tests and a fictional player-ratings preview.

The next recommended slice is the admin-only session publish/rebuild
operation and mobile attendance form. Keep invite onboarding and the economy
out of scope until that operation has passing database and integration tests.

Additional migration: `20260816010000_phase_1a_roster_and_ratings.sql`.

## Attendance-flow update — 2026-08-16

Added the mobile attendance interface at `/admin/attendance` and a protected
database foundation for `publish_session` and `rebuild_season`. The interface
is an interaction preview only: it does not mutate data until Supabase SSR
authentication and a local admin account are implemented. Both functions
require an enabled admin role, publish only draft sessions, and rebuild all
player-season state from published history.

Additional migration: `20260816020000_publish_and_rebuild_sessions.sql`.
The next required slice is SSR email/password sign-in for manually provisioned
local admins, followed by wiring this form to those server-authoritative
operations. Invite claim onboarding remains later work.

## Secure admin publishing update â€” 2026-08-16

The attendance flow is now a real, protected local workflow. Supabase SSR
cookie clients and the Next.js proxy refresh sessions; `/admin/attendance`
requires both a verified Supabase claim and an enabled `admin` or `superadmin`
profile. Public registration is disabled in local Supabase configuration and
the UI exposes sign-in only.

An admin selects the date, session type, attendees, and optional goals, then
submits a Next.js server action. The action verifies the admin again, finds the
active season, and calls `kut.publish_attendance_session`. That database
function validates input, creates the draft session and attendance rows,
publishes it, and rebuilds season state in one transaction. The browser never
writes roster, sessions, attendance, or ratings directly.

Additional migration: `20260816030000_publish_attendance_session.sql`.

Tests passing:

- `npm run verify:fast` (13 unit tests)
- `npm run test:db` (11 pgTAP tests)
- `npm run test:e2e` (unauthenticated admin route redirect)
- `npm run build`
- one local browser smoke flow: fictional admin sign-in, attendance publish,
  and rebuild confirmation

Manual setup: create a local user in Supabase Studio and give it an enabled
`kut.profiles` admin role; exact SQL is in `README.md`. Hosted Supabase and
Vercel remain deliberately untouched. Before production use, create the admin
profile through a controlled provisioner and apply the equivalent hosted Auth
setting that disables public registration.

Next recommended task: add the reusable Live Card visual system, then invite
claim onboarding. Do not start wallets, packs, or market operations yet.

## Live Ratings update â€” 2026-08-16

The homepage now renders the current active-season ratings from the local
database rather than hard-coded demo data. A published attendance session
therefore updates the visible OVR, attributes, and rarity after the existing
rebuild and root-page revalidation.

The page reads the narrow `kut.public_live_ratings` view. It exposes only
public in-game card fields: chosen display name, archetype, OVR, attributes,
and rarity. It does not expose profiles, email addresses, attendance history,
photos, admin notes, or hidden activity/form scores. Anonymous users retain no
direct table access; their read permission is limited to this view.

Additional migration: `20260816040000_public_live_ratings_view.sql`.

Tests passing:

- `npm run verify:fast`
- `npm run test:db` (13 pgTAP tests)
- `npm run test:e2e` (2 Chromium tests)
- `npm run build`

Next recommended task: extract the rating tile into a reusable Live Card
component and add the six rarity treatments. Invite claim onboarding remains
the next authentication milestone.

## Live Card visual-system update â€” 2026-08-16

`src/components/live-card.tsx` is now the reusable Live Card component used by
the ratings page. It has a CSS-rendered layered frame, portrait/initials
fallback, compact six-stat grid, OVR, display name, archetype, and a textual
rarity label. All six tiers have distinct frame treatments: Common, Bronze,
Silver, Gold, Holo, and Elite.

Holo and Elite use a subtle CSS shine; `prefers-reduced-motion` disables that
animation. Rarity is also written as text, so no card meaning depends on color
or hover. The `detail` size is available for future player and collection
pages without changing the rating data model.

Tests passing:

- `npm run verify:fast` (13 unit tests)
- manual mobile browser visual check of published local player data

Next recommended task: invite claim onboarding. The visual component is ready
to be reused in collection, pack, and market interfaces later.

## Invite-only onboarding update â€” 2026-08-16

Admins can now create a one-time invitation at `/admin/invites` for an active
Player without an existing linked account. A cryptographically random token is
shown as a shareable link exactly once; only its SHA-256 hash is stored in
`kut.invitations`, which records creation, expiry, and consumption.

Recipients open `/invite/<token>` and submit an email/password. A server
action validates input, creates the Auth user using the server-only service
role, calls the service-role-only `kut.claim_invitation` function, links the
new profile to the invited Player, and permanently consumes the invite. If the
claim fails, the newly created Auth user is removed. Public self-registration
remains unavailable.

Additional migrations:

- `20260816050000_invite_onboarding.sql`
- `20260816050100_preserve_consumed_invite_audit.sql`

Tests passing:

- `npm run verify:fast` (15 unit tests)
- `npm run test:db` (20 pgTAP tests)
- `npm run test:e2e` (3 Chromium tests)
- local browser smoke flow: create invite, claim it, and sign in as the new
  normal user

Manual setup: local/hosted server environments need `SUPABASE_SERVICE_ROLE_KEY`.
No password-recovery email flow exists yet; use an admin-assisted recovery
process until custom SMTP is configured.

Next recommended task: finish the Phase 1A correction workflow, allowing an
admin to safely amend a published session and trigger the deterministic
rebuild. Do not build starter assets or currency until wallet/ledger tables
are implemented atomically.

## Published-session correction update — 2026-08-16

Phase 1A is complete locally. Admins can open any of the latest published
sessions from `/admin/attendance`, amend its date, type, attendance, or goals,
and provide a mandatory reason. `kut.correct_published_attendance_session`
locks the published session, records both the previous and replacement values
in `kut.session_corrections`, replaces the attendance, and rebuilds the whole
season in one transaction. The public ratings page is revalidated after a
successful correction.

The correction page and Server Action require an enabled admin role; the RPC
checks that role independently. Its audit table is read-only to admins through
RLS, and normal users cannot call the RPC. Existing inactive attendees can be
retained while correcting a historical session, but new inactive attendees are
still rejected.

Additional migrations:

- `20260816060000_correct_published_sessions.sql`
- `20260816060100_grant_session_correction_reads.sql` (restores the missing
  table-level read grant required in addition to RLS for the admin audit view)

Tests passing:

- `npm run verify:fast` (15 unit tests)
- `npm run test:db` (29 aggregate pgTAP tests)
- `npm run test:e2e` (admin routes redirect when unauthenticated)

Manual local setup: after receiving this migration, run
`npx supabase migration up --local` once with the local stack running.

Next recommended task: implement Phase 2's wallet, immutable ledger, Live
editions, starter grant, and idempotent attendance rewards as one
server-authoritative data slice. Do not build pack opening or the collection
UI until those economy foundations and tests exist.

## Published-session cancellation update — 2026-08-16

Admins can now cancel a published session from its correction page. Cancellation
requires a reason, retains the session and its attendance for audit, clears its
published timestamp, and rebuilds the season so the cancelled event no longer
affects any Live Rating. It is deliberately a cancellation rather than a
destructive delete.

Additional migration: `20260816060200_cancel_published_sessions.sql`.

Tests passing:

- `npm run verify:fast` (15 unit tests)
- `npm run test:db` (35 aggregate pgTAP tests)
- `npm run test:e2e` (4 Chromium tests)
- `npm run build`

Next recommended task remains the server-authoritative wallet, immutable
ledger, starter grant, Live editions, and idempotent attendance rewards. Do
not begin packs or collection UI until that data slice passes its security and
integrity tests.

## Reversible session lifecycle update — 2026-08-16

Cancelled sessions remain in the admin session list and can be revised through
the existing correction flow without affecting ratings. An admin may then
reactivate the session with a reason, which publishes it again and rebuilds its
season. Cancellation and reactivation both appear in an admin-only status
history.

The former blanket uniqueness rule for `(season, date, session type)` is now a
partial unique index for only `draft` and `published` sessions. A cancelled
record therefore does not prevent recording a replacement session at the same
slot. Conversely, reactivation is safely rejected if a current session now
occupies that slot.

Additional migration: `20260816060300_reversible_session_lifecycle.sql`.

Tests passing:

- `npm run verify:fast` (15 unit tests)
- `npm run test:db` (44 aggregate pgTAP tests)
- `npm run test:e2e` (4 Chromium tests)
- `npm run build`

Next recommended task remains the server-authoritative wallet, immutable
ledger, starter grant, Live editions, and idempotent attendance rewards.

## Economy foundation update — 2026-08-16

Phase 1B's data foundation is complete locally. The `kut` schema now has Live
Card editions, individual Card Copies, wallets, an immutable wallet ledger,
and idempotent attendance-reward records. All economy tables use RLS; users
may only read their own wallet, ledger, cards, and reward records, and the
browser has no direct write policy for any of them.

Invite claim onboarding now atomically creates the Profile, starter wallet
credit (`+250` TF Coins), one starter ledger entry, and three distinct,
untradeable Live Card Copies. Existing accounts that predate this migration
see a one-time server-action prompt on the homepage instead. The starter claim
locks the Profile and has both a persisted claim marker and a unique ledger
key, so it cannot mint assets twice.

Publishing a session, adding attendance to a published session, and
reactivating a cancelled session all invoke the same idempotent reward process.
An enabled account linked to an attendee receives `+75` TF Coins exactly once
per Player/session. Migration backfill applies this rule to already-published
local history; cancellation deliberately does not claw back earlier rewards.

Additional migration: `20260816070000_wallet_starter_and_attendance_rewards.sql`.

Tests passing:

- `npm run verify:full`
- 15 unit tests, 63 aggregate pgTAP tests, and 4 Chromium tests

Next recommended task: build the authenticated collection page and card detail
view from these read-only tables. Do not build pack opening or discard until
the collection can clearly show ownership and starter-card tradeability.

## Audited admin password recovery update — 2026-08-16

`/admin/accounts` is a protected recovery page for local/admin-assisted
password resets. The action first writes a pending audit event through an
admin-checked RPC, then calls Supabase Auth's server-only Admin API to set the
new temporary password, and finally marks the event completed or failed.
Passwords are neither stored nor logged by KUT.

Ordinary admins can reset normal member accounts but cannot reset themselves
or another administrator. Superadmins can reset administrator accounts other
than themselves. The recent reset audit is visible to admins only.

Additional migration: `20260816070100_audited_admin_password_resets.sql`.

Tests passing:

- `npm run verify:full`
- 15 unit tests, 71 aggregate pgTAP tests, and 5 Chromium tests

Next recommended task remains the authenticated collection page and card
detail view built on the wallet/card data foundation.

## Private collection and card detail update â€” 2026-08-16

Authenticated, enabled members now have a **My Club** page at `/club` and an
individual card page at `/club/cards/[cardId]`. The collection shows the
member's TF Coin balance, all active card copies, current Live ratings, and
whether each copy is tradeable. It is deliberately read-only: discard,
pack-opening, and market operations remain future server-authoritative slices.

The pages read `kut.my_collection_cards`, a `security_invoker` database view
that explicitly filters `owner_id = auth.uid()`. This means an administrator
cannot accidentally see a different member's collection through this UI even
though their operational table policies are broader. Live cards resolve their
current active-season state; future Special cards can use their frozen snapshot
attributes through the same projection.

Additional migration: `20260816070200_collection_read_projection.sql`.

Tests passing locally:

- `npm run verify:fast` (15 unit tests)
- `npm run test:db` (74 aggregate pgTAP tests)

Next recommended task: implement a server-authoritative discard flow for
eligible cards, with a compensating ledger entry and an immutable card burn
record. Pack opening should follow only after that view of ownership and
tradeability is proven.

## Atomic basic pack opening update â€” 2026-08-16

My Club now offers the single MVP **TFH Pack**: 250 TF Coins for three
tradeable Live Card copies. Outcomes are chosen in the database from active,
collectible Live editions using the specified rarity weights (Common 100,
Bronze 60, Silver 30, Gold 12, Holo 4, Elite 1). Duplicate editions are
allowed.

`kut.open_pack(pack_slug, idempotency_key)` locks the member wallet, verifies
the database-defined price, inserts the opening, debits the wallet with a
matching immutable ledger entry, randomly selects and mints all three copies,
and stores every slot before returning the saved opening ID. Replays of the
same key return the original opening; insufficient balance rolls the complete
transaction back. `/club/packs/[openingId]` reads only the caller's saved
result, so refreshing cannot produce a different pack.

Additional migration: `20260816070400_atomic_basic_pack_opening.sql`.

Tests passing locally:

- `npm run verify:fast` (16 unit tests)
- `npm run test:db` (100 aggregate pgTAP tests)
- `npm run test:e2e` (7 Chromium tests)
- `npm run build`

Next recommended task: add the pack expected-value calculation and compact
admin economy readout before expanding pack types or starting the transfer
market.

## Server-authoritative card discard update â€” 2026-08-16

Eligible tradeable card copies can now be discarded from their card-detail
page. The page displays the current discard value and requires an explicit
browser confirmation. Locked starter cards display their value but have no
discard control.

`kut.discard_card(card_id, idempotency_key)` locks the owned active card,
calculates the value from the current Live OVR (or frozen Special OVR and
multiplier), marks the copy burned, appends one `discard` wallet-ledger row,
and credits the wallet in one transaction. Replaying the same idempotency key
returns the original payout without a second credit. There is no browser write
policy for card copies or wallets.

Additional migration: `20260816070300_server_authoritative_card_discard.sql`.

Tests passing locally:

- `npm run verify:fast` (16 unit tests)
- `npm run test:db` (84 aggregate pgTAP tests)
- `npm run test:e2e` (6 Chromium tests)
- `npm run build`

Next recommended task: build server-authoritative basic pack opening so users
can obtain the first tradeable cards. It must debit the wallet, choose pack
contents server-side, mint copies, and preserve retry/idempotency guarantees
in one transaction.

## Pack economy health readout update â€” 2026-08-16

`/admin/economy` is an admin-only, read-only pack-health dashboard. It shows
the eligible Live pool, weighted expected discard per slot and per pack, the
expected return percentage, and compact current totals for coin supply, pack
openings, card copies, and burned cards. The status bands are Target (<=75%),
Watch (>75%), Warning (>80%), and Critical (>=95%).

The browser display reads `kut.pack_economy_health`, a security-invoker view
that returns no rows to normal members. A matching pure TypeScript economy
calculator has unit coverage for the rarity weighting, formula, input checks,
and threshold boundaries. The dashboard is deliberately informational; it
does not create a browser-accessible way to change pack price or odds.

Additional migration: `20260816070500_pack_economy_health.sql`.

Tests passing locally:

- `npm run verify:fast` (20 unit tests)
- `npm run test:db` (103 aggregate pgTAP tests)
- `npm run test:e2e` (8 Chromium tests)
- `npm run build`

Next recommended task: start the transfer-market backend—listings and
atomic buy-now purchase—with locked-card protection and market-sale ledger
entries. The card ownership, discard, and pack foundations are now present.

## Atomic transfer market update â€” 2026-08-16

The first buy-now market is available at `/market`. Owners list an eligible
tradeable Card Copy from its detail page for 24 hours at server-calculated
bounds. An active listing visibly locks the card, replaces discard with a
cancel action, and appears through a narrow authenticated market projection.

`kut.buy_listing(listing_id, idempotency_key)` locks the listing and wallets,
verifies ownership and funds, transfers the one Card Copy, records the sale,
and writes balanced buyer/seller/tax ledger entries in one transaction. The
tax is 5%, rounded up with a one-coin minimum; it is deliberately burned.
Repeating a buyer idempotency key returns the persisted sale without a second
debit. `market_sales` provides the immutable base for future reference value
and price history.

Additional migrations: `20260816070600_atomic_marketplace.sql` and
`20260816070601_fix_market_wallet_lock.sql`.

The market cards also show the seller's KUT display name. The narrow market
projection exposes this deliberately public marketplace information, not an
email address or other account data.

Additional migration: `20260817000000_expose_market_seller_name.sql`.

Tests passing locally:

- `npm run verify:fast` (20 unit tests)
- `npm run test:db` (128 aggregate pgTAP tests)
- `npm run test:e2e` (9 Chromium tests)
- `npm run build`

Next recommended task: implement reference value, Club Value calculation, and
the public Club Value leaderboard. That completes the remaining Phase 1D MVP
market loop without adding new economy mutations.

## Club Value and leaderboard update - 2026-08-17

`/club` now presents a member's Club Value: their wallet balance plus the
current reference value of every unburned Card Copy, including locked starter
cards. `/leaderboard` ranks enabled clubs by that value and shows each member's
display name, derived club name, card count, and unique-player count.

Reference values reuse the specified 14-day market-median rule once an edition
has five completed sales; otherwise they use the 1.5x current discard-value
fallback. Both database views are read-only and evaluate on page request, so
Live rating changes and qualifying sales are reflected without a cache.

Additional migrations: `20260817010000_club_value_leaderboard.sql` and
`20260817010001_fix_club_value_projection_permissions.sql`.

Next recommended task: add a Message Center for market sale/purchase and
other in-app notifications.

## Message Center update - 2026-08-17

`/messages` is now the authenticated in-app inbox. Every completed market
sale atomically creates one private purchase message for the buyer and one
private sale message for the seller; the migration also adds messages for
existing market-sales history. Members can mark one or all of their own
messages as read, but cannot create, modify, or read another member's inbox
entries.

My Club shows an unread-message count and links to the inbox. The current
scope is market events only; attendance, pack, and admin notifications can be
added through the same append-only event model later.

Additional migrations: `20260817020000_message_center_market_notifications.sql`
and `20260817020100_include_buyer_in_sale_notifications.sql`.

## MVP hardening update - 2026-08-17

The application now has safe route-level loading, not-found, and error-recovery
screens. Errors never expose database details in the UI, and the recovery copy
states that an error did not complete a game action. Key authenticated routes
have loading skeletons; existing empty states were reviewed for collection,
market, leaderboard, and messages.

Playwright now checks the public ratings page and a protected sign-in boundary
at a 390px phone viewport, including horizontal-overflow guards. The database
suite now verifies that a purchase retry cannot create a second buyer message,
and that one member cannot directly update or mark another member's message as
read.

The local security review is recorded in `docs/SECURITY_REVIEW.md`; backup,
hosted migration dry-run, and explicit preview-deployment steps are in
`docs/OPERATIONS.md`. No hosted Supabase project, Vercel project, or preview
deployment was changed. A genuine two-independent-client simultaneous-buy test
was the remaining local pre-alpha integrity check; it is covered by the later
two-client market-race update below.

Tests passing locally: `npm run verify:full` (20 unit tests, 145 database
tests, 11 Chromium browser tests, lint, typecheck, and production build).

## Alpha-readiness UI update - 2026-08-17

Signed-in members and administrators now have a visible **Sign out** control
on the core member, card/pack detail, market, messages, leaderboard, and
admin screens. It performs a local Supabase sign-out and returns to the public
login page; a failure leaves the session intact and gives a safe retry
message.

All visible application and README currency copy now says **KUT Coins**. This
is intentionally a display-only branding sweep: database field names, ledger
records, formulas, pack price, and historical data remain unchanged.

Tests passing locally: `npm run verify:full` (20 unit tests, 145 database
tests, 11 Chromium browser tests, lint, typecheck, and production build).

Next recommended task: manually review the signed-in Club, Market, Messages,
and admin attendance flows at a narrow mobile viewport.

## Navigation overhaul update - 2026-08-17

Every page previously hand-rolled its own back-link; the same destination was
labelled four different ways depending on which screen linked to it, two
pages (card detail, pack reveal) had no menu entry at all, and admin sub-pages
were two hops apart. This addressed the "review signed-in flows at a narrow
mobile viewport" item above by building the persistent navigation the build
spec already specified (Part XVII, §46) rather than deferring it further.

Authenticated routes now live under an `(app)` route group with a shared
`AppNav`: a desktop top bar and a mobile bottom tab bar, both with five
primary destinations (Home, Collection, Packs, Market, Club) plus a "More"
overflow menu (Leaderboard, Player directory, Messages with an unread badge,
Settings, and Admin for admins only). `/club` split into three pages along
existing data only, no new backend queries beyond reusing `my_club_value` and
`club_value_leaderboard`: `/club` (wallet/Club Value overview), `/club/collection`
(the card grid, was `/club`), and `/club/packs` (the pack store, pulled out of
the old combined page). Card detail moved from `/club/cards/[cardId]` to
`/club/collection/[cardId]`; pack reveal stays at `/club/packs/[openingId]`.
Admin pages gained a shared tab strip so Attendance/Accounts/Economy/Invites
are reachable from each other directly instead of only through Attendance.

`/players` and `/settings` are new placeholder pages ("coming soon") so the
spec-mandated overflow menu items have somewhere to point before Player
Directory (Phase 1A) and full Settings (Phase 1.5) are built. `requireUser`
and `requireAdmin` are now wrapped in React's `cache()` so the new layout-level
auth check and a page's own call share one Supabase round trip per request
instead of duplicating it.

No route/label change here needed a `docs/decisions.md` entry: this
implements the spec's own navigation section rather than deviating from it.
Squad building (Phase 3) will need a real nav placement decision later; no
slot was reserved speculatively.

Tests passing locally: `npm run lint`, `npm run typecheck` (via `next build`),
`npm run test` (20 unit tests), `npm run test:e2e` (11 Chromium tests,
including the 390px viewport checks), and `npm run build`. Full authenticated
click-through (verifying the AppNav itself renders correctly, not just the
pre-login redirect boundary) was not possible in this environment: local
Supabase requires Docker, which is not installed here, and the shared hosted
project was deliberately not used for interactive testing.

Next recommended task: manually sign in locally and click through Home,
Collection, Packs, Club, Market, and the admin tab strip to confirm the
AppNav renders and behaves as designed, since automated coverage here only
proved the pre-login redirect boundary.

## Hosted alpha deployment and shared migration authority - 2026-08-17

KUT is live at `https://kut.vibetrunk.com`. A verified encrypted logical
export was created before the hosted schema change, then KUT's 25 migrations
through `20260817030000_private_live_ratings.sql` were applied.

Supabase migration history is global to the shared project rather than per
schema. `VibeTrunk/supabase` is now the central catalogue and sole hosted
migration deployment point. KUT retains matching migration files for local
database tests only. Every future schema change must have matching immutable
files in both repositories and use the central backup, parity-check, dry-run,
and explicit-approval workflow.

## Two-client market-race update - 2026-08-17

`npm run test:market-race` now opens two independent local PostgreSQL sessions
as fictional authenticated buyers and starts the same `buy_listing` RPC
concurrently. It verifies one completed sale, one resulting card owner, the
expected seller/winner/loser balances, and exactly three ledger entries. Its
fixed local fixtures are deleted after every run.

The development-only `pg` client and its TypeScript declarations support this
test; they are not shipped to the browser or production application code.

Tests passing locally: `npm run test:market-race` (1 race test) and
`npm run verify:full` (20 unit tests, 145 database tests, 11 Chromium browser
tests, lint, typecheck, and production build).

Next recommended task: manually review the signed-in Club, Market, Messages,
and admin attendance flows at a narrow mobile viewport. Do not perform market
race testing against the shared hosted Supabase project.

## Member-only Live Ratings update - 2026-08-17

The group chose to keep Live Ratings private. The root route now redirects an
unauthenticated or disabled visitor to `/login`; its member-facing card data
is fetched only after a valid enabled profile is confirmed. The login copy now
correctly describes private, invite-only member access rather than admin-only
access.

Migration `20260817030000_private_live_ratings.sql` revokes anonymous SELECT
access to `kut.public_live_ratings`. The authenticated projection remains the
same, so no rating formula, card state, or economy rule changed.

Tests passing locally: `npm run verify:full` (20 unit tests, 145 database
tests, 11 Chromium browser tests, lint, typecheck, and production build).

Next recommended task: manually review the signed-in Club, Market, Messages,
and admin attendance flows at a narrow mobile viewport.

## Local sign-in CSP fix - 2026-08-17

Discovered while manually verifying the navigation overhaul below: `src/proxy.ts`
hardcoded the CSP `connect-src` directive to the hosted Supabase project's
domain only. Signing in against a local `supabase start` stack therefore had
the browser silently block the `auth/v1/token` request as a CSP violation,
which `signInWithPassword` surfaced only as a generic "Sign-in failed" message
with no indication the real cause was a blocked network request rather than
wrong credentials.

`connect-src` now derives from `NEXT_PUBLIC_SUPABASE_URL` at request time
(falling back to the hosted project URL only if that variable is unset), so it
always matches whatever Supabase instance the app is actually configured
against — local or hosted — instead of a value hardcoded to one environment.

Verified: rebuilt and confirmed the header via `curl` on both the dev server
and a fresh `next start` build; local sign-in against a manually created
Studio admin user succeeded end to end.

## Clubblad visual redesign - 2026-08-17

Replaced the player card's generic dark-gradient look with "Clubblad", a
Panini-sticker-album system — see ADR-022 for the full design rationale.
`src/components/live-card.tsx` and the `.live-card*` rules in
`src/app/globals.css` were rewritten; the `LiveCardPlayer` prop shape and the
`size` API are unchanged, so no call site outside those two files needed
edits for the card itself.

The same palette was then extended across the rest of the app chrome — nav
(`app-nav.tsx`, including a new brass pentagon brand mark), dashboard, and
every button/badge/banner/input/empty-state pattern across all ~40
remaining `.tsx` files under `src/app` and `src/components` — via a scripted
token substitution, hand-reviewed and corrected (see ADR-022 for the bugs
that surfaced: a mis-mapped `amber-950`, a missing `warning` tier, two
hardcoded gradients).

Two sketch rounds (five initial card directions, then three more ambitious
jersey/stat redraws) were shown to the user as throwaway HTML artifacts
before touching the codebase; nothing from the second round was adopted.

Verified: `npm run typecheck`, `npm run lint`, and `npm run test` (20 unit
tests) all pass. Both the card redesign and the chrome redesign were checked
in a real Playwright-driven browser render, via a temporary unauthenticated
`/design-preview` route deleted immediately after each check — it was never
committed.

Not verified: the actual authenticated pages (Collection, Market, Packs,
admin) have not been manually clicked through in a signed-in browser session
since this change: `/design-preview` only proved the shared tokens and the
nav component render correctly, not every page that consumes them.

Next recommended task: this work is uncommitted in the working tree as of
this entry (`git status` shows 42 modified files). Commit it before starting
unrelated work, and manually click through Collection, Market, Packs, and an
admin screen in a signed-in session to confirm the token migration reads
correctly on real data, not just the seed fixtures used in `/design-preview`.

## Initial TFH roster and August 2026 attendance backfill - 2026-08-18

The first real content: `20260818000000_initial_tfh_roster_and_august_sessions.sql`
imports 21 real TFH members with 2+ appearances across the five published
August 2026 attendance sheets (03, 07, 10, 14, 17 Aug), creates their Live
Card editions, opens the `TFH 2026` season, and backfills all five sessions
as already-published with zero recorded goals (none were on the source
sheets). This follows BUILD_SPEC.md Part 137, which explicitly allows a
one-time migration/seed script for the initial roster instead of a polished
admin import UI — that UI still does not exist.

By the user's request, the 12 people who only appear once across the five
sheets (Bader, Souhail, Meral, Maikel, both "Nick"s, Xander, Zak, Jurie,
Steffen, Serhat, Stephen) are deliberately left out of the roster rather than
getting a Live Card from a single appearance; the migration comment explains
the exclusion and how to re-add someone (with their full attendance history)
once they attend a second session.

`kut.rebuild_season` requires an authenticated admin session (`kut.is_admin()`
reads `auth.uid()`), which a migration does not have. Its computation was
extracted into an internal, ungated `kut._rebuild_season_core`, which
`kut.rebuild_season` now delegates to after its admin check; the migration
calls the core directly. This keeps a single canonical rating formula
(BUILD_SPEC.md Part 10) instead of duplicating the loop by hand.

`supabase/seed.sql`'s fictional local season now computes `is_active` instead
of hardcoding `true`, so it no longer collides with a real active season
already inserted by a migration — `kut.seasons_one_active_idx` allows only
one active season at a time.

Known data gap: Friday 07.08.2026's sheet listed "Nick" twice at different
positions and was confirmed with the user to be two different people, but
both were single-appearance and are excluded per the note above; if either
returns for a second session, their real name (or a distinguishing display
name) will be needed since two roster entries would otherwise both read
"Nick". There is still no admin UI to rename a player or edit archetypes —
only a migration/Studio SQL can do that today.

Verified locally: `npm run test:db` (145 pgTAP tests, unchanged), `npm run
verify:fast` (20 unit tests, lint, typecheck), and a manual query of the
rebuilt `player_season_state` confirming per-session attendee counts (9, 22,
8, 17, 9) match the source sheets before the roster trim, and that the
highest Live OVR produced is 45 (Bronze) — consistent with the "no strong
cards yet" goal. Not yet applied
anywhere else: this repository's migrations are local-only:
`VibeTrunk/supabase` remains the sole hosted deployment point per the
"Hosted alpha deployment" entry above, and this migration has not been added
there yet.

Next recommended task: add the matching migration file to
`VibeTrunk/supabase` and run its backup/dry-run/parity-check workflow before
the real roster and August history go live at `kut.vibetrunk.com`. After
that, resolve the two placeholder "Nick" records with their real names or
distinguishing display names.

## Roster trimmed to 2+ appearances; activity formula reweighted - 2026-08-18

Two follow-up changes to the same still-unapplied migration, both by
explicit user request:

The 12 players with exactly one appearance across the five source sessions
(Bader, Souhail, Meral, Maikel, both "Nick"s, Xander, Zak, Jurie, Steffen,
Serhat, Stephen) were removed from the roster, card editions, and attendance
— confirmed to have no profiles, invitations, or cards attached first. 21
real players remain, each with 2-4 matches attended.

`ACTIVITY_FIRST_APPEARANCE` was raised from `8` to `14` after the user felt a
single match should move a card's rating more; see ADR-024 in
`docs/decisions.md` for the four options simulated, why this one was chosen,
and its main tradeoff (a once-a-week regular's activity now caps at the same
long-run ceiling as a twice-a-week regular, just slower to reach — it no
longer caps lower). Changed in `docs/BUILD_SPEC.md` (Parts 11, 11.2, 145),
`src/game/config.ts`, `tests/fixtures/rating-scenarios.json`, and the SQL
formula inside `20260818000000_initial_tfh_roster_and_august_sessions.sql`.

With the new formula, the season's top cards are now Aram and Teize at 52
(Silver, 4 matches each), down to Derk at 39 (Common, 2 matches). Verified
locally: `npm run test:db` (145 pgTAP tests) and `npm run verify:fast` (20
unit tests including the recalculated rating-engine fixtures).

Next recommended task: unchanged from the entry above — add the matching
migration to `VibeTrunk/supabase` and deploy it deliberately, then resolve
the two placeholder "Nick" identities if either returns for a second session.

## Hosted deployment of the initial roster and formula update - 2026-08-19

`20260818000000_initial_tfh_roster_and_august_sessions.sql` is now live at
`kut.vibetrunk.com`. Followed the `VibeTrunk/supabase` operator workflow:
copied the migration into the catalogue unchanged, extended
`verify-catalog.ps1` to cover it (27/27 matched), confirmed via `supabase
migration list --linked` that all 26 previously-deployed migrations still
matched remote with no drift, ran `supabase db push --dry-run` to confirm
this was the only pending migration, and captured a local schema+data
logical backup of the hosted database before applying (kept outside both
repos, in session scratch space — not encrypted, since the passphrase-based
encryption script needs an interactive prompt this environment can't supply;
that gap was disclosed to the user rather than silently skipped).

The actual `supabase db push` was refused by Claude Code's own auto-mode
safety classifier — consistent with this project's own rule that live
Supabase mutations don't run unattended — so the user ran it themselves from
their own terminal. `supabase migration list --linked` afterward confirmed
`20260818000000` now matches remote. `VibeTrunk/supabase`'s `README.md` and
`CLAUDE.md` "current hosted ledger" notes are updated to match.

The real TFH roster (21 players) and August attendance history, and the
reweighted `ACTIVITY_FIRST_APPEARANCE = 14` formula (ADR-024), are now what
`kut.vibetrunk.com` actually serves — no longer local-only.

Next recommended task: resolve the two placeholder "Nick" identities (see
above) if either returns for a second session. Otherwise, no outstanding
follow-up from this deployment.

## Full August 2026 month — sessions 21.08 / 28.08 and four new qualifiers - 2026-08-29

`20260829000000_august_2026_full_month_roster_and_sessions.sql` completes the
month the initial import started. The source was the full "TFH Attendance
August" sheet (seven sessions: 03, 07, 10, 14, 17, 21, 28 Aug). The first
five were already imported and unchanged; this migration adds the two
remaining Fridays as already-published, zero-goal sessions (ids
`a0…0006` = 21.08, `a0…0007` = 28.08) and re-runs `kut._rebuild_season_core`
over the complete history.

By the user's standing rule (2+ appearances to earn a roster spot), four
people join, taking the roster from 21 to **25**:

- **Steffen**, **Serhat** — one appearance on 17.08 (both were on the initial
  import's exclusion list), second on 21.08.
- **Stephen** — 17.08 then 28.08.
- **Maarten** — new to the sheets entirely, 21.08 + 28.08.

Their 17.08 attendance (Steffen, Serhat, Stephen), dropped as
single-appearance in the initial import, is backfilled here against the
existing 17.08 session, so their history is complete.

Still excluded as exactly one appearance across the whole month: Bader
(03.08); Souhail, Meral, Maikel, Nick, Xander, Zak (07.08); Jurie (14.08);
**Cormac** and **Peter** (both new, 28.08 only). The migration comment lists
them and how to re-add anyone who returns.

No game rule, invariant, or public projection changed — this is data entry
following the established pattern, so no ADR. `ACTIVITY_FIRST_APPEARANCE`
stays at 14 (ADR-024); OVRs shifted on apply because the rebuild now sees
seven published sessions instead of five, which is the intended effect.

Verified locally: `npm run verify:fast` (lint, typecheck, 20 unit tests),
`npx supabase migration up --local` (applies cleanly), and `npm run test:db`
(145 pgTAP tests, unchanged). Post-apply query confirmed per-session stored
attendee counts of 8 / 15 / 8 / 16 / 9 / 14 / 11 for 03–28 Aug (17.08 rose
from 6 to 9 with the three backfilled players; Cormac and Peter correctly
absent from 28.08), a 25-player real roster, and the four new players present
with two appearances each (Maarten and Stephen at 46 Bronze, Serhat and
Steffen at 40 Bronze). Highest Live OVR is now 57 (Oussama, Teize — Silver),
up from 52 at the initial import; still nothing above Silver.

Next recommended task: add the matching migration file to `VibeTrunk/supabase`
and run its backup / parity-check / dry-run / explicit-approval workflow
before this goes live at `kut.vibetrunk.com` (ADR-021). This repo's copy is
local-only until then.

## Hosted deployment of the full-August-2026 roster - 2026-08-29

`20260829000000_august_2026_full_month_roster_and_sessions.sql` is now live at
`kut.vibetrunk.com`. Followed the `VibeTrunk/supabase` operator workflow
(ADR-021): catalogued the migration unchanged (`VibeTrunk/supabase#3`,
squash-merged), extended `verify-catalog.ps1` to 28 entries (all matched),
confirmed via `supabase migration list --linked` that the 27 previously
deployed migrations still matched remote with no drift and `20260829000000`
was the only pending one, and ran `supabase db push --dry-run` (one pending
migration, no seeds/roles). Backups before applying: a hosted-project backup
from the Supabase dashboard, plus a `kut`-schema logical export via `supabase
db dump --linked` (data + schema); the data dump was AES-256 encrypted and
kept under `%USERPROFILE%\backups`, outside both repos.

`VibeTrunk/supabase#3` also added a repo `.gitattributes` (`* text=auto
eol=lf`): `core.autocrlf=true` on Windows had been checking the catalogued
SQL out as CRLF, so `verify-catalog.ps1`'s SHA-256 comparison against the LF
sources in this repo could never pass — it was already silently failing on
`20260818000000`. That fix pins the *catalogue* side; the KUT repo still has
`autocrlf=true` and no `.gitattributes`, and this deployment hit the other
half of it: `git pull` on `main` after `VibeTrunk/kut#4` merged re-smudged
this repo's copy of `20260829000000` to CRLF, so the parity check then failed
on *that* file. Worked around by normalising both working copies to LF for
the run; the committed blobs were byte-identical throughout (same git object
`05745b27`). Adding a matching `.gitattributes` to this repo is the real fix
and remains an open loose end.

The real `supabase db push` was run by the user from their own terminal —
live shared-Supabase mutations are not run unattended in this project, same
as the 2026-08-19 initial-roster deployment. `supabase migration list
--linked` afterward confirmed `20260829000000` matches remote.
`VibeTrunk/supabase`'s `README.md` / `CLAUDE.md` ledger notes were updated
(`VibeTrunk/supabase#4`).

The 25-player TFH roster and the complete seven-session August attendance
history are now what `kut.vibetrunk.com` serves. Verified against the hosted
database after the push: `supabase migration list --linked` shows
`20260829000000` matched Local/Remote; per-session stored attendee counts are
8 / 15 / 8 / 16 / 9 / 14 / 11 for 03–28 Aug; `kut.players` holds 25 rows; the
top Live OVRs are Oussama and Teize at 57 (Silver), with nothing above
Silver.

Next recommended task: resolve the two placeholder "Nick" identities from the
initial import if either returns for a second session; otherwise no
outstanding follow-up. Consider adding a `.gitattributes` to this repo to
harden the catalogue parity check against fresh Windows clones.

## Admin "Add Player" — roster growth without a migration - 2026-08-29

Admins can now register a new TFH member from `/admin/roster` (new "Roster"
tab in the admin strip): display name + archetype + optional full name. On
submit the server action calls the new `kut.admin_add_player` RPC
(`20260829120000_admin_add_player.sql`), which in one transaction inserts the
`kut.players` row with a collision-suffixed slug, mints the player's `live`
`card_editions` row, and runs `kut._rebuild_season_core` so the player has a
baseline `player_season_state` row (30 OVR / `common`) and shows in Live
Ratings immediately. A later attendance publish moves the rating normally.
See ADR-025 for the rationale; BUILD_SPEC.md Part 137 is amended.

The RPC is `security definer`, executable by any authenticated caller but
gated internally by `kut.is_admin()` (same shape as the other admin RPCs);
`requireAdmin()` is re-checked at the route and again in the server action.
Duplicate display names are allowed (only `slug` is unique →
`steffen` / `steffen-2`) — the deliberate "two Nicks" escape hatch; the form
shows a soft, non-blocking warning when the typed name already exists.

Also in this branch: a repo-root `.gitattributes` (`* text=auto eol=lf`) plus
a `git add --renormalize` commit, closing the open loose end from the
2026-08-29 hosted-deployment entry above — `core.autocrlf=true` on Windows
had twice re-smudged `supabase/migrations/*.sql` to CRLF and tripped
`VibeTrunk/supabase`'s `verify-catalog.ps1` SHA-256 drift check.

Tests passing locally: `npm run verify:fast` (lint, typecheck, 20 unit
tests). `npm run test:db` extends `phase_1a_roster.test.sql` to `plan(152)`
with eight `admin_add_player` assertions (admin add, archetype stored, Live
edition minted, baseline season-state row, duplicate name allowed, slug
collision suffixed, blank name rejected `22023`, non-admin rejected `42501`).

Deviation from the feature brief's literal test block: the "blank display
name is rejected" assertion is run under the admin JWT claim, not as an
anonymous authenticated caller. `admin_add_player` checks `is_admin()` before
it validates the name, so a non-admin caller gets `42501`, never the `22023`
the test expects — the assertion only isolates the name check when the caller
is already an admin.

Next: deploy `20260829120000_admin_add_player.sql` to hosted via the
`VibeTrunk/supabase` ADR-021 workflow (catalogue the file unchanged, extend
`scripts/verify-catalog.ps1` — expect "matches 29", PR; then backup →
`supabase migration list --linked` (one pending, no drift) →
`supabase db push --dry-run` → `supabase db push`; flip the ledger notes and
add the deployed entry here). After that, every future roster add is just the
form.

## Admin roster: deactivate / reactivate / delete a player - 2026-08-29

Follow-up to the add-player entry above, by user request ("also allow me to
remove players"). `/admin/roster`'s table now has per-row **Deactivate /
Reactivate** and **Delete** controls, backed by two new RPCs in
`20260829130000_admin_manage_roster.sql` (both `security definer`, gated by
`kut.is_admin()`):

- `kut.admin_set_player_active(p_player_id, p_is_active)` — soft, reversible.
  Flips `players.is_active`; the player leaves `public_live_ratings` and the
  `open_pack` pool (both filter that flag) but keeps their row, history,
  season-state, and any owned card copies. This is the primary "remove"
  action.
- `kut.admin_delete_player(p_player_id)` — hard `DELETE`, allowed only when
  the player has no attendance, no linked profile, no invitation, and no
  owned `user_cards` copy of their editions. Also removes the auto-minted
  Live edition and baseline season-state row. Otherwise raises `P0001`
  "deactivate instead"; a `foreign_key_violation` handler is the backstop.

See ADR-026 for why removal is soft-by-default (consistent with
cancel-don't-delete sessions and soft card burns) with the hard delete
scoped to genuine never-used typos. The Delete button is disabled in the UI
when the page can see attendance or a linked account; the RPC is the final
arbiter for the invite / owned-card cases. Delete asks for a
`window.confirm` first.

Tests: `phase_1a_roster.test.sql` → `plan(165)` (+13): deactivate clears
`is_active` and drops the player from `public_live_ratings`; reactivate
restores it; a never-used added player hard-deletes cleanly (row, Live
edition, and season-state all gone, no orphans); a player with attendance is
refused with `P0001`; non-admins get `42501` for both RPCs.

Verified locally: `npm run verify:fast` (lint, typecheck, 20 unit tests),
`npx supabase migration up --local`, `npm run test:db` (166 tests: 1 phase0 +
165), `npm run build`, and a real signed-in browser pass (Playwright): added
a player, deactivated it (gone from `/` ratings), reactivated it (back),
hard-deleted a fresh throwaway player, and confirmed Delete is greyed out for
a player with attendance.

Deploy note: `20260829130000_admin_manage_roster.sql` ships in the same
`VibeTrunk/supabase` ADR-021 batch as `20260829120000_admin_add_player.sql`
(two pending migrations; `verify-catalog.ps1` then expects "matches 30").

## Hosted deployment of the admin roster RPCs - 2026-08-29

`20260829120000_admin_add_player.sql` and `20260829130000_admin_manage_roster.sql`
are now live at `kut.vibetrunk.com`. Followed the `VibeTrunk/supabase` ADR-021
workflow: both files catalogued unchanged (`VibeTrunk/supabase#5`,
squash-merged), `verify-catalog.ps1` extended to 30 entries ("matches 30").
That PR also resolved the long-standing CRLF loose end — kut's working copy
of `20260829000000` had been re-smudged to CRLF and was failing the
catalogue SHA-256 check; kut now carries `.gitattributes` (`* text=auto
eol=lf`, from `VibeTrunk/kut#6`) so it re-normalises to LF and stays that
way.

Pre-push checks from `VibeTrunk/supabase`: `supabase migration list --linked`
showed the 28 previously-deployed migrations matching remote with no drift
and these two pending; `supabase db push --dry-run` confirmed exactly the two
(no seeds, no roles). Backup: a `kut`-schema logical export (schema + data)
via `supabase db dump --linked`, kept under `%USERPROFILE%\backups`, outside
both repos — **not encrypted** (the passphrase script needs an interactive
prompt this environment can't supply; disclosed rather than skipped silently,
same as the 2026-08-18/29 roster deploys). Supabase's Free plan has no
managed/on-demand backup or PITR, so the logical dump is the backup
mechanism; the migrations are `create or replace function` only (no schema or
data mutation), so rollback is a `drop function` with nothing to restore.

The real `supabase db push` was run by the user from their own terminal —
live shared-Supabase mutations are not run unattended in this project.
`supabase migration list --linked` afterward showed all 30 migrations with
matching Local/Remote (`20260829120000` at 12:00 UTC, `20260829130000` at
13:00 UTC), no drift. `VibeTrunk/supabase`'s README / CLAUDE ledger notes
were updated to run through `20260829130000` (`VibeTrunk/supabase#6`).

Verified against prod: signed in as an admin at `kut.vibetrunk.com/admin/roster`,
added a player ("test"), then deactivated and hard-deleted them — all three
RPCs work live.

Roster growth and pruning no longer need a migration or a `VibeTrunk/supabase`
PR. Remaining follow-ups are unchanged: rename / archetype / photo editing,
`is_collectible`, merging duplicates, the two placeholder "Nick" identities,
and the read-only member-facing `/players` directory.

## Alpha-readiness batch: explainer, Player Directory, member card self-service - 2026-08-29

Three first-tester gaps closed on one branch (see ADR-027 for the schema
rationale). `npm run verify:full` was run and the signed-in narrow-viewport
mobile click-through was done this session — both were previously listed as
pending in `docs/HANDOFF.md`.

- **`/how-it-works`** — a member-gated static explainer covering
  attendance &rarr; Activity &rarr; OVR, Form/goals, the six rarity tiers,
  archetypes (with the offset table), packs, discard, the 5% burned market
  tax, Club Value, and the Message Center. Every number is pulled from
  `src/game/config.ts` / `src/game/rating-engine.ts` so the copy cannot drift.
  Linked from the "More" nav menu (new `IconInfo`), the Home header, and the
  starter-claim banner.
- **Player Directory** — `/players` (was a stub) is now a searchable,
  filterable roster (query / rarity / archetype / sort), and
  `/players/[slug]` is a per-player profile with the detail card and stats.
  Backed by the new `kut.player_directory` view (`security_invoker`, LEFT JOIN
  season state so a 30-OVR newcomer still lists; does not expose claimant).
- **Member card self-service** — `/settings/card`: a signed-in member linked
  to a player can change their own archetype and upload a card photo with a
  square pan/zoom crop (canvas &rarr; 512&times;512 WebP/JPEG, uploaded
  browser-side to the private `player-photos` bucket, then recorded via RPC).
  Unlinked members get an "ask an admin" panel. Both writes go through
  ownership-gated `security definer` RPCs (`kut.set_own_player_photo`,
  `kut.set_own_player_archetype`); archetype changes re-run
  `kut._rebuild_season_core`.
- `players.photo_path` added to `kut.public_live_ratings` and
  `kut.my_collection_cards`; `photoUrl` wired into Home, the directory, and
  the collection views. `LiveCard` now renders the photo as an `<img>` (the
  old inline `background-image` would fail production CSP); `img-src` in
  `src/proxy.ts` gains `blob:` + the Supabase origin. Photo URLs are
  short-lived signed URLs from `src/lib/player-photos.ts`.
- Shared `src/game/archetypes.ts` replaces the four duplicated archetype slug
  lists. No formula or `GAME_CONFIG` value changed.

Migration added: `20260830000000_member_self_service_and_player_directory.sql`
(2 widened views, `kut.player_directory`, 2 RPCs, the `player-photos` bucket,
4 `storage.objects` policies; rollback DDL in the header).

Tests: `npm run verify:full` passes — lint, typecheck, **24 unit tests**
(new `tests/unit/archetypes.test.ts`, `RARITY_BANDS` coverage), **191 pgTAP
tests** (new `supabase/tests/database/member_self_service.test.sql`, `plan(25)`
covering the RPCs' ownership gating, the rebuild, path validation, anon
rejection, `player_directory` LEFT JOIN, and `storage.objects` RLS),
**16 Playwright** gate specs (`/how-it-works`, `/players`, `/players/[slug]`,
`/settings/card`), and `next build`. Also verified with a real signed-in
local browser pass: archetype change recalculates the six stats, a photo
upload round-trips (browser upload &rarr; RPC &rarr; signed URL) and appears
on Home / directory / collection, and the console shows zero CSP violations.

Not yet deployed: this migration is local-only until it goes through the
`VibeTrunk/supabase` ADR-021 workflow (catalogue byte-identical, extend
`scripts/verify-catalog.ps1` &rarr; expect "matches 31", backup,
`migration list --linked`, `db push --dry-run` reviewing the `storage.*`
statements, user-run `db push`). It is the first KUT migration that touches
the `storage` schema. `docs/OPERATIONS.md` step 5 is now stale — the CSP
lives in `src/proxy.ts`, not `vercel.json`.

## Username sign-up, admin account links, attendance-reward inbox messages - 2026-08-29

Follow-up batch on the same branch (see ADR-028). Migration
`20260831000000_admin_links_username_and_attendance_messages.sql`.

- **Sign up with a username, not an email.** `kut.profiles.username` (unique,
  `^[a-z0-9_]{3,30}$`, lower-cased). `src/lib/auth/username.ts` maps a username
  to a synthetic `users.kut.local` address for Supabase Auth (no mail is ever
  sent there). The invite-claim form asks for a username; `claim_invitation`
  takes a required `p_username` (old 2-arg dropped) and stores it. The login
  form takes "Username" but still accepts a raw email for accounts created
  before this change. Username is a login handle only — public display name is
  unchanged. `/settings` shows the member's username.
- **Admin links / unlinks an account to a player.** New `/admin/links` tab →
  `kut.admin_set_profile_player(uuid, uuid)` (`security definer`, `is_admin()`
  gated). Validates one-account-per-player; null unlinks. Forward-only: no
  back-pay of attendance rewards for the player's earlier sessions.
- **Attendance rewards write a dated inbox message.**
  `kut.grant_attendance_rewards` now inserts a `user_notifications` row
  (`event_type='attendance_reward'`, keyed on the session, idempotent like the
  reward) &mdash; "You received N KUT Coins for attending the session on
  DD Mon YYYY." Existing rewards are backfilled with one message each. The
  `/how-it-works` page gains a "showing up also pays" callout.
- **Attendance reward raised 75 &rarr; 250** (ADR-029), in the same migration.
  Not retroactive: the function is only redefined, past rewards keep their
  amount, and every session published/corrected after deploy pays 250. Value
  is one `v_amount` constant in the migration, mirrored by
  `ECONOMY.attendanceCoinReward` (`src/game/economy.ts`) and BUILD_SPEC
  Parts 24 / 145.

Tests: lint, typecheck, **28 unit** (new `tests/unit/username.test.ts`),
**202 pgTAP** (new `member_admin_links.test.sql` `plan(10)`;
`phase_1a_roster.test.sql` updated for the 3-arg `claim_invitation` &rarr;
`plan(166)`), **17 Playwright** (gate spec for `/admin/links`; invite spec
updated to the username field), `next build`. Verified with a signed-in local
browser pass: admin creates an invite &rarr; new member signs up with a
username &rarr; signs in with that username; email-identifier login still
works; `/admin/links` unlink + re-link both work; zero CSP violations.

Both `2026083*` migrations are local-only until the ADR-021 deploy.

## Admin account disable / delete + members-only leaderboard - 2026-08-29

Migration `20260901000000_admin_manage_accounts_and_leaderboard.sql` (see
ADR-030).

- **`/admin/links` no longer overflows horizontally** — the `<table>` is now a
  wrapping card list (verified no horizontal scroll at 1280px and 390px).
- **Disable / enable an account** — `kut.admin_set_account_disabled(uuid, bool)`.
  Reversible; a disabled account can't sign in and leaves the leaderboard.
- **Permanently delete an account** — `kut.admin_prepare_account_deletion(uuid)`
  clears the `ON DELETE RESTRICT` blockers, then the server action calls the
  Auth admin API to remove `auth.users` (cascades wallet / ledger / cards /
  notifications). Refused for an account with any completed `market_sales`
  ("disable it instead"); can't target yourself, and only a superadmin can
  touch another admin. Verified end-to-end in the browser: a trade-free test
  account hard-deleted cleanly (profile + `auth.users` + cards gone); a
  traded account was correctly blocked.
- **Leaderboard is members-only** — `kut.club_value_leaderboard` filters
  `role = 'user'`, so admin/superadmin accounts don't appear in the public
  rank. `my_club_value` is unchanged (an admin still sees their own club
  summary on `/club`).

Tests: lint, typecheck, 28 unit, **217 pgTAP** (`member_admin_links.test.sql`
&rarr; `plan(25)`; `phase_1a_roster.test.sql`'s leaderboard assertion flipped
to expect an admin is excluded), 17 Playwright, `next build`.

All three `2026083*` / `20260901000000` migrations are local-only until the
ADR-021 deploy.

## Home "Top risers", starter-pack reveal, pack animation - 2026-08-30

Migration `20260902000000_starter_reveal_and_rating_snapshots.sql` (see
ADR-031). Three related pieces:

- **Weekly rating snapshots.** New `kut.player_rating_snapshots`
  `(player_id, season_id, week_start)` written by an `after insert or update`
  row trigger on `kut.player_season_state` (`kut.capture_rating_snapshot`,
  keyed on `last_week_start`). Fires on every rebuild path without touching
  `kut._rebuild_season_core`; same-week rebuilds overwrite in place so the
  previous week's row is stable. Migration seeds the current week only — prior
  weeks are not reconstructed.
- **`kut.top_risers`** (`security_invoker`) diffs the two most recent snapshot
  weeks of the active season, returns `ovr_delta > 0` ordered by delta.
- **Home** (`src/app/(app)/page.tsx`) now shows the top 5 risers (each a
  `LiveCard` with the new optional `trend` prop &rarr; a "▲ +N" pill) and a
  "See the full player directory" link, instead of the whole
  `public_live_ratings` grid. Empty state until a second football week is
  published. Closes HANDOFF Phase D item 4.
- **`/welcome`** — a top-level route (no `AppNav` chrome). `getNavContext`
  redirects any member with `starter_claimed_at` set and the new
  `kut.profiles.starter_opened_at` null to it. "Open your starter pack" calls
  `kut.mark_starter_opened()` (stamps `starter_opened_at`; legacy fallback
  grants the starter if `starter_claimed_at` was still null &mdash; replaces
  the deleted homepage `StarterClaimForm`), then plays the reveal over the
  already-granted cards. Backfill sets `starter_opened_at = starter_claimed_at`
  for existing members, so only brand-new accounts see the gate.
- **`src/components/pack-reveal.tsx`** (pure state machine in
  `pack-reveal-state.ts`) &mdash; rarity clue &rarr; OVR &rarr; identity
  &rarr; next &rarr; summary, with tap-to-skip, "Skip all", and a
  reduced-motion instant summary. Used by `/welcome` and the bought-pack
  reveal at `/club/packs/[openingId]` (was a static grid).
  `kut.my_pack_opening_results` gained `players.photo_path`.

Tests: `npm run lint`, `npm run typecheck`, **33 unit** (new
`tests/unit/pack-reveal-state.test.ts`), **18 Playwright** (new `/welcome`
sign-in-boundary spec), `next build` (24 routes incl. `/welcome`). New
`supabase/tests/database/starter_reveal_and_movers.test.sql` `plan(26)` covers
the snapshot trigger (weekly capture, same-week overwrite, earlier-week
preservation), `top_risers` (riser included, faller excluded, no non-positive
delta), and `mark_starter_opened` (stamps, idempotent, legacy-grant fallback,
anon rejected). It passes 26/26 (verified via direct `psql`); a full
`npm run test:db` run needs a clean `supabase db reset --local` first &mdash;
this dev DB has leftover member profiles linked to seed players and
`Test Season 2026` left active, which trips `phase_1a_roster.test.sql`'s
invite-claim fixtures (pre-existing, unrelated to this change).

Migration deployed to hosted 2026-08-30 (see the entry below). Rollback DDL
is in the migration header.
## ADR-027..030 alpha-readiness batch deployed to hosted - 2026-08-30

The three migrations (`20260830000000`, `20260831000000`, `20260901000000`)
were catalogued into `VibeTrunk/supabase` (PR #7, "matches 33"), a verified
GPG-encrypted `kut`-schema backup was taken, and `supabase db push` was run
from `VibeTrunk/supabase` &mdash; `migration list --linked` now shows 33/33
applied. KUT PR #8 merged and Vercel redeployed (the updated `src/proxy.ts`
CSP with `img-src` `blob:` + the Supabase origin ships with it).

Verified on the hosted project: the private `player-photos` bucket (5 MiB,
webp/jpeg/png) and its four `storage.objects` policies; the five new `kut`
functions; `photo_path` on `public_live_ratings` / `my_collection_cards`;
`profiles.username`; `kut.player_directory` (25 rows); and
`club_value_leaderboard` filtering `role = 'user'`. Post-deploy smoke test
(signed-in) of `/how-it-works`, `/players`, `/players/[slug]`, `/admin/links`,
`/settings/card` passed. `VibeTrunk/supabase` PR #8 flips the ledger to
"applied 2026-08-30".

Housekeeping in the same follow-up: the pre-existing duplicate `superadmin`
account (`m.f.vanoostrom@gmail.com`, never used past 2026-08-15) was deleted
from hosted; and the two nav pennant glyphs in `app-nav.tsx` moved from an
inline `style={{ clipPath }}` (blocked by the prod nonce-only `style-src`) to
a `.clip-pennant` stylesheet class.

## ADR-031 (movers / starter reveal / pack animation) deployed to hosted - 2026-08-30

`20260902000000_starter_reveal_and_rating_snapshots.sql` is live at
`kut.vibetrunk.com`. Followed the ADR-021 workflow: catalogued byte-identical
into `VibeTrunk/supabase` (PR #9), `verify-catalog.ps1` extended and run
("matches 34" &mdash; not "32" as the entry above originally guessed); a
`kut`-schema + data logical backup taken via `supabase db dump --linked`
(`%USERPROFILE%\backups\kut_{schema,data}_pre_20260902_*.sql`, unencrypted &mdash;
the passphrase script needs an interactive prompt); `migration list --linked`
confirmed one pending migration, no drift; `db push --dry-run` showed the one
migration, no seeds/roles. The user ran `supabase db push` from
`VibeTrunk/supabase`.

Verified against the hosted project (fresh `supabase db dump --linked --schema
kut`): `kut.player_rating_snapshots`, the `player_season_state_capture_snapshot`
trigger, `kut.top_risers`, `kut.profiles.starter_opened_at`,
`kut.mark_starter_opened`, and `photo_path` on `kut.my_pack_opening_results`.
`kut.vibetrunk.com/login` and `/` return 200. `VibeTrunk/supabase` PR #10
flips the ledger to "applied 2026-08-30".

The hosted "Top risers" widget shows its empty state until the first session
published after this deploy creates a second week of snapshots. Every existing
member's `starter_opened_at` was backfilled `= starter_claimed_at`, so only
members onboarded from here on hit the `/welcome` gate.

## Backup tooling for the hosted `kut` schema - 2026-08-30

Prep for inviting the first real members. The shared Supabase project has no
managed backup or PITR, so a logical dump is the backup mechanism; the only
prior one is `.private-backups/BACKUP_LOG.md`'s 2026-08-19 pre-invite export,
now stale by the ADR-027..031 batch and never test-restored.

- `scripts/backup-kut-hosted.ps1` (new) — one command: `supabase db dump
  --linked -s kut` (schema DDL) + `--data-only --use-copy` (data),
  concatenated into one replayable `.sql`, encrypted to
  `%USERPROFILE%\backups\kut\kut-backup-<ts>.sql.enc` via the existing
  `scripts/protect-kut-backup.ps1` (AES-256-CBC + HMAC-SHA256, PBKDF2 600k),
  then **decrypted back and SHA-256-compared** before the plaintext is
  shredded. Appends a metadata line to the gitignored
  `.private-backups/BACKUP_LOG.md`. Read-only against prod — no `db push`.
  Non-interactive-capable (`-Passphrase` / `-DbPassword` SecureStrings), which
  closes the "encryption needs an interactive prompt" gap noted in earlier
  deploy entries.
- `docs/BACKUP.md` (new) — coverage table (`kut` schema yes; `auth.users` via
  Supabase platform backup; `player-photos` bucket still an open gap), the
  take-a-backup steps, a **restore drill** (decrypt → replay into a scratch
  local DB with `session_replication_role = replica` so the kut-only dump
  loads without `auth.users` → sanity row counts), cadence, and an optional
  DPAPI-based scheduled-task setup.
- `docs/OPERATIONS.md` — the vague "perform a backup/export on a regular
  schedule" bullet now points at the script and `docs/BACKUP.md`.

No schema, game rule, invariant, or public projection changed — ops tooling
only, so no ADR.

Run and verified 2026-08-30 by the user:

- `scripts/backup-kut-hosted.ps1` produced
  `%USERPROFILE%\backups\kut\kut-backup-20260830-104303.sql.enc` (173,664 B
  plaintext), round-trip integrity check passed.
- Restore drill (docs/BACKUP.md) against that file **passed**: replayed into a
  throwaway DB in the local `supabase_db_kut` container — full schema
  (functions, tables, views, indexes, triggers, RLS, grants) with no errors,
  then every `COPY` block. Post-restore counts: 25 players, 1 profile, 0
  wallets/ledger/cards/sales — consistent with the pre-alpha state. The drill
  needs a stub `auth` schema and `session_replication_role = replica` because
  the dump is `kut`-only; both are now baked into docs/BACKUP.md and recorded
  in `.private-backups/BACKUP_LOG.md`.

The pre-invite backup blocker is cleared. Open gaps: the `player-photos`
storage bucket is still not in the dump; a scheduled/automated run is
documented (DPAPI) but not set up.

## Pre-alpha invite gate cleared - 2026-08-30

All three must-do checks before inviting real members are verified against the
hosted project:

1. **Backup + restore** — see the entry above (`scripts/backup-kut-hosted.ps1`
   run + passing `docs/BACKUP.md` restore drill).
2. **Account recovery** — a throwaway hosted account was locked out and reset
   via `/admin/accounts`. There is no email on file for any account, so this
   admin-assisted path is the entire recovery story; it works on prod.
3. **Invite claim end-to-end on prod** — issued an invite at
   `kut.vibetrunk.com`, claimed it with a fresh username, signed in. The
   one-time token, the username → `users.kut.local` synthetic-email mapping,
   and the Auth redirect allow-list all behave on the real domain.

`docs/HANDOFF.md`'s "Known gaps before a real alpha" section is updated to
reflect this (hosted setup done; gate cleared; early-alpha follow-ups listed).
No code or schema change — documentation only.

First invites can go out. Early-alpha follow-ups (not blockers): backup before
each Friday session; skim Vercel + Supabase logs post-session (no alerting);
add a second admin (single operator / single recovery path today); hold
economy formulas steady through short-term noise; `/settings/card` photo
uploads are unmoderated.
