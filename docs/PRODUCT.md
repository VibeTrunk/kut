# FLUT product reference

What the game does today, per area, and where each rule lives. This is the first
stop before changing behaviour. Read only the section you need. It replaces
reading the old build spec, roadmap and ADR log for orientation. Those were
archived at the git tag `docs-archive-2026-10`; read a `BUILD_SPEC §N` or an
older ADR (ADR-001 to ADR-141) from there:

```powershell
git show docs-archive-2026-10:docs/BUILD_SPEC.md | rg "^## 44\."
git show docs-archive-2026-10:docs/archive/decisions-2026.md | rg "ADR-099"
```

Newer ADRs are in `docs/decisions.md`. Open work is in GitHub issues
(`gh issue list`).

Ground rules for every area:

- **SQL is authoritative.** Every economy and rating rule runs in Postgres
  functions in schema `kut` (`supabase/migrations/`, where the latest
  `create or replace` wins). The browser never writes `wallets`, `user_cards`
  or `market_listings`. `src/game/` holds constants and display helpers only.
  ADR-064 deleted the TypeScript mirrors of the rating and economy formulas.
  The one TS twin with golden-vector parity is the Midweek engine.
- **Part L** (`docs/INVARIANTS.md`, items 1–28) lists the invariants. Each area
  below names the items that apply. Changing one needs an ADR, a spec change and
  its own PR.
- **Values** (§145, `src/game/config.ts`, `ECONOMY` in `src/game/economy.ts`,
  `src/game/midweek/config.ts`) each mirror a SQL literal. Change the
  migration, the constant and §145 together.
- **Reads** go through views. Member-wide views are definer projections gated
  on `kut.is_active_member()` (ADR-079); never flip them to `security_invoker`
  (KB-013). Tests: pgTAP in `supabase/tests/database/`, races in
  `tests/integration/`.
- **No scheduler.** Due work (survey finalization, Midweek steps, offer expiry)
  runs lazily from page visits through idempotent `for update skip locked`
  workers (ADR-061, ADR-098).

| If you are changing… | Read |
| --- | --- |
| pack price, odds, starter, discard, wallet, Club Value | [Packs and economy](#packs-and-economy) |
| listings, buying, offers, wants | [Market and trades](#market-and-trades) |
| OVR, Form, attributes, tiers, G+A | [Ratings](#ratings-form-and-ga) |
| sessions, attendance, rewards, Chronicle | [Attendance](#attendance-and-the-chronicle) |
| post-session report, kudos | [Reports and kudos](#reports-and-kudos) |
| anything on `/midweek` | [Midweek Madness](#midweek-madness) |
| Special cards, Groundmasters | [Specials](#specials-and-groundmasters) |
| injury, rehab check-in, plaster cast | [Injury mode](#injury-mode) |
| inbox, Home "now" cards, activity feed | [Notifications](#notifications-and-home) |
| `/admin/*` | [Admin](#admin) |
| who sees what, photos, invites | [Privacy](#privacy-consent-and-accounts) |
| names, domain, redirect | [FLUT name and domain](#flut-name-and-domain) |

## Packs and economy

**Behaviour.**
- One currency, FLUT Coins (ADR-034, renamed in ADR-137). Every change is a
  `wallet_ledger` row with a reason.
- Faucets: the starter grant (250 coins and 3 distinct Live cards, once),
  attendance (250 per session), the bibs bonus (100), a session report (50),
  the injury stipend (100 a week), Midweek wins and calls, audited admin grants.
- Sinks: packs, and the 5% market tax, which is burned.
- The basic pack (`tfh-pack` in `kut.pack_definitions`) costs **250** and holds
  3 Live cards. The draw is weighted by current tier: Common 100, Bronze 60,
  Silver 30, Gold 12, Holo 4, Elite 1 per eligible Player. `open_pack` needs the
  quoted price and an idempotency key, so a stale quote never debits.
- Discard burns a copy for `round(10 × 1.08^(OVR − 30))`, computed by the server
  at the moment of discard.
- Club Value (`/club/value`, Standings) is coins + owned discard value + 4× the
  discard value of the member's own linked Player. Duplicates of one edition
  count 100/20/5/0% (v3, ADR-056). Discard always pays in full.
- The starter reveal on `/welcome` is cosmetic. The grant already happened in
  `claim_invitation` (ADR-031).

**Part L:** 2, 4, 5, 6, 7, 8, 10, 11.

**Where.**
- `open_pack(text, bigint, uuid)`, `discard_card`, `card_discard_value`,
  `claim_invitation`, `grant_starter_pack`, `mark_starter_opened`.
- Views: `my_collection_cards`, `my_pack_opening_results`, `my_club_value*`,
  `club_value_leaderboard`, `pack_economy_health` (admin).
- `scripts/measure-pack-ev.mjs` measures a pack's expected value on the real
  roster.
- `src/lib/pack-summary.ts`, `src/lib/album.ts` (the album is a paged book,
  ADR-048).

**History.**
- Pack price: 175 (ADR-057, 6 Sep) → 250 (ADR-136, 7 Oct).
- Attendance reward: 75 → 250 (ADR-029, 29 Aug), not retroactive.
- Club Value: v1 used wallet + reference value; v2 used the discard sum
  (ADR-041); v3 added the duplicate discount.
- "Untradeable" starter cards were retired (ADR-033). Every card is tradeable
  and discardable.
- Ideas, not built: silver and gold packs (issue #223).

## Market and trades

**Behaviour.**
- **Listings.** Buy-now only, 24 or 72 hours (ADR-072). The price must lie
  within `get_listing_bounds`:
  - minimum `max(1, floor(0.8 × discard))`;
  - maximum `max(100, ceil(5 × reference value))`;
  - a listed card stays owned but cannot be discarded, re-listed or offered.
- **Buying.** `buy_listing` is one locked transaction: debit the buyer, credit
  the seller minus 5%, move the card, write `market_sales`, and send both
  parties a message (ADR-019).
- **Reference value.** The median of at least 5 sales in 14 days, clamped to
  1–6× discard. Otherwise 1.5× discard.
- **Trade offers** (ADR-042, `/market/[listingId]`):
  - coins and/or up to 3 cards, escrowed when proposed, at most 10 active;
  - they expire after 12 h;
  - on accept, the trade swaps atomically and the other offers are refunded;
  - accepted trades never enter `market_sales`.
- **Wants.** Up to 100 private wants and 30 copies marked available (ADR-058).
  A match shows only the owner's display name and a copyable prompt; there is
  no matcher.
- **Listing page.**
  - An ownership chip shows how many copies of the Player and the edition you
    own, counted across every collection copy (ADR-100, ADR-102).
  - The discard value is shown as the price floor (ADR-103).

**Part L:** 1, 2, 3, 4, 5, 20, 22, 23.

**Where.**
- `create_listing(uuid, bigint, integer)`, `cancel_listing`, `buy_listing`,
  `propose_trade`, `respond_to_trade`, `withdraw_trade`,
  `expire_trade_offers` (lazy, from the market pages),
  `market_reference_value`, `set_card_want`, `set_trade_availability`.
- Views: `active_market_listings` (has `seller_id` and `discard_value`),
  `my_trade_offers`, `my_wanted_cards`, `my_trade_cards`.
- Races: `tests/integration/market-race.test.ts`, `trade-race.test.ts`.
- `src/lib/market-ownership.ts`.

## Ratings, Form and G+A

**Behaviour.**
- Ratings are rebuilt deterministically from history by
  `kut._rebuild_season_core`, never incremented.
- **Activity** (0–100) is decayed and topped up per football week (ISO Monday
  to Sunday):
  - ×0.90 each week;
  - +14 for one appearance, +17 for two or more;
  - weeks without a published session are skipped entirely.
- **activity OVR** = `30 + 45 × (activity/100)^0.8`.
- **Form** (0–8):
  - From the season's v2 cutover (TFH 2026: week of 7 Sep), Form is the sum of
    per-session inputs from member reports, weighted 1/.75/.5/.25/0 by session
    age.
  - Each input is the G+A score plus the kudos score, capped at 3.5.
  - G+A scores 0/1/1.25/1.5 for 0/1/2/3+.
  - Kudos score 0/1/1.5/2 for 0/1/2/3+ recognised categories.
  - Earlier sessions keep the v1 weekly goal formula (§13.1).
- **Live OVR** = `clamp(round(activity OVR + round(Form)), 30, 83)`.
- **Tiers:** Common 30–39, Bronze 40s, Silver 50s, Gold 60s, Holo 70s,
  Elite 80–83.
- **Attributes** are OVR plus the archetype offsets (seven archetypes; each
  offset set sums to 0). SHO gets `+min(8, 2 × last week's count)`.
- Every Live copy of a Player shows the same current stats.
- Cards explain their own rating in Form terms: the rating story, the
  breakdown and the history graph over tier bands (ADR-047, ADR-074, ADR-076).

**Part L:** 12, 13, 15, 16.

**Where.**
- `_rebuild_season_core`, `rebuild_season`, `capture_rating_snapshot`
  (weekly snapshots, `top_risers`), `season_rating_rules`.
- Views: `public_live_ratings`, `player_rating_breakdown`,
  `player_form_contributions`.
- `src/game/rating-engine.ts` (display helpers only),
  `src/game/archetypes.ts`, `src/lib/rating-story.ts`.
- Tests: `rating_breakdown.test.sql`, `goals_assists_cutover.test.sql`.

**History.**
- The first-appearance bonus went from 8 to 14 (ADR-024, 18 Aug).
- **Goals → G+A (ADR-101).**
  - From the week of **28 Sep 2026** the reported count is goals plus assists
    combined, stored as one integer.
  - Earlier sessions keep the goals-only meaning and the "goals" label
    everywhere. Nothing was backfilled.
  - Column names (`goals`, `p_goals`, `effective_goals`) are compatibility
    names.
  - The cutover lives in `GOALS_ASSISTS_CUTOVER` (`src/game/reported-count.ts`)
    and in `kut._uses_combined_count`, pinned to the same date by tests.
  - Midweek's simulated goals and assists are separate and unaffected.
- Archetype self-service is limited to once per 336 hours, admins exempt
  (ADR-094).

## Attendance and the Chronicle

**Behaviour.**
- An admin records a session (`monday`, `friday` or `other`) with its
  attendees, the bibs bringer, and G+A for attendees without an account, then
  publishes it.
- Only published sessions count. Publishing:
  - rebuilds ratings;
  - pays each linked attendee the attendance reward once, with an inbox
    message;
  - pays the bibs bonus once per (session, Player);
  - opens the session report.
- Corrections are audited (ADR-007). A bibs reassignment pays the new
  bringer; the previous one keeps theirs.
- A session is never deleted: cancel and reactivate (ADR-008, ADR-009). A
  cancelled session does not count as a football week.
- The **Chronicle** (`/chronicle`, `/chronicle/[week]`) has one issue per
  football week (ADR-049). It shows finalized per-player results. While a
  report is open it shows only aggregate progress, marked provisional
  (ADR-060). `/sessions` redirects there.

**Part L:** 5, 9, 15, 16, 17, 21.

**Where.**
- `publish_attendance_session`, `correct_published_attendance_session`,
  `cancel_published_session`, `reactivate_cancelled_session`,
  `process_published_session_rewards`, `grant_attendance_rewards`,
  `grant_bibs_reward`.
- Views: `published_sessions`, `chronicle_*`.
- `src/lib/chronicle.ts`, `src/game/football-week.ts`.

## Reports and kudos

**Behaviour.**
- Publishing opens a **24-hour report** for each linked attendee
  (`/sessions/[sessionId]/report`, the Home "now" card).
- The member reports their G+A and nominates teammates. The ballot shows
  three of the seven positive kudos categories, chosen deterministically.
  An unanswered category is not a Skip (ADR-068).
- A complete form (zero G+A and skipped kudos included) pays **50 once**.
  A submitted report never goes back to draft (ADR-078).
- **At finalization:**
  - a category is recognised when at least two distinct teammates nominated
    it, and only once at least three reporters gave kudos;
  - results and rating snapshots are versioned and the ratings rebuilt;
  - each linked attendee gets `session_results`;
  - each recognised Player gets `kudos_awarded`, which names the categories
    and the OVR change, never the nominators (ADR-069).
- Ballots and per-player provisional values stay private until then.
- **Admin options:**
  - correct a G+A with a reason, which never pays;
  - close a window early with a reason, which keeps `closes_at` on the record
    (ADR-067).

**Part L:** 4, 5, 16 (the paid-once reward is an ADR-059 contract, not a
Part L item).

**Where.**
- `submit_session_report`, `finalize_session_surveys` → `_finalize_one_session`,
  `admin_correct_session_goals`, `admin_finalize_session_survey`,
  `is_survey_finalized`.
- Tables: `kudos_categories`, `session_reports`, `session_report_results`.
- Lazy trigger: `src/lib/session-reports/finalize-due-surveys.ts`.
- Ballot: `src/lib/session-reports/kudos-ballot.ts`.

**History.**
- The kudos ladder rose to +2 and the session cap to 3.5 (ADR-060, ADR-063).
- A planned cutover move was withdrawn and never shipped (ADR-062).

## Midweek Madness

**Behaviour.**
- **The week.** Every football week, members' five-card squads play a seeded
  knockout on Wednesday evening (BUILD_SPEC §44, the canonical rules).
  - The lock is **19:55 Europe/Amsterdam**. Round *r* starts at
    lock + 5 + 15(*r*−1) minutes.
  - A match is 14 chance slots of 20 s, then a shoot-out if needed.
  - Each week keeps the clock version it opened with (ADR-104).
- **Who plays.**
  - Every active member who owns a card and hasn't opted out is entered.
    Non-pickers get a random **auto squad** at a 0.55 handicap.
  - Empty slots get **trialists**.
  - The week is skipped with fewer than 4 entrants, or when the previous week
    had no published session.
- **Squads.** One Player per slot. Power is the OVR factor (1.00–1.12) × form
  roll × pick factor × fitness × handicap, and a fresh day roll every match.
- **Shape** (ADR-116):
  - archetypes give 0–3 plusses per line;
  - each outfield line short of 3 plusses multiplies the squad by 0.88;
  - one card plays in goal.
- **Archetypes for the week.** They are frozen when the week opens (ADR-099).
  Unclaimed Players draw a new archetype each week from the week's seed
  (ADR-110).
- **Rewards.**
  - Wins pay by round, summing to **250** for the champion (ADR-096), paid
    lazily after the final in the transaction that completes the week.
  - Members who are already out may **call** the winners of later matches.
    Correct calls pay 30 divided by the matches after round 1, at most 30 a
    night (ADR-118).
  - Every entrant gets one `midweek_result` message (ADR-109).
- **After the night.**
  - Cards get night ratings from 1 to 10 (ADR-117). These are display only and
    never touch OVR.
  - Share images: a champion poster and "my night", drawn in the browser
    (ADR-120).
- **Pages.** `/midweek` (picker, evening, champion), `/midweek/[weekStart]`,
  `/midweek/[weekStart]/match/[matchId]`, `/midweek/past`, all under the
  Compete tab (ADR-107). The admin page has the switch, a rehearsal and void.

**Part L:** 4, 5, 25, 26, 27, 28.

**Where.**
- **Engine:**
  - SQL `_mm_*` functions, driven by `run_midweek_due` (open, lock and simulate,
    pay);
  - the pure TS twin in `src/game/midweek/`;
  - parity is pinned by `tests/fixtures/midweek-golden.json`
    (`tests/unit/midweek-golden.test.ts`, `midweek-parity-sql.test.ts`,
    `supabase/tests/database/midweek_engine_parity.test.sql`), ADR-090.
  - Change TS, golden file and SQL together.
- **Member RPCs:** `save_midweek_squad(uuid[])`, `set_midweek_opt_out`,
  `save_midweek_prediction`.
- **Reveals:** time-gated `midweek_*_public` views (§44.9). Nothing is revealed
  by a job.
- **Lazy trigger:** `src/lib/midweek/run-due.ts`, called from Home and every
  Midweek page.
- **Reports:** a seeded phrasebook in `src/lib/midweek/report/` (ADR-093).
- **Simulation:** `tests/sim/`.

**History.**
- Friday Five was removed (ADR-088) and Midweek was specified (ADR-089).
- Switched on 26 Sep; the first evening was 30 Sep.
- The clock was v1 (20:00, whole rounds every 30 min) until ADR-104.
- Rotation and balance went live on 3 Oct.
- Operations rule: never push a migration during a running Wednesday evening.

## Specials and Groundmasters

**Behaviour.**
- The Special editions schema exists, but **nothing is issued** (ADR-055).
  Packs and starters draw Live editions only.
- A Special's identity, rating, rarity and art are a frozen snapshot that never
  changes.
- Projections read the stored `snapshot_rarity_tier` (ADR-121, KB-038). Live
  tiers follow current state.
- A Special is never drawn in the injury cast. It may play in Midweek, where
  the strongest copy per Player is used.
- `/admin/editions` is a read-only foundation page.

**Part L:** 14 (and 6, 7, 10 once a pack can roll one).

**Where.**
- `20260916000000_special_edition_scaffolding.sql`,
  `protect_frozen_card_edition`.
- Tests: `special_editions.test.sql`, `special_snapshot_tiers.test.sql`.

**Next (favored, not decided).** Groundmasters, a one-off Special for the
Players who helped renew the pitch agreement. Issue #222 holds the proposal
and the delivery order:
1. an ADR and spec update;
2. the card design;
3. the issuance migration;
4. a pack roll in its own PR.

The `edition_type` check still lacks a `groundmaster` value.

## Injury mode

**Behaviour.**
- An admin starts injury mode from the injury date (ADR-082).
- Each football week without an appearance, the member may do one **rehab
  check-in**, for the current or the previous week. It pays **100** and
  **protects** that week's Activity: no ×0.90 decay. Form still fades.
- Injury mode ends by itself at the first attended session after the injury
  date, or when an admin ends it. Protection is never backdated.
- **Comeback Form** (ADR-083): after 3 or more protected weeks, the first
  return earns `min(2, 0.25 × protected weeks)` as a fading Form input.
- **Plaster cast:** the Live card of a currently injured Player is drawn in a
  signed cast on every card screen (ADR-084 to ADR-087). In Midweek its
  fitness is 0.95.

**Part L:** 4, 5, 15, 24.

**Where.**
- `admin_start_injury`, `admin_end_injury`, `injury_check_in(date)`,
  `my_injury_status`, `comeback_form_inputs`.
- Views: `injured_players`.
- `src/lib/injuries.ts`, `src/lib/injury-cast.ts`, the `/injury` route.
- Tests: `injury_protection.test.sql`, `injury_comeback.test.sql`.

## Notifications and Home

**Behaviour.**
- `user_notifications` is a private inbox (`/messages`), written only by
  server functions inside the transaction that caused it.
- Event types: `market_sale`, `market_purchase`, `attendance_reward`,
  `pack_opened`, `admin_notice`, `bibs_bonus`, `trade_offer`,
  `trade_response`, `session_report`, `session_results`, `report_correction`,
  `kudos_awarded`, `injury_check_in`, `midweek_result`.
- Every message opens its subject through `/messages/[id]/open`, which also
  marks it read (ADR-114).
- **Home:**
  - leads with a "now" stack of what's due: the Midweek evening, picking, the
    open report, the rehab check-in, the champion card;
  - then top risers and the club activity feed, which excludes superadmin
    activity (ADR-038, ADR-039, ADR-054).
- No push, email or realtime delivery exists.

**Part L:** none directly. Messages ride the economy transactions, so a sale
never misses one side's message.

**Where.**
- `mark_notifications_read`. Views: `activity_feed`, `top_risers`.
- `src/lib/messages.ts`, `messages-load.ts`, `src/lib/home/`,
  `src/lib/activity.ts`.
- `src/lib/notification-copy.ts` translates stored "KUT Coins" text at display
  time (ADR-137). A test fails if a migration adds an untranslated literal.

## Admin

**Behaviour.**
- Roles: `user`, `admin`, `superadmin`. Pages under `/admin`:
  - **Attendance:** record, publish, correct, cancel; reports, G+A
    corrections, early close.
  - **Roster:** add, deactivate or hard-delete a never-used Player
    (ADR-025, ADR-026); start or end an injury. **Invites.**
  - **Accounts** (`/admin/links`): link to a Player (ADR-028), disable or
    delete (ADR-030), soft reset to 250 coins (ADR-035), adjust a wallet
    (at most 100,000 per call).
  - **Account recovery** (`/admin/accounts`): audited password resets
    (ADR-011). **Pack health** (`/admin/economy`). **Midweek**: switch,
    rehearsal, void.
- Admin work should stay tiny (§3.7). Midweek needs none weekly.
- A superadmin may grant coins to their own wallet; `admin_adjust_wallet`
  refuses the caller's own (ADR-052).

**Part L:** 5, 8, 12, 17, 19.

**Where.** The `admin_*` RPCs, `admin_account_events` (audit),
`midweek_admin_overview`, `admin_session_report_roster`.

## Privacy, consent and accounts

**Behaviour.**
- **Membership** is invite-only (ADR-006): a token is claimable once and stored
  as a hash, sign-up takes a username (ADR-028), and sign-in is by password,
  with no Supabase Auth redirect flow.
- **Members-only:** every page and projection (ADR-020, ADR-079); no public
  roster. Never exposed: emails, tokens, others' ledgers, admin notes.
- **Card ownership** is private (the album, wants, collections). Exceptions:
  - a listing shows its seller;
  - Midweek shows the five entered cards from the lock. Entry is the default
    and the opt-out is the consent (ADR-091);
  - an owner count appears only at 3 or more owners.
- **Photos.** A member sets their own Player's photo and archetype on
  `/settings/card` (ADR-027). Photos live in a private Storage bucket. The
  silhouette is the default.
- **Share images** (ADR-120) are the one deliberate exception to §53. They
  carry names and photos, are drawn in the browser and sent only by the member;
  nothing is hosted.
- **Backups** (ADR-141) cover schema `kut` only. Auth accounts are not backed
  up.

**Part L:** 18, 19, plus the ADR-079 gate on every definer view.

**Where.**
- `is_active_member`, `is_admin`, `claim_invitation`, `set_own_player_photo`,
  `set_own_player_archetype`, `set_own_club_name`.
- `src/lib/invites/`, `src/lib/auth/`, `src/lib/player-photos.ts`.
- Tests: `member_only_projections.test.sql`.

## FLUT name and domain

**Behaviour.**
- The game is **FLUT, Football League Ultimate Team** (ADR-137, 8 Oct;
  formerly KUT). The currency is **FLUT Coins**.
- Only user-visible words changed. They come from `src/lib/brand.ts`.
- Internal names stay `kut`: the schema, the repo, the Vercel project, the
  ledger reasons and server-written text (translated at display).
- The primary host is `https://flut.vibetrunk.com` (ADR-139). `next.config.ts`
  redirects every path on `kut.vibetrunk.com` to the same path and query there
  with a **307**.
- Sign-in cookies are per host. Invite links use `APP_URL`.

**History.** Slice 5 (switching the redirect to 308) was **declined** on
9 Oct. The redirect stays a 307 so a rollback reaches members at once.
Reopen this only if the legacy host is retired. `/club/midweek/*` → `/midweek/*`
is a separate permanent redirect (ADR-107).

**Where.** `next.config.ts` and `tests/unit/legacy-host-redirect.test.ts`.
`docs/RELEASING.md` has the live check.
