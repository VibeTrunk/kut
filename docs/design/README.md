# Design reference — album, Chronicle, rating history

Rendered mockups for the three features specified in
[`../SPEC_ALBUM_CHRONICLE_GRAPH.md`](../SPEC_ALBUM_CHRONICLE_GRAPH.md) and
built per [`../PLAN_ALBUM_CHRONICLE_GRAPH.md`](../PLAN_ALBUM_CHRONICLE_GRAPH.md).

**These are the visual source of truth for the build.** Where the prose and a
mockup disagree on layout, follow the mockup and note it; where they disagree
on a *rule* (what data is shown, what is omitted, what a state does), the spec
wins.

Rendered at native size (desktop 1440px, mobile 390px) from the Claude Design
canvas artboards. Regenerate by re-rendering the `.dc.html` artboards in
`/design` at the sizes in `design/canvas.json`.

| File | Route | Spec | Look for |
|---|---|---|---|
| `main.png` | `/club/collection` desktop | §3 | The bound spread: two leaves, gutter, page headers, turn arrows, page index with per-page completion bars |
| `album-mobile.png` | `/club/collection` mobile | §3 | One leaf, 2 columns × 5 rows, turn buttons naming their destination, same page numbers as desktop |
| `chronicle-index.png` | `/chronicle` desktop | §4.5 | Masthead, latest issue as hero, back-issue run |
| `chronicle-index-mobile.png` | `/chronicle` mobile | §4.5 | Same, stacked; tallies fold into one line per issue |
| `chronicle.png` | `/chronicle/[week]` desktop | §4.3 | Masthead, standfirst, two matchday reports, two-column attendee lists, crossings |
| `chronicle-mobile.png` | `/chronicle/[week]` mobile | §4.9 | Single-column attendee lists; crossing rows stack name/OVR over the tier move |
| `graph.png` | `/players/[slug]` desktop | §2 | Tier bands behind the line, goal markers under the axis, and the one-point "first week" state study |
| `graph-mobile.png` | `/players/[slug]` mobile | §2.6 | Bands run full width with labels inside; x labels thinned to first/middle/last |

## What the mockups are showing

The sample roster is invented but internally consistent across every artboard —
Sander Bakker is 67 Gold in the album, in the graph, and among Monday's
scorers; Ruben de Vries' Holo→Elite crossing in the Chronicle matches his 81
Elite card in the album. If a number looks odd, it is probably deliberate.

Two things in the album that are easy to mistake for mistakes:

- **All-rounder cards show six identical attribute numbers.** That is correct —
  all-rounder offsets are all zero
  ([`rating-engine.ts:55`](../../src/game/rating-engine.ts#L55)) — and it is why
  roughly 80% of the roster looks like that. See spec §3.5.
- **Slot numbers run 37–54 on the shown pages**, not 1–18. The mockup is pages
  5 and 6 of 7, i.e. mid-album, so the paging and the range labels are visible.

## What is deliberately not drawn

Do not infer these from blank space (spec §4.4, §7): the Chronicle's club desk
(market/packs) and kudos blocks, album completion rewards, and any share
surface. The Chronicle issue layout leaves room for the first two; that room is
layout, not a v1 deliverable.

## Card rendering

Every card in these mockups is the existing `LiveCard`
([`src/components/live-card.tsx`](../../src/components/live-card.tsx)) with the
material-ladder CSS from
[`src/app/globals.css`](../../src/app/globals.css) — same six tier stocks, same
pennant silhouettes, same 5:7 ratio and `4cqi` internal scale. The mockups
reproduce it in plain HTML because they are standalone pages; **the build must
use the real component, not a copy of the mockup markup.**
