# Midweek Madness pages — design handoff for PRs 7–8

For the agent building PR 7 (entry UI) and PR 8 (results UI). Read this with
`docs/BUILD_SPEC.md` §44, ADR-091 and ADR-093. The mockups are the approved
design (approved by the owner on 2026-09-25); where this note and a mockup
disagree, this note wins, and where either disagrees with §44, §44 wins.

**Specs to update as you build.** D1 changes the navigation, whose canonical
record is BUILD_SPEC §46: PR 7 adds `/club/midweek` to Home's entry there and
records D1 and D2 in `docs/decisions.md`. D3's renderer flag and D4's cutoff
are recorded by PR 8, which implements them.

## How to read the mockups

- **25 files, one per screen and state,** in `design/midweek/*.dc.html`, laid
  out on five canvas pages in `design/midweek/canvas.json`. Each is placed at
  320 px, 412 px (Pixel 7) and, where the layout changes, 1440 px. Every
  artboard is titled `route — state · width`, and a note beside each row gives
  the §44 rule it shows.
- **Each file is one responsive page, not three drawings.** Breakpoints are
  container queries at Tailwind's `sm` (640 px) and `lg` (1024 px), so the file
  renders correctly at whatever width the canvas or a browser gives it. In the
  app they become ordinary `sm:` and `lg:` classes.
- **Generated, not hand-drawn.** `node design/midweek/build/build.mjs` renders
  the real `LiveCard` (plaster cast included) and icons from `src/`, inlines
  the real `globals.css`, reads the real engine config (`MIDWEEK`,
  `roundPayouts`, `revealAt`) and uses every report line exactly as
  `renderMatchReport` produced it in `sample-tournament.json`. It measures each
  artboard in Chromium and fails if a page scrolls sideways at any width. To
  change a mockup, edit `build/lib.mjs`, `build/screens.mjs` or
  `build/midweek.css` and rebuild; never edit a `.dc.html` by hand.
- **"You" are Sanne** in the sample: a bye, a 1–0 win over Eline, then out to
  Sophie 2–2, 6–7 on penalties in the quarter-finals, 50 coins. Her collection
  is invented around her real sample five. The starter-pack screen uses a new
  member, Pieter.
- The shirts read "Q.", "S." and so on only because the sample's surnames are
  initials. Real display names set the surname on the arc as they do today.

## Screen map

| File | Route | State | §44 rule it shows |
|---|---|---|---|
| `Picker-Empty` | `/club/midweek` | open, nothing picked | §44.2 auto squads |
| `Picker-Partial` | `/club/midweek` | open, 3 picked after "load last week's five", slot 4 being filled, unsaved | §44.2 one per Player, trialists, pre-fill saves nothing; ADR-085 cast |
| `Picker-Saved` | `/club/midweek` | open, five saved, last week's result strip | §44.2 only a saved squad counts; §44.9 own squad only |
| `Picker-OptedOut` | `/club/midweek` | open, member opted out | §44.2 opt-out; ADR-091 |
| `Picker-Starter` | `/club/midweek` | open, only the 3 starter cards | §44.2 trialists |
| `Week-Locked` | `/club/midweek` | locked, 20:12, before round 1 | §44.1 times; §44.2 re-check at lock; §44.9 entries appear with round 1 |
| `Week-Revealing` | `/club/midweek` | rounds 1–2 out, 21:05 | §44.1 reveal times; §44.6 bye = win; §44.7 paid after the final |
| `Week-Complete` | `/club/midweek` | complete, 22:41 | §44.7 champion total; §44.8 seed published; §44.1 next week opens at once |
| `Week-SkippedBreak` | `/club/midweek` | skipped: club break | §44.1 club-break gate |
| `Week-SkippedField` | `/club/midweek` | skipped: fewer than 4 entrants | §44.1 minimum entrants |
| `Week-Void` | `/club/midweek`, `/club/midweek/[weekStart]` | void | §44.8, §44.9 a void week shows no results |
| `Week-Disabled` | `/club/midweek` | config off, nothing running | §44.8 launch switch |
| `Bracket-Revealing` | `/club/midweek/[weekStart]` | rounds 1–2 out | §44.6 slots, byes, pairings; §44.9 per-round reveal |
| `Bracket-Complete` | `/club/midweek/[weekStart]` | complete, pick shares | §44.9 pick shares, owner counts ≥ 3 (ADR-091) |
| `Report-Thrashing` | `/club/midweek/[weekStart]/match/[matchId]` | Joris 7–0 Emma (auto squad, 8 moments, hat trick) | §44.10 layout |
| `Report-Shootout` | same | Sophie 2–2 Sanne, 7–6 on penalties, your match | §44.5 penalties; §44.10 tally plus narrated misses |
| `Report-Injured` | same | Mila 0–3 Eline, two injured Players | §44.3 fitness; §44.10 injured variants |
| `Home-BeforeLock` | `/` | Home card, not picked | §47 Home; §44.2 |
| `Home-Live` | `/` | Home card, round 2 out | §44.1 |
| `Collection-Card` | `/club/collection` | the strip, three states | ADR-053 (see owner decisions) |
| `Settings-TakingPart` | `/settings` | Midweek panel, opt-out confirmation open | ADR-091; §44.2 |
| `Settings-OptedOut` | `/settings` | Midweek panel, opted out | §44.2 |
| `HowItWorks-Midweek` | `/how-it-works` | section 12 | §44 in members' words; ADR-091 |
| `Admin-Midweek` | `/admin/midweek` | running, rehearsal output | §44.8 switch and rehearsal |
| `Admin-Void` | `/admin/midweek` | void a week mid-reveal | §44.8 void |

### The page has two jobs at once

The worker creates the next tournament as soon as the current one is
complete, skipped or void (§44.1). So from Wednesday about 22:30,
`midweek_current` (the latest `week_start`) is already **next** week's open
tournament. `/club/midweek` therefore always shows:

1. **the previous tournament's outcome** when there is one to report: the
   champion hero on Wednesday night (`Week-Complete`), a one-line strip after
   that (`Picker-Saved`), or the skip or void notice (`Week-Skipped*`,
   `Week-Void`);
2. **the current tournament**: the picker while `open`, the evening while
   `simulated`.

Which of the two leads, and for how long, is owner decision D4.

## Components

### Reused unchanged

- **`LiveCard`**: the pick grid, the desktop team sheet, your locked five and
  the champion's five. No change is needed. On results pages, feed `injured`
  from the **lock snapshot** (`midweek_entry_cards.injured`), not today's
  injury, so the cast shows what the engine used. The simplest way is to build
  the `injuredPlayerIds` set passed to `toLiveCardPlayer` from the entries.
- **`.tier-chip`** (the Chronicle's rarity chip): pick-shares rows and the "why"
  panel.
- **`SectionTabs` (`row`)**: admin gets an eighth tab, `Midweek`
  (`/admin/midweek`).
- **`not-found.tsx`**: the disabled route.
- App patterns kept as they are: the brass primary button, bordered secondary,
  `rounded-2xl border-line/60 bg-panel/60` panels, the kicker, `display`
  headings, the compressed mobile page header (30 px h1, lede hidden below
  `sm`, per `nav-audit/MobileRules`).

### Changes to `app-shell` and routes

- `src/lib/nav/routes.ts`: the plan says "add `/club/midweek` to the Club
  entry's `owns`", but ADR-053 removed the Club tab and `/club` is now a
  redirect. **Add `/club/midweek` to Home's `owns`** (D1), next to
  `/chronicle`, with the matching case in `tests/unit/nav-routes.test.ts`.
  `/club/midweek` stays under `/club`, so the existing `/club` → `/club/collection`
  redirect is untouched.
- Admin tabs: add `{ key: "midweek", href: "/admin/midweek", label: "Midweek" }`.
- Nothing in `app-nav.tsx` or `live-card.tsx` changes.

### New components

All live in `src/components/midweek/`. The class names in `build/midweek.css`
(`mw-*`) are the reference styling; port them to Tailwind.

| Component | Props | States and notes |
|---|---|---|
| `MidweekLockBar` | `lockAt`, `now`, `seedHash` | Lock time in Europe/Amsterdam, a countdown (`in 1 day, 4 h`; below an hour `in 18 min`), `MidweekSeed` beneath. Client component only for the countdown tick. |
| `MidweekSeed` | `seedHash`, `seed: string \| null`, `defaultOpen?` | A `<details>` "Fairness seal": the short hash, then the explanation and the full hash. When `seed` is set, it shows the seed and a check that `sha256(seed)` equals the seal (computed server-side). Steel and small, never brass. |
| `MidweekSaveStatus` | `kind: "none" \| "dirty" \| "saved"`, `savedAt?` | Dot plus text, `role="status"`: "Not picked yet", "Unsaved changes", "Saved Tue 6 Oct, 14:02". The dot's shape differs per state (dashed, ring, filled), so colour isn't the only signal. |
| `MidweekSquadSlots` | `slots: (SlotCard \| null)[5]`, `activeSlot`, `onActivate`, `onRemove` | Below `lg`: five `mw-slot` rows (number, `MidweekMiniCard`, name, "archetype · tier · OVR", the injured chip, remove). From `lg`: a team sheet of five `LiveCard`s or `MidweekTrialistCard`s. An empty slot is a trialist row with "Add"; the active slot has a brass outline and "Choosing…". |
| `MidweekMiniCard` | `rarityTier`, `ovr`, `injured`, `variant?: "trialist" \| "empty"` | 46 px, 5:7, with the tier-chip palette, the OVR and a plaster band when injured. Needed because `LiveCard` is unreadable below about 140 px (§48). `aria-hidden`; the row carries the text. |
| `MidweekTrialistCard` | `slot`, `state: "trialist" \| "choosing"` | A card-sized dashed frame at `LiveCard` size for the desktop sheet. |
| `MidweekKeeperCheck` | `archetypes: Archetype[]` | One Goalkeeper: "Yara Q. goes in goal." Several: "Your strongest Goalkeeper on the night goes in goal; the others play outfield." None: a warning. Archetypes only, because no factor is known before the lock. |
| `MidweekSaveBar` | `dirty`, `canSave`, `hasLastWeek`, `lockAt` | "Load last week's five" (secondary) and "Save your five" (primary), or a disabled "✓ Saved". **Sticky above the tab bar below `sm`** (`bottom: calc(4rem + env(safe-area-inset-bottom))`); inline from `sm`. Uses `useActionState`, like `savePlayerArchetype`. |
| `MidweekPickTile` | `card`, `state: "add" \| "in"`, `targetSlot?`, `copies` | `LiveCard` plus a 44 px button: "Add to your five", "Put in slot 4" or "✓ In your five". The grid shows one tile per Player; `×2 copies` when more than one copy is owned, and the save sends the strongest copy. Grid: 2, 3 and 5 columns (the KB-006 grid). A filter row: All · Goalkeepers. |
| `MidweekRevealClock` | `stops: {time, name, state: "lock" \| "done" \| "next" \| "hidden", you?}[]`, `compact?`, `label` | The evening as a line of stops: lock, then one per round. States differ in shape (filled ✓, ringed, dashed) and in words ("Out", "Next", "Hidden"). Stops where you are still in get a halo. Below 400 px the lock stop is dropped. On the bracket page each stop is a jump link to its round. An `<ol>` with an `aria-label`. |
| `MidweekPath` | `rows` | "Your night": one row per round you played. A bye row, won rows with a report link and the coins, the out row (brick, "Out" chip), and a dashed "Next" row with the time and the coins a win would pay. |
| `MidweekMatchRow` | `pair`, `revealed`, `known`, `you`, `href?` | Two side rows: ✓ mark and bold for the winner, faint for the loser, penalties as `1 (5)`, "You" and "Auto" chips; a bye is one dashed row. Unrevealed rows show "Reveals 21:30" instead of scores; a pairing whose sides aren't decided yet reads "Winner, QF 1". `role="group"` with a full sentence as its `aria-label` ("Julia 1, Stijn 1, 5–4 on penalties. Julia won."). |
| `MidweekBracket` | `rounds`, `revealedThrough`, `you` | Below `lg`: rounds as sections in order, pairs joined by a bracket line naming the match their winners meet in ("Winners meet in quarter-final 2"). This is also the accessible version. From `lg`: a five-column tree, `aria-hidden`, drawn from the same data. Your path is brass in both. |
| `MidweekPickShares` | `rows: {player, rarity, picks, owners \| null, pickFactor}[]` | A table sorted by pick factor, highest boost first; "a rare pick" when `owners` is null; ▲/▼ plus colour on the factor. Two columns from `lg`. |
| `MidweekScoreboard` | `match` | **Always side 0 left and side 1 right,** from the per-side goals, never `report.score` (which is winner-first). "✓ Through" and "Out" chips in words, penalties as "7–6 on pens". |
| `MidweekTimeline` | `timeline`, `managers` | An `<ol>`: the minute, a kind chip (Goal, Save, Block, Woodwork, Wide; a word, not only a colour), "for Sanne" or "Sophie's chance", the renderer's text, and the running score with the scoring side's number bold. Each item has an `sr-only` "Score after this: …". |
| `MidweekShootout` | `shootout`, `managers` | A tally row per side (✓ scored, ✕ missed; sudden-death kicks ringed), the total, a legend, an `sr-only` table of every kick, then `shootout.lines` in order with the decider emphasised. |
| `MidweekWhyPanel` | `why`, `managers` | The odds bar (both percentages printed on the bar and named beneath it; one side hatched as well as coloured), then each side: manager plus "Auto squad" and "No keeper" chips, then each card: tier chip, name, "archetype · OVR", **Power** large, a five-cell factor strip (OVR, Form, Pick, Fitness, Day; ▲/▼ plus green or red away from 1.00) and chips (In goal, Trialist, Injured, the handicap, the pick label, goals, assists). A one-line formula at the foot. |
| `MidweekEntryCard` | `state` | Home, directly under the header. Before the lock: "Pick your five" or "Your five are in". During the evening: "Round 2 is out" plus your result, the next time and a compact clock. After the final: "Joris won Midweek Madness" plus your result, until D4's cutoff. Hidden when disabled or opted out. |
| `MidweekStrip` | `state` | A one-line link on Collection (three states in `Collection-Card`) and the next-week link on `Week-Complete`. |
| `MidweekOptOutPanel` | `optedOut`, `hasSavedSquadThisWeek`, `locked` | Settings: a switch, three privacy bullets and a two-step opt-out; opting back in is one tap. |

## Data

What each screen reads. `midweek_current` and `my_midweek_squad` are as in
PR 3's migration; the rest are PR 5 and PR 6 views as planned. **Bold** marks
something the spec or the planned views don't yet provide.

| Screen | Reads |
|---|---|
| Picker | `midweek_current` (`enabled`, `tournament_id`, `week_start`, `lock_at`, `seed_hash`, `status`, `opted_out`); `my_midweek_squad` for this tournament's saved slots, **and last tournament's rows for "load last week's five"** (the view returns every tournament, so filter on the previous `week_start`, then drop cards no longer owned); `my_collection_cards` for the grid (group by `player_id`, strongest copy first) plus `fetchInjuredPlayerIds` for the cast. |
| Last-week strip, skip and void notices | **The previous tournament.** `midweek_current` returns only the latest, which is already next week's. Needs either a `previous_*` set of columns or a small `midweek_tournaments_public` view (week, status, reason, champion, `final_reveal_at`). |
| Skip and void wording | **`status_reason` as a code** (`club_break`, `too_few_entrants`, `admin_void`) plus the admin's free text for void. `midweek_current` doesn't expose `status_reason` today, and the member copy differs by reason. |
| Week, locked | `midweek_current`; my saved cards (`my_midweek_squad` joined to `my_collection_cards`). No one else's data. |
| Week, revealing and complete; bracket | `midweek_matches_public` (round, pairing, both sides' manager display names, **goals per side**, penalties per side, winner side, win chance, `reveal_at`); **byes with their round-1 pairing** (a bye isn't a match, and the sample JSON lists byes without positions, so the mockup had to rebuild them from round 2); `midweek_entries_public` for the `auto` flag per entrant; `midweek_current.seed` once complete. |
| Your coins | **A member view of my midweek rewards** (`midweek_rewards` rows for `auth.uid()`, or ledger rows with reason `midweek_win`). Before payout, "+17 so far · paid after the final" is computed from `roundPayouts` and the revealed wins, as display only. |
| Champion's five | `midweek_entries_public` cards: **`player_id` and photo path** for `LiveCard`, the locked OVR and archetype (attributes are OVR plus `ARCHETYPE_OFFSETS`), and the lock-time injured flag. The rarity tier comes from the locked OVR via `getRarityTier`, not from today's rating. |
| Report | `midweek_matches_public` plus `midweek_events_public` plus both sides' entries, into `renderMatchReport`. **Per-card, per-match day rolls**: the "why" panel shows `dayRollPpm`, which is per card per match, but the plan puts `day_roll` on events. It needs a per (match, side, slot) home. |
| Pick shares | `midweek_pick_shares_public` after `complete`: player, picks, owners (null below 3), pick factor, plus rarity for the chip. |
| Home card | `midweek_current`, the count of my saved slots, and my latest revealed match from `midweek_matches_public`. |
| Settings | `midweek_current.opted_out`; whether I have a saved squad for an open, unlocked tournament (for the confirmation wording); `set_midweek_opt_out`. |
| Admin | `midweek_config.enabled`; the current tournament's status and times; **counts of saved squads and opt-outs** (admin-only); **the `admin_midweek_rehearsal` return shape**, which should carry the field, picked and auto counts, the auto squads' managers, a per-round summary, the champion, and a list of `{level, message}` warnings such as "slot 3 card no longer owned → trialist". |

## Copy

UI copy outside the reports, ready to use. `{…}` is data; numbers come from
`MIDWEEK` and `roundPayouts`, never typed into the copy.

### Picker (`/club/midweek`)

- Kicker: `Midweek Madness · {Wed 7 Oct}`. Title: `Pick your five`.
- Lede (from `sm` only): `Five of your cards, one knockout, Wednesday night. Every match you win pays KUT Coins; the champion takes {250} in all.`
- Lock bar: `Squads lock` / `{Wed 7 Oct}, {20:00}` / `in {1 day, 4 h}`.
- Seal summary: `Fairness seal {a511a3f0…5dfa4abc}`. Expanded: `This week's draws were fixed before anyone picked. The seal is a fingerprint (SHA-256) of a secret seed; the seed is published once the final is shown, so anyone can check the fingerprint matches and nobody, admins included, could have re-rolled the week.` After complete: `✓ Matches the seal. SHA-256 of the seed is the seal above.`
- Privacy line: `From 20:30 on Wednesday, members see the five cards you enter. Never the rest of your collection.`
- Not picked: `No pick, no problem, just a worse one. If you haven't saved a five by {20:00} on Wednesday, an auto squad plays for you: up to five random Players from your collection, all heavily handicapped. Picking takes a minute.`
- Loaded last week's five: `Loaded last week's five. {Tess F. and Wout Y.} aren't in your collection any more, so slots {4 and 5} are open. Nothing is saved until you press Save.` (All still owned: `Loaded last week's five. Nothing is saved until you press Save.`)
- Section: `Your five`. Status: `Not picked yet` / `Unsaved changes` / `Saved {Tue 6 Oct, 14:02}`.
- Slot meta: `{All-rounder} · {Bronze} · OVR {40}`, adding ` · plays at reduced fitness` when injured, plus the chip `Injured`.
- Trialist slot: `Trialist` / `Plays here if you leave it empty: a Common All-rounder, OVR {30}, handicapped.` Active: `Choosing…` / `Tap a card below to put it here.` / `Cancel`. Remove: aria-label `Remove {name} from slot {n}`.
- Keeper: `{Yara Q.} goes in goal.` / `Your strongest Goalkeeper on the night goes in goal; the other plays outfield.` / `No Goalkeeper in your five. Your best defender goes in goal, and keeps goal much worse than a real one.`
- Save bar: `Load last week's five`, `Save your five`, `✓ Saved`; note `Change it as often as you like until {Wed 7 Oct}, {20:00}.`
- Grid: `Your cards`; filter `All {12}` · `Goalkeepers {1}`; `One slot per Player. Where you own two copies, the stronger one plays.`; buttons `Add to your five` / `Put in slot {4}` / `✓ In your five`; badge `×{2} copies`.
- Starter: `You have {3} Players, so {2} trialists make up your five. Trialists are handicapped; every Player you add from a pack beats one. Open a pack →`
- Save errors (map `friendlyError` codes): 22023 → `Pick between one and five cards you own, one per Player.`; locked → `Squads are locked. Your five from before {20:00} is the one that plays.`; opted out → `You've opted out. Take part again to pick a five.`
- Toast after saving: `Saved. Your five play on {Wednesday}.`

### Opted out (`/club/midweek`)

- Title: `You're sitting this out`.
- `You opted out of Midweek Madness, so you aren't entered: no squad, no auto squad, and none of your cards are shown to anyone.` / `Come back and you're in for {Wed 7 Oct}, picked or auto.` / buttons `Take part again`, `Settings` / `You can still follow Wednesday's bracket from 20:30 like everyone else.`

### Wednesday (`/club/midweek`)

- Locked: title `Squads are locked`; lede `The bracket is drawn and every match is already decided. Round 1 comes out at {20:30}, then a round every half hour.`; `Round 1 at {20:30}, in {18} minutes. The final at {22:30}.`; `Locked in: all five still yours` (or `Locked in. {Olaf G.} was no longer yours at the lock, so a trialist took that slot.`, or for no pick `You didn't pick, so an auto squad plays for you. See it at {20:30}.`); `Members see these five from 20:30, with their numbers for the week.`
- Revealing: title `Round {2} is out` (the final: `The final is out`); `Your night`; `+{50} so far · paid after the final`.
- Path rows: `Bye. Counts as a win.` / `Beat {Eline} {1–0}. Report` / `Out: lost to {Sophie} {2–2, 6–7 on penalties}. Report` / `Next: {Sophie}. Result at {21:30}, in {25} minutes.` with `win +{50}`. If you're out, your last row is the Out row and the section header reads `{+50} · paid after the final`.
- Clock words: `Lock`, `Round 1`, `Round 2`, `Quarters`, `Semis`, `Final`; states `Locked`, `Out`, `Next`, `Hidden`.
- Complete: kicker `Midweek Madness · {Wed 7 Oct} · Champion`; `Beat {Sophie} {on penalties} in the final, {1–1 and 5–4 from the spot}. {250} KUT Coins over the night. Report →`. Stats: `You +{50} paid to your wallet`, `Your finish {Quarters} {out on penalties}` (champion: `Champion`), `Entrants {22} {7} auto squads`, `Goals {64} in {21} matches`. `{953} KUT Coins paid across the club tonight.` Next week: `Next Wednesday is open — Pick your five for {Wed 14 Oct}. Locks at {20:00}.`
- Last-week strip: `Last Wednesday · {30 Sep}` / `You reached the {semi-finals}. +{100} KUT Coins. {Lieke} won it.` (`You won it! +250 KUT Coins.` / `You went out in round 1.` / `You sat it out.`) / `Bracket →`.
- Club break: `No Midweek Madness on {Wed 7 Oct}. There was no TFH session the week before, so the club was on a break. Nothing was played or paid, and your saved five didn't carry over.`
- Too few: `No Midweek Madness on {Wed 7 Oct}. Only {3} clubs were in, and a bracket needs {4}. Nothing was played or paid.`
- Void: `{Wed 7 Oct} was called off by an admin. "{reason}" No results are shown and no coins were paid for that night.`

### Bracket and reports

- Bracket: back `← Midweek Madness`; title `The bracket` (complete: `{Joris} won it`); legend `✓ went through` · `You your path` · `Auto auto squad` · `Bye counts as a win` · `(4) penalties`; round headers `Round 1`, `Round 2`, `Quarter-finals`, `Semi-finals`, `Final` with `Out at {20:30}` or `Reveals {21:30}`; `Winners meet in {quarter-final 2}`; placeholder `Winner, {QF 1}`.
- Pick shares: `Who picked whom`; `How many managers picked each Player, out of the entrants who own one. The fewer who picked a Player, the bigger the boost. Auto squads don't count. Owners are shown only when at least {3} entrants own the Player.`; columns `Player`, `Picked`, `Owners` (`of {12} owners` / `a rare pick`), `Pick factor`.
- Report: back `← {Wed 7 Oct} bracket`; kicker `{Quarter-final 2} · out at {21:30}`; chips `✓ Through`, `Out`, `You`, `Auto squad`; under the score `full time` or `{7–6} on pens`; sections `How it went`, `Penalties` (`{18} kicks · sudden death` or `five each`; legend `scored`, `missed`, `sudden death`), `Why`; `Chances before kick-off`; `{55}% before kick-off`; chips `No keeper`, `In goal`, `Trialist`, `Injured`, `handicap ×{0.58}`, `{1} goal`/`{2} goals`, `{1} assist`/`{2} assists`; foot `Power is the card's week: OVR × Form × Pick × Fitness, times any handicap, fixed at the lock. Each match multiplies it by a fresh Day roll. A green arrow is above 1.00, a red one below.`
- Timeline labels: `for {Sanne}` on goals, `{Sophie}'s chance` otherwise.

### Entry points

- Home, before the lock: kicker `Midweek Madness · {Wed 7 Oct}`; `Pick your five`; `Squads lock Wednesday at 20:00, in {1 day, 4 h}. You haven't picked yet, so an auto squad would play for you, heavily handicapped.`; button `Pick your five`. Saved: `Your five are in` / `Change them until Wednesday 20:00.` / button `Change your five`.
- Home, evening: kicker `Midweek Madness · live`; `Round {2} is out`; `You beat {Eline} {1–0}. Quarter-final against {Sophie} at {21:30}.` (out: `You went out to {Sophie} on penalties. {Final} at {22:30}.`); button `Follow the bracket`.
- Home, after the final: `{Joris} won Midweek Madness`; `You reached the {quarter-finals}: +{50} KUT Coins.`; button `See the bracket`.
- Collection strip: `Midweek Madness: pick five of these` / `Squads lock Wed 20:00. No pick, auto squad.`; `Midweek Madness: your five are in` / `Change them until Wed 20:00.`; `Your five are playing tonight` / `{Quarter-final} at {21:30}.`

### Settings

- `Midweek Madness` / `A knockout for five of your cards, every Wednesday.` / state `You're taking part` or `You've opted out`.
- Bullets: `Members see the five cards you enter, or your auto squad, from 20:30 on the Wednesday, with their numbers for the week.` · `The rest of your collection is never shown.` · `Opting out takes you out completely: no squad, no auto squad, nothing shown.`
- Confirmation: `Opt out of Midweek Madness?` / `Your saved five for {Wed 7 Oct} will be removed and you won't be entered. You can come back any time before a Wednesday's lock.` / `Opt out` · `Keep playing`. Between lock and final: `Tonight's squads are already locked, so this applies from next Wednesday.`
- Opted out: `You aren't entered and none of your cards are shown. Switch it back on to be in for {Wed 7 Oct}, picked or auto.`

### How KUT works, section 12

As in `HowItWorks-Midweek`, with subsections: The week · If you don't pick
· What makes a card strong · Coins (table from `roundPayouts` for 4, 8, 16 and
32 entrants) · What other members see (steel callout, the ADR-091 wording) ·
Fair draws. It's the rules page, so it stays up even when Midweek Madness is
disabled.

### Admin

- `Running` / `While running, a new tournament opens as soon as the last one ends. Pausing stops new ones; a tournament that is already open still plays unless you void it.` Paused: `Paused`.
- `This week · {Wed 7 Oct}`: `Status`, `Locks`, `Squads saved`, `Opted out`, `Seal`, `Void this week…`.
- `Rehearsal` / `Runs the engine on the squads saved right now plus auto squads, with a throwaway seed. Writes nothing and pays nothing. Last run {Tue 6 Oct, 21:14}.` / `Run again` / `Rehearsal champion: {Joris}. Throwaway seed, so not tonight's result.`
- Void: title `Void {Wed 7 Oct}`; `Voiding hides every result of this week, including rounds already shown, and pays nobody. It can't be undone, and it can't re-run the week. It's possible until the coins are paid after the final at {22:30}.`; `Reason, shown to every member` (1–200 characters); `I understand nobody is paid for {Wed 7 Oct} and the results disappear.`; `Void {Wed 7 Oct}` · `Cancel`. After payout: `{Wed 7 Oct} has been paid, so it can't be voided. Correct a member's coins with a wallet adjustment in Economy.`

## Owner decisions

Decided by the owner in review on 2026-09-25.

- **D1. Home owns `/club/midweek`.** Add it to Home's `owns` in
  `src/lib/nav/routes.ts`, next to `/chronicle`, because both answer "what's
  happening this week". The planned "Club entry" no longer exists (ADR-053).
- **D2. The "Club page" card becomes the Collection strip** under the
  Collection header (`Collection-Card`), in its three states. There is no
  `club/page.tsx` any more; `/club` redirects to Collection. Home keeps its own
  card as well.
- **D3. Owner counts are withheld until the week is `complete`.** Until then
  the pages pass `picks` and `owners` as null into `renderMatchReport`, so the
  "why" panel shows each pick factor but no "N of M owners" label; from
  `complete` the labels appear (as in the mockups, which show a completed
  week). Passing null isn't enough, because the renderer reads null as "a
  rare pick"; see open question 1 for the renderer change this needs. §44.9 and ADR-091 stand unchanged. PR 5's `midweek_entries_public`
  must not expose owner counts before `complete` either.
- **D4. Last Wednesday's result leads `/club/midweek` until Thursday 23:59
  Europe/Amsterdam:** the champion hero on Wednesday night and Thursday
  (`Week-Complete`). From Friday it shrinks to the one-line strip above the
  picker (`Picker-Saved`) until the next lock. The Home card follows the same
  cutoff.

## Open questions and spec friction

1. **Owner counts before `complete`: resolved by D3.** The renderer's "why"
   panel prints `pickLabel` ("6 of 12 owners") in every report, and reports
   appear from round 1, while §44.9 publishes owner counts only at `complete`.
   The pages withhold them until then. **This needs a renderer change in PR 8,
   with tests;** passing null is not enough. Today `render.ts` reads
   `owners === null` as "a rare pick" (line 262), and the contrarian-hero fact
   picks its `contrarian_known` line (which cites "N of M owners") or its
   `contrarian_rare` line by the same test (line 440). Null before `complete`
   would label every card "a rare pick" and change the fact line when the week
   completes. Proposed: a `ReportInput.ownersPublished: boolean`. When false,
   `pickLabel` is null for every card and the contrarian fact uses a third,
   count-free phrasing (a new phrasebook line, for the owner's read-through),
   so a report's text never changes after it first appears. Report text
   stability is worth keeping: members will quote reports on the night.
2. **Byes aren't matches.** The bracket needs each bye's round-1 pairing.
   Neither `midweek_matches_public` as planned nor the sample JSON carries it.
3. **The previous tournament disappears** from `midweek_current` the moment
   the next opens (see "The page has two jobs at once"). It needs a view.
4. **Per-card day rolls** need a per (match, side, slot) home; see Data.
5. **`report.score` is winner-first** ("3–1" when the away side won 3–1),
   while the timeline is side-ordered. The mockups keep side 0 on the left
   everywhere and never render `report.score`. The views should give goals per
   side.
6. **Disabled while a tournament is still running.** §44.8 says an open
   tournament still runs. Proposed: the pages and entry points stay visible
   until that tournament is complete or void, then hide (`Week-Disabled`). Past
   bracket URLs keep working, as history.
7. **Void mid-evening** hides rounds members have already seen. That follows
   §44.9 ("shows no results"). Confirm that is intended, since members may
   have read a report that then vanishes.
8. **No archive of past weeks** is designed. The last-week strip links to one
   bracket. A list of past tournaments (perhaps via the Chronicle) is a
   ROADMAP candidate, not PR 8 scope.
9. **Field size before 20:30.** Nothing says how many entered until round 1,
   and the mockups show none. If wanted, it's a count only, safe under ADR-091.
10. **Handicap precision.** `0.575` renders as `×0.57` or `×0.58` at two
    decimals. Show handicaps at three decimals, or as "auto squad" and
    "trialist" without the number.
11. **The "OVR" factor column** is the OVR *factor* (1.00–1.10), beside the OVR
    itself in the subtitle. It reads fine with the formula line, but "Rating"
    is an alternative label if review finds it confusing.
12. **Phrasebook lines that don't sit well in a layout** (not rewritten; for
    the phrasebook owner):
    - `A Olaf G. throw-in turns into a pinball game in the box.` The article
      needs to follow the name ("An Olaf G. throw-in"), or the line needs
      rephrasing, since it can't know the name.
    - `Chris D. reads Noor E. (Koen)'s shot …` and three more: a possessive
      after the manager in brackets. It happens whenever both sides field the
      same Player.
    - `… to deny Vera I.!`, `The woodwork denies Ayla D.!`, `Hat trick for Olaf G.!`:
      an initial's full stop followed by "!". ADR-093 tidies a double full stop
      but not this.
    - In the "why" panel the doubled names, "Olaf G. (Joris)" under Joris's own
      side, are redundant. The renderer could expose the base name and the
      disambiguation separately.
    - Line lengths fit every layout: headlines at most 59 characters, timeline
      entries at most 177, which wrap to about six lines at 320 px.
13. **Sample data mismatch:** the "why" cards carry archetype slugs
    (`all_rounder`) and entries carry labels (`All-rounder`). It's harmless to
    the design, but the real views should use one: slugs, as elsewhere.
