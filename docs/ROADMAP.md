# KUT roadmap

Everything **not yet built**, in one place. For the rest:

- what has shipped → `PROGRESS.md` (dated log)
- why each decision was made → `decisions.md` (ADR log)
- open defects in shipped behaviour → `KNOWN_BUGS.md`
- the canonical spec, including its own Phase 2–4 scope → `BUILD_SPEC.md`
- raw tester feedback and how each item was triaged → `TESTER_FEEDBACK_BATCHES.md`

## Status vocabulary

- **idea** — raised, not yet evaluated or committed
- **favored** — the direction is endorsed; needs an ADR + spec change before build
- **planned** — agreed in principle, waiting for a slot or a design
- **blocked** — needs a product decision or an ADR before it can start
- **partial** — some of it shipped; the open remainder is described
- **declined** — considered and deliberately not doing; the reason is stated

## Real-life play → ratings: attendance backbone + goals + kudos survey

**Status: favored.** Endorsed direction for connecting more of what happens
during a Terrible Football Haarlem session to KUT, without KUT becoming a
ranking of who is best at football. Supersedes the "player-of-the-week peer
vote" brainstorm below and is the considered design for the round-3
"performance / peer scoring" cluster in the table further down. Building it
needs its own ADR and a `BUILD_SPEC.md` Part V (§11–15) + Part 145 update; it
touches the Part L rating-determinism and faucet invariants.

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
| Rating graph over time — per-player OVR line chart | planned | Low effort: `kut.player_rating_snapshots` already stores weekly `live_ovr` per player per season (ADR-031). A query + a chart component on `/players/[slug]`. Per-attribute history would need a wider snapshot table. |
| See other members' squads / teams | blocked | Needs a card-ownership privacy decision + an ADR — the codebase deliberately hides who owns which card (`my_collection_cards` is owner-scoped; `player_directory` hides who claimed a player). Build sketch in ADR-044 / `TESTER_FEEDBACK_BATCHES.md` round-2 💡03. |
| Duplicate copies weigh less for Club Value | blocked | Changes a published economy formula (Club Value v2, ADR-041) — data-changing migration + ADR + a re-balance against the Part L faucet/sink invariants. Intent: reward collecting breadth and make the transfer market more active. |
| Prestige + collections — hand in N cards for a reward | idea | Two related card-sink mechanics: a permanent cosmetic medal for turning in 30 distinct cards; themed sets (e.g. ≥80% of a session's attendees) handed in for a coin payout. New tables + a sink and/or faucet + UI. `BUILD_SPEC.md` Part XXXV already sketches collection challenges. |
| "Store" instead of "Packs" | idea | Rename the section and add variety: multiple pack types, sub-250-coin items, cosmetics that pimp your personal card. Today there is one 250-coin basic pack. New product surface + a cosmetics model; ADR + migration. |
| Player / Team of the Season ("TOTS" = Terrible of the Season) | idea | End-of-season award from most team-of-the-week appearances / most goals, plus a Team of the Season XI. Season-boundary aggregation over existing snapshot + goal data; no economy change if purely cosmetic. |
| Coin-generating dimension — mini-game or PvP on card collections | idea | Large: a new subsystem with its own tables and a new coin faucet to balance against the Part L invariants. Recorded in the spec as "Future idea 1". |
| Peer / performance scoring beyond goals — assists, defensive play, post-game survey, 1–5 player ratings, goalie saves, goal reward scaled by player count | favored | The considered design for this round-3 cluster is **"Real-life play → ratings"** at the top of this file (attendance backbone + diminishing-returns goals + a positive-only kudos survey). |
| Distinct goalkeeper stat set (handling / reflexes / …) | idea | ADR-036 shipped a goalkeeper archetype that reuses the six outfield stats with an offset. A true GK stat set would rewrite the card component and every attribute projection — deferred as the "hard" variant in the round-1 triage. |
| Market auctions | idea | ADR-042 added fixed-price listings + escrow trade offers. A timed ascending auction is a separate mechanic. |
| Weather bonus — extra coins for rain / snow / freeze / >25 °C | idea | No weather data source today. |
| In-app FAQ | idea | There is a "How KUT works" page; a short FAQ is a smaller, distinct surface. |

## Larger phases

From the archived 2026-08-17 handoff's "recommended next phases",
de-duplicated and status-checked (`archive/HANDOFF-2026-08-17.md`):

| Phase | Status | Notes |
|---|---|---|
| A — Alpha readiness & operational safety | shipped | Backup/restore drill, preview preflight, risk-tiered migration process — `OPERATIONS.md`, `BACKUP.md`, ADR-032. |
| B — Navigation & product clarity | shipped | Authenticated nav overhaul + the `/how-it-works` page (PROGRESS "Navigation overhaul update"). |
| C — Safer admin testing tools | shipped | `admin_adjust_wallet` audited coin faucet + `admin_reset_account` soft reset — ADR-035. |
| D — Visual & collection experience | partial | Shipped: `/settings/card` photo (ADR-027), Player Directory (ADR-027), Home top-risers (ADR-031), the material-ladder redesign (ADR-043). **Open:** the Panini-style album view for `/club/collection` — duplicate stacks grouped by edition, alongside the current grid as a management mode. |
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
