# Implementation plan — rating history graph, Panini album, TFH Chronicle

Build plan for the three features specified in
[`SPEC_ALBUM_CHRONICLE_GRAPH.md`](SPEC_ALBUM_CHRONICLE_GRAPH.md). Rendered
designs — desktop and mobile per surface — are checked in at
[`docs/design/`](design/README.md).

**Read the spec first.** This document says *how and in what order*; the spec
says *what*. Where they disagree, the spec wins and this file is wrong.

| Slice | Feature | Migration | Branch | Proposed ADR |
|---|---|---|---|---|
| 0 | Shared groundwork | none | folded into slice 1 | — |
| 1 | Rating history graph | none | `feat/rating-history-graph` | ADR-047 |
| 2 | Panini collection album | none | `feat/collection-album` | ADR-048 |
| 3a | Chronicle views | **one, additive** | `feat/chronicle-views` (+ a PR in `VibeTrunk/supabase`) | part of ADR-049 |
| 3b | Chronicle UI | none | `feat/tfh-chronicle` | ADR-049 |

Three feature branches, four PRs, each squash-merged. Never commit to `main`.
**Executing it all in one pass instead? Read §0 first — the branch/PR shape
changes and there is a hard human step in the middle.**

---

## 0. Before writing any code

Four things, in this order. Each exists because skipping it produces a
predictable, expensive kind of wrong.

### 0.1 Read these, in this order

1. `CLAUDE.md` — canonical project guidance (`AGENTS.md` points here; do not
   read one instead of the other).
2. [`SPEC_ALBUM_CHRONICLE_GRAPH.md`](SPEC_ALBUM_CHRONICLE_GRAPH.md) — **in
   full**, including §0 (locked decisions), §1 (shared constraints) and §7
   (deliberately deferred).
3. [`design/`](design/README.md) — the eight rendered mockups. These are the
   visual source of truth.
4. This plan.

### 0.2 The design reference is in the repo

[`docs/design/`](design/README.md) holds a PNG per surface, desktop and mobile,
rendered at native size, with an index mapping each to its route and spec
section. Look at the one for the surface you are building **before** writing
its markup. Two things there are commonly mistaken for bugs — all-rounder cards
showing six identical numbers, and slot numbers starting at 37 — and the index
explains both.

### 0.3 This is not the Next.js in your training data

The repo runs **Next 16.3.1**. `AGENTS.md` carries a standing warning that this
version's APIs, conventions and file structure differ from training data, and
that the guides in `node_modules/next/dist/docs/` are authoritative.

In practice the trap is route signatures. `params` and `searchParams` are
**Promises** and must be awaited:

```ts
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
```

Every existing route already does this. **Copy the shape from a neighbouring
page rather than recalling it** — `src/app/(app)/players/[slug]/page.tsx` for a
dynamic route, `src/app/(app)/club/collection/page.tsx` for one reading
`searchParams`. The same goes for the Supabase client
(`await createClient()`, `.schema("kut")`), auth (`await requireUser()`), and
photo URLs (`resolvePhotoUrls`): the conventions are established, and matching
them matters more than any preference.

### 0.4 Two rules from `CLAUDE.md` that bite on this work

- **Never `supabase db push` from this repo.** Hosted migrations are catalogued
  and deployed only from `VibeTrunk/supabase`. Writing and locally testing the
  migration here is correct; deploying it from here is not.
- **Never commit to `main`.** Branch, push, open a PR. Branch protection will
  reject a direct push anyway.

---

## 0b. Executing in one pass

If a single agent is building all four slices in one run, the slice
*ordering* still holds but the branch/PR shape collapses:

- **One branch**, `feat/album-chronicle-graph`.
- **One commit per slice**, in the §9 order, with the slice name in the subject
  (`feat: rating history graph (ADR-047)`). This keeps review legible and lets
  a single slice be reverted without unpicking the rest.
- **One PR** at the end, or two if you want the migration reviewed separately.

Two things do **not** collapse:

1. **Slice 1 must precede slice 3b.** Slice 3b imports
   `src/game/football-week.ts`, which slice 1 creates. Build in order.
2. **The hosted migration push is a human step in the middle.** The agent
   writes `20260913000000_chronicle_views.sql` and its pgTAP, and verifies both
   locally. It cannot deploy them: the push happens from `VibeTrunk/supabase`,
   with approval, and is deliberately outside the agent's allow-list.

   > **Therefore: the PR must not be merged, and no Vercel preview of it will
   > work, until that push has happened.** Previews run against the real hosted
   > Supabase; every `/chronicle` route 500s until `kut.chronicle_weeks` exists.
   > Say so explicitly in the PR description so it is not merged by reflex.

Run `npm run verify:fast` after each slice rather than only at the end — a
type error from slice 1 surfacing during slice 3 is much harder to place. Run
the CSP grep (§6) after each slice that adds a route.

---

## 1. Why this order

**Graph first.** Smallest surface, no migration, and it is where the
hand-rolled SVG charting pattern gets established under the CSP constraint
(§1.1). Nothing else depends on it, so if the pattern needs a second pass it is
cheap to redo. It also forces the shared week helper (§2.1) into existence
before the Chronicle needs it.

**Album second.** No migration, largest UI, entirely contained in
`/club/collection`. Independent of slice 1 — could run in parallel if two
people are working, but the shared week helper is not needed here so there is
no coupling either way.

**Chronicle last, and split in two.** It is the only slice needing a hosted
migration, and it retires two live routes. Splitting the views from the UI
matters for a specific reason:

> **The additive views must be deployed to the hosted `kut` schema *before* the
> Chronicle UI branch reaches a Vercel preview or production.** Preview deploys
> run against the real hosted Supabase project. A preview of `feat/tfh-chronicle`
> would 500 on every `/chronicle` route until `kut.chronicle_weeks` exists.

Because the views are additive and no existing code reads them, pushing them
early is safe and unobservable. Do 3a completely — including the hosted push —
before opening the 3b PR.

---

## 2. Slice 1 — Rating history graph

Branch `feat/rating-history-graph`. Spec §2.

### 2.1 Shared groundwork (do this first, in this branch)

**`src/game/football-week.ts`** — new. The single TypeScript expression of the
football week, mirroring `date_trunc('week', session_date)::date` (spec §1.4).
The Chronicle imports the same module in slice 3.

```ts
/** ISO Monday of the week containing this YYYY-MM-DD date, as YYYY-MM-DD. */
export function weekStart(isoDate: string): string
/** Inclusive week end (Sunday), as YYYY-MM-DD. */
export function weekEnd(weekStartIso: string): string
```

> **Trap.** Do **not** implement this with `new Date(iso)` plus local getters.
> `new Date("2026-08-31")` parses as UTC midnight and local getters then shift
> the day for any viewer west of UTC, which would silently file a session into
> the wrong week. Use `Date.UTC` / `getUTC*` throughout, or plain string
> arithmetic. (`src/lib/format.ts` already has this latent shift, but it is
> display-only and out of scope here — do not "fix" it in this slice.)

Unit tests: a year boundary, a leap day, a Sunday/Monday session pair, and a
run under `TZ=America/New_York` to prove the UTC handling.

### 2.2 Work

| File | Change |
|---|---|
| `src/components/card-stats.tsx` | Delete `RatingHistory` and `RatingSnapshot`. `AttributeBars` stays untouched. |
| `src/components/rating-history.tsx` | **New.** The chart, per spec §2.4–2.5. Server component, inline SVG only. Takes `{ snapshots, goalsByWeek, playerName }`. |
| `src/app/(app)/players/[slug]/page.tsx` | Scope the snapshot query to the active season and drop `limit(8)`; add the goals-per-week query; render the new component. |
| `src/app/(app)/club/collection/[cardId]/page.tsx` | Add the one-line "See <name>'s rating history →" link to `/players/<slug>`. Needs `player_slug` adding to that page's `select` — the view already exposes it. |

Chart internals worth pinning down before writing code, all in spec §2.4:

- Y domain is the tier band containing the series **plus one band either side**,
  clamped to 30–83. Never auto-fit.
- X is ordinal by week index, not by date.
- Tier thresholds come from `getRarityTier` in
  [`rating-engine.ts:144`](../src/game/rating-engine.ts#L144) — import the
  boundaries, do not retype them.
- Tier band fills reuse the `.tier-chip[data-rarity]` stock colours from
  `globals.css`.
- Tooltips are native SVG `<title>`. No client component, no JS.

### 2.3 Tests

- **Unit** (`tests/unit/football-week.test.ts`): as §2.1.
- **Unit** (`tests/unit/rating-history.test.ts`): pure domain-selection helper —
  a Gold-band series yields Silver→Holo; a series at the 30 floor produces no
  band below Common; a series spanning three bands widens correctly.
- **E2E** (`tests/e2e/player-profile.spec.ts`): a player with ≥2 snapshots
  renders a `polyline`; a player with exactly 1 renders the distance-to-tier
  line and no `polyline`; a player with 0 renders neither and does not error.
- **Manual/CI**: `grep -r 'style="' .next/server/app/(app)/players` — must find
  nothing. This is the CSP check no automated test covers.

### 2.4 Done when

Spec §2.7 (1)–(7) all hold, `npm run verify:fast` is green, and ADR-047 is
written. No `BUILD_SPEC.md` change: the graph alters no game rule, invariant,
public API or acceptance criterion — record that reasoning in the ADR so the
omission is deliberate rather than an oversight.

---

## 3. Slice 2 — Panini collection album

Branch `feat/collection-album`. Spec §3.

### 3.1 Pure logic first

**`src/lib/album.ts`** — new, and the part that carries the tests. Keep it
free of React and of Supabase so it is unit-testable in isolation.

```ts
export type AlbumSlot = {
  index: number;            // 1-based positional slot number (§3.4)
  player: DirectoryRow;
  copies: CollectionCard[]; // empty = a gap
};
export type Lens =
  | { kind: "all" } | { kind: "gaps" } | { kind: "specialists" }
  | { kind: "type"; archetype: Archetype } | { kind: "tier"; tier: RarityTier };

export function buildSlots(roster, owned): AlbumSlot[]
export function applyLens(slots, lens): AlbumSlot[]
export function paginate(slots, page, perPage): { pages, slots, total }
export function spreadFor(page): [left: number, right: number | null]
```

> **Trap — ordering must be total.** Sort by `display_name` **then `id`**. Two
> players sharing a display name with only a name-based sort gives Postgres and
> JS licence to return them in either order, so slot numbers and page contents
> could shuffle between requests. A tiebreak on `id` makes pagination stable.

Slot numbers are assigned over the **unlensed** roster (so a player's number is
the same whichever lens you arrive through), while pagination runs over the
**lensed** set. Spec §3.4–3.5.

### 3.2 Components

New directory `src/components/album/`:

| File | Role |
|---|---|
| `album-slot.tsx` | One slot: filled (`LiveCard` + optional stack/`×N`/pills) or the empty recess. Do **not** fork `LiveCard`. |
| `album-leaf.tsx` | One page: header (`Page N`, slot range, `n / 9`), 3×3 grid, page number, corner lift. |
| `album-spread.tsx` | Desktop: two leaves + gutter + ‹ › turn links. Mobile: one leaf + turn buttons. |
| `page-index.tsx` | Per-page completion chips (SVG geometry). |
| `lens-bar.tsx` | Lens chips + the two `<select>`s. |

### 3.3 Route

`src/app/(app)/club/collection/page.tsx` becomes a thin dispatcher on
`?view=`; today's grid moves to a `manage-view.tsx` **unchanged** — same
params, same behaviour, same markup. Resist the urge to tidy it in this slice.

- Pagination is **link-based only** (spec §3.9 option 1). ‹ › and the page
  index are `<Link>`s to `?page=N`; the route stays a server component; no
  client island. Back/forward and deep links work for free.
- `?page=all` renders the "Show all pages" escape hatch.
- Out-of-range `?page=` → `notFound()`.
- Changing lens resets `page` to 1.

**Photo URLs.** Call `resolvePhotoUrls` for the **open pages only** (≤18 paths),
not the whole roster — signed-URL generation is the one place this page can get
expensive. The `?page=all` view is the exception and resolves everything.

**Nudge.** Render only when the viewer's own `profiles.player_id` resolves to a
player whose `archetype = 'all_rounder'`. Copy must address the viewer about
their own card and must never state how many players "haven't chosen" — the
schema cannot distinguish that (spec §3.5, §7).

### 3.4 Tests

- **Unit** (`tests/unit/album.test.ts`): alphabetical + `id` tiebreak ordering;
  63 players → 7 pages with a part-empty last page; `spreadFor(5) === [5, 6]`;
  each lens narrows and re-paginates; `specialists` excludes `all_rounder`;
  duplicate counting across editions; slot numbers stable across lenses.
- **E2E** (`tests/e2e/collection-album.spec.ts`): album is the default;
  `?view=manage` renders the old grid with its params intact; turn links move
  pages; out-of-range 404s; `?page=all` renders every slot; arrow keys turn.
- **Axe** on `/club/collection` in both modes.

### 3.5 Docs

- ADR-048.
- `BUILD_SPEC.md` §41 rewritten from "Collection album — Phase 2" to the built
  design, and removed from Phase 2 scope in Part XXXIV. This one **is** a spec
  change — §41's "possible subcollections" list is superseded by the lens model.

---

## 4. Slice 3a — Chronicle views

Branch `feat/chronicle-views` here, plus a PR in `VibeTrunk/supabase`.

### 4.1 The migration

`supabase/migrations/20260913000000_chronicle_views.sql` — two views, spec §4.6.
Additive tier (ADR-032): no data change, rides the last scheduled backup,
rollback is two `drop view` statements.

- `kut.chronicle_weeks` — one row per football week containing a published
  session: `week_start`, `week_end`, `session_count`, `appearance_count`,
  `attendee_count`, `goal_count`.
- `kut.chronicle_tier_changes` — `lag(rarity_tier) over (partition by
  player_id, season_id order by week_start)` over `player_rating_snapshots`,
  joined to `kut.players`, emitting `from_tier` / `to_tier` where they differ
  and the previous value is not null. Exposes **both** directions; the page
  filters to promotions, so reversing that editorial call later needs no
  migration.

Both `security_invoker = true` — every underlying select is already permitted
to members. `grant select … to authenticated, service_role`.

Follow the file conventions of
[`20260912000000_tester_feedback_round_2.sql`](../supabase/migrations/20260912000000_tester_feedback_round_2.sql):
a header comment saying what, why, the ADR, the tier, and the rollback DDL.

### 4.2 pgTAP

`supabase/tests/database/chronicle_views.test.sql`, modelled on
`published_sessions.test.sql`:

1. Both views exist.
2. `chronicle_weeks` groups by ISO Monday — a fixture week holding both a
   Monday and a Friday session yields **one** row with summed counts.
3. Draft and cancelled sessions are excluded.
4. A week with no published session produces no row.
5. `chronicle_tier_changes` emits exactly one row per genuine change.
6. No row for an unchanged tier, and none for a player's first-ever snapshot.
7. A change across a **season boundary** is not reported (this is what the
   `partition by … season_id` is for — test it explicitly).
8. Both views selectable by `authenticated`, revoked from `anon`.

Run locally per the established workflow — `supabase db reset` is deny-listed;
apply the migration and run pgTAP through
`docker exec supabase_db_kut psql`.

### 4.3 Deploy

Catalogue the migration in `VibeTrunk/supabase` and push from there — **never**
`supabase db push` from this repo. Additive tier: `db push --dry-run` first,
review the listed migrations, then the real push with approval.

**Slice 3a is not done until the hosted push has happened.** Only then open the
3b PR.

---

## 5. Slice 3b — Chronicle UI

Branch `feat/tfh-chronicle`. Spec §4.

### 5.1 Routes

| Path | Action |
|---|---|
| `src/app/(app)/chronicle/page.tsx` | **New.** Index: hero latest issue + back-issue run. |
| `src/app/(app)/chronicle/[week]/page.tsx` | **New.** One issue. `[week]` is the ISO Monday, `YYYY-MM-DD`. |
| `src/app/(app)/sessions/page.tsx` | **Delete.** Replaced by a permanent redirect in `next.config.ts`. |
| `src/app/(app)/sessions/[sessionId]/page.tsx` | **Replace** with a lookup-and-redirect server component (below). |

`next.config.ts` currently declares no `redirects()` — add one for
`/sessions` → `/chronicle`, `permanent: true`.

`/sessions/[sessionId]` cannot be a config redirect because the target week
depends on the session's date. Keep the route as a server component that looks
up the published session, then `redirect()`s to
`/chronicle/<weekStart(session_date)>#s-<sessionId>`, and `notFound()`s for an
unknown, draft or cancelled id. Both existing links (Home and the nav item)
should be repointed at `/chronicle` in the same PR, so the redirects exist only
for bookmarks and old message links.

### 5.2 Validation

`[week]` must be rejected unless it is a well-formed `YYYY-MM-DD`, **is a
Monday**, and has a `chronicle_weeks` row. Anything else `notFound()`s. Reuse
`weekStart()` from slice 1 for the Monday check rather than writing a second
one.

### 5.3 Content

Per spec §4.3, v1 carries exactly three blocks: issue header, matchday reports,
tier crossings. Nothing else — the club desk and kudos slots are layout space,
not code (§4.4).

- Matchday reports reuse `kut.published_sessions` + `kut.attendance` joined to
  `kut.players`, i.e. exactly what `/sessions/[sessionId]` does today. The
  attendee list ordering (goals desc, then name) must be preserved verbatim —
  spec §4.10 (4) makes that an acceptance criterion.
- Tier crossings render **promotions only**, filtering the view. The block is
  omitted entirely — no heading, no empty box — when there is nothing to say.
- `src/lib/chronicle.ts` for the pure grouping/labelling helpers, importing
  `weekStart` from `src/game/football-week.ts`.

### 5.4 Nav

`src/components/app-shell/nav-items.tsx`: the "Sessions" entry in
`buildMoreNavItems` becomes `{ href: "/chronicle", label: "Chronicle", Icon:
IconSessions, isActive: prefixed("/chronicle") }`. Icon unchanged.

### 5.5 Tests

- **Unit** (`tests/unit/chronicle.test.ts`): week grouping and issue numbering;
  a week with one session and a week with two; label formatting.
- **E2E** (`tests/e2e/chronicle.spec.ts`): index lists only weeks with a
  published session; an issue renders every session in its week in date order;
  `/sessions` and `/sessions/<id>` redirect, and the anchor is present; a
  malformed and a non-Monday `[week]` 404; no route reachable unauthenticated.
- **Axe** on both routes.

### 5.6 Docs

- ADR-049 — including the promotions-only editorial call and its reasoning.
- `BUILD_SPEC.md`: Part XVII §46 (navigation) updated for the `/chronicle`
  entry replacing `/sessions`, plus a new Chronicle section describing the
  weekly-issue model. The nav is a public surface, so this is a required spec
  change.

---

## 6. Verification

Per slice, before opening the PR:

```bash
npm run verify:fast          # lint + typecheck + unit
npm run test:e2e             # the new spec plus the existing suite
npm run build                # catches server/client boundary mistakes
```

Slice 3a additionally runs pgTAP through
`docker exec supabase_db_kut psql` (not `supabase db reset` — deny-listed).

Before the final merge, one `npm run verify:full` with Docker running.

**The CSP grep is not covered by any of the above.** After `npm run build`, on
each slice:

```bash
grep -rn 'style="' .next/server/app | grep -v node_modules
```

Must return nothing for the new routes. A hit means a runtime-computed
dimension leaked into an inline style and will be stripped in production
(spec §1.1).

---

## 7. Risks and traps

Ordered by how likely they are to be missed.

1. **Inline styles.** The single most likely defect, and it is invisible in
   `npm run dev` — the dev CSP is looser than production. The grep above is the
   only reliable catch.
2. **Migration before preview.** §1. A `feat/tfh-chronicle` preview deploy
   against a hosted schema without `chronicle_weeks` 500s on every route.
3. **Non-total sort order.** §3.1. Two players sharing a display name will
   shuffle slot numbers and page contents between requests without an `id`
   tiebreak.
4. **Local-time date parsing.** §2.1. `new Date("2026-08-31")` plus local
   getters shifts the day west of UTC and files sessions into the wrong week.
5. **Sparse-history states.** Fixtures must include a player with exactly one
   snapshot and one with none. With no backfill, the one-point state is what
   most players actually have at launch — if it is only exercised by hand, it
   ships broken.
6. **Season boundary in `lag()`.** Without `partition by … season_id`, the
   first snapshot of a new season reads as a tier change from the old one.
7. **Signed-URL cost on the album.** Resolving photos for all 63 players on
   every page view is wasteful; resolve the open pages only.
8. **`/sessions/[sessionId]` for a draft or deleted session** must `notFound()`,
   not throw or redirect to a non-existent issue.
9. **Manage mode regressions.** Moving the existing grid into a sub-component
   is the easiest place to silently change behaviour. Its params and markup
   should come out byte-identical.

---

## 8. Out of scope — do not build

Listed because each is a plausible-looking temptation mid-build. All are
recorded in spec §7.

- Any snapshot backfill.
- Per-attribute history lines, or an attendance timeline on the profile.
- Chronicle club desk (market/packs), club-table movement, or demotion rows.
- Any Chronicle sharing surface — no public route, no share token, no OG image.
- Album completion rewards, other members' albums, sub-collections.
- A stored `players.album_number`, or a column distinguishing "chose
  All-rounder" from "never chose".
- An animated page turn or swipe island.
- Fixing `formatDate`'s latent timezone shift.

If a slice finds itself adding an RPC that moves coins or cards, the scope has
drifted: stop and write an ADR first (spec §1.2).

---

## 9. Sequence summary

1. `feat/rating-history-graph` — week helper, chart, profile + card-detail
   link, ADR-047. → PR, merge.
2. `feat/collection-album` — album lib, components, route split, ADR-048,
   `BUILD_SPEC.md` §41. → PR, merge.
3. `feat/chronicle-views` — migration + pgTAP. → PR, merge. Then catalogue and
   push from `VibeTrunk/supabase`, and confirm the hosted views exist.
4. `feat/tfh-chronicle` — index, issue, redirects, nav, ADR-049,
   `BUILD_SPEC.md` §46 + new Chronicle section. → PR, merge.
5. One `PROGRESS.md` entry per merged slice, and update `CLAUDE.md`'s "Current
   hosted deployment" section after the step-3 push.
