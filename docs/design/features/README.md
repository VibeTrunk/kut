# Feature designs — revised 6 September 2026

**Design only; no app rules or database records changed.**

- [Interactive gallery](http://127.0.0.1:4173/design/features/index.html) (local preview must be running)
- [Gallery source](../../../design/features/index.html)
- [Mobile overview](overview.png)
- [Feature specs](../../archive/SPEC_NEXT_FEATURES.md)
- [Rating balance review](../../RATING_BALANCE_REVIEW.md)
- [Implementation plan](../../archive/IMPLEMENTATION_PLAN_NEXT_FEATURES.md)
- [New-session prompt](../../archive/START_NEXT_FEATURES.md)

Filesystem HTML links may open source in your editor. Use the localhost link,
which serves design artifacts from `test-results/design-preview`, or open the
HTML directly in a browser. Open screen in the gallery gives a full desktop view.

## Revised journeys

Wanted cards now show **who is open to trading that card**. Members copy a
channel-neutral message and contact each other. There is no reciprocal matching, Matches tab,
swap-review/sending flow or new escrow contract. Private wants and explicit
copy-level sharing remain. Actual exchanges use existing Market listings and
Offers; those listings are public, not reserved for the person in the conversation.

A complete self-report pays **50 KUT Coins once per Player/session**. Explicit
zero goals and Skip in every category are valid. Drafts do not pay; editing a
submitted report cannot pay again. Admin Reports shows completion and rewards
separately from goal coverage, including attendees without accounts. Named
Edit/Add goals actions require a reason and never impersonate form completion.

## Current screens

| Screen | Mobile | Desktop |
|---|---|---|
| Wanted cards and availability | [Full](wanted-mobile.png) | [Render](wanted-desktop.png) |
| Add wanted cards | [Picker](wanted-picker-mobile.png) | Centered dialog |
| Available-copy selector | [Full](tradecards-mobile.png) | Unified into Trading preferences in the implementation |
| How to complete a trade | [Dialog](trade-help-mobile.png) | Centered dialog |
| Home reward prompt | [Full](home-mobile.png) | Existing Home structure |
| Goals/kudos and +50 reward | [Full](report-mobile.png) | [Render](report-desktop.png) |
| Teammate picker / Skip | [Picker](kudos-picker-mobile.png) | Centered dialog |
| Submitted and rewarded | [Full](saved-mobile.png) | Narrow column |
| Closed report | [Full](report-closed-mobile.png) | Same content |
| Incomplete form | [Error](report-error-mobile.png) | Same content |
| Chronicle results | [Full](recap-mobile.png) | Article + Form panel |
| Admin attendance | [Full](attendance-mobile.png) | Narrow form |
| Admin session reports | [Full](adminreports-mobile.png) | [Render](adminreports-desktop.png) |
| Admin goal correction | [Dialog](admin-goals-mobile.png) | Centered dialog |
| Corrected goals, unchanged rewards | [Full](adminreports-corrected-mobile.png) | Same content |
| 175-coin pack | [Full](packs-mobile.png) | [Render](packs-desktop.png) |
| Pack confirmation | [Dialog](pack-confirm-mobile.png) | Centered dialog |
| 174 coins: insufficient | [State](pack-insufficient-mobile.png) | Same content |
| Club Value | [Full](value-mobile.png) | [Render](value-desktop.png) |
| Duplicate breakdown | [Full](copies-mobile.png) | Table + explanation |
| Special scaffolding | [Full](editions-mobile.png) | [Render](editions-desktop.png) |
| Empty wanted list | [State](wanted-empty-mobile.png) | Same content |

Former matches/swap artboards are superseded. Old prototype screen URLs resolve
to Wanted. Supporting Market/Offers screens are contextual sketches of existing
features. No special cards or overflow menus were introduced.

## Try it

1. Wanted → Add cards → search Dana → Add → Done → Remove.
2. Trading preferences → Select available copies → toggle a specific copy. Nothing is reserved.
3. Copy message → send it to the owner through your chosen channel. If clipboard access fails,
   selectable text is provided. No outbound message is sent automatically.
4. Goals/kudos → enter goals → choose or skip each category → Submit. The
   fixture wallet goes 500 → 550. Edit/resubmit: it stays 550.
5. Admin attendance → Reports → No account → Ellis → Add goals with a reason.
   Then edit Alex's submitted goals. Completion/rewards do not change.
6. Packs → Open → Confirm: a fresh fixture goes 500 → 325.
7. Club Value → Alex → change copy count: five = 126; two = 121.

## Prototype boundary and appearance

No API, real account, economy transaction, goal submission or outbound message.
State resets on reload/gallery selection. Screens are fictional scenarios,
not a continuous economy: the valuation scenario owns five Alex copies, while
the wanted scenario illustrates an album gap. The spec governs durable data,
audit history, reward atomicity, historical corrections and privacy. Do not
ship this prototype JS as app logic.

Cards come from the **actual LiveCard component**, icons from the existing icon
module, material CSS from `src/app/globals.css`, and fonts from the existing
self-hosted Archivo/Instrument Serif cache. Layouts reuse the current tokens,
buttons and tabs. No new illustration or external font system.

## Verification

Regenerate with:

```powershell
node design/features/check-rating-balance.mjs
node design/features/build-assets.mjs
node design/features/render-and-check.mjs
npm run verify:fast
```

Export requires the existing `.next` font cache; delivered HTML already includes
those files. Future changed font hashes require updating the exporter.

Local Playwright Chromium is used because Browser plugin discovery returned no
connection. `verification.json` records **72 layout checks** (12 screens at
320/360/390/430/768/1440px), 13 interaction groups and zero page errors. Checks
include zero goals/all skips, reward once across edits, admin guest-goal entry,
member correction, no-account filtering and no horizontal document overflow.
Screens and dialogs were also visually inspected. The separate balance script
loads the real unchanged rating engine and writes `rating-balance.json`.

Viewport PNGs show fixed mobile navigation. Long full-page artboards temporarily
anchor that bar to the document foot for capture so it cannot mask the middle
of the image. The overview uses actual viewport captures. Database concurrency,
real-device keyboard/safe-area and accessibility acceptance remain requirements
for the future implementation.
