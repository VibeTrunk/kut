# KUT roadmap

Everything **not yet built**, in one place. For the rest:

- what has shipped → `PROGRESS.md` (dated log)
- why each decision was made → `decisions.md` (ADR log)
- open defects in shipped behaviour → `KNOWN_BUGS.md`
- the canonical spec, including its own Phase 2–4 scope → `BUILD_SPEC.md`
- raw tester feedback and how each item was triaged → `TESTER_FEEDBACK_BATCHES.md`

## Five-feature design package — 2026-09-05 → **all five shipped 2026-09-06**

**Status: shipped.** All five features below were built and deployed to hosted
on 2026-09-06 (migrations `20260916000000` … `20260920090000`, plus ADR-063's
`20260922000000`). `BUILD_SPEC.md` and the ADRs are canonical for their live
behaviour; the table is kept as the record of what was designed, and the design
documents moved to `archive/` — where they disagree with the spec, the spec
wins. The [interactive gallery](../design/features/index.html) and
[rendered screen guide](design/features/README.md) are the mockups as designed,
not the shipped UI.

| Feature | Shipped as | Design proposal |
|---|---|---|
| Wanted cards and trade availability | ADR-058, `20260919000000` | Revised 2026-09-06: private wants plus explicitly shared copies; show who is open to trading and encourage direct contact through any channel. No reciprocal matching or new escrow flow. |
| Special-edition scaffolding only | ADR-055, `20260916000000` | Frozen edition contracts/rendering/constraints, dormant integrations, an admin empty archive; zero Special rows/copies and Live-only packs. |
| Attendance + goals + kudos | ADR-059/060/063, `20260920000000` | Members self-report within 24h and earn 50 KUT Coins once for completing the form (zero/skips valid). Admin sees completion, corrects submitted goals and records goals for accountless attendees. Balance review in `RATING_BALANCE_REVIEW.md`. |
| Basic pack price 175 | ADR-057, `20260918000000` | Three Live cards, same weights and attendance reward; actual roster expected-discard-value check required before activation (§6). |
| Duplicate-sensitive Club Value | ADR-056, `20260917000000` | Per-edition copy contributions 100%, 20%, 5%, 0% thereafter, with transparent breakdown and unchanged full discard payouts (§7). |

The package resolved the older brainstorm's open questions. Note the goal-Form
cap it proposed (+1.5) still stands, but the kudos ladder and combined cap were
raised afterwards by ADR-063 (0 / 1 / 1.5 / 2 and +3.5 combined). The older
discussion below is retained as rationale, not a second conflicting instruction.

## Status vocabulary

- **idea** — raised, not yet evaluated or committed
- **favored** — the direction is endorsed; needs an ADR + spec change before build
- **planned** — agreed in principle, waiting for a slot or a design
- **specified** — the design is settled and written down; needs its ADR +
  spec change at build time, but no open product questions remain
- **blocked** — needs a product decision or an ADR before it can start
- **partial** — some of it shipped; the open remainder is described
- **shipped** — built and deployed; `PROGRESS.md` and the ADR log are canonical
- **declined** — considered and deliberately not doing; the reason is stated

## Real-life play → ratings: attendance backbone + goals + kudos survey

**Status: shipped** (ADR-059, ADR-060, ADR-063). Published attendance opens a
24-hour self-report survey for goals + three deterministically chosen kudos
categories; a completed form pays 50 KUT Coins once; qualified kudos score
0 / 1 / 1.5 / 2 Form, goals 0 / 1 / 1.25 / 1.5, combined per-session input
capped at 3.5 and v2 Form at 8; a per-season published-week cutover preserves
legacy history; finalization is a bounded service-role worker (with the ADR-061
lazy fallback) that writes versioned results, rating snapshots and per-player
notifications. Live behaviour is in `BUILD_SPEC.md`'s "Implemented feature
amendments" and `RATING_BALANCE_REVIEW.md`. The brainstorm below is the
original proposal, kept for history — its open questions are answered by the
ADRs and its cap figures predate ADR-063.

### Design principle (as proposed — recorded, not adopted as gospel)

- KUT may reward behaviour that makes TFH more fun, but must **never become a
  disguised ranking of football ability.**
- *"KUT rewards showing up above everything else, and additionally rewards
  positive contributions to the evening — not just football ability."*
- **Playing badly never subtracts points.** A rating can fall only from not
  showing up — never because other people judged someone's play. No
  downvotes, no "who played badly", no ratings out of 5/10, no
  best-to-worst ranking.
- Not being nominated is not a punishment — that player still showed up,
  played, and keeps their normal attendance progression.

### OVR weighting

- Roughly **75–80% of OVR** stays driven by attendance (permanent
  progression, as today).
- **No more than 20–25%** comes from what happens while playing, and that
  part rewards **positive contributions only**.
- Keep it deliberately shallow — do **not** start recording saves, tackles,
  assists, possession loss, clean sheets, etc. ("no Opta Haarlem").

### Goals → Form (diminishing returns)

Goals feed a temporary **Form** boost, not permanent OVR:

| Goals in a session | Form |
|---|---|
| 1 | +1.0 |
| 2 | +1.5 |
| 3 | +1.75 |
| 4+ | +2.0 (cap) |

> Discrepancy to resolve in the ADR: the summary the proposer settled on caps
> **goal Form at +1.5**, not +2.0. Pick one.

### Kudos survey → Form

After a session, each attendee may **nominate** other players in positive-only
categories. Proposed categories:

| Category | For |
|---|---|
| **Team Player** | played well with others, involved teammates |
| **Engine** | kept running, working, participating |
| **Playmaker** | created chances or made others play better |
| **The Wall** | strong defensive work or goalkeeping |
| **Difference Maker** | a noticeably positive impact on the game |
| **Great Vibes** | contributed to the relaxed, friendly TFH atmosphere |
| **Level Up** | played noticeably well **relative to their own usual level** |

Two candidate scales — the ADR picks one:

- **By raw kudos count:** 0 → +0; 1–2 → +0.5; 3–5 → +1; 6+ → +1.5 (cap).
- **By distinct categories (proposer's preference):** 1 category → +0.5;
  2 → +1; 3+ → +1.5 (cap). Rewards breadth of recognition, so a striker with
  three goals doesn't also sweep the kudos jackpot; a keeper might get
  The Wall + Team Player, a less technical player Engine + Great Vibes.

### Optional: kudos / goals also nudge card attributes

Cards already carry PAC/SHO/PAS/DRI/DEF/PHY. Not everything has to move OVR —
some recognition could shape the attribute mix instead, so a card reflects
*what kind of player* someone is:

- Goals → **SHO**
- Playmaker → **PAS / DRI**
- The Wall → **DEF / PHY**
- Engine → **PAC / PHY**
- Team Player, Great Vibes → small **OVR / Form** bonus
- Attendance → remains the main **OVR** driver

Whether this attribute layer is in v1 or deferred is an ADR question.

### Form decay

The combined per-session Form boost **fades over the next 3–4 playing
sessions**, so a great evening spikes a player temporarily but never makes
them permanently "a better player". Exact curve (and whether it reuses the
existing Form Score decay in `BUILD_SPEC.md` §13) is an ADR question.

### Preferred end state (proposer's summary)

- Attendance = the main source of **permanent** OVR progression.
- Each session adds a **limited, temporary Form boost**:
  - Goals: **max +1.5 Form**, strongly diminishing.
  - Kudos: **max +1.5 Form**, from positive nominations across categories.
- Form then decays over the next 3–4 sessions.

### Automation flow (minimise admin)

1. **Manual:** admin processes the sign-up list and marks who attended.
2. Every attendee is automatically sent a survey; it stays open **24 hours**.
3. Survey asks: **how many goals did you score** this session.
4. Survey asks the player to **nominate players in 3 kudos categories**; the
   3 categories are **randomised per session** (from the 7 above).
5. After 24 h the survey **auto-closes**, results are **published**, and the
   per-player Goals + Kudos Form is processed.

Steps 2–5 are intended to be fully automated (mirrors the existing
`expire_trade_offers` / attendance-reward server-authoritative pattern).

### Open questions for the ADR

- Goal-Form cap: **+2.0** (step table) vs **+1.5** (summary).
- Kudos scale: **raw count** vs **distinct categories**.
- Is there a **combined** Goals + Kudos Form cap, or do they stack to ~+3–3.5?
- Exact Form-decay curve over 3–4 sessions.
- How "75–80 / 20–25" maps onto the existing Activity-based Overall + Form
  architecture (§11–14): is the in-play part **purely temporary Form**, or
  also a small permanent component?
- Goals: **self-reported** in the survey vs **admin-entered** (an optional
  goals field already exists on `publish_attendance_session`).
- Anti-abuse: collusion / vote-trading, self-nomination block, minimum
  turnout before kudos count, per-nominator category limits.
- Randomised 3-of-7 categories per session — does every category still get
  roughly even coverage over a season?
- Is the PAC/SHO/… attribute-nudge layer in v1 or later?

## Tester-feedback ideas

Raw triage (who asked, de-duplication, disposition) lives in
`TESTER_FEEDBACK_BATCHES.md`. The items carried forward:

| Item | Status | Notes / next step |
|---|---|---|
| Rating-history backfill | idea | The graph itself shipped 2026-09-02 (ADR-047) with **no** backfill, so each player's series starts at one or two points and accumulates weekly. `BUILD_SPEC.md` §10 guarantees a season is rebuildable from published sessions, so a deterministic backfill of `player_rating_snapshots` remains possible if the sparse start proves unsatisfying. Data-changing; needs an ADR. Design note in `archive/SPEC_ALBUM_CHRONICLE_GRAPH.md` §7. |
| See other members' squads / teams | blocked | Needs a card-ownership privacy decision + an ADR — the codebase deliberately hides who owns which card (`my_collection_cards` is owner-scoped; `player_directory` hides who claimed a player). Build sketch in ADR-044 / `TESTER_FEEDBACK_BATCHES.md` round-2 💡03. The **admin** view of a member's cards under "Admin tooling" below is a separate, operator-only item and does not unblock this one — admins already hold an `admins read all cards` RLS policy, members do not. |
| Duplicate copies weigh less for Club Value | shipped | Shipped 2026-09-06 (ADR-056, migration `20260917000000`): per-edition copy contributions 100% / 20% / 5% / 0%, via `kut.duplicate_edition_contribution`, with the breakdown on `/club/value`. Full discard payouts unchanged. The constant behind the ladder is `ECONOMY.duplicateEditionWeights` (ADR-064). |
| Prestige + collections — hand in N cards for a reward | idea | Two related card-sink mechanics: a permanent cosmetic medal for turning in 30 distinct cards; themed sets (e.g. ≥80% of a session's attendees) handed in for a coin payout. New tables + a sink and/or faucet + UI. `BUILD_SPEC.md` Part XXXV already sketches collection challenges. |
| "Store" instead of "Packs" | idea | Rename the section and add variety: multiple pack types, sub-250-coin items, cosmetics that pimp your personal card. Today there is one 250-coin basic pack. New product surface + a cosmetics model; ADR + migration. |
| Player / Team of the Season ("TOTS" = Terrible of the Season) | idea | End-of-season award from most team-of-the-week appearances / most goals, plus a Team of the Season XI. Season-boundary aggregation over existing snapshot + goal data; no economy change if purely cosmetic. |
| Coin-generating dimension — mini-game or PvP on card collections | idea | Large: a new subsystem with its own tables and a new coin faucet to balance against the Part L invariants. Recorded in the spec as "Future idea 1". |
| Peer / performance scoring beyond goals — assists, defensive play, post-game survey, 1–5 player ratings, goalie saves, goal reward scaled by player count | partial | The **"Real-life play → ratings"** design for this round-3 cluster shipped 2026-09-06 (ADR-059/060/063): attendance backbone, diminishing-returns goals and a positive-only post-game kudos survey. **Open remainder:** assists, defensive play, 1–5 player ratings, goalie saves and scaling the goal reward by player count — none of these has a design, and each would need its own ADR. |
| Distinct goalkeeper stat set (handling / reflexes / …) | idea | ADR-036 shipped a goalkeeper archetype that reuses the six outfield stats with an offset. A true GK stat set would rewrite the card component and every attribute projection — deferred as the "hard" variant in the round-1 triage. |
| Market auctions | idea | ADR-042 added fixed-price listings + escrow trade offers; ADR-072 let the seller choose a 24- or 72-hour window. A timed ascending auction is still a separate mechanic. |
| Weather bonus — extra coins for rain / snow / freeze / >25 °C | idea | No weather data source today. |
| In-app FAQ | idea | There is a "How KUT works" page; a short FAQ is a smaller, distinct surface. |

## Product-fit ideas

New ideas identified during roadmap review. They are deliberately **not scoped** and need an ADR before implementation; in particular, none may weaken the card-ownership privacy stance or add an unbounded coin faucet.

| Item | Status | Notes / next step |
|---|---|---|
| Wanted-card lists and trade matching | shipped | Shipped 2026-09-06 (ADR-058, migration `20260919000000`): private wants plus copy-level availability at `/club/collection/wanted`, showing who is open to trading and a copyable message to start the conversation. Deliberately no reciprocal matcher, no new offer target and no new notification machinery — agreed trades complete through the existing Market/Offers routes. |
| Session Recap / "TFH Chronicle" | partial | v1 shipped 2026-09-02 (ADR-049, migration `20260913000000`): one issue per football week at `/chronicle`, matchday reports plus tier crossings, member-only. The **kudos & goals** block then shipped 2026-09-06 with member reporting (ADR-059/060): each matchday report now renders reported goals, recognised kudos categories and survey progress. **Open remainder** (`archive/SPEC_ALBUM_CHRONICLE_GRAPH.md` §4.4): the **club desk** block for the week's sales, listings, trades and pack opens — all already in `kut.activity_feed`, so it is a rendering job, not a data one. The issue layout still reserves room for it. |
| Opt-in community collection goals | idea | A TFH-wide seasonal album or themed goal that members can contribute toward while retaining their own cards. Completion unlocks a cosmetic club-wide badge, card frame, or Chronicle moment — **not** coins, packs, ratings, or ownership disclosure. This complements the personal Panini album and collection challenges; needs opt-in contribution semantics, a privacy-safe aggregate-progress design, and an ADR. |
| Market "My listings" tab | idea | Raised by the 2026-09-05 navigation audit and deliberately not built with ADR-053. Market now has `Buy` / `Offers` section tabs; a third **My listings** tab would show everything you currently have up for sale. Today a listing is cancelled from its card in the Collection, which works, but there is no single view of your own active listings. `kut.my_collection_cards` already carries `active_listing_id` and `active_listing_price`, so it is a filter over data the Collection already fetches — no new query shape, but it is new scope and a product decision about whether the Collection or the Market owns that job. |

## New candidate additions — 2026-09-08

All items in this section have **idea** status. They were selected as
high-potential additions during a roadmap review, but they are not committed
features and have not had their product rules, economy effects, privacy model
or implementation scoped. Each needs an ADR before implementation; anything
that changes a game rule or public contract also needs a `BUILD_SPEC.md`
update.

### KUT Matchweek Drop

**Status: idea.** Turn the end of a football week's reporting cycle into a
recognisable reveal moment rather than letting the results appear silently
across several pages. A short sequence could reveal attendance and goals,
kudos, rating movements, tier changes, and selected Chronicle / club-activity
moments, then lead into the permanent Chronicle issue. It should present data
KUT already calculates rather than introduce another scoring system.

Open design questions include what triggers a Drop after automatic or early
survey finalization, whether it is watched once or can be replayed, which
events deserve inclusion, and how the experience remains quick, accessible
and respectful of reduced-motion preferences.

### My KUT Season / KUT Wrapped

**Status: idea.** Give each member a personal, narrative view of their season:
appearances, goals, kudos categories, starting/current/peak OVR, rarity
promotions, notable cards, collection progress, and trading or pack-opening
moments. It could have a live in-season form and a richer end-of-season
"Wrapped" summary with a shareable final card. This is distinct from the
generic season history listed under Phase 2: the point is the member's own
story, not merely an archive of seasons or standings. It should initially be
a read-only interpretation of existing facts, without attaching new coin or
rating rewards.

### Card-copy identity and provenance

**Status: idea.** Make an individual Card Copy feel like a collectible object
rather than an interchangeable row. Candidate details include a stable serial
number, mint date and source, matchweek or pack of origin, original-starter
status, and an ownership / trade count or timeline. Preserve the existing
card-ownership privacy stance: provenance may be anonymous, and previous owner
names must not be exposed without an explicit privacy decision. Decide whether
history can be reconstructed accurately for existing copies and whether any
provenance marker is purely cosmetic by default; it must not silently change
OVR, discard value, pack odds or Club Value.

### A good start for new players

**Status: idea.** Give a genuine newcomer a fair, enjoyable start after the
club and economy have already progressed. This deliberately records only the
product goal, **not** a guided mission or onboarding-quest system. More thought
is needed about what bounded advantages a newcomer could receive, how long
they last, and what positive advantage an established member could receive
for welcoming, trading with, gifting to or otherwise helping the newcomer.
Possible mechanisms are inputs for design, not adopted rules.

Any design must be tied to the real invited Player/account so it cannot be
farmed through alternative accounts, must not permanently disadvantage
existing members, and must not create an unbounded coin or card faucet. It
should also be designed together with the academy / card-eligibility concept
below: an attendee who has not yet qualified for a full card and an established
Player who has only just claimed an account are different newcomer cases.

### Shareable cards and matchweek posters

**Status: idea.** Generate polished, club-branded images that a member may
choose to download or share: their current Live Card, an OVR or rarity change,
a Chronicle cover, a matchweek summary, an album achievement, or an
end-of-season card. Sharing remains opt-in; the generated asset must omit
private data, respect photo consent, and offer the normal initials / default-art
fallback when a personal photo may not be used. This is an export surface, not
automatic external messaging or a reason to add spammy notifications.

### Animated Special-edition card artwork

**Status: idea.** Allow selected Special editions to use animated GIF artwork
in place of the Player's static profile photo, making rare cards feel visibly
different from ordinary Live editions. Animation belongs to the edition's
frozen artwork treatment rather than replacing the Player's normal profile
photo everywhere. Before implementation, settle who may upload or assign the
asset, file-size and dimension limits, storage and content-validation rules,
and how animation behaves in card grids, reveal sequences and shareable
exports. Every animated card needs a good static poster-frame fallback, and
`prefers-reduced-motion` or an in-app accessibility choice must be able to show
that still image instead.

### Gift a sealed pack

**Status: idea.** Let one member buy a sealed pack for another member, with
the recipient performing the reveal and receiving the normal
server-authoritative outcome. The sender pays the configured price; this is
not a direct coin transfer and must use the same odds, supply guards, ledger
audit and idempotency guarantees as an ordinary pack opening. An ADR must
settle self-gifts, send / receive limits, unopened-gift expiry or refunds,
inactive recipients, notifications, and abuse through coordinated or
alternative accounts before any economy work begins.

## Raised 2026-09-15 — all three shipped 2026-09-16

**Status: shipped.** Three items were raised on 2026-09-15 and all three shipped
the next day in a single migration,
`20260926000000_trade_log_rating_story_listing_duration.sql`:

| Item | Shipped as |
|---|---|
| Trades show their full value in the club log | ADR-073 |
| An OVR breakdown on the card detail page | ADR-074 |
| List cards on the market for 72 hours | ADR-072 |

The ADRs and `PROGRESS.md` are canonical for the live behaviour. Three points
worth carrying forward, because each was a decision rather than an
implementation detail:

- **The trade log names cards but does not value them.** Nothing is snapshotted
  at accept time, so a coin-equivalent computed later would drift with Live
  Ratings and a past trade would rewrite its own worth. If per-card valuation is
  ever wanted, it needs snapshot columns written at accept time — a
  data-changing change, not another projection.
- **The OVR story states Form per session and OVR only once.** The original
  request asked for "+2 OVR for goals, +2 OVR for kudos";
  `RATING_BALANCE_REVIEW.md` forbids it, because Form is rounded once on the
  total and per-line integers would not sum. Revisiting that means revisiting
  the balance review, not just the copy.
- **Batching was a one-time authorization** (ADR-075), taken so the hosted
  schema was pushed once. It sets no precedent; the next migration-bearing
  change returns to one per PR.

Follow-ups these three deliberately left open:

| Item | Status | Notes / next step |
|---|---|---|
| Name the cards in the `Trade completed` notification | idea | The seller inbox notice still says "plus cards" unquantified. The feed now names them, so the inbox reads as the poorer surface. Fixing it means `create or replace`-ing all ~150 lines of `kut.respond_to_trade` for a copy change; worth doing alongside the next real change to that function rather than alone. |
| Clamp a trade offer to its listing expiry | idea | `kut.propose_trade` sets a flat 12-hour expiry with no clamp to `listing.expires_at`, so an offer can nominally outlive its listing. Harmless — `respond_to_trade` re-checks and refuses — but more visible now listings can run 72 hours. Fix is `least(now() + interval '12 hours', listing.expires_at)`. |
| Cancelling a lapsed listing reports the wrong thing | idea | `kut.cancel_listing` carries `expires_at > now()`, so cancelling an expired listing raises "active listing not found" rather than a clean "already expired". More sellers will meet this at 72 hours. |
| Backfill or snapshot per-card trade values | idea | Prerequisite for ever showing a trade's total coin-equivalent. See the first bullet above. |

## Player eligibility, academy and roster pruning

**Status: idea; workings deliberately open.** Occasional visitors who attend
once and never return should not automatically receive a permanent collectible
Player card. A starting proposal is to require three recorded attendances
before a Player becomes part of the full card game, while remaining open to a
different mechanism that achieves the same outcome more fairly or simply.

Candidate lifecycle:

1. After one or two qualifying attendances, show the person in a visible
   **Academy** of upcoming Players, without yet minting or making their full
   collectible card available.
2. On the third qualifying attendance, promote them to full Player-card status.
3. If their Academy attendance count has not increased for a month, take an
   as-yet-undecided action. Whether they remain visible, are archived/hidden,
   or later restart part of the qualification process is explicitly open and
   must not be inferred from this proposal.
4. Support the other end of the lifecycle too: an admin may propose retiring
   a full Player who no longer attends often. Retirement is **never automatic**
   and requires an explicit manual confirmation so injury, travel or another
   temporary absence can be handled humanely.
5. The proposed retirement settlement cashes out active copies of that
   Player's affected cards to their owners at the applicable discard value.
   Exact burn / retirement semantics remain open and must be atomic, audited
   and communicated to every affected owner.

Before an ADR, decide what counts as a qualifying session, whether the three
appearances are lifetime or inside a rolling window, who may appear publicly
in the Academy, how existing Players are grandfathered, what happens after an
Academy timeout or later return, and whether promotion happens immediately or
after admin confirmation. Pruning additionally needs explicit rules for Live
versus Special editions, current listings, cards held in trade escrow,
historical market / Chronicle / album records, current-season ratings, and
possible future reactivation. Never delete the historical Player or silently
invalidate economy records.

## Generated default player portraits

**Status: idea.** Replace the visually empty initials-only state for Players
without a custom photo with a small controlled library — initially around ten
distinct generated default portraits. Assign a portrait deterministically so
the same Player keeps the same visual across Live Cards, the Album, Market,
Chronicle and shareable assets; a consented custom photo always overrides it.
The defaults should be clearly fictional / illustrative rather than attempts
to resemble the real person, cover enough visual variety to avoid making the
roster look repetitive, carry suitable usage rights, and work across all
rarity treatments and card sizes. Art direction, assignment inputs and whether
archetype influences the portrait are open design decisions.

## KUT Five Cup — archetype-aware weekly knockout

**Status: favored.** A lightweight, asynchronous competitive use for the cards
members own, without live PvP, manual result entry, or a full football match
engine. This promotes the card collection beyond raw OVR while keeping real
TFH football as KUT's main event.

- **Entry:** one squad per member per football week, made from five owned Card
  Copies representing five distinct real Players. Entry is available to all
  members; attending the underlying session is not required.
- **Timing:** entries lock after a published TFH session in that football week;
  no Cup runs in a week without one. A server-side single-elimination bracket
  resolves on Sunday.
- **Line-up shape:** any five-card squad is valid. A balanced formation earns
  a small, capped bonus rather than being a hard requirement: an Anchor
  (Goalkeeper / Defender / Tank), Creator (Playmaker / All-rounder), Runner
  (Speedster / All-rounder), Finisher (Finisher / All-rounder), and Wildcard.
  An All-rounder may fill only one role. This makes specialists valuable
  without making new or incomplete collections unable to enter.
- **Resolution:** a small server-authoritative match resolver, not a real-time
  match engine. It snapshots each selected card's attributes at lock, then
  resolves a few seeded match moments from Attack (SHO/PAC/DRI), Control
  (PAS/DRI/PHY), and Defence (DEF/PHY), with bounded randomness and published
  pre-match odds. A stored result is final and can never be rerolled.
- **Rewards:** start with a cosmetic trophy / badge during validation. A later
  coin reward may be a modest, hard-capped weekly faucet (for example, a small
  entry-completion amount plus a small amount per win; no more than 50 KUT
  Coins per member per week). It must not rival the 250-coin attendance reward
  or make stronger collections snowball into a dominant coin source.

Before implementation, write an ADR and update `BUILD_SPEC.md`: specify the
resolved probability formula and tie-break, exact reward and economy cap,
entry/ownership edge cases, card-stat snapshot policy, audit/ledger behaviour,
and abuse/concurrency tests. The result and every monetary reward must remain
server-authoritative and idempotent.

## Admin tooling

Continues Phase C ("Safer admin testing tools", ADR-035) below. Both items are
operator surfaces, not member-facing features, and neither weakens the
member-to-member card-ownership privacy stance — "See other members' squads /
teams" above stays blocked on its own privacy ADR, and the admin view below
must stay `kut.is_admin()`-gated rather than becoming a member-reusable
projection. Scoped 2026-09-03; the pair needs one ADR (next free number:
ADR-052) and a `BUILD_SPEC.md` touch at build time. Rough estimate ~1.5 days
for both, of which the deciding and documenting outweighs the coding.

| Item | Status | Notes / next step |
|---|---|---|
| Admin view of a member's cards | specified | The permission already exists — `kut.user_cards` has carried an `admins read all cards` RLS policy since `20260816070000`. Only a projection is missing: `kut.my_collection_cards` is deliberately owner-scoped (`owner_id = auth.uid()`, with a comment saying it stays so even for admins), so add an `is_admin()`-gated sibling view that exposes `owner_id` instead of filtering on it, `security_invoker` + `security_barrier` + `revoke all from public` like every other projection. One additive `create view` + grants; no rows touched. Front end is a page under `src/app/(app)/admin/` plus a tab in `admin-tabs.tsx`; card rendering already exists in `src/components/album/`. |
| Admin grant of specific cards | specified | **Mint, not transfer** (decided 2026-09-03): a granted card is a new copy, so Part L invariants #20 (ownership changes only via `buy_listing` / `respond_to_trade`) and #22 (trade escrow) stay untouched, nothing needs recomputing (`pack_economy_health`, `my_club_value`, `club_value_leaderboard` are all views), and an accidental grant is undone by burning that one card id. **Cap: 5 copies per call** as the fat-finger guard, dual-declared as `ECONOMY.adminCardGrantMax` in `src/game/economy.ts` and a literal in the RPC, mirroring how `adminWalletAdjustMax` / `100000` are declared today. `user_cards.source` already allows `'admin'` and `user_notifications.event_type` already allows `'admin_notice'`, so the schema work is one new `kut.admin_grant_cards` RPC shaped like `admin_adjust_wallet` (is_admin, not-yourself, superadmin / admin-target guards, required 1–200 char reason, audit row, member notification) plus `'card_grant'` added to the `admin_account_events.action` check. UI is another `intent` branch in `admin/links/actions.ts` and its table, alongside `adjust_coins`. |

**Migration tier: additive** — decided 2026-09-03, and worth stating
explicitly in the ADR rather than leaving implicit. `OPERATIONS.md` lists "any
change to `user_cards` semantics" under the data-changing tier, and a new
minting path arguably is one; the classification follows ADR-035's precedent
instead, which shipped `admin_reset_account` — a function that *burns* cards
and re-grants starter cards at run time — as additive on the reasoning that
the migration itself mutates no member rows and the minting is gated behind
`is_admin()` at run time. The grant RPC is the same shape and strictly less
destructive. Consequence per ADR-032: the ~10–15 min checklist, no fresh
pre-push backup (rides the last scheduled one), no restore drill.

Open at build time, none of them blocking:

- Whether the admin card view shows burned copies and acquisition history or
  only the active collection (default: active only, matching
  `my_collection_cards`), and whether wallet balance / Club Value belong on
  the same screen or stay on the existing tabs.
- Whether the grant form carries an idempotency key. `admin_reset_account`
  takes one (`p_idempotency_key` + the `admin_account_events_reset_idem_idx`
  partial unique index); `admin_adjust_wallet` does **not**, so a double form
  submit there writes two events. Cards are recoverable by burning, but the
  reset pattern is cheap to copy and worth copying.
- Whether a grant appears in `kut.activity_feed` (ADR-038). Default: silent,
  matching the coin faucet — a club-wide "an admin gave X a card" row reads as
  favouritism and leaks ownership that the privacy stance otherwise protects.
- Which editions are grantable. Only Live editions exist today (every
  `insert into kut.card_editions` in the migration history sets
  `is_live true`), so the picker is just the roster and there is no supply
  ceiling. When special editions land (`BUILD_SPEC.md` Part VI §19 / Part XIV)
  decide whether admin grants respect `max_supply` and increment
  `minted_count` — `open_pack` is its only writer today.
- A revoke / claw-back counterpart is deliberately **out of scope**: unlike a
  mint it would touch invariants #20 and #22 and need active-listing and
  `held_by_offer_id` guards. Raise it as its own item if it turns out to be
  wanted.
- Each feature needs a matching `supabase/tests/database/*.test.sql`; locally
  these apply via `docker exec supabase_db_kut psql`, not `supabase db reset`.

## Larger phases

From the archived 2026-08-17 handoff's "recommended next phases",
de-duplicated and status-checked (`archive/HANDOFF-2026-08-17.md`):

| Phase | Status | Notes |
|---|---|---|
| A — Alpha readiness & operational safety | shipped | Backup/restore drill, preview preflight, risk-tiered migration process — `OPERATIONS.md`, `BACKUP.md`, ADR-032. |
| B — Navigation & product clarity | shipped | Authenticated nav overhaul + the `/how-it-works` page (PROGRESS "Navigation overhaul update"). |
| C — Safer admin testing tools | partial | Shipped: `admin_adjust_wallet` audited coin faucet + `admin_reset_account` soft reset — ADR-035. **Open remainder:** an admin view of a member's cards and an admin card grant, both scoped 2026-09-03 — see "Admin tooling" above. |
| D — Visual & collection experience | shipped | `/settings/card` photo (ADR-027), Player Directory (ADR-027), Home top-risers (ADR-031), the material-ladder redesign (ADR-043), and the Panini album at `/club/collection` (ADR-048, 2026-09-02) — a bound, paged album, nine slots per page, alphabetical, desktop two-page spread / mobile one leaf, duplicate stacks, gaps as empty slots, with the old grid as `?view=manage`. Archetype ended up a lens rather than the spine, because roughly 80% of the roster is All-rounder by default. Completion rewards remain deliberately unbuilt — see "Prestige + collections" above. |
| E — Community contribution mechanics | partial | Shipped: bibs-washing coin bonus (ADR-037). **Open / declined:** a "first 10 to sign up" bonus — keep it out of the football Live Rating; if built, do it as a capped coin bonus or a separate badge, transparent and auditable (the archived handoff has the full reasoning). |
| F — Message Center expansion | shipped | attendance-reward / pack-opened / trade / admin-notice inbox events — ADR-028, ADR-042, ADR-044. |

## Spec-defined future scope

`BUILD_SPEC.md` carries its own forward-looking sections. Indexed here, not
copied — the spec is canonical:

- Part VI §19 — special editions
- Part XIV — Special Cards (Phase 2)
- Part XV — Matchday / fantasy layer ("Friday Five", Phase 3)
- Part XVI — post-match community voting / awards (Phase 3+)
- Part XXXIV §119–121 — Phase 2 / 3 / 4 delivery outline
- Part XXXV — collection challenges / card sinks (future)
- Part XLII — notification candidates (future)
- Part XLVIII — questions deliberately deferred

## Brainstorms (not scoped)

Half-baked ideas kept so they aren't lost — not scoped, not prioritised, not
a plan to build. Moved here from `decisions.md` by ADR-045.

### Weekly 5-card squad knockout

A lightweight competitive use *for* the cards members own, without any new
admin/attendance data entry and without attendance-guessing as the object of
play.

- Each member assembles a squad of 5 owned cards, one slot per distinct real
  Player (no duplicate-player stacking within a squad — owning duplicates
  stays fine and is encouraged as collecting flavour).
- Squad power derives entirely from existing Live OVR — no new stats, no
  admin entry beyond what `publish_attendance_session` already records.
- Sunday night, gated on the same "was a session published this football
  week" rule Part 9 defines (skip cleanly if not), squads feed a
  single-elimination bracket seeded by power, byes for non-power-of-two
  fields.
- Each matchup resolves via a power-weighted probability (formula unchosen) —
  needs the deterministic, testable, pure-function treatment
  `pack_economy_health` got in ADR-015 before it affects real squads. Odds
  published per round, so Sunday has several reveal moments.
- Reward starts as bragging rights / a badge only; a currency or pack payout
  would need the ledger-backed, security-definer treatment of `open_pack` /
  `buy_listing` (ADR-010/014/016).

Open questions: minimum-entrant threshold; whether a currency reward is added
later and how; the power-weighting formula; seeding by total or average XI
OVR. Overlaps the "coin-generating dimension" idea above and BUILD_SPEC
Part XV (fantasy layer).

### Player-of-the-week peer vote

> **Largely superseded** by "Real-life play → ratings: attendance backbone +
> goals + kudos survey" (favored, top of this file). The kudos survey there
> replaces a best-3 vote with positive-only, multi-category nominations.
> Salvageable leftovers: the "In Form" special-edition card for a standout,
> and the Friday-21:00→Sunday-23:59 window. Kept for those.

Another route for a player's cards to improve, alongside attendance and Live
OVR: a weekly peer vote for the top 3 players of the week.

- Voting window Friday 21:00 → Sunday 23:59 (the football-week framing of
  Part 9; skip cleanly on weeks with no published session).
- Each member picks 3 distinct players, cannot vote for themselves.
- Voting pays a small coin reward — a currency payout, so the same
  ledger-backed, security-definer treatment as `open_pack` / `buy_listing`
  (ADR-010/014/016), plus an anti-abuse rule (only counts with 3 valid picks;
  one reward per member per week).
- After close, the 3 top-voted players get a card boost — magnitude,
  stacking with Live OVR, and decay all unspecified; needs the ADR-015
  pure-function treatment before it touches real cards.
- Optional extra: the single top-voted player gets an "In Form"
  special-edition card, leaning on the frozen-snapshot Special card model,
  one per week.

Open questions: the boost formula and duration; 3rd-place tie-breaking;
minimum turnout; public or secret votes; how the "In Form" card is minted,
owned, and expired; abuse vectors (collusion, vote-trading).

## One-off open items

- **`home` tools-grid blurb** — drafted in `decisions.md` ("Open items"), not
  yet added to `VibeTrunk/home/src/data/tools.ts`.
- **Narrow the Supabase auth redirect allow-list** to KUT's own preview
  pattern — `OPERATIONS.md` "Follow-ups" (2026-08-19).
- **`player-photos` storage bucket** is not covered by the SQL backup —
  `BACKUP.md`.
- **Photo consent toggle + admin photo moderation** — still open (ADR-027).
- **Enable RLS on `kut.season_rating_rules`** — low-priority defense in depth
  from the 2026-09-16 Supabase Security Advisor review. The table is in an
  exposed schema, but this is not a current write or data-integrity hole:
  `20260920070000_rating_rules_read_permission.sql` revokes `public`/`anon`
  and grants only `SELECT` to `authenticated` and `service_role`; its rows are
  deliberately readable by signed-in screens. In a separate independently
  reviewable migration, enable RLS, retain the least-privilege grants, add an
  authenticated read policy (preferably using the same active-KUT-member
  boundary as KB-017), and add pgTAP assertions that `anon` and authenticated
  writes fail while the intended member read and owner/service paths still
  work. This needs no paid Supabase feature or recurring administration.
