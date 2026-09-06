# KUT — collecting, match reports and economy design

Date: 2026-09-06 (revised after review). **Status: designed for review; not implemented or deployed.**

This document specifies the five features requested together: wanted cards and
trade availability; Special edition scaffolding only; self-reported goals and kudos;
175-coin basic packs; and steeply diminishing duplicate Club Value.
The shipped rules in `BUILD_SPEC.md` remain in force until their individual
implementation ADRs land. Proposed defaults below are concrete design choices,
not a claim of prior user approval for every formula.

Screen source: [`../design/features/index.html`](../design/features/index.html).
Screen guide and renders: [`design/features/README.md`](../design/features/README.md).
The prototype uses fictional members and performs no real transactions.

Implementation guide: [IMPLEMENTATION_PLAN_NEXT_FEATURES.md](IMPLEMENTATION_PLAN_NEXT_FEATURES.md).
New-session prompt: [START_NEXT_FEATURES.md](START_NEXT_FEATURES.md).

## 1. Decisions at a glance

| Area | Proposed decision |
|---|---|
| Wanted cards | Private wanted list plus explicit copy-level availability; show members who are open to trading a wanted edition. |
| Swapping | A simple availability notice encourages members to contact each other and agree terms. Complete exchanges through the existing Market/Offers flow; no new swap engine. |
| Special editions | Prepare types, frozen rendering, constraints and dormant integration. Create **zero** Special editions or copies, and keep packs Live-only. |
| Goals | Attendees submit their own goals within 24 hours of attendance publication. Remove goals from the normal admin attendance form. |
| Kudos | Three positive categories per session, one distinct teammate per category; any category can be skipped. No ability ratings or negative votes. |
| Form | Goals max +1.5; kudos max +1.5 per session; four-session taper; aggregate Form cap 8. Attendance formula retained. |
| Report reward | 50 KUT Coins once per eligible Player/session for an explicitly completed goals/kudos form; edits and admin goal entry never pay again. |
| Admin reports | Completion roster, member-goal corrections and goal entry for attendees without accounts, with reason and audit trail. |
| Pack price | Exactly **175 KUT Coins**, three Live cards, existing weights, attendance and starter awards still 250. |
| Duplicate value | Per edition, copies contribute **100%, 20%, 5%, then 0%** of their discard value. Wallet and personal-card weight remain unchanged. |
| Navigation | Existing five primary destinations. Visible section links and actions; no More/ellipsis/overflow menu. |

## 2. Shared UX and visual contract

Use the shipped Clubblad design (ADR-043 and ADR-053), not the older design
artboards as a substitute for current components. Copy these values exactly:
board `#15130f`, board-deep `#0b0a07`, panel `#211c15`, panel-2 `#2a2318`,
line `#4a4030`, ink `#f4efe3`, muted ink `#b3a891`, brass `#e0ac4a`,
steel `#8fb0c2`, moss `#8bbd6c`. Reuse `.board-ground`, `.display`,
`LiveCard`, `SectionTabs`, `FilterBar`, `BottomSheet`, icons and button styles.
Headings use Instrument Serif, weight 400, leading .94; interface and numbers
use Archivo. Utility headings 30px on mobile, 60px from `sm`. Cards retain
their exact 5:7 geometry, material ladder, jersey fallback and six attributes.
No new illustration system, font CDN, bright dashboard theme, or fake photos.

### Navigation and action placement

- Keep Home / Collection / Packs / Market / Leaderboard primary navigation.
- Collection: Album / Manage / Wanted. Club Value remains a visible header link.
- Market stays Buy / Offers. Collection → Wanted shows availability inline.
  `My trade cards` is a visible link on Wanted and Manage; no Matches tab,
  reciprocal matching preferences, swap-review page or new transfer flow.
- Home and the relevant Chronicle session expose `Add goals & kudos` until
  submitted; then `View your report`. Messages also deep-link to the session.
- All collection actions are named buttons: Want card, Remove, Make available,
  Make private, List, Discard. Nothing relies on hover or a three-dot control.
- In this design the avatar is a direct link to `/settings`, with visible
  links there to My card, How KUT works, Admin (role-gated) and Sign out. This
  small shell adjustment removes the existing account dropdown/sheet as well;
  no new feature is hidden in it. Messages retains its own direct control.

### Mobile behavior

Design at 390×844; acceptance at 320, 360, 390, 430, 768 and 1440px. Page
gutter 20px (16px at 320), content max-width 1152px. Primary buttons 52px
minimum; other interactive targets at least 44×44px. Inputs at least 16px
to avoid focus zoom. Lists use compact ruled rows; full cards appear where
their artwork actually helps selection, in two columns on phones. Wanted-card availability uses short named rows and visible conversation actions.
It never compares two cards or suggests that a reciprocal deal has been agreed.

Bottom navigation reserves `64px + env(safe-area-inset-bottom,0px)`. A sticky
single-action footer, where used, reserves its additional measured height;
it is one DOM button, not a duplicate. Avoid sticky footers on long editable
forms; an in-flow Save remains usable with the keyboard. Compact pickers open
a full-height-on-mobile dialog with a visible title, search, Close and Done;
Escape, focus trap/return, labelled selection and body-scroll lock are required.
Dialogs use `100dvh`, scroll internally, and respect both safe areas.

Use native links for routes, actual buttons for mutations, `aria-current` for
navigation, `aria-pressed` for toggle buttons, and inline `role=status` for
save confirmations. Error messages preserve entered values and move focus to
an error summary. No optimistic coin, ownership or rating updates. Save a
private report draft on the server only after explicit Save; unsaved local
input may persist in component state across picker opens, never in a public URL.
Support keyboard operation, 200% text sizing and reduced motion.

## 3. Wanted cards and simple trade availability — revised 6 September

### 3.1 Scope and complexity

Replace the first proposal's reciprocal matching system with a small discovery
feature. Approximate engineering complexity: **3/10 versus 7/10** for the former
direct-swap design (judgment, not a measured effort estimate). Two lists and a
narrow read query remain; the new target type, new proposal RPC, extra escrow
lifecycle, matching consent switch, fairness/comparison UI and reciprocal
requirements are removed. The underlying existing Market/Offers complexity
already exists and is not rebuilt here.

**Member mental model:** "I want this card. Bea has marked a copy as open to
trading. I'll contact Bea and see if we can agree terms." Bea need not want anything the
viewer owns. KUT does not negotiate, reserve a copy or imply a deal is agreed.

### 3.2 Two lists and privacy

A private wanted list is keyed by `(user_id, edition_id)`, with at most 100 rows.
Only issued/selectable editions can be wanted; currently that means Live cards.
An owned edition may also be wanted; show `You own N`. Acquisition marks the
want fulfilled and stops notices, with `Want another` explicitly reactivating it.
A subsequent discard/sale does not silently reactivate it. Keep a small Collected
filter for fulfilled wants. Never use names or album slot numbers as identity.

On each owned, eligible copy, the member can toggle **Open to trading**. There
is no automatic sharing of duplicates. First use explains: **"Members who want
this card can see your name. Your other cards stay private."** Explicit sharing
is the only consent required: no separate "matching enabled" preference.
A member can opt in up to 30 specific copies. Only display one availability row
per `(owner, edition)` to a viewer, regardless of copy count. Do not expose copy
IDs, how many the owner holds, their wants, unrelated cards, telephone number,
email or other private profile data.

Changing one's want list can reveal names for deliberately shared editions;
that is the declared privacy scope, not a claim that sharing is visible only
to a permanently fixed set of people. No arbitrary owner-inventory lookup.

### 3.3 Screens and conversation journey

1. Collection → Wanted → Add cards, or `Want card` on an album gap/player.
2. Each wanted card shows separate facts: `Listed from 130 coins` (public listing)
   and **"Bea Test is open to trading this card."** Show up to three names plus a
   visible `See all N members` link if necessary; alphabetical, no ranking.
3. `Copy message` copies: "Hi Bea, I saw you're open to trading your Live Alex
   card on KUT. Shall we agree a trade?" Show `Copied. Send it to the owner.`
   and provide selectable text if clipboard access fails. KUT does not send a
   message or store contact details.
4. A short `How to complete a trade` explanation says to contact each other and agree terms,
   have the owner list the card, then use the existing listing's Offer action.
   That flow supports cards and/or coins. A listing is public and can be bought
   by someone else; disclose this limitation, do not present it as a private
   reserved exchange. If that later proves a problem, design direct trades
   separately. Never invent a free transfer or do two unsecured manual transfers.
5. Wanted-edition and available-owned-copy selectors share the same Trading
   preferences screen and row/button treatment. Copy states say Private /
   Available / Unavailable (listed or held in an offer).

No Matches destination, You give/You get screen, new offer button, automatic
counterpart selection or requirement that the other member wants your card.
The only discovery in v1 is the inline wanted-card display; **no new push,
email or inbox notification machinery**. Refresh on page load/return and provide
an explicit Refresh button. This keeps stale-availability handling honest and
avoids a notification-preference feature for this small club group.

### 3.4 Data and lifecycle

Two tables: `card_wants(user_id,edition_id,state,created_at,fulfilled_at)` and
`trade_availability(card_id PK,owner_id,created_at)`. Owner-scoped RLS on both;
no member-wide direct SELECT over ownership. Server mutations
`set_card_want(edition_id,wanted)` and
`set_trade_availability(card_id,available)` derive the caller and validate
ownership, active profile, unburned, unlisted and unheld copy. Idempotent set
semantics and row uniqueness, not a new transaction/escrow protocol.

`get_my_wanted_availability()` is an authenticated, fixed-search-path, narrowly
scoped SECURITY DEFINER read RPC. Return only caller's active wants joined to
other active members' explicit flags, deduped by owner/edition, with display
name and edition. Revalidate ownership/eligibility on every read. No reciprocal
join, supplied arbitrary owner, caller-chosen wishes outside their saved list,
coin values, full inventories or private contact fields in the response.

Availability does not lock cards or change prices. Unmarking is immediate and
needs no refunds. Existing list/discard/transfer/burn/reset/deletion paths clear
availability when ownership or eligibility changes (a small centralized trigger
is preferable to modifying every economy RPC). Listing/offer-held flags disappear;
if that listing/offer is later cancelled the member must explicitly opt in again.
Reader revalidation hides a stale flag even before cleanup runs. Clearing flags
must not mutate existing trade-offer states or coin/card balances. Existing
Market/Offers behavior is untouched. No `target_kind`, `propose_matched_trade`,
new ownership-transfer path or new transaction notification.

### 3.5 States and acceptance

No wants → Add cards. Nobody open → `Nobody has offered this card for trading
yet`, with any public listing still actionable. Several owners → named rows.
Own shared copy never appears to oneself. Revoked/transferred/held/burned/disabled
owner → disappears on refresh. A copied message may become stale; nothing was
reserved and the member checks availability in conversation/the real listing.

Tests: private inventory inaccessible; wanted list not exposed to counterpart;
non-reciprocal availability works; explicit opt-in only; no duplicate-owner rows;
no owner copy-count leak; disabled/held/listed/burned exclusion; ownership-change
cleanup; fulfilled wants; clipboard fallback; no new ledger/escrow side effects.

## 4. Special editions — scaffolding only

### 4.1 What this slice means

The database already has `card_editions` with `is_live`, frozen stat fields,
edition type, supply/window metadata and multiplier; collection/value paths
already partly resolve snapshots. Start with an inventory of actual schema
and grants. Extend it only where missing; do not build a second edition model.

Deliver a typed resolved-card contract discriminated by `isLive`. Live cards
resolve current season state. Specials require OVR, all six frozen attributes,
edition type/title, issued timestamp, frozen archetype, description/context,
frozen rarity treatment and versioned immutable artwork reference. Snapshot
OVR bounded 30–95, attributes 1–99, positive multiplier, positive weight when
later eligible, valid availability interval and nonnegative minted count ≤ cap.
Archive artwork separately from a mutable profile photo; retiring/removing a
photo for consent remains possible without changing frozen gameplay stats.

Use the actual card skeleton and material CSS. A later Special gets an edition
label **below** the card and a date/context block on detail; no new seventh
Live rarity, no extra text crammed over the OVR. Frozen attributes and valuation
must never fall back to Live stats if a required snapshot is missing: show a
recoverable unavailable state and block economy actions for that broken record.
Snapshot immutability must be enforced in the database, not only TypeScript.

Prepare edition-aware collection grouping, wanted keys, detail metadata and
frozen valuation tests. Future album Specials should be a visible mode only
when issued editions exist; the personal Live album retains one slot per real
Player. Duplicate weighting is per edition, so a genuinely different historical
edition later receives its own first-copy contribution.

### 4.2 Explicit release boundary

- Create **no** Special rows, drafts, copies, own-special grants or real artwork.
- Do not activate pack Special rolls. Pack selection stays `is_live = true`.
- Do not advertise Special odds, locked packs, empty member tabs, countdowns
  or coming-soon inventory. The only member-visible pack content is Live cards.
- Do not ship a mint/publish RPC or usable admin issuance control in this slice.
- Admin → Editions has an empty state: `No special editions have been issued`.
  A quiet explanation says editions will preserve a football moment. No primary
  Create/Publish button. This is an operator readiness surface, not a store.
- Tests may create synthetic Special fixtures inside rolled-back local tests;
  they must not be seed/production content or member-facing mock cards.

Later issuance needs a separate ADR: selection, boosts, multiplier, supply,
pack chance and windows, admin authorization, mint concurrency, art retention,
and own-special grant policy. Never label the current scaffold “Specials live”.

### 4.3 Acceptance

Zero new Special editions/copies after migration; zero chance to pack one;
all Live visuals unchanged; malformed snapshot fails closed; frozen stats,
archetype and edition art do not follow later player edits; collection, market,
discard and Club Value resolve synthetic frozen fixtures consistently. Admin
screen inaccessible to ordinary members at both route and data layers.

## 5. Attendance, self-reported goals and kudos

### 5.1 End-to-end lifecycle

1. Admin selects date, attendees and bibs bringer, then `Publish attendance`.
   **No goals fields** in this everyday form. Existing attendance coins and
   Activity update immediately; members need not complete a survey to earn them.
2. The transaction creates one survey per session, snapshots eligible linked
   attendees and three category IDs, and sets `closes_at = published_at + 24h`.
   In-app messages and a Home prompt link to it. KUT has synthetic login emails;
   “send a survey” therefore means in-app delivery, not automatic email.
3. Attendee enters goals and optionally nominates teammates, then explicitly
   saves. Their own saved answers can be edited until close. Chronicle may show
   the aggregate number of submitted forms and aggregate goals so far, but other
   members cannot see individual provisional goals, ballots or scores.
4. At the deadline submission closes according to database time, even if no
   job has run. Finalization aggregates valid reports and kudos, publishes the
   recap and deterministically rebuilds ratings/snapshots once.
5. Before close, Chronicle shows `Reports open`, aggregate progress and the
   eligible member's report action. After finalization it shows effective goal
   reports and recognized categories with a route to each card.

There is one form per actual session, not per football week. Monday and Friday
each get one. Late publication still grants a full 24h; the screen shows both
football date and actual closing timestamp in Europe/Amsterdam. Store timestamps
in UTC. Cancelled sessions close without Form input and do not advance decay.

### 5.2 Goals interaction and truth model

Question: **“How many goals did you score?”** Initially unanswered, never a
silently recorded zero. Show 0 / 1 / 2 / 3 / 4 / 5 quick buttons, plus a
labelled numeric field for 6+ (keyboard supports every nonnegative integer).
Store raw string while typing, select on focus, validate on save. Accept
0–99; for ≥10 show an inline `Confirm N goals` checkbox before submission.
This is an input-error guard, not proof that a count is true.

Saved zero is a report of zero. No report remains `Not reported` and contributes
zero Form without claiming the person scored zero. Non-account attendees are
included in attendance totals and may receive kudos, but cannot self-report
until linked. Admins can enter their goals from the session report roster,
without creating an account or pretending they submitted a form (see §5.7).
Late-linked attendees may join the eligible electorate before close through
the audited link operation, but never gain a second ballot for one real Player.

Recaps say `Reported goals` and `14 of 20 goal reports received`; incomplete
totals are never presented as an official match score. Do not add assists,
saves, downvotes, 1–5 ratings or proof-upload requirements. Outliers can be
flagged privately for admin review. Admin → session → `Correct report` is a
separate exceptional path requiring a reason, before/after audit and member
notice; it does not reintroduce goals into normal attendance entry.

### 5.3 Kudos interaction and selection

Seven categories: Team Player, Engine, Playmaker, The Wall, Difference Maker,
Great Vibes, Level Up. Three are selected **once per session**, the same three
for everyone. Draw randomly among the least-used categories in that season;
persist selected IDs and the draw seed/version. Corrections/retries never reroll
them, and the scheduler never depends on changing client randomness.

Each category is a labelled row with a brief plain-language explanation and
`Choose teammate`. That opens a searchable attendee picker, excluding self.
One nominee per category and each recipient may appear only once in a ballot.
Already selected teammates remain visible but disabled with the reason and a
clear path to change the earlier choice. `Skip` is always permitted. No
nomination is prefilled; skipping never lowers anybody's rating.

Three steps are not three separate mandatory pages: goals and the three kudos
rows live on one short form, with a named picker when needed. A user can save
partial answers as a draft without a reward. To submit for **50 KUT Coins**,
enter goals explicitly (including zero) and answer each of the three categories
with a nominee or an explicit Skip. Skipping all categories is valid; there is
no incentive to invent nominations. Drafts do not count as ballots or completed
reports. Once submitted, edits must remain complete and do not pay again.
Attendance still pays 250 separately; receiving kudos/scoring has no coin reward.

Kudos counts only when **at least three distinct attendees submit ballots with
at least one valid nomination**. A recipient earns recognition for a category
when at least **two distinct eligible nominators** choose them in that category.
With one recipient per ballot, reaching multiple categories requires broader
recognition. Received qualified category count 0/1/2/3 gives
**+0/1/1.25/1.5 Form**. The first recognized category is meaningful; further
categories have diminishing returns while the original +1.5 cap remains.
If turnout is too low: `Not enough kudos reports this time; goals still count`.
Do not publish nominators, raw vote counts, unrecognized names or a popularity
ranking. Recognized categories appear as positive badges in alphabetical player
order. This mitigates casual vote trading; organized collusion is still possible
and must remain auditable, with no pretend claim it can be eliminated.

### 5.4 Concrete rating proposal

Retain existing weekly Activity equation, exponent, 30–75 Activity OVR and
30–83 final Live OVR. No permanent performance points. At a survey's session:

| Goals | 0 / unreported | 1 | 2 | 3+ |
|---|---:|---:|---:|---:|
| Goal Form | 0 | 1.0 | 1.25 | 1.5 |

`session_input = goal_form + kudos_form`, capped at **3.0**. Replace the old
weekly goals/hat-trick formula for new-rule sessions; do not add this on top.
Old hat-trick +1 and old per-goal 1.25 no longer apply to new-rule sessions.

Order published, non-cancelled sessions by `(session_date, session_type, id)`.
Each session contribution has weights **1, .75, .5, .25, 0** at ages 0–4,
where age counts subsequent published TFH sessions in that season, whether or
not the player attended. Empty/cancelled weeks do not age contributions.

```text
form_score = min(8, sum(session_input * age_weight) + legacy_carry)
form_bonus = floor(form_score + 0.5)     # nonnegative, same in SQL and TS
live_ovr = clamp(round(activity_ovr + form_bonus), 30, 83)
```

An isolated +3 evening contributes 3 → 2.25 → 1.5 → .75 → 0. Four consecutive
maximum evenings produce 7.5 Form, rounded to +8. An open survey contributes
zero until finalized, but its published session advances age. Late results are
inserted at their original chronological position, not as a fresh boost today.
Goals-only maximum over four sessions is 3.75 Form, versus 7.5 with full kudos.

The earlier roadmap's “75–80% attendance” is **not an exact formula** here:
attendance controls 45 of the 53 available OVR points above baseline (~85%),
Form at most 8 (~15%). This explicitly prioritizes preserving KUT's existing
ceiling and attendance backbone over the loose percentage target.

Separate category-specific PAC/SHO/etc. nudges are deferred. Preserve the existing
goals-to-SHO rule `min(8, 2 * reported_goals_in_latest_football_week)` for new
finalized goals, resetting on a subsequent football week as today; kudos affects
the six attributes through OVR and archetype only. No double goal ingestion.
The statement “playing badly never subtracts points” means no negative judgments;
OVR can still fall while attending when earlier **temporary Form expires**.
Copy must explain that honestly, not promise ratings can fall only on absence.

### 5.5 Storage, automation and corrections

Proposed tables: `session_surveys(session_id PK, status, opened_at, closes_at,
category_ids, selection_seed, rules_version, finalized_at, revision)`;
`session_reports(session_id, player_id, submitted_by, goals nullable,
status draft/submitted, explicit_skips, submitted_at nullable, updated_at, revision)` unique `(session_id,player_id)`;
`session_kudos(session_id,nominator_player_id,category_id,recipient_player_id)`
unique `(session_id,nominator_player_id,category_id)` and
`(session_id,nominator_player_id,recipient_player_id)`; immutable correction audit.
Attendance stores eligibility; user identity maps to the linked real Player.
Persist eligible voter/player mappings and adjustments for replay and audit.

RPC `submit_session_report(session_id,goals,nominations,expected_revision,
idempotency_key)` derives user, validates current linked eligibility and stored
categories, locks survey, checks database time `< closes_at`, and replaces the
member's entire answer set atomically, with the one-time completion reward
when eligible (§5.7). Distinguish `save_draft` from `submit` intent and persist
explicit skipped categories; count only submitted ballots. Different stale revision returns a
conflict with their saved version; retries cannot duplicate votes. A unique
request key returns its original outcome. Member reads own report only.

`finalize_session_surveys(batch_limit)` is service-only: bounded worker locks
due rows (`FOR UPDATE SKIP LOCKED`), finalizes counts, rebuilds each affected
season under the shared rebuild lock, and writes one result notification per
member/session/revision. Record a job heartbeat, attempts and failures. Use a
database scheduler every five minutes, subject to shared Supabase operator
deployment; do not assume Vercel Hobby can run it this frequently. A server-only
lazy fallback on report/Chronicle loads finalizes due sessions if scheduling
fails. User RPCs may never reopen or set timestamps. At close UI says
`Reports closed · results are being prepared` until committed. Failure retries
do not repay attendance coins. Results are never partially published.

Attendance correction removes ineligible votes/reports, recomputes valid
aggregates and ratings, and audits the change. Removed-and-readded voters do
not get a new ballot. Added attendees before close use the same deadline;
after close admin may correct goals with a reason but does not fabricate kudos
or open a new electorate. Cancellation invalidates the survey's rating input.
Existing forward-only attendance reward correction policy remains intact.
Relinking after close never transfers a ballot to a different real Player.

Rollout starts at the next unpublished football week boundary. Store the rule
version on sessions; historical admin goals remain authoritative for old-rule
sessions, with no retrospective surveys or invented ballots. Preserve old
weekly snapshots; rebuild old weeks with the old formula. Carry the previous
week's legacy Form into new sessions with .75/.5/.25/0 weights on the first
four new sessions, then retire it. This is an explicit, deterministic transition
policy; an ADR must record its small one-off rating effect. Apply new chronological
rebuild snapshots to each historical week, not today's state written backwards.

### 5.6 Acceptance

Cover zero vs missing; 0/1/2/3/99 goals; invalid negative/fractional input;
self votes; repeated recipient; invalid category; insufficient turnout;
two nominators in one category; disabled and unlinked accounts; edit/save race;
exact deadline and DST; delayed publication and finalization; Monday+Friday;
no-game/cancelled weeks; old-session corrections; cutover/legacy decay;
full-season SQL/TypeScript parity; no attendance reward replay; no public
ballots or provisional totals; no OVR updates from client-supplied Form.

### 5.7 Completion reward and admin report management — added 6 September

**Reward: 50 KUT Coins per eligible real Player/session**, credited atomically
on the first complete self-submission before close. A completed form has an
explicit 0–99 goals answer and an explicit nominee or Skip for each category.
Zero goals plus three skips earns the same 50 as any other valid form. No minimum
kudos turnout or nominations received is required for the participation reward.
Drafts, admin goal entry, guest rows and merely opening the form do not qualify.

`session_report_rewards` unique `(session_id,player_id)` stores the beneficiary
user, fixed amount 50 and ledger reference, also uniquely constrained at the
ledger level using reason `session_report_reward`. Derive beneficiary from the
eligible linked player; lock report/reward/wallet in a consistent order and
credit wallet + immutable ledger + report submission in one transaction. Same
request key returns the same result; a later edit/new key/relink/reset/retry
cannot earn another 50. Reward history survives soft reset. Do not replay old
sessions at rollout or when a new account is linked after closure. Limits: one
50 reward per eligible linked attendee, per real published session; standard
unique session identity still applies. Freeze the award amount/rules version on
the survey, so a later configuration change cannot reprice historical rewards.

UI: Home says `Your report → +50 KUT Coins`; form footer explains "Enter your
goals and choose or skip each category." CTA `Submit report → earn 50 coins`.
Success says `Report submitted → +50 KUT Coins received`, reflects the new
wallet, and offers Edit. Edits say `Reward already received` and use `Save
changes`. An interrupted request reloads the server's saved submission/receipt,
never shows a second reward animation or pays twice. No per-vote reward copy.

Reward correction follows the existing forward-only attendance policy: later
goal corrections, category turnout changes, session cancellation or accidental
attendance removal do not automatically claw back the 50. The immutable receipt
remains; proven abuse can use the existing audited admin wallet adjustment.
Repeated remove/re-add/cancel operations never create a second eligibility key.
This is a new bounded faucet; list it in the spec's faucet inventory/Part L,
wallet-reason validation and admin economy totals before implementation.

**Admin → Attendance → session → Reports** has visible All / Pending / No account
filters, search, and one row per attendee. It shows:

- player name and whether they have an account;
- Submitted (with timestamp), Draft, Pending, or No account;
- submitted goal count and effective count if overridden, with source;
- Reward paid / Not earned / Not eligible;
- explicit `Edit goals` or `Add goals` button, no overflow menu.

Completion summary is **submitted / eligible accounts**, e.g. `12 of 16 forms
completed → 4 attendees without accounts`, not 12/20. Goal coverage is a separate
metric and includes admin-entered goals. Admin entry cannot mark a member's
form completed or pay their reward. Do not expose individual kudos ballots on
this everyday admin screen; completion and goals are sufficient.

`Edit goals` opens a labelled sheet showing player, original goals, effective
count, editable 0–99 count and required 1–200 character reason. `Add goals` for
an attendee without an account uses the same form. Reject non-attendees rather
than silently adding attendance/rewards. Show source and revised value immediately
on successful save. Existing saved zero differs from no report. Admin can
remove an override explicitly to restore the player's submitted value/unreported
state; show that outcome before confirmation. Prevent silent overwrites of a
member's original submission and never edit their kudos on their behalf.

Proposed `session_goal_overrides(session_id,player_id,goals,reason,actor_id,
updated_at,revision)` plus immutable before/after audit. A missing override means
use the member's submitted goals. A present override takes priority and cannot
be overwritten by a member edit. Members see the correction, reason and who made
it; their goal field is read-only while overridden, but they can edit kudos
before close. If an admin already supplied goals for a pending member, that
member explicitly acknowledges that value on submission instead of reentering
it; they still must personally answer/skip all kudos to earn 50. Guest later
linked before close follows the same rule; no duplicate player ballot/reward.

RPC `admin_set_session_goals(session_id,player_id,goals_or_remove,reason,
expected_revision,idempotency_key)` verifies active admin and published session,
locks against submission/finalization, validates attendee/count, and writes one
revision plus audit. A separate discriminator distinguishes remove-override from
an explicit zero. Admin may act before or after report closure. Before closure,
keep the original deadline and aggregate only at close. After closure, rebuild
Form/SHO/weekly snapshots and Chronicle from the effective goals at the session's
original date, preserving frozen Specials and past market transactions. Notify
the affected account once per correction; no account means retain audit without
inventing a notification target. A cancelled session requires its existing
attendance correction workflow first, not an orphan goal edit.

Tests additionally cover: once-only +50 with zero goals/three skips, drafts
unpaid, incomplete categories blocked, save/retry/edit race, deadline boundary,
wrong-user award, reset/relink, admin override vs member submission vs close,
admin goals for accountless attendee, completion count excluding guests,
non-attendee rejection, restore original/zero/null handling, no reward for admin
entry/correction, no cloned attendance faucet and historical replay stability.

### 5.8 Balance verification

See [`RATING_BALANCE_REVIEW.md`](../RATING_BALANCE_REVIEW.md) and its repeatable
`design/features/check-rating-balance.mjs` calculations. The review compares
against the **actual current rating-engine functions**, not the stale example
calculations in the original build spec. It covers isolated/repeated inputs,
weekly vs session cadence, the extra goals-to-SHO boost, category thresholds,
small groups, OVR/discard effects and the new coin faucet. These calculations
verify bounds and relative strengths; synthetic voting scenarios cannot prove
how real people will vote. Recheck after several real sessions before retuning.

## 6. Basic pack price: 175 KUT Coins

Update the active basic row in **`kut.pack_definitions`** (actual schema name,
not the older suggested `pack_types`) to 175 via a versioned data-changing
migration. Mirror `ECONOMY.basicPackPrice`, spec §28/§145, relevant how-it-works
copy, fixtures and admin expected-return denominator. Three cards and rarity
weights remain identical. Starter/attendance 250 and bibs 100 stay as they are.
Past `pack_openings.price_paid` and ledger entries never change; no refund or
compensation for earlier packs. Do not perform a broad replacement of `250`.

Screen: current pack treatment, title and ladder, with a visible wallet and
`Open for 175 KUT Coins`, `3 Live cards · leaves you 325` for a 500 balance.
No fake sale badge, crossed-out price or Special chance. Use a styled purchase
confirmation dialog showing cost, three Live cards and after-balance. Cancel
leaves everything untouched. Confirm opens once, disables during submission,
then reuses the existing stored pack reveal and skip/reduced-motion behavior.
174 balance says `Need 1 more KUT Coin`; 175 succeeds and leaves zero.

Price is read server-side. Extend confirmation submission with expected price
or an equivalent signed quote; if the active price changed, refresh the quote
and ask for confirmation again before charging. Replaying a previously completed
idempotency key returns that opening at its recorded old price. Reload during
reveal must recover it, never purchase again.

### Economy review required for rollout

175 is a 30% reduction and buys ~42.9% more packs per attendance coin over time.
With the newly requested 50-coin completion reward, a reporting attendee earns
300 per session: 1.714 packs versus the original 250/250 = 1 pack, **71.4% more**
in the long run before discard returns. Reporting adds 20% to attendance income,
not to rating. Recheck total faucets jointly; no backdated report rewards.
At unchanged discard EV, the return ratio multiplies by `250/175 ≈ 1.4286`.
At this price, target EV ≤ **131.25**, warning > **140**, critical ≥ **166.25**.
An old 70% return would become 100%: a real repeat-open/discard loop risk.

Compute exact weighted EV from the current eligible roster immediately before
rollout, plus baseline, active-regular and mature-roster fixtures and the proposed
goals/kudos engine. Record values in the price ADR. Do not claim the live economy
was checked in this design task. Do not silently alter odds, discard payouts or
the requested price to make a failing check pass. A critical result requires a
separate concrete balancing decision before activation. Duplicate Club Value
weights do **not** lower discard EV and cannot solve a pack/discard coin loop.

Tests: exact 175 debit, three cards, 174 failure with no debit/mint, 175→0,
500→325, retry recovery, price-change confirmation, historic-price replay,
no Special draws, expected-return status thresholds and representative rosters.

## 7. Duplicate-sensitive Club Value (v3 proposal)

Group all unburned cards by `(owner_id,edition_id)`. For an edition with count
`n` and current server discard value `D`, the owned contribution is:

```text
edition_value = (n >= 1 ? D : 0)
              + (n >= 2 ? floor(D * 20 / 100) : 0)
              + (n >= 3 ? floor(D *  5 / 100) : 0)

club_value = wallet_balance + sum(edition_value) + 4 * personal_card_base_value
```

| Copies, D = 100 | 1 | 2 | 3 | 4 | 10 |
|---|---:|---:|---:|---:|---:|
| Old owned contribution | 100 | 200 | 300 | 400 | 1,000 |
| New owned contribution | 100 | 120 | 125 | 125 | 125 |

This makes all duplicates combined worth at most **25% extra**. The fourth
copy onward contributes zero, rather than a small infinitely accumulating tail.
Use integer arithmetic; floor each weighted contribution, then sum. For real
60 OVR Live cards `D=101`, five copies give `101+20+5+0+0=126`, not 505.
For floor OVR `D=10`, contributions are 10,2,0,0,… .

“First” is a valuation position, not a permanent privileged card copy. To show
an auditable per-copy table, rank by `(acquired_at,id)` and recompute on every
ownership change. If the first is sold, the next remaining one takes its place.
The edition total depends only on count and D, never transaction history.
Listed and offered/held cards remain owned and count until transferred. Burned
cards never count. Existing treatment of escrowed coins remains unchanged.
Personal-card bonus is separate, even when the member owns their own Live copy.

Different editions of the same Player are not duplicates: a future issued
Special preserves a different moment, so it gets its own first-copy weight.
The scaffolding has no Special issuances, so no immediate loophole is introduced.
Keep real unique-player count separate from distinct-edition count.

### UX

Collection header continues to link the actual Club Value. `/club/value` leads
with Wallet + Collection + Personal card, then a compact `How copies count`
strip: 1st 100%, 2nd 20%, 3rd 5%, 4th+ 0%. Below, edition rows show player,
edition, owned count and weighted subtotal with a visible `See copies` link.
Copy detail separates **“Adds to Club Value”** from **“Discard for N KUT Coins”**.
Neither is labelled simply “Value”. Before discard, show the server-computed
change in total Club Value after the remaining copies are reweighted.

Manage duplicates has explicit `Trading preferences`, `List` and `Discard`
actions.
No guilt copy, forced sell, hoarding warning, auto-discard or overflow menu.
First visit after activation explains `Club Value now favors different cards`
and links the breakdown. Leaderboard may reorder immediately; the banner says
coins/cards were not removed and gives the effective date. Do not show a rank
drop as football performance deterioration or put it into rating history.

### Deliberate economic limit

This discourages **holding** duplicate cards for Club Value. It does not cap
wealth: discarding a low-weight copy still yields its full discard payout,
and those coins count at 100%. Example: two D=100 copies contribute 120;
discard either and you have 100 coins + one 100 card = 200, an 80 increase.
That is an incentive to release surplus, not a hidden arithmetic defect. It
also means packs followed by duplicate discards can still create large coin
balances if their EV is too high. Changing duplicate discard payouts or wallet
weight would be a separate economy proposal, not smuggled into this request.

### Backend and acceptance

One canonical grouped server valuation backs `my_club_value`, the member-only
breakdown and `club_value_leaderboard`. Keep counterpart ownership private;
leaderboard gets aggregates only. Mirror the formula as a pure TypeScript
reference function with shared SQL fixtures. Add breakdown fields rather than
renaming current view columns incompatibly without a staged client rollout.

Migration is **data-changing** by repository policy because it changes a
published formula and ranks, even if only views/functions change. No rows of
wallets, cards or past ledgers are rewritten. Snapshot a read-only before/after
rank/value comparison for rollout; do not expose private per-owner holdings.
Rollback restores v2 projections, not historical transactions.

Test count 0/1/2/3/4/1000; low and high D rounding; different editions vs same
player; tied timestamps; remove first/middle/last; listed/held/burned; Live rating
change; frozen Specials; unlinked personal bonus; reset/deletion; identical
breakdown and leaderboard totals; no client-controlled weights.

## 8. Delivery sequence and review checklist

These are independent implementation PRs, consistent with CLAUDE.md's rule
against batching migrations or invariant/RPC changes. No migration is supplied
or applied by this design task.

1. Special scaffolding, zero issuance (additive); establish edition contracts.
2. Duplicate Club Value v3 (data-changing); transparent breakdown and release copy.
3. Basic pack 175 (data-changing); roster EV decision before activation.
4. Private wants and simple trade availability (additive); no new transfer path.
5. Session reports/kudos, the 50-coin completion reward, admin report tools and
   rating v2 (data-changing); cut over on a new football
   week with scheduler, transition parity and result screens ready together.

Each implementation records its own ADR and updates BUILD_SPEC's affected
sections (§8–15, §19, §28–32, §39/39a, §40/41, §46/47, §63/66, RPC contracts,
§145 and Part L where a contract changes). Hosted migrations remain owned by
VibeTrunk/supabase and require their normal operator process. Push/deployment
is a later action, not part of designing these features.

Visual acceptance: compare prototype and existing cards side-by-side; exact
fonts/colors; two-column cards at phone widths; no horizontal document overflow;
all destinations/actions reachable without an overflow menu; dialogs and form
errors keyboard-accessible; safe-area bottom spacing; goal field can be emptied;
long player names and large balances wrap; screen-reader labels and selected
states; reduced motion and loading/empty/error states. Product acceptance uses
the concrete transitions and arithmetic above, not screenshots alone.
