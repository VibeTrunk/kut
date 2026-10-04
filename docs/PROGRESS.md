# KUT build log

Dated delivery entries, oldest first — **newest at the bottom**. Each entry is
one shipped slice: what changed, the migrations involved, verification
results, and (where relevant) the hosted-deploy status.

**Current state is not tracked here.** See `CLAUDE.md` ("Status so far" /
"Current hosted deployment") for what is live, `DEPLOYMENTS.md` for every
hosted deploy since 2026-08-30, `ROADMAP.md` for what is next, and
`KNOWN_BUGS.md` for open defects. The doc map is `docs/README.md`.

> **Historical note.** This file originally opened with the fixed
> `# Current phase / # Completed / # In progress / # Tests currently passing /
> # Known failures / # Next recommended task / # Manual setup still required /
> # Database migrations added / # Environment variables added` headings from
> `BUILD_SPEC.md` §107. Once KUT shipped, that snapshot shape was permanently
> stale and the running log below became the whole file (ADR-045). The
> earliest entries describe the Phase 0 foundation — a Next.js 16 App Router
> app with strict TypeScript, local Supabase + pgTAP, Vitest/Playwright, the
> `verify:fast` / `verify:full` scripts, and CI — which the first dated entry
> then supersedes.

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

Deployed 2026-08-30 from `VibeTrunk/supabase`, as one batch with
`20260831000000` and `20260901000000` after KUT PR #8 merged, through the
ADR-021 workflow (catalogue byte-identical, extend
`scripts/verify-catalog.ps1` &rarr; expect "matches 31", backup,
`migration list --linked`, `db push --dry-run` reviewing the `storage.*`
statements, user-run `db push`). The `player-photos` bucket (private, 5 MiB,
webp/jpeg/png) and its four `storage.objects` policies were confirmed on the
hosted project. It is the first KUT migration that touches the `storage`
schema. `docs/OPERATIONS.md` step 5 is now stale — the CSP lives in
`src/proxy.ts`, not `vercel.json`.

(Corrected 2026-09-08: this paragraph opened "Not yet deployed: this migration
is local-only until it goes through the `VibeTrunk/supabase` ADR-021 workflow"
for nine days after the batch had actually gone out. The deploy facts above are
taken from the catalogue's own record in `VibeTrunk/supabase`'s `CLAUDE.md`,
which is authoritative for hosted state.)

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

## Batch B — retire the untradeable concept (tester feedback #9) - 2026-08-30

Branch `feat/all-cards-tradable` (off `main`). See ADR-033. Every Card Copy is
now tradeable and discardable; the `is_tradeable` distinction and all its UI
are gone. The user confirmed **full removal** (starter cards included, no
softer hold rule) and chose to **drop the column** rather than force it true.

- **Migration `20260903000000_drop_is_tradeable.sql`** (data-changing tier,
  ADR-032). Drops `kut.user_cards.is_tradeable`. Rebuilds `kut.my_collection_cards`
  (a `drop view` + `create view` — `create or replace view` can't drop a
  column; nothing in the schema reads that view). Recreates
  `grant_starter_pack`, `open_pack` (mint plain copies), `discard_card` (no
  `is_tradeable` gate), `get_listing_bounds`, `create_listing`, `buy_listing`
  (no `and is_tradeable` predicate) from their latest prior bodies. An active
  market listing still blocks a burn (`user_cards_prevent_burning_listed_card`
  trigger); discard/list still need a resolvable rating. Reverse DDL in the
  migration header (lossless — every surviving row was `true`).
- **Front-end**: collection subheader (`N tradeable · N locked` → card count),
  card badge (`Tradeable`/`Locked` → only `Listed`), card-detail "Ownership"
  tile removed, "Starter cards are locked" explainer removed, discard/list
  gating no longer checks tradeability. Copy sweeps in `how-it-works`, `club`,
  `packs`, `market`, `starter-reveal`, `starter-cards.ts`, `README.md`.
- **Spec**: `docs/BUILD_SPEC.md` §20 rewritten (historical design kept
  below a superseded banner); `is_tradeable` struck from the `user_cards`
  schema block; ~11 scattered "untradeable" phrasings de-flagged; acceptance
  criteria "starter cards cannot be discarded" and "market cannot transfer
  untradeable card" removed; Part L regression invariant #20 reworded to the
  server-authoritative-`buy_listing` rule.
- **Tests**: `phase_1a_roster.test.sql` — three obsolete negative starter
  assertions removed (`plan(166)` → `plan(163)`), `is_tradeable` dropped from
  fixtures. `member_admin_links.test.sql`, `starter_reveal_and_movers.test.sql`,
  `tests/integration/market-race.test.ts` — `is_tradeable` dropped from
  `user_cards` inserts.

Local gate: `npm run verify:fast` (lint, typecheck, 33 unit) + `npm run
test:db` (240 pgTAP against the migrated schema, via `supabase migration up
--local`). Hosted deploy is the separate `VibeTrunk/supabase` ADR-021 step
(fresh backup immediately before the push, since this is data-changing) —
never `supabase db push` from this repo. This repo's copy is local-only until
then.

## Batch B deployed to hosted - 2026-08-31

`20260903000000_drop_is_tradeable.sql` is live at `kut.vibetrunk.com`.
Followed the risk-tiered ADR-032 / ADR-021 workflow for the **data-changing**
tier:

- **Catalogued** byte-identical into `VibeTrunk/supabase` (PR #11,
  squash-merged); `scripts/verify-catalog.ps1` extended and run → "matches
  35". Source/catalogue SHA-256 identical (`b0c839ef…`).
- **Fresh** encrypted `kut`-schema backup (schema DDL + data) via
  `scripts/backup-kut-hosted.ps1` immediately before the push — not riding the
  last scheduled one, per the data-changing tier. Round-trip integrity check
  passed; logged in `.private-backups/BACKUP_LOG.md`. The restore drill was
  not re-run (last: 2026-08-30; this migration doesn't change the
  dump/replay mechanism).
- Pre-push from `VibeTrunk/supabase`: `supabase migration list --linked`
  showed the 34 previously-deployed migrations matching remote with no drift
  and `20260903000000` pending; `supabase db push --dry-run` confirmed the one
  migration, no seeds/roles.
- The real `supabase db push` was run by the user from their own terminal —
  live shared-Supabase mutations are not run unattended in this project.
- **Verified against the hosted project**: `supabase migration list --linked`
  shows `20260903000000` matched Local/Remote (35 migrations, no drift); a
  fresh `supabase db dump --linked -s kut` contains **zero** `is_tradeable`
  references; `kut.user_cards` is now `id, edition_id, owner_id, source,
  acquired_at, burned_at, created_at`; `grant_starter_pack`, `open_pack`,
  `discard_card`, `get_listing_bounds`, `create_listing`, `buy_listing` are
  all recreated and `discard_card` no longer carries the tradeability gate.
- `VibeTrunk/supabase` README / CLAUDE ledger notes flipped to "applied
  2026-08-31" (PR #12).

The front-end (Vercel, auto-deploy on the KUT PR #17 merge) and the hosted
schema are now consistent: every Card Copy is tradeable and discardable,
starter cards included. Batch C (coin-name SQL sweep) is the next
tester-feedback batch.

## Batch C — "KUT Coins" is the one currency name (tester feedback #7 + #11) - 2026-08-31

Branch `feat/canonical-coin-name` (off `main`). See ADR-034. "KUT Coins" is now
canonical everywhere (singular "KUT Coin"); the build spec's old working name
"TF Coins" is retired. The user confirmed the exact name and chose a short
**"KUT"** ticker for the leaderboard's narrow value column.

- **Migration `20260904000000_canonical_coin_name.sql`** (data-changing tier,
  ADR-032 — one backfill `UPDATE`). `create or replace`s `open_pack` +
  `buy_listing` from their latest `20260903000000` bodies with `TF Coins` →
  `KUT Coins` in the two insufficient-funds `raise` strings and the two
  `market_purchase` / `market_sale` `format()` notification bodies, then a
  one-shot `update kut.user_notifications set body = replace(body, 'TF Coins',
  'KUT Coins') where event_type in ('market_purchase','market_sale') and body
  like '%TF Coins%'` for the rows already on hosted (backfilled once each by
  `20260817020000` / `…020100`). Reverse `replace()` in the header, scoped to
  the same `event_type`s so it is lossless (`attendance_reward` bodies already
  said "KUT Coins" and are untouched both ways). No economy value, ledger
  `reason`, column, price, or formula changed — Part L untouched.
- **Front-end**: `leaderboard/page.tsx` value column `{value} TF` → `{value}
  KUT`. `src/app/(app)/page.tsx` (#11) gains a "Kelderklasse Ultimate Team"
  subtitle under the "This week in KUT" heading — the full name previously
  appeared only in `layout.tsx` metadata and `login/page.tsx`. Front-end only,
  no migration.
- **Spec / docs**: `docs/BUILD_SPEC.md` glossary entry reframed `**TF Coins**`
  → `**KUT Coins**`; L891 / L919 / L937 / L3556 updated; `docs/decisions.md`
  ADR-014 pack-definition line and `README.md` My Club paragraph updated;
  ADR-034 added. Dated historical `docs/PROGRESS.md` lines left as written.
- **Tests**: `phase_1a_roster.test.sql` — the one `throws_ok` asserting the
  pack error string updated to `insufficient KUT Coins for this pack`. No
  other test asserts the string (grepped). Plan count unchanged.

Local gate: `npm run verify:fast` + `npm run test:db`. Hosted deploy is the
separate `VibeTrunk/supabase` ADR-021 step for the **data-changing** tier
(fresh backup immediately before the push; catalogue the file byte-identical
and extend `scripts/verify-catalog.ps1`) — never `supabase db push` from this
repo. This repo's copy is local-only until then.

Mixed-state window (same shape as Batch B): the leaderboard `TF`→`KUT` fix and
the Home subtitle ship via Vercel on merge; the inbox backfill + function swap
ship on the hosted push. Between them `/messages` still shows "TF Coins" on old
and new rows — harmless, resolves on push.

## Batch C deployed to hosted - 2026-08-31

`20260904000000_canonical_coin_name.sql` is live at `kut.vibetrunk.com`.
Followed the risk-tiered ADR-032 / ADR-021 workflow for the **data-changing**
tier (one backfill `UPDATE` on `kut.user_notifications`):

- **Catalogued** byte-identical into `VibeTrunk/supabase` (PR #13,
  squash-merged); `scripts/verify-catalog.ps1` extended and run → "Central
  catalogue matches 36 approved source migrations". Source/catalogue git blob
  identical (`3a9ea223`).
- **Fresh** encrypted `kut`-schema backup (schema DDL + data) via
  `scripts/backup-kut-hosted.ps1` immediately before the push — the prior
  on-file backup was the pre-Batch-B one, so a new run was required per the
  data-changing tier. Round-trip integrity check passed; logged in
  `.private-backups/BACKUP_LOG.md`. Restore drill not re-run (last: 2026-08-30;
  this migration doesn't change the dump/replay mechanism).
- Pre-push from `VibeTrunk/supabase`: `supabase migration list --linked` showed
  the 35 previously-deployed migrations matching remote with no drift and
  `20260904000000` pending; `supabase db push --dry-run` confirmed the one
  migration, no seeds/roles.
- The real `supabase db push` was run by the user from their own terminal —
  live shared-Supabase mutations are not run unattended in this project.
- **Verified against the hosted project**: a fresh `supabase db dump --linked
  -s kut` contains **zero** `TF Coins` references; "KUT Coins" appears in the
  `open_pack` and `buy_listing` insufficient-funds raises and both
  `buy_listing` `market_purchase` / `market_sale` notification `format()`
  bodies (the `attendance_reward` body already said "KUT Coins" and is
  unchanged). The backfill `UPDATE` committed in the same transaction as the
  `create or replace`s. `migration list --linked` shows `20260904000000`
  Local = Remote.
- `VibeTrunk/supabase` README / CLAUDE ledger notes flipped to "applied
  2026-08-31" (PR #14).

Front-end (Vercel, auto-deploy on the KUT PR #19 merge) and the hosted schema
are now consistent: "KUT Coins" is the currency name on every surface,
including the Message Center inbox and the leaderboard's `KUT` ticker. The Home
header now also expands the acronym ("Kelderklasse Ultimate Team", tester
feedback finding #11). Batch C closes tester feedback #7 + #11; Batch D (admin
economy tools — #8 assign coins, #6 soft account reset) is the next
tester-feedback batch.

## Batch D — admin economy tools (ADR-035) - 2026-08-31

Branch `feat/admin-economy-tools`. Tester feedback #8 (admin assigns coins) +
#6 (reset a traded account). **Additive** tier (ADR-032): the migration is all
`create table` / `create or replace function` / one widened check constraint
and mutates no member rows; the reset *operation* mutates rows at run time,
`is_admin()`-gated.

- **Migration** `20260905000000_admin_economy_tools.sql`:
  - `kut.admin_adjust_wallet(uuid, bigint, text)` — audited coin faucet, both
    directions, `abs` cap 100000 (`22023`), never below zero (`P0001`), typed
    1–200-char reason. `wallet_ledger.reason 'admin_grant'` + a
    `kut.admin_account_events` row + an `admin_notice` inbox row. Not self, not
    a superadmin target, only-superadmin-adjusts-admin (mirrors ADR-030).
  - `kut.admin_reset_account(uuid, uuid)` — cancels active listings, soft-burns
    every owned card, deletes pack history + notifications, zeroes the wallet
    via one `-(balance)` + `+250` ledger pair (`reason 'admin_reset'`,
    net 250), re-grants the 3-card starter inline, nulls `starter_opened_at`
    (keeps `starter_claimed_at`) to replay `/welcome`. Keeps `market_sales`,
    market ledger rows, and `attendance_rewards` guard rows. Idempotent on
    `p_idempotency_key` (audit-row `detail->>'idempotency_key'` + partial
    unique index + `profiles` `FOR UPDATE`).
  - `kut.admin_account_events` audit table, admin-read RLS like
    `password_reset_events`.
  - `wallet_ledger.reason` check widened: `+ 'admin_grant', 'admin_reset'`.
- **`src/game/economy.ts`**: `adminWalletAdjustMax: 100_000`.
- **Front-end**: `/admin/links` — `page.tsx` now also loads each account's
  `wallets.balance` and a per-load reset idempotency key; `links-table.tsx`
  gains an amount+reason "Adjust coins" mini-form and a "Reset club" confirm
  button per row (both behind the existing `canModerate` gate);
  `actions.ts` gains `adjust_coins` / `reset_account` intents + error mapping +
  `/admin/economy` `/messages` revalidation. `admin-tabs.tsx`: "Account links"
  → "Accounts", old "Accounts" (password recovery) → "Recovery".
- **Spec**: Part 24 §928 gains an "Admin adjustment" coin source; Part L §162
  invariant #8 reworded with the ADR-035 carve-out (#4/#5/#9 stay literally
  true); Part 125 + §58 `ledger_reason` list note the two new reasons.
- **Tests**: `member_admin_links.test.sql` `plan(25)` → `plan(47)` — has_*
  for both RPCs + the table, and the full guard/happy-path matrix for each
  (non-admin `42501`, self `P0001`, over-cap `22023`, below-zero `P0001`,
  credit writes one ledger + one notice + one audit row; reset burns the owned
  card, nets the wallet to 250, keeps `market_sales` + `attendance_rewards`,
  and a replayed idempotency key is a no-op).

Local gate: `npm run verify:fast` + `npm run test:db` (`supabase migration up
--local`). Hosted deploy is the separate **additive**-path `VibeTrunk/supabase`
ADR-021 step (catalogue byte-identical, extend `verify-catalog.ps1` →
"matches 37", `migration list --linked` no drift, `db push --dry-run`
reviewed, ride the last scheduled backup, user runs `db push`, verify the
three new objects on hosted). Never `supabase db push` from this repo.
Mixed-state window: between the KUT merge and the hosted push the two new
`/admin/links` buttons return an RPC-not-found error if used — push promptly.

## Batch D deployed to hosted - 2026-08-31

`20260905000000_admin_economy_tools.sql` is live at `kut.vibetrunk.com`.
Followed the **additive**-tier ADR-032 / ADR-021 workflow (all `create table` /
`create or replace function` / one widened check; no data migration):

- **KUT PR #21** merged → Vercel shipped the `/admin/links` UI.
- **Catalogued** byte-identical into `VibeTrunk/supabase` (PR #15,
  squash-merged); source/catalogue git blob identical (`a9e84887`).
  `scripts/verify-catalog.ps1` extended and run → "Central catalogue matches
  37 approved source migrations".
- **No fresh backup** — additive tier rides the last scheduled
  `backup-kut-hosted.ps1` run; restore drill not re-run (this migration doesn't
  change the dump/replay mechanism).
- Pre-push from `VibeTrunk/supabase`: `supabase migration list --linked` showed
  the 36 previously-deployed migrations matching remote with no drift and
  `20260905000000` pending; `supabase db push --dry-run` confirmed the one
  migration, no seeds/roles.
- The real `supabase db push` was run by the user from their own terminal —
  live shared-Supabase mutations are not run unattended in this project.
- **Verified against the hosted project** (`supabase db dump --linked -s kut`):
  `kut.admin_account_events` table + the `admin_account_events_reset_idem_idx`
  partial unique index + the `admins read admin account events` RLS policy;
  `kut.admin_adjust_wallet(uuid, bigint, text)` and
  `kut.admin_reset_account(uuid, uuid)`, both `revoke all … from public` +
  `grant … to authenticated`; `wallet_ledger_reason_check` now lists
  `admin_grant` + `admin_reset` (the prior 8 values plus these 2).
  `migration list --linked` shows `20260905000000` Local = Remote.
- `VibeTrunk/supabase` README / CLAUDE ledger notes flipped to "applied
  2026-08-31" (PR #16).

Front-end (Vercel, auto-deploy on the KUT PR #21 merge) and the hosted schema
are now consistent: `/admin/links` "Adjust coins" and "Reset club" work end to
end. Batch D closes tester feedback #8 + #6; Batch E (content features — #4
Goalkeeper, #5 bibs bonus, #10 newsfeed) is the last tester-feedback batch.

## Batch E1 — Goalkeeper archetype (ADR-036) - 2026-08-31

The last tester-feedback batch (E) is split into three independent, all-additive
sub-batches, each its own branch / ADR / migration / hosted deploy: **E1**
Goalkeeper archetype, **E2** bibs-washing coin bonus, **E3** activity newsfeed.
See `docs/TESTER_FEEDBACK_BATCHES.md`.

E1 (finding #4) adds a **seventh archetype, Goalkeeper**, on branch
`feat/goalkeeper-archetype`, migration
`20260906000000_goalkeeper_archetype.sql`:

- **Reuses the six shared attributes** with its own offset row — a shot-stopper,
  `pac -6 / sho -12 / pas 0 / dri -8 / def +14 / phy +12`, summing to exactly 0
  (BUILD_SPEC §589). Not a distinct DIV/HAN/REF stat set (§585). See ADR-036.
- **TypeScript**: `"goalkeeper"` added to `ARCHETYPES` + `ARCHETYPE_LABELS`
  (`src/game/archetypes.ts`) and `ARCHETYPE_OFFSETS` (`src/game/rating-engine.ts`).
  Every archetype picker/validator already derives from those, so the admin
  add-player form, `/settings/card` editor, and `/how-it-works` offsets table
  (now 7 rows) pick it up with no UI change.
- **SQL** (all additive): widen the `kut.players` archetype `check` (drop the
  auto-named inline constraint by lookup, re-add as `players_archetype_check`
  incl. `goalkeeper` — same shape as Batch D's `wallet_ledger.reason` widening);
  `create or replace` `kut.admin_add_player` and `kut.set_own_player_archetype`
  with `goalkeeper` in their allow-lists; `create or replace`
  `kut._rebuild_season_core` with a `when 'goalkeeper' then <n>` arm on each of
  the six attribute `CASE`s (restates the ADR-024 formula — byte-identical
  otherwise). **No player is pre-assigned** and the rebuild is **not** called by
  the migration — the new arm is inert until a player opts in via the existing
  RPCs, which keeps the tier additive.
- **Spec**: §585 reworded (GK is a 7th offset profile, not a separate stat set);
  §15.1 gains a Goalkeeper offset block; §1446's "goalkeepers" subcollection
  bullet annotated. §2881's "all archetypes" test list is already generic.
- **Docs**: ADR-036 in `docs/decisions.md`; `docs/TESTER_FEEDBACK_BATCHES.md`
  Batch E row split into E1/E2/E3 and finding #4 marked decided.

Local gate (green): `npm run verify:fast` (lint, typecheck, 34 unit tests —
`archetypes.test.ts` lock-step + a new goalkeeper scenario in
`tests/fixtures/rating-scenarios.json` for the SQL↔TS parity suite) and
`npm run test:db` (`supabase migration up --local` clean;
`phase_1a_roster.test.sql` `plan(163)` → `plan(166)` — goalkeeper accepted by
`admin_add_player`, archetype stored, and a fresh goalkeeper rebuilds to
`array[24,18,30,22,44,42]` = `live_ovr 30 +` the six offsets).
`member_self_service.test.sql` still uses `'keeper'` as its bogus archetype —
the slug is `goalkeeper`, so that stays a valid negative case.

Hosted deploy is the separate **additive**-path `VibeTrunk/supabase` ADR-021
step (catalogue byte-identical, extend `verify-catalog.ps1` → "matches 38",
`migration list --linked` no drift, `db push --dry-run` reviewed, ride the last
scheduled backup, user runs `db push`, verify the widened check + three
functions on hosted). Never `supabase db push` from this repo. Mixed-state
window: between the KUT merge and the hosted push, picking "Goalkeeper" in the
UI returns the RPC's "invalid archetype" error — push promptly.

## Batch E2 — bibs-washing coin bonus (ADR-037) - 2026-08-31

E2 of Batch E (finding #5) adds a **one-off `+100` KUT Coins bonus for the
session's bibs washer**, on branch `feat/bibs-bonus`, migration
`20260907000000_bibs_bonus.sql`. **Coins only** — no rating/OVR effect. See
ADR-037.

- **SQL** (all additive):
  - `kut.match_sessions.bibs_washed_by uuid` (nullable, `references
    kut.players(id) on delete restrict`) — one washer per session, so a column
    not a table.
  - `kut.bibs_rewards` guard table — PK `(session_id, player_id)`, deferrable
    `ledger_id` FK, member-reads-own / admin-reads-all RLS — a shape match to
    `kut.attendance_rewards`.
  - `wallet_ledger.reason` widened with `'bibs_bonus'`;
    `user_notifications.event_type` widened with `'bibs_bonus'` (distinct type
    so the washer's own `attendance_reward` inbox row for the same session does
    not collide on the `(user, event_type, ref_type, ref_id)` unique key).
  - `kut.grant_bibs_reward(p_session_id)` — security definer, modelled on
    `kut.grant_attendance_rewards`; called from
    `kut.process_published_session_rewards` next to it. Idempotent on the
    `bibs_rewards` PK + the ledger key `'bibs:'||session||':'||washer`.
  - `kut.publish_attendance_session` / `kut.correct_published_attendance_session`
    each gain a trailing `p_bibs_washed_by uuid default null` (old signature
    dropped + recreated — a `create or replace` can't widen the arg list),
    validate it is a distinct attendee, and store it on the session. The
    correction stores the washer *before* replacing the attendance so the
    reward trigger re-fires for a changed washer; the previous washer keeps
    their bonus (forward-only).
- **TypeScript**: `ECONOMY.bibsCoinBonus = 100` (`src/game/economy.ts`); a
  "Who washed the bibs?" `<select>` on the attendance form's review step
  (options = checked-in players + "Nobody"), threaded through
  `admin/attendance/actions.ts` (+ `[sessionId]/page.tsx` for pre-fill on a
  correction) to both RPCs as `p_bibs_washed_by`; `messages/page.tsx` gains a
  "Bibs bonus" kicker label + the `bibs_bonus` event type.
- **Spec**: Part 24 gains a "Bibs bonus" coin source; Part 145 gains
  `BIBS_COIN_BONUS = 100`; Part L §162 gains invariant #21 (bounded faucet).
- **Docs**: ADR-037; `docs/TESTER_FEEDBACK_BATCHES.md` finding #5 marked
  decided and the Batch E row split into E1/E2/E3.

Local gate (green): `npm run verify:fast` (lint, typecheck, 33 unit tests) and
`npm run test:db` (`supabase migration up --local` clean; new
`bibs_bonus.test.sql` `plan(15)` — washer credited exactly one 100-coin
`bibs_bonus` ledger row + guard row + dated inbox message; a repeat
`grant_bibs_reward` is a no-op; a non-attendee washer is rejected `22023`; a
correction that reassigns the washer pays the new one and leaves the original's
row intact. `phase_1a_roster.test.sql` `has_function` arg lists updated for the
two new signatures).

Hosted deploy is the separate **additive**-path `VibeTrunk/supabase` ADR-021
step (catalogue byte-identical, extend `verify-catalog.ps1`, `migration list
--linked` no drift, `db push --dry-run` reviewed, ride the last scheduled
backup, user runs `db push`, verify the column + table + two widened checks +
functions on hosted). Never `supabase db push` from this repo. Mixed-state
window: between the KUT merge and the hosted push, choosing a bibs washer on
the attendance form returns the RPC's "invalid argument" error — push promptly.

## Batch E3 — activity newsfeed (ADR-038) - 2026-08-31

Last piece of Batch E. Finding #10 — a **club-wide activity newsfeed** at
`/feed`, on branch `feat/activity-feed`, migration
`20260908000000_activity_feed.sql`. Additive: one `create view` + one grant.

- **SQL**: `kut.activity_feed` — `with (security_invoker = false,
  security_barrier = true)`, `grant select to authenticated` (the
  `kut.club_value_leaderboard` controlled-projection pattern). `union all` of
  four already-persisted sources:
  - `sale` — `kut.market_sales` (`sold_at`): seller name, **buyer name**, card
    (player) name, `sale_price`.
  - `listing` — `kut.market_listings` where `status='active' and expires_at >
    now()` (`listed_at`): seller name, card name, `price`.
  - `pack` — `kut.pack_openings` (`opened_at`): opener name, `price_paid`
    (count only, no card reveal).
  - `session` — `kut.match_sessions` where `status='published'`
    (`published_at`): `session_date`, `session_type`.
  Not discards, not coin-grant / attendance rows. Underlying tables keep their
  own RLS for every other path.
- **Disclosure change** (the ADR call): a completed-sale row now shows the
  seller, card, price **and buyer name** club-wide — `kut.market_sales` was
  otherwise buyer+seller-only. The buyer was already visible to the seller via
  the ADR-019 sale notification. Listings already exposed the seller
  club-wide (ADR-017).
- **Retention**: none. `/feed` fetches `order by ts desc limit 200` with an
  optional `?before=<ts>` cursor ("Older activity →" / "← Latest").
- **Front-end**: new `src/app/(app)/feed/page.tsx`; a `/feed` "Newsfeed" entry
  in the More menu (`components/app-shell/nav-items.tsx`), new `IconFeed`
  (`components/icons.tsx`, 15 icons now). Per-type copy: "A sold Card to B for
  N KUT Coins", "A listed Card for N KUT Coins", "A opened a pack (N KUT
  Coins)", "A new session was published — DD Mon YYYY · type".
- **Spec**: §47 (Home screen) gains an "Implemented (ADR-038)" note + a widget
  bullet, recording the sale-name disclosure. **Docs**: ADR-038;
  `docs/TESTER_FEEDBACK_BATCHES.md` finding #10 decided + Batch E row split.

Local gate (green): `npm run verify:fast` (lint, typecheck, 33 unit tests) and
`npm run test:db` (`supabase migration up --local` clean; new
`activity_feed.test.sql` `plan(9)` — an uninvolved member reads a completed
sale with both seller and buyer names, an active listing, and a published
session from the view; `kind = 'discard'` never appears; every row has a sort
`ts`).

Hosted deploy is the separate **additive**-path `VibeTrunk/supabase` ADR-021
step (catalogue byte-identical, extend `verify-catalog.ps1`, `migration list
--linked` no drift, `db push --dry-run` reviewed, ride the last scheduled
backup, user runs `db push`, verify `kut.activity_feed` on hosted). Never
`supabase db push` from this repo. Mixed-state window: the `/feed` nav entry
ships on the KUT merge but the page errors until the view is on hosted — push
promptly.

Batch E (and with it the 2026-08-30 tester-feedback round) is complete once
E1 + E2 + E3 are merged and deployed.

## Batch E deployed to hosted (E1 + E2 + E3) - 2026-08-31

`20260906000000_goalkeeper_archetype.sql`, `20260907000000_bibs_bonus.sql`, and
`20260908000000_activity_feed.sql` are live at `kut.vibetrunk.com`. Followed the
**additive**-tier ADR-032 / ADR-021 workflow — one `db push` for all three (no
data migration; the GK rebuild arm is inert until a player opts in, the bibs
reward mutates rows only at run time, the feed is a view):

- **KUT PRs #23 / #24 / #25** merged → Vercel shipped the Goalkeeper picker
  option, the "Who washed the bibs?" attendance-form field, and `/feed` + its
  More-menu entry.
- **Catalogued** byte-identical into `VibeTrunk/supabase` (PR #17,
  squash-merged); the three catalogue blobs match the KUT `main` blobs (git
  object ids equal). `scripts/verify-catalog.ps1` extended and run → "Central
  catalogue matches 40 approved source migrations".
- **No fresh backup** — additive tier rides the last scheduled
  `backup-kut-hosted.ps1` run.
- Pre-push from `VibeTrunk/supabase`: `supabase migration list --linked` showed
  the 36 previously-deployed migrations matching remote with no drift and
  `20260906/07/08` pending; `supabase db push --dry-run` confirmed the three,
  no seeds/roles.
- The real `supabase db push` was run by the user from their own terminal —
  live shared-Supabase mutations are not run unattended in this project.
- **Verified against the hosted project** (`supabase db dump --linked -s kut`):
  `players_archetype_check` lists `goalkeeper` and both roster RPC allow-lists
  carry the seven-value list; `_rebuild_season_core` has the six
  `when 'goalkeeper'` arms; `kut.match_sessions.bibs_washed_by`,
  `kut.bibs_rewards`, `kut.grant_bibs_reward`, and `bibs_bonus` in both the
  `wallet_ledger.reason` and `user_notifications.event_type` checks;
  `publish_attendance_session` / `correct_published_attendance_session` present
  only as the new 5-/6-arg signatures (old ones gone), granted to
  `authenticated` + `service_role`; `kut.activity_feed` with its `authenticated`
  select grant. `migration list --linked` shows all three Local = Remote.
- `VibeTrunk/supabase` README / CLAUDE ledger notes flipped to "applied
  2026-08-31" (PR #18).

The mixed-state window for E2 is closed — attendance publishing works on prod
again (it had been failing since the #24 merge, because the deployed front-end
sends `p_bibs_washed_by` and the hosted 4-arg RPC couldn't resolve it).

**Batch E, and with it the entire 2026-08-30 tester-feedback round, is
complete.** No open tester-feedback items remain.

## Copy-drift sweep + newsfeed moved to Home (ADR-039) - 2026-08-31

Follow-up to tester feedback: a pass over the site for stale explanations after
Batches A–E, plus two scoped changes. Branch `fix/newsfeed-home-and-drift`. No
migration, no hosted push — the `kut.activity_feed` view is untouched.

- **Newsfeed → Home section (ADR-039).** Deleted `src/app/(app)/feed/` and the
  `/feed` "Newsfeed" nav entry (+ unused `IconFeed`). Home's server component
  now also queries `kut.activity_feed` (`order by ts desc limit 12`,
  `ts >= 2026-08-30` floor, no pager) and renders a "Club activity" list at the
  bottom of the page. A feed query error falls back to the empty state rather
  than failing Home.
- **Dates are date-only.** New `src/lib/format.ts` `formatDate` (no time
  component), used by the Home feed section and the Messages inbox (which had a
  redundant `timeStyle: "short"`). The feed's `session` row now goes through the
  same helper, so every row shares one format. Activity copy/types live in
  `src/lib/activity.ts`.
- **`how-it-works` copy.** Added the bibs-washer bonus to §1 (bound to
  `ECONOMY.bibsCoinBonus`); noted the Goalkeeper profile in §5; generalised the
  §10 Messages description and renamed "Message Center" → "Messages" to match
  the nav/H1.
- **README.** Removed the "no application code yet" line; fixed the attendance
  reward (75 → 250) and added the bibs bonus; refreshed the Status paragraph;
  "Admin attendance → Economy" → "Admin → Economy".
- **BUILD_SPEC / decisions.** ADR-038 spec note amended and ADR-039 recorded;
  BUILD_SPEC Home-widget list updated.

`npm run verify:fast` green (lint + typecheck + 34 unit tests).

## Tester follow-up: market card art, Club Value v2, trade offers - 2026-08-31

Branch `feat/market-art-club-value-trade-offers`. Three tester items in one PR;
three additive/data-changing local migrations mirrored for hosted catalogue in
`VibeTrunk/supabase` (not pushed from here).

- **Market card art (ADR-040, `20260909000000`).** `kut.active_market_listings`
  gains `photo_path` + `seller_id` (appended). `/market` now resolves signed
  photo URLs like `/club/collection` does and hides Buy/Offer on the viewer's
  own listings. Tier: additive.
- **Club Value v2 (ADR-041, `20260910000000`).** `club_value = coins +
  SUM(discard_value of owned cards) + 4 x personal-card discard-equivalent`.
  Drops `market_reference_value` from Club Value (kept for listing bounds).
  `my_club_value` dropped + recreated (renames `card_value` ->
  `owned_cards_value`, adds personal-card columns); `club_value_leaderboard`
  replaced in place. New `/club/value` page shows the arithmetic; linked from
  `/club`, the More nav, `/leaderboard`, How-it-works §9. `ECONOMY`
  `personalCardClubWeight: 4` + `calculateClubValue()` helper. Tier:
  data-changing.
- **Trade offers with coin + card escrow (ADR-042, `20260911000000`).** New
  `trade_offers` / `trade_offer_cards` tables + `user_cards.held_by_offer_id`.
  RPCs `propose_trade` / `respond_to_trade` / `withdraw_trade` /
  `expire_trade_offers`; guards added to `create_listing`, `discard_card`,
  `prevent_burning_listed_card`, `cancel_listing`, `buy_listing`,
  `admin_reset_account`, `admin_prepare_account_deletion`. Coins + cards
  escrowed at propose time; 12h expiry (lazy sweep on the market pages; cron is
  a future follow-up). `wallet_ledger.reason` += `trade_escrow` /
  `trade_unescrow` / `trade_sale`; `user_notifications.event_type` +=
  `trade_offer` / `trade_response`. New `/market/offers` hub + `my_trade_offers`
  view + nav badge. `activity_feed` gains a `trade` row. Accepted trades are
  NOT written to `market_sales` (invariant #23). Tier: data-changing.

Verification (all green): `npm run verify:full` (lint + typecheck + 38 unit +
`test:db` + 20 e2e + build) plus `npm run test:market-race` (market + new
trade-race). New pgTAP: `market_listing_card_art` (5), `club_value` (16),
`trade_offers` (48). BUILD_SPEC Part XII §38/§39/§39a, Appendix C, Part XXXIV,
Part L invariants #20/#22/#23 updated; ADR-040/041/042 recorded.

**Deployed to hosted 2026-08-31** &mdash; KUT PR #28 merged; the three SQL
files catalogued into `VibeTrunk/supabase` (PR #19) and applied with one
`supabase db push` from there (data-changing tier: fresh backup taken first).
`kut.vibetrunk.com` smoke-tested: `/market` card art, `/club/value`,
`/club`, `/leaderboard`, and a live offer + withdraw round-trip.

## Tester feedback round 2 — one sweep (ADR-044) - 2026-09-01

Branch `feat/tester-feedback-round-2`. Four defects + three ideas in one PR;
one migration `20260912000000_tester_feedback_round_2.sql` (data-changing tier
because of a `user_notifications` backfill), mirrored for the hosted catalogue
in `VibeTrunk/supabase` (not pushed from here). 💡03 ("see other members'
squads") is documented as needs-a-product-decision, not built.

- **#1 blank activity row** — `src/lib/activity.ts` gained the `trade` kind
  (added to `kut.activity_feed` by ADR-042) + a `default` arm. Front-end only.
- **#3 leaderboard name on mobile** — the row `<li>` restacks on phones
  (rank + club, then value, then cards/players); club name shows at every
  width. CSS only.
- **#4 Home full name** — re-added the "Kelderklasse Ultimate Team" subtitle
  ADR-043 dropped.
- **#7 bibs copy** — `create or replace kut.grant_bibs_reward` with the body
  string "for bringing the bibs to the session on …" + a scoped, reversible
  backfill of existing `bibs_bonus` rows; internal identifiers unchanged.
  Front-end: attendance-form label, How-it-works, `economy.ts` comment.
- **💡01 card lightbox** — new `card-lightbox.tsx` (portal-free fixed overlay,
  focus-trapped, `Esc`/backdrop close, reduced-motion aware, CSP-clean —
  styling in `globals.css`). Expand button on each card; card-body tap still
  navigates. Collection / Player directory / Market / both detail pages.
- **💡04 custom club names** — new `kut.set_own_club_name(text)` RPC (own row,
  trim, blank→NULL, ≤80, no control chars, not unique);
  `club_value_leaderboard` `coalesce`s it with the `"<name>'s Club"` default.
  New "Club name" section on `/settings` (`settings/actions.ts` +
  `club-name-form.tsx`).
- **💡12 published sessions** — new additive `kut.published_sessions` view;
  `/sessions` list + `/sessions/[id]` detail (attendees, goals, bibs bringer);
  "More" nav entry; Home "Session published" rows link to it.

Verification (all green): `npm run verify:fast` (lint + typecheck + 48 unit,
incl. new `tests/unit/activity.test.ts`), `npm run test:db` (383 pgTAP, incl.
new `published_sessions.test.sql` (7) and extended `bibs_bonus` (19) /
`member_self_service` (35) / `club_value` (20)), `npm run test:e2e` (22, incl.
`/sessions` auth-boundary), `next build`. ADR-044; BUILD_SPEC §59 / Part 145 /
the activity-feed + widgets notes updated.

**Deployed to hosted 2026-09-01** &mdash; KUT PR #31 merged; the SQL file
catalogued into `VibeTrunk/supabase` (PR #20, which also brought
`scripts/verify-catalog.ps1` current through `20260909`&ndash;`20260912`) and
applied with one `supabase db push` from there (data-changing tier: fresh
encrypted backup taken immediately before). `kut.vibetrunk.com` smoke-tested:
`/sessions` list + detail, a `/settings` club-name round-trip to
`/leaderboard`, the reworded bibs notification, and unchanged leaderboard
`club_value` / `rank`.

## Remove fullscreen card lightbox — 2026-09-02

Reverted the ADR-044 card lightbox (💡01). It was reported broken in round-3
feedback (KB-001, no repro) and judged not worth keeping — the card detail
pages are already a full-size view and every grid card links there.

- Deleted `src/components/card-lightbox.tsx` and the unused `IconExpand` icon.
- Dropped `<CardLightbox>` + imports from all five surfaces (Player directory,
  Market, Collection grid, both card detail pages).
- Removed the `.card-zoom-trigger` / `.card-lightbox*` CSS (rules, keyframes,
  reduced-motion guard) from `src/app/globals.css`.
- Unwrapped the per-card `group relative` wrappers; kept `relative` where an
  absolute child still needs it (Market price pill; Collection badges — moved
  onto the card `<Link>`).

Front-end only: no migration, no schema, no economy value, no spec rule
change. KB-001 marked fixed-by-removal. ADR-046. Verification: `npm run
verify:fast` + `next build`.

## Fix card top-left scrim hard edge (KB-002) — 2026-09-02

`.live-card__topscrim` — the tinted readability ground under the OVR number
(ADR-043) — was a fixed `66% x 46%` box whose single
`linear-gradient(146deg, ...)` only feathered along that one diagonal, so its
right and bottom edges clipped as a hard rectangle over a busy photo.

Re-cut as `radial-gradient(120% 120% at top left, ...)`: opacity is highest
exactly at the corner where the OVR number sits, and it reaches full
transparency at ~84% of the box, clear of the right and bottom edges, so the
ground melts into the photo on every exposed side. Box dimensions, tint
(`--stock` per tier, darker on Elite), and the OVR readability contrast are
unchanged. CSS-only, one rule; no JS, no backend. KB-002 marked fixed.

Also tidied the round-3 feedback ledger (`TESTER_FEEDBACK_BATCHES.md`) so the
KB-001 / KB-002 rows reflect their resolutions (removal / this fix).

Verification: `npm run verify:fast` + `next build`.

## Rating graph, collection album, TFH Chronicle (ADR-047/048/049) — 2026-09-02

Three collection-and-story features in one branch, specified first in
`archive/SPEC_ALBUM_CHRONICLE_GRAPH.md` and sequenced in
`archive/PLAN_ALBUM_CHRONICLE_GRAPH.md` (both merged separately as PR #35), then built
and merged as PR #36.

**Rating history graph (ADR-047).** The eight-bar `RatingHistory` sparkline in
`card-stats.tsx` is deleted and replaced by `src/components/rating-history.tsx`
— a line chart, one point per published football week, over horizontal
rarity-tier bands, with goal markers on weeks the player scored. On
`/players/[slug]` beneath `AttributeBars`; `/club/collection/[cardId]` gains a
one-line link to it rather than a second copy. The snapshot query is now scoped
to the active season instead of an unscoped `limit(8)`. No migration — the
series stays sparse (one or two points per player) until more weeks accumulate,
by design.

**Panini collection album (ADR-048).** `/club/collection` defaults to a bound,
paged album: nine slots per page, alphabetical, desktop two-page spread and
mobile one leaf, owned slots showing the card, gaps showing an empty slot,
duplicates stacked. The existing filter/sort/discard/list grid moves to
`?view=manage` behind a segmented control. Lenses (`all` · `gaps` ·
`specialists` · `type:<archetype>` · `tier:<tier>`) choose the album's contents;
archetype is a lens rather than the album's spine because ~80% of the roster
carries the `all_rounder` default. New `src/lib/album.ts` plus
`src/components/album/` (`collection-album.tsx`, `lens-menu.tsx`,
`album-keyboard-navigation.tsx`). No migration.

**TFH Chronicle (ADR-049).** `/chronicle` (index) and `/chronicle/[week]` (one
issue per football week, keyed by the ISO Monday as `YYYY-MM-DD`) replace
`/sessions`, which — with `/sessions/[sessionId]` — becomes a permanent
redirect. The More-menu entry is renamed "Sessions" → "Chronicle", keeping
`IconSessions`. v1 issues carry the header, matchday reports (attendance,
scorers, bibs) and tier crossings only; the crossings block is omitted entirely
when there is not enough snapshot history rather than rendering an empty box.
New `src/lib/chronicle.ts` and `src/game/football-week.ts`.

Migration `20260913000000_chronicle_views.sql` (additive tier): the
`kut.chronicle_weeks` and `kut.chronicle_tier_changes` views, both
`security_invoker = true`, `revoke all from public`, `grant select to
authenticated, service_role`. Rollback is two `drop view`s.

Verification: CI green on PR #36 — `fast`, `e2e`, `database` and `scan` jobs all
passed, plus the Vercel deployment. New tests: `tests/unit/album.test.ts`,
`chronicle.test.ts`, `football-week.test.ts`, `rating-history.test.ts` (54 unit
tests total, up from 48) and `supabase/tests/database/chronicle_views.test.sql`
(`plan(4)`).

**Deployed to hosted 2026-09-02** — the SQL file catalogued into
`VibeTrunk/supabase` (PR #22) and applied from there; `supabase migration list`
shows `20260913000000` local and remote with no drift on the 44 prior
migrations. Production serves `/chronicle` at `kut.vibetrunk.com`.

Spec updated with this entry: §41 (collection album) rewritten from its Phase 2
sketch to the built design, Part XVII §46 (navigation) updated for the
`/chronicle` entry, and Part 137 amended for the launch roster rule (ADR-050).

## Fix the four open layout defects (KB-003 … KB-006) — 2026-09-04

Cleared `KNOWN_BUGS.md` — two album alignment defects found in our own review of
the ADR-048 spread, and the two mobile defects from Maarten's round-4 feedback.
The mobile pair was designed as before/after phone artboards first and the
approach approved from those.

**Album slot alignment (KB-003).** A collected slot was a `pt-4` wrapper around a
5:7 card; an empty slot was a bare 5:7 link with its number placed *inside* the
box. The two states were ~1rem apart in height, and since each leaf is its own
grid in its own `<article>`, row heights are computed per page — so any row where
one leaf held a card and the other held a gap pushed the facing leaves out of
horizontal alignment for the rest of the spread. Both states now render through
one `SlotFrame` (number strip + aspect box); the collected overlays already
positioned against that wrapper, so nothing moved. Matches design spec §3.7.

**Spread page index (KB-004).** Desktop opens two leaves but the index
highlighted one chip, so the facing page read as closed. Added `spreadPartner()`
beside `spreadFor()` in `src/lib/album.ts`, with a unit test, and made the chip
class three-way. The partner is marked at `lg:` only — the second leaf is
revealed purely by CSS, and `BUILD_SPEC.md` §41 requires identical page numbers
at both widths, so it is marked, never renumbered. `aria-current` still names the
single requested page; the all-pages view has no partner.

**Leaderboard on mobile (KB-005).** Below `sm` each club was a three-row block
~129px tall with the ruled header hidden, so three clubs filled a phone and the
eye travelled down rather than across. Now one table shape at every width:
`grid-cols-[2rem_minmax(0,1fr)_auto]`, header always shown, 63px per row, six or
seven clubs visible. The cards/players counts are **demoted** into the club meta
line, not hidden — `BUILD_SPEC.md` §39 lists both as leaderboard display fields.
The name track stays the only flexible one with `min-w-0`, which is what keeps
round-3 finding #3 from returning; the comment there was rewritten to say so.

**Market on mobile (KB-006, ADR-051).** The grid was `grid-cols-1` below `sm`, so
one listing filled the viewport. It is now `grid-cols-2 … sm:grid-cols-3
lg:grid-cols-4`, matching Home's riser grid. `Buy for 1250 KUT Coins` does not
fit a ~160px button, so the label is a coin glyph plus the price with the full
sentence kept as `aria-label`. The offer form does not fit either, and rather
than a modal layer the app does not have, offers moved to a new
`/market/[listingId]` detail page — see ADR-051 for the rejected bottom-sheet
alternative. `ProposeOfferForm` lost its collapsed state, the market index
stopped fetching offerable cards it no longer renders, and the four market
actions widened `revalidatePath("/market")` to `("/market", "layout")` so the
nested route is invalidated.

Front-end only: no migration, no schema, no economy value, no RPC change. Every
surface already had the data it needed. KB-003, KB-004, KB-005 and KB-006 all
marked fixed. ADR-051 for the offer relocation only; the other three are layout
fixes and take none, per the KB-002 precedent.

Spec updated with this entry: §36 gains the listing surfaces.

Verification: `npm run verify:fast` (55 unit tests, up one for `spreadPartner`) +
`next build`, then driven against a local Supabase stack signed in as a real
member.

- **Album, 1440px.** Every slot box measures 222px whether collected or empty,
  and on a spread mixing the two states across both leaves the row tops match
  exactly (`[555, 793, 1031]` on each). Both spread chips render brass, with
  `aria-current` on only the requested page.
- **Leaderboard, 390x844.** 63px rows, ruled header present, counts on the club
  meta line, no horizontal overflow. Only one club exists locally, so the row
  geometry is measured and the six-or-seven figure follows from it rather than
  being counted on screen.
- **Market, 390x844.** Two 167px tiles per row; the card links through to
  `/market/<id>`, which renders the detail card, Buy, and the offer form with no
  leftover "Make an offer" button. A stale listing id renders "Page not found",
  matching `/club/collection/[cardId]`. No console errors on any page.

Known, pre-existing and unchanged by this work: a *malformed* (non-UUID) id on
either `/market/<id>` or `/club/collection/<id>` renders the error boundary
rather than "Page not found", because the query rejects the cast before the
`notFound()` check is reached.

## Compact the market filter form on mobile (KB-008), register KB-007 — 2026-09-04

Two follow-ups from the KB-006 verification pass.

**KB-008 — the filter form.** Verifying the two-column market grid showed the fix
was being wasted: the filter form only opened into columns at `sm`, so on a phone
its six controls stacked full width for ~352px, and the first listing still sat
below the fold. It is now two columns below `lg` — search across the top, the two
selects paired, the price bounds paired, then Filter — measured at **232px**, with
the first listing moving from ~706px to 586px. DOM order was regrouped to match
the rows, which moves sort ahead of the price pair in the `lg:` track list; the
desktop row is otherwise unchanged, still a single 74px row of six tracks.

**KB-007 — registered, not fixed.** A malformed (non-UUID) id on `/market/<id>` or
`/club/collection/<id>` renders the error boundary rather than "Page not found",
because the raw path segment reaches the query and fails the `uuid` cast before
the `notFound()` check. Pre-dates this work — the new market route inherited the
pattern from the collection page. Left open deliberately: fixing it touches a page
outside this branch's scope, and the register is the right place to hold it.

Front-end only: no migration, no schema, no economy value.

Verification: `npm run verify:fast` + `next build`, then measured in the running
app at 390x844 and 1440x900 — form 232px vs 74px respectively, six controls
present at both widths, no horizontal overflow, and two listing cards now visible
under the form on a phone where previously only a sliver of one showed.

## Reserve the safe-area inset under the mobile tab bar (KB-010) — 2026-09-05

First of four PRs from the navigation UX audit. Shipped
alone because it is a two-line bug fix and deserves its own revert.

**KB-010 — content hidden behind the tab bar.** The bottom tab bar is
`fixed inset-x-0 bottom-0` and adds `pb-[env(safe-area-inset-bottom)]` **on top
of** its own content, so it measures **61.5px** at a zero inset and 95.5px on a
device reporting the usual 34px. The content wrapper reserved a flat `pb-16`
(64px) either way, so the shortfall was the inset minus 2.5px of slack — about
**31.5px of every page** sitting under the bar on a modern iPhone, and nothing
at all on a device without an inset. That last part is why it survived this
long: local development, CI and every desktop width all report an inset of 0,
so the bug is invisible everywhere it gets tested.

The wrapper now reserves `calc(4rem + env(safe-area-inset-bottom,0px))` below
`sm`. The explicit `0px` fallback is load-bearing rather than decorative: with a
bare `env()` an unset variable invalidates the whole `calc()`, the declaration
is dropped, and the padding falls to 0 — strictly worse than the bug being
fixed.

**KB-011 — registered, not fixed.** Signing in as a local `role = user` account
to take the measurement showed that `login-form.tsx:30` runs
`router.replace("/admin/attendance")` after *every* successful sign-in. Members
are then bounced to `/` by `requireAdmin()`, so the end state is right and there
is no authorization hole — but the landing page for the whole product is a
hardcoded admin route. Unrelated to this layout change, so it goes in the
register rather than into this PR; it belongs with the navigation work.

Front-end only: no migration, no schema, no economy value. No ADR — a layout
fix, per the KB-002 / KB-003 precedent.

Verification: `npm run verify:fast` (55 unit tests) + `next build`, then driven
against a local Supabase stack signed in as a real member at 390x844.

- **Emitted CSS.** `.pb-\[calc\(4rem_\+_env\(safe-area-inset-bottom\,0px\)\)\]`
  resolves to `padding-bottom: calc(4rem + env(safe-area-inset-bottom,0px))` in
  the built stylesheet — checked because Tailwind drops an arbitrary value it
  cannot parse silently, and a build passing proves nothing about it.
- **No regression at a zero inset.** Computed `padding-bottom` is **64px** on
  `/`, `/market`, `/leaderboard` and `/settings` — identical to the old
  `pb-16`, as it must be, since every environment available here reports 0.
- **Bar geometry.** 61.5px tall, top edge at y=782.5 in an 844px viewport, on
  all four pages. `scrollWidth` equals `innerWidth` (390) throughout, so no
  horizontal overflow was introduced.

The 31.5px figure is arithmetic from the measured 61.5px bar, not a reading
taken on a notched device — no such device was available here. Worth a look on
a real iPhone when one is to hand.

## Five tabs, a messages control and an account menu (ADR-053) — 2026-09-05

Second of four PRs from the navigation UX audit, and the substantial one. The
"More" overflow menu is removed entirely; every destination is now a primary
tab, a tab within a section, or one of two single-purpose chrome controls.

**The headline, and it is measured.** Nine of fifteen member destinations lit
nothing in the chrome before this change — active styling was computed only
for `primaryNavItems`, and the "More" button never took a state of its own.
Driven through all fourteen member routes at 390px afterwards: **unlit
destinations: none.**

**Primary tabs** are now Home, Collection, Packs, Market, Leaderboard, the same
on the desktop bar and the mobile bottom bar. `/club` retires to a
`permanentRedirect("/club/collection")`, following `/sessions`. Its whole job
was linking to Collection and Packs — both already tabs — plus Club Value, and
it closed on a "squad building is planned" placeholder.

**Section tabs** replace two menu rows: Market gains `Buy` / `Offers` and the
Leaderboard gains `Clubs` / `Players`. The new `SectionTabs` serves both plus
the Admin row, which migrated onto it in the same change — three consumers, so
the abstraction was proved against a third shape rather than assumed. Admin's
targets grew from ~34px to ~44px as a result, which `BUILD_SPEC.md` §52 asks
for and which makes the admin header slightly taller.

**One event, one badge, one place.** An incoming trade offer used to increment
`incomingOfferCount` *and* write an unread notification, and both then merged
into a single 6px dot. The offer count now sits on the Market tab and the
Offers section tab; unread messages sit on a Messages control of their own. The
dot is gone. Both market pages read the count from `getNavContext()`, which is
`React.cache()`d and already called by the `(app)` layout in the same request —
free, and it makes a disagreement between the two badges impossible.

**The avatar became the account menu.** It was `aria-hidden="true"` with no
link or handler, next to a control labelled "More" whose panel opened headed by
the member's display name; the two had swapped jobs.

**Route matching moved to a pure table.** `src/lib/nav/routes.ts` has no React,
no `next/*` and no Supabase imports, so the rules are unit-testable in a repo
with no jsdom — the precedent `src/components/pack-reveal-state.ts` sets and
documents in its own header. The per-item `isActive` closures could not survive
this: `/market` and `/market/offers` are both tabs, so an independent prefix
test lights both on the offers page while an independent exact test stops
lighting anything on `/market/[listingId]`. Only a whole-list longest-prefix
resolver gets both right.

**Two destinations needed an owner, found during verification.** The first pass
left `/chronicle` and `/club/value` lighting nothing — both had lost their menu
row and neither belonged to a tab. Home now owns the Chronicle (both answer
"what happened this week"; Home's own heading is "This week in KUT") and
Collection owns Club Value, which is also where its figure now lives. A test
asserts every member destination resolves to some tab, so this cannot regress
quietly.

Also: the duplicated Album/Manage toggle is resolved — both Collection headers
render through one `CollectionHeader` — and five icons lost their last
consumer, so `IconClub`, `IconMenu`, `IconDirectory` and `IconOffer` are
deleted while `IconScale` and `IconSessions` are reused and `IconUser` is new.

Front-end only: no migration, no schema, no economy value. Part L untouched.

Spec updated with this entry: §46 rewritten as the canonical nav record, §47
amended for Home's Chronicle link.

Verification: `npm run verify:fast` (87 unit tests, up 32 from 55) +
`next build` — the build is not optional here, since `verify:fast` never
compiles and this moved code across the server/client boundary in three
places. Then driven against a local Supabase stack signed in as a real member,
with a real incoming trade offer created through `create_listing` +
`propose_trade` rather than fabricated rows, so both badges had live data.

- **Wayfinding, 390px.** All fourteen member destinations light something:
  eleven light a tab, three (`/settings`, `/settings/card`, `/how-it-works`)
  light the avatar ring. `aria-current` resolves as designed — on
  `/market/offers` the Market tab is `"true"` and the Offers tab is `"page"`,
  so the screen never carries two `aria-current="page"`.
- **Badges.** Market tab and Offers section tab both render `1`; the messages
  control announces `"Messages, 1 unread"`.
- **Bottom bar, 320px and 390px.** Five equal tracks (64px / 78px), no
  horizontal overflow, no label clipping — "Leaderboard" is the longest label
  the bar has carried and measures 61.1px in a 64px track at 320px, which is
  what the `text-[10px] min-[360px]:text-[11px]` step is for. Tab height 54px,
  above the 44px target. The badge is absolutely positioned against the icon,
  so it does not widen a track or grow the row.
- **`/club`** redirects to `/club/collection`. `club/loading.tsx` is
  deliberately kept: it is the Suspense boundary for `/club/collection`,
  `/club/packs` and `/club/value`, not just the retired page.
- **Keyboard.** Enter opens the account menu, Escape closes it and returns
  focus to the trigger; no `role="menu"` remains in the document.
- **No page errors** on any route at any width.

Note for KB-010's numbers: the bottom bar now measures 55–56px rather than the
61.5px recorded there, because the labels gained `leading-none` and the 320px
size step. The safe-area reservation is unchanged and still clears it, with
more slack than before.

## One filter bar across the three card grids, and KB-011 — 2026-09-05

Third of four PRs from the navigation UX audit.

**Three grids, three vocabularies, two behaviours.** The Market, the player
directory and the Collection's Manage grid show the same cards filtered by the
same three fields, and each did it differently: the Market and the directory
used a `<form>` of selects behind an explicit **Filter** submit; Manage used
instant-navigation chips for tier, a link row for sort, and a search box with no
button. Tapping a tier chip in your Collection changed the grid; choosing a tier
on the Market did nothing until you found the submit button.

They now share `src/components/filter-bar.tsx`: search on the left, chips for a
short enumerated set (tier), a select for a long one (archetype), sort on the
right, and **everything applies on click**. The Market's min/max price pair and
the directory's archetype select join the same bar without changing its grammar.

**Below `sm` the bar collapses to a Filters pill plus a chip per active filter,
with the full set in a sheet.** That sheet is also the one honest home for an
Apply button — the price bounds are the only control here that genuinely wants
one, because a half-typed number is not a filter. On the Market this replaces
the two-column block KB-008 cut to 232px; the bar is now one row at every width.

**URL rules are pure and tested.** `src/lib/filters.ts` holds `buildFilterHref`
and `countActiveFilters` with no React or `next/*` imports, the same boundary
`src/lib/nav/routes.ts` uses. Defaults stay out of the URL, so the canonical
address is `/market` rather than `/market?sort=newest`; preserved params survive
every change, which is what keeps `?view=manage` from throwing a member back
into the album when they pick a tier.

**Two inconsistencies fixed while here.** The Collection's Manage grid listed
tiers highest-first (Elite → Common) while the Market, the directory *and* the
album's own lens menu list them ascending; it now matches. And its empty-state
"Clear them" link dropped `view=manage`, so clearing a filter silently switched
you to the album view.

**KB-011 — the landing page.** `login-form.tsx` ran
`router.replace("/admin/attendance")` after every successful sign-in regardless
of role; `requireAdmin()` then bounced members to `/`, so the end state was
right and there was never an authorization hole, but every member paid a
navigation through a page they could not open. Everyone now lands on `/`,
admins included — Home is the page built to answer "what changed since I was
last here", and there is no reason for an admin's first screen to be attendance
either.

Deviation from the plan, deliberately: the album's **Lens** was to stop carrying
its own By type / By tier menus "once the shared bar offers them". The shared
bar is not rendered in album mode — the Lens *is* the album's filter — so
removing them would delete the capability rather than move it. Left alone.

Note: the bar renders twice in the DOM, once for each breakpoint, in the same
`hidden sm:flex` / `sm:hidden` pattern `AppNav` already uses for its two
headers. Only one is ever visible, and `display: none` keeps the hidden copy out
of the accessibility tree.

Front-end only: no migration, no schema, no economy value. No ADR: `BUILD_SPEC`
§36 lists which filters must exist — player search, rarity, min/max price and
the three sorts — and every one is preserved; it does not specify how they are
presented.

Verification: `npm run verify:fast` (100 unit tests, up 13) + `next build`, then
driven against a local Supabase stack signed in as a real member.

- **Sign-in lands on `/`** for a `role = user` account.
- **One grammar at 390px** — all three surfaces render the Filters pill and the
  sort control, with the desktop row hidden and no horizontal overflow.
- **Sheet** opens, locks body scroll, offers Apply price, closes on Escape and
  restores scroll.
- **Applies on click** — tapping Gold on the Market gives `?rarity=gold` and the
  pill reads "Filters 1"; choosing a sort gives `?rarity=gold&sort=price`, and
  choosing the default again drops `sort=` from the URL entirely.
- **`?view=manage` survives** a tier change on the Collection.
- **Desktop 1440** — the inline row on all three, chips in the same ascending
  tier order everywhere, archetype select present only on the directory, no
  overflow.
- **No page errors** on any surface at any width.

## Mobile page treatment and the naming sweep — 2026-09-05

Last of four PRs from the navigation UX audit. The shell was fixed in ADR-053;
this is the pages inside it. Mobile is the primary platform for a game about
turning up to football on a Monday, but the desktop layout was the considered
one and the phone inherited it — that is what this reverses.

**Compressed headers.** Utility pages opened with a kicker, a 48px serif `h1`
and a two-to-three-line standfirst before anything happened. Below `sm` the
heading is now 30px and the standfirst is dropped — but only on pages where it
is pure description. The leaderboard's carries the "See the full breakdown"
link and Messages' carries the unread count, so both stay at every width; no
route is lost to a hidden paragraph. Desktop is untouched at 60px. On the
Market the first listing moves from **597px to 343px**.

**One sheet, not two.** `src/components/bottom-sheet.tsx` was extracted from the
filter sheet PR 3 shipped, and the account menu is its second consumer. Writing
a near-copy is the mistake that produced two Album/Manage toggles and two
Collection headers before ADR-053 merged them. It owns the scrim, the Escape
key, body-scroll lock, focus-in and focus-return, and it clears the tab bar's
safe-area inset the way the page wrapper does (KB-010).

**The account menu is a sheet on a phone and a dropdown on desktop** — the
divergence ADR-053 deferred. A sheet is the right idiom for a thumb, an anchored
panel for a pointer.

**Detail pages, treated differently on purpose.** On `/market/[listingId]` the
Buy button is pinned above the tab bar below `sm`: the detail card is ~460px
tall, so Buy sat under the name, the attribute bars and a rule. It is rendered
**once** — moved out of flow, never duplicated — so there is no second submit
path, and it returns to the flow at `sm` where the two-column layout has room.
`/club/collection/[cardId]` does **not** get a bar: List and Discard are panels
with a price input and a confirm, not one button, and will not fit one. Its
actions moved above the metadata table instead, at every width — act first,
reference data after. Two shapes of content, two treatments; the plan called for
a sticky bar on both and only one could honestly have it.

**Activity ledger.** Below `sm` each entry stacked into three rows — kind,
description, timestamp — twelve times, the longest block on the most-visited
page. Kind and time now share a line with the description under them: **78px per
entry against ~94px**, with nothing hidden and no dead "See all" link to a page
that does not exist.

**Album swipe.** A horizontal drag turns a leaf, which is what a phone user
tries first on something drawn as a bound album. The "‹ Page 3" buttons and the
page index stay exactly as they were — the swipe is an addition, never the only
route, and a gesture is claimed only once it is clearly horizontal (60px across,
under 40px of vertical travel) so scrolling is never blocked.

**Naming sweep.** One name per section, in the tab, the heading and the back
link: "Club Value Leaderboard" → **Leaderboard**, "Player directory" →
**Players** (heading, metadata title and the profile back link), and the listing
back link "← Transfer market" → **← Market**. Kickers keep their editorial voice
— "Transfer market", "KUT roster", "KUT inbox" are the clubblad register and are
what a kicker is for; they simply stop being a second name for the section.

`IconSessions`, the calendar glyph the Chronicle borrowed from the `/sessions`
list it replaced in ADR-049, is retired for a new `IconChronicle`.

**Docs correction.** ADR-053, `BUILD_SPEC.md` §46 and KB-010 all said "Log out".
The button says **"Sign out"**, matching "Sign in". The prose was wrong, not the
code.

Front-end only: no migration, no schema, no economy value. No ADR — ADR-053
already records the navigation decision and named this mobile pass as deferred
work; nothing here changes a rule, an invariant or a public surface beyond the
§46 wording fix.

Verification: `npm run verify:fast` (100 unit tests) + `next build`, then driven
against a local Supabase stack at 390×844 and 1440×900, with a listing owned by
*another* member so the Buy path actually rendered.

- **Headings** 30px on the phone and 60px on desktop, standfirsts visible only
  at `sm`+. First content: Market 343px, Players 359px, Leaderboard 396px. No
  horizontal overflow anywhere.
- **Account sheet** opens, locks scroll, lists Settings / My card / How KUT
  works plus one Sign out button, closes on Escape and restores scroll.
- **Buy** — exactly one button in the DOM, `position: fixed` at 390px with its
  top at 704px in an 844px viewport (visible without scrolling, clear of the tab
  bar), and `position: static` at 1440px.
- **Card detail** order is attributes → rating-history link → actions → rule →
  metadata, so the actions precede the reference table.
- **Ledger** 78px per entry, two rows, order 1/2/3 as intended.
- **No page errors** on any surface at either width.

## Five-feature specs and screen designs — 2026-09-05

**Design complete for review; features remain unimplemented.** Added
`docs/SPEC_NEXT_FEATURES.md` with concrete product rules, UX, data/RPC boundaries,
privacy, economy implications, failure/correction states, release sequence and
future acceptance tests for the five requested additions:

- private wanted-card lists and mutual trade matching, including the necessary
  direct-card extension to the existing listing-based escrow contract;
- Special-edition scaffolding only, issuing no editions/copies and leaving
  the member pack experience Live-only;
- member-submitted goals and optional positive kudos, a 24-hour report window,
  automated finalization, deterministic session-based Form decay and versioned
  historical cutover; routine admin attendance no longer asks for goals;
- 175-coin basic packs, preserving the three cards, weights and 250-coin awards;
- per-edition duplicate Club Value weights of 100% / 20% / 5% / 0% thereafter,
  with full discard payouts explicitly distinguished from weighted contribution.

`design/features/index.html` is an offline interactive review gallery with
13 primary screens, supporting routes, pickers, confirmations and error/closed
states. It exports the actual LiveCard/icon components, material CSS and existing
self-hosted fonts, with fictional fixtures. `docs/design/features/` contains
mobile/desktop PNGs, an overview, screen guide and verification record. Updated
the roadmap/documentation map to point to this design; it does not silently
replace the currently shipped BUILD_SPEC rules or mark an implementation ADR
accepted.

Verification: `npm run verify:fast` passed (lint, typecheck, 100 tests across
14 files); local artifact rendering passed 78 no-overflow layout checks
(13 screens × 320/360/390/430/768/1440px), ten interaction groups and no browser
page errors. Visually reviewed mobile and desktop renders. The Browser plugin
had no connected browser, so used the installed local Playwright Chromium for
artifact rendering. No DB tests/build necessary for this design-only work.

Next implementation work should adopt/revise each proposal in a separate ADR
and PR where migrations or RPC/invariant changes are involved. The 175-coin
price needs actual-roster pack expected-discard-value review before activation;
the spec explains that duplicate Club Value discounts do not lower discard EV.
No app behavior, database, hosted configuration, environment variables or live
economy changed. Nothing pushed or deployed.


## Feature design review revisions — 2026-09-06

Revised `SPEC_NEXT_FEATURES.md` and the interactive gallery after user feedback.
These are still design artifacts, not game/database implementations.

- Replaced reciprocal matching/direct-card offers with private wants and
  explicit trade availability: a wanted card names members open to trading it,
  offers copyable conversation text, and encourages discussion in WhatsApp.
  Existing Market/Offers completes exchanges. No new transfer/escrow contract,
  Matches tab, matching preference or new notification machinery.
- Added 50 KUT Coins once per Player/session for a completed self-report.
  Explicit zero goals and all three kudos categories skipped are valid; drafts,
  edits and admin entry do not pay. Spec includes atomic ledger/idempotency,
  cancellation/relink/reset rules and the cumulative faucet effect with 175 packs.
- Added the Admin Reports screen, completion/accountless/pending distinctions,
  reward status, and Add/Edit goals with required reason. Guest goal entry and
  member corrections preserve completion/rewards. Spec covers immutable audit,
  member-vs-admin precedence and closed-session historical recalculation.
- Added `RATING_BALANCE_REVIEW.md` and a repeatable calculation against the actual
  existing rating engine. Verified +1.5 goal/+1.5 kudos caps, +3 session maximum,
  +8 overall ceiling, decay/cadence, old hat-trick comparison, SHO and discard
  effects. Synthetic turnout simulations explicitly do not predict real votes.

Validation: 72 responsive checks (12 primary screens, six widths), 13 interaction
checks, zero browser page errors; visually reviewed wanted, admin reports and
reward confirmation. `npm run verify:fast` passed lint, typecheck and 100 tests.
No game code, migrations, production data or deployment changed. Refreshed the
local review server's artifact copy so the existing localhost gallery link
shows the revised screens. Former swap/matching images are superseded and are
not linked by the current gallery or screen guide.

## Five-feature implementation handoff — 2026-09-06

Added `docs/IMPLEMENTATION_PLAN_NEXT_FEATURES.md` and
`docs/START_NEXT_FEATURES.md` for a fresh 5.6 Terra / High session to build the
whole revised package. The plan maps existing code and SQL contracts, orders
five separately reviewable feature units, and specifies local database,
concurrency, authenticated browser, history/parity and mobile acceptance gates.
It includes the simplified WhatsApp trading handoff, 50-coin atomic reward,
admin member/guest goal corrections, cutover/legacy rating treatment, scheduler
and fallback, quote-aware 175 packs, duplicate value and zero Special issuance.

Inspected current attendance/pack/economy/rating code, migration definitions,
snapshot trigger and test/CI setup. The plan calls out the current final-state-only
rating rebuild, missing authenticated journey coverage, untracked design files
that must survive a new session, and actual-roster EV as a hosted activation gate.
Linked the plan/prompt from the documentation map, feature spec, roadmap and
screen guide. Verified local document links and patch whitespace. Documentation
only in this step; application tests were not rerun. No game code, migration,
database record, environment, push or deployment changed.

## Five-feature local implementation — 2026-09-06

Implemented the five feature slices locally: zero-issuance Special scaffolding;
duplicate-aware Club Value; 175-coin quote-safe basic packs; private wants and
explicit availability with a channel-neutral contact handoff; and self-reported goals/kudos,
once-only rewards, corrections, versioned ratings, finalization and Chronicle
results. The concrete defaults and migration follow-ups are recorded in
ADR-055–ADR-059 and `BUILD_SPEC.md`'s implemented amendments.

Local database verification passes 14 pgTAP files / 435 assertions, including
privacy, reward, correction, SQL/TypeScript Form fixture and snapshot history
checks. The focused local concurrency suite passed pack idempotency/stale-price
and report reward races. A local pack-EV measurement is 87.46 expected discard
coins per 175-coin pack; a fresh hosted roster measurement, scheduler setup and
operator activation are still required before release. No hosted Supabase
project, deployment, push, PR or merge was changed.

## Mobile walkthrough feedback fixes — 2026-09-06

Resolved seven local walkthrough findings. Trading preferences now combines
wanted editions and available owned copies; all contact copy is channel-neutral.
Wanted-card listing status now uses the public Market projection and has pgTAP
coverage for an admin-owned active listing. Superadmins again see the Settings
Admin destination. Attendance has a visible calendar control, explains the
stored legacy/v2 cutover, retains admin goals for legacy sessions and links a
new v2 publication to its reports. Eligible `/sessions/[sessionId]` visits open
the member report. Chronicle promotion tier labels no longer overflow their
swatches.

Added migrations `20260920060000` and `20260920070000`; both were applied only
to local Supabase. Verification: fast gate 17 files / 110 tests, pgTAP 14 files
/ 438 assertions, concurrency 3 tests, production build passed. The in-app
browser was not connected and Playwright hung before emitting a report, so the
signed-in visual walkthrough still needs confirmation in the user's working
browser. Nothing hosted was mutated or deployed.

## Chronicle reporting-progress and kudos follow-up — 2026-09-06

Open v2 surveys now render as open in Chronicle, including the deadline,
submitted/eligible count, aggregate reported goals and the current member's
report action. A security-definer projection exposes only those aggregates;
individual provisional goals and ballots remain private. Finalized results
remain the only per-player Chronicle output.

Local ballot inspection confirmed the reported four votes for Alex Example and
three (not four) for Charlie Fixture, each in one category. Adopted the revised
kudos Form ladder 0 / 1 / 1.25 / 1.5 for 0 / 1 / 2 / 3 recognized categories,
preserving the +1.5 kudos and +3 combined caps. Migrations `20260920080000` and
`20260920090000` update finalization, keep deadline state database-authoritative
and deterministically replay derived results without changing reports, ballots,
rewards, transaction history or survey audit times.

Verification after this follow-up: fast gate 17 files / 110 tests, pgTAP 14
files / 444 assertions, focused concurrency 3 tests and production build pass.

## Survey finalization lazy fallback — 2026-09-06

The bounded finalizer `kut.finalize_session_surveys(20)` had no runner. Added
`finalizeDueSurveys()` (`src/lib/session-reports/finalize-due-surveys.ts`),
invoked from the Chronicle week issue and session-report page renders: it counts
`open` surveys past `closes_at`, calls the service-role RPC only when some exist,
throttles to once per 60s per process and never throws into the page. No
migration; the RPC and its grants are unchanged (ADR-061). The Messages page
event-type union/labels also gained the already-emitted `session_report`,
`session_results`, `report_correction` and the forthcoming `kudos_awarded`.

## Kudos cap to +2, +3.5 combined cap, and a kudos-awarded notice — 2026-09-06

Migration `20260922000000_kudos_cap_two_and_award_notice.sql` (ADR-063): kudos
Form ladder 0 / 1 / 1.5 / 2; combined per-session Form input cap 3 → 3.5
(`session_input` check widened); `user_notifications.event_type` gains
`kudos_awarded`. `kut._finalize_one_session` now snapshots each player's OVR
before the season rebuild and, for every player with ≥ 1 recognised category,
inserts an idempotent `kudos_awarded` notice — no nominator named, stating the
OVR change (goals + kudos) or nothing when it is not positive. Existing derived
result rows are re-scored and affected seasons replayed; reports, ballots,
rewards, transactions and audit times are untouched. `src/game/rating-engine.ts`
and `design/features/check-rating-balance.mjs` mirror the ladder/cap; the
balance JSON and `RATING_BALANCE_REVIEW.md` are regenerated. Verification: pgTAP
14 files / 449 assertions PASS (5 new), fast gate 17 files / 110 tests PASS,
`npm run build` PASS.

## Consistency sweep: one UUID guard, batched Chronicle reads, dead formulas removed — 2026-09-07

No migration, no schema or game-rule change. A cleanup pass over the weekend's
feature set, from a codebase review.

**One UUID guard.** `src/lib/uuid.ts` (`isUuid`, added for KB-007) was adopted
in 4 files while 16 others kept their own copy of the same regex under four
different names — `UUID_RE`, `uuidPattern`, `uuid`, and inline literals. All 16
now import the helper; zero raw copies remain outside `src/lib/uuid.ts`.

**Chronicle N+1 removed.** `/chronicle/[week]` fanned out one `attendance` and
one `chronicle_session_reports` query *per session*, sitting in the same
`Promise.all` as two correctly batched `.in("session_id", sessionIds)` reads.
Both now batch and group through a `groupBySession` helper, matching the shape
`progressBySession` already used. Two queries per week instead of 2 + 2N.

**Dead formulas deleted (ADR-064).** The TypeScript rating engine and economy
formulas were reachable only from their own unit tests — a second
implementation asserted against itself while the real engine is SQL.
`src/game/` drops 589 → 228 lines. `rating-engine.ts` keeps only display
helpers; `economy.ts` is constants. `card-editions.ts` and `demo-players.ts`
are gone, as is `design/features/check-rating-balance.mjs` (the one non-test
consumer). Special-edition scaffolding is untouched in SQL and pgTAP.

**Smaller fixes.** `ECONOMY.duplicateEditionWeights` replaces a literal
100/20/5/0 array in the Club Value screen and the stale `club_value_v2.sql`
comment reference. `scripts/measure-pack-ev.mjs` now reads
`kut.pack_economy_health` — the admin projection that already computed pack EV
— instead of a fifth copy of the rarity weights, discard curve and pack price;
it resolves an admin and reads the view as that member (the view is
`security_invoker`, gated on `kut.is_admin()`). `VIEW_TABS` is exported and the
duplicated collection-tabs array deleted. Chronicle's `TIERS` derives from
`RARITY_BANDS` and is typed `RarityTier[]`. Two `select("*")` calls name their
columns. A malformed kudos nominee is now rejected instead of being silently
recorded as a Skip. `value.personal_card_weight || …` → `??`. Empty
`sessions/[id]/` route directories removed.

**Docs.** ADR-062 recorded as a tombstone (withdrawn, never shipped — hosted
already held the intended cutover; see the entry for the
`_rebuild_season_core` week-vs-cutover trap it got wrong). The four spent
`*_NEXT_FEATURES.md` planning docs moved to `docs/archive/` and `docs/README.md`
no longer points the next session at them as future work; all relative doc
links verified to resolve. New design renders are gitignored going forward.

`ROADMAP.md` — whose stated job is "everything **not yet built**" — was carrying
the five-feature package as "**Design only: none of these changes has been
implemented or deployed**" a day after all five shipped. That section is now
marked shipped with each feature's ADR and migration; the two rows still reading
`planned` (duplicate Club Value, wanted cards) are `shipped`; the peer-scoring
cluster moves `favored` → `partial` with its real remainder (assists, defensive
play, 1–5 ratings, goalie saves, player-count goal scaling) spelled out; the
Chronicle row records that its kudos & goals block shipped with member reporting
and only the club-desk block is still open; and `shipped` — used six times but
never defined — is added to the status vocabulary.

Verification: dependencies resynced to the merged Dependabot bumps (Next
16.3.4, vitest 4.1.11 — the local tree had been running the pre-bump versions),
then lint PASS, typecheck PASS, unit 17 files / 110 tests → 14 files / 85 tests
PASS (the drop is the deleted formula suites), pgTAP 14 files / 449 assertions
PASS, `npm run build` PASS. The integration race suite was also run and is
unaffected; it remains outside CI pending the Wave 2 fixture fix.

## Prettier adopted, the source reformatted (ADR-065) — 2026-09-07

No migration, no schema or game-rule change. Tooling and a mechanical reformat,
alone in its own PR.

**The problem.** The repo had no formatter, no `.editorconfig`, and
`eslint-config-next` enforces no formatting rules, so the codebase had forked
into two visually incompatible styles. Sixteen files in `src/`, `tests/` and
`scripts/` carried a line over 400 characters;
`admin/attendance/[sessionId]/reports/page.tsx` was **eight lines long in
total**, with the whole React component on line 8 at 3,845 characters — up from
3,734 in the ADR-064 sweep, because a correct fix added column names to it.
Without a formatter, every legitimate change degrades those files further and
none of them can be reviewed in a PR diff.

**Prettier 3.9.6**, pinned exactly (as `next` and `eslint-config-next` already
are) so a minor bump cannot restyle the repo and redden CI on an unrelated PR.
Chosen over Biome: taking only Biome's formatter still installs a
platform-specific native binary — the install shape that already fails here
(`npm ci` EPERM on Next's SWC binary under OneDrive) — and taking its linter too
would drop the 22 `@next/next/*` and 16 `react-hooks/*` rules, React Compiler
set included, that Biome does not reimplement.

**`printWidth` 100, measured not chosen.** Formatting the pre-reformat tree at
each candidate width: 80 → 136 files / 8,747 churn lines; 90 → 123 / 7,264;
**100 → 111 / 6,034**; 120 → 97 / 4,374. The count of lines still over 100
characters afterwards is flat at 293–299 for widths 80–100 and jumps to 797 at
120. That ~295 floor is `className` string literals, which Prettier never breaks
at any width. So 100 is 31% cheaper than Prettier's default 80 at no cost in
residual long lines, while 120 buys its saving by declining to break lines that
should break. Every other value in `.prettierrc.json` is a Prettier 3 default,
written out explicitly so a future major cannot silently restyle the repo.

**`eslint-config-prettier` is not installed** — checked, not assumed.
`npx eslint --print-config src/app/page.tsx` resolves 86 active rules; every one
was cross-checked against that package's conflicting-rule list, with zero hits,
and its four "special" rules are absent too. It would be an inert dependency.

**Scope.** 164 files: `.ts` / `.tsx` / `.mts` / `.mjs` / `.css` under `src/`,
`tests/`, `scripts/`, plus the seven root configs. `.prettierignore` is the
single source of truth for that reach, because it governs format-on-save in an
editor as well as the npm scripts — `docs/`, `design/` and `supabase/` are
outside it deliberately. 111 files were reformatted (+4,923 / −1,107) in a
commit of their own, readable with `git diff -w` or skippable entirely.
`format:check` is the first step of `verify:fast`; the CI `fast` job already
runs that, so `.github/workflows/verify.yml` needed no edit and local and CI
cannot drift apart.

**Three findings worth keeping.** Prettier is **not idempotent** on member
chains: one `--write` pass left two `actions.ts` files that `--check` then
rejected, because a `supabase.schema("kut").rpc(...)` chain breaks or collapses
depending on whether the *input* was split across lines. Left there,
`format:check` would have failed in CI forever on a freshly formatted tree; the
tree is at the fixed point. `.prettierignore` uses **gitignore semantics**, so an
unanchored `supabase/` also matched `src/lib/supabase/` and silently dropped five
real source files — every directory pattern is now anchored with a leading slash.
And **JSX text is the only place a reformat can change behaviour**: reflowing JSX
moves `{" "}` around (27 occurrences before, 59 after, 14 on the removed side)
and no test suite would catch a lost space, so every changed `.tsx` was parsed
with the TypeScript compiler and its rendered text reconstructed under React's
JSX whitespace rules and compared before against after — all 72 identical, zero
mismatches.

Two lines over 400 characters survive, in `market-race.test.ts` and
`trade-race.test.ts`; both are single-quoted SQL `insert` statements, which
Prettier never breaks.

`main` is squash-merge only, so the reformat commit's SHA never reaches it, and
a `.git-blame-ignore-revs` naming a SHA git cannot resolve makes `git blame` fail
outright. The file therefore ships with its rules and local opt-in documented but
no SHA; a follow-up PR adds the squashed commit's SHA once `main` has it.

Verification, before and after the reformat, with identical counts: `verify:fast`
14 files / 85 tests PASS, pgTAP 14 files / 449 assertions PASS,
`npm run test:market-race` 3 files / 5 tests PASS, `npm run build` PASS.
`format:check` passes clean on the formatted tree. E2E runs in CI only.
## Chronicle results reach the whole club again (ADR-066 / KB-013) — 2026-09-08

The first live kudos round finalized correctly and then appeared to vanish: on
`/chronicle/2026-09-07` a member saw "Results finalized. No report results were
recorded." while an admin on the same URL saw all eleven attendees, their
effective goals and their recognised categories. Nothing was wrong with the
data. `kut.chronicle_session_reports` ran as the reader
(`security_invoker=true`) and inner-joins `kut.session_surveys`, which admits
only `kut.is_admin()` or a member holding a `session_survey_eligibility` row —
an attendee. Everyone who missed the session read zero rows. The
`"members read finalized results"` policy on `kut.session_report_results`
failed identically, because a referenced table's RLS is applied inside a policy
expression, so its `exists()` over `session_surveys` was blind too.

`20260923000000_chronicle_results_visibility.sql` makes the projection
`security_invoker=false` — matching `chronicle_session_report_status`, whose
definer rights are exactly why the status line, the 11-attendee count and the
22-goal total *did* reach every member — and replaces the policy's inline
`exists()` with a `security definer` `kut.is_survey_finalized(uuid)`. No data
change. The join on `status='finalized'` is now the only guard keeping an open
session out of the projection, so the tests assert it directly by reopening the
finalized survey and re-reading as a member.

The same change repairs three columns nobody had noticed were broken:
`submitted_reports`, `eligible_accounts` and `attendee_count` are sub-selects
over RLS-scoped tables, so an attendee computed "1 of 1 reports submitted". The
page hid it by preferring the status view's counts and treating these as a
fallback.

Six new pgTAP assertions in `next_features_contracts.test.sql` (plan 40 → 46),
using a new fixture member with no player link and no eligibility row: they read
the finalized issue, see the club-wide submitted count of 3, select from
`session_report_results` directly, and see nothing at all in either place once
the survey is reopened.

Verification: `verify:fast` PASS (14 files / 85 tests). The migration was
applied to the local stack and the full pgTAP suite re-run against it: 14 files,
455 assertions, zero failures (449 before, +6 here). The local schema reproduced
the defect exactly — `chronicle_session_reports` reported `security_invoker=true`
beside its sibling's `false` — before the migration flipped it. E2E runs in CI
only. Deployed 2026-09-08 from `VibeTrunk/supabase` (catalogue PR #31), in one
`db push` with ADR-067's migration; hosted checks confirm
`chronicle_session_reports` reports `security_invoker` = `false` and
`kut.is_survey_finalized` exists, and the week-of-7-September issue now renders
the full per-player table on a non-admin account.
## Admins can close a report window early (ADR-067) — 2026-09-08

The 24-hour report window is the right default and the wrong one once everybody
present has filed. `kut.admin_finalize_session_survey(uuid, text)` is a gated
front door to `kut._finalize_one_session`: `kut.is_admin()`, a 3–500 character
reason, refuses a cancelled survey, returns `already_finalized` instead of
raising on a second press, and hands back the attendee / eligible / submitted
counts and whether the three-ballot kudos quorum was met. Same scoring, same
season rebuild, same notifications — only the timing moves.

Nothing downstream needed a change, because everything already keys off
`session_surveys.status`: `submit_session_report` rejects anything but `open`,
`finalize_session_surveys` only claims `open` rows so it cannot double-run, and
`chronicle_session_report_status.accepting_reports` flips on its own.
`closes_at` is left alone — the table's `check (closes_at = opened_at + 24h)`
means moving it would mean rewriting when the window opened — so the published
deadline stays on the record and an early close is visible as
`finalized_at < closes_at`. New nullable `finalized_by` / `finalized_reason`
columns stay null on the automatic path, so null reads as "closed at its
deadline".

`/admin/attendance/[sessionId]/reports` grows a panel above the roster: the
automatic close time, how many of the eligible members have submitted, that the
pending ones can no longer submit *or* earn the 50 KUT Coins, and that kudos need
three submitted reports carrying nominations before any category is recognised.
The reason field is required before the button will submit.

Verification: `verify:fast` PASS (14 files / 85 tests). Both migrations applied
to the local stack and the whole pgTAP suite re-run: 15 files, 476 assertions,
zero failures — 21 of them new, in `admin_finalize_session_survey.test.sql`,
covering the gate, the reason, the audit columns, the preserved deadline, the
quorum, the closed window, the untouched reward, idempotence and the automatic
path's null audit trail. Two were caught and fixed while writing them: a plan
miscount, and a reward read-back that was itself RLS-scoped to the wrong member.
E2E runs in CI only. Deployed 2026-09-08 from `VibeTrunk/supabase` (catalogue
PR #31), in the same `db push` as ADR-066's migration; hosted checks confirm
`kut.admin_finalize_session_survey` exists, both audit columns are present and
nullable, and no survey row carries a non-null `finalized_by`.
## A wallet read that fails no longer reads as zero coins (KB-014) — 2026-09-08

Tracing a member's report that their KUT Coins fell on a refresh: the ledger
cleared them completely — `wallets.balance` equalled `sum(wallet_ledger.amount)`
for every member in the club, and every movement in the window was accounted for
(six discards up to 250, then a 175-coin pack). But the trace turned up the one
place the UI can state a balance that was never real. `getNavContext` reads the
wallet alongside the profile and never checks `walletResponse.error`, so
`?? 0` turns any failed read into a confident zero in the header pill; Home does
the same, then hands that fabricated figure to Club Value through
`clubValue ?? balance`.

`NavContext.balance` and `AppNavProps.balance` are now `number | null`. An error
logs and yields null, and both coin pills — desktop and mobile — render an em
dash with an `aria-label` of "KUT Coins unavailable". Home renders its wallet
stat the same way. Club Value keeps its `?? balance` fallback for the *no-row*
case, which is a real member who owns no cards and whose club really is worth
just their coins, and degrades to an em dash only when the read itself failed.
The pack store already threw on this error and is unchanged.

Verification: `verify:fast` PASS. No migration, no schema surface.
## Kudos picks survive a save, and a blank category is no longer a Skip (KB-015) — 2026-09-08

Three of nine members in the first live kudos round submitted all-skip ballots
and reported the selection "resetting". It was not the database: the ballots
read back correctly under RLS, and every save had persisted. It was React.

React resets a `<form action={fn}>` once the action settles — `startHostTransition`
calls `requestFormReset` unconditionally in `react-dom` 19.2.8 — and the reset
restores every control to the default it was **mounted** with. A controlled
`<input>` is safe because React keeps the element's `defaultValue` equal to the
current value on every commit; a `<select>` gets no such treatment, and React
never re-applies a changed `defaultValue` to one either. So the three kudos
dropdowns reverted on every save while the goals field, in the same form,
survived — exactly the shape of the report we got. Reproduced against the local
stack: pick three teammates, press Save draft, get the green "Your report is
saved" banner, and watch all three snap back. On a first report the mount-time
default is `""` — the value of the first option, `Skip` — so they snapped back
to Skip, and a second press wrote three real skips.

Making the selects controlled was verified **insufficient**; they still
reverted. The action is now dispatched from an `onSubmit` handler, which keeps
the auto-reset out of it entirely. Alongside that, a category has three states
instead of two: nominee, explicit Skip, or undecided. Undecided is the opening
state, is sent by omitting the category from `p_nominations` (which the RPC
already accepted on a draft and rejected on a submission), and disables Submit
with a named reason — so nobody skips by inertia and no reverted ballot can be
resubmitted as one. Duplicate nominees, a database constraint that used to fail
the whole save with a generic message, are caught inline and named. The teammate
list is sorted by display name; `kut.attendance` has no natural order and is
read by a sequential scan, so it was in heap order before.

Verification: `verify:fast` PASS (15 files / 93 tests), 8 of them new in
`tests/unit/kudos-ballot.test.ts`. Driven end to end against the local stack as
member_c on a reopened survey: the bug reproduced on the old code, then, on the
new, picks survived a draft save and a submit, a reload round-tripped two
nominations plus one explicit Skip, a partial draft stored one nomination with
no skips, Submit stayed disabled while any category was undecided, and a
duplicate pick was blocked and named. No migration; the RPC contract is
unchanged. ADR-068. The same React reset affects three cosmetic surfaces
elsewhere, registered as KB-016.
## The kudos notice says what you won and why your card moved — 2026-09-08

ADR-063's `kudos_awarded` body was deliberately vague: "Teammates recognized you
with kudos this session. Your card rating rose +N OVR this week." It withheld
the part that is actually the reward — which categories — and implied the whole
week's movement came from kudos.

The body now names every recognised category in ballot order, joined by a new
`kut._join_names(text[])` helper as "A", "A and B" or "A, B and C", and credits
the movement to this session's goals *and* kudos, naming the goal count when
there is one and claiming no goals when the player scored none. A movement of
zero or less still produces no rating sentence, and the notice still names no
nominator.

Verification: 482 pgTAP assertions across 15 files, zero failures — six of them
new, covering the full body text of a single-category notice, that it names no
category the player did not win, and the one/two/three/empty forms of the name
join. All four body shapes were also driven end to end against the local stack
by seeding ballots on a reopened survey and finalizing: three categories with
two goals, two categories with one goal (singular), one category with no rating
move, and three categories with no goals ("These kudos lifted…"). `verify:fast`
PASS. ADR-069, `20260925000000_kudos_award_notice_detail.sql`. Deployed
2026-09-08 from `VibeTrunk/supabase` (catalogue PR #33), on its own additive
`db push` on top of the ADR-066 / ADR-067 batch earlier the same day. Hosted
checks confirm `kut._join_names` and the replaced `kut._finalize_one_session`
exist, that the helper renders `Engine, Playmaker and The Wall`, and that the
finalizer body now calls it; `migration list --linked` shows `20260925000000`
Local = Remote with no drift across the ledger, and the catalogue check reports
65 approved source migrations. Notices written before the push keep the ADR-063
wording, so the club sees a mix until the next session finalizes.
## The archetype select stops contradicting its own save (KB-016) — 2026-09-08

Follow-up to KB-015. Registering that bug, I noted three other forms that looked
like they shared the React post-action reset. Driving all three against the
local stack, only one of them actually does.

The card editor's archetype `<select>` saved correctly — RPC ran, stats
recalculated, "Archetype updated" shown — and then kept displaying the previous
archetype until a hard reload, so the page contradicted its own confirmation.
Fixed the way KB-015 was: controlled *and* dispatched from `onSubmit`, since
controlling a `<select>` alone was already proven insufficient.

The club-name field and the admin goal-override inputs do **not** revert, and
the register has been corrected. React's `updateInput` pushes a changed
`defaultValue` to the DOM on every update, so an uncontrolled `<input>` picks up
the revalidated server value and the reset restores that; a `<select>` gets no
equivalent. That asymmetry is the whole reason the same `<form action={fn}>`
pattern is harmless on one control type and destructive on the other — which is
also why the goals field survived while the kudos dropdowns did not.

Verification: `verify:fast` PASS. Driven end to end as a member: saving an
archetype now leaves the select on the new value, a hard reload agrees, and
`kut.players.archetype` matches; the club name overwrote an existing value and
held; the admin goal override held and its row read back "Goals: 4 (admin
correction)". No migration, no schema surface.

## The integration race suites become a real CI gate (ADR-070) — 2026-09-15

Wave 2 of the codebase-quality sweep. The three suites in `tests/integration/`
cover the concurrency and atomicity of the economy paths `BUILD_SPEC.md` Part
XX–XXIII requires to be server-authoritative — market buy races, trade-offer
escrow, pack replay and stale quotes — and they are the only automated proof
those RPCs serialize under contention, since pgTAP runs one session inside a
rollback and structurally cannot test a race. They were unrun on every axis:
`vitest.config.mts` globs `tests/unit/**`, no CI job invoked them,
`trade-race.test.ts` had no script, and `test:market-race` silently ran all
three through a config whose name claimed one.

Fixed in that order — correctness first, gate second, because the point was
that the gate be trustworthy before it became a gate.

Three configs collapse to two. `vitest.integration.config.mts` (new) replaces
`vitest.market-race.config.mts` and the scriptless
`vitest.next-features-race.config.mts`; `npm run test:market-race` becomes
`npm run test:integration`, and `verify:full` gains it. `npm test` stays
unit-only and database-free, which is load-bearing — the CI `fast` job runs
`verify:fast` with no Postgres.

Each suite is now correct in isolation: `market-race` and `trade-race` own their
`kut.players` row instead of leaning on the seed player, and every id each
writes sits under its own UUID prefix (`20000000-`, `21000000-`, beside the
`30000000-` `next-features-race` already used). `fileParallelism: false` is the
belt to that braces, for suites nobody has written yet.

**Two corrections to the reported problem.** No suite ever deleted the shared
seed player — both only read it as an FK target, under distinct edition ids — so
there was no delete/re-insert race and no fixture-id collision. But a real
unscoped delete was found one file over: `trade-race.test.ts`'s cleanup carried
`or reason in ('trade_escrow','trade_unescrow','trade_sale')` with no user
scope, deleting every trade ledger row in the database for every account, twice
per run. Invisible across the test suite, destructive against a local stack with
real trade history. The `user_id` predicate alone already covers the suite, so
the `or` arm is gone. The reported violation count was also 14 migrations in one
PR, not 11.

The `DeprecationWarning` about overlapping `client.query()` calls is gone —
three `Promise.all` fan-outs of four, five and three queries on the same `admin`
client, all post-race assertion reads, now awaited one at a time. The
`Promise.all`s that *are* the races use separate clients and are untouched.

CI: a step in the existing `database` job after `test:db`, with
`timeout-minutes: 5` because a suite that loses its lock ordering hangs rather
than fails. The job's trimmed stack was verified sufficient rather than assumed —
the suites need no PostgREST and no GoTrue, and their data dependencies
(`'tfh-pack'`, the kudos category ids) come from migrations, not `seed.sql`. It
blocks from day one: branch protection has `required_status_checks: null`, so
nothing gates a merge today and a red step is pressure, not a block.

Also new: a PR-only `migrations` job failing any PR that touches more than one
`supabase/migrations/*.sql`, making `CLAUDE.md`'s prose rule mechanical. It
reads only the PR's own diff against the merge base, so the 64 existing
migrations cannot trip it.

Verification: the substance here was the stress run, since these suites mutate
shared state rather than rolling back. **20 consecutive runs of
`npm run test:integration` on the final code: 20 passed, 0 failed**, 3 files / 5
tests every time, 4.0–4.5s per run once warm (the two cold runs took 7.4s and
7.6s). Zero `DeprecationWarning` lines across all 20. An earlier 20-run pass on
the pre-formatting code was also 20/20, 3.8–4.8s. `verify:fast` PASS — 15 unit files / 93
tests. `npm run test:db` PASS — 15 files / 482 pgTAP assertions.
`npm run build` PASS. The migration guard was driven against three arms locally:
this branch (0 migrations → pass), `87549ee` (1 → pass), `43ebedc` (14 → fail,
naming all 14). No migration and no schema surface; `src/` untouched.

Local-stack note: the working copy was four migrations behind
(`20260922000000`–`20260925000000`) and `20260925000000` had partially applied —
`kut._join_names` existed but `kut._finalize_one_session` had not been replaced.
Both were applied by `docker exec … psql` and the ledger now reads 64.

## Durable production-safety controls (ADR-071) — 2026-09-15

Implemented the repository half of the production-safety plan without touching
application code, migrations, hosted data, credentials, GitHub settings,
Vercel, or deployment state.

- One canonical production-invariants source now generates a byte-identical,
  directly visible block in `AGENTS.md` and `CLAUDE.md`; `verify:fast` rejects
  drift. It expressly prohibits secret output, bundled migration/invariant
  slices, ungated deployment, and unverified/unrecoverable backup claims.
- CI now runs on docs-only changes, publishes an always-present `merge-gate`,
  adds a production-dependency audit, and enforces immutable migration history,
  one new migration, and companion pgTAP evidence or reviewed JSON exemption.
  Gitleaks is pinned to the v8.30.1 linux/amd64 image digest.
- Backup credentials now use stable Windows DPAPI locators. `.env.local` is an
  explicit bootstrap source only, parsed with tested dotenv semantics. Backup
  production, encryption, and cold verification are isolated across processes;
  publication is atomic and rekeying stages a separately verified new file.
- The SHA-bound non-deploying production gate requires exact fresh GitHub
  evidence, KUT-to-central migration hashes, agent-session evidence,
  authenticated member/admin mobile E2E, finalizer readiness, and both recent
  and freshly repeated cold-backup verification. Release approval remains a
  separate expiring artifact with `deployment_authorized = false`.
- Codex and Claude production launchers plus `SessionStart` hooks fail on model
  mismatch. Codex high reasoning is launcher-enforced and recorded because the
  current hook payload cannot independently attest reasoning effort. Separate
  session prompts now define specification, migration, integration, and release
  handoffs and their authorization boundaries.

Verification: formatting, lint, typecheck, workflow JSON/YAML parsing, and
PowerShell parsing pass. Unit tests pass (18 files / 116 tests); pgTAP passes
(15 files / 482 assertions); integration/finalizer tests pass (4 files / 6
tests); unauthenticated E2E passes (26 tests); authenticated Pixel 7 member/admin
E2E passes (2 tests); production build passes (29 pages); npm production audit
reports 0 vulnerabilities; DPAPI credential-store and separate-process cold-
verify/rekey pipeline tests pass; the 64-file catalogue hash check passes.

Still deliberately external: land the repository change, observe a green CI
run, then separately authorize configuring `merge-gate` and `scan` as required
checks (bare job names; corrected 2026-09-15). Real credential bootstrap, a hosted
backup, a clean-SHA production gate, release approval, push, merge, hosted
migration, and deployment were not performed.

### ADR-071 review corrections (2026-09-15)

A review of the unlanded ADR-071 tree, before it was committed, found five
defects; all are fixed and recorded in the ADR-071 addendum in
`docs/decisions.md`.

The one that mattered most: the destructive test fixtures had no target guard.
The authenticated Playwright setup deletes and recreates `auth.users`, every
database suite took its connection string from an environment variable with
only a loopback default, and the production gate itself requires `API_URL` and
`DB_URL` to be exported — so an operator holding hosted values in their shell
would have pointed those fixtures at production. `tests/support/local-target.ts`
now refuses a non-loopback host across the integration suites, the Playwright
global setup/teardown, and the authenticated Playwright config; verified by
running the suite against a hosted-looking URL and watching it exit non-zero
before a browser started, naming the host and not the password.

Also: commit, push and `supabase functions deploy` no longer auto-allowed in
either agent rule set (direct pushes to `main` denied); the Claude session hook
rewritten as attest-only because `SessionStart` provably cannot abort a session
and `model` is optional there, with real enforcement moved to a new
`PreModelSwitch` guard that blocks a mid-release downgrade off Opus;
`finalizer-readiness.test.ts` replaced with a real end-to-end finalization test;
and the backup pipeline tests extended from happy-path only to 23 assertions
covering wrong credential, tampered and truncated ciphertext, hash mismatch,
evidence suppression and rekey failure, plus a recursive work-directory cleanup
that can no longer mask the real error or strand plaintext.

Verification after the corrections: `verify:fast` passes (20 files / 137 tests,
up from 18 / 116); pgTAP passes (15 files / 482 assertions); integration passes
(4 files / 9 tests); unauthenticated E2E passes (26 tests); authenticated mobile
E2E passes at both Pixel 7 and 320x568 (4 tests); production build passes;
credential-store, backup-pipeline (23 assertions) and the new
session-receipt suite (21 assertions) pass; PowerShell parsing,
hook JSON, workflow YAML, migration policy and invariant drift all clean; the
release gate still fails closed on a dirty checkout.

Still deliberately external and unchanged: nothing is committed or pushed, no
branch protection, Vercel, Supabase or GitHub setting was touched, no credential
was bootstrapped, and no backup, gate, approval or deployment was run.

## Three readability features, one migration — 2026-09-16

Three member-facing changes shipped together in
`20260926000000_trade_log_rating_story_listing_duration.sql`: seller-chosen
listing durations (ADR-072), a trade's full composition in the club log
(ADR-073), and a "why this rating" story on the card page (ADR-074). They are
batched into one migration at the owner's explicit instruction so the hosted
schema is pushed once rather than three times; ADR-075 records that decision,
what it satisfies honestly, and what it costs.

All three turned out to be projection work. **No table was created or altered,
no row was backfilled, and no economy or rating formula moved** — every input
already existed and was simply never exposed. Additive tier per `OPERATIONS.md`.

**Seller-chosen listing duration (ADR-072).** `kut.create_listing` takes a
duration and the seller picks 24 or 72 hours; 24 stays the default.
`market_listings.expires_at` has carried a 24-hour column default since the
original marketplace migration and expiry has always been enforced lazily by
`expires_at > now()` predicates, so only the value written at insert time moved.
The old two-argument signature is *dropped* before the three-argument one is
created — a defaulted parameter would otherwise have left a second, permanently
24-hour entry point alive. The permitted durations are an allow-list rather than
a range, dual-declared as the SQL guard and `ECONOMY.listingDurationChoiceHours`
and re-validated in the server action, so the form control is never the only
guard. `create_listing` also stopped returning a hardcoded
`now() + interval '24 hours'` that was never read back from the insert. The card
page now shows the real expiry date instead of asserting "24 hours" in copy.

**A trade's full composition in the log (ADR-073).** Two defects, both in
`kut.activity_feed`. The trade branch reported `coins_to_seller` while every
other branch reports gross, so trades alone were understated by the 5% burn —
it now reports `offered_coins` and `amount` means the same thing everywhere.
And `trade_offer_cards` was never joined, so cards moving the other way were
invisible; a lateral `array_agg` now supplies them in a new ninth column. Past
trades consequently read higher than before: no data changed, the feed simply
reports the price rather than the proceeds. No coin valuation is attached to the
offered cards, because nothing is snapshotted at accept time and a value
computed later would drift with Live Ratings.

**A card explains its own rating (ADR-074).** Two new views split a player's OVR
into its attendance base and Form bonus, and list the sessions behind that Form
with their decay weight and recognised category titles. The requested "+2 OVR
for goals, +2 OVR for kudos" shape is *not* what shipped:
`RATING_BALANCE_REVIEW.md` rules that Form is rounded once on the total, so
per-line OVR would not sum to the real number. The story states the bonus once
in OVR and every session line in Form. The attendance base is derived as
`live_ovr - floor(form_score + 0.5)` rather than recomputed from the attendance
curve, so the two halves reconstruct the card face by construction. Age is
counted in sessions, never weeks.

The real risk in that last one is that the decay ladder is now expressed a
second time outside `_rebuild_season_core` and could drift from it. That is
pinned by a test which runs the real engine over a fixture and asserts the
summed weighted contributions equal the resulting `form_score`.

Verification: `verify:fast` passes (21 files / 159 tests, up from 20 / 142);
pgTAP passes (17 files / 516 assertions, up from 15 / 482) — new
`listing_duration.test.sql` (13) and `rating_breakdown.test.sql` (14), and
`activity_feed.test.sql` grown 12 → 19 after having no trade coverage at all;
production build passes; the migration-policy gate passes with exactly one added
migration. Two stale assertions were caught by running the whole suite rather
than only the new files: `phase_1a_roster.test.sql` pinned the old
`create_listing` signature, and two `activity.test.ts` cases pinned the old
trade sentence.

Deliberately unchanged and recorded in the ADRs: nothing sweeps expired listings
(still the `LAUNCH_PLAN.md` decision, and there is still no cron infrastructure
in the repo); `propose_trade` still sets a flat 12-hour offer expiry with no
clamp to the listing's own expiry, which is more visible at 72 hours;
`cancel_listing` still raises "active listing not found" for a lapsed listing;
and the seller's `Trade completed` notification still says "plus cards" without
naming them, because fixing it means re-declaring all ~150 lines of
`respond_to_trade` for a copy change.

Merged as PR #86 (`aa1f254`), catalogued in `VibeTrunk/supabase` PR #34, and
pushed to hosted 2026-09-16 on a fresh cold-verified backup
(`20260916-005721`) rather than the scheduled one the additive tier allows.
Smoke-tested on hosted: a card lists for 72 hours and shows its real expiry
date, the club activity feed returns rows, and a Live card renders its rating
buildup.

One thing to carry forward. Vercel deploys production on merge to `main`, so
PR #86 shipped application code that expected this schema roughly two hours
before the schema existed. Creating a market listing failed on hosted in that
window — `create_listing` was called with `p_duration_hours` against the old
two-argument signature — and the club activity feed rendered empty, because
selecting the not-yet-existing `offered_card_names` errored and that widget is
deliberately non-critical. Nothing crashed and no data was at risk, and the two
rating-story reads degraded silently exactly as intended. But the next
migration-bearing change whose code cannot degrade that gracefully needs a
feature flag, a tolerant read, or a catalogue push queued to follow the merge
immediately.

## The rating story adds up again (KB-018 / ADR-076) — 2026-09-16

Two screenshots, one day after the rating story shipped: a card listing 1.00 and
1.25 Form under a stated total of **2.88**, and a card reading "FROM FORM **+2**"
directly above the sentence "No recent session is adding Form right now, so this
rating is all attendance".

Both are the same omission. `kut._rebuild_season_core` builds Form as
`least(8, greatest(0, v_contributions + v_legacy * <decay>))`, and
`kut.player_form_contributions` reads `kut.session_report_results` — the
`v_contributions` term only. `v_legacy` is the Form carried over the season's
rating-v2 cutover, from goals scored before self-reporting existed, fading over
the first four v2 sessions. It counts toward `form_score` and toward the OVR
bonus, but has no session row, so it vanished from the itemisation while staying
in the total. The first card's gap is 0.625 (2.5 legacy Form at the 0.25 weight
of a third v2 session); the second card's entire 1.5 Form is carry-over (6.0 at
the same weight), which is why its list was empty while its bonus was +2.

The split itself was never wrong — `attendance_base + form_bonus = live_ovr`
holds by construction, which is exactly what ADR-074 built it to do. What was
wrong is that the panel then itemised only part of the Form it had just totalled.

`carriedForm()` recovers the remainder as `form_score` minus the listed rows and
`rating-breakdown.tsx` renders it as a row of its own, so the rows sum to the
total. The "all attendance" sentence now requires the rows to be genuinely
empty; a player whose Form is entirely carried keeps a "no recent session yet"
note instead of being told their Form is zero. A negative remainder — the
`least(8, …)` ceiling clipping a big week — says so rather than leaving rows
that over-sum. The old `Carried Form: 1.5` footnote is gone, superseded by the
row that explains it.

No migration, so this can ship on its own. The amount is still **inferred**
rather than read: the subtraction is exact, but it is the client deciding that
the remainder is carry-over. Adding a term to the engine without adding a column
to the view would mislabel it. `legacy_form` / `legacy_weight` on
`kut.player_rating_breakdown`, plus a test fixture whose season spans a cutover,
are in `docs/ROADMAP.md`.

Worth noting why the pinning test stayed green. It forces the cutover so that
"no legacy Form carries in" — and says in a comment that the sum assertion only
holds that way. The fixture was built around the gap instead of over it, and
ADR-074 never mentioned the legacy term at all. Also worth noting that the
symptom self-clears at a season's fourth v2 session, when the legacy weight
reaches 0, and returns on the next season spanning a rules cutover.

Verified: `npm run verify:fast` (policy, format, lint, typecheck, 168 unit tests
including ten new ones that use both reported cards as fixtures) and
`npm run build`.


## The goal badge comes back inside the frame (KB-019 / ADR-077) — 2026-09-22

Hovering the `×10` week on a player's rating graph showed nothing, while every
other week tooltipped. The register held two untested guesses; both turned out
to be wrong.

The component was rendered to static markup and probed in Chromium with
`elementFromPoint`, walking up to the nearest `<title>` — six geometries (1, 6,
18 and 30 weeks; the scoring week mid-series, penultimate and last), four probe
points each. Mid-series everything already worked, badge included, at every
density. The failure is specific: when the scoring week is the **last** point,
`x = 548` and the badge is drawn at `557` with a 25px glyph box inside a 560-wide
viewBox, so most of it sits outside the frame — and what is outside the viewBox
cannot be hovered. The badge is the obvious thing to aim at, so the week reads as
having lost its tooltip even though the football beside it still had one.

The badge now flips to the left of the football when it would cross the edge.
All four probes resolve the correct title in all six geometries afterwards.

A first attempt went the other way — one transparent hit circle per point
carrying the `<title>`, with `pointer-events: none` on the marks — and measuring
it showed it *removed* working hover from the badge, because the circle's radius
never reaches the badge. It was reverted before it went anywhere. Measuring the
old structure first would have skipped that.

Not established: whether Freek's 31 Aug was his last published week. The local
stack was down, so the reported instance was never reproduced against real data
— only a defect that produces exactly that symptom, and no other geometry that
does.

Verified: `npm run verify:fast` (policy, format, lint, typecheck, 168 unit
tests) plus the Chromium probe above.

## A submitted report stops going back to draft (KB-020 / ADR-078) — 2026-09-22

An admin screenshot showed Melle as "Draft · Reward paid". That state is
reachable: the report form kept offering "Save draft" after a report was
submitted, and the RPC's upsert overwrote `status` unconditionally while the
reward row — written once, never deleted — stayed put.

The damage is not on the roster. `kut._finalize_one_session` scores only
`status='submitted'` rows and uses that same filter for the `v_turnout>=3` gate,
so a report left this way at finalization drops that member's goals and kudos
*and* can wipe kudos recognition for everyone in the session — while their
`session_kudos` rows still count toward recipients' two-nominator threshold.

The fix is one derived local, resolved before any validation runs: a `draft`
call against a submitted report becomes an edit that stays submitted. A guarded
upsert was rejected — it would hold the status while letting the row be
rewritten under the weaker draft rules, so a submitted report could end up
submitted and hollow. The `on conflict` clause needed no change at all.

The form now receives `report_status`, which the page had been selecting and
discarding, and drops "Save draft" once the report is submitted. Both buttons
gained an explicit `type="submit"`: "Save draft" had none, so it was the form's
default submit button and **Enter in the goals field regressed a submitted
report without a click**. That was not in the report; it turned up while
reading.

Rows that already regressed are repaired by the migration. Sessions already
finalized are **not** replayed — available (`admin_correct_session_goals` re-runs
the finalizer routinely) but declined by the owner, because it would move live
OVR retroactively. So for an already-finalized session the lost goals and kudos
stay lost, and ADR-078 says so.

The 16-assertion pgTAP file was run against the old function as a negative
control and fails five of them there, the standing "no draft holding a reward"
invariant among them.

Verified: `npm run verify:fast`, and `npm run test:db` — 18 files, 532
assertions, against a local stack migrated through `20260927000000`.

## Member-only projections prove an active profile (KB-017 / ADR-079) — 2026-09-22

The Supabase Security Advisor's finding, closed. Ten `security_invoker = false`
views granted `SELECT` to the shared project's `authenticated` role and
deliberately bypassed their sources' RLS, but never proved the caller was a KUT
member — so a JWT from another VibeTrunk tool, or a disabled account with a live
session, could read member-only data through the Data API.

One predicate, `kut.is_active_member()`, now gates all ten. `security definer`
because `kut.profiles` RLS lets a member read only their own row, so invoker
rights could never prove a foreign caller has *no* profile. The service role
passes through two disjuncts, one per transport; `current_user` and
`pg_has_role(session_user, …)` are both recorded in ADR-079 as traps that would
have made the predicate unconditionally true.

Each view body is copied byte-identically and wrapped — the risk here is
transcription across ten bodies and six files, not semantics, and a wrapper also
makes it impossible for `create or replace view` to change the column shape.
`EXPLAIN` shows `One-Time Filter: kut.is_active_member()`, so a denied caller
never executes the body.

Nothing was flipped to `security_invoker = true`. That is the generic advice and
it is how KB-013 blacked out the Chronicle.

The new 71-assertion file was run against the ungated views as a negative
control: 15 fail, and *which* 15 confirms the register's accounting exactly — a
profileless JWT reads all six club-wide projections, a disabled member reads
those six plus three of their own personal views, while `my_club_value` holds
because it already had its own `is_disabled` check and the profileless caller
never reached the caller-scoped four at all.

Three existing assertions needed a member's role and claim, having read the
leaderboard as the test superuser. One of them — "an admin account is absent
from the club value leaderboard" — would otherwise have kept passing for the
wrong reason.

No application code changed: `getNavContext()` already redirects every caller
this denies.

Verified: `npm run verify:fast`, and `npm run test:db` — 19 files, 603
assertions, against a local stack migrated through `20260928000000`.

## The rating graph reads reported goals too (KB-021 / ADR-080) — 2026-09-22

The "Rating over N published weeks" graph on `/players/[slug]` drew a goal
football only on weeks before the rating-v2 cutover. Freek's 31 Aug point
carried `×10` while 7, 14 and 21 Sept were plain dots — with the "What's in that
Form" panel immediately below listing 3, 1 and 2 goals for those very sessions.

The page built `goalsByWeek` from `kut.attendance.goals` alone. Since ADR-059
the engine switches goal source at the cutover week:

```sql
if v_week.week_start < v_cutover then
  select coalesce(sum(a.goals),0) into v_goals from kut.attendance a ...
else
  select coalesce(sum(r.effective_goals),0) into v_goals from kut.session_report_results r ...
```

So every reporting-era week has been drawn goalless since self-reporting shipped,
and every future week would have been. Not a rendering bug that looked like a
data bug: the graph was reading a table the game stopped writing to.

`buildGoalsByWeek` now chooses per session on
`kut.match_sessions.rating_rules_version`, mirroring `kut.chronicle_player_season`
rather than re-deriving the cutover date on the client — the same choice the
Chronicle already makes, and it means a v2 session that also carries a non-zero
`attendance.goals` is never counted twice. The v2 side reads
`kut.player_form_contributions`, already fetched on this page for the ADR-074
story section, so no query was added and the finalized-survey gate (ADR-066)
still applies.

**This reopens the half of KB-019 that ADR-077 left open.** That ADR fixed a
genuinely clipped `×N` badge on the last point, measured it properly, and said
plainly that if the symptom survived on a week that is not last, the register
should be reopened. It did, for an unrelated reason. Both fixes are real; the
first explained why one badge could not be hovered, never why the September
weeks had no badge at all.

The reported "there is also no mouse over" is addressed in the same change: each
point group gains a transparent hover disc of radius `min(14, spacing / 2)`,
since a plain point is a 3.5px circle in a 560-unit viewBox with nothing
hoverable between points. Unlike the structure ADR-077 measured and rejected,
the `<title>` stays on the point group and the visual marks keep their pointer
events, so the disc only adds reachable area — hovering the football or its
badge resolves the same title as before.

Queued in `docs/ROADMAP.md`: a `player_week_goals` view, so the client stops
knowing that two goal sources exist. Deferred only because a migration-bearing
change ships on its own.

Verified: `npm run verify:fast`, with five new assertions in
`tests/unit/rating-history.test.ts` pinning both sources, the no-double-count
rule and multiple sessions in one week.

## `kut.season_rating_rules` gets RLS (ADR-081) — 2026-09-23

The last open item from the 2026-09-16 Supabase Security Advisor review, and
defense in depth rather than a live hole. The table — one row per season, its
rating-v2 cutover week — was the only one in `kut` with RLS off. Grants were
already least-privilege (`SELECT` for `authenticated` and `service_role`, nothing
for `anon`, no writes for anyone), but a JWT from another VibeTrunk tool or a
disabled account with a live session could still read the cutover dates.

Migration `20260929000000_season_rating_rules_rls.sql` enables RLS and adds one
`select`-for-`authenticated` policy on `kut.is_active_member()`, the ADR-079
predicate. It filters rather than raises. The admin who reads the cutover on
`/admin/attendance` passes it; the service role bypasses RLS. Grants are
unchanged, there is no write policy and no DML. Additive tier.

No `FORCE`. The brief assumed `FORCE` would break the three `security definer`
readers and writers — the season rebuild and the publish and season-creation
triggers. Measured locally, it would not: the owning `postgres` role has
`BYPASSRLS`, which overrides `FORCE`. It stays off regardless, because it buys
nothing and would move those paths from the owner bypass onto a platform role
attribute. The test pins `relforcerowsecurity = false` and that each function
is owned by the table's owner.

A read-only survey found no other `kut` table without RLS, so the build spec's
"RLS on every table" now holds for the whole schema. A new schema-wide assertion
keeps it that way.

Negative control: against the unmigrated schema, 7 of the new file's 27
assertions fail, and they are exactly the ones this migration is meant to flip.

Verified: `npm run verify:fast`, and every pgTAP file — 20 files, 630
assertions — against a local stack migrated through `20260929000000`.
Migration policy passes for the working tree: one migration, isolated, tested.
Hosted: pushed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #40) on its
own additive `db push`. Afterwards `migration list --linked` shows 69 entries,
all present locally and remotely, with no drift. Smoke-tested on hosted: RLS is
on and not forced, the one policy and the grants are as written, no `kut` table
is left without RLS, and `/admin/attendance` still shows the member-reports
notice for a post-cutover date.

## Injury mode update — 2026-09-23

ADR-082. A long-term injured Player's card no longer has to decay towards 30.
An admin marks the Player injured from `/admin/roster` (with an injury date and
an admin-only note). Each football week the Player sits out, the member checks
in from Home: +100 KUT Coins, and Activity carries over instead of decaying
×0.90. Form still fades. A 🩹 Injured chip shows on the Player's Live cards in
the directory, player page, collection and album. Injury mode ends by itself
when the Player plays a published session again, or when an admin ends it.
Protection is never backdated.
"How KUT works" has a new section 4 explaining injury mode to members; later
sections moved down one number. The roster table on `/admin/roster` is now
wider than the add-player form, so the injury column fits.

Migration `20260930000000_injury_protection.sql`: `kut.injury_periods`
(admin-read only), `kut.injury_check_ins` (the only fact the rebuild reads, and
the idempotency key for the stipend), `admin_start_injury` / `admin_end_injury`,
`my_injury_status` / `injury_check_in`, the `kut.injured_players` projection
gated on `kut.is_active_member()`, and an `injury_check_in` notice when a recent
week's first session is published. `kut._rebuild_season_core` is re-emitted
verbatim apart from the protected-week guard. Rebuilding the real local data
before and after gave zero differences in 29 players and 174 snapshots.
Spec: §9, §11.3, Part 145 `INJURY_WEEKLY_STIPEND`, Part L #24. Data-changing
tier.

Not in this slice: the Comeback Form boost (own PR, ADR-083), the chip on market
listings (no `player_id` on that view), and Players without an account.

Verified: `npm run verify:fast`, and every pgTAP file — 21 files, 678
assertions, 48 of them in the new `injury_protection.test.sql` — against a local
stack migrated through `20260930000000`.
Hosted: pushed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #42) on its
own `db push`, after a fresh cold-verified backup (`20260923-105756`).
Afterwards `migration list --linked` shows 70 entries, all present locally and
remotely, with no drift. Smoke-tested on hosted: the new tables (with RLS),
functions, view, trigger, both widened constraints and the engine guard are in
place, `anon` cannot execute the check-in, and `/admin/roster` shows the Injury
column.

## Comeback Form update — 2026-09-23

ADR-083, the second slice of injury mode. A Player returning from injury mode
with at least 3 protected weeks gets a comeback boost on their first session
back: 0.25 Form per protected week, capped at 2. It ages like any session input
over the next four sessions and counts under the Form cap of 8. The rating story
on the card and player pages lists it as its own row ("0.75 Form — comeback
after 3 weeks out injured"), and How KUT works section 4 explains it.

Migration `20261001000000_injury_comeback_form.sql`:
- `kut.comeback_form_inputs`: derived rows the rebuild deletes and re-derives
  from check-ins and attendance, like the snapshots. Read under
  `kut.is_active_member()`.
- `kut._rebuild_season_core`: re-emitted from `20260930000000` with the
  derivation and a union into the session inputs.
- `kut.player_form_contributions`: comeback rows unioned in, with `source` and
  `protected_weeks` appended.

Rebuilding the local data before and after gave zero differences, since no
player there has an injury. The pages now read the contributions view with
`select("*")`, so they keep working in the window before the hosted push.
Data-changing tier.

Verified: `npm run verify:fast` (178 unit tests), and every pgTAP file — 22
files, 703 assertions — against a local stack migrated through `20261001000000`.
The new `injury_comeback.test.sql` has 25 assertions.
Hosted: pushed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #44) on its
own `db push`, after a fresh cold-verified backup (`20260923-112450`).
Afterwards `migration list --linked` shows 71 entries, all present locally and
remotely, with no drift. Smoke-tested on hosted: the table (RLS on, one policy,
no `anon` select, empty), both engine guards and both appended view columns are
in place, and a Live card's rating story still sums to its Form total. Negative control: against the PR-1 engine, 15 of them fail, covering
every rule, engine and rating-story assertion.

## Plaster cast update — 2026-09-23

ADR-084, visual only. An injured Player's Live cards no longer carry the small
🩹 Injured chip. The whole card goes into a signed plaster cast instead, at every
tier including Elite:
- plaster stock replaces the tier material, and the nameplate and pennant
  become an elastic bandage;
- "set in plaster" is written under OVR, and a plaster tapes the art's corner
  down;
- the bottom of the art fades into a signature band carrying two signatures
  and a doodle;
- a bandage clip holds the nameplate, and PAC is crossed out with "hop" beside
  it.

The pennant icon and the tier word still name the tier. The photo itself is
never tinted or re-cropped. The shirt back lifts so its number clears the band,
and gets two crossed plasters. On two-up phone cards (under 224 px) only one
signature, the plasters, the clip and the strike remain. The
signatures come from a fixed pool of twelve lines, chosen by a hash of the Player
id, so every copy shows the same cast and the admin injury note is never used.
Same call sites as before: players list and detail, collection, card detail and
album; market cards are unchanged. Two self-hosted fonts, Caveat and Permanent
Marker, are loaded without preload. How KUT works section 4 describes the cast.

Design and handoff: `docs/design/injury-cast/README.md`. New
`src/lib/injury-cast.ts` and `tests/unit/injury-cast.test.ts`. No migration, RPC,
economy or rating change.

Verified: `npm run verify:fast` (184 unit tests, 6 of them new). Checked by eye
on the local app at 390 px and 1280 px on `/players`, `/players/[slug]` and
`/club/collection`, with a shirt back and a custom photo, and across all six
tiers, including Elite, with the shirt, two photos and the bust fallback at
detail and grid size, against the design canvas. A non-injured card renders the
same markup as before, apart from one attribute-less `<g>` in the shirt-back SVG,
which draws nothing. Local injury periods had to be inserted directly: every
local account holder has an appearance at a fixture session dated after today,
so the roster form refuses the date.

## Plaster cast rule update — 2026-09-23

ADR-085, PR A of ROADMAP "Plaster cast on every card". UI only. Every card
screen now applies one rule for the plaster cast: a Live card of a Player who is
injured right now. The rule is in one helper, `toLiveCardPlayer`
(`src/lib/live-card-player.ts`). Fixes KB-022 (a Special copy wore the cast in
the collection list and the album) and KB-023 (card detail and the album hashed
the card id, so their signatures differed from `/players`).

- `LiveCardPlayer.injured` is required and `id` always means the Player id. A
  row without one is `{ id: null, injured: false }`, which can't be cast.
- The shirt-back arc gets its own key from `useId()` instead of the id.
- Home risers and the starter reveal on `/welcome` now show the cast too. The
  starter query adds `player_id` and `is_live`.
- The market and pack results set `injured: false` explicitly until PR B adds
  `player_id` and `is_live` to their views. The pack reveal keeps each copy's
  id in its own `cardId` field for its links.
- Owner decisions recorded as settled in ADR-085: the market shows the cast, and
  only Live cards get it.

Verified: `npm run verify:fast` (189 unit tests, 5 of them new in
`tests/unit/live-card-player.test.ts`). Checked on the local app with Playwright
at 390 px and 1280 px, reading each card's cast attributes as well as looking at
it. Djanco's Live card showed the same cast on `/players`, `/players/djanco`, the
collection list, the album and card detail: green "Snel weer terug!", then "Walk
it off (later)" and a heart. Oussama's differs from Djanco's, as it should, and
Freek, who isn't injured, is unchanged. A temporary Special copy of Djanco,
inserted into the local DB for the check and deleted afterwards, showed no cast
in the list, its album slot or on its detail page. Home risers and the starter
reveal were not checked by eye. No local injured Player is a riser, and the
reveal needs a new account, so the unit tests cover them.

## Plaster cast on the market and in packs — 2026-09-23

ADR-086, PR B of ROADMAP "Plaster cast on every card", which is now shipped. An
injured Player's Live card shows the plaster cast on the market list, its listing
page, pack results and the pack reveal too, so every card screen follows the
ADR-085 rule. A buyer can see the Player is out and the card's rating is frozen.
Special editions stay uncast everywhere. Spec §11.3 now states the rule.

Migration `20261002000000_cast_on_market_and_packs.sql`, additive with zero DML:
`kut.active_market_listings` and `kut.my_pack_opening_results` each gain
`player_id` and `is_live` as their last two columns. Both bodies are copied from
their latest versions (`20260928000000` and `20260902000000`), and a
line-by-line comparison confirmed the only difference is the appended columns.
The market view keeps its `kut.is_active_member()` gate. The pack view never had
one: it is an invoker view scoped to the member's own openings, and it stays
that way. New `toListedCardPlayer` passes these rows to the same rule, and
reads a row without the new fields as "no cast". The three pages now read the
views with `select("*")`.

Verified:
- `npm run verify:fast` (193 unit tests, 4 new for `toListedCardPlayer`).
- Every pgTAP file against the local stack migrated through `20261002000000`:
  23 files, 729 assertions, 26 of them in the new
  `cast_on_market_and_packs.test.sql`. Negative control: run after the rollback
  DDL, its six schema assertions fail and its first value query errors.
- Playwright at 390 px and 1280 px, with temporary local fixtures deleted
  afterwards: a listing of Djanco's Live card, and a Special copy of him that was
  both listed and in a pack opening.
  - Djanco's Live listings on `/market`, the listing page and his slot in a real
    local pack result all showed the same cast as `/players`.
  - The Special showed none on the market, its listing page or its pack result,
    and the pack's other cards were unchanged.
- The deploy window: with both views rolled back to their previous bodies, every
  market and pack page still rendered 200 with every card and no cast.

Hosted: pushed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #46) on its
own additive `db push`, riding the scheduled backup `20260923-112450`
(cold-verified). Afterwards `migration list --linked` shows 72 entries, all
present locally and remotely, with no drift. Smoke-tested on hosted: both views
end in `player_id, is_live`, the market view is still gated and the pack view
still invoker, `anon` can select neither, and `kut.my_wanted_cards` still
resolves. `/market` loads normally. No Player is in injury mode on hosted today,
so the cast itself has only been seen locally.

## Midweek Madness engine and tuning — 2026-09-25

PR 1 of the Midweek Madness build (BUILD_SPEC §44, ADR-089–092). No database,
UI or migration: nothing members see changes.

- `src/game/midweek/`: the pure engine. It covers randomness (`sha256(seed ‖ tag)`),
  integer ppm arithmetic, card power, squad shape and keeper choice, the
  chance-by-chance match with penalties, the seeded bracket with byes, pay per
  round, the Wednesday 20:00 Amsterdam schedule, and whole-tournament
  orchestration with auto squads and trialists.
- `npm run sim:midweek` (`tests/sim/`, `vitest.sim.config.mts`): 5,000 simulated
  20-week seasons of a KUT-shaped club. It measures the nine §44.12 targets and
  writes `docs/archive/MIDWEEK_TUNING.md`. Seven pass outright. Two pull
  against each other, and the owner signed them off as they are (ADR-092):
  strongest-vs-weakest 70.6% (goal about 65%), thought-through-vs-random 58.7%
  (goal at least 60%).
- `tests/fixtures/midweek-golden.json`, generated by
  `node scripts/midweek/golden.mjs`: the vectors the SQL engine must reproduce
  (ADR-090).

Verified: `npm run verify:fast`, including the new `midweek-*` unit suites
(rng uniformity, factor bounds, keeper choice, the match model, bracket,
payouts, DST lock times, the golden vectors and a 200-season balance smoke
test).

## Midweek Madness match reports — 2026-09-25

PR 2 of the Midweek Madness build (BUILD_SPEC §44.10, ADR-093). TypeScript only:
no database, UI or migration.

- `src/lib/midweek/report/`: `renderMatchReport` turns a stored match into a
  headline, up to three fact lines, a timeline, the shoot-out and a "why"
  panel. Phrase choice is keyed on the published seed hash.
- The phrasebook: 512 lines in layers (build-up, finishes by chance type and
  quality, saves, woodwork, blocks, shots forced wide, injury asides,
  penalties, headlines, fact lines), awaiting the owner's read-through.
- `design/midweek/sample-tournament.{md,json}` (`node scripts/midweek/sample.mjs`):
  an invented 22-entrant tournament with every report rendered, the input for
  the design pass before PRs 7–8.

Verified: `npm run verify:fast`, including the phrasebook rules and a thousand
simulated reports (no repeats within a match, injury lines only for injured
cards, every fact kind reachable).

## Midweek Madness squad entry — 2026-09-25

PR 3 of the Midweek Madness build: migration `20261003000000_midweek_entry.sql`
(BUILD_SPEC §44.14; ADR-089, ADR-091). Additive, no UI.

- Tables for the launch switch (off by default), tournaments, the seed (service
  role only), saved squads and opt-outs.
- `kut.save_midweek_squad(uuid[])` and `kut.set_midweek_opt_out(boolean)`.
- The gated projections `kut.midweek_current`, `kut.midweek_tournaments_public`
  and `kut.my_midweek_squad`. Skips and voids carry a reason code and a void its
  admin note, and the tournament list lets the page report last week's outcome
  after next week's has opened. Both came from the design handoff
  (`design/midweek/HANDOFF.md`).

Nothing creates a tournament yet, so nothing is enterable until the engine
migration's worker ships.

Verified locally: `midweek_entry.test.sql` (89 assertions: the access matrix,
every refusal with its error code, the reason-code rules, private squads before
the lock, the opt-out and the lock), the whole pgTAP suite,
`npm run test:integration` and `npm run verify:fast`.

Merged as #120 and pushed to hosted the same day (catalogue PR #48 in
`VibeTrunk/supabase`); the record is in `docs/DEPLOYMENTS.md`.

## Midweek Madness archetype cooldown — 2026-09-25

PR 4 of the Midweek Madness build: migration
`20261004000000_archetype_cooldown.sql` (BUILD_SPEC §44.2, §44.14; ADR-089,
ADR-094). Additive.

- `kut.players.archetype_changed_at`, stamped by `set_own_player_archetype`
  when a member actually changes their archetype. Nothing is backfilled, so
  everyone's first change is allowed.
- `set_own_player_archetype` refuses another change within 14 days (336
  hours) with `22023`, carrying the next allowed moment. Re-saving the current
  archetype is not a change. The admin path is not limited.
- `/settings/card` shows when the archetype can next change, in club time, and
  disables the form until then. It reads the stamp separately, so the page
  works before the hosted push.

Verified locally: `archetype_cooldown.test.sql` (28 assertions: the first
change, the refusal and its DETAIL, the same-archetype re-save, both edges of
the window, the admin path, the other refusals unchanged), the whole pgTAP
suite, `npm run test:integration` and `npm run verify:fast`.

Merged as #122 and pushed to hosted the same day (catalogue PR #50 in
`VibeTrunk/supabase`); the record is in `docs/DEPLOYMENTS.md`.

## Midweek Madness engine — 2026-09-25

PR 5 of the Midweek Madness build: migration
`20261005000000_midweek_engine.sql` (BUILD_SPEC §44.3–§44.11, §44.14; Part L
#25; ADR-090, ADR-091, ADR-095). Additive.

- **The engine in SQL** (`kut._mm_*`), a line-for-line port of
  `src/game/midweek/`. `node scripts/midweek/golden.mjs` now also writes
  `midweek_engine_parity.test.sql` from the golden fixture, and a unit test
  fails when it is stale. All 160 golden values match.
- **The stored result:** entries and their lock-time cards, pick shares,
  matches (byes included, goals and penalties per side, each card's day roll)
  and their events, plus a worker log.
- **Part L #25 in the tables:** a result is written once and never changes, a
  tournament only moves forward, and squads are immutable after the lock.
- **The worker,** `kut.run_midweek_due`: lock (club-break gate, field,
  simulation), complete (publish the seed) and open (the next week, while the
  switch is on). Coins come with the payout migration.
- **The reveal projections:** matches, events, entries (from round 1, no
  counts until complete) and pick shares (once complete), and the champion
  appended to the tournament list.
- **Admin:** the switch, void before payout, the rehearsal (writes nothing) and
  an admins-only overview with the saved-squad and opt-out counts.

Nothing runs on hosted until the switch is turned on at launch (PR 9).

Verified locally: `midweek_engine_parity.test.sql` (160 assertions),
`midweek_engine.test.sql` (147: the access matrix, the worker's lifecycle and
gates, the lock snapshot, reveal timing, owner counts, a second call changing
nothing, the #25 guards, void, the rehearsal leaving every table unchanged, the
switch and the open step), the whole pgTAP suite (27 files, 1,153 assertions),
`npm run test:integration` with the new `midweek-race.test.ts` (three
concurrent worker calls: each week locked once and completed once, no error)
and `npm run verify:fast`.

Merged as #125 and pushed to hosted on 2026-09-26 (catalogue PR #52 in
`VibeTrunk/supabase`); the record is in `docs/DEPLOYMENTS.md`.

## Midweek Madness payouts — 2026-09-26

PR 6 of the Midweek Madness build: migration
`20261006000000_midweek_payouts.sql` (BUILD_SPEC §44.7, §44.14; Part L #26;
ADR-096). Data-changing: it adds a coin faucet.

- **Coins per win:** the worker's complete step now pays every win in the
  stored bracket, byes as round-1 wins, at `kut._mm_round_payouts(rounds)`,
  before it publishes the seed and marks the week complete, in one
  transaction. A champion collects exactly 250 (`ECONOMY.midweekChampionTotal`).
- **Part L #26 in the table:** `kut.midweek_rewards` pays a
  (tournament, round, member) once; a guard accepts only a stored win at its
  round's amount, while the week is being completed, within 250 per member per
  tournament, and a paid reward never changes. Ledger reason `midweek_win`,
  with an idempotency key per win.
- **One inbox message per member paid** (`midweek_result`): how far they got,
  their coins and the champion. The inbox labels it "Midweek Madness".
- **`kut.my_midweek_rewards`:** a member's own wins paid, for the "Your coins"
  line of the results pages (HANDOFF).
- **The faucet ADR (ADR-096):** 953 coins a week at a roster of 22, about 43 per
  member, and never more than one attendance reward to anyone.

Void is unchanged: a week is complete exactly when it has been paid, and a
complete week cannot be voided.

Verified locally: `midweek_payouts.test.sql` (63 assertions: the access
matrix, the widened constraints still refusing unknown values, every win paid
once at its round's amount, the champion's 250 in brackets of 16, 8 and 4, byes
paid, the ledger matching every wallet move (#4/#5), one message per member
paid with its wording, a second call paying nothing, the guard, void before and
after payout, a member disabled before the payout, and the member view), the
whole pgTAP suite (28 files, 1,216 assertions), `npm run test:integration`
with `midweek-race.test.ts` extended (three concurrent calls pay the completed
week once, a full bracket, one ledger row per win) and `npm run verify:fast`.

Merged as #127 and pushed to hosted on 2026-09-26 after a fresh cold-verified
backup (catalogue PR #54 in `VibeTrunk/supabase`); the record is in
`docs/DEPLOYMENTS.md`.

## Midweek Madness entry UI — 2026-09-26

PR 7 of the Midweek Madness build: the pages members pick on, built to the
approved mockups (`design/midweek/`, HANDOFF.md; ADR-097). No migration: every
view it reads is already on hosted, where the switch is off.

- **`/club/midweek`, the picker:** the lock time with a ticking countdown, the
  fairness seal, the privacy line, "Your five" as slot rows on a phone and a
  team sheet of cards from `lg`, the keeper check, a save bar pinned above the
  tab bar on a phone, and the grid of your cards, one tile per Player (the save
  sends the strongest copy). "Load last week's five" pre-fills and saves
  nothing. Starter, opted-out and no-cards states; a last-week strip for the
  previous week's result, skip or void.
- **Outside an open week:** short holding states (locked tonight, next week
  opening soon, opening soon), which the results UI (PR 8) replaces.
- **Settings:** the Midweek Madness switch, two steps to opt out and one tap
  back, with wording that depends on whether a saved five would be withdrawn.
- **Entry points:** a card under Home's header and a strip under the
  Collection header, before the lock. Home owns the route in the navigation
  (D1).
- **`/how-it-works` section 12:** the rules in members' words, the coin table
  from `roundPayouts`, what other members see, and fair draws.
- **Tolerant:** switched off with nothing running, the route is not found and
  every entry point is absent; a missing view or failed read hides it.

Verified locally: `npm run verify:fast` (unit tests for the countdown,
visibility, keeper check, last-week pre-fill, save status, strongest copy per
Player, refusal copy, last-week and skip wording, and the opt-out wording; the
navigation test) and `npm run test:e2e:authenticated` (Pixel 7 and 320 px:
`release_member` picks five, saves and sees them saved after a reload; the
Settings opt-out and the picker's way back; `/club/midweek` in the core-route
loop with no horizontal overflow). A local visual review at 320 px, Pixel 7
and 1440 px compared the picker states, Settings, Home and Collection with the
mockups.

## Midweek Madness results UI — 2026-09-26

PR 8 of the Midweek Madness build: the evening, the bracket, the match
reports and the admin page, built to the approved mockups (`design/midweek/`,
HANDOFF.md; ADR-098). No migration: every view it reads is on hosted, where
the switch is off.

- **`/club/midweek`, the evening:** Week-Locked (the reveal clock and your
  own five), Week-Revealing ("Round 2 is out", "Your night" with the coins won
  so far, the round just out) and Week-Complete (the champion and their five,
  your coins and finish, the field and the goals, next week one tap away, and
  the seed checked against the seal). The champion leads until Thursday 23:59
  Amsterdam (D4); skip and void notices sit above next week's picker, and the
  last-week strip links its bracket.
- **`/club/midweek/[weekStart]`, the bracket:** rounds as sections on a phone
  and a tree from `lg`, byes, rounds not yet out with who meets or where they
  come from, your path in brass, and "Who picked whom" once complete.
- **`/club/midweek/[weekStart]/match/[matchId]`, the report:** headline,
  scoreboard (side 0 always left), facts, timeline, shoot-out and the "why"
  panel with the odds and every card's factors. Built on the server from the
  stored rows by a database twin of the report adapter.
- **D3 in the renderer:** a new `ownersPublished` flag and a count-free
  contrarian line (four new phrasebook lines, read and approved by the owner), so
  a report reads the same all night and owner counts appear only in the "why"
  panel once the week is complete.
- **Home and Collection:** the Home card's evening ("Round 2 is out", your
  result, the next match, a compact clock) and after-the-final states; the
  Collection strip's "Your five are playing tonight".
- **`/admin/midweek`:** the switch, this week at a glance, the rehearsal and
  void with a reason; the eighth admin tab.
- **The lazy trigger:** `runDueMidweek()` from Home and every Midweek page.

Verified locally: `npm run verify:fast` (new unit tests for the D4 cutoff
across both clock changes, the reveal clock, bracket assembly with byes, your
night, the stored-row report adapter against every golden tournament, the D3
flag and text stability, the trigger's due-work check and the admin helpers)
and `npm run test:e2e:authenticated` (Pixel 7 and 320 px: a seeded completed
week's bracket and a match report with no horizontal overflow, bad URLs not
found, the admin controls and a rehearsal; the bracket joins the core-route
overflow loop, which now measures against the device width). A local visual
review at 320 px, Pixel 7 and 1440 px compared Week-Locked, Week-Revealing,
Week-Complete, the bracket mid-reveal and complete, three reports (shoot-out
with an injured Player, thrashing, shoot-out), Home, Collection, admin, void
and Week-Void with the mockups; it found the shoot-out's screen-reader table
widening a 320 px screen, now fixed.

## Midweek Madness launch — 2026-09-26

PR 9 of the Midweek Madness build: the launch. Operations and docs, plus one
fix the launch found.

- **Hosted rehearsal** with the owner, switch off, no week open: three runs,
  each a field of 22 (matching an independent SQL count), all auto squads, a
  32-slot, 5-round bracket (10 byes and 6 matches in round 1), pay per win
  17 · 33 · 50 · 67 · 83, a different real champion each run, and only the
  two expected info warnings. No club break: the 21 Sep session is published.
- **Backup** `20260926-102414`, fresh and cold-verified, before the faucet
  opened.
- **KB-024: the switch failed on hosted.** `admin_set_midweek_enabled`
  updated its single config row with no `WHERE`, which PostgREST's
  `safeupdate` rejects; every database suite connects as `postgres` and never
  loads it. Fixed in PR #131, migration `20261007000000` (`where id`), with a
  schema-wide pgTAP guard (no `kut` function updates or deletes without a
  `WHERE`) and an integration test that calls the switch as `authenticator`,
  as the API does. Catalogued as supabase #56 and pushed the same day.
- **Switched on** by the owner on `/admin/midweek`. The first week opened on
  the next page visit: week 2026-09-28, locking **Wed 30 Sep 20:00**. Checked
  on the admin page, on Home ("Pick your five") and as an ordinary member.
- **Next:** the first live Wednesday checklist (the plan's manual item 5):
  the owner saves a squad as an ordinary member before 20:00 and follows the
  evening through to the payout and the seed check.

Verified: `npm run verify:fast`, `npm run test:db` and
`npm run test:integration` for #131 locally and in CI; the hosted smoke row
matched the local run.

## Midweek archetype snapshot — 2026-09-26

Closes a way to sabotage other members' squads: changing your own archetype
just before the lock (ADR-099, migration `20261008000000`).

- **Frozen at the open.** Opening a week snapshots every Player's archetype
  (`kut.midweek_archetype_snapshots`, filled by a trigger on tournament
  insert); the lock plays the snapshot, and a change applies from the next
  week. The week open at the push is backfilled.
- **Picker:** reads `kut.midweek_archetypes`; a card changed since the open
  says "X this week, Y from next". Falls back to the live archetype until the
  hosted push.
- **Copy:** `/settings/card` and how-it-works §12 say changes count from the
  next week. BUILD_SPEC §44.2, §44.11 and the migration tables updated.

Verified: pgTAP `midweek_archetype_snapshot` (19) plus the Midweek engine,
parity, entry, payouts, switch and cooldown suites locally;
`npm run verify:fast`.

**On hosted 2026-09-26** (catalogue supabase #58, fresh backup
`20260926-154520`, 78 migrations, no drift), before the first lock; the open
week 2026-09-28 is backfilled. The record is in `DEPLOYMENTS.md`.

## Transfer-market ownership counts — 2026-09-27

Implemented ADR-100 locally on both market surfaces. Every listing now shows
the current viewer's number of copies of the Player and of the exact edition,
including the viewer's own listings. Listed copies and copies held in trade
offers still count because they remain owned; the detail page calculates the
totals before applying the unchanged offer-eligibility filter.

The market grid makes one parallel `my_collection_cards` request for only
`player_id, edition_id`, so the feature adds no per-listing queries. A pure
helper builds both count maps and supplies the concise visible label plus an
expanded screen-reader label. The shared presentation wraps in the existing
two-column phone grid.

Verified locally: the focused ownership unit file (6 assertions) and
`npm run verify:fast`. No migration, database view, RPC, RLS policy or Part L
invariant changed. No hosted deployment was performed.

**Live since 2026-09-27** (KUT PR #135): frontend-only, so Vercel deployed it
on merge with nothing to push to the database. The owner confirmed it on hosted
2026-09-30; the grid presentation is followed up as KB-026.

## Goals + assists — 2026-09-27

Implemented ADR-101 locally. From the football week beginning **2026-09-28** a
member reports one combined **G+A** count (goals and assists added together;
2 + 2 is stored as 4). Goals and assists are not stored apart. Earlier sessions
keep their goals-only meaning and label, and nothing is backfilled.

- **One source.** `src/game/reported-count.ts` holds the cutover and every
  label and formatter. The report page, Home prompt, Chronicle list and issue,
  admin report roster and corrections, admin attendance form, player rating
  graph, rating story and "How KUT works" §3 all ask it, by session date or by
  week Monday.
- **Scoring unchanged.** Same count ladder (0 / 1 / 1.25 / 1.5), kudos ladder,
  3.5 session cap, Form cap 8 and Live OVR ceiling 83. The recent-week SHO
  modifier reads the combined count, so a reported 4 gives the capped +8; this
  is documented, not avoided. Column and RPC names keep `goals`. Midweek
  Madness is untouched.
- **Migration `20261009000000_goals_assists_notice_copy.sql`** (additive tier):
  `kut._uses_combined_count(date)`, plus date-aware wording in
  `kut._open_session_survey`, `kut._finalize_one_session` and
  `kut.admin_correct_session_goals`. Each body is its latest definition
  verbatim apart from a date lookup and a wording branch; privileges were
  compared before and after on the local catalog.
- **Precondition.** No session dated on or after 28 Sep was published on hosted
  (the last documented one is 21 Sep). `next_features_contracts.test.sql` dates
  its fixture at `current_date`, so its ADR-069 body assertion now takes its
  expected wording from that session's date.
- **Docs.** ADR-101; BUILD_SPEC §8, §15.2, §145 and a 2026-09-27 amendment;
  `RATING_BALANCE_REVIEW.md` update; ROADMAP Priority row → implemented.

Verified locally: the focused unit files (57), pgTAP
`goals_assists_cutover` (48) and `next_features_contracts` (52) against the
local stack with the migration applied, `npm run verify:fast` (361 unit
tests), then `npm run verify:full`: 31 pgTAP files / 1,291 assertions,
6 integration files / 14 tests, 26 Playwright tests and a production build,
exit 0.

**Not deployed.** The migration needs its catalogue PR in `VibeTrunk/supabase`
and a hosted push. Vercel deploys on merge first; the pages need nothing new
from the database, but notices written before the push keep the goals wording.
Push before the 28 Sep session is published, or at the latest before its
report window closes.

**On hosted 2026-09-27** (catalogue supabase #60, fresh backup
`20260927-180300`, 79 migrations, no drift), before the first G+A session on
Mon 28 Sep; the hosted smoke row matched the local run. The record is in
`DEPLOYMENTS.md`.

## Market ownership chip (KB-026) — 2026-09-30

Implemented ADR-102 (KUT PR #139), the owner-approved Claude Design mockups.
The ADR-100 ownership count left its bordered block under the card and became
a chip on the card itself, on both `/market` and `/market/[listingId]`:

- `LiveCard` takes an optional `badge`, drawn inside the art at its lower edge
  (`.live-card__badge`); `MarketOwnership` is now that chip.
- `ownershipDisplayData` gained `shortText` for the grid ("You own 2",
  "You own 3 · 1"). Equal totals on the listing page now read "You own 2 of
  this edition". The spoken sentence is unchanged; on the grid it moved to an
  `sr-only` line outside the listing link, whose `aria-label` hid it.

Verified locally at 390×844 and 1280 wide with Playwright against the local
stack, on a grid of nine listings (created through `kut.create_listing` on the
local database only) that mixes owned, unowned, an injured owned Player and the
viewer's own listing: every Buy button in a row sits at the same height at both
widths, nothing scrolls sideways, and the chip clears the OVR, pennant, price
and surname, photo cards included. The focused unit file (7 assertions) and
`npm run verify:fast`.

No migration, view, RPC, RLS policy or Part L invariant changed. Frontend only:
Vercel deploys it on merge with nothing to push to the database.

## Market discard value (KB-027) — 2026-09-30

Implemented ADR-103 (KUT PR #140), the owner-approved Claude Design mockups:
the listing detail page shows the card's discard value under the asking price.

- **Migration `20261010000000_market_listing_discard_value.sql`** (additive
  tier): `kut.active_market_listings` re-created with its `20261002000000` body
  verbatim and `discard_value` appended last, calling
  `kut.card_discard_value(card.id)` only when the card has a rating; plus
  `grant execute on function kut.card_discard_value(uuid) to authenticated,
  service_role`, which the view needs because function privileges are checked
  against the caller: without it every member and service-role read failed. Definer view, security barrier, ADR-079 gate and grants unchanged.
- **Frontend.** `/market/[listingId]` renders "Discard value" only when the
  column is a number, so nothing shows before the hosted push or for an unrated
  card. The grid is unchanged.
- **Docs.** ADR-103, BUILD_SPEC §36, KNOWN_BUGS (KB-027 fixed). No Part L
  invariant changes.

Verified locally: the migration applied to the local stack, where every
listing's `discard_value` read as a member matched `get_listing_bounds`.
`market_listing_card_art.test.sql` grew from 5 to 21 assertions:

- the column exists and comes last;
- the view keeps its reloptions;
- the function grants (authenticated and service_role yes, anon no);
- a Live listing (160) and a Special listing (120) equal
  `kut.card_discard_value`;
- an unrated card stays listed with a null value;
- a profileless JWT and a disabled member read zero rows;
- anon is refused at the grant;
- the service role still reads the view and `kut.my_wanted_cards`.

`cast_on_market_and_packs.test.sql` pinned ADR-086's `player_id` and `is_live`
as the view's last two columns; it now checks that they keep their place,
directly before `discard_value`.

Playwright screenshots of the listing page at 390×844 and 1280 wide, then
`npm run verify:full`: 361 unit tests, 31 pgTAP files / 1,307 assertions,
6 integration files / 14 tests, 26 Playwright tests and a production build,
exit 0.

**Not deployed.** The migration needs its catalogue PR in `VibeTrunk/supabase`
and a hosted push. Vercel deploys on merge first; until the push the listing
page simply has no discard line.

**On hosted 2026-09-30** (catalogue supabase #62, fresh backup
`20260930-163158`, 80 migrations, no drift); the hosted smoke row matched the
local run, with all 15 live listings carrying a value that agrees with
`kut.card_discard_value`. The record is in `DEPLOYMENTS.md`.
## Midweek pick label: "fewer than 3 owners" — 2026-09-30

On the first live week's pick shares the owner saw Freek labelled "a rare pick"
although both entrants who own a Freek card picked it (pick factor 0.96, below
neutral). The label stands in for an owner count below
`MIDWEEK_OWNER_COUNT_MIN` (ADR-091), so it describes a scarce *card*, not a
rare *pick*. It now reads **"fewer than 3 owners"**, from one constant,
`FEW_OWNERS_LABEL` in `src/lib/midweek/report/render.ts`, used by the "why"
panel and the pick-shares table. The privacy rule, the SQL and the pick factors
are unchanged; BUILD_SPEC §44.9 and §44.10 now quote the new wording. The
unpublished contrarian headlines ("was a rare pick this week") are about few
pickers and stay as they are. The design mockups in `design/midweek/` keep the
old label as the record of what was approved.

## Midweek Madness: the first live week — 2026-09-30

The first tournament (`week_start` 2026-09-28) locked Wed 30 Sep 20:00 and
ran without intervention. The payout check from the launch plan returned
exactly what it expected for 17–32 entrants: `complete | 31 | 953 | 953 | 31 |
250 | 1 | true`. That means 31 wins paid for 953 coins, the ledger agrees row for
row, one champion reached 250, and the published seed matches the seal. The
first page visit after the final came at 22:30, so the coins landed the minute
the final was revealed.

What the week looked like (read-only query in the Midweek handover, run on
hosted 2026-09-30 at about 23:10, 40 minutes after the payout):

| | |
|---|---|
| Entrants | 21 (1 member opted out): 32 slots, 11 byes, 20 matches over 5 rounds |
| Picked / auto squads | 17 / 4; only 2 of the 17 were saved in the last two hours |
| Picked squads with a trialist | 0: all 17 picked five cards |
| Keeperless | 1 of 17 picked squads; all 4 auto squads |
| All-rounders among picked cards | 33 of 85 (39%), against about 80% of the roster |
| Picked squad against auto squad | picked won 4 of 4 |
| Goals per match | 2.75 (simulation target ≈ 2.85 across a bracket) |
| Shoot-outs | 3 of 20 matches |
| Upsets (winner under 35% before kick-off) | 0 |
| Result messages read by 23:10 | 5 of 16 |

Nothing needed correcting, so there is no `DEPLOYMENTS.md` entry. What it
suggests for "MM 2.0" in `ROADMAP.md` is recorded there. One week is a small
sample: 0 upsets in 20 matches doesn't yet say the favourites are too strong,
because the query doesn't count how many matches had an underdog under 35% at
all.

## Midweek fixes KB-030 and KB-031 — 2026-10-01

The first two items of the MM 2.0 plan, both frontend only and not waiting for
the design review.

- **KB-030, "Locked in: all five still yours".** Members read it as if their
  cards were at stake. The locked screen now says what the lock checked: "All
  five were still in your collection at the lock, so all five play." (or the
  count saved; a lost card "was no longer in your collection at the lock").
  The locked screen and how-it-works §12 now say once that your cards are
  never at stake and a result only ever pays coins.
- **KB-031, bracket lines from round 1 to round 2 on desktop.** The `lg` tree
  stacked each round's boxes on their own, so a bye (one line) and a match
  (two) gave round 1 uneven heights and its lines missed round 2. The tree is
  now one grid for every round: a header row, then one equal row per round-1
  pairing, each round a subgrid column. A round-`r` pairing spans `2^(r−1)`
  rows, so it is centred on its two feeders by construction. The phone list
  is unchanged.

Verification: `npm run verify:fast` (unit tests for the row placement over 2–6
rounds and for the new line); the authenticated E2E's completed week gains a
fifth entrant, so round 1 mixes byes and matches, and a new test checks at
1280 px that every group's bracket line ends on the middles of its two
pairings and that its middle is the next-round match's.

## MM 2.0 B1: the evening's new clock (ADR-104) — 2026-10-01

The first migration of MM 2.0 (`20261011000000_midweek_evening_timing.sql`).
Squads lock at 19:55, round 1 starts at 20:00 and a round every 15 minutes
(the final of five rounds at 21:00), and the payout waits for the end of the
final.

- **A clock per week.** `MIDWEEK.schedule` now holds version 1 (every week so
  far: 20:00, a round every 30 minutes) and version 2, and each tournament
  stores its `schedule_version`. Pages compute every time from the week's
  version and read a row without the column as version 1, so the code is right
  both before and after the hosted push.
- **Every event has its moment.** The lock step stores each match's start and
  end and each event's time: the match clock runs 0' to 90' over 4:40 (14
  slots of 20 s), and shoot-out kicks follow 5 s apart. The longest possible
  match (50 kicks and a settling draw) ends after 8:55, inside a round.
  `final_reveal_at` is now the end of the final, which is what the payout
  already waits for. The views still reveal matches whole at kick-off; event by
  event is ADR-106.
- **The open week moves to 19:55 at the push**, unless that's already past.
  Target: on hosted by Sat 10 Oct, so the week locking Wed 14 Oct is the first.

Verification: `npm run verify:fast` (40 files, 376 tests); every pgTAP suite
on the local stack, including the new `midweek_evening_timing.test.sql` (42)
and the regenerated parity test (190: the SQL clock matches the TypeScript one
on both versions, and no engine result changed); `midweek-race`,
`midweek-switch` and `finalizer-readiness`. The engine and payout suites now
pin their weeks to version 1, whose timings they were written for. The
authenticated E2E passed 15 of 16 in two of three runs and 16 of 16 in one:
the failure is `/club/collection` at 320 px (323 px wide), the flake first seen
during KB-030/031. It isn't this change: the Collection page's Album · Manage ·
Trading switcher needs about 303 px at min-content, more than the 280 px
content box, and whether it overflows depends on which font is loaded when the
check measures. To be registered on its own.

## MM 2.0 B1 on hosted — 2026-10-02

`20261011000000_midweek_evening_timing.sql` (ADR-104) is live: catalogue PR
supabase #64, backup `20261002-091630`, 81 migrations, no drift, smoke row as
expected (`docs/DEPLOYMENTS.md`). The open week of 5 Oct moved to the new
clock, so **Wed 7 Oct is the first evening at 19:55**, a week earlier than
ADR-104's target.

The production gate did its job on the way: for `199b126` it failed closed on
both runs because `/club/collection` was 323 px wide at 320 px. That was the
"flake" seen while building KB-030/031 and B1. It is KB-032: the
Album · Manage · Trading tabs needed ~303 px in a 280 px box, and whether the
page overflowed depended on font timing. KUT #148 narrows the segmented tabs'
phone padding (`px-3` below `sm`), the authenticated E2E then passed three runs
in a row, and the gate passed for `5da5dd8`.

Next for MM 2.0: PR 3 (B2, the draw and the five cards public from the lock,
ADR-105), not in this push week.

## MM 2.0 B2: the draw and every five from the lock — 2026-10-02

PR 3 of MM 2.0 (`feat/midweek-draw-from-lock`, ADR-105, migration
`20261012000000_midweek_draw_from_lock.sql`, views only). What members may read
from 19:55, for the evening's first five minutes as DR2 approved them:

- **`kut.midweek_draw_public`, new:** round 1's pairings and byes with both
  managers and the kick-off, from the lock, with no result column.
- **`midweek_entries_public` from the lock** instead of round 1: the five cards
  and everything that follows from them. The week's dice (form roll, pick
  factor, power) read null until round 1 kicks off. Columns unchanged.
- **Leak fix:** `final_reveal_at` (the end of the final since ADR-104) shows in
  the member views only once it has passed; at the lock it told an API reader
  whether the final would go to penalties. No page read it.
- **`evening_live`** appended to `midweek_current` for F1's Compete badge.
- Pages: the three entry columns are nullable and a report waits for them;
  nothing changes on screen until F5.

Verification: `npm run verify:fast` (40 files, 377 tests); every pgTAP suite on
the local stack, including the new `midweek_draw_from_lock.test.sql` (49:
before the lock, between the lock and round 1, round 1 under way, the final in
play, after the final, a void week, a week past its lock but not drawn, and
the D3 owner-count rule). The engine and B1 suites changed one assertion each,
both pinning the old shape (squads hidden until round 1; `schedule_version` as
`midweek_current`'s last column).

On hosted the same day (see below).

## MM 2.0 F1: Compete navigation — 2026-10-02

`feat/compete-navigation` (ADR-107, no migration). The fifth primary tab is
**Compete** (Midweek · Standings · Players), replacing Leaderboard, per the
DR2-approved mockups:

- Midweek Madness moved from `/club/midweek` to `/midweek`; everything under
  the old path is a permanent redirect, so shared links keep working.
- `CompeteBadge`: `Pick` until a member saves a squad for the open week, `Live`
  from the lock to the end of the final (`evening_live` from ADR-105, with a
  fallback for the deploy-before-push window).
- The Leaderboard page is headed Standings; Compete's section tabs sit at the
  top of the Midweek, bracket, Standings and Players pages.
- The Collection strip is gone (Q12).

Verification: `npm run verify:fast` (40 files, 387 tests); authenticated E2E
20/20 at 320 px and 412 px (Pixel 7), including the new Compete tests: the
`Pick` badge before and after a save, the tabs and their `aria-current`, the
redirects, no strip on Collection, and a 1440 px pass of the top bar with no
horizontal overflow.

## MM 2.0 B2 on hosted — 2026-10-02

`20261012000000_midweek_draw_from_lock.sql` (ADR-105) is live: catalogue PR
supabase #66, backup `20261002-110621`, gate passed for `2f3a94a` (#152 and
#153), smoke row as expected (`docs/DEPLOYMENTS.md`). From the next lock
(Wed 7 Oct 19:55) members can read the draw and every entered five before
round 1, and the Compete tab's `Live` badge reads `evening_live`. F3 and F5,
which waited for this, can now ship.

## Release gate without the launcher (ADR-108) — 2026-10-02

`chore/remove-production-launcher` (no migration). The production gate no
longer needs a separate launcher session: the launchers, the session receipt
and its module, and the Claude and Codex session hooks are gone, with their
tests. Every data-guarding gate check is unchanged. The next migration release
runs its gate in the working session.

## MM 2.0 F2: the match page in team colours (ADR-111) — 2026-10-02

`feat/midweek-match-page` (no migration). The match report now follows the
approved DR2 mockup (`Match-Other-FullTime`), in its full-time state. Matches
are still revealed whole, and the live states come with F6.

- Every Player and manager name is in its side's colour: blue left, red
  right, for every viewer. A Player both sides fielded shows only its name on
  screen; screen readers still hear whose copy it is. The renderer now returns
  each line as segments next to its unchanged text, so the page never
  re-parses names.
- The scoreboard has team-coloured names and digits. The timeline puts each
  chance in its side's lane, and from 600 px of its own width it becomes two
  lanes either side of the minute and score. Shoot-out rows show the manager,
  the total, then the kicks.
- The Why is a list: each card's Power in this match in a pill tinted by
  strength, with a bar against an ordinary card, strongest first.
  `Show every factor` opens Rating, Form, Pick, Fitness and Day for every
  card, and each factor explains itself on hover, tap or focus, with figures
  taken from the config. Owner counts leave the report.

Verification: `npm run verify:fast`; authenticated E2E 22/22 at 320 px and
412 px (Pixel 7), including the factors opened, an explanation shown on focus
and closed with Escape, and a 1440 px pass with the Why beside the story, all
with no horizontal overflow. A shoot-out and a Player fielded by both sides
were checked visually at 320 px, 412 px and 1440 px from the design sample.
Found on the way, not part of this change: from 640 px to about 880 px the
desktop top bar is wider than the screen on every page. It is registered and
fixed separately.

## KB-033: the top bar fits from 640 px — 2026-10-02

`fix/top-bar-tablet` (no migration). From `sm` to about 880 px every page was
wider than the screen: the desktop header's five labelled tabs, coins,
messages and avatar need about 880 px. Below `lg` the tabs now show their
icons only. Each keeps its label for screen readers and as a hover title, so
every link's name is unchanged. Found while checking the F2 match page at
700 px. No E2E width fell in that band.

Verification: `npm run verify:fast`; authenticated E2E with a new test at 640,
768 and 1023 px on Home, Midweek and Market (no horizontal overflow, every tab
named, the avatar on screen).

## MM 2.0 F3: the picker (ADR-112, KB-028, KB-029) — 2026-10-02

`feat/midweek-picker` (no migration). The picker follows the DR2-approved
mockups.

- One lock line, with the countdown right after the time it counts to. The
  fairness seal leaves the picker.
- The save bar says what its status means: the status and a note on the left,
  the actions on the right. Saved, it offers `Change your five`. With unsaved
  changes on a phone it becomes one compact row that stays above the tab bar.
- The privacy line now says members see your five from the lock, and that
  cards are never at stake.
- On phones and tablets, `Your cards` is a compact list. From `lg` the card
  grid stays. Archetype chips with counts filter it instantly.
- A Player whose archetype changed since the week opened says so in every
  place the card appears, including the card face from `lg` (KB-028).

Verification: `npm run verify:fast`; authenticated E2E at 320 px and 412 px
(Pixel 7). A new test switches a fixture Player's archetype for the open week
and checks the KB-028 wording, the filter, that Save stays in view with
unsaved changes, and the badges at 1440 px. Every page was checked for no
horizontal overflow. The empty, unsaved and saved states were checked
visually at 320 px, 412 px and 1440 px.

## MM 2.0 F5: the evening from the lock (ADR-113, KB-034) — 2026-10-02

`feat/midweek-evening-from-lock` (no migration). The evening and the bracket
follow the DR2-approved mockups, in their kick-off and full-time states.
Matches are still revealed whole, and the live states come with F6.

- A sticky clock under the app header shows the lock and every round as
  Locked, Played, Live, Next or Later, with a brass dot on the rounds you're in.
- From 19:55 the evening page shows the draw: your first match, your five and
  your opponent's (both possible opponents after a bye) with OVR, archetype,
  tier and keeper, and round 1's kick-off times. Form, pick and chances still
  wait for 20:00.
- Through the evening: your night, the next round's kick-offs and the round
  just played. Once you're out, a marked placeholder for the follow-up and a
  card for the final; from the final's kick-off, the final for everyone.
- Match rows show `Kick-off 20:15`, full time with scores, or a bye. Later
  rounds name `Winner of Mila v Eline` or `Winner, Quarters 1`. The bracket has
  jump links on phones and kick-off times in the desktop tree.
- `/midweek/past` lists every finished week with its champion, the field and
  how you did. The champion view links to it, with placeholders for ratings
  and sharing.
- KB-034, found on the way: during the evening the Compete tabs with the
  `Live` chip made every Compete page 360 px wide on a 320 px phone. Fixed.

Verification: `npm run verify:fast` (395 tests); authenticated E2E at 320 px
and 412 px (Pixel 7) plus 1440 px, with new tests for the draw, the
mid-evening, the champion view after the final and past weeks, each with the
no-overflow check and the clock pinned on scroll. The draw, out, final,
champion and past-weeks states were checked visually at 320, 412 and 1440 px
against the mockups.

## MM 2.0 F4: Home and Messages (ADR-114) — 2026-10-02

`feat/home-messages` (no migration). Home and the inbox follow the
DR2-approved mockups, with the review's unmocked items.

- Home opens with a short header, then a "now" stack ordered by deadline:
  picking, the session report, the rehab check-in, or the champion. During
  the evening the live Midweek card leads it: the draw, your match at full
  time with its headline, or the final, as they stood when the page loaded.
- Club Value and Rank are tiles that read as links; the KUT Coins tile is
  gone. Club activity shows six rows and folds a member's run of pack openings
  into one.
- Every message is one link to what it is about, and opening it marks it
  read. Rows are grouped Today, Earlier this week and by day; unread rows say
  New.
- The pack summary says which album slot a new Player fills, or how many
  copies you now hold and what this one discards for, with one summary line.
- Settings no longer promises notification preferences; the idea is in the
  roadmap.

Verification: `npm run verify:fast`; authenticated E2E at 320 px and 412 px
(Pixel 7) with new tests for the now stack, the evening card at the draw and
mid-evening, the inbox (open a Midweek result, open a club notice) and a pack
summary, plus Home at 1440 px, each with the no-overflow check. Home, the
evening card and Messages were checked visually at 320, 412 and 1440 px
against the mockups.

## MM 2.0 PR 5: a result message for every entrant (ADR-109) — 2026-10-02

`feat/midweek-result-for-everyone`, migration
`20261013000000_midweek_result_for_everyone.sql` (data-changing tier).

- Every entrant now gets a Midweek message when the week is paid, not only
  the members who won coins. The title says how far they got; the body says
  who beat them and how (penalties included), their coins, the champion, and
  whether an auto squad played for them.
- Payments are unchanged.

Verification: every pgTAP suite through `docker exec` (the payouts suite
updated: one message per entrant, the wording per finish, the auto-squad line,
none for an opted-out or disabled member, still idempotent);
`midweek-race` and `midweek-switch` integration tests; `npm run verify:fast`.

## MM 2.0 F6: the evening live (ADR-115) — 2026-10-02

`feat/midweek-live` (no migration). The evening follows the DR2-approved
live mockups.

- Your own match and the final unfold chance by chance: the score so far,
  `Live · 64′`, every chance as it comes, and the shoot-out kick by kick.
- Every other match reads `In play · result at full time` until it ends, in
  the evening, the bracket and its own page, which shows both line-ups and the
  chances before kick-off.
- The evening, the bracket and a live match page update every 20 seconds while
  a match is in play, and at the next kick-off otherwise, with `Updated …`.
- Your night says `Playing Eline now.`; the out card says the final is
  watched live again; Home's card shows your match as it stood at page load.
- The pages work the same before and after ADR-106's push, which follows this.

Verification: `npm run verify:fast`; authenticated E2E at 320 px and 412 px
(Pixel 7) plus 1440 px, run twice: against today's views and with ADR-106's
applied. New tests cover a match one minute in and the final one minute in.
The live evening, a live and an in-play match page, the final, the bracket and
Home were checked visually at 320, 412 and 1440 px against the mockups. Found
and fixed on the way: Home's card overlapped at 320 px with long names.

## MM 2.0 PR 4 (B3): the evening unfolds event by event (ADR-106) — 2026-10-02

`feat/midweek-live-reveal`, migration `20261014000000_midweek_live_reveal.sql`
(views only, additive tier).

- A member's reads now follow the evening's clock: a match shows from its
  kick-off, each event from its own moment, and the score, winner and end only
  once the match has ended; the champion once the final has.
- Weeks from before the new clock still show whole matches.
- F6 (#165, ADR-115) shipped first and already masks matches in play on the
  pages, so the pages look the same before and after this push; what changes
  is that a member's own API reads no longer run ahead of the clock.

Verification: the new `midweek_live_reveal` pgTAP suite (before kick-off, a
minute in, mid shoot-out, the final in play, complete, a pre-ADR-104 week) and
every other suite through `docker exec`; `npm run verify:fast`; authenticated
E2E at 320 px and 412 px (Pixel 7) plus 1440 px against these views. The live
evening was checked visually at 320, 412 and 1440 px with the migration
applied (the draw, a minute into round 1, between rounds, the final live, the
champion), along with what a member's own reads return at each moment.

## MM 2.0 PR 6 (C0): the archetype rotation in the simulation harness — 2026-10-03

`feat/midweek-rotation-harness`. Harness only: no migration, no engine or SQL
change; golden vectors and parity untouched. The evidence for checkpoints Q8
and Q9, which PR 7 (C1, ADR-110) waits for. Neither is decided here.

- `tests/sim/midweek-world.ts` can rotate unclaimed Players' archetypes each
  week as the roadmap row decides (owner, 2026-09-30): only active,
  collectible, unclaimed Players; the pool every archetype, Goalkeeper and
  All-rounder included. It runs before each week opens, the week plays what
  it set (the ADR-099 freeze), and it is seeded and deterministic from a hash,
  never the world generator, so every variant sees the same collections,
  habits, injuries and dice. The tuning club's seven specialists are its
  claimed Players; the other 23 rotate. With rotation off, `npm run
  sim:midweek` reproduces `MIDWEEK_TUNING.md` exactly.
- `node scripts/midweek/rotation.mjs` runs six variants over the same 5,000
  seasons (37 min) and writes `docs/archive/MIDWEEK_ROTATION.md`: no rotation;
  weekly uniform (the roadmap decision); weekly dealt evenly; exactly three or
  one rotating Goalkeepers; uniform every four weeks.

**What the run shows (5,000 seasons):**

| | Today | Weekly uniform | Dealt evenly | 3 rotating GKs | 1 rotating GK | Every 4 weeks |
|---|---:|---:|---:|---:|---:|---:|
| Strongest vs weakest (≤ 72%) | 70.6% | 65.7% | 65.4% | 65.9% | 68.0% | 65.7% |
| Thought-through vs random (≥ 58%) | 58.7% | **55.0%** | **54.5%** | **54.8%** | **56.6%** | **54.9%** |
| Habit lead (≤ 5%) | 4.5% | 1.7% | 1.5% | 1.6% | 1.3% | 2.0% |
| Strongest wins 8 (22–33%) | 28.2% | 23.1% | 22.8% | 23.2% | 25.5% | 23.1% |
| Goalkeepers on the roster, mean | 2.0 | 5.3 | 5.3 | 5.0 | 3.0 | 5.3 |
| Squads without a Goalkeeper | 64.5% | 36.3% | 34.8% | 36.7% | 53.6% | 35.8% |
| Fixed-habit squads with 2+ GKs | 2.4% | 19.2% | 18.5% | 16.6% | 6.0% | 19.3% |
| Members owning a GK, leanest 1% of weeks (of 22) | 3 | 11 | 13 | 13 | 8 | 11 |
| Rotating Player visibly changed within 2 / 3 weeks | — | 86% / 98% | 86% / 98% | 86% / 98% | 85% / 98% | 0% / 0% (86% in 8) |

- **Q8 (smooth the keeper count?).** Smoothing changes no target: the uniform
  draw, the even deal and a fixed quota of three land within half a point of
  each other on every row. What smoothing does change is the spread: under the
  uniform draw the roster holds 2 to 15 Goalkeepers in a week (3 or fewer in
  14% of weeks, 8 or more in 10%), and in the leanest 1% of weeks only 11 of 22
  members own one; dealt evenly it is always 5 or 6, and at least 13 own one.
  The **level** is what moves the targets: rotation takes the roster from 2 to
  about 5.3 Goalkeepers, so a fixed-habit five holds one 60% of the time instead of
  31%, and the thinker's edge, which ADR-092 found comes mostly from fielding a
  Goalkeeper, shrinks.
- **Every rotation variant takes "a thought-through five beats a random five"
  below its signed-off 58% floor** (54.5–56.6%), even with a single rotating
  Goalkeeper. The other rows stay in band and mostly improve (strongest vs
  weakest nearer "about 65%", the habit lead down from 4.5% to under 2%); the
  8-entrant row sits near its 22% floor. So PR 7 on its own would leave the
  ADR-092 sign-off unmet until something restores the thinking edge.
- **Q9 (a rotating archetype shows a Player is unclaimed).** Weekly, an
  attentive member tells 86% of unclaimed Players apart after watching two
  weeks and 98% after three; no smoothing variant changes that. Rotating every
  four weeks only delays it (86% after eight weeks) and costs the same balance.
  What leaks is "this Player has no linked account", not which member is which
  Player (`player_directory` still hides the link). Today the default already
  leaks most of the same: about 80% of the roster is an unclaimed All-rounder.
  The model has no claimed All-rounders, so it overstates today's one-week
  signal; the history signal does not depend on that.

**Options for the owner (not decided):**

- Q8: (a) no smoothing, as decided on 2026-09-30; (b) deal evenly or fix the
  rotating-keeper count, which removes the lean and glut weeks but does not
  move any target; (c) fewer rotating Goalkeepers (a quota of one), which
  softens the drop (56.6%) but still misses 58% and narrows "every archetype".
- The 58% row, for PR 7 against PR 8: (a) accept the dip while C1 is live
  alone and retune C2 (balance) with rotation on, so its sign-off restores
  58%; (b) hold C1's hosted push until C2 is tuned, and ship them back to
  back; (c) re-sign ADR-092's floor at about 55% for the rotating club.
- Q9: (a) accept, and say in how-it-works that unclaimed Players' archetypes
  rotate weekly; (b) rotate less often, which only delays it; (c) keep a
  claimed Player rotating until their member first chooses an archetype, so
  rotation means "nobody chose" rather than "unclaimed" (changes the
  2026-09-30 "claiming ends the rotation"); hiding past archetypes in the UI
  would not help, since every card face shows the week's.

**Decided by the owner, 2026-10-03, after the report (merged as #168):**

- **Q8: (a)**, no smoothing. Each rotating Player draws any of the seven
  archetypes independently, as decided on 2026-09-30.
- **The 58% row: (a)**. Accept the dip while C1 is live on its own; PR 8 (C2,
  balance) is tuned with rotation on, and its sign-off restores
  thought-through vs random to at least 58%.
- **Q9: (a)**, accept. How-it-works says that unclaimed Players' archetypes
  rotate weekly.

Verification: `npm run verify:fast` (422 tests, including the new
`midweek-rotation` unit tests: only eligible Players rotate, every archetype
is drawn, deterministic, the deal and quota are exact, off changes nothing);
`npm run sim:midweek` passes and reproduces `MIDWEEK_TUNING.md`;
`node scripts/midweek/rotation.mjs` at 5,000 seasons.

## MM 2.0 PR 7 (C1): unclaimed Players' archetypes rotate weekly — 2026-10-03

`feat/midweek-archetype-rotation`, ADR-110 (amends ADR-027 and ADR-099).
Migration `20261015000000_midweek_archetype_rotation.sql`, data-changing tier;
new Part L #27. Built to the owner's decisions in the ROADMAP row
(2026-09-30) and after C0 (2026-10-03): no smoothing (Q8), the visibility
accepted (Q9).

- **The open step rotates first.** `kut._mm_open_next` takes a transaction
  advisory lock, checks again for a running week, generates the week's seed,
  then `kut._mm_rotate_archetypes(seed)` sets every active, collectible Player
  with no linked account to `kut._mm_rotation_archetype(seed, player)` (rng.ts
  `uniform` over the seven, tag `rotation:<player id>`), rebuilds the active
  season once if anything changed, and returns the changes. The insert follows,
  so the ADR-099 snapshot freezes the rotated archetypes, and the changes are
  logged against the new week in `kut.midweek_archetype_rotations`.
- **The seed is the week's own secret one** (ADR-110): no draw can be known
  before the week opens; once the seed is published at payout, every draw can
  be checked against it.
- **Racing worker calls rotate once**: the advisory lock and the second check.
  A clash on `week_start` now raises (the old `on conflict do nothing` would
  have left a rotation without its week); the worker records it as `open: …`.
- **Copy:** how-it-works §6 and the Midweek section, and `/settings/card`,
  say that a Player with no linked account gets a new archetype every week
  (Q9). No page reads anything new, so they work before the push.
- **E2E fixture:** `endFixtureEvening` puts back, from the log, the archetypes
  rotated when the worker opened the week after the fixture's evening, and
  rebuilds the season, before it deletes that week.
- The C0 harness is unchanged; its `uniform` variant is this model. Switching
  its default to rotation belongs to PR 8's retune.

Locally an open with rotation and rebuild takes about 75 ms (25 eligible
Players, 24 changed); 7,000 draws for one seed land 973–1,051 per archetype.

Verification: `npm run verify:fast` (422); every pgTAP suite through
`docker exec` (35 files, 1,496 assertions), including the new
`midweek_archetype_rotation.test.sql` (34: only eligible Players rotate;
claimed by an enabled or a disabled account, inactive and non-collectible
never do; deterministic for a seed and uniform over the seven; every change
reported and logged against the new week; OVR unchanged and the stats
rebuilt; the cooldown not stamped; the snapshot freezes the draw; switch off
rotates nothing; a rerun opens, rotates and logs nothing);
`npm run test:integration` (7 files, 16 tests), including the new
`midweek-rotation` suite (three worker calls racing through `authenticator`
with safeupdate loaded: one week opens, every eligible Player has their draw,
one log row per change, the snapshot matches; a later call changes nothing);
`npm run sim:midweek` unchanged.

## MM 2.0 PR 8 (C2): balanced squads beat All-rounders — 2026-10-03

`feat/midweek-balance`, ADR-116 (amends ADR-089 and ADR-092). Migration
`20261016000000_midweek_balance.sql`, data-changing tier; no invariant
changes. Decided in the owner's Q13 interview and tuning sign-off
(2026-10-03); Q3 (captain, own-card bonus) out of scope.

- **The interview found the lines were not worth the same.** Measured with the
  match engine before deciding: one card at 1.40 added about 3 points of win
  chance in attack or midfield and under 1 in defence; four Speedsters or
  Playmakers beat four All-rounders about 56%, a balanced four only tied them.
- **The plusses are the engine's input** (`MIDWEEK.shape.plusses`, both
  engines): All-rounder 1/1/1, Speedster 2/2/0, Finisher 3/1/0, Playmaker
  1/3/0, Defender 0/1/3, Tank 0/2/2 (the owner's change at the sign-off),
  Goalkeeper 0/0/3. Line values per plus count are tuned so a plus is worth
  about the same in every line (+3.4 / +3.3 / +2.3 points), with outfield
  defence now 0.8 of a shot's resistance.
- **The weakest-line rule:** each outfield line needs 3 plusses; each plus
  short costs the squad ×0.88 (`kut._mm_balance`, stored as
  `midweek_entries.balance_ppm`, shown in `midweek_entries_public`).
- **The keeper's own strength:** a Goalkeeper 1.65 × power, a stand-in 0.45 of
  that whatever its archetype.
- **Retuned with the rotation on** (`archive/MIDWEEK_TUNING.md`, option R2):
  OVR factor at 83 1.12, auto factor 0.55. Strongest vs weakest 71.2%,
  thought-through vs random 61.6% (55.0% with the rotation alone), balanced
  vs All-rounders 63.1%, the best stack 32.7%; every target passes.
- **The harness** plays the `uniform` rotation by default, its thinker picks
  for the plusses, and it reports the shapes at equal power (two new target
  rows). The tuning sweeps ran as throwaway drivers, not committed.
- **Pages:** how-it-works shows the plusses table and the rule (§6 points to
  it); the Why list shows a chip per short line ("Defence 3 short"), only
  when the stored balance is below 1. Both work before the push: a missing or
  null `balance_ppm` means no chip.
- **Fixtures re-picked:** `midweek_live_reveal.test.sql`'s mid-shoot-out
  evening moves from seed 01 to fb; `midweek_engine.test.sql` reads the new
  auto factor; `midweek_draw_from_lock.test.sql` lists the appended column.

Verification: `npm run verify:fast` (427 tests); every pgTAP suite through
`docker exec` (36 files, 1,528 assertions), including the regenerated
`midweek_engine_parity.test.sql` (199: the SQL twin reproduces every golden
value, the balance vectors and a one-line-stack match included) and the new
`midweek_balance.test.sql` (23: the table and the line values, the rule and
its floors, the keeper's plusses skipped, the lock step storing each squad's
balance as the engine played it, auto squads included, and members reading it
from the lock); the midweek integration suites (race, switch, rotation: 7);
`npm run sim:midweek` at 5,000 seasons (every target passes; rewrites
`MIDWEEK_TUNING.md`); the authenticated E2E (49 passed, 1 expected skip),
including a new how-it-works check at 320 px and on a Pixel 7.

## MM 2.0 interviews (Q1, Q4, Q2) and F7 core: card ratings — 2026-10-03

`feat/midweek-ratings`, ADR-117. No migration. The owner decided Q1 (ratings),
Q4 (the shareable result), Q2 (something to follow after a knockout) and the
picker's plusses count in one interview; the ROADMAP's MM 2.0 rows record each
answer.

- **Q1 → F7, measured first:** 150 simulated seasons compared a counterfactual
  replay (mostly noise: 60% of goalscorers neutral or negative), the §44.10
  standout points (coarse) and events weighted by each chance's goal
  probability. The owner chose the weighted events, a rating per match and per
  night, a floor of 4, and a Claude Design mock before the pages.
- **The rule:** `matchRatings` and `rateNight` in
  `src/lib/midweek/report/ratings.ts`, pure functions of the stored events and
  the seed hash; 70 description lines in a new phrasebook layer
  (`phrasebook/ratings.ts`, 14 stories), for the owner's read-through.
- **Design input:** `design/midweek/sample-ratings.json`, every member's five
  with ratings and lines from the sample world on today's engine.
- **Q4 → F8:** names and Player photos on the image (the owner's decision,
  recorded against §53 in F8's ADR), a champion poster and "my night", from
  payout; UI from the same mock round.
- **Q2 → D:** predictions for members who are out, coins capped at about 30
  a night (30 split over the matches a round-1 loser could predict), no table;
  the backend ships first as its own migration PR (ADR-118), the UI after the
  mock.

Verification: see the PR.

## MM 2.0 D (backend): predictions for members who are out — 2026-10-03

`feat/midweek-predictions`, ADR-118 (amends ADR-096). Migration
`20261017000000_midweek_predictions.sql`, data-changing tier; adds Part L #28.
Decided in the owner's Q2 interview; the pages follow the Claude Design mock.

- **The rule:** a member whose own match has ended in defeat picks the winner
  of each later match before its kick-off, once both its feeders have ended;
  changeable until kick-off. `kut.save_midweek_prediction(week, round,
  pairing, winner)`; the rules live in a trigger on `kut.midweek_predictions`,
  checked in an order that never gives a result away.
- **Coins:** 30 split over the matches a round-1 loser could predict (2 a
  correct pick at 17–32 entrants), paid at the payout with the wins, one
  guarded row per (week, member) in `kut.midweek_prediction_rewards`, ledger
  reason `midweek_prediction`. `predictionCoins` is the TypeScript twin.
- **The result message** gains "You called 2 of 3 right: +20 KUT Coins."
- **Views:** the caller's picks and coins, and each match's split (counts
  only) from its kick-off.

## MM 2.0: deeper team colours, violet and teal — 2026-10-03

`feat/midweek-team-colours`, ADR-119 (amends ADR-111, ADR-107). No migration.
Built to DR3's drop-in values (`design/mm2-dr3/HANDOFF.md` §5).

- **Tokens:** side 0 violet, side 1 teal, each with a text tone (AA) and a
  deeper `-fill` for rails, the odds bar, scored kicks and the new 3 px
  scoreboard strip; renamed side-neutral (`team-0`, `team-1`).
- **Live** gets `--color-live-bg` / `-line` and no longer borrows the red
  side's tint (chip, clock, Home's live card).
- **Contrast** pinned in `tests/unit/team-colours.test.ts` from `globals.css`.

Verification: `npm run verify:fast` (446 tests); the authenticated E2E (49 passed, 1
expected skip), whose match-report checks now read the computed violet and
teal names and fills and the strip at 320, 412 and 1440 px, and Home's live
card on the Live tokens.

## MM 2.0 F7 pages: card ratings on the champion view, the bracket and each report — 2026-10-03

`feat/midweek-ratings-pages`, ADR-117 amended. No migration. Built to the
DR3 mockups `Evening-Champion`, `Bracket-Complete` and `Match-Rated`.

- **`MidweekRatingList`:** `Your five's ratings`, best first with `★ Best of
  your five`, neutral discs, the line, and `Show each match` chips that link
  to each report. On the champion view (closed) in place of the placeholder,
  and on the complete bracket (open) with a `Your ratings` jump link.
- **`MidweekWhyList`:** a rating column with its key and foot sentence, on
  every report of a complete week.
- **Data:** `loadNightRatings` reads the member's own matches' events in one
  query; `nightRatings` is a pure function of the rows, unit-tested against
  `rateNight` over the golden tournaments (the stored-row builders moved to
  `tests/support/midweek-stored-rows.ts`).
- **Copy:** how-it-works §12 "Ratings".

Verification: `npm run verify:fast` (444 tests, 6 new for `nightRatings`); the
authenticated E2E (53 passed, 1 expected skip): the complete bracket's ratings
(open, a `Your ratings` jump link, five night discs, one best chip, chips per
match) at 320 and 412 px and in a row of five at 1440, a chip opening its rated
report (ten discs, the key, the foot sentence), the how-it-works anchor, and the
champion view's block closed until `Show each match`; every no-overflow check.

## MM 2.0 D pages: calls for members who are out — 2026-10-03

`feat/midweek-calls`, ADR-118 amended. No migration; the backend has been on
hosted since 2026-10-03. Built to the DR3 mockups `Evening-Out`,
`Predict-States`, `Evening-FinalLive`, `Bracket-Calls`, `Bracket-Complete`
and `Evening-Champion`.

- **`MidweekPredictions`:** `Call the winners` on `/midweek` once out, and
  under a live final: one neutral card per later match, toggle buttons that
  save at once (`saveMidweekCall` → `save_midweek_prediction`), change or
  clear, every DR3 state, refusals worded by the guard's message, and the
  club's split from kick-off.
- **The bracket:** each later row carries the call (list and tree), a jump
  link while one is open, and once paid `Your calls` with `✓ +2` or `Not this
  time`.
- **The champion view:** `You` counts wins and calls; the weekly line links to
  the bracket's calls.
- **Model:** `src/lib/midweek/calls.ts` (pure, unit-tested on an 8-entrant
  bracket); `loadCalls` reads the three views tolerantly.
- **E2E fixture:** `takeBackPayouts` also takes back prediction coins.
- **Copy:** how-it-works §12 "Calls, once you're out".

Verification: `npm run verify:fast` (461 tests, 9 new for the call model); the
authenticated E2E (58 passed, 1 expected skip). The new calls test finds the
fixture account that goes out first, moves the evening to a minute before the
next round, and at 320 and 412 px saves, changes, clears and re-saves a call,
reloads, sees it on the bracket (and at 1440 on the tree), sees it close at
kick-off with the club's split, then after the payout the weekly line, `You`
counting calls, the bracket's `Your calls`, and the how-it-works anchor; every
no-overflow check.

## MM 2.0 F8: share images, the champion poster and "my night" — 2026-10-03

`feat/midweek-share`, ADR-120 (new; records the §53 exception the owner
chose in Q4). No migration. Built to the DR3 mockups `Share-Poster`,
`Share-MyNight`, `Share-Flow`, `Evening-Champion` and `Bracket-Complete`.

- **CORS checked first:** Supabase Storage answers signed photo URLs with
  `Access-Control-Allow-Origin: *`, locally and on hosted (a credential-less
  request with a bogus token), so photos are fetched, made into bitmaps and
  drawn without tainting the canvas.
- **`share.ts`** (pure): every word and number on both images; **`share-draw.ts`**:
  the canvas, the LiveCard face drawn from its own shirt path and fonts.
- **`MidweekShare`:** previews on mount; `Share` (system share sheet) and
  `Save image` on a phone, `Download` on a desktop; on the champion view and
  the complete bracket. The last `MidweekPlaceholder` and the component retire.
- **Data:** the champion's ratings come with the member's in one events query.
- **Copy:** how-it-works §12 gains one line on the images.

Verification: `npm run verify:fast` (468 tests, 7 new for the share model); the authenticated E2E
(59 passed, 1 expected skip). On a phone both previews draw at 1080 × 1350
(one card with a real Storage photo, so a tainted canvas would fail),
`Share` hands `kut-midweek-17-jan-champion.png` to the share sheet and `Save
image` downloads "my night"; on a desktop context `Download` saves a PNG whose
header reads 1080 × 1350; the champion view shows the block; every
no-overflow check, and the bracket's KB-031 line test, which caught a
layout shift from the drawing before it was fixed.

## MM 2.0: the picker's plusses count — 2026-10-03

`feat/midweek-plusses`, ADR-116 amended. No migration. Built to the DR3
mockups `Picker-Lines-*` (`design/mm2-dr3/HANDOFF.md` §4).

- **`MidweekLineCount`:** each line's plusses against the 3 it needs, the
  verdict with the factor, who goes in goal and the rule; no count without a
  Goalkeeper (DR3-8). It calls the engine's `squadBalance`, so it can't
  disagree with the match.
- **The sticky save bar** on a phone with unsaved changes gains the verdict
  as a second row; **the phone list rows** show each card's plusses.
- **Model:** `src/lib/midweek/plusses.ts`, unit-tested on DR3's cases
  (balanced, one short, the three-keeper gamble at ×0.77, trialists, no
  keeper).
- **E2E fixture:** the calls test (D) now signs in as whichever fixture
  account goes out first before the final, giving a fixture member the test
  password when neither release account does, so it never skips silently.

Verification: `npm run verify:fast` (474 tests, 6 new for the count); the
authenticated E2E (61 passed, 1 expected skip): the count with no Goalkeeper,
a short defence at ×0.77 with the sticky row, then balanced, at 320 and 412 px
and at 1440 (the sticky row hidden); each phone row's plusses; every
no-overflow check.

## Share recovery and rating/share alignment — 2026-10-04 (local, not released)

Frontend slice for KB-037, KB-035 and KB-036, implemented in that order;
ADR-117/120 amendment. No migration dependency. Existing owner reports and
the documentation-map change are retained. Git status/history and canonical
guidance were read before editing, followed by installed Next.js 16.3.5 docs.

- **Share recovery:** each image owns loading/drawing/Retry and its preview
  URL. Font failures fall back to system fonts after at most 3 seconds; photo
  fetch/decode keeps the shirt fallback and a 5-second bound. `arcTo` replaces
  a missing `roundRect`; nonempty PNG export is bounded to 10 seconds.
  Canvas-context/draw/export failures are isolated to their tile, with a real
  Retry. Bitmaps, late cancelled decodes, canvas backing stores and owned URLs
  are released; downloads reuse the preview URL.
- **Diagnostics:** local console/event records only stage, image kind,
  allowlisted error name and recovery. Native share cancellation is neutral;
  action failures keep the PNG and allow Share/Save again. No photo URL,
  credential, payload, error message, member name or user agent is logged.
- **Rating links:** full-width rows, wrapped opponent names, disc/arrow right,
  44 px minimum targets. Phone rows span the text/disc area; desktop cards use
  shared rows. Toggle ARIA state, accessible names and report targets remain.
- **Share layout:** five shared desktop rows for preview/title/description/
  actions/feedback, compact 110 px phone thumbnails. Both PNGs were already
  1080 × 1350; this corrects content-dependent page alignment, not dimensions.
- **Browser coverage:** Chromium Pixel 7/320 and WebKit iPhone emulation;
  the release runner provisions both engines. New regressions cover old
  schedule-v1 and current schedule-v2 completed fixtures, real local CORS
  photos, rejected/hung fonts, missing roundRect, failed photos, context/draw/
  null or stalled PNG failures, independent Retry, share abort/error/success,
  download fallback and cleanup after rendering or cancelled decode. Geometry
  spans 320/412/640/1280 px, short/long names, one/two images and loading/error/
  ready/feedback on completed views. Desktop screenshot visually checked.

Validation: `verify:fast` passes (49 files, 474 unit tests), including policy
sync, formatting, ESLint and TypeScript. Final browser/build results are
recorded in the verification addendum below.

**KB-037 stays investigating.** The affected phone, OS and browser were asked
for early but remain unknown. Neither its actual exception nor the hosted
30 September payload has been reproduced. Rejected fonts and missing
roundRect are demonstrated failures, not confirmed explanations for that
device. Emulated WebKit and mocked sharing cannot close the report.

## Frozen Special tier correction — 2026-10-04 (separate local migration slice)

KB-038 / ADR-121; `20261018000000_special_snapshot_tiers.sql`, following
`20261017000000_midweek_predictions.sql`. Existing migrations are immutable
and untouched. The new migration has been applied only to local Supabase.

Collection, market, saved pack results and offered-card JSON now read a
Special's `snapshot_rarity_tier` directly. The first three had the obsolete
OVR ladder; trade JSON always used Common. Live tiers and missing-state
floors, frozen OVR/stat/tier rows, discard/pricing/economy formulas, view
column contracts, grants and invoker/definer/barrier modes remain unchanged.
Current projections and RPC output were audited; Live-only projections and
weights need no change, and past Midweek lock snapshots are not rewritten.

Validation: 51 new pgTAP assertions exercise all six divergent stored tiers,
Live/current-state and missing-state floors in all four outputs, real trade
RPC guards, frozen rebuild persistence/immutability, columns, ACLs and
anon/member/disabled/profileless/service-role boundaries. Full local pgTAP
passed **38 files / 1,626 assertions**. The Windows Supabase CLI failed to
quote this repository's spaced path (zero tests); every SQL file was instead
run with `psql` in the local DB container, with TAP plan/count/assertion and
SQL exit-status checks. The working-tree migration policy passes: one added
migration and companion test, no existing migration edits. `verify:fast` and
production dependency audit pass; pinned local Gitleaks scans found no leaks
in working sources or 246 history commits.

**Independent review/release:** package this SQL/test and Special-related
spec/roadmap/ADR/KB/progress hunks separately from the frontend PR. Part L and
RPC contracts do not change; there is no issuance. Catalogue the exact SQL in
**VibeTrunk/supabase**, extend its verification, and establish parity before
Special issuance. Central catalogue work and hosted application remain
outstanding. Rollback re-creates the four prior view definitions named in the
SQL; no snapshot rewrite/drop/grant change is needed. Applicable release and
backup evidence must name the eventual exact candidate SHA.

The initial implementation ended without commits or external mutations.
The owner subsequently authorized commits and pushes of these two slices:
frontend on `docs/known-bugs-kb035-kb036`, migration on stacked
`fix/special-snapshot-tiers` (review against the frontend branch until it
merges). At that point, merges, deployments, hosted migrations and
central-repository mutations remained unauthorized. Later PR/catalogue work
is recorded below. KB-025 remains cannot-reproduce; KB-018's
database provenance follow-up remains deliberately deferred.

### Verification addendum for both local slices (before PR publication)

- Full authenticated run: **129 passed, two expected duplicate pack-test
  skips, one WebKit Sign in click timeout** before KB-033's layout assertions.
  The same case passed unchanged on a focused rerun (1/1, 8.1 seconds).
  All **39 new share/rating/layout regressions passed**, no skips. The initial
  full run was not green; the two skips are not passes (pack coverage ran
  successfully once on narrow Chromium).
- `test:integration`: **7 files / 16 tests passed**, explicit loopback target.
  `test:e2e`: **26 passed**, no skips. Production build passed.
- Local installed Next.js is **16.3.5**, while package declaration/lockfile
  specify **16.3.6**. Documentation was read from the installed package;
  dependency files were untouched. Validate the eventual candidate in CI's
  clean lockfile install before release; local checks do not certify 16.3.6.
- `verify:fast` passed as recorded above. Its first ESLint run raced
  Playwright's initial cleanup of `test-results`; the rerun passed.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities. Pinned
  Gitleaks working-source and history scans passed with full redaction.
  Working-tree migration policy passed; the release runner parses without
  executing the production gate. `git diff --check` is clean.
- No missing local stack or browser engine remains. **Missing evidence:**
  affected real phone/browser and actual 30 September diagnosis, central
  migration catalogue parity, exact-candidate GitHub merge/scan evidence,
  applicable cold backup and production release gate. Nothing is deployed;
  each external mutation and each commit needs separate explicit instruction.

## PR and catalogue follow-up — 2026-10-04

Opened KUT PRs #183 (frontend) and #184 (Special-tier migration), plus central
**VibeTrunk/supabase PR #79** with the exact committed SQL, catalogue entry and
verification entry. Both original KUT heads passed every required GitHub check,
including clean-lockfile build, database/integration, migration policy and
secret scan. The central repository has no automated PR checks; its local
source verification passes for 88 shared migrations, and KUT parity passes
for 87 KUT migrations.

Read-only hosted preflight from the central checkout, using the stored DPAPI
credential without logging it: 87 applied migrations match, and only
`20261018000000_special_snapshot_tiers.sql` is pending. The central dry run
with vault updates explicitly disabled names only that file. Sanitized
evidence and an executable PowerShell preflight are stored locally under
`.release-evidence/migration/`; they are ignored and contain no credentials.
No hosted migration was applied and the production release gate was not run.

The owner squash-merged #183 as `17fc33e163c35965f2abcd961395c14df6a3ae46`.
GitHub retargeted the stacked #184 to `main`; squash ancestry caused conflicts
in KNOWN_BUGS, PROGRESS and decisions. Merged updated `origin/main` into the
migration branch, retaining the frontend history and all KB-038/ADR-121
documentation. SQL, database tests and application code are unchanged.
The updated head requires fresh CI before the owner merges #184. Independent
future slices branch from `main`, as now recorded in CLAUDE.md; commit/push
requests include opening or updating their PRs.

Conflict-repair checks: `verify:fast` passes again (49 files / 474 tests,
policy copies, formatting, lint and TypeScript). A byte comparison confirms
unchanged migration/test content; KB-018/025/035–037 exactly match merged
main, and no frontend application/test changes remain in the PR diff.

Remaining: owner approval/merges for #184 and central #79; final-candidate
release evidence and applicable cold-verified backup; a repeated central
preflight, separately authorized hosted application and ordinary-member smoke
verification. The agent will perform the technical steps as far as authorized
and provide exact PowerShell if an operator action is needed. KB-037 remains
investigating pending the affected phone/OS/browser and real-device evidence.
