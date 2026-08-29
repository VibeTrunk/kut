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
