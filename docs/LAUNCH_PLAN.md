# KUT go-live plan

Date drafted: 2026-09-02. Revised 2026-09-02 after the owner's go-live
decisions (ADR-050) and the album / Chronicle / graph deploy.
**Status: in progress — target Friday 2026-09-04, before the session.**

The checklist to take KUT from closed alpha (5–10 trusted testers) to open to
everyone at Terrible Football Haarlem. It extends — does not replace — the
alpha checklist and risk-tiered migration process in
[`OPERATIONS.md`](OPERATIONS.md). Mark items done inline as they land; when the
list is clear, record the go-live in [`PROGRESS.md`](PROGRESS.md).

## Readiness summary

- **App / features: ready.** Tester feedback rounds 1–3 are all absorbed
  (batches A–F), there are no open items in
  [`TESTER_FEEDBACK_BATCHES.md`](TESTER_FEEDBACK_BATCHES.md), and both defects
  in [`KNOWN_BUGS.md`](KNOWN_BUGS.md) (KB-001, KB-002) were fixed 2026-09-02.
- **The rating graph, Panini album and TFH Chronicle shipped 2026-09-02**
  (ADR-047/048/049, PR #36), with migration `20260913000000_chronicle_views.sql`
  applied to hosted the same day. They are live in production and are *not*
  pending work — the earlier draft of this plan listed the album and the graph
  as out of scope, which is now wrong. **No further hosted schema migration is
  needed for launch.**
- **The gaps are operational and onboarding**, not product.
- **Two features will look sparse on day one, by design.** The rating graph
  shows one or two points per player and the Chronicle's tier-crossings block is
  omitted entirely until two snapshot weeks exist — `player_rating_snapshots`
  has only accumulated since 2026-08-30. This is expected, not a defect; both
  get better weekly. Worth knowing before someone asks in the group chat.

## 0. Decisions taken (ADR-050)

Settled with the owner 2026-09-02. Reasoning in
[`decisions.md`](decisions.md) ADR-050; the consequences are threaded through
the checklist below.

| Question | Decision |
|---|---|
| Supabase Pro ($25/mo) | **No.** Free plan, so no PITR and no managed backup |
| Custom SMTP | **No.** Password recovery stays admin-assisted (ADR-011) |
| Invite mechanism | **Unchanged** — `/admin/invites`, one token at a time, by WhatsApp DM |
| Card for joiners | **Baseline card on join** — the 2+ appearances bar does not apply to people joining |
| Invite scope | **The whole TFH WhatsApp group**, including people who never appeared on an August sheet |
| Invite timing | **Everyone Thursday 2026-09-03**, before Friday's session |
| Restore drill | **After the launch weekend** |
| Backup cadence | **Fresh backup Thursday**; ongoing cadence decided after launch |
| Archetype for joiners | **`all_rounder` default, no nudge** |

**The consequence of "no Pro", stated once.** There is no PITR and no managed
backup, so the encrypted logical dump from `scripts/backup-kut-hosted.ps1` is
the *only* route back to a known-good state for game data. That makes the
Thursday backup load-bearing rather than routine, and it means an
economy-corrupting mistake after launch costs everything since the last dump.
Vercel's instant rollback covers the app; nothing covers the database but the
dump. See §4 for what this implies if something goes wrong on the night.

## 1. Before the first wide invite

### 1.1 Onboarding & auth

- [x] **Custom SMTP: decided against** (ADR-050). `BUILD_SPEC.md` §89.1 and
      open question §4210 #5 are updated to record path 2, admin-assisted
      recovery.
- [x] **Password-recovery runbook written** 2026-09-02 —
      [`OPERATIONS.md`](OPERATIONS.md) "Member support runbooks". It also
      records the sharper reason this path is permanent: KUT holds no real email
      address for anyone, so self-service recovery is not a config away (ADR-050
      amendment).
- [x] **Auth redirect allow-list narrowed** 2026-09-02 to
      `https://kut-*-vibetrunk.vercel.app/**`; the team-wide
      `https://*-vibetrunk.vercel.app/**` is gone. Three entries remain:
      production, that pattern, and `http://localhost:3000/**`.
- [x] **Re-confirmed** 2026-09-02: public self-sign-up disabled, anonymous
      sign-ins disabled, Email the only enabled provider, Site URL
      `https://kut.vibetrunk.com`. The "Confirm email" toggle is on and is
      harmless — invited accounts are created pre-confirmed through the
      service-role admin API, so no mail is ever attempted.
- **Standing rule — invite tokens go by DM only, never into the group chat.**
      Not a task to tick; a rule that holds all evening. Tokens are
      single-use, player-bound and valid 14 days; one posted to a group would
      let the wrong person claim someone else's identity and card. If it
      happens, the fix is `/admin/links` → `admin_set_profile_player` to
      unlink and relink. Put the rule in the launch-night notes, not just here.

### 1.2 Data safety

- [x] **Fresh backup taken 2026-09-02 16:23** —
      `kut-backup-20260902-162326.sql.enc`, round-trip integrity check passed,
      logged in `.private-backups/BACKUP_LOG.md`. With no PITR this is the
      launch's safety net. It predates Thursday's roster work, which is the
      correct shape for a rollback point; optionally take a second one *after*
      the Player rows exist and before the invites go out, so a restore does not
      also mean re-creating twenty rows by hand.
- [x] **Restore drill: deferred to after the launch weekend** (ADR-050). The
      2026-08-30 drill passed, and the only schema change since is two additive
      views. Re-drill once real member data is in the dump, which is the more
      meaningful test. [`BACKUP.md`](BACKUP.md) asks for one "before the first
      invite" — this is a conscious deviation, recorded here.
- [x] **`player-photos` bucket gap accepted in writing — this bullet is the
      acceptance.** Storage objects are not in the SQL dump
      ([`BACKUP.md`](BACKUP.md)). Photos are re-uploadable by their owners at
      `/settings/card`, so losing the bucket costs annoyance, not game state.
      Revisit if it grows or if photos start carrying sentimental weight.
- [x] **Supabase Pro: decided against** (ADR-050).

### 1.3 Moderation & privacy

- [x] **Photo-removal procedure documented** 2026-09-02 —
      [`OPERATIONS.md`](OPERATIONS.md) "Member support runbooks". Ask the member
      to remove it themselves first; otherwise null `kut.players.photo_path` in
      Studio *and* delete `players/<player_id>/profile.webp` from the bucket.
      Note the one-hour signed-URL TTL: an already-issued link stays fetchable
      until it expires. ADR-027's consent toggle and admin moderation UI remain
      open ([`ROADMAP.md`](ROADMAP.md) one-off items) and are the proper fix.

### 1.4 Robustness (optional, safe to defer)

- [ ] **Scheduled `expire_trade_offers`.** Offer expiry is a lazy sweep on
      `/market` page loads today (ADR-042); a cron makes it robust for a larger
      population. Self-healing without it — still fine to defer.

## 2. Player card database (the roster)

No reset. Card editions are referenced by `user_cards`, `market_sales` and
`pack_opening_cards` with `ON DELETE RESTRICT`; wiping them is impossible
without destroying the economy. Grow the roster, don't reset it.

- [x] **The "2+ appearances before a card" rule does not apply to joiners**
      (ADR-050). It was an *import* policy for backfilled attendance sheets,
      not a spec rule; `BUILD_SPEC.md` Part 137 now says so. Anyone who joins
      gets a Player at the 30 OVR / common baseline, so their own card is in
      their album on day one.
- [ ] **Create Player rows for every invitee who does not have one.** Since the
      invite scope is the whole WhatsApp group, this covers two sets:
      the ~11 August single-appearance names (Bader, Souhail, Meral, Maikel,
      both "Nick"s, Xander, Zak, Jurie, Cormac, Peter) **and** anyone in the
      group who has never attended. `kut.admin_add_player` via `/admin/roster`
      does the whole job in one transaction — inserts the player, mints their
      Live edition, runs the rebuild. **Invites are player-bound, so every row
      must exist before its invite can be issued.** This is the bulk of
      Thursday's work; the 25 already on the roster need nothing.
- [x] **The two "Nick" placeholders are a non-item.** Friday 07.08's sheet
      listed "Nick" twice and both were excluded from the import, so no such
      rows exist and there is nothing to rename. What remains is a naming call
      at row-creation time: if two people in the group both go by Nick, give
      them distinguishing display names, because `/admin/invites` picks players
      by display name and two identical entries are a coin flip.
- [x] **Do not backfill new members into past August sessions** (ADR-050). A
      correction that adds them also back-pays 250 KUT Coins per session — an
      unplanned faucet against the Part L invariants. Joiners accrue from the
      next published session, which is Friday's.
- [x] **Archetype: `all_rounder` default, no nudge** (ADR-050). Self-service
      stays available at `/settings/card`. Note that reassigning an *existing*
      player's archetype triggers a rating rebuild — data-changing tier, so not
      launch work.

## 3. Accounts — no blanket reset

- [x] **Do not reset accounts wholesale** (ADR-050). `kut.admin_reset_account`
      is per-user and idempotent; there is no bulk path and only a handful of
      real accounts exist. Everyone is on the same 250/session faucet from
      go-live regardless, so an early tester's small head start is minor and
      arguably earned.
- [ ] **Offer a voluntary reset** to any tester who wants to start clean with
      the group. Reset involuntarily only accounts left in a deliberately junk
      state (spammed test trades, etc.). Record the decision if used.
- [x] **No season / ratings reset** (ADR-050). There is no season-rollover
      feature, ratings already reflect real attendance, and new members
      correctly start at 30 OVR / common. A clean competitive restart would
      need its own ADR and is not a launch task.

## 4. If something goes wrong

Worth deciding before the night rather than during it.

- **App-level breakage** (a bad page, a broken route): roll back the Vercel
  deployment. Instant, no data implications.
- **Data-level breakage** (a wrong correction, a bad admin action): there is no
  PITR. The options are a targeted fix — most admin operations are reversible
  by design, and `admin_adjust_wallet` is an audited faucet — or a restore from
  Thursday's dump, which loses everything since. Prefer the targeted fix, and
  prefer doing nothing over guessing.
- **Do not change economy formulas during launch weekend.** A single unusual
  outcome is not a signal ([`OPERATIONS.md`](OPERATIONS.md) Alpha operations).
- **Name the support channel** before inviting — where "I'm stuck" goes and who
  answers it. With ~30 people arriving at once and no self-service password
  reset, this will get used.

## 5. Sequencing

**Wednesday 2026-09-02 — done.**

- ✅ Documentation backfill for the shipped features (ADR-047/048/049/050,
  `PROGRESS.md`, `BUILD_SPEC.md` §41 / Part XVII §46 / Part 137, ROADMAP status,
  both hosted-deploy records) — KUT PR #37, catalogue PR #23.
- ✅ Auth redirect allow-list narrowed; self-sign-up, anonymous sign-ins,
  providers and Site URL all re-confirmed.
- ✅ Password-recovery runbook and photo-removal procedure written
  ([`OPERATIONS.md`](OPERATIONS.md)); launch messages drafted (Appendix A);
  ADR-050 amended with the identity-model consequence.
- ✅ **Production smoke-tested as a logged-in member** — pulled forward from
  Thursday. The album, Chronicle and graph were exercised by a real account the
  day they shipped.
- ⛔️ Dropped: resolving the two placeholder "Nick" identities. No such rows
  exist — both were excluded from the import — so there is nothing to rename.
  If two people in the group both go by Nick, give them distinguishing display
  names when their rows are created, because `/admin/invites` picks players by
  display name.

**Thursday 2026-09-03 — the working evening:**

1. **Fresh backup** (`scripts/backup-kut-hosted.ps1`), logged.
2. Create Player rows for every invitee not already on the roster. Expect this
   to be the slow part: `admin_add_player` runs a full season rebuild per call,
   so do it in one sitting *before* the invites rather than interleaved with
   them.
3. Generate and DM invite tokens — one at a time, individually, never in the
   group.
4. Post the group announcement and the FAQ (Appendix A).

**Friday 2026-09-04 — session day:**

- Mop up anyone who did not claim their invite; issue replacements as needed.
- Play.
- **Publish the session's attendance the same evening.** This is the payoff:
  every new member gets 250 KUT Coins, their first rating movement, and the
  week's Chronicle issue appears. Publishing promptly is what makes day one
  feel like a game rather than a signup form.
- Record the go-live in [`PROGRESS.md`](PROGRESS.md).

**First two weeks:** watch `/admin/economy`, market liquidity, failed-action
reports and feedback. Run the restore drill. Decide the ongoing backup cadence
([`BACKUP.md`](BACKUP.md) has an unattended scheduled-task recipe). Do not
change formulas after a single unusual outcome.

## 6. Explicitly out of scope for launch

Tracked in [`ROADMAP.md`](ROADMAP.md), not blockers: "Store" / more pack types,
duplicate-copy Club Value weighting, "Real-life play → ratings" (goals + kudos
survey), the KUT Five Cup, market auctions, an in-app FAQ page, prestige and
collection rewards, wanted-card lists, and the Chronicle's reserved club-desk
and kudos blocks.

## Appendix A — Launch messages

Drafts to copy into WhatsApp. Two audiences: the group, and each person
individually with their own invite link. The numbers below are the live ones —
starter grant 250 KUT Coins, attendance reward 250 per published session
(ADR-029), bibs bonus 100, basic pack 250.

### A1. The group announcement

> ⚽ **KUT is live** — Kelderklasse Ultimate Team.
>
> It's a card game for TFH. Everyone who plays has their own player card, and
> your card gets better by *showing up* — every session I publish moves the
> ratings. You collect cards of the rest of us, open packs, and trade.
>
> You'll each get a personal invite link from me in a DM. **Don't forward it** —
> it's tied to your own card, and whoever opens it first becomes you.
>
> How it works: https://kut.vibetrunk.com/how-it-works
>
> Questions in here, or DM me.

### A2. The individual invite DM

Send one per person, with their own link. Never paste a link into the group.

> Here's your personal KUT invite 👇
> `<invite link>`
>
> It's just for you — don't forward it. Pick a username and a password of at
> least 12 characters. There's no email involved, so **write your password down
> somewhere**: if you lose it I have to reset it by hand.
>
> You'll start with 250 KUT Coins and a few cards. See you Friday.

### A3. Short FAQ

Post after the announcement, or keep it to answer questions as they come.

> **Do I need to download anything?**
> No, it's a website. Open it in your phone browser and add it to your home
> screen if you want.
>
> **Why does it want a username instead of my email?**
> KUT doesn't use email at all. You pick a username and a password. Nothing gets
> sent to you and I don't store an address for you.
>
> **I forgot my password.**
> Message me and I'll set a new one for you. There's no reset email — that's the
> trade-off for not collecting addresses.
>
> **How do I get a better card?**
> Turn up. Attendance is what drives your rating. You can't buy your way to a
> better card, and playing badly never costs you anything.
>
> **How do I get coins?**
> 250 to start, 250 every session you're marked present, and 100 for bringing
> the bibs. You also get coins from selling cards.
>
> **What do I spend them on?**
> Packs are 250 and contain cards of other TFH players. You can also buy cards
> directly from other people on the market, or offer them a swap.
>
> **Can I see other people's collections?**
> No — on purpose. You can see everyone's *ratings* and what's for sale, but not
> who owns which cards.
>
> **My card photo is wrong / I want it gone.**
> Change or remove it yourself under Settings → Card. Ask me if you want a hand.
>
> **My graph is nearly empty.**
> Rating history only started recording a few days ago, so everyone's is short
> right now. It fills in a week at a time.
>
> **Something's broken.**
> Tell me what you were doing and send a screenshot.

### A4. What not to say

- Do not post any invite link, temporary password, or username in the group.
- Do not promise features from `ROADMAP.md` — the Cup, the kudos survey, the
  store and prestige rewards are unbuilt and several may never be built.
- Do not claim the market has liquidity on day one. Nobody has anything to sell
  until people open packs.
