# Tester feedback — triage and delivery batches

Date raised: 2026-08-30

A round of tester feedback (10 findings + 2 future ideas; finding #11 was
added later, while cutting Batch C). The intent is to
deliver **all of it eventually**, in the ordered batches below rather than one
large change — several items change a game rule, an economy faucet, or a DB
invariant and so need their own migration, `docs/decisions.md` entry, and test
updates. Hosted migrations deploy from `VibeTrunk/supabase`, not this repo, so
every DB batch has a separate hosted-deploy step, run through the risk-tiered
checklist in `docs/OPERATIONS.md` (ADR-032): additive migrations are the light
path (dry-run + parity + merge); data-changing ones also need a fresh backup
and an SQL-reversible shape.

## Findings

| # | Summary | Difficulty | Notes |
|---|---------|-----------|-------|
| 1 | Attendance reward messages show the kicker "Market purchase" | Trivial | `messages/page.tsx` hard-coded the kicker to one of two market labels; `attendance_reward` fell through. Front-end only. |
| 2 | Wrong username/password error says "email" | Trivial | `login-form.tsx` copy. Legacy email sign-in path stays (`loginIdentifierToEmail`), so the pre-username hint still mentions email by necessity. |
| 4 | Add Goalkeeper archetype (different stats) | Medium / Hard | Medium if GK reuses the 6 stats with its own offset row (`archetypes.ts`, `ARCHETYPE_OFFSETS`, 3 SQL `check` constraints, 2 RPC allowlists, archetype pickers, `archetypes.test.ts`, migration + hosted deploy, spec entry). Hard if GK gets a distinct stat set (DIV/HAN/REF…) — rewrites the card component and every attribute projection. |
| 5 | Bonus coins for washing the bibs (recorded with weekly attendance) | Medium / Hard | Medium for a coin bonus: attendance-flow input, storage column/table, reward path mirroring `grant_attendance_rewards` (ledger + wallet + notification), migration + hosted deploy. Hard if it feeds ratings/OVR (Part L invariants + spec). |
| 6 | Reset accounts even after they have traded | Medium / Hard | Blocked today by design: `admin_prepare_account_deletion` refuses accounts with `market_sales` rows (ADR-030); those FKs are `ON DELETE RESTRICT`. Soft reset (keep login, wipe wallet/cards/packs/messages/attendance rewards, re-grant starter, keep trade history) is Medium. True hard delete is Hard. Needs a product decision + ADR. |
| 7 | Coin name inconsistent — "KUT Coins" vs "TF Coins" | Medium | Live "TF Coins" strings in `packs/actions.ts` and in SQL function bodies (market notifications, insufficient-funds errors). Decide canonical name (**proposed: "KUT Coins"**, realign the spec's "TF Coins"), sweep code + SQL, backfill existing notification rows, migration + hosted deploy. |
| 8 | Admin can assign coins to a player | Medium-low | Mirror the attendance-reward pattern: `kut.admin_adjust_wallet(user_id, amount, reason)` (security definer, `is_admin()` gate, ledger reason + audit) + a small admin form. Migration + hosted deploy. ADR line (coin faucet, Part L). |
| 9 | Remove the untradable concept; drop Locked/Tradeable and "Live edition" labels | Trivial / Medium | "Live edition" text removal is Trivial (done in Batch A). Retiring `is_tradeable` is Medium — threaded through the starter grant, discard RPC guard, marketplace list/buy RPCs, both projections, the card detail page ("Ownership", "Starter cards are locked" explainer), plus a Phase-1B acceptance criterion and a Part L invariant. Also update/remove the db-tests asserting "3 untradeable starter cards". "Non-live edition as an icon" is a later concern — `is_live` already exists in the data. |
| 10 | Newsfeed of recent actions | Medium | No new write paths — sales (`market_sales`), listings (`market_listings`), discards (`wallet_ledger`), pack opens (`pack_openings`), attendance already persisted. Work is a unioned read-only view + member-wide RLS + pagination + a page + nav entry + copy. Migration + hosted deploy. Decide which events are public and how far back. |
| 11 | Home never expands the "KUT" acronym | Trivial | `src/app/(app)/page.tsx` header was kicker "Terrible Football Haarlem" + h1 "This week in KUT"; the full name "Kelderklasse Ultimate Team" appeared only in `layout.tsx` metadata and `login/page.tsx`. Added once as a subtitle under the h1 on the authenticated Home. Front-end only, no migration. Bundled into Batch C. |

Finding 3 was withdrawn by the tester (no entry).

## Future ideas

Ideas raised in feedback but not scheduled now live in **`ROADMAP.md`**
("Tester-feedback ideas"), each with a status and a next step. This file keeps
only the triage record — who raised what, de-duplication, and where each item
went. Round 1 sent two ideas forward (a coin-generating dimension; a rating
graph over time); round 2 sent one (see other members' squads); round 3's
triage table is below.

---

# Tester feedback — round 2

Date raised: 2026-09-01 (screenshots + notes). Four defects and three
buildable ideas, delivered as **one sweep** (not batches): KUT branch
`feat/tester-feedback-round-2`, one migration
`20260912000000_tester_feedback_round_2.sql`, one ADR (ADR-044). The hosted
migration deploys from `VibeTrunk/supabase` as its own step.

| # | Summary | Difficulty | DB migration? | Notes |
|---|---------|-----------|---------------|-------|
| 1 | A club-activity row renders blank | Trivial | no | `kut.activity_feed` gained `kind = 'trade'` (ADR-042 §18); `src/lib/activity.ts` still knew 4 kinds, so a trade row had an empty kicker + `undefined` sentence. Added the `trade` case + a `default` arm. |
| 3 | No club names on the leaderboard (mobile) | Low | no | CSS: the row `<li>` used the multi-column grid at every width, collapsing the `minmax(0,1fr)` name track to 0 on a phone; Club column was `hidden lg:block`. Row restacks on mobile; club name shows at every width. |
| 4 | KUT full name lost from Home | Trivial | no | ADR-043 rewrote the Home header and dropped the "Kelderklasse Ultimate Team" subtitle (added in ADR-034). Re-added under the `<h1>`. |
| 7 | Bibs message says "washing … after", should be "bringing … to" | Medium-low | **yes** | The notification body is built in `kut.grant_bibs_reward`. `create or replace` with the corrected `format()` string + a scoped, reversible backfill of existing `bibs_bonus` rows. Internal identifiers (`bibs_washed_by`, `bibs_bonus`) unchanged. Front-end: attendance-form label, How-it-works line, `economy.ts` comment. |
| 💡01 | Tap a card to view it fullscreen | Medium | no | New `card-lightbox.tsx` client overlay (portal-free, CSP-clean, focus-trapped, reduced-motion aware). A dedicated expand button on each card opens it; card-body tap still navigates. Wired into Collection / Player directory / Market / both detail pages. |
| 💡04 | Rename your club | Medium | **yes** | `profiles.club_name` existed unused. New `kut.set_own_club_name(text)` RPC (own-row, trim, blank→NULL, ≤80, no control chars, **not unique**); `club_value_leaderboard` `coalesce`s it with the old default. Front-end: a section on `/settings`. |
| 💡12 | See published sessions somewhere | Low-Medium | **yes** (additive view) | Members already read published sessions/attendance via RLS. New `kut.published_sessions` summary view + `/sessions` list + `/sessions/[id]` detail (attendees, goals, bibs bringer) + a "More" nav entry. |
| 💡03 | See other members' squads/teams | — | — | **Document only** — carried to `ROADMAP.md` (blocked: needs a card-ownership privacy decision + ADR). |

## Round-2 delivery

| Batch | Contents | Migration tier (ADR-032) | Status |
|-------|----------|--------------------------|--------|
| **F — one sweep** | #1, #3, #4, #7, 💡01, 💡04, 💡12 | data-changing (the `user_notifications` backfill in #7; the RPC + view + view changes are additive) | **done** &mdash; KUT PR #31, ADR-044, migration `20260912000000`; deployed to hosted 2026-09-01 (VibeTrunk/supabase PR #20) |

## Delivery batches

| Batch | Contents | Migration tier (ADR-032) | Status |
|-------|----------|--------------------------|--------|
| **A — copy & labels** | #1, #2, #7 front-end strings, #9 "Live edition" label | none | merged (PR #14) |
| **B — tradability** | #9 model change (every card tradable, delete the untradable concept), drop guards, spec + tests | data-changing (drop `user_cards.is_tradeable`, market RPC semantics) | **done** — KUT PR #17, ADR-033, migration `20260903000000`; deployed to hosted 2026-08-31 (VibeTrunk/supabase PR #11 + #12) |
| **C — coin-name sweep** | #7 SQL function bodies (`open_pack` / `buy_listing` error strings + market notification bodies) + backfill of existing `user_notifications` rows + leaderboard `TF`→`KUT` ticker + spec/README/ADR realignment; #11 expand "KUT" on Home | data-changing (backfill `update` on `user_notifications`) | **done** — KUT PR #19, ADR-034, migration `20260904000000`; deployed to hosted 2026-08-31 (VibeTrunk/supabase PR #13 + #14) |
| **D — admin economy tools** | #8 assign coins, #6 soft account reset | additive (new RPC + admin form; the reset *operation* mutates rows at run time, not the migration) | **done** — KUT PR #21, ADR-035, migration `20260905000000`; deployed to hosted 2026-08-31 (VibeTrunk/supabase PR #15 + #16) |
| **E1 — Goalkeeper archetype** | #4 — a seventh archetype reusing the six stats with its own offset row (pac -6, sho -12, pas 0, dri -8, def +14, phy +12; sums to 0), opt-in, no player pre-assigned | additive (widened `check` + `create or replace` RPCs; no member rows touched) | **done** — KUT PR #23, ADR-036, migration `20260906000000`; deployed to hosted 2026-08-31 (VibeTrunk/supabase PR #17 + #18) |
| **E2 — bibs-washing coin bonus** | #5 — coins-only (+100), `match_sessions.bibs_washed_by` column + `grant_bibs_reward` + `bibs_rewards` guard table, forward-only on corrections | additive (new column/table + two widened checks + `create or replace` RPCs) | **done** — KUT PR #24, ADR-037, migration `20260907000000`; deployed to hosted 2026-08-31 (VibeTrunk/supabase PR #17 + #18) |
| **E3 — activity newsfeed** | #10 — member-wide `activity_feed` view (completed sales + new listings + pack opens + published sessions; no discards), ~200-event window, sale seller+buyer names shown club-wide | additive (one `create view` + grant) | **done** — KUT PR #25, ADR-038, migration `20260908000000`; deployed to hosted 2026-08-31 (VibeTrunk/supabase PR #17 + #18) |

## Open product decisions (needed before B–E)

- **#4** — ~~GK reuses the 6 existing stats with its own offset profile, or gets a
  distinct GK stat set?~~ **Decided 2026-08-31 (ADR-036):** a seventh offset
  profile over the same six stats (pac -6, sho -12, pas 0, dri -8, def +14,
  phy +12; sums to 0), opt-in via the existing self-service / admin RPCs, no
  player pre-assigned (keeps the migration additive).
- **#5** — ~~bibs bonus is coins only, or also a rating/OVR effect? Coin
  amount?~~ **Decided 2026-08-31 (ADR-037):** coins-only, `+100`, stored as
  `match_sessions.bibs_washed_by`, paid via `grant_bibs_reward` + a
  `bibs_rewards` guard table, forward-only on corrections.
- **#6** — ~~define "reset" as the soft reset described above?~~ **Decided
  2026-08-31 (ADR-035):** yes — `kut.admin_reset_account` wipes wallet / owned
  cards (soft burn) / pack history / notifications and re-grants the standard
  250 + 3 starter, replays the `/welcome` reveal, and **keeps** the
  login/username/profile/player link, every `market_sales` + market
  `wallet_ledger` row, and every `attendance_rewards` guard row (so invariant
  #9 holds). Idempotent on an `p_idempotency_key uuid`.
- **#8** — ~~admin assigns coins: grant only or both directions? cap? tell the
  member?~~ **Decided 2026-08-31 (ADR-035):** `kut.admin_adjust_wallet`, both
  directions, `abs(amount)` capped at 100,000, never below zero, a typed
  1–200-char reason required, `wallet_ledger.reason = 'admin_grant'`, an
  `admin_notice` inbox row, audited in `kut.admin_account_events`. Any
  non-superadmin target, not self; only a superadmin may adjust an admin.
- **#7** — ~~confirm canonical name is "KUT Coins" and the spec is realigned.~~
  **Decided 2026-08-31:** canonical name is exactly "KUT Coins" (singular "KUT
  Coin"); the leaderboard's narrow value column uses a short "KUT" ticker.
  ADR-034.
- **#9** — ~~confirm every card becomes tradable, including starter cards, and the
  concept is deleted (not just hidden).~~ **Decided 2026-08-30:** full removal
  (starter cards included, no softer hold rule); drop the `is_tradeable`
  column outright. ADR-033.
- **#10** — ~~newsfeed shows sales + new listings only, or also discards?
  Retention window?~~ **Decided 2026-08-31 (ADR-038):** completed sales + new
  listings + pack opens + published sessions; not discards. No retention job
  (`limit 200` + a `?before=` cursor). Sale rows show the buyer name club-wide.

---

# Tester feedback — round 3

Date raised: 2026-09-01. Two threads: a screenshot thread (items A1–A10) and
an ideas thread (💡01–💡20). De-duplicated across both, then triaged.
Nothing here has been built in this round — the disposition column says where
each item now lives.

## Defects

| Item | Sources | Disposition |
|---|---|---|
| Club-activity row renders blank | screenshot | Already fixed — round-2 #1 / ADR-044. No action. |
| No club names on leaderboard | screenshot, 💡04 | Already fixed / shipped — round-2 #3 + 💡04 / ADR-044. No action. |
| KUT full name lost from Home | screenshot | Already fixed — round-2 #4 / ADR-044. No action. |
| Bibs message wording | screenshot | Already fixed — round-2 #7 / ADR-044. No action. |
| Card fullscreen "doesn't work like intended" | 💡18 (Maarten), 💡01 follow-up | → **`KNOWN_BUGS.md` KB-001** (open; needs a repro). |
| Lighter box + hard line top-left of every card | screenshot (Maarten) | Intended element (`.live-card__topscrim`, the OVR readability ground, ADR-043) rendering with a hard edge → **`KNOWN_BUGS.md` KB-002** (open; fix sketch included). |

## Ideas

All carried to **`ROADMAP.md`** ("Tester-feedback ideas") with a status:

| Item | Sources | Status in ROADMAP |
|---|---|---|
| Duplicate copies weigh less for Club Value | A5, 💡02 (Freek; Maarten seconds) | blocked (economy formula + ADR) |
| See other members' squads / teams | A6, 💡03 (Teize) | blocked (privacy ADR) — already tracked from round 2 |
| Prestige (30 distinct cards → medal) + collections (themed set → payout) | A2, A10 (Maarten) | idea |
| "Store" instead of "Packs" + more to buy | 💡11 (Teize) | idea |
| Player / Team of the Season ("TOTS") | 💡17 (Darryl) | idea |
| Performance / peer scoring beyond goals — assists, defence, 1–5 player ratings, post-game survey, goalie saves, goal reward scaled by player count | A8, 💡06, 💡08, 💡14, 💡15, 💡16 | **favored** — designed as "Real-life play → ratings" in `ROADMAP.md` (attendance backbone + diminishing-returns goals + positive-only kudos survey) |
| Distinct goalkeeper stat set (handling / reflexes / …) | A9, 💡15 | idea (the "hard" GK variant deferred in round 1) |
| Market auctions | 💡05 (Teize) | idea |
| Weather bonus (rain / snow / freeze / >25 °C) | 💡07 (Teize) | idea |
| In-app FAQ | 💡09 (Teize); 💡10 support hotline (jokey) not carried | idea |

## Already covered (no action)

- 💡13 — personal special card weighs heavier for score: shipped as Club Value
  v2's 4× personal-card term (ADR-041).
- 💡12 — see published sessions: shipped (ADR-044, `/sessions`).
- 💡01 — card fullscreen: shipped (ADR-044); the "doesn't work" report is
  KB-001.
- 💡19, 💡20 — empty.
