# Kelderklasse Ultimate Team (KUT) — Project Context

## What this is
KUT (working title "TFH Ultimate Cards" in the build spec) is a browser-based
collectible football-card game for Terrible Football Haarlem (TFH): real
attendance and match performance drive a card economy players collect, open
packs of, and trade with each other. It is a tool in the
[VibeTrunk](https://vibetrunk.com) hub — see
[VibeTrunk/home](https://github.com/VibeTrunk/home) for the landing page and
the wider ecosystem context. The canonical, exhaustive product and technical
specification lives in [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) — read it
in full before implementing anything; this file is orientation, not a
substitute.

## Status so far
- **Repo:** feature-complete MVP built and committed; see "Current hosted
  deployment" below for what's live.
- **Branch workflow:** GitHub branch protection on `main` is enabled
  (2026-08-23) — direct pushes are rejected, even for admins. All changes
  go through a feature branch and PR, squash-merged, branch auto-deleted on
  merge. See the global CLAUDE.md's "Branch workflow" section for the
  session-level conventions (branch naming, who merges).
- **Vercel:** connected as project `kut` at `kut.vibetrunk.com`.
- **Supabase:** uses the shared VibeTrunk Supabase project, schema `kut`
  (not `public`); the hosted schema is created and migrated — see below.

## This repo's job
Own KUT end to end, per `docs/BUILD_SPEC.md`: the Next.js/TypeScript
frontend, the Supabase backend (migrations, RLS policies, RPC/Edge
Functions for atomic economy operations), and its deployment as the `kut`
Vercel project on the `kut.vibetrunk.com` subdomain. `VibeTrunk/home` knows
nothing about this repo beyond its name, blurb, and URL — keep it that way;
don't add cross-repo coupling beyond the shared Supabase project.

## Current hosted deployment

KUT is live at `https://kut.vibetrunk.com` as Vercel project `kut`. The
hosted `kut` schema is applied through
`20260912000000_tester_feedback_round_2.sql` &mdash; tester feedback round 2
(ADR-044), deployed 2026-09-01 in one `db push` from `VibeTrunk/supabase`
(PR #20 there):

- `20260912000000_tester_feedback_round_2.sql` (ADR-044, data-changing for the
  backfill only) &mdash; one migration for four defects + three ideas.
  `create or replace kut.grant_bibs_reward` with the notification body reworded
  ("washing the bibs after" &rarr; "bringing the bibs to") + a scoped,
  reversible backfill of existing `bibs_bonus` `kut.user_notifications` rows;
  new `kut.set_own_club_name(text)` self-service RPC over the dormant
  `kut.profiles.club_name` column (own row, trim, blank&rarr;NULL, &le;80, no
  control chars, not unique); `kut.club_value_leaderboard` `create or replace`d
  to `coalesce` that column with the synthesised `"<name>'s Club"` default
  (`club_value` / `rank` unchanged); new additive `kut.published_sessions`
  summary view backing `/sessions`.

On top of the tester follow-up trio (ADR-040/041/042), deployed 2026-08-31 in
one `db push` from `VibeTrunk/supabase` (PR #19 there), on top of Batch E:

- `20260909000000_market_listing_card_art.sql` (ADR-040, additive) &mdash;
  `kut.active_market_listings` gains `photo_path` + `seller_id` so `/market`
  renders player card art and hides Buy/Offer on the viewer's own listings.
- `20260910000000_club_value_v2.sql` (ADR-041, data-changing) &mdash; Club
  Value becomes `coins + sum(owned-card discard value) + 4 &times;
  personal-card discard-equivalent`. `kut.my_club_value` dropped + recreated
  (`card_value` &rarr; `owned_cards_value` + personal-card columns);
  `kut.club_value_leaderboard` `create or replace`d. `market_reference_value`
  kept, but only for `get_listing_bounds`.
- `20260911000000_trade_offers.sql` (ADR-042, data-changing) &mdash;
  coin + card escrow trade offers on listings. New `kut.trade_offers` /
  `kut.trade_offer_cards` tables + `kut.user_cards.held_by_offer_id`;
  `propose_trade` / `respond_to_trade` / `withdraw_trade` /
  `expire_trade_offers`; guards added to `create_listing`, `discard_card`,
  `prevent_burning_listed_card`, `cancel_listing`, `buy_listing`,
  `admin_reset_account`, `admin_prepare_account_deletion`.
  `wallet_ledger.reason` += `trade_escrow` / `trade_unescrow` /
  `trade_sale`; `user_notifications.event_type` += `trade_offer` /
  `trade_response`; `kut.activity_feed` gains a `trade` row; new
  `kut.my_trade_offers` view. Accepted trades are never written to
  `kut.market_sales` (invariant #23).

Batch E migrations (deployed 2026-08-31):

- `20260906000000_goalkeeper_archetype.sql` (ADR-036, E1 / #4) &mdash; a
  seventh `goalkeeper` archetype reusing the six shared attributes with its
  own offset row (sums to 0); widens the `kut.players` archetype `check` and
  `create or replace`s `admin_add_player` / `set_own_player_archetype` /
  `_rebuild_season_core`. No player pre-assigned.
- `20260907000000_bibs_bonus.sql` (ADR-037, E2 / #5) &mdash; a `+100` KUT
  Coins bonus for the session's bibs washer (coins only). Adds
  `kut.match_sessions.bibs_washed_by`, the `kut.bibs_rewards` guard table,
  `kut.grant_bibs_reward`, `bibs_bonus` in the `wallet_ledger.reason` and
  `user_notifications.event_type` checks, and a trailing `p_bibs_washed_by`
  on `publish_attendance_session` / `correct_published_attendance_session`
  (old signatures dropped + recreated).
- `20260908000000_activity_feed.sql` (ADR-038, E3 / #10) &mdash; a read-only
  member-wide `kut.activity_feed` view (sales + listings + pack opens +
  published sessions; sale rows expose the buyer name club-wide).

Before Batch E, also deployed 2026-08-31:
`20260905000000_admin_economy_tools.sql` (ADR-035, batch D &mdash;
`admin_adjust_wallet` audited coin faucet + `admin_reset_account` soft club
reset + the `admin_account_events` audit table),
`20260904000000_canonical_coin_name.sql` (ADR-034, batch C &mdash; "KUT
Coins" is the one currency name) and `20260903000000_drop_is_tradeable.sql`
(ADR-033, batch B &mdash; every card tradeable, `is_tradeable` dropped); and,
`20260902000000_starter_reveal_and_rating_snapshots.sql` (ADR-031, deployed
2026-08-30).

Supabase records migration history globally for the shared database, not per
schema. Hosted migrations are therefore catalogued and deployed only from
[`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase). This repository
keeps matching SQL files for local Supabase development and database tests;
never run a hosted `supabase db push` from here.

Before writing code in a new session, read (in order): `docs/BUILD_SPEC.md`,
`docs/PROGRESS.md` (once it exists), `docs/decisions.md`, and recent git
history — the build spec itself asks for this same reading order (Part
XXXI) and lists the phased delivery plan (Part XXXIV) to follow slice by
slice rather than building everything at once.

## Backend model
All VibeTrunk tools share **one Supabase project**, each in its own Postgres
schema — this tool's is the `kut` schema. Row-level security is enabled on
every table; the browser never talks to Postgres directly. Per the build
spec (Part XX–XXIII), economically valuable operations (pack opening,
discard, market buy/sell, starter grant, attendance rewards) must be
server-authoritative — implemented as tightly validated database functions
or Edge Functions, never as direct client writes to `wallets`, `user_cards`,
or `market_listings`.

## Working style
Same as `VibeTrunk/home`: this is partly a deliberate learning project in
production-grade practices, not just a quick hack — favor clear structure
and document decisions in markdown as you go (`docs/decisions.md`,
`docs/PROGRESS.md` per the build spec's Part XXXI).

The build spec is unusually prescriptive on purpose (Part I, §1): security
and data-integrity requirements win over convenience, the game-economy
invariants (Part L) must never be violated, and any agent that changes a
game rule, database invariant, public API, or phase acceptance criterion
must update the spec or record the deviation in `docs/decisions.md` — never
silently "improve" a formula.

## Agent safety
Standard VibeTrunk scaffold (see global CLAUDE.md's agent safety policy) —
PreToolUse hooks block destructive commands and young (<14-day) npm
packages; see `AGENTS.md` and `.claude/settings.json` /
`.codex/rules/project.rules` for exact allow/deny lists. This scaffold was
generated by the `vibetrunk-new-tool` skill from the template
`VibeTrunk/home` established, and copied into `VibeTrunk/cogitster` before
that.

Live-mutating Supabase CLI commands (`supabase db push` for real, `supabase
db reset`, `supabase secrets set`) are intentionally **not** auto-allowed —
they change the live schema or rotate live credentials for every VibeTrunk
tool sharing this Supabase project, so each use should get a deliberate look
rather than running unattended. Read-only/dry-run commands (`supabase
migration list`, `supabase db push --dry-run`, `supabase functions deploy`)
are allowed.
