# Critical invariants (Part L)

These must never be violated. Copied verbatim from `BUILD_SPEC.md` §162 (Part L)
when that spec was archived (process reset S6); the full spec is readable with
`git show docs-archive-2026-10:docs/BUILD_SPEC.md`. Change an item only with an
ADR and its own PR. `docs/PRODUCT.md` names the items that apply to each area.

1. A Card Copy has at most one current owner.
2. A burned Card Copy cannot be owned/traded again.
3. A market listing can complete at most once.
4. Wallet balance never goes below zero.
5. Every wallet change has a ledger entry.
6. A pack result cannot be rerolled by refreshing.
7. A pack cannot mint cards without its matching debit.
8. Starter grant happens at most once per account, except an explicit audited admin reset (ADR-035).
9. Attendance reward happens at most once per Player/session.
10. Client cannot choose pack results.
11. Client cannot choose discard payout.
12. Client cannot directly set OVR.
13. Live copies of the same Player show the same current stats.
14. Special Card stats never change after issue.
15. A cancelled/no-game week does not decay Players.
16. Season rebuild is deterministic.
17. Normal user cannot edit attendance.
18. Service-role secret never reaches browser.
19. Invite token can be claimed at most once.
20. Card ownership changes only through a server-authoritative transaction — `buy_listing` or `respond_to_trade` (accept). ADR-033 retired the former "untradeable card cannot enter the market" invariant; ADR-042 added the trade-offer accept path.
21. Bibs bonus is a bounded faucet: at most once per `(session, Player)`, never re-paid on a correction of the same washer (ADR-037).
22. Trade-offer escrow is conserved (ADR-042): coins/cards offered are removed from the proposer at propose time and are either returned in full (reject / withdraw / expire / listing gone) or transferred atomically on accept — never both, never neither. A `held_by_offer_id` card cannot be listed, discarded, burned, or re-offered.
23. An accepted trade offer is never written to `market_sales`, so it never affects Reference Value (ADR-042).
24. An injury check-in protects at most one (Player, football week), pays its stipend at most once, and protects only a week in which that Player made zero appearances (ADR-082).
25. A Midweek Madness tournament is simulated at most once and its stored result never changes: a void hides it, never recomputes it. A tournament only moves forward (`open` → `skipped`, `simulated` or `void`; `simulated` → `complete` or `void`), and squads are immutable after the lock (§44.8, ADR-095). Its lock and its clock (`schedule_version`) may move only while it is open, and the times stored at the lock (each match's start and end, each event's time) never change (ADR-104).
26. A Midweek Madness win pays at most once per (tournament, round, member), only for a win in the stored bracket at its round's amount, and one tournament pays any member at most `MIDWEEK_CHAMPION_TOTAL`. A week is paid exactly when it completes, so a paid week cannot be voided (§44.7, ADR-096).
27. Only the Midweek open step changes a Player's archetype without the member or an admin, and only an active, collectible Player with no linked account, once per opened week, drawn from that week's seed and logged. A rotation never changes OVR and never stamps the archetype cooldown (§44.2, ADR-110).
28. A Midweek prediction is made only by a member already out of that week, only before the match's kick-off and once both matches that feed it have ended, and only for one of its two managers; no refusal gives away a result before its match has ended. Correct predictions pay once per (week, member), at the week's rate, at most 30 coins a night, at the payout, and never take a member's night past `MIDWEEK_CHAMPION_TOTAL` (§44.7, ADR-118).

Every coding agent should treat this section as a regression checklist.
