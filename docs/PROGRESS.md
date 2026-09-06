# KUT build log

Dated delivery entries, oldest first — **newest at the bottom**. Each entry is
one shipped slice: what changed, the migrations involved, verification
results, and (where relevant) the hosted-deploy status.

**Current state is not tracked here.** See `CLAUDE.md` ("Status so far" /
"Current hosted deployment") for what is live, `ROADMAP.md` for what is next,
and `KNOWN_BUGS.md` for open defects. The doc map is `docs/README.md`.

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
