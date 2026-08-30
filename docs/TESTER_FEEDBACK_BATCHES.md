# Tester feedback — triage and delivery batches

Date raised: 2026-08-30

A round of tester feedback (10 findings + 2 future ideas). The intent is to
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

Finding 3 was withdrawn by the tester (no entry).

## Future ideas (not scheduled)

- **Idea 1 — coin-generating dimension** (mini-game or PvP battles on card
  collections). Large; a new subsystem with its own tables, a new coin faucet
  to balance against the Part L sink/faucet invariants, and its own UI.
- **Idea 2 — rating graph over time.** Lower effort than it looks:
  `kut.player_rating_snapshots` already records weekly `live_ovr` per player
  per season (ADR-031), so a per-player OVR line chart is mostly a query + a
  chart component on the player page. Per-attribute history would need a wider
  snapshot table.

## Delivery batches

| Batch | Contents | Migration tier (ADR-032) | Status |
|-------|----------|--------------------------|--------|
| **A — copy & labels** | #1, #2, #7 front-end strings, #9 "Live edition" label | none | merged (PR #14) |
| **B — tradability** | #9 model change (every card tradable, delete the untradable concept), drop guards, spec + tests | data-changing (drop `user_cards.is_tradeable`, market RPC semantics) | **done** — KUT PR #17, ADR-033, migration `20260903000000`; deployed to hosted 2026-08-31 (VibeTrunk/supabase PR #11 + #12) |
| **C — coin-name sweep** | #7 SQL function bodies + backfill of existing messages + spec realignment | data-changing (backfill `update` on `user_notifications`) | not started |
| **D — admin economy tools** | #8 assign coins, #6 soft account reset | additive (new RPC + admin form; the reset *operation* mutates rows at run time, not the migration) | not started |
| **E — content features** | #4 Goalkeeper, #5 bibs bonus, #10 newsfeed (may split further) | mixed — newsfeed view + bibs storage + GK enum value are additive; reassigning existing players to GK is data-changing | not started |

## Open product decisions (needed before B–E)

- **#4** — GK reuses the 6 existing stats with its own offset profile, or gets a
  distinct GK stat set?
- **#5** — bibs bonus is coins only, or also a rating/OVR effect? Coin amount?
- **#6** — define "reset" as the soft reset described above?
- **#7** — confirm canonical name is "KUT Coins" and the spec is realigned.
- **#9** — ~~confirm every card becomes tradable, including starter cards, and the
  concept is deleted (not just hidden).~~ **Decided 2026-08-30:** full removal
  (starter cards included, no softer hold rule); drop the `is_tradeable`
  column outright. ADR-033.
- **#10** — newsfeed shows sales + new listings only, or also discards? Retention
  window?
