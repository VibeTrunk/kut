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

## Speculative ideas → moved to `ROADMAP.md`

Two brainstorms once lived here — a **weekly 5-card squad knockout** and a
**player-of-the-week peer vote** — explicitly "not an ADR, not scoped". They
belong with the other forward-looking material, so they now sit in
`docs/ROADMAP.md` under "Brainstorms (not scoped)", unchanged. Moved by
ADR-045.

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
_Superseded by **ADR-039**: the front end moved into a "Club activity" section
on Home; the `/feed` route, its nav entry, and `IconFeed` were removed. The
`kut.activity_feed` view and its pgTAP coverage are unchanged._

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

## ADR-039 — Activity feed is a Home section, not a `/feed` route

Date: 2026-08-31

Status: Accepted

Supersedes: the front-end half of **ADR-038** (the `kut.activity_feed` view and
its behaviour are untouched).

Decision: the club-wide activity feed renders as a **"Club activity" section at
the bottom of Home** instead of a standalone page. `src/app/(app)/feed/` and the
`/feed` "Newsfeed" entry in `buildMoreNavItems` are removed, along with the
now-unused `IconFeed`.

Details:

- Home's server component adds one more query to its existing `Promise.all`:
  `kut.activity_feed` `select … order by ts desc limit 12` with a fixed
  `.gte("ts", "2026-08-30T00:00:00Z")` floor. No `?before=` pager — a Home
  widget shows a short recent list, not a browsable archive.
- The `2026-08-30` floor hides pre-launch test/seed rows the club never wants
  to see.
- A feed query error never fails Home — the section falls back to its empty
  state (`activityResponse.data ?? []`).
- Shared helpers: `describeActivity` / `ACTIVITY_KIND_LABEL` / `ActivityRow` in
  `src/lib/activity.ts`; date-only `formatDate` in `src/lib/format.ts`, now used
  by both this section and the Messages inbox (previously each formatted dates
  inline, Messages with a redundant `timeStyle: "short"`).
- Dates render **date-only** everywhere in member-facing history (feed +
  Messages) — the exact minute of a sale or pack open is noise. The `session`
  row's `session_date` goes through the same `formatDate`, so every row in the
  list shares one format.

Reason: keeps the "what changed?" content in the natural landing flow (next to
Top risers, wallet, rank) and drops a nav entry. No schema or migration impact;
this ships on a normal KUT PR with no hosted push.

## ADR-040 — Transfer-market cards render player art (and expose seller_id)

Date: 2026-08-31

Status: Accepted

Decision: widen `kut.active_market_listings` with `player.photo_path` and
`listing.seller_id`, and wire the photo through `/market` the same way
`/club/collection` and `/players` already do (`resolvePhotoUrls` →
`photoUrl` on `<LiveCard>`).

Details:

- Tester report: "Teize's pic was missing in the transfer market, the
  collection / player directory does show it correctly." It was not
  Teize-specific — the market view never selected `photo_path` and the page
  never resolved signed URLs, so every listing fell back to the
  jersey-initials placeholder.
- `photo_path` is only a storage-object key; the `player-photos` bucket stays
  private and images are still reached exclusively through short-lived signed
  URLs minted server-side (`src/lib/player-photos.ts`). No privacy change.
- `seller_id` is added in the same `create or replace` so `/market` can hide
  the "Make an offer" / "Buy" controls on the viewer's own listings
  (ADR-042). `buy_listing` already rejects self-purchase; this only removes a
  dead control.
- Migration `20260909000000_market_listing_card_art.sql`. Tier: additive
  (ADR-032) — one `create or replace view`, nothing rewritten, no row
  written; rides the last scheduled backup.

Reason: a card game where half the cards show no face on the busiest trading
screen reads as broken. Cheap, self-contained fix.

## ADR-041 — Club Value v2: a transparent coins + discard + 4x personal-card sum

Date: 2026-08-31

Status: Accepted

Supersedes: the Club Value formula in ADR-030 / BUILD_SPEC Part XII §39 (the
wallet + `sum(market_reference_value)` model).

Decision: Club Value becomes

    club_value = coins
               + owned_cards_value    -- SUM(discard_value) over every unburned owned card
               + personal_card_bonus  -- 4 x discard-equivalent of the member's linked
                                         player's Live card (0 when no player is linked)

`discard_value` is the existing, already-documented
`round(10 * 1.08^(OVR-30) * special_multiplier)`.
`personal_card_base_value = round(10 * 1.08^(linked_player.live_ovr - 30))`;
a linked player with no active-season rating row yet uses the 30-OVR floor
(base 10), matching `kut.player_directory`.

Details:

- Tester feedback: the old number was impossible to explain — it depended on
  invisible 14-day sale history and a piecewise `clamp(median, discard,
  discard*6)` / `discard*1.5` fallback. v2 is a plain sum of three
  individually-visible numbers.
- `kut.market_reference_value` is kept — it still backs
  `kut.get_listing_bounds` for listing price bands. It is simply no longer
  part of Club Value.
- Weight W = 4 (chosen by the product owner): at OVR 50/60/70 the
  personal-card base value is ~47/101/217, so the bonus is ~188/404/868 — a
  meaningful, attendance-driven personal floor that still sits below an active
  collector's owned-card subtotal, so collecting keeps mattering. Mirrored as
  `ECONOMY.personalCardClubWeight` and the `4` literals in the migration.
- New page `/club/value` shows the arithmetic: the three line items, an
  expandable per-card discard-value table, and the personal-card `base x 4`
  line. Linked from the `/club` Club Value tile, the More nav ("Club Value"),
  the leaderboard intro, and How-it-works §9.
- `kut.my_club_value` gains `owned_cards_value`, `personal_card_weight`,
  `personal_card_player_name/slug`, `personal_card_ovr`,
  `personal_card_base_value`, `personal_card_bonus`; the old `card_value`
  column is renamed `owned_cards_value` (one consumer, `/club`, updated).
  `kut.club_value_leaderboard` keeps its column names; only the ranked total
  changes.
- Migration `20260910000000_club_value_v2.sql`. Tier: data-changing
  (ADR-032) — it changes a published economy formula and the leaderboard
  order. Fresh backup immediately before the hosted push. Read-only views
  only; no row rewritten.

Reason: a leaderboard nobody can audit erodes trust in the whole economy, and
weighting the attendance-driven personal card keeps KUT about turning up to
football rather than only about opening packs.

## ADR-042 — Trade offers on market listings, with coin + card escrow

Date: 2026-08-31

Status: Accepted

Promotes: "trading offers" from the BUILD_SPEC Part XXXIV Phase-4 "potential"
list to a shipped feature (the spec asks for an economy/abuse review first —
below).

Decision: a member can offer KUT Coins and/or up to 3 of their own cards for
an active listing instead of paying the buy-now price. Everything offered is
escrowed at propose time; offers expire 12h after they are made.

Details:

- New tables `kut.trade_offers` and `kut.trade_offer_cards`; new
  `kut.user_cards.held_by_offer_id` (FK, `on delete set null`) as the
  card-escrow lock.
- Server-authoritative RPCs (all `security definer`, mirroring the
  marketplace):
  - `propose_trade(listing_id, offered_coins, offered_card_ids[], idem)` —
    validates the listing is active and not the caller's own; offered coins
    `0` or `1..get_listing_bounds.maximum_price` (a coin offer below the
    asking price is allowed — that is the point); each offered card owned,
    unburned, not held, not listed; <=3 cards; <=10 active offers per proposer.
    Debits + `trade_escrow` ledger row for the coins, sets `held_by_offer_id`
    on the cards, notifies the seller.
  - `respond_to_trade(offer_id, accept, idem)` — seller only. Accept re-runs
    the `buy_listing` atomic swap at the offered price (5% burn on the coin
    component, `trade_sale` receipt to the seller), moves the listed card to
    the proposer and the offered cards to the seller, marks the listing
    `sold`, and auto-rejects + refunds every other active offer on that
    listing. Reject refunds the escrow.
  - `withdraw_trade(offer_id)` — proposer only; refunds the escrow.
  - `expire_trade_offers()` — sweeps offers past `expires_at`, refunding
    each. Called lazily on `/market` and `/market/offers` loads. A Vercel
    cron is a documented follow-up (the function is already granted to
    `service_role`); not added now because the repo has no cron/route infra
    yet and both trigger pages are high-traffic.
- Escrow refund is centralised in `kut._refund_trade_offer(offer_id)` —
  releases card holds and credits `trade_unescrow` once (ledger-key guarded).
- Guards added to existing paths: `create_listing` and `discard_card` reject a
  held card; the `prevent_burning_listed_card` trigger also blocks burning
  one; `cancel_listing` and `buy_listing` auto-reject + refund a listing's
  pending offers; `admin_reset_account` and `admin_prepare_account_deletion`
  unwind a member's offers (the FKs are `on delete restrict`).
- `wallet_ledger.reason` gains `trade_escrow` / `trade_unescrow` /
  `trade_sale`; `user_notifications.event_type` gains `trade_offer` /
  `trade_response`. `kut.activity_feed` gains a `trade` row for accepted
  offers. New read projection `kut.my_trade_offers` powers `/market/offers`
  and the nav badge.
- Migration `20260911000000_trade_offers.sql`. Tier: data-changing
  (ADR-032) — new escrow economy, new ledger reasons, four existing economy
  functions rewritten. Fresh backup immediately before the hosted push.

Economy / abuse review (per the spec requirement):

- Lowball / spam offers: capped at 10 active outgoing offers per member; each
  one escrows real coins/cards, so spamming is self-limiting. Sellers simply
  decline.
- Price manipulation: accepted trades are not written to `kut.market_sales`,
  so they never count as qualifying sales for `market_reference_value` — an
  offer is a private negotiation, not a public price signal.
- Double-spend: coins leave the wallet and cards are `held_by_offer_id` at
  propose time; both are released or transferred atomically on resolve. A held
  card cannot be listed, discarded, burned, or re-offered.
- Self-dealing via alts: identical risk profile to the existing market (no
  worse); the 5% burn still applies to any coin component.
- Race safety: accept re-locks the listing + both wallets in UUID order and
  re-checks ownership, exactly like `buy_listing`; concurrent accept/accept
  and accept/buy resolve to a single winner with the loser fully refunded
  (covered by `tests/integration/trade-race.test.ts`).
- Notification volume: bounded by the active-offer cap and one notification
  per state transition.

Reason: the club asked for it, and coin-only buy-now under-serves a group that
mostly wants to swap specific cards. Escrow + a short 12h window keeps the
economy invariants intact.

## ADR-043 — The material ladder: card face, typography, and screen redesign

Date: 2026-08-31

Status: Accepted

Decision: the Live Card face was redesigned around one rule — **each rarity
tier adds a physical property to the tier below it and takes nothing away** —
and the app's typography and five member-facing screens were brought in line
with it. No database, RPC, view, economy formula, or game invariant changed;
this is a presentation-layer change only, and no migration accompanies it.

The ladder, in material terms:

| Tier | OVR | Material | Motion at rest |
| --- | --- | --- | --- |
| common | under 40 | uncoated newsprint, open press grain | none |
| bronze | 40–49 | coated stock | none (one 1.15s specular pass on hover) |
| silver | 50–59 | cold-foil stamped, brushed plate | none (specular pass on hover) |
| gold | 60–69 | hot foil, embossed rating | 9s foil cycle |
| holo | 70–79 | refraction film, iridescent edge | two layers drifting at 17s and 23s |
| elite | 80+ | black lacquer + gold leaf, internal light | 6.5s breath, 7.5s caustic, pointer tilt |

Elite is the only inverted card in the set, which is what makes an Elite pull
legible across a room. Only three of six tiers animate at rest and the two
continuous ones run slower than 9s, so a full Collection grid composites a
handful of moving layers at most. `prefers-reduced-motion` disables all of it;
the ladder still reads, because it is material first and motion second.

Card anatomy changes (the skeleton is shared by all six tiers):

- Art bleeds to the card edge. The taped, 2°-rotated frame at 58% card width
  is gone — it cropped faces and made every card sit askew.
- The six rotated stat circles became a ruled stat table. The circles cost
  roughly a third of the card's lower area and were the least legible element
  at grid size; the table stays readable down to a 168px card on a phone.
- The tier **word** moved from inside the pennant (where it was set at
  0.42rem) onto the nameplate. The pennant keeps colour + silhouette, so
  ADR-022's three-way rarity encoding (hue, shape, word) is preserved.
- The no-photo card is the **shirt back**: surname across the shoulders, live
  rating as the squad number, drawn in the tier's own material. Most of the
  club never uploads a photo, so this is the default card face, not an error
  state — and unlike the previous initials-on-a-jersey monogram it differs per
  player. Surnames over 14 characters fall back to a plain drawn bust.

Typography: Arial is replaced by **Instrument Serif** (page headings, the
clubblad voice) and **Archivo** (every interface job and every number,
tabular). Both are self-hosted via `next/font`.

Reason: ADR-022 chose "Clubblad" and derived the chrome palette from the card
tiers; that decision still holds and **the palette is unchanged here**. What
did not hold was that all six tiers were the same card in six colours, so
rarity was a hue swap rather than a felt difference. Tying tier to material
makes the ladder something you can see at a glance and gives high tiers
somewhere to go without making low tiers look broken.

Consequences and constraints worth remembering:

- **Production CSP is `style-src 'self' 'nonce-…'`, which strips inline
  `style` attributes.** Everything visual therefore lives in `globals.css` or
  Tailwind classes. Two knock-on rules: computed bars (attribute strength,
  rating history) are drawn as **SVG geometry**, not divs with a percentage
  width, because Tailwind cannot generate an arbitrary-value class from a
  runtime number; and the Elite pointer tilt writes `--card-tilt-x/y` through
  **CSSOM** (`element.style.setProperty`), which `style-src` does not govern,
  rather than a React `style` prop.
- **`font-src` is `'self'`**, so a webfont CDN would be blocked. `next/font`
  self-hosts both faces under `/_next/static/media`; do not switch to a
  `<link>` to fonts.googleapis.com.
- The card scales from one variable: it is an inline-size container and each
  region sets its base with `4cqi`, then uses `em` beneath that. Container
  query units cannot address their own container, so the card's own radius and
  shadow stay in `rem`.
- Only Elite loads client JS (`CardTilt`); every other tier stays a pure
  server component.
- A holo "prism edge" built as a conic-gradient ring masked with
  `mask-composite: exclude` was **abandoned**: Chromium never excluded the
  interior, and the gradient's colour-stop boundaries painted as stray
  diagonals across the whole card. Layered inset shadows split the light at
  the four edges instead. Do not reintroduce the masked-ring approach.

Screen changes, deliberately limited to low-hanging fruit — the UX and
information architecture are otherwise untouched:

- Home: "Open a pack" is a primary button rather than a fourth entry inside
  the stats `<dl>`; the activity feed is a ruled ledger rather than a stack of
  rounded boxes.
- Collection: gained the search / tier / sort vocabulary Market already had,
  plus header totals for the whole collection. The set is fetched once and
  narrowed in the route handler — a club collection is tens of cards, and it
  keeps the totals honest in one round trip.
- Market and Collection: price and status ride the card instead of floating as
  loose text beneath it, so a scanned grid reads in one pass.
- Player profile: gained a rating-history chart from the existing
  `kut.player_rating_snapshots` table (readable by `authenticated` since
  ADR-031 — no schema change was needed).

The design was explored on a multi-artboard canvas before any code changed;
the shirt-back placeholder was chosen there over a crest monogram and a line
portrait.

Revisions after the first review pass:

- **Holo is a periodic prismatic sweep plus a continuous shimmer**, and it
  took four passes to land. A real holographic card only fires when the light
  catches it, so the refraction is periodic, not continuous: a band of thin
  coloured lines crosses the card in about 2.5s and then it rests for six
  (`card-prism`, 9s). The lines are a `repeating-linear-gradient`; the band is
  a single-layer `mask-image` envelope so they fade in and out at its edges
  rather than reading as a moving rectangle, and the layer is wider than the
  card so its own edges never enter frame. The shimmer is separate and does
  run continuously (`card-glide`, 11s).

  Three earlier attempts are worth not repeating: smooth linear-gradient
  washes read as a flat purple tint; hard-stopped `repeating-linear-gradient`
  bands read as far too intense; and a continuously rotating conic gradient
  reads as restless and mechanical. Note the irony — the leaking masked conic
  ring described below produced roughly the right *look* by accident, which is
  why the fix was to reproduce the effect deliberately rather than abandon it.
  Note also that single-layer `mask-image` works fine here; it was
  specifically `mask-composite` that failed.

- **Stat pairs are grouped left, not `space-between`.** Spreading each pair
  across its grid cell put every value further from its own label than from
  the *next* label, so the numbers appeared to belong to the wrong stat. Label
  and value now sit together with a `min-width` on the label keeping the
  values aligned in columns.
- **`.live-card__topscrim`** puts a ground under the rating. Over a light
  uploaded photo the OVR had nothing behind it and became hard to read; the
  scrim is tinted with the card's own `--stock`, so it darkens on Elite and
  lightens on every other tier.

Screens beyond the five above (player directory, leaderboard, messages,
settings, login, invite, welcome, Club Value, trade offers, how-it-works, and
the admin tooling) were brought onto the same shell, eyebrow, display-serif
heading, control and button vocabulary. Verified against the production CSP
with `next start`: no `style-src` violations, no page errors and no 4xx across
every route reachable without a session.

## ADR-044 — Tester feedback round 2: activity-feed trade rows, mobile
leaderboard, Home full name, bibs copy fix, card lightbox, custom club names,
published-sessions pages

Date: 2026-09-01

Status: Accepted

A second tester round (4 defects + 3 buildable ideas), shipped as **one
sweep**: KUT branch `feat/tester-feedback-round-2`, one migration
`20260912000000_tester_feedback_round_2.sql`, this one ADR. 💡03 ("see other
members' squads") is recorded in `docs/TESTER_FEEDBACK_BATCHES.md` as
needs-a-product-decision and is **not** built here.

**Defects (front-end only).**

- *Blank club-activity row.* `kut.activity_feed` grew a fifth `kind`,
  `'trade'`, in `20260911000000` (ADR-042 §18) but `src/lib/activity.ts` still
  knew four, so a trade row rendered an empty kicker and an `undefined`
  sentence (the `switch` fell through). Added `'trade'` to `ActivityKind`, a
  `describeActivity` case (`X traded Y to Z for N KUT Coins.`), and a
  `default:` arm + a tolerant `activityKindLabel()` lookup so any future
  `kind` can never render blank again.
- *No name on the leaderboard on mobile.* The row `<li>` applied the
  multi-column grid at every width (unlike the `sm:grid` header), so on a
  phone the fixed tracks overflowed and the `minmax(0,1fr)` name track
  collapsed to 0; the dedicated Club column was also `hidden lg:block`. The
  row is now a two-cell grid on mobile (rank + club, with the value line and a
  cards/players line each spanning both cells) that opens into the full ruled
  table from `sm` up. The club name shows at every width, as a subtitle under
  the member name — which also front-runs custom club names below. No view or
  data change: `kut.club_value_leaderboard` always returned `display_name` and
  a synthesised `club_name`.
- *Home lost the KUT full name.* ADR-043 rewrote the Home `<header>` and
  dropped the "Kelderklasse Ultimate Team" subtitle added in ADR-034. Re-added
  under the `<h1>`.

**Bibs bonus copy fix (#7) — DB, data-changing.** The reward is for the member
who **brings the (clean) bibs to** a session, which is exactly what
`match_sessions.bibs_washed_by` already records; the notification only ever
said "for washing the bibs after the session". Decision: correct the
**user-visible copy only** and keep every internal identifier
(`bibs_washed_by`, `wallet_ledger.reason = 'bibs_bonus'`,
`user_notifications.event_type = 'bibs_bonus'`, `kut.bibs_rewards`). The
notification body is composed server-side in `kut.grant_bibs_reward`, so this
needs a migration: a `create or replace` of that function with the one
`format()` string changed to "for bringing the bibs to the session on %s", plus
a one-shot, substring-scoped, reversible backfill of existing `bibs_bonus`
rows. Front-end sweep: the attendance-form label ("Who brought the bibs?"),
the How-it-works line, and the `ECONOMY.bibsCoinBonus` comment.
`ECONOMY.bibsCoinBonus` and Part 145 are unchanged (still 100). ADR-037 stands;
its "washing the bibs after" body wording is superseded here.

**Card lightbox (💡01) — front-end only.** No overlay primitive existed. New
`src/components/card-lightbox.tsx` (`"use client"`): a portal-free
`position: fixed` overlay showing `<LiveCard size="detail">`, with `Esc` +
backdrop close, focus moved to Close and trapped there, focus restored on
close, `aria-modal`, body scroll-lock via a class toggle, and a zoom-in
animation guarded by `prefers-reduced-motion`. All styling is in
`globals.css` (`.card-lightbox*`, `.card-zoom-trigger`) — no inline `style`,
per the nonce-only `style-src`. A dedicated expand button (`IconExpand`,
corner-of-card, hover/focus-revealed, always visible on touch) opens it; the
card-body tap target — a `next/link` to the detail page on the three grids —
is untouched, so each grid card is wrapped in a `group relative` div holding
the `<Link>` and the trigger. Wired into Collection, Player directory, Market,
and both card detail pages.

**Custom club names (💡04) — DB, additive.** `kut.profiles.club_name` has
existed unused since `20260816010000` (nullable, `<= 80`). New security-definer
RPC `kut.set_own_club_name(text)` (mirrors `set_own_player_photo`): writes the
caller's own row only, trims, treats blank/whitespace as `NULL` (→ the
synthesised default), rejects `> 80` chars and control characters with
`22023`, `revoke … from public, anon` + `grant … to authenticated`. **Not
unique** — it's a display label and the member's real name disambiguates rows.
`kut.club_value_leaderboard` is `create or replace`d to project
`coalesce(nullif(btrim(club_name), ''), display_name || '''s Club')`; the
`club_value` / `rank` arithmetic is byte-identical, so no economy drift
(pgTAP asserts this). `kut.my_club_value` is not touched. Front-end: a "Club
name" section on `/settings` (new `settings/actions.ts` `saveClubName` +
`club-name-form.tsx`).

**Published-sessions pages (💡12) — DB, additive.** Members already have RLS
`select` on published `match_sessions` and their `attendance`
(`20260816010000`), so a new thin `kut.published_sessions` view
(`security_invoker = true`, one row per published session with
`attendee_count` + `goal_count`) is a convenience, not a permission change. New
routes `/sessions` (list, newest first) and `/sessions/[sessionId]` (attendee
list with goals, the bibs bringer). Nav entry added to the "More" group; the
Home "Session published" activity rows link to `/sessions`.

**Tier & rollout.** The migration is **data-changing** (ADR-032) solely
because of the `user_notifications` backfill — fresh backup immediately before
the `VibeTrunk/supabase` push; parts B/C/D are additive. Full rollback DDL is
in the migration header. Never `supabase db push` from this repo.

**Verification.** `npm run verify:fast` (lint, typecheck, 48 unit incl. new
`tests/unit/activity.test.ts`), `npm run test:db` (383 pgTAP incl. new
`published_sessions.test.sql` and extended `bibs_bonus` / `member_self_service`
/ `club_value`), `npm run test:e2e` (22, incl. `/sessions` auth-boundary), and
`next build` all green. The logged-in visuals (mobile leaderboard, lightbox,
Home subtitle) are covered by a scripted manual checklist — the e2e harness
has no authenticated session.

## ADR-045 — Documentation restructure: one roadmap, a doc map, archived one-time plans

Date: 2026-09-02

Status: Accepted

Forward-looking content had scattered across five documents — the 2026-08-17
handoff's "Recommended next phases" (mostly shipped, still written as
pending), `TESTER_FEEDBACK_BATCHES.md`'s "Future ideas", `decisions.md`'s
"Open items", and BUILD_SPEC's own Phase 2–4 / future parts — with no single
place to see what is next. "What to read first" was duplicated in four places
and "agent guardrails" in three. Two one-time planning docs (`HANDOFF.md`,
`MVP_HARDENING_PLAN.md`, both 2026-08-17) were fully executed but still sat in
`docs/` as if live, and `PROGRESS.md` still opened with the frozen Phase-0
snapshot headings from BUILD_SPEC §107.

Decision:

- **`docs/ROADMAP.md`** is the single home for everything not yet built —
  ideas, planned phases, blocked items — each with a status
  (idea / planned / blocked / partial / declined). It absorbs the handoff's
  phase list (de-duplicated and status-checked), the tester "Future ideas",
  and the one-off open items, and it *indexes* (does not copy) BUILD_SPEC's
  future parts. BUILD_SPEC stays canonical and unchanged.
- **`docs/README.md`** is the documentation map: one table of what each
  document is for, plus the start-of-session reading order. Other docs point
  here instead of restating the list.
- **`docs/archive/`** holds superseded one-time documents with a "historical"
  banner: `HANDOFF-2026-08-17.md` and `MVP_HARDENING_PLAN.md`. `git mv`, so
  history is intact; dated log entries that mention them still resolve.
- **`TESTER_FEEDBACK_BATCHES.md`** keeps only the triage record (who reported
  what, de-duplication, disposition); its "Future ideas" section is now a
  pointer to `ROADMAP.md`. Round 3's triage table was added here.
- **`PROGRESS.md`** keeps every dated entry unchanged; its stale Phase-0
  header block is replaced with a short orientation note. This is a
  deliberate deviation from BUILD_SPEC §107's fixed-heading shape — recorded
  here rather than by editing the spec, since §107 describes a
  multi-session-coding convention, not a game rule or acceptance criterion.
  (The long-standing lowercase `decisions.md` vs the spec's `DECISIONS.md` is
  likewise left as-is; the lowercase name is canonical for this repo.)
- **`README.md`** drops its stale, duplicative feature-walkthrough (superseded
  by the in-app `/how-it-works` page and BUILD_SPEC Parts IV–XIII) and points
  at `docs/README.md`.

Reason: one canonical location per kind of information — spec, shipped log,
decisions, forward work, bugs, raw feedback, runbooks — so nothing has to be
cross-checked against a stale copy. No spec, code, migration, or economy
value changed; this ADR is the record of a docs-only reorganisation.

Consequences: agents should read `docs/README.md` after `CLAUDE.md` for the
map, and record new forward-looking items in `ROADMAP.md` (not in a handoff or
the feedback ledger). `CLAUDE.md`'s reading-order line now names
`docs/README.md` and `docs/ROADMAP.md`. No verification impact (no code or
test changed).

## ADR-046 — Remove the fullscreen card lightbox (reverts ADR-044 💡01)

Date: 2026-09-02

Status: Accepted

The card lightbox shipped in ADR-044 (tester idea 01) was reported broken in
round-3 feedback — "tapping a card to view it fullscreen doesn't work like
intended" (KB-001), with no repro detail. Rather than chase a fix, the owner
decided the affordance is not worth keeping: the card detail pages already are
a full-size view of the card, and every grid card links to its detail page.

Removed, front-end only, no DB or spec impact:

- Deleted `src/components/card-lightbox.tsx` and the unused `IconExpand` glyph.
- Removed `<CardLightbox>` from all five surfaces (Player directory, Market,
  Collection grid, and both card detail pages) and the now-unused imports.
- Deleted the `.card-zoom-trigger` / `.card-lightbox*` block (rules +
  keyframes + `prefers-reduced-motion` guard) from `src/app/globals.css`.
- Unwrapped the per-card `group relative` wrappers the trigger needed. Where
  an absolutely-positioned child still relies on a positioned ancestor
  (Market price pill, Collection "Listed" / edition badges) the `relative`
  was kept — moved onto the card's `<Link>` on the Collection grid.

The `document.body` `overflow-hidden` toggle is gone with the component; no
other code toggled that class.

KB-001 is resolved by removal (status set in `KNOWN_BUGS.md`). ADR-044's
other six items stand. Verification: `npm run verify:fast` + `next build`.

---

## ADR-047 — Rating history as a line chart over tier bands

Date: 2026-09-02

Status: Accepted

`/players/[slug]` carried an eight-bar sparkline (`RatingHistory` in
`card-stats.tsx`) with no axis, no scale, no tier context and no dates beyond a
start–end caption, and it hid itself entirely below two snapshots. It answered
"has this gone up?" and nothing else.

Replaced with a line chart — one point per published football week, drawn over
horizontal rarity-tier bands, with goal markers on the weeks a player scored.
Design settled in `archive/SPEC_ALBUM_CHRONICLE_GRAPH.md` §2.

- **Tier bands, not a bare axis.** OVR alone is a number; OVR against the tier
  it sits in is the thing members actually care about, because the tier is what
  changes the card face and its market value.
- **X is ordinal by week index, not by date.** A holiday gap shows up in the
  labels, not as blank horizontal space, so a sparse series reads as a history
  with gaps rather than a broken chart.
- **Season-scoped.** The query now filters `player_rating_snapshots` on the
  active season (`kut.seasons where is_active`) instead of an unscoped
  `limit(8)`. Ratings are per-season, so an unscoped series was wrong the
  moment a second season existed.
- **Goal markers reuse published attendance**, which the Chronicle and the
  activity feed already show club-wide. No new disclosure.

**No backfill.** `kut.player_rating_snapshots` has only accumulated since
ADR-031 (2026-08-30) and the capture trigger writes one week per rebuild, so on
ship day most players have one or two points. The chart is therefore designed
so a sparse series reads as *early*, not as broken — no empty box, no "no data"
apology. A deterministic season backfill stays available later
(`BUILD_SPEC.md` §10 guarantees the season is rebuildable from published
sessions) and is recorded as deferred in the spec's §7.

No migration: the snapshot table and published attendance already exist. Both
queries are non-critical — a failure renders the profile without the chart,
exactly as the page already treated snapshots.

## ADR-048 — The collection album is a bound, paged book; archetype is a lens

Date: 2026-09-02

Status: Accepted

`BUILD_SPEC.md` §41 specified a "Collection album — Phase 2" as a
roster-completion view with owned and missing slots, and left the organisation
open ("possible subcollections: Monday regulars, Friday regulars, Gold players,
2026 debutants"). This settles those choices and builds it.

The emotional job is to **make the gap visible**. `/club/collection` could show
what you have but never what you are missing, so there was no pull toward the
market and no reason to care about a duplicate.

- **A bound album you leaf through, not a scrolling grid.** Nine slots per
  page, ordered alphabetically by display name; desktop shows two facing leaves
  as a spread, mobile one leaf, page numbers identical on both.
- **Album is the default view of `/club/collection`**; the existing
  filter/sort/discard/list grid becomes a "Manage" mode at `?view=manage`,
  reached by a segmented control under the page title. Completion is the more
  emotional read, and ROADMAP phase D already described exactly this split.
- **Archetype is a lens, not the spine.** The first design used archetype
  pages. It does not survive contact with the data: `kut.players.archetype`
  defaults to `all_rounder` and only changes if a member sets it at
  `/settings/card` (ADR-027) or an admin does, so roughly **80% of the roster
  is All-rounder** — six near-empty pages and one page of about fifty. Lenses
  (`all` · `gaps` · `specialists` · `type:<archetype>` · `tier:<tier>`) select
  which players are in the album and pagination adapts. `specialists` — the
  players who actually chose a type — is the only cut of the archetype data
  that means anything while the default dominates.
- **Slot numbers are positional, never identifiers.** They are an alphabetical
  index, so adding a player shifts every number after them. Nothing may persist
  or reference them.

Out of scope in v1 and unchanged by this ADR: completion rewards (a faucet or
sink that must be balanced against Part L — the ROADMAP "Prestige +
collections" item is their home), other members' albums (card ownership is
deliberately private; "see other members' squads" stays a blocked roadmap item
needing its own privacy ADR), and sub-collections, which are where §41's
"possible subcollections" list would land if built — as lenses.

No migration: both queries already exist elsewhere in the app.

## ADR-049 — The TFH Chronicle replaces /sessions, one issue per football week

Date: 2026-09-02

Status: Accepted

`/sessions` was a list of dates. The Chronicle is a weekly club paper: one
issue per football week, telling what happened at TFH and what it did to the
cards. Design settled in `archive/SPEC_ALBUM_CHRONICLE_GRAPH.md` §4.

- **The football week is the unit** because it is the rating engine's unit
  (`BUILD_SPEC.md` §9). A Monday and a Friday in the same week share one
  activity calculation, so "whose card moved" is only a truthful statement at
  week level. Individual sessions become matchday reports nested inside the
  issue.
- **Computed live, no snapshot table and no write path.** An attendance
  correction retroactively fixes an old issue, which is the correct behaviour
  here: the Chronicle then always agrees with the ratings people can see.
- **`[week]` is the ISO Monday as `YYYY-MM-DD`** (e.g. `/chronicle/2026-08-31`)
  rather than `2026-W36`, because it *is* the `week_start` key — no conversion,
  no ISO week-year edge cases at year boundaries, and it sorts naturally.
- **Promotions only, editorially.** v1 carries the issue header, matchday
  reports (attendance, scorers, bibs) and **tier crossings** — no risers and
  fallers list, no market or pack desk, no club-table movement. A rating falling
  is a consequence of not showing up; a weekly paper that named people for it
  would make KUT a place you get called out, which is the opposite of what it is
  for. Tier crossings are the one rating event worth reporting because they
  visibly change the card. Layout leaves room for a later club desk and a
  kudos/goals block; no code was written for either.
- **Members only.** No public route, share token or OG image. An issue names who
  attended, who scored and who brought the bibs — all already club-visible via
  the activity feed — and the Chronicle must not become the surface that leaks
  them outside TFH.
- **Weeks with no published session produce no issue.** No "quiet week"
  placeholder, consistent with §9: a week without a published session does
  nothing to anyone.

`/sessions` and `/sessions/[sessionId]` become permanent redirects; the More
menu's "Sessions" entry becomes "Chronicle" (`IconSessions` retained). The nav
is a public surface, so `BUILD_SPEC.md` Part XVII §46 is updated with it.

One additive migration, `20260913000000_chronicle_views.sql`:
`kut.chronicle_weeks` (one row per football week with a published session) and
`kut.chronicle_tier_changes` (a `lag()` over `player_rating_snapshots` finding
consecutive weeks where the tier differs), both `security_invoker = true`
because every underlying select is already permitted to members. Rollback is two
`drop view`s.

**Known-sparse at launch:** tier crossings need two snapshot weeks to compute
anything, and snapshots only started accumulating 2026-08-30, so the block is
omitted entirely — no heading, no empty box — on early issues. See ADR-047 for
the same constraint on the graph.

## ADR-050 — Go-live operating decisions for the wide TFH invite

Date: 2026-09-02

Status: Accepted

Decisions taken by the owner when opening KUT from closed alpha to the whole of
Terrible Football Haarlem, ahead of the Friday 2026-09-04 session. The checklist
they resolve is `docs/LAUNCH_PLAN.md`; the reasoning not repeated here lives
there.

- **No Supabase Pro upgrade.** The shared project stays on the free plan, so
  there is no PITR and no managed backup. The encrypted logical dump
  (`scripts/backup-kut-hosted.ps1`) remains the only rollback path for game
  state, and `docs/BACKUP.md`'s cadence is therefore load-bearing rather than
  advisory. Accepted knowingly.
- **No custom SMTP.** Password recovery stays admin-assisted (ADR-011), closing
  `BUILD_SPEC.md` open question §4210 #5 as "not for launch". Onboarding never
  depended on email — invites are player-bound token links — so this costs
  support load in week two rather than blocking the launch.

  **Amended 2026-09-02, and this is the stronger point:** self-service email
  recovery is not merely unconfigured, it is **impossible with the current
  identity model**, and no amount of SMTP configuration changes that. Members
  sign in with a self-chosen username, which `src/lib/auth/username.ts` maps to
  a synthetic address on the non-routable domain `users.kut.local`. KUT holds no
  real email address for any member, so there is nowhere to send a recovery
  link. Adding a provider later is therefore **not** a config change: it would
  need a way to collect and verify real addresses first (a schema change, a
  settings surface, a consent question, and a decision about whether an address
  is required or optional), and only then the SMTP setup. Anyone revisiting this
  should cost it as a feature, not a checkbox.

  The same design is why the hosted "Confirm email" Auth toggle can stay on
  harmlessly: invited accounts are created through the service-role admin API
  with `email_confirm: true` (`src/app/invite/[token]/actions.ts`), so they are
  pre-confirmed and no mail is ever attempted. The toggle only gates the public
  sign-up path, which is disabled.
- **Invite process unchanged.** `/admin/invites` issues one token at a time,
  delivered by WhatsApp DM. Tokens are single-use, player-bound and expire in 14
  days; a token posted to a group chat would let the wrong person claim someone
  else's identity, so DM is the rule, with `/admin/links`
  (`admin_set_profile_player`) as the recovery path if it happens anyway.
- **Anyone who joins gets a card immediately.** The "2+ appearances before a
  Player row" bar was a one-off *import* policy recorded in the roster
  migrations, never a spec rule; it does not apply to joiners. Every invitee gets
  a Player at the 30 OVR / common baseline via `kut.admin_add_player`, so their
  album has their own card in it on day one. `BUILD_SPEC.md` Part 137 is updated.
  The bar stays only for migration-backfilled historical players.
- **Invite scope is the whole TFH WhatsApp group**, including people who never
  appeared on an August sheet — each needs a Player row created before their
  invite can be issued, since invites are player-bound.
- **No backfill of joiners into past sessions.** A correction that adds someone
  to an August session also back-pays 250 KUT Coins per session, an unplanned
  faucet against the Part L invariants. Joiners accrue from the next published
  session.
- **No blanket account reset, no season reset, no roster reset.** Reasoning in
  `LAUNCH_PLAN.md` §2–§3; card editions are referenced with `ON DELETE RESTRICT`
  and everyone is on the same faucet from go-live regardless.
- **New joiners keep the `all_rounder` default archetype** and are not nudged to
  change it. Self-service stays available at `/settings/card`
  (`set_own_player_archetype`). Reassigning an *existing* player's archetype
  triggers a rating rebuild and is data-changing tier, so it is not launch work.
- **Restore drill deferred to after the launch weekend.** The 2026-08-30 drill
  passed and the only schema change since is two additive views; re-drilling once
  real member data is in the dump is the more meaningful test. A fresh backup is
  still taken before the first invite wave.
- **Backup cadence to be set after launch**, once the group's real trading
  activity is visible. `BACKUP.md`'s unattended scheduled-task recipe is
  available when that is decided.

---

## ADR-051 — Trade offers move from the market grid to a listing detail page

Date: 2026-09-04

Status: Accepted

Round-4 feedback reported the transfer market as unbrowsable on a phone: the
listing grid was `grid-cols-1` below `sm`, so one listing filled the viewport
(KB-006). Moving it to two columns is the fix, but it leaves each tile ~160px
wide, and a tile carried two action controls. `BuyListingForm`'s label shortens
cleanly. `ProposeOfferForm` does not — it expands inline into a bordered panel
with a coin input and a scrollable card list, which is unusable at that width.

Offers therefore leave the grid entirely, at every width:

- **New route `/market/[listingId]`** — the card at `size="detail"`, attribute
  bars, price, seller, Buy, and the offer form full width. It reads
  `kut.active_market_listings` by `listing_id`; sold, cancelled and expired
  listings drop out of that view, so a stale id `notFound()`s rather than
  rendering a dead Buy button. The tile's card links here.
- **`ProposeOfferForm` loses its collapsed state.** On the detail page the form
  *is* the screen, so the "Make an offer" button and the `open` state are gone
  rather than kept behind a prop. Nothing else rendered the collapsed mode.
- **The market index stops fetching offerable cards.** That query only fed the
  per-tile form; the index is one Supabase round trip lighter.
- **`revalidatePath("/market")` widened to `("/market", "layout")`** in all four
  market actions, so the new nested route is invalidated too. It also subsumes
  the separate `/market/offers` call.

Rejected: **a bottom sheet** over the grid. It keeps offers one tap from
browsing and is the native phone idiom, but it needs a modal layer the app does
not have, and the grid tile would still carry two controls. The detail page
costs a navigation and reuses a page shape the collection already has.

Nothing changes server-side. The same `propose_trade` RPC, the same escrow, the
same idempotency key; both forms already carried a hidden `listingId` and did no
page-specific work, so they were imported unchanged. Part L invariants #20
(ownership changes only via `buy_listing` / `respond_to_trade`), #22 (trade
escrow) and #23 (accepted trades never written to `market_sales`) are untouched.
Front-end only: no migration, no schema, no economy value.

`BUILD_SPEC.md` §36 gains the detail page. KB-006 marked fixed. Verification:
`npm run verify:fast` + `next build`.

## ADR-052 — A superadmin may grant themselves KUT Coins

Date: 2026-09-04

Status: Accepted

Decision: a new `security definer` RPC, `kut.admin_grant_self_wallet(p_amount
bigint, p_reason text, p_idempotency_key uuid)`, gated to `role = 'superadmin'`
(stricter than `kut.is_admin()`, which also passes a plain `admin`) rather than
widening `kut.admin_adjust_wallet` (ADR-035). It credits (`+`) or claws back
(`-`) the caller's own wallet in one transaction: a `wallet_ledger` row (new
reason `'admin_self_grant'`), the wallet update, and a
`kut.admin_account_events` audit row (new action `'self_wallet_grant'`) —
**no** `admin_notice` inbox message, since a superadmin does not need to be
told they granted themselves coins. Same guards as `admin_adjust_wallet`:
`abs(p_amount)` capped at `100000` (`ECONOMY.adminWalletAdjustMax`), a result
below zero raises `P0001`, a 1–200 char `p_reason` is required. Unlike
`admin_adjust_wallet`, it takes a real `p_idempotency_key uuid` (backed by a
partial unique index on `admin_account_events (target_user_id,
detail->>'idempotency_key') where action = 'self_wallet_grant'`, the same
pattern `admin_reset_account` uses) — closing the gap flagged in
`docs/ROADMAP.md` for the coin-faucet family.

Migration `20260914000000_admin_self_wallet_grant.sql`: widens
`admin_account_events.action`'s check with `'self_wallet_grant'` and
`wallet_ledger.reason`'s check with `'admin_self_grant'`, adds the partial
unique index, and creates the RPC.

Rejected: reusing `admin_adjust_wallet` by dropping its self-block. That RPC's
`p_user_id = auth.uid()` guard (`P0001` "you cannot adjust your own wallet")
stays exactly as-is; a superadmin granting themselves coins is a distinct,
higher-scrutiny action that deserves its own audit tags rather than being
indistinguishable from an ordinary admin-to-member grant in
`kut.admin_account_events` / `kut.wallet_ledger`.

Reason: a superadmin sometimes needs to correct or top up their own wallet
(e.g. after manually verifying a discrepancy, or for testing) without routing
through a second admin account, and the existing faucet deliberately refuses
to touch the caller's own wallet.

Consequences: tier is **additive** (ADR-032) — `create or replace function`
plus two widened checks and one new partial index; nothing existing is
rewritten or dropped. Rides the last scheduled backup; no fresh pre-push
backup required. SQL-reversible (drop function / drop index / restore the
narrower checks — no `self_wallet_grant` / `admin_self_grant` rows exist
before this migration's hosted push). UI: a new "Grant myself coins" form
renders only on the current superadmin's own row in `/admin/links`
(`src/app/(app)/admin/links/links-table.tsx`), gated `isSelf &&
currentUserRole === "superadmin"` — distinct from the existing `canModerate`
gate, which stays `false` for one's own row (disable/reset/delete/adjust-others
are unaffected). `BUILD_SPEC.md` §58's `ledger_reason` list gains
`admin_self_grant`; the "Admin adjustment" note near `admin_adjust_wallet`
gains a one-line pointer to this RPC.

## ADR-053 — Five tabs, a messages control and an account menu replace the More menu

Date: 2026-09-05

Status: Accepted

A UX audit of the shell (desktop and mobile) found the navigation had been
outgrown rather than designed badly: Phase B shipped five primary tabs plus a
"More" overflow menu, and the Chronicle (ADR-049), trade offers (ADR-042),
Club Value v2 (ADR-041) and the Panini album (ADR-048) were each added on top
of it without a second pass on the shape. Three structural consequences, all
measurable:

- **Nine of fifteen member destinations lit nothing in the chrome.** Active
  styling was computed only for `primaryNavItems`; the "More" button never took
  a state of its own.
- **Three of the five tabs pointed into `/club`**, whose own page existed
  mostly to link to Collection and Packs — both already tabs — and closed on a
  "squad building is planned" placeholder.
- **One event produced two badges.** An incoming trade offer incremented
  `incomingOfferCount` *and* wrote an unread `trade_offer` notification; both
  then collapsed on the closed control into a single 6px dot that said
  something had happened but never what.

Decision: the overflow menu is removed entirely and every destination becomes a
tab, a tab within a section, or one of two single-purpose chrome controls.

- **Primary tabs, identical on both platforms:** Home, Collection, Packs,
  Market, Leaderboard. `BUILD_SPEC.md` §46 is updated as the canonical record.
- **`/club` retires** to a `permanentRedirect("/club/collection")`, following
  the `/sessions` precedent from ADR-049. Its Club Value figure moves onto the
  Collection header; the card and unique-player counts were already there.
- **Section tabs** replace two menu rows: Market gains `Buy | Offers` and the
  Leaderboard gains `Clubs | Players`. A new `SectionTabs`
  (`src/components/app-shell/section-tabs.tsx`) serves both plus the existing
  Admin row, which migrates onto it in the same change.
- **Messages gets its own control** in the bar with a numeric unread count, and
  the incoming-offer count moves onto the Market tab and the Offers section
  tab. One event, one badge, one place. The merged dot is gone.
- **The avatar becomes the account menu trigger.** It was previously
  `aria-hidden="true"` with no link or handler, sitting beside a control
  labelled "More" whose panel opened headed by the member's display name — the
  two had swapped jobs. The menu now holds only account routes: Settings, My
  card, How KUT works, Admin (admins only) and Sign out — the label the button
  actually carries, matching "Sign in".

Two supporting changes fall out of it:

- **Route matching moves to a declarative table.** `src/lib/nav/routes.ts` is
  pure — no React, no `next/*`, no Supabase — so the matching rules are
  unit-testable in a repo with no jsdom, following the precedent
  `src/components/pack-reveal-state.ts` sets and documents. The per-item
  `isActive` closures could not survive the restructure: `/market` and
  `/market/offers` are both tabs, so an independent prefix test lights both on
  the offers page while an independent exact test stops lighting anything on
  `/market/[listingId]`. Only a whole-list "longest owned prefix wins"
  resolver gets both right. Entries declare what they `owns`, which is also how
  Leaderboard stays lit on `/players`, Home on `/chronicle`, and Collection on
  `/club/value`.
- **`aria-current` gains the `"page"` / `"true"` distinction**, so
  `/market/offers` does not carry two `aria-current="page"` at once — the
  Market tab is an ancestor, the Offers tab is the page.

Rejected: **keeping `/club` as a real hub** and building it up instead. It is
defensible — squad building is a planned Phase 3 feature that will need a home
— but it asks the member to pay a permanent tab now for a page that is empty
now, and BUILD_SPEC Part XV can place squad building when it exists rather
than reserving a slot speculatively (the same reasoning PROGRESS records for
the original nav overhaul).

Rejected: **implementing the ARIA menu pattern** on the account panel. The old
`MoreMenu` set `role="menu"` with `role="menuitem"` links while containing a
heading, a divider and a `div`-wrapped button — none of them valid menu
children — and implemented none of the roving focus, `tabindex` management or
focus return the role promises. Making that true costs 50–70 lines for a
control that should not be a `menu`: a dropdown of navigation links is a `nav`
with links. The roles are dropped instead (three attributes deleted, one line
of focus-return added), which also makes it consistent with `LensMenu`, the
repo's other dropdown, which never had roles.

Deferred: **a bottom sheet on mobile** instead of the reused desktop dropdown.
It is the right end state and is filed with the rest of the mobile pass, where
it belongs with the compressed page headers, the filter sheet and the sticky
detail action. The dropdown shrinks from nine rows to four plus logout in this
change, so it gets better rather than worse in the meantime.

Reason: a navigation whose overflow menu holds club-wide content, personal
economy state, the member's inbox, help and account in nine unlabelled rows is
not an overflow menu — it is a second, worse navigation. Removing it forces
every destination to justify a home, and the ones that could not find one
(`/club`) turned out not to need to exist.

Consequences: **front-end only — no migration, no schema, no economy value.**
Part L invariants are untouched; nothing here changes ownership, the ledger,
pack results, ratings or authorization. `getNavContext` is unchanged and still
fetches both counts — `/market` and `/market/offers` now call it too, which is
free because it is `React.cache()`d and the `(app)` layout has already called
it in the same request, and it guarantees the tab badge and the chrome badge
cannot disagree. Five icons lost their last consumer: `IconClub`, `IconMenu`,
`IconDirectory` and `IconOffer` are deleted, while `IconScale` and
`IconSessions` are reused on the Collection header and Home's Chronicle link;
`IconUser` is new. `admin-tabs.tsx` becomes a wrapper over `SectionTabs`, which
raises its targets from ~34px to the ~44px `BUILD_SPEC.md` §52 asks for. The
duplicated Album/Manage toggle is resolved as a side effect: both Collection
headers now render through one `CollectionHeader`.

`BUILD_SPEC.md` §46 rewritten with the new structure; §47 gains Home's
Chronicle link. Verification: `npm run verify:fast` (87 unit tests, up 32) +
`next build`, then driven against a local Supabase stack with a real incoming
trade offer at 320px, 390px and 1440px.
