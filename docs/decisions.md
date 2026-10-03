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

Superseded in part by ADR-072 (2026-09-16): the listing duration is no longer
fixed at 24 hours — a seller chooses 24 or 72. Everything else in this ADR,
including the locking, tax and atomicity rules, still stands.

Decision: The marketplace uses buy-now listings only. Listings retain
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

Status: Accepted (amended by ADR-110: an unclaimed Player's archetype also
rotates weekly, at the Midweek open)

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

## ADR-054 — The club activity feed excludes superadmin activity

Date: 2026-09-05

Status: Accepted

Decision: `kut.activity_feed` (ADR-038) is `create or replace`d so each of its
five unioned branches carries a `role <> 'superadmin'` guard on whichever
profile(s) generated that row — seller and buyer for `sale`, seller and
proposer for `trade`, seller for `listing`, opener for `pack`. The `session`
branch is untouched: a published session is a club-wide fact, not one
member's economic activity, so there is no actor role to check.

Migration `20260915000000_activity_feed_excludes_superadmin.sql`: one `create
or replace view`; no table, column or grant change.

Reason (KB-009): the superadmin account is used for production demos and
manual testing, and its pack openings, sales, listings and trades were
appearing in the member-facing feed on Home (ADR-039), muddying the real
club's activity history with test noise.

Rejected: filtering in the query layer (`src/lib/activity.ts` /
`src/app/(app)/page.tsx`) instead of the view. The view is the single read
path for this projection — filtering there keeps the guarantee in one place
rather than something every future caller has to remember to repeat.

Consequences: tier is **additive** (ADR-032) — the underlying tables
(`kut.market_sales`, `kut.trade_offers`, `kut.market_listings`,
`kut.pack_openings`) and their RLS are unchanged, so the superadmin's ledger
and audit history are fully retained; only this read projection is narrower.
Reversible by restoring the view to its 20260911000000 body. Three new pgTAP
cases in `supabase/tests/database/activity_feed.test.sql` cover a
superadmin-authored sale, listing and pack each being excluded, alongside the
existing member-authored fixtures that must still show. No front-end change —
`kind`, `actor_name`, `counterparty_name`, `card_name`, `amount`,
`session_date` and `session_type` are all unchanged, so `src/lib/activity.ts`
and Home's rendering are untouched.

## ADR-055 — Special editions are scaffolded but not issued

Date: 2026-09-06

Status: Accepted

Decision: Special editions now require frozen player identity, rating, rarity,
description and artwork metadata. Their 30–95 OVR range is intentionally
separate from a Live card's 30–83 range. The migration issues no Special
edition or copy, and packs remain Live-only.

Reason: this establishes an auditable immutable model without inventing an
issuance event before its product rules exist.

Consequences: `20260916000000_special_edition_scaffolding.sql` adds only the
schema and integrity boundaries. Activation needs a separately reviewed
issuance migration and product decision.

## ADR-056 — Club Value discounts duplicate copies by edition

Date: 2026-09-06

Status: Accepted

Decision: copies 1/2/3/4+ of one edition contribute 100% / 20% / 5% / 0% of
that edition's discard value to Club Value. Discarding a copy still pays its
full discard value; Club Value is not a payout rule.

Reason: the concrete values from the revised feature package reward collection
breadth while preserving existing ownership and discard invariants.

Consequences: `20260917000000_duplicate_club_value.sql` rebuilds the member
and leaderboard projections through one SQL helper; `20260920020000` grants
that projection helper to the intended read roles after local compatibility
testing.

## ADR-057 — Basic packs cost 175 coins and require a quoted price

Date: 2026-09-06

Status: Accepted

Decision: the basic three-card Live-only pack costs exactly 175 KUT Coins.
`open_pack(slug, expected_price, idempotency_key)` rejects a stale quote before
any debit and preserves replay-safe prior outcomes.

Reason: price is a server-side economic contract, not client authority.

Consequences: `20260918000000_basic_pack_175.sql` changes the price and RPC
contract. Local active-roster measurement is 87.46 expected discard coins per
pack (49.98% of price); a fresh hosted-roster measurement is still required
before activation and does not authorize changing the requested price or odds.

## ADR-058 — Wants are private; availability starts a conversation

Date: 2026-09-06

Status: Accepted

Decision: members may keep up to 100 private wants and mark up to 30 owned
copies explicitly available. Wanted and available selectors share one screen.
A want sees only relevant owner display names and a channel-neutral copyable
prompt. There is no reciprocal matcher, offer engine, or
new escrow path.

Reason: this is the revised social handoff, using the existing exchange paths
without exposing private lists or creating a second transaction system.

Consequences: `20260919000000_wants_trade_availability.sql` enforces owner
RLS, caps, cleanup and fulfillment. `20260920030000` is a local compatibility
correction for the established pack availability column names; `20260920060000`
routes listing visibility through the same public projection as Market.

## ADR-059 — Member reports are versioned, rewarded once, and finalized reliably

Date: 2026-09-06

Status: Accepted

Decision: published attendance opens a 24-hour self-report form. A valid
completed form, including explicit zero goals and skipped kudos, earns 50
coins once per player/session. Admins may correct member or guest goals with a
reason and immutable audit; corrections never pay. Rating v2 is selected per
published session from a season cutover and writes historical snapshots when
the survey finalizes.

Reason: the reward, ratings and history must be database-authoritative and
remain explainable after edits or legacy sessions.

Consequences: `20260920000000_session_reports_rating_v2.sql` adds the report,
receipt, survey, results, correction and versioned rebuild model.
`20260920010000`, `20260920040000` and `20260920050000` harden service
finalization, persisted submit state and Chronicle reads. Scheduled hosted
finalization is an operator activation step; the bounded service RPC is the
safe fallback.

## ADR-060 — Chronicle shows aggregate open progress; first kudos recognition is +1 Form

Date: 2026-09-06

Status: Accepted

Decision: During an open v2 survey, Chronicle shows the number of submitted
forms, eligible accounts, aggregate goals reported so far, the actual deadline,
and the current member's report action. It does not expose individual
provisional goals, nominees, ballots, or raw vote counts. Finalized Chronicle
rows remain the only player-level results. Qualified kudos categories now score
0 / 1 / 1.25 / 1.5 Form for 0 / 1 / 2 / 3 recognized categories, preserving
the existing +1.5 kudos cap and +3 combined session cap.

Reason: The prior Chronicle inferred survey state from the absence of finalized
rows, which falsely labelled open reporting as closed and displayed zero goals.
The original +0.5 first-category award also made a clear four-person consensus
feel incidental. A +1 first recognition is legible, while diminishing returns
keep broader recognition valuable without increasing the balance-review caps.

Consequences: `20260920080000_chronicle_open_progress_and_kudos_ladder.sql`
adds a security-definer aggregate-only Chronicle projection, rebuilds the weekly
goal aggregate, replaces the finalizer's kudos ladder, re-scores existing
derived local result rows and deterministically replays affected seasons.
`20260920090000` makes the accepting-reports decision database-authoritative.
Raw reports, ballots, rewards, transactions, survey timestamps and audit records
are unchanged. TypeScript uses the same ladder and the balance simulation is
rerun.

## ADR-061 — Survey finalization runs as a server-side lazy fallback

Date: 2026-09-06

Status: Accepted

Decision: `kut.finalize_session_surveys(20)` — the bounded, service-role-only
finalizer — is invoked from the server render of the Chronicle week issue
(`/chronicle/[week]`) and a member's session report (`/sessions/[sessionId]/report`)
via `finalizeDueSurveys()` in `src/lib/session-reports/finalize-due-surveys.ts`.
The helper first runs one `count` query for surveys that are `open` with
`closes_at <= now()`, calls the RPC only when that count is non-zero, throttles
repeat attempts to once per 60s per warm process, and swallows every error. No
scheduled runner (Vercel Cron, pg_cron) is added.

Reason: the club is small and the Chronicle is opened routinely, so a
visit-driven trigger finalizes closed surveys within hours without a scheduler,
a cron secret, or a Vercel plan dependency. `finalize_session_surveys` already
claims due rows `for update skip locked` and re-checks status, and
`_finalize_one_session` re-locks the survey, so concurrent page loads at worst
add an empty `session_survey_jobs` row. The RPC and its grants are unchanged.

Consequences: no migration. `src/lib/session-reports/finalize-due-surveys.ts` is
new; the two page components call it after `requireUser()`. The Messages page
event-type union and label map gain `session_report`, `session_results`,
`report_correction` (already emitted server-side) and `kudos_awarded`. An
operator may still install a scheduled runner later for punctuality; this
fallback and the manual bounded RPC remain the supported paths meanwhile.

## ADR-062 — Member-reporting cutover move: withdrawn, never shipped

Date: 2026-09-07 (recorded after the fact; the withdrawn work was dated 2026-09-06)

Status: Withdrawn — superseded by evidence, no migration shipped

Decision: the proposed migration `20260921000000_kudos_cutover_2026_09_07.sql`,
which would have moved `kut.season_rating_rules.v2_starts_week` from
`2026-09-28` to `2026-09-07`, is withdrawn and its branch deleted. No schema or
data change was made. The ADR number is retained as a tombstone so the gap
between ADR-061 and ADR-063 is explained rather than looking like a lost record.

Reason: hosted never held `2026-09-28`. The base migration
`20260920000000_session_reports_rating_v2.sql` seeds the cutover as
`coalesce(max(published session week) + 7, this week + 7)`, evaluated at deploy
time. Hosted's last published session was `2026-09-04`, whose football week
begins `2026-08-31`; `+ 7` gives `2026-09-07` — already the intended value.
Verified on hosted 2026-09-07: the active season `TFH 2026` reads
`v2_starts_week = 2026-09-07`, and the two published sessions (`2026-08-31`,
`2026-09-04`) are correctly stamped `rating_rules_version = 1`. The `2026-09-28`
figure came from the local seed environment, whose fixture data contains
future-dated published sessions that push the same formula three weeks out. The
withdrawn migration was guarded (`where v2_starts_week = date '2026-09-28'`), so
it would have matched zero rows and done nothing.

Consequences: none to the schema. Two things are worth carrying forward.

First, a correctness note the withdrawn migration got wrong in its own header.
It claimed that because `rating_rules_version` is stamped per session at publish
time, "sessions already published keep their version" and a cutover move is
therefore safe. `kut._rebuild_season_core` does not work that way: it branches on
`if v_week.week_start < v_cutover`, the week against the cutover date, not the
session's stamped version. Moving a cutover *backwards* past an already-published
week therefore flips that week to the v2 branch, which reads
`session_report_results` filtered on `rating_rules_version = 2`. A v1 session
contributes nothing, `v_v2_count` is 0 so the legacy carry multiplier is also 0,
and Form collapses to 0 for every player that week. Any future cutover change
must check for published sessions in the affected weeks first.

Second, an ADR that asserts a hosted verification should record the value it
observed. This one stated "Precondition verified on hosted before deploy" while
the matching `PROGRESS.md` entry recorded only a local `npm run test:db` run —
which is what let a local seed artifact be mistaken for hosted state.

## ADR-063 — Kudos Form ladder rises to +2, combined session cap to +3.5, and recognised players are notified

Date: 2026-09-06

Status: Accepted

Decision: qualified kudos categories now score 0 / 1 / 1.5 / 2 Form for
0 / 1 / 2 / 3 recognised categories (was 0 / 1 / 1.25 / 1.5). The combined
per-session Form input cap rises from 3 to 3.5, so a hat-trick scorer who also
earns full kudos banks the whole bonus; goals still cap at 1.5 and the v2 Form
ceiling stays 8. At finalization every player with at least one recognised
category also receives a `kudos_awarded` notification. It never names a
nominator and reports the player's OVR movement from finalising that session
(goals + kudos combined), or no number when the movement is not positive. It is
sent in addition to the club-wide `session_results` notice and is idempotent per
player/session, so an admin goal correction that re-finalises does not resend or
restate it.

Reason: the +1.5 kudos ceiling made broad multi-category recognition worth
little more than a single category, and a strong goal night left no room for
kudos at all under the +3 combined cap. Players recognised by teammates had no
signal that it happened or that their card moved.

Consequences: `20260922000000_kudos_cap_two_and_award_notice.sql` widens the
`session_report_results` `session_input` check to `0..3.5`, adds `kudos_awarded`
to `user_notifications.event_type`, `create or replace`s `kut._finalize_one_session`
(new ladder, `least(3.5, …)`, pre-rebuild OVR snapshot, the extra insert), then
re-scores existing derived result rows and deterministically replays affected
seasons. Reports, ballots, rewards, transactions and survey audit times are
unchanged; historical finalised sessions do not emit `kudos_awarded`.
`src/game/rating-engine.ts` mirrors the ladder and the 3.5 cap; `BUILD_SPEC.md`
amendments and `RATING_BALANCE_REVIEW.md` are updated. The kudos and combined
caps remain review numbers, not Part L invariants.

## ADR-064 — The TypeScript rating and economy formulas are deleted, not mirrored

Date: 2026-09-07

Status: Accepted

Decision: the TypeScript re-implementations of the rating engine and the
economy formulas are removed. `src/game/rating-engine.ts` keeps only what a
screen actually renders — `RARITY_BANDS`, `getRarityTier`, `ARCHETYPE_OFFSETS`,
`calculateActivityOvr` and `calculateLiveDiscardValue`. `src/game/economy.ts`
becomes constants only (`ECONOMY`). Deleted: `calculateFormScore`,
`calculateWeeklyPerformance`, `calculateActivityScore`, `calculateLiveOvr`,
`calculateAttributes`, `createInitialRatingState`, `calculateRatingStateForWeek`,
`rebuildRatingState`, the v2 group (`calculateGoalForm`, `calculateKudosForm`,
`calculateSessionInput`, `calculateVersion2FormScore`), the Club Value and
pack-EV helpers (`calculateClubValue`, `calculateDuplicateEditionValue`,
`calculateExpectedPackEconomy`, `getPackReturnStatus`, `LIVE_PACK_WEIGHTS`),
`src/game/card-editions.ts` (`resolveCardEdition`), and `src/game/demo-players.ts`.
This supersedes the sentence in ADR-063 that says `rating-engine.ts` mirrors the
kudos ladder and the 3.5 cap — it no longer does, and does not need to.

Reason: none of it was reachable from `src/`. Every one of those exports was
imported only by its own unit test, and `demo-players.ts` was imported by
nothing at all. The engine that actually runs is `kut._rebuild_season_core` and
the economy RPCs; the TypeScript was a parallel implementation asserted only
against itself. That is worse than no coverage, because a green unit suite
implied the rules were verified while SQL could change underneath it without
turning anything red. The same numbers already have real assertions against the
database in `next_features_contracts.test.sql` (the 100/20/5/0 duplicate ladder)
and the rest of the pgTAP suite.

The alternative considered was building a parity harness that runs SQL and
TypeScript over shared fixtures and asserts equality. That is the only thing
that would make a mirror trustworthy, but it is a real piece of infrastructure
and it is only worth building if the TypeScript is going to serve the UI. It is
not, so the mirror was deleted instead. If a screen later needs to compute a
rating client-side, add the function back together with that harness — not on
its own.

Consequences: `src/game/` drops from 589 to 228 lines.
`tests/unit/economy.test.ts`, `tests/unit/rating-v2.test.ts`,
`tests/unit/card-editions.test.ts` and `tests/fixtures/rating-scenarios.json`
are deleted; `tests/unit/rating-engine.test.ts` keeps the display-helper
invariants and gains an archetype-offsets-sum-to-zero check (BUILD_SPEC §589).
`ECONOMY` gains `duplicateEditionWeights`, so the Club Value screen renders the
100/20/5/0 ladder from the same constant the comments point at instead of a
literal array. `scripts/measure-pack-ev.mjs` now reads `kut.pack_economy_health`
— the admin projection that already computed expected pack value — instead of
keeping a fifth copy of the rarity weights, the discard curve and the pack
price; it resolves an admin profile and reads the view as that member, because
the view is `security_invoker` and gated on `kut.is_admin()`.

`design/features/check-rating-balance.mjs` is retired in the same change. It
was the one consumer of the deleted formulas outside the unit tests — a
design-time balance harness for ADR-063, a decision already shipped — so
keeping it working would have meant keeping the mirror. Its outputs
(`RATING_BALANCE_REVIEW.md`, `design/features/rating-balance.json`) stay as the
record, marked as point-in-time. A future balance exercise should measure
`kut._rebuild_season_core` directly.

The Special-edition scaffolding is unaffected at the database level:
`20260916000000_special_edition_scaffolding.sql` and `special_editions.test.sql`
still hold the frozen-snapshot and immutability rules, and issuance is still
zero. Only the unused TypeScript resolver went. Whoever builds Special editions
writes the resolver against the SQL contract then, with a consumer attached.

## ADR-065 — Prettier formats the TypeScript source; the docs and migrations are left alone

Date: 2026-09-07

Status: Accepted

Decision: Prettier 3.9.6 is adopted as the repository's formatter, pinned to an
exact version, and `format:check` becomes the first step of `verify:fast`. It
owns `.ts` / `.tsx` / `.mts` / `.mjs` / `.css` under `src/`, `tests/` and
`scripts/`, plus the seven root build and test configs — 164 files. Everything
else is denied in `.prettierignore`, which is the single source of truth for the
formatter's reach because it governs format-on-save in an editor as well as the
npm scripts. `docs/`, `design/` and `supabase/` are outside it, deliberately.

Reason: the repo had no formatter, no `.editorconfig`, and `eslint-config-next`
enforces no formatting rules, so style was whatever each session happened to
produce. It had forked in two. Files written earlier are conventionally
formatted; files from the 2026-09-06 feature push are single enormous lines —
`src/app/(app)/admin/attendance/[sessionId]/reports/page.tsx` was **eight lines
long in total**, with the entire React component on line 8 at 3,845 characters.
Sixteen files carried a line over 400. That file grew from 3,734 to 3,845 in the
ADR-064 sweep because a correct fix added column names to it: without a
formatter every legitimate change makes such a file worse, and no reviewer can
read it in a PR diff. The same drift is visible in SQL, where migrations
`20260916`–`20260919` use `set search_path = kut, pg_catalog` and `20260920+`
use `set search_path=kut,pg_catalog`.

`printWidth` is 100, and it was measured rather than chosen. Formatting the
pre-reformat tree at each candidate width gives:

| printWidth | files changed | churn (± lines) | lines left over 100 chars |
|---|---|---|---|
| 80 (Prettier default) | 136 | 8,747 | 293 |
| 90 | 123 | 7,264 | 293 |
| **100** | **111** | **6,034** | **299** |
| 120 | 97 | 4,374 | 797 |

100 costs 31% less churn than the default 80 at an effectively identical count
of residual long lines. That floor of roughly 295 lines is `className` string
literals — Prettier never breaks a string literal, so no width fixes them, and
201 of them already exceed 80 characters on their own. 120 buys further diff
reduction only by declining to break lines that should break, tripling the
over-100 count. An earlier draft of this decision argued for 80 on the grounds
that comment prose in `src/` wraps at p50=76 / p90=81; that reasoning was
discarded because Prettier never reflows comments, so the statistic says nothing
about code width. Every other value in `.prettierrc.json` is a Prettier 3
default, written out explicitly so a future major cannot silently restyle the
repo the way v3 changed `trailingComma`. Double quotes, semicolons and 2-space
indent match what is already there: 474 double-quoted imports against zero
single-quoted, and no tabs.

Prettier rather than Biome. Biome's value is being linter and formatter at once,
and neither half is free here. Taking only its formatter still installs a
platform-specific native binary — the same install shape that already fails on
the maintainer's machine (`npm ci` EPERM on Next's SWC binary under OneDrive,
which is why `npm install` is used locally). Taking its linter too would drop the
22 `@next/next/*` and 16 `react-hooks/*` rules, the React Compiler set among them
(`purity`, `immutability`, `set-state-in-render`, `preserve-manual-memoization`),
which Biome does not reimplement. That is a bad trade for formatter speed on 164
files where ESLint already finishes in seconds. `prettier-plugin-tailwindcss` was
also considered and rejected: class sorting would balloon the diff and reorders
utilities whose order can matter.

`eslint-config-prettier` is **not** installed, and that was checked rather than
assumed. `npx eslint --print-config src/app/page.tsx` resolves 86 rules to
`error`/`warn`; cross-checking every one against `eslint-config-prettier`'s
conflicting list — core stylistic (`indent`, `quotes`, `semi`, `max-len`,
`comma-dangle`, …), `@typescript-eslint/*` stylistic, and `react/jsx-*` layout —
yields zero hits, and its four "special" rules (`curly`, `no-confusing-arrow`,
`no-unexpected-multiline`, `lines-around-comment`) are absent too. It would be an
inert dependency. Re-run that command if `eslint-config-next` ever adds
stylistic rules.

`format:check` goes into `verify:fast` only, not into
`.github/workflows/verify.yml` as well. The CI `fast` job already runs
`npm run verify:fast`, so one definition covers local and CI and the two cannot
drift; the workflow needed no edit. It runs first in the chain because it is the
cheapest check and should fail before a typecheck.

Consequences: 111 of the 164 in-scope files were reformatted (+4,923 / −1,107),
in a commit of its own so it can be read with `git diff -w` or skipped entirely.
Verification held flat across the change — `verify:fast` 14 files / 85 tests,
pgTAP 14 files / 449 assertions, the integration race suites 3 files / 5 tests,
and `npm run build`, all PASS before and after with identical counts.

Three things this turned up that are worth keeping.

**Prettier is not idempotent on member chains.** A single `prettier --write .`
pass left two files that `--check` then rejected:
`src/app/(app)/sessions/[sessionId]/report/actions.ts` and the sibling
`admin/attendance/[sessionId]/reports/actions.ts`, where a
`supabase.schema("kut").rpc(...)` chain breaks or collapses depending on whether
the *input* had it split across lines, so `format(format(x)) != format(x)`. Left
at one pass, `format:check` would have failed in CI forever on a tree that had
just been formatted. The tree is at the fixed point, reached after one extra
pass. If a future bulk reformat is ever run, run `format` until `format:check`
passes rather than assuming one pass is enough.

**`.prettierignore` uses gitignore semantics, so directory patterns must be
anchored.** An unanchored `supabase/` also matches `src/lib/supabase/`, and it
silently dropped five real source files from formatting before it was caught by
reconciling the expected file count against Prettier's own `--file-info`. Every
directory pattern in that file now carries a leading slash, and the reason is
recorded in the file itself.

**JSX text is the only place a reformat can change behaviour.** Prettier is
AST-preserving, but reflowing JSX inserts and removes `{" "}` to keep meaningful
spaces across line breaks — this diff went from 27 occurrences to 59, with 14 on
the removed side — and neither Vitest nor pgTAP would notice a lost space. So
every changed `.tsx` was parsed with the TypeScript compiler and its rendered
text reconstructed under React's JSX whitespace rules (leading and trailing
whitespace-with-newline dropped, interior runs collapsed to a single space), then
compared before against after. All 72 render identical text; zero mismatches.

Two lines over 400 characters survive, in `market-race.test.ts` and
`trade-race.test.ts`. Both are single-quoted SQL `insert` statements, and
Prettier never breaks a string literal; shortening them means editing them, which
is not a mechanical reformat.

`main` is squash-merge only, so the reformat commit's SHA never lands on it and
`.git-blame-ignore-revs` cannot be completed inside the PR that does the
reformatting — and a SHA git cannot resolve makes `git blame` fail outright,
which is worse than having no file. The file therefore ships with its rules and
its local opt-in documented but no SHA, and a follow-up PR adds the squashed
commit's SHA once `main` has it. Documentation is left unformatted for the same
reason it is unversioned prose: reflowing `BUILD_SPEC.md` (4,783 lines) and this
ADR log (2,714) would produce an unreviewable diff and destroy the line history
`git blame` gives those decision records. `supabase/` is left alone because those
migrations are already deployed to the hosted schema.

The follow-up PR that registered the squashed SHA measured what the entry
actually buys, and it is not free. Across the 111 reformatted files, the lines
wrongly blamed on the reformat drop from 4,923 to 151 — 4,772 lines of
authorship restored. But across the files the same commit genuinely authored
(this log, `PROGRESS.md`, `README.md`, the two Prettier config files), the lines
correctly blamed on it fall from 278 to 93: 185 lines lose their attribution.
Squash-merging is the cause. Because `main` takes one commit per PR, that SHA
bundles the mechanical reformat with the config and this ADR, and `--ignore-rev`
is all-or-nothing; for lines a skipped commit genuinely authored, git hunts for
the most similar line in the parent rather than admitting it has no answer, and
scatters the ADR-065 block across roughly 25 unrelated commits. The entry is
kept because the ratio is 26 code lines recovered per prose line lost, and
because these documents date themselves — every ADR carries a `Date:` and every
`PROGRESS.md` entry is dated in its heading — so `git blame` was never how they
are read. A future bulk reformat that can be landed as its own commit on `main`
should be, rather than bundled into a PR that also adds content.
## ADR-066 — Chronicle results are a definer projection; finalization is provable without survey eligibility

Date: 2026-09-08

Status: Accepted

Decision: `kut.chronicle_session_reports` is recreated with
`security_invoker=false`, matching its sibling
`kut.chronicle_session_report_status` (ADR-060 / `20260920090000`). The
`"members read finalized results"` policy on `kut.session_report_results` stops
proving finalization with an inline `exists()` over `kut.session_surveys` and
calls a new `security definer` predicate, `kut.is_survey_finalized(uuid)`,
instead. Migration `20260923000000_chronicle_results_visibility.sql`; no data
change.

Reason: the Chronicle is the club's newspaper, but its per-player results were
readable only by the people who were *at* the session. The projection ran as the
reader, and its inner join to `kut.session_surveys` meets
`"eligible members read surveys"`, which admits `kut.is_admin()` or a member
holding a `kut.session_survey_eligibility` row — i.e. an attendee. Everyone who
missed the session read zero rows and the issue page fell through to its
"Results finalized. No report results were recorded." empty state (KB-013),
while an admin on the same URL saw the full table. The policy on the results
table had the same defect for the same reason: Postgres applies a referenced
table's RLS inside a policy expression, so that `exists()` could not see the
survey row either. The two-layer failure is why the symptom was total rather
than partial.

Making the view a definer projection also repairs three columns that were
quietly wrong for everyone: `submitted_reports`, `eligible_accounts` and
`attendee_count` are sub-selects over `kut.session_reports` and
`kut.session_survey_eligibility`, both RLS-scoped to the reader's own rows, so
an attendee computed "1 of 1 reports submitted". The page never showed it
because it prefers the status view's counts and only falls back to these, but
the columns are part of the contract and now mean what they say.

Nothing new is disclosed. `effective_goals` is already published club-wide as
`chronicle_session_report_status.goal_total`; `recognized_categories` lists only
categories two or more nominators agreed on, which is the feature; `goal_form`,
`kudos_form` and `session_input` are pure functions of those two under the
ADR-063 ladders; and the three count columns duplicate ones the status view
already grants. Raw ballots (`kut.session_kudos`) and provisional reports
(`kut.session_reports`) keep their own RLS and are never read here. The join to
`session_surveys` on `status='finalized'` is now the *only* thing keeping an open
session out of the projection — it is load-bearing, and the pgTAP cases assert
it by reopening a finalized survey and re-reading as a member.

Consequences: `kut.is_survey_finalized(uuid)` is new, executable by
`authenticated` and `service_role`. Six pgTAP assertions in
`next_features_contracts.test.sql` cover a member with no eligibility row
reading a finalized issue, the club-wide count, direct `session_report_results`
access, and both no-leak cases while the survey is open. Rollback restores the
invoker view and the inline-`exists()` policy and drops the function; it
reinstates the blackout.
## ADR-067 — An admin can close a report window early; the deadline is left on the record

Date: 2026-09-08

Status: Accepted

Decision: `kut.admin_finalize_session_survey(uuid, text)` lets an admin finalize
a published session's report window before its 24 hours elapse. It is a gated,
audited front door to the existing `kut._finalize_one_session` — same scoring,
same season rebuild, same notifications — and adds no rating maths. It requires
`kut.is_admin()` and a 3–500 character reason, refuses a cancelled survey,
returns `already_finalized` rather than raising on a second press, and returns
the attendee / eligible / submitted counts plus whether the kudos quorum was
met. `kut.session_surveys` gains nullable `finalized_by` and `finalized_reason`.
Migration `20260924000000_admin_finalize_session_survey.sql`.

Reason: the 24-hour wait is the right default for a club where people report
from the pub car park hours later, but it is the wrong default once everyone
present has actually filed. Waiting a further ten hours to see the week's
ratings — and the ADR-061 lazy fallback needing somebody to open a page after
that — is friction with no integrity purpose. Nothing downstream needed
changing, because every consumer already keys off `session_surveys.status`:
`submit_session_report` rejects a status other than `open`,
`finalize_session_surveys` only selects `open` rows so it cannot double-run, and
`chronicle_session_report_status.accepting_reports` flips on its own.

`closes_at` is deliberately not moved. `session_surveys` carries
`check (closes_at = opened_at + interval '24 hours')`, so rewriting it would mean
rewriting `opened_at` and erasing when the window actually opened. Leaving it
means the published deadline stays on the record and `finalized_at < closes_at`
is what identifies an early close. `finalized_by` and `finalized_reason` stay
null on the automatic path and on the re-finalization `admin_correct_session_goals`
triggers, so null reads as "closed at its deadline" — asserted in the tests.

Consequences: a member who had not submitted when an admin closes the window
loses both the ability to submit and the 50-coin completion reward. That is
inherent to closing it and is not softened here; instead
`/admin/attendance/[sessionId]/reports` states the pending count, the reward
consequence and the three-ballot kudos quorum in the panel above the button, and
requires the reason before it will submit. Rewards already earned are untouched.
No extra notification event type was added — finalization already sends
`session_results` to every eligible member, and widening the
`user_notifications.event_type` check to say "closed early" would change a
constraint for a sentence. 21 pgTAP assertions in
`admin_finalize_session_survey.test.sql` cover the gate, the reason, the audit
columns, the preserved deadline, the quorum, the closed window, the untouched
reward, idempotence, and the automatic path's null audit trail.

## ADR-068 — The kudos ballot is React-controlled, and an unanswered category is not a Skip

Date: 2026-09-08

Status: Accepted

Decision: the session report form (`src/app/(app)/sessions/[sessionId]/report/`)
dispatches its server action from an `onSubmit` handler instead of
`<form action={fn}>`, holds every kudos category in React state, and gives each
category three states rather than two: a nominee, an explicit Skip, or
**undecided**. Undecided is the opening state, is sent to
`kut.submit_session_report` by omitting the category from `p_nominations`, and
blocks a submission (a draft still saves). The decision logic lives in
`src/lib/session-reports/kudos-ballot.ts` and is unit-tested. No migration: the
RPC already accepted a missing category on a draft and raised on a submission,
and its contract is unchanged.

Reason: two defects, one of which corrupted the first live kudos round (KB-015).

React resets a form with a *function* action once that action settles —
`startHostTransition` calls `requestFormReset` unconditionally
(`react-dom` 19.2.8), and the reset restores every control to the default it was
**mounted** with. React keeps a controlled `<input>` safe from this by syncing
the element's `defaultValue` to the current value on every commit, but it does
nothing equivalent for a `<select>`, and it never re-applies a changed
`defaultValue` to one either. So the kudos selects reverted on every save, while
the goals field — same form, controlled `<input>` — survived, which is exactly
how the report reached us: "the selection for players resets". Reproduced
against the local stack: pick three teammates, press Save draft, get "Your
report is saved", and watch all three dropdowns snap back. Making the selects
controlled is necessary but **not** sufficient — verified, they still reverted —
so the dispatch moved off the `action` prop.

The second defect is what made the first one expensive. "Skip" was the first
option, so an untouched select already read as a deliberate Skip and Submit
accepted it. A member whose picks had just been silently reverted could save
again and cast three explicit Skips without ever seeing a warning; three of nine
did. Separating "not answered yet" from "Skip" removes the silent path in both
directions — nobody skips by inertia, and nobody's reverted ballot can be
resubmitted as one.

Consequences: the form is now JavaScript-only in a way it was not before —
`onSubmit` + `preventDefault` means no no-JS fallback. It already depended on
`crypto.randomUUID()` in the browser for its idempotency key, so nothing that
worked before stops working. Submit is disabled, with a named reason, while any
category is undecided or a teammate is picked twice; the duplicate rule is the
database's (`unique(session_id, nominator_player_id, recipient_player_id)`) and
is now caught inline instead of failing the whole save with a generic message.
The teammate list is sorted by display name — `kut.attendance` has no natural
order and is read by a sequential scan, so it was previously in heap order.
`explicit_skips` is read back from `kut.my_session_reports` so a saved Skip
reopens as a Skip, and only a genuine explicit Skip is ever written as one.

Not fixed here: `settings/card`'s archetype select shares the same React reset
and shows its pre-save value until a reload (KB-016). It is cosmetic — the save
succeeds and a reload shows the truth — and cannot turn a revert into a wrong
vote. Fixed in a follow-up with the same controlled + `onSubmit` combination.
`settings/club-name-form` and the admin goal-override inputs were suspected of
the same and then measured: they are fine. React's `updateInput` pushes a
changed `defaultValue` to the DOM on every update, so an uncontrolled `<input>`
picks up the revalidated value and the reset restores *that* — the asymmetry
with `<select>`, which gets no equivalent, is exactly why the goals field
survived while the kudos dropdowns did not.

## ADR-069 — The kudos notice names the categories and credits goals + kudos for the OVR move

Date: 2026-09-08

Status: Accepted

Decision: the `kudos_awarded` notification body introduced by ADR-063 is
rewritten to name every category the player was recognised in, in the order the
session's ballot presented them, and to attribute the rating movement to what
produced it — this session's reported goals *and* the kudos. A new immutable
helper `kut._join_names(text[])` renders the list as "Engine", "Engine and
Playmaker", or "Engine, Playmaker and The Wall". Migration
`20260925000000_kudos_award_notice_detail.sql`.

The four shapes the body can take:

- `Teammates recognized you for The Wall, Playmaker and Level Up this session.
  Your 2 goals and these kudos lifted your card rating +3 OVR this week.`
- `… Your 1 goal and these kudos lifted your card rating +1 OVR this week.`
  (singular where the count is one)
- `… These kudos lifted your card rating +1 OVR this week.` (no goals scored, so
  no goals claimed)
- `Teammates recognized you for The Wall this session.` (movement of zero or
  less, so no rating sentence at all — unchanged from ADR-063)

Reason: the old body said only "Teammates recognized you with kudos this
session. Your card rating rose +N OVR this week." Members could not tell what
they had been recognised *for*, which is most of the reward — the categories are
the compliment, the Form is the side effect. It also read as though the whole
week's movement came from kudos, when at finalization the movement is precisely
this session's goals plus its kudos; appearances were already counted when the
session was published. Naming both is accurate and answers the question the
vague version provoked.

Consequences: text-only. One `create or replace` of `kut._finalize_one_session`
plus one new helper; no table, constraint, grant, scoring rule or rating maths
changes, and no data change. Notices already written keep the ADR-063 wording,
because re-finalizing a session hits the existing `on conflict … do nothing` —
so the club will see a mix until the next session finalizes, which is preferable
to rewriting notices members have already read. The notice still names no
nominator, still goes only to players with at least one recognised category, and
still requires the unchanged quorum (a category needs two nominators, and the
session needs three ballots). Six new pgTAP assertions in
`next_features_contracts.test.sql` cover the full body of a single-category
notice, that it names no category the player did not win, and the one/two/three
and empty forms of the name join. The two- and three-category bodies were also
driven end to end against the local stack with the real club fixture.

## ADR-070 — The integration race suites become a real CI gate, and one migration per PR is enforced mechanically

Date: 2026-09-15

Status: Accepted

Decision: `tests/integration/` becomes a first-class, CI-gated suite. One config
(`vitest.integration.config.mts`) and one honestly-named script (`npm run
test:integration`) replace three configs and a misnamed script; each suite is
made independently correct; and the suite runs as a step of the existing
`database` job in `.github/workflows/verify.yml`. Separately, a new `migrations`
job enforces the one-migration-per-PR rule that `CLAUDE.md` has stated in prose
since the batching convention was written.

### Why the suites were worth rescuing

They are the only automated proof that `kut.buy_listing`, `kut.open_pack`,
`kut.respond_to_trade` and `kut.submit_session_report` actually serialize under
contention. pgTAP runs one session inside a rollback and structurally cannot
test a race — two connections are the whole mechanism. `BUILD_SPEC.md` Part
XX–XXIII requires these paths to be server-authoritative, and Part L invariant
#23 (an accepted trade is never written to `kut.market_sales`) is asserted
nowhere else in the repository.

They were nevertheless unrun in every sense: `vitest.config.mts` globs
`tests/unit/**`, no CI job invoked them, `trade-race.test.ts` had no script at
all, and `test:market-race` silently ran all three through a config whose name
claimed one. A fourth config, `vitest.next-features-race.config.mts`, narrowed
to a single file and had no script pointing at it.

### Making them trustworthy before making them a gate

The order matters: a gate nobody trusts is worse than no gate, so the
correctness work landed first and the CI step was made conditional on 20
consecutive green runs.

Two fixture-isolation changes, which answer different questions:

- **Namespacing.** `market-race` and `trade-race` both built their
  `kut.card_editions` row against the seed player
  `00000000-0000-4000-8000-000000000001` (`supabase/seed.sql`, "Alex Example").
  Neither deleted it, so — contrary to how the problem was first reported —
  there was no delete/re-insert race on that row and no fixture-id collision
  between the two suites. The undeclared dependency on seed data was still
  wrong: it makes a suite depend on a row it does not own and cannot see. Each
  suite now inserts and deletes its own `kut.players` row, and every id it
  writes sits under its own UUID prefix — `20000000-` for market, `21000000-`
  for trade, beside the `30000000-` that `next-features-race` already used. This
  is what makes each file correct *in isolation*.
- **`fileParallelism: false`.** This is what makes the suite correct *as a
  whole*. These suites mutate shared database state rather than rolling back the
  way pgTAP does, so the convention above is only ever as good as the next
  author's memory of it. Serializing costs about a second on a suite that runs
  in four, and immunises the entire class of problem for files nobody has
  written yet. Both, not either.

One genuine defect was fixed along the way, at a different line than the one
reported. The cleanup in `trade-race.test.ts` ran

```sql
delete from kut.wallet_ledger
where user_id = any($1::uuid[])
   or reason in ('trade_escrow','trade_unescrow','trade_sale')
```

whose `or` arm is unscoped: it deleted **every** trade ledger row in the
database, for every account, in both `beforeAll` and `afterAll`. Nothing else
writes those reasons today, so it never surfaced across the test suite — but
against a developer's local stack carrying real trade history it was destructive
on every run. The `user_id` predicate alone already covers every row the suite
creates, so the `or` arm is simply deleted.

Finally, the `DeprecationWarning: Calling client.query() when the client is
already executing a query` these suites emitted is gone. It came from three
`Promise.all` fan-outs issuing four, five and three queries on the *same*
`admin` client. All of them were post-race assertion reads, so they are now
awaited one at a time; `pg` is on 8.x, where this warns, and pg 9 removes the
behaviour. The `Promise.all`s that *are* the races run on separate clients,
which is legal and is the entire point — those are untouched, and now carry a
comment saying so.

### Where it runs, and why it blocks

A step of the existing `database` job, after `npm run test:db`. That job's
trimmed stack already provides everything needed: the suites connect by raw `pg`
to `127.0.0.1:54322` and need no PostgREST and no GoTrue, they insert into
`auth.users` as superuser and `set role authenticated` (both from the postgres
image, not gotrue), and their data dependencies — `kut.pack_definitions`
`'tfh-pack'` and the three kudos category ids — come from migrations rather than
`seed.sql`, and `supabase start` applies both. This was verified rather than
assumed. A separate job would re-pay a 2–3 minute `supabase start` for no extra
signal. pgTAP runs first because it is transactional and leaves nothing behind,
while these suites mutate and then clean up. The step carries
`timeout-minutes: 5`, because a concurrency suite that loses its lock ordering
does not fail — it hangs.

It blocks from day one, with no `continue-on-error`. The question is softer than
it looks: branch protection on `main` has `required_status_checks: null`, so no
check gates a merge today and every job in this workflow is already advisory. A
red step therefore cannot produce the intermittently-red *required* check that
was the concern; it produces visible pressure, which is the point. A
non-blocking step that nobody ever promotes is worse than none at all, because
it teaches everyone to ignore it. The real gate on correctness was the stress
run, not a soft landing afterwards.

### The migration guard

A pull-request-only `migrations` job fails any PR whose diff against the merge
base touches more than one `supabase/migrations/*.sql`. `CLAUDE.md` has stated
that rule in prose for as long as the batching convention has existed, and it
was violated once — 14 migrations in a single PR, now permanently on the hosted
schema and unrevertable without dragging unrelated work with them. Prose did not
hold; a mechanical guard is the only durable form of the rule.

It inspects only the files the PR itself changes, so the 64 migrations already
on `main` can never trip it — that is the mechanism, rather than an exemption
list that would need maintaining as the count grows. Verified against three
arms: this branch (0 migrations, passes), the ADR-069 PR `87549ee` (1, passes),
and the 14-migration commit `43ebedc` (fails, naming all 14).

There is deliberately no label override. The rule in `CLAUDE.md` is
unconditional, and because nothing is a required check a human can still merge
past a red run when they genuinely must — that is already the right amount of
friction, and a documented escape hatch would dilute a rule whose single
violation is permanent.

Consequences: no migration, no schema surface, and no application code touched —
`src/` is untouched entirely. `npm test` stays unit-only and database-free,
which is load-bearing: the CI `fast` job runs `verify:fast` with no Postgres, so
a single config using vitest `projects` was rejected precisely because a bare
`vitest run` would then reach for a database that is not there. `verify:full`
gains `test:integration`. The single-file config is not replaced, because it is
redundant — `npm run test:integration -- tests/integration/trade-race.test.ts`
takes a filename filter. The `database` job grows by roughly five seconds.
Historical references to `test:market-race` in `PROGRESS.md`, earlier entries of
this file, `SECURITY_REVIEW.md` and `archive/` are left alone as a dated record
of what was actually run at the time; `README.md` and `OPERATIONS.md`, which
describe what to run *now*, are updated.

## ADR-071 — Production release safety is fail-closed, SHA-bound, and non-deploying

Date: 2026-09-15

Status: Accepted

Decision: production readiness is represented by machine-readable evidence for
one exact commit SHA. The repository supplies the controls but makes no external
configuration change in this slice.

- `verify` runs for every PR and main push. An always-present `merge-gate`
  accepts skipped database/E2E/security jobs only for a mechanically classified
  docs-only diff. Executable changes require all of them. Gitleaks is pinned to
  the reviewed v8.30.1 linux/amd64 image digest. After one green landing run,
  branch protection should separately require `merge-gate` and `scan` (the bare
  job names GitHub reports; corrected 2026-09-15, see the addendum below).
- The ADR-070 migration count check becomes an immutable-history policy:
  modifying, deleting, copying or renaming a base migration fails; at most one
  migration may be added; and it needs a changed database test or a reviewed
  machine-readable exemption. Semantic Part L/RPC and risk-tier review remains
  human work.
- Production credentials use Windows DPAPI records under
  `%LOCALAPPDATA%\VibeTrunk\kut\credentials`, addressed by stable nonsecret
  locators `backup-encryption-v1` and `hosted-db-v1`. `.env.local` is accepted
  only by an explicit bootstrap command, never as runtime fallback.
- The backup orchestrator never receives secrets. One worker retrieves the two
  credentials, puts the database password only in its child environment, dumps,
  hashes and encrypts a pending candidate, deletes plaintext and exits. A new
  process independently retrieves the passphrase and decrypts/hash-compares.
  Only a passed candidate is atomically published. Rekey writes a new candidate
  and separately verifies both old and new plaintext hashes; it never overwrites
  existing generations.
- Production-sensitive Codex sessions request `gpt-6-astra` at high reasoning,
  with `gpt-5.6-sol` high as the explicit fallback. A `SessionStart` hook checks
  the active model and attests a launcher receipt. Codex hook payloads expose
  the model but not reasoning effort, so `high` is honestly launcher-enforced
  and receipt-recorded rather than claimed as runtime-attested. The Claude
  launcher/hook requires the current `opus` alias.
- `request-production-gate.ps1 -CandidateSha <sha>` requires a clean checkout,
  fresh successful GitHub jobs for that SHA (including the aggregate and secret
  scan), byte-identical central catalogue hashes, a fresh cold-verified backup,
  authenticated member/admin mobile E2E, finalizer readiness, and verified
  session evidence. Missing, skipped, stale, duplicated or mismatched evidence
  fails. Its manifest records `release_approval = not_granted` and
  `deployment_authorized = false`.
- Release approval is a second interactive artifact and still records
  `deployment_authorized = false`. The repository intentionally provides no
  deploy command. Vercel auto-deploy, GitHub branch protection, hosted migration
  application, pushes/merges and production secrets remain separately
  authorized external actions.
- One canonical production-invariants source is copied byte-for-byte into both
  agent entry points by a generator; `verify:fast` rejects drift. Separate
  prompts cover specification, migration, integration review and release
  sessions so the release prompt cannot smuggle in deploy authority.

Reason: the prior controls were good individual practices but did not compose
into a durable release boundary. Docs-only workflow filters meant a future
required check could remain pending; branch protection required no status
checks; migration history could still be modified; the backup passed secrets
on argv and verified in the same process; and no artifact tied CI, catalogue,
backup, mobile auth, finalizer and agent evidence to the commit being approved.

Consequences: this is tooling/docs only — no application code, schema,
migration, hosted data, Vercel setting or GitHub setting changes. Local release
gating now requires a Windows operator for DPAPI and a full local Supabase stack
for authenticated mobile E2E. The GitHub required-check change and any Vercel
cutover remain explicit manual follow-ups. The release gate is intentionally
strict: a docs-only candidate, an old green run, a missing backup, or a session
started before the candidate commit cannot be promoted by exception.

### ADR-071 addendum — corrections found in review before the slice landed

Date: 2026-09-15

A review of the unlanded ADR-071 working tree found five defects. They are
recorded here rather than as a new ADR because ADR-071 had not been committed,
so nothing was ever released with these behaviours.

1. **Destructive fixtures had no target guard.** The authenticated Playwright
   setup deletes and recreates `auth.users`, and every database suite read its
   connection string from an environment variable with only a loopback
   *default*. `request-production-gate.ps1` itself requires `API_URL` and
   `DB_URL` to be exported, so an operator holding hosted values would have
   pointed the fixtures at production. `tests/support/local-target.ts` now
   refuses a non-loopback host in the integration suites, the Playwright global
   setup/teardown, and the authenticated Playwright config, which fails before a
   browser starts. The single override is an exact acknowledgement phrase in
   `KUT_ALLOW_NONLOCAL_TEST_TARGET`; CI and every repository script leave it
   unset. Refusals name the host, never the connection string.
2. **The agent rule sets still auto-allowed the very actions ADR-071 called
   authorization decisions.** `git add`/`git commit`/`git push`, `git push
   origin main` and `npx supabase functions deploy` ran without prompting in
   `.claude/settings.json` and `.codex/rules/project.rules`. Commit, push and
   function deployment now prompt; pushing directly to `main` is denied. Being
   reversible never made a function deployment unattended — it ships code to the
   shared hosted project.
3. **The Claude session hook could not do what it claimed.** It returned
   `continue:false` on a model mismatch, but the hooks reference states that
   `SessionStart` cannot abort a session — `continue:false` is not honoured and
   exit code 2 is non-blocking there. It also treated an absent `model` as a
   violation, while the same reference says Claude Code "doesn't always include
   it", so the launcher would have blocked every session had blocking worked.
   The hook is now attest-only and records `hook` / `unavailable` / `rejected`;
   the gate fails closed on `rejected` or a missing attestation and labels
   `unavailable` as launcher-enforced in the manifest. Real runtime enforcement
   moved to a new `PreModelSwitch` hook, where exit code 2 does block: a
   production session cannot be downgraded off Opus mid-release. Both Claude
   hooks now have unit coverage; previously only the Codex one did.
4. **`finalizer-readiness.test.ts` did not test finalizer readiness.** It
   asserted EXECUTE grants and that a batch call returned a row. It now seeds a
   published session whose 24-hour window closed an hour ago (backdating
   `opened_at`, since the table's check constraint pins `closes_at`), with three
   submitting attendees and a two-nominator kudos category, then asserts the
   survey finalizes on the automatic path, per-attendee results and the
   ADR-063 ladder, weekly rating snapshots, a job row with null `error_text`,
   notices for every eligible member, and that a second pass does not
   re-finalize. The suppressed-error path in the deployed runner is exactly what
   the `error_text` assertion exists to catch.
5. **Backup tests covered only the happy path, and cleanup could mask a
   failure.** `test-kut-backup-pipeline.ps1` now runs 23 assertions including
   wrong credential, missing locator, tampered ciphertext, truncated ciphertext,
   wrong expected hash, refusal to overwrite, no evidence file on any failure,
   no leftover decrypted scratch file on any path, and rekey failure leaving the
   source byte-identical with no pending file. Separately, both orchestrators
   removed their work directory non-recursively, which throws on a non-empty
   directory; thrown from a `finally` that exception would have replaced the
   real error while leaving plaintext in `%TEMP%`. Cleanup is now recursive and
   downgrades its own failure to a warning.

Also corrected: `$matches` in the gate script shadowed PowerShell's automatic
`$Matches`, and the authenticated E2E ran only at Pixel 7 despite the plan
asking for a narrow width too — it now also runs at 320x568.

Receipt validation moved out of `request-production-gate.ps1` into
`scripts/lib/KutSessionReceipt.psm1`. The gate refuses a dirty checkout before
it ever reads a receipt, which made that logic unreachable from any test — the
extraction is what let `scripts/test-kut-session-receipt.ps1` cover it (21
assertions across both providers, candidate binding and freshness). The move
also surfaced a live defect: under `Set-StrictMode -Version Latest` a missing
property is a terminating error, so reading `model_attestation` off a Codex
receipt, which has no such field, would have failed the gate with a confusing
PowerShell error. Optional fields are now read through `Get-KutReceiptField`,
and the Codex hook writes the field too so the manifest is uniform.

Not addressed, and still open: `scripts/protect-kut-backup.ps1` does not zero
key and plaintext byte arrays in `finally` blocks, and its PBKDF2 uses the
SHA-1 PRF implied by the three-argument `Rfc2898DeriveBytes` constructor. Both
predate ADR-071 and neither is reachable without the passphrase, but the
original plan listed the zeroing as acceptance criteria and it was dropped.
Changing the KDF would break the `KUTBKP01` format every existing backup uses,
so it needs its own slice with a rekey path.

### ADR-071 addendum 2 — two defects that blocked the follow-up runbook

Date: 2026-09-15

Found immediately after ADR-071 landed as `c27f075`, while walking the
follow-up steps it defines. Both were in the landed slice; neither affected the
running application.

1. **The documented required-check contexts do not exist.** Four documents told
   the operator to require `verify / merge-gate` and `gitleaks / scan`. GitHub
   Actions reports a check run under its *job* name, so the real contexts are
   `merge-gate` and `scan`. Requiring the `workflow / job` form would have
   pinned contexts that never report, leaving every PR permanently pending and
   blocking all merges — the same never-starts failure the always-present
   aggregator was introduced to prevent, reintroduced through the runbook.
   `scripts/release/request-production-gate.ps1` was already correct, so this
   was prose-only. The docs now carry the bare names and a `gh api` one-liner to
   re-confirm them before changing protection.

2. **The credential bootstrap could not read a real `.env.local`.** It required
   `KUT_HOSTED_DB_PASSWORD`, the name `.env.example` introduced alongside it.
   The operator file predating it carries `KUT_SUPABASE_DB_PASSWORD`, which is
   referenced nowhere else in the repository. `validateBootstrapValues` now
   accepts either spelling for the `hosted-db-v1` locator, prefers the canonical
   one, and refuses outright when both are present with different values rather
   than guessing which secret to store under a locator nothing would re-check.
   Accepting an alias was chosen over documenting a rename because the
   alternative is hand-editing a secrets file to satisfy a naming change.

Neither is reachable from the deployed application: the first is documentation,
the second is a local operator script. The wider lesson is that ADR-071's
verification proved its scripts self-consistent without ever proving they matched
the environment they would run in — the check names were never read back from
GitHub, and the bootstrap was never resolved against a real `.env.local`. Both
are now covered: the bootstrap resolution is unit-tested against both spellings
and the conflict case, and the docs carry the command that re-derives the check
names from the API.

## ADR-072 — A seller chooses a 24-hour or 72-hour market listing

Date: 2026-09-16

Status: Accepted

Decision: `kut.create_listing` takes a duration and the seller picks it from a
two-value allow-list — 24 or 72 hours. 24 hours remains the default.

TFH has plenty of members who do not open the app every day, so a 24-hour
buy-now window could lapse before the people most likely to want a card ever
saw it. Rather than lengthening every listing and taking the short window away
from sellers who want a quick sale, the duration became a choice.

This changes a duration, not a mechanism. `kut.market_listings.expires_at` has
existed since `20260816070600_atomic_marketplace.sql` with a
`default (now() + interval '24 hours')`, and expiry has always been enforced by
`expires_at > now()` predicates in the table's RLS policy,
`kut.active_market_listings`, `kut.my_collection_cards`, `kut.activity_feed`,
`kut.buy_listing`, `kut.propose_trade` and `kut.prevent_burning_listed_card`.
All of that is untouched. The migration is additive: no table is created or
altered, no row is backfilled, and every existing listing keeps the
`expires_at` it already had.

Three things are worth recording about the shape:

- **The old signature is dropped, not left behind.** Adding a defaulted third
  parameter to a PL/pgSQL function creates an *overload*, so
  `create_listing(uuid, bigint)` would have survived as a second, silently
  24-hour-only entry point. The migration drops it first and recreates the
  three-argument version, following the ADR-037 precedent for
  `publish_attendance_session`. The new parameter still defaults to 24, so
  existing two-argument callers — including
  `supabase/tests/database/trade_offers.test.sql` — stay valid.
- **An allow-list, not a range.** An arbitrary duration would let a seller park
  a card in the listing soft-lock for as long as they liked. The permitted
  values are dual-declared as the `p_duration_hours not in (24, 72)` guard in
  SQL and `ECONOMY.listingDurationChoiceHours` in `src/game/economy.ts`,
  mirroring how `adminWalletAdjustMax` / `100000` are declared. The server
  action re-validates before the RPC, so the form control is convenience, not
  security.
- **The return value stopped lying.** The previous body returned a hardcoded
  `now() + interval '24 hours'` that was never read back from the insert.
  Nothing consumed it, but with a variable duration it would have been wrong, so
  it now returns the `expires_at` actually stored, via `returning`.

The card detail page now shows the real expiry date instead of asserting "24
hours" in copy, using the existing date-only `formatDate` convention that
`/market/offers` already applies to offer expiry.

Deliberately not changed, and left as separate concerns:

- **Nothing sweeps expired listings.** A lapsed listing keeps
  `status = 'active'` and is merely hidden by the predicates above, flipped
  opportunistically by `create_listing`/`buy_listing`. That remains the owner's
  explicit decision in `docs/LAUNCH_PLAN.md` — "the sweep is not what enforces
  expiry" — and a longer window does not change the reasoning. The repository
  still has no cron infrastructure of any kind.
- **`kut.propose_trade` still sets a flat 12-hour offer expiry with no clamp to
  `listing.expires_at`**, so an offer can nominally outlive its listing. This is
  pre-existing and harmless — `respond_to_trade` re-checks the listing and
  refuses — but it is more visible at 72 hours. A
  `least(now() + interval '12 hours', listing.expires_at)` clamp is the fix if
  it becomes a nuisance.
- **`kut.cancel_listing` carries `expires_at > now()`**, so cancelling a lapsed
  listing raises "active listing not found" rather than a clean "already
  expired". More sellers will meet this at 72 hours.

Consequences: section 1 of
`supabase/migrations/20260926000000_trade_log_rating_story_listing_duration.sql`
plus `supabase/tests/database/listing_duration.test.sql` (13 assertions,
including that the two-argument signature is gone and that 0, 48, 168 and null
are all refused). `phase_1a_roster.test.sql` had pinned the old two-argument
signature and was updated to the new one. `BUILD_SPEC.md` Part XI §33 and Part
XXXIII §82 drop their "24-hour listing" wording, and ADR-016's "24-hour buy-now
listings only" is superseded on duration alone — everything else about that
decision stands.

## ADR-073 — The club log reports a trade's whole consideration

Date: 2026-09-16

Status: Accepted

Decision: `kut.activity_feed` reports a trade's **gross** offered coins and names
every card offered back. The change is confined to the projection; no trade row
is rewritten.

An accepted trade logged only the net coins the seller banked and the name of
the listed card. When an offer bundled cards plus coins — or several cards plus
coins — everything except the coin receipt was invisible, so the club log
understated what had actually changed hands. Two distinct defects sat behind
that, and both are fixed in the view.

**The amount meant something different for trades than for everything else.**
Every other branch reports gross: `market_sales.sale_price`,
`market_listings.price`, `pack_openings.price_paid`. The trade branch reported
`trade_offers.coins_to_seller`, which is already 5% lighter than what the
proposer actually paid. That inconsistency was invisible because nothing
displayed the two side by side. The trade branch now reports
`trade_offers.offered_coins`, so `amount` means the same thing in all five
branches.

A consequence worth stating plainly: **past trades now read higher than they
did.** A trade that displayed "138 KUT Coins" becomes "145 KUT Coins". No data
changed — `coins_to_seller` and `coins_burned` are untouched on the row, and the
seller still sees their real post-burn receipt on `/market/offers`. This is the
feed reporting the price rather than the proceeds, which is what "the value of
the trade" means to everyone reading it.

**Offered cards were never joined at all.** `kut.trade_offer_cards` has existed
since ADR-042 but the feed never touched it, so cards moving the other way could
not appear. A lateral `array_agg` of the offered players' display names now
supplies them, appended as `offered_card_names`. `create or replace view` can
only add columns at the end — the same constraint ADR-040 met — so the column
order is load-bearing and all five branches carry `null::text[]` where they have
no offered cards. A coins-only trade yields null rather than an empty array, so
the UI can branch on presence.

No valuation is attached to those cards, and that is deliberate. Nothing is
snapshotted at accept time, so a coin-equivalent computed later would drift with
Live Ratings and a past trade would silently rewrite its own worth. Naming the
cards says what was exchanged without inventing a number that was never agreed.

Privacy is unchanged: the feed already discloses both counterparty names and the
listed card club-wide, and the offered cards are the other half of that same
disclosed transaction. The view keeps owner rights (`security_invoker = false`),
so the new join raises no RLS question, and both `role <> 'superadmin'` guards
(KB-009 / ADR-054) are untouched. Part L invariant #23 still holds — the trade
branch does not reference `kut.market_sales`, and the test asserts it.

Consequences: section 2 of
`supabase/migrations/20260926000000_trade_log_rating_story_listing_duration.sql`;
`kut.activity_feed` gains a ninth column. `src/lib/activity.ts` gains a
`joinNames` helper rendering `A` / `A and B` / `A, B and C`, the TypeScript twin
of `kut._join_names` (ADR-069). `activity_feed.test.sql` grows from 12 to 19
assertions — it had no trade coverage whatsoever before this. The two existing
trade assertions in `tests/unit/activity.test.ts` were updated and four added.

Deliberately not done: the seller's `Trade completed` notification still says
"plus cards" without naming them. Fixing it means `create or replace`-ing all
~150 lines of `respond_to_trade` for a copy change, which is poor risk/reward
beside a view-only change. Registered as a follow-up rather than smuggled in.

## ADR-074 — A card explains its own rating, in Form rather than per-line OVR

Date: 2026-09-16

Status: Accepted

Decision: two additive read projections,
`kut.player_rating_breakdown` and `kut.player_form_contributions`, back a "why
this rating" story on the card detail page and the player profile. The
attendance/Form split is stated in OVR once; per-session detail is stated in
Form.

A card showed its OVR and never explained it. Attendance, goals and kudos all
feed the number, but a member could not see why they were a 62 or where a recent
+2 came from. The `kudos_awarded` notice (ADR-069) explains a single session;
nothing explained the standing rating.

**No new data is stored.** `kut.session_report_results` already holds
`effective_goals`, `goal_form`, `kudos_form`, `session_input` and
`qualified_category_ids` per player per session, and `kut.player_season_state`
already holds `activity_score` and `form_score`. This is a reading of facts that
already existed.

**The requested shape was "+2 OVR for goals, +2 OVR for being elected", and that
is not what shipped.** `docs/RATING_BALANCE_REVIEW.md` rules that Form is
rounded once, on the total: "three separate category awards are not individually
rounded and added… The UI says 'Form' for decimal contributions, rather than
promising an exact '+N OVR' per category." Per-line OVR integers would not sum
to the real figure, so the story states the combined bonus once in OVR and every
session line in Form. The narrative the request asked for survives; only the
unit on the individual lines changed.

**The attendance base is derived, not recomputed.** The engine computes
`live_ovr := least(83, greatest(30, round(activity_ovr + floor(form + .5))))`,
so the attendance half could have been recalculated as
`30 + 45·(activity/100)^0.8`. It deliberately is not: recomputing invites an
off-by-one against the stored `live_ovr`, and a breakdown that fails to add up
is worse than no breakdown. Instead `form_bonus` is `floor(form_score + 0.5)` —
the engine's own final rounding — and `attendance_base` is `live_ovr` minus that
bonus. The two halves then reconstruct the number on the card face *by
construction*, including where the clamp bites; `is_ovr_capped` lets the UI say
so at the 83 ceiling.

**The known risk is duplication of the decay ladder.**
`player_form_contributions` expresses the session-age weights (1 / .75 / .5 /
.25 / 0) and the age expression a second time, outside
`kut._rebuild_season_core`. If the engine's ladder moves and the view does not,
the view lies quietly. That is pinned by
`supabase/tests/database/rating_breakdown.test.sql`, which runs the real
`_rebuild_season_core` over a fixture and asserts the summed
`weighted_contribution` equals the resulting `player_season_state.form_score`.
Per ADR-064 the maths is not mirrored into TypeScript; `src/lib/rating-story.ts`
formats numbers SQL computed and recalculates nothing.

Age is counted in **sessions**, never weeks — the same document warns "never
equate four sessions with four weeks" — so the copy names actual session dates
and a unit test asserts the decay wording never contains "week".

**Privacy.** Both views are `security_invoker = true`, so the caller's own RLS
applies: `session_report_results` is already gated to finalized surveys by
`kut.is_survey_finalized` (ADR-066), and `match_sessions` to published rows.
Neither view may join `kut.session_kudos`, which holds nominator identity, nor
`kut.session_surveys`, whose attendee-only policy caused the KB-013 blackout —
session dates come from `match_sessions` and category titles from
`qualified_category_ids`, so neither table is needed. A test asserts via
`information_schema.view_table_usage` that neither is referenced, and another
asserts a member who missed a session still reads its finalized breakdown.

Per-category nominator *counts* are deliberately not exposed either: since
qualification is exactly "≥2 distinct nominators", publishing a count above two
would leak more than the current model does in a squad this small.

Consequences: section 3 of
`supabase/migrations/20260926000000_trade_log_rating_story_listing_duration.sql`;
`supabase/tests/database/rating_breakdown.test.sql` (14 assertions);
`src/lib/rating-story.ts` + `tests/unit/rating-story.test.ts` (16 assertions);
`src/components/rating-breakdown.tsx`. The card detail page now selects
`player_id` from `my_collection_cards`, which the view always exposed but the
page never read. The story renders only for a Live card — a Special edition is a
frozen snapshot and explaining a current OVR would misdescribe it — and both
reads are non-critical, dropping the section rather than failing the page, which
matches how the ADR-047 chart treats its own queries.

## ADR-075 — Three features ship in one migration, once, by explicit instruction

Date: 2026-09-16

Status: Accepted

Decision: ADR-072, ADR-073 and ADR-074 ship as one migration file and one PR,
rather than the three the standing convention would produce.

`policy/PRODUCTION_INVARIANTS.md` says "one migration- or invariant-bearing
feature is allowed per PR or independently reviewable change slice", and the
`migrations` CI job (ADR-070) permits at most one *added* migration file per
change, with a matching database test and no label override. The normal reading
of both is one feature per PR.

The owner instructed otherwise on 2026-09-16, for an operational reason that the
convention does not serve: hosted migrations are applied by hand from
`VibeTrunk/supabase`, and three PRs mean three separate `supabase db push`
operations against the shared project. One migration means one push.

What makes this acceptable rather than merely convenient:

- **The mechanical gate is satisfied honestly, not circumvented.** The invariant
  caps *added migration files* at one, and this is one file. Nothing is bypassed
  and no exemption was needed.
- **The invariant's second limb is met deliberately.** Each of the three is an
  independently reviewable slice: its own ADR, its own database test file, its
  own rollback, and a clearly delimited section in the migration. They touch
  disjoint objects — a function, a view replacement, and two new views — so no
  section can mask a defect in another.
- **All three are additive.** No table is created or altered, no row is
  backfilled, no economy or rating formula moves, and no Part L invariant is
  touched. The revert-granularity argument behind the one-per-PR rule bites
  hardest on data-changing migrations; here a rollback is three independent
  `drop`/recreate steps, spelled out per section.
- **One file is atomically applied.** Postgres DDL is transactional, so a
  failure anywhere rolls the whole migration back. Three sequential pushes can
  leave the hosted schema half-applied; this cannot.

What is genuinely given up: squash-merge means this lands as one commit on
`main`, so `git bisect` and `git revert` cannot separate the three. Reverting
one feature means reverting the code for all three and re-applying two, while
the hosted schema stays migrated. That cost is accepted knowingly and is the
reason this ADR exists rather than the batching passing unrecorded.

This is a one-time authorization for these three changes. It sets no precedent:
the next migration-bearing change goes back to one per PR unless the owner again
says otherwise, and a data-changing migration should not be batched at all.

## ADR-076 — The rating story accounts for carried Form, by subtraction for now

Date: 2026-09-16

Status: Accepted

Decision: the "why this rating" panel (ADR-074) renders the Form its session
rows do not account for as a row of its own, recovered as `form_score` minus the
listed rows. No migration; `kut.player_form_contributions` is unchanged.

**The rows did not add up, and in one case the panel contradicted itself.**
Reported from two live cards. One listed 1.00 and 1.25 Form beneath a stated
total of 2.88. The other showed "FROM FORM +2" directly above "No recent session
is adding Form right now, so this rating is all attendance", with a bare
`Carried Form: 1.5` footnote — a line that rendered only when the list was
empty, and explained nothing when it did. Registered as KB-018.

**Cause.** `kut._rebuild_season_core` computes

    v_form := least(8, greatest(0, v_contributions + v_legacy * <decay>))

and `kut.player_form_contributions` reads `kut.session_report_results`, which is
the `v_contributions` term alone. `v_legacy` is the Form a player carried over
the season's rating-v2 cutover — goals scored before self-reporting existed —
decaying over the first four v2 sessions by the count of published v2 sessions
rather than by session age. It is counted in `player_season_state.form_score`
and so in the OVR bonus, but it has no session row to render. ADR-074 did not
mention the term at all; the pinning test in
`supabase/tests/database/rating_breakdown.test.sql` forces the cutover so that
"no legacy Form carries in" and says the sum assertion only holds that way, so
the fixture could not reproduce the live condition.

The attendance/Form split was never wrong: `attendance_base + form_bonus =
live_ovr` holds by construction, as ADR-074 intended.

**Why subtraction, and what it costs.** The remainder is exact —
`v_contributions` is precisely what the contributions view sums, so
`form_score - listed` is the rest of the engine's expression and nothing else.
What the client cannot know is *which* part of the expression it is. A positive
remainder is attributed to carry-over because that is the only other additive
term; a negative one is attributed to the `least(8, …)` ceiling, which is the
only subtractive one. Both are true of today's engine and neither is asserted by
the database. Adding a term to the engine without adding a column here would
therefore mislabel it rather than hide it — a real, accepted risk, carried
because the alternative is a migration and the symptom is live now.

This does not mirror rating maths into TypeScript (ADR-064): it subtracts two
numbers SQL computed and re-derives nothing. The proper fix — `legacy_form` and
`legacy_weight` columns on `kut.player_rating_breakdown`, read rather than
inferred, with a test fixture whose season spans a cutover — needs its own
migration and its own PR, and is in `docs/ROADMAP.md`.

**The symptom would have cleared itself.** At a season's fourth v2 session the
legacy weight reaches 0 and the rows sum again. It returns on the next season
that spans a rules cutover, and the self-contradicting empty-state copy was
wrong on the day it was reported, so waiting was not a fix.

Consequences: `carriedForm()`, `describeCarriedForm()` and
`describeCarriedDecay()` in `src/lib/rating-story.ts`;
`src/components/rating-breakdown.tsx` renders the carry-over as a list row, gates
the "all attendance" sentence on the rows being genuinely empty, keeps a
"no recent session yet" note for a player whose Form is entirely carried, and
names the 8 Form ceiling on a negative remainder. The `Carried Form: N` footnote
is removed, superseded by the row. Ten new unit assertions in
`tests/unit/rating-story.test.ts`, including both reported cards as fixtures.


## ADR-077 — The goal badge stays inside the graph so it can be hovered

Date: 2026-09-22

Status: Accepted

Decision: `GoalFootball` draws its `×N` badge on the left of the football when
the badge would otherwise cross the right edge of the graph's viewBox. No other
change to `src/components/rating-history.tsx`; no migration.

**The report.** A card screenshot of Freek's rating graph: hovering the week
carrying the `×10` badge showed no goal count, while other weeks tooltipped
normally (KB-019). The register recorded two guesses — a `goalsByWeek` keying
problem, or something about the badge specifically — and said neither had been
tested.

**What was measured.** The component was rendered to static markup and probed
in real Chromium with `document.elementFromPoint`, walking up from the hit
element to the nearest `<title>`, across six geometries: 1, 6, 18 and 30
published weeks, with the multi-goal week placed mid-series, penultimate and
last. Four probe points per graph — the football's centre, the gap beside it,
the badge's glyph box and the badge's far edge.

This **disproved the standing hypotheses.** Mid-series, every probe resolved the
correct week's title, including the badge and the space around it, at both 6 and
18 weeks. The overlap theory — that at ~17+ weeks the badge reaches into the
next point's group, which is painted later and wins the hit test — is false: the
badge belongs to its own point's group, and a neighbour only wins where the
neighbour's own marks are painted.

**The one geometry that fails** is the multi-goal week as the *last* point.
`x(last) = left + plotWidth = 548`, the badge is drawn at `x + 9 = 557`, and its
glyph box measures 25px wide in a viewBox 560 wide — so most of the badge is
outside the frame. Probing it hits `<body>`: the part of an SVG element outside
the viewBox is not hoverable, so the badge, which is the most salient thing on
that point and the natural place to aim, could not be hovered at all. The
football itself still tooltipped, which is why the failure reads as "only that
week is broken". The same clipping hits the penultimate point once a season
passes ~30 published weeks and the spacing closes up.

**The fix** flips the badge to `textAnchor="end"` at `x - 9` when
`x + 34 > width` — the 9px offset plus the measured 25px glyph box. After it,
all four probes resolve the correct title in all six geometries, including the
two that previously hit `<body>`.

**An earlier attempt is worth recording because it was wrong.** The first
version moved every point's `<title>` onto a transparent hit circle painted last
and set `pointer-events: none` on the visual marks. Measured, it was a
regression: the hit circle's radius does not reach the badge, so disabling
pointer events on the marks *removed* hover from the badge in the mid-series
case where it had been working. A structural change made without measuring the
structure it replaced.

**What this does not establish.** Freek's actual snapshot series was not
available — the local stack was down and hosted data is not read from here — so
it is not confirmed that 31 Aug was his last published week. What is confirmed
is that this is a real defect producing exactly the reported symptom, and that
no other geometry produces it. If the symptom survives on a week that is not
the last, KB-019 should be reopened with the browser and the week's position in
the series recorded.

## ADR-078 — A submitted session report never goes back to draft

Date: 2026-09-22

Status: Accepted

Decision: `kut.submit_session_report` derives an effective intent from the
stored row before it validates anything, so a `draft` call against an
already-submitted report is an *edit that stays submitted*. Rows that already
regressed are repaired. Sessions already finalized with a regressed report are
deliberately **not** re-scored. Migration
`20260927000000_session_report_status_is_monotonic.sql`.

**The defect.** The report form rendered "Save draft" even once a report was
submitted — `rewardReceived` only relabelled the Submit button — and the RPC's
upsert wrote `status=excluded.status` unconditionally, collapsing `submitted_at`
to null whenever the new status was not `submitted`. So a member could press
Save draft and move their own report backwards, while
`kut.session_report_rewards`, written once on the original submit and never
deleted, kept the 50 coins. The admin roster joins the two independently and
displayed the result verbatim: "Draft · Reward paid" (KB-020).

**Why it was not cosmetic.** `kut._finalize_one_session` scores only
`r.status='submitted'` rows, and uses the same filter for the `v_turnout>=3`
gate that decides whether *any* kudos are recognised in that session. A report
left in this state at finalization therefore drops that member's goals and kudos
from scoring, and can wipe kudos recognition for everyone present — while their
`session_kudos` rows still count toward recipients'
`count(distinct nominator_player_id)>=2`, so the session is internally
inconsistent as well as wrong.

**Why one derived local rather than a guarded upsert.** The obvious fix is to
hold `status` in the `on conflict do update`. It is not enough: the row would
stay `submitted` while being rewritten under the *draft* validation, which
permits a null goal count and an incomplete ballot. A submitted report could
then end up submitted and hollow. Promoting the intent first —

    v_intent := case when v_report.status='submitted' then 'submit' else p_intent end;

— means an edit must satisfy the same completeness rules that earned the status.
The `on conflict` clause is then unchanged: the BEFORE trigger normalises
`excluded.status` to `submitted`, and `submitted_at` resolves to
`coalesce(session_reports.submitted_at, now())`, preserving the original time.
The table's `check ((status='submitted') = (submitted_at is not null))` holds in
all four transitions. The reward insert remains `on conflict do nothing`.

**The UI stops the user reaching it at all.** `report_status` was already
selected from `kut.my_session_reports` and then dropped on the floor; it is now
passed to the form, and "Save draft" is not rendered once the report is
submitted. Hiding beats disabling — a disabled button invites a question the
page cannot answer. Both buttons also gained an explicit `type="submit"`: "Save
draft" had none, which made it the form's default submit button, so **Enter in
the goals field regressed a submitted report with no click at all.** That was
not in the original report; it was found while reading the form.

**Deliberately not replaying finalized sessions.** `_finalize_one_session` is
re-runnable — `kut.admin_correct_session_goals` calls it exactly that way — so
replaying the affected sessions was available and was considered. It was
declined by the owner on 2026-09-22: it would move live OVR for real members
retroactively, push `finalized_at` forward, and disturb the ADR-067 reading of
`finalized_at < closes_at` as "closed early". The consequence is stated plainly:
for any session already finalized with a regressed report, that member's goals
and kudos stay out of that week's scoring, and a session whose turnout had
fallen below three keeps its lost kudos recognition. A later
`admin_correct_session_goals` on such a session re-scores it correctly.

**The backfill's victim predicate is exact.** A `session_report_rewards` row is
written only by a real submit and is never deleted, so `status='draft'` beside
one is reachable by no other path. `submitted_at` is recovered from
`updated_at`, the closest surviving evidence. The repair is not reversible —
nothing records which rows were draft beforehand — which the migration header
says.

**Test.** `supabase/tests/database/session_report_status.test.sql`, 16
assertions. It was run against the *old* function as a negative control and
fails five of them there, including the standing invariant that no report is
left as a draft while holding a completion reward.

## ADR-079 — One active-member predicate gates every definer projection

Date: 2026-09-22

Status: Accepted

Decision: `kut.is_active_member()`, one `stable security definer` predicate,
gates all ten `security_invoker = false` views. Migration
`20260928000000_active_member_projection_gate.sql`. No application code changes.

**The finding.** The Supabase Security Advisor flagged ten views that grant
`SELECT` to the shared project's `authenticated` role and deliberately bypass
their source tables' RLS, without proving the caller is a KUT member. A JWT
issued for another VibeTrunk tool in this project, or a disabled KUT account
with a still-valid session, could therefore read member-only names, market and
activity data, Club Values, ratings and Chronicle results through the Data API
(KB-017). A bounded read disclosure: these are read projections and `anon` has
no `SELECT` on any of them.

**Measured, not assumed.** The new pgTAP file was run against the *ungated*
views as a negative control. Fifteen assertions fail there, and which fifteen
matters: a profileless JWT reads all six club-wide projections; a disabled
member reads those six *plus* their own trade offers, editions and copies. The
disabled member's `my_club_value` does **not** fail — it already carried its own
`not profile.is_disabled` — and the profileless caller never reached the four
caller-scoped views, which are keyed on `auth.uid()`. That is exactly the
accounting KB-017 claimed, confirmed rather than restated.

**`security definer` is required.** `kut.profiles` RLS lets a member read only
their own row, so an invoker-rights probe could never prove that a *foreign*
caller has no profile. The predicate mirrors `kut.is_survey_finalized`
(ADR-066): `sql`, `stable`, `security definer`, `search_path = kut, pg_catalog`,
revoke-then-grant.

**Why the service role is inside the predicate.** A service-key JWT carries no
`sub`, so `auth.uid()` is null and the profile branch would deny it. Two
disjuncts cover the two transports: `auth.role()` — already the house idiom at
`20260920000000:348` — for PostgREST, and `current_setting('role', true)` for a
bare `set role service_role` psql session, since entering a definer function
changes `current_user` but not the `role` GUC. Neither is reachable from
`authenticated`: GoTrue only issues `role: authenticated` user tokens, and
`authenticated` is not a member of `service_role`, so `SET ROLE` is refused.

Two shapes were explicitly rejected and are recorded so they are not proposed
again. `current_user` inside a `SECURITY DEFINER` body is the function *owner*,
which would make the predicate unconditionally true — the migration would ship
as a no-op that looks fixed. `pg_has_role(session_user, 'service_role',
'member')` is true for everyone, because `session_user` is `authenticator` for
every PostgREST request and `authenticator` *is* a member of `service_role`.

**Never `security_invoker = true`.** That is the Advisor's generic remedy and it
is wrong here. These are cross-RLS club projections by design; doing it to
`kut.chronicle_session_reports` is literally KB-013, the live Chronicle
blackout, and doing it to `activity_feed` or `club_value_leaderboard` would
empty them for everyone. Named here so the next audit does not re-propose it.

**Why wrap rather than edit ten WHERE clauses.** The risk in this migration is
transcription across ten bodies and six source files, not semantics. Each body
is copied byte-identically and the only new text is
`select * from ( … ) gated where kut.is_active_member()`, which also means
`create or replace view` cannot change the column names, order or types (the
ADR-073 lesson) — `select *` is expanded from an unchanged body. It gates
`activity_feed`'s five `UNION ALL` branches and `club_value_leaderboard`'s
aggregation in one place each. `EXPLAIN` confirms the predicate is a
pseudoconstant qual: the plan reads `One-Time Filter: kut.is_active_member()`
above the body, so a denied caller never executes it.

**The four caller-scoped views are gated too, and this should not be
overclaimed.** They never leaked another member's data — the negative control
proves it. The residue was the *disabled caller's own* data on three of them.
They are gated for uniformity: one function replaces four hand-rolled variants
of the same idea, and it removes a per-view judgement call from every future
reviewer. `my_club_value`'s own `not profile.is_disabled` is left in place:
redundant now, but removing it would be an interior edit to a verbatim body.

**No role filter.** Admins and superadmins read as members. The
`role <> 'superadmin'` guards in `activity_feed` (KB-009) and the `p.role='user'`
filter in `club_value_leaderboard` scope those views' *subjects*, which is a
different question from who may read them.

**The gate filters; it never raises.** `src/lib/nav/context.ts:47-52` reads
`kut.my_trade_offers` in the same `Promise.all` as the profile read, before the
disabled-user redirect at `:55-58`. A gate that raised would turn every disabled
member's `/` render into a 500 instead of a redirect to `/login`. Every deny
assertion in the test is `is(count, 0)`, never `throws_ok`, which pins it.

**Consequences.** Three pre-existing assertions — one in
`member_admin_links.test.sql`, two in `member_self_service.test.sql` — read
`kut.club_value_leaderboard` as the test superuser with the `sub` claim cleared,
and now need a member's role and claim. One of them, "an admin account is absent
from the club value leaderboard", would otherwise have gone on passing for the
wrong reason. No application code changed: `getNavContext()` already redirects
every caller this denies.

**Deliberately not done.** Revoking `anon`'s lingering `usage on schema kut`;
dropping `kut.public_live_ratings`, which has zero references in `src/` and
survives only as a legacy projection; and RLS on `kut.season_rating_rules`,
already queued in `docs/ROADMAP.md`, which asks for "the same active-KUT-member
boundary as KB-017" and can now cite `kut.is_active_member()` by name.

## ADR-080 — The rating graph reads goals from both eras, as the engine does

Date: 2026-09-22

Status: Accepted

Decision: `/players/[slug]` builds `goalsByWeek` from **two** sources, switching
per session on `kut.match_sessions.rating_rules_version` exactly as
`kut._rebuild_season_core` and `kut.chronicle_player_season` do: admin-entered
`kut.attendance.goals` for a v1 session, member-reported
`kut.session_report_results.effective_goals` — read through the existing
`kut.player_form_contributions` projection — for a v2 one. The mapping lives in
one exported, tested function, `buildGoalsByWeek`. No migration.

**The report.** A second screenshot of Freek's rating graph after ADR-077
shipped: the 31 Aug point still carries the `×10` football while 7, 14 and 21
Sept render as plain dots, even though the "What's in that Form" panel directly
below lists 3 goals on 21 Sept, 1 on 14 Sept and 2 on 11 Sept. ADR-077 asked for
exactly this reopening — "if the symptom survives on a week that is not the
last" — and it did.

**ADR-077 was not wrong, it was incomplete.** The clipped badge is a real defect
and the measurement that found it stands. But it explained only why the *last*
point's badge could not be hovered; it never explained why the September weeks
had no badge to hover in the first place. The register's first guess, "a
`goalsByWeek` keying issue", which ADR-077 recorded as disproved for the hover
question, was the right instinct aimed at the wrong symptom.

**The actual cause is a split goal source.** Since ADR-059 the engine reads
goals from a different table on each side of the rating-v2 cutover week:

```sql
if v_week.week_start < v_cutover then
  select coalesce(sum(a.goals),0) into v_goals from kut.attendance a ...
else
  select coalesce(sum(r.effective_goals),0) into v_goals from kut.session_report_results r ...
```

The page has only ever read the first branch. 31 Aug predates the cutover, so
its admin-entered goals render; every reporting-era week is invisible no matter
how many goals were reported. The graph has therefore been silently wrong for
every week since self-reporting began, and it will stay wrong for every future
week — this is not a rendering bug that happened to look like a data bug, it is
the graph reading a table the game stopped writing to.

**Per session, not per week.** `rating_rules_version` is a column on the
session, and both sources can be non-zero for the same v2 session, so summing
them unconditionally would double-count. `kut.chronicle_player_season:8` already
makes the choice per session (`case when session.rating_rules_version = 1 then
attendance.goals else result.effective_goals end`) and this mirrors it, rather
than re-deriving the cutover date on the client. The engine's own week-level
comparison and this session-level one agree, because a week's sessions all carry
the same version: the version is assigned from
`date_trunc('week', session_date) >= v2_starts_week`.

**No new query.** `kut.player_form_contributions` is already fetched on this page
for the ADR-074 story section, covers every published v2 session of the active
season — the decay weight can be `0.00`, but the row is still there — and is
`security_invoker = true`, so it stays gated to finalized surveys (ADR-066).
Reusing it keeps the read path single, per ADR-064.

**The hover target is widened in the same change.** A plain point is a 3.5px
circle with a 2px stroke in a 560-unit viewBox — about 11 screen pixels — and
nothing between points was hoverable at all, which is the second half of the
report ("there is also no mouse over"). Each point group gains a transparent
disc, radius `min(14, spacing / 2)` so a disc never swallows its neighbour's.
This is **not** the structure ADR-077 measured and rejected: the `<title>` stays
on the point group and the visual marks keep their pointer events, so the disc
only adds reachable area. Hovering the football or the badge resolves the same
title it did before, because the disc shares their group.

**Deliberately not done.** Moving the choice into SQL as a `player_week_goals`
view. It would be the better home — the client would stop knowing that two goal
sources exist — but it needs a migration, and a migration-bearing change ships
on its own (project CLAUDE.md). Queued in `docs/ROADMAP.md`.

## ADR-081 — `kut.season_rating_rules` gets RLS and the active-member read policy

Date: 2026-09-23

Status: Accepted

Decision: enable row level security on `kut.season_rating_rules` and add one
policy, `"active members read rating rules"` — `for select to authenticated
using (kut.is_active_member())`. No write policy, no grant change, no `FORCE`.
Migration `20260929000000_season_rating_rules_rls.sql`, test
`season_rating_rules_rls.test.sql`. No application code changes.

**The finding.** The 2026-09-16 Supabase Security Advisor review flagged the
table as the one in the exposed `kut` schema with RLS disabled — a deviation
from `BUILD_SPEC.md` §78, "Enable Row Level Security on every exposed table".
It was never a write or integrity hole: `20260920070000` revokes
`public`/`anon` and grants only `SELECT` to `authenticated` and
`service_role`, and nobody holds `INSERT`/`UPDATE`/`DELETE`. What remained was
KB-017 in miniature: a JWT from another VibeTrunk tool, or a disabled KUT
account with a live session, could read each season's rating-v2 cutover week.
Low value, but the same boundary ADR-079 drew everywhere else, so the same
predicate draws it here. Measured before the migration: both of those callers
read all three local rows.

**Filter, never raise.** A denied caller reads zero rows, the ADR-079 contract.
The one app reader, `src/app/(app)/admin/attendance/page.tsx`, is an
authenticated admin, and admins pass the predicate — it has no role filter. The
service role is not named in the policy because it has `BYPASSRLS`; policies
never apply to it.

**No write policy.** Writes are refused by the missing grant (`42501`) before
RLS is consulted, and with RLS on they would stay refused even if a grant ever
appeared. Every legitimate writer is a `security definer` function.

**Why the definer paths keep working.** `kut._rebuild_season_core`, the
`match_sessions_rating_version` trigger (`kut._version_and_open_session_survey`)
and the `seasons_initialize_rating_rules` trigger
(`kut.initialize_season_rating_rules`) are all `security definer`, owned by the
table's owner, `search_path = kut, pg_catalog`. A table's owner bypasses its RLS
unless it is forced.

**Why not `FORCE`, stated accurately.** The brief for this change said `FORCE`
would break those three paths. Measured on the local stack, in a rolled-back
transaction with `FORCE` and *no policy at all*, it does not: a season still
seeded its row, publishing still stamped `rating_rules_version = 2`, and
`kut.rebuild_season` still ran, while a direct `authenticated` read returned
zero. The owning role, `postgres`, carries `BYPASSRLS` locally — it is not a
superuser — and `BYPASSRLS` overrides `FORCE`. `FORCE` stays off anyway: it
would buy nothing, since the only code running as the owner is those three
reviewed functions, and it would rest them on a role attribute the platform
grants and this repository cannot pin, instead of the bypass Postgres gives
every owner. The test pins what this repository *can* pin:
`relforcerowsecurity = false`, and that each of the three functions is
`security definer` and owned by the table's owner.

**The same fact limits the behavioural test, and this should not be
overclaimed.** Because the owner has `BYPASSRLS` locally, the assertions that
publishing, rebuilding and seeding still work cannot fail *because of RLS* on
this stack. They guard against any other breakage; the structural pins above
are what guard the RLS bypass. The version-stamp assertion is still
discriminating in the sense that matters: if the trigger ever could not see the
row, its subquery would return `NULL` and the session would be stamped `1`.

**Existing tests.** Every other file that touches the table — setup
`update`/`insert` in five of them — runs as `postgres`, which bypasses RLS, and
`next_features_contracts.test.sql:48` reads it as an active member. All twenty
files pass unchanged.

**The survey found nothing else.** Before this migration
`kut.season_rating_rules` was the only table in `kut` with
`relrowsecurity = false`; after it, none is. The new test pins that, so
§78 now holds for the whole schema and a new table created without RLS fails
the suite.

**Negative control.** The new test was run against the unmigrated schema first:
seven of its 27 assertions fail — RLS off, the policy, its command and its role,
the schema-wide RLS check, and the profileless and disabled reads — and the
other twenty pass, which is exactly the change this migration makes and nothing
more.

**Rollback.** `drop policy "active members read rating rules" on
kut.season_rating_rules; alter table kut.season_rating_rules disable row level
security;` Grants are unchanged, so none need re-granting. No data involved.

## ADR-082 — Injury mode: a weekly check-in protects Activity and pays a stipend

Date: 2026-09-23

Status: Accepted

Decision: an admin can put a Player with an active account into **injury
mode**. Each football week the Player sits out, the member does a **rehab
check-in** from Home. It pays 100 KUT Coins and **protects** that week: Activity
carries over unchanged instead of decaying ×0.90. Form is not protected. A 🩹
Injured chip marks the Player's Live cards. Migration
`20260930000000_injury_protection.sql`, test `injury_protection.test.sql`,
spec §11.3, Part 145 `INJURY_WEEKLY_STIPEND`, Part L #24.

**The problem.** A long-term injured Player's card falls from 75 to ~62 after
four football weeks out, ~53 after eight and ~35 after six months. That punishes
the Player for something outside their control, and every member who owns the
card loses Club Value with them. "Retirement is never automatic… so injury…
can be handled humanely" (ROADMAP, roster pruning) already anticipated this.

**A protected week is a week off for that one Player.** §9 already says a week
with no TFH session decays nobody. A protected week applies the same rule to
one Player's Activity, so no new decay maths is invented. The engine change is
one guard in `kut._rebuild_season_core`'s week loop. The body is otherwise
verbatim from `20260920000000:406-463`, and a rebuild of the real local data
before and after the migration produced zero differences across 29 players and
174 snapshots.

**Form still fades.** v2 Form ages by club sessions, not weeks, and it rewards
what happened on the pitch. Freezing it would carry a pre-injury hot streak
through months without football. The card settles onto its attendance base and
stays there.

**The check-in, not the admin flag, protects a week.** The rebuild reads only
`kut.injury_check_ins`, so it stays deterministic (Part L #16) and a protected
week is a fact the member created. Two consequences are deliberate:

- **No backdating** (owner decision, 2026-09-23). Weeks lost before the first
  check-in stay lost; there is no admin "protect past weeks" path.
- **A Player who drifts away stops being protected.** If check-ins stop, the
  weeks decay normally, without anyone having to notice and end the period.

**"Active" is derived.** A period is active while it is open and the Player has
no attendance at a published session dated *strictly after* `started_on`.
Strictly, because a Player is often injured during a session they attended, and
the admin enters that date. Playing again ends injury mode with no trigger, and
an attendance correction re-derives it. `admin_start_injury` closes a stale open
period whose Player has since returned (`end_reason 'returned to play'`,
`ended_by` null) before starting a new one. Ending a period never rewrites
history: weeks already protected stay protected, so no rebuild runs.

**The check-in window** is the current or the previous ISO week in
Europe/Amsterdam, a week of the active season with a published session, no
appearance by the Player, not before the injury week, and not already checked
in. The previous-week grace covers a session published after its week has
ended. The rule lives only in SQL (`kut._injury_checkable_week`), per ADR-064.
`kut.my_injury_status()` tells Home which week, if any, to offer.

**The stipend is a bounded faucet.** It pays at most 100 per Player per football
week, enforced by the `(player_id, week_start)` primary key, the
`kut.bibs_rewards` pattern, plus the ledger's idempotency key. That is well below
showing up (250 attendance plus 50 for the report), so injury mode never pays
better than playing. An admin cannot switch it on for their own player.

**Immediate rebuild.** A check-in rebuilds the active season so the protection
shows at once rather than at the next survey finalization. A season-scoped
advisory lock serialises check-in rebuilds with each other. Nothing serialised
`kut.rebuild_season` against the finalizer before this either, and both rebuild
from the same facts, so the last writer is correct.

**Privacy.** The admin note may hold medical detail. `kut.injury_periods` is
admin-read only. Members see injury status through `kut.injured_players`, which
projects only `player_id`, `started_on` and `protected_weeks`. It is a definer
view gated on `kut.is_active_member()` (ADR-079), with the active rule inlined,
because a view's function calls are checked against the caller.

**Notices.** `admin_notice` on start and end (distinct `reference_type`s, so the
end notice isn't swallowed by the unique index), and a new `injury_check_in`
notice when a recent week's *first* session of the active season is published.

**Deliberately left out:**

- **The market badge.** `kut.active_market_listings` has no `player_id`, and
  adding one means re-emitting an ADR-079 gated view. That is its own small
  change.
- **Players without an account.** They can't check in, so `admin_start_injury`
  refuses them.
- **The Comeback Form boost on return.** It changes the Form formula and the
  ADR-074 breakdown view, so it gets its own PR and ADR, after this one reaches
  hosted.

**Tier: data-changing** (`docs/OPERATIONS.md`): a new `wallet_ledger` reason
and a rating-engine change, even though no existing row is written. Fresh
backup before the hosted push.

**Deploy ordering.** Vercel deploys on merge, before the hosted push. Every new
read degrades gracefully: Home hides the check-in card, the badge is omitted,
and the roster shows "—" when the schema is missing. The admin and check-in
actions return an error message. Still, push the catalogue right after merge.

**Rollback** is in the migration header. It drops the objects, restores the
`20260920000000` rebuild body and narrows both check constraints (after deleting
any `injury_stipend` / `injury_check_in` rows). Protected weeks then decay again
on the next rebuild.

## ADR-083 — A comeback from injury mode earns a capped, fading Form boost

Date: 2026-09-23

Status: Accepted

Decision: the first published v2 session a Player attends after an injury
period with at least 3 protected weeks carries a comeback Form input of
`least(2, 0.25 × protected_weeks)`. It ages exactly like a session's
goals-and-kudos input and counts under the unchanged Form cap of 8. Migration
`20261001000000_injury_comeback_form.sql`, test `injury_comeback.test.sql`,
spec §11.3 and three Part 145 constants. Part L unchanged.

**Why Form, and why on the return.** ADR-082 deliberately pays nothing in rating
for being absent: a protected week only holds Activity still. "KUT rewards
showing up above everything else" (the attendance-backbone brainstorm), so the
reward for the rehab goes to the session where the Player shows up again. Form
is the right currency: it is temporary by construction, it fades over four
sessions, and it cannot compound into a permanent advantage. The +0.25 per week
makes a long, conscientious rehab worth more than a short one, and the cap of 2
equals the kudos maximum from a single session.

**The threshold is 3 weeks** so a short knock isn't a Form farm. A single
protected week pays the stipend and holds the card, and that's all.

**Counted weeks are the ones actually protected.** Only check-ins for weeks
*before* the return week count. A check-in in the return week protected nothing,
since a week with an appearance is always scored normally (ADR-082).

**One comeback per return.** Periods that end in the same return session (an
admin ended one and started another without the Player playing in between) are
summed into a single comeback, still capped at 2. Only the first session after
the injury counts; later sessions are ordinary.

**Derived, not recorded.** `kut.comeback_form_inputs` holds rows the rebuild
deletes and re-derives from `kut.injury_check_ins` and attendance every time,
exactly as it re-derives `kut.player_rating_snapshots`. An attendance
correction that moves the return session therefore moves the comeback with it,
and the rebuild stays deterministic (Part L #16). A persisted table rather than
a view, for two reasons:

- **The rebuild must not depend on who calls it.** A view gated on
  `kut.is_active_member()` would read zero rows for a bare `postgres` rebuild and
  silently drop every comeback.
- **The rating story has to see it.** The story's view is `security_invoker`, and
  members can only read their own `injury_check_ins`, so an ungated rule over that
  table would have hidden other players' comebacks. The table instead carries one
  `is_active_member()` read policy.

**The rating story still sums to the total.** `kut.player_form_contributions`
unions the comeback rows in, and appends two columns: `source` (`session` /
`comeback`) and `protected_weeks`. Without that, `carriedForm()` would have
mislabelled a comeback as Form "carried over from before session reports began".
The story renders "0.75 Form — comeback after 6 weeks out injured", in Form and
never per-line OVR, per `RATING_BALANCE_REVIEW.md`. A comeback row shares its
session's `session_id`, so rows are now keyed by `source:session_id`.

**Deploy ordering.** Both pages read the contributions view with `select("*")`
instead of a column list. In the window between merge and hosted push, the new
columns don't exist yet; a list naming them would fail the read and briefly
turn every player's Form into "carried over". With `*`, every row is simply a
session row until the schema arrives.

**No new notice.** The comeback appears in the rating story and the card rating.
A "Welcome back" inbox notice would need `kut._finalize_one_session`
re-emitted, which isn't worth it for this change.

**Tier: data-changing.** It is a rating-formula change, even though the migration
writes no row and output only changes for a Player with an injury period, 3+
protected weeks and a return. Rebuilding local data before and after gave zero
differences.

**Negative control.** Run against the ADR-082 engine, 15 of the new file's 25
assertions fail: every rule, engine and rating-story check. The other ten pass,
because schema, access and "nothing earned" cases are true either way.

**Rollback** is in the migration header. Drop and recreate the contributions view
from `20260926000000` (`create or replace` cannot drop appended columns), re-run
the `20260930000000` rebuild body, drop the table and rebuild the active season.

## ADR-084 — An injured Player's card goes into a signed plaster cast

Date: 2026-09-23

Status: Accepted

Decision: while a Player is in injury mode (ADR-082), every `LiveCard`
rendered with `injured` swaps its tier material for a **signed plaster cast**.
This supersedes ADR-082's sentence "A 🩹 Injured chip marks the Player's Live
cards"; the chip's markup and CSS are deleted. The card skeleton is unchanged:
OVR, tier pennant, art, nameplate and ruled stat table. The change is one data
attribute (`data-injured` on the `<article>`), a CSS block after the Elite tier
in `globals.css`, decorative markup in `src/components/live-card.tsx` and the new
`src/lib/injury-cast.ts`. **Visual only:** no migration, RPC, economy or rating
change, and Part L is unchanged. The design and handoff are in
`docs/design/injury-cast/README.md`.

**The cast is the card, not the photo.** Writing goes only where there is
plaster: the signature band (the bottom 40% of the art, where the picture fades
into solid plaster), the nameplate and the stat table. The top 60% of the art is
where a face sits in an uploaded photo, so it carries only the "set in plaster"
note under OVR and one corner plaster. That is what makes the design work over
any custom photo.

**Rarity still reads.** The plaster replaces all six materials, including
Elite's inverted lacquer, and the tier effects (sheen, film, glow and foil) are
off. Rarity survives twice: the pennant silhouette keeps its tier icon, and the
tier word stays on the nameplate. Elite keeps its pointer tilt. The selector
`.live-card[data-rarity][data-injured]` outranks every tier rule whatever the
source order.

**The nameplate line is not extended with "In plaster".** "All-rounder · Common
· In plaster" overflows the plate at grid size, and the look already says it. A
`sr-only` line carries the meaning instead ("Injured: the rating is protected
during recovery", the chip's old tooltip), and everything drawn on the cast is
`aria-hidden`.

**The photo is never tinted, blurred or re-cropped.** It keeps
`object-fit: cover`; only the band and the corner plaster cover it. The known
trade-off is that a face sitting unusually low in the crop gets its chin
softened by the band. That is accepted, because the upload is a square
head-and-shoulders crop. On the shirt back, the shirt lifts 14 viewBox units so
the number clears the band, and two crossed plasters go over the number. The
bust fallback is unchanged; the band covers its base.

**Signatures are fixed per Player.** Two lines, an ink and a doodle are chosen by
an FNV-1a hash of `player.id`, so every copy of the Player's card shows the same
cast on every page, and the server render stays deterministic (no
`Math.random`). The second line is offset from the first by 1 to 11 places, so
the two always differ. Pinned by `tests/unit/injury-cast.test.ts`.

**Never write the injury note on the cast.** `kut.injury_periods.note` is
admin-only and may hold medical detail (ADR-082). The signatures come only from
a fixed pool of twelve English and Dutch lines, each at most 20 characters so
slot 1 fits at every size, and none names a real member.

**Grid size drops the fine print.** Below 224 px (two-up on a phone), a
container query hides the second signature, the doodle, the cast note and "hop".
One signature, the plasters, the clip and the PAC strike remain.

**Market and pack cards unchanged.** The scope is the call sites that already
pass `injured`: the players list and detail, the collection and card detail, and
the album. The market and pack openings can't pass it yet, because their views
carry no `player_id`. ROADMAP "Plaster cast on every card" tracks the fix: add
the id, then make injury status a required part of the card's data.

**Two new fonts**, Caveat 700 (`--font-hand`) and Permanent Marker 400
(`--font-marker`), both through `next/font/google`. They are self-hosted, so the
CSP's `font-src 'self'` holds, and they use `preload: false`, because only
injured cards use them.

**Nothing on the cast animates**, so reduced motion needs no extra rule.

## ADR-085 — One rule decides the plaster cast on every card screen

Date: 2026-09-23

Status: Accepted

Decision: a card shows the plaster cast (ADR-084) when it is **a Live card of a
Player who is injured right now**:
`injured = is_live && injuredPlayerIds.has(player_id)`. The rule lives in one
helper, `toLiveCardPlayer` in `src/lib/live-card-player.ts`, and every screen
whose view row carries `player_id` and `is_live` builds its card through it.
UI only: no migration, RPC or economy change, and Part L is unchanged. Fixes
KB-022 and KB-023. This is PR A of ROADMAP "Plaster cast on every card".

**Owner decisions (2026-09-23), settled:**

- **(a) The market shows the cast.** A buyer should know the Player is out and
  that the card's rating is frozen, not rising.
- **(b) Live cards only.** A Special edition is a frozen snapshot whose rating
  nothing protects (ADR-082), so it never gets the cast, even when its Player is
  injured.

**Why the screens drifted.** Each page applied its own version of the rule.
Card detail checked `is_live`, but the collection list and the album didn't, so
a Special copy wore the cast in its grid and album slot and lost it when opened
(KB-022). Card detail and the album passed the *card* id as the card's `id`,
which the cast hashes for its signatures, so the same Player showed different
lines there than on `/players` (KB-023). Measured locally before the fix: Djanco
read "Snel weer terug!" on `/players` and "TFH misses you" in the album.

**The type makes skipping the rule a compile error.** `LiveCardPlayer.injured`
is now required, and the separate `injured` prop on `LiveCard` is gone. `id`
always means the Player id. The type is a union: either `{ id: <Player id>,
injured: boolean }` or `{ id: null, injured: false }`. A row with no Player id
can therefore never be cast, and a card or listing id has nowhere to go that the
signature hash reads. The shirt-back arc used to key its SVG `<path>` on `id`;
it now uses `useId()`, because two copies of one Player on a page would
otherwise share an element id.

**Which rows go through the helper.** It accepts a `player_directory` /
`top_risers` row (always Live, Player id in `id`) or a `my_collection_cards` row
and its album shape (Player id in `player_id`, `is_live` read from the row). That
covers the players list and detail, Home risers, the collection list, card
detail, the album and the starter reveal on `/welcome`. Home risers and the
starter reveal showed no cast before this; the starter query now selects
`player_id` and `is_live` from a view that already had them.

**The market and pack openings wait for PR B.** `kut.active_market_listings` and
`kut.my_pack_opening_results` have no `player_id` or `is_live`, so those pages
build `{ id: null, injured: false }` explicitly, with a comment naming PR B. The
pack reveal's links used `card.id`, so `PackReveal` now takes
`{ cardId, player }`: the copy's id stays beside the card face, never in it.
PR B appends both columns to both views in one additive migration and switches
these pages to the helper.

**Pinned by** `tests/unit/live-card-player.test.ts`: a Special of an injured
Player is not cast, a Live card of an injured Player is, a Live card of a Player
who isn't injured is not, and the same Player gets the same `id` from every row
shape, never the card id.

## ADR-086 — The market and pack openings carry the card's Player, so they show the cast too

Date: 2026-09-23

Status: Accepted

Decision: `kut.active_market_listings` and `kut.my_pack_opening_results` each
gain two trailing columns, `player_id` and `is_live`, both straight from
`kut.card_editions`. The market list, the listing page, pack results and the pack
reveal then build their cards through the ADR-085 rule, so the market shows the
cast as the owner decided (ADR-085 (a)). Migration
`20261002000000_cast_on_market_and_packs.sql`, test
`cast_on_market_and_packs.test.sql`, spec §11.3. This is PR B of ROADMAP
"Plaster cast on every card", and it supersedes ADR-084's "Market and pack cards
unchanged".

**Copied, then appended.** Each body is copied from its latest version, and the
only new text is the two appended select-list items. A line-by-line comparison
against the source files confirmed that. `create or replace view` can only
append columns, and appending last keeps every existing column's name, order and
type (the ADR-073 lesson). `kut.my_wanted_cards` reads
`kut.active_market_listings`, which is one more reason never to `drop view` here.

**Access is unchanged, and the two views differ in how.** The ROADMAP plan
assumed both views sit behind the ADR-079 gate. Only the market does:

- `kut.active_market_listings` stays a definer view wrapped in
  `where kut.is_active_member()`. The new columns sit inside the gated body, so
  `select *` exposes them and a denied caller still reads zero rows.
- `kut.my_pack_opening_results` is `security_invoker = true`, scoped by
  `opening.user_id = auth.uid()`, and was never one of ADR-079's ten definer
  projections. It has no gate to keep. Its access model is left exactly as it
  was: a member reads only their own openings.

**A disabled member's own pack history is not a gap** (owner decision,
2026-09-23). A disabled account can't use the app: every page redirects it to
`/login`. With a still-valid session, a direct Data API call could read that
member's own pack openings, but that is data they already saw, never anyone
else's, and read-only. It is also nothing this view adds: the member's own rows
in `kut.user_cards`, `kut.wallets` and `kut.wallet_ledger` are readable the same
way, because their policies ask only "is this your row?". So the view is not
gated, and this needs no follow-up. If disabling ever has to mean "sees nothing
at all", the fix is a Supabase auth ban or one rule across all of a member's own
data, not a gate on one view. The `20261002000000` header, which is immutable,
still calls this "left open"; this paragraph supersedes that wording.

**The helper gains one entry point.** `toListedCardPlayer` takes a market or pack
row and hands it to `toLiveCardPlayer` once `player_id` and `is_live` are both
present. The rule stays in one place. A row without them yields
`{ id: null, injured: false }`.

**Deploy ordering.** Vercel deploys on merge, before the hosted push. The three
pages now read these views with `select("*")`, never a column list naming the new
fields, because naming a missing column would fail the read and empty the market
(PR #86). Until the push the fields are absent, and the helper reads that as "no
cast". Measured locally: with the views rolled back to their previous bodies,
the market list, both listing pages and both pack results rendered 200 with every
card and no cast. With the migration re-applied, the cast was back.

**Tier: additive** (`docs/OPERATIONS.md`): two view re-emits, no table, grant or
row change, zero DML. It rides the scheduled backup.

**Rollback** is in the migration header and optional, since the extra columns
are harmless to every reader. `create or replace` cannot drop columns, so the
rollback drops and re-runs three views: `kut.my_wanted_cards` and
`kut.active_market_listings`, from `20260928000000` and `20260920060000`, and
`kut.my_pack_opening_results`, from `20260902000000` block 5. That DDL was
exercised locally twice, once inside the negative control and once for the
deploy-ordering check.

**Negative control.** Run after the rollback DDL, against the old views, the new
test's six schema assertions fail. Its first value query then errors on the
missing `player_id`. The access assertions pass either way, because access didn't
change.

## ADR-087 — The club can pick a Player's cast lines in code

Date: 2026-09-25

Status: Accepted

Decision: `CAST_OVERRIDES` in `src/lib/injury-cast.ts` maps a Player id to the
two lines on that Player's cast. When a Player has an entry, those lines replace
the hashed pair from ADR-084. Ink and doodle stay hashed. A Player without an
entry keeps the hashed lines, so every existing cast is unchanged. This amends
ADR-084's "Signatures are fixed per Player": they are still fixed per Player, but
the club may choose them. **Visual only:** no migration, RPC, economy or rating
change, and Part L is unchanged.

**Why code, not an admin field.** Custom casts are rare: the first one is for a
long-term injury. An admin field would need a column on `kut.injury_periods`, a
new admin RPC, a view change and a hosted push for something set once in a long
while. It would also put free text in front of every member, including on the
market, which is the risk ADR-084 avoided by never showing the admin note. A PR
means someone reviews every line before members see it.

**The pool's rules still hold**, and `tests/unit/injury-cast.test.ts` pins them
for every entry: two different, non-empty lines of at most 20 characters, keyed
by a lowercase Player id (Postgres returns ids in lowercase, and the lookup is an
exact match). A line may come from `CAST_LINES` or be new. The rules the tests
cannot check are for review: never a member's name and nothing medical.

**An entry outlives the injury.** It is keyed by Player, not by injury period,
so it applies to every future injury of that Player too. Delete the entry when
the injury ends if the next one should get fresh lines.

## ADR-088 — Friday Five is removed from the specification

Date: 2026-09-25

Status: Accepted

Decision: BUILD_SPEC Part XV §44 ("Friday Five" / "TFH Five") and the Friday
Five item in §120 (Phase 3) are removed. Both sections keep their numbers, so
existing references still resolve; ADR-089 fills them with Midweek Madness in
the same change. **Docs only:** nothing was built, so no code, migration, RPC or
Part L invariant changes.

**Why.** Friday Five was fantasy football over the club's own attendance and
goals: a squad scored when its Players turned up and scored. The club does not
want to go that way. The successor, Midweek Madness, is played on the cards
themselves, deliberately "without attendance-guessing as the object of play".
It inherits no rule from Friday Five.

**Kept:** the removed section's constraint that matchday rewards must not
inject enough currency to overpower the market economy. §44 carries that line
forward.

ADR-053's reference to "BUILD_SPEC Part XV can place squad building" is
historical and stays as written.

## ADR-089 — Midweek Madness is specified and will be built

Date: 2026-09-25

Status: Accepted

Decision: BUILD_SPEC §44 specifies **Midweek Madness**, a weekly 5-card squad
knockout, and §120 makes it the Phase 3 build. §145 gains its constants. The
design was worked out with the owner on 2026-09-25; its rationale stays in
`docs/ROADMAP.md`, and the spec is canonical. **Docs only in this change:**
nothing is built yet, and Part L gains #25 and #26 only in the PRs that make
them hold (§44.13).

**Why build it now.** §120 said not to implement Phase 3 until market and
collection usage proved sustained. That gate was the owner's call, and the
owner has made it: members' cards need a weekly purpose beyond collecting and
trading, and the design has a go/no-go of its own before any schema exists.
The TypeScript engine and simulation harness come first; if tuning cannot hit
the §44.12 targets, the build stops there.

**The rules in short** (§44 has them in full):

- Squads lock Wednesday 20:00 Europe/Amsterdam; one round is revealed every
  30 minutes from 20:30.
- The whole roster is entered. A member who doesn't pick gets a random auto
  squad at a heavy penalty; opt-out is in settings. Trialists fill empty slots.
- Card power is `ovr_factor × form_roll × pick_factor × fitness × day_roll`,
  with OVR flattened to 1.00–1.35, a pick factor that rewards the unpopular
  pick among owners, and a small penalty for an injured Player.
- Archetypes shape a squad's lines; one card plays in goal.
- Matches are played as chances; a draw goes to penalties.
- Each win pays `250·r/(R(R+1)/2)`, so a champion totals 250.
- The seed's hash is published before the lock, the seed after the final.
- Targets: the nine-row table in §44.12.

**Owner decisions recorded here:**

- **Coins are live from week one;** there are no shadow weeks. The safety net
  is the admin rehearsal (engine run on real squads, writes nothing), void
  before payout, and the audited `admin_adjust_wallet` after it.
- **The full phrasebook ships at launch.** This replaces the brainstorm's
  "launch with about 100 lines".
- **The self-service archetype cooldown is 14 days.** Without it a member could
  retune their own card for the week, say by becoming the club's only
  Goalkeeper. The admin path is not limited.

**Filled in where the brainstorm was silent** (none changes a rule the owner
set; each can be revisited at the tuning sign-off):

- **The pick-factor curve.** The brainstorm gives 1.30 near share 0 and 0.85 at
  share 1, and calls a sole owner's share of 0.50 "a mild penalty". A straight
  line between the two ends puts 0.50 at 1.075, a bonus, so the starting curve
  is piecewise linear through (0, 1.30), (0.40, 1.00) and (1, 0.85): 0.50 lands
  at 0.975, just below the neutral 1.00 that auto squads and trialists get.
- **Rounding of the per-round pay:** rounds before the final round half up, and
  the final takes the remainder. This reproduces every figure in the
  brainstorm's table, and the amounts keep increasing up to six rounds.
- **Fewer than four entrants** marks the week `skipped`, like the club-break
  gate.
- **A saved card sold or burned before the lock** becomes a trialist; a card
  listed on the market or held in trade escrow is still owned and still
  plays. If no saved card survives, the member gets an auto squad.
- **The launch switch** stops new tournaments; one already open still runs
  unless voided.
- **Bracket placement:** byes go to seeded random round-1 pairings, and
  entrants are shuffled into the slots.
- **New tunables** with starting values: trialist OVR 30, a line-shape scale,
  the keeperless keeper factor and a shoot-out cap.

**Supersedes the ROADMAP "KUT Five Cup" item.** It was an earlier sketch of the
same idea and proposed a hard cap of 50 coins per member per week. That cap is
deliberately not carried over. The champion's 250 matches the attendance
reward, and a full bracket of 17–32 entrants issues 953 coins a week, about
four attendance rewards. That is within §44's constraint that matchday rewards
must not overpower the market economy. The faucet gets its own ADR with the
payout migration, which checks it against Part L.

**Consequences:** the build runs as ten PRs, one migration or invariant each
(ADR-070): spec, engine and harness (owner signs off tuning), report renderer
and phrasebook (owner reads it through), squad entry, archetype cooldown,
engine and worker (#25), payout (#26), entry UI, results UI, launch. The
Midweek pages live under the Club tab, which ADR-053 kept free for squad
building.

## ADR-090 — The Midweek engine runs in SQL, with a TypeScript twin pinned by shared golden vectors

Date: 2026-09-25

Status: Accepted

Decision: the Midweek Madness engine is **authoritative in SQL**: the stored
result decides coins. It also exists as a pure TypeScript module under
`src/game/midweek/`. **Both must reproduce one committed golden-vector file,**
`tests/fixtures/midweek-golden.json`:

- a Vitest test checks the TypeScript side;
- a pgTAP file generated from the fixture checks the SQL side;
- a unit test fails when the generated pgTAP file is stale against the
  fixture.

To make bit-for-bit agreement possible, the engine uses no floating point:

- **Randomness** is `sha256(seed ‖ tag)`, with the first 6 bytes read as an
  integer in `[0, 2^48)`. That is core Postgres `sha256()` and Node's
  `crypto`, with no extension or dependency.
- **Every factor is an integer in parts per million:** `bigint` in SQL, plain
  numbers in TypeScript, kept well under 2^53. No `exp`, `log` or float
  division, so the two engines cannot drift by a rounding difference.

**Why a twin, given ADR-064.** ADR-064 deleted TypeScript copies of SQL
formulas because they were asserted only against themselves and nothing
reachable used them. It named the one condition for bringing a mirror back: a
parity harness over shared fixtures. This twin has that harness, and a real job
the SQL cannot do. Tuning needs thousands of simulated seasons against
simulated managers, which plpgsql cannot run in reasonable time. The twin also
powers the unit-level balance smoke test, so a later tweak cannot silently
break a target.

**Why not TypeScript only.** Results pay coins, so they must be computed
server-side and atomically with the lock, like every other economy operation
(Part XX–XXIII). An Edge Function would add a second runtime and deployment
path for no gain.

**Consequences:** any change to the engine changes both sides and regenerates
the fixture in the same PR. The report renderer is presentation only and has no
SQL twin. This is an exception for Midweek Madness, not a reversal of ADR-064:
the rating and economy formulas stay SQL-only.

## ADR-091 — Midweek Madness shows entered squads: entry is the default, opting out is the consent

Date: 2026-09-25

Status: Accepted

Decision: KUT deliberately hides who owns which card, and "See other members'
squads" is a blocked ROADMAP item. Midweek Madness has to show squads in its
bracket and reports, so it gets a narrow exception with these rules:

- **Taking part is the default, and the opt-out is the consent mechanism.**
  Auto entry means a member can be entered without doing anything, so entry
  alone isn't treated as consent. The rules page says plainly that your five
  entered cards are shown to members, and the opt-out in settings takes you
  out entirely: not picked, not auto-entered, never shown.
- **Only the entered cards are shown,** and only from round 1's reveal, never
  before the lock. Before the lock a member sees only their own squad. The
  rest of a collection is never shown.
- **Owner counts appear only as aggregates of at least three.** Below that the
  count is null in SQL and the report says "a rare pick", so "1 of 1 owners"
  never names who holds an Elite.
- **Only active members can read any of it** (ADR-079); nothing is public.
- **The seed is readable only by `service_role`** until the tournament is
  complete. Before that only its hash is visible.

**What this does not guarantee.** The "why" panel shows each card's pick
factor, and together with the visible pickers a determined reader can work out
how many entrants own a Player. That reveals a count, never which members; the
threshold is about never printing a count that points at a person.

**Consequences:** "See other members' squads" stays blocked. This exception
covers only cards a member entered in a Midweek tournament. It is not a
collection view.

## ADR-092 — Midweek Madness tuning: the engine's numbers, and one trade-off for the owner

Date: 2026-09-25

Status: Accepted — signed off by the owner on 2026-09-25 (option 1 below)

Decision: the pure TypeScript engine (`src/game/midweek/`) and its simulation
harness (`npm run sim:midweek`) are built, and the engine is tuned to the values
now in BUILD_SPEC §44 and §145. The evidence is
`docs/archive/MIDWEEK_TUNING.md`, generated from 5,000 simulated 20-week seasons.
Seven of the nine §44.12 targets pass. Two sit just outside their bands, and they
pull against each other:

| Target | Goal | Simulated |
|---|---|---|
| Strongest collection beats the weakest in a single match | about 65% (60–70%) | 70.6% |
| A thought-through five beats a random five from the same collection | at least 60% | 58.7% |

**Why they cannot both be met here.** A random search over eleven knobs
(OVR weight, form range, pick curve, day roll, keeper value, auto factor,
chance count, contrasts), confirmed at 1,000 seasons per candidate, found a
frontier: every point off the first row costs about one point of the third.

- The weakest collection in a KUT-shaped club is almost always a starter pack:
  three cards and two trialists. The trialist factor is already as high as the
  "empty slot is never best" rule allows. Against the weakest collection that
  fields five *real* cards, the strongest wins only about 58%, so wealth alone is
  a modest edge; the trialists make up most of the first row.
- The edge of thinking comes mostly from fielding a Goalkeeper, not from OVR.
  Raising the keeper's value lifts the third row but also the first, and lets
  whichever fixed habit tends to include keepers pull ahead of the rest, which
  breaks the "no habit wins" row.

**The owner's choice at the sign-off.** The options put to the owner, in rough
order of preference:

1. Accept both rows as they are, reading "about 65%" as met at 70.6% and 60% as
   met at 58.7%.
2. Relax one target: the first row to "about 70%", or the third to "at least
   55%". The harness can then move along the frontier to favour the other one.
3. Change a rule, not a number. For example, make a trialist a card the member
   can see and pick around, or give the Goalkeeper less weight. Either reopens
   part of ADR-089 and needs its own decision.

**Changed from the starting values**, each within §44's "starting value" remit:
OVR factor max 1.35 → 1.10; form 0.75–1.45 → 0.80–1.25; pick curve
(0, 1.30) … (1, 0.85) → (0, 1.25) … (1, 0.875); day roll ±10% → ±12%; auto
factor 0.65 → 0.575; keeperless factor 0.60 → 0.45. Injured fitness (0.95), the
line-shape scale (0.5), trialist OVR (30) and the shoot-out cap (20) are
unchanged.

**New knobs, added where §44 left the model open:**

- `MIDWEEK_TRIALIST_FACTOR` (0.825). At OVR 30 with a neutral pick factor, a
  trialist would out-power the worst real card: an OVR-30 card picked by every
  owner and injured. The factor keeps it just below, so an empty slot is never
  the best play. It also applies, on top of the auto factor, to trialists in an
  auto squad.
- **The chance model:** 14 slots, a chance in each with probability 0.686, the
  side chosen by the ratio of midfields; goal probability
  `0.30 × difficulty × 2S / (S + R)`; the chance-type weights and difficulties
  in `config.ts`. It gives about 2.5 goals between equal balanced sides and 2.85
  across a bracket, with 21.5% of matches going to penalties.
- **The published odds:** a closed-form `a³ / (a³ + b³)` over the sides'
  week-long ratings. The report's calibration table shows how it tracks what
  happens.

**How the harness measures** (all in `tests/sim/midweek-world.ts`):

- The club: 30 Players, low-rated on the whole, about 80% All-rounders and two
  Goalkeepers. 22 members, each with a starter pack plus a skewed number of
  packs drawn with the real pack weights. 30% don't pick, and the rest keep one
  habit all season: highest OVR, least popular last week, last week's
  finalists' Players, random, or thought-through.
- "Thought-through" means a Goalkeeper if one is owned, then the best OVR,
  avoiding injured Players. A thinker that also predicted this week's pick
  shares from last week's did worse, which is the "no pick stays best" goal
  working.
- "No habit wins" is measured as the best habit's lead over the runner-up
  among the four fixed habits, at most 5%.
- The engine runs on a fast tag-hashing generator in the harness and on
  sha256 in production. Draws stay keyed by tag, so a counterfactual squad in
  the same week sees the same form rolls.

**Consequences:**

- The golden vectors (`tests/fixtures/midweek-golden.json`, 8 matches including
  shoot-outs, 8 tournaments including byes, a skipped field and edge squads)
  pin the engine for the SQL twin (ADR-090).
- A 200-season smoke run of the targets, with a 5-point tolerance, runs in the
  unit suite, so a later tweak can't silently break the balance.
- **Signed off 2026-09-25: option 1.** The owner accepted both rows as they
  are. The harness bands follow: the first row passes up to 72%, the third
  from 58%, so `npm run sim:midweek` passes at the tuned values and a drift
  past either still fails it. The §44.12 targets keep their wording; the
  accepted values sit beside them.

## ADR-093 — Midweek match reports: a seeded renderer over a reviewed phrasebook

Date: 2026-09-25

Status: Accepted (the phrasebook itself awaits the owner's read-through in
review)

Decision: match reports are rendered by `renderMatchReport` in
`src/lib/midweek/report/`, a pure TypeScript function of the stored match (the
events, both squads' lock-time factors and names) and the tournament's
**published `seed_hash`**. It returns a headline, up to three fact lines, a
timeline, the shoot-out and a "why" panel (BUILD_SPEC §44.10). Every line comes
from the phrasebook in `src/lib/midweek/report/phrasebook/`: 512 lines at
launch, the full phrasebook ADR-089 promised.

**Why the seed hash, not the seed.** The plan said "a pure function of the
stored events and the seed". The seed stays secret until the final is revealed
(ADR-091), but rounds are shown from 20:30. Rendering from the secret would need
service-role access on every report page. The hash is public from the start,
unique per tournament, and just as good a key for picking phrases. Revealing
which phrases were picked says nothing about the seed.

**The rules the tests pin** (`midweek-phrasebook.test.ts`,
`midweek-report.test.ts`):

- every placeholder is valid for its layer, and lines stay short and
  punctuated;
- no line appears twice in the phrasebook, and no phrase repeats within one
  report across a thousand simulated matches;
- no gendered words (he, him, his, she, her and so on) and no medical terms
  anywhere;
- injury words only in the injury layers, and no body parts there;
- a miss always credits the keeper, a defender or the woodwork, with a
  ridicule list as a backstop;
- an injury phrase appears only when a card in that match was injured at the
  lock;
- every fact kind can be produced;
- minimum sizes per layer, so variety cannot quietly shrink.

What a test cannot judge (tone, humour, nothing hurtful to a clubmate) is the
owner's read-through in the PR.

**Choices made in writing it:**

- A goal's quality tier follows the engine's probability: below 15%
  sensational, 35% or more routine. Saves are graded the same way by the chance
  they denied.
- The timeline holds every goal plus the biggest other chances, 4–8 moments. A
  shoot-out narrates only misses and the deciding kick, so a long sudden death
  doesn't drain the phrasebook.
- Injury mentions are asides added after the moment ("Not bad for someone still
  in plaster."). The finish itself stays true to the engine's chance type, so an
  injured Player's long shot is never described as a header.
- Names: display names, with a double full stop tidied when a name ends in an
  initial. A trialist is "Sanne's trialist", numbered when a side has two or
  more. A Player fielded by both sides gets the manager's name added.
- In an auto squad, the "why" panel labels each pick "auto squad" rather than
  quoting owner counts for a choice the member didn't make.
- Headline priority: hat trick, upset, thrashing, three-keeper gamble,
  shoot-out, comeback, late winner, keeperless side, then a comfortable or
  narrow win. Keeperless squads are common while the roster has few
  Goalkeepers, so that headline sits low.

**Design pass (owner, 2026-09-25).** The pages (PRs 7–8) get a design pass
first, in a separate session. `node scripts/midweek/sample.mjs` exports an
invented tournament with every report rendered (`design/midweek/`) as its
input, and PRs 7–8 implement the approved mockups. PRs 3–6 carry on
meanwhile.

## ADR-094 — The archetype cooldown: how the 14 days are measured and what counts as a change

Date: 2026-09-25

Status: Accepted

Context: ADR-089 decided that a member may change their own Player's archetype
at most once every 14 days, because the archetype shapes a Midweek Madness
squad's lines (BUILD_SPEC §44.2). The plan for PR 4 said to copy
`kut.set_own_player_archetype` verbatim from
`20260906000000_goalkeeper_archetype.sql` and add the guard. Four details were
left open.

Decision (migration `20261004000000_archetype_cooldown.sql`):

- **The stamp.** `kut.players.archetype_changed_at` (nullable, no default, no
  backfill) records the last self-service change. Null means never, so the
  first change is always allowed, including for a Player whose archetype an
  admin chose. The admin path (`admin_add_player`, admin writes to
  `kut.players`) neither checks nor sets it.
- **14 days is 336 elapsed hours.** A change is refused while
  `now() < archetype_changed_at + interval '336 hours'`. `interval '14 days'`
  would add calendar days in the session's time zone, which can differ by an
  hour across a DST change from what the settings page computes. Elapsed hours
  keep SQL and `nextArchetypeChangeAt` in `src/game/archetypes.ts` identical.
- **Re-saving the current archetype is not a change.** It is neither refused
  nor stamped, so pressing Save twice doesn't start (or restart) a cooldown. The
  rating rebuild still runs, as it always did.
- **The guard locks the Player row** (`for update`) before reading the stamp,
  so two concurrent saves cannot both pass it. This is the one change to the
  copied body beyond the guard itself.

The refusal is SQLSTATE `22023` with the message
`archetype change cooldown: next change allowed from <ISO-8601 UTC>` and the
exact moment, to the microsecond, as its DETAIL. The page rounds the time it
shows up to the minute, so it never names a moment the RPC would still refuse. An invalid archetype is still checked first and
keeps its own `22023` message. `/settings/card` reads the stamp separately and
tolerates its absence (Vercel deploys before the hosted push), shows the next
allowed date in club time and disables the form until then; the server action
turns the refusal into the same sentence if a stale page submits anyway.

Privacy: `kut.players` is readable by every authenticated caller, so the stamp
is too. It reveals when a member last changed their archetype, which the
archetype itself already shows on every card; it is not treated as private.

Tier: additive (ADR-032). Rides the last scheduled backup.

## ADR-095 — The Midweek engine migration: one pure SQL tournament, a stored result that cannot change, and when the lock is read

Date: 2026-09-25

Status: Accepted

Context: PR 5 of the Midweek Madness build is migration
`20261005000000_midweek_engine.sql`: the SQL engine, the lazy worker, the
stored result, the reveal projections and the admin controls, and Part L #25.
The plan fixed the scope; the design handoff (`design/midweek/HANDOFF.md`)
added bye positions, day rolls per card and match, goals per side, the
champion, owner counts withheld until complete (D3), admin counts and the
rehearsal's return shape. Several details were open, and a few depart from the
plan's text.

Decision:

- **The SQL engine speaks the TypeScript twin's shapes.** `kut._mm_simulate`
  takes `EntrantInput[]` and returns `TournamentResult` as JSON, and
  `_mm_play_match` takes two `MatchSide`s and returns a `MatchOutcome`. The
  plan said "pure; returns rows". JSON lets the parity test compare each golden
  tournament and match whole, and lets the worker and the rehearsal share the
  one function: the worker stores what it returns, the rehearsal only reads it.
  All 160 golden values matched on the first run, and perturbing one constant
  fails 20 of them.
- **Stored results use the engine's 0-based indexes** (slot 0–4, side 0–1,
  pairing from 0), so a page hands them to the renderer without translating.
  Squad slots in `kut.midweek_squad_cards` stay 1–5: they are the member's
  picks in order, and the lock moves the surviving picks up into engine slots,
  with trialists after them, as the engine does.
- **A bye is a row in `kut.midweek_matches`** (`bye = true`, no side 1, side 0
  the round-1 winner), so the bracket has its position (HANDOFF question 2).
- **Day rolls live on the match row**, one `integer[]` per side, indexed by
  slot. The plan put `day_roll` on events and the hand-off asked for a
  (match, side, slot) home; an array per side is that home and matches the
  engine's `dayRollsPpm` exactly (HANDOFF question 4). Goals and penalties are
  stored per side, side 0 first (question 5).
- **The champion is appended to `kut.midweek_tournaments_public` as two
  columns**, `champion_user_id` then `champion_name`, shown once the final is
  revealed and never for a void week.
- **Reveal timing is read from the stored rows.** Matches and events appear at
  their `reveal_at`; entries appear once a round-1 row is revealed. The views
  call no `_mm_` function, because members cannot execute the engine and a
  definer view checks function grants against the caller.
- **Owner counts (D3, ADR-091).** `midweek_entries_public` carries `picks` and
  `owners` as null until the week is `complete`, and `owners` below three
  always. `midweek_pick_shares_public` lists a Player nobody picked only when at
  least three own it, and does not publish the smoothed share: a row for an
  unpicked Player owned by one or two members, or its share, would point at
  them.
- **Part L #25 is enforced in the tables, not only by the worker.** Result rows
  can be inserted only while their tournament is `open` (inside the lock step)
  and never updated or deleted directly; a status moves only forward; the week,
  seed hash, a passed lock and a drawn bracket never change; a published seed
  must hash to `seed_hash`; squads cannot change once `now() >= lock_at`. Deletes
  cascading from a deleted tournament or account pass (they run one trigger
  level down), so account deletion and test clean-up still work. The squad
  guard is an AFTER trigger so a bad row still fails with its own constraint's
  error.
- **When the lock is read.** KUT has no scheduler, so the lock step runs at the
  first worker call at or after `lock_at` and reads the field then: active
  members, owned cards, OVR as `my_collection_cards` reads it, the archetype
  from the Player (as every card screen shows it, including on Special editions),
  and the ADR-085 injury flag. **Opt-outs alone count as of `lock_at`**
  (`opted_out_at <= lock_at`), which keeps PR 3's rule that a locked squad is
  not withdrawn. A trade, a published session or an archetype change between
  `lock_at` and that first call is therefore seen. This qualifies §44.11's "the
  result is identical whenever it is computed", which now reads "given the
  field". KUT keeps no ownership or rating history to read an earlier moment
  from; page visits on a Wednesday evening make the gap minutes, and the
  archetype cooldown (ADR-094) limits what a late change can do.
- **The club-break gate** reads the football week before `week_start`
  (Monday − 7 to Sunday − 1) for a session with status `published`.
- **The open step** creates the first ISO week whose lock is still ahead and
  which has no tournament, so a voided or skipped week is never run again. The
  seed is sha256 of two version-4 UUIDs (`gen_random_uuid`, 244 random bits from
  `pg_strong_random`), which needs no extension.
- **The worker returns `{locked, completed, opened}`**, not a count, and logs
  each call in `kut.midweek_jobs`. A lock or completion that fails rolls back
  that tournament alone, is recorded, and is retried by the next call.
- **Void** records `voided_at` and `voided_by` (two new nullable columns). It
  is allowed for an `open` or `simulated` week, including mid-evening after
  rounds have shown (§44.9: a void week shows no results; HANDOFF question 7
  stands as specified). A voided open week is not re-run; the next week opens.
- **The rehearsal** runs the earliest open week's saved squads plus auto squads,
  or everyone as auto when no week is open (the Tuesday before launch, with the
  switch still off), with a throwaway seed. It returns the shape in BUILD_SPEC
  §44.14, including `would_skip` and warnings for lost saved cards, the gate and
  the switch. **Admin counts** come from `kut.midweek_admin_overview`, an
  admins-only view.

Consequences: the payout migration adds coins to the worker's complete step
and a member view of their own rewards; the pages (PRs 7–8) read the views
above and tolerate their absence before the hosted push. The concurrency test
`tests/integration/midweek-race.test.ts` runs three worker calls at once and
finds each week locked once and completed once, with no error.

Tier: additive (ADR-032). The migration writes no row, and the worker writes
only once a tournament exists, which needs the switch, off on hosted. Rides the
last scheduled backup.

## ADR-096 — Midweek Madness payouts: a bounded weekly faucet, paid from the stored bracket

Date: 2026-09-26

Status: Accepted

Context: PR 6 of the Midweek Madness build is migration
`20261006000000_midweek_payouts.sql`, which pays the coins §44.7 specifies and
adds Part L #26. ADR-089 left the faucet's own ADR to this migration, and
§44's one inherited rule is that matchday rewards must not overpower the
market economy. The plan fixed the mechanism (a guard table in the
`grant_bibs_reward` shape, paid inside the worker's complete step); a few
details were open.

Decision:

- **The faucet is accepted at the specified size.** Round `r` of `R` pays
  `round_half_up(250 × r / T)`, the final absorbing the rounding, so a champion
  collects exactly `MIDWEEK_CHAMPION_TOTAL` (250, now also
  `ECONOMY.midweekChampionTotal`). Because the whole active roster is entered
  and byes pay, every run issues a full bracket: 333, 459, 650 or 953 coins for
  2–5 rounds. At today's roster of about 22 members that is 953 a week, about
  43 coins per member. For comparison, one attended session pays that member
  250 plus up to 50 for the report, and a session of a dozen attendees issues
  3,000 in attendance alone; the most any member takes from a Midweek night is one
  attendance reward. Showing up stays the dominant coin source, so the faucet
  sits within §44's rule. Watch the admin economy dashboard's coin supply and
  pack purchases after launch; the lever is `MIDWEEK_CHAMPION_TOTAL`, which
  lives in `src/game/midweek/config.ts` and `kut._mm_config()` (a change is a
  migration plus regenerated golden vectors, ADR-090).
- **Paid from the stored bracket, not recomputed.** `kut._mm_pay_tournament`
  pays each winner in `kut.midweek_matches`, byes as round-1 wins, at
  `kut._mm_round_payouts(rounds)`, so a payment can never disagree with the
  bracket members saw. It runs inside `kut._mm_complete_tournament`, re-created
  to pay before the status flips to `complete`, in the same transaction and
  under the tournament's row lock. A week is therefore complete exactly when it
  has been paid, and `admin_void_midweek`'s existing refusal of a complete week
  is the "no void after payout" rule, unchanged.
- **Part L #26 is enforced in the table, not only by the worker.**
  `kut.midweek_rewards` has the primary key `(tournament_id, round_no,
  user_id)` and a deferred `ledger_id`; the ledger row carries the idempotency
  key `midweek:<tournament>:<round>:<member>`. A guard trigger accepts a reward
  only while its tournament is `simulated` with the final revealed (so only in
  the complete step), only for a stored win (that pairing's winner, in that
  round, bye flag matching), only at exactly that round's amount, and only
  while the member's total for the tournament stays within 250. A paid reward
  never changes. Deleting a reward row is not blocked, as with
  `kut.bibs_rewards`, and cannot re-pay a win: a week is paid only while it is
  completed, once. Foreign keys restrict deleting a paid tournament, match,
  member or ledger row.
- **One inbox message per member paid, per tournament.** Type
  `midweek_result`, title "Midweek Madness", deduplicated by
  `(user, type, 'midweek_tournament', tournament)`. The body says how far the
  member got, the coins and the champion ("You reached the semi-finals on Wed 7
  Oct: +100 KUT Coins. Lieke won it."; the champion's reads "You won Midweek
  Madness on Wed 7 Oct: 250 KUT Coins over the night."), following the copy in
  `design/midweek/HANDOFF.md`. The date is the week's scheduled Wednesday. A
  member out in round 1 without a bye is paid nothing and gets no message: the
  inbox reports things that happened to the member's wallet, and the Home card
  and the bracket carry the result (§44.7's "one message per member" is read as
  one per member paid).
- **A member disabled between the lock and the payout is not paid,** as
  `grant_bibs_reward` skips a disabled member. The field already excludes
  members disabled at the lock, so this covers only the evening's window.
- **Members read their own rewards** through `kut.my_midweek_rewards` (HANDOFF
  "Your coins"): one row per win with the week, round, pairing (for the report
  link), bye flag, amount and when it was paid. A definer view gated on
  `kut.is_active_member()` (ADR-079), like `kut.my_midweek_squad`; the guard
  table itself is service-role only. The "+17 so far" line before payout stays
  display-only arithmetic in the page.
- **Constraints** `wallet_ledger_reason_check` and
  `user_notifications_event_type_check` are re-created with the full lists from
  `20260930000000_injury_protection.sql`, the latest to change them, plus
  `midweek_win` and `midweek_result`.

Consequences: the concurrency test now also checks that three concurrent
worker calls pay the completed week once, a full bracket's worth, with one
ledger row per win and one message per member paid; its clean-up takes back
what it paid members already on the local stack. The pages (PRs 7–8) read
`my_midweek_rewards` tolerantly, and the inbox labels `midweek_result` before
the hosted push.

Tier: data-changing (docs/OPERATIONS.md): it widens what the ledger accepts and
adds a coin faucet, so the hosted push needs a fresh cold-verified backup. The
migration itself writes no row, and nothing pays until a tournament exists,
which needs the switch, off on hosted.

## ADR-097 — The Midweek entry pages: Home owns the route, a Collection strip, and what shows outside an open week

Date: 2026-09-26

Status: Accepted

Context: PR 7 of the Midweek Madness build is the entry UI: the picker at
`/club/midweek`, the opt-out in Settings, the Home card, the Collection strip
and section 12 of `/how-it-works`, built to the approved mockups in
`design/midweek/` and `design/midweek/HANDOFF.md`. It carries no migration;
every view it reads is already on hosted, and the switch there is off. HANDOFF
asks this PR to record owner decisions D1 and D2, and the build plan asks it to
decide what the page shows while a week isn't open, since the evening is PR 8.

Decision:

- **D1: Home owns `/club/midweek` in the navigation,** next to `/chronicle`,
  because both answer "what's happening this week" and Home's card is the
  route's entry point. The plan's "add it to the Club entry" predates ADR-053,
  which removed that entry. The route stays under `/club`; the `/club` redirect
  to Collection is unchanged, and Collection does not own it. PR 8's
  `/club/midweek/[weekStart]` pages inherit the ownership. BUILD_SPEC §46
  records it.
- **D2: the planned Club-page card is a strip under the Collection header,**
  in the album and in Manage, linking to the picker. Home keeps its own card
  under its header (BUILD_SPEC §47). Both show only while picking is open for a
  member who hasn't opted out; PR 8 adds their evening and after-the-final
  states.
- **When Midweek shows at all (HANDOFF open question 6, settled).** The switch
  on shows it; with the switch off, a tournament that is still `open` or
  `simulated` keeps it visible until it completes or is voided, because §44.8
  lets an open week run after a pause. Otherwise `/club/midweek` is the app's
  not-found page (Week-Disabled), and the Home card, the Collection strip and
  the Settings panel are absent. `/how-it-works` section 12 is the rules page
  and always shows. The opt-out panel follows the same rule as the rest, so it
  appears with the feature rather than before it.
- **Tolerant reads.** One loader, `src/lib/midweek/load.ts`, reads
  `midweek_current` and the caller's squad with `select("*")`. A missing
  relation, a failed read or a denied read (zero rows, ADR-079) means "not
  showing", logged, never a failed page. The picker is the exception once
  Midweek is showing: a failed squad or collection read throws, because "not
  picked" would be a false statement about the member's entry.
- **The PR 7/8 boundary: small holding states.** Outside an open week the
  picker page shows one of three short states, which PR 8 replaces with the
  designed screens:
  - locked tonight (the lock has passed, or the week is `simulated`):
    "Squads are locked", when round 1 comes out, whether the member's saved
    five, an auto squad or nothing (opted out) is in, and the fairness seal;
  - the latest week has ended and the next isn't open yet: "Next week opens
    soon" with that week's result line;
  - switched on before the first tournament exists: "Opening soon".
  Above the picker, last week's outcome is the one-line strip of
  `Picker-Saved`: how far the member got and their coins (from
  `my_midweek_rewards`), "went out in round 1" or "sat it out" (whether
  `midweek_entries_public` holds an entry for them) and the champion, or the
  club-break, too-few or void notice. It has no "Bracket →" link and there is
  no champion hero yet: both are PR 8 pages (D4).
- **The too-few notice names the minimum, not the count.** HANDOFF's "Only
  {3} clubs were in" needs the field size of a skipped week, which no view
  publishes; the strip says "Fewer than 4 clubs were in, and a bracket needs
  4." Publishing the count would be a view change for a later migration PR.
- **The picker works one Player per slot.** The grid shows one tile per
  Player, and a save sends that Player's strongest owned copy, judged by what a
  copy decides before the lock: the OVR factor times fitness (§44.3). So a
  Special edition that kept a higher OVR beats the Live copy, and an injured
  Player's Special edition beats a Live copy of the same OVR. Ties go to the
  higher OVR, then the card id.
  - **"Saved" means the cards a save would send now are exactly the saved
    ones.** A saved copy sold since, or a stronger copy bought since, shows
    "Unsaved changes" with a notice, because only a saved squad counts at the
    lock (§44.2). A saved Player no longer owned at all leaves the slot open
    (a trialist) and is named.
  - **"Load last week's five"** reads the caller's latest earlier squad from
    `my_midweek_squad`, keeps each slot's position, keeps a Player still owned
    through any copy, opens the slot of one no longer owned and names it, and
    saves nothing (§44.2).
  - **A save compacts the squad.** `save_midweek_squad` numbers slots by array
    order, so a five saved with slot 2 empty comes back as slots 1–4. Slot
    position has no effect in the engine, which moves surviving picks up at
    the lock anyway (ADR-095).
  - **Refusals** map to HANDOFF's copy (22023, both P0001 cases by message).
    HANDOFF gives no words for P0002 and 42501; the page says "There's no
    Midweek Madness week open to pick for right now." and "Only active KUT
    members can take part."
- **Opting out.** The Settings switch takes two steps to opt out, one tap to
  come back (`set_midweek_opt_out`), and the opted-out picker offers "Take part
  again" too. The confirmation says a saved five for that week will be
  removed, only when the RPC would remove one (an open, unlocked week with a
  saved squad); after the lock it says the opt-out applies from next Wednesday,
  because opt-outs count as of `lock_at` (ADR-095).
- **Presentation.** The mockups' `mw-*` classes are ported to Tailwind
  utilities, with the tier palette and the plaster band as arbitrary values;
  nothing is added to `globals.css`. The lock countdown is the only ticking
  client code: its first render uses the server's `now`, so server and client
  print the same text. Times are Europe/Amsterdam, and the clocks in the copy
  (20:00, 20:30) come from `MIDWEEK.schedule`. `/how-it-works` takes every
  number from `MIDWEEK`, `roundPayouts`, `bracketShape` and
  `ARCHETYPE_CHANGE_COOLDOWN_DAYS`.

Consequences: `SectionTabs` and `app-nav.tsx` are unchanged. The
authenticated E2E seeds five fixture Players (ids `00000097-…`), six cards for
`release_member`, the switch on and next week's tournament open with a fixture
seed, removes all of it in its teardown (switch back off), and resets the
member's squad and opt-out before each Midweek test, so both device projects
start from "not picked, taking part". PR 8 replaces the holding states with the
evening, complete, skipped and void screens, adds the bracket link and the
champion hero with D4's cutoff, and the lazy `runDueMidweek()` trigger.

## ADR-098 — The Midweek results pages: reports that read the same all night, the champion until Thursday, and a trigger on every Midweek page

Date: 2026-09-26

Status: Accepted (the owner read the four new phrasebook lines and approved
them, with the choice to render report text without owner counts, on
2026-09-26)

Context: PR 8 of the Midweek Madness build is the results UI: the evening and
the champion on `/club/midweek`, the bracket at `/club/midweek/[weekStart]`,
the match report at `.../match/[matchId]`, the Home card's and Collection
strip's evening states, `/admin/midweek`, and the lazy trigger. It is built to
the approved mockups (`design/midweek/`, HANDOFF.md) and carries no migration:
every view it reads is on hosted. HANDOFF asks this PR to implement and record
owner decisions D3 and D4, and leaves questions 7, 10, 11 and 12 open.

Decision:

- **D3: the renderer's `ownersPublished` flag, and a report whose text never
  changes.** `ReportInput.ownersPublished` is new. When false, no picked card
  carries a pick label (an auto squad still reads "auto squad", a trialist
  nothing), and the contrarian-hero fact uses a new, count-free pool,
  `contrarian_unpublished`, instead of `contrarian_known` or `contrarian_rare`.
  Before this, a null owner count read as "a rare pick", which before
  `complete` would have labelled every card rare. The plan's wording ("the
  pages pass the flag; the text never changes after it first appears") cannot
  hold both ways: every report first appears before its week completes, so a
  page that passed `ownersPublished = complete` would swap the contrarian line
  for its counted version at completion. So the pages render a report's text
  (headline, facts, timeline, shoot-out) with the flag false, always, and only
  the "why" panel's pick labels follow the week's status
  (`renderStoredReport` in `src/lib/midweek/report/from-db.ts`). The counted
  contrarian lines stay in the phrasebook for the design sample and the tests,
  but members now read the count-free ones. The pool has four lines, not one,
  because every fact pool keeps at least three (the phrasebook's variety rule).
- **D4: the champion leads until Thursday 23:59 Amsterdam.**
  `championLeadsUntil(lock_at)` is Friday 00:00 in club time, two days after
  the lock's date in Amsterdam; clocks change on a Sunday at 01:00 UTC, so the
  Friday's offset is the day's own. Unit-tested in summer and winter time and
  across both changeover weeks. Until then `/club/midweek` shows Week-Complete,
  with "Next Wednesday is open" linking to `/club/midweek?view=pick`, the way
  through to next week's picker while the champion leads. Home follows the
  same cutoff: after the final it says who won and how the member did, and
  goes back to "Pick your five" on Friday. The Collection strip is about
  picking, so it keeps asking for a pick throughout; D4 names only the page
  and Home.
- **`/club/midweek` now has every state.** PR 7's holding states are replaced:
  Week-Locked (the lock has passed, round 1 isn't out: the clock and the
  member's own five), Week-Revealing ("Round 2 is out": the clock, "Your night"
  with coins "so far · paid after the final" from `roundPayouts`, and the round
  just out), Week-Complete (above), and the skip and void notices above next
  week's picker. The last-week strip gains its "Bracket →" link. Before round 1
  nothing about the rest of the field is visible (§44.9), so "Your five" shows
  the saved cards the member still owns now, with today's injury cast; from
  round 1 on, every card on a results page is its lock-time snapshot (the
  `injured` flag and OVR from `midweek_entries_public`), as HANDOFF asks.
- **The report adapter has a database twin.** `reportInputFromRows` builds the
  renderer's input from `midweek_matches_public`, `midweek_events_public` and
  both sides' `midweek_entries_public` rows, as `from-engine.ts` does from an
  engine run. A unit test stores every golden tournament's matches the way
  `_mm_lock_tournament` stores them, reads them back and gets exactly the input
  and the report its engine run gives. The scoreboard is always side 0 left,
  from the per-side goals, never the renderer's winner-first `score`.
- **The bracket** is assembled from the revealed rows: byes are their round-1
  rows, a round not out yet shows who meets when the round before is out
  ("Winner, QF 1" otherwise), and "Your path" is brass. HANDOFF drew the `lg`
  tree `aria-hidden` beside a list that is `display: none` at that width, which
  would leave a screen reader nothing on a desktop; the tree keeps round
  headings and the same labelled match rows instead. The page validates
  `weekStart` as an ISO Monday and the report `matchId` with `isUuid` (KB-007)
  before any query. Past weeks stay readable with the switch off (ADR-097).
- **Admin, `/admin/midweek`**, the eighth admin tab: the switch
  (`admin_set_midweek_enabled`), this week from `midweek_admin_overview`
  (status, lock, squads saved, opted out, the seal, and the worker's last run
  and error), the rehearsal (`admin_midweek_rehearsal`; the result lives in the
  page's state, since the rehearsal writes nothing, so "Last run" is that
  result's `ran_at`), and void at `?void=1` with a 3–200-character reason and a
  confirmation tick. The refusals are mapped: 42501, 22023, P0002, and P0001 by
  message (paid, or did not run). After payout the void view points to Economy
  instead; a voided week says it is void.
- **The lazy trigger.** `runDueMidweek()` (`src/lib/midweek/run-due.ts`)
  copies `finalizeDueSurveys`: a 60-second damper per server process, a
  count-first check through the service client (an open week whose lock has
  passed, a simulated week whose final is out, or the switch on with no week
  running), then `run_midweek_due(5)`, errors logged and swallowed. Home and
  all three Midweek pages call it before their own reads.
- **HANDOFF questions settled.**
  - 7, void mid-evening: as specified (ADR-095). The bracket and every report
    URL of a void week show the void notice and nothing else.
  - 10, handicap precision: three decimals (×0.575, and ×0.474 for a trialist
    in an auto squad), so no factor is rounded into a different one.
  - 11: the factor strip keeps "OVR"; the formula line explains it.
  - 12, in part: under a manager's own side the "why" panel drops the
    "(manager)" the renderer adds to a Player both sides fielded. The other
    phrasebook items stay with the phrasebook's owner.
- **Smaller choices.** "Locked in: all five still yours" counts the squad
  actually saved ("all 3"). "Five each" appears only when both sides took
  five kicks; a shoot-out decided early shows its kick count. The coins paid
  across the club are the bracket's arithmetic, the same `roundPayouts` the
  payout uses.

Consequences: the authenticated E2E seeds a completed week in 2001 (a
published session in the week before, release_member's five saved, three
fixture members, the worker run to completion) and removes it after, taking
back the coins it paid. The bracket and a report are in the no-overflow
checks, and that check now compares with the device's width: a phone widens
its layout viewport to fit an element that is too wide, and `innerWidth`
grows with it, so the old check could not see the shoot-out's screen-reader
table doing exactly that at 320 px (now clipped inside a block).

Tier: no migration.

## ADR-099 — Midweek archetypes are frozen when the week opens, not at the lock

Date: 2026-09-26

Status: Accepted (supersedes the "frozen at the lock" part of ADR-089 and §44.2;
amended by ADR-110: the open step now rotates unclaimed Players' archetypes
right before the insert, so the snapshot freezes the rotated ones)

Context: the lock read each card's archetype live from `kut.players`. The
14-day cooldown (ADR-094) limits how often a member changes their own
Player's archetype, not when. So every other week a member could change on
Wednesday afternoon and reshape every squad that had already picked their
Player: a Goalkeeper turning Speedster leaves those squads keeperless (×0.45
in goal) with no time to react. The owner asked to close that.

Decision (migration `20261008000000_midweek_archetype_snapshot.sql`):

- **A snapshot per tournament.** `kut.midweek_archetype_snapshots` holds every
  Player's archetype for each tournament, written by an `after insert` trigger
  on `kut.midweek_tournaments`. A trigger rather than a change to
  `_mm_open_next`, so every way a week is created (the worker's open step,
  admin SQL, the database tests) snapshots in the same statement, and a week
  can't exist without one.
- **The lock plays the snapshot.** `kut._mm_field` reads
  `coalesce(snapshot.archetype, player.archetype)`; nothing else it reads
  changes. The rehearsal uses the same function, so it previews what the lock
  will play.
- **A Player created after the open plays their live archetype.** They have no
  snapshot row. A member linked to a brand-new Player could still change once
  before the lock (the first change is always allowed); accepted, because it
  needs an admin to add a Player mid-week and the next week is frozen as usual.
- **The picker shows the snapshot.** `kut.midweek_archetypes` (definer view
  gated on `kut.is_active_member()`, ADR-079) feeds `/club/midweek`. The tile
  and its card face carry the week's archetype, and a card changed since the
  open reads "Goalkeeper this week, Speedster from next". The card's six stats
  stay as they are today: the engine uses only the archetype and OVR, and
  recomputing stats would show numbers no other screen shows. The page
  tolerates the view's absence (Vercel deploys before the hosted push), falling
  back to the live archetype, which is what the lock reads until then.
- **The open week is backfilled at the push**, as the roster stands then. It
  opened on 2026-09-26, the day of this change.
- **The cooldown stays.** It no longer protects Midweek Madness, but it still
  limits churn on a card others own. Relaxing it is a separate owner decision.
- **Everything else is unchanged:** a change still applies at once to the card
  face and the rating rebuild everywhere outside Midweek Madness. OVR is not a
  lever: archetype offsets sum to zero.

`/settings/card` and how-it-works §12 now say a change counts in Midweek
Madness from the next week.

Tier: data-changing (ADR-032): the backfill writes rows (into the new table
only) and the lock reads a new source. Fresh backup before the push.

## ADR-100 — Transfer-market ownership counts use every private collection copy

Date: 2026-09-27

Status: Accepted (owner decision, 2026-09-27)

Context: A member deciding whether to buy a market listing could not see if
they already owned that Player or the exact edition. The market grid did not
read the collection; the listing detail page did, but immediately removed
listed and trade-offer-held cards before constructing its offer picker.

Decision:

- Every listing on `/market` and `/market/[listingId]`, including the viewer's
  own listing, shows two viewer-private totals: all copies of the same Player
  and copies of the exact edition. When both are one, the label contracts to
  "You own 1 of this edition"; otherwise it reads "You own P · E of this
  edition". Nothing renders when both totals are zero.
- The spoken label expands the shorthand to name both concepts explicitly,
  for example "You own 3 copies of this Player, including 1 copy of this
  edition."
- Every row returned by `kut.my_collection_cards` counts. A copy remains
  owned while it is listed or held by a trade offer, so neither
  `active_listing_id` nor `held_by_offer_id` excludes it from these totals.
- `/market` makes one parallel collection query selecting only `player_id`
  and `edition_id`, then builds Player and edition count maps once for all
  listings. The detail page extends its existing collection select with those
  two ids, calculates ownership from the complete result, and only then
  filters the rows used by the offer form.
- The count and wording live in a pure helper. The UI is a shared component,
  compact enough to wrap cleanly in the two-column phone grid.

Consequences: the feature reads only the already owner-scoped private
collection view and does not reveal another member's holdings. Buying,
listing, market filtering, injury casts and trade-offer eligibility keep their
existing paths. This is frontend-only: no migration, view, RPC, RLS policy or
Part L invariant changes. It is implemented and verified, but not deployed.

## ADR-101 — Members report one combined goals + assists count from the week of 28 Sep 2026

Date: 2026-09-27

Status: Accepted (owner decision, 2026-09-26). Implemented locally; not deployed.

Context: the post-session self-report (ADR-059) asks for goals only, so a
player who sets up the goals earns nothing for it. The owner raised "goals +
assists" as the next priority on 2026-09-26 (`ROADMAP.md`, Priority), framed as
renaming the input, not the formula.

Decision:

- **One combined integer.** A member reports a single number, their goals and
  assists added together: **Goals + Assists**, short **G+A**. 2 goals + 2
  assists is entered and stored as `4`. Goals and assists count equally and are
  **not stored separately**, so the split is not recoverable. Every surface
  states a post-cutover count as one total ("4 G+A"), never as goals and
  assists.
- **Cutover: the football week beginning Monday 2026-09-28.** A session dated
  on or after it reports G+A; an earlier session keeps its goals-only meaning
  and its "goals" label everywhere. Because the cutover is a Monday, a football
  week is wholly on one side, so a week's Monday decides a weekly total
  (Chronicle issues, the rating graph) exactly as a session date decides a
  session. No historical value is backfilled, relabelled or re-scored.
- **Precondition checked.** The latest documented hosted session is 21 Sep
  (`PROGRESS.md`, Midweek Madness launch), and nothing dated on or after 28 Sep
  had been published when this was built (2026-09-27). Local and CI fixtures
  that date sessions at `current_date` are fictional and take whatever meaning
  their date gives them; the one pgTAP assertion that depended on it
  (`next_features_contracts.test.sql`, the ADR-069 notice body) now derives the
  expected wording from its fixture session's date.
- **Compatibility names stay.** `attendance.goals`, `session_reports.goals`,
  `session_goal_overrides.goals`, `session_report_results.effective_goals` and
  `goal_form`, the views' `reported_goals`, `goal_total` and `goal_count`, and
  RPC parameters such as `p_goals` keep their names. Renaming them would be a
  breaking schema change with no behavioural gain.
- **Scoring is unchanged.** The count feeds the same ladders: 0 / 1 / 1.25 /
  1.5 Form for 0 / 1 / 2 / 3+ (at most 1.5 per session), kudos 0 / 1 / 1.5 / 2,
  the 3.5 per-session cap, the session-age decay 1 / .75 / .5 / .25 / 0, the
  Form cap of 8 and the Live OVR ceiling of 83. A combined 4 earns exactly the
  1.5 Form that 4 goals earned. `kut._rebuild_season_core` is not touched.
- **The SHO modifier reads the combined count.** The rebuild adds
  `least(8, 2 * count)` to SHO for the latest football week, and that count is
  now G+A. This is a deliberate consequence of not splitting the number: a
  playmaker's assists now lift Shooting too, and a reported 4 (say 2 goals + 2
  assists) produces the existing capped +8 SHO. Accepted rather than engineered
  away, because separating it would need separate goal and assist fields, which
  this decision rejects. "How KUT works" says so.
- **Midweek Madness is unaffected.** Its goals are simulated match events with
  their own wording; no Midweek file, table or function changes.

Implementation:

- **TypeScript: one source.** `src/game/reported-count.ts` holds
  `GOALS_ASSISTS_CUTOVER = "2026-09-28"` and the pure helpers every screen uses:
  `reportsGoalsAndAssists`, `countLabel` (Goals / G+A), `countLabelLong` (Goals
  / Goals + Assists), `countNoun`, `countQuestion`, `formatGoals` ("1 goal",
  "2 goals"), `formatGoalsAssists` ("4 G+A"), `formatReportedCount` (by date),
  `speakReportedCount` ("4 goals and assists", for accessible labels) and
  `countColumnLabel` (a mixed column reads "Goals / G+A"). No component compares
  against the date itself. A non-ISO value reads as historical, the reading
  that never relabels anything.
- **Surfaces.** The report page heading ("Goals + Assists & kudos"), question
  ("How many goals and assists did you get in total?"), a one-line example, the
  10+ confirmation ("Confirm 10 G+A"), the server-side confirmation error and
  the explanatory copy; the Home prompt; the Chronicle list, standfirst,
  provisional-total note, per-session totals, open-report prompt and finalized
  per-player results; the admin report roster, add/edit controls and correction
  form (with a "one combined total" hint after the cutover), the admin
  attendance form's report notice and legacy-entry fieldset, and the attendance
  index; the player rating graph's tooltips, the football's accessible label
  and the screen-reader table; the rating story's session lines and empty-state
  copy; "How KUT works" §3. Admin correction errors are now date-neutral ("A
  whole number from 0 to 99 and a reason are required.").
- **SQL: notices only.** Migration
  `20261009000000_goals_assists_notice_copy.sql` adds
  `kut._uses_combined_count(date)` (immutable, executable by `service_role`
  only, like `kut._join_names`) and re-creates, from their latest bodies
  verbatim, the three functions that write notice copy: `kut._open_session_survey`
  (report-open title "Goals + Assists & kudos"), `kut._finalize_one_session`
  (results body "Reported G+A and recognized kudos are now in the Chronicle.";
  kudos body "Your 4 G+A and these kudos lifted your card rating +N OVR this
  week.") and `kut.admin_correct_session_goals` ("Reported G+A corrected"; "the
  effective G+A total"). Each reads the session date (`_finalize_one_session`
  in the `match_sessions` read it already made, `admin_correct_session_goals`
  in its existing locking join, the trigger from `new`) and branches only the
  wording. Locking, qualification, scoring, the rebuild call,
  `on conflict ... do nothing`, security definer, `search_path` and privileges
  are unchanged; the local catalog's ACLs were compared before and after. SQL
  error messages such as `valid goals and reason are required` are internal and
  unchanged. Notices already written keep their wording.

Tests: `supabase/tests/database/goals_assists_cutover.test.sql` (48
assertions) drives the real publish, report, finalize and correct path on a
2026-09-27 and a 2026-09-28 session: every notice's wording on both sides; the
ladder for 0 / 1 / 2 / 3 / 4 / 10; kudos 2 and a 3.5 session input for a
combined 4 with three categories; hand-computed Form (5.1875), OVR (51) and
kudos-notice deltas (+2, +3); SHO +6 for 3 and +8 for 4, 5 and 10; a guest's
admin-entered count; no pre-cutover notice mentioning G+A after corrections and
re-finalization; and, on a 17-week fixture season, Activity 100, Form capped at
8, Live OVR at 83 and SHO 91. `tests/unit/reported-count.test.ts` covers the
boundary, singular and plural, the combined format, the column label, parity of
the SQL and TypeScript cutover dates, and that no Midweek file reads the new
terminology; the rating-story, rating-history (rendered markup) and Chronicle
unit tests gained both sides of the cutover.

Consequences:

- Tier: additive (ADR-032). Three `create or replace` function bodies and one
  new immutable helper, no DML. It still needs its own catalogue PR in
  `VibeTrunk/supabase` and a hosted push; nothing is applied from here.
- **Deploy ordering.** Vercel deploys on merge, before the hosted push. The
  pages need nothing new from the database, so they work either way. Until the
  push, notices for sessions from 28 Sep are written in the goals wording and
  keep it, because notices are never rewritten, while the pages already say
  G+A. Pushing before the first post-cutover session is published (Mon 28 Sep)
  avoids the mix entirely; pushing before its window closes 24 hours later
  still gets the results and kudos notices right.
- **Balance.** The ladder is unchanged, but a count that includes assists
  reaches 2 and 3 more often, so more members will sit at 1.25 to 1.5 Form per
  session and more SHO spikes will appear. `RATING_BALANCE_REVIEW.md` records
  this; it stays bounded by the unchanged 1.5 / 3.5 / 8 / 83 caps.
- Part L is unchanged. BUILD_SPEC §8, §15.2, §145 and a new implemented
  amendment record the rule.

## ADR-102 — The market's ownership count rides the card as a chip

Date: 2026-09-30

Status: Accepted (owner decision, 2026-09-30, on the Claude Design mockups).
Resolves KB-026. Amends ADR-100's presentation; its counting rules stand.

Context: ADR-100 put "You own P · E of this edition" in a bordered block under
each market card. Only listings the viewer owns copies of had the block, so in
the two-column phone grid (and every other width) owned tiles grew taller and
the Buy buttons in a row no longer lined up. The owner found it ugly and asked
for a small chip on the card itself, the way the price already rides it.

Decision:

- **A chip on the card, in both places.** On `/market` and
  `/market/[listingId]` the ownership count is a dark pill with the Collection
  glyph at the foot of the card art, on the name's left edge, just above the
  nameplate. It clears the OVR, the pennant, the price pill and the surname on
  the shirt at every width. The bordered block is gone from both pages, so
  every tile in a grid row is the same height.
- **`LiveCard` gains an optional `badge` slot**, drawn inside the art
  (`.live-card__badge`), so it sits exactly on the art's lower edge at every
  card size instead of guessing a percentage from outside. No other screen
  passes one. On an injured Player's card it covers the lower cast signature;
  the chip is information, the signature decoration.
- **Visible text.** The grid chip shows the counts alone: "You own 2", or
  "You own 3 · 1" when the Player and edition totals differ. The listing page
  shows ADR-100's sentence, with equal totals contracted the way 1 · 1 already
  was: "You own 2 of this edition" instead of "You own 2 · 2 of this edition".
- **Spoken text is ADR-100's, unchanged.** On the grid the card sits inside the
  listing link, whose `aria-label` replaces everything in it, so the chip there
  is visual only and the tile speaks the full sentence in an `sr-only` line
  after "Sold by". On the listing page the chip carries it itself.

Consequences: frontend only. No migration, view, RPC, RLS policy or Part L
invariant changes, and ownership is still counted from the same owner-scoped
`kut.my_collection_cards` read. BUILD_SPEC §36 "Listing surfaces" records the
chip.

## ADR-103 — The listing page shows the card's discard value as the price floor

Date: 2026-09-30

Status: Accepted (owner decision, 2026-09-30, on the Claude Design mockups).
Resolves KB-027.

Context: a buyer could not see what a listed card would discard for, so there
was no floor to judge the asking price against. `kut.active_market_listings`
carried no discard value, and `kut.card_discard_value` has been revoked from
`authenticated` since `20260816070600`. KB-025 already has the card detail page
(`my_collection_cards`, an inlined formula) and the listing bounds
(`get_listing_bounds` → `card_discard_value`) reading the value from two places.

Decision:

- **Listing detail page only.** `/market/[listingId]` shows "Discard value"
  with the coin figure under the asking price, and the line "What this card pays
  out if you discard it." The grid tile already carries the price, the ADR-102
  ownership chip, the seller and Buy; a second coin figure there would blur
  which number you pay. The detail page is one tap away.
- **One source.** Migration `20261010000000` appends `discard_value` last to
  `kut.active_market_listings`, inside the ADR-079 `is_active_member()` gate,
  computed by calling `kut.card_discard_value(card.id)`. The formula is not
  inlined a third time. The view stays `security_invoker = false`,
  `security_barrier = true`, with its grants unchanged.
- **Grant `authenticated` and `service_role` EXECUTE on
  `kut.card_discard_value(uuid)`**, the same two roles the view grants SELECT
  to. A function called inside a view is checked against the caller, not the
  view owner, even in a definer view: without the grant every member's market
  read failed locally with "permission denied for function card_discard_value",
  and so did every service-role read of the view and of `kut.my_wanted_cards`,
  even with zero rows. This is a small access change: any `authenticated` JWT
  can call the function directly and learn a card's discard value, given its
  id. The value is derivable from public ratings, card ids are only readable
  through member-gated views, `service_role` already bypasses RLS, and anon
  stays revoked.
- **Guard the call.** `card_discard_value` raises P0002 for a card with no
  rating (no snapshot, no live state in the active season), where the view
  falls back to OVR 30. The view only calls it when
  `coalesce(snapshot_ovr, live_ovr)` is not null, so such a row stays listed with
  a null `discard_value` instead of breaking the whole market read. The guard
  repeats the function's rating lookup, not its formula.
- **Nothing is made up.** Vercel deploys on merge, before the hosted push; the
  page reads the view with `select("*")` and renders the line only when
  `discard_value` is a number (KB-014).

Consequences: read-only. `kut.discard_card` still works out the payout on the
server at discard time; no Part L invariant changes (§11 "client cannot choose
discard payout" is untouched: the page only displays). A listing may be priced
as low as 80% of the discard value (`get_listing_bounds`), so a visible floor
makes buying such a listing and discarding it an obvious small profit. The
owner accepted that; the page states the facts and adds no "bargain" label.

## ADR-104 — The Midweek evening runs on a versioned clock: lock 19:55, a round every 15 minutes, paid after the final ends

Date: 2026-10-01

Status: Accepted (amends ADR-089 §44.1 times and ADR-096 payout timing; MM 2.0
release B, first of three)

Context: the owner chose a faster evening for MM 2.0 (`docs/ROADMAP.md`,
"MM 2.0"): squads lock at 19:55, round 1 starts at 20:00 and a round every 15
minutes, so with 17–32 entrants the final starts at 21:00 instead of 22:30.
Matches are to unfold chance by chance (Q6, decided 2026-10-01: 20 seconds per
chance slot, 5 seconds per penalty kick; Q7: the same pacing for every match),
so the payout must wait for the end of the final, not its start, or the inbox
message names the champion while the final is still playing. Three things made
a plain constant change wrong: every page computed every time from today's
config, so changing it would re-time weeks already played on screen; Vercel
deploys before the hosted push, so for a few days new code meets old rows; and
Part L #25 says a simulated week keeps what it was drawn with.

Decision (migration `20261011000000_midweek_evening_timing.sql`):

- **A schedule version per week.** `MIDWEEK.schedule` holds
  `versions` (1 and 2) and `current` (2); `kut.midweek_tournaments` stores
  `schedule_version`, which the open step sets and which is fixed once the week
  locks (Part L #25, guard extended). Version 1 is every week before this ADR:
  lock 20:00, round r revealed whole 30 × r minutes later. Version 2: lock
  19:55, round r starts `lock + 5 + 15 × (r − 1)` minutes. One formula covers
  both (`roundOffsetMinutes`, `roundIntervalMinutes`), and adding a clock later
  means adding a version, never editing one.
- **Pages take the clock from the week.** `scheduleVersionOf(row)` reads the
  column, and treats a row without it as version 1, which is exactly what every
  hosted week is until the push. The lock and round-1 clocks in copy (how-it-works
  §12, the privacy line, Settings) come from the week too.
- **Every event gets its moment, stored at the lock.** The match clock runs
  0' to 90' over the 14 chance slots of 20 seconds (4:40), so a chance is due
  at `kick-off + minute × 280 s / 90`; after full time each shoot-out kick, and
  a settling draw, follows 5 seconds after the one before. `midweek_matches.ends_at`
  is the last of these (full time without a shoot-out, kick-off for a bye) and
  `midweek_match_events.reveal_at` each event's. Derived from the minute rather
  than the slot, so a live viewer can run a match clock that reaches each event
  as it happens. `kut._mm_match_timing` and `matchTiming` are twins, pinned by
  the golden vectors (both versions, every golden match). Weeks simulated
  before this keep null times: they reveal whole matches, as drawn.
- **The longest match fits in a round.** 4:40 plus 50 kicks (5 + 20
  sudden-death rounds a side) and a settling draw is 8:55, under 15 minutes; a
  unit test pins it for every version, so a winner is never due in two matches
  at once.
- **`final_reveal_at` is the end of the final.** The complete step and the
  reward guard already wait for it, so the seed, pick shares, coins and inbox
  message now land when the final ends; neither function changed. Under
  version 1 the end equals the reveal, so its meaning is unchanged there.
- **Views are unchanged except for the version.** `midweek_current` and
  `midweek_tournaments_public` append `schedule_version`; matches and events are
  still revealed whole at their start (§44.9). Revealing them event by event is
  ADR-106's views-only migration, pushed together with the live viewer.
- **The rehearsal uses the week's clock** and also gives each round's end and
  the version.
- **The open week moves to version 2 at the push**, its lock from 20:00 to
  19:55, unless 19:55 is already past (then it stays on version 1). An open
  week's lock may move (Part L #25).

First week on the new clock: the one open when the push lands. The target is
to push by Sat 10 Oct, making the week of 12 Oct (lock **Wed 14 Oct 19:55**)
the first. A push after that is held until the 14 Oct payout, and the week of
19 Oct (lock Wed 21 Oct 19:55) is the first.

Update 2026-10-02: pushed on 2 Oct, so the **week of 5 Oct (lock Wed 7 Oct
19:55)** is the first on version 2; the 28 Sep week stays on version 1
(`docs/DEPLOYMENTS.md`).

Consequences: the evening is shorter (final at 21:00 with 17–32 entrants) and
coins land about 5–9 minutes after the final starts instead of at its reveal.
Members see the earlier lock on the lock bar, the picker and how-it-works. No
engine result changes: the golden fixture's matches and tournaments are byte
for byte the same; only its config, schedule and timing vectors changed.

Tier: data-changing (docs/OPERATIONS.md): it re-times the open week's lock
and moves when the payout runs. Fresh cold-verified backup before the push.

## ADR-105 — Midweek from the lock: the draw and every five, the week's dice from round 1

Date: 2026-10-02

Status: Accepted (amends ADR-091 "only from round 1's reveal", ADR-095
"entries appear once a round-1 row is revealed", ADR-098's Week-Locked "before
round 1 nothing about the rest of the field is visible", and ADR-104 "views are
unchanged except for the version"; MM 2.0 release B, second of three)

Context: the owner approved the MM 2.0 evening in DR2 (2 Oct,
`design/ux-review/HANDOFF.md`). Its first five minutes, 19:55 to 20:00
(`Evening-Draw`, `Bracket-FromLock`), show who you meet and when, and both
fives, "with no form, pick or chance until 20:00". Until now nothing about the
field was readable before round 1's reveal, so the data has to come first; the
pages follow in F5. The same review found a leak ADR-104 introduced: since
`final_reveal_at` became the end of the final, `midweek_current` and
`midweek_tournaments_public` showed it from the lock, and its distance from
the final's kick-off told an API reader at 19:55 whether the final would go to
penalties. And the Compete tab's badge (F1) needs to say `Live` from the lock
to the end of the final, which a member can no longer compute once that end is
hidden.

Decision (migration `20261012000000_midweek_draw_from_lock.sql`):

- **`kut.midweek_draw_public`, new:** round 1 of a drawn week from the lock:
  each pairing's position, byes (one entrant, which counts as a win and is no
  secret), both managers and the kick-off (`kickoff_at`, the round-1 match's
  stored start on the week's clock, ADR-104). It has no result column at all:
  goals, penalties, winner, win chance, day rolls and `ends_at` stay in
  `midweek_matches_public`, from kick-off. Gated like every Midweek projection
  (definer view on `kut.is_active_member()`, a void or undrawn week shows
  nothing).
- **`midweek_entries_public` from the lock instead of round 1.** Visible from
  the lock: the five cards, OVR, archetype, injury flag, trialist, auto, the
  keeper slot (the draw shows `in goal`), and the factors that follow from those
  anyway (OVR factor, fitness, handicap, line multipliers). **Withheld until
  round 1 kicks off:** `form_roll_ppm`, `pick_factor_ppm` and `power_ppm`, the
  week's dice and the pick shares; they read null. Columns unchanged (views
  only gain columns at the end); picks and owner counts keep owner decision
  D3, unchanged.
- **`final_reveal_at` only once it has passed,** in both member views. No page
  reads it there; the worker and the admin page read the table.
- **`midweek_current` appends `evening_live`:** the latest week is `simulated`
  and now is between its lock and the end of its final. A week past its lock
  that the worker hasn't drawn yet is not live, since it may still be skipped;
  a drawn week whose final is over is not live even before the worker pays it.
- **Pages tolerate the withheld dice.** `EntryCardRow`'s three columns are
  nullable, and `reportInputFromRows` gives no report while any are null, which
  can only happen when the entries are read a moment before round 1's kick-off
  and the match a moment after; the match page then shows "not found", as for
  an unrevealed match. Today's evening page stays in its Week-Locked state
  until round 1, so nothing changes on screen until F5 uses these views.

What it still gives away, accepted: the keeper slot. With two Goalkeepers in a
squad the one in goal is the stronger this week, and a keeperless squad's
keeper is the outfielder with the most defence times power: a hint at
relative form inside one squad, never a number.

Consequences: from 19:55 every member reads the whole draw and every entered
five, which ADR-091 already makes public from 20:00; the privacy line moves to
"From 19:55" with the picker (F3). Matches and events are still revealed whole
at their start; event by event is ADR-106 (PR 4).

Tier: additive (docs/OPERATIONS.md): views only, no table, function or row
changes.

## ADR-107 — Compete replaces Leaderboard: Midweek, Standings and Players under one tab

Date: 2026-10-02

Status: Accepted (amends ADR-053's primary tabs and ADR-097's route and
Collection strip; reverses owner decision D1 and retires D2; MM 2.0 frontend
F1)

Context: the UX review of 1 Oct found Midweek Madness hard to find: it lived
under Home at `/club/midweek`, reached through Home's card and a strip on
Collection, and the chrome could not show that a pick was due or the evening
was on. The owner chose option C (DR1-1, DR1-2 in
`design/ux-review/HANDOFF.md`): a fifth tab named Compete holding Midweek,
the standings and the player directory, with Midweek at `/midweek`; DR2
approved the mockups on 2 Oct, and Q12 (2 Oct) removed the Collection strip.
ADR number: ADR-106 stays reserved for the live-reveal migration (B3), which
an applied migration's comment already names.

Decision (no migration):

- **Compete is the fifth primary tab** (`/midweek`, owning `/midweek`,
  `/leaderboard`, `/players`), in place of Leaderboard, with Leaderboard's
  icon. Home no longer owns any Midweek route.
- **Section tabs `COMPETE_TABS`:** Midweek · Standings · Players, at the top
  of the picker and evening, a week's bracket, Standings and the directory.
  Match reports keep their back link (the mockups show no tabs there). The
  Leaderboard page is headed **Standings**; its URL stays `/leaderboard`.
- **Midweek moves to `/midweek`.** `/club/midweek/:path*` is a permanent
  redirect (308) in `next.config.ts`, which covers the evening, every bracket
  and match link already shared, and `?view=pick`. A whole subtree with dynamic
  segments is why it is a config redirect, not a page stub like `/club` and
  `/sessions`. With Midweek switched off and no week running, `/midweek`
  redirects to Standings: it used to be "not found", which would make the tab
  itself a dead end.
- **`CompeteBadge`:** `Pick` while a week is open, the member hasn't opted out,
  and they have no saved squad; `Live` from the lock to the end of the final,
  for every member; nothing otherwise, and no `Pick` when the squad read fails.
  `Live` reads `midweek_current.evening_live` (ADR-105) and, where that column
  is absent because Vercel deploys before the push, falls back to the end of
  the final (`final_reveal_at`, readable from the lock until ADR-105). Shown on
  the tab in both bars; `Live` also on the Midweek section tab, while `Pick`
  stays off it because the picker is the page asking. The chip is hidden from
  screen readers and one sentence stands in, so the link reads "Compete Pick.
  Midweek Madness: you haven't picked your five". The nav context loads it
  with the other badges: `midweek_current`, and the caller's squad only while
  picking is open; a failed read shows no badge and never fails the page.
- **The Collection strip is removed** (Q12), with the entry-point data only it
  used. Home keeps its card. Midweek actions now revalidate the root layout,
  since the badge is on every page.
- **New tokens** `--color-live` (#ff8091) and `--color-ink-on-live` for the
  `Live` chip, as in the mockups.
- Copy: how-it-works §10 and Home's Rank tile say "standings".

Consequences: one tap from anywhere to Midweek, and the chrome says when a pick
is due or the evening is live. Standings is one tap deeper than before (Home's
Rank tile links straight to it). BUILD_SPEC §46 records the new bar, and also
corrects its description of the avatar, which links to Settings.

## ADR-108 — The release gate runs in the owner's session: no launcher, no session receipt

Date: 2026-10-02

Status: Accepted (reverses the agent-session part of ADR-071 and its
addendum; ADR-106 stays reserved for MM 2.0 B3)

Context: ADR-071 required production-sensitive work to start through
`scripts/start-production-claude.ps1` or `start-production-codex.ps1`. The
launcher wrote a receipt bound to the candidate SHA, session hooks recorded the
model they could observe, a `PreModelSwitch` hook blocked a downgrade off Opus,
and `request-production-gate.ps1` refused to run without a valid receipt. In
practice every migration release needed a second, cold agent session, opened
from a terminal at the candidate commit, only to run the gate, and the owner
then had to return to the working session. The receipt certified which model
ran the gate; it protected no data, and Claude Code cannot reliably report the
model to `SessionStart` anyway, so much of it was "launcher-enforced" by the
script it was meant to check.

Decision: remove the agent-session requirement entirely.

- `request-production-gate.ps1` no longer reads a receipt, and its manifest no
  longer has an `agent_session` block.
- Deleted: both launchers, `scripts/lib/KutSessionReceipt.psm1` and
  `scripts/test-kut-session-receipt.ps1` (`npm run test:session-receipt`), the
  Claude `SessionStart` and `PreModelSwitch` hooks, the Codex `SessionStart`
  hook, their registrations and their unit tests.
- The production invariant now says the gate runs in the owner's ordinary
  agent session and does not certify the model; the release-gate invariant
  drops "valid agent-session evidence".

Everything that guards hosted data stays: CI for the exact SHA, a clean
checkout at it, catalogue parity, a fresh cold-verified backup re-verified at
gate time, finalizer readiness, authenticated mobile E2E, and the rule that
every merge, push and hosted mutation needs its own explicit instruction from
the owner.

Consequences: the whole release, gate included, runs from one session. Gate
evidence written before this change still carries `agent_session`; nothing
reads it.

## ADR-111 — The match page in team colours: names as segments, a lane timeline, and a Why list with Power

Date: 2026-10-02

Status: Accepted (amends ADR-093's renderer output and ADR-098's report page;
MM 2.0 frontend F2, built to the mockups the owner approved in DR2. ADR-109 and
ADR-110 stay reserved for PR 5 and C1)

Context: the UX review's DR1-5 and DR2-1..3 and DR2-5..8
(`design/ux-review/HANDOFF.md` "Matches") redesign the match report. With two
clubmates often fielding the same Player, a report needs every name in its
team's colour. The old "why" panel was a dense grid of factors that the owner
found hard to read, and HANDOFF asks for a list that never scrolls sideways.
Matches are still revealed whole at kick-off (the per-event views are ADR-106),
so this slice builds the full-time state only. The live states come with F6.

Decision (no migration, no phrasebook change):

- **The renderer returns segments as well as text.** `renderMatchReport` keeps
  every text field byte for byte (the stored-rows test and the design sample
  confirm it) and adds `headlineParts`, `parts` on each fact and timeline
  moment, `lineParts` on the shoot-out and `label` on each "why" card. A
  segment is plain text or a name with its side. A Player both sides fielded
  carries its manager as `owner`, which the text spells out as
  "Iris W. (Sanne)". Pages colour names from the segments and never re-parse
  text (HANDOFF question 1). Because the page drops the suffix on screen,
  "Kees R. (Bart)." would show as "Kees R..": the segments drop the sentence's
  full stop after a name that ends in an initial. Unit tests pin that every
  line's segments read as its text with the suffixes removed.
- **Team colours** (`--color-team-blue` and `--color-team-red`, each with `-bg`,
  `-line` and an on-colour) go only on the match page (DR2-1). Side 0 is blue
  and on the left for every viewer. `PlayerName` colours a name and keeps
  "(Sanne's)" for screen readers (DR2-2).
- **`MidweekScoreboard`:** names and digits in team colour, Through/Out chips,
  no chance counter.
- **`MidweekLaneTimeline`:** one lane per chance, leaning to its side, with
  the head mirrored for side 1. It switches to two lanes either side of a
  minute-and-score spine at 600 px of its own width (a container query). The
  desktop report's left column is narrower than that, so it keeps one lane.
  Screen readers hear "39th minute. Goal for Sanne." and the score after it.
- **Shoot-out rows:** the manager, the total (DR2-5), then the kicks filled in
  team colour or ringed. Then the renderer's lines with coloured names. The
  sudden-death ring goes, as in the mockup; the count of kicks stays.
- **`MidweekWhyList`** replaces `MidweekWhyPanel`. Each card shows **Power in
  this match**, `power_ppm × day_roll_ppm`, so the factor boxes multiply out to
  the number on screen; the old panel showed the week's power. Cards are listed
  strongest first, one compact row each: a pill tinted by strength band (heat
  colours, never team colours; the band word for screen readers) and a bar from
  0.50 to 1.50 with a tick at 1.00 (DR2-8). `Show every factor` opens five
  boxes per card: Rating, Form, Pick, Fitness, Day, always all five (DR2-6).
  Each label explains itself on hover, tap or focus and closes on blur or
  Escape (DR2-7, WCAG 1.4.13); every figure in that copy comes from `MIDWEEK`.
  The bars are SVG `width` attributes, because the CSP blocks inline styles.
- **Owner counts leave the report** (HANDOFF): the list shows no pick labels,
  and an auto squad is a chip on its side's heading. The bracket's pick shares
  keep the counts after the final (D3 unchanged). `renderStoredReport` still
  computes the labels; no page shows them now.
- A score in report text keeps to one line (word joiners around its dash), so a
  320 px headline never ends a line on "3–".

Consequences: one way to read a match: the colour says whose, the lane says
which side, and the Power pill says how strong each card was. The live
scoreboard, `MidweekShootoutLive`, the in-play page and polling remain F6, on
top of these components. The design sample (`design/midweek/sample-tournament.json`)
predates ADR-104's clock and #142's "fewer than 3 owners" label. It was left
as it is because its text is unchanged.

Tier: no migration.

## ADR-112 — The picker: a lock line, a save bar that says what its status means, a list on phones, and an archetype filter

Date: 2026-10-02

Status: Accepted (amends ADR-097's picker and ADR-099's archetype label; MM 2.0
frontend F3, built to the DR2-approved `Picker-Empty`, `Picker-Editing` and
`Picker-Saved` mockups; fixes KB-028 and KB-029)

Context: two picker bugs were open. KB-028: from `lg` nothing said that a
card's archetype would change next week, and on phones the card grid didn't
say it either. KB-029: the lock bar's countdown floated beside the fairness
seal, and with no earlier week to load the save bar was a wide empty box. The
UX review also found the phone grid of full cards slow to scan and the
Goalkeeper-only filter too narrow. `design/ux-review/HANDOFF.md` "Midweek: the
picker" settles all four.

Decision (no migration):

- **`MidweekLockLine` replaces `MidweekLockBar`:** one line, `Squads lock
  Wed 7 Oct, 19:55 in 1 day, 4 h`, with the countdown right after the time it
  counts to. The fairness seal leaves the picker, as HANDOFF asks; it stays on
  the evening, the bracket and the champion view. Commit-and-reveal (§44.8) is
  unchanged: `seed_hash` is in the member views from the moment the week
  exists. The opted-out page uses the same line.
- **`MidweekSaveBar`:** the status (dot and words) with one note on the left,
  and the actions on the right, never an empty column:
  - `Not picked yet`: the auto-squad warning. This replaces the separate "no
    pick, no problem" notice.
  - `Unsaved changes`: "Nothing counts until you save."
  - `Saved {when}`: "Change it as often as you like until {lock}". The only
    action is `Change your five`, which starts choosing for slot 1 beside
    Cancel.
  - With unsaved changes below `sm`, the bar becomes one compact opaque row,
    last in the flow and sticky above the tab bar, with the secondary action
    and the note hidden. Otherwise it is inline under the five.
  - Order: the five, the keeper check, the save bar, the privacy line, then
    `Your cards`.
- **The privacy line** now reads from the lock (`From 19:55 on Wednesday …`),
  because ADR-105 shows every entered five from then, and it adds that cards
  are never at stake (the KB-030 question).
- **`MidweekPickRow` below `lg`:** a compact list with the mini card, name,
  `archetype · tier · OVR`, the KB-028 line, and `Add`, `Slot 4` or `✓ In`.
  From `lg` the approved `LiveCard` grid stays. Each size has exactly one list.
- **`MidweekArchetypeFilter`:** chips with counts by the archetype each card
  plays this week. `All` and `Goalkeepers` always show (`Goalkeepers 0` makes
  a missing keeper visible), then every other archetype the member owns. It is
  instant and client-side. `archetypeFilters` in `entry.ts` is unit-tested.
- **KB-028:** `weekArchetype` now returns the week's label, the change in
  words (`Goalkeeper this week, Speedster from next`) and the coming
  archetype. The change shows in the phone slot row, the pick row and under
  the desktop team-sheet card. The card face carries a `LiveCard` badge
  `Speedster from next week` in the grid and on the team sheet.

Consequences: the authenticated E2E gains a test that sets a fixture Player's
open-week snapshot to another archetype (`setWeekArchetype`; the member reset
puts it back). It checks the KB-028 line, the filter, that Save stays in view
with unsaved changes on a phone, and the badges at 1440 px.

Tier: no migration.

## ADR-113 — The evening from the lock: a sticky clock, the draw with every five, kick-off and full-time rows, and past weeks

Date: 2026-10-02

Status: Accepted (amends ADR-098's evening and bracket pages; MM 2.0 frontend
F5, built to the DR2-approved `Evening-Draw`, `Evening-Out`,
`Evening-Champion`, `Bracket-FromLock`, `Bracket-Evening` and `Weeks-Past`
mockups; fixes KB-034)

Context: ADR-105 put the draw and every entered five in the member views from
the lock, but the pages still showed only "Squads are locked" until round 1,
and then "Round 2 is out" with the old reveal clock. `design/ux-review/HANDOFF.md`
("Midweek: the evening", "Bracket", "Placeholders") redesigns the evening and
the bracket around the MM 2.0 clock. Matches are still revealed whole at their
kick-off until ADR-106 (PR 4), so this slice builds the kick-off and full-time
states; in-play, live and polling are F6, which ships with PR 4's push.

Decision (no migration):

- **`MidweekClock`** replaces `MidweekRevealClock` on the evening and bracket
  pages: sticky under the app header, edge to edge, the lock and every round
  with its time, in five states that differ in shape and word (`Locked`,
  `Played`, `Live`, `Next`, `Later`). A round is `Played` once every pairing
  shows a result (a bye always does), `Live` from its kick-off until then. With
  whole-match reveals a round goes straight to `Played`; under ADR-106 the same
  rule gives `Live` while it plays, so the clock needs no change in F6. Rounds
  the member is in (up to the one they went out in) carry a brass dot, and the
  list is one sentence for screen readers. Home's card keeps the old clock
  until F4/F6.
- **The evening page in four phases** (`eveningPhase`), each with HANDOFF's
  title: `The draw is out` from the lock to round 1; `{Round} is live` (or
  `… are live` for the quarter- and semi-finals) while the member is in or not
  entered; `You’re out` once they have lost; `The final is live` from the
  final's kick-off for everyone. The champion view (D4) is unchanged in place.
- **The draw:** `Your first match` names the opponent and kick-off, or after a
  bye the round-2 stage and both possible opponents (`In the semi-finals you
  meet the winner of Mila v Eline`, or one name when the neighbouring pairing
  is a bye too). `MidweekFiveList` shows the member's five (outlined in brass)
  and the opponents', from `midweek_entries_public`: mini card, name,
  `archetype · tier · OVR`, `in goal`, and the auto-squad chip. No form, pick or
  chance before 20:00. Then round 1's pairings with their kick-off.
- **Later phases:** `Your night`, then the next round with its kick-off and the
  round just played at full time. Out: the follow-up `MidweekPlaceholder` and a
  card for the final beside `Your night`. The final: the full-time
  `MidweekScoreboard` in team colours (a single-match block, DR2-1), the note
  that the champion and coins follow its end, and the semi-finals.
- **One deviation from HANDOFF's copy, until F6:** the final card on
  `You’re out` says `Come back for the final` / `Its result shows on this page
  at 21:00.` instead of `Everyone watches it live` / `Chance by chance, on this
  page.` Today the final shows whole at kick-off, so the approved line would be
  untrue for every evening before F6; F6 restores it. The draw's one-opponent
  variant, the past-weeks skip, void and round-1 lines are derived the same way
  from approved copy.
- **`MidweekMatchRow`** (neutral, DR2-1) has three states: `Kick-off 20:15`,
  `Full time` with scores and the report link, and a dashed bye that counts as
  a win. `assembleBracket` now takes round 1 from `midweek_draw_public` and
  names a pairing not yet decided as `Winner of Mila v Eline` in round 2 and
  `Winner, Quarters 1` (or `Semis 1`, `R2 M1` in a bigger bracket) beyond,
  per HANDOFF. Round headings say `Kick-off 20:00` in the list and the `lg`
  tree (DR2-4). Without the draw view the bracket is built from the revealed
  round-1 rows exactly as before (unit-tested).
- **The bracket page** shows the clock and the fairness seal while the evening
  runs, and `MidweekJumpLinks` (`Your match · R2 20:15`, then each round). The
  jump links show below `lg` only: from `lg` the tree shows every round side by
  side, so there is nowhere to jump. The legend under the clock went, as in
  the mockups; every row's spoken sentence says what its marks mean. Round
  headings are no longer sticky, because the clock now holds that place.
- **`/midweek/past`** (`MidweekWeekList`): every complete, skipped or void
  week, newest first, each opening its bracket: `{Wout H.} won it · {21}
  entrants. You: {semi-finals}, +{100}.`, or why nothing was played. The
  champion view links to it (`Past weeks →`) and gains the two marked
  placeholders, ratings and share.
- **KB-034:** Compete's section tabs with the `Live` chip on Midweek needed
  about 308 px in a 320 px screen's 280 px content box, so every Compete page
  scrolled sideways during the evening on the narrowest phones. Phone tabs now
  use `px-2`, and below 360 px 13 px labels with almost no padding (262 px,
  16 px to spare); the E2E checks the tabs stay inside the gutter.

Consequences: from Wed 7 Oct members see the draw and both fives at 19:55, and
the evening reads as a clock rather than a reveal schedule. The authenticated
E2E turns the open fixture week into tonight's evening
(`startFixtureEvening`), moves it forward in time for the later states
(`advanceFixtureEvening`, which bypasses the Part L #25 guards with
`session_replication_role = replica` in one transaction on the local stack),
and puts the open week back after each test (`endFixtureEvening`).

Tier: no migration.

## ADR-114 — Home leads with what's due, and every message opens its subject

Date: 2026-10-02

Status: Accepted (amends ADR-031, ADR-038 and ADR-039's Home layout, ADR-097
and ADR-098's Home card, and ADR-019's inbox; MM 2.0 frontend F4, built to the
DR2-approved `Home-Now-Picking`, `Home-Now-Live` and `Messages` mockups and
the UX review's unmocked items)

Context: the UX review of 1 Oct found that Home opened with a 390 px masthead
on a phone and put a live Midweek round third, and that the inbox was a dead
end: no message linked to what it was about, and each carried its own "Mark
read" button. `design/ux-review/HANDOFF.md` ("Home", "Messages") settles both;
Q11 (2 Oct) keeps Home's live card static at page load. The review also asked
for chips on the pack summary and for the Settings placeholder to go, neither
of them mocked.

Decision (no migration):

- **A short header:** `Terrible Football Haarlem` / `This week in KUT`, 30 px
  on a phone. The masthead's paragraph is now the risers' subtitle; its
  Chronicle link sits in Club activity's heading and "How KUT works" under the
  activity.
- **The "now" stack** (`HomeNowStack`): the cards with a deadline, in one
  list. The Midweek evening leads while it runs; otherwise the soonest
  deadline first: picking (the lock), the session report (`closes_at`), the
  rehab check-in (the end of the week after the one it is for, ADR-082's
  window) and the champion card (Thursday 23:59, D4). `orderNowCards` is
  unit-tested. Each card is one link, except the check-in, which stays the form
  that does the check-in in place.
- **The evening card** (`Home-Now-Live`) shows from the lock to the end of the
  final, with the `Live` marker and the round as its kicker. At page load it
  shows: the draw (who you meet, `See the draw`); your match this round at
  full time as a compact `MidweekScoreboard` in team colours (a single-match
  block, DR2-1) with the report's headline and `See the report`; from the
  final's kick-off, the final for everyone; once you are out, `Follow the
  final` (HANDOFF); after a bye or between rounds, the evening's title and
  your night in a line. Home does not poll (Q11). The HANDOFF puts the latest
  chance under a live scoreboard; at full time the headline says more, and a
  match in play exists only once ADR-106's views hide results until full
  time. Until F6 such a match shows no score, only that it kicked off and
  `Watch your match`: its live scoreboard and latest chance need the report of
  the events revealed so far, which F6 builds with ADR-106. `See the draw`,
  `See the report` and the kicked-off line are derived from the approved copy.
- **`MidweekRevealClock` is retired** with Home's old card, and with it
  `revealStops` and `revealedRounds`; its test of both clock versions now runs
  on `eveningStops`.
- **Stats:** Club Value and Rank as tiles that read as links (`See the maths →`,
  `Standings →`); the KUT Coins tile goes, as the coin pill shows the balance;
  `Open a pack` is full width below `sm` and shares the row from `sm`.
- **Club activity:** six rows, a member's consecutive pack openings folded into
  one (`Member B opened 5 packs.`, `foldActivity`). Unnamed rows never fold.
  Home reads 30 rows to fill six.
- **Messages:** `MessageRow`, one compact link per message, through
  `/messages/{id}/open`, a route handler that marks the caller's own message
  read and redirects to a path it builds itself. It is a plain `<a>`, never a
  prefetched `<Link>`, so nothing marks a message read unseen. Unread rows
  carry a filled dot and the word `New`; the per-message button goes and
  `Mark all read` stays. Groups: `Today`, `Earlier this week` (since Monday,
  club time), then each older day. Targets by `event_type` (`messageTarget`):
  Midweek result → that week's bracket; sale → `Wallet`, which is Club Value,
  because KUT has no wallet page and Club Value opens with the balance;
  purchase → the card, while the member still owns it; trade offer and trade
  answer → Offers (HANDOFF sends an answer to the listing, but by then the
  listing has usually sold or closed, and the offer row says what happened);
  kudos → My card; a session's results, reward, bibs bonus or correction → its
  Chronicle issue; the report form's own message → the form; the rehab
  check-in → Home. A club notice links nowhere and has no arrow: unread,
  opening it only marks it read; read, it is no link at all.
- **The pack summary** (`packSummary`): each card carries a chip on its face
  (the `LiveCard` badge slot, ADR-102): `New · fills slot 14` when every copy
  the member holds of that Player came out of this pack, the album slot in
  `buildSlots` order, or `×3 · discards for 63` for a Player held more than
  once. One line sums it up: `2 new Players. Album 19 / 29.` A failed read
  shows the cards without chips.
- **Settings** loses "Notification preferences are planned for a later polish
  pass." The idea moved to `ROADMAP.md`.

Consequences: Home on a phone opens with what is due, and every message is one
tap from its subject. The authenticated E2E checks the now stack, the tiles and
the evening card at the draw and mid-evening, opens a Midweek result and a club
notice from the inbox, and opens a pack (last in the file, as it spends coins).

Tier: no migration.

## ADR-109 — Every entrant hears how their Midweek night went

Date: 2026-10-02

Status: Accepted (amends ADR-096's inbox message; owner decision DR1-3 in
`design/ux-review/HANDOFF.md`; MM 2.0 backend PR 5)

Context: ADR-096 sent one `midweek_result` message per member paid, and none
to a member out in round 1 without a bye, on the reasoning that the inbox
reports what happened to the wallet. On 30 Sep that left 5 of 21 entrants
with no word at all, and the UX review found the inbox the only "this
happened to you" channel. The owner decided every entrant gets one (DR1-3),
and DR2 approved its wording.

Decision (migration `20261013000000_midweek_result_for_everyone.sql`):

- **One message per entrant**, from `kut.midweek_entries`, re-created in
  `kut._mm_pay_tournament`'s message step. Members opted out were never
  entered; a member disabled since the lock is neither paid nor told, as before.
- **Worded by finish** (HANDOFF "Messages"). The title says how far the member
  got: `You won Midweek Madness`, `You went out in the final` / `the
  semi-finals` / `the quarter-finals`, or `… in round 2`. The body says who
  beat them and how, winner's score first (`Sophie beat you 2–1.`, or `Sophie
  beat you on penalties, 7–6.` after a draw), then the coins if any (`+50 KUT
  Coins.`), then the champion (`Joris won it.`). The champion's message reads
  `250 KUT Coins over the night.`, and an auto squad's adds `Your auto squad
  played for you.`. Two details beyond the mockup's lines: the runner-up's
  message leaves out `Joris won it.`, since Joris is the one who beat them, and
  the date ("on Wed 7 Oct") is gone, since the inbox dates every message.
- **The reference stays the tournament**, so the inbox links the message to
  that week's bracket (ADR-114).
- **Payments are unchanged** word for word: rewards, ledger rows, wallets and
  the return value. Part L #26 is untouched, and the inbox's unique index on
  (user, type, reference) keeps the step idempotent.

Consequences: every Wednesday night now ends with a message for everyone who
played. A week paid before the push keeps its old messages. The payouts pgTAP
suite now expects one message per entrant (M1 saves a five for one week, so a
message without the auto-squad line is tested), and the concurrency test
expects as many messages as entrants.

Tier: data-changing (docs/OPERATIONS.md): it changes what the worker writes
when it pays a week. Fresh cold-verified backup before the push.

## ADR-115 — The evening live: your match and the final chance by chance, every other match at full time

Date: 2026-10-02

Status: Accepted (amends ADR-111's match page, ADR-113's evening and bracket,
and ADR-114's Home card; MM 2.0 frontend F6, the page half of live matches,
built to the DR2-approved `Evening-YourMatch`, `Evening-FinalLive`,
`Match-Yours-Live`, `Match-Other-InPlay`, `Match-Final-Live` and
`Bracket-Evening` mockups. ADR-106 is the data half, PR 4's migration)

Context: since ADR-104 every event's moment and every match's end are stored at
the lock, and the evening's pages (ADR-113) show kick-off and full-time states.
HANDOFF ("Midweek: the evening", "Matches") asks for a member's own match and
the final to unfold chance by chance, every other match to show only `In play
· result at full time`, and nothing anywhere that gives a result away before
its full time. The plan asked whether these pages must wait for ADR-106's views
or can work against today's.

Decision (no migration):

- **Rendered on the server from the stored match.** The report renderer picks
  a match's timeline moments and phrases from the whole match, so text rendered
  from the events seen so far would change as the match goes on. A match in
  play is therefore read whole through the service role on the server
  (`loadLiveMatch`), rendered once, and only what is due by now leaves the
  server (`liveView`): the moments up to now, each at its stored moment
  (kick-off + minute × 280 s / 90), the kicks taken (one every 5 seconds after
  full time), the score they add up to, and the Why with no goals or assists.
  Never the headline, facts or later moments. `LiveMatch` carries only those
  pieces, so a page cannot pass more by mistake.
- **In play is read from each match's stored end** (`loadMatchEnds`,
  `maskInPlay`): every visible match whose end is still ahead has its goals,
  penalties and winner withheld before any page logic sees it. ADR-106's view
  does the same from its push; a row the view already withholds stays in play.
  So the pages read the same before and after that push, and the order is F6
  first, then PR 4 (ADR-106). A failed read of the ends shows matches whole, as
  before.
- **Rows** (`MidweekMatchRow`): `Live` with a link to watch it for the
  member's own match and the final, `In play · result at full time` with no
  score for every other match, in the list and the `lg` tree. `Your night`
  gains `Playing Eline now.` with what a win pays. The jump link reads
  `Your match · Live`. The clock needed no change: a round is `Live` until
  every pairing shows a result.
- **The evening page:** while your match plays, `Your match` leads with the
  live scoreboard (`Live · 64′`, the running match clock, Q10) and the latest
  chance, then your night, then `This round`. From the final's kick-off the
  final for everyone, with the shoot-out kick by kick
  (`MidweekShootoutLive`). The out card's copy is restored: `Everyone
  watches it live` / `Chance by chance, on this page.`
- **The match page:** your match or the final live, `How it went` with every
  chance so far, the newest outlined in brass, and the Why with `Goals and
  assists are added at full time.` Any other match in play: `In play · result
  at full time`, why it isn't shown chance by chance, both line-ups and the
  Why's pre-match side. The line-ups are named "X's line-up" there, because the
  Why already names each side's five.
- **Polling** (`MidweekLivePoller`): the evening, the bracket and a match page
  in play ask the server for themselves every 20 seconds while a match is in
  play, and otherwise once at the next kick-off, so a round never starts
  unseen; a hidden tab waits until it is shown. `Updated 20:18:20` sits under
  the clock, or at a match page's foot with "checks for new chances every 20
  seconds". No Realtime. The newest chance slides in, unless reduced motion.
- **Home's card in play** (Q11, static at page load): the score so far, the
  minute, and the latest chance (or the last kick) as one line, with `Watch
  your match`. On the card the board shows just `45′`, since its kicker
  already carries `Live`, and leaves the auto-squad chip to the match page:
  two long names and their chips do not fit a 320 px card.

Consequences: on Wednesday a member watches their own match and the final
unfold, and no page shows a result before its full time, before and after
ADR-106's push. The authenticated E2E checks a match one minute in (your own
live, every other in play, no report link, no final score) and the final one
minute in, at 320 and 412 px and the final page at 1440 px. It passed against
both the current views and ADR-106's.

Tier: no migration.

## ADR-106 — The evening unfolds event by event: views gate each event and each result, and F6 ships first

Date: 2026-10-02

Status: Accepted (amends ADR-095's reveal gates and ADR-105's "events appear
at their round's start, whole"; MM 2.0 backend PR 4, the data half of live
matches; F6 is the page half. The number was reserved since ADR-104, whose
migration names it)

Context: since ADR-104 every event's moment and every match's end are stored
at the lock, but the member views still showed a match whole from its
kick-off: an API reader knew the result at 20:00, and the pages could not show
a match unfolding. HANDOFF ("Data the screens need", "No full-time estimates")
asks that a result, and any time that implies a match's length, be readable
only from its full time; Q7 chose the same pacing for every match. Vercel
deploys on merge before a hosted push, so the plan asked this ADR to settle,
before F6 is built, whether F6 works against the views as they are or the
merge and the push must land back to back.

Decision (migration `20261014000000_midweek_live_reveal.sql`, views only):

- **`midweek_matches_public`:** the pairing, kick-off, win chance and day rolls
  from kick-off, as before; goals, penalties, winner and `ends_at` only once
  the match has ended (a late end gives a shoot-out away); appends `ends_at`
  and `in_play`. A bye ends as it starts.
- **`midweek_events_public`:** each event from its own moment; appends
  `reveal_at`.
- **`midweek_tournaments_public`:** the champion from the end of the final.
- **Weeks simulated before ADR-104** have no stored times and keep showing
  whole matches at kick-off.
- **No per-round `played` flag.** `MidweekClock` already derives `Played` from
  every pairing showing a result (ADR-113), which these views now give exactly.

**F6 works against both the old views and these, and ships first.** The
report renderer picks a match's timeline moments and phrases from the whole
match (the biggest chances, no phrase twice), so text rendered from the events
seen so far would change as the match goes on. The live match page therefore
renders on the server from the stored match, read through the service role,
and sends the browser only what is due: the moments, kicks and score up to
now, and the headline, facts and goals and assists from full time. Rows of
matches take "in play" from each match's stored end the same way. The server
was always allowed to read the stored result; what changes is that a member's
own reads stop running ahead of the clock. So F6 needs nothing from this
migration, and this migration needs F6: pushed before F6, today's pages would
read a match in play (no winner yet) as lost. The order is: F6 merged and
deployed, then this PR rebased on it, merged and pushed, outside a running
Wednesday evening; no back-to-back merge and push.

**F6 shipped first, as ADR-115 (KUT #165).** It masks in-play rows itself, from
each match's stored end (`loadMatchEnds`, `maskInPlay`), and renders a live
match from the stored match on the server (`loadLiveMatch`); see ADR-115 for
the page half. A row this migration already withholds stays in play there, so
nothing on the pages changes at this push: what changes is what a member's own
API reads can see.

Consequences: from the push a member reading the API learns no result before
its full time, and the pages show the same thing. The new pgTAP suite pins
six moments of an evening (before kick-off, a minute in, mid shoot-out, the
final in play, complete, and a pre-ADR-104 week); the evening-timing suite now
expects no champion while the final plays.

Tier: additive (docs/OPERATIONS.md): views only, columns appended.

## ADR-110 — Unclaimed Players' archetypes rotate weekly, drawn from the new week's seed

Date: 2026-10-03

Status: Accepted (amends ADR-027's "only the member or an admin changes an
archetype" and ADR-099's "a trigger rather than a change to `_mm_open_next`";
MM 2.0 PR 7, C1. The number was reserved since ADR-104)

Context: `kut.players.archetype` defaults to `all_rounder` and only the
claiming member or an admin changes it (ADR-027), so every Player with no
linked account, about 80% of the roster, is an All-rounder for good. That
flattens squad shape (§44.4) and is the prerequisite for the balance change
(C2), which would otherwise weaken most squads overnight. The roadmap row
"Rotate unclaimed Players' archetypes weekly" carries the owner's decisions
(2026-09-30): every archetype in the pool, only active and collectible
Players, claiming ends the rotation, rotate just before the Midweek week opens
so the ADR-099 snapshot freezes it, seeded and logged, OVR unchanged. The C0
harness (#168, `archive/MIDWEEK_ROTATION.md`) informed the rest, decided
2026-10-03: no smoothing (Q8), each rotating Player draws independently; the
dip in "thought-through vs random" to about 55% is accepted while C1 is live
alone, and C2 is tuned with rotation on to restore 58%; the visibility is
accepted (Q9) and how-it-works says so.

Decision (migration `20261015000000_midweek_archetype_rotation.sql`):

- **Who rotates.** A Player with `is_active and is_collectible` and no
  `kut.profiles` row naming them in `player_id`. A disabled account still
  claims its Player. Unlinking a Player starts the rotation again from the
  next open.
- **When.** In the worker's open step (`kut._mm_open_next`), after the switch
  and running-week checks and right before the tournament insert, so the
  `after insert` snapshot trigger (ADR-099) freezes the rotated archetypes and
  nothing changes between the open and the lock. With the switch off no week
  opens and nothing rotates. A change made after the open still applies from
  the next week, as before.
- **The draw.** `kut._mm_rotation_archetype(seed, player)`: rng.ts `uniform`
  over the seven archetypes in `src/game/archetypes.ts` order, tag
  `rotation:<player uuid>`, which no other draw uses. Each Player draws
  independently and uniformly, All-rounder and Goalkeeper included: the C0
  harness's `uniform` variant, which stays as it is (switching the harness
  default to rotation belongs to C2's retune).
- **The seed: the new week's own secret seed, not a public hash.** A hash of
  the week and the Player would be deterministic and checkable, but anyone
  with the formula could compute every future week's archetypes and, say, buy
  next month's Goalkeepers on the market. The week's seed does not exist until
  the week opens, so nobody (an admin included) can know a draw in advance; its
  `seed_hash` is published at the open and the seed itself once the week is
  paid (§44.8), so anyone can then check every draw. A week that is skipped or
  voided never publishes its seed, so its rotation stays uncheckable; the log
  still records it. The tag keeps the rotation independent of the week's
  match draws.
- **Logged.** `kut.midweek_archetype_rotations` (tournament, Player, from, to,
  when) holds each change; a Player who draws the archetype they already have
  is not a change. Service role only, like the snapshots. Members see the
  result on every card face and in `kut.midweek_archetypes`.
- **Card faces follow at once.** `kut._mm_rotate_archetypes` calls
  `kut._rebuild_season_core` once per open that changed anything, as
  `set_own_player_archetype` does. OVR is unchanged: the offsets sum to zero.
- **Claiming keeps the archetype of the moment, and the first change stays
  free.** The rotation never stamps `archetype_changed_at`, so the cooldown
  (ADR-094) still lets a newly linked member change at once.
- **One opener at a time.** Page visits call the worker concurrently. The open
  step now takes a transaction advisory lock and checks again for a running
  week once it holds it, so racing calls rotate once and open one week. The
  `on conflict do nothing` on `week_start` is gone: a clash now raises, which
  rolls the rotation back with the open, and the worker records the error
  (`open: …`) and leaves it for the next call.
- **Running it again changes nothing.** For the same seed the rotation is a
  no-op; a second worker call finds the week open and does not rotate.

New Part L invariant #27: only the open step changes an archetype without a
member or an admin, and only an unclaimed, active, collectible Player's, once
per week, logged.

How-it-works (§6 and the Midweek section) and `/settings/card` now say that a
Player with no linked account gets a new archetype every week. Vercel deploys
that copy on merge, before the hosted push; until the push the first rotation
is simply still to come. The week already open at the push keeps its
archetypes; the first rotation runs when the worker opens the following week.

Consequences: unclaimed Players' card faces reshuffle every week, so an
attentive member can tell a rotating Player is unlinked within two to three
weeks (C0); `player_directory` still hides which member is which Player. The
roster holds about five Goalkeepers in an average week instead of two. The
E2E fixture puts back the archetypes its evening's open rotated, from the
log, before it deletes that week.

Tier: data-changing (ADR-032). The push rewrites no row, but from the next
open the worker rewrites `kut.players.archetype` and the season's stats every
week. Fresh cold-verified backup first.

## ADR-116 — Balanced squads beat All-rounders: the plusses are the engine's input, with a weakest-line rule

Date: 2026-10-03

Status: Accepted (amends ADR-089's squad shape and "no balance rules", and
ADR-092's tuned values; MM 2.0 PR 8, C2. Decided in the owner's Q13 interview
and tuning sign-off, 2026-10-03)

Context: the roadmap row "Balanced squads beat All-rounders" asks that four
well-balanced outfield archetypes be markedly better than four All-rounders,
with a table that shows each archetype's contribution to each line as 0 to 3
plusses. Until now §44.4 had no balance rules: each card's lines followed its
§15.1 offsets, and every archetype's three line multipliers added up to about
3.0, so four All-rounders (perfectly even) and a balanced set of specialists
(about the same total) were level. Measured with the match engine (60,000
matches a row, equal power, both sides with a Goalkeeper): Finisher, Playmaker,
Defender and Tank beat four All-rounders 49.5% of the time, while four
Speedsters or Playmakers won about 56% and four Tanks about 40%. The lines are
not worth the same: midfield decides who gets each chance (and takes it from
the other side), attack is the drawn shooter's own, and outfield defence is
averaged and shared half and half with the keeper, so one card at 1.40 added
about 3 points of win chance in attack or midfield and under 1 in defence.
The captain and the own-card bonus are out of scope (Q3). The rotation (C1,
ADR-110) is live, so the retune runs with it on, and its sign-off had to bring
"thought-through vs random" back to at least 58% (Q8).

Decision (migration `20261016000000_midweek_balance.sql`):

- **The plusses are the engine's input**, in the TypeScript engine and the SQL
  twin alike (`MIDWEEK.shape.plusses`, `kut._mm_config()`), so the table members
  see can never disagree with the maths. Card faces and OVR keep the §15.1
  offsets; Midweek no longer reads them. Considered and not chosen: the table
  as a rounded label over the offset maths (it can disagree at the edges), and
  offsets for the lines with plusses only for a balance bonus (members would
  see the bonus exactly but not the lines, and the offsets' attack bias stays).
- **The table.** All-rounder 1/1/1, still average everywhere; every outfield
  specialist four plusses: Speedster 2/2/0, Finisher 3/1/0, Playmaker 1/3/0,
  Defender 0/1/3, Tank 0/2/2, and the Goalkeeper 0/0/3 when it plays outfield.
  The table follows the offsets except the Tank, which the owner moved from
  0/1/3 to 0/2/2 at the sign-off so it no longer plays the Defender's role.
  Specialists carrying more in total than an All-rounder is what makes
  balanced squads markedly better; with equal totals they would only tie.
- **Line values per plus count**, attack and midfield 0.5 / 1.0 / 1.5 / 2.0,
  defence 0.2 / 1.0 / 1.8 / 2.6, set so one plus is worth about the same win
  chance in every line: +3.4, +3.3 and +2.3 points in attack, midfield and
  defence. Getting defence that close needed **outfield defence to count 0.8 of
  a shot's resistance** (`match.defenceWeightPpm`; the keeper the other 0.2,
  half and half before). The keeper still matters: four outfielders without a
  Goalkeeper win 39.1% against the same four with one.
- **The weakest-line rule.** The plusses of the four cards not in goal are
  added up per line; every plus a line falls short of 3 multiplies every card
  of the squad by 0.88, floored after each step, for the whole week
  (`kut._mm_balance`, stored as `kut.midweek_entries.balance_ppm`). Chosen over
  a penalty on the gap between lines (no clear target to aim for) and
  diminishing returns per line (it fights the individual attack and has no
  single factor to show). The threshold started at 4 and was signed off at 3:
  with 4, trialist-heavy starter squads fell short so often that the
  strongest-vs-weakest row could not take more OVR effect, and only 12 sets of
  four specialists met it (29 at 3).
- **The keeper's own strength.** A Goalkeeper in goal plays at 1.65 times its
  power (the value its offsets gave), a stand-in at 0.45 of that whatever its
  archetype. With the new defence values a stand-in's own defence line would
  have made a Tank in goal nearly a real keeper. The keeper's plusses don't
  count in the lines.
- **The retune** (`archive/MIDWEEK_TUNING.md`, signed off as option R2): OVR
  factor at 83 1.10 → 1.12 (the owner asked for more OVR effect, and the
  threshold of 3 made room for it), auto factor 0.575 → 0.55; form, pick
  curve, day roll and trialists unchanged. With rotation on every target
  passes at 5,000 seasons: strongest vs weakest 71.2%, thought-through vs
  random 61.6%, no habit ahead by more than 2.1%, auto squads to the last four
  2.0%, and two new rows, four balanced specialists against four All-rounders
  at equal power 63.1% (target 60–65%) and the best one-line stack 32.7%
  (target below 50%). Goals per bracket match 2.96 (2.85), and the published
  odds are better calibrated (Brier 0.188, from 0.195).
- **The harness** now plays the `uniform` rotation by default, and its
  thought-through manager fields a Goalkeeper if it owns one, then the four of
  its seven strongest other cards with the most power weighted by plusses
  under the rule, valuing a plus at about what it is worth in a match.
- **Switch at the push** (owner): one engine, no rules version per week. The
  week open when the push lands locks on the new rules, even if that is the
  7 Oct week before the first rotation. Weeks already simulated keep their
  stored results (Part L #25); their entries' `balance_ppm` stays null.
- **What members see**: how-it-works shows the plusses table and the rule, and
  the Why list a chip per line that fell short ("Defence 3 short") beside "No
  keeper", only when the stored balance is below 1. A live plusses count in the
  picker is a later frontend slice, mocked first. The chip recomputes the short
  lines from the stored archetypes and today's table; a future change to the
  table should version it rather than re-label past weeks.

Consequences:

- Golden vectors and the parity pgTAP are regenerated (ADR-090), with a
  one-line-stack match and a set of balance vectors; 199 parity assertions
  pass. `midweek_live_reveal.test.sql` re-picks its mid-shoot-out seed (fb),
  because the same seed now plays out differently.
- No Part L invariant changes: the engine stays a pure function of the locked
  squads and the seed.
- Deploy ordering: Vercel deploys on merge, before the push. The pages read
  `midweek_entries_public` with `select("*")` and treat a missing or null
  `balance_ppm` as no balance factor, so they work on the old schema.

Tier: data-changing (docs/OPERATIONS.md): it changes what the lock step
computes and so who is paid. Fresh cold-verified backup first.

## ADR-117 — Card ratings after a Midweek night: weighted events, per match and per night, floor 4

Date: 2026-10-03

Status: Accepted (the rule and the description lines; MM 2.0 F7, core. The
pages that show the ratings follow from a Claude Design mock, owner decision
2026-10-03, and amend this ADR. The lines await the owner's read-through in
review)

Context: the roadmap row "Player ratings after the tournament" asks that once
the tournament is complete, each card in a member's squad gets a published
rating from 1 to 10, reflecting how much it contributed to winning, with a
short description. DR2 left a placeholder for it on the champion view ("Your
five's ratings: 1–10 per card with a line"). The owner decided the open
questions in the Q1 interview (2026-10-03), after the candidates were measured
on 150 simulated seasons (3,000 tournaments, about 236,000 card-matches, the
rotation and the ADR-116 balance on).

Decision:

- **Event-based, weighted by the chance.** Every card starts at 6. Event
  points, times 0.75, are added: a goal `1 + 1.5 × (1 − p)` and its assist
  `0.6 + 0.6 × (1 − p)`, where `p` is the engine's goal chance, so a goal from
  nothing counts for more than a tap-in; a save `0.3 + 1.5 × p`, a block
  `0.3 + 1.2 × p` and a shot forced wide `0.15 + 0.5 × p`, so stopping a big
  chance counts for more; 0.15 for making a chance that didn't go in; 0.3 for
  a penalty scored and 0.8 for a penalty saved. The result adds 0.4 for a win
  and takes 0.4 off for a loss, shoot-outs included; each goal conceded in open
  play takes 0.3 off the keeper and 0.1 off each outfielder. **A miss costs the
  shooter nothing,** as the phrasebook never blames a shooter. The constants
  are `RATING` in `src/lib/midweek/report/ratings.ts`.
- **Rejected: a counterfactual replay** (re-run the match with the card
  swapped for a trialist, same seed, possible once the seed is published).
  Measured, it is mostly noise: swapping one card shifts the midfield share and
  every weighted draw, so the match plays out differently. 60% of goalscorers
  came out neutral or negative, 8% of cards that did nothing flipped the
  result, and it correlated 0.19 with what the cards did. Averaging many
  replays measures pre-match strength instead, which the Why list already
  shows as Power. The plain standout points of §44.10 were the third
  candidate: traceable but coarse (63% of ratings on 6 or 7, and a tap-in worth
  a screamer).
- **Per match and per night.** Each card has a rating per match; its night
  rating is the mean of its matches (a bye is not a match). Both to one
  decimal, from **4** (the floor) to 10. Measured: per match a mean of 6.8 (sd
  1.2), winners 7.6 and losers 6.0, a 10 in 2% of card-matches, the floor in
  0.05% (a keeper conceding four in a defeat); per night a mean of 6.5. The
  top-rated card of a match is Common or Bronze in 43% of matches.
- **The line under a night rating** comes from a new phrasebook layer,
  `rating:<story>`: the card's biggest contribution over the night picks a
  story (`nightStory`, from a hat trick down to a quiet night in a side that
  went through), and the seed hash and the member pick a line, so it never
  changes and no two cards of a five share one. Every pool holds at least five
  lines. The phrasebook rules apply unchanged (ADR-093: names only, nothing
  medical, no ridicule), and counts appear only where they are at least two.
- **Presentation only.** `matchRatings` and `rateNight` are pure functions of
  the stored events, the lock-time keeper and the published seed hash, like
  the renderer (ADR-093): no migration, no SQL twin, and any past week can be
  rated again. They decide nothing and pay nothing.
- **Shown once the week is complete** (the row's intent). The pages, and
  whether a match report shows its ratings before payout, come with the mock.

Consequences: `design/midweek/sample-ratings.json` (written by
`tests/sim/midweek-ratings-sample.sim.ts`) gives the mock real ratings and
lines. `sample-tournament.json` is not regenerated, because it carries the
DR2 story; the ratings sample replays the same world on today's engine. A
season table built on the ratings was considered for "Something to follow
after a knockout" and not chosen (Q2): Midweek has no season, and a card's
rating is final once its manager is out.

**Amended 2026-10-03 (F7 pages, built to the owner-approved DR3 mockups,
`design/mm2-dr3/HANDOFF.md` §1, DR3-4):**

- **Where ratings show,** only once the week is complete (paid): the champion
  view (until Thursday 23:59, D4) as `Your five's ratings` in place of DR2's
  placeholder, closed per match; the week's bracket for good, near the top
  with a `Your ratings` jump link and each match open, which is how the
  ratings outlive Thursday; and every match report of that week, in the Why
  list, for both sides. Not before the week is complete, even for a match at
  full time while the evening runs: a rating needs the whole week's result. A
  member who wasn't entered sees no block.
- **A neutral disc** (`MidweekRatingDisc`): `panel-2` fill, an `ink-dim`
  ring, one decimal, never tinted, so nobody reads it against Power's heat
  bands (different shape, side, range and colour). Screen readers hear "rated
  7.5 out of 10 for the night" (or "for this match", "against Eline").
- **Best first** (ties in slot order), with `★ Best of your five` on the top
  card and no mark for the lowest. Below `lg` one row per card (mini card,
  name, archetype and tier, the line in the serif, the disc); from `lg` the
  five LiveCards in a row with the disc and name under each.
- **Per-match chips:** one `Show each match` button per block opens a chip
  per match under every card (`Round 2 v Eline` and the disc), each linking to
  that report, where the same number is in the Why list. The chips are
  rendered on the server; the toggle is the block's only client code.
- **The Why list's rating column:** a 38 px disc on the right of each card,
  `Rating` at the end of each side's heading, a key above the odds bar (a mini
  Power pill and a mini disc), and one foot sentence.
- **One read:** the champion view and the bracket load the events of the
  member's own matches in one query (`loadNightRatings`); every other row was
  already loaded. `RATING` moved to `report/rating-rule.ts` so client code can
  quote it (`ratings.ts` needs `node:crypto`).
- **How-it-works** gains "Ratings" in §12 (`#midweek-ratings`), which the
  block's `How ratings work →` opens.

Tier: no migration.

## ADR-118 — Predictions for members who are out: pick the later matches, coins for the right ones

Date: 2026-10-03

Status: Accepted (amends ADR-096's faucet; adds Part L #28; MM 2.0 D, the
backend. Decided in the owner's Q2 interview, 2026-10-03. The pages follow
from a Claude Design mock and amend this ADR)

Context: the roadmap row "Something to follow after being knocked out". With
22 entrants about 6 members are out after round 1 (by about 20:05) and 14 after
round 2 (by about 20:20), so most of the club has nothing of its own to watch
before the evening is half over. Measured on 150 simulated seasons, the
pre-match favourite wins 74% in round 1, then 73%, 67%, 63% and 61% in the
final: calling the obvious winner pays early, judgement later.

Decision (migration `20261017000000_midweek_predictions.sql`):

- **Predictions, only for members who are out** (owner: not everyone). Once a
  member's own match has ended in defeat, they may pick the winner of each
  later match they are not in, before its kick-off, as soon as both matches
  that feed it have ended (round 2 opens as round 1 finishes, between 6 and 10
  minutes before its kick-off). A pick can be changed or cleared until
  kick-off and never after. Rejected: a consolation bracket for round-1
  losers (an engine change with new golden vectors, a second bracket, and it
  covers 6 of the 14 out by round 2), and a season table built on the ratings
  (a card's rating is final once its manager is out, and Midweek has no
  season).
- **Coins for correct picks, about 30 a night at most** (owner). 30 split over
  the matches a round-1 loser could predict, `2^(R−1) − 1` of them:
  `kut._mm_prediction_coins(R)` and `predictionCoins` are 30, 10, 4 and 2 a
  correct pick for 2 to 5 rounds (4, 5–8, 9–16, 17–32 entrants), so a perfect
  night pays 30, 30, 28 or 30. Past 32 entrants it rounds to 0 and the picks
  are only counted. Paid at the payout, in the same transaction as the wins,
  as one row per (week, member) in `kut.midweek_prediction_rewards` (ledger
  reason `midweek_prediction`, key `midweek-prediction:<week>:<member>`). A
  member disabled since the lock is not paid.
- **The faucet (amends ADR-096).** At 22 entrants, if every member who is out
  predicts every match and backs the favourite, the week pays about 200 coins
  more than the 953 of the bracket: about 9 a member. Nobody still in can
  predict, so the most a night pays any member stays far under the 250
  champion total (a semi-finalist who calls the final: 102), and the guard
  holds that bound anyway. Showing up stays the dominant coin source.
- **No table** (owner): Midweek has no season (`kut.seasons` is the rating
  season, created by hand and never reset), so the result message gains one
  sentence instead: "You called 2 of 3 right: +20 KUT Coins." or "You called 0
  of 2 right."
- **Part L #28, in the tables.** A trigger on `kut.midweek_predictions` holds
  every rule whoever writes the row, and checks them in an order that never
  gives a result away: the member's own defeat (theirs to know), the match and
  its kick-off (public), both feeders ended (public), and only then the pick
  against the stored pairing, which by then is public too. So a refusal never
  says who won a match still in play. `kut.save_midweek_prediction(week, round,
  pairing, winner)` names a match by round and pairing, because a later
  round's match is not shown to members before its kick-off. A second trigger
  accepts a reward only from the complete step, for exactly the member's
  stored picks and the ones that came true, at the week's rate, at most 30,
  and never past the champion's total with the member's wins.
- **Privacy.** A member reads their own picks (`kut.my_midweek_predictions`,
  with `correct` once the match has ended) and their own coins
  (`kut.my_midweek_prediction_rewards`). Everyone reads how the club split on
  a match from its kick-off (`kut.midweek_prediction_splits_public`): counts,
  never who.

Consequences: the payout function is re-created with the wins step word for
word (Part L #26 untouched) and its message step extended. No page reads any
of this until the mock's pages ship, so nobody can predict before then and
nothing pays. The pages will read the views tolerantly.

Tier: data-changing (docs/OPERATIONS.md): it widens what the ledger accepts,
adds a faucet and changes what the worker writes when it pays a week.

## ADR-119 — Deeper team colours: violet and teal, with a text tone and a fill per side, and Live on its own tokens

Date: 2026-10-03

Status: Accepted (amends ADR-111's team colours and ADR-107's Live token; MM
2.0, built to the owner-approved DR3 mockups, `design/mm2-dr3/HANDOFF.md` §5,
decisions DR3-1, DR3-2, DR3-3, DR3-9 and DR3-10)

Context: the owner found the match page's blue and red too bright (3 Oct):
deeper is classier. DR3 tried deeper royal blue and claret, then royal blue
and teal, then four pairs without the blue, and the owner chose **violet and
teal** (DR3-10). Deep colours on a dark board don't pass AA as small text, and
today the red side and the `Live` marker are one colour (`#ff8091`).

Decision (no migration):

- **Two tokens per side.** The plain token is the **text tone** (names, score
  digits, side headings): violet `#9e80d1`, teal `#4fb3a0`, both AA on board,
  panel, panel-2 and the tinted lanes. `-fill` is everything drawn (lane
  rails, the odds bar, scored penalty dots, the scoreboard strip): violet
  `#6f4fa1`, teal `#1f7a6c`, with light ink (`#f4efe3`) on them at AA. `-bg`
  (`#181322`, `#0e1f1c`) tints the lanes at 55%; `-line` (`#423658`,
  `#23514a`) is kept for borders.
- **Side-neutral names** (DR3-10): `--color-team-blue*` becomes
  `--color-team-0*` and `--color-team-red*` `--color-team-1*`, with their
  Tailwind classes, since neither side is blue or red any more.
- **The fills** pass 3:1 for graphics in teal; violet's is 2.92:1 on the board,
  within the stretch the owner allowed. Nothing relies on a fill alone: names,
  lane side, the odds bar's percentages and the ✓/✕ on each kick carry it.
  The odds bar's side-1 opacity goes, as both fills are now deep.
- **Live on its own tokens** (DR3-3): `--color-live-bg` and
  `--color-live-line` keep today's pink tint, and the Live chip, the clock's
  live stop and Home's live card use them instead of the red side's. The
  `Live` pink itself is unchanged.
- **A 3 px strip** across the top of every scoreboard, side 0's fill on the left
  half and side 1's on the right (DR3-2); decorative and hidden from screen
  readers.
- **Checked in a unit test** (`tests/unit/team-colours.test.ts`): DR3's
  values, every contrast DR3's table computes (read from `globals.css`), Live
  apart from both sides, and no source file left on the old names.

Consequences: Live and the sides can no longer be confused (they were one
colour). For deuteranopes violet and teal differ mainly by lightness (ΔE 36,
as royal blue and teal did); the lane side, names and screen-reader sentences
carry the side too. Lists of matches stay neutral (DR2-1). DR2's mockup
generator (`design/ux-review/build/ux.css`) still names the old tokens and is
left as the record of DR2; DR3's generator sets its own values.

Tier: no migration.
