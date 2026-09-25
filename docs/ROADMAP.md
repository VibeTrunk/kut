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
- **superseded** — replaced by a named successor, which carries on the idea

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
| Coin-generating dimension — mini-game or PvP on card collections | specified | Large: a new subsystem with its own tables and a new coin faucet to balance against the Part L invariants. Recorded in the spec as "Future idea 1". Specified as "Midweek Madness" below (BUILD_SPEC §44, ADR-089). |
| Peer / performance scoring beyond goals — assists, defensive play, post-game survey, 1–5 player ratings, goalie saves, goal reward scaled by player count | partial | The **"Real-life play → ratings"** design for this round-3 cluster shipped 2026-09-06 (ADR-059/060/063): attendance backbone, diminishing-returns goals and a positive-only post-game kudos survey. **Open remainder:** assists, defensive play, 1–5 player ratings, goalie saves and scaling the goal reward by player count — none of these has a design, and each would need its own ADR. |
| Distinct goalkeeper stat set (handling / reflexes / …) | idea | ADR-036 shipped a goalkeeper archetype that reuses the six outfield stats with an offset. A true GK stat set would rewrite the card component and every attribute projection — deferred as the "hard" variant in the round-1 triage. |
| Market auctions | idea | ADR-042 added fixed-price listings + escrow trade offers; ADR-072 let the seller choose a 24- or 72-hour window. A timed ascending auction is still a separate mechanic. |
| Weather bonus — extra coins for rain / snow / freeze / >25 °C | idea | No weather data source today. |
| In-app FAQ | idea | There is a "How KUT works" page; a short FAQ is a smaller, distinct surface. |
| Show owned copies when buying | idea | When browsing cards on the market to buy, show how many copies the member already owns of that card. Low-priority UX improvement; requires no new queries since owned card counts are already fetched for the collection. |

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

## Injury mode — protect a long-term injured Player's card

**Status: partial.** Raised 2026-09-23 for a Player out with a long-term
injury, whose card would otherwise decay towards 30 OVR (and take every owner's
Club Value with it).

**Shipped in the first slice (ADR-082, migration `20260930000000`; pushed to
hosted 2026-09-23 via `VibeTrunk/supabase` catalogue PR #42):** an admin
puts a Player with an account into injury mode. Each football week they sit
out, the member does a rehab check-in from Home: 100 KUT Coins, and Activity
doesn't decay that week. Form still fades. Cards go into a signed plaster
cast (ADR-084, which replaced the first slice's 🩹 Injured chip).
Injury mode ends by itself when they play again. There is no backdating, by
owner decision.

**Open remainder:**

| Item | Status | Notes / next step |
|---|---|---|
| Comeback Form boost | shipped | ADR-083, migration `20261001000000`, pushed to hosted 2026-09-23 via `VibeTrunk/supabase` catalogue PR #44. The first published session attended after ≥ 3 protected weeks carries `least(2, 0.25 × protected_weeks)` Form, ageing like a session input under the Form cap of 8. It shows as its own row in the rating story. |
| Plaster cast on every card | shipped | One rule on every card screen: *the cast shows on a Live card of a Player who is injured right now* (spec §11.3). **PR A** (ADR-085, PR #107, UI only): one helper, `toLiveCardPlayer`, for the players list and detail, Home risers, collection list, card detail, album and the starter reveal on `/welcome`; `LiveCardPlayer.injured` is required and `id` is always the Player id; fixed KB-022 and KB-023. **PR B** (ADR-086, PR #108, migration `20261002000000`, additive, zero DML): `kut.active_market_listings` and `kut.my_pack_opening_results` gain `player_id` and `is_live`, and the market list, listing page, pack results and pack reveal go through the same helper, reading those views with `select("*")`. **Owner decisions (2026-09-23), settled in ADR-085:** (a) the market shows the cast; (b) Live cards only. **Hosted:** `20261002000000` pushed 2026-09-23 via `VibeTrunk/supabase` catalogue PR #46 and smoke-tested; no Player is in injury mode on hosted yet, so the cast itself has only been seen locally. |
| Sideline supporter | idea | An injured Player who comes to watch: coins but no Activity, and perhaps a kudos vote, since they saw the game. |
| Chronicle "treatment room" | idea | Injured Players and comebacks in the weekly issue. |

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

## Midweek Madness — weekly 5-card squad knockout

**Status: specified** (2026-09-25, ADR-089). The rules are canonical in
BUILD_SPEC §44; this section keeps the design rationale from the brainstorm it
grew out of. Where the two differ, §44 wins. Numbers marked as starting values
are tuned by the simulation harness and signed off by the owner in
`archive/MIDWEEK_TUNING.md`. It succeeds BUILD_SPEC Part XV "Friday Five",
which ADR-088 removed, and supersedes "KUT Five Cup" below.

**The pitch.** Every Wednesday each member enters five of their own cards, and
the squads play a knockout bracket that evening. A member who doesn't pick is
entered anyway, with a random squad and a penalty. The design goals are:

1. **Wealth helps but does not decide.** A bigger, better collection gives a
   statistical edge. It must not make the strongest collection the default
   winner.
2. **No pick stays best.** The right five depends on what everyone else picks,
   so there is something to think about every week.
3. **Cheap cards can decide matches.** A Bronze card can be the star of the
   week, and the reason is visible.
4. **The result is a story.** Each match gets a short report in which every
   line traces back to a number.

It keeps the original constraint: no new admin or attendance data entry, and
attendance-guessing is not the object of play. **It runs with zero weekly admin
work** (see "Running without admin" below).

### The week

- **Picking.** Picking opens when the previous final is revealed, and each
  member can change their squad until the lock. The picker can pre-fill last
  week's five, but only a squad saved *this* week counts as picked.
- **The lock is Wednesday 20:00 Europe/Amsterdam.** At the lock the server:
  - checks ownership (a card sold since picking becomes a trialist, see below);
  - gives every member who didn't pick an auto squad (see below);
  - takes a snapshot of each card's Live OVR and archetype;
  - draws the bracket at random;
  - simulates the whole tournament in one go.
- **Rounds are revealed every 30 minutes from 20:30,** so the final lands
  around 22:00. Results are computed at the lock, and a view reveals each row
  only once its time has passed, so nobody can read ahead through the API.
- **The gate.** The tournament runs only if the previous football week (§9) had
  a published session, so it pauses cleanly during club breaks.
- **The field is the whole roster:** every active member who owns at least one
  card and hasn't opted out, picked or not. It needs at least four; the roster
  is well above that, so in practice this never skips.

### Squads

- **Five owned cards, each of a different real Player.** Owning duplicates is
  still fine, but one Player can fill only one slot.
- **Trialists fill empty slots.** A member who owns fewer than five eligible
  cards (the starter pack is three) gets a trialist in each empty slot. A
  trialist is a Common All-rounder with its own weekly form roll and a neutral
  pick factor. The neutral factor matters: leaving a slot empty on purpose must
  never be the best play, and the simulation has to show that it isn't.
- **A member needs at least one real card to enter.**
- **Members who don't pick get an auto squad.** It is five random distinct
  Players from their own collection, drawn from the weekly seed, with
  trialists if they own fewer than five.
  - **Penalty:** every card in an auto squad has its power multiplied by
    `auto_factor` (about 0.65), and gets a neutral `pick_factor`.
  - **Auto squads don't count towards pick shares.** A random pick is not a
    choice, and counting it would blur the popularity signal.
  - **The penalty is sized so auto squads rarely go deep** (see the targets).
    Deliberate pickers get easy early wins against them, which is itself the
    reason to pick.
  - **The auto squad pays the same coins if it wins.** The penalty makes that
    rare. If nobody picks at all, a random member still wins the week; that is
    accepted as the cost of running unattended.
- **Opting out.** A member can opt out in settings, and is then never auto
  entered. This matters for privacy (see below).

### How a card's match power is built

```text
card_power  = ovr_factor × form_roll × pick_factor × fitness   (fixed for the week)
match_power = card_power × day_roll                    (fresh every match)
```

- **`ovr_factor` flattens Live OVR.** It runs from 1.00 at OVR 30 to about 1.35
  at OVR 83. This is the main thing that stops the richest member winning by
  default. If OVR counted in full, an all-Elite squad would be nearly
  unbeatable.
- **`form_roll` is one weekly roll per Player,** shared by every squad that
  fielded them. Most rolls land near 1.0, and a few Players have a big week (up
  to about 1.45) or a quiet one (down to about 0.75). Because the roll is
  shared, "Bas had a great week" is one fact for the whole club, not a separate
  result in each match.
- **`pick_factor` rewards the unpopular pick,** measured by choice rather than
  by how rare the card is to own:

  ```text
  share       = (entrants who picked this Player + 1)
              / (entrants who own a card of this Player + 3)
  pick_factor = roughly 1.30 when share is near 0, down to 0.85 when share is 1
  ```

  - **Owners, not all entrants, are the baseline.** Measured against every
    squad, an Elite that only its rich owner has would always look like a
    daring pick, and it would stack the biggest bonus on the highest OVR.
  - **The `+1 / +3` smoothing handles small numbers.** A sole owner who picks
    their card lands at 0.50, a mild penalty: a card nobody else can pick is
    not a brave choice. Ten owners with one picker lands at 0.15, a big bonus.
- **`day_roll` is the "on the day" roll:** a small fresh roll per card per
  match, roughly ±10%. After round 1 everyone can see each card's week-long
  factors, and without this roll the score draw would be the only uncertainty
  left. With it, "can Bas do it again in the semi?" stays a real question, and a
  report can say Bas "couldn't repeat the first-round heroics". It stays small,
  so the weekly form roll still carries the week's story, and the targets below
  cap it.
- **`fitness` is a small penalty for injured Players:** about 0.95 when the
  card's Player is injured at the lock, 1.00 otherwise. It follows the
  ADR-085 rule that decides the plaster cast: a Live card of a Player who is
  injured right now. It is deliberately small, so an injured Player stays a
  real option. An injured favourite may well be under-picked, and the pick
  factor can then outweigh the penalty. That makes "the injured contrarian
  pick" a legitimate gamble, and it is fine.

### Squad shape comes from the cards' archetypes

- **Archetypes set the shape, not the size.** A card's attack, creation and
  defence contributions come from its archetype's offset profile (§15.1),
  scaled by `card_power`. Absolute stats are not used, because those would
  bring raw OVR back in at full weight.
- **Three lines:**
  - attack: SHO, PAC and DRI;
  - midfield: PAS and DRI;
  - defence: DEF and PHY.
- **One keeper.** The keeper is the best Goalkeeper-archetype card in the
  squad. A squad without one puts an outfielder in goal at a heavy penalty. A
  second or third keeper plays outfield, carrying their SHO −12.
- **All-rounders are average everywhere.** That keeps the roughly 80% of the
  roster that has the default archetype useful.
- **No balance rules to write.** "One keeper beats zero or three" and "balance
  helps" then follow from the numbers.
- **Archetypes are frozen at the lock, with a cooldown on changes**
  (`set_own_player_archetype`, 14 days, decided in ADR-089). Otherwise members
  could retune their own card's archetype for the tournament, say by becoming
  the club's only Goalkeeper. The club accepts that archetype now carries
  tactical weight.

### A match

- **Every match is its own draw.** The weekly factors set strength, and each
  match is then played out at random from that strength, as in real football.
  A 65% favourite loses one match in three.
- **Chances, not just goals.** Each side gets a random number of chances,
  driven by its midfield against the other side's. Each chance has:
  - a **creator**, weighted by midfield contribution;
  - a **shooter**, weighted by attack contribution;
  - a **chance type**, weighted by the two cards' archetypes (see "Match
    reports");
  - an **outcome**: goal, save, woodwork, block or wide. The goal probability
    comes from the shooter's power against the defence and keeper.

  The chance model has to reproduce the intended expected goals. What it adds
  is that the creator, the type and the saves are real engine events, so the
  report's colour is traceable too.
- **Minutes.** Each chance gets a minute, so a report reads as a timeline.
- **Draws.** A draw goes to penalties, where the keepers matter. Each kick is
  an event too.
- **Odds.** Each match's pre-match win chance is published with its result.
- **Determinism.** The whole tournament is a pure function of the locked
  squads, the snapshots and one weekly seed. SQL is authoritative, with a
  TypeScript twin pinned by shared golden vectors and integer-only arithmetic
  (ADR-090), so the same inputs always give the same result. The seed's hash is published before the
  lock and the seed itself after, so nobody, admins included, can re-roll a
  week.

### Rewards

A coin reward is paid for every match won. Each round pays more than the one
before, and the champion's total equals the attendance reward (250,
`ECONOMY.attendanceCoinReward`), kept in its own constant.

Round `r` of `R` pays `250 × r / (R(R+1)/2)`. Earlier rounds round half up
and the final absorbs the remainder (ADR-089):

| Entrants | Rounds | Pay per win, round by round | Coins issued in a full bracket |
|---:|---:|---|---:|
| 4 | 2 | 83 · 167 | 333 |
| 5–8 | 3 | 42 · 83 · 125 | 459 |
| 9–16 | 4 | 25 · 50 · 75 · 100 | 650 |
| 17–32 | 5 | 17 · 33 · 50 · 67 · 83 | 953 |

- **Byes are drawn at random** and pay like a win, so the champion always
  collects exactly 250.
- **The emission is modest.** Because the whole roster is entered, every week
  issues a full bracket's worth: with a 17–32 member roster, 953 coins,
  roughly four attendance rewards. That fits the §44 constraint that matchday
  rewards must not overpower the market economy.
- **Paying is a new coin faucet,** so it needs:
  - its own ledger reason;
  - an idempotency guard per (tournament, round, member);
  - a security-definer payout like `grant_attendance_rewards`;
  - an inbox message per payout;
  - an ADR that checks the change against Part L.

### Targets the simulation has to hit

These put numbers on the design goals. Each is a knob, and the targets below
are starting choices. The weights are tuned by simulating many seasons against
a mix of simulated managers.

| Target | Starting value | Why this value |
|---|---|---|
| Strongest collection beats the weakest in a single match | about 65% | Like a top side against a bottom side in real football: usually, not always. At 50% collecting stops mattering; at 90% the result is decided before kick-off. |
| Strongest collection wins the whole tournament | about 25–30% with 8 entrants | That is roughly 65% compounded over three rounds, and 2–2.5× the fair share of 12.5%. It is a real edge, but the richest member still loses most weeks. |
| A thought-through five beats a random five from the same collection | at least 60% | This keeps the weekly thinking worth doing, so it isn't a lottery. It is the brake on how large `form_roll` and `day_roll` can get. |
| No fixed habit wins over a 20-week season | none ahead by more than a few percent | Habits tested: always highest OVR, always least popular, always last week's winners, random. The best reply to "everyone picks top OVR" must lose to the best reply to *that*. This is the test of "no pick stays best". |
| A Common or Bronze card is a match's standout | most weeks, at least once | This is design goal 3, measured. |
| An empty slot is never the best choice | always | This keeps the trialist rule honest. |
| An auto squad beats a typical picked squad | at most about 20% | "A significant disadvantage". It still wins against other auto squads, so the early rounds aren't a walkover for everyone. |
| An auto squad reaches the last four | about 2% of the time or less | "Rare to make it to later stages". |
| The squad that looks strongest after round 1 reaches the final | at most about 35% | Keeps the bracket up in the air after round 1 reveals everyone's weekly factors. `day_roll` and the per-match score draw carry this. |

### Match reports

The report should have real colour, like "Darryl scores a sensational overhead
kick from a Teize cross", and every flourish has to be true to the engine.
That calls for a large phrasebook, hundreds of lines, which the club accepts.

- **Layout: a headline, a timeline of 4–8 key moments, and a "why" panel.**
  - The timeline shows the minute, the event and its colour.
  - The "why" panel shows each card's factors as numbers.
  - The prose brings the colour; the numbers carry the traceability.
- **Colour comes from engine events, never invented.** Every phrase is picked
  from what the chance model produced: creator, shooter, chance type, outcome,
  and how likely the chance was. A Tank heading in a corner and a Speedster
  running through on goal happen because the engine made those chances, so the
  story and the numbers can't disagree.
- **Chance types lean on archetype.** For example:

  | Archetype | Typical chances |
  |---|---|
  | Speedster | breakaways, runs down the wing, a chase onto a through ball |
  | Finisher | volleys, first-time finishes, and the rare overhead kick |
  | Playmaker | through balls, free kicks, a curled shot from the edge of the box |
  | Tank, Defender | headers from set pieces, scrambles in the box, a thunderous long shot |
  | Goalkeeper | long throws that start a chance; a keeper goal is a once-a-season event |
  | All-rounder | any of these at an average rate |

- **Quality follows the odds.** A low-probability chance that goes in is a
  "sensational" goal, a routine one is "tidy" or "scrappy". The overhead kick
  in the example is sensational *because* the engine scored an unlikely chance,
  and the "why" panel can show it.
- **The phrasebook is layered, so it multiplies:**
  - build-up and assist phrasings per assist type ("from a Teize cross",
    "after a one-two with…");
  - finish phrasings per chance type and quality tier;
  - saves, woodwork, blocks and near-misses;
  - penalty-shootout kicks;
  - headlines and the fact lines (contrarian hero, form hero, Bronze standout,
    upset, keeperless side, three-keeper gamble, thrashing, brace, hat trick).

  About 15 chance types × 3 quality tiers × 6–10 finishes, plus the other
  layers, comes to several hundred lines and tens of thousands of distinct
  sentences.
- **No phrasing repeats within a match.** Picks are seeded and drawn without
  replacement.
- **Injured Players get their own layer.** A Player injured at the lock is
  named as such in the timeline ("Injured Darryl", "still in plaster"), and
  gets injury variants of finishes and moments: "Injured Darryl limps towards
  the back post and heads it in!". The humour is about playing on regardless,
  never about the injury itself. As with the cast lines (ADR-084, ADR-087), the
  text:
  - is generic and never medical, so no body parts or diagnoses;
  - never draws on `kut.injury_periods.note`, which may hold medical detail.

  Injury status is already public on every card through the cast, so naming it
  reveals nothing new.
- **Templates use names, never gendered pronouns.** Any line can land on any
  Player, and KUT doesn't record pronouns, so a phrase repeats the name or is
  worded without a pronoun. A unit test rejects he/him/his/she/her.
- **Misses credit someone, never ridicule the shooter.** "A stunning save from
  their keeper denies Bas" or "off the post", never "Bas fluffs it". Praise Players,
  tease managers: "your three-keeper gamble backfired" is fine.
- **Reviewed like `CAST_LINES` (ADR-087).** The phrasebook is code, and every
  line reaches members through a PR. Unit tests pin:
  - that every placeholder is valid;
  - length limits;
  - a banned-word list, including gendered pronouns and medical terms;
  - a minimum number of phrasings per chance type and quality tier, so variety
    can't quietly shrink.

  Writing the first few hundred lines is a good job to draft with an agent and
  review by hand.
- **An LLM could later rewrite a report into richer prose,** constrained to
  restate the event log. It is not needed: the layered phrasebook reaches the
  target colour deterministically, without an API cost or unreviewed text about
  real people.

### Privacy

- **Reports show squads,** which touches the ownership privacy that blocks "See
  other members' squads" above. Auto entry means a member can be entered
  without doing anything, so being entered can't count as consent by itself.
  Decided: taking part is the default, the rules page says plainly that your
  five are shown, and the settings opt-out takes you out entirely. Only the five
  entered cards are ever shown, never the rest of a collection.
- **Owner counts appear only as aggregates.** A count is shown only when at
  least three entrants own the Player; below that the report says "a rare
  pick". Otherwise "1 of 1 owners" would show exactly who holds an Elite.
- ADR-091 records this. "See other members' squads" stays blocked: the
  exception covers only cards entered in a tournament.

### Running without admin

KUT has no scheduler: ADR-061 chose a visit-driven lazy trigger instead, and
Midweek Madness uses the same pattern.

- **The lock is a deadline in the data, not a job.** The save-squad RPC refuses
  changes after Wednesday 20:00, so the inputs freeze on time whether or not
  anything runs.
- **The first page load after 20:00** (anyone, on any KUT page) runs the lock
  and simulation, claimed with `for update skip locked` like
  `finalize_session_surveys`. The result is fully decided by the frozen squads
  and the seed, so computing it at 20:00 or at 23:00 gives the identical
  tournament.
- **Reveals are timestamps.** Views show each round once its time has passed;
  nothing has to run at 20:30.
- **Coins are paid lazily after the final's reveal time,** not at simulation
  time, so wallet balances can't spoil results early. Payment is idempotent per
  (tournament, round, member).
- **The next week's tournament and seed are created by the same trigger** once
  the final is revealed.
- **Weekly admin work: none.** Publishing sessions, which admins already do,
  is the only input, through the club-break gate. Optional extras, none needed
  week to week:
  - an admin "void this week" action, as a safety valve for a bug;
  - reviewing new report lines, which arrive as ordinary PRs.
- **A Vercel Cron backstop** could be added later if nobody opening the app on a
  Wednesday ever proves to be a real problem. Results would be the same either
  way; only the moment coins land would change.

### How big a build this is

It is a mid-sized subsystem, about the size of the attendance, goals and kudos
survey with its finalizer (ADR-059/060/061/063). It is bigger than injury mode
(ADR-082–087) and smaller than the market with trade offers:

- about 5 tables (tournament, squads, squad cards, matches, match events), 3 or
  4 RPCs, one lazy trigger, one payout path, and pages under Club;
- **what is genuinely new is the engine.** Nothing in KUT simulates yet. It has
  to exist in SQL, which is authoritative, with a TypeScript twin for
  simulation and tuning, and parity tests between them. Balancing it against
  the targets is the real work and the real risk;
- day-to-day upkeep once tuned is low: numbers live in config, and the gate and
  lazy trigger reuse proven patterns.
- **Compared with the kudos survey:** that system took 9 migrations (about
  1,700 lines of SQL), about 3,200 lines of app code and tests, and more than
  ten PRs including three follow-up bug fixes (KB-015, KB-020, KB-021). Midweek
  Madness has plumbing of about that size (tables, RPCs, a lazy finalizer,
  notifications, pages), plus the engine and its tuning, which have no
  counterpart there, plus the phrasebook. So it is **medium to large: a notch
  above kudos.** Building the engine and simulation harness first (PR 1
  below) gives a go/no-go before any of the plumbing is built.
- **The infrastructure can run it reliably:**
  - The compute is trivial: a 32-squad bracket is 31 matches of about 20
    chances, a few hundred rows written in milliseconds by one function call.
  - Seeded randomness in SQL has precedent: the kudos migration already picks
    categories through `md5(seed || id)`, and core Postgres `sha256()` gives
    the same bits as the TypeScript twin's `crypto`.
  - The lazy trigger with a `skip locked` claim is the proven ADR-061 pattern.
  - The Wednesday 20:00 lock is computed in `Europe/Amsterdam`, so daylight
    saving is handled.
  - The one-off cost is 4–5 hosted migration pushes through
    `VibeTrunk/supabase`, one per migration PR. That is release work, not
    weekly work.
- **The colourful reports add moderately, and mostly in content.**
  - The engine plays chances instead of drawing one score. That is a loop of
    weighted draws, about a third more engine work, plus calibrating it so the
    chances still produce the intended expected goals.
  - The prose is presentation only: a pure TypeScript function over the stored
    events and the seed. It never decides a result, so it needs no SQL twin and
    no parity tests.
  - The real cost is writing and reviewing several hundred lines. The full
    phrasebook ships at launch (ADR-089).

### Build shape

Ten PRs, each on its own branch, one migration or invariant each (ADR-070):

| PR | Content | Status |
|---:|---|---|
| 0 | Specification: BUILD_SPEC §44, §120, §145; ADR-089–091 | shipped (#114) |
| 1 | Pure TypeScript engine, simulation harness, golden vectors. **Checkpoint:** the owner signs off `archive/MIDWEEK_TUNING.md` | shipped (#115); tuning signed off 2026-09-25 (ADR-092) |
| 2 | Report renderer and the full phrasebook (512 lines), TypeScript only, plus an invented sample tournament for design (`design/midweek/`). **Checkpoint:** the owner reads the phrasebook | shipped (#117) |
| — | **Design pass** in a separate session, from the sample: mockups for the pages of PRs 7–8, handoff in `design/midweek/HANDOFF.md` with owner decisions D1–D4. **Checkpoint:** the owner approves the mockups | approved, merged (#119) |
| 3 | Migration `20261003000000`: config, tournaments (skip and void reason codes), squads, opt-outs, `save_midweek_squad`, and the gated views `midweek_current`, `midweek_tournaments_public` and `my_midweek_squad` | shipped (#120); on hosted 2026-09-25 |
| 4 | Migration: the 14-day archetype cooldown | planned |
| 5 | Migration: SQL engine, `run_midweek_due`, reveal views, admin void and rehearsal; Part L #25. Per HANDOFF.md: bye positions, per-card per-match day rolls, goals per side, the champion on `midweek_tournaments_public`, owner counts withheld until `complete` (D3), admin counts and the rehearsal's return shape | planned |
| 6 | Migration: payouts, ledger reason `midweek_win`, the faucet ADR; Part L #26. Per HANDOFF.md: a member view of their own midweek rewards | planned |
| 7 | Entry UI, built to the approved mockups: the picker, opt-out, navigation (Home owns the route, D1; the Collection strip, D2), tolerant reads | planned |
| 8 | Results UI, built to the approved mockups: bracket, match report (a renderer `ownersPublished` flag, D3), the result leading until Thursday 23:59 (D4), admin page, the lazy trigger | planned |
| 9 | Launch: hosted rehearsal with the owner, enable the config | planned |

It lives at `/club/midweek`, owned by Home in the navigation, next to the Chronicle (owner decision D1 in `design/midweek/HANDOFF.md`); the Club page card became a Collection strip (D2).

Still open:
- whether a season leaderboard or badge sits on top of the coins (parked).

## KUT Five Cup — superseded

**Status: superseded by Midweek Madness (ADR-089).** An earlier sketch of the
same idea: five distinct Players, a Sunday knockout, a capped formation bonus,
and a hard cap of 50 coins per member per week. Midweek Madness keeps the
squad of five distinct Players, the seeded server-side resolver and the final,
never-rerolled result. It replaces the formation bonus with archetype-shaped
lines, and it deliberately drops the 50-coin cap in favour of a champion total
of 250 (ADR-089 has the reasoning).

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
- Part XV — Matchday layer: "Friday Five" removed by ADR-088; §44 now
  specifies "Midweek Madness" (ADR-089, section above)
- Part XVI — post-match community voting / awards (Phase 3+)
- Part XXXIV §119–121 — Phase 2 / 3 / 4 delivery outline
- Part XXXV — collection challenges / card sinks (future)
- Part XLII — notification candidates (future)
- Part XLVIII — questions deliberately deferred

## Brainstorms (not scoped)

Half-baked ideas kept so they aren't lost — not scoped, not prioritised, not
a plan to build. Moved here from `decisions.md` by ADR-045.

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
- **Enable RLS on `kut.season_rating_rules`** — **shipped 2026-09-23
  (ADR-081, migration `20260929000000_season_rating_rules_rls.sql`; pushed to
  hosted 2026-09-23 via `VibeTrunk/supabase` catalogue PR #40).** Low-priority defense in depth from the
  2026-09-16 Supabase Security Advisor review. RLS is on, with one
  `select`-for-`authenticated` policy on `kut.is_active_member()` (ADR-079). The
  least-privilege grants from `20260920070000` are unchanged, and there is no
  `FORCE`. `season_rating_rules_rls.test.sql` covers anon, a profileless JWT, a
  disabled member, an active member, an admin, the service role, member writes
  and the three definer paths. The read-only survey that closed this item found
  **no other `kut` table with RLS disabled**. The same test now asserts that for
  the whole schema.
