# Known bugs

Confirmed or credibly-reported defects in shipped KUT behaviour that are not
yet fixed. This is the register; fixes are recorded in `docs/PROGRESS.md` and,
where they change a rule or invariant, `docs/decisions.md`.

Distinct from `docs/TESTER_FEEDBACK_BATCHES.md`, which tracks feature requests
and ideas. A "this doesn't work as intended" report about a feature we *did*
ship belongs here; a "we should also build X" belongs there.

## Conventions

- One row per bug, newest `KB-` id last. Keep ids stable once assigned.
- **Status:** `open` · `investigating` · `fixed` (date + where) · `wontfix` (why)
  · `cannot-reproduce`.
- When a bug is fixed, leave the row in place, set the status, and link the
  PR / ADR / migration.

## Register

| id | Reported | Area | Summary | Status |
|----|----------|------|---------|--------|
| KB-001 | 2026-09-01 (Maarten, round-3 feedback) | Card lightbox — `src/components/card-lightbox.tsx`, `globals.css` (💡01 / ADR-044) | Tapping a card to view it fullscreen "doesn't work like intended". No repro detail captured yet — needs device/browser, which surface (Collection / Player directory / Market / detail page), and what actually happens (wrong size, doesn't open, can't dismiss, scroll bleed). | fixed 2026-09-02 (resolved by removal — the fullscreen lightbox was taken out, ADR-046 / `fix/remove-card-lightbox`; card detail pages remain the full-size view) |
| KB-002 | 2026-09-01 (Maarten, round-3 feedback) | Card face — `.live-card__topscrim`, `src/app/globals.css:192` (ADR-043) | The lighter patch top-left of every card is intended (a readability ground under the OVR number, tinted with the card's `--stock`), but it renders with a visible hard edge on the left/bottom. It is a fixed `66% × 46%` rectangle whose single `linear-gradient(146deg, …)` only feathers to transparent along that one diagonal axis, so the other edges of the box clip while the fill is still opaque. Most obvious over a busy/high-contrast photo (e.g. Darryl). Fix: falloff that reaches 0 before every edge — e.g. `radial-gradient(120% 120% at 0 0, …)` or a mask. | fixed 2026-09-02 (`src/app/globals.css` `.live-card__topscrim` — the single `linear-gradient(146deg, …)` replaced with `radial-gradient(120% 120% at top left, …)` that hits full transparency at ~84% of the box, clear of the right and bottom edges; `fix/topscrim-edge-feather`) |
| KB-003 | 2026-09-02 (own review, desktop spread screenshot) | Collection album — `src/components/album/collection-album.tsx:14-21` (ADR-048) | Collected slots and empty slots do not occupy the same box, so rows drift out of alignment between the two facing leaves. A collected slot is a `div` with `pt-4` (the slot number sits *above* the card) wrapping a `.live-card` at `aspect-[5/7]`; an empty slot is a bare `aspect-[5/7]` link with its number absolutely placed *inside* the box. A collected slot is therefore ~1rem taller than an empty one, and because each leaf is its own `grid` inside its own `<article>`, row heights are computed per page — any row where the left page has a card and the right page does not (or vice versa) pushes the two pages out of horizontal alignment for the rest of the spread. Deviates from the design spec §3.7 ("every slot keeps the card's 5:7 aspect ratio so the grid stays even. Above each slot sits its number"). Fix: one shared slot wrapper (same `pt-4` number strip + same aspect box) with the card or the recess rendered inside it, so both states are identical boxes; optionally also pin the leaf grids to a shared row height so the two `<article>`s cannot drift. | open |
| KB-004 | 2026-09-02 (own review, desktop spread screenshot) | Collection album page index — `src/components/album/collection-album.tsx:26` (ADR-048) | On desktop the spread shows two leaves (pages 1 *and* 2 via `spreadFor`, `src/lib/album.ts:42`) but the page index below highlights only one chip — the `border-brass text-brass` active style is keyed on `number === currentPage` alone, so the facing page reads as closed. Design spec §3.6 asks for "the open page(s) highlighted". The layout is server-rendered and the second leaf is revealed purely by CSS (`hidden lg:block`), so the fix has to be breakpoint-aware too: mark the partner page's chip active only at `lg:` (e.g. an `lg:border-brass lg:text-brass` class on the spread partner) rather than computing one active page. Keep `aria-current="page"` on the single requested page — it is the accurate value at both widths and cannot be made responsive. | open |
