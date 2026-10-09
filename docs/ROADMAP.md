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
| Basic pack price 250 | ADR-057, ADR-136, `20261019000000` | Three Live cards, same weights and attendance reward; only the purchase price changes. |
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
- **implemented** — built and verified, but not deployed
- **blocked** — needs a product decision or an ADR before it can start
- **partial** — some of it shipped; the open remainder is described
- **shipped** — built and deployed; `PROGRESS.md` and the ADR log are canonical
- **completed** — a non-release task is finished; its dated result is in PROGRESS
- **declined** — considered and deliberately not doing; the reason is stated
- **superseded** — replaced by a named successor, which carries on the idea
- **monitoring** — an unresolved incident is retained; investigate on a related
  recurrence or matching user report, rather than running dedicated diagnostics

## Priority — raised 2026-09-26

The owner flagged these as the next things to pick up, ahead of the
unprioritised idea lists further down. Each economy- or rule-changing item still
needs its ADR and spec change at build time.

| Item | Status | Notes / next step |
|---|---|---|
| Goals report becomes "goals + assists" | shipped | **Live since 2026-09-27 (ADR-101, KUT PR #137, migration `20261009000000`, catalogue supabase #60).** From the football week beginning **2026-09-28** the self-report, admin correction and accountless-attendee entry take one combined **G+A** integer (2 goals + 2 assists = 4); goals and assists are not stored apart. Earlier sessions keep meaning and saying goals; nothing is backfilled. Only labels change: columns and RPC parameters keep their `goals` names, and the ladder (0 / 1 / 1.25 / 1.5), kudos, the 3.5 / 8 caps and the 83 ceiling are unchanged. The recent-week SHO modifier reads the combined count, so a reported 4 gives the capped +8. `src/game/reported-count.ts` is the one source for the cutover and wording; the SQL notices are date-aware. Midweek Madness unaffected. The owner confirmed it working on hosted 2026-09-30. **Watch:** the reported-count distribution after 28 Sep (`RATING_BALANCE_REVIEW.md`). |
| Groundmasters — the first Special edition | favored | **Raised 2026-09-30.** A one-off Special edition for the Players who helped renew the pitch agreement: its own card design and a frozen rating. **Players picked 2026-10-02:** Teize, Alex, Melle, Freek, Cedric and Thomas. Integration proposal, five card designs, groundwork fixes and open decisions are in the "Groundmasters" section below. **Next step:** the owner picks a design direction and the economy numbers; then the ADR. |
| Silver and gold packs | idea | **Raised 2026-10-02.** Two dearer pack types beside the 250-coin basic pack, with better odds of strong cards. Today there is one pack: `tfh-pack` in `kut.pack_definitions` (slug, title, price, card count), with the tier weights of BUILD_SPEC §29 (Common 100 … Elite 1) inside `open_pack`. **Open decisions:** (1) what makes a pack silver or gold: a guaranteed minimum tier in one slot (the reading the names suggest, since Silver and Gold are also card tiers), weights shifted towards the top tiers, or more cards; (2) prices and card counts; (3) whether the Groundmasters Special roll lives in these packs rather than the basic one. **Constraints:** a dearer pack must not return more in discard value than it costs, or it becomes a coin faucet; measure each design with `scripts/measure-pack-ev.mjs` on the real roster, as ADR-057 did for the basic pack. A guaranteed tier can come up empty when few Players hold it (the Elite and Holo tiers are thin), so the ADR needs a fallback rule. It changes BUILD_SPEC §28 ("only one purchasable pack type"), and it touches the pack-integrity invariants (Part L #6, #7, #10), so it needs an ADR, a spec change, a migration and a database test, one migration per PR. The "Store" idea under Tester-feedback ideas would later give the pack types a shared shop page. |
| MM 2.0 | idea | **Moved 2026-09-30.** "Rotate unclaimed Players' archetypes weekly" and "Midweek Madness: own-card bonus and a captain" are now part of the "MM 2.0" section below, with their notes and the owner's decisions carried over in full. |
| Show owned copies on the transfer market | shipped | **Live since 2026-09-27 (ADR-100, KUT PR #135); Vercel deployed it on merge, and the owner confirmed it on hosted 2026-09-30.** Frontend-only; no migration, no Part L change. `/market` and `/market/[listingId]` show both the viewer's total copies of the Player and copies of the exact edition. Every row returned by owner-scoped `my_collection_cards` counts, including the viewer's own listed and offer-held copies. `/market` makes one parallel `player_id, edition_id` read for all listings; detail counts the full existing collection result before filtering offer-eligible cards. **Follow-up:** the grid presentation became a chip on the card (KB-026, ADR-102, PR #139). |
| SBCs or another card / coin sink | idea | **Half-baked.** Today's sinks are only the pack price and the burned 5% market tax (BUILD_SPEC §25); discard is a card sink but a coin faucet, and Midweek Madness added a coin faucet on 2026-09-26. Candidate shapes: (1) **SBCs** — squad-building challenges, as sketched in BUILD_SPEC §122 ("Friday Night Challenge": hand in 5 different Players, combined OVR ≥ 270, two Friday attendees → one premium pack; the cards are burned), which gives low/mid duplicates a use; (2) the "Prestige + collections" row below (medal for 30 distinct cards, themed sets for coins); (3) pure coin sinks from §25's "later sinks" — event entry, cosmetic frames, profile cosmetics — overlapping the "Store" row. Constraints: a reward must be worth less than what it burns (by discard value), or the sink is secretly a faucet — check against the Part L invariants and the pack-EV targets; burning must be an atomic, server-authoritative RPC that excludes listed and offer-held copies like discard does, and the ADR must say whether a card in an unsettled Midweek squad can be handed in. §122 says not to build challenges before observing the real duplicate economy, so the first step is a read-only look at duplicate counts and wallet balances (and how fast Midweek coins accumulate). Needs an ADR, a migration and a database test — one migration per PR. |

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
| Prestige + collections — hand in N cards for a reward | idea | Two related card-sink mechanics: a permanent cosmetic medal for turning in 30 distinct cards; themed sets (e.g. ≥80% of a session's attendees) handed in for a coin payout. New tables + a sink and/or faucet + UI. `BUILD_SPEC.md` Part XXXV already sketches collection challenges. Now one of the candidate shapes of "SBCs or another card / coin sink" under Priority above. |
| "Store" instead of "Packs" | idea | Rename the section and add variety: multiple pack types, cheaper items, cosmetics that pimp your personal card. Today there is one 250-coin basic pack (ADR-136). The extra pack types are now "Silver and gold packs" under Priority above. New product surface + a cosmetics model; ADR + migration. |
| Player / Team of the Season ("TOTS" = Terrible of the Season) | idea | End-of-season award from most team-of-the-week appearances / most goals, plus a Team of the Season XI. Season-boundary aggregation over existing snapshot + goal data; no economy change if purely cosmetic. |
| Coin-generating dimension — mini-game or PvP on card collections | shipped | Large: a new subsystem with its own tables and a new coin faucet to balance against the Part L invariants. Recorded in the spec as "Future idea 1". Specified as "Midweek Madness" below (BUILD_SPEC §44, ADR-089); live since 2026-09-26. |
| Peer / performance scoring beyond goals — assists, defensive play, post-game survey, 1–5 player ratings, goalie saves, goal reward scaled by player count | partial | The **"Real-life play → ratings"** design for this round-3 cluster shipped 2026-09-06 (ADR-059/060/063): attendance backbone, diminishing-returns goals and a positive-only post-game kudos survey. **Open remainder:** assists as a separate stat (from 2026-09-28 assists count only inside the one combined G+A report, ADR-101; see "Goals report becomes 'goals + assists'" under Priority above), defensive play, 1–5 player ratings, goalie saves and scaling the goal reward by player count — none of these has a design, and each would need its own ADR. |
| Distinct goalkeeper stat set (handling / reflexes / …) | idea | ADR-036 shipped a goalkeeper archetype that reuses the six outfield stats with an offset. A true GK stat set would rewrite the card component and every attribute projection — deferred as the "hard" variant in the round-1 triage. |
| Market auctions | idea | ADR-042 added fixed-price listings + escrow trade offers; ADR-072 let the seller choose a 24- or 72-hour window. A timed ascending auction is still a separate mechanic. |
| Weather bonus — extra coins for rain / snow / freeze / >25 °C | idea | No weather data source today. |
| In-app FAQ | idea | There is a "How KUT works" page; a short FAQ is a smaller, distinct surface. |
| Show owned copies when buying | shipped | Promoted to and shipped as "Show owned copies on the transfer market" under Priority above (ADR-100, PR #135, live since 2026-09-27). |

## Product-fit ideas

New ideas identified during roadmap review. They are deliberately **not scoped** and need an ADR before implementation; in particular, none may weaken the card-ownership privacy stance or add an unbounded coin faucet.

| Item | Status | Notes / next step |
|---|---|---|
| Wanted-card lists and trade matching | shipped | Shipped 2026-09-06 (ADR-058, migration `20260919000000`): private wants plus copy-level availability at `/club/collection/wanted`, showing who is open to trading and a copyable message to start the conversation. Deliberately no reciprocal matcher, no new offer target and no new notification machinery — agreed trades complete through the existing Market/Offers routes. |
| Session Recap / "TFH Chronicle" | partial | v1 shipped 2026-09-02 (ADR-049, migration `20260913000000`): one issue per football week at `/chronicle`, matchday reports plus tier crossings, member-only. The **kudos & goals** block then shipped 2026-09-06 with member reporting (ADR-059/060): each matchday report now renders reported goals, recognised kudos categories and survey progress. **Open remainder** (`archive/SPEC_ALBUM_CHRONICLE_GRAPH.md` §4.4): the **club desk** block for the week's sales, listings, trades and pack opens — all already in `kut.activity_feed`, so it is a rendering job, not a data one. The issue layout still reserves room for it. |
| Opt-in community collection goals | idea | A TFH-wide seasonal album or themed goal that members can contribute toward while retaining their own cards. Completion unlocks a cosmetic club-wide badge, card frame, or Chronicle moment — **not** coins, packs, ratings, or ownership disclosure. This complements the personal Panini album and collection challenges; needs opt-in contribution semantics, a privacy-safe aggregate-progress design, and an ADR. |
| Notification preferences | idea | Settings promised them ("planned for a later polish pass") until ADR-114 removed the placeholder, since plans belong here. Open: which inbox messages a member may mute, and whether any should reach a phone outside the app (KUT has no push notifications). |
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

## Groundmasters — the first Special edition

**Status: favored** (raised 2026-09-30). A one-off Special edition honouring the
Players who helped renew the agreement for the pitch the club plays on. It is
the first issuance on top of the ADR-055 scaffolding
(`20260916000000_special_edition_scaffolding.sql`), which stores a complete,
immutable snapshot per edition but has issued nothing: packs and starter
grants are still Live-only. ADR-055 requires "a separately reviewed issuance
migration and product decision", so this needs an ADR and a spec change
(BUILD_SPEC §19, §30, §42–43, §119) before any build.

**Decided by the owner (2026-09-30):**

- a **one-off event**, not a recurring achievement type: one edition per
  honoured Player, issued once;
- a **special card design** of its own;
- a **fixed rating**: a frozen snapshot that never follows the Live card
  (Part L #14). The Player's Live card is untouched and keeps its normal tier.
- **the honoured Players (2026-10-02):** Teize, Alex, Melle, Freek, Cedric and
  Thomas, so six editions. Match each name to its Player row when the issuance
  is written.

**Proposed integration (Claude's recommendation, not yet decided):**

| Topic | Proposal | Why |
|---|---|---|
| Rating | `min(95, Live OVR at issue + boost)`, stats frozen and capped at 99 (§19). Boost **+6 to +8** (the mockups use +8). | Grounded in how the Player actually plays, rather than a hand-set number. Kept modest because of Midweek Madness (below). |
| How members get them | (1) The honoured Player gets **one copy of their own edition** (§43). (2) A **Special roll in the existing basic pack during a release window** (§30: 1% per slot, about 1 in 34 packs). (3) An optional **supply cap per edition** (e.g. 10), which makes the "No. 04 / 10" serial meaningful. No separate pack product. | A window gives the release an "event" feel without a new pack SKU (that belongs with the "Store" idea). A cap is optional in §43, but in a club of about 20 members a numbered copy is the point; its cost is the concurrency acceptance test (§119). |
| Discard multiplier | **1.0–1.25**, not the ×1.5 §27 suggests. | Discard mints coins. At ×1.5 an OVR 80 Groundmaster discards for about 704 coins (2.8 packs at 250) and an OVR 90 one for about 1,520 (about 6.1 packs). At a 3% hit rate that adds tens of coins of expected value to every pack. Let scarcity carry the market price, and re-run `scripts/measure-pack-ev.mjs` as ADR-057 did. |
| Club Value | No change. | A Special is its own edition, so it counts at 100% beside the Player's Live copy (ADR-056). |
| Midweek Madness | Allowed, and deliberately strong. | `src/lib/midweek/copies.ts` already picks a member's strongest copy per Player, so a Groundmaster outranks its Live card, and a Special never goes into the injury cast (ADR-085). That is the reason to chase one. A +12 boost would tilt the weekly bracket; +6 to +8 keeps the edge bounded (the payout cap, Part L #26, bounds the coins). |
| Admin grants | Settle in the same ADR. | "Admin grant of specific cards" (Admin tooling, below) already asks whether grants respect `max_supply` and increment `minted_count`; today `open_pack` is its only writer. |

**Groundwork found while scoping:**

- `card_editions.edition_type` only allows `live`, `totw`, `hat_trick`,
  `milestone`, `iron_man`, `comeback`, `tots` and `other`. Add a proper
  `groundmaster` value rather than hiding it under `other`, because the card
  frame keys off the edition type.
- **Latent tier bug.** Every card projection derives a Special's
  `rarity_tier` from a shifted ladder on `snapshot_ovr` (70+ Elite, 60+ Holo,
  50+ Gold, 40+ Silver, 30+ Bronze), which neither matches the Live ladder
  (§16) nor reads the stored `snapshot_rarity_tier`. Current definition:
  `20261010000000_market_listing_discard_value.sql` line 78, and the same
  expression in the other card views. Invisible today because no Special
  exists; the first Groundmaster would show the wrong tier.
  **Correction is a separate slice (KB-038, ADR-121):**
  `20261018000000_special_snapshot_tiers.sql` reads the frozen tier in the
  collection, market, saved pack results and offered-card JSON. Catalogue and
  apply it through `VibeTrunk/supabase` before issuance; issuance must not
  bundle this projection fix.

**Card designs (2026-09-30).** Five directions, built on the real `LiveCard`
and `globals.css`, in [`design/groundmasters/`](../design/groundmasters/README.md)
(regenerate with `node design/groundmasters/build/build.mjs`; also on the
owner's private Claude Design canvas). Each shows the Special at detail and
collection size, beside the Player's unchanged Live card for comparison:

1. **Mown stripes.** The card is the pitch: mown grass stripes, a chalk
   touchline border, a centre circle meeting the halfway line at the
   nameplate, a corner flag in place of the tier pennant, and a slow "mower"
   pass across the stripes.
2. **The agreement.** The signed renewal: laid paper, a line-drawn shirt, the
   name in italics on a signature line, a red "RENEWED" rubber stamp, a wax
   "GM" seal and typewriter stats. Tells the real story most directly; no
   animation.
3. **Keys to the ground.** Midnight-blue enamel and brass: an engraved key in
   the background, a brass key tag instead of the pennant, a double brass
   border.
4. **Honours board.** Dark mahogany with gilt signwriting and
   "GROUNDMASTERS" across the top, like a clubhouse honours board.
5. **Site plan.** A cyanotype drawing: grid paper, the pitch outline, a
   dimension line labelled "Groundmaster", a north arrow, and the nameplate as
   a drawing's title block.

1, 2 and 5 are furthest from the existing tier ladder. 3 and 4 share Elite's
dark-and-gold family, so they are easier to mistake for it at grid size. The
design reads from the edition type plus `artwork_key`; `snapshot_rarity_tier`
stays for sorting and filters only. "Animated Special-edition card artwork"
(New candidate additions) could later extend whichever direction wins.

**Open decisions for the ADR:** the design direction (or a combination, e.g.
stripes with the wax seal); the boost; a supply cap and its size; the discard
multiplier; the release window's dates; whether the pack roll lives in the
basic pack or in the silver and gold packs (Priority above); and whether a
member's album gets a Groundmasters section. Not yet mocked: the pack reveal, a card
with an uploaded photo instead of the shirt back, and the Midweek mini card.

**Delivery order** (one migration per PR; hosted pushes go through
`VibeTrunk/supabase`):

1. ADR + spec update for the rules above. Docs only.
2. The card design and the album section, in the UI. Safe to deploy first:
   nothing renders it until a Special exists.
3. Migration: the `groundmaster` edition type and an
   admin issuance RPC that also grants the honoured Player's own copy, with
   pgTAP coverage.
4. Migration: the Special roll in `open_pack` with window, cap and concurrency
   tests. Its own PR, because it touches pack-integrity invariants
   (Part L #6, #7, #10).

## Midweek Madness — weekly 5-card squad knockout

**Status: shipped** (specified 2026-09-25, ADR-089; built in PRs #114–#131; switched on 2026-09-26, first week Wed 30 Sep). The rules are canonical in
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
| 4 | Migration `20261004000000`: the 14-day archetype cooldown (`players.archetype_changed_at`, the guard in `set_own_player_archetype`, the next allowed date on `/settings/card`; ADR-094) | shipped (#122); on hosted 2026-09-25 |
| 5 | Migration: SQL engine, `run_midweek_due`, reveal views, admin void and rehearsal; Part L #25. Per HANDOFF.md: bye positions, per-card per-match day rolls, goals per side, the champion on `midweek_tournaments_public`, owner counts withheld until `complete` (D3), admin counts and the rehearsal's return shape (migration `20261005000000`, ADR-095) | shipped (#125); on hosted 2026-09-26 |
| 6 | Migration: payouts, ledger reason `midweek_win`, the faucet ADR; Part L #26. Per HANDOFF.md: a member view of their own midweek rewards (migration `20261006000000`, ADR-096) | shipped (#127); on hosted 2026-09-26 |
| 7 | Entry UI, built to the approved mockups: the picker, opt-out, navigation (Home owns the route, D1; the Collection strip, D2), tolerant reads (ADR-097; no migration) | shipped (#129) |
| 8 | Results UI, built to the approved mockups: bracket, match report (a renderer `ownersPublished` flag, D3), the result leading until Thursday 23:59 (D4), admin page, the lazy trigger (ADR-098; no migration) | shipped (#130) |
| 9 | Launch: hosted rehearsal with the owner, enable the config | shipped 2026-09-26: rehearsal passed (22 entrants, 32 slots, 5 rounds); the switch failed through the API (KB-024), fixed by migration `20261007000000` (#131); switched on the same day (`docs/DEPLOYMENTS.md`) |

It lives at `/club/midweek`, owned by Home in the navigation, next to the Chronicle (owner decision D1 in `design/midweek/HANDOFF.md`); the Club page card became a Collection strip (D2).

Still open:
- whether a season leaderboard or badge sits on top of the coins (parked).

## MM 2.0

**Status: idea** (raised by the owner 2026-09-30, the evening of the first
live week). A second version of Midweek Madness, collecting the changes below
into one item. Each builds on BUILD_SPEC §44 as it stands; §44 stays canonical
until an ADR and a spec change adopt a part of this. It absorbs two items that
were under Priority: "Rotate unclaimed Players' archetypes weekly" (at the
owner's request) and "Midweek Madness: own-card bonus and a captain" (because it
needs the same engine retune; see the row).

**First-week evidence (30 Sep, one week; `PROGRESS.md`).** 17 of 21 members
picked, and early: only 2 saved in the last two hours, so a pick reminder is
less urgent than feared. Members already think about archetypes: only 39% of
picked cards were All-rounders against about 80% of the roster, and only one
picked squad had no keeper. That supports the plusses table, and makes the
archetype rotation the bigger lever. Someone was watching at 22:30 when the
final came out, but only 5 of 16 result messages had been read 40
minutes later. That's too early to judge the inbox, but it argues for the shareable result over the inbox. The engine
matched the simulation (2.75 goals per match, 3 shoot-outs in 20); 0 upsets is
worth watching over more weeks.

| Idea | Owner's intent | Notes against today's §44 |
|---|---|---|
| Player ratings after the tournament | Once the tournament is complete, each card in a member's squad gets a published rating from 1 to 10, reflecting how much it contributed to winning, with a short description. | Today the report has a "standout" score per match (goal 3, assist 2, save 1, block 1, penalty scored 1, penalty saved 2; §44.10), which could be the base. Open: a rating per match or one over the member's whole night; whether "contribution to winning" is counted from events or measured by re-running a match without the card (possible, because every match is a deterministic function of the seed); and who writes the descriptions: new phrasebook lines, read by the owner as in PR 2. **Built 2026-10-03:** the rule and its lines (F7 core, ADR-117, #174), then the pages from DR3 (ADR-117 amended): the champion view, the week's bracket and each report's Why list, once the week is complete. If it's a pure function of the stored events, it can be TypeScript-only like the renderer (ADR-093) and needs no migration. **Decided (owner, 2026-10-03, Q1 interview):** measured first on 150 simulated seasons. A counterfactual replay is mostly noise (60% of goalscorers come out neutral or negative, because swapping one card replays the whole match differently), and the plain standout points are coarse (63% of ratings on 6 or 7). The owner chose **events weighted by each chance's goal probability** (a goal from nothing counts more than a tap-in, a save more the bigger the chance it denied; a miss costs the shooter nothing), **a rating per match and per night** (the mean of the card's matches), **a floor of 4**, one decimal; the descriptions are a new phrasebook layer the owner reads; the UI comes from a **Claude Design mock first**. **Core built 2026-10-03 (ADR-117, no migration):** the rule and 70 lines; the pages follow the mock. |
| Balanced squads beat All-rounders | Four well-balanced outfield archetypes should be markedly better than four All-rounders. A table shows each archetype's contribution to each line (attack, midfield, defence) as 0 to 3 plusses, not numbers, and members aim for a balanced number of plusses across the lines. | A rule change. Today there are no balance rules: "All-rounders are average everywhere, so the default archetype stays useful", and balance only helps as far as it follows from the §15.1 offsets (§44.4). Needs a balance term in the engine, the TypeScript engine and SQL twin changed together with new golden vectors (ADR-090), and a retune against the ADR-092 targets (strongest vs weakest ≤72%, thought-through vs random ≥58%). **Decided (owner, 2026-10-03, Q13 interview):** (1) **the plusses are the engine's input**: a fixed 0–3 table per archetype and line, in the TypeScript engine and the SQL twin alike, replaces the offset-derived line multipliers in Midweek, so the table can never disagree with the maths; card faces and OVR keep the §15.1 offsets. Measured first with the match engine (60,000 matches a row): the lines are not worth the same today. Midfield decides who gets each chance and attack is individual (the drawn shooter's own attack sets the goal chance), while outfield defence is averaged and shares its weight with the keeper, so one card at 1.40 adds about 3 points of win chance in attack or midfield and under 1 in defence; four Speedsters or Playmakers beat four All-rounders about 56%, four Tanks about 40%, and Finisher, Playmaker, Defender and Tank only tie them (49.5%). Each line's value per plus is therefore tuned so a plus is worth about the same in every line. (2) **Specialists carry 4 plusses, the All-rounder 3** (1/1/1, still average everywhere); the starting table follows the offsets (best line 3, second 1, weakest 0; Speedster 2/2/0) and its values are signed off with the tuning. (3) **The weakest-line rule**: each of the four outfielders' lines needs at least N plusses (N = 4 to start), and every plus a line falls short multiplies the whole squad by a tuned penalty; the keeper keeps today's strength. (4) **Strength**: four balanced specialists beat four All-rounders of equal power **about 60–65%** of the time, and a one-line stack loses to four All-rounders; both are new harness rows. (5) **Switch at the push**, one engine, pushed as soon as it is ready: the week open at the push plays the new balance, even if that is the 7 Oct week before the first rotation. (6) **What members see**: how-it-works shows the plusses table and the rule, and the Why list a chip like "No keeper" (e.g. "Defence 2 short"); a live plusses count in the picker is a later frontend slice, mocked first (**in the 2026-10-03 mock round**, owner; **built 2026-10-03 from DR3**, ADR-116 amended). **Tuning signed off (owner, 2026-10-03, option R2 of `archive/MIDWEEK_TUNING.md`):** with the rotation on, the **Tank becomes 0/2/2** (midfield and defence, so it no longer plays the Defender's role), the threshold is **3 plusses per line** with **×0.88 per plus short**, a line's value for 0–3 plusses is 0.5 / 1.0 / 1.5 / 2.0 in attack and midfield and 0.2 / 1.0 / 1.8 / 2.6 in defence, outfield defence counts 0.8 of a shot's resistance (the keeper 0.2; it was half and half), a stand-in keeper is a fixed 0.45 of a Goalkeeper, the OVR factor at 83 rises to **1.12** (the owner asked for more OVR effect) and the auto factor drops to 0.55. Every target passes at 5,000 seasons: strongest vs weakest 71.2%, thought-through vs random **61.6%**, balanced vs All-rounders 63.1%, the best stack 32.7%; a plus is worth +3.4 / +3.3 / +2.3 points of win chance in attack, midfield and defence. **Built 2026-10-03 (MM 2.0 PR 8, ADR-116, migration `20261016000000`).** **Depends on the rotation below:** about 80% of the roster is an All-rounder, so without it, making All-rounders markedly worse weakens most members' squads overnight. **Tuned with rotation on (owner, 2026-10-03):** the rotation alone takes thought-through vs random to about 55% (C0, #168), and this change's sign-off must bring it back to at least 58%. |
| Rotate unclaimed Players' archetypes weekly | Folded in from Priority (2026-09-30), as the prerequisite for the balance change above. | `kut.players.archetype` defaults to `all_rounder` and only changes when the claiming member or an admin sets it (ADR-027), so every Player with no linked account is stuck as an All-rounder: about 80% of the roster (ADR-048 album note). That flattens squad shape (§44.4) and the album's `specialists` lens. Proposal: a server-side step reassigns each **unclaimed** Player's archetype on a fixed cadence, e.g. weekly. Constraints: (1) **timing**: rotate just *before* the Midweek week opens, so the ADR-099 snapshot trigger freezes the new archetype for that week and nothing changes between open and lock; (2) **deterministic and audited**: seeded or cyclic, not `random()` at read time, with each change logged; (3) **OVR stays put**: offsets sum to zero, but the six card-face stats and the rating rebuild follow the archetype at once (ADR-099), so owners of those cards see their stats reshuffle each week. Say so in how-it-works. **Owner decisions (2026-09-30):** the pool is **every archetype**, All-rounder and Goalkeeper included, so a rotated Player can land on the default or become a keeper; **only active, collectible Players rotate**, so inactive Players and Academy Players (see "Player eligibility, academy and roster pruning" above) keep their archetype; **claiming ends the rotation**, and the member keeps whatever archetype the Player has at that moment (their first `set_own_player_archetype` change is still free, per ADR-094). Checked in the simulation harness (MM 2.0 C0, #168, `archive/MIDWEEK_ROTATION.md`): smoothing the keeper count moves no target, but every rotation variant takes thought-through vs random below 58%; and a rotating Player is told apart from a fixed one within two to three weeks, while `player_directory` today shows claim status neither way. **Owner decisions (2026-10-03):** **no smoothing** (Q8), each rotating Player draws any archetype independently; the thought-through dip is **accepted while the rotation is live on its own**, and the balance change below is tuned with rotation on so its sign-off restores at least 58%; the **visibility is accepted** (Q9) and how-it-works says unclaimed Players' archetypes rotate weekly. **Built 2026-10-03 (MM 2.0 PR 7, ADR-110, migration `20261015000000`):** the open step draws each eligible Player's archetype from the new week's secret seed (unpredictable until the open, checkable once the seed is published at payout), logs every change in `kut.midweek_archetype_rotations`, and rebuilds the card faces once; Part L #27. The week open at the push keeps its archetypes; the first rotation runs when the worker opens the following week. |
| Own-card bonus and a captain | Folded in from Priority (2026-09-30). **Out of scope for MM 2.0 (owner, 2026-10-03, Q3):** C2 (the balance change) is built and tuned without either; the owner may bring them back later, as their own change with their own retune. Earlier: **Unsure** (owner, 2026-09-30): not committed to MM 2.0. It adds levers to a squad that already has many (OVR, form, pick share, fitness, keeper, balance); the fewer levers members must keep in mind, the better. | Two squad-level twists: (1) a small bonus when a member fields a card of **their own claimed Player** (loyalty, "play yourself"); (2) a **captain**, one of the five chosen at entry, whose card weighs more in the squad's win chance. **Why it is here:** both are new factors in `card_power` / squad strength, so they need the same harness retune as the balance change. Tuning them together means one retune and one owner sign-off instead of two, against the existing targets, especially "a thought-through five beats a random five" and "no fixed habit wins". Open: bonus size; whether the own-card bonus stacks with `pick_factor` (a member's own Player is often a low-share pick already); whether a captain is picked per week and what auto squads get; and privacy: the entered five are already shown (ADR-091), but `player_directory` deliberately hides which member claimed which Player, so a visible own-card bonus in a report would disclose that link. Either keep the bonus silent in reports or decide the disclosure in the ADR. The rotation above sharpens this, since only claimed Players would keep a fixed archetype. |
| Whose chance it is, at a glance | Every chance makes it immediately clear whether it is for my team or the opponent's. It doesn't have to be a graphic. **Decided (owner, 2026-09-30, looking at a live round-1 report):** (1) each timeline entry (chance, goal, save, …) lines up **left for the left squad and right for the right squad**, like the scoreboard; (2) the two squads get a **team colour, blue and red**, and every Player's name is shown in their team's colour: in the event text, in the "Why" panel and on the scoreboard. | Today the report timeline says it only in small text ("for Thomas", "Sanne's chance"; `src/components/midweek/report.tsx:129`), every entry is left-aligned in one column, and side 0 is always on the left with a "You" chip on the scoreboard. Mirroring the timeline follows the same side-0-left rule. Colour follows the side, not the viewer, so a match between two other managers reads the same way; the mirrored layout is what keeps it readable without colour (colour-blind members, or a red and blue that are hard to tell apart on the dark theme). Needs a red and a blue that both pass contrast on the dark background and don't clash with the brass accent or the green/red "through"/"out" chips. On a phone the two columns become one, indented or bordered by side. Presentation only (no migration), so it can ship before the rest of MM 2.0; it matters most once matches unfold chance by chance, where it is the first thing a viewer reads. **Resolve with Claude Design** at desktop and phone widths first. **Built 2026-10-02 (F2, ADR-111); deeper colours 2026-10-03:** the owner found blue and red too bright, and DR3 chose **violet and teal** (DR3-10), with a text tone and a fill per side and Live on its own pink (ADR-119). |
| Matches unfold chance by chance | The simulation plays out live, one chance every 20 seconds, **but only for what a member is watching** (owner, 2026-09-30): their own match live, and the final live for everyone. Every other match is revealed whole at its start time, as today. | This keeps the build and the pages simpler: there's no need to play all 16 round-1 matches at once. A member who arrives late sees their own match already decided, with a way to replay it. A match has 14 slots with ~69% chances each, so about 10 chances: ~3–4 minutes per match if only chances are shown, 4:40 if every slot is. Open: how shoot-out kicks are paced. Today events appear all at once at the match's `reveal_at` (§44.9); this needs a reveal time per event in the gated views (so nothing leaks early through the API), and pages that update without a reload. Local realtime is switched off (#136), so this means polling or a decision to use realtime. |
| A round every 15 minutes | Rounds start every 15 minutes instead of every 30. | `MIDWEEK_REVEAL_INTERVAL_MINUTES` goes from 30 to 15. With 17–32 entrants (5 rounds) the final starts at 21:00 instead of 22:30. A ~4-minute match leaves ~10 minutes between rounds. |
| Lock at 19:55, round 1 at 20:00 | Squads lock at 19:55; the first round starts at 20:00. | Today round `r` is revealed at `lock_at + 30 min × r`, with the lock at 20:00. The new rule is round `r` starts at `lock_at + 5 min + 15 min × (r − 1)`. **Payout timing must move with it** (owner agreed 2026-09-30): payment, the seed, pick shares and the inbox message happen after `final_reveal_at` (§44.7, §44.11), so with live unfolding `final_reveal_at` must become the end of the final's last chance. Otherwise the payout reveals the champion while the final is still playing. |
| Something to follow after being knocked out | Members who are out early still have a reason to follow the evening (owner agreed 2026-09-30). **Built 2026-10-03:** predictions for members who are out (ADR-118, #175, on hosted), then the pages from DR3 as "calls" (ADR-118 amended). | **The problem gets worse with the faster evening.** With 22 entrants there are 32 slots: 10 byes and only 6 real matches in round 1, and after round 2, **14 of 22 members are out**. At 15-minute rounds that happens by about 20:20, so most of the club has nothing of their own left to watch before the evening is half over. Options: a consolation bracket for round-1 losers (no coins or a small amount, checked against the ADR-096 faucet); predicting the winners of matches you're not in; or a stake that lasts all evening, e.g. your cards' ratings (first row) counting toward a season table (the parked "season leaderboard or badge"). Open: which one, and whether it pays. Anything that pays coins changes the faucet and needs its own ADR. **Decided (owner, 2026-10-03, Q2 interview):** **predictions**, open only to **members who are out**: before a match's kick-off, once both its feeders have ended, pick its winner. Measured: the pre-match favourite wins 74% in round 1 and 61% in the final, and about 6 of 22 members are out after round 1, 14 after round 2. **Coins for correct picks, at most about 30 a night:** 30 split over the matches a round-1 loser could predict (2 per correct pick at 17–32 entrants, 4 at 9–16, 10 at 5–8, 30 at 4), paid at payout, its own ADR checked against ADR-096 (about 200 coins a week at 22 entrants if everyone out predicts everything). **No table:** Midweek has no season (`kut.seasons` is the rating season, never reset), so a weekly line ("You called 5 of 7: +10 KUT Coins") instead. Rejected: a consolation bracket (an engine change, and it covers only round-1 losers) and a season table on the ratings (a card's rating is final once its manager is out). The backend (one migration) ships first; the UI comes from the same mock round. |
| A shareable result | A result members can post in the club's group chat: a champion poster, or "my night" as an image (owner agreed 2026-09-30). | The group chat is where the club actually lives, so this is likely the best way to get members watching next week. It overlaps with "Shareable cards and matchweek posters" (New candidate additions) and should reuse whatever that builds. Only shows what is already public to members after the final (§44.9); a manager's name on a shared image leaves the members-only projections (ADR-079), so the ADR says what an image may show. **Decided (owner, 2026-10-03, Q4 interview):** an image may show **manager and Player names and Player photos** (the owner's decision; §53 keeps photos to members, so F8's ADR records this exception, and a Player without a photo gets the usual initials art); **both images**: a champion poster anyone may share and "my night" for your own (with your five's ratings once F7's pages land); offered from payout; drawn on a canvas in the browser, shared through the Web Share API on phones and downloaded on desktop; no migration. The UI comes from the same Claude Design mock round as the ratings and predictions. **Built 2026-10-03 (F8, ADR-120):** both images at 1080 × 1350, drawn on a canvas in the browser, on the champion view and the complete bracket; the §53 exception recorded. |
| The bracket is public from the lock | Once squads lock, members see the draw (who meets whom, and the path to the final) before round 1 comes out. Raised by the owner 2026-09-30, while waiting for the first week's round 1. | Today nothing about the rest of the field is visible until round 1 (§44.9; ADR-098: the bracket is "assembled from the revealed rows"), so the 30 minutes after the lock show only your own five. The draw is fixed at the lock and never changes (Part L #25), so showing it early gives nothing away about results. It needs a **pairings-only** projection: `midweek_matches_public` rows carry goals and winners, so they can't simply be revealed earlier. **Decided (owner, 2026-09-30): the five cards are shown too**, not only manager names, so members can size up an opponent. That moves the entries' reveal from round 1 to the lock; the ADR says whether their week-long factors (form, day) come with them, since those hint at results. A §44.9 change and one migration. With the 19:55 lock above, the bracket has only 5 minutes before round 1; the draw can't come earlier, because the field is settled only at the lock. **Built 2026-10-02:** the data in ADR-105 (on hosted), the pages in ADR-113 (F5). |
| A UX pass: give Midweek Madness its own place | Midweek Madness is a big feature, but it lives entirely under Home. MM 2.0 includes a UX pass, and the owner wants Claude Design's view on KUT's UX as a whole (2026-09-30). | Today there are five primary tabs (Home, Collection, Packs, Market, Leaderboard; ADR-053), and Home owns `/`, `/chronicle` and `/club/midweek` (`src/lib/nav/routes.ts`; owner decision D1 in `design/midweek/HANDOFF.md`). The pages are reached through the Home card and the Collection strip, with no tab or section tab of their own. Options for the review to weigh include a section tab under Home, a sixth tab (ADR-053 settled on five for the phone bar), or a tab that groups the competitive surfaces (Midweek and Leaderboard). **One design pass for all of MM 2.0's screens:** whose chance it is, live unfolding, the bracket from the lock, ratings, something to follow after being knocked out, and the shareable result all change the same pages, as do KB-028–KB-031. Designing them together avoids three rounds of mockups. A ready-to-paste prompt for a separate Claude Design session is at `~/.claude/plans/kut-ux-pass-prompt.md`. It asks for a written review first, and mockups only for the direction the owner picks. |

**Build notes.** A simulated week keeps the times and results it was drawn with
(Part L #25). An open week's lock may still move, so the ADR names the first
week that follows the new rules. The timing changes (15-minute rounds, the 19:55 lock, a reveal
time per event), the rotation, and the engine change (balance, plus the own-card
bonus and captain if they stay) are each migration-bearing, so they go in separate
PRs, one migration each (ADR-070). The rotation ships before the balance change,
or in the same week's release, never after it. The ratings and the "whose chance"
display can probably stay frontend-only. The engine change needs the owner's
tuning sign-off, as PR 1 did. Needs an ADR amending ADR-089 (design), ADR-092
(tuning) and ADR-098 (the pages), plus ADR-027/ADR-099 for the rotation.

**Considered and left out:**
- **Distinct goalkeeper stat set** (Tester-feedback ideas): rewrites the card
  component and every rating, well beyond Midweek Madness. MM 2.0 keeps the
  Goalkeeper archetype's offsets.
- **Season leaderboard or badge** ("Still open" under Midweek Madness): still
  parked on its own, but one of the options for "Something to follow after being
  knocked out" above.
- **KB-028 and KB-029** (picker defects in `KNOWN_BUGS.md`): defects in what is
  live now, so they're fixed on their own rather than waiting for MM 2.0.
- **SBCs or another card / coin sink** (Priority): an economy change, separate
  from how the tournament plays.

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

## Engineering follow-ups — 2026-10-07

The 5 October Codex handoff's rule repair, shared guidance, #197 timeline,
release orchestration 3a/3b/3c and access-diagnosis work are complete through
#198–#202. The attributable browser matrix shipped in #203. ADR-134 ends
dedicated Topic A diagnostics for now; item 6's inventory and preservation
are complete. This table records follow-up scope, not publication or removal approval.

| Item | Status | Notes / next step |
|---|---|---|
| Worktree content and preservation inventory (handoff item 6) | completed | Inventoried all 16 extras against #203 using content and read-only PR history. No unpublished committed feature delta was found; local unfinished/private content was separately preserved. Three encrypted archives passed independent recovery checks, including all nine stashes. Four individually approved removals are complete. Last verified count: 13 registered total, including the ordinary checkout, on 2026-10-07. Twelve extras remain: ten clean and two with local unfinished work. No further removal is approved. See PROGRESS for preservation limits and private evidence locators. |
| Approval-based cleanup for Codex and Claude (ADR-135) | ordinary-file workflow accepted; worktree activation blocked | Ordinary exact-file removal uses direct chat approval and existing tools after preservation/state checks; an actual disposable shell probe passed and both self-contained guards permit it. No new consent system is required for ordinary files. The owner accepted this version with the worktree safeguards retained and authorized its publication. Worktree engine/recovery adapters are prepared for review with standalone refusal; their live host/permission coverage remains unproven. Automatic approval review rejected relaxing those requirements and the patch was not applied. Unknown partial Git leftovers remain blocked. No retained item has removal approval; no settings/ACL/location change is authorized. |
| Topic A — WebKit Drawing stalls / slow spells | monitoring | Open, initiating cause unresolved; intermittent test/release reliability impact demonstrated, real-user impact unconfirmed. Owner accepted monitoring on 2026-10-07 (ADR-134). Preserve and triage a related failure during ordinary authorized work or a matching user report. Any further experiment needs a discriminating hypothesis and a 30-minute time-box; retain assertions and fail-closed gates. No proactive reruns or profiling. |
| Topic B / KB-037 | monitoring | Existing passive decisions remain: resume on recurrence and preserve the original failure before clearing state. Neither is established as sharing Topic A's cause. KB-037's canonical report/status stays in KNOWN_BUGS. |
| Windows port-reservation persistence (ADR-125) | planned | Verify read-only after the owner's next reboot. No reboot has been confirmed for this check; do not repeat the port repair or alter exclusions now. |

## FLUT rename — remaining slices (ADR-137)

Slice 1, the in-app branding, is built in PR `feat/flut-branding`. Each item
below needs its own authorization; the order and checks are in ADR-137.

| Item | Status | Notes / next step |
|---|---|---|
| Server template migration | idea (optional) | One new migration, in its own PR with a database test, re-creates the functions that write "KUT Coins" (notices, the Midweek result, the admin reset, RPC exceptions) with FLUT wording; `design/flut/HANDOFF.md` §8 lists them. Not needed for members: the display adapter already shows FLUT Coins, and stays for rows already stored. Messages are never back-filled. |
| Slice 2 — attach `flut.vibetrunk.com` | planned | Vercel `kut` domain, DNS/TLS check, Production `APP_URL`. Supabase Auth Site URL is shared by all tools: verify only. |
| Slice 3 — `feat/flut-domain` | planned | Exact-host 307 `kut.vibetrunk.com/:path*` → `https://flut.vibetrunk.com/:path*` in `next.config.ts`; the release checker moves to the new domain, asserts the legacy alias serves the same deployment without a Vercel-level redirect, and probes the redirect live. Announce the sign-in-again cutover; never on a Midweek Wednesday evening. |
| Slice 4 — `VibeTrunk/home` listing | planned | FLUT, `https://flut.vibetrunk.com`, "Collectible football cards for TFH — showing up matters." |
| Slice 5 — permanent redirect | planned | 307 → 308 after production acceptance. |

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
