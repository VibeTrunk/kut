# UX review and MM 2.0 pages — design handoff

For every agent building a UI slice of MM 2.0 or the navigation change. Read
this in full before any UI slice. It sits on top of `design/midweek/HANDOFF.md`
(the approved Midweek pages), which still holds for everything this note
doesn't change. Where this note and a mockup disagree, this note wins; where
either disagrees with BUILD_SPEC §44 or §46, the spec wins until an ADR changes
it. **Nothing should be built from the old `design/midweek/` evening mockups**
(20:00 lock, 30-minute rounds): the evening here is the MM 2.0 one.

**Status: approved by the owner (DR2, 2 Oct 2026)** after three review rounds
(DR2-1 to DR2-8 below). The evening's clock is now on `main` as ADR-104
(#147); the mockups use its timing.

The step-1 review that led here is `design/ux-review/review/index.html`
(published as a private artifact, 1 Oct 2026).

## How to read the mockups

- **19 files, one per screen and state,** in `design/ux-review/*.dc.html`, laid
  out on five canvas pages in `design/ux-review/canvas.json`. Each is placed at
  320 px, 412 px and 1440 px; a note beside each row gives the rule it shows.
- **Each file is one responsive page.** Breakpoints are container queries at
  Tailwind's `sm` (640 px) and `lg` (1024 px); in the app they become `sm:` and
  `lg:` classes.
- **Generated, not hand-drawn.** `node design/ux-review/build/build.mjs`
  renders the real `LiveCard` and icons from `src/`, inlines the real
  `globals.css` and `design/midweek/build/midweek.css`, and uses every report
  line exactly as `renderMatchReport` produced it in
  `design/midweek/sample-tournament.json`. It fails if any artboard scrolls
  sideways. Change `build/lib.mjs`, `build/screens.mjs` or `build/ux.css` and
  rebuild; never edit a `.dc.html` by hand. `--shots <dir>` writes PNGs.
- **The evening is retimed** to MM 2.0: lock Wed 7 Oct 19:55, round 1 20:00,
  round 2 20:15, quarter-finals 20:30, semi-finals 20:45, final 21:00. The
  sample's 22 entrants and reports are unchanged; only the clock moved.
- **"You" are Sanne:** a bye, a 1–0 win over Eline in round 2 (both sides
  field Iris W., the "two Max" case), then out to Sophie in the
  quarter-finals, 2–2 and 6–7 on penalties (18 kicks, full time 20:36:10).
  Joris beats Sophie in the final on penalties (12 kicks, full time 21:05:40).
- The picker gives Sanne nine extra Players with archetypes set by the
  generator, so the archetype filter has something to filter.

## Screen map

| File | Route | State | Shows |
|---|---|---|---|
| `Home-Now-Picking` | `/` | Tuesday, not picked, report open | Compact header; the "now" stack by deadline; Coins tile removed |
| `Home-Now-Live` | `/` | Wed 20:18, your match live | The live card leads Home |
| `Compete-Standings` | `/leaderboard` | Standings under Compete | Compete section tabs; "Leaderboard" heading becomes "Standings" |
| `Messages` | `/messages` | 2 new, linked rows | Every message links to its subject; a Midweek result for every entrant |
| `Picker-Empty` | `/midweek` | open, nothing picked | KB-029 lock line and save bar; slots first; list + archetype filter |
| `Picker-Editing` | `/midweek` | 3 picked, choosing slot 4, unsaved | KB-028 in slot row, list, team sheet and card face; compact sticky save bar |
| `Picker-Saved` | `/midweek` | saved, no earlier week | KB-029's empty-bar case fixed; Compete drops "Pick" |
| `Evening-Draw` | `/midweek` | 19:57:30 | The draw and every five from the lock; numbers from 20:00 |
| `Evening-YourMatch` | `/midweek` | 20:18:20 | Your match live; others "In play"; your night |
| `Evening-Out` | `/midweek` | 20:41 | Knocked out; follow-up placeholder; the final to come back for |
| `Evening-FinalLive` | `/midweek` | 21:05:15 | The final live for everyone, mid shoot-out |
| `Evening-Champion` | `/midweek` | 21:08 | Champion after the end; ratings and share placeholders; seal |
| `Match-Yours-Live` | `/midweek/[weekStart]/match/[matchId]` | your match, 20:18:20 | Lanes, team-coloured names, the Why (closed) without goals and assists |
| `Match-Other-InPlay` | same | not your match, before full time | Line-ups and pre-match chances only |
| `Match-Other-FullTime` | same | the same match after full time | The full report; the Why with "Show every factor" opened and Form's explanation showing |
| `Match-Final-Live` | same | the final, 21:05:15 | Regulation chances plus the live shoot-out tally |
| `Bracket-FromLock` | `/midweek/[weekStart]` | 19:57:30 | Kick-off times, "Winner of …", jump links; the tree from `lg` |
| `Bracket-Evening` | `/midweek/[weekStart]` | 20:18:20 | Round 1 at full time, round 2 in play; the tree from `lg` |
| `Weeks-Past` | `/midweek/past` | every past week | The archive the review found missing |

## Owner decisions (DR1, 1 Oct 2026)

- **DR1-1. Option C, named Compete.** The fifth primary tab becomes
  **Compete**, with section tabs **Midweek · Standings · Players**. It owns
  `/midweek`, `/leaderboard` and `/players`. Replaces Leaderboard in the bar.
- **DR1-2. Midweek moves to `/midweek`,** with permanent redirects from
  `/club/midweek` and everything beneath it. This reverses D1 ("Home owns
  `/club/midweek`") in `design/midweek/HANDOFF.md` and ADR-097.
- **DR1-3. Every entrant gets a result message,** including members who won
  nothing. Amends ADR-096, which messages only members who were paid.
- **DR1-4. Groundmasters is not part of MM 2.0.** No Special variant of the
  Midweek mini card is designed here; it comes with the Groundmasters build.
- **DR1-5. Match reports (owner, 1 Oct):** every Player and manager name is
  shown in its team's colour, everywhere in a report, so "Max" for blue and
  "Max" for red can't be confused; no "chance x of 14" counter; the Why panel
  becomes a simple table.

**DR2 review, round 1 (owner, 2 Oct 2026):**

- **DR2-1. Team colours only where one match is open:** a match page, and
  the single-match blocks that preview one (`Your match` and `The final` on
  the evening page, Home's live card). **Every list of matches is neutral:**
  the draw, round rows, the bracket list and tree, `Your night`, the champion
  view, past weeks.
- **DR2-2. No "(manager)" after a Player's name** when both sides field the
  same Player. On screen it is just `Iris W.`, in blue or red; screen readers
  still hear `Iris W. (Sanne's)`.
- **DR2-3. The Why is simple and never scrolls sideways,** on any width: see
  `MidweekWhyList` below. No tables.
- **DR2-4. The desktop bracket tree stays** (the shipped KB-031 tree), with
  the new kick-off, in-play and live states in its boxes.
- **DR2-5. The penalty total sits next to the manager's name,** before the
  kicks, not at the far end of the row.

**DR2 review, round 2 (owner, 2 Oct 2026):**

- **DR2-6. Every factor box always shows Fitness,** even when no card is
  injured, so the five boxes read the same on every card.
- **DR2-7. Each factor explains itself** on mouse-over, and on tap or keyboard
  focus for phones and screen readers (copy below).
- **DR2-8. No `Biggest effect` line. One compact row per card,** about half
  the old height, with Power the most prominent thing on it, coloured by
  strength so a strong or weak card shows at a glance.

Earlier owner decisions that still stand: side 0 is blue and on the left, side
1 red and on the right, for every viewer; colour follows the side, never the
viewer (30 Sep). The evening timings, uniform pacing and polling (30 Sep and
1 Oct) as in the ROADMAP's MM 2.0 section.

**Records needed:** a frontend ADR for DR1-1/DR1-2 amending ADR-053 and
ADR-097, and a BUILD_SPEC §46 update (it also still says the avatar opens a
menu; it links to Settings). DR1-3 changes the payout function, so it is a
migration-bearing change with its own ADR amending ADR-096 (one per PR,
ADR-070). DR1-5 is presentation only.

## Navigation

- `src/lib/nav/routes.ts`: replace the Leaderboard entry with
  `{ key: "compete", href: "/midweek", label: "Compete", owns: ["/midweek", "/leaderboard", "/players"] }`
  and remove `/club/midweek` from Home's `owns`. Add
  `COMPETE_TABS = [Midweek /midweek, Standings /leaderboard, Players /players]`;
  `LEADERBOARD_TABS` goes. Update `tests/unit/nav-routes.test.ts`.
- Icon: reuse `IconLeaderboard` for Compete (the mockups do). A trophy icon is
  optional and not designed here.
- **Compete's status badge** (`CompeteBadge`, new), on the tab in both bars
  and on the Midweek section tab:
  - `Pick` (brass) while a week is open, the member takes part, and they have
    no saved five;
  - `Live` (live red) from the lock to the end of the final;
  - nothing otherwise, and nothing for an opted-out member before the lock.
  The visible word is in the badge; the link's accessible name adds
  "Midweek Madness: you haven't picked your five" or "Midweek Madness is live".
  Anchored to the icon's right edge (`right: -18px`), so it can't push the
  fifth tab past the screen at 320 px.
- Remove the Collection strip (D2): Compete's badge and Home's card replace it.
- Home keeps its Midweek card as the "now" entry.

## Home

- Header below `sm`: kicker `Terrible Football Haarlem`, h1 `This week in KUT`
  at 30 px. No subtitle, no paragraph; the Chronicle and how-it-works links
  move to the risers and activity sections or stay as today below the stack
  (not mocked; keep them reachable).
- **The "now" stack** (`HomeNowStack`, new) holds the cards with a deadline,
  ordered: the Midweek evening while it runs; otherwise by deadline among the
  Midweek pick card, the session report and the injury check-in. Each card is
  one link.
- Stats: **Club Value** and **Rank** tiles with persistent link text (`See the
  maths →`, `Standings →`), and `Open a pack` as a full-width button below `sm`.
  The **KUT Coins tile is removed** (the coin pill shows the balance).
- Top risers as today. Club activity: six rows, consecutive same-member pack
  openings folded into one row (`Member B opened 5 packs.`).
- During the evening the live card shows the scoreboard as it stood at page
  load and the latest chance. **Home does not poll.**

## Messages

- `MessageRow` (new): the whole row is one link to the message's subject.
  Opening a message marks it read; the per-message "Mark read" button goes;
  "Mark all read" stays. Unread rows: filled dot **and** the word `New`.
- Groups: `Today`, `Earlier this week`, then older by date.
- Link targets by `event_type`: Midweek result → that week's bracket; sale /
  purchase → wallet or the card; trade offer → `/market/offers`; trade response
  → the listing; kudos and rating notices → `My card`; session report →
  the Chronicle issue; attendance reward → the Chronicle issue. Rows with no
  sensible target link to nothing and say so by omitting the arrow.

## Midweek: the picker (KB-028, KB-029)

- Order: Compete section tabs, last-week strip (as approved), head, **lock
  line**, `Your five`, keeper check, save bar, privacy line, `Your cards`.
- **KB-029, lock line** (`MidweekLockLine`, replaces `MidweekLockBar`): one
  line, `Squads lock Wed 7 Oct, 19:55 in 1 day, 4 h`; the countdown follows the
  time it counts to. The fairness seal leaves the picker (it's on the bracket
  and the champion view).
- **KB-029, save bar** (`MidweekSaveBar`, revised): the status (dot + words +
  one note line) on the left, actions on the right; never an empty column.
  Clean: inline. **Unsaved changes below `sm`:** sticky above the tab bar as
  one compact opaque row (status + `Save your five`), the secondary action and
  note hidden. Inline from `sm`.
- **KB-028:** a Player whose archetype changed since the week opened shows
  `Goalkeeper this week, Speedster from next` (from `PickCard.archetypeLabel`)
  in the phone slot row, the phone list row, under the desktop team-sheet card,
  and on the card face in the grid as a `LiveCard` `badge` (`Speedster from
  next week`).
- **Your cards below `lg`:** `MidweekPickRow` (new), a compact list: mini card,
  name, `archetype · tier · OVR`, the KB-028 line when relevant, and a button
  (`Add`, `Slot 4` while choosing, or the chip `✓ In`). **From `lg`:** the
  LiveCard grid as approved.
- **Archetype filter** (`MidweekArchetypeFilter`, new): chips with counts,
  `All · Goalkeepers · Defenders · Speedsters · Finishers · Playmakers ·
  All-rounders`, client-side, instant (no submit). A chip appears for every
  archetype the member owns; `All` and `Goalkeepers` always appear, so
  `Goalkeepers 0` makes a missing keeper visible.

## Midweek: the evening

**Timing (as decided, built in ADR-104):** lock 19:55; round `r` starts at
`lock + 5 min + 15 min × (r − 1)`; 14 chance slots of 20 s, so the match clock
runs 0′ to 90′ over 4:40 and a chance is due at `kick-off + minute × 280 s /
90`; after full time a penalty kick every 5 s. Each event's moment is stored
at the lock (`midweek_match_events.reveal_at`, `midweek_matches.ends_at`), and
pages take the clock from the week's `schedule_version`, never from today's
config. Every
match unfolds at the same pace in the data. A member watches **their own
match and the final** chance by chance; every other match shows its result at
its full time. Coins are paid and the champion named after the **end** of the
final. Pages update by polling.

- **Polling:** the evening page, a match page and the bracket poll every 20 s
  while any match is in play, and show `Updated 20:18:20` quietly (under the
  clock, or at the foot of a match page). Home doesn't poll. Reduced motion:
  a new chance appears without its slide-in.
- **`MidweekClock`** (new, replaces `MidweekRevealClock` on evening pages):
  sticky at the top of the page, under the app header. Stops `Lock, Round 1,
  Round 2, Quarters, Semis, Final` with times. States, in shape and word:
  `Locked` (steel ring), `Played` (filled ✓), `Live` (live-red ring with halo),
  `Next` (brass ring), `Later` (dashed). A stop is `Played` once every match of
  that round has reached full time. Rounds the member is still in carry a
  brass dot after the name. The `<ol>` has a full-sentence `aria-label`.
- **Evening page order:** clock, Compete tabs, head, then
  - 19:55–20:00 (`Evening-Draw`): `Your first match` with your five and the
    opponent's (or both possible opponents' after a bye) as `MidweekFiveList`
    (new, neutral panels; yours outlined in brass): mini card, name,
    `archetype · tier · OVR`, `in goal`. Panels sit at their own height (no
    stretching to the neighbour). No form, pick or chance until 20:00. Then
    round 1's pairings with kick-off times.
  - your match in play (`Evening-YourMatch`): `Your match` (live scoreboard +
    the latest chance, `Watch it →`), `Your night`, then `This round` with
    every other match **In play** and no score.
  - you're out (`Evening-Out`): `Your night` with the out row, the follow-up
    **placeholder**, a card pointing at the final, the next round's pairings,
    the round just played.
  - the final (`Evening-FinalLive`): the final in place of your match for
    everyone, with the live shoot-out tally.
  - after the end of the final (`Evening-Champion`): the approved champion
    hero, the four stats, the ratings and share **placeholders**, next week,
    past weeks, the seal and seed.
- **No full-time estimates for matches you aren't watching.** A shoot-out ends
  later than a normal match, so a per-match time would give a draw away. Rows
  say `In play · result at full time` and nothing more. The data must follow:
  a match's result, and any time that implies its length, is readable only
  from its full time.

## Matches

- **`MidweekScoreboard`** (revised): side 0 blue left, side 1 red right; names
  in team colour; the score's digits in team colour. Live: `Live · 64′` (the
  running match clock, `elapsed × 90 / 280 s`, capped at 90′), `Live · pens 3–3` during a shoot-out. No
  chance counter (DR1-5). Through/Out chips only at full time.
- **`MidweekLaneTimeline`** (new, replaces `MidweekTimeline`): chronological.
  Below `sm` one column: a side-0 chance has a blue rail on the left and leaves
  32 px free on the right; a side-1 chance a red rail on the right and 32 px
  free on the left, its head (manager, kind chip, minute) mirrored. When its own
  column is at least 600 px wide (a container query on the timeline, not the
  page), two lanes either side of a minute-and-score spine. The desktop
  report's left column is narrower, so it keeps the one-column leaning form. Each item says whose
  chance it is in words (`sr-only`: "39th minute. Goal for Sanne."). The
  newest item on a live page has a brass outline.
- **`PlayerName`** (new): on a match page every Player and manager name in
  report text, facts, headline, shoot-out lines and the Why is wrapped in its
  side's colour. **No `(manager)` suffix on screen (DR2-2):** the renderer
  disambiguates a Player fielded by both sides as `Iris W. (Sanne)`; the page
  shows `Iris W.` in the side's colour and keeps `(Sanne's)` for screen
  readers only. Dropping the suffix must not leave a double full stop
  (`Kees R. (Bart).` → `Kees R..`). Proposed: `renderMatchReport` returns text
  as segments (`{text}` or `{text, side}`, the Player's base name only), so
  the UI never re-parses names; TypeScript only, no phrasebook change
  (ADR-093 stands). Lists of matches never colour names (DR2-1).
- **On a live page, show nothing that gives the result away:** no headline, no
  facts, and no goals or assists in the Why table until full time (they appear
  then, with a footnote saying so). The timeline and shoot-out show only
  revealed events.
- **A match you aren't in, before full time** (`Match-Other-InPlay`): the
  scoreboard reads `In play · result at full time`, a line explains why, and
  both fives are shown. Its Why table (pre-match chances, factors) may show,
  without goals and assists.
- **Shoot-out, live** (`MidweekShootoutLive`, new): one row per side: the
  manager, **then the running total** (DR2-5), then the kicks, filled in team
  colour (✓) or ringed (✕), dashed rings for the first five still to come;
  and `Last kick: Ayla D. misses.` in an
  `aria-live="polite"` line. Grows in place; a 25-kick sudden death wraps.
- **`MidweekWhyList`** (new, replaces `MidweekWhyPanel`; DR1-5, DR2-3). No
  tables, nothing scrolls sideways at any width:
  - the odds bar, blue and red, with each side's name and percentage beneath;
  - per side, a heading (`{manager}` in team colour, `{46}% before kick-off`,
    the `Auto squad` / `No keeper` chips), then its five cards, highest Power
    first;
  - **Power is the card's power in this match:** `power_ppm × day_roll_ppm`.
    The stored `power_ppm` is the week's power, fixed at the lock, and each
    match multiplies it by a fresh Day roll. Showing the product means the
    factor boxes multiply out to the number on screen;
  - **per card, closed (the default; DR2-8), one compact row:** on the left
    the **Power pill** (`1.19`, 17 px black weight, tinted in its strength
    band and spanning the row's height); beside it, line 1 is the name in
    team colour then `archetype · OVR` plus notes in words (`in goal`,
    `trialist`, `injured`, `handicap ×0.575`, `1 goal`, `2 assists`), wrapping
    if needed; line 2 is a thin bar from 0.50 to 1.50 in the band's colour
    with a tick at 1.00 (an ordinary card). No `Biggest effect` line;
  - **strength bands** (pill text, pill tint and bar):

    | Band | Power | Text | Tint | Border | Screen readers |
    |---|---|---|---|---|---|
    | 4 | ≥ 1.10 | `#8bbd6c` (moss) | `#1c2416` | `#3c5230` | `power 1.19, strong` |
    | 3 | 1.00–1.09 | `#c3d27c` | `#22241a` | `#4a5030` | `…, above ordinary` |
    | 2 | 0.90–0.99 | `#e0ac4a` (brass) | `#2b1f0a` | `#5c4419` | `…, below ordinary` |
    | 1 | < 0.90 | `#e8794f` | `#2a1712` | `#6a3524` | `…, weak` |

    Every text colour is at least 5.8:1 on its tint, `panel` and `board`.
    Colour is never the only signal: the number, the bar's length against the
    tick and the `sr-only` band word carry it too. The bands are a heat scale,
    not team colours: the name keeps its side's colour, the pill and bar
    never do;
  - **`Show every factor`** (one button for the whole panel) opens, under
    each card, one row of five small boxes: `Rating`, `Form`, `Pick`,
    `Fitness`, `Day` (always all five, DR2-6), each as `+19%`, `−7%` or a
    dash. `Hide the factors` closes it. The row is five equal columns: under
    the whole card below 412 px (so `Fitness` fits at 320 px), under the name
    from 412 px;
  - **factor explanations (DR2-7):** each box's label is a `<button>` with a
    dotted underline and `aria-describedby` pointing at a `role="tooltip"`
    element. The explanation shows on hover, on tap (focus) and on keyboard
    focus, and closes on blur or Escape. It spans the whole strip, just below
    it, so it never runs off a narrow screen. Its numbers come from `MIDWEEK`
    config, not hard-coded copy;
  - "Rating" is the OVR factor (old open question 11); handicaps show three
    decimals (old open question 10);
  - owner counts ("6 of 6 owners") leave the report; the bracket's pick
    shares keep them after the final (ADR-091, D3 unchanged);
  - bars are drawn as SVG with `width` attributes (or stepped classes), not
    inline styles, because the CSP blocks inline styles;
  - layout: one column everywhere; on desktop the Why is the report's right
    column with the two sides stacked.

## Bracket

- Jump links (`MidweekJumpLinks`, new): `Your match · R2 20:15` (or `· Live`),
  then each round. The member's match link is brass.
- Round sections list `MidweekMatchRow` (revised) in four states: `Kick-off
  20:00` (from the lock), `In play` (not your match), `Live` (your match or the
  final), and full time with scores. Later rounds show settled names, or
  `Winner of Mila v Eline` for round 2, or `Winner, Quarters 1` beyond.
- From `lg`: **the tree** (DR2-4), as shipped for KB-031 (`bracket.tsx`, one
  shared row grid, a round-`r` pairing spanning `2^(r−1)` round-1 rows, lines
  meeting the next round). Its boxes gain the new states: kick-off time
  (`20:15`), `In play`, `Live`, and the score with ✓ at full time; a bye is a
  dashed one-name box. Names are neutral; the member's box is outlined in
  brass. The list below `lg` and the tree are drawn from the same data.
- **`/midweek/past`** (`MidweekWeekList`, new): one row per week, newest
  first: `{Wed 30 Sep}` / `{Wout H.} won it · {21} entrants. You: {semi-finals},
  +{100}.` or the skip / void reason. Each row opens that week's bracket.

## Team colours (new tokens in `globals.css`)

| Token | Value | Use |
|---|---|---|
| `--color-team-blue` | `#7cb0ff` | side 0 names, score digit, rail, kicks |
| `--color-team-blue-bg` | `#14213a` | side 0 lane and five panel |
| `--color-team-blue-line` | `#2f4f86` | side 0 borders |
| `--color-team-red` | `#ff8091` | side 1 names, score digit, rail, kicks; also the `Live` marker |
| `--color-team-red-bg` | `#331419` | side 1 lane and five panel |
| `--color-team-red-line` | `#7a2d3b` | side 1 borders |

Used only on a match page and the single-match blocks (DR2-1). Both pass AA
on `board`, `panel` and their tinted lanes. Colour is never the only signal: lane position, the manager's name and the `sr-only` sentences
carry it too. The red stays pinker than the brick `Out` chip.

## Components

**Reused unchanged:** `LiveCard` (with its `badge` slot, ADR-102), the mini
card (`MidweekMiniCard`; the five-list uses it at 34 × 48 without its `OVR`
label), `MidweekKeeperCheck`, `MidweekPath` rows, `MidweekSeed`, the champion
hero and stats, `MidweekPickShares`, `SectionTabs`, the bracket tree.

**New:** `CompeteBadge`, `HomeNowStack`, `MessageRow`, `MidweekLockLine`,
`MidweekPickRow`, `MidweekArchetypeFilter`, `MidweekClock`, `MidweekFiveList`,
`MidweekLaneTimeline`, `PlayerName`, `MidweekShootoutLive`, `MidweekWhyList`,
`MidweekJumpLinks`, `MidweekWeekList`, `MidweekPlaceholder` (dashed, `Placeholder
· not decided`, for the three undecided items).

**Revised:** `MidweekSaveBar`, `MidweekScoreboard`, `MidweekMatchRow`,
`MidweekEntryCard` (Home), the Compete tab in `app-nav.tsx`.

**Retired:** `MidweekLockBar`, `MidweekRevealClock` on evening pages,
`MidweekTimeline`, `MidweekWhyPanel`, `MidweekStrip` (Collection).

## Placeholders, not decided

Marked on the mockups with `MidweekPlaceholder`; do not build them from here:

- **Something to follow after a knockout** (`Evening-Out`): prediction,
  consolation bracket or season table.
- **Your five's ratings** (`Evening-Champion`): 1–10 per card with a line.
- **Share your night** (`Evening-Champion`): an image for the group chat; its
  ADR must say what it shows beyond the members-only views (ADR-079).

## Data the screens need

| Screen | Needs |
|---|---|
| Compete badge | Whether a week is open, the member's opt-out, whether they have a saved five; whether now is between `lock_at` and the final's end. |
| Draw (19:55–20:00) | **A pairings-only projection** from the lock (MM 2.0 "bracket from the lock"), with byes and their positions; **entries' five cards from the lock**, without form, pick or day factors until round 1 starts. |
| Live match | Per-event `reveal_at` and the match's `ends_at` (ADR-104, stored at the lock). Still needed: the gated events view returning only events whose `reveal_at` has passed (ADR-106's views-only migration); the current score derived from them. |
| Other matches | The result and goals per side **only from full time**; `ends_at` must not reach a member before it passes, since a late end gives a shoot-out away. |
| Why | The existing `why` data; goals and assists only from full time. |
| Clock | Each round's start (from `lock_at` and the week's `schedule_version`, ADR-104), and whether each round's matches have all passed `ends_at`. |
| Champion | `final_reveal_at` is the end of the final (done in ADR-104). |
| Messages | A link target per notification type; the Midweek result row for every entrant (DR1-3). |
| Past weeks | `midweek_tournaments_public` plus the member's own finish and coins per week (`my_midweek_rewards` and their last match). |

## Copy

`{…}` is data. Numbers come from `MIDWEEK` and `roundPayouts`, never typed in.
Copy carried over unchanged from `design/midweek/HANDOFF.md` isn't repeated,
except where its time changes (20:00 → 19:55; "from 20:30" → "from 19:55").

### Navigation

- Primary tab: `Compete`. Badges: `Pick`, `Live`. Accessible additions:
  `Midweek Madness: you haven't picked your five`, `Midweek Madness is live`.
- Section tabs: `Midweek`, `Standings`, `Players`.
- Standings page: kicker `KUT standings`, h1 `Standings`, lede as today's
  Leaderboard lede.

### Home

- `Terrible Football Haarlem` / `This week in KUT`.
- Midweek, picking: kicker `Midweek Madness · {Wed 7 Oct}`; right `in {22 h}`;
  `Pick your five`; `Squads lock Wednesday at 19:55. You haven't picked yet, so
  an auto squad would play for you, heavily handicapped.`; button `Pick your
  five`.
- Midweek, live: kicker `Midweek Madness · {Round 2}`; marker `Live`; the
  scoreboard; `{39}′ {latest chance text}`; button `Watch your match`. Out:
  button `Follow the final` from the moment you're out.
- Report: kicker `Your report · +50 KUT Coins`; `Add G+A & kudos`; `For
  {Monday}'s session. Closes {Thu 23:59}.`
- Stats: `Club Value` / `See the maths →`; `Rank` / `Standings →`; `Open a
  pack`. Sections `Top risers` (`Players →`), `Club activity`.
- Folded activity: `{Member B} opened {5} packs.`

### Messages

- Kicker `KUT inbox`, h1 `Messages`; `{2} new · opening one marks it read`;
  `Mark all read`; groups `Today`, `Earlier this week`; badge word `New`.
- Midweek result, every entrant (DR1-3):
  - out with coins: `You went out in the {quarter-finals}` / `{Sophie} beat you
    on penalties, {7–6}. +{50} KUT Coins. {Joris} won it.` / `Bracket →`;
  - champion: `You won Midweek Madness` / `{250} KUT Coins over the night.` /
    `Bracket →`;
  - out with nothing: `You went out in round 1` / `{Emma} beat you {2–1}.
    {Joris} won it.` / `Bracket →`;
  - auto squad: append `Your auto squad played for you.`
- Link labels: `Bracket`, `Wallet`, `Offers`, `Your card`, `Chronicle`.

### Picker

- Lock line: `Squads lock {Wed 7 Oct, 19:55} in {1 day, 4 h}`.
- Save bar: `Not picked yet` / `No pick by 19:55 on Wednesday? An auto squad
  plays for you, heavily handicapped.`; `Unsaved changes` / `Nothing counts
  until you save.`; `Saved {Tue 6 Oct, 14:02}` / `Change it as often as you
  like until {Wed 7 Oct, 19:55}.`; buttons `Load last week's five`, `Save your
  five`, `Change your five`.
- Privacy: `From 19:55 on Wednesday, members see the five cards you enter,
  never the rest of your collection. Your cards are never at stake: a result
  only pays coins.`
- KB-028: `{Goalkeeper} this week, {Speedster} from next` (rows and team
  sheet); card badge `{Speedster} from next week`.
- Filter: `All {14}`, `Goalkeepers {1}`, `Defenders`, `Speedsters`,
  `Finishers`, `Playmakers`, `All-rounders`. List buttons `Add`, `Slot {4}`,
  chip `✓ In`.

### Evening

- Clock names `Lock`, `Round 1`, `Round 2`, `Quarters`, `Semis`, `Final`;
  states `Locked`, `Played`, `Live`, `Next`, `Later`; `Updated {20:18:20}`.
- Titles: `The draw is out` · `{Round 2} is live` · `You're out` · `The final
  is live` (champion view as approved).
- Draw (names plain, no team colours): `Your first match`; `{Round 2} · kick-off {20:15}`; `Round 1 is a bye
  for you, which counts as a win (+{17}). In round 2 you meet the winner of
  {Mila} v {Eline}.` (no bye: `You meet {Eline} at {20:00}.`); `Form, pick
  boost and the chances before kick-off appear when round 1 starts at
  {20:00}.`; `Full bracket →`.
- Live: `Your match`, `Watch it →`, `Your night`, `+{17} so far · paid after
  the final`, `Playing {Eline} now.` with `win +{33}`, `This round`.
- Rows: `In play` / `result at full time`; `Live`; `Kick-off {20:15}`;
  `Full time`; bye `counts as a win`.
- Out: path row `Out: lost to {Sophie} {2–2}, {6–7} on penalties. Report`;
  card `The final · {21:00}` / `Everyone watches it live` / `Chance by chance,
  on this page.`
- Final: `The final`, `Watch it →`; `The champion is named and coins are paid
  when the final ends. You: +{50} so far.`
- Placeholder frame: `Placeholder · not decided` + the item's name and one
  line (see the mockups).

### Matches

- Kickers: `{Round 2} · your match · live`, `{Round 2} · in play`, `{Round 2},
  match {6} · full time {20:19}`, `The final · live`.
- Scoreboard: `Live · {64}′`, `Live · pens {3–3}`, `full time`, `{4–5} on
  pens`, `In play` / `result at full time`.
- In play explainer: `You're not in this match, so it isn't shown chance by
  chance. Its result and report appear at full time, at the same moment for
  everyone. Members watch their own match and the final live.`
- `How it went`; live: `A new chance every 20 seconds`; foot `Updated
  {20:18:20} · checks for new chances every 20 seconds`.
- Shoot-out: `Penalties`; `{7} kicks so far · one every 5 seconds` /
  `{12} kicks`; `Last kick: {Ayla D.} {scores|misses}.`
- Why: `Why`; `Chances before kick-off`; legend `{Sanne} {46}%` / `{54}%
  {Eline}`; side heading `{Sanne}` `{46}% before kick-off`; card line
  `{All-rounder} · {39}` plus notes `in goal`, `trialist`, `injured`,
  `handicap ×{0.575}`, `{1} goal`, `{2} assists`; Power `{1.19}` (screen
  readers: `power {1.19}, {strong|above ordinary|below ordinary|weak}`);
  buttons `Show every factor`, `Hide
  the factors`; factor labels `Rating`, `Form`, `Pick`, `Fitness`, `Day`; foot
  `Power is a card's strength in this match; 1.00, the tick on each bar, is
  an ordinary card. Green is stronger than that, amber and orange weaker. It
  multiplies the card's rating, form, pick, fitness and
  this match's day roll{; hover or tap a factor to see what it means}.{ Goals
  and assists are added at full time.} Who picked whom is on the bracket page
  after the final.`
- Factor explanations (figures from `MIDWEEK` config):
  - Rating: `From the card's OVR: no boost at OVR {30}, up to +{10}% at OVR
    {83}.`
  - Form: `The Player's form this week, rolled once at the lock: from
    −{20}% to +{25}%, usually close to zero. Every copy of the Player shares
    it.`
  - Pick: `Picking against the crowd pays: up to +{25}% when few owners
    picked this Player, down to −{12.5}% when nearly all of them did.`
  - Fitness: `−{5}% when the Player is injured; otherwise no change.`
  - Day: `A fresh roll for this match only, between −{12}% and +{12}%.`

### Bracket and past weeks

- Jump links `Your match · {R2 20:15}` / `Your match · Live`, then round
  names. Section header `Kick-off {20:00}`. Placeholders `Winner of {Mila} v
  {Eline}`, `Winner, {Quarters} {1}`.
- Past weeks: kicker `Midweek Madness`, h1 `Past weeks`; rows `{Wed 30 Sep}` /
  `{Wout H.} won it · {21} entrants. You: {semi-finals}, +{100}.`; skipped:
  `No Midweek Madness: the club was on a break. Nothing played or paid.`;
  champion view link `Past weeks →`.

## Open questions and spec friction

1. **Renderer segments.** Colouring names by re-parsing rendered text works
   (the mockups do it) but is fragile; `renderMatchReport` returning segments is
   the clean fix. TypeScript only.
2. **Live minute.** `Live · 64′` is the running match clock. The
   owner asked for no chance counter; a match minute is proposed as the
   football equivalent. Drop it if it reads as the same thing.
3. **Home's live card doesn't poll.** If members leave Home open, it goes
   stale; a 20 s poll is cheap if wanted.
4. **The Collection strip goes** (review recommendation, not an explicit owner
   decision). Keep it if the owner prefers.
5. **Standings is one tap deeper.** Home's Rank tile links straight to it.
6. **Phrasebook lines.** None of the sample's lines broke a layout. The
   possessive-after-bracket case (`Noor E. (Koen)'s shot`) still reads oddly
   but colours correctly; it's listed in the Midweek handoff for the
   phrasebook owner.
7. **Not mocked, follow the review:** the pack summary's `New` / `×3` chips,
   the Settings placeholder removal, the Home masthead links' new place, the
   Report "Why" on desktop beyond what's shown.
