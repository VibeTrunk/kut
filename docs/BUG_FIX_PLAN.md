# Known-bug investigation and fix plan

Investigated: **4 October 2026**. Source revision:
`73024a3c3e74a7a911b2833766fc63e7a207601d`, including the owner's existing
uncommitted KB-035–KB-037 entries in `KNOWN_BUGS.md`.

Implementation and local validation are recorded below for two separate
reviewable slices. The owner subsequently authorized commits and pushes:
frontend on `docs/known-bugs-kb035-kb036`, with the migration on
`fix/special-snapshot-tiers`. The owner squash-merged frontend PR #183;
migration PR #184 now targets `main`. Its former stack caused conflicts in
three shared documentation files; updated `origin/main` was merged into the
migration branch, retaining both slices' documentation. Independent future
slices will branch from `main` instead. Central catalogue PR #79 is prepared
and validated, but neither migration PR is merged or applied to hosted.
The affected-phone diagnosis remains unconfirmed.

## Scope and inventory

Reviewed the complete bug register, tester feedback, the roadmap's defect
notes, relevant specification/ADRs, recent delivery history, affected code,
browser-test configuration and existing regression tests. GitHub's open-issue
query returned **zero issues** for `VibeTrunk/kut`.

At investigation time the register contained **37 bugs: 33 marked fixed,
three open and one cannot-reproduce**. Historical fixes were checked against their recorded
resolution; this was not a fresh reproduction of all 33 fixes. Two additional
items need explicit treatment: the latent Special-card tier defect in the
roadmap, and KB-018's deliberately deferred database follow-up.

After local implementation: **38 entries, 36 fixed (including local-only
KB-035/036/038), one investigating (KB-037), one cannot-reproduce (KB-025)**.
Local fixed status is not a claim that a change has shipped.

| Order | Item | Current assessment | Planned disposition |
|---|---|---|---|
| 1 | KB-037: sharing fails on a phone | Recovery implemented; exact device cause still unconfirmed | Keep investigating until the affected device passes |
| 2 | KB-035: uneven rating chips | Fixed and verified locally in Chromium/WebKit | Full-width rows with the rating disc and arrow pinned right |
| 3 | KB-036: misaligned share tiles | Fixed and verified locally; PNG dimensions unchanged | Shared desktop grid rows; compact phone layout retained |
| Before any Special issuance | KB-038: Special-card rarity projection | Confirmed latent defect; corrected locally with one migration | Separate catalogue/hosted release before issuance |
| On recurrence | KB-025: inconsistent discard quote | Still cannot reproduce; previous hosted investigation found no source for 120 | Capture simultaneous evidence and investigate before changing pricing |
| Deferred | KB-018: inferred carried Form | User-facing issue fixed; explicit database provenance remains intentionally declined | Preserve the decision; reconsider before another rating-rule cutover |

The three open UI bugs can share one frontend PR, with KB-037's failure mode
made reproducible first. The Special-tier correction is its own migration
slice. KB-025 and KB-018 do not justify speculative database changes now.

## Evidence collected

- An isolated browser harness rendered the **current components**, compiled
  the **current `globals.css`**, and used synthetic data and system fonts.
  It did not use authenticated production data or reproduce a real phone.
- Both canvas outputs decoded to **1080 × 1350** in Chromium. Their layouts
  inside the images differ, but their export dimensions do not.
- Rating links measured approximately **165, 174 and 306 px** for three
  different labels at 1280 px. Their discs moved with the label widths.
- At 640 and 1280 px, both share previews measured **190 × 237.5 px**.
  With a short champion name, the descriptions had different heights and
  the Download button tops differed by approximately **7.8 px**. With a
  longer champion name, the same fixture happened to align. This is a
  content-dependent grid-row problem, not proof of unequal preview widths.
- Removing `CanvasRenderingContext2D.roundRect` in a controlled probe caused
  `TypeError: ctx.roundRect is not a function`. Rejecting `document.fonts.load`
  caused asset loading to reject. These identify real failure paths, **not
  the confirmed cause of the owner's phone failure**.
- At investigation time the authenticated Playwright projects were Chromium at Pixel 7 and
  320 px sizes. They check successful PNG drawing/sharing but neither WebKit
  nor consistent chip/button geometry. WebKit was not installed locally;
  the required Playwright revision is now installed and covered by the suite.
- The existing share-data, night-ratings and rating-story suites passed:
  **3 files, 42 tests**. This validates their current unit coverage, not a fix
  for the reported browser failures.

The ignored investigation scripts and JSON are in `test-results/`; they are
temporary evidence, not part of the maintained test suite.

## 1. KB-037 — make sharing work on the affected phone

**Files:** `src/components/midweek/share.tsx`,
`src/lib/midweek/share-draw.ts`, authenticated Playwright configuration and
the share-image cases in `tests/e2e-authenticated/mobile.spec.ts`.

### Findings

These findings describe the pre-fix source; the execution record distinguishes
simulated recovery evidence from the reported phone failure.

1. `loadShareAssets` awaited four font loads with `Promise.all`. Any one
   rejection prevents both previews from drawing, even though system font
   fallbacks are available.
2. Individual photo fetch/bitmap failures already fall back to a shirt. A
   missing `createImageBitmap` alone should therefore not fail both exports.
3. Drawing calls `ctx.roundRect` without a fallback. Canvas context creation,
   path drawing and PNG serialization are other possible failure stages.
4. There is **no `OffscreenCanvas`** in this path. The share API is called only
   after a preview is ready, so a share-sheet problem cannot explain initial
   `No preview` messages.
5. Both the asset-level and per-image catches discarded the error. The interface
   said “Try again” but offered no retry control. Each tile now owns its
   asynchronous work and Retry, with sanitized stage diagnostics.
6. Older completed weeks use the same drawing functions. Unit fixtures already
   exercise stored-week data, but the actual 30 September payload has not
   been reproduced on the affected device.

### Implementation sequence

1. Capture browser/OS and a sanitized failure record with a stage:
   `fonts`, `canvas-context`, `draw`, or `png-export`, plus image kind and
   error name. Do not log signed photo URLs, credentials, full payloads or
   member names. Keep the member-facing message simple.
2. Reproduce the 30 September case and a newer completed week on WebKit and
   the reported phone/browser. Check failed font requests and CSP events.
   Capture the actual exception before selecting the device-specific fix.
3. Make font loading degrade to available fonts instead of preventing export
   when a font request fails. Apply a bounded wait if a request can hang.
4. If the failing browser lacks `roundRect`, draw the same rounded path with
   established canvas primitives. Do not lower image resolution merely on
   the assumption that memory is the problem; measure that first.
5. Add a working Retry action. Keep success/failure independent per image;
   refresh drawing state on retry and release bitmaps/object URLs/canvas
   resources when finished or cancelled. Prevent late asynchronous results
   from retaining resources after unmount.
6. Exercise coarse-pointer file sharing, download fallback, Save image,
   cancelled shares and genuine share errors. Make action errors distinguish
   failure to share from failure to draw.

### Acceptance

- Both previews decode to 1080 × 1350 on Chromium and WebKit, with and without
  photos, for old and newer completed-week fixtures.
- A failed font request permits a readable fallback export; a failed photo
  request keeps the shirt fallback and an exportable canvas.
- A forced drawing/export failure produces a usable Retry action; retry
  succeeds after the simulated failure is removed. One failed tile does not
  disable the successful tile.
- Share receives a nonempty PNG with the expected filename. Browsers without
  file-sharing support download it. Cancelling the native share sheet does
  not report a failure.
- A real-device check passes on the affected browser. Mobile-sized Chromium
  and mocked `navigator.share` are insufficient to close this report alone.

API references for the diagnostic paths:
[FontFaceSet.load](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/load)
and [Canvas roundRect](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/roundRect).
They support the API checks, not a diagnosis of the reported phone.

## 2. KB-035 — align per-match rating chips

**File:** `src/components/midweek/rating-list.tsx`, `MatchChips`.

The list switches from hidden to `flex`, wraps, and renders content-sized
`inline-flex` links. Replace this with one column of links occupying the
available card-column width. Each link should use a grid with
`minmax(0,1fr)` for the label and fixed-size tracks for the disc and arrow.
Wrap long opponent names while retaining the full accessible name. The
minimum height must accommodate the existing 30 px disc and padding.

On phones, check the narrow name column inside the three-column rating row;
if necessary, place the match list across the available text/disc columns
below the card description. Do not give links an intrinsic minimum width
that reintroduces page overflow. At desktop, give the five lists equal
column widths. If their first chips must also share a horizontal baseline,
use shared parent rows rather than assuming the card descriptions are equal
height.

**Acceptance:** at 320, 412, 640 and 1280 px, each list's links have equal
widths and right-aligned discs/arrows within a 1 px tolerance. Short and long
names remain readable, links open the correct reports, the toggle retains
its ARIA state, and neither champion view nor complete bracket overflows.
Extend the existing ratings E2E geometry assertions; pure data unit tests
cannot detect this layout defect.

## 3. KB-036 — align share previews, labels and actions

**File:** `src/components/midweek/share.tsx`, `MidweekShare` and `ShareItem`.

The source already has `sm:w-[190px]` on each item. Both renderers use the
same canvas dimensions. The measured defect is that each item's nested grid
resolves its own text and action rows. `min-h-[86px]` reserves action height
but does not align the action row across tiles.

Use a common grid from `sm`, with equal columns and shared rows for preview,
title, description, actions and feedback (subgrid is one option). Explicitly
constrain preview dimensions and contain the image. Preserve the compact
stacked phone items, their 110 px thumbnails and coarse-pointer Share/Save
actions, while keeping long text inside the available width. Handle one
poster-only item, loading, ready and error states without moving its sibling.

**Acceptance:** preview widths/heights and title/action baselines match
within 1 px at 640 and 1280 px with short and long manager names, one or two
images, and different feedback states. Both previews keep a 4:5 ratio.
At 320 and 412 px, there is no overflow and both phone actions remain usable.
Run the same checks on the champion view and complete bracket. Do not change
the PNG dimensions to fix a page-layout defect.

## 4. Latent Special-card tier defect — fix before issuance

**Existing source:** `ROADMAP.md`, Groundmasters “Groundwork found while
scoping”; ADR-055's immutable `snapshot_rarity_tier` contract.

The collection, market and pack-result projections derive Special tiers from
an obsolete shifted OVR ladder instead of reading `snapshot_rarity_tier`.
The latest market definition is in
`20261010000000_market_listing_discard_value.sql`; collection and pack-result
definitions have the same issue. The roadmap records no issued Specials at
the time it was scoped; this investigation did not query today's hosted
inventory.

Before issuance, register the defect with the next available KB id and make
one independently reviewable projection-correction migration. Read the
stored tier for Specials and retain the current state tier for Live editions.
Audit all current projections and any RPC result that supplies tier data,
not only the newest market view. Preserve column order, signatures, grants,
member gates and each view's intentional security mode. Do not edit old
migrations or change ratings, discard formulas or frozen edition rows.

Add pgTAP fixtures whose stored tier deliberately differs from the obsolete
ladder. Prove consistent collection/market/pack output, unchanged Live tiers,
frozen tier persistence after a rebuild, and unchanged anon/member access.
Use one new migration and companion database tests; catalogue it in the central
`VibeTrunk/supabase` catalogue. Any issuance migration remains a separate
feature slice. Hosted application requires its own explicit instruction and
the applicable release/backup gates. Until corrected, this is a blocker for
issuing Specials rather than an explanation for the phone sharing report.

## 5. KB-025 — retain evidence-driven triage

The register's investigation found that neither the member's Live cards,
their historical OVRs, Special editions nor ledger explained the displayed
120. The current detail page reads the discard quote from
`my_collection_cards` and listing bounds from a subsequent RPC. The actual
discard payout remains calculated by `kut.discard_card` on the server.

Keep `cannot-reproduce`. On recurrence, capture the full page, card id,
timestamp, browser, deployed version and simultaneous view/RPC responses.
Compare ownership/edition/state and the UI props in that same render. An
intervening rating rebuild between separate reads is worth checking, but
does not explain the original impossible 120 value.

Add an authenticated navigation regression using two cards with different
discard values if the issue is reopened; verify the displayed quote and
subsequent server-authoritative payout. Do not replace the button's value
with a value reverse-calculated from the listing minimum: flooring loses
information. If evidence supports a consistent-read RPC, that contract change
needs its own migration slice. Closure requires a reproducible mismatch and
a regression test, not another cache clear.

## 6. KB-018 — preserve the deferred follow-up

The UI now accounts for the residual carried Form and the Form ceiling.
The remainder still lacks explicit database provenance. The owner declined
the `legacy_form` / `legacy_weight` projection extension on 23 September;
the carry-over reaches zero at the fourth v2 session.

Keep this deferred. Before another season spans a rules cutover, reconsider
one projection migration exposing explicit legacy inputs, a cutover-spanning
pgTAP fixture, and a tolerant frontend read during deployment. Test capped
and uncapped Form and injury/comeback contributions. Do not reopen the fixed
user-facing bug or alter the rating engine simply to remove this debt.

## Verification and completion order

1. Build local fixtures and capture KB-037's actual failing stage; implement
   its bounded compatibility/recovery fix.
2. Implement KB-035 and KB-036, then run the geometry and sharing cases across
   Chromium and WebKit. Keep a real-device check for KB-037.
3. Run `npm run verify:fast`, the relevant authenticated browser suites
   against a loopback Supabase stack, and `npm run build`. For code PRs,
   require the repository's normal merge-gate and secret-scan evidence.
   Extend the release runner's browser provisioning if WebKit is added to
   the authenticated release configuration.
4. Mark only verified bugs fixed in `KNOWN_BUGS.md`; record the shipped slice
   and checks in `PROGRESS.md`. Update the ADR/spec only if approved behavior
   or contracts change. KB-037 stays open if the real-device failure persists.
5. Complete the Special-tier slice before Special issuance. Keep KB-025's
   recurrence path and KB-018's deferred decision visible.

The production release gate has not run. Existing loopback guards remain on;
test fixtures must never target hosted Supabase to reproduce a member report.
Every commit, push, merge, deployment and hosted migration remains a separate
authorization decision under the repository's production-safety rules.

## Execution record — 4 October 2026

### Frontend slice: KB-037, then KB-035 and KB-036

- Read canonical guidance and the prescribed documentation order; inspected
  status/history before editing and retained the owner's KB-035–037 reports
  and documentation-map change. Read installed Next.js 16.3.5 guides for
  server/client components, CSS, links, fonts and supported browsers.
- Added local sanitized diagnostics: `stage`, `kind`, allowlisted `errorName`
  and `recovery` only. Deterministic faults identify fonts, canvas context,
  drawing and PNG export stages. No real-phone exception has been captured.
- Font rejection/3-second timeout uses system fonts; missing `roundRect` uses
  an `arcTo` path. Photo failure retains the existing shirt fallback, with
  a 5-second bound; PNG export has a 10-second bound. Both images still export
  at 1080 × 1350. This path continues to use no OffscreenCanvas.
- Independent per-image work, Retry and action errors retain a successful
  sibling. Abort/late decode, bitmap close, canvas backing-store release and
  owned preview URL cleanup are covered. Share cancellation is neutral.
- Rating links fill their columns, wrap names and keep 44 px targets, the
  rating disc and arrow right aligned. Mobile lists span the text/disc area;
  desktop cards share description/list rows. Existing ARIA toggle/report
  navigation stays intact.
- Share tiles use five common desktop rows; phone thumbnails stay 110 px.
  Geometry coverage uses 320/412/640/1280 px, short/long names, both completed
  surfaces, one/two images, loading/error/Retry/ready/download feedback.
- Added the WebKit project and browser provisioning to the release runner.
  The affected phone/OS/browser was requested early and is still unknown.
  The older fixture is synthetic January 2001 schedule v1; the newer fixture
  uses the current completed evening/schedule v2. Neither is the actual
  hosted 30 September payload. Emulated WebKit and mocked sharing do not
  satisfy the real-device acceptance criterion: KB-037 stays investigating.
- Full authenticated run: **129 passed, two expected duplicate pack-test
  skips, one WebKit Sign in click timeout** (before an existing KB-033 test's
  layout assertions). All **39 new regression cases passed**, with no skips.
  The duplicate pack test actually passed once on narrow Chromium; neither
  skip is counted as a pass. A focused unchanged rerun is recorded with the
  final checks below; this initial full run is not reported as green.

### Migration slice: KB-038 / ADR-121

- One new migration, `20261018000000_special_snapshot_tiers.sql`; existing
  migrations are untouched. Specials read `snapshot_rarity_tier` in collection,
  market, saved pack results and offered-card JSON (the latter formerly
  hardcoded Common). Live behavior, snapshots, OVR/discard formulas, view
  column order, ACLs, member gates and invoker/definer/barrier modes remain.
- Audited current projections/RPC outputs; `open_pack` supplies no tier in
  its result and weights Live editions only. Other tier projections are
  Live-only or inherit these views. Past Midweek lock snapshots retain their
  existing presentation; no tournament or frozen edition is rewritten.
- Applied the new migration **only to the running local Supabase stack**.
  Added 51 meaningful pgTAP assertions covering six deliberately divergent
  stored tiers, Live/missing-state behavior, trade RPC output, rebuild/frozen
  persistence, immutability, columns, grants and caller boundaries.
- Full pgTAP passed: **38 files, 1,626 assertions**. Windows CLI `test db`
  could not quote this repository's spaced path (zero tests executed);
  the fallback ran every SQL file with `psql` inside `supabase_db_kut`, checking
  SQL exit status, TAP plans/counts and every assertion. All fixture work was
  local; loopback guards and hosted opt-in variables were not bypassed.
- Working-tree migration policy passes: one addition with its database test,
  no existing migration mutation. Central **VibeTrunk/supabase** PR #79
  contains the committed SQL byte-for-byte and extends central verification.
  Source verification passes for 88 shared migrations; KUT parity passes for
  87 KUT migrations. Read-only hosted preflight confirms 87 applied migrations
  match and only this migration is pending; the central dry run names only
  `20261018000000_special_snapshot_tiers.sql`. Nothing has been applied.

### Review and release boundaries

Package frontend code/tests/browser provisioning and its documentation as one
PR. Package the new SQL/test, ADR-121, Special spec/roadmap/KB-038 and associated
validation log separately; shared documentation needs selective hunks. Do not
bundle either with issuance. Commit/push authorization covers these two slices
only. The shared plan describes both; the migration's SQL/test and dedicated
spec/roadmap/ADR/register/progress changes belong to its companion branch.

| Slice | Dedicated files | Shared documentation hunks |
|---|---|---|
| Frontend | `rating-list.tsx`, `share.tsx`, `share-draw.ts`, `share-regression.spec.ts`, authenticated config, mobile test helper/comments, release browser provisioning, root README and PRODUCTION_SAFETY | KB-035–037 statuses, ADR-117/120 amendment, frontend PROGRESS and plan sections; preserve the owner's original registrations/docs-map addition |
| Migration | `20261018000000_special_snapshot_tiers.sql`, `special_snapshot_tiers.test.sql`, BUILD_SPEC and ROADMAP corrections | KB-038, ADR-121, migration PROGRESS and plan sections |

KB-025 remains cannot-reproduce; no new mismatch evidence was found. KB-018's
declined database provenance follow-up remains deferred. Hosted card inventory
was not queried. Both original KUT PR heads passed all required GitHub checks,
including clean-lockfile build and database suites. The updated migration head
requires fresh CI. Real-device evidence, migration PR merges, final candidate
release/backup gates and separately authorized central hosted application
remain release work. The read-only preflight must be repeated after merging.

### Final local checks (before PR publication)

| Check | Result |
|---|---|
| `verify:fast` | Pass: policy copies, formatting, ESLint, TypeScript, 49 files / 474 unit tests. Initial ESLint encountered Playwright deleting `test-results`; rerun passed. |
| Authenticated Chromium/WebKit | 129 passed / 2 duplicate pack-test skips / 1 Sign in click timeout in the full run; unchanged focused WebKit rerun passed (1/1). All 39 new regressions passed. The initial full run was not green; skips are not passes. |
| Local pgTAP | Pass: 38 files / 1,626 assertions, including 51 new; local-container fallback described above. CLI attempt ran zero tests and is not counted as passing. |
| `test:integration` | Pass: 7 files / 16 concurrency and readiness cases, explicit loopback database URL. |
| `test:e2e` | Pass: 26 unauthenticated Chromium cases. |
| `build` | Pass, using installed Next.js 16.3.5. Lockfile/declaration specify 16.3.6; exact lockfile CI validation remains required. No dependency files were changed. |
| Migration policy / runner syntax | Working-tree policy passes with the untracked migration/test included; release runner PowerShell AST parses. Gate itself not executed. |
| Production dependency audit | Pass: zero vulnerabilities at the required high-severity threshold. |
| Pinned local Gitleaks | No leaks in tracked/new working sources or 246 history commits, with full redaction. This is local evidence, not exact-candidate GitHub `scan`. |
| Production/device/catalogue | Not run/complete: affected device and actual 30 September diagnosis, central catalogue parity, exact-candidate CI and production gate/backup. No skipped check is substituted for these. |
