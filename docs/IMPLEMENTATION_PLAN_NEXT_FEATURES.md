# Implementation plan: the five KUT features

Prepared 2026-09-06 for a new Codex session using **5.6 Terra / High**.
**Status: ready to implement locally; no feature implementation or deployment
has been performed by this planning task.**

This is the execution guide for [SPEC_NEXT_FEATURES.md](SPEC_NEXT_FEATURES.md),
including the user's revisions to trading and post-football reports. Complete
all five slices in one continuing session. Use sequential checkpoints, rather
than stopping after each slice to ask whether to continue. The largest and
most coupled slice is reports, rewards and the versioned rating rebuild.

## 1. Start here in a fresh session

1. Read repository `AGENTS.md`, `CLAUDE.md` and `docs/README.md`; then read
   `BUILD_SPEC.md` in full, `PROGRESS.md` (newest entries at the bottom),
   `decisions.md`, recent git history, `ROADMAP.md` and `KNOWN_BUGS.md` as required
   by the repository. Do not mistake old roadmap brainstorming for this design.
2. Read this plan, [SPEC_NEXT_FEATURES.md](SPEC_NEXT_FEATURES.md) in full,
   [RATING_BALANCE_REVIEW.md](RATING_BALANCE_REVIEW.md), and the
   [screen guide](design/features/README.md). Inspect the current prototype
   and mobile/desktop PNGs before changing the UI.
3. Read `OPERATIONS.md` and `BACKUP.md` before preparing migrations. Read relevant
   installed Next.js guides in `node_modules/next/dist/docs/` before Next code;
   this project uses Next 16.3.4 and React 19, not an assumed older API.
4. Inspect `git status --short`, branch, recent history, migration filenames,
   package scripts and local tooling. Record the actual starting revision and
   existing modifications in a working execution log.
5. Run the baseline checks and establish an isolated local Supabase test
   environment (§10). Preserve existing work. Then implement slices A–E.

### Scope and authority

The user's chosen scope is the five-feature package, with simple trade
availability, a 50-coin form reward, admin completion/goal tools, excellent
mobile UX and no overflow menu. Numerical choices in the feature spec are
the concrete defaults for this implementation, not proof the user separately
approved every formula. Adopt them explicitly in implementation ADRs and
`BUILD_SPEC.md`; do not pause to re-ask settled choices or silently retune them.

The existing build spec describes shipped behavior. These planned changes
deliberately replace the specific rules identified below; all other invariants
remain in force. If current code differs materially from the inspected baseline,
reconcile the plan against the new code and record the difference before edits.

Implement and verify locally. This request does **not** authorize a remote push,
PR publication, merge, hosted database mutation or Vercel deployment. Finish the
reviewable local work and deployment notes first. Any later hosted activation
follows the existing explicit sign-off process in `OPERATIONS.md`.

### Preserve the handoff files

At planning time, the feature spec, rating review, `design/features/` and
`docs/design/features/` are **untracked**, and four existing docs are modified.
They are intentional work from this conversation. A clean checkout of the
current remote branch will not necessarily contain them. Use this workspace,
or explicitly carry the complete package into a new worktree before beginning.
Do not clean, reset, discard, or assume these files are disposable build output.

The inspected HEAD was `56d1474` (KB-009 / ADR-054). The latest local migration
was `20260915000000_activity_feed_excludes_superadmin.sql`. These are reference
points, not instructions to reset to that commit. The hosted-state paragraph in
`CLAUDE.md` can lag the actual catalogue. Allocate migration timestamps and ADR
numbers after checking the latest state; do not use today's date if it sorts
before existing migrations, and do not assume the next ADR is still available.

## 2. What must be built

| Slice | Result | Migration/contract classification |
|---|---|---|
| A | Complete frozen-edition contracts and rendering; admin empty archive; zero Special issuance | Additive scaffolding, subject to audit of existing constraints/data |
| B | Duplicate Club Value: first 100%, second 20%, third 5%, all later 0%; transparent breakdown | Data-changing formula/invariant |
| C | Basic packs cost 175, with price-aware confirmation and exact purchase replay | Data-changing price and pack RPC contract |
| D | Private wanted editions, explicitly shared owned copies, names of willing traders, copyable contact text | Additive discovery/consent contract; existing trading untouched |
| E | Member goals/kudos, one-time 50-coin completion reward, admin reports/corrections, rating v2, finalizer and recaps | Data-changing report/reward/rating contract |

Order: **A → B → C → D → E → integrated acceptance**. A establishes edition
identity for B and D; E's rating and faucet changes require C's economy review
to be repeated against the combined rules. A critical EV finding blocks hosted
activation, not completion of unrelated local implementation.

Repository policy requires separate PRs for independent migrations or
invariant/RPC changes. Preserve **five separately reviewable feature units**;
do not collapse them into a single feature PR. One working session can implement
all of them serially on a local integration branch, retaining per-slice patch or
commit boundaries for later ordered PRs. Keep shell/navigation changes with D.
Each unit must have its own ADR, migration explanation, tests and spec changes.
If making local commits, include only that unit's files/hunks and preserve
pre-existing changes. No parallel agents in the same tree.

## 3. Existing implementation map

Paths are relative to the repository root. Proposed new paths below are
implementation destinations, not files that already exist.

| Concern | Read/change these existing locations |
|---|---|
| Rules | `src/game/rating-engine.ts`, `src/game/economy.ts`, `src/game/config.ts`, `src/game/archetypes.ts` |
| Card presentation | `src/components/live-card.tsx`, `card-stats.tsx`, `src/app/globals.css`, `src/lib/player-photos.ts` |
| Collection | `src/app/(app)/club/collection/`, `src/components/album/`, `src/lib/album.ts` |
| Valuation | `src/app/(app)/club/value/page.tsx`, `src/app/(app)/leaderboard/page.tsx`, collection header and Home consumers |
| Packs | `src/app/(app)/club/packs/`, `src/components/pack-reveal.tsx`, `pack-reveal-state.ts` |
| Existing trades | `src/app/(app)/market/`, collection `market-actions.ts`, `create-listing-form.tsx`, `discard-card-form.tsx` |
| Attendance/admin | `src/app/(app)/admin/attendance/`, `admin/links/actions.ts`, `admin/accounts/`, `admin/economy/page.tsx` |
| Chronicle/home | `src/app/(app)/page.tsx`, `chronicle/`, `src/lib/chronicle.ts`, `src/lib/activity.ts` |
| Auth/notifications | `src/lib/auth/{user,admin}.ts`, `src/lib/supabase/{server,service}.ts`, `src/app/(app)/messages/` |
| Navigation | `src/lib/nav/{routes,context}.ts`, `src/components/app-shell/`, `src/app/(app)/settings/page.tsx`, admin tabs |
| Reusable UI | `src/components/{bottom-sheet,filter-bar,icons}.tsx`, existing button/form styles |
| Tests/CI | `tests/unit/`, `tests/fixtures/`, `tests/integration/`, `tests/e2e/`, `supabase/tests/database/`, `.github/workflows/verify.yml` |

Find the **latest definition** of each SQL object across all migrations, not
just its original `CREATE`. Especially preserve these amendments:

- `20260906000000_goalkeeper_archetype.sql`: latest inspected
  `_rebuild_season_core`, all seven archetype offsets.
- `20260902000000_starter_reveal_and_rating_snapshots.sql`: weekly snapshot
  table/trigger and stored starter reveal behavior.
- `20260907000000_bibs_bonus.sql`: attendance publish/correct contracts and
  forward-only bibs/attendance rewards.
- `20260904000000_canonical_coin_name.sql`: latest inspected `open_pack` body;
  keep the canonical currency copy and existing checks.
- `20260911000000_trade_offers.sql`: collection and offer projections, held-card
  guards, escrow, account reset/deletion behavior, latest listing/discard/buy RPCs.
- `20260910000000_club_value_v2.sql` plus
  `20260912000000_tester_feedback_round_2.sql`: valuation, club-name amendment,
  published sessions and corrected bibs notification wording.
- `20260913000000_chronicle_views.sql`: public Chronicle projections.
- `20260915000000_activity_feed_excludes_superadmin.sql`: retain superadmin
  exclusion when extending feed projections; don't resurrect an earlier view.

Search all callers/views/tests before changing SQL signatures. Match explicit
grants and RLS, and avoid ambiguous PostgREST function overloads.

## 4. Slice A — Special-edition scaffolding only

**Deliverable:** safe edition contracts across existing card surfaces, with
the existing Live appearance unchanged and no Special editions issued.

1. Audit `kut.card_editions` and all SQL/TS consumers. Existing schema already
   has edition type, `is_live`, seven snapshot numbers, discard multiplier,
   availability window, supply, weight, issue time and metadata. Do not recreate
   the table or add redundant versions of these columns.
2. Define a discriminated resolved-card type in a focused new game/lib module:
   Live resolves current player state; Special resolves its immutable snapshot.
   Include frozen archetype, rarity, description/context, art reference/version
   and issuance metadata needed by spec §4. Use typed columns or validated
   versioned metadata consistently; document the chosen storage contract.
3. Add only missing fields/constraints. Live snapshots remain null. Special
   snapshot/identity fields must be complete and valid; multiplier positive,
   valid availability interval and minted count within any supply cap. Invalid
   Specials fail closed rather than falling back to today's Live rating.
4. Enforce immutable frozen fields in SQL. Cover Live↔Special conversion and
   changes to player/edition identity, not just snapshot OVR. Keep future supply
   accounting distinct from immutable artwork/stats. A photo-consent withdrawal
   must still be able to remove display access without changing frozen ratings.
5. Audit `card_discard_value`, collection, listing, offer, reveal, valuation and
   edition read projections for `coalesce(snapshot, live)` leaks. Resolve by
   edition kind throughout. Keep existing view columns compatible; append fields
   where needed. Restrict internal helpers and keep private ownership private.
6. Render through the existing `LiveCard` geometry/material system. Put the
   future edition label below the card. Preserve the six Live rarity tiers;
   edition kind is not a seventh rarity. Add `/admin/editions` as the empty,
   role-gated archive shown in the design, linked through visible admin tabs.
7. Keep all pack/starter selection explicitly Live-only. Add **no** issuance RPC,
   mint/publish button, real draft row, Special seed record, or member-facing empty
   Special section. Synthetic Special data is allowed only in isolated tests,
   rolled back or cleaned up completely.

**Acceptance:** old Live renders remain the same; incomplete snapshots rejected;
frozen values remain unchanged after Live rating/archetype changes; ownership
transfer preserves the edition; member cannot mint/mutate snapshots; all pack
draws are Live; migration adds zero Special editions and zero Special copies.
Update the existing market/trade race fixtures: they currently create synthetic
Specials without all the newly required metadata.

## 5. Slice B — Duplicate-sensitive Club Value

Implement a canonical SQL valuation by `(owner_id, edition_id)` over unburned
copies. Let `D` be that edition's full server discard value:

```text
count = 0: 0
count = 1: D
count = 2: D + floor(D * 20 / 100)
count >= 3: D + floor(D * 20 / 100) + floor(D * 5 / 100)
club_value = wallet + sum(edition_contributions) + 4 * personal_live_discard
```

1. Add a pure TypeScript reference/helper to `src/game/economy.ts`. The current
   `calculateClubValue` takes only a flat list of discard values; it cannot
   identify editions. Change its input/callers explicitly to carry edition IDs
   or pre-grouped edition counts, with shared fixtures for SQL parity.
2. Implement one SQL grouped calculation reused by `my_club_value`, an own-club
   breakdown, and `club_value_leaderboard`. Rank a member's copies by
   `(acquired_at, id)` for displayed contributions; recalculate after transfer
   or discard. Never assign a permanently privileged first copy.
3. Preserve existing view field names, personal bonus, wallet weight, disabled
   account handling and club names. Listed/held copies still belong to the
   holder and count; burned copies do not. Different editions of one player
   each get their own first copy. Unique-player album counts remain separate.
4. Update Collection header, Home, value page, leaderboard and card detail
   consumers together. Add `/club/value/[editionId]` (or equivalent scoped
   detail) with the copies/weights breakdown. Show full discard payout separately
   from Club Value contribution. Project total value after removal by reranking
   the remaining group; don't subtract the selected row's display value alone.
5. Write release copy explaining why ranks may move. Migration changes
   projections only: no wallet, ownership, burn or historical ledger rewrites.
   Record a private before/after aggregate comparison for eventual rollout.

**Required examples:** five copies at `D=101` contribute `101+20+5=126`;
two contribute `121`; the fourth and thousandth add zero. At `D=100`, holding
two contributes 120, while discarding one for 100 leaves 100 in cards plus 100
coins. This limits hoarding's *card contribution*, not total realizable wealth.
Full discard value is deliberately unchanged.

**Acceptance:** counts 0/1/2/3/4/1000; low-value floor rounding; tied timestamps;
first/middle/last removal; listed/held/burned; transfer; Live repricing; frozen
Specials; unlinked personal card; reset/deletion; no private breakdown access
through leaderboard/helper RPCs; totals agree on every surface. Rollback restores
v2 projections and compatible clients, never old transactions.

## 6. Slice C — Basic packs at 175

1. Change the active basic row in **`kut.pack_definitions`**, not a nonexistent
   `pack_types` table. Assert the intended row/configuration before the scoped
   update. Mirror `ECONOMY.basicPackPrice = 175`, UI, how-it-works and relevant
   fixtures. Keep three cards, rarity weights, attendance/starter 250 and bibs
   100. Never globally replace the literal 250.
2. Extend `open_pack` with an expected-price contract and update the server
   action/client together. For a new request, compare the quote with the locked
   current pack definition before any debit/mint. A changed quote returns a
   specific recoverable result for fresh confirmation.
3. Check for a completed opening by caller/idempotency key **before** enforcing
   today's price against a replay. Return the stored original result and
   `price_paid`; don't reject or reprice an old successful opening. Audit the
   existing request lock/uniqueness behavior for concurrent same-key calls.
   Retire old signatures deliberately, or preserve a documented bounded
   compatibility path that cannot bypass the required new confirmation contract.
4. Replace `window.confirm` in `open-pack-form.tsx` with the shared styled
   dialog: cost, three Live cards, wallet after purchase, Cancel and Confirm.
   Generate/preserve one request key per purchase attempt, disable pending
   confirmation, recover uncertain outcomes using that key, and reuse the stored
   reveal route. Reconfirm only an uncompleted repriced attempt.
5. Keep historical opening prices and ledger entries intact. Add an exact,
   reproducible roster EV report using the same eligible pool and weights as SQL;
   include current, regular and mature rosters, then rerun with E's ratings.

At 175: target expected discard ≤131.25; watch above 131.25; warning >140;
critical ≥166.25. A critical real-roster result requires a separate balancing
decision before hosted activation. Missing access to the current roster means
**activation verification pending**, not a fabricated passing EV. Finish local
code/tests and record the concrete missing measurement. Do not change 175,
weights or discard payouts to make the metric pass. B's duplicate weighting
does not lower discard returns.

**Acceptance:** 174 fails without charge/mint; 175→0; 500→325; exactly three
cards and one debit; concurrent/retried same key returns one opening; stale quote
charges nothing; old 250 opening replays at 250; interrupted/reloaded reveal
doesn't purchase; no Special draws; EV status boundaries correct.

## 7. Slice D — Wants and simple trading availability

There is no reciprocal matcher, Matches tab, direct-card offer, new swap state
machine, reservation or new trading notification system. Members contact each
other through their preferred channel. Actual exchange uses current public
listings + Offers.

1. Add `card_wants` keyed by `(user_id, edition_id)`, with explicit active versus
   fulfilled state/timestamps. Cap active wants at 100 per member. Wanting an
   already-owned edition is allowed. Acquisition fulfills an active want and
   stops availability notices; selling later does not reactivate it. `Want
   another` explicitly reactivates it. Scope edition selection to member-visible
   issued editions; don't expose dormant future Special metadata.
2. Add `trade_availability` keyed to a particular owned card copy and owner.
   Cap active shared copies at 30. Only unburned, unlisted, unheld owned copies
   qualify. All opt-ins are explicit; do not automatically share duplicates.
3. Implement `set_card_want`, `set_trade_availability` using authenticated
   identity, server validation and concurrency-safe limits. Owner RLS only;
   prohibit arbitrary browser writes that bypass caps/eligibility. Serialize
   concurrent opt-ins consistently and validate the card under its ownership lock.
4. Implement `get_my_wanted_availability` as a narrow read boundary. A scoped
   SECURITY DEFINER function with fixed search path can bypass inventory RLS
   only for the caller's active wants joined to currently consented, eligible
   copies. Return edition and willing member display identity only, deduplicate
   owner/edition, sort by display name with a stable tie-breaker. Hide self,
   disabled accounts, contact details, other holdings, counts and copy IDs.
   Do not accept arbitrary lists of target users/editions for inventory probing.
5. Add centralized lifecycle cleanup for availability when a card is listed,
   held, transferred, burned or removed by reset/deletion. Recheck eligibility
   at read time too. Acquisition can fulfill wants through the corresponding
   ownership/insert hook. Lock ordering must coexist with the existing market
   RPCs; the hook must not mutate wallets or offer states. Cancelled listings
   or offers do not silently restore sharing.
6. Add Collection `Album / Manage / Wanted`, `/club/collection/wanted` and
   `/club/collection/trade-cards`. Reuse existing collection filtering rather
   than rebuild the album. Ensure specific routes don't fall through to the
   `[cardId]` page. Give the member a searchable wanted picker and named
   remove/share actions in owned-card detail/Manage.
7. On Wanted, show up to three willing members then `See all`, with Copy message.
   If clipboard fails, show selectable message text. Include the card/edition
   and a clear conversation starter; never auto-send or access external contact
   data. Explain how to list the card and use the existing Offer action and that
   the listing is public and can be bought by someone else.
8. Replace the avatar overflow/dropdown/sheet with a direct `/settings` link.
   Put visible My card, How KUT works, role-gated Admin and Sign out destinations
   on Settings; preserve the separate Messages control. Keep five primary tabs.
   Update route ownership/active-state tests for Wanted, trade cards and value
   detail. No new More menu or icon-only hidden feature actions.

**Acceptance:** exact edition matching without reciprocity; consent off removes
visibility; nonowners cannot opt in; private inventory cannot be enumerated;
cap races; zero/one/many holders; long/equal names; own/disabled accounts;
fulfilled/re-want behavior; clipboard fallback; list/hold/transfer/burn/reset
cleanup; cancelled listing needs new opt-in; existing buy/trade race tests still
pass. UI must not imply an agreed or reserved trade.

## 8. Slice E — Reports, reward, admin tools and rating v2

Build this as one coherent feature unit with internal checkpoints E1–E6. Do
not activate self-reports until the server contracts, admin correction path,
finalization, rewards and historical rebuild all work together.

### E1. Versioned data and authority

- Persist a per-season cutover football-week boundary and a rule version on
  each session. Choose the next week with no published sessions at activation;
  it must be a Monday boundary and cannot split an already-published week.
  Resolve it from actual season data, not migration filename or today's clock.
  An explicit stored boundary also governs later backdated sessions. No surveys
  or completion rewards are backfilled for legacy sessions.
- `session_surveys`: one per new-rule session, status/open/close/finalized times,
  three category IDs, persisted selection seed/version, rule version, reward
  amount (50), revision. Validate exactly three distinct allowed categories.
- `session_reports`: unique `(session_id, player_id)`, submitting user, nullable
  original goals, draft/submitted status, explicit skips, submission/update
  times and revision. Preserve the first completion time independently of edits.
- `session_kudos`: unique `(session, nominator_player, category)` **and**
  `(session, nominator_player, recipient_player)`. Foreign keys/checks and RPC
  validation enforce actual attendees and the session's categories. Draft
  nominations are private and excluded from results.
- Persist electorate player↔account eligibility and audited changes. This must
  support late linking, unlinking/relinking, attendee corrections and disabled
  accounts without duplicating a real player's ballot or reward.
- `session_report_rewards`: durable unique `(session_id, player_id)`, original
  beneficiary, amount=50 and unique ledger reference/idempotency identity.
  A soft account reset must not delete this entitlement guard. Hard deletion
  follows the existing account lifecycle without cascading away a surviving
  player's paid entitlement; use nullable beneficiary references/audit retention
  where necessary. Never transfer old payment history to a new account.
- `session_goal_overrides`: unique session/player, effective goals, reason,
  actor, timestamp and revision, plus immutable before/after audit. Absence of
  an override is different from an override of zero.
- Store caller-scoped request keys, request fingerprint and outcomes for report
  and admin goal mutations. A completed retry returns its original outcome;
  reuse with a different payload is rejected. Do not rely on browser state.
- Public read projections contain only finalized effective goals, coverage and
  qualified badges. Own report/receipt reads are private. Admin report roster
  and audit are admin-only; nomination identity is never public. Direct writes
  to reports, awards, goals, results and ratings must not bypass protected RPCs.

Use fixed search paths, explicit execute grants and enabled-user/admin checks
consistent with the existing code. Service role stays server-only. Check RLS
for both tables and views; `security_invoker` alone cannot make a projection
read data the caller is not permitted to read. Prefer a narrowly scoped result
projection over exposing raw ballot rows.

### E2. Publish, submit and pay once

1. Amend attendance publication atomically: save attendees/bibs, apply the
   existing attendance/activity rewards, then create the survey, eligible
   account mappings, fixed categories and deduplicated in-app invitations.
   `closes_at = actual publication timestamp + 24h`. A retry cannot reroll
   categories, create another survey, extend the deadline or repay attendance.
   The current publish wrapper has no request-key argument: add replay identity
   or an equivalently strict persisted payload check, rather than treating any
   date/type uniqueness error as a successful retry. Reject conflicting payloads.
   New-rule attendance payloads must not accept admin goals as rating input.
   If legacy `attendance.goals` stays required, store its compatibility zero
   internally for new sessions and exclude it from every new-rule goal query;
   a missing report still displays `Not reported`, never an asserted zero.
2. Seven categories: Team Player, Engine, Playmaker, The Wall, Difference Maker,
   Great Vibes, Level Up. Select three once by repeatedly choosing among the
   least-used remaining categories in that season, resolving ties using the
   stored random seed/algorithm version. Serialize publication at season level;
   a replay returns the stored selection. No client-generated draw.
3. `submit_session_report` takes session ID, intent (`save_draft`/`submit`),
   explicit goals or acknowledgement of a current admin override, nominations,
   explicit skips, expected revision and request key. Derive real player and
   caller from authentication/eligible mapping; never accept a target user for
   self-submission. Validate again in SQL even when server action validates.
4. Goals are integers 0–99; missing stays null. A submitted report requires an
   explicit value or acknowledgement of the current override, and nominee or
   explicit Skip for each of the three categories. No self/duplicate recipient,
   nonattendee or unknown category. All zero/all skips is valid. Draft is unpaid;
   a submitted report cannot be edited back to an incomplete draft.
5. Serialize mutations using a documented common lock order across publish,
   report, override, finalize, cancel and link correction. The inspected rebuild
   wrapper/core has **no explicit season-wide lock**: establish one, rather than
   assuming it exists. A transaction-scoped advisory lock keyed by a documented
   KUT namespace and season identity is suitable; use the same helper in every
   rating writer, including direct rebuild, archetype and session lifecycle
   callers. Audit current market/reset/profile locks before choosing the complete
   order; acquire the season lock before rows that rebuild will need. Recheck
   deadline with actual database wall-clock time **after waiting for locks**;
   a transaction timestamp taken before waiting must not allow a late save.
6. First eligible complete self-submit: replace answers, insert reward guard,
   credit caller's wallet 50, insert one `wallet_ledger` row with reason
   `session_report_reward`, record receipt and notify in one transaction.
   Constraint/ledger failure rolls back answers and money together. Updates,
   retries, new request keys, relinks, resets and remove/re-add cycles cannot
   create a second credit. Return committed completion/receipt/balance.
7. Extend ledger/event type checks and admin faucet totals for this new reason.
   Do not reuse attendance reason or pay via an unaudited server wallet update.
   Admin-entered goals, guest goals and opening a form never earn 50. Paid
   rewards are forward-only through later corrections/cancellation, consistent
   with attendance; abuse adjustment uses existing audited admin tools.

### E3. Admin roster and correction lifecycle

- Add `/admin/attendance/[sessionId]/reports`: all attendees, search and
  All/Pending/No account filters, Submitted with time/Draft/Pending/No account,
  original and effective goals/source, reward state, and visible Edit/Add.
  Pending includes eligible non-submitted members (drafts remain labelled).
  Completion is submitted/eligible linked accounts; guests are counted
  separately. Goal coverage includes reported zero and admin guest goals.
- `admin_set_session_goals`: session/player, operation set/remove, goals,
  reason 1–200 characters, expected revision and request key. Require enabled
  admin and an actual attendee of a published session. Audit old/new override,
  preserve the member's original submission and notify linked member. No kudos
  edit, fabricated completion or reward. Support entry before and after close.
- A current override wins over original goals. Member sees read-only effective
  goals and reason; can still edit kudos before close. A pending member must
  explicitly acknowledge that effective goal value to complete their own form.
  Override revision changes invalidate stale acknowledgement. Removing override
  explicitly restores original submitted value or unreported null.
- Attendance removal invalidates that player's report participation and their
  votes as nominator/recipient; retain audit/payment guards rather than destroy
  replay history. Re-add before the original deadline reuses the same identity
  and requires valid resubmission where invalidated; it is not a second ballot
  or fresh 24h window. Added/late-linked attendees can join only before close.
- After close, eligibility cannot be expanded to fabricate new ballots. An
  admin can correct/add attendee goals through the audited path. Cancellation
  removes the session from Form/age calculations; reactivation respects the
  original deadline/categories/paid entitlements and recomputes valid results.
  Never reopen an expired survey implicitly. Restore only answers still valid
  under the corrected attendance, with the event recorded.
- Audit `admin_set_profile_player`, disable/reset/deletion paths and attendance
  publish/correct/cancel/reactivate together. Unlinked or disabled users cannot
  submit. A mapping change does not move a ballot from one real player to
  another. Snapshot historical voter eligibility so later account changes don't
  silently rewrite closed football results; deliberate attendance corrections
  use the explicit replay path.
- Legacy attendance corrections retain legacy admin goals and old formulas.
  Removing goals fields from routine new-session entry must not zero historical
  goals when correcting names, attendance or bibs.

### E4. Deterministic rating rebuild and historical snapshots

Add pure v2 functions and shared SQL/TS scenario fixtures. Preserve callable
legacy functions or explicitly version their callers; don't replace old test
expectations wholesale with new numbers.

```text
Goal Form: 0/unreported -> 0; 1 -> 1; 2 -> 1.25; 3+ -> 1.5
Kudos quorum: >=3 distinct submitted nominators with >=1 valid nomination
Qualified category: >=2 distinct eligible nominators for recipient/category
Kudos Form: qualified category count 0/1/2/3 -> 0/1/1.25/1.5 (max 1.5)
Session input: min(3, Goal Form + Kudos Form)
Session order: (session_date, session_type, id), published/non-cancelled, in season
Age weights: [1, .75, .5, .25, 0] for 0..4 subsequent club sessions
Form: min(8, sum(session input * age weight) + legacy carry)
Rounded Form bonus: floor(Form + 0.5)
Live OVR: clamp(round(activity OVR + rounded Form bonus), 30, 83)
```

- Keep Activity: weekly `0.90 * previous + 14 first appearance + 3 second`,
  cap 100; Activity OVR `30 + 45 * (activity/100)^0.8`. Keep archetype offsets.
- Replace old `0.55 * form + 1.25 * min(goals,4) + hat-trick` only in new-rule
  weeks. Goals/kudos must never stack on top of that old performance input.
- Closed/finalized goals use the admin override if present, otherwise submitted
  member goals. Drafts and open-survey goals/kudos contribute nothing to ratings;
  Chronicle exposes only aggregate open progress and goal totals.
  A published open-survey session nevertheless advances the age of earlier
  contributions. Nonattendance doesn't stop age; weeks with no noncancelled
  club session don't advance it. A season boundary resets season inputs.
- Keep the existing SHO extra `min(8, 2 * effective goals in latest football
  week)` on top of the archetype/OVR-derived stat. No other category-specific
  stat nudges. A later football week resets that SHO input as before.
- Carry the preceding legacy week's Form at .75/.5/.25/0 on the first four
  new-rule sessions. No historical surveys or retroactive +50. Freeze the
  cutover version; an old-session correction recomputes the legacy fold and
  carry using the old formula, then replays subsequent new sessions.
- Fix historical projection intentionally: today's `_rebuild_season_core`
  calculates only the final state, and `capture_rating_snapshot` writes only
  `last_week_start`. That is insufficient for corrections and delayed results.
  Compute chronological per-week states, update affected historical snapshots
  from their own week-end state, then update current state. Revise the snapshot
  trigger/write ownership so it cannot overwrite a past week with today's OVR.
  Preserve old-version semantics and existing pre-cutover snapshots at rollout;
  only an explicit correction/replay changes an affected old result. Remove or
  reconcile snapshots for a now-empty cancelled week and downstream mover/tier
  projections in the same consistent replay.
- Late finalization contributes at the original session position, never as a
  fresh present-day boost. Recompute current state and affected Chronicle/week
  snapshots atomically under the shared season rebuild lock introduced here.
  Never modify frozen Specials, past sale prices, pack prices or any historical
  wallet ledger.

Golden cases: isolated +3 gives 3/2.25/1.5/.75/0; four max sessions give 7.5
Form and rounded +8; goals-only max gives 3.75; six distinct supporters are
needed for one recipient to qualify in all three categories. Attendance spans
45 of 53 possible OVR points above baseline (~85%), Form 8 (~15%); this is a
range comparison, not a claim that 85% of every player's current rating comes
from attendance. Existing temporary SHO/OVR/discard effects remain in the audit.

### E5. Finalization and notifications

- `finalize_session_surveys(batch_limit)` is service-only, clamps a bounded
  batch, finds candidate seasons, acquires the shared season lock first (try-lock
  and skip busy seasons), then claims due surveys with `FOR UPDATE SKIP LOCKED`.
  Do not lock a survey and then wait on a season lock held by a submit/correction
  waiting on that survey. Revalidate deadlines/eligibility and ballots after
  claiming, compute finalized result rows, replay affected seasons and write
  deduplicated result notices.
  Commit a consistent season batch; no public partial result or reward replay.
- Schedule every five minutes through the shared database operator's scheduler
  configuration. Keep scheduler installation separate from runtime client code;
  never assume Vercel Hobby supports this cadence or install an extension into
  other schemas casually. Local tests can call the worker directly.
- Add a bounded server-only fallback used on report/Chronicle loads. It must
  first establish the member can access the relevant session and must not expose
  an unauthenticated service-role rebuild endpoint. Rate-limit/coalesce repeated
  calls and limit work; avoid a full-season rebuild on every ordinary page load.
- Close submissions by DB time even if the job is down. UI state then reads
  `Reports closed · results are being prepared`. Worker retry repairs results,
  not the deadline. Record successful heartbeat and attempts/failures; failure
  logs need a separate durable transaction/job wrapper so rollback doesn't
  erase the only evidence of failure. Do not store ballot content in logs.
- Admin goal/attendance correction after finalization increments result revision
  and recomputes; notifications use member/session/revision identity and do not
  resend old publication invitations or coin rewards.

### E6. Member/admin screens and read surfaces

Suggested new member route: `/sessions/[sessionId]/report`, with server actions,
read loader and a focused client form in that directory. Existing `/sessions`
routes redirect to Chronicle: preserve those links while giving the new report
route its own auth/eligibility guard. Home owns this report route in primary
navigation. Add only focused shared modules such as `src/lib/session-reports.ts`
and pure report/rating helpers; don't put database rules into a large UI file.

- Home and Messages deep-link to the relevant form. Multiple open sessions get
  distinct links/deadlines; no ambiguous single global draft.
- One mobile form: initially unanswered goals, 0–5 shortcuts, editable numeric
  input for every 0–99 integer, inline confirmation for ≥10, and three category
  rows with teammate pickers or explicit Skip. Keep raw input string until save
  so clearing the field does not turn into zero.
- Preserve input across picker open/close and failed save. Draft is explicit;
  no hidden autosubmit. Show Submit and earn 50, server-confirmed success and
  wallet, then Edit report with 50 already received. Don't optimistically award
  coins. A stale-revision conflict shows the server version and a clear path
  to review/retry, not silent last-write-wins.
- Teammate picker excludes self, disables an already-chosen recipient with a
  reason, supports search, Skip, keyboard, focus return and mobile scrolling.
  No vote counts or provisional totals.
- Admin routine attendance is date/type/attendees/bibs only for new rules;
  Reports provides completion and goal editing. Preserve an explicit legacy
  correction experience where old goals remain required source data.
- Chronicle shows **Reported goals**, goal coverage, qualified positive badges
  in alphabetical player order, and Form explanation. Never claim an incomplete
  goal sum is the match score. Low turnout has the specified neutral message.
  Update `chronicle_weeks`, published-session projections and all goal consumers
  so they don't keep summing stale `attendance.goals` for new-rule sessions.
- Update card detail/rating history, Home risers, how-it-works, notification
  presentation and admin economy totals. Clearly explain expiring temporary
  Form; don't retain copy claiming ratings can fall only due to absence.

## 9. UX acceptance shared by every slice

Use the exact current Clubblad tokens/fonts/components, and the revised
prototype for layout/interaction intent. Reference screenshots are a visual
contract, not production markup or a source of fake data. Do **not** copy
`prototype.js` into the application or substitute its fixture math for RPCs.

Required screens: Wanted, wanted picker/empty, My trade cards, trade help,
Home report prompt, report/picker/error/closed, saved receipt, Chronicle recap,
admin attendance, admin reports/filter states/goal correction, packs/confirmation/
insufficient, Club Value/copy breakdown, admin Editions empty, Settings direct
destinations. Include real loading, error, stale and permission states.

Check 320/360/390/430/768/1440px, with 390×844 as the main reference. No document
horizontal overflow. Two-column cards where shown; 20px gutters (16px at 320);
52px primary buttons, 44px other targets, 16px inputs; long names/balances wrap.
Preserve the 5:7 card geometry, actual typography and six-attribute layout.

Keyboard and screen-reader checks: labelled controls, `aria-current`,
`aria-pressed`, error-summary focus, status announcements, dialog focus trap and
return, Escape, body-scroll lock, 200% text and reduced motion. Use `100dvh`
and safe areas for mobile dialogs. Bottom navigation needs reserved space;
editable forms must remain usable with the keyboard open. One actual submit
button, no overlapping duplicate sticky action. No overflow menu anywhere in
the new journeys, including the existing avatar control being replaced.

Inspect screenshots from the **real local app with seeded users**, side by
side with the design. Prototype no-overflow tests alone do not verify production
queries, permissions, actual dialogs or mobile keyboard behavior.

## 10. Local setup and verification

Existing commands, run separately in PowerShell:

```powershell
npm run verify:fast
npx supabase start
npx supabase migration up --local
npm run test:db
npm run test:market-race
npm run test:e2e
npm run build
```

Reuse installed dependencies when present; use the lockfile with `npm ci` if
needed. CI currently uses Node 24. Do not upgrade frameworks or add a broad
component/test library for this work. Supabase local ports are 54321 (API),
54322 (Postgres), 54323 (Studio). Use an isolated local stack/fixtures; no hosted
DB for tests. Do not reset existing local data to fix migration errors.

Read only necessary environment variable names/host classifications, never
print secrets. `.env.local` may point at hosted Supabase: explicitly override
the app/test process with local URL and local keys. Check both HTTP and Postgres
targets for localhost before seeding/mutating fixtures. Preserve any existing
environment file. Keep service credentials out of client bundles, logs and git.

### Add meaningful coverage, not only happy-path render tests

| Layer | Required additions |
|---|---|
| Pure unit/fixtures | Edition resolution, grouped value, report completeness/validation, v1/v2 full-season fixtures, kudos thresholds, versioned decay, cutover/SHO, routes, exact EV |
| pgTAP | Edition constraints/immutability; value parity/privacy; quoted pack replay; wants consent/caps/lifecycle/RLS; reports/rewards/overrides/deadline/finalize/rebuild/privacy; legacy regression |
| Concurrent real connections | Same-key pack opens; report same/different keys pay once; member edit vs admin override; save waiting past deadline; submit vs finalize/cancel/relink/reset; availability vs list/transfer; existing market/trade races |
| Authenticated Playwright | Local fictional member/admin/guest roster, full wants journey and listing handoff, report zero/skips/draft/reward/edit, admin guest/add/correct, closed results, pack174/175/replay, duplicate breakdown, role denial and mobile layouts |
| Production build/visual | Full lint/type/unit, app build, real-app screenshots/accessibility checks, font/card comparison |

`test:market-race` already discovers **all** `tests/integration/**/*.test.ts`
through `vitest.market-race.config.mts`, despite its narrow name. Add the new
concurrency files there or rename/add an alias coherently. These tests are not
included in `verify:full` today; run them explicitly and wire them into the
appropriate local-DB CI job. Check the existing `KUT_LOCAL_DATABASE_URL` before
running: fixtures perform writes and cleanup.

Existing Playwright tests mostly verify unauthenticated redirects, and their
fallback publishable key is a placeholder. Add a distinct authenticated local
fixture/configuration with real **local** auth keys and seeded fictional users;
do not present the existing login-boundary suite as proof new journeys work.
The current database CI excludes Auth/PostgREST, so authenticated E2E needs a
full local API/Auth stack in its job (or a dedicated job), while pgTAP/race tests
can use direct Postgres. Keep the existing fast unauthenticated suite runnable.

Regression fixtures must include Monday+Friday and weekly-only sessions,
out-of-order publication, delayed finalization, an empty/cancelled week, exact
close boundary, Europe/Amsterdam DST, old-week correction, guest late-link,
disabled/unlinked members, repeat cancellation/reactivation and account resets.
Verify SQL/TS per-week snapshots and final state, not just final OVR. Assert
ledger sum/uniqueness, owner conservation and zero duplicated attendance/bibs.

Run targeted checks after each slice, then the integrated full suite once the
five slices pass. Re-run broader suites only for new changes/failures or
unresolved concerns. Docker/browser/network unavailability must be recorded as
an unrun check; finish unaffected work, and do not label unverified money/rating
changes production-ready. Use the supported Browser skill when available for
interactive inspection; follow its workflow. Installed Playwright can support
automated screenshot/tests when appropriate.

### Design artifacts and preview recovery

Durable references are `design/features/` and `docs/design/features/`.
The prior loopback server at port 4173 and ignored `test-results/design-preview`
are conveniences, not dependencies. Filesystem HTML links can open source in
the editor; view the PNGs or serve the artifacts in a browser instead.

To recreate the preview, copy **only** these two artifact directories into an
ignored staging root, then serve that root bound to loopback. Do not serve the
repository root (which may contain environment files):

```powershell
$kutPreviewRoot = Join-Path (Get-Location).Path 'test-results/design-preview'
New-Item -ItemType Directory -Force -Path (Join-Path $kutPreviewRoot 'design') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $kutPreviewRoot 'docs/design') | Out-Null
Copy-Item -LiteralPath 'design/features' -Destination (Join-Path $kutPreviewRoot 'design') -Recurse -Force
Copy-Item -LiteralPath 'docs/design/features' -Destination (Join-Path $kutPreviewRoot 'docs/design') -Recurse -Force
Start-Process python -ArgumentList @('-m','http.server','4173','--bind','127.0.0.1') -WorkingDirectory $kutPreviewRoot -WindowStyle Hidden
```

First check whether port 4173 already serves the current gallery; reuse it if
so. Open `http://127.0.0.1:4173/design/features/index.html` and
`http://127.0.0.1:4173/docs/design/features/overview.png`. Old swap/matching
artboards are superseded; only the current gallery/screen guide governs.

`build-assets.mjs` currently needs the existing `.next` font cache/hashes to
re-export actual components; delivered assets already work without regeneration.
`check-rating-balance.mjs` compares against the current legacy rating exports:
retain that baseline or update the audit to call explicit v1 exports after E.
Don't regenerate a misleading comparison where both sides use v2. Prototype
verification (72 layout checks, 13 interaction groups) is prior design evidence,
not a test result for the implementation.

## 11. Migrations, adoption and eventual activation

For each slice, allocate fresh ordered SQL filename(s) and a distinct ADR from
the actual current catalogue. Do not edit already-applied migrations. Prefer
additive fields/compatible projections first, explicit contract replacement
second, and no automatic historical data rewrite. Explain each constraint,
grant, function replacement and any data-changing statement in migration notes.

Update relevant `BUILD_SPEC.md` sections as each slice is adopted: edition
model/rendering; Club Value; packs/confirmation; wants/privacy/navigation;
attendance/report/goals/kudos rules; RPC contracts; central constants (§145)
and affected Part L invariants. Document the new +50 faucet explicitly. Add
dated progress entries with implemented/tested/deployed distinguished. Update
roadmap status only for completed local implementation, and never say hosted
until actually deployed. Retain design docs as design references.

Prepare a per-slice operator handoff in `docs/OPERATIONS.md` or a linked release
document: migration names/order/classification, compatible app version,
preflight queries, local results, rollback SQL/forward recovery and hosted
status. Hosted catalogue parity, dry-run, backups and real apply occur only
through `VibeTrunk/supabase`, following `OPERATIONS.md`. Do not silently modify
another checkout or assume this session can allocate a globally unused number
without later catalogue verification.

| Activation gate | Required evidence / recovery |
|---|---|
| A | No existing incomplete Special data; zero new issuance; snapshot constraints compatible with current rows. Rollback code/contracts without deleting future audit data. |
| B | Private aggregate before/after CV/rank comparison, matching projection/client fields. Restore v2 views to revert rankings; don't touch wallet/history. |
| C | Current actual-roster EV and combined E scenarios; historical replay passes. Revert future pack price/quote UI together if necessary; never refund/reprice old openings automatically. |
| D | RLS/privacy and lifecycle/race checks. Stop new sharing/discovery if needed while keeping existing listing/offer engine operational. |
| E | Unpublished-week cutover selected, service worker/scheduler and fallback tested, heartbeat observable, SQL/TS history parity and reward races pass. Disable new report entry/finalization coherently if needed; preserve ballots/overrides/ledger/guards for audited forward recovery. Do not drop/recreate reward tables or silently switch existing v2 sessions back to v1. |

175 packs plus completed reports give 300/175 = 1.714 packs per session before
discard, versus the former 250/250 = 1. This is 71.4% more long-run purchasing
capacity, not a measured inflation estimate. Treat the combined economy gate
as real. The rating audit establishes bounds and relative strengths, not proof
of how members will nominate people; prepare a review after several
real sessions without automatically retuning anything.

## 12. Completion record for the build session

Maintain a compact execution record as work progresses so context compaction
or a resumed session doesn't restart completed work. Record actual filenames,
ADRs, migration names, test commands/results and unresolved items. Do not check
off this template based only on the design tests.

- [ ] Baseline and existing work preserved; local-only test targets verified.
- [ ] A complete: frozen edition contracts, exact Live rendering, zero issuance.
- [ ] B complete: canonical duplicate valuation and consistent private breakdown.
- [ ] C complete: 175 purchase/quote/replay behavior and reproducible EV report.
- [ ] D complete: wants/consent/discovery/cleanup, contact handoff, no overflow.
- [ ] E1–E3 complete: reports, exactly-once 50, admin/guest/correction lifecycle.
- [ ] E4 complete: legacy/v2 parity, cutover, SHO, chronological snapshots.
- [ ] E5–E6 complete: finalizer/observability, member/admin/recap journeys.
- [ ] Unit, pgTAP, concurrency, authenticated E2E, build and visual gates recorded.
- [ ] Five reviewable feature units, ADRs/build spec/progress/roadmap updated.
- [ ] Hosted activation dependencies and per-slice recovery notes concrete.

Final build-session response should state what is implemented, exact test
results, any genuine unrun checks/activation blockers, where the changes can
be reviewed, and whether anything was pushed or deployed. Do not stop with a
second implementation plan, mark stubs as complete, or claim the gallery is the
implemented application.

Use [START_NEXT_FEATURES.md](START_NEXT_FEATURES.md) for the copy-paste prompt.
