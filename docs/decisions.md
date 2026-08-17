# Decisions — Kelderklasse Ultimate Team (KUT)

Why this repo looks the way it does. Newest entries at the bottom.

## Agent safety scaffolding

Copied from the `vibetrunk-new-tool` skill's templates, which trace back to
`VibeTrunk/home` (the original template) and `VibeTrunk/cogitster` (which
added the Supabase CLI allow-list adaptation). See `VibeTrunk/home`'s
`docs/decisions.md` for the full reasoning behind the allow-list +
PreToolUse-hook + gitleaks-CI defense-in-depth design — not repeated here to
avoid drift between copies.

The Supabase addon was applied at creation time (`.codex/rules/project.rules`,
`.claude/settings.json`): `npx supabase migration list` and
`npx supabase db push --dry-run` are auto-allowed as read-only; `supabase
functions deploy` is auto-allowed generically since the build spec doesn't
pin down a specific Edge Function name yet (unlike cogitster's single
`solo-game` function — KUT's spec describes several RPC-style operations:
`claim_starter_pack`, `open_pack`, `discard_card`, `create_listing`,
`buy_listing`, `publish_session`, `rebuild_season`). `supabase db push`
(real), `db reset`, and `secrets set` stay off the allow-list.

## Name

The working title in the build spec is "TFH Ultimate Cards" / "TFH Cards",
with a suggested subdomain `tfh.vibetrunk.com`. The user chose to name it
Kelderklasse Ultimate Team (KUT) instead — repo `VibeTrunk/kut`, subdomain
`kut.vibetrunk.com`, Supabase schema `kut`. Anywhere the build spec itself
says "TFH Ultimate Cards", read it as this project's working spec; the
product name shown to users is KUT.

## Open items

- **Blurb for `home`'s tools grid** was drafted ("Collectible football cards
  for Kelderklasse — showing up matters as much as scoring.") but not yet
  added to `VibeTrunk/home/src/data/tools.ts`, even though KUT is now live —
  offer that edit (per the `vibetrunk-new-tool` skill, step 6).

Resolved: framework/stack scaffolding is built (see ADR-001 onward), and the
CSP `connect-src` placeholder was replaced with the real project ref and
moved to a per-request nonce in `src/proxy.ts` (see the "Fix login hydration
under strict CSP" commit).

## ADR-001 — Phase 0 local development foundation

Date: 2026-08-16

Status: Accepted

Decision: KUT uses a Next.js App Router application with strict TypeScript,
Tailwind CSS, ESLint, Vitest, Playwright, and a project-scoped Supabase CLI.
Local Supabase is initialized with a version-controlled `kut` schema
migration and pgTAP test. The initial page is intentionally only a public
foundation page; no private TFH data is present.

Reason: This directly follows the canonical Phase 0 acceptance criteria and
lets every later schema/RLS/economy change be tested locally without touching
the shared hosted Supabase project.

Consequences: Docker Desktop is required for database tests. `verify:fast`
does not require Docker; `verify:full` does. Production linking, Vercel, and
the real Supabase project reference remain deliberately deferred.

## ADR-002 — Roster and rating data live in the `kut` schema

Date: 2026-08-16

Status: Accepted

Decision: The first Phase 1A migration stores Players, Seasons, Profiles,
Match Sessions, Attendance, and derived Player Season State in `kut`, using
constrained text rather than PostgreSQL enums. Row-level security denies
anonymous access, allows authenticated in-game reads, and permits mutations
only to enabled admins. Ratings are calculated in a pure TypeScript module
from published football weeks; the database rebuild operation is the next
slice and must use the same tested fixtures.

Reason: This keeps category changes migration-friendly, preserves the model
mandated by the build spec, and makes the critical rating rules independently
testable before they affect real data.

Consequences: There is no client-authoritative rating state. Future admin
publish/rebuild code must keep database output in parity with
`src/game/rating-engine.ts` and its fixtures.

## ADR-003 â€” Server-authoritative local admin attendance publishing

Date: 2026-08-16

Status: Accepted

Decision: Email/password login uses Supabase SSR cookie clients with a Next.js
proxy to refresh sessions. The admin route and its Server Action independently
verify the Supabase JWT claims and the enabled role in `kut.profiles`. The
browser may authenticate but has no direct data-mutation path.

`kut.publish_attendance_session` is the only new attendance publication entry
point. It accepts validated JSON attendance data, creates the session and
attendance rows, invokes the existing publish/rebuild operation, and runs as a
single database transaction. It is executable only by authenticated callers
whose enabled profile is an admin or superadmin.

Reason: A UI-only guard or client-side insert could allow crafted browser
requests to affect real-player ratings. Keeping authorization at the route,
action, RLS, and database-function layers preserves the build specification's
server-authority and deterministic-rebuild requirements.

Consequences: Admin accounts must be provisioned deliberately; public signup
is disabled at the Auth-service level and absent from the application UI. The
email provider itself remains enabled so provisioned users can sign in with a
password. Invite claim onboarding is the later,
member-facing account-creation path. The local fictional admin is test data
only and never belongs in hosted Supabase.

## ADR-004 â€” Narrow public Live Ratings projection

Date: 2026-08-16

Status: Accepted

Decision: The homepage reads `kut.public_live_ratings`, a database view that
contains only active, collectible Players in the active Season and only the
public card fields needed to render a Live Rating. `anon` has access to this
view and schema usage, but not to the underlying roster, attendance, profile,
or state tables.

Reason: The specification allows a public in-game roster while prohibiting a
private roster. A constrained projection permits an unauthenticated ratings
homepage without exposing hidden Activity/Form Scores, attendance history,
emails, photos, or admin information. It also avoids placing a service-role
secret in the page-rendering path.

Consequences: The homepage is dynamic and revalidates after attendance
publication. Any future public card field must be consciously added to the
view; private Player fields must never be selected through it.

## ADR-005 â€” CSS-rendered reusable Live Cards

Date: 2026-08-16

Status: Accepted

Decision: Live Cards are rendered from player-state data and CSS layers, not
pre-generated card images. The component supports compact grid and future
detail sizes, has a monogram portrait fallback, and uses CSS-only frame,
texture, and rarity effects.

Reason: This satisfies the visual architecture in the build specification,
keeps every card current as ratings change, avoids duplicated image storage,
and stays performant on mobile devices. A textual tier label and reduced
motion mode make the treatment accessible.

Consequences: Player photos can be added later by supplying a safe authorized
photo URL/path to the component. Card content remains data, not pixels, so it
can be reused by collection, pack-reveal, player-detail, and market views.

## ADR-006 â€” Invite-only Auth creation through a server action

Date: 2026-08-16

Status: Accepted

Decision: Administrators create player-bound invitations from the protected
admin UI. The server generates a 256-bit random token, stores only its
SHA-256 hash, and returns the raw link once. Claiming an invite uses a server
action with the server-only Supabase service role to create the Auth user,
then calls a service-role-only database function to link the profile and
consume the invitation.

Reason: Browser sign-up would conflict with private membership and could not
safely use an Auth admin API. The database function locks and consumes the
invite with profile creation, while the server action removes an Auth user if
that claim fails.

Consequences: The server environment must provide `SUPABASE_SERVICE_ROLE_KEY`.
No raw invite token is stored, a token cannot be claimed twice, and consumed
invitation audit records prevent hard deletion of their associated Auth user.
Password recovery remains admin-assisted until custom SMTP is configured.

## ADR-007 — Audited correction of published attendance

Date: 2026-08-16

Status: Accepted

Decision: A published session is corrected only through the protected
`kut.correct_published_attendance_session` RPC and its admin Server Action.
The function locks the published session, writes an immutable correction record
containing the old and replacement session/attendance values, requires a
human-readable reason, updates the live session, and rebuilds its season in the
same transaction.

Reason: Rating rebuilds are intentionally deterministic so genuine data-entry
mistakes must be correctable. Direct, unlogged updates would make the
real-world input history untrustworthy and would let an accidental correction
silently rewrite the explanation for changed ratings.

Consequences: Ratings may change after a correction, which is the expected
result. The original publish timestamp stays intact, correction history is
visible only to admins, and later economy work must follow the specification's
policy: add missing attendance rewards when appropriate but do not
automatically claw back already-issued currency or reverse completed market
transactions.

## ADR-008 — Cancel published sessions; never destructively delete them

Date: 2026-08-16

Status: Superseded by ADR-009

Decision: Admins can cancel, but not delete, a published session through
`kut.cancel_published_session`. Cancellation requires a reason, records who
cancelled it and when, clears the published timestamp, and rebuilds the linked
season atomically.

Reason: An accidental duplicate or invalid session needs a quick operational
escape hatch. Deleting it would erase the evidence required to explain rating
changes and undermine deterministic reconstruction from historical inputs.

Consequences: Cancelled sessions and their attendance remain in the database
but are excluded from all rebuild calculations and normal-user reads.

## ADR-009 — Reversible published-session lifecycle

Date: 2026-08-16

Status: Accepted

Decision: A cancelled session remains visible to admins, may be corrected
while cancelled, and can be reactivated with an explicit reason through
`kut.reactivate_cancelled_session`. `kut.session_status_events` records every
cancellation and reactivation. Only `draft` and `published` sessions occupy a
unique `(season, date, session type)` slot; cancelled sessions do not.

Reason: A cancellation is often a temporary operational decision rather than
a definitive statement that the real event never happened. Keeping the record
editable and reversible preserves history while allowing an admin to resolve
duplicate or mistaken entries without being blocked by their original slot.

Consequences: Editing a cancelled session does not rebuild ratings because it
is not currently counted. Reactivation rebuilds the season atomically. If a
new draft or published session has used the same slot, reactivation is denied
until that conflicting current session is resolved.

## ADR-010 — Economy writes use database transactions and an append-only ledger

Date: 2026-08-16

Status: Accepted

Decision: Wallet balances, ledger entries, Card Copies, starter grants, and
attendance rewards live in `kut` and have no direct browser write policies.
`claim_starter_pack` locks the Profile and atomically records the starter
marker, wallet credit, ledger entry, and three distinct untradeable cards.
Attendance rewards are triggered only for published attendance and protected
by a `(session_id, player_id)` idempotency record plus a unique ledger key.

Reason: Currency and ownership are the first irreversible game-economy state.
Using a mutable balance alone or client-originated writes would make duplicate
grants and untraceable minting likely, especially when sessions are corrected
or retried.

Consequences: New invite claims immediately receive their starter assets;
earlier accounts can claim once through a server action. Corrections and
reactivations can award a newly eligible attendee but cannot duplicate an
existing reward. Cancellation does not retroactively create negative wallet
entries, matching the MVP correction policy. Packs, discard, and market
operations must add compensating ledger-backed transactions rather than write
balances directly.

## ADR-011 — Audited, server-only admin-assisted password recovery

Date: 2026-08-16

Status: Accepted

Decision: KUT provides a protected account-recovery page that sets a temporary
password only through Supabase Auth's server-only Admin API. Before the Auth
change, an admin-checked RPC writes a pending event; the action then marks it
completed or failed. Passwords never enter the KUT database or audit data.

Reason: Custom SMTP/password-recovery links are not configured yet, but a
private-group app needs a controlled recovery route. An unaudited UI or direct
browser Admin API call would expose the service-role secret and permit
untraceable account takeover.

Consequences: An admin may reset a normal member but not their own password or
another administrator's; a superadmin may reset other administrators. Admins
must share the temporary password securely. This flow remains a bridge until
the normal self-service SMTP recovery flow is implemented.

## ADR-012 â€” Private collection read projection

Date: 2026-08-16

Status: Accepted

Decision: The authenticated collection and card-detail pages read the
`kut.my_collection_cards` `security_invoker` view rather than assembling
ownership data from browser-managed joins. The view has an explicit
`owner_id = auth.uid()` filter, omits burned copies, and selects a Live card's
current active-season state while allowing a future Special edition to supply
its immutable snapshot attributes.

Reason: A card copy is private economic state. Although an administrator has
separate read access for operational support, the member-facing collection
must never become a convenient path for retrieving other members' cards.
Keeping the exact display projection in one read-only database view also
prevents the UI from interpreting rating or snapshot rules independently.

Consequences: `/club` and `/club/cards/[cardId]` work only for an enabled,
authenticated profile and are intentionally read-only. The next economy flow
that changes ownership or balance must be a server-authoritative database
transaction; no client write policy is added by this view.

## ADR-013 â€” Atomic card discard with a ledger-backed burn

Date: 2026-08-16

Status: Accepted

Decision: `kut.discard_card(card_id, idempotency_key)` is the sole discard
operation. It locks an active Card Copy owned by the authenticated enabled
user, rejects untradeable copies, calculates the payout from the server’s
current Live state or the Special snapshot, sets `burned_at`, appends a
positive `discard` ledger entry, and credits the wallet in one transaction.
The idempotency key is unique per user and returns the original result if
retried for the same card.

Reason: Discard destroys an owned economic asset and creates currency. Letting
the client mark a copy burned or supply the amount would break both ownership
and wallet invariants. A soft burn keeps the historic card copy and its ledger
reference auditable while excluding it from My Club.

Consequences: Starter cards remain locked and have no discard UI. The first
manual discard test will require a future tradeable Pack or market card.
Future market listings must be checked by this operation before a card can be
discarded, once listings exist.

## ADR-014 â€” Persisted, server-selected basic pack openings

Date: 2026-08-16

Status: Accepted

Decision: KUT has one active MVP pack definition, TFH Pack (250 TF Coins,
three cards). `kut.open_pack(pack_slug, idempotency_key)` performs the wallet
debit, ledger entry, weighted Live-edition selection, Card Copy minting, and
opening/result persistence in one security-definer transaction. A result page
reads the saved opening rather than any browser-provided card data.

Reason: A pack is both a currency debit and a source of scarce economic
assets. Separating payment, random selection, or minting would permit partial
state and refreshing a reveal must not reroll outcomes. The caller never
supplies the price, selected editions, rarity, or Card Copy identifiers.

Consequences: Duplicate Live editions are allowed and pack copies are
tradeable. The current scope intentionally excludes Special-card rolls and
additional pack SKUs. Before changing pack economics or adding another pack,
the specified expected-value calculation and admin health readout need to be
implemented.

## ADR-015 â€” Read-only pack economy health monitoring

Date: 2026-08-16

Status: Accepted

Decision: The admin economy page reads `kut.pack_economy_health`, which
derives expected Live-card discard value from the active player state and the
specified rarity weights. It exposes expected return alongside compact global
economy totals only to administrators. The same calculation shape is covered
by a pure TypeScript module for deterministic simulation-style unit tests.

Reason: Pack value shifts as attendance changes Live OVR and rarity. It needs
to be visible before creating a broader market, but an early dashboard must
not become an unaudited settings panel or expose economy-wide data to ordinary
members.

Consequences: The page warns at the product thresholds but cannot change any
configuration. Adding a new pack SKU or altering odds/price must be a
versioned migration/configuration decision with updated expected-value tests.

## ADR-016 â€” Atomic buy-now market with listing locks

Date: 2026-08-16

Status: Accepted

Decision: The marketplace uses 24-hour buy-now listings only. Listings retain
seller ownership but lock the Card Copy against discard; `create_listing` and
`cancel_listing` validate the caller and status server-side. `buy_listing`
locks the listing and both wallets in a consistent order, validates balance
and seller ownership, transfers the single Card Copy, records an immutable
sale, and writes buyer, seller, and tax ledger entries atomically.

Reason: Listing and purchase are ownership-changing economy operations. A
client-managed transfer, non-atomic balance update, or unprotected listing
could duplicate a card, double-sell it, or create/lose coins. The listing row
and buyer idempotency key provide retry-safe transaction history.

Consequences: The 5% tax is rounded up with a minimum of one coin and is
burned, not credited to any account. Listing bounds derive from the current
server-calculated discard/reference value. The current scope has no auctions;
the next read-only slice should add Club Value and leaderboard calculations
using the recorded sale history.

## ADR-017 - Public seller name on active listings

Date: 2026-08-17

Status: Accepted

Decision: `kut.active_market_listings` includes the selling member's KUT
display name, and the Transfer Market renders it as "Sold by [name]".

Reason: Buyers need enough context to identify who is offering a card, while
the market must not reveal email addresses or unrelated profile data.

Consequences: A seller's chosen KUT display name is visible to signed-in
market members while their listing is active. The view continues to expose no
email address, user ID, wallet balance, or private collection data.

## ADR-018 - Read-only Club Value and leaderboard projections

Date: 2026-08-17

Status: Accepted

Decision: Club Value is calculated on page request as wallet balance plus the
reference value of every unburned Card Copy, including locked copies. The
authenticated member-only `my_club_value` view supplies the personal summary;
the authenticated `club_value_leaderboard` view exposes only rank, display
name, derived club name, total value, card count, unique-player count, and a
caller-specific current-member flag.

Reason: This implements the MVP pricing context and competition loop without
creating a cache that could drift from current Live ratings or recent sales.

Consequences: Values use the existing five-sales/14-day median and bounded
fallback function. These views do not permit a client to alter a wallet, card,
sale, or reference-value rule; email addresses and private collection details
remain absent from the leaderboard.

## ADR-019 - Private Message Center with atomic market events

Date: 2026-08-17

Status: Accepted

Decision: `user_notifications` is a member-private inbox. A successful
`buy_listing` transaction writes one immutable market-purchase message for the
buyer and one market-sale message for the seller alongside the ownership and
wallet updates. The only mutable field is `read_at`, changed through a
member-checked database function and server action.

Reason: A market transfer is not complete as a usable product flow if the
seller has no reliable in-app record that their card sold and coins arrived.
Putting notification creation in the same transaction prevents a completed
sale from silently missing one side's message.

Consequences: Members can read and mark only their own messages. Browser
clients have no direct notification write policy. Existing sales are backfilled
once; future notification categories can reuse the table without weakening the
economy transaction boundary.

## ADR-020 - Member-only Live Ratings

Date: 2026-08-17

Status: Accepted

Decision: The Live Ratings homepage and `kut.public_live_ratings` view are
available only to authenticated KUT members. Unauthenticated visits to `/`
redirect to `/login`, and `anon` no longer has `SELECT` access to the view.

Reason: KUT is an invite-only private group. The group decided that even the
roster's narrow in-game card projection should not be publicly browsable.

Consequences: Sign-out leaves a member at the login page rather than a public
ratings page. Server and database tests must verify the authentication boundary
for `/` and deny anonymous view access. The view name remains unchanged to
avoid a needless migration of member-facing code.

## ADR-021 - Central catalogue for the shared Supabase migration ledger

Date: 2026-08-17

Status: Accepted

Decision: Hosted migrations for the shared VibeTrunk Supabase project are
catalogued and deployed only from `VibeTrunk/supabase`. KUT keeps identical
migration files for its local Supabase stack and database tests, but must not
run a hosted `supabase db push` itself. New schema changes require matching,
immutable migration files in the owning app repository and the central
catalogue.

Reason: Supabase records migration versions globally for the database rather
than separately for schemas. Cogitster's existing migration entry caused KUT's
otherwise valid hosted push to fail its local/remote-history safety check.

Consequences: Operators create a verified encrypted backup, check catalogue
file parity, review a central dry-run, and obtain explicit approval before a
hosted schema change. This adds a small cross-repository release step while
preserving each tool's isolated schema and local test workflow.
