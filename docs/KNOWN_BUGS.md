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
