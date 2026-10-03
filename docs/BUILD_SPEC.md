# TFH Ultimate Cards — Product & Technical Build Specification

**Project:** Browser-based collectible football-card game for Terrible Football Haarlem (TFH)  
**Working title:** **TFH Ultimate Cards**  
**Host:** VibeTrunk.com, preferably `tfh.vibetrunk.com`  
**Document version:** 1.0  
**Date:** 16 August 2026  
**Intended implementers:** Codex and/or Claude Code, supervised by a vibe coder  
**Primary stack:** Next.js + TypeScript + Supabase + Vercel  
**Primary device:** Mobile browser, with full desktop support

> **Naming note (added by `vibetrunk-new-tool` scaffolding):** this project
> shipped as **Kelderklasse Ultimate Team (KUT)** — repo `VibeTrunk/kut`,
> subdomain `kut.vibetrunk.com`, Supabase schema `kut` — instead of the
> working title and subdomain below. Per Part XLVIII of this document, the
> final product name was always a deferred, non-blocking decision; this
> spec is kept verbatim as the canonical product/technical reference, so
> read every "TFH Ultimate Cards" / "TFH Cards" / `tfh.vibetrunk.com` below
> as this project. See `docs/decisions.md` for the rest of the naming
> decision.

---

## 1. Purpose of this document

This is the canonical product and technical specification for the TFH card game.

It is deliberately detailed enough that a coding agent can build the project over multiple sessions without needing to reconstruct core decisions from chat history.

When implementation decisions conflict with this document:

1. Security and data-integrity requirements win.
2. The game-economy invariants in this document win.
3. The simplest implementation that satisfies the specification wins.
4. If a coding agent changes a game rule, database invariant, public API, or phase acceptance criterion, it must update this specification or record the deviation in `docs/DECISIONS.md`.
5. Do not silently "improve" formulas or game rules.

The initial goal is not to recreate EA Sports FC/FIFA Ultimate Team feature-for-feature. The goal is to create a small, original, socially fun game whose strongest mechanic is that **real TFH attendance and football performances change the value and appearance of cards owned by other people**.

---

# PART I — PRODUCT VISION

## 2. Product concept

TFH has roughly 200 members. Roughly 40–60 appear with some regularity, and approximately 20 players attend a typical Monday and/or Friday football session.

Every real TFH player has a digital player identity and a **Live Card**.

Users create an account and build a collection of card copies representing TFH players.

The core loop is:

1. Real football happens.
2. An admin records attendance, and optionally goals.
3. The game recalculates Live Card ratings.
4. Card visuals, rarity, discard value, and market expectations change.
5. Users open packs, collect, buy, sell, speculate, and compare club values.
6. The next real game creates another market event.

The intended feeling is:

> "Bas is only 57 and says he is coming both Monday and Friday. I'm buying him before everyone notices."

Then:

> "Bas scored twice. His card became Gold and I bought four copies yesterday."

This connection between the real group and the virtual economy is the product's main differentiator.

---

## 3. Product principles

### 3.1 Showing up matters more than being good

TFH is not meant to become a public ranking of who is objectively best at football.

Long-term card value is driven primarily by attendance and consistency.

Actual football performance creates temporary form and special collectible moments, but should not make the five best footballers permanently dominate the game.

A mediocre but extremely reliable player should be a desirable asset.

### 3.2 Every normal card is alive

All normal copies of a player's Live Card reference the same current player state.

If Richard rises from 59 to 61:

- every Live Richard copy becomes 61;
- every Live Richard copy gets the new rarity treatment;
- every Live Richard copy gets the new discard value;
- historical Special Richard cards do not change.

### 3.3 Special cards preserve history

Special cards are frozen snapshots.

Examples:

- Team of the Week
- Hat-Trick Hero
- 10-Week Iron Man
- 50th Appearance
- Comeback
- Team of the Season

A special card created on a date retains its stats and artwork forever, even if the player later disappears for six months.

### 3.4 The game should generate stories

Optimize for moments users will mention in WhatsApp or at football:

- "I packed myself."
- "Why do you own eleven copies of Dennis?"
- "He went Silver to Gold overnight."
- "I sold him the day before his hat trick."
- "I sacrificed you in a challenge."
- "I have the only tradeable Hat-Trick Bas."

### 3.5 No real-money economy

There is no purchasing coins, packs, cards, or advantages with real money.

Do not build cash-out, gambling, paid loot boxes, crypto, NFTs, or transferable real-world value.

The currency is game-only.

### 3.6 Mobile first

Most usage is expected to happen from phones:

- before football;
- after football;
- in the pub;
- in WhatsApp-driven social moments.

Desktop is supported, but mobile UX takes priority.

### 3.7 Admin workload must stay tiny

The game must remain viable if one person administers it.

MVP weekly admin work should normally be:

1. create/open the Monday or Friday session;
2. tap the ~20 attendees;
3. optionally enter goals;
4. publish;
5. done.

The admin must not need to manually edit ratings, prices, card copies, or rarity after each match.

---

## 4. Originality / branding rule

The product may be inspired by the interaction patterns of football-card games, but must use:

- an original name;
- original card frames;
- original icons;
- original animations;
- original terminology where practical;
- no copied EA/FIFA/FC artwork, badges, pack graphics, sounds, fonts, or proprietary assets.

"FIFA Ultimate Team" is a design reference, not the product name.

The working product name in code should be `TFH Ultimate Cards` or simply `TFH Cards` until a final name is chosen.

---

# PART II — USERS AND PERMISSIONS

## 5. User types

### 5.1 Player/user

A normal authenticated group member.

Can:

- sign in;
- own a collection;
- receive a starter pack;
- own multiple copies of the same player;
- open packs;
- discard eligible cards;
- list eligible cards for sale;
- buy market listings;
- view the market;
- view player/card pages;
- view club-value rankings;
- edit limited profile settings;
- optionally claim a real TFH player identity.

Cannot:

- create currency;
- create card copies;
- alter ratings;
- edit attendance;
- alter pack results;
- alter market transactions;
- edit another user's collection.

### 5.2 Admin

Everything above, plus:

- create and edit real-player records;
- upload/change player photos;
- create match sessions;
- record attendance;
- record goals;
- publish sessions;
- correct published attendance;
- manage invitations;
- link user accounts to real players;
- disable players/accounts;
- inspect economy health;
- create future Special Card editions.

### 5.3 Superadmin

Optional technical distinction.

May additionally:

- promote/demote admins;
- change global game configuration;
- run maintenance operations;
- create manual ledger corrections;
- trigger state rebuilds.

For MVP, one account can be both admin and superadmin.

---

# PART III — CORE GAME MODEL

## 6. Terminology

**Player**  
A real TFH football participant.

**User**  
An authenticated game account.

**Live Card**  
The normal dynamic card edition for a Player.

**Special Card**  
A frozen, permanent card edition based on an achievement/event.

**Card Copy**  
An individually owned instance of an edition. Users can own multiple copies.

**Overall / OVR**  
The headline card rating.

**Activity Score**  
Hidden 0–100 measure of recent real-world attendance.

**Form Score**  
Hidden 0–8 measure of recent performance.

**Rarity Tier**  
Dynamic visual tier for Live Cards derived from current OVR.

**Discard Value**  
Guaranteed coin amount received for permanently destroying an eligible card copy.

**Reference Value**  
System estimate used for club value and market context.

**Club Value**  
Wallet coins plus reference value of all owned card copies.

**KUT Coins**  
Game currency. Was "TF Coins" (ADR-034); "KUT Coins" is now canonical everywhere
(UI, SQL notification bodies and error strings, spec). Singular: "KUT Coin".

---

# PART IV — REAL-WORLD FOOTBALL DATA

## 7. Match sessions

A TFH football event is a `match_session`.

Required fields:

- date;
- session type: `monday`, `friday`, or `other`;
- season;
- status: `draft`, `published`, `cancelled`;
- created by;
- published timestamp.

Optional fields:

- location;
- notes;
- score/context;
- admin comments.

Only **published** sessions affect ratings.

Cancelled sessions do not count as a football week and do not cause decay.

---

## 8. Attendance

Each published session contains zero or one attendance record per Player.

MVP attendance record:

- session ID;
- player ID;
- goals: integer, default 0;
- optional note.

**Goals + assists (ADR-101).** From the football week beginning Monday
2026-09-28 the one reported integer (`attendance.goals` for an admin-entered
session, `session_reports.goals` / `session_report_results.effective_goals` for
a member-reported one) is the player's goals and assists **combined**, "G+A":
2 goals + 2 assists is stored as `4`. The two parts are never stored separately
and cannot be recovered. A session dated before 2026-09-28 keeps its
goals-only meaning and label; nothing is backfilled or relabelled. Column and
RPC names (`goals`, `p_goals`, `effective_goals`, `goal_form`) are unchanged
compatibility names, and every formula that reads the count reads it
unchanged. See the 2026-09-27 amendment at the end of this document.

Later versions may add:

- assists as their own field (since ADR-101 assists count only inside the one
  combined G+A value);
- clean sheet;
- keeper saves;
- player-of-the-match;
- community-voted awards.

Do not add these to MVP merely because the schema could support them.

---

## 9. Football week

Use ISO weeks, Monday through Sunday.

A week affects player activity only if it contains at least one **published, non-cancelled TFH match session**.

This rule is critical.

If TFH plays no official game in a week:

- nobody receives attendance credit;
- nobody decays;
- form does not decay merely because the organizer took a holiday.

If Monday and Friday both happen in one week, they belong to the same activity calculation.

A Player in injury mode who checked in for a football week is treated, for
Activity only, as though that week had no session — see §11.3 (ADR-082).

---

# PART V — LIVE PLAYER PROGRESSION

## 10. Deterministic rebuilding is mandatory

Do **not** implement player ratings as a sequence of destructive `+2`, `-2` updates.

Current state must be reconstructable from:

- season starting state;
- published match sessions;
- attendance;
- performance;
- configuration.

Implement one canonical calculation module and a database/server operation that can rebuild all Player Season States from history.

This gives:

- easy correction of attendance mistakes;
- reproducible automated tests;
- safe migration of formulas;
- transparent debugging;
- protection against double-processing a session.

At TFH scale, rebuilding a full season for ~200 players is cheap and preferable to fragile incremental state.

---

## 11. Activity Score

Activity Score is a hidden decimal from `0` to `100`.

Default season starting Activity Score:

`0`

For every football week in chronological order:

```text
activity_next =
  clamp(
    activity_previous * 0.90
    + first_appearance_bonus
    + second_appearance_bonus,
    0,
    100
  )
```

Where:

```text
first_appearance_bonus = 14 if player attended >= 1 published session that week, else 0
second_appearance_bonus = 3 if player attended >= 2 published sessions that week, else 0
```

Therefore:

- no attendance in a football week: multiply by 0.90;
- one attendance: multiply by 0.90, then +14;
- two or more attendances: multiply by 0.90, then +17;
- no official TFH session that week: no calculation at all.

`first_appearance_bonus` was raised from its original value of `8` to `14` on
2026-08-18, at the club's request, so a single match visibly moves a card
rather than being lost in the following week's decay — see
[`docs/decisions.md`](decisions.md) for the full rationale and the tradeoff
it accepts.

### 11.1 Why this model

It rewards:

- consistent weekly participation;
- additional Monday + Friday participation;
- returning after absence.

It also causes inactive cards to gradually become cheaper without crashing instantly.

### 11.2 Approximate default progression

Starting at zero and attending once every football week:

| Week | Activity | Activity-based OVR approx. |
|---:|---:|---:|
| 1 | 14 | 39 |
| 2 | 27 | 46 |
| 4 | 48 | 55 |
| 8 | 80 | 68 |
| 12 | 100 | 75 |
| 20 | 100 | 75 |
| Long-run | 100 | 75 |

Attending twice every football week:

| Week | Activity | Activity-based OVR approx. |
|---:|---:|---:|
| 1 | 17 | 41 |
| 2 | 32 | 48 |
| 4 | 58 | 59 |
| 8 | 97 | 74 |
| 12 | 100 | 75 |
| 20 | 100 | 75 |
| Long-run | 100 | 75 |

This is intentional:

- a single match now visibly moves a card the same week, not two or three
  weeks later;
- ordinary weekly regulars reach Silver/Gold within roughly two months and
  cap their activity contribution (75 activity-based OVR, before any form
  bonus) by about week 12 instead of drifting up for the rest of the season;
- once a player's activity is fully capped, attending twice a week no longer
  produces a *higher* long-run ceiling than attending once a week — only a
  *faster* one. Under the original `8`/`3` bonus, once-a-week play converged
  to an activity ceiling of 80 (not 100), so only Monday-and-Friday regulars
  ever reached the true cap; that distinction is gone at `14`/`3`. Form
  (goals) is the only remaining way for a once-a-week player's Live OVR to
  keep separating from a plateaued peer once both are capped;
- attendance alone does not produce 90+ cards — the Live OVR ceiling (Part
  14) is unchanged at 83, and this cap is reached by activity alone (75) plus
  only the maximum form bonus (8).

### 11.3 Injury protection (ADR-082)

An admin may put a Player with an active account into **injury mode** from the
date of the injury. While it lasts, the member may do one **rehab check-in** per
football week they did not play, for the current or the previous ISO week
(Europe/Amsterdam). A check-in:

- pays `INJURY_WEEKLY_STIPEND` (100) KUT Coins, at most once per
  (Player, football week), ledger reason `injury_stipend`;
- **protects** that week: if the Player made zero appearances in it,
  `activity_next = activity_previous` instead of the ×0.90 decay.

Form is **not** protected; it keeps fading as sessions pass. A week with an
appearance is always scored normally. Injury mode ends by itself when the
Player attends a published session dated after the injury date, or when an
admin ends it; weeks already protected stay protected. Protection is never
backdated — a week counts only through a check-in the member made. The check-in
table (`kut.injury_check_ins`) is the only input the rebuild reads, so rebuilding
stays deterministic.

**Comeback Form (ADR-083).** The first published v2 session a Player attends
after an injury period carries a comeback Form input when at least
`INJURY_COMEBACK_MIN_WEEKS` (3) weeks were protected before the return week:

```text
comeback_input = least(INJURY_COMEBACK_FORM_CAP, INJURY_COMEBACK_FORM_PER_WEEK × protected_weeks)
               = least(2, 0.25 × protected_weeks)
```

It ages exactly like a session's goals-and-kudos input (100 / 75 / 50 / 25 / 0 %
over the following published v2 sessions) and counts under the unchanged Form cap
of 8. It is Form, so it never lifts a card permanently. Only the first return
after a period counts. Periods that end in the same return session are summed
into one comeback, still capped at 2. The rebuild re-derives these inputs from
check-ins and attendance every time (`kut.comeback_form_inputs`), and the rating
story lists them as their own row.

**On the card (ADR-084 to ADR-087).** A card is drawn in a signed plaster
cast when it is a **Live card of a Player in injury mode right now**, on every
card screen: players list and detail, Home, collection, album, card detail, the
market list and listing page, pack results and both reveals. A Special edition
never is, because its rating is a frozen snapshot that nothing protects. The
cast's signatures are chosen from the Player id, so every copy looks the same.
The club can pick a Player's two lines in code instead (ADR-087).

---

## 12. Activity-based Overall

Calculate activity-based OVR as:

```text
activity_ovr =
  30 + 45 * (activity_score / 100) ^ 0.80
```

Round only for display/final stored OVR; retain internal decimal calculations where convenient.

If `activity_score = 0`, activity OVR is exactly `30`.

Bounds:

```text
30 <= activity_ovr <= 75
```

---

## 13. Form Score

Form is temporary and primarily driven by goals in MVP.

Hidden Form Score range:

```text
0 <= form_score <= 8
```

For every football week:

```text
form_next =
  clamp(
    form_previous * 0.55
    + weekly_performance_points,
    0,
    8
  )
```

### 13.1 MVP weekly performance points

```text
goal_points = 1.25 * min(total_goals_that_week, 4)

hat_trick_bonus =
  1.0 if total_goals_that_week >= 3
  else 0

weekly_performance_points =
  goal_points + hat_trick_bonus
```

Examples:

| Goals that football week | New performance input |
|---:|---:|
| 0 | 0 |
| 1 | 1.25 |
| 2 | 2.50 |
| 3 | 4.75 |
| 4+ | 6.00 |

This causes a hat trick to produce a large but temporary visible jump.

Future award points must be added to configuration rather than hardcoded throughout the application.

---

## 14. Final Live OVR

```text
form_bonus = round(form_score)

live_ovr =
  clamp(
    round(activity_ovr + form_bonus),
    30,
    83
  )
```

The standard Live Card ceiling is therefore `83`.

That ceiling is deliberate.

Ratings above the low 80s should mainly belong to frozen Special Cards.

---

## 15. Card attributes

Use six familiar but generic football attributes:

- `PAC` — Pace
- `SHO` — Shooting
- `PAS` — Passing
- `DRI` — Dribbling
- `DEF` — Defending
- `PHY` — Physical

MVP does not use separate goalkeeper statistics. The Goalkeeper archetype
(ADR-036) is a seventh offset profile over these same six attributes — a
shot-stopper (strong DEF/PHY, weak SHO/DRI) — not a distinct DIV/HAN/REF stat
set. A goalkeeper card is still driven by attendance and goals like any other;
keepers rarely score, so their Form stays low, and that is intended.

Every player chooses or is assigned an archetype.

Archetypes redistribute attributes but do not create a large hidden OVR advantage.

### 15.1 Default archetypes and offsets

Offsets are applied to `live_ovr`.

**All-rounder**

```text
PAC  0
SHO  0
PAS  0
DRI  0
DEF  0
PHY  0
```

**Speedster**

```text
PAC +10
SHO  -1
PAS  -2
DRI  +4
DEF  -6
PHY  -5
```

**Finisher**

```text
PAC  +2
SHO +10
PAS  -3
DRI  +3
DEF  -8
PHY  -4
```

**Playmaker**

```text
PAC  -2
SHO  -2
PAS +10
DRI  +5
DEF  -6
PHY  -5
```

**Defender**

```text
PAC  -2
SHO  -7
PAS  -1
DRI  -4
DEF +10
PHY  +4
```

**Tank**

```text
PAC  -8
SHO  -2
PAS  -2
DRI  -4
DEF  +4
PHY +12
```

**Goalkeeper** (ADR-036 — reuses these six attributes, no distinct GK stat set)

```text
PAC  -6
SHO -12
PAS   0
DRI  -8
DEF +14
PHY +12
```

Final base attribute:

```text
attribute = clamp(live_ovr + archetype_offset, 1, 99)
```

### 15.2 Goal-driven Shooting boost

On top of the archetype calculation, make current form visible in Shooting:

```text
recent_goal_shooting_bonus =
  min(8, 2 * goals_in_most_recent_football_week)

SHO =
  clamp(base_SHO + recent_goal_shooting_bonus, 1, 99)
```

This means a player who scores several goals visibly receives a Shooting spike without permanently changing their identity.

From the football week beginning 2026-09-28 `goals_in_most_recent_football_week`
is the week's combined **G+A** count (ADR-101), exactly as stored: the modifier
is unchanged, so assists now lift SHO too, and a reported `4` (for example
2 goals + 2 assists) gives the same capped +8 as 4 goals.

Future award systems can apply temporary stat-specific modifiers.

---

## 16. Live rarity tiers

Rarity is derived from current Live OVR.

Do not manually store a user-editable rarity for Live Cards.

| OVR | Tier | Visual intent |
|---:|---|---|
| 30–39 | Common | muted / basic |
| 40–49 | Bronze | warm metallic |
| 50–59 | Silver | silver metallic |
| 60–69 | Gold | gold metallic |
| 70–79 | Holo | animated/shimmer |
| 80–83 | Elite | premium animated treatment |

The exact colors and artwork are design variables.

Tier boundary animation is important.

Example:

> RICHARD 59 → 61  
> SILVER → GOLD

The user should see a celebratory upgrade state after the next login/home-page refresh.

Respect `prefers-reduced-motion`.

---

# PART VI — CARD OBJECT MODEL

## 17. Player versus edition versus card copy

This distinction is mandatory.

### 17.1 Player

The real human identity:

> Bas

### 17.2 Card Edition

A card design/version associated with a Player.

Examples:

- Bas — Live
- Bas — Team of the Week, Week 12
- Bas — Hat-Trick Hero, 14 November 2026

### 17.3 Card Copy

An individual owned instance.

Examples:

- Live Bas copy #123 owned by User A
- Live Bas copy #894 owned by User A
- Live Bas copy #992 owned by User B
- TOTW Bas copy #1022 owned by User C

A user may own many copies of one edition.

---

## 18. Live editions

There is one active Live edition per Player.

Its displayed stats are read from the current Player Season State.

A Live card copy does not contain an independent mutable OVR.

If all Live Bas cards show different stats, the implementation is wrong.

---

## 19. Special editions — later phase

A Special edition stores a frozen snapshot:

- OVR;
- six stats;
- special type;
- issue date;
- title;
- description;
- artwork treatment;
- discard multiplier;
- pack availability window;
- optional maximum supply.

Default future boosts:

| Special type | Suggested OVR boost |
|---|---:|
| Team of the Week | +8 |
| Hat-Trick Hero | +10 |
| Milestone | +6 |
| Iron Man | +7 |
| Team of the Season | +12 |

These are starting values, not MVP requirements.

Special OVR:

```text
special_ovr = min(95, live_ovr_at_issue + configured_boost)
```

Special attributes are similarly frozen and capped at 99.

---

## 20. Tradeability

> **Superseded (2026-08-30, ADR-033):** the untradeable concept was removed
> entirely. There is no `is_tradeable` flag on `user_cards` any more. **Every
> Card Copy is tradeable and discardable**, starter cards included. The
> original design below is kept for history.
>
> The only remaining eligibility rules, applied uniformly to every card
> regardless of source:
>
> - a copy with an **active market listing** cannot be discarded (enforced by
>   the `user_cards_prevent_burning_listed_card` trigger);
> - discard and listing both require a **resolvable rating** for the copy
>   (a Live edition needs current season state; a Special uses its snapshot).
>
> Consequence accepted at the time: a brand-new player can immediately sell or
> discard all three starter cards. See ADR-033.

---

_Original design (no longer in force):_

Each Card Copy has an explicit tradeability flag.

Types:

- `tradeable`
- `untradeable`

Starter cards are untradeable.

Future reward cards may also be untradeable.

Untradeable cards:

- cannot be listed;
- cannot be discarded unless the reward definition explicitly allows it;
- still count toward collection completion;
- count toward club value unless later configured otherwise.

---

# PART VII — ONBOARDING

## 21. Invite-only membership

> **Implemented (2026-08-29, ADR-028):** step 6 asks for a **self-chosen
> username**, not an email. The app maps the username to a synthetic
> non-routable address (`users.kut.local`) for Supabase Auth; no mail is sent.
> Login accepts the username (or, for accounts created before this change, a
> raw email). The username is a login handle only — the display name is still
> the linked Player's name. Admins can also link/unlink an account to a Player
> after the fact from `/admin/links` (`kut.admin_set_profile_player`).

Do not allow unrestricted public account creation.

The game is for TFH members.

Preferred zero-cost MVP onboarding:

1. Admin creates an invitation tied to a real Player.
2. Application generates a cryptographically random one-time invite token.
3. Only a hash of the token is stored.
4. Admin shares the invite link manually, e.g. through WhatsApp.
5. Recipient opens link.
6. Recipient provides an email address and password.
7. Account is created and linked to the invited Player.
8. Invite is consumed permanently.
9. User receives starter assets.

This avoids depending on production email delivery while still letting users log in with email/password.

### 21.1 Later auth improvement

Custom SMTP can enable:

- email confirmation;
- password resets;
- magic-link login;
- account recovery.

Keep the authentication layer compatible with this upgrade.

Do not hardwire game identity to a specific email provider.

---

## 22. Starter grant

On successful first onboarding, atomically grant:

- `250` KUT Coins;
- `3` random Live Card copies;
- the three starter cards are ordinary tradeable copies (ADR-033);
- no duplicate editions within the three-card starter pack.

The starter grant may occur exactly once per user.

This must be protected by a unique database constraint and server-side transaction.

The user may receive their own card.

> **Implemented (2026-08-30, ADR-031):** the grant still happens automatically
> inside `claim_invitation`, but a member's **first sign-in is gated** to a
> full-screen `/welcome` step (`kut.profiles.starter_opened_at` null →
> `getNavContext` redirects there). "Open your starter pack" calls
> `kut.mark_starter_opened()` — which stamps `starter_opened_at`, and grants
> the starter as a legacy fallback if `starter_claimed_at` was still null —
> then plays the §49 reveal animation over the granted cards. The reveal is
> cosmetic: the coins and cards exist before `/welcome` renders.

---

# PART VIII — GAME CURRENCY

## 23. Currency

Use integer currency only.

No decimal KUT Coins.

Never trust a client-provided balance.

Every balance change must be produced server-side and recorded in an immutable ledger.

---

## 24. MVP coin sources

### Starter grant

`+250` once.

### Attendance reward

A game User linked to the real Player receives:

`+250 KUT Coins` per published session they attended.

> **Note (2026-08-29):** raised from `75` to `250` (ADR-029), **not** applied
> retroactively — already-granted rewards keep their original amount. Granting
> the reward now also writes a dated `attendance_reward` message to the User's
> inbox ("You received N KUT Coins for attending the session on DD Mon YYYY."),
> keyed on the session so it is idempotent alongside the coins (ADR-028). The
> value is a single `v_amount` constant in `kut.grant_attendance_rewards`,
> mirrored by `ECONOMY.attendanceCoinReward` (`src/game/economy.ts`) and
> Part 145 below.

This connects participation in real TFH football to participation in the card economy.

Attendance reward records must be idempotent: processing the same session twice must not create duplicate coins.

### Discard

Eligible card is destroyed; user receives the card's current server-calculated discard value.

### Market sale

Seller receives:

```text
sale_price - market_tax
```

The buyer's coins are transferred; these are not newly created coins.

### Admin adjustment

An admin may credit or debit any member's wallet through the audited
`kut.admin_adjust_wallet` RPC (both directions; `abs(amount)` capped; never
below zero; a typed reason required). Recorded with `wallet_ledger.reason =
'admin_grant'` and a `kut.admin_account_events` audit row, and the member is
told in their inbox. This is the only coin faucet other than starter and
attendance. See ADR-035.

> A soft account reset (`kut.admin_reset_account`, ADR-035) also moves coins:
> it writes one compensating `-(balance)` entry (`reason 'admin_reset'`) and a
> fresh `+250` starter, netting the wallet to `250`. It does not create coins
> beyond the standard starter grant.

> A superadmin may also grant/claw back coins on their **own** wallet through
> a separate, superadmin-only RPC (`kut.admin_grant_self_wallet`,
> `wallet_ledger.reason = 'admin_self_grant'`) — same cap and guards as
> `admin_adjust_wallet`, but `admin_adjust_wallet` itself still refuses to
> touch the caller's own wallet. See ADR-052.

### Bibs bonus

The member linked to the Player who brings the bibs to a session receives a
one-off `+100 KUT Coins` (`BIBS_COIN_BONUS`, Part 145). The admin records the
bibs bringer on the attendance form; `kut.match_sessions.bibs_washed_by`
stores it (null = nobody; the column name is retained from ADR-037). Paid by
the audited `kut.grant_bibs_reward`, alongside `grant_attendance_rewards`, with
`wallet_ledger.reason = 'bibs_bonus'` and a dated `bibs_bonus` inbox message
("You received 100 KUT Coins for bringing the bibs to the session on DD Mon
YYYY."). A `kut.bibs_rewards` guard table, PK `(session_id, player_id)`, plus a
unique ledger key make it idempotent: at most once per `(session, bringer)`,
never re-paid for the same bringer on a correction. Reassigning the bringer on
a correction pays the new one; the previous one keeps their bonus
(forward-only). Coins only — no rating/OVR effect. See ADR-037; the "washing
the bibs after" wording was corrected to "bringing the bibs to" in ADR-044
(user-visible copy only).

---

## 25. MVP coin sinks

### Packs

Coins are destroyed when a pack is opened.

### Market tax

Default:

`5%`

Tax is rounded up to the nearest whole coin, minimum `1` coin.

The tax is burned, not given to an admin/treasury.

Later sinks:

- collection challenges;
- special event entry;
- cosmetic frames;
- profile cosmetics.

---

# PART IX — DISCARD VALUE

## 26. Live discard formula

Default:

```text
live_discard_value =
  round(
    10 * 1.08 ^ (live_ovr - 30)
  )
```

Examples:

| OVR | Approx. discard |
|---:|---:|
| 30 | 10 |
| 40 | 22 |
| 50 | 47 |
| 60 | 101 |
| 70 | 217 |
| 80 | 469 |
| 83 | ~590 |

Because rarity is itself derived from OVR, this already makes higher rarity more valuable.

Do not calculate discard value on the client and trust the result.

Always calculate it server-side at the moment of discard.

---

## 27. Special-card discard

Later:

```text
special_discard_value =
  round(
    normal_formula_using_special_ovr
    * special_discard_multiplier
  )
```

Suggested multipliers:

- TOTW: 1.5
- Hat-Trick Hero: 1.75
- Milestone: 1.5
- Team of the Season: 2.0

All remain configurable.

---

# PART X — PACKS

## 28. MVP pack

Only one purchasable pack type is needed initially.

### TFH Pack

Default:

- price: `250` coins;
- contains: `3` card copies;
- normally produces Live editions;
- cards are tradeable;
- duplicate editions are allowed;
- pack results are determined server-side before the reveal animation begins.

Do not add multiple pack SKUs in MVP.

---

## 29. Live-card pack weighting

Do not make every Player equally likely.

Each eligible Live edition receives a weight based on current rarity.

Default weight:

| Tier | Weight per eligible Player |
|---|---:|
| Common | 100 |
| Bronze | 60 |
| Silver | 30 |
| Gold | 12 |
| Holo | 4 |
| Elite | 1 |

For a Live draw:

1. build list of active eligible Players;
2. assign weight from current tier;
3. weighted-random select one;
4. create a Card Copy of that Player's Live edition.

This naturally makes stronger current players rarer while adapting to the real roster distribution.

---

## 30. Special-card pack roll — later

When special editions exist, each card slot first performs a Special roll.

Default initial Special chance:

`1% per card slot`

If successful:

- select from currently pack-eligible special editions;
- apply edition-specific weights and remaining supply;
- if no eligible special exists, fall back to Live draw.

This percentage must be configuration, not hardcoded.

---

## 31. Pack integrity

Pack opening must be a single atomic server-side operation:

1. validate user;
2. lock/check wallet;
3. confirm balance;
4. debit pack price;
5. write wallet ledger;
6. select all card outcomes;
7. create all card copies;
8. write pack-opening record;
9. return finalized result to UI.

The browser then animates the already-recorded result.

Refreshing during an animation must not reroll the pack.

Double-clicking must not purchase two packs unless the user intentionally performed two distinct confirmed opens.

Use an idempotency key for pack-open requests.

---

## 32. Economy safety check

Because player ratings change over time, pack economics must be monitored.

Implement a pure calculation that computes:

```text
expected_discard_value_per_slot
expected_discard_value_per_pack
expected_discard_return_ratio =
  expected_pack_discard / pack_price
```

Admin economy screen should display this.

Target range for a basic pack:

```text
expected discard return <= 75% of pack price
```

Warning threshold:

```text
> 80%
```

Critical threshold:

```text
>= 95%
```

Do not silently change pack odds in response.

The admin can later tune pack price or weights through version-controlled configuration.

Automated tests must simulate representative player distributions and flag obviously broken settings.

---

# PART XI — TRANSFER MARKET

## 33. MVP market model

Use **Buy Now listings only**.

No auctions in MVP.

User can:

- select an owned card that is not already listed;
- enter a price;
- create a listing, choosing a 24-hour or 72-hour window (ADR-072);
- cancel an unsold listing;
- browse active listings;
- buy a listing immediately.

A card with an active listing is locked from:

- discard;
- another listing;
- challenge submission;
- other ownership-changing actions.

The seller remains the owner until a sale completes.

---

## 34. Market listing bounds

Price ranges reduce accidental absurd listings and casual coin transfer abuse.

For MVP:

```text
minimum_listing_price =
  max(1, floor(current_discard_value * 0.80))

maximum_listing_price =
  max(100, ceil(current_reference_value * 5))
```

Server calculates both bounds.

The client merely displays them.

Special editions can later receive custom price bounds.

---

## 35. Buying a listing

A market purchase is an atomic database transaction.

Required sequence:

1. authenticate buyer;
2. lock listing row;
3. verify listing is active and not expired;
4. verify buyer is not seller;
5. lock buyer wallet;
6. verify buyer balance;
7. verify seller still owns the card;
8. debit buyer full price;
9. calculate 5% tax;
10. credit seller price minus tax;
11. write both ledger entries;
12. transfer Card Copy ownership;
13. mark listing sold;
14. write immutable market sale record;
15. commit.

Two buyers attempting to buy the same listing simultaneously must result in:

- exactly one successful purchase;
- no negative wallet;
- no duplicated Card Copy.

This is a mandatory automated concurrency/integration test.

---

## 36. Market browsing

MVP filters:

- player search;
- rarity;
- OVR;
- min/max price;
- archetype;
- sort by newest;
- sort by price ascending;
- sort by OVR.

Later:

- special type;
- edition;
- price history;
- bargains;
- watched players.

Listing surfaces (ADR-051):

- the **grid** at `/market` is a card, its price and one Buy button per listing —
  two columns on a phone, four from `lg`;
- each card links to a **listing detail page** at `/market/<listing_id>`, which
  carries the full attribute breakdown, Buy, and the coin-and-card offer form.
  Offers are made here and nowhere else;
- both surfaces show the current viewer's ownership of the listed Player and
  exact edition (ADR-100). Every unburned copy in `kut.my_collection_cards`
  counts, including copies currently listed or held for a trade offer. The
  count is a chip on the card itself, at the foot of the art (ADR-102), so a
  grid row's tiles are all the same height; it is omitted only when both
  totals are zero;
- the listing detail page shows the card's **discard value** under the asking
  price, as the floor to judge it against (ADR-103). It is the view's trailing
  `discard_value` column, read from `kut.card_discard_value` (the function
  `get_listing_bounds` and `discard_card` use), never a second copy of the
  formula. A card with no rating has a null value, and a null or absent value
  renders nothing (KB-014). The grid tile does not show it;
- a sold, cancelled or expired listing 404s, since it leaves
  `kut.active_market_listings`.

---

# PART XII — REFERENCE VALUE AND CLUB VALUE

## 37. Why sale price is not automatically "value"

A single friend-to-friend sale must not make every copy of a player worth an absurd amount.

Reference Value therefore uses robust market history and a fallback.

---

## 38. MVP Reference Value

For an edition:

### If there are at least 5 qualifying sales in the previous 14 days

Use:

```text
market_median =
  median(qualifying sale prices)
```

Then:

```text
reference_value =
  clamp(
    market_median,
    discard_value,
    discard_value * 6
  )
```

### If there are fewer than 5 qualifying sales

Use:

```text
reference_value =
  round(discard_value * 1.5)
```

For a Live edition, current discard value is based on current Live OVR.

For a Special edition, use its frozen discard formula.

### Qualifying sale

At MVP, any completed market sale inside the enforced listing bounds qualifies.

Later anti-manipulation rules may require unique buyer/seller counts.

Accepted **trade offers** (§39a / ADR-042) are **not** qualifying sales — they
are private negotiations, not price signals, and are never written to
`market_sales`.

> **Note (2026-08-31, ADR-041):** Reference Value is now used **only** for
> `get_listing_bounds` (market listing price bands). It is no longer part of
> Club Value — see the revised §39 below.

---

## 39. Club Value

> **Revised 2026-08-31 (ADR-041).** The former model — `wallet_balance +
> sum(reference_value of every owned Card Copy)` — was replaced because
> Reference Value depends on invisible sale history and a piecewise clamp, so
> members could not audit their own number.

```text
club_value =
  wallet_balance
  + owned_cards_value        -- sum(discard_value of every unburned owned Card Copy)
  + personal_card_bonus      -- 4 × personal_card_base_value

discard_value(card)      = round(10 × 1.08^(OVR − 30) × special_discard_multiplier)
personal_card_base_value = round(10 × 1.08^(linked_player.live_ovr − 30))
```

- Every term is an individually-visible number; `/club/value` shows the
  arithmetic card by card.
- `personal_card_bonus` uses the member's linked Player (`profiles.player_id`).
  No linked Player → `0`. A linked Player with no active-season rating row yet
  → the 30-OVR floor (base value 10, bonus 40).
- Weight **W = 4** — mirrored as `ECONOMY.personalCardClubWeight` and the `4`
  literals in `20260910000000_club_value_v2.sql`. Changing it is a spec + ADR
  change.

Include every unburned Card Copy (ADR-033 removed the untradeable class).

Do not include cards that have been permanently burned/discarded.

Leaderboard displays:

- rank;
- username/display name;
- club name;
- Club Value;
- card count;
- unique-player count.

> **Note (2026-08-29, ADR-030):** the leaderboard lists `role = 'user'`
> accounts only — admin / superadmin accounts are excluded from the public
> rank (they still see their own summary on `/club`). Admins can also
> disable (reversible) or permanently delete an account from `/admin/links`.

Refresh on page request is acceptable at MVP scale.

Cache only if measurement shows it is needed.

---

## 39a. Trade offers (2026-08-31, ADR-042)

Instead of paying a listing's buy-now price, a member may **offer** KUT Coins
and/or up to **3** of their own Card Copies for it.

Lifecycle: `active → accepted | rejected | withdrawn | expired`.

- **Propose** (`propose_trade`): the listing must be active and not the
  caller's own. Offered coins are `0` or `1..get_listing_bounds.maximum_price`
  (a coin offer *below* the asking price is allowed — that is the point of an
  offer). Each offered card must be owned, unburned, not listed, and not
  already committed to another offer. Max 10 active outgoing offers per member.
  On propose, the coins leave the proposer's wallet (`wallet_ledger` reason
  `trade_escrow`) and each offered card is locked
  (`user_cards.held_by_offer_id`).
- **Accept** (`respond_to_trade`, seller only): runs the same atomic swap as
  `buy_listing` at the offered price — 5% burn on the coin component,
  `trade_sale` receipt to the seller — moves the listed card to the proposer
  and the offered cards to the seller, marks the listing `sold`, and
  auto-rejects + refunds every other active offer on that listing.
- **Reject / withdraw / expire**: release the card locks and refund the
  escrowed coins (`trade_unescrow`). Offers **expire 12h** after they are
  made; `expire_trade_offers()` runs lazily on the market pages (a cron is a
  future addition).
- A held card cannot be listed, discarded, burned, or re-offered.
  `cancel_listing` and `buy_listing` unwind a listing's pending offers;
  `admin_reset_account` / `admin_prepare_account_deletion` unwind a member's.
- Accepted offers appear in `activity_feed` as a `trade` row and are **not**
  written to `market_sales` (see §38 qualifying-sale note).

---

# PART XIII — COLLECTION

## 40. Collection screen

Primary mobile collection page.

Must support:

- card grid;
- card count;
- unique Player count;
- total Club Value;
- search by Player;
- filter rarity;
- filter duplicates;
- sort OVR;
- sort value;
- sort newest;
- tap card for detail sheet/page.

Each Card Copy detail should show:

- player;
- edition;
- current/frozen OVR;
- attributes;
- rarity;
- tradeability;
- discard value;
- reference value;
- acquisition source;
- acquisition date;
- active listing state if any.

---

## 41. Collection album

**Built 2026-09-02 (ADR-048).** This section originally sketched the album as
Phase 2 scope and left its organisation open; it now describes what shipped.
The design detail is `docs/archive/SPEC_ALBUM_CHRONICLE_GRAPH.md` §3.

A roster-completion view, whose job is to make the *gap* visible:

> 73 / 201 TFH Players collected

Each real Player has a slot. Owned slots show the card; missing slots show an
empty slot; duplicate copies stack in the owner's slot.

The form is a **bound album that is leafed through**, not a scrolling grid:

- nine slots per page, ordered alphabetically by display name;
- desktop (≥1024px) shows two facing leaves as a spread, mobile shows one leaf,
  with identical page numbers on both;
- slot numbers are **positional, not permanent** — an alphabetical index that
  shifts when a player is added. They must never be persisted or used as an
  identifier.

The album is the **default view of `/club/collection`**. The filter/sort grid
with the discard and list actions remains, as a "Manage" mode at
`?view=manage`, selected by a segmented control under the page title. Album
params (`page`, `lens`) and Manage params (`q`, `rarity`, `sort`) do not leak
across modes.

**Subcollections are lenses, not pages.** Archetype was the first candidate for
the album's spine and does not survive contact with the data:
`kut.players.archetype` defaults to `all_rounder` and changes only when a member
sets it at `/settings/card` (ADR-027) or an admin does, so roughly 80% of the
roster carries the default. A lens instead selects which players are in the
album, and pagination adapts:

- `all` (default) — every player in the directory;
- `gaps` — uncollected only;
- `specialists` — every player whose archetype is not `all_rounder`;
- `type:<archetype>` — one of the seven archetypes, including goalkeepers
  (ADR-036) and `type:all_rounder`;
- `tier:<tier>` — one of the six live tiers.

Monday/Friday regulars, 2026 debutants and season-specific groups are still
possible subcollections; if built they are added as lenses.

Completion rewards remain a later feature — any reward is a coin faucet or a
card sink and must be balanced against the Part L invariants first. The album
is cosmetic. Other members' albums are out of scope: card ownership is
deliberately private and exposing it needs its own decision.

---

# PART XIV — SPECIAL CARDS — PHASE 2

## 42. Initial Special Card types

### Team of the Week

Created weekly from noteworthy performances.

Recommended MVP+ selection:

- up to 3 players;
- admin confirms selection;
- may use goals plus manual judgment.

### Hat-Trick Hero

Automatic eligibility when goals in one session >= 3.

Admin chooses whether to issue the edition.

### Iron Man

Attendance streak achievement.

### Milestone

Examples:

- 25 appearances;
- 50 appearances;
- 100 appearances.

### Comeback

First appearance after a configured long absence.

### Team of the Season

End-of-season special.

---

## 43. Special-card supply

Schema must support:

- unlimited supply during a date window;
- or fixed maximum supply.

Do not require fixed-supply mechanics for first Special Card release.

Every minted copy gets an immutable Card Copy ID.

Potential later fun rule:

> A Player receiving a Special Card is automatically granted one copy of their
> own Special edition. (ADR-033 removed the untradeable flag; if this copy
> should be non-liquid, a hold rule would need to be designed rather than
> reusing the retired flag.)

---

# PART XV — MATCHDAY LAYER — PHASE 3

## 44. Midweek Madness — weekly 5-card squad knockout

**Specified 2026-09-25 (ADR-089).** Every Wednesday each member enters five of
their own cards, and the squads play a seeded knockout bracket that evening.
The design rationale and the brainstorm behind it are in `docs/ROADMAP.md`
("Midweek Madness"); this section is the canonical rule set. The engine is
authoritative in SQL with a TypeScript twin (ADR-090); privacy follows ADR-091.

It replaces "Friday Five" / "TFH Five", which ADR-088 removed and from which it
inherits no rule except one: **matchday rewards must not inject enough
currency to overpower the market economy.**

Design goals, which the targets in §44.12 put numbers on:

1. a bigger, better collection gives an edge but does not decide the week;
2. no pick stays best;
3. cheap cards can decide matches, visibly;
4. every match produces a report in which each line traces back to a number;
5. zero weekly admin work.

The numbers below are the tuned values from the simulation harness (ADR-092),
recorded with their evidence in `docs/archive/MIDWEEK_TUNING.md` and signed
off by the owner on 2026-09-25. The
executable definition of every rule in §44.3–§44.6 is the pure engine in
`src/game/midweek/`, pinned by `tests/fixtures/midweek-golden.json`; the SQL
engine must reproduce that file (ADR-090).

### 44.1 The week

- **One tournament per football week (§9),** identified by that week's Monday
  (`week_start`).
- **The lock is Wednesday 19:55 Europe/Amsterdam** (`lock_at`), computed in
  that time zone so daylight saving is handled.
- **Round `r` starts at `lock_at + 5 min + 15 min × (r − 1)`,** so round 1
  starts at 20:00 and, with 17–32 entrants (5 rounds), the final at 21:00.
- **A match lasts 4:40 plus its shoot-out.** Its clock runs from 0' to 90' over
  the 14 chance slots of 20 seconds each, so a chance is due at
  `kick-off + minute × 280 s / 90`; after full time each shoot-out kick, and a
  settling draw, follows 5 seconds after the one before. A match ends
  (`ends_at`) at full time or with its last kick; the longest possible (50
  kicks and a draw) ends 8:55 after kick-off, inside a round.
  `final_reveal_at` is the end of the final.
- **Each week keeps the clock it opened with** (`schedule_version`, ADR-104).
  Version 2 is the clock above. Version 1, every week up to the push of
  ADR-104, locked at 20:00 and revealed round `r` whole at `lock_at + 30 min ×
  r`; its final ends as it is revealed. Pages compute every time from the
  week's version, never from the current one.
- **Picking opens when the tournament exists** and closes at the lock. The next
  week's tournament is created as soon as the current one is complete, skipped
  or void.
- **The club-break gate.** At the lock the tournament runs only if the
  previous football week had at least one published, non-cancelled session.
  Otherwise it is marked `skipped`: nothing is simulated or paid.
- **The field** is every active member (`kut.is_active_member()`) who, at the
  lock, owns at least one active, unburned card and has not opted out, whether
  they picked or not. **Fewer than `MIDWEEK_MIN_ENTRANTS` (4) entrants marks
  the week `skipped`.**

### 44.2 Squads

- **A saved squad is 1–5 Card Copies** the member owns, active and unburned,
  **each of a different Player.** Owning duplicates is fine; one Player fills
  one slot. `save_midweek_squad` refuses anything else, and refuses every
  change once `now() >= lock_at`.
- **Only a squad saved for this tournament counts as picked.** The picker may
  pre-fill last week's five, but pre-filling saves nothing.
- **At the lock each saved card is re-checked.** A card the member no longer
  owns, or that was burned, becomes a trialist. A card that is listed on the
  market or held in trade escrow is still owned and still plays. If no saved
  card survives, the member is treated as not having picked.
- **Trialists fill empty slots.** A trialist is a Common All-rounder at
  `MIDWEEK_TRIALIST_OVR` (30), with its own form roll, a neutral pick factor
  (1.00), fitness 1.00, and its power multiplied by `MIDWEEK_TRIALIST_FACTOR`
  (0.825). The factor keeps a trialist below the worst real card: OVR 30,
  picked by every owner and injured. Leaving a slot empty on purpose must never
  be the best play (§44.12).
- **Members who did not pick get an auto squad:** up to five random distinct
  Players from their own collection, drawn from the tournament seed, one copy
  each, with trialists for the rest. Every card in an auto squad, trialists
  included, has its power multiplied by `MIDWEEK_AUTO_FACTOR` (0.575) and gets
  the neutral pick factor. **Auto squads are left out of pick shares.** An auto
  squad that wins is paid like any other.
- **Opting out.** A member can opt out in settings and is then never entered,
  picked or auto. An opt-out saved before the lock applies to that week. An
  opted-out member cannot save a squad.
- **Archetypes are frozen when the tournament opens** (ADR-099). Opening a
  week snapshots every Player's archetype; the picker shows the snapshot and
  the lock plays it, so a change made while a week is open applies from the
  next week, and nobody can reshape squads others have already picked. A
  Player created after the open has no snapshot and plays their live
  archetype. The picker names such a change wherever the card appears
  ("Goalkeeper this week, Speedster from next", and on the card face
  "Speedster from next week") and filters cards by the archetype they play
  this week (ADR-112). A member may change their own Player's archetype (`set_own_player_archetype`) at most once every
  `ARCHETYPE_CHANGE_COOLDOWN_DAYS` (14, measured as 336 elapsed hours). The
  first change is always allowed, re-saving the archetype the Player already
  has is not a change, and the admin path is not limited (ADR-094).
- **Unclaimed Players' archetypes rotate weekly** (ADR-110). Right before a
  week opens, every active, collectible Player with no linked account draws
  one of the seven archetypes, independently and uniformly, All-rounder and
  Goalkeeper included, from the new week's own seed (tag
  `rotation:<player id>`). The snapshot then freezes the draw for that week.
  Each change is logged; the card faces are rebuilt at once; OVR doesn't
  move. Claiming ends the rotation: the member keeps the archetype the Player
  has then, and their first change is still free. The seed is secret until the
  week is paid, so no draw can be known in advance, and checkable afterwards.

### 44.3 Card power

```text
card_power  = ovr_factor × form_roll × pick_factor × fitness × handicap   (fixed for the week)
match_power = card_power × day_roll                                      (fresh every match)
```

`handicap` is `auto_factor` in an auto squad, times `MIDWEEK_TRIALIST_FACTOR`
for a trialist, else 1.00. Each factor, multiplied left to right in parts per
million and floored after each step:

| Factor | Rule | Value (ADR-092; started at) |
|---|---|---|
| `ovr_factor` | Linear in the locked OVR, clamped to 30–83: 1.00 at 30, `MIDWEEK_OVR_FACTOR_MAX` at 83. Flattening OVR is what stops the richest collection winning by default. | max 1.10 (1.35) |
| `form_roll` | One roll per Player per tournament, shared by every squad that fields the Player: the mean of two uniform draws, its lower half mapped onto [min, 1.00) and its upper half onto [1.00, max), so most rolls land near 1.00. Trialists roll their own. | range 0.80–1.25, mode 1.00 (0.75–1.45) |
| `pick_factor` | Decreasing in the Player's pick share (below). Neutral is 1.00. | through (0, 1.25), (0.40, 1.00), (1, 0.875), piecewise linear ((0, 1.30), (0.40, 1.00), (1, 0.85)) |
| `fitness` | `MIDWEEK_INJURED_FITNESS` when the card is a Live card of a Player in injury mode at the lock (the ADR-085 cast rule), else 1.00. | 0.95 (0.95) |
| `day_roll` | A fresh roll per card per match. | uniform ±12% (±10%) |

**Pick share** measures choice, not scarcity, and uses owners as the baseline:

```text
share = (non-auto entrants who picked this Player + 1)
      / (entrants who own a card of this Player    + 3)
```

A sole owner who picks their card lands at 0.50, just below neutral: a card
nobody else can pick is not a brave choice. One picker among ten owners lands
at 0.15, a big bonus; nine of ten at 0.77.

**The lock snapshots every input.** For each entered card: the OVR
(`coalesce(snapshot_ovr, live_ovr, 30)`, as `my_collection_cards`), the
archetype, and the injury flag. A later change to any of them has no effect on
that tournament.

### 44.4 Squad shape

- **Archetypes set the shape, not the size.** A card contributes to three lines
  according to its archetype's §15.1 offsets, averaged over the line's
  attributes and scaled by `MIDWEEK_SHAPE_SCALE` (0.5 per 10 offset points),
  times `card_power`: `line_mult = 1 + 0.5 × mean_offset / 10`, floored at 0.10. Absolute attributes are never used; they
  would bring raw OVR back in at full weight.
  - attack: SHO, PAC, DRI;
  - midfield: PAS, DRI;
  - defence: DEF, PHY.
- **Exactly one card plays in goal;** the other four make up the lines.
  - The keeper is the Goalkeeper-archetype card with the highest `card_power`.
  - A squad without a Goalkeeper puts the outfielder with the highest defence
    contribution in goal, at `MIDWEEK_KEEPERLESS_FACTOR` (0.45; started at
    0.60). Keeper strength is the keeper's defence contribution, times that
    factor when keeperless.
  - A second or third Goalkeeper plays outfield with the Goalkeeper offsets,
    including SHO −12.
- **All-rounders are average everywhere,** so the default archetype stays
  useful. There are no balance rules: "one keeper beats zero or three" and
  "balance helps" follow from the numbers.

### 44.5 A match

- **Chances, not a score draw.** A match has `MIDWEEK_CHANCE_SLOTS` (14)
  slots across 90 minutes. Each slot holds a chance with probability 0.686,
  and the chance goes to a side in proportion to the two midfields (contrast
  1: a plain ratio). Each chance records:
  - a **creator**, weighted by midfield contribution;
  - a **shooter**, weighted by attack contribution;
  - a **chance type**, weighted by the two cards' archetypes (§44.10);
  - an **outcome**: goal, save, woodwork, block or wide. The goal
    probability is `0.30 × chance-type difficulty × 2 × S / (S + R)`, clamped
    to 0.02–0.85, where `S` is the shooter's attack contribution and `R` the
    mean of the defending side's average outfield defence and its keeper. A
    miss is a save (45), block (25), woodwork (8) or shot forced wide (22),
    credited to the keeper or a defender;
  - a **minute** in 1–90, so a report reads as a timeline.
- **The chance model reproduces the intended goals:** about 2.5 per match
  between two equal balanced sides, 2.85 across a simulated bracket. The keeper
  starts a chance occasionally (long throws) and scores about once a season
  club-wide.
- **A draw goes to penalties:** five kicks each, then sudden death, each kick
  an event decided by kicker against keeper. After
  `MIDWEEK_SHOOTOUT_MAX_ROUNDS` (20) sudden-death rounds a
  seeded draw decides, so every match has a winner.
- **Odds.** Each match stores a pre-match win chance in ppm, a closed-form
  estimate from both squads' week-long factors (before `day_roll`): each side's
  rating is its outfield attack, midfield and defence plus its keeper, and the
  chance is `a³ / (a³ + b³)`. It is published with its result.

### 44.6 Bracket

- The bracket has `P` slots, the smallest power of two ≥ the number of
  entrants `N`, and `R = log2(P)` rounds.
- Round 1 has `P / 2` pairings. A seeded draw picks `P − N` of them to hold a
  single entrant (a **bye**), and a seeded shuffle places the entrants into the
  slots. Every pairing holds at least one entrant, because `N > P / 2`.
- The winners of pairings `2k − 1` and `2k` meet in the next round.
- **A bye counts as a round-1 win** and is paid as one.

### 44.7 Rewards

Every match won pays coins, increasing by round, so the champion totals
exactly `MIDWEEK_CHAMPION_TOTAL` (250, its own constant, equal today to the
attendance reward):

```text
T     = R(R+1)/2
pay_r = round_half_up(250 × r / T)          for r < R
pay_R = 250 − Σ pay_r (r < R)                the final absorbs the rounding
```

| Entrants | Rounds | Pay per win, round by round | Coins issued in a full bracket |
|---:|---:|---|---:|
| 4 | 2 | 83 · 167 | 333 |
| 5–8 | 3 | 42 · 83 · 125 | 459 |
| 9–16 | 4 | 25 · 50 · 75 · 100 | 650 |
| 17–32 | 5 | 17 · 33 · 50 · 67 · 83 | 953 |

- Because the whole roster is entered and byes pay, every run issues a full
  bracket's worth: with 17–32 entrants, 953 coins, about four attendance
  rewards a week.
- **Payment is lazy and happens once:** after `final_reveal_at`, the end of
  the final (ADR-104), never at simulation time or while the final plays, so wallet balances cannot spoil results early. At most one
  payment per (tournament, round, member), ledger reason `midweek_win`, through
  a security-definer path shaped like `grant_bibs_reward`. It pays the winners
  stored in the bracket, in the same transaction that completes the week, so a
  week is complete exactly when it has been paid (ADR-096).
- **A member disabled between the lock and the payout is not paid,** as the
  bibs bonus skips a disabled member.
- **One inbox message** (`midweek_result`) per entrant, per tournament, paid
  or not (ADR-109; until then only members paid were told): titled by how far
  they got, then who beat them and how, their coins if any, and the champion;
  an auto squad's message says so. A member disabled since the lock gets none.
- **The faucet** (ADR-096): about 43 coins per member a week at a roster of 22,
  and never more than one attendance reward to any member, so showing up stays
  the dominant coin source.

### 44.8 Determinism, fairness and controls

- **The tournament is a pure function** of the locked squads, the snapshots
  and one secret 32-byte seed per tournament.
- **Randomness** is `sha256(seed ‖ tag)` with the first 6 bytes read as an
  integer in `[0, 2^48)`, where the tag names the draw (for example the match,
  chance and field). All arithmetic is integer fixed-point in parts per
  million; no floats, `exp` or `log` (ADR-090).
- **Commit and reveal.** `seed_hash = sha256(seed)` is visible from the moment
  the tournament exists; the seed itself only once the tournament is
  `complete`. Nobody, admins included, can re-roll a week.
- **A stored result is final.** A tournament is simulated at most once, its
  result never changes, and squads are immutable after the lock.
- **States:** `open` → `skipped` or `simulated` → `complete`; `open` or
  `simulated` → `void`.
- **Void** (`admin_void_midweek`, with a required reason) works only before
  payout. It hides the week's results and pays nothing; it never recomputes.
  After payout, corrections go through the audited `admin_adjust_wallet`.
- **Rehearsal** (`admin_midweek_rehearsal`) runs the engine on the current
  saved squads plus auto squads with a throwaway seed, returns the result, and
  **writes nothing**.
- **Launch switch.** A single-row `kut.midweek_config` with `enabled` (default
  `false`). Disabled, the worker creates no new tournament; one already open
  still runs unless voided.

### 44.9 Reveals and privacy

Everything is gated by time in definer projections on
`kut.is_active_member()` (ADR-079); no reveal is a job.

- **Before the lock** a member sees only their own saved squad, plus the
  tournament's lock, clock version and `seed_hash`. `final_reveal_at` shows
  only once the final has ended (ADR-105): earlier, its distance from the
  final's kick-off would say whether the final goes to penalties.
- **From the lock** (ADR-105): round 1's draw (pairings, byes, both managers
  and the kick-off, no result) and every squad's five cards with their OVR,
  archetype, injury, trialist and auto flags, the keeper, and the factors that
  follow from those (OVR factor, fitness, handicap, lines).
- **From round 1's kick-off,** the week's dice: each card's form roll, pick
  factor and power, null until then.
- **Each match** appears at its kick-off (the pairing, its win chance and day
  rolls), **each event** at its own moment (§44.1), and the match's goals,
  penalties, winner and end only once it has ended; the champion once the final
  has (ADR-106). A week simulated before ADR-104 has no stored times and shows
  whole matches at kick-off.
- **Pick shares** appear once the tournament is `complete`. An owner count is
  shown only when at least `MIDWEEK_OWNER_COUNT_MIN` (3) entrants own the
  Player; below that it is null and the report says "fewer than 3 owners" (until
  2026-09-30 "a rare pick", which read as few pickers rather than few owners). This rule
  lives in SQL. Until the week is complete the entries carry no pick or owner
  count at all (owner decision D3), and a Player nobody picked is listed only
  when at least three own it, so no row hints that one or two members hold it
  (ADR-095).
- **Only the entered cards are ever shown,** never the rest of a collection.
  Entry is the default; the rules page says plainly that your five are shown,
  and the opt-out takes you out entirely (ADR-091).
- **A void tournament** shows no results.

### 44.10 Match reports

- **Layout:** a headline, up to three fact lines, a timeline of key moments
  (minute, event, colour and the running score), the shoot-out if there was
  one, and a "why" panel with each card's factors as numbers. The timeline
  holds every goal, topped up with the biggest other chances to 4–8 moments.
  A shoot-out narrates its misses and the deciding kick; scored kicks show as
  a tally.
- **Team colours and the Why list (ADR-111):** on a match page every Player
  and manager name is in its side's colour, side 0 blue on the left and side 1
  red on the right for every viewer; lists of matches stay neutral. The
  renderer returns each line as text and as segments (plain text, or a name
  with its side and, for a Player both sides fielded, its manager), so pages
  never re-parse names. On screen such a Player shows its base name, and the
  manager is read out to screen readers only. The timeline puts each chance in
  its side's lane. The "why" is a list, never a table: per card its **Power in
  this match** (`power × day_roll`) in a pill tinted by strength band (≥ 1.10,
  1.00–1.09, 0.90–0.99, < 0.90) with a bar from 0.50 to 1.50, strongest first.
  Five factor boxes (Rating, Form, Pick, Fitness, Day) open on request, each
  explained from `MIDWEEK`. Owner counts are not in the report.
- **Colour comes from engine events, never invented.** Every phrase is chosen
  from the stored creator, shooter, chance type, outcome and probability.
  Quality follows the odds: a goal from a chance below 15% is "sensational",
  from 35% or more "routine", "quality" in between. A save is graded the same
  way by the chance it denied.
- **Chance types lean on archetype:**

  | Archetype | Typical chances |
  |---|---|
  | Speedster | breakaways, runs down the wing, a chase onto a through ball |
  | Finisher | volleys, first-time finishes, the rare overhead kick |
  | Playmaker | through balls, free kicks, a curled shot from the edge of the box |
  | Tank, Defender | headers from set pieces, scrambles in the box, a thunderous long shot |
  | Goalkeeper | long throws that start a chance; a keeper goal is a once-a-season event |
  | All-rounder | any of these at an average rate |

- **The renderer is presentation only:** a pure TypeScript function
  (`src/lib/midweek/report/`) of the stored events, the lock-time factors and
  the tournament's published `seed_hash`, which keys every phrase choice. It
  decides nothing, needs no SQL twin, and never reads the secret seed
  (ADR-093).
- **Names:** Players by display name; a trialist as the manager's ("Sanne's
  trialist", numbered when there are two or more); a Player fielded by both
  sides with the manager's name added.
- **The full phrasebook ships at launch:** several hundred lines in layers
  (build-up and assist, finishes by chance type and quality, injured variants,
  saves, woodwork and blocks, penalty kicks, headlines, fact lines such as
  contrarian hero, form hero, Bronze standout, upset, keeperless side,
  three-keeper gamble, thrashing, brace and hat trick).
- **Phrasebook rules**, pinned by unit tests like `CAST_LINES` (ADR-087):
  - names, never gendered pronouns;
  - nothing medical, no body parts, and never `kut.injury_periods.note`;
  - an injured variant only for a card injured at the lock, and the humour is
    about playing on, never the injury;
  - a miss always credits someone ("a stunning save", "off the post"), never
    ridicules the shooter; teasing managers' choices is fine;
  - no phrasing repeats within one match;
  - every line reaches members through a reviewed PR.
- **Fact thresholds:** a contrarian or form hero has that factor at 1.15 or
  more and scored or was the standout for the winner; an upset is a winner
  under 35% before kick-off; a cheap standout is Common or Bronze (OVR under
  50); a thrashing is three goals or more. The standout scores goal 3, assist 2,
  save 1, block 1, penalty scored 1, penalty saved 2.
- **Owner counts and a report's text (ADR-098).** The renderer takes
  `ownersPublished`. While false, no picked card carries a pick label ("N of M
  owners" or "fewer than 3 owners"; an auto squad still reads "auto squad") and the
  contrarian-hero fact uses a count-free line. Reports appear from round 1 and
  owner counts only at `complete` (§44.9, owner decision D3), so the pages
  render every report's text with the flag false: a report reads the same all
  night and afterwards. The "why" panel's pick labels used to appear once the
  week was complete; since ADR-111 the report shows no owner counts, and they
  stay on the bracket's pick shares.
- **The pages (PR 8, ADR-098):** the report at
  `/midweek/[weekStart]/match/[matchId]`, the bracket at
  `/midweek/[weekStart]` (rounds as they are revealed, byes, the
  champion, and pick shares once complete), and the evening on
  `/midweek` (under `/club/midweek` until ADR-107, which redirects
  there). From round 1 every card on them shows its lock-time snapshot,
  injury cast included. Last Wednesday's champion leads `/midweek` and the
  Home card until Thursday 23:59 Europe/Amsterdam
  (owner decision D4); a void week's URLs show only its notice.
- **The evening from the lock (ADR-113):** the evening and the bracket of a
  running week carry a sticky clock (the lock and every round; `Locked`,
  `Played` once every pairing of the round shows its result, `Live` from its
  kick-off until then, `Next`, `Later`). From the lock `/midweek` shows the
  draw: the member's first match, their five and their opponent's (both
  possible opponents after a bye) with lock-time OVR, archetype, tier and
  keeper only, and round 1's kick-offs. Then the member's night, the next
  round's kick-offs and the round just played; once out, a placeholder and the
  final; from the final's kick-off, the final for everyone. Rows of matches are
  neutral, in three states: kick-off, full time, or a bye. A pairing not yet
  decided reads `Winner of A v B` in round 2 and `Winner, Quarters 1` beyond.
  `/midweek/past` lists every complete, skipped or void week, newest first.

- **Live (ADR-115, with ADR-106):** a member watches their own match and the
  final chance by chance: each chance at its stored moment, the score so far,
  `Live · 64′` (the running match clock), then the shoot-out kick by kick.
  Every other match reads `In play · result at full time` until it ends. No
  page shows a result, a headline, facts, goals or assists before full time;
  the page renders the whole stored match on the server and sends only what is
  due. The evening, the bracket and a match page poll every 20 seconds while a
  match is in play, and once at the next kick-off otherwise; Home's card shows
  the match as it stood at page load and does not poll.

### 44.11 Running without admin

KUT has no scheduler; like ADR-061, one idempotent, service-role-only worker
(`kut.run_midweek_due`) runs lazily from page visits and does whatever is due:

- **open:** create the next tournament with its seed and `seed_hash` when the
  config is enabled, first rotating unclaimed Players' archetypes from that
  seed (§44.2, ADR-110), one opener at a time;
- **lock:** after `lock_at`, apply the gates, build auto squads, snapshot,
  simulate the whole bracket and store it (`simulated`);
- **pay:** after `final_reveal_at`, the end of the final, pay, publish the
  seed and pick shares (`complete`).

Claims use `for update skip locked`, so concurrent calls do the work once.
Given the field, the result is identical whenever it is computed; only the
moment coins land depends on when someone visits. Publishing sessions, which
admins already do, is the only weekly input.

**The trigger (ADR-098).** `runDueMidweek()` calls the worker from Home and
every Midweek page, before the page reads anything, so a visit at 20:01 sees
the locked week. It first counts due work through the service client (an open
week whose lock has passed, a simulated week whose final is out, or the switch
on with no week running), tries at most once a minute per server process, and
never fails the page.

**When the lock snapshot is taken (ADR-095).** The lock step runs at the first
worker call at or after `lock_at`, and reads the field then: who is active,
which cards they own, and each card's OVR and injury flag. The archetype is
the week's snapshot from when it opened (§44.2, ADR-099). Opt-outs alone count
as of `lock_at` itself (`opted_out_at <= lock_at`). A trade or a published
session between `lock_at` and that first call is therefore seen. Page visits on a Wednesday evening make the gap minutes, and
KUT keeps no history to read an earlier moment from.

### 44.12 Simulation targets

The harness simulates at least 5,000 seasons against a mix of manager
strategies; a fast smoke version runs in the unit suite.

| Target | Starting value | Simulated, 5,000 seasons (ADR-092) |
|---|---|---|
| Strongest collection beats the weakest in a single match | about 65% | 70.6% |
| Strongest collection wins the whole tournament (8 entrants) | about 25–30% | 28.2% |
| A thought-through five beats a random five from the same collection | at least 60% | **58.7%** |
| No fixed habit wins over a 20-week season (highest OVR, least popular, last week's winners, random) | none ahead by more than a few percent | 4.5% lead |
| A Common or Bronze card is a match's standout | most weeks, at least once | every week |
| An empty slot is never the best choice | always | yes |
| An auto squad beats a typical picked squad | at most about 20% | 12.0% |
| An auto squad reaches the last four | about 2% or less | 1.9% |
| The squad that looks strongest after round 1 reaches the final | at most about 35% | 31.8% |

The first and third rows pull against each other, and no tuning the harness
found meets both. The owner accepted both as they are (ADR-092); the harness
fails if either drifts past 72% or below 58%.

**The archetype rotation (MM 2.0 C0).** The harness can also rotate unclaimed
Players' archetypes each week, as the ROADMAP's "Rotate unclaimed Players'
archetypes weekly" proposes: only active, collectible, unclaimed Players, the
pool every archetype, decided before the week opens and frozen for it (ADR-099),
seeded and deterministic. `node scripts/midweek/rotation.mjs` runs every
rotation variant over the same seasons and rewrites
`docs/archive/MIDWEEK_ROTATION.md`: the targets above, Goalkeepers per roster and
per squad, and how visibly rotation marks a Player as unclaimed. It is the
evidence for checkpoints Q8 and Q9 and changes no rule; `npm run sim:midweek`
still plays today's fixed archetypes.

### 44.13 Invariants to come

Added to Part L by the PR that makes each hold:

- **#25 (engine PR):** a tournament is simulated at most once, its stored
  result never changes (a void hides it, never recomputes), and squads are
  immutable after the lock. **Added to Part L by
  `20261005000000_midweek_engine.sql` (ADR-095).**
- **#26 (payout PR):** a midweek win pays at most once per (tournament, round,
  member), and one tournament pays any member at most
  `MIDWEEK_CHAMPION_TOTAL`. **Added to Part L by
  `20261006000000_midweek_payouts.sql` (ADR-096).**
- **#27 (rotation PR):** only the open step changes an archetype without a
  member or an admin, and only an unclaimed, active, collectible Player's.
  **Added to Part L by `20261015000000_midweek_archetype_rotation.sql`
  (ADR-110).**

### 44.14 Data and functions

Each Midweek migration adds its part here.

**Entry (`20261003000000_midweek_entry.sql`).** Members read nothing directly;
the functions write and two gated projections read.

| Object | What it holds or does |
|---|---|
| `kut.midweek_config` | One row: `enabled`, default `false`. The launch and pause switch. |
| `kut.midweek_tournaments` | One per football week: `week_start`, `lock_at`, `seed_hash`, `status` (`open`, `skipped`, `simulated`, `complete`, `void`), `rounds` and `final_reveal_at` once drawn, and `seed`, only once `complete`. A skip or void carries `status_reason` as a code (`club_break` or `too_few_entrants` for a skip, `admin_void` for a void), and a void carries the admin's `void_note`, which members read. |
| `kut.midweek_tournament_secrets` | The seed from creation. The service role alone reads it. |
| `kut.midweek_squads`, `kut.midweek_squad_cards` | A member's saved squad: slots 1–5, one Card Copy and one Player per slot. |
| `kut.midweek_opt_outs` | Members who never take part. |
| `kut.save_midweek_squad(uuid[])` | Saves the caller's squad for the open tournament, replacing any earlier one. Refuses: no active account (`42501`); opted out, or `now() >= lock_at` (`P0001`); no open tournament (`P0002`); not 1–5 distinct cards, a card that isn't the caller's and active, or two cards of one Player (`22023`). |
| `kut.set_midweek_opt_out(boolean)` | Opts the caller out, withdrawing a squad saved for a tournament that hasn't locked yet, or back in. |
| `kut.midweek_current` | The switch, the latest tournament (with its reason and void note, and its seed only once complete) and whether the caller has opted out. One row even before any tournament exists. |
| `kut.midweek_tournaments_public` | Every tournament, newest first, with the same fields. Next week's tournament opens as soon as one ends, so this is how a page reports last week's outcome (owner decision D4). The engine migration appends the champion. |
| `kut.my_midweek_squad` | The caller's own squads, one row per slot. |

All three projections are definer views gated on `kut.is_active_member()`
(ADR-079): a denied caller reads zero rows.

**Archetype cooldown (`20261004000000_archetype_cooldown.sql`, ADR-094).**

| Object | What it holds or does |
|---|---|
| `kut.players.archetype_changed_at` | When the member last changed the Player's archetype through self-service. Null means never; nothing is backfilled, and admin changes don't set it. |
| `kut.set_own_player_archetype(text)` | Now refuses a change within 336 hours of `archetype_changed_at` (`22023`, message `archetype change cooldown: next change allowed from <ISO-8601 UTC>`, the exact moment to the microsecond as DETAIL), and stamps it on a change. Re-saving the current archetype is neither refused nor stamped. Its other refusals are unchanged. |

**Engine (`20261005000000_midweek_engine.sql`, ADR-095).** The engine, the
worker, the stored result, the reveal projections and the admin controls; adds
Part L #25. Stored results use the engine's 0-based indexes (slot 0–4, side
0–1, pairing from 0), so a page hands them to the renderer unchanged; squad
slots stay 1–5, and the lock moves the surviving picks up into engine slots.

| Object | What it holds or does |
|---|---|
| `kut._mm_*` | The engine, a line-for-line port of `src/game/midweek/` in bigint ppm. `_mm_simulate(seed, entrants)` takes the engine's `EntrantInput[]` and returns its `TournamentResult` as JSON; `_mm_play_match` likewise one `MatchOutcome`. Internal: no member, admin or service-role grant. Pinned by the generated `midweek_engine_parity.test.sql`. |
| `kut.midweek_entries`, `kut.midweek_entry_cards` | One row per entrant (`auto`, keeper slot, keeperless) and per entered card: the lock-time Card Copy, Player, OVR, archetype and injury flag, and every week-long factor, `power_ppm` and the three line multipliers. Trialists have no card or Player. |
| `kut.midweek_pick_shares` | Per Player owned in the field: owners, picks (auto squads left out), share and pick factor. |
| `kut.midweek_matches` | Every round-1 pairing, a bye included (`bye`, no side 1, a round-1 win for side 0), and every later match: goals and penalties per side, winner, side 0's pre-match win chance, each side's day rolls by slot, and `reveal_at = lock_at + 30 min × round`. |
| `kut.midweek_match_events` | A match's events in engine order (`seq`): a chance (minute, creator, shooter, defender, chance type, outcome, goal chance in ppm), a penalty kick (round, kicker, keeper, outcome, chance) or the draw that settles a shoot-out. |
| `kut.midweek_jobs` | One row per worker call: what it locked, completed and opened, and any error. |
| `kut.midweek_tournaments.voided_at`, `.voided_by` | When a void happened and which admin did it. |
| Part L #25 guards | Result rows can be inserted only while their tournament is `open` (inside the lock step) and never updated or deleted directly; a tournament's status only moves forward, its week and seed hash never change, its lock only while open, its bracket once drawn, and a published seed must hash to `seed_hash`; squads and their cards cannot change once `now() >= lock_at`. Deletes cascading from a deleted tournament or account pass. |
| `kut.run_midweek_due(integer)` | The service-role worker (§44.11). **Lock:** each open week whose lock has passed — the club-break gate, the field (opt-outs as of the lock), the simulation with the week's secret seed, every stored row, then `simulated` with `rounds` and `final_reveal_at`; or `skipped` with its reason. **Complete:** each simulated week whose final is revealed — publishes the seed, `complete`. **Open:** with the switch on and no week open or simulated, the next ISO week whose lock is ahead and which has no tournament (a voided or skipped week never runs again), with a fresh seed. Claims skip rows another call holds. Returns `{locked, completed, opened}`. |
| `kut.midweek_tournaments_public` | Gains `champion_user_id` and `champion_name` at the end, from the final once it is revealed. |
| `kut.midweek_matches_public` | Revealed pairings (`reveal_at <= now()`) of simulated and complete weeks, byes included, with both managers' names. |
| `kut.midweek_events_public` | The events of revealed matches. |
| `kut.midweek_entries_public` | Every entered card with its manager, Player name and photo, snapshot and factors, from round 1's reveal. `picks` and `owners` stay null until the week is `complete` (owner decision D3), and `owners` below three always. |
| `kut.midweek_pick_shares_public` | A complete week's pick shares: picks, owners (null below three) and pick factor. A Player nobody picked is listed only when at least three own it. |
| `kut.midweek_admin_overview` | Admins only: the switch, the latest tournament and its times and seed hash, how many squads are saved for it, how many members opted out, and the worker's last run and error. |
| `kut.admin_set_midweek_enabled(boolean)` | The launch and pause switch, recording who flipped it. |
| `kut.admin_void_midweek(uuid, text)` | Voids an `open` or `simulated` week with a 3–200-character note members read. Refuses: not an admin (`42501`); a bad note (`22023`); no such week (`P0002`); a complete (paid) week, or one that did not run (`P0001`). |
| `kut.admin_midweek_rehearsal()` | Runs the engine on the earliest open week's saved squads plus auto squads (everyone auto when no week is open) with a throwaway seed, and writes nothing. Returns `ran_at`, `tournament_id`, `week_start`, `lock_at`, `status`, `would_skip` (`club_break`, `too_few_entrants` or null), `field`, `picked`, `auto`, `opted_out`, `auto_managers`, `size`, `rounds`, `by_round` (each round's `reveal_at` and pairings: names, goals, penalties, winner), `champion` (`user_id`, `name`) and `warnings` (`{level, message}`: lost saved cards, the gate, too few entrants, no open week, the switch off). |

All projections are definer views gated on `kut.is_active_member()` (the admin
overview on `kut.is_admin()`), and a void week shows no result in any of them.

Since the evening timing migration (`20261011000000`, ADR-104) the lock step
stores `reveal_at` as each match's start on the week's clock (§44.1), not
`lock_at + 30 min × round`, and the complete step waits for the end of the
final.

**Payouts (`20261006000000_midweek_payouts.sql`, ADR-096).** Adds Part L #26.

| Object | What it holds or does |
|---|---|
| `kut.wallet_ledger` reason `midweek_win`, `kut.user_notifications` type `midweek_result` | The two constraints re-created with one value each. A ledger row references `midweek_tournament` and carries the idempotency key `midweek:<tournament>:<round>:<member>`. |
| `kut.midweek_rewards` | One row per win paid: tournament, round, member (the primary key), the pairing won (`match_id`, unique), `bye`, `amount` and the deferred `ledger_id`. Service role reads it; members read their own through the view below. |
| Part L #26 guard | A reward is accepted only while its tournament is `simulated` with the final revealed, for a stored win (that pairing's winner, in that round), at exactly `kut._mm_round_payouts(rounds)[round]`, and while the member's total for the tournament stays within `MIDWEEK_CHAMPION_TOTAL`. A paid reward never changes. |
| `kut._mm_pay_tournament(uuid)` | Internal. Pays every stored win of a tournament (byes as round-1 wins), skipping a member disabled since the lock: guard row, wallet, ledger row, balance, then one `midweek_result` message per member paid. Returns the wins paid. |
| `kut._mm_complete_tournament(uuid)` | Re-created: pays before publishing the seed and setting `complete`, in one transaction under the tournament's row lock. Its contract is unchanged. |
| `kut.my_midweek_rewards` | The caller's own rewards: `tournament_id`, `week_start`, `round_no`, `match_id`, `bye`, `amount`, `paid_at`. A definer view gated on `kut.is_active_member()`. |

**Archetype snapshot (`20261008000000_midweek_archetype_snapshot.sql`, ADR-099).**

| Object | What it holds or does |
|---|---|
| `kut.midweek_archetype_snapshots` | Each Player's archetype per tournament (`tournament_id`, `player_id`, `archetype`), written when the tournament is inserted. Service role reads it. |
| Trigger `midweek_tournament_archetype_snapshot` | After insert on `kut.midweek_tournaments`: snapshots every row of `kut.players` for the new tournament, whatever inserted it. |
| `kut._mm_field(uuid, timestamptz)` | Re-created: a card's archetype is the tournament's snapshot, or the live one for a Player without a row. Otherwise unchanged. |
| `kut.midweek_archetypes` | The snapshots (`tournament_id`, `player_id`, `archetype`) for the picker. A definer view gated on `kut.is_active_member()`. |

**Evening timing (`20261011000000_midweek_evening_timing.sql`, ADR-104).**

| Object | What it holds or does |
|---|---|
| `kut._mm_config()` | `schedule` becomes `{lockDayOffset, current, versions: {1, 2}}`, each version with `lockHourLocal`, `lockMinuteLocal`, `roundOffsetMinutes`, `roundIntervalMinutes`, `slotSeconds` and `kickSeconds`. Every other key is unchanged. |
| `kut._mm_schedule(int)`, `kut._mm_lock_at(date, int)`, `kut._mm_round_start_at(timestamptz, int, int)`, `kut._mm_match_timing(jsonb, int)` | The clock, twins of `src/game/midweek/schedule.ts` (`scheduleFor`, `lockAt`, `roundStartAt`, `matchTiming`), pinned by the golden vectors. `_mm_match_timing` takes a match's engine events and returns `{eventOffsetsMs, endOffsetMs}`. `_mm_lock_at(date)` now means the current version; `_mm_reveal_at` is dropped. Internal, like every `_mm_` function. |
| `kut.midweek_tournaments.schedule_version` | 1 or 2. Existing weeks are 1; the open step names the current version, and the default is 2. Fixed once the week locks. |
| `kut.midweek_matches.ends_at` | When the match ends: full time, or its shoot-out's last kick or settling draw; a bye ends as it starts. Null on weeks simulated before ADR-104. |
| `kut.midweek_match_events.reveal_at` | When the event is due (§44.1). Null on weeks simulated before ADR-104. |
| Part L #25 guard | The schedule version, like the lock, may change only while the week is open. `ends_at` and the event times are covered by the existing guard: a stored result is never updated. |
| `kut._mm_lock_tournament(uuid)` | Re-created: writes each match's `reveal_at` (its start) and `ends_at`, each event's `reveal_at`, and `final_reveal_at` as the end of the final, on the week's version. |
| `kut._mm_open_next()` | Re-created: opens the next week on the current version, with that version's lock. |
| `kut.admin_midweek_rehearsal()` | Re-created: each round's `reveal_at` on the open week's clock (or the current one), plus each round's `ends_at` (when its last match ends) and `schedule_version` at the top level. |
| `kut.midweek_current`, `kut.midweek_tournaments_public` | Append `schedule_version` (null on `midweek_current` before any week exists). |
| The open week | Moved to version 2 at the push (lock 20:00 → 19:55), unless 19:55 had already passed. |

**Draw from the lock (`20261012000000_midweek_draw_from_lock.sql`, ADR-105).**
Views only.

| Object | What it holds or does |
|---|---|
| `kut.midweek_draw_public` | Round 1 of a drawn week (`simulated` or `complete`) from the lock: `match_id`, `tournament_id`, `week_start`, `pairing`, `bye`, both managers' ids and names, and `kickoff_at` (round 1's start on the week's clock). No result column. |
| `kut.midweek_entries_public` | Re-created: every entered card from the lock instead of round 1's reveal; `form_roll_ppm`, `pick_factor_ppm` and `power_ppm` null until round 1 kicks off. Columns, and the D3 rule for `picks` and `owners`, unchanged. |
| `kut.midweek_current`, `kut.midweek_tournaments_public` | `final_reveal_at` null until it has passed. `midweek_current` appends `evening_live`: the latest week is `simulated` and now is between its lock and the end of its final. |

**A result for every entrant (`20261013000000_midweek_result_for_everyone.sql`, ADR-109).**

| Object | What it holds or does |
|---|---|
| `kut._mm_pay_tournament(uuid)` | Re-created. Pays exactly as before; its message step now sends one `midweek_result` per entrant not disabled, titled by finish (`You won Midweek Madness`, `You went out in the semi-finals`), with who beat them and how, their coins, the champion (not on the runner-up's) and, for an auto squad, `Your auto squad played for you.` The reference stays the tournament. |

**Live reveal (`20261014000000_midweek_live_reveal.sql`, ADR-106).** Views only.

| Object | What it holds or does |
|---|---|
| `kut.midweek_matches_public` | Re-created: goals, penalties, `winner_side` and `winner_user_id` null until the match has ended; appends `ends_at` (null until passed) and `in_play`. |
| `kut.midweek_events_public` | Re-created: each event from its own `reveal_at` (with its match before ADR-104); appends `reveal_at`. |
| `kut.midweek_tournaments_public` | The champion from the end of the final. |

**Archetype rotation (`20261015000000_midweek_archetype_rotation.sql`, ADR-110).** Adds Part L #27.

| Object | What it holds or does |
|---|---|
| `kut.midweek_archetype_rotations` | One row per archetype the open step changed: `tournament_id`, `player_id`, `from_archetype`, `to_archetype`, `rotated_at`. Service role reads it. |
| `kut._mm_rotation_archetype(bytea, uuid)` | A Player's draw for a seed: rng.ts `uniform` over the seven archetypes (`src/game/archetypes.ts` order), tag `rotation:<player id>`. Internal. |
| `kut._mm_rotate_archetypes(bytea)` | Sets every active, collectible Player with no linked account to their draw, returns the changes as `[{playerId, from, to}]`, and rebuilds the active season once if anything changed. The same seed again changes nothing. Internal. |
| `kut._mm_open_next()` | Re-created: one opener at a time (a transaction advisory lock, then the running-week check again); rotates with the new week's seed right before the insert, so the snapshot freezes the rotation; logs each change against the new week. A clash on `week_start` now raises, rolling the rotation back with the open. |

---

# PART XVI — FUTURE COMMUNITY VOTING

## 45. Post-match awards — Phase 3+

Potential post-match voting:

- Engine;
- Playmaker;
- Wall;
- Player of the Match.

Rules:

- only accounts linked to Players who attended that session may vote;
- one vote per award;
- no self-vote;
- results close after a time window;
- winners receive temporary attribute/form effects;
- voting does not directly create huge permanent OVR increases.

Do not build until the group demonstrates willingness to participate.

---

# PART XVII — MOBILE UX

## 46. Navigation

Recommended authenticated bottom navigation on mobile:

1. **Home**
2. **Collection**
3. **Packs**
4. **Market**
5. **Club**

Additional pages via menu/profile:

- Leaderboard;
- **Chronicle** (`/chronicle`);
- Club Value;
- Trade offers;
- Player directory;
- Settings;
- Admin.

Desktop may use side/top navigation.

**Update (2026-09-02, ADR-049).** The "Sessions" entry (`/sessions`) in the
More menu is now **"Chronicle"** (`/chronicle`), keeping the same icon.
`/sessions` and `/sessions/[sessionId]` are permanent redirects to
`/chronicle` and to the containing week's issue. The Chronicle presents one
issue per football week — the rating engine's own unit (§9) — with each
session in that week as a matchday report inside it. Because the navigation is
a public surface, this list is the canonical record of it.

**Update (2026-09-05, ADR-053).** The More menu is **removed**. Every
destination is now a primary tab, a tab within a section, or one of two
single-purpose chrome controls, so that each one can show "you are here" —
nine of fifteen previously could not.

Primary navigation, **identical on desktop and mobile**:

1. **Home** (`/`) — also owns the Chronicle (`/chronicle`)
2. **Collection** (`/club/collection`) — also owns Club Value (`/club/value`)
3. **Packs** (`/club/packs`)
4. **Market** (`/market`) — badge: incoming trade offers
5. **Leaderboard** (`/leaderboard`) — also owns the player directory
   (`/players`)

Section tabs, inside a primary destination:

- Market: **Buy** (`/market`) · **Offers** (`/market/offers`, badged)
- Leaderboard: **Clubs** (`/leaderboard`) · **Players** (`/players`)
- Collection: **Album** · **Manage** (`?view=manage`, unchanged from §41)
- Admin: the existing row of tabs, eight since Midweek (`/admin/midweek`,
  ADR-098) joined it

Chrome controls, right of the bar on both platforms:

- **Messages** (`/messages`) — its own control, carrying a numeric unread
  count. It replaces the single undifferentiated dot that previously merged
  unread messages and incoming offers on the "More" button.
- **Account** — the avatar, now the menu trigger rather than a decorative
  disc: Settings, My card, How KUT works, Admin (admins only), Sign out.

`/club` is a **permanent redirect to `/club/collection`**, as `/sessions`
redirects to `/chronicle`. Its Club Value figure moved to the Collection
header; its card and unique-player counts were already there.

**Update (2026-09-26, ADR-097).** Home also owns **Midweek Madness**
(`/club/midweek` and the pages beneath it, §44), next to the Chronicle: both
answer "what's happening this week", and Home's card is the way in (owner
decision D1). The route sits under `/club`, but the `/club` redirect is
unchanged and Collection does not own it. Collection carries a one-line
Midweek strip under its header instead of the Club-page card the build plan
had (D2). Neither the Midweek pages nor their entry points show while Midweek
Madness is switched off with no week running.

**Update (2026-10-02, ADR-107).** The fifth primary tab is **Compete**
(`/midweek`), replacing Leaderboard (owner decisions DR1-1 and DR1-2 in
`design/ux-review/HANDOFF.md`). Primary navigation is now:

1. **Home** (`/`) — also owns the Chronicle (`/chronicle`)
2. **Collection** (`/club/collection`) — also owns Club Value (`/club/value`)
3. **Packs** (`/club/packs`)
4. **Market** (`/market`) — badge: incoming trade offers
5. **Compete** (`/midweek`) — also owns `/leaderboard` and `/players`; badge:
   Midweek's status

- **Compete's section tabs:** **Midweek** (`/midweek`) · **Standings**
  (`/leaderboard`) · **Players** (`/players`), at the top of the picker and
  evening, a week's bracket, Standings and the directory; a match report keeps
  its back link instead. The Leaderboard page is titled **Standings**.
- **Midweek Madness moves from Home to Compete,** at `/midweek` and the pages
  beneath it. `/club/midweek` and everything under it are permanent redirects
  to the same path under `/midweek` (query string kept). Home keeps its
  Midweek card as the way in. While Midweek is switched off with no week
  running, `/midweek` sends a member to Standings instead of a dead end.
- **Compete's badge:** `Pick` (brass) while a week is open, the member has not
  opted out, and they have no saved squad; `Live` (live red) from the lock to
  the end of the final, for every member (`midweek_current.evening_live`, or
  the end of the final where that column is absent); nothing otherwise. It sits
  on the tab in both bars; `Live` also on the Midweek section tab. The link's
  accessible name adds "Midweek Madness: you haven't picked your five" or
  "Midweek Madness is live". On the bottom bar the badge is anchored to the
  icon's right edge, so it cannot push the fifth tab past a 320 px screen.
- **The Collection strip is removed** (owner decision Q12, retiring D2):
  Compete's badge and Home's card replace it.
- **The avatar links to Settings,** and is marked current on Settings, My
  card, How KUT works and Admin. It is not a menu trigger: the app has worked
  this way for a while, and this record still described ADR-053's menu.
- **The top bar from `sm` to `lg` shows the five tabs as icons** (KB-033):
  with their labels, the tabs, coins, messages and avatar need about 880 px.
  Each label stays in its link for screen readers and as its hover title, and
  the labels return from `lg`.

**Update (2026-10-02, ADR-114).** **Messages** (`/messages`): each message
is one row and one link to its subject, through `/messages/{id}/open`, which
marks it read on the way: a Midweek result to its week's bracket, a sale to
Club Value (the wallet), a purchase to the card, trade messages to Offers,
kudos to My card, session messages to the Chronicle issue or the report form,
the rehab check-in to Home. A club notice links nowhere. Unread rows show a dot
and `New`; rows are grouped `Today`, `Earlier this week` and by day; `Mark
all read` stays.

Desktop may use side/top navigation. Because the navigation is a public
surface, this list remains the canonical record of it.

---

## 47. Home screen

Home should answer "what changed?" quickly.

> **Implemented (2026-08-30, ADR-031):** Home leads with wallet balance, Club
> Value, rank, an "Open a pack" CTA, and the **top 5 weekly risers** —
> `kut.top_risers` diffs the two most recent `kut.player_rating_snapshots`
> weeks of the active season and returns only positive `ovr_delta`, rendered as
> `LiveCard`s with a "▲ +N" trend pill. Snapshots are captured by an
> `after`-trigger on `kut.player_season_state` (keyed on `last_week_start`), so
> the widget needs two published football weeks before it shows anything
> (explanatory empty state until then). Home links out to `/players` for the
> full roster rather than listing it. Recent acquisitions / market activity /
> latest-session widgets are still not built.

> **Implemented (2026-08-31, ADR-038):** a club-wide **activity newsfeed**.
> `kut.activity_feed` is one read-only `security_invoker = false` view (granted
> to `authenticated`, the `kut.club_value_leaderboard` pattern) unioning four
> already-persisted sources: completed sales (`market_sales`), active listings
> (`market_listings`), pack openings (`pack_openings`, count only — no card
> reveal), and published sessions (`match_sessions`). **Not** discards
> (private inventory management) and **not** coin-grant / attendance rows
> (noise). No retention job. **Disclosure change:** a completed-sale row shows
> the seller, the card, the price **and the buyer name** club-wide (previously
> `market_sales` was buyer+seller-only; the buyer was already visible to the
> seller via the ADR-019 sale notification). Listings already exposed the
> seller club-wide (ADR-017).
>
> **Amended (ADR-039):** the feed is a **"Club activity" section at the bottom
> of Home**, not a standalone `/feed` route — the route and its "Newsfeed" nav
> entry were removed. Home reads `order by ts desc limit 12` with a fixed
> `ts >= 2026-08-30` floor (no pager, no `?before=` cursor); dates render
> date-only. The `kut.activity_feed` view is unchanged.
>
> **Amended (ADR-053):** Home carries a direct link to the current Chronicle
> issue. Home and the Chronicle both answer "what happened this week" — Home's
> own heading is "This week in KUT" — but Home previously reached it only
> through a session row in the activity feed, and the Chronicle lost its More
> menu entry when that menu was removed. A fuller Matchday Update hero (below)
> remains Phase 2 scope.

> **Amended (ADR-044):** `kut.activity_feed` also emits `kind = 'trade'` (added
> with trade offers, ADR-042); `src/lib/activity.ts` renders it as
> "X traded Y to Z for N KUT Coins." and carries a `default` arm so an
> unhandled `kind` can never render a blank row. A **member-facing
> `/sessions`** list + `/sessions/[id]` detail (attendee list, goals, bibs
> bringer) is now built, backed by the additive `kut.published_sessions`
> summary view (`security_invoker = true` — published sessions and their
> attendance are already member-readable by RLS). Home's "Session published"
> rows link to it. This is the "latest-session widget" noted above.

> **Amended (ADR-097):** a **Midweek Madness card** sits directly under Home's
> header, the one thing on Home with a deadline: before the lock "Pick your
> five" (with the countdown, and the auto-squad warning) or "Your five are in".
> It shows only while picking is open for a member who hasn't opted out; its
> evening and after-the-final states follow with the results pages (§44).
>
> **Amended (ADR-098):** during Wednesday evening the card says which round is
> out, the member's latest result and next match, with the evening's clock;
> after the final it names the champion and how the member did until Thursday
> 23:59 Amsterdam (owner decision D4), then asks for next week's pick again.

> **Amended (ADR-114, MM 2.0 F4):** a short header (`This week in KUT`), then
> the **"now" stack**: the cards with a deadline, the Midweek evening first
> while it runs, otherwise the soonest deadline first among the Midweek pick
> card, the session report, the rehab check-in and the champion card. From the
> lock to the end of the final the Midweek card is live: the draw, the
> member's match at full time with its headline, or the final, as they stood at
> page load (Home does not poll). Then Club Value and Rank as linked tiles (the
> KUT Coins tile is gone; the coin pill shows the balance) and `Open a pack`;
> `Top risers`; and Club activity in six rows, a member's consecutive pack
> openings folded into one.

MVP widgets:

- wallet balance;
- Club Value;
- current rank;
- "Open Pack" CTA;
- recent acquisitions;
- latest market activity;
- latest published TFH session;
- biggest current player movers if historical snapshots exist;
- club-wide activity feed as a Home section (ADR-038; ADR-039 moved it from `/feed` into Home).

Phase 2 adds a Matchday Update hero:

- biggest OVR rise;
- tier changes;
- top scorer;
- special cards released.

---

## 48. Player card component

This is the product's most important visual component.

It must work at:

- compact grid size;
- full detail size;
- pack-reveal size;
- market listing size.

Displays:

- photo;
- display name;
- OVR;
- rarity treatment;
- six stats on expanded/full card;
- archetype;
- optional trend arrow;
- optional Special Card title.

Requirements:

- CSS-driven frame whenever possible;
- do not bake names/stats into images;
- image fallback if no player photo;
- readable at ~160px mobile width;
- no information available only by hover;
- shiny effects are performant;
- reduce animation for `prefers-reduced-motion`.

---

## 49. Pack reveal UX

> **Implemented (2026-08-30, ADR-031):** `src/components/pack-reveal.tsx`
> (pure state machine in `pack-reveal-state.ts`) animates the sequence below —
> rarity clue → OVR → identity, card by card, then a summary of all three with
> Collection / Open-another actions. Tap advances, "Skip all" jumps to the
> summary, and `prefers-reduced-motion` mounts straight to the summary. The DB
> transaction is untouched — the component only animates the already-persisted
> `kut.my_pack_opening_results`. Used by the bought-pack reveal at
> `/club/packs/[openingId]` and by the one-time starter reveal at `/welcome`.

> **Amended (ADR-114):** each card in the summary carries a chip: `New ·
> fills slot 14` for a Player new to the member's album, or `×3 · discards
> for 63` for one already held, and a line sums the pack up (`2 new Players.
> Album 19 / 29.`).

Sequence:

1. user taps pack;
2. confirmation if required;
3. server completes purchase and returns three immutable results;
4. reveal begins;
5. rarity clue;
6. OVR;
7. player photo/name;
8. next card;
9. summary of all three;
10. actions: Collection / Open another.

Allow:

- tap to skip;
- "Skip all";
- reduced-motion instant reveal.

Never delay the database transaction until after animation.

---

## 50. Admin attendance mobile UX

The admin attendance flow should be optimized for a phone.

Recommended:

- search field;
- recent/regular players near top;
- large tap targets;
- selected count;
- filter selected/unselected;
- persistent "20 selected" action bar;
- save draft;
- publish confirmation.

Goal entry should occur after attendee selection, not mixed into the first tap workflow.

Example:

> 20 attendees selected → Next → Goals → Publish.

---

## 51. PWA

Phase 1.5 / easy enhancement:

- web app manifest;
- app icon;
- standalone display mode;
- add-to-home-screen friendly;
- theme color.

Do not build complex offline state synchronization in early versions.

---

# PART XVIII — ACCESSIBILITY

## 52. Requirements

- semantic buttons/links;
- keyboard-accessible desktop navigation;
- visible focus;
- color contrast meeting WCAG AA where feasible;
- rarity is never communicated by color alone;
- meaningful `alt` text;
- touch targets at least ~44px;
- animation can be reduced;
- pack opening usable without animation;
- forms have labels and errors.

---

# PART XIX — PRIVACY

## 53. Default privacy stance

Player photos and group information should be visible only to authenticated TFH members.

Do not expose:

- account emails;
- invite tokens;
- wallet ledger details of other users;
- admin notes;
- private profile data.

Public unauthenticated pages should contain no private roster.

Player display naming should be configurable.

Recommended default:

- chosen display name or first name + last initial.

If TFH explicitly wants full names, this can be enabled.

---

## 54. Photo consent

Each Player should eventually be able to:

- upload/replace photo;
- request photo removal;
- use a generic silhouette;
- control display name within admin-defined limits.

MVP can begin with admin-managed photos if the group has agreed to that use.

Store originals in a private Supabase Storage bucket.

Prefer resized/compressed images, e.g.:

- max dimension ~1200 px;
- sensible JPEG/WebP compression;
- no need for multi-megabyte originals.

---

# PART XX — TECHNICAL ARCHITECTURE

## 55. Recommended stack

### Frontend / application

- Next.js, current stable release at project creation;
- App Router;
- React;
- TypeScript with `strict: true`;
- Tailwind CSS;
- small reusable component library created in-project;
- Zod for request/input validation.

### Backend / data

Supabase:

- PostgreSQL;
- Auth;
- Storage;
- Row Level Security;
- database functions/RPC for atomic economy operations.

### Hosting

Vercel Hobby while usage remains appropriate for a private, non-commercial group project.

Recommended domain:

`tfh.vibetrunk.com`

Alternative:

`vibetrunk.com/tfh`

Subdomain is preferred because:

- cleaner deployment;
- separate app lifecycle;
- fewer routing conflicts;
- easy future migration.

### Testing

- Vitest;
- React Testing Library;
- Playwright;
- Supabase CLI database tests / pgTAP;
- GitHub Actions if repository is on GitHub.

---

## 56. Deliberate non-choices for MVP

Do not add unless demonstrated necessary:

- Redux;
- GraphQL;
- Redis;
- WebSocket server;
- microservices;
- event bus;
- Kubernetes;
- external queue;
- separate backend repository;
- complex real-time market;
- blockchain;
- payment provider.

For ~200 Players and likely dozens of active Users, these would add failure modes without meaningful benefit.

---

## 57. Server authority

Anything economically valuable must be server-authoritative.

Client may never decide:

- pack contents;
- discard amount;
- wallet balance;
- sale tax;
- listing ownership;
- card ownership;
- card OVR;
- rarity;
- starter eligibility;
- attendance rewards.

Client sends intent.

Server validates and executes.

---

# PART XXI — DATABASE MODEL

## 58. Database enums

Suggested enums:

```text
user_role:
  user
  admin
  superadmin

session_type:
  monday
  friday
  other

session_status:
  draft
  published
  cancelled

card_edition_type:
  live
  totw
  hat_trick
  milestone
  iron_man
  comeback
  tots
  other

card_source:
  starter
  pack
  attendance_reward
  special_grant
  challenge
  admin

listing_status:
  active
  sold
  cancelled
  expired

ledger_reason:
  starter
  attendance
  pack_purchase
  discard
  market_buy
  market_sale
  market_tax
  challenge
  admin_adjustment
  admin_grant   # ADR-035: kut.admin_adjust_wallet
  admin_reset   # ADR-035: kut.admin_reset_account wallet zero + starter re-grant
  admin_self_grant   # ADR-052: kut.admin_grant_self_wallet
```

Exact PostgreSQL enum vs constrained text is an implementation choice. Prefer migration-friendly constrained text if agents are likely to change categories frequently.

---

## 59. `profiles`

One row per authenticated user.

Fields:

```text
id uuid PK references auth.users
display_name text not null
club_name text
role text not null default 'user'
player_id uuid unique nullable references players
created_at timestamptz
updated_at timestamptz
is_disabled boolean default false
starter_claimed_at timestamptz nullable
```

Do not store password.

Avoid duplicating email from `auth.users` unless genuinely needed.

> **Implemented (ADR-044):** `club_name` (dormant since the initial schema) is
> now member-editable via `kut.set_own_club_name(text)` — a security-definer
> RPC (own row only; trims; blank/whitespace → `NULL`; `≤ 80` chars, no
> control characters; `revoke … from public, anon`). **Not unique.** Set from a
> "Club name" section on `/settings`. `kut.club_value_leaderboard` renders
> `coalesce(nullif(btrim(club_name), ''), display_name || '''s Club')`, so an
> unset club falls back to the synthesised default. `club_value` / `rank` are
> unaffected.

---

## 60. `players`

Stable real-person identity.

```text
id uuid PK
slug text unique not null
display_name text not null
full_name text nullable
photo_path text nullable
archetype text not null default 'all_rounder'
is_active boolean default true
is_collectible boolean default true
created_at timestamptz
updated_at timestamptz
```

Possible later:

```text
preferred_position
privacy_mode
joined_at
retired_at
```

---

## 61. `seasons`

```text
id uuid PK
name text not null
starts_on date not null
ends_on date nullable
is_active boolean
created_at timestamptz
```

Exactly one active season at MVP.

---

## 62. `match_sessions`

```text
id uuid PK
season_id uuid references seasons
session_date date not null
session_type text not null
status text not null default 'draft'
notes text nullable
created_by uuid references profiles
published_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Recommended unique constraint:

```text
unique(season_id, session_date, session_type)
```

---

## 63. `attendance`

```text
id uuid PK
session_id uuid references match_sessions on delete cascade
player_id uuid references players
goals integer not null default 0 check goals >= 0
note text nullable
created_at timestamptz
updated_at timestamptz
unique(session_id, player_id)
```

---

## 64. `player_season_state`

Cached current output of the deterministic rating engine.

```text
player_id uuid
season_id uuid
activity_score numeric not null
form_score numeric not null
live_ovr integer not null
pac integer not null
sho integer not null
pas integer not null
dri integer not null
def integer not null
phy integer not null
rarity_tier text not null
last_week_start date nullable
last_rebuilt_at timestamptz
primary key(player_id, season_id)
```

This table is derived state.

It may be deleted/rebuilt from history.

---

## 65. `rating_snapshots`

Useful for trends and "biggest riser" UX.

Create one snapshot per Player per meaningful recalculation/week.

```text
id uuid PK
player_id uuid
season_id uuid
week_start date
activity_score numeric
form_score numeric
live_ovr integer
pac integer
sho integer
pas integer
dri integer
def integer
phy integer
rarity_tier text
created_at timestamptz
unique(player_id, season_id, week_start)
```

If implementation complexity becomes high, snapshots may be Phase 1.5, but the schema should be planned.

---

## 66. `card_editions`

```text
id uuid PK
player_id uuid references players
edition_type text not null
title text not null
is_live boolean not null default false

snapshot_ovr integer nullable
snapshot_pac integer nullable
snapshot_sho integer nullable
snapshot_pas integer nullable
snapshot_dri integer nullable
snapshot_def integer nullable
snapshot_phy integer nullable

special_discard_multiplier numeric nullable
pack_available_from timestamptz nullable
pack_available_until timestamptz nullable
max_supply integer nullable
minted_count integer not null default 0
pack_weight numeric nullable

issued_at timestamptz nullable
metadata jsonb not null default '{}'
created_at timestamptz
```

Constraint:

- at most one Live edition per Player.

For a Live edition, snapshot stats are null.

For a Special edition, snapshot stats are required.

---

## 67. `user_cards`

Individual Card Copies.

```text
id uuid PK
edition_id uuid references card_editions
owner_id uuid references profiles
source text not null
acquired_at timestamptz not null
burned_at timestamptz nullable
created_at timestamptz
```

A burned card remains in historical records but is not owned/usable.

Optional future:

```text
serial_number integer
```

---

## 68. `wallets`

```text
user_id uuid PK references profiles
balance bigint not null default 0 check balance >= 0
updated_at timestamptz
```

Use integer/bigint.

---

## 69. `wallet_ledger`

Immutable ledger.

```text
id uuid PK
user_id uuid references profiles
amount bigint not null
reason text not null
reference_type text nullable
reference_id uuid nullable
idempotency_key text nullable
created_at timestamptz
```

Recommended uniqueness:

```text
unique(user_id, idempotency_key)
```

where idempotency key is not null.

Never update/delete ordinary ledger entries.

Administrative correction uses an additional compensating entry.

---

## 70. `market_listings`

```text
id uuid PK
card_id uuid references user_cards
seller_id uuid references profiles
price bigint not null check price > 0
status text not null
created_at timestamptz
expires_at timestamptz
sold_at timestamptz nullable
buyer_id uuid nullable references profiles
```

Prevent more than one active listing per Card Copy.

Use partial unique index if convenient:

```text
unique(card_id) where status = 'active'
```

---

## 71. `market_sales`

Immutable completed sale history.

```text
id uuid PK
listing_id uuid unique references market_listings
card_id uuid
edition_id uuid
seller_id uuid
buyer_id uuid
sale_price bigint
tax_amount bigint
seller_receipt bigint
sold_at timestamptz
```

Keep edition ID denormalized for easy price-history queries.

---

## 72. `pack_types`

Even with one MVP pack, store configuration in data/code rather than scattering literals.

```text
id uuid PK
slug text unique
name text
price bigint
card_count integer
is_active boolean
special_chance numeric
configuration jsonb
```

Global tuning values can alternatively live in version-controlled TypeScript configuration.

Prefer version-controlled constants for core formulas in MVP and database rows for user-facing pack activation.

---

## 73. `pack_openings`

```text
id uuid PK
user_id uuid
pack_type_id uuid
price_paid bigint
idempotency_key text unique
opened_at timestamptz
```

---

## 74. `pack_opening_cards`

```text
pack_opening_id uuid
card_id uuid
slot_number integer
primary key(pack_opening_id, slot_number)
unique(card_id)
```

---

## 75. `invitations`

```text
id uuid PK
player_id uuid unique nullable
token_hash text unique not null
created_by uuid
expires_at timestamptz nullable
claimed_by uuid nullable
claimed_at timestamptz nullable
revoked_at timestamptz nullable
created_at timestamptz
```

Never store plaintext invite token after initial generation.

---

## 76. `attendance_rewards`

Idempotency/support table.

```text
session_id uuid
player_id uuid
user_id uuid
ledger_id uuid
created_at timestamptz
primary key(session_id, player_id)
```

---

## 77. Useful indexes

At minimum:

```text
attendance(session_id)
attendance(player_id)
match_sessions(season_id, session_date)
user_cards(owner_id) where burned_at is null
user_cards(edition_id)
market_listings(status, expires_at)
market_listings(status, price)
market_sales(edition_id, sold_at)
wallet_ledger(user_id, created_at desc)
card_editions(player_id)
rating_snapshots(player_id, week_start desc)
```

Measure before adding exotic indexes.

---

# PART XXII — DATABASE SECURITY / RLS

## 78. RLS principle

Enable Row Level Security on every exposed table in the public schema.

Never rely on "the UI does not show the button" as authorization.

### 78.1 Normal users

May read:

- active Players;
- current player states;
- card editions;
- their own Card Copies;
- active market listings;
- public market sale history;
- public leaderboard/profile display fields;
- their own wallet;
- their own ledger;
- their own pack openings.

May directly update only narrowly permitted own-profile fields.

### 78.2 Admins

May additionally manage:

- Players;
- sessions;
- attendance;
- invitations.

### 78.3 Economy mutations

Users should **not** receive broad direct write policies for:

- wallets;
- wallet ledger;
- card ownership;
- market-sale completion;
- pack-result creation.

These are performed through tightly validated database/server functions.

### 78.4 Service role

Never expose Supabase service-role key to browser code.

Only server-side trusted environment may access it.

Prefer RLS-aware user-context operations and narrowly scoped SECURITY DEFINER functions over broad service-role usage.

---

# PART XXIII — SERVER OPERATIONS / RPC CONTRACTS

## 79. Core operation: `claim_starter_pack`

Inputs:

- authenticated user;
- optional idempotency key.

Preconditions:

- invitation/account is valid;
- starter not already claimed.

Atomically:

- set starter claimed;
- grant +250 ledger/balance;
- choose 3 distinct eligible Live editions;
- mint 3 Card Copies;
- return cards.

Postcondition:

Calling again returns already-claimed result/error and creates nothing new.

---

## 80. `open_pack(pack_slug, idempotency_key)`

Atomically:

- verify active pack;
- get server price;
- verify wallet;
- debit;
- choose results server-side;
- mint copies;
- record opening;
- return result.

No result may exist without the matching payment.

No payment may occur without either a successful opening or full transaction rollback.

---

## 81. `discard_card(card_id, idempotency_key)`

Atomically:

- card belongs to caller;
- card not burned;
- card has a resolvable rating;
- no active listing;
- calculate current server discard value;
- mark burned;
- credit wallet;
- ledger record;
- return amount.

---

## 82. `create_listing(card_id, price)`

Validate:

- ownership;
- tradeability;
- no active listing;
- price within current server bounds;
- user not disabled.

Create an active listing running 24 or 72 hours, at the seller's choice (ADR-072).

---

## 83. `cancel_listing(listing_id)`

Validate seller ownership and active state.

Mark cancelled.

No ownership transfer required because seller retained ownership.

---

## 84. `buy_listing(listing_id, idempotency_key)`

Implement transaction described in section 35.

This operation must use row locking / equivalent atomic database behavior.

---

## 85. `publish_session(session_id)`

Admin-only.

Atomically / reliably:

1. set session published;
2. run deterministic season rebuild;
3. grant attendance rewards idempotently;
4. create/update relevant rating snapshots;
5. return summary of changed players.

If step 2 fails, session should not appear as successfully processed.

If implementation separates the rebuild from publication, use an explicit processing state and robust retry; the simpler transaction-oriented design is preferred.

---

## 86. `rebuild_season(season_id)`

Admin/superadmin only.

Deterministically recompute all Player Season State rows from historical published sessions.

This operation must be safe to run repeatedly.

Identical input history + identical configuration = identical result.

---

# PART XXIV — RATING ENGINE IMPLEMENTATION

## 87. Pure TypeScript reference engine

Create one pure module, e.g.:

`src/game/rating-engine.ts`

It should expose functions such as:

```ts
calculateActivityScore(...)
calculateActivityOvr(...)
calculateWeeklyPerformance(...)
calculateFormScore(...)
calculateLiveOvr(...)
calculateAttributes(...)
getRarityTier(...)
calculateLiveDiscardValue(...)
```

No database calls inside these pure functions.

This makes them easy to test.

The database rebuild may:

- call equivalent SQL functions;
- or run through trusted server code.

Do not maintain two subtly different formulas.

If SQL mirrors TypeScript, create parity tests using shared fixtures.

---

## 88. Canonical fixtures

Create `tests/fixtures/rating-scenarios.json`.

Include scenarios such as:

- never attends;
- attends first week;
- weekly regular for 20 weeks;
- twice-weekly regular for 20 weeks;
- every-other-week player;
- regular stops for 4 football weeks;
- player scores hat trick;
- player scores repeatedly;
- cancelled week;
- week with no session;
- two sessions same week;
- correction to old attendance.

Snapshot expected outputs.

Any intentional formula change must update fixtures visibly.

---

# PART XXV — AUTHENTICATION

## 89. MVP authentication

Use Supabase Auth with email/password.

Onboarding remains protected by one-time invite token.

Because invitation itself proves membership, email verification can be deferred while the app remains private and the built-in mail provider is insufficient for a group launch.

Requirements:

- password minimum sensible length;
- generic auth errors where appropriate;
- session cookies handled using current Supabase Next.js SSR guidance;
- no auth secrets in localStorage beyond normal Supabase client behavior;
- disabled account is blocked at application authorization layer.

### 89.1 Password recovery

MVP choices, in priority order:

1. configure a free/low-volume custom SMTP provider before launch;
2. if not configured, admin-assisted reset/re-invite procedure.

Document whichever path is actually enabled in `README.md`.

Do not pretend password reset works if SMTP was never configured.

**Resolved (2026-09-02, ADR-050): path 2.** Custom SMTP is deliberately not
configured for the wide TFH launch, so password recovery is **admin-assisted**
(ADR-011) and the audited `/admin/accounts` flow — `create_password_reset_event`
then `complete_password_reset_event` — is the only route. Nothing in onboarding
depends on email; invites are player-bound token links delivered by WhatsApp DM,
so this costs support load, not capability. Revisit if the
manual load becomes tiresome; the DNS verification lead time is the reason to
start it well ahead rather than on a launch night.

---

# PART XXVI — STORAGE

## 90. Player photos

> **Implemented (2026-08-29, ADR-027):** the `player-photos` bucket is
> private with folder-scoped `storage.objects` RLS. Upload is
> **member self-service** (a member edits only their own linked player's
> photo from `/settings/card`, square-cropped client-side), not admin-only.
> Access is via short-lived server-minted signed URLs. Path is
> `players/<player-uuid>/profile.webp` as below. Fallback is the CSS
> initials/jersey treatment in `LiveCard`.

Supabase Storage bucket:

`player-photos`

Recommended:

- private;
- authenticated signed access;
- admin upload in MVP;
- unique object path by Player ID;
- resized/compressed before or during upload.

Example path:

```text
players/<player-uuid>/profile.webp
```

Do not use raw email addresses in object paths.

Fallback image:

- original TFH silhouette/avatar;
- no third-party copyrighted footballer silhouette.

---

# PART XXVII — FREE-TIER CONSTRAINTS

## 91. Expected scale

This project is tiny by SaaS standards:

- ~200 Players;
- likely <200 Users;
- tens of active Users;
- ~1–2 football sessions/week;
- low thousands of Card Copies initially;
- perhaps tens of thousands after prolonged use.

A single Postgres database is more than adequate.

---

## 92. Supabase considerations

As of the date of this specification, Supabase's Free Plan documentation describes limited database/storage capacity and potential automatic pausing for low activity.

Design accordingly:

- keep photos compressed;
- do not store duplicate generated card images;
- card visuals should be rendered from data + CSS;
- keep migrations in git;
- maintain seed data;
- periodically export/backup important group data;
- understand that an inactive free project may need to be restored/unpaused.

Supabase's built-in auth email sender is not suitable for a mass launch without custom SMTP due to tight rate limits.

Official references:

- Pricing: https://supabase.com/pricing
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Local workflow: https://supabase.com/docs/guides/local-development/cli-workflows
- Database testing: https://supabase.com/docs/guides/database/testing
- Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Project pausing: https://supabase.com/docs/guides/platform/free-project-pausing

---

## 93. Vercel considerations

Vercel Hobby is suitable for the expected traffic of a private non-commercial game, subject to its current terms and usage limits.

Avoid architecture that depends on:

- long-running workers;
- a Vercel WebSocket server;
- high-frequency cron.

MVP requires no cron.

If a periodic job is added later, a once-daily job is enough for:

- cached leaderboard refresh;
- stale listing cleanup;
- notifications.

Official references:

- Hobby plan: https://vercel.com/docs/plans/hobby
- Limits: https://vercel.com/docs/limits
- Cron pricing/limits: https://vercel.com/docs/cron-jobs/usage-and-pricing

---

# PART XXVIII — MARKET / REALTIME STRATEGY

## 94. Do not require realtime for MVP

The market can feel responsive without live sockets.

Refresh:

- after listing;
- after buying;
- after cancelling;
- on returning to market page;
- optionally via user-initiated pull/refresh.

Later, Supabase Realtime can add live sale/listing updates.

Do not create a custom WebSocket service.

---

# PART XXIX — OBSERVABILITY

## 95. Application errors

At minimum:

- structured server logs;
- user-safe error messages;
- unique request/action IDs for economy operations;
- log failed economy RPC name and non-sensitive context.

Later, optional:

- Sentry or equivalent free tier.

Do not log:

- passwords;
- auth tokens;
- invite plaintext tokens;
- service-role key.

---

## 96. Auditability

Important admin/economy actions should be reconstructable from durable tables:

- wallet ledger;
- market sales;
- pack openings;
- match sessions;
- attendance;
- invitations.

An admin "fix" should normally create a correcting record rather than deleting economic history.

---

# PART XXX — AUTOMATED TESTING STRATEGY

## 97. Testing philosophy

The project is expected to be built through AI-assisted coding sessions.

Therefore tests are not optional polish.

They are the main defense against an agent accidentally breaking:

- currency;
- ownership;
- ratings;
- RLS;
- marketplace atomicity.

The project should have one obvious verification command.

---

## 98. Required npm scripts

Recommended:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:db": "supabase test db",
    "verify:fast": "npm run lint && npm run typecheck && npm run test",
    "verify:full": "npm run verify:fast && npm run test:db && npm run test:e2e && npm run build"
  }
}
```

Exact CLI command may be adjusted to current package versions.

`npm run verify:fast` should run after ordinary coding changes.

`npm run verify:full` must pass before completing a phase.

---

## 99. Unit tests — Vitest

Mandatory high-coverage modules:

### Rating engine

Test:

- bounds;
- progression;
- decay;
- no-game week;
- two-game week;
- form decay;
- goal bonus;
- rating cap;
- all archetypes;
- stat cap 1–99;
- rarity boundaries.

### Economy

Test:

- discard formula;
- discard monotonicity;
- tax rounding;
- listing bounds;
- reference-value fallback;
- median calculation;
- pack weighting;
- expected pack discard calculation.

### Invariants

Randomized/property-like tests:

- increasing Activity Score never decreases activity OVR;
- higher OVR never lowers Live discard;
- Live OVR never <30 or >83;
- attribute never <1 or >99;
- wallet calculations stay integer;
- pack candidate weights are positive;
- disabled/non-collectible Player never enters pack pool.

Core pure game logic target:

- effectively complete branch coverage.

Do not chase 100% coverage for cosmetic React components.

---

## 100. Database tests — Supabase CLI / pgTAP

Mandatory:

### RLS

Anonymous user:

- cannot read private game data.

Normal authenticated user:

- can read public-in-game roster/market;
- can read own wallet;
- cannot read another user's private ledger;
- cannot directly change wallet;
- cannot directly transfer card;
- cannot edit attendance;
- cannot create Special edition.

Admin:

- can create/edit session;
- can edit attendance.

### Constraints

- one attendance row per session/player;
- one active listing per card;
- one starter claim;
- wallet cannot go below zero;
- one user linked to at most one real Player;
- one claimed invite only once.

### RPC integrity

- discard cannot run twice;
- listing cannot sell twice;
- starter cannot mint twice;
- pack idempotency works.

---

## 101. Integration tests

Run against local Supabase.

Required flows:

1. create user from invite;
2. claim starter;
3. validate 250 balance and 3 starter cards;
4. publish attendance;
5. validate linked user attendance reward;
6. validate rating changes;
7. open pack;
8. validate exact wallet debit and Card Copies;
9. discard;
10. validate burn + credit;
11. list card;
12. buy from second user;
13. validate tax, balances, ownership, sale history;
14. repeat purchase request and verify no duplicate action.

---

## 102. Concurrency test

This test is critical.

Setup:

- Seller lists one card.
- Buyer A and Buyer B both have sufficient funds.
- Both purchase requests execute near-simultaneously.

Assert:

- exactly one succeeds;
- one fails cleanly;
- Card Copy has exactly one owner;
- Seller credited exactly once;
- tax recorded exactly once;
- listing has exactly one sale;
- no wallet negative.

---

## 103. End-to-end tests — Playwright

Core browser flows:

### Desktop

- login;
- starter pack;
- collection;
- open pack;
- list card;
- second user buys;
- leaderboard changes.

### Admin

- create session;
- select attendees;
- enter goals;
- publish;
- see card upgrade.

### Mobile

At least:

- modern iPhone-like viewport;
- common Android-like viewport.

Validate:

- bottom nav;
- card grid;
- pack opening;
- market buy;
- admin attendance selection;
- no horizontal overflow.

Playwright supports Chromium, Firefox, and WebKit; use Chromium for every CI run and run wider browser coverage periodically if CI time permits.

---

## 104. Visual regression

Phase 1.5:

Add targeted screenshot tests for:

- Common card;
- Bronze;
- Silver;
- Gold;
- Holo;
- Elite;
- pack reveal;
- mobile collection;
- mobile admin attendance.

Do not make the whole application screenshot-test dependent; dynamic content makes brittle tests.

---

## 105. Test data

Never use real TFH members in automated tests.

Use obvious fictional fixtures, e.g.:

- Alex Example;
- Bea Test;
- Charlie Fixture;
- Dana Demo.

Provide deterministic seeded accounts:

- normal user A;
- normal user B;
- admin.

Never put production passwords or Supabase production keys in fixtures.

---

# PART XXXI — CI / AI-CODING WORKFLOW

## 106. Repository structure

Recommended:

```text
/
  app/
  components/
  src/
    game/
    lib/
    server/
  supabase/
    migrations/
    seed.sql
    tests/
  tests/
    unit/
    integration/
    e2e/
    fixtures/
  docs/
    BUILD_SPEC.md
    DECISIONS.md
    PROGRESS.md
    ECONOMY.md
  public/
  README.md
  package.json
```

This specification should be saved as:

`docs/BUILD_SPEC.md`

---

## 107. `docs/PROGRESS.md`

This file is specifically for multi-session coding.

Every coding session should update:

```text
# Current phase
# Completed
# In progress
# Tests currently passing
# Known failures
# Next recommended task
# Manual setup still required
# Database migrations added
# Environment variables added
```

An agent beginning a new session must read:

1. `docs/BUILD_SPEC.md`
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md`
4. relevant recent git diff/history

before changing code.

---

## 108. `docs/DECISIONS.md`

Record decisions that affect architecture/game behavior.

Format:

```text
## ADR-001 — Invite-only onboarding
Date:
Status:
Decision:
Reason:
Consequences:
```

Examples:

- auth method;
- changed pack price;
- changed rating decay;
- added SMTP provider;
- changed domain;
- season reset rule.

---

## 109. Agent coding rules

Place these rules in `CLAUDE.md` and/or `AGENTS.md` as appropriate:

1. Never change economy formulas without updating unit fixtures and documentation.
2. Never use client-authoritative currency or card ownership.
3. Never bypass failing tests to finish a feature.
4. Every database schema change requires a migration.
5. Do not make production-only manual schema changes in Supabase Dashboard without capturing them in migrations.
6. Run `npm run verify:fast` before declaring an implementation task complete.
7. Run `npm run verify:full` before declaring a phase complete.
8. Update `docs/PROGRESS.md` at the end of each coding session.
9. Never expose service-role keys.
10. Use fake data in tests.
11. Prefer simple code over framework cleverness.
12. Do not add new dependencies unless their benefit is clear.
13. Preserve mobile usability.
14. Preserve deterministic game calculations.

---

# PART XXXII — DEVELOPMENT ENVIRONMENTS

## 110. Local environment

Use Supabase CLI locally.

Repository should contain:

- migrations;
- seed;
- config;
- database tests.

A new coding session on another machine should be able to reproduce the project from git plus environment variables.

Do not make production Supabase the only place where schema knowledge exists.

---

## 111. Production

Production:

- Vercel deployment;
- one Supabase hosted project;
- Vercel environment variables;
- production domain.

At this scale, a permanent paid staging Supabase project is unnecessary.

Use:

- local Supabase for development/tests;
- Vercel preview deployments where possible;
- production only after tests pass.

Be careful: Vercel Preview deployments should not automatically perform destructive production database migrations.

---

# PART XXXIII — ENVIRONMENT VARIABLES

## 112. Expected variables

Names can follow current Supabase Next.js conventions.

Likely:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_URL
INVITE_TOKEN_SECRET or equivalent if needed
```

If custom SMTP is configured, configure through Supabase rather than exposing credentials to browser code.

Keep:

`.env.example`

with names and descriptions but no secrets.

---

# PART XXXIV — PHASED DELIVERY

## 113. Phase 0 — Foundation

Goal: reproducible project, no game yet.

Build:

- git repository;
- Next.js TypeScript app;
- Tailwind;
- Supabase local configuration;
- initial production Supabase project;
- Vercel project;
- domain or preview URL;
- lint/typecheck;
- Vitest;
- Playwright;
- Supabase DB tests;
- CI;
- docs structure.

### Acceptance criteria

- fresh clone can run locally from documented steps;
- `npm run verify:fast` passes;
- one Playwright smoke test passes;
- one database test passes;
- Vercel preview deploy works;
- no secrets committed.

---

## 114. Phase 1A — Roster, auth, admin attendance

Build:

- Players;
- seasons;
- profiles;
- invite onboarding;
- email/password login;
- admin role;
- player photos;
- match sessions;
- attendance;
- goals;
- publish;
- deterministic rating rebuild;
- player directory;
- Live Card component;
- rarity visuals.

### Acceptance criteria

- admin can add/import Players;
- admin can create an invite;
- invited User can create account;
- admin can record 20 attendees comfortably on a phone;
- publish changes Player ratings exactly as fixtures predict;
- re-running rebuild does not change result;
- editing an old attendance record and rebuilding produces correct current state;
- no-game week does not decay;
- unauthorized user cannot edit attendance;
- mobile E2E flow passes.

At this point the project is already a useful "live TFH ratings" site.

---

## 115. Phase 1B — Collections and starter pack

Build:

- Live card editions;
- Card Copies;
- wallets;
- ledger;
- starter grant;
- collection page;
- card detail;
- Club Value fallback from discard/reference;
- attendance coins.

### Acceptance criteria

- first User gets exactly 250 coins once;
- first User gets exactly 3 distinct starter cards once;
- starter endpoint is idempotent;
- card copies belong to one owner;
- users cannot inspect private wallet ledgers of others;
- attendance reward runs once only.

---

## 116. Phase 1C — Packs and discard

Build:

- TFH Pack;
- weighted Live draw;
- atomic opening;
- pack animation;
- discard;
- economy calculation;
- admin economy readout.

### Acceptance criteria

- pack results are persisted before animation;
- refresh does not reroll;
- insufficient balance fails without card creation;
- discard cannot occur twice;
- expected pack-discard calculation is shown to admin;
- simulation tests pass;
- pack UI works on mobile.

This is the first version suitable for a small closed playtest without a market.

---

## 117. Phase 1D — Marketplace and leaderboard — MVP COMPLETE

Build:

- list;
- cancel;
- browse;
- filters;
- buy;
- tax;
- market history;
- Reference Value;
- Club Value leaderboard;
- transaction UI;
- concurrency test.

### Acceptance criteria

- card cannot be simultaneously listed twice;
- two buyers cannot both buy one card;
- seller/buyer balances reconcile with ledger;
- 5% tax burns correct integer amount;
- club-value calculation follows spec;
- mobile market works;
- full test suite passes.

### MVP launch definition

The product is considered MVP-complete only after Phase 1D.

---

## 118. Phase 1.5 — Polish

Potential:

- PWA manifest;
- card upgrade animations;
- price trend;
- rating history;
- Matchday Update page;
- player self-service photo;
- better onboarding;
- custom SMTP;
- password recovery;
- visual regression tests;
- lightweight analytics.

Do not block MVP on these unless onboarding/auth requires SMTP.

---

## 119. Phase 2 — Special collectibles

Build:

- Special editions;
- Team of the Week;
- Hat-Trick Hero;
- pack availability windows;
- optional supply cap;
- special artwork;
- own-special grant;
- ~~Collection Album~~ — delivered early, 2026-09-02 (§41, ADR-048);
- milestones;
- season history.

### Acceptance criteria

- Special stats never change when Live Player changes;
- maximum supply cannot be exceeded under concurrency;
- expired Special is no longer packable;
- Special edition price/discard logic uses frozen stats;
- historical Special pages show issue context.

---

## 120. Phase 3 — Squads

Build Midweek Madness (§44), which replaced Friday Five (ADR-088):

- the pure engine and simulation harness first, with the owner's tuning
  sign-off before any schema work;
- squad entry, the archetype cooldown, the engine and worker, the payout,
  then the entry and results pages;
- one migration or invariant per PR (ADR-070).

The original gate, "do not implement until market/collection usage proves
sustained", was the owner's call to make; ADR-089 records the decision to build.

---

## 121. Phase 4 — Community systems

Potential:

- post-match awards;
- voting;
- challenges / SBC-like card sinks;
- achievements;
- notifications;
- friend activity;
- ~~trading offers~~ — **shipped 2026-08-31, ADR-042** (see §39a);
- auctions;
- card wishlists;
- watched prices.

Each feature needs an economy/abuse review before implementation.

---

# PART XXXV — CHALLENGES / CARD SINKS — FUTURE

## 122. Collection challenges

A future challenge can require users to permanently submit/burn cards.

Example:

### Friday Night Challenge

Submit:

- 5 different Players;
- combined OVR >= 270;
- at least two Players who attended a Friday in current season.

Reward:

- one premium pack.

The submitted cards are destroyed.

This provides a useful Card Copy sink and gives low/mid-tier duplicates value.

Do not implement challenges before observing the actual duplicate economy.

---

# PART XXXVI — SEASONS

## 123. MVP season behavior

Create Season 1 manually.

Do not automatically reset while testing/launching.

---

## 124. Future season transition

Collections and Special Cards must persist.

Recommended Live Activity soft reset:

```text
new_activity_score =
  max(10, previous_activity_score * 0.45)
```

Recommended:

```text
new_form_score = 0
```

This prevents long-term veterans from beginning permanently maxed while preserving some continuity.

A season transition must be an explicit admin operation with preview.

Never run it automatically on an assumed date.

---

# PART XXXVII — ADMIN ECONOMY DASHBOARD

## 125. MVP metrics

Admin should be able to see:

- total Users;
- active Users last 30 days if available;
- total KUT Coins in wallets;
- coins created from starter;
- coins created from attendance;
- coins created from discard;
- coins destroyed by packs;
- coins destroyed by market tax;
- total Card Copies;
- total burned;
- cards minted from packs;
- average current OVR;
- rarity distribution;
- expected discard per basic pack;
- expected discard return ratio;
- average market sale;
- sales last 7 days.

This does not need a sophisticated BI system.

Simple queries/cards are enough.

> **Note (ADR-035):** the per-reason coin bullets above are spec'd but not yet
> built — `kut.pack_economy_health` reports `total_coin_supply` only. When a
> per-reason breakdown is built it must include the three admin ledger reasons
> `admin_grant` (audited faucet), `admin_reset` (the reset's wallet zero +
> starter re-grant), and `admin_self_grant` (ADR-052, the superadmin
> self-grant); today all three flow into the supply total automatically.

---

## 126. Economy warning signs

Watch for:

### Inflation

- total wallet coins continually rises;
- pack purchases become trivial;
- listing prices continually increase.

Potential response:

- increase pack price;
- increase tax slightly;
- add challenge sinks;
- reduce attendance coin reward.

### Deflation / poverty

- users cannot afford packs;
- market has no buyers;
- users hoard and never transact.

Potential response:

- lower pack price;
- attendance bonus;
- weekly objectives;
- slightly increase discard.

### Duplicate glut

- collections fill with unwanted low cards;
- market listings are saturated at minimum price.

Potential response:

- Collection Album rewards;
- challenges;
- low-card crafting/exchange.

Do not react after one weird week. Use several weeks of data.

---

# PART XXXVIII — EDGE CASES

## 127. Player leaves TFH

Set:

`players.is_active = false`

Decide separately:

- existing Card Copies remain;
- player removed from Live pack pool;
- historical cards remain;
- existing Live cards may retain final state or continue decaying only if season rebuild includes later football weeks.

Recommended:

Existing Live cards continue to follow the player's Activity decay through the season, but inactive Player is no longer packable.

---

## 128. Player returns

Set active true.

Same Player identity resumes.

Do not create a duplicate Player row.

Comeback Special can later celebrate this.

---

## 129. Duplicate names

Player ID is authoritative.

Slug/display can disambiguate.

Never use display name as database identity.

---

## 130. Attendance entered late

Rebuild season from history.

Result should be identical to having entered it on time, except economic attendance reward timestamps.

---

## 131. Attendance corrected after market transactions

Recalculate Live stats normally.

Do not retroactively reverse completed market prices.

Markets involve risk; buyers traded based on available information at the time.

Attendance coin correction policy for MVP:

- newly added attendee after publish can receive missing reward;
- removal of mistakenly marked attendance does not automatically create negative wallet;
- admin may create a documented manual correction if abuse/material error occurred.

Keep this simple.

---

## 132. Pack opened while Player tier changes

The server evaluates pack candidates within the transaction/request using the state current at open time.

Recorded Card Copy is valid even if Player stats change seconds later.

Because it is a Live Card, it will then display the new Live state.

---

## 133. Listed Live card changes value

The listing price remains the seller's chosen fixed amount until:

- sold;
- cancelled;
- expired.

Do not auto-change listing price when OVR/discard changes.

If current discard increases above listing price, that creates a legitimate market opportunity.

---

## 134. User account disabled

- cannot sign in/use economy operations;
- collection is preserved;
- listings should be cancelled by admin or excluded from market;
- history remains.

---

# PART XXXIX — PERFORMANCE

## 135. Scale assumptions

Optimize for simplicity first.

Likely expensive views:

- collection with card/player/state join;
- market listings;
- leaderboard;
- sale history.

Use:

- pagination;
- database indexes;
- server-side filtering.

Do not prematurely build caching infrastructure.

---

## 136. Images

Images are likely a bigger bandwidth/storage concern than database rows.

Use:

- responsive image sizes;
- modern image format;
- lazy loading in grids;
- small thumbnails;
- no giant original images rendered in 150px cards.

---

# PART XL — MANUAL ADMIN IMPORT

## 137. Initial roster import

Support CSV import or provide a one-off script.

Suggested CSV:

```csv
display_name,full_name,archetype,is_active
Bas,Bas Example,finisher,true
Richard,Richard Example,playmaker,true
```

Photo paths can be added manually later.

Import must:

- validate rows;
- show errors;
- avoid duplicate slugs;
- not create duplicate players on re-run.

For a one-time initial setup, a migration/seed script is acceptable instead of building a polished import UI.

**Update (2026-08-29, ADR-025):** incremental additions now have a UI —
`/admin/roster` calls the server-authoritative `kut.admin_add_player` RPC,
which inserts the player, mints their Live edition, and runs the canonical
rebuild in one transaction. Bulk backfill (a whole historical roster or
attendance sheet at once) stays a migration. This partly delivers the
"player directory" / roster-management item of Phase 1A (Part 114): admins
can now add Players from the app, and (ADR-026) deactivate/reactivate or —
for a never-used entry — hard-delete them. A read-only member-facing
`/players` directory and rename / archetype / photo editing remain to build.

**Update (2026-09-02, ADR-050):** the initial imports applied a "2+ appearances
before a Player row" bar, to keep one-off guests out of the roster. That was an
*import* policy for backfilled historical attendance sheets, and it stays that.
It does **not** apply to people joining KUT: anyone invited gets a Player row at
the 30 OVR / common baseline via `kut.admin_add_player`, so their own card is in
their album from day one. Joiners are **not** backfilled into past published
sessions — a correction that adds them also back-pays the per-session attendance
reward, which would be an unplanned faucet against the Part L invariants. They
accrue from the next published session.

---

# PART XLI — DESIGN SYSTEM

## 138. Visual personality

Desired:

- playful;
- football-card-inspired;
- premium enough that shiny pulls feel exciting;
- not an imitation of EA UI;
- suitable for a group whose name is "Terrible Football Haarlem."

It should be allowed to be slightly self-aware and funny.

Possible tone:

- "Terrible Pack"
- "Club Value"
- "In Form"
- "Market"
- "Holo"
- "Matchday Update"

Avoid overly corporate copy.

---

## 139. Card visual architecture

Implement card frame from layers:

1. tier background/frame;
2. subtle texture;
3. Player photo;
4. OVR/name/stat typography;
5. tier/special badge;
6. optional CSS shine;
7. optional trend indicator.

This allows every Card Copy to render without storing a pre-generated image file.

For social sharing later, a server-generated static card image can be added separately.

---

# PART XLII — NOTIFICATIONS — FUTURE

## 140. Good notification candidates

Later, if custom email/push infrastructure exists:

- "Your Bas upgraded Silver → Gold."
- "Your market listing sold."
- "A Player on your squad scored."
- "New Team of the Week is live."
- "You were outbid" only if auctions are later added.

Do not send spammy pack reminders.

No notification system is required for MVP.

---

# PART XLIII — ANALYTICS — OPTIONAL

## 141. Product analytics

Useful events:

- login;
- pack_opened;
- market_listing_created;
- market_purchase;
- card_discarded;
- collection_viewed;
- leaderboard_viewed.

For the initial private game, database events may provide enough insight.

Do not add invasive analytics by default.

---

# PART XLIV — BACKUPS AND RECOVERY

## 142. Important data

Critical:

- Players;
- attendance/session history;
- users/profile linkage;
- Card Copies;
- wallet ledger;
- market sales;
- Special Card editions.

Because the project is on free infrastructure:

- keep schema/migrations in git;
- keep non-private seed/config in git;
- periodically export database;
- separately preserve player-photo assets if they matter.

A full database can be reconstructed technically, but historical ownership/economy cannot be reconstructed from code alone.

---

# PART XLV — DEFINITION OF DONE

## 143. Feature-level definition of done

A feature is not done until:

- implementation exists;
- mobile UI is usable;
- validation exists;
- authorization exists;
- relevant unit/integration tests exist;
- relevant tests pass;
- no TypeScript errors;
- no lint errors;
- database migration committed if schema changed;
- `docs/PROGRESS.md` updated;
- manual setup documented.

---

## 144. MVP definition of done

MVP is launchable when:

- invite-only login works;
- roster/photos work;
- admin attendance is easy on mobile;
- ratings rebuild deterministically;
- Live Card visuals update;
- users receive starter pack;
- wallet/ledger work;
- attendance gives coins;
- packs work;
- discard works;
- market works atomically;
- Club Value leaderboard works;
- security/RLS tests pass;
- concurrency purchase test passes;
- mobile Playwright tests pass;
- production deploy works;
- backup procedure documented.

---

# PART XLVI — INITIAL CONFIGURATION

## 145. Canonical defaults

Put these in one version-controlled configuration module.

```text
ACTIVITY_WEEKLY_DECAY = 0.90
ACTIVITY_FIRST_APPEARANCE = 14
ACTIVITY_SECOND_APPEARANCE = 3

ACTIVITY_OVR_FLOOR = 30
ACTIVITY_OVR_RANGE = 45
ACTIVITY_OVR_EXPONENT = 0.80

FORM_WEEKLY_DECAY = 0.55
FORM_GOAL_POINTS = 1.25
FORM_HAT_TRICK_BONUS = 1.0
FORM_GOAL_CAP = 4
FORM_CAP = 8

LIVE_OVR_MIN = 30
LIVE_OVR_MAX = 83

ATTENDANCE_COIN_REWARD = 250  # raised from 75 on 2026-08-29, ADR-029
BIBS_COIN_BONUS = 100  # one-off, for the session's bibs bringer, ADR-037 (copy fixed ADR-044)
INJURY_WEEKLY_STIPEND = 100  # per rehab check-in, at most once per Player and football week, ADR-082
INJURY_COMEBACK_MIN_WEEKS = 3  # protected weeks before a return earns comeback Form, ADR-083
INJURY_COMEBACK_FORM_PER_WEEK = 0.25  # ADR-083
INJURY_COMEBACK_FORM_CAP = 2  # one comeback input never exceeds this; the Form cap of 8 still applies, ADR-083
ARCHETYPE_CHANGE_COOLDOWN_DAYS = 14  # self-service changes only, as 336 elapsed hours, ADR-089, ADR-094
GOALS_ASSISTS_CUTOVER = 2026-09-28  # first football week whose reported count is goals + assists combined; wording only, ADR-101 (src/game/reported-count.ts, kut._uses_combined_count)
STARTER_COIN_GRANT = 250
STARTER_CARD_COUNT = 3

# Midweek Madness, §44 (ADR-089). Tuned values, signed off 2026-09-25 (ADR-092);
# the code is src/game/midweek/config.ts.
MIDWEEK_CHAMPION_TOTAL = 250  # a champion's total over all rounds; its own constant (ECONOMY.midweekChampionTotal, ADR-096)
MIDWEEK_SQUAD_SIZE = 5
MIDWEEK_LOCK = Wednesday 19:55 Europe/Amsterdam  # schedule version 2 (ADR-104); version 1 was 20:00
MIDWEEK_ROUND_OFFSET_MINUTES = 5  # round 1 starts 5 minutes after the lock; version 1: 30
MIDWEEK_ROUND_INTERVAL_MINUTES = 15  # between round starts; version 1: 30
MIDWEEK_SLOT_SECONDS = 20  # per chance slot: a match's 14 slots take 4:40; version 1: 0 (whole matches)
MIDWEEK_KICK_SECONDS = 5  # per shoot-out kick or settling draw after full time; version 1: 0
MIDWEEK_MIN_ENTRANTS = 4
MIDWEEK_OWNER_COUNT_MIN = 3  # owner counts below this are never shown, ADR-091
MIDWEEK_OVR_FACTOR_MAX = 1.10  # 1.00 at OVR 30; started at 1.35
MIDWEEK_FORM_ROLL = 0.80 .. 1.25, mode 1.00  # started at 0.75 .. 1.45
MIDWEEK_PICK_FACTOR = (0, 1.25) (0.40, 1.00) (1, 0.875)  # piecewise linear in share
MIDWEEK_PICK_SHARE_SMOOTHING = +1 / +3
MIDWEEK_DAY_ROLL = ±0.12  # started at ±0.10
MIDWEEK_INJURED_FITNESS = 0.95
MIDWEEK_AUTO_FACTOR = 0.575  # started at 0.65
MIDWEEK_TRIALIST_OVR = 30
MIDWEEK_TRIALIST_FACTOR = 0.825  # new at tuning: keeps a trialist below the worst real card
MIDWEEK_SHAPE_SCALE = 0.5  # per 10 offset points
MIDWEEK_KEEPERLESS_FACTOR = 0.45  # started at 0.60
MIDWEEK_CHANCE_SLOTS = 14  # each holds a chance with probability 0.686
MIDWEEK_GOAL_BASE = 0.30  # before chance-type difficulty and finishing
MIDWEEK_WIN_CHANCE_CONTRAST = 3
MIDWEEK_SHOOTOUT_MAX_ROUNDS = 20

BASIC_PACK_PRICE = 250
BASIC_PACK_CARD_COUNT = 3
SPECIAL_SLOT_CHANCE = 0.01  # unused until Special Cards exist

MARKET_TAX_RATE = 0.05
LISTING_DURATION_HOURS = 24

PACK_WEIGHT_COMMON = 100
PACK_WEIGHT_BRONZE = 60
PACK_WEIGHT_SILVER = 30
PACK_WEIGHT_GOLD = 12
PACK_WEIGHT_HOLO = 4
PACK_WEIGHT_ELITE = 1
```

Do not duplicate these values in UI components.

UI obtains human-readable current configuration through imported shared code or server response.

---

# PART XLVII — LAUNCH APPROACH

## 146. Closed alpha

Start with approximately:

- admin;
- 5–10 trusted TFH users;
- real or partially real roster;
- one or two weeks.

Goals:

- determine whether people enjoy packs;
- test whether card values feel understandable;
- catch market bugs;
- observe whether 75 attendance coins / 250 pack price feels right;
- see whether OVR climbs feel satisfying.

Do not alter formulas in response to one user being unlucky.

---

## 147. Beta

Expand to:

- 20–40 users;
- full roster;
- real attendance;
- market.

Monitor:

- coin supply;
- number of pack opens;
- market liquidity;
- discard frequency;
- duplicate accumulation;
- return visits after matchdays.

Only after this should Special Cards launch.

Specials give the game a second "launch moment."

---

# PART XLVIII — QUESTIONS THAT CAN BE DEFERRED

None of the following blocks implementation.

They should remain configurable decisions rather than questions that stop development:

1. Final product name.
2. Exact color palette/card art.
3. Whether full surnames are visible.
4. Whether users choose archetypes themselves or admin assigns them.
   — *Answered: both. Members self-serve at `/settings/card`
   (`set_own_player_archetype`, ADR-027); admins can also set it. New joiners
   keep the `all_rounder` default and are not nudged (ADR-050). A member's
   own changes have a 14-day cooldown, because the archetype shapes a
   Midweek Madness squad (§44.2, ADR-089); `/settings/card` shows when the
   next change is allowed (ADR-094).*
5. Whether custom SMTP is configured before alpha.
   — *Answered 2026-09-02: no. Password recovery is admin-assisted; see §89.1
   and ADR-050.*
6. Whether attendance reward remains 75 after economy testing.
   — *Answered: no. Raised to **250** by ADR-029 (migration
   `20260831000000`, `v_amount constant bigint := 250`), not applied
   retroactively — past rewards keep the amount they were credited. The starter
   grant and the basic pack price are also 250.*
7. Whether Pack price remains 250 after simulation/playtest.
8. Whether a Player automatically receives a copy of their own future Special.
9. Exact season length.
10. Exact collection subgroups.
11. Final Special Card terminology.

---

# PART XLIX — RECOMMENDED FIRST IMPLEMENTATION SESSIONS

## 149. Session 1 — Project skeleton

Tasks:

- initialize repo;
- Next.js;
- Tailwind;
- test stack;
- Supabase CLI;
- docs;
- CI;
- deploy hello-world to Vercel.

Do not build cards yet.

---

## 150. Session 2 — Schema and security skeleton

Tasks:

- migrations through Players / Profiles / Seasons / Sessions / Attendance;
- seed fake data;
- RLS;
- database tests;
- admin role helper.

---

## 151. Session 3 — Rating engine

Tasks:

- pure formulas;
- fixture scenarios;
- exhaustive unit tests;
- rebuild service;
- player state table;
- rating output in simple UI.

Do not spend time on shiny graphics until formulas/tests pass.

---

## 152. Session 4 — Admin attendance

Tasks:

- session creation;
- mobile attendee picker;
- goals;
- publish;
- rebuild;
- E2E admin test.

At the end, manually run a fake Friday and verify cards move.

---

## 153. Session 5 — Card visual system

Tasks:

- reusable card;
- six rarity tiers;
- photo fallback;
- responsive collection-ready component;
- reduced motion.

---

## 154. Session 6 — Invite/auth/onboarding

Tasks:

- invite generation;
- secure claim;
- email/password account;
- profile-player link;
- auth E2E.

---

## 155. Session 7 — Wallet, starter, attendance reward

Tasks:

- wallet;
- immutable ledger;
- starter grant;
- Live editions;
- Card Copies;
- attendance reward;
- idempotency tests.

---

## 156. Session 8 — Collection

Tasks:

- collection grid;
- card details;
- filtering/sorting;
- Club summary;
- mobile polish.

---

## 157. Session 9 — Pack engine

Tasks:

- pack config;
- weighting;
- pack RPC;
- economy expected-value tool;
- tests.

---

## 158. Session 10 — Pack UI and discard

Tasks:

- reveal sequence;
- skip/reduced motion;
- discard;
- ledger;
- E2E.

---

## 159. Session 11 — Market backend

Tasks:

- listings;
- price bounds;
- buy transaction;
- tax;
- sale record;
- concurrency tests.

---

## 160. Session 12 — Market UI / leaderboard

Tasks:

- browsing;
- filters;
- selling;
- buying;
- Reference Value;
- Club Value;
- leaderboard;
- E2E.

---

## 161. Session 13 — MVP hardening

Tasks:

- full test pass;
- mobile review;
- RLS review;
- error states;
- empty states;
- loading states;
- production config;
- backup instructions;
- small alpha release.

---

# PART L — CRITICAL INVARIANTS

## 162. These must never be violated

1. A Card Copy has at most one current owner.
2. A burned Card Copy cannot be owned/traded again.
3. A market listing can complete at most once.
4. Wallet balance never goes below zero.
5. Every wallet change has a ledger entry.
6. A pack result cannot be rerolled by refreshing.
7. A pack cannot mint cards without its matching debit.
8. Starter grant happens at most once per account, except an explicit audited admin reset (ADR-035).
9. Attendance reward happens at most once per Player/session.
10. Client cannot choose pack results.
11. Client cannot choose discard payout.
12. Client cannot directly set OVR.
13. Live copies of the same Player show the same current stats.
14. Special Card stats never change after issue.
15. A cancelled/no-game week does not decay Players.
16. Season rebuild is deterministic.
17. Normal user cannot edit attendance.
18. Service-role secret never reaches browser.
19. Invite token can be claimed at most once.
20. Card ownership changes only through a server-authoritative transaction — `buy_listing` or `respond_to_trade` (accept). ADR-033 retired the former "untradeable card cannot enter the market" invariant; ADR-042 added the trade-offer accept path.
21. Bibs bonus is a bounded faucet: at most once per `(session, Player)`, never re-paid on a correction of the same washer (ADR-037).
22. Trade-offer escrow is conserved (ADR-042): coins/cards offered are removed from the proposer at propose time and are either returned in full (reject / withdraw / expire / listing gone) or transferred atomically on accept — never both, never neither. A `held_by_offer_id` card cannot be listed, discarded, burned, or re-offered.
23. An accepted trade offer is never written to `market_sales`, so it never affects Reference Value (ADR-042).
24. An injury check-in protects at most one (Player, football week), pays its stipend at most once, and protects only a week in which that Player made zero appearances (ADR-082).
25. A Midweek Madness tournament is simulated at most once and its stored result never changes: a void hides it, never recomputes it. A tournament only moves forward (`open` → `skipped`, `simulated` or `void`; `simulated` → `complete` or `void`), and squads are immutable after the lock (§44.8, ADR-095). Its lock and its clock (`schedule_version`) may move only while it is open, and the times stored at the lock (each match's start and end, each event's time) never change (ADR-104).
26. A Midweek Madness win pays at most once per (tournament, round, member), only for a win in the stored bracket at its round's amount, and one tournament pays any member at most `MIDWEEK_CHAMPION_TOTAL`. A week is paid exactly when it completes, so a paid week cannot be voided (§44.7, ADR-096).
27. Only the Midweek open step changes a Player's archetype without the member or an admin, and only an active, collectible Player with no linked account, once per opened week, drawn from that week's seed and logged. A rotation never changes OVR and never stamps the archetype cooldown (§44.2, ADR-110).

Every coding agent should treat this section as a regression checklist.

---

# PART LI — PRODUCT SUCCESS CRITERIA

## 163. The game is working if…

Technical success is necessary, but product success looks like:

- players check the site after Monday/Friday;
- people talk about whose card rose;
- people care when a card crosses a rarity boundary;
- users trade because of expected real attendance;
- people intentionally collect their friends;
- low-rated Players still have value because of collection, speculation, or challenges;
- Special Cards become memories of real TFH moments;
- administration remains easy enough that the organizer keeps entering attendance.

The best sign of success is not "many features."

It is someone saying before Friday:

> "Don't tell anyone, but I bought five of him because he said he's playing tonight."

---

# APPENDIX A — EXAMPLE PLAYER CALCULATION

Suppose a Player begins at:

```text
activity = 0
form = 0
```

### Week 1

Attends Friday, scores 0.

```text
activity = 0 * .90 + 8 = 8
activity_ovr ≈ 36
form = 0
live_ovr = 36
```

### Week 2

Attends Monday and Friday, scores 1 total.

```text
activity = 8 * .90 + 11 = 18.2
activity_ovr ≈ 42
form = 0 * .55 + 1.25 = 1.25
live_ovr ≈ 43
```

### Later

After months of consistency, suppose:

```text
activity = 70
form = 0
activity_ovr ≈ 64
live_ovr = 64
rarity = Gold
```

Then the Player scores a hat trick:

```text
weekly performance = 4.75
form ≈ 4.75
form bonus = 5
live_ovr ≈ 69
```

A borderline player could cross:

```text
59 Silver → 64 Gold
```

The following football week, without goals:

```text
form = 4.75 * .55 = 2.61
```

The boost drops naturally rather than disappearing instantly.

---

# APPENDIX B — EXAMPLE MARKET TRANSACTION

Card listing:

```text
price = 300
tax = ceil(300 * .05) = 15
seller receives = 285
buyer pays = 300
15 coins are burned
```

Records:

Buyer ledger:

```text
-300 market_buy
```

Seller ledger:

```text
+285 market_sale
```

Optional system analytics records:

```text
15 market_tax
```

Do not create a system wallet unless there is a real reason. Tax can simply be represented in sale history and not credited.

---

# APPENDIX C — EXAMPLE CLUB VALUE

> Revised 2026-08-31 (ADR-041) for the Club Value v2 formula.

Member's linked Player: **Bas**, current Live OVR 62 →
`personal_card_base_value = round(10 × 1.08^32) ≈ 117`.

Member owns:

```text
Wallet:                                        420
Live Bas          discard value  (OVR 62)      117
Live Bas 2nd copy discard value  (OVR 62)      117
Live Richard      discard value  (OVR 45)       32
Special Joost     frozen discard value          80
```

Club Value:

```text
  wallet             420
+ owned_cards_value   117 + 117 + 32 + 80  = 346
+ personal_card_bonus 117 × 4              = 468
= 1,234
```

Duplicates count independently. The personal-card bonus is added even though
the member also happens to own two Bas copies — the bonus is the *linked
Player's* card value, not a card the member holds.

---

# APPENDIX D — PLATFORM REFERENCES

Technical platform assumptions should be rechecked at implementation time because free-tier limits change.

Official references used for this specification:

- Supabase pricing: https://supabase.com/pricing
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase local workflow: https://supabase.com/docs/guides/local-development/cli-workflows
- Supabase migrations: https://supabase.com/docs/guides/local-development/database-migrations
- Supabase database testing: https://supabase.com/docs/guides/database/testing
- Supabase project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel limits: https://vercel.com/docs/limits
- Vercel cron: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Next.js App Router: https://nextjs.org/docs/app
- Next.js testing: https://nextjs.org/docs/app/guides/testing
- Playwright: https://playwright.dev/
- Playwright best practices: https://playwright.dev/docs/best-practices
- Vitest: https://vitest.dev/guide/

---

# APPENDIX E — FIRST PROMPT FOR CODEX / CLAUDE CODE

Use this when starting implementation:

> Read `docs/BUILD_SPEC.md` in full. Treat it as the canonical product and technical specification. Then read `docs/PROGRESS.md` and `docs/DECISIONS.md` if they exist. Do not begin by implementing the whole game. Determine the current delivery phase and implement only the next coherent slice. Preserve all invariants in the specification. Use Supabase migrations for schema changes, add automated tests for game/economy/security logic, run `npm run verify:fast` before declaring the task complete, and update `docs/PROGRESS.md` with exactly what changed, which tests pass, remaining manual setup, and the next recommended task. Never put currency, pack results, card ownership, rating calculations, or market completion under client authority.

---

**End of specification.**

---

# IMPLEMENTED FEATURE AMENDMENTS — 2026-09-06

These accepted amendments supersede conflicting earlier MVP text; their
implementation ADRs are ADR-055 through ADR-059.

- **Special editions:** are scaffolded with immutable frozen identity, rating,
  rarity, description and artwork fields; no Special edition or copy is issued
  and packs draw Live editions only.
- **Club Value:** duplicate copies of the same edition contribute 100%, 20%,
  5%, then 0% of discard value. Selling or discarding still uses the full card
  value and is not discounted by this projection.
- **Basic packs:** contain three Live cards and cost **175 coins**. The server
  requires the caller's expected price and an idempotency key; stale quotes do
  not debit a wallet.
- **Trading discovery:** a member may have at most 100 private wants and 30
  explicitly available owned copies. Discovery returns only the owner display
  name for a wanted available card and supports a channel-neutral conversation prompt;
  it adds no reciprocal match, direct trade, escrow or automatic transfer.
- **Reports, kudos and ratings:** publishing attendance opens a 24-hour report
  for each eligible linked member. One completed form pays **50 coins** once,
  including zero goals/all skipped kudos. Three positive kudos categories are
  selected deterministically. Goals score 0/1/1.25/1.5 for null-or-0/1/2/3+;
  qualifying kudos score 0/1/1.5/2 for 0/1/2/3 recognised categories; the
  per-session Form input is capped at 3.5 and v2 Form at 8 (ADR-063). During an
  open survey Chronicle may expose only aggregate
  submission progress and aggregate goals, clearly marked provisional; player
  results and ballots stay private until finalization. Session-age weights are
  1/.75/.5/.25/0. A per-season
  published-session cutover preserves legacy history, while finalization
  records versioned results and rating snapshots and, for each recognised
  player, a `kudos_awarded` notification that omits the nominator and states the
  OVR change. Admin goal corrections for
  members or guests require a reason, recalculate final results and never pay
  a reward. An admin may also close a session's report window before its 24
  hours elapse (`kut.admin_finalize_session_survey`, ADR-067): same scoring, same
  rebuild, same notifications, with the closing admin and a required reason
  recorded on the survey and the published `closes_at` left intact. Members who
  had not submitted lose the window and its reward; nothing already earned is
  clawed back.

---

# IMPLEMENTED PRODUCTION-SAFETY AMENDMENT — 2026-09-15

Production readiness is a fail-closed evidence contract for one exact commit
SHA, not an informal checklist. CI always publishes one aggregate merge gate;
docs-only classification may skip expensive jobs, while any executable change
requires fast/build, E2E, database/pgTAP/concurrency, migration policy and
dependency results. The independent secret scan is also required by operating
policy.

Existing migrations are immutable. A change may add at most one migration and
must change a database test or carry a reviewed machine-readable exemption.
Hosted migration authority remains exclusively in `VibeTrunk/supabase`.

A production gate additionally requires byte-identical catalogue parity, an
authenticated member/admin mobile E2E pass, finalizer-readiness proof, a fresh
separate-process cold-verified encrypted backup. Since ADR-108 it no longer
requires production-agent session evidence. The gate and the separate release approval both explicitly deny
deployment authority. Deployment, hosted migration application, branch
protection, and secret changes always require their own explicit instruction.

Detailed contracts and commands are in `docs/PRODUCTION_SAFETY.md` (ADR-071).

---

# IMPLEMENTED FEATURE AMENDMENT — 2026-09-27: goals + assists (ADR-101)

This amends the 2026-09-06 "Reports, kudos and ratings" amendment above. It is
implemented locally; its migration (`20261009000000`) is not yet applied to
hosted.

- **One combined count.** From the football week beginning Monday
  **2026-09-28**, the post-session report, the admin correction and the
  accountless-attendee entry ask for one integer: goals and assists added
  together, **Goals + Assists** ("G+A"). 2 goals + 2 assists is entered and
  stored as `4`. Goals and assists count equally, are not stored separately and
  cannot be recovered; the product always states such a value as one total
  ("4 G+A").
- **History keeps its meaning.** A session dated before 2026-09-28 keeps the
  goals-only meaning and the "goals" label on every surface (report, Chronicle,
  player graph, rating story, admin). A football week is never split, because
  the cutover is a Monday. No historical value is backfilled, relabelled or
  re-scored, and notices already sent keep their wording.
- **Scoring is unchanged.** The count feeds the existing ladder unchanged:
  0 / 1 / 1.25 / 1.5 Form for 0 / 1 / 2 / 3+ (at most 1.5 per session); kudos
  0 / 1 / 1.5 / 2; the 3.5 per-session cap; session-age decay
  1 / .75 / .5 / .25 / 0; the Form cap of 8; the Live OVR ceiling of 83. A
  combined 4 earns exactly the 1.5 Form that 4 goals earns.
- **SHO.** The recent-week Shooting modifier (§15.2, `least(8, 2 * count)`)
  consumes the same combined count, so assists lift SHO and a reported 4 gives
  the capped +8.
- **Names.** Database columns and RPC parameters (`goals`, `p_goals`,
  `reported_goals`, `effective_goals`, `goal_form`, `goal_total`, `goal_count`)
  keep their names as compatibility names.
- **Where the rule lives.** `GOALS_ASSISTS_CUTOVER` in
  `src/game/reported-count.ts` for every screen, and
  `kut._uses_combined_count(date)` for the notices SQL writes (report open,
  session results, kudos awarded, admin correction). Both are pinned to the
  same date by tests.
- **Midweek Madness is out of scope.** Its goals and assists are simulated
  match events (§44.10) and keep their own wording.
