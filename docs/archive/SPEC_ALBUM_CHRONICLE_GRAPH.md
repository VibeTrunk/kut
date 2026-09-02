# Specification — rating history graph, Panini album, TFH Chronicle

Pre-ADR design specification for three roadmap items, promoted together on
2026-09-02:

| # | Feature | Roadmap origin | Proposed ADR |
|---|---|---|---|
| A | Rating history graph | Tester-feedback ideas — "Rating graph over time" (*planned*) | ADR-047 |
| B | Panini-style collection album | Larger phases, D — Visual & collection experience (*partial*); `BUILD_SPEC.md` §41 | ADR-048 |
| C | TFH Chronicle (weekly session recap) | Product-fit ideas — "Session Recap / TFH Chronicle" (*idea*) | ADR-049 |

**This document is not canonical.** It is the agreed design that the ADRs and
the `BUILD_SPEC.md` edits will be written *from*, at build time. Once each
feature ships, its rules live in `BUILD_SPEC.md` and its reasoning in
`decisions.md`; this file is then archived.

Reading order for anyone picking this up: `CLAUDE.md` → `BUILD_SPEC.md` §9
(football week), §11–16 (rating engine), §40–41 (collection) → `decisions.md`
ADR-031 (rating snapshots), ADR-038/039 (activity feed), ADR-043 (the material
ladder) → this file.

---

## 0. Decisions already locked

Settled with the product owner on 2026-09-02, before design. An implementer
may not quietly reverse these.

| Question | Decision |
|---|---|
| Chronicle unit | **One issue per ISO football week**, with each session in that week as a matchday report nested inside it |
| Chronicle source of truth | **Computed live** from existing tables/views — no snapshot table, no write path |
| Album placement | **Album becomes the default view of `/club/collection`**; today's filter/sort grid becomes a "Manage" mode on the same route |
| Rating-history backfill | **No backfill.** Ship the graph against whatever snapshots exist and let history accumulate week by week |
| Album organisation | **A bound, paged album** — nine slots per page, ordered alphabetically by display name; desktop shows a two-page spread, mobile one leaf. Archetype is a **lens**, not the spine (settled 2026-09-02 after the mockups showed ~80% of the roster is All-rounder by default) |
| Album slot numbers | **Positional, not permanent.** Alphabetical index; a new player shifts the numbers after them. Never used as an identifier |
| Chronicle v1 content | Matchdays + scorers + bibs, **plus tier crossings only** — no risers/fallers list, no market/pack desk, no club-table movement |
| Graph companions | **Rarity tier bands + goal markers.** No attendance timeline, no per-attribute lines |
| Chronicle sharing | **Members only.** No public link, no tokenised URL, no external share surface |

### Consequence of "no backfill", stated once

`kut.player_rating_snapshots` has only accumulated rows since 2026-08-30
(ADR-031 seeded the *then-current* week only), and the capture trigger writes
exactly one week per rebuild — the season's most recent published week. So on
the day this ships the table holds roughly **one or two distinct weeks**.

Two features depend on it:

- the **graph** will show 1–2 points for most players;
- the Chronicle's **tier crossings** block needs two snapshot weeks to compute
  anything, so it will be empty at first.

Both must therefore be designed so a sparse series reads as *early*, not as
*broken* — see §2.5 and §4.7. Neither may render an empty box with a "no data"
apology. A deterministic season backfill (`BUILD_SPEC.md` §10 guarantees the
season is rebuildable from published sessions) stays available as a later
option and is recorded in §7.

---

## 1. Shared constraints

These bind all three features and are the ones most likely to be missed.

### 1.1 No inline styles — CSP

Production CSP is `style-src 'self' 'nonce-…'`. The browser strips the inline
`style` attribute, and Tailwind cannot generate an arbitrary-value class from
a runtime number. Every data-driven dimension must therefore be **SVG geometry
attributes** (`x`, `y`, `width`, `height`, `d`, `viewBox`) or a static utility
class — the pattern `AttributeBars` already uses in
[card-stats.tsx](../src/components/card-stats.tsx).

Practical effect: **no charting library.** Recharts, Chart.js, D3's default DOM
output, and every library that positions with inline `style` are ruled out.
The graph is hand-written inline SVG in a server component.

Similarly `font-src` is `'self'` — no webfont CDN. Both faces are already
self-hosted through `next/font`.

### 1.2 Read-only; server authority unaffected

None of these three features writes anything. No wallet, card-ownership,
listing, pack or rating write path is touched, so no `BUILD_SPEC.md` Part L
invariant is engaged. That is deliberate and should stay true: if a build step
finds itself adding an RPC that moves coins or cards, the scope has drifted and
needs its own ADR.

### 1.3 Migration budget

Hosted migrations are deployed only from `VibeTrunk/supabase` and are
risk-tiered (ADR-032). Total ask across all three features:

- **Feature A (graph): no migration.** Everything it needs is already in
  `kut.player_rating_snapshots` and `kut.attendance`.
- **Feature B (album): no migration.** `kut.my_collection_cards` and
  `kut.player_directory` already carry every column, including
  `player_id`, `archetype`, `photo_path`, `active_listing_id` and
  `held_by_offer_id`.
- **Feature C (Chronicle): one *additive* migration**, two views. Additive tier
  — rides the last scheduled backup, changes no data, rolls back with two
  `drop view` statements.

### 1.4 Week arithmetic

`week_start = date_trunc('week', session_date)::date` — the ISO Monday. This is
the exact expression `_rebuild_season_core` uses
([20260816020000](../supabase/migrations/20260816020000_publish_and_rebuild_sessions.sql):33)
and the value stored in `player_season_state.last_week_start`, which the
ADR-031 trigger copies into `player_rating_snapshots.week_start`.

Every week key in all three features **must** be derived this way, so the
graph, the Chronicle and the rating engine agree by construction. Do not
introduce a second week convention (`extract(week …)`, a Sunday start, a
locale-dependent `Intl` week).

### 1.5 Snapshots are append-only and never corrected

The rebuild sets `last_week_start` to the season's most recent published week
for every player, so correcting a *past* session re-runs the fold but only
overwrites the **current** week's snapshot row. Historical rows are never
revised.

For a chronicle that is a feature, not a bug — the record says what was true at
the time. But it must be stated plainly in the graph's caption, so a member who
spots a discrepancy after an attendance correction is not left confused.

### 1.6 Design language

Everything inherits ADR-043's material ladder and app chrome, unchanged:

- `.board-ground` page background, `.display` (Instrument Serif) headings,
  Archivo for all interface text and every number (`tabular-nums`);
- brass `#e0ac4a` as the single accent; `moss` positive, `brick` negative,
  `steel` neutral-informational;
- the six tier stocks already defined as `.tier-chip[data-rarity]` in
  `globals.css` — reuse those exact values anywhere a tier is drawn outside a
  card;
- `LiveCard` is the only card renderer. Do not fork it; extend it by props.
- minimum touch target 44px (`min-h-11`), matching every existing control.

### 1.7 Accessibility

`BUILD_SPEC.md` Part XVIII applies. For the two new visual surfaces:

- the chart carries `role="img"` and an `aria-label` stating the range in
  words, plus a visually-hidden `<table>` of the same numbers;
- tier is never signalled by colour alone — the existing rule is hue **plus**
  pennant silhouette **plus** the tier word, and the album's lens chips, empty
  slots and the graph's band labels must keep that;
- an uncollected album slot needs an accessible name that says so ("Ruben de
  Vries — not collected"), not merely a visual ghost.

---

## 2. Feature A — Rating history graph

### 2.1 What it replaces

The `RatingHistory` bar sparkline in
[card-stats.tsx:56-101](../src/components/card-stats.tsx#L56-L101), rendered on
`/players/[slug]` under `AttributeBars`. That component is deleted; the export
name may be reused.

What it must beat: 8 bars, no axis, no scale, no tier context, no dates beyond
a start–end caption, and it hides itself entirely below two snapshots.

### 2.2 Route and placement

`/players/[slug]` only, in the right-hand column beneath `AttributeBars`, above
the fold at 1280px.

`/club/collection/[cardId]` gains a one-line link — "See Ruben's rating history
→" — pointing at the player profile. No second copy of the chart.

### 2.3 Data

One changed query and one added query, both inside the `Promise.all` the page
already runs:

```
kut.player_rating_snapshots
  select week_start, live_ovr, rarity_tier
  where player_id = <id> and season_id = <active season id>
  order by week_start asc
```

Scoping to the active season is new — today's query is unscoped and
`limit(8)`. The active season id comes from `kut.seasons where is_active`,
already readable by `authenticated` ("authenticated users read seasons",
[20260816010000](../supabase/migrations/20260816010000_phase_1a_roster_and_ratings.sql):141).

Goals per week, for the goal markers:

```
kut.attendance a join kut.match_sessions s on s.id = a.session_id
  select s.session_date, a.goals
  where a.player_id = <id> and s.status = 'published'
```

grouped in TypeScript into `week_start` buckets using §1.4 semantics. Members
already have RLS select on published attendance, and `/sessions/[id]` renders
it club-wide today, so this is no new disclosure.

Both queries are non-critical: a failure renders the profile without the chart,
exactly as the page already treats snapshots.

### 2.4 Chart specification

A **line chart** — one polyline through one point per published football week —
over horizontal tier bands.

**Scale.** X is ordinal by week index, not by date: gaps between published
weeks show up in the *labels*, not as blank horizontal space, so a holiday does
not stretch the chart. Y is `live_ovr`.

The Y domain is **fixed to the tier band containing the series, plus one band
either side**, clamped to the engine's bounds (`live_ovr` is checked `between
30 and 83` on the snapshot table; the engine floor is 30). Never auto-fit Y
tightly to the data — the old sparkline did (`min-3` to `max+2`), which makes a
one-point wobble look like a collapse. A fixed, band-aligned domain is what
makes "how close am I to Gold" honest.

**Tier bands.** Full-width horizontal bands behind the line at the engine's own
thresholds ([rating-engine.ts:144-151](../src/game/rating-engine.ts#L144-L151)):

| Tier | From | To |
|---|---|---|
| Elite | 80 | — |
| Holo | 70 | 79 |
| Gold | 60 | 69 |
| Silver | 50 | 59 |
| Bronze | 40 | 49 |
| Common | — | 39 |

Each band is filled with its `.tier-chip` stock colour at low alpha and
labelled at the left edge with the tier word in `text-ink-faint`; the boundary
between bands is a 1px rule. This is the element that carries the whole feature
when a player has only one snapshot.

**Line and points.** Brass polyline, 2px, round joins. One dot per week; the
latest week's dot is filled brass and larger, earlier dots hollow. The latest
value is also set as a large `tabular-nums` numeral beside the chart — the one
genuinely good idea in the current sparkline, kept.

**Goal markers.** On any week where the player scored, a small brass triangle
below the axis with the goal count. Weeks with no goals get nothing — no zero
labels. Each marker's `<title>` reads "3 goals in this week". Worth saying in
the caption: goals feed Form, which is the temporary part of the line, so this
is what explains a spike that later fades.

**X labels.** The Monday of each week, `d MMM`. Above 10 weeks, label the
first, the last and every fourth in between; the rest keep their `<title>`.

**Tooltips.** Native SVG `<title>` per point and per marker — no JavaScript, no
client component, no inline style. A custom hover card is explicitly out of
scope for v1: it would force the whole profile into a client component for
marginal gain.

**Caption.** Beneath the chart in `text-ink-faint`: the range in words, plus the
append-only note from §1.5 — e.g. *"6 published weeks, 4 Aug – 1 Sep. Ratings
are recorded once per football week and are not revised if attendance is
corrected later."*

### 2.5 States

| Snapshots | Render |
|---|---|
| 0 | No chart frame. One line: "Ruben's rating history starts with the next published session." |
| 1 | **Bands + a single point, no line**, plus a distance-to-next-tier line: "6 OVR from Gold." |
| 2+ | Full chart as specified. |

The one-point state is the single most important piece of design work in this
feature, because with no backfill it is what almost everyone sees on day one.
It must look like a chart that has just started, not one that failed to load.

### 2.6 Responsive

- **Desktop (≥768px):** fills the right column, ~420×200px drawing area.
- **Mobile:** full width, ~180px tall; band labels move inside the bands at the
  left; x labels thin to first/last/every fourth regardless of count.
- The SVG scales by `viewBox`, so no horizontal scroll and no
  breakpoint-specific data fetching.

### 2.7 Acceptance criteria

1. A player with ≥2 snapshots in the active season shows a line with one point
   per published week, tier bands, and goal markers on scoring weeks.
2. A player with exactly 1 snapshot shows bands, one point and a
   distance-to-next-tier line — and no empty-state apology.
3. A player with 0 snapshots shows a single sentence and no chart frame.
4. Snapshots from a previous season never appear.
5. No inline `style` attribute exists anywhere in the rendered output.
6. Screen readers announce the range and can reach every value via the hidden
   table.
7. The profile page still renders if either query errors.

---

## 3. Feature B — Panini collection album

Design settled 2026-09-02 against the mockups. The spine is **pages**, not
archetypes — see §3.5 for why that change was forced.

### 3.1 Concept

`BUILD_SPEC.md` §41 already specifies this as "Collection album — Phase 2": a
roster-completion view, one slot per real Player, owned slots showing the card
and missing slots showing a silhouette and/or name. This spec fixes the open
choices in it.

The emotional job: make the *gap* visible. Today `/club/collection` shows what
you have; it can never show what you are missing, so there is no pull toward
the market and no reason to care about a duplicate.

The form is a **bound album you leaf through**, not a scrolling grid. Pages are
the structure: a fixed nine slots per page, desktop showing two facing leaves
as a spread, mobile showing one leaf. Page numbers are identical on both.

### 3.2 Route and modes

One route, two modes, on `/club/collection`:

| Mode | URL | Purpose |
|---|---|---|
| **Album** (default) | `/club/collection` | Completion. The roster as numbered slots, leafed page by page, gaps visible. |
| **Manage** | `/club/collection?view=manage` | Today's page unchanged — search, tier filter, sort, every individual copy, discard/list actions. |

A two-item segmented control sits directly under the page title. Album is the
default because completion is the more emotional read and because ROADMAP
phase D describes exactly this split ("the album view … alongside the current
grid as a management mode").

Album-mode query params:

- `page=N` — 1-based page number. Absent means page 1. Out-of-range 404s.
- `lens=all` (default) `| gaps | specialists | type:<archetype> | tier:<tier>`

Manage mode keeps its existing `q`, `rarity`, `sort` params untouched. Mode
params do not leak across modes. Changing the lens resets `page` to 1.

### 3.3 Data — no migration

Two queries the app already makes elsewhere:

- `kut.player_directory` — the denominator. Every `is_active and
  is_collectible` player with slug, display name, archetype, photo_path, live
  OVR, attributes and rarity tier.
- `kut.my_collection_cards` — the numerator. Already carries `player_id`,
  `archetype`, `ovr`, `rarity_tier`, `edition_title`, `is_live`,
  `discard_value`, `active_listing_id`, `held_by_offer_id`, `photo_path`.

Join in TypeScript on `player_id`. Both sets are tens-to-low-hundreds of rows;
the page already fetches the whole collection in one round trip and filters in
memory for exactly this reason. Fetching everything also keeps the header
totals and the page-index completion bars honest — they describe the whole
album, not the open page.

`resolvePhotoUrls` is called once, for the photo paths on the **open pages
only** — not the whole roster.

### 3.4 Pagination

**Order: alphabetical by `display_name`**, the same collation
`player_directory` already orders by. Confirmed 2026-09-02.

- **Page size: 9** (3×3 on a desktop leaf, 2 columns × 5 rows on mobile).
- 63 collectible players therefore make 7 pages; the last page is part-empty
  and simply ends — no filler slots.
- **Desktop** renders pages `2n-1` and `2n` as a spread; **mobile** renders one
  page. `?page=` always names a single page, so a link works on both: desktop
  opens the spread containing it.

**Slot numbers are positional, not permanent.** A slot's number is its index in
the current alphabetical ordering, so adding a player mid-alphabet shifts every
number after them. That is an accepted consequence of the alphabetical
decision, and it means:

- slot numbers may be *displayed*, but must never be used as an identifier, a
  URL, a stored reference, or anything a member is invited to quote ("I need
  number 12");
- deep links use `?page=N`, which is also positional — acceptable, since a page
  is a browsing position rather than a name for a player;
- a permanent numbering would need a stored `players.album_number` assigned
  once. Recorded in §7 as deferred, **not** built.

Pagination is computed after the lens is applied (§3.5), so page counts change
with the lens. This is what makes the album immune to any distribution of
players across archetypes.

### 3.5 Lenses — and why archetype is not the spine

The first design used archetype pages. That does not survive contact with the
data: `kut.players.archetype` defaults to `'all_rounder'`
([20260816010000](../supabase/migrations/20260816010000_phase_1a_roster_and_ratings.sql):7)
and only changes if a member visits `/settings/card`
(`set_own_player_archetype`, ADR-027) or an admin sets it. In practice roughly
**80% of the roster is All-rounder** — six near-empty pages and one page of
about fifty.

So archetype is demoted from structure to **lens**. A lens selects which
players are in the album; pagination then adapts:

| Lens | Set |
|---|---|
| `all` (default) | every `player_directory` row |
| `gaps` | uncollected only |
| `specialists` | every player whose archetype is **not** `all_rounder` |
| `type:<archetype>` | one of the seven archetypes |
| `tier:<tier>` | one of the six live tiers |

**`specialists` is the lens that earns its place**: it is the players who
actually chose a type, which is the only cut of the archetype data that means
anything while the default dominates. Its counterpart (All-rounders) is
reachable as `type:all_rounder`.

Two consequences worth stating plainly in the ADR:

- **The card face already shows the skew.** All-rounder offsets are all zero
  ([rating-engine.ts:55](../src/game/rating-engine.ts#L55)), so a default
  player's card carries six identical attribute numbers. The album does not
  hide this; it is a true rendering of the data.
- **`all_rounder` currently means two different things** — "deliberately a
  generalist" and "never touched the setting" — and nothing in the schema
  separates them. Any future copy claiming "N players haven't chosen a type"
  would be a guess. Distinguishing them needs a column; deferred (§7).

The album therefore does the one thing it legitimately can about the default:
a **personal nudge** in the header — "Your card is an All-rounder by default —
choose your type →", linking to `/settings/card`. Shown only when the viewer's
own linked player is `all_rounder`. It changes the only archetype a member is
allowed to change.

Lens controls render as a single row: `all` / `gaps` / `specialists` as chips
with counts, then two `<select>`s for type and tier. On mobile the row scrolls
horizontally.

### 3.6 The leaf

Each page is drawn as a leaf of a bound album:

- a warm panel a shade lighter than the board, rounded on the outer corners;
- a **gutter** between the two desktop leaves — a soft dark gradient with a
  1px brass centre line — which is what says "one bound object", not two panels;
- an outer **corner lift** on each leaf, so it reads as turnable;
- a page header: `Page 5`, the slot range, and an `n / 9` counter;
- the page number set small at the outer bottom corner.

**Turn controls.** Desktop: circular ‹ › buttons floating just outside the
spread, vertically centred. Mobile: two full-width buttons naming the
destination pages, plus horizontal swipe.

**Page index.** Below the spread, one chip per page carrying the page number
and a small completion bar (SVG geometry per §1.1), the open page(s)
highlighted. This is how "which page is my gap on?" gets answered without
scanning, and it is the element that replaces whole-roster scanning.

### 3.7 Slot states

Every slot keeps the card's 5:7 aspect ratio so the grid stays even. Above each
slot sits its number, in the manner of a printed album's numbered places.

| State | Rendering |
|---|---|
| **Collected, 1 copy** | The real `LiveCard`, unchanged. |
| **Collected, N copies** | The `LiveCard` with a stack: two offset card-edge slivers behind it, and an `×N` badge. The badge is itself a link to `/club/collection?view=manage&q=<name>` — the one place every individual copy is listed and actionable. |
| **Collected, listed** | The existing "Listed" pill, unchanged. |
| **Collected, in escrow** | An "In a trade offer" pill, from `held_by_offer_id`. New — the current grid does not surface escrow at all, and a card that cannot be listed or discarded should say so. |
| **Missing** | A recess pressed into the leaf: inset shadow, a dashed brass hairline inset, the `ShirtBack` art ghosted, the player's name letterpressed on a dimmed plate, and the tier pennant as an **outline** showing what the missing card would be. No OVR, no attributes. |
| **You** | If `profiles.player_id` matches the slot, a small brass "You" marker on the nameplate. Independent of collected state — you do not automatically own your own card. |

The missing slot must read as *a slot waiting to be filled*, not as a broken
card. It stays a link, pointing at `/players/<slug>` where the full live card
and stats are public anyway — so nothing is hidden, the album just withholds it
at slot size to create the pull.

### 3.8 Header and progress

Above the album:

- `47 / 63 TFH players collected` as the headline figure, in the `.display` face.
- A single completion bar (SVG geometry per §1.1).
- The existing secondary line — total cards, unique players, total discard
  value — kept, since it is the honest summary of what the album is worth.
- The Album / Manage segmented control, and the §3.5 personal nudge.

### 3.9 Client boundary and accessibility

Page turning is the one interactive element in these three features. Two
acceptable implementations; the ADR picks one:

1. **Server-rendered pages, links only.** `?page=N` is a normal navigation; ‹ ›
   are `<Link>`s. Zero client JS, the whole route stays a server component,
   back/forward and deep links work for free. No turn animation.
2. **A small client island** wrapping the spread, for swipe and an animated
   turn, with the links kept as the underlying navigation.

**Start with (1).** It is the smaller change, keeps the route a server
component, and the design does not depend on an animation. Add (2) later only
if leafing feels inert in use.

Accessibility, either way:

- ‹ › are real links/buttons with accessible names ("Previous page, pages 3–4");
- the page index is a list of links, not decoration;
- keyboard: left/right arrow keys turn pages when the album has focus;
- a **"Show all pages"** escape hatch renders every slot in one continuous run,
  for screen-reader users and for anyone who wants to scan — this is also the
  honest answer to pagination hiding things;
- every slot, filled or empty, is keyboard reachable with an accessible name
  that includes its state ("Ruben de Vries — not collected").

### 3.10 Explicitly out of scope

- **Completion rewards.** `BUILD_SPEC.md` §41 says "Completion rewards are later
  features", and any reward is a coin faucet or a card sink that must be
  balanced against Part L. The album is cosmetic in v1. The future home for
  rewards is the ROADMAP "Prestige + collections" item.
- **Other members' albums.** Card ownership is deliberately private
  (`my_collection_cards` is owner-scoped, `player_directory` hides who claimed a
  player). "See other members' squads" is a *blocked* roadmap item needing its
  own privacy ADR. The album is your own, only.
- **Sub-collections** (Monday regulars, 2026 debutants, season groups) — §41
  lists them as possibilities; deferred. The lens model is where they would go.
- **Stable slot numbers** — see §3.4 and §7.

### 3.11 Responsive

- **Desktop (≥1024px):** two leaves side by side, 3×3 each; the spread fills
  `max-w-6xl`. Cards land at roughly 159px wide — about 25% smaller than
  today's collection grid, which is the accepted cost of showing a spread.
- **Tablet / narrow desktop:** one leaf, 3×3.
- **Mobile:** one leaf, 2 columns × 5 rows, cards at roughly 149px.
- Turn controls move from floating circles to full-width buttons below the leaf.

### 3.12 Acceptance criteria

1. `/club/collection` renders the album by default; `?view=manage` renders
   today's grid with behaviour and URL params unchanged.
2. The denominator equals the `player_directory` row count exactly — inactive
   and non-collectible players never appear or count.
3. Slots are ordered alphabetically by `display_name` and paginated nine to a
   page; 63 players produce 7 pages with the last part-empty.
4. Desktop shows two pages as a spread, mobile one; `?page=5` opens the leaf
   containing slot 41 on both.
5. Owning any non-burned copy of a player, in any edition, fills that slot.
6. A player with 3 copies shows one card, a stack, and `×3` linking to manage
   mode pre-filtered to that name.
7. A listed card and an escrowed card each show their own pill.
8. Every lens re-paginates: `lens=specialists` on a 14-player set produces 2
   pages, and `page` resets to 1 when the lens changes.
9. The page index shows a completion bar per page that sums to the header total.
10. The personal nudge appears only when the viewer's own player is
    `all_rounder`, and links to `/settings/card`.
11. "Show all pages" renders every slot in the current lens in one run.
12. Left/right arrow keys turn pages; every slot is keyboard reachable with an
    accessible name that includes its collected state.
13. An out-of-range `?page=` returns 404.

## 4. Feature C — TFH Chronicle

### 4.1 Concept

Replaces `/sessions`. Where the current page is a list of dates, the Chronicle
is a weekly club paper: one issue per football week, telling the story of what
happened at TFH and what it did to the cards.

The football week is the unit because it is the rating engine's unit
(`BUILD_SPEC.md` §9): a Monday and a Friday in the same week share one activity
calculation, so "whose card moved" is only a truthful statement at week level.

### 4.2 Routes

| Route | Purpose |
|---|---|
| `/chronicle` | Index. Latest issue as a hero, then earlier issues newest-first. |
| `/chronicle/[week]` | One issue. `[week]` is the ISO Monday as `YYYY-MM-DD`, e.g. `/chronicle/2026-08-31`. |
| `/sessions` | Permanent redirect → `/chronicle`. |
| `/sessions/[sessionId]` | Permanent redirect → `/chronicle/<monday of that session>#s-<sessionId>`. |

`YYYY-MM-DD` rather than `2026-W36` because it *is* the `week_start` key from
§1.4 — no conversion, no ISO week-year edge cases at year boundaries, and it
sorts naturally.

Nav: the "Sessions" entry in the More menu becomes **"Chronicle"**
(`/chronicle`, `IconSessions` retained). The Home page link to `/sessions`
follows. Both are the only two references in the codebase.

### 4.3 Issue content — v1

Per the locked decision, v1 carries exactly three blocks.

**1. Issue header.**
- Kicker: `KUT Chronicle`.
- Title: the week, in the `.display` face — "Week of 31 August".
- Dateline: `31 August – 6 September 2026`.
- Standfirst: one generated sentence of totals — "Two sessions, 25 appearances,
  40 goals."

**2. Matchday reports** — one per published session in the week, in date order.
Each carries an `id="s-<sessionId>"` anchor (the redirect target) and shows:

- weekday, date and session type (Monday / Friday / Session);
- attendance count and total goals;
- who brought the bibs, named;
- the attendee list with per-player goals, sorted goals-desc then name — the
  existing `/sessions/[id]` ordering, preserved;
- `location` if set.

This is today's session detail page, restyled and nested. Nothing is lost in
the migration.

**3. Tier crossings** — players whose `rarity_tier` changed between their
previous snapshot week and this one, rendered as small tier-to-tier rows:
`Ruben de Vries — Silver → Gold`, with both tier chips.

**Direction: promotions only in v1.** A downgrade names someone for *not
turning up*, and the design principle the roadmap commits to is that KUT never
publishes a negative judgement of a member. The tier drop is still visible on
the member's own card and in the directory; the club paper simply does not run
a demotions column. *Flagged for confirmation — this is the one editorial call
in the feature.*

### 4.4 Reserved layout slots — designed, not built

The layout should leave room for these so adding them later is not a redesign.
They are **not** v1 deliverables and no code should be written for them:

- **Club desk** — the week's market sales, listings, trades and pack openings
  (all already in `kut.activity_feed`).
- **Kudos & goals** — output of the roadmap's "Real-life play → ratings"
  survey, if that ships.

### 4.5 Index page

- The latest issue rendered as a hero card: week title, standfirst, the
  matchday lines, and a link in.
- Then earlier issues as compact rows: week, session count, appearances, goals.
- Weeks with **no published session produce no issue** (§9 — a week without a
  published session does nothing to anyone). There is no "quiet week" placeholder.

### 4.6 Data — one additive migration

Computed live, so an attendance correction retroactively fixes an old issue.
That is the correct behaviour here: the Chronicle then always agrees with the
ratings people can see.

Two new views, `security_invoker = true` (every underlying select is already
permitted to members), one migration, additive tier:

**`kut.chronicle_weeks`** — one row per football week with a published session:

```
week_start        date      -- date_trunc('week', session_date)::date
week_end          date      -- week_start + 6
session_count     integer
appearance_count  integer   -- attendance rows, i.e. appearances not people
attendee_count    integer   -- distinct players
goal_count        integer
```

over `kut.match_sessions` (status = 'published') left-joined to
`kut.attendance`, grouped by `week_start`.

**`kut.chronicle_tier_changes`** — per player per week, the tier they moved
from and to:

```
week_start   date
player_id    uuid
slug         text
display_name text
photo_path   text
from_tier    text
to_tier      text
live_ovr     integer
```

over `kut.player_rating_snapshots` with `lag(rarity_tier) over (partition by
player_id, season_id order by week_start)`, joined to `kut.players`, filtered to
rows where the tier actually changed and the previous value is not null. The
view exposes both directions; the *page* filters to promotions (§4.3), so
reversing that editorial call later needs no migration.

The matchday reports themselves need no new view — they use the existing
`kut.published_sessions` (added by ADR-044) plus `kut.attendance` joined to
`kut.players`, exactly as `/sessions/[sessionId]` does today.

Rollback: `drop view kut.chronicle_tier_changes; drop view
kut.chronicle_weeks;`

*Zero-migration alternative, if the migration slot is not wanted:* both views
can be computed in TypeScript from `published_sessions`, `attendance` and
`player_rating_snapshots`. It costs a `lag()` reimplementation and more rows
over the wire, and gives pgTAP nothing to test. The migration is recommended.

### 4.7 States

| Condition | Render |
|---|---|
| No published sessions at all | Index shows one line: "The first issue arrives when a session is published." |
| An issue's week has fewer than two snapshot weeks behind it | The tier-crossings block is **omitted entirely** — no heading, no empty box. |
| No tier changed in a week that has enough history | Same: block omitted. |
| A session with zero attendance rows | The matchday report still appears, with "No attendance was recorded." |

### 4.8 Privacy

Member-only, behind `requireUser()`, like every other page. No public route, no
share token, no OG image, no external link. An issue names who attended, who
scored and who brought the bibs — all already club-visible today via
`/sessions/[id]` and the activity feed — and it must not become the surface
that leaks them outside TFH.

### 4.9 Responsive

- **Desktop:** single column, `max-w-3xl`, newspaper measure. Matchday reports
  as stacked sections; the tier-crossings block as a right-hand aside at
  ≥1024px if the design wants it, otherwise stacked.
- **Mobile:** one column throughout; the attendee list is the same bordered row
  list `/sessions/[id]` uses today.
- Issue navigation: previous/next week links at the foot of each issue, plus
  the back link to the index.

### 4.10 Acceptance criteria

1. `/chronicle` lists exactly the weeks that contain ≥1 published session,
   newest first, latest as a hero.
2. `/chronicle/2026-08-31` renders every published session in that ISO week as a
   matchday report, in date order.
3. `/sessions` and `/sessions/<id>` permanently redirect, and the old session's
   anchor is scrolled to.
4. Bibs bringer, attendee list and per-player goals match what
   `/sessions/[id]` showed before the migration, exactly.
5. The tier-crossings block is absent — not empty — when there is nothing to
   say.
6. A malformed `[week]` param (not `YYYY-MM-DD`, or a date that is not a Monday,
   or a week with no published session) returns 404.
7. Correcting a published session's attendance changes the affected issue on
   next render.
8. No route is reachable without authentication.

---

## 5. Migration summary

| Feature | Migration | Tier (ADR-032) | Rollback |
|---|---|---|---|
| A — graph | none | — | — |
| B — album | none | — | — |
| C — Chronicle | `kut.chronicle_weeks`, `kut.chronicle_tier_changes` | additive | two `drop view` |

One additive migration total. It changes no data, so it rides the last
scheduled backup; it is catalogued and pushed from `VibeTrunk/supabase`, never
from this repo.

---

## 6. Test plan

**pgTAP (`supabase/tests/database/`)**

- `chronicle_weeks` groups by ISO Monday and matches a hand-computed fixture for
  a week containing both a Monday and a Friday session.
- `chronicle_weeks` excludes draft and cancelled sessions.
- `chronicle_tier_changes` emits exactly one row per genuine tier change, none
  for an unchanged tier, and none for a player's first-ever snapshot.
- `chronicle_tier_changes` partitions by season — a change across a season
  boundary is not reported.
- Both views are selectable by `authenticated` and revoked from `anon`.

**Unit (Vitest)**

- Week bucketing helper agrees with `date_trunc('week')` across a year
  boundary, a leap day, and a Sunday/Monday session pair.
- Tier-band domain selection: a series inside Gold yields Silver–Holo bands; a
  series at the 30 floor does not produce a band below Common.
- Album pagination: alphabetical ordering, nine slots a page, 63 players
  producing 7 pages with a part-empty last page, and desktop spread pairing
  (page 5 sits with page 6).
- Album lenses: each lens narrows the set and re-paginates; `specialists`
  excludes `all_rounder`; changing lens resets the page; duplicate counting
  across editions is unaffected by the lens.

**Playwright**

- Album default renders page 1; turn controls and `?page=` navigate; an
  out-of-range page 404s; Manage toggle preserves its own params.
- "Show all pages" renders the full lens in one run.
- A player profile with 1 snapshot and one with ≥2 both render without error.
- `/sessions/<id>` redirects to the right issue anchor.
- Axe pass on `/chronicle`, `/chronicle/[week]`, `/club/collection` and
  `/players/[slug]`.

**Manual**

- Grep the built output for `style="` on all four routes — the CSP check that
  automated tests will not catch.

---

## 7. Deliberately deferred

Recorded so they are not silently dropped, and so a later session does not
re-litigate them:

- **Deterministic season backfill of `player_rating_snapshots`.** Would make the
  graph useful immediately instead of in a month. Declined for now; §10 of the
  spec makes it possible whenever wanted. Data-changing migration, needs a
  pgTAP proof that the rebuild reproduces current live state exactly.
- **Per-attribute history lines** (PAC/SHO/…). Derivable with no schema change
  from `live_ovr` + archetype offsets, but an archetype change would retroactively
  re-shape the historical lines; only the OVR line is exactly true forever.
- **Attendance timeline on the profile** — a played/missed strip per week.
  Complete data exists back to the season start.
- **Chronicle club desk** (market, packs) and **club-table movement**.
- **Chronicle demotion rows** — pending the §4.3 confirmation.
- **Album completion rewards**, **other members' albums**, **sub-collections**
  (the lens model is where sub-collections would go).
- **Permanent slot numbers** — a stored `players.album_number`, assigned once,
  so a member could say "number 12" and mean it. Alphabetical positional
  numbering was chosen instead (§3.4); this is the upgrade path if the numbers
  ever need to be quotable.
- **Distinguishing "chose All-rounder" from "never chose".** `archetype`
  defaults to `all_rounder` and nothing records whether a member set it
  deliberately, so no copy anywhere may claim how many players have not chosen.
  Needs a column (a nullable `archetype_set_at`, or making `archetype`
  nullable) plus a decision about what an unset card renders as.
- **Animated page turn / swipe** — §3.9 option (2). Ship the link-based
  pagination first.
- **Admin editorial note per session.** `match_sessions.notes` exists in the
  schema but is not editable in the admin UI; surfacing it in an issue would
  need a small admin addition first.
- **Chronicle sharing outside KUT** in any form.

---

## 8. Open question for the product owner

One editorial call is still open, flagged in §4.3:

> Should the Chronicle's tier-crossings block show **promotions only**, or both
> directions? The recommendation is promotions only — a demotions column names
> people for not turning up, which cuts against the principle that KUT rewards
> showing up and never publishes a negative judgement. Both directions is one
> filter change either way; the view supports both.
