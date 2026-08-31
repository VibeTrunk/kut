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

## Speculative idea — weekly 5-card squad knockout (not decided)

Status: Half-baked — brainstormed only, not scoped, not an ADR.

Idea raised while discussing whether KUT's collect/trade loop is fun enough
on its own: give members a lightweight competitive use *for* the cards they
own, without adding any new admin/attendance data entry and without
attendance-guessing ("will they show up this week?") as the object of play.

Rough shape discussed, none of it committed:

- Each member may assemble a squad of 5 owned cards, one slot per distinct
  real Player (no duplicate-player stacking within a squad — though owning
  duplicates stays fine and is even encouraged as collecting flavor, per
  Part 3.4's "why do you own eleven copies of Dennis" story goal).
- Squad power derives entirely from existing Live OVR — no new stats and no
  admin entry beyond what `publish_attendance_session` already records
  (attendance + optional goals).
- Sunday night, gated on the same "was a session published this football
  week" rule Part 9 already defines (skip cleanly if not, same as activity/
  form decay already does), squads feed into a single-elimination knockout
  bracket, seeded by power, with byes for non-power-of-two fields.
- Each matchup resolves via a power-weighted probability rather than a coin
  flip or a certainty — exact formula not chosen, and it needs the same
  deterministic, testable, pure-function treatment `pack_economy_health` got
  in ADR-015 before it's allowed to affect real people's squads. Odds would
  be published per round, not just once, so Sunday night has several reveal
  moments instead of one static percentage.
- Reward starts as bragging rights / a badge only, deliberately avoiding any
  currency or pack payout until the mechanic is validated as fun — a payout
  version would need the same ledger-backed, security-definer treatment as
  `open_pack` / `buy_listing` (ADR-010, ADR-014, ADR-016), which is real
  scope, not a UI afterthought.

Open questions nobody has answered: minimum-entrant threshold before a
week's tournament runs at all; whether a currency reward gets added later
and if so how; the exact power-weighting formula; whether seeding uses total
or average XI OVR. This is recorded here only so the brainstorm isn't lost —
it is not scoped, not prioritized, and not a plan to build.

## Speculative idea — player of the week vote (not decided)

Status: Half-baked — brainstormed only, not scoped, not an ADR.

Another route for a player's cards to improve, alongside attendance and Live
OVR: a weekly peer vote for the top 3 players of the week, giving members a
say in the card economy without any new admin data entry.

Rough shape discussed, none of it committed:

- Voting window opens Friday 21:00 and closes Sunday 23:59 (same football-week
  framing Part 9 already uses; skip cleanly on weeks with no published
  session, like activity/form decay does).
- Each member picks 3 distinct players for the week and cannot vote for
  themselves.
- Voting pays a small coin reward — a currency payout, so it needs the same
  ledger-backed, security-definer treatment as `open_pack` / `buy_listing`
  (ADR-010, ADR-014, ADR-016), plus an anti-abuse rule so voting isn't a
  free coin faucet (e.g. only counts once the ballot has 3 valid picks,
  one reward per member per week).
- After close, the 3 players with the most votes get an extra boost to their
  cards — magnitude, stacking with Live OVR, and decay all unspecified, and
  it needs the deterministic, testable, pure-function treatment
  `pack_economy_health` got in ADR-015 before it touches real cards.

Optional extra: the single top-voted player gets an "In Form" special-edition
card. Mechanics unworked — would lean on the frozen-snapshot Special card
model (ADR referenced around card snapshots / Part 3.4), one per week,
supersedes the previous week's In Form card or coexists as a collectible.

Open questions nobody has answered: the boost formula and how long it lasts;
tie-breaking for 3rd place; minimum-turnout threshold before the boost
applies at all; whether votes are public or secret; how the "In Form" card is
minted, owned, and expired; abuse vectors (collusion, vote-trading).
Recorded here so the brainstorm isn't lost — not scoped, not prioritized,
not a plan to build.

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

Decision: KUT has one active MVP pack definition, TFH Pack (250 KUT Coins,
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

## ADR-022 - Chrome palette derived from card rarity tiers, not stock Tailwind swatches

Date: 2026-08-17

Status: Accepted

Decision: The player card was redesigned as "Clubblad" — a Panini-style
sticker-album card (paper background per rarity tier, a corner pennant badge
carrying tier as colour + shape + word, a taped photo mount, an illustrated
jersey fallback with initials when there is no player photo). The app's
surrounding chrome then adopted a token set derived from that same card
palette instead of Tailwind's default `slate-*`/`amber-*`/`cyan-*`/
`emerald-*`/`rose-*` swatches, which had been used ad hoc across ~40 files.
New Tailwind v4 `@theme` tokens (`board`, `panel`, `panel-2`, `line`,
`ink`/`ink-dim`/`ink-faint`, `brass`, `steel`, `moss`, `brick`, `warning`,
each with `-bg`/`-line` companions where needed) live in
`src/app/globals.css`. `--color-board` is literally the Elite pennant's hex
value; `--color-brass` and `--color-steel` are drawn from the Gold and
Silver pennants.

Reason: the card face and the surrounding app chrome had drifted into two
unrelated palettes — a warm paper card sitting on a generic dark-SaaS shell.
The user asked for one cohesive visual identity; pulling the chrome's colours
from the card's own tiers was a more specific, less generic choice than
picking a new brand palette from scratch, and it keeps the whole system
self-consistent (comparing colours across pages against a fixed set of six
already-designed tiers, rather than inventing new ones).

Consequences: new UI should reach for these tokens (`bg-board`, `text-brass`,
`border-line`, etc.) instead of raw Tailwind colour swatches. The chrome
migration was mechanical — a scripted `\b<old>\b` regex substitution across
every `.tsx` file under `src/`, then hand-reviewed — and surfaced a few real
bugs worth remembering: `amber-950` had been used both as a shadow tint and
as a solid badge background and could not collapse to a single token; a
fourth "Warning" severity tier on the admin economy page used `orange-*`,
which had no established mapping and needed the new `warning` token; two
files (the pack-opening button, the pack-reveal header) had hardcoded
gradient hex values the regex could not reach and were fixed by hand. Two
sketch rounds (five initial card directions, then three more ambitious
card redraws addressing "the no-photo jersey doesn't read as a jersey" and
"stats don't pop") were shown to the user as throwaway HTML artifacts before
any code changed; the user picked Clubblad for the base card and declined all
three redraws, keeping the shipped card as-is.

## ADR-023 - Connect the Vercel project to its GitHub repository

Date: 2026-08-17

Status: Accepted

Decision: The `kut` Vercel project was linked to `VibeTrunk/kut` via
`vercel git connect`, so pushes to `main` build and deploy automatically.

Reason: The project had been deployed only by manual `vercel --prod` runs
at initial setup; it had no Git integration. ADR-022's chrome redesign was
merged to `main` and passed CI (`database`, `e2e`, `fast`, `scan`) but was
never actually deployed - `kut.vibetrunk.com` kept serving the pre-redesign
build for hours with no error or signal anywhere in GitHub or Vercel that a
deploy hadn't happened. A manual `vercel --prod` was run once to ship the
already-merged redesign immediately.

Consequences: Future pushes to `main` should deploy without a manual CLI
step. This was not yet confirmed end-to-end with a real push at the time of
writing - worth a sanity check (e.g. a GitHub deployment/check entry
appearing) on the next commit. If it silently doesn't trigger, fall back to
manual `vercel --prod` and re-investigate the Git connection.

**Confirmed 2026-08-18:** the push of this very ADR's commit
(`98f06b3`) produced a `Production` deployment (Vercel dashboard
`id 5952002745`) tagged with the Git-commit source icon, distinct from the
`>_` CLI-source icon shown on every earlier manual `vercel --prod` deploy in
the same list. The GitHub commit status API independently shows a matching
`Vercel` / `success` status on that sha. Auto-deploy on push to `main` is
confirmed working end-to-end; no further manual `vercel --prod` step is
needed for ordinary merges.

## ADR-024 - Raise the weekly first-appearance activity bonus from 8 to 14

Date: 2026-08-18

Status: Accepted

Decision: `ACTIVITY_FIRST_APPEARANCE` (BUILD_SPEC.md Part 11 / Part 145) is
raised from `8` to `14`. `ACTIVITY_SECOND_APPEARANCE` (`3`), the weekly decay
(`0.90`), the activity-OVR curve (floor `30`, range `45`, exponent `0.80`),
and the Live OVR ceiling (`83`) are all unchanged. Updated in three places
that must stay in sync: `docs/BUILD_SPEC.md` Parts 11, 11.2, and 145;
`src/game/config.ts`; and the SQL rebuild formula (currently only in
`supabase/migrations/20260818000000_initial_tfh_roster_and_august_sessions.sql`'s
`kut._rebuild_season_core`, since that migration was still unapplied to
hosted at the time of this change — see that migration and ADR "Initial TFH
roster" entry in `docs/PROGRESS.md`). `tests/fixtures/rating-scenarios.json`
was recalculated for the five affected scenarios.

Reason: After importing real August 2026 attendance (`docs/PROGRESS.md`,
"Initial TFH roster and August 2026 attendance backfill"), the user felt a
single match had too small an effect on a card's rating — the most active
player in five weeks of real data was only 45 OVR (Bronze). Four candidate
tweaks were simulated and shown to the user (bigger bonus, slower decay, a
blend, and a moderate bonus); the user picked the most aggressive option: the
single-match jolt, at its exact previewed value of `14` (keeping `+3` for a
second same-week appearance unchanged).

Consequences: A single match is now visibly worth more immediately (week-1
activity-based OVR rises from 36 to 39; see BUILD_SPEC.md Part 11.2 for the
full before/after tables). The more significant, less obvious effect: with
the original `8`/`3`
bonus, a once-a-week regular's activity score converged to a long-run ceiling
of 80 (not 100), while a twice-a-week (Monday+Friday) regular converged to
the true cap of 100 — that gap was the spec's stated mechanism for "ordinary
weekly regulars eventually become Gold; exceptionally consistent Monday +
Friday players become Holo" (Part 11.2, as originally written). At `14`/`3`,
a once-a-week regular's steady state is also 100 (140 uncapped, clamped to
100) — the same ceiling as a twice-a-week regular, reached in about 12 weeks
instead of about 8. Once both are capped, activity alone no longer separates
a once-a-week player from a twice-a-week peer; only form (goals) can. This
was explained to the user as a tradeoff of the chosen option before they
picked it, and BUILD_SPEC.md Part 11.2 now documents it directly rather than
carrying the old, now-inaccurate "Gold vs Holo" narrative. If this
plateauing-together effect turns out to be undesirable once the real
attendance data has grown for a full season, revisit toward one of the other
three simulated options (moderate bonus, slower decay, or a blend) instead of
raising `ACTIVITY_FIRST_APPEARANCE` further, since higher values compress the
time-to-cap even more without restoring the once/twice-per-week distinction.

## ADR-025 — Server-authoritative admin add-player RPC

Date: 2026-08-29

Status: Accepted

Decision: `kut.admin_add_player(p_display_name, p_archetype, p_full_name)` is
the sole roster-add path. It is a `security definer` function, executable by
any authenticated caller but gated internally by `kut.is_admin()` (the same
shape as `correct_published_attendance_session` and the other admin RPCs). In
one transaction it inserts the `kut.players` row (deriving a unique slug from
the display name, suffixing `-2`, `-3`, … on collision), mints the player's
`live` `card_editions` row, and — if a season is active — runs
`kut._rebuild_season_core` so the new player has a baseline
`player_season_state` row immediately. A matching `/admin/roster` UI (route +
server action, both re-checking `requireAdmin()`) lists the roster and hosts
the add form. This replaces the migration-per-roster-change workflow for
incremental additions.

Reason: Weekly roster growth (a new TFH member turns up twice) should not
require a shared-database migration, a `VibeTrunk/supabase` PR, and the
ADR-021 hosted-push ceremony every time. Edition minting plus the rating
rebuild must stay atomic and must use the one canonical formula
(BUILD_SPEC.md Part 10) — hence a single RPC that does all three steps rather
than a direct browser insert against `kut.players` (which RLS would actually
permit for an admin, but which would skip the edition and the rebuild).

Consequences: A new Live edition enters the pack pool the moment the player is
added — expected, and identical to what the roster migrations already did. A
brand-new player sits at 30 OVR / `common` until their first published
attendance moves the rating normally. Duplicate display names are allowed
(only `slug` is unique → `steffen`, `steffen-2`); this is the deliberate "two
Nicks" escape hatch, and the UI warns but does not block. Out of scope as
explicit follow-ups: editing a player (rename, change archetype, set
`photo_path`), the `is_active` toggle, and merging duplicates — there is still
no UI for any of those. Bulk historical import stays a migration (BUILD_SPEC.md
Part 137).

## ADR-026 — Removing a player is a soft deactivate, with a narrow hard delete for never-used entries

Date: 2026-08-29

Status: Accepted

Decision: `/admin/roster` gets two more server-authoritative paths, both
`security definer` and gated by `kut.is_admin()` like `admin_add_player`:

- `kut.admin_set_player_active(p_player_id, p_is_active)` — flips
  `kut.players.is_active`. This is the normal "remove from the roster"
  action. A deactivated player leaves `kut.public_live_ratings` and the
  `kut.open_pack` candidate pool (both already filter `players.is_active`)
  but keeps their row, attendance history, `player_season_state`, and every
  card copy people already own. It is fully reversible from the same UI.
- `kut.admin_delete_player(p_player_id)` — a true `DELETE`, allowed only when
  the player has no `attendance`, no linked `profiles` row, no `invitations`
  row, and no `user_cards` copy of any of their `card_editions`. It also
  deletes the auto-minted Live edition and the baseline season-state row. Any
  linked record → `P0001` "deactivate instead"; a `foreign_key_violation`
  backstop catches anything the explicit checks miss.

Reason: The user asked to "remove players." The whole codebase already
treats destructive deletes as a last resort (ADR-008/009 cancel-don't-delete
sessions, ADR-013 soft card burns, `on delete restrict` on `attendance`,
`card_editions`, `invitations`). Deactivation covers the real case — someone
left the club, or was added by mistake but has since attended — without
risking economy state: their Live edition stops minting new copies, existing
copies keep working. The hard delete exists purely so a genuine typo (a
player added seconds ago, never used) can be cleaned up instead of sitting
deactivated forever; its eligibility rules make it impossible to run against
a player who is part of any history.

Consequences: "Deactivate" is the primary control and the safe default;
"Delete" is offered per-row but is disabled in the UI when the page can see
attendance or a linked account, and the RPC is the final arbiter for the
invite/owned-card cases. Deactivation does not touch existing card copies,
market listings, or pending invitations for that player — an admin resolves
those separately if needed. No rebuild runs on deactivate/reactivate (the
rating maths is unaffected; the player is simply filtered out of public
projections). Still out of scope: rename, archetype edit, `photo_path`,
`is_collectible`, and merging duplicates.

## ADR-027 — Member self-service player-card photo and archetype

Date: 2026-08-29

Status: Accepted

Decision: A signed-in member can now edit their own linked player's card from
`/settings/card`:

- `kut.set_own_player_photo(p_photo_path text)` and
  `kut.set_own_player_archetype(p_archetype text)` — both `security definer`,
  `set search_path = kut, pg_catalog`, `revoke execute from public, anon`,
  `grant execute to authenticated`; same shape as `kut.admin_add_player`
  (ADR-025) except gated on **ownership** (`kut.profiles.player_id =
  the row for `auth.uid()`, not disabled) instead of `kut.is_admin()`. A
  non-null photo path must equal exactly `players/<own-player-id>/profile.webp`.
  `set_own_player_archetype` re-runs `kut._rebuild_season_core` for the active
  season, because `player_season_state.pac..phy` are materialised at rebuild
  time (same reason `admin_add_player` rebuilds — BUILD_SPEC Part 10). These
  are the **first member write path into `kut.players`**; RLS still grants no
  direct member write on that table.
- A **private** Supabase Storage bucket `player-photos` (5 MiB;
  `image/webp`, `image/jpeg`, `image/png`) with folder-scoped RLS on
  `storage.objects`: a member may INSERT/UPDATE/DELETE only under
  `players/<their-own-linked-player-id>/*`; any enabled member may SELECT
  (the whole app is member-only, ADR-020). Object path per BUILD_SPEC §90:
  `players/<player-uuid>/profile.webp`. Private + short-lived signed URLs
  (1 h) minted server-side through one helper
  (`src/lib/player-photos.ts`) — the single place to change if the bucket is
  ever made public.
- `players.photo_path` is added to `kut.public_live_ratings` and
  `kut.my_collection_cards` (append-only via `create or replace view`), and a
  new `kut.player_directory` view (`security_invoker`, LEFT JOIN season state
  so a brand-new 30-OVR player still lists) backs the member-facing Player
  Directory at `/players` + `/players/[slug]`.
- `src/components/live-card.tsx` renders `photoUrl` as an `<img>` (was an
  inline `style={{ backgroundImage }}` that production CSP would refuse);
  `img-src` in `src/proxy.ts` gains `blob:` (crop preview) and the Supabase
  origin (signed URL).
- The six archetype slugs, previously duplicated in four places, now come from
  one module, `src/game/archetypes.ts` (`ARCHETYPES`, `ARCHETYPE_LABELS`,
  `isArchetype`); `src/game/rating-engine.ts` re-exports them and keeps
  `ARCHETYPE_OFFSETS`. No formula or `src/game/config.ts` value changed.

Reason: These are the HANDOFF "archetype / photo editing" and "member-facing
`/players` directory" follow-ups, plus the readiness-review "no in-app
explanation" gap (`/how-it-works`, shipped in the same branch). `/settings`
already promised photo uploads. Keeping members off direct `kut.players`
writes preserves ADR-002/010's server-authoritative posture.

Consequences: The hosted deploy (`20260830000000_member_self_service_and_player_directory.sql`)
is the first KUT migration that touches the `storage` schema — the ADR-021
dry-run must review the bucket insert and the four `storage.objects`
policies, and the migration role must be able to create policies on
`storage.objects` on the shared project. The member-only Live Ratings
projection now carries `photo_path` (still member-only). A member can trigger
a full-season rebuild by toggling their archetype; trivially cheap at ~25
players, but a per-member cooldown is the noted lever if it is ever abused.
Rollback DDL is captured verbatim in the migration header. Still out of
scope: player rename, `is_collectible`, merging duplicates, and the
directory does not show which member claimed a player.

## ADR-028 — Username sign-up, admin account⇄player linking, attendance-reward inbox messages

Date: 2026-08-29

Status: Accepted

Decision: three related changes, migration
`20260831000000_admin_links_username_and_attendance_messages.sql`.

**1. Members sign up with a username, not an email.** `kut.profiles` gains a
`username text unique` column (`^[a-z0-9_]{3,30}$`, stored lower case). Supabase
Auth still needs an address, so `src/lib/auth/username.ts` maps a username 1:1
to a synthetic address on the non-routable domain `users.kut.local`
(`usernameToEmail`). No mail is ever sent there — accounts are created with
`email_confirm`, and recovery stays admin-assisted (ADR-011). `claim_invitation`
gains a required `p_username` argument (the old 2-arg function is dropped) and
stores it on the profile. The **login form accepts either** a username or, for
accounts created before this change, a raw email (`loginIdentifierToEmail`:
contains `@` → use as-is, else synthesize). The username is a **login handle
only** — the public display name stays the linked player's real name, so the
leaderboard / market / directory are unchanged.

**2. An admin links / unlinks an account to a player from the UI.**
`/admin/links` (new admin tab) calls
`kut.admin_set_profile_player(p_user_id uuid, p_player_id uuid)` — `security
definer`, gated by `kut.is_admin()` (same shape as `admin_add_player`). It
validates the player exists and is not already linked to a different account
(`profiles.player_id` is unique), then sets `profiles.player_id` (null =
unlink). Linking is **forward-only**: it does **not** back-pay attendance
rewards for the player's sessions before the link. Invite-claim still
auto-links from the invitation; this is for corrections.

**3. Attendance rewards write a dated inbox message.**
`kut.grant_attendance_rewards` now also inserts a `user_notifications` row
(`event_type = 'attendance_reward'`, `reference_id = session_id`, so the
existing once-per-(user,event,ref) unique index makes it idempotent like the
reward itself) reading *"You received N KUT Coins for attending the session on
DD Mon YYYY."* The migration backfills one message per already-granted reward
using the amount actually credited. The reward amount was **raised from 75 to
250 in the same migration** (see ADR-029) — it lives as a single `v_amount`
constant in the SQL and mirrors `ECONOMY.attendanceCoinReward` in
`src/game/economy.ts` (BUILD_SPEC Part 145).

Reason: the group wants members to pick their own handle rather than share an
email, wants a way to fix a wrong or missing account↔player link without a
migration, and wants attendance coins to be visible in the inbox the same way
market events already are (ADR-019).

Consequences: `users.kut.local` addresses are non-routable by design; if a
real mail path is ever wanted, migrate usernames to real addresses rather than
relying on that domain. The login field now says "Username" with a hint for
legacy email accounts. `claim_invitation`'s signature changed, so its one
pgTAP call and the invite server action were updated. The attendance-reward
message is idempotent and safe across publish / correct / reactivate.

## ADR-029 — Attendance reward raised from 75 to 250 KUT Coins

Date: 2026-08-29

Status: Accepted

Decision: `ATTENDANCE_COIN_REWARD` goes from `75` to `250`. Changed in three
places that must stay in sync: `kut.grant_attendance_rewards`'s `v_amount`
constant (in migration
`20260831000000_admin_links_username_and_attendance_messages.sql`, alongside
the inbox-message change from ADR-028), `ECONOMY.attendanceCoinReward` in
`src/game/economy.ts`, and `docs/BUILD_SPEC.md` Parts 24 and 145. The
`/how-it-works` page reads the constant, so its copy updates automatically.

Reason: at 75, a match was worth less than a third of a pack (250) and the
economy leaned almost entirely on discard + market churn; the club wanted
showing up to be the clearly dominant coin source. 250 makes one attended
session fund one pack.

Consequences: **not retroactive.** The migration only redefines the function;
it does not re-run the reward loop, and already-granted rewards keep the
amount they were credited (backfilled inbox messages report that historical
amount via `wallet_ledger.amount`). So on hosted, past August sessions stay at
whatever was granted then (0 for accounts that weren't linked yet, since
linking is forward-only per ADR-028); every session published or corrected
after this deploys pays 250. This roughly triples the main coin faucet — watch
the admin economy dashboard's coin-supply and pack-purchase numbers over the
first few weeks and revisit (pack price, tax, or this value) if wallets
inflate faster than packs and market tax drain them. Starter grant (250) and
pack price (250) are unchanged.

## ADR-030 — Admin account management (disable / delete) and a members-only leaderboard

Date: 2026-08-29

Status: Accepted

Decision: migration `20260901000000_admin_manage_accounts_and_leaderboard.sql`.

- **`kut.club_value_leaderboard` shows `role = 'user'` accounts only.** Admin /
  superadmin accounts no longer appear in the public rank (an admin still sees
  their own numbers on `/club` — `my_club_value` is unchanged). `rank` comes
  back null for an admin, and Home / `/club` already hide the rank chip when
  it is null.
- **`kut.admin_set_account_disabled(uuid, boolean)`** — soft, reversible.
  `security definer`, `is_admin()`-gated. A disabled account cannot sign in
  (`requireUser`/`requireAdmin` already check `is_disabled`) and drops out of
  the leaderboard. Cannot target yourself or a superadmin; only a superadmin
  may disable another admin (mirrors ADR-011's password-reset rules).
- **`kut.admin_prepare_account_deletion(uuid)` + `service.auth.admin.deleteUser`**
  — permanent. The RPC authorizes (same self / role rules), **refuses if the
  account has any completed `market_sales`** (irreversible cross-member
  history — disable those instead, `P0001`), then deletes the `ON DELETE
  RESTRICT` rows that would block removal (`market_listings`,
  `pack_opening_cards`, `pack_openings`, `attendance_rewards`,
  `password_reset_events`, and the consumed `invitations` row). The server
  action then calls the Auth admin API to delete `auth.users`, which cascades
  `profiles` → `wallets`, `wallet_ledger`, `user_cards`, `user_notifications`.
  If the Auth delete fails after cleanup, the action falls back to disabling
  the account.
- **`/admin/links` redesigned** from a `<table>` (which overflowed
  horizontally) into a wrapping card list, and now also carries the
  disable/enable and delete controls. It loads all profiles including
  disabled ones. Moderation buttons are hidden client-side for ineligible
  targets; the RPCs are the final arbiter.

Reason: the club wants a hard-delete for abandoned / test / mistaken
accounts, a reversible disable for real accounts that misbehave, and doesn't
want admin accounts cluttering the competitive leaderboard.

Consequences: hard delete is deliberately narrow — most real members will
have traded and can only be disabled, which is the safer outcome anyway
(their economy history stays intact). The delete cleanup is not atomic with
the Auth API call (same shape as the password-reset flow); a mid-failure
leaves a cleaned-but-still-present account that the fallback disables.

## ADR-031 — Weekly rating snapshots, Home "Top risers", and a cosmetic starter-pack reveal

Date: 2026-08-30

Status: Accepted

Decision: migration `20260902000000_starter_reveal_and_rating_snapshots.sql`,
plus front-end changes. Three related pieces:

**1. Weekly rating snapshots + `kut.top_risers`.** `kut.player_rating_snapshots`
`(player_id, season_id, week_start)` stores one `live_ovr` / `rarity_tier` row
per player per published football week. It is populated by an `after insert or
update` row trigger on `kut.player_season_state`
(`kut.capture_rating_snapshot`), keyed on `new.last_week_start` — so **every**
rebuild path (publish / correct / cancel-reactivate / `admin_add_player` /
`set_own_player_archetype`) captures a snapshot without editing
`kut._rebuild_season_core` and re-stating the ADR-024 rating formula. Multiple
rebuilds inside the same football week overwrite the same row, so the prior
week's row — and the delta Home shows all week — is stable even when a member
self-serves an archetype change. `kut.top_risers` (`security_invoker`) diffs
the two most recent snapshot weeks of the active season and returns only
`ovr_delta > 0`, ordered by delta. The migration seeds the current week from
`player_season_state`; deltas therefore only appear after the **next** publish
creates a second snapshot week (Home shows an explanatory empty state until
then). This is the BUILD_SPEC §47 "biggest current player movers if historical
snapshots exist" widget.

**2. Home stops being the de-facto full roster.** `src/app/(app)/page.tsx` now
renders the top 5 `top_risers` (each a `LiveCard` with a new optional
`trend` prop → a "▲ +N OVR this week" pill, per BUILD_SPEC §48's "optional
trend arrow") and links to `/players` for the full directory, instead of the
entire `public_live_ratings` grid. Closes the HANDOFF Phase D item 4 follow-up.

**3. Cosmetic starter-pack reveal at `/welcome`.** The starter grant stays
automatic inside `claim_invitation` (unchanged). A new
`kut.profiles.starter_opened_at` (backfilled `= starter_claimed_at` for
existing members, so only brand-new accounts are affected) gates a member:
`getNavContext` redirects any member with `starter_claimed_at` set and
`starter_opened_at` null to a full-screen `/welcome` (a top-level route,
outside the `(app)` nav chrome). Pressing "Open your starter pack" calls
`kut.mark_starter_opened()` — which stamps `starter_opened_at`, and as a
legacy safety-net grants the starter first if `starter_claimed_at` was somehow
still null (this replaces the deleted homepage `StarterClaimForm`) — then plays
the reveal animation over the already-granted cards.

**4. Shared pack-opening animation.** `src/components/pack-reveal.tsx` (pure
state machine in `pack-reveal-state.ts`) animates the BUILD_SPEC §49 sequence
(rarity clue → OVR → identity → next → summary) with tap-to-skip, "Skip all",
and a `prefers-reduced-motion` instant summary. Used by both `/welcome` and the
bought-pack reveal at `/club/packs/[openingId]` (previously a static grid).
`kut.my_pack_opening_results` gained `players.photo_path` so revealed cards
show photos.

Reason: first-tester feedback — Home was an undifferentiated wall of ~25 cards
with no "what changed?", new members got their starter silently with no
moment, and there was no pack-open animation at all despite the spec
describing one in detail.

Consequences: the reveal is deliberately **theatre** — the coins and cards are
real and already granted before `/welcome` renders, so a member who never
logs in still has their starter; `/welcome` only marks that they have seen it.
`top_risers` needs two published football weeks of snapshot history before it
shows anything; the migration cannot backfill prior weeks (the fold is not
re-run), so on hosted deploy the widget is empty until the first post-deploy
session publish. The snapshot trigger adds one lightweight upsert per player
per rebuild (~25 rows). Deployed to hosted 2026-08-30 via the ADR-021
`VibeTrunk/supabase` workflow (`VibeTrunk/supabase` PR #9 catalogued it,
`verify-catalog.ps1` "matches 34"; PR #10 flipped the ledger to applied) —
see `docs/PROGRESS.md`. Rollback DDL is in the migration header.

## ADR-032 — Risk-tiered hosted migration process

The pre-ADR-021 / early-`docs/OPERATIONS.md` process treated every hosted
migration identically: fresh encrypted backup, restore-drill verification,
full `verify:full`, catalogue parity, dry-run, sign-off. On the shared
project's plan there is no PITR and no managed backup (`docs/BACKUP.md`), so
some of that is genuinely load-bearing — but applied to every migration it
made even a one-line `create or replace` a ~1-hour ritual, which is a real
disincentive to shipping small fixes during the alpha.

Decision: classify each migration as **additive** (new object, `create or
replace`, new nullable/defaulted column, new index/enum value — nothing
existing rewritten) or **data-changing** (backfill, drop/retype, rating
rebuild, or any change to wallet/ledger/card/market semantics), and run the
matching checklist in `docs/OPERATIONS.md`. Both tiers keep the cheap
high-value steps: catalogue parity, line-by-line `db push --dry-run`,
`verify:fast` + `test:db` locally (full `verify:full` moves to CI-before-merge
only), and explicit sign-off. Only the data-changing tier requires a **fresh**
backup immediately before the push and a best-effort SQL-reversible migration
shape; the additive tier rides on the most recent **scheduled** backup. The
restore drill becomes periodic (before first invite, then ~monthly or on
significant schema-shape change) rather than per-migration.

Reason: process-design review during the tester-feedback batching
(`docs/TESTER_FEEDBACK_BATCHES.md`). The user declined Supabase Pro (which
would have added PITR and made most of this moot), so the trim keeps the steps
that actually protect irreplaceable small-scale user data and drops the ones
that were re-doing one-time work (restore drills) or running slow suites
(e2e + build) locally on every change.

Consequences: additive migrations go from a ~1-hour ritual to ~10–15 min
(parity + dry-run + the two-repo PR hop + merge). Data-changing migrations
stay ~25–35 min. Accepted residual risk: an additive migration that breaks in
a way a follow-up migration cannot cleanly fix falls back to the last
scheduled backup, losing anything since — bounded small as long as the backup
cadence stays tight (at least weekly once members trade, per `docs/BACKUP.md`).
No code or schema change; `docs/OPERATIONS.md` and `docs/BACKUP.md` updated to
match.

## ADR-033 — Retire the untradeable concept; every card is tradeable and discardable

Date: 2026-08-30

Status: Accepted

Decision: the `is_tradeable` distinction is removed entirely (tester feedback
#9, Batch B in `docs/TESTER_FEEDBACK_BATCHES.md`). Migration
`20260903000000_drop_is_tradeable.sql` drops `kut.user_cards.is_tradeable` and
recreates every object that referenced it with the guard/field gone:
`grant_starter_pack` and `open_pack` mint plain copies; `discard_card` loses
its `if not v_card.is_tradeable` gate; `get_listing_bounds`, `create_listing`,
and `buy_listing` lose the `and is_tradeable` predicate on their owned-card
lookups; the `kut.my_collection_cards` view drops the column (a `drop view` +
`create view`, since `create or replace view` cannot remove a column). Nothing
in the schema reads that view, so the drop/recreate is contained.

The product question — a brand-new player can now immediately sell or discard
all three starter cards (starter wallet 250 + 3× discard value, instantly
liquid), which the starter lock existed to prevent — was put to the user, who
chose **full removal** with no softer rule (no starter hold, no
discardable-but-not-tradable middle state). The user also chose the **drop the
column** option over the smaller "keep it, force it true" change.

Card copies are still protected from a burn while they carry an active market
listing (the `user_cards_prevent_burning_listed_card` trigger, ADR-016) and a
copy still needs a resolvable rating to be discarded or listed — those are the
only remaining eligibility rules, and they apply uniformly to every source.

Reason: testers read "Locked" / "Tradeable" badges, a collection subheader
counting "N tradeable · N locked", a card-detail "Ownership" tile, and a
"Starter cards are locked" explainer as a bug or an unexplained restriction.
The "Live edition" label half of finding #9 was already handled in Batch A
(PR #14). The economy team accepts the starter-liquidation consequence: the
starter grant is a one-time 250 + 3 cards regardless, and a player who dumps
it immediately simply starts from ~250–300 coins and an empty collection,
which self-corrects through packs and attendance rewards (250/session,
ADR-029).

Consequences:

- **Spec changes** (required by CLAUDE.md for a game-rule / invariant change):
  `docs/BUILD_SPEC.md` §20 "Tradeability" is rewritten to record the removal;
  the `is_tradeable` line is struck from the `user_cards` schema block; the
  "mint 3 untradeable Card Copies", "card tradeable/eligible", "3 untradeable
  cards", "3 distinct untradeable starter cards", "own-special untradeable
  grant" phrasings are de-flagged; the acceptance criteria "starter cards
  cannot be discarded" and "market cannot transfer untradeable card" are
  removed; the Part L regression-checklist invariant #20 "Untradeable card
  cannot enter the market" becomes "Card ownership changes only through a
  server-authoritative `buy_listing` transaction."
- **Tests**: `phase_1a_roster.test.sql` loses the three now-obsolete negative
  starter assertions (`plan(166)` → `plan(163)`) and the `is_tradeable`
  column refs in its fixtures; `member_admin_links.test.sql`,
  `starter_reveal_and_movers.test.sql`, and `tests/integration/market-race.test.ts`
  drop `is_tradeable` from their `user_cards` inserts.
- **Rollback**: data-changing tier (ADR-032) — a fresh backup is taken
  immediately before the hosted push. The migration header carries the
  reverse DDL; every surviving row was `is_tradeable = true`, so re-adding the
  column `boolean not null default true` and re-applying the prior function
  bodies is lossless.
- Hosted deploy is a separate step via `VibeTrunk/supabase` (ADR-021); never
  `supabase db push` from this repo.

## ADR-034 — "KUT Coins" is the canonical currency name

Date: 2026-08-31

Status: Accepted

Decision: the game currency is **"KUT Coins"** everywhere — UI, SQL (error
strings and notification bodies), spec, and docs. Singular is **"KUT Coin"**.
The build spec's old working name "TF Coins" is retired (tester feedback #7,
Batch C in `docs/TESTER_FEEDBACK_BATCHES.md`). The user confirmed the exact
name and chose a short **"KUT"** ticker (not the full "KUT Coins") for the one
narrow unit label on the leaderboard's value column.

The visible front-end had already been swept to "KUT Coins" (the 2026-08-17
alpha-readiness entry + Batch A / PR #14). Batch C closes the three remaining
server-side leaks and realigns the half-migrated spec:

- **`kut.user_notifications.body`** for `market_purchase` / `market_sale` rows
  read "… for N TF Coins." / "… You received N TF Coins after tax." and render
  verbatim on `/messages`. Migration `20260904000000_canonical_coin_name.sql`
  `create or replace`s `open_pack` + `buy_listing` (latest bodies from
  `20260903000000`) with "TF Coins" → "KUT Coins" in the two `format()` bodies,
  then a one-shot `update kut.user_notifications set body = replace(body, 'TF
  Coins', 'KUT Coins') where event_type in ('market_purchase','market_sale')
  and body like '%TF Coins%'` to fix the rows already on hosted (backfilled
  once each by `20260817020000` / `…020100`).
- **RPC error strings** — `raise exception 'insufficient TF Coins for this
  pack'` (`open_pack`) and `'… for this listing'` (`buy_listing`). Not
  user-visible today (`actions.ts` catches and rewrites to a "KUT Coins"
  message) but wrong; fixed in the same `create or replace`.
- **Leaderboard** — `leaderboard/page.tsx` rendered `{value} TF`; now `{value}
  KUT`.
- **Spec** — the `**TF Coins**` glossary entry is reframed to `**KUT Coins**`;
  `docs/BUILD_SPEC.md` L891 / L919 / L937 / L3556 and `docs/decisions.md`'s
  ADR-014 pack-definition line and `README.md`'s My Club paragraph updated.
  Dated historical `docs/PROGRESS.md` lines are left as written.

Reason: a tester saw "TF Coins" in their Message Center inbox while every other
surface said "KUT Coins". ADR-028/029 had already put "KUT Coins" into spec
Parts 24 / 145 / 942, so the doc was internally inconsistent.

Consequences: **display-only.** No economy value, ledger `reason` value, column
name, price, or formula changes — the Part L invariants are untouched, so this
is not a game-rule change beyond the naming realignment recorded here and in
the spec. Tier: **data-changing** (ADR-032) purely because of the one backfill
`UPDATE`; a fresh backup is taken immediately before the hosted push, the
catalogue's `verify-catalog.ps1` is extended for the new file, and the
migration is trivially SQL-reversible (`replace()` back, scoped to the same
`event_type`s — `attendance_reward` bodies already said "KUT Coins" and are
excluded both ways). Hosted deploy is the separate `VibeTrunk/supabase`
ADR-021 step; never `supabase db push` from this repo. Bundled with tester
feedback finding #11 (the authenticated Home now shows the expanded name
"Kelderklasse Ultimate Team" once, under the "This week in KUT" heading) —
front-end only, no migration.

## ADR-035 — Admin coin faucet + soft account reset

Date: 2026-08-31

Status: Accepted

Decision: two `is_admin()`-gated, `security definer` economy tools for `/admin`,
plus one audit table and one widened check constraint. Migration
`20260905000000_admin_economy_tools.sql` (tester feedback #8 + #6, Batch D in
`docs/TESTER_FEEDBACK_BATCHES.md`).

**1. `kut.admin_adjust_wallet(p_user_id uuid, p_amount bigint, p_reason text)`
— an audited coin faucet.** Before this, an admin could only mint coins by
publishing attendance. It credits (`+`) or claws back (`-`) KUT Coins in one
transaction: a `wallet_ledger` row (new `reason` value `'admin_grant'`), the
wallet update, a `kut.admin_account_events` audit row, and an `admin_notice`
inbox message ("An admin adjusted your wallet by ±N KUT Coins. Reason: …").
Guards: both directions allowed; `abs(p_amount)` capped at `100000` (raises
`22023`, mirrored by `ECONOMY.adminWalletAdjustMax` in `src/game/economy.ts`);
a result below zero raises `P0001` (invariant #4 never violated); a typed
`p_reason` of 1–200 chars is required; not self, not a superadmin target, and
only a superadmin may adjust an admin's wallet (mirrors
`admin_set_account_disabled`, ADR-030).

**2. `kut.admin_reset_account(p_user_id uuid, p_idempotency_key uuid)` — a soft
club reset that works even after the member has traded.** `admin_prepare_account_deletion`
refuses any account with `market_sales` rows (ADR-030) and hard delete is the
only other "start over" path; this wipes the member's economy state while
keeping their login and the cross-member trade history. In one transaction it:
cancels the member's active listings; **burns** (soft `burned_at`, not deletes)
every owned Card Copy — `ON DELETE RESTRICT` from `pack_opening_cards` /
`market_listings` / `market_sales` makes delete impossible for any card ever
listed or sold, and burn is uniform and keeps history; deletes the member's
`pack_opening_cards` + `pack_openings` and all their `user_notifications`;
zeroes the wallet **without deleting ledger rows** (immutable, invariant #5 /
ADR-010) — one compensating `-(balance)` entry then a fresh `+250`, both
`reason 'admin_reset'`, net balance `250`; re-grants the standard starter
inline (250 + 3 random Live editions, no dup — the same select
`grant_starter_pack` uses; **not** a call to it, which would raise `P0001` on
the retained `starter_claimed_at`); nulls `starter_opened_at` (keeps
`starter_claimed_at`) so `getNavContext` replays the cosmetic `/welcome`
reveal over the fresh cards (ADR-031); and writes an `account_reset` audit row
+ an `admin_notice` ("Your KUT club was reset by an admin…"). Idempotent: the
audit row's `detail->>'idempotency_key'` (with a partial unique index) plus the
`profiles` row `FOR UPDATE` lock make a repeat key return the first result with
no second burn/grant (same pattern as `open_pack` / `discard_card`). Same
guardrails as #1 (not self, not superadmin, only-superadmin-resets-admin).

**`attendance_rewards` guard rows are kept, not deleted.** Deleting them would
let a later correction/reactivation of a past session re-pay the member,
violating invariant #9. The coins are already removed by zeroing the wallet;
the `(session_id, player_id)` rows must stay. `market_sales` and the market
`wallet_ledger` entries are likewise kept — they are cross-member history.

**Invariant #8 carve-out.** Part L §162 #8 "Starter grant happens at most once"
is reworded to "…at most once per account, **except an explicit audited admin
reset (ADR-035)**". Invariants #4, #5, #9 stay literally true — that is exactly
why the reward rows are kept and the ledger is append-only here.

**3. `kut.admin_account_events`** `(id, target_user_id, actor_id, action check
in ('wallet_adjust','account_reset'), amount bigint, reason text, detail jsonb,
created_at)` — admin-read RLS like `kut.password_reset_events`; rows written
only by the two RPCs (security definer, bypassing RLS).

**4. `wallet_ledger.reason` check widened** with `'admin_grant'` and
`'admin_reset'` — a new allowed check value, so **additive** per
`docs/OPERATIONS.md`. `user_notifications.event_type` already allows
`'admin_notice'` — unchanged. `docs/BUILD_SPEC.md` §58's illustrative
`ledger_reason` list gains both values; Part 24 §928 gains an "Admin
adjustment" coin source; Part 125's (spec'd-but-unbuilt) per-reason breakdown
note gains the two reasons — `kut.pack_economy_health` has no per-reason split
today, so the faucet flows into `total_coin_supply` automatically.

Reason: testers asked for an admin to be able to hand out / correct coins, and
to be able to reset a member's club after they had traded (the existing hard
delete refuses traded accounts and throws away the login too).

Consequences: tier is **additive** (ADR-032) — the migration is all `create
table` / `create or replace function` / one widened check; it mutates no
member rows (the reset does that at run time). Rides the last scheduled backup;
no fresh pre-push backup. SQL-reversible: `drop function` / `drop table` /
restore the narrower check (the migration is inert on hosted until the separate
`VibeTrunk/supabase` push, so no `admin_grant` / `admin_reset` rows exist at
rollback time). UI: both controls are per-account rows on `/admin/links` (tab
relabelled "Account links" → "Accounts", and the old "Accounts" password tab →
"Recovery"). Between the KUT merge and the hosted push the two new buttons
return an RPC-not-found error if used — do the push promptly. Hosted deploy is
the additive path in `docs/OPERATIONS.md` via `VibeTrunk/supabase` (ADR-021);
never `supabase db push` from this repo.

## ADR-036 — Goalkeeper archetype (seventh offset profile)

Date: 2026-08-31

Status: Accepted

Decision: KUT gains a seventh archetype, **Goalkeeper** (slug `goalkeeper`,
label "Goalkeeper"). It **reuses the six shared attributes**
(PAC/SHO/PAS/DRI/DEF/PHY) with its own offset row — it is **not** a distinct
DIV/HAN/REF stat set (BUILD_SPEC §585 already said "MVP does not need separate
goalkeeper statistics"; a distinct set would rewrite `live-card.tsx` and every
attribute projection). The offsets are a shot-stopper — strong DEF/PHY, weak
SHO/DRI — and **sum to exactly 0** like the other six (§589, "no large hidden
OVR advantage"):

```text
PAC -6   SHO -12   PAS 0   DRI -8   DEF +14   PHY +12     (sum 0)
```

Changed in the places that must stay in sync: `src/game/archetypes.ts`
(`ARCHETYPES`, `ARCHETYPE_LABELS`), `src/game/rating-engine.ts`
(`ARCHETYPE_OFFSETS.goalkeeper`), `docs/BUILD_SPEC.md` §585 + §15.1, and
migration `20260906000000_goalkeeper_archetype.sql`, which widens the
`kut.players` archetype `check`, `create or replace`s `kut.admin_add_player`
and `kut.set_own_player_archetype` with `goalkeeper` in their allow-lists, and
`create or replace`s `kut._rebuild_season_core` with a
`when 'goalkeeper' then <n>` arm on each of the six attribute `CASE`
expressions (the six `<n>` equal `ARCHETYPE_OFFSETS.goalkeeper`). The slug is
`goalkeeper`, not `keeper` — `tests/unit/archetypes.test.ts` and
`member_self_service.test.sql` both keep `"keeper"` as a bogus negative case.
Every archetype picker and validator already derives from `ARCHETYPES` /
`isArchetype`, so the admin add-player form, the `/settings/card` editor, and
the `/how-it-works` offsets table (now seven rows) pick Goalkeeper up with no
UI change.

**No player is pre-assigned Goalkeeper.** It is opt-in via the existing
self-service (`set_own_player_archetype`) and admin (`admin_add_player`) RPCs,
both of which already run `_rebuild_season_core`. Pre-assigning real keepers
would make the migration data-changing; leaving it opt-in keeps it **additive**
(ADR-032). A goalkeeper card is still driven by attendance + goals like every
other card — keepers rarely score, so their Form stays low, and that is
accepted: the card reflects turning up.

Reason: tester feedback #4 ("add a Goalkeeper archetype"). The Medium path (a
seventh offset row) was chosen over the Hard path (a separate GK stat set).

Consequences: tier is **additive** — a widened check constraint plus three
`create or replace function`s; nothing existing is rewritten and the migration
touches no member rows (the new `_rebuild_season_core` arm is inert until a
player has `archetype = 'goalkeeper'`). Rides the last scheduled backup; no
fresh pre-push backup. Rollback is only safe while no player is a goalkeeper —
DDL is in the migration header. `_rebuild_season_core` now restates the
ADR-024 rating formula for the third time (SQL, TS, and this migration's
copy); the pgTAP `phase_1a_roster.test.sql` asserts a fresh goalkeeper
rebuilds to `live_ovr 30 + {pac -6, sho -12, pas 0, dri -8, def +14, phy +12}`
and `tests/fixtures/rating-scenarios.json` carries a goalkeeper scenario for
the SQL↔TS parity suite. Hosted deploy is the additive path in
`docs/OPERATIONS.md` via `VibeTrunk/supabase` (ADR-021); never `supabase db
push` from this repo. Between the KUT merge and the hosted push, picking
"Goalkeeper" in the UI returns the RPC's "invalid archetype" error — do the
push promptly.

## ADR-037 — Bibs bonus is coins-only (100), stored on the session, forward-only

Date: 2026-08-31

Status: Accepted

Decision: the member linked to the Player who washed the bibs after a session
gets a one-off **`+100` KUT Coins** (`ECONOMY.bibsCoinBonus` /
`BIBS_COIN_BONUS`, Part 145 — meaningful, well under a session's 250 attendance
reward). **Coins only** — no rating/OVR effect (that would add a new input to
`_rebuild_season_core`, the fixtures, and Part L; punted). Batch E2, migration
`20260907000000_bibs_bonus.sql`, all additive.

**Storage.** One washer per session → a nullable column
`kut.match_sessions.bibs_washed_by uuid references kut.players(id) on delete
restrict`, not a table. Validated as null-or-(a distinct attendee of that
session) inside `kut.publish_attendance_session` /
`kut.correct_published_attendance_session` (a CHECK can't reference other
tables).

**Reward path** mirrors `kut.grant_attendance_rewards` exactly:
`kut.grant_bibs_reward(p_session_id)` (security definer) is called from
`kut.process_published_session_rewards` next to `grant_attendance_rewards`, so
it fires on publish and on the attendance churn of a correction. A
`kut.bibs_rewards` guard table — `(session_id, player_id, user_id, ledger_id,
created_at)`, PK `(session_id, player_id)`, member-reads-own / admin-reads-all
RLS — plus the unique ledger key `'bibs:' || session || ':' || washer` make it
idempotent: **at most once per `(session, washer)`**. `wallet_ledger.reason`
gains `'bibs_bonus'`; `user_notifications.event_type` gains `'bibs_bonus'` (a
distinct type, so the `(user, event_type, ref_type, ref_id)` unique key does
not collide with the washer's own `attendance_reward` row for the same
session). Inbox body: "You received 100 KUT Coins for washing the bibs after
the session on DD Mon YYYY."

**Forward-only on corrections.** If a correction names a different washer, the
new washer is paid (a fresh guard row); the previous washer **keeps** their
100 — no claw-back (Part L §162 #21, invariant #9-style). The
`correct_published_attendance_session` body sets `bibs_washed_by` *before* it
replaces the attendance, so the reward trigger sees the corrected washer.

**Signatures change.** `kut.publish_attendance_session` and
`kut.correct_published_attendance_session` each gain a trailing
`p_bibs_washed_by uuid default null`. A `create or replace` cannot widen the
argument list, so each old signature is dropped and recreated; existing
4-/5-arg callers are unaffected by the new defaulted parameter. The two pgTAP
`has_function` assertions were updated for the new arg lists.

Reason: tester feedback #5 ("bonus coins for washing the bibs, recorded with
weekly attendance"). Medium path (a coin bonus) chosen over the Hard path (a
rating/OVR effect).

Consequences: tier is **additive** (ADR-032) — new nullable column, new table,
two widened check constraints, `create or replace` / drop+recreate of
functions; no member row is rewritten and the migration grants no coins
(`grant_bibs_reward` does that at run time, only for sessions that name a
washer). Rides the last scheduled backup; no fresh pre-push backup. Rollback
DDL is in the migration header (safe only while no `bibs_bonus` rows exist; on
hosted the migration is inert until the `VibeTrunk/supabase` push). Front-end:
a "Who washed the bibs?" select on the attendance form's review step (options =
the checked-in players + "Nobody"), threaded through
`admin/attendance/actions.ts` to both RPCs; `messages/page.tsx` gains a "Bibs
bonus" kicker label. Between the KUT merge and the hosted push, choosing a
washer returns the RPC's "invalid argument" error — push promptly. Hosted
deploy is the additive path in `docs/OPERATIONS.md` via `VibeTrunk/supabase`
(ADR-021); never `supabase db push` from this repo.

## ADR-038 — Member-wide activity newsfeed view

Date: 2026-08-31

Status: Accepted

Decision: a club-wide **activity newsfeed** at `/feed`, backed by one read-only
view `kut.activity_feed`. Batch E3, migration
`20260908000000_activity_feed.sql`, additive (one `create view` + one grant,
nothing altered, no row written).

**Events shown** (`union all` of four already-persisted sources — no new write
path):

| kind | source | row |
|------|--------|-----|
| `sale` | `kut.market_sales` (`sold_at`) | seller name, **buyer name**, card (player) name, `sale_price` |
| `listing` | `kut.market_listings` where `status = 'active' and expires_at > now()` (`listed_at`) | seller name, card name, `price` |
| `pack` | `kut.pack_openings` (`opened_at`) | opener name, `price_paid` — count only, **no card reveal** (pack contents stay private) |
| `session` | `kut.match_sessions` where `status = 'published'` (`published_at`) | `session_date`, `session_type` |

**Not** discards (private inventory management, reads as negative) and **not**
coin-grant / attendance-reward rows (noise). The plan doc's "sales + new
listings only" was the safe floor; pack-opens + published-sessions keep the
feed alive on quiet market days without new disclosure.

**Retention: none.** No delete job. The page fetches `order by ts desc limit
200` with an optional `?before=<ts>` cursor ("Older activity →"), so the
effective window is ~the last 200 events.

**Privacy (the real ADR call).** A completed-sale row is a **new disclosure** —
`kut.market_sales` is otherwise readable only by buyer + seller (RLS,
`20260816070600`). For this small private club the feed shows the **seller
name, the card, the price and the buyer name** for a sale. The buyer is
already visible to the seller via the ADR-019 sale notification; showing it
club-wide is the deliberate, minimal extra. Listings already expose the seller
club-wide (ADR-017) — no change. Pack openings show the opener and coins spent,
never the cards drawn.

**Mechanism.** `kut.activity_feed` is `with (security_invoker = false,
security_barrier = true)` and `grant select to authenticated` — it runs as the
view owner, bypassing the underlying tables' RLS, exactly like
`kut.club_value_leaderboard` (ADR-030 / `20260901000000`). Every underlying
table keeps its own RLS for all other code paths.

**Front-end.** New route `src/app/(app)/feed/page.tsx`; a `/feed` "Newsfeed"
entry in the More menu (`nav-items.tsx` `buildMoreNavItems`), with a new
`IconFeed` (`src/components/icons.tsx`). Per-type copy: "A sold Card to B for N
KUT Coins", "A listed Card for N KUT Coins", "A opened a pack (N KUT Coins)",
"A new session was published — DD Mon YYYY · type".

Reason: tester feedback #10 ("newsfeed of recent actions"). Part LI §163
success criteria ("people talk about whose card rose", "people care when a
card crosses a rarity boundary") is the rationale.

Consequences: tier is **additive** (ADR-032) — one view + grant; rides the last
scheduled backup, no fresh pre-push backup, SQL-reversible (`drop view
kut.activity_feed`). pgTAP `activity_feed.test.sql` `plan(9)` proves an
uninvolved member reads a completed sale (with both names), an active listing,
and a published session from the view, and that `kind = 'discard'` never
appears. Between the KUT merge and the hosted `VibeTrunk/supabase` push (ADR-021
additive path; never `supabase db push` from this repo), `/feed` errors on the
missing view — the nav entry ships on the merge, so push promptly.
