# Design packages

One line per feature on what was decided. The canvases are the owner's private
Claude Design artifacts, so a link below only opens for the owner. The artboard
sources (`*.dc.html`), their `canvas.json` indexes, the package build scripts
and the nav-audit page were archived at the git tag `docs-archive-2026-10`:

```powershell
git ls-tree -r --name-only docs-archive-2026-10 design | rg "dc.html"
git show docs-archive-2026-10:design/midweek/Picker-Saved.dc.html
```

The HANDOFF notes here say where they mention `BUILD_SPEC §N` or an old ADR;
read those from the same tag (see `docs/README.md`). Where a package drew
"KUT", read FLUT (`flut/HANDOFF.md`).

| Package                      | What we decided                                                                                                                                                         | Canvas                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Album, Chronicle, graph      | A bound Panini-style album, a weekly Chronicle issue and a rating-history graph. Built (ADR-047 to 049). Renders in `docs/design/`.                                       | Private                                                                 |
| `features/` (2026-09-05)     | Wanted cards with a copyable message and no matcher, goals and kudos reports, duplicate-sensitive Club Value, Special-edition scaffolding. Built (ADR-056 to 063). The 175-coin pack mockups are historical: the price is 250 (ADR-136). | Private; gallery in `features/index.html`                               |
| Navigation audit (2026-09-05) | Five primary tabs (ADR-053). A Market "My listings" tab was deferred (issue #237).                                                                                      | Archived at the tag                                                     |
| Injury cast (2026-09-23)     | A signed plaster cast replaces the "Injured" chip on Live cards. Built (ADR-084). `docs/design/injury-cast/README.md`.                                                  | <https://claude.ai/artifact/JJ1XHAugHcpSrQAkkyHFdb> (private)           |
| `midweek/` (2026-09-25)      | Midweek Madness entry and results pages, approved by the owner. Built (ADR-091 to 093). `midweek/HANDOFF.md`.                                                          | Private                                                                 |
| `ux-review/` (DR2, 2 Oct)    | MM 2.0 evening and a Compete section. Approved after three rounds. Built (ADR-104, 105, 110 to 113). `ux-review/HANDOFF.md`.                                            | Private                                                                 |
| `mm2-dr3/` (DR3, 3 Oct)      | Ratings, predictions for members who are out, share images, the plusses count and violet and teal team colours (DR3-10). Built (ADR-116 to 120). `mm2-dr3/HANDOFF.md`. | Private (canvas id `Xi7N3kMA2V2iC1zmtPvXVw`)                            |
| `groundmasters/`             | Five card directions for the first Special edition. No direction chosen yet. Rules and open decisions are in issue #222.                                                | Private                                                                 |
| `flut/` (2026-10-08)         | The FLUT marks, lockup, icons and share images. Built (ADR-137). `flut/HANDOFF.md`. Supersedes the branding in every older package.                                     | Private ("FLUT Rebrand")                                                |
