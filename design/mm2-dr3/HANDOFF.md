# MM 2.0 design round 3 (DR3): ratings, predictions, sharing, plusses, team colours

For every agent building F7 (ratings pages), D (prediction pages), F8 (the
shareable result), the picker's plusses count, or the team-colour change. Read
this in full before any of those slices. It sits on top of
`design/ux-review/HANDOFF.md` (DR2), which still holds for everything this note
doesn't change. Where this note and a mockup disagree, this note wins; where
either disagrees with BUILD_SPEC §44 or an ADR, the spec and ADR win until a
new ADR changes them.

**Status: approved by the owner (checkpoint DR3, 3 Oct 2026),** with violet
and teal as the team colours (DR3-10). Nothing here is built. The owner's
decisions are DR3-1 to DR3-10 at the end.

## How to read the mockups

- **33 files** in `design/mm2-dr3/*.dc.html`, on six canvas pages in
  `design/mm2-dr3/canvas.json`. Pages are placed at 320, 412 and 1440 px with
  a note beside each row. The two share images are single 1080 × 1350
  artboards. On the colours page each row holds today, violet and teal, and
  royal blue and teal, left to right, 2,560 px apart. The pairs page shows its reports at 412 and 1440 px only.
- **Generated, not hand-drawn.** `node design/mm2-dr3/build/build.mjs
  [--shots <dir>]` renders the real `LiveCard` and icons from `src/`, inlines
  the real `globals.css`, DR2's `ux.css` and `midweek.css`, and fails if any
  page scrolls sideways or a share image isn't exactly 1080 × 1350. Change
  `build/lib.mjs`, `build/screens.mjs` or `build/dr3.css` and rebuild; never
  edit a `.dc.html` by hand.
- **Every DR3 screen uses the chosen team colours** (violet and teal, below),
  except the `Colours-*-Before` files (today's), the `Colours-*-Royal` files
  (round 2's royal blue and teal) and the `Pairs-*` files (round 3).
- **Blue-grey labels** (`r3-state`, `r3-note`) are design notes, not app copy.
- **The data.** The evening is DR2's (`sample-tournament.json`, MM 2.0 clock,
  "you" are Sanne: a bye, beat Eline 1–0, out to Sophie on penalties in the
  quarter-finals; Joris beats Sophie on penalties in the final). Ratings and
  their lines come unchanged from `sample-ratings.json`.

### The two samples disagree, so the mocks do too

`sample-ratings.json` replays the same world on today's engine, so its results
differ from the DR2 story (ADR-117 says so). Sanne meets the same opponents,
but beats Eline 2–0 and loses 1–3 to Sophie there. Joris's last two opponents
differ too (Stijn and Niels, not Julia and Sophie). The mocks therefore never
put a ratings-sample score next to a DR2 score. Per-match ratings are labelled
by round and opponent only. The rated match report uses **Mila v Eline
(round 1, 0–3)**, the one Sanne-free match where both samples agree on the score
and the scorers roughly match. No line was rewritten. Every line fitted every
layout at 320 px, including the longest, "Bas V. scored and created. Hard to
ask more of one card."

The DR2 sample also predates ADR-116, so its auto squads still read `handicap
×0.575` (today 0.55). That is not a design point.

## Screen map

| File | Route | State | Shows |
|---|---|---|---|
| `Evening-Champion` | `/midweek` | 21:08, the week complete | Ratings, the weekly calls line and the share block replace DR2's two placeholders; `You` adds wins and calls |
| `Bracket-Complete` | `/midweek/[weekStart]` | the week complete | The same ratings, with `Show each match` open; your calls; share; then the rounds as today |
| `Match-Rated` | `/midweek/[weekStart]/match/[matchId]` | a report once the week is complete | Each card's rating for this match in the Why list, apart from the Power pill |
| `Evening-Out` | `/midweek` | 20:41, out | `Call the winners` replaces the DR2 placeholder: one call saved, one open, the final not open yet |
| `Predict-States` | `/midweek` | every state | Nothing open, open, saving, saved, changed, refused, closed with split, resolved, weekly line |
| `Evening-FinalLive` | `/midweek` | 21:05, the final live | `Your calls` under the final: semi-finals resolved, the final closed with the club's split |
| `Bracket-Calls` | `/midweek/[weekStart]` | 20:41 | Your calls on the bracket's rows; the bracket doesn't take picks |
| `Share-Poster` | image | 1080 × 1350 | The champion poster |
| `Share-MyNight` | image | 1080 × 1350 | "My night" |
| `Share-Flow` | `/midweek` | after tapping | Phones: the system share sheet; desktop: downloaded |
| `Picker-Lines-Balanced` | `/midweek` | saved, balanced | The plusses count under the keeper check |
| `Picker-Lines-OneShort` | `/midweek` | unsaved, defence 1 short | The count, and its verdict in the sticky save bar |
| `Picker-Lines-NoKeeper` | `/midweek` | unsaved, no Goalkeeper | No count, and why (DR3-8) |
| `Picker-Lines-TwoShort` | `/midweek` | unsaved, three keepers | Attack and midfield each 1 short, ×0.77 |
| `Picker-Lines-NoColour` | `/midweek` | the same in greyscale | How it reads without colour |
| `Colours-Tokens` | n/a | violet and teal, with royal blue for comparison | Every token, its contrast and colour-blind simulations, computed |
| `Colours-Report-FullTime-Before/Violet/Royal` | match page | regular-time result | Bart v Fleur 1–0 |
| `Colours-Report-Shootout-Before/Violet/Royal` | match page | penalty shoot-out | Sophie v Sanne 2–2, 7–6 on pens |
| `Colours-Report-Live-Before/Violet/Royal` | match page | still being played | Sanne v Eline at 20:18:20 |
| `Colours-Elsewhere-Before/Violet/Royal` | `/midweek`, `/` | 20:18 | `Your match`, `The final`, Home's live card, the clock, the badge, Live |
| `Pairs-Board` | n/a | round 3 | Four pairs, three without the blue, with their checks; violet and teal chosen |
| `Pairs-royal-teal`, `-indigo-olive`, `-plum-olive`, `-violet-teal` | match page | shoot-out report | Each pair applied to Sophie v Sanne |

## 1. Ratings (F7, amends ADR-117)

**Where they show**, once the week is complete (`status = 'complete'`, the
same moment it is paid):

- **The champion view** (until Thursday 23:59, D4): `Your five's ratings`
  after `Your night` and the calls line, in place of DR2's placeholder.
- **The week's bracket** `/midweek/[weekStart]` for good: the same block near
  the top, with a jump link `Your ratings`. This is how the ratings outlive
  Thursday. A member who didn't enter sees no block.
- **Every match report of that week:** each card's rating for that match in
  the Why list, for both sides. Before the week is complete the column isn't
  there and DR2's list is unchanged. That includes a match that has reached
  full time while the evening is still running: a rating needs the whole
  week's result.
- **The "my night" image** (and the champion's on the poster).

**`MidweekRatingDisc` (new): a rating is never coloured.** It is a neutral
circle: `panel-2` fill, `ink-dim` 1.5 px ring, `ink` number, one decimal,
tabular. Power is a tinted rounded rectangle on the left of a row; a rating is
an untinted circle on the right. They differ in shape, side, range (0.47–1.44
against 4.0–10.0) and colour, so nobody can read a rating against Power's
bands. A heat scale for ratings was considered and rejected: it would collide
with Power's moss-to-orange bands, and a red 4.8 would mock a card. Screen
readers hear `rated 7.5 out of 10 for the night` (or `for this match`, or
`against {Eline}`). Sizes: 52 px (grid), 44 (list), 38 (Why list), 30
(per-match chips).

**`MidweekRatingList` (new):**

- Best first (ties keep slot order). The top card carries the neutral chip
  `★ Best of your five`; there is no mark for the lowest.
- Below `lg`, one row per card: the mini card (`MidweekMiniCard`; a trialist's
  `TRI` frame), the name, `{archetype} · {tier}{ · in goal}`, the line in the
  serif at 17 px, and the disc on the right.
- From `lg`, the five `LiveCard`s in a row with the disc and name under each,
  then the line.
- **Per-match ratings:** one button for the block, `Show each match` /
  `Hide each match` (`aria-expanded`), opens a row of chips under each card:
  `{R2} v {Eline}` plus a 30 px disc. Each chip links to that match's report,
  where the same number is in the Why list. Closed by default on the champion
  view; the mock shows it open on the bracket.
- A foot line with the rule, from `RATING`.

**The Why list with ratings** (`MidweekWhyList`, revised): a third grid
column, the 38 px disc spanning the row's two lines, and `Rating` as a small
column heading at the end of each side's heading. A key above the odds bar
shows a mini Power pill and a mini disc: `Power: how strong a card was going
in` · `Rating: how it played, out of 10`. At 320 px the name column still
gets 160 px.

## 2. Predictions (D, amends ADR-118)

The word on screen is **call**: `Call the winners`, `Your calls`, `You called
it`. It's shorter than "predict", and it's the football word. The result
message's `You called 2 of 3 right` already uses it.

**`MidweekPredictions` (new), on `/midweek` from the moment you're out.** It
replaces DR2's placeholder, in the right-hand column beside `Your night` from
`lg`, under it on phones, above the `The final` card. Title `Call the
winners`. Once nothing is left to call it becomes `Your calls`. Under the
title: `+{2} KUT Coins a correct pick · paid after the final`, from
`predictionCoins(rounds)`.

**`MidweekPredictCard` (new): one per later match you're not in,** listed by
kick-off, the matches still open or not yet open first. Cards are neutral,
because a list of matches gets no team colours (DR2-1).

- **The card** is a `role="group"` labelled `{Semi-final 1}, kick-off
  {20:45}. Who wins?`. Visible: the same kicker, `+{2}` on the
  right (or `Live`, `Closed`, `Full time`), then two options with `v` between
  them.
- **Each option** is a 52 px toggle `<button aria-pressed>` (not a radio, so
  it can be cleared, DR3-5): a ring that fills brass with ✓ when picked, the
  manager's name, and `Your pick` under it. **A tap saves at once** through
  `save_midweek_prediction(week, round, pairing, winner)`; tapping the other
  name changes the pick, and tapping your pick again clears it (a null
  winner). There's no submit button. The status line under the
  options is `aria-live="polite"`.
- **States** (all in `Predict-States`):
  - **not yet open**: dashed card, dashed name boxes holding what's known
    (`Niels` / `Winner of Sophie v Sanne`), `Opens when both matches before it
    have ended.`
  - **open, no pick**: `Tap a name to call it. Closes at kick-off, {20:45}.`
  - **saving**: the tapped option shows a dashed ring and `Saving…`, the other
    is dimmed, `aria-busy` on the group.
  - **saved**: `✓ Saved {20:38}. Change it until kick-off, {20:45}; tap
    {Sophie} again to clear it.`
  - **changed**: `✓ Changed to {Niels}, {20:39}. Change it until kick-off,
    {20:45}; tap {Niels} again to clear it.`
  - **cleared**: `Pick cleared. Tap a name to call it. Closes at kick-off,
    {20:45}.`
  - **refused**: the last saved state stays and a `role="alert"` line explains
    (copy below).
  - **closed at kick-off**: options disabled, `Live` on the kicker while the
    match plays, the club's split (`MidweekPredictSplit`, below), then
    `Closed at kick-off. You picked {Sophie}.` or `You didn't call this one.`
  - **ended**: the winner's option gets `✓ Won`. `✓ You called it {Sophie}
    won. +{2} KUT Coins after the final.` or `Not this time {Joris} won.` The
    "not this time" chip is neutral, never brick or red. A wrong call is never
    marked as a failure.
- **`MidweekPredictSplit` (new):** `How the club called it`, a neutral two-part
  bar (steel and faint ink, a gap between) with `{Niels} {7}` and `{4}
  {Sophie}` beneath. From kick-off only, as the view gates it. Counts only.
  With no picks at all, show `Nobody called this one.` and no bar.
- **Nothing open yet** (e.g. Laura at 20:35: out at 20:34:40 while both other
  quarter-finals are still in their shoot-outs): the block shows every
  not-yet card and `Nothing to call yet` under the title.
- **The weekly line** after the week is complete, as in the result message:
  `You called {2} of {3} right: +{4} KUT Coins.` (or `You called 0 of {2}
  right.`). On the champion view it sits under `Your night` with `Your calls
  →`, which jumps to the bracket. The `You` stat becomes `+{54} KUT` / `{50} for
  wins, {4} for calls`.
- **The bracket keeps your calls for good:** `Your calls` on the complete
  bracket lists each with `✓ +{2}` or `Not this time`.

**Where else picking goes: nowhere.** Recommendation: picking only on the
evening page, which is where a member who is out already is. The bracket shows
each call read-only on its row (`✓ Your call: {Sophie}`, or `Open to call` with
`Call it →` to `/midweek#calls`), and while one is open the jump links lead
with `Call the {semis} · {1} open` (`Bracket-Calls`). One place that saves
means one set of states to build and test. Home's live card, for a member who
is out with a call open, may say `{2} matches to call` above `Follow the
final` (not mocked).

## 3. The shareable result (F8, new ADR)

**Size: 1080 × 1350 px (4:5), PNG.** Reasons:

- A 4:5 portrait shows large in a chat bubble without becoming a thin strip,
  and fills most of a phone screen when opened.
- 1,350 px on the long side is under the size WhatsApp scales images down to
  at standard quality (around 1,600 px, from experience rather than a
  published spec; check on a real phone when building), so the text isn't
  resampled.
- It holds five cards, a path and a headline at sizes that read full-screen on
  a phone. The canvas renders at 1:1 whatever the device pixel ratio.

**Type sizes in canvas px:**

| Element | Size |
|---|---|
| Body | 36 or more |
| Labels | 20 or more |
| Ratings | 34 in an 84 px disc |
| Champion's name | 184, serif |

**The champion poster** (`Share-Poster`), which anyone may share, top to
bottom:

1. The KUT mark and `Midweek Madness · {Wed 7 Oct 2026}`.
2. `Champion`, then the shield and `{Joris}`.
3. `Beat {Sophie} on penalties in the final, {1–1} and {5–4} from the spot.`
   (or `Beat {Sophie} {2–1} in the final.`).
4. `{Joris}'s five · rated out of 10 for the night`, then five cards with
   their night ratings and names.
5. The path: five tiles, round name over `{7–0} {Emma}`, a bye as `Bye`.
6. The foot: `{22} entrants · {64} goals`. No club name and no site address
   on either image (DR3-7).

**"My night"** (`Share-MyNight`):

1. The same top line.
2. `{Sanne}'s night`.
3. The finish in the serif (`Quarter-finals`, `Champion`, `Final`, `Semi-finals`,
   `Round 1`).
4. `+{54} KUT Coins`, wins plus calls.
5. The path as three to five tiles; the tile where you went out is dashed.
6. Your five with night ratings, the best one's disc ringed brighter.
7. `★ {Bas V.} {7.5}` over its line in the serif.
8. The foot: `Called {2} of {3} · {Joris} won it`, or `{Joris} won it` with no
   calls.

**Cards on the images** are the LiveCard face: the photo where the Player has
one (an illustration stands in on the mocks), otherwise LiveCard's shirt back
(ADR-043: surname and OVR as the squad number; the brief's "initials art" is
the bust fallback LiveCard uses only for surnames too long for the arc).
Each image shows one photo card beside shirt backs: Noor E. on the poster,
Bas V. on "my night". The canvas code draws the face itself; it can't render
the React component. It can reuse LiveCard's SVG paths through `Path2D`, or
draw the shirt SVG as an image from a `blob:` URL. The CSP already allows
`blob:` and `data:` in `img-src`.

**`MidweekShare` (new), on the champion view and the complete bracket:**
`Share the night` / `Images for the club's group chat`, then two previews
side by side, each with its own button:

- **Previews.** The canvas output at thumbnail size, with `The champion
  poster` / `{Joris}, the final and the five` and `Your night` / `Your path,
  your five and their ratings`.
- **Phones:** `Share` (primary) and a `Save image` link under it.
- **Desktop:** `Download`.
- **The note under both:** `Both show managers' and Players' names and
  Players' photos. Send them to the club; they're made on your phone, nothing
  is uploaded.`
- A member who didn't enter gets the poster only.

**What happens:**

- **On a phone:** `navigator.canShare({ files: [file] })` true → `navigator.share({
  files: [png], title: "Midweek Madness, Wed 7 Oct" })` opens the system share
  sheet (mocked in `Share-Flow`, labelled as the phone's own).
- **Otherwise** (desktop, or no file sharing): an `<a download>` with an object
  URL. The file names are `kut-midweek-{7-oct}-champion.png` and
  `kut-midweek-{7-oct}-{sanne}.png`. The button then says `Downloaded`, and
  under it: `✓ {file} is in your downloads. Drop it into the group chat.`
- **Choosing which:** by capability and a coarse pointer
  (`matchMedia("(pointer: coarse)")`), not by width. Desktop Chrome supports
  Web Share too, but the owner chose a download there.
- **When it's drawn:** on tap, from data the page already has, with fonts
  awaited through `document.fonts.load`.
- **Photos:** fetched through `fetch` (the CSP's `connect-src` allows the
  Supabase URL), then `createImageBitmap`, so the canvas is never tainted.
- **Errors:** if drawing fails, `Couldn't make the image. Try again.` and
  nothing is shared.

## 4. The picker's plusses count (ADR-116, Q13's later slice)

**`MidweekLineCount` (new)**, in `Your five`, after the keeper check and
before the save bar, on every width:

- **Heading:** `Plusses per line` with `How plusses work →` (the how-it-works
  table).
- **Three rows,** `Attack`, `Midfield`, `Defence`. Each has three pips (a pip
  is filled for a plus and dashed where one is missing; anything above 3 shows
  as `+{4}`), then `{4} of {3}` from 412 px, then `✓ enough` (moss) or `! {1}
  short` (warning amber, `!` in a filled circle).
- **The verdict** (`aria-live="polite"`): `Balanced. Every line has {3} or
  more, so no penalty.` or `{Defence} {1} short: one plus short, so your whole
  five plays at ×{0.88} this week.` (`{Attack} {1} short, {Midfield} {1}
  short: {2} plusses short, … ×{0.77} …`). The factor is `shortfallPpm` to the
  power of the plusses short, floored each step as in `squadBalance`, shown to
  two decimals.
- **The keeper:** `{Anouk B.} goes in goal and isn't counted.` With several
  Goalkeepers: `One of your Goalkeepers goes in goal and isn't counted; the
  others play outfield with their plusses.`
- **No Goalkeeper, no count (DR3-8):** the rows and verdict are replaced by
  `Add a Goalkeeper to see your count. Without one, who stands in goal is only
  settled at the lock, so the picker can't say which four cards count.`, and
  the sticky row reads `No Goalkeeper yet, so no line count`.
- **The rule line:** `Each line needs {3} plusses from the four cards not in
  goal; every plus short costs the whole five ×{0.88}.`
- **Sources:** every number comes from `MIDWEEK.shape.plusses` and
  `MIDWEEK.balance`.

**Which four count.** Empty slots count as trialists (All-rounder 1/1/1),
because that is what plays. With one Goalkeeper, it is in goal. With several,
any one of them is: all are 0/0/3, so the count is the same whichever plays.
Without a Goalkeeper, `chooseKeeper` picks the outfielder with the highest
power × defence. Power includes form, which isn't known until the lock, so the
picker shows no count (DR3-8).

**A finding from the table:** two lines can only fall short at once with two
or more Goalkeepers outfield. A four-card outfield of specialists or
All-rounders always has at least 3 in two of the lines. `Picker-Lines-TwoShort`
therefore shows the three-keeper gamble (×0.77).

**On phones with unsaved changes**, DR2's sticky save bar gets a second row:
`! {Defence 1 short} · ×{0.88}` or `✓ Lines balanced`. The cost is then visible
at the moment of saving, even when the count has scrolled away. The count itself
stays inline (two sticky things would cover too much at 320 px). From `sm` the
bar is inline and the extra row is hidden.

**The phone list rows** (`MidweekPickRow`, revised) gain one line: `A ++ · M ++
· D –` (screen readers: `Plusses: attack 2, midfield 2, defence 0`). From `lg`
the LiveCard grid is unchanged.

**Without colour** (`Picker-Lines-NoColour`): filled against dashed pips, the
✓ and `!` marks, and the words `enough` and `1 short` carry it.

## 5. Deeper team colours

**Chosen: violet and teal (DR3-10).** Two jewel tones that keep KUT's classy
look and stay clear of the brass, moss and brick it already uses. Every DR3
screen shows them.

How it got there:

- **Round 1:** royal blue and claret. The owner liked the deeper blue, but the
  red "is messing up the colour scheme" (DR3-1).
- **Round 2:** burgundy or teal for side 1; the owner took royal blue and teal
  (DR3-9). Burgundy (`#c97a85` / `#8e2b40`) fell away. Each `Colours-*-Royal`
  file shows royal blue and teal for comparison.
- **Round 3:** the owner asked what would work without the blue. Four pairs
  were mocked (see "Round 3" at the end) and the owner chose violet and teal.

**Rejected along the way:**

- **Copper:** it would suit the warm palette best, but it sits on top of the
  brick `Out` chip (ΔE 11) and the orange weak-Power band.
- **Ivory and silver:** they read as body text.
- **Teal with plum or petrol:** colour-blind members can't tell them apart.

Deep colours on a dark board don't pass AA as small text, so each side gets
two tokens:

- a **text tone** for names, score digits and side headings;
- a **fill** for everything drawn: lane rails, the chance bar, penalty dots
  and the 3 px scoreboard strip (kept, DR3-2).

Live moves onto its own tokens and keeps today's pink (DR3-3).

**Drop-in for `src/app/globals.css`** (replaces the team block; the Live block
gains two lines). It keeps today's token names so it drops in as is, which is
how the mocks use it.

**Rename the tokens in the same change.** Neither side is blue or red any
more, so `--color-team-blue*` becomes `--color-team-0*` (violet) and
`--color-team-red*` becomes `--color-team-1*` (teal), with the Tailwind
classes (`text-team-blue` → `text-team-0`, and so on) and every use in the
mapping table below. Nothing else changes.

```css
  /* The Midweek evening's `Live` marker, pinker and brighter than either side
     colour and the brick `Out` chip; its own tint, so it never follows a team. */
  --color-live: #ff8091;
  --color-ink-on-live: #2a0a10;
  --color-live-bg: #331419;
  --color-live-line: #7a2d3b;
  /* Team colours (DR3, violet and teal): side 0 left, side 1 right, for
     every viewer, only where one match is open (DR2-1). The plain token is the
     TEXT tone (names, score digits, side headings: AA on board, panel, panel-2
     and the tinted lanes); -fill is everything drawn (rails, the chance bar,
     penalty dots, the scoreboard strip). */
  --color-team-blue: #9e80d1;
  --color-team-blue-fill: #6f4fa1;
  --color-team-blue-bg: #181322;
  --color-team-blue-line: #423658;
  --color-ink-on-team-blue: #f4efe3;
  --color-team-red: #4fb3a0;
  --color-team-red-fill: #1f7a6c;
  --color-team-red-bg: #0e1f1c;
  --color-team-red-line: #23514a;
  --color-ink-on-team-red: #f4efe3;
```

| Side 0 token | Violet (chosen) | Royal blue (round 2, comparison) |
|---|---|---|
| text | `#9e80d1` | `#7d9bdb` |
| fill | `#6f4fa1` | `#3966c2` |
| bg | `#181322` | `#111a2f` |
| line | `#423658` | `#2c4677` |

Side 1 is teal in both: `#4fb3a0`, fill `#1f7a6c`, bg `#0e1f1c`, line `#23514a`.

**Contrast**, as computed on `Colours-Tokens` (the lane is the `-bg` at 55%
over `board`):

| Token | board | panel | panel-2 | its lane | ink on it |
|---|---|---|---|---|---|
| violet text `#9e80d1` | 5.71 | 5.20 | 4.78 | 5.65 | |
| teal text `#4fb3a0` | 7.32 | 6.68 | 6.13 | 7.00 | |
| royal blue text `#7d9bdb` | 6.70 | 6.11 | 5.61 | 6.47 | |
| violet fill `#6f4fa1` | 2.92 | 2.67 | | 2.89 | 5.53 |
| teal fill `#1f7a6c` | 3.59 | 3.27 | | 3.43 | 4.51 |
| royal blue fill `#3966c2` | 3.40 | 3.10 | | 3.29 | 4.75 |

- Every coloured name and number is AA (≥ 4.5:1).
- Teal's fill passes 3:1 for graphics. Violet's is 2.9:1 on the board, just
  under, within the stretch the owner allowed (round 3). Nothing relies on a
  fill alone: names, lane side, the chance bar's percentages and the ✓ / ✕ on
  each penalty dot carry it.
- Today's pink-on-pink Live pair is unchanged.

**Red–green colour blindness** (Machado 2009, full severity, on the tokens
page), ΔE between the two sides:

| | Typical | Deuteranopia | Protanopia |
|---|---|---|---|
| Text, today | 74 | 66 | 46 |
| Text, violet and teal | 73 | 36 | 47 |
| Text, royal blue and teal | 54 | 36 | 41 |
| Fill, today | 74 | 66 | 46 |
| Fill, violet and teal | 73 | 37 | 47 |
| Fill, royal blue and teal | 70 | 54 | 55 |

- With typical vision violet and teal differ more than royal blue and teal did.
- Deuteranopes tell violet from teal mainly by lightness (36), as they did
  royal blue and teal. It is still clearly distinct.
- Lane side, names and the sr-only sentences carry the side too.

**Kept apart:**

- Violet (hue about 300°) has no neighbour on the board: the nearest are the
  steel grey-blue (ΔE 44) and Live's pink (ΔE 56).
- Teal (about 175°) from the moss `Through` chip (ΔE 35) and the strong-Power
  band (about 95°).
- Live's pink, far lighter and brighter, from either side. Today Live and the
  red team are one colour, which the split fixes.
- Ratings, which are never tinted.

**Which token carries which use, in the code:**

| File | Today | Change |
|---|---|---|
| `report.tsx` 89–90, `player-name.tsx` | `text-team-*` | unchanged (text tone) |
| `report.tsx` 188–189 (lane rail) | `border-team-blue` / `border-team-red` | `border-team-*-fill`; the `bg-team-*-bg/55` tints stay |
| `report.tsx` 239 (`SCORED` kicks) | `bg-team-* text-ink-on-team-*` | `bg-team-*-fill`, same ink tokens (now light) |
| `why-list.tsx` 274–276 (odds bar) | `fill-team-*`, red `opacity-80` | `fill-team-*-fill`, drop the opacity |
| `chip.tsx` 37 (Live chip) | `border-team-red-line bg-team-red-bg` | `border-live-line bg-live-bg` |
| `clock.tsx` 12 (live stop) | `bg-team-red-bg` | `bg-live-bg` |
| `entry-points.tsx` 99 (Home live card) | `border-team-red-line`, `rgb(51_20_25/55%)` | `border-live-line`, `bg-live-bg/55` gradient |
| the scoreboard | none | new: a 3 px strip, side 0's fill left half and side 1's fill right half, across the top (decorative) |

The `rgb(255_128_145/…)` halos in `chip.tsx` and `clock.tsx` are Live's and
stay. Lists of matches stay neutral (DR2-1).

## Components

**Reused unchanged:** `LiveCard`, `MidweekMiniCard`, `MidweekKeeperCheck`,
`MidweekPath`, `MidweekSeed`, the champion hero, `MidweekMatchRow`,
`MidweekFiveList`, `MidweekClock`, `MidweekScoreboard` (apart from the strip),
`MidweekLaneTimeline`, `MidweekShootoutLive`, `MidweekJumpLinks`, `SectionTabs`.

**New:**

- `MidweekRatingDisc`, `MidweekRatingList`
- `MidweekPredictions`, `MidweekPredictCard`, `MidweekPredictSplit`
- `MidweekCalls` (the read-only list on the bracket), `MidweekCallChip` (on
  bracket rows)
- `MidweekShare`, plus `drawChampionPoster` / `drawMyNight` (canvas, pure
  functions of the page's data)
- `MidweekLineCount`

**Revised:**

- `MidweekWhyList`: the rating column and its key.
- `MidweekSaveBar`: the lines row while sticky.
- `MidweekPickRow`: the plusses line.
- The champion view's `You` stat.
- `MidweekScoreboard`: the strip.

**Retired:** the three `MidweekPlaceholder` uses. The component can go with
the last one.

## Data the screens need

| Screen | Needs | Source | Missing? |
|---|---|---|---|
| Ratings, block and image | Every match the member played that week (byes excluded), as `ReportInput` (stored events with `pGoalPpm`, creator, shooter, defender; keeper slot; outcome), the member's side in each, the published `seed_hash`, and the member's user id | `rateNight` (#174) over the match pages' existing reads, once `status = 'complete'` | No SQL. The champion view and bracket now read up to five matches' events for one member, plus the champion's for the poster. Load them in one query by `tournament_id` and the member's matches, not one call per match |
| Ratings, report | That match's `ReportInput` | `matchRatings` (#174), already loaded by the page | none |
| Calls: who is out | The member's own match lost and ended | the existing match projections | none |
| Calls: which matches, and when they open | Each later match's two feeders' winners and `ends_at` (public at their full time, ADR-106), and its kick-off from `roundStartAt(lock_at, round, schedule_version)` | derived on the page; the row is named by round and pairing because the match isn't shown before kick-off | none, but side order matters: side 0 is the winner of feeder `2k`, side 1 of `2k+1`. The cards and the split must follow it |
| Calls: your picks and results | `round`, `pairing`, `predicted_user_id`, `predicted_name`, `saved_at`, `correct` (null until ended) | `kut.my_midweek_predictions` (#175) | none |
| Calls: save, change, clear | | `kut.save_midweek_prediction` (#175); a null winner clears | Clear isn't mocked. If wanted, tapping your own pick again clears it (Q5) |
| Calls: the split | `side_0_picks`, `side_1_picks` from kick-off | `kut.midweek_prediction_splits_public` (#175) | **A match nobody called has no row** (an inner join on picks). The page treats a missing row as 0–0 and shows `Nobody called this one.` |
| Weekly line | Picks, correct, amount | `kut.my_midweek_prediction_rewards` once paid; before that, counted from `my_midweek_predictions` | none. A member with 0 right has no reward row; count their picks from `my_midweek_predictions` |
| `You` stat | Wins plus calls | `my_midweek_rewards` plus `my_midweek_prediction_rewards` | none |
| Share images | The champion's five (names, OVR, archetype, rarity, photo URL), their night ratings, the final, the path, entrants, goals; your five, path, coins, calls | what the champion view already loads, plus the ratings above | Photos: today's `photoUrls` must be fetchable by `fetch` from the browser (they are Supabase Storage URLs; check the bucket's CORS when building) |
| Plusses count | Each picked card's archetype (the week's snapshot, ADR-099) and `MIDWEEK.shape` / `MIDWEEK.balance` | `PickCard` already has the archetype | none |

## Copy

`{…}` is data. Numbers come from `RATING`, `predictionCoins`, `MIDWEEK` and
`roundPayouts`, never typed in. Names only, never pronouns.

### Ratings

- Block: `Your five's ratings`; `Out of 10, the mean of {2} matches` (`… of 1
  match` for one).
- Chip: `★ Best of your five`.
- Meta: `{All-rounder} · {Bronze}{ · in goal}`.
- Buttons: `Show each match` / `Hide each match`; link: `How ratings work →`.
- Chips: `{R2} v {Eline}` with the disc.
- Foot: `Every card starts at {6} and gains for goals, assists, saves and
  blocks, more for the harder ones; a win adds {0.4} and a defeat takes {0.4}
  off. A miss never costs the shooter. The night's rating is the mean of the
  card's matches; a bye isn't a match.`
- Screen readers: `rated {7.5} out of 10 for the night` / `for this match` /
  `against {Eline}`.
- Why list: column heading `Rating`; key `Power: how strong a card was going
  in` · `Rating: how it played, out of 10`; foot sentence added once complete:
  `The circle on the right is how the card played in this match, out of 10,
  from what it did: every card starts at {6}.`
- Lines: exactly as `rateNight` returns them (`line` / `lineParts`).

### Calls

- Titles: `Call the winners`, `Your calls`.
- Sub: `+{2} KUT Coins a correct pick · paid after the final`; `Nothing to call
  yet`; `{2} right so far · +{4} after the final`; `Paid`.
- Kicker: `{Semi-final 1} · kick-off {20:45}`, `The final · kick-off {21:00}`;
  right `+{2}` / `Live` / `Closed` / `Full time`.
- Not open: `Winner of {Sophie} v {Sanne}`; `Opens when both matches before it
  have ended.`
- Open: `Tap a name to call it. Closes at kick-off, {20:45}.`
- Saving: `Saving…` (option tag), `Saving your pick…`.
- Saved: `Your pick` (option tag); `✓ Saved {20:38}. Change it until kick-off,
  {20:45}.`
- Changed: `✓ Changed to {Niels}, {20:39}. Change it until kick-off, {20:45}.`
- Closed: `How the club called it`; `{Niels} {7}` · `{4} {Sophie}`; `Nobody
  called this one.`; `Closed at kick-off. You picked {Sophie}.` / `Closed at
  kick-off. You didn't call this one.`
- Ended:
  - option tag `✓ Won`;
  - `✓ You called it {Sophie} won. +{2} KUT Coins after the final.` (`…
    +{2} KUT Coins.` once paid);
  - `Not this time {Joris} won.`;
  - `{Joris} won. You didn't call this one.`
- Refusals, by the guard's message:
  - `predictions close at kick-off` → `Couldn't change it: picks closed at
    kick-off, {20:45}. Your pick stays {Sophie}.` (no earlier pick: `Couldn't
    save: picks closed at kick-off, {20:45}.`);
  - `…opens for predictions once both matches before it have ended` → `Not open
    yet: it opens when both matches before it have ended.`;
  - `predictions open once you are out` → `Calls open once you're out.`;
  - network or other: `Couldn't save. Check your connection and tap again.`
- Foot: `You're out, so you can call the winners of the matches still to come.
  A match opens once both matches before it have ended, and closes at its
  kick-off. Your picks are yours: from kick-off everyone sees how the club
  split, never who picked whom.`
- Weekly: `You called {2} of {3} right: +{4} KUT Coins.` / `You called 0 of {2}
  right.`; link `Your calls →`.
- Stat: `+{54} KUT` / `{50} for wins, {4} for calls`.
- Bracket: chips `✓ Your call: {Sophie}`, `Open to call`; link `Call it →`;
  jump link `Call the {semis} · {1} open`; list `You picked {Sophie}. {Sophie}
  won.` with `✓ +{2}` or `Not this time`.
- Final live note: `The champion is named and coins are paid when the final
  ends. You: +{50} so far, and {2} for each call that comes true.`

### Sharing

- Block: `Share the night` / `Images for the club's group chat`.
- Items: `The champion poster` / `{Joris}, the final and the five`; `Your
  night` / `Your path, your five and their ratings`.
- Buttons: `Share`, `Save image`, `Download`, `Downloaded`; done `✓ {file} is
  in your downloads. Drop it into the group chat.`; error `Couldn't make the
  image. Try again.`
- Note: `Both show managers' and Players' names and Players' photos. Send them
  to the club; they're made on your phone, nothing is uploaded.`
- Image alt text (for the preview `<img>`): `Preview: The champion poster`,
  `Preview: Your night`.
- The images' own text:
  - `Midweek Madness · {Wed 7 Oct 2026}`; `Champion`; `{Joris}`;
  - the final line as on the champion view;
  - `{Joris}'s five · rated out of 10 for the night`;
  - path tiles `{Round 2}` / `{7–0} {Emma}`, `Bye`;
  - foot `{22} entrants · {64} goals`;
  - `{Sanne}'s night`; the finish word; `+{54} KUT Coins`;
  - `Beat {Eline} {1–0}`, `Lost to {Sophie} on pens, {6–7}`;
  - `★ {Bas V.} {7.5}` and the line;
  - `Called {2} of {3} · {Joris} won it`.

### Plusses

- Heading: `Plusses per line`; link `How plusses work →`.
- Rows: `Attack`, `Midfield`, `Defence`; `{4} of {3}`; `✓ enough`; `! {1}
  short`; overflow `+{4}`.
- Verdict:
  - `Balanced. Every line has {3} or more, so no penalty.`;
  - `{Defence} {1} short: one plus short, so your whole five plays at ×{0.88}
    this week.`;
  - `{Attack} {1} short, {Midfield} {1} short: {2} plusses short, so your whole
    five plays at ×{0.77} this week.`
- Keeper:
  - `{Anouk B.} goes in goal and isn't counted.`;
  - `One of your Goalkeepers goes in goal and isn't counted; the others play
    outfield with their plusses.`;
  - no Goalkeeper: `Add a Goalkeeper to see your count. Without one, who stands
    in goal is only settled at the lock, so the picker can't say which four
    cards count.`
- Rule: `Each line needs {3} plusses from the four cards not in goal; every plus
  short costs the whole five ×{0.88}.`
- Sticky row: `! {Defence 1 short} · ×{0.88}` / `✓ Lines balanced` / `No Goalkeeper yet, so no line count`.
- List row: `A ++ · M ++ · D –` (screen readers `Plusses: attack {2}, midfield
  {2}, defence {0}`).
- Group label (screen readers): `Attack {4} of {3}, enough; …`.

## Records the build needs

- **F7 pages:** amend ADR-117 (where ratings show, neutral disc, best first,
  per-match chips, the Why column), and BUILD_SPEC §44.10's ratings bullet.
- **D pages:** amend ADR-118 (the word "call", one place to pick, the states,
  `Nobody called this one`), and §44.7 / §44.9 if wording moves.
- **F8:**
  - a new ADR: the images, their contents, the size, Web Share and download,
    and the exception to §53 for photos on a shared image (the owner's Q4);
  - the decision that the poster shows the champion's ratings, and "my night"
    the member's calls.
- **Team colours:** a presentation ADR amending DR2's token table (and ADR-111
  where it names the colours). It also records the `-fill` and Live tokens.
- None of these is migration-bearing.

## Owner decisions (DR3, 3 Oct 2026)

- **DR3-1. Team colours:** the deeper blue is approved. The red goes deeper
  still, or gives way to a non-red colour (superseded by DR3-9 and DR3-10).
- **DR3-2.** Keep the 3 px club-colour strip across the scoreboard.
- **DR3-3.** Live keeps its pink, on its own tokens.
- **DR3-4.** Ratings: neutral disc, best first, `★ Best of your five`.
- **DR3-5.** `Call` on screen, not "predict". Tapping your pick again clears
  it, so the options are toggle buttons, not radios.
- **DR3-6.** Picking only on the evening page; the bracket stays read-only. No
  Compete badge for open calls.
- **DR3-7.** The poster shows the champion's night ratings, and "my night" your
  calls. Neither image carries the site address or the club's name.
- **DR3-8.** No plusses count until a Goalkeeper is picked.
- **DR3-9 (round 2, 3 Oct).** Royal blue and teal for now. Everything else in
  DR3 is approved.
- **DR3-10 (round 3, 3 Oct).** Violet and teal are the team colours, replacing
  the blue. The tokens get side-neutral names when they are built.
- **Round 2 fixes (owner, 3 Oct):** the `You` stat reads `+{54} KUT`, and on
  phones the share block is one row per image (preview left; title, `Share` and
  `Save image` right), so the two no longer sit unevenly side by side.

## Round 3: pairs without the blue

The owner asked what would work if the blue went too, while keeping KUT's
classy look. Method (`Pairs-Board`):

1. Every hue was tried as a text tone at a moderate saturation (OKLCH chroma
   at most 0.12) that passes AA on panel-2, with a fill of the same hue at
   OKLCH lightness 0.5.
2. Any hue within ΔE 18 of a colour KUT already uses was dropped: brass, moss,
   brick, the orange weak-Power band, Power band 3, steel, warning amber,
   Live.
3. Each pair was scored on its worst case across typical vision, deuteranopia
   and protanopia.

Findings:

- **Most warm hues are taken** by KUT's own colours, so a side colour there
  would read as one of them.
- **The best-separated pairs lie on the blue–yellow axis,** the one
  red–green colour-blind members keep.
- **Teal with plum or petrol looked good but failed for deuteranopes** (ΔE 18
  and 2), so they're not shown.

| Pair (side 0 / side 1) | Text | Fill | ΔE text (typical / deut. / prot.) | Note |
|---|---|---|---|---|
| Royal blue / teal (round 2's choice) | `#7d9bdb` / `#4fb3a0` | `#3966c2` / `#1f7a6c` | 54 / 36 / 41 | weakest for deuteranopes |
| Indigo / olive | `#8489da` / `#a4932e` | `#5658ab` / `#71640b` | 98 / 95 / 100 | best separated; olive is ΔE 19 from brass |
| Plum / olive | `#bb76b5` / `#a4932e` | `#8b4486` / `#71640b` | 86 / 71 / 85 | warmest; plum is ΔE 39 from Live |
| **Violet / teal (chosen, DR3-10)** | `#9e80d1` / `#4fb3a0` | `#6f4fa1` / `#1f7a6c` | 73 / 36 / 47 | jewel tones; deuteranopes as with royal blue and teal |

Every text tone passes AA. The fills are 2.9–3.6:1 on the board, which is
within the 3:1 stretch the owner allowed. The `Pairs-*` files apply each
pair's side tint and border from one OKLCH rule; the chosen tokens in
section 5 keep round 2's hand-tuned teal tint and border.
