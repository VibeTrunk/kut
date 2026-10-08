# FLUT rebrand: marks, lockup, icons, share images

For every agent building the KUT → FLUT rename. Read this in full before
touching any brand string. **FLUT** stands for **Football League Ultimate
Team**.

**This package supersedes the branding in every older design package**
(`design/*.dc.html`, `design/features`, `design/midweek`, `design/ux-review`,
`design/mm2-dr3`, `design/nav-audit`, `design/groundmasters`). Those packages
are preserved unchanged as the record of their rounds. Wherever one of them
draws "KUT" or "KUT Coins", read FLUT and FLUT Coins as specified here.
Everything else in them still stands.

**Status: approved by the owner on 2026-10-08 and built in PR
`feat/flut-branding` (ADR-137).** Three owner overrides apply: the root
metadata title is the full name `FLUT — Football League Ultimate Team`
(§7 said `"FLUT"`); server-written text is translated at display time by
`src/lib/notification-copy.ts` instead of waiting for §8's migration, which
remains an optional later slice; and the line references below predate the
build. `build/build-assets.cjs` applies §5 to the pre-build `share-draw.ts`
(`c919037`), so it refuses on later trees by design.

## What changes and what doesn't

- **Changes:** the letters only. KUT becomes FLUT, "KUT Coins" becomes
  "FLUT Coins", and "Kelderklasse Ultimate Team" becomes "Football League
  Ultimate Team".
- **Unchanged:** the Clubblad palette (`globals.css` `@theme`), Archivo and
  Instrument Serif, the shield glyph (`.clip-pennant`), every LiveCard tier
  material, all layouts, and the "Terrible Football Haarlem" kicker lines.
- **Out of scope for the UI work:** the Postgres schema `kut`, the repo, the
  Vercel project and `kut.vibetrunk.com`, and internal identifiers such as
  `kut:share-diagnostic`, console prefixes and test names. Renaming any of these
  is a separate infrastructure decision.

## How to read the mockups

- The **canvas** is `project/canvas.json` plus 14 `project/*.dc.html`
  artboards, on five pages: Marks and lockup; Login and welcome; Nav,
  Chronicle, currency; Share images; Favicon and app icons. It is the same
  canvas as the owner's private Claude Design artifact "FLUT Rebrand".
- The artboards are **hand-built** reproductions using the components' own px
  values. The build must use the real components and change only what this
  note lists. As in older packages, where a mockup and this note disagree,
  this note wins.
- **Blue-grey text** (`#8fb0c2`) is a design annotation, not app copy.
- **Measured, not estimated.** Every width here was measured in the real
  webfonts (Google Fonts Archivo and Instrument Serif, the same faces
  `next/font` self-hosts) at 320, 360, 412, 640, 1024 and 1280 px.
- **Assets** are in `assets/` and are rebuilt with
  `node design/flut/build/build-assets.cjs`. That run needs network access for
  the fonts. It also redraws both share images with the app's own
  `share-draw.ts` plus the §5 diff.

## 1. The pennant wordmark (app chrome)

`app-nav.tsx` keeps its markup and classes; only the text node changes.

| Where | Spec | Width |
|---|---|---|
| Desktop header, `app-nav.tsx:117` | `clip-pennant h-4 w-3.5` + `text-xl font-black tracking-tight` | 55px (KUT 46) |
| Mobile header, `app-nav.tsx:161` | `clip-pennant h-3.5 w-3` + `text-lg font-black` | 51px text, 72px with pennant (KUT 63) |

Avatar fallback `{initials || "KUT"}` (`app-nav.tsx:150, 181`) becomes
`{initials || "F"}`. At 12px 900, FLUT is 34px wide, which doesn't fit the
36px circle. The fallback only shows for a member without a display name.

## 2. The full-name lockup (login and welcome)

Today the login shows the pennant mark and then a one-line kicker. Set as
one kicker, the new name is 296px wide, more than the 272px column at
320px, so it wraps with "TEAM" alone on the second line. The lockup instead
sets the name on **two fixed lines, Football League / Ultimate Team**, at
every width. Its widest line is 158px, so it never re-wraps.

**Crest lockup** (login, left-aligned; it replaces both `login/page.tsx:12–18`
paragraphs):

```tsx
<p className="mb-2 flex items-center gap-4">
  <span aria-hidden="true" className="clip-pennant h-20 w-[70px] shrink-0 bg-brass" />
  <span className="grid gap-2">
    <span className="text-[40px] font-black leading-none tracking-[-0.02em] text-ink">FLUT</span>
    <span className="text-[0.7rem] font-extrabold uppercase leading-[1.45] tracking-[0.26em] text-brass">
      <span className="block">Football League</span>
      <span className="block">Ultimate Team</span>
    </span>
  </span>
</p>
```

The lockup is 244px wide in total and fits the 272px column at 320. The
`header` keeps its `space-y-4`; `mb-2` gives the lockup 24px before
"Sign in". Screen readers hear "FLUT, Football League, Ultimate Team",
because the block spans read as separate phrases.

**Stacked lockup** (welcome, centred; it replaces the "Welcome to KUT" kicker
at `welcome/page.tsx:37–39`):

- A kicker reading `Welcome to`: the same size and tracking as today's
  kicker, in `text-ink-faint`, so the brass stays on the name.
- Then `mt-3.5 flex flex-col items-center gap-3`, holding a pennant of
  `h-[50px] w-11`, FLUT at `text-5xl font-black leading-none
  tracking-[-0.02em]`, and the same two-line name.
- The h1 follows at `mt-7`.

Body copy changes as usual: "250 FLUT Coins and three Live Cards…" and the
done label "Enter FLUT" (`starter-reveal.tsx:31, 48`).

## 3. Chronicle mastheads and headings

No layout change. "FLUT Chronicle" is 305px at 60px (KUT 286) and 244px at
48px (KUT 228). Both mastheads already split after the first word at 320 and
still do. The index's one-line threshold moves from 336 to 352px, and the
issue's from about 480 to 500px. "This week in FLUT" (180px at 30px) and
"How FLUT works" (267px at 48px) each stay on one line at 320.

## 4. Compact currency label: the one fix

`midweek/views.tsx:827`, the "You" stat's unit. In a 140px two-column cell at
320 to 331px, "+254 FLUT" runs 3px into the cell's 16px padding; it isn't
clipped, but it is off. Below `sm`, set the unit to 12px with a 3px gap, so it
ends 3px inside the padding; today's KUT has 4px to spare:

```tsx
{unit && <span className="ml-[3px] text-xs font-extrabold tracking-normal sm:ml-1 sm:text-sm">{unit}</span>}
```

Every other currency string fits with room to spare: the Now kicker, the pack,
discard and buy buttons, and the toasts. See the `Currency` artboard for the
full table with sources.

## 5. Share images (`share-draw.ts`)

Two calls change and no coordinate moves:

```diff
-  text(ctx, "KUT", M + 46, 106, { color: C.ink });
+  text(ctx, "FLUT", M + 46, 106, { color: C.ink, track: -0.02, size: 44 });

-  text(ctx, "KUT Coins", M + coinsWidth + 16, 405, { color: C.inkDim });
+  text(ctx, "FLUT Coins", M + coinsWidth + 16, 405, { color: C.inkDim });
```

| Element | Exact spec | Width | Placement |
|---|---|---|---|
| Shield | unchanged, brass 34 × 34 | 34 | (64, 72) |
| **FLUT** | Archivo **900**, **44px**, letter-spacing **−0.9px** (`track -0.02` through `spacing()`, rounded to 0.1px) | **122.0** (KUT 105.1) | x **110**, baseline **106**; cap height 31; ink spans x 110 to 232 |
| Date line | unchanged, 800, 26px, +0.2em | at most 696 | right edge 1016, baseline 100; starts at x 320 or later, at least 88px clear |
| **FLUT Coins** | Archivo **800**, **34px**, no tracking | **195.8** (KUT 180.2) | x M + figure + 16, baseline **405**; at +256, the most a night pays, it ends at x 468 |

Without canvas `letterSpacing` (before Chrome 99 or Safari 17), FLUT draws
untracked at 125.6px and ends at x 236, which is still clear. Also rename the
`/** KUT's shield … */` comment (line 290) and the download name in
`share.ts:95` to `flut-midweek-…`; update `tests/unit/midweek-share.test.ts`,
`tests/e2e-authenticated/share-regression.spec.ts` and `mobile.spec.ts`, which
assert `kut-midweek-…`.

## 6. Favicon and app icons (App Router conventions)

| Asset | Put it at | What it is |
|---|---|---|
| `assets/favicon.ico` | `src/app/favicon.ico` (replaces the Next default) | 16, 32 and 48 PNG frames. The 16 is a hand-hinted master (`assets/src/favicon-16.svg`). |
| `assets/icon.svg` | `src/app/icon.svg` | The `.clip-pennant` shield in brass `#e0ac4a` with an F in `#1c150a` |
| `assets/apple-icon.png` | `src/app/apple-icon.png` | 180 × 180, full bleed on the board vignette: a 128 × 140 shield with FLUT at 30px 900 |

The file conventions emit the `<link>` tags, so no `metadata.icons` entry is
needed. All three are same-origin static files and pass the CSP.

## 7. Every other string (copy only)

These are plain renames. The list was generated with
`rg -n "\bKUT\b" src tests`; rerun it when you build.

- **Metadata:** `layout.tsx:43` becomes `title: "FLUT"`. Not the full name:
  page titles read "FLUT Chronicle", so the bare mark is the root title.
  Also update the Chronicle, How it works and Welcome page titles.
- **Pages:** `not-found.tsx:7`, `page-loading.tsx:3, 7`, `(app)/loading.tsx:13`,
  `invite/[token]/page.tsx:19` ("Join FLUT") and `claim-invite-form.tsx:52`
  ("Create FLUT account"). Also `settings/page.tsx:92` and `nav/routes.ts:123`
  ("How FLUT works"), `wanted/copy-message-button.tsx:7`, and the
  `how-it-works` body copy.
- **"KUT Coins" in TS/TSX:** the admin, packs, market, injury and midweek
  actions; `activity.ts`; `midweek/calls.ts`, `entry.ts` and `load.ts`; and
  `sign-in-error.ts` / `profile-read.ts`. Unit tests that assert this copy move
  with it.

## 8. Server-side copy: a separate, later slice

Postgres functions write "KUT Coins" into notices and messages: the market,
offers, payouts, bibs, injury check-ins, the Midweek result and calls, and the
admin reset text. Some RPC exceptions carry it too. Changing them means
re-creating those functions in **one new migration, in its own PR**, with a
database test, per the batching rules in `CLAUDE.md`. Its hosted application
then goes through `VibeTrunk/supabase`. Messages already sent keep their
wording, and nothing back-fills them. Until that slice ships, new server
notices still say "KUT Coins". The frontend PR must say so in its body.

## Before building

The rename changes the product's public name, which `docs/BUILD_SPEC.md`
states in its header. Record it as an ADR in `docs/decisions.md` and update
the spec's name line in the same PR (CLAUDE.md, "Working style").
