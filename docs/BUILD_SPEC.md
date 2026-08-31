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

Later versions may add:

- assists;
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

### Bibs bonus

The member linked to the Player who washed the bibs after a session receives a
one-off `+100 KUT Coins` (`BIBS_COIN_BONUS`, Part 145). The admin records the
washer on the attendance form; `kut.match_sessions.bibs_washed_by` stores it
(null = nobody). Paid by the audited `kut.grant_bibs_reward`, alongside
`grant_attendance_rewards`, with `wallet_ledger.reason = 'bibs_bonus'` and a
dated `bibs_bonus` inbox message ("You received 100 KUT Coins for washing the
bibs after the session on DD Mon YYYY."). A `kut.bibs_rewards` guard table,
PK `(session_id, player_id)`, plus a unique ledger key make it idempotent: at
most once per `(session, washer)`, never re-paid for the same washer on a
correction. Reassigning the washer on a correction pays the new washer; the
previous one keeps their bonus (forward-only). Coins only — no rating/OVR
effect. See ADR-037.

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
- create a 24-hour listing;
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

> **Note (2026-09-01, ADR-041):** Reference Value is now used **only** for
> `get_listing_bounds` (market listing price bands). It is no longer part of
> Club Value — see the revised §39 below.

---

## 39. Club Value

> **Revised 2026-09-01 (ADR-041).** The former model — `wallet_balance +
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

## 39a. Trade offers (2026-09-01, ADR-042)

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

## 41. Collection album — Phase 2

Provide a roster-completion view:

> 73 / 201 TFH Players collected

Each real Player has a slot.

Owned:

- visible card/image.

Missing:

- silhouette and/or name.

Possible subcollections:

- Monday regulars;
- Friday regulars;
- Gold players;
- 2026 debutants;
- goalkeepers (players with the Goalkeeper archetype, ADR-036);
- season-specific groups.

Completion rewards are later features.

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

# PART XV — MATCHDAY / FANTASY LAYER — PHASE 3

## 44. "Friday Five" / "TFH Five"

This is deliberately not MVP.

Once collecting and trading are proven fun, let each user select five owned cards before a deadline.

Suggested five slots:

- 1 keeper/utility;
- 1 defender;
- 1 midfielder;
- 2 attackers;

or simply five unrestricted cards initially.

Cards are selected by Card Copy ID.

A copy may only occupy one slot.

Squad locks before the relevant session.

Suggested scoring:

- selected player attends: +2;
- goal: +3;
- hat trick: +5 bonus;
- future Player of Match: +5.

Weekly ranking provides modest rewards.

Important: matchday rewards must not inject enough currency to overpower the market economy.

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
- Player directory;
- Settings;
- Admin.

Desktop may use side/top navigation.

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

Create 24-hour active listing.

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
- Collection Album;
- milestones;
- season history.

### Acceptance criteria

- Special stats never change when Live Player changes;
- maximum supply cannot be exceeded under concurrency;
- expired Special is no longer packable;
- Special edition price/discard logic uses frozen stats;
- historical Special pages show issue context.

---

## 120. Phase 3 — Squads / weekly fantasy

Build:

- Friday Five / TFH Five;
- lock deadline;
- weekly scoring;
- weekly leaderboard;
- small rewards;
- squad history.

Do not implement until market/collection usage proves sustained.

---

## 121. Phase 4 — Community systems

Potential:

- post-match awards;
- voting;
- challenges / SBC-like card sinks;
- achievements;
- notifications;
- friend activity;
- ~~trading offers~~ — **shipped 2026-09-01, ADR-042** (see §39a);
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
> per-reason breakdown is built it must include the two admin ledger reasons
> `admin_grant` (audited faucet) and `admin_reset` (the reset's wallet zero +
> starter re-grant); today both flow into the supply total automatically.

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
BIBS_COIN_BONUS = 100  # one-off, for the session's bibs washer, ADR-037
STARTER_COIN_GRANT = 250
STARTER_CARD_COUNT = 3

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
5. Whether custom SMTP is configured before alpha.
6. Whether attendance reward remains 75 after economy testing.
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

> Revised 2026-09-01 (ADR-041) for the Club Value v2 formula.

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
