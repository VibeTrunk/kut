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
