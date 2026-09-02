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
- [ ] **Write the admin-assisted password-recovery runbook.** Now required
      rather than optional, since it is the only recovery path. Short and
      concrete: where the request arrives (WhatsApp), the admin flow
      (`/admin/accounts`, which audits through `create_password_reset_event`
      then `complete_password_reset_event`), how the new password reaches the
      member, and the rule that it is never posted in a group chat. Add it to
      `README.md` or `OPERATIONS.md` — §89.1 requires whichever path is enabled
      to be documented.
- [ ] **Narrow the Supabase Auth redirect allow-list** from
      `https://*-vibetrunk.vercel.app/**` to
      `https://kut-*-vibetrunk.vercel.app/**`
      ([`OPERATIONS.md`](OPERATIONS.md) Follow-ups, 2026-08-19). Dashboard
      change, a few minutes.
- [ ] **Re-confirm** hosted Supabase Auth still has public self-sign-up
      disabled and Site URL is `https://kut.vibetrunk.com`.
- [ ] **Invite tokens go by DM only — never into the group chat.** Tokens are
      single-use, player-bound and valid 14 days; one posted to a group would
      let the wrong person claim someone else's identity and card. If it
      happens, the fix is `/admin/links` → `admin_set_profile_player` to
      unlink and relink. Put the rule in the launch-night notes, not just here.

### 1.2 Data safety

- [ ] **Take a fresh backup Thursday, before the first invite goes out**
      (`scripts/backup-kut-hosted.ps1`). Log it in
      `.private-backups/BACKUP_LOG.md`. With no PITR this is the launch's only
      safety net — do not skip it or reuse an older one.
- [x] **Restore drill: deferred to after the launch weekend** (ADR-050). The
      2026-08-30 drill passed, and the only schema change since is two additive
      views. Re-drill once real member data is in the dump, which is the more
      meaningful test. [`BACKUP.md`](BACKUP.md) asks for one "before the first
      invite" — this is a conscious deviation, recorded here.
- [ ] **`player-photos` storage bucket** is still not covered by the SQL dump
      ([`BACKUP.md`](BACKUP.md)). Accept the gap in writing before members start
      uploading: photos are re-uploadable by their owners, so the loss is
      annoyance rather than lost game state. Revisit if the bucket grows.
- [x] **Supabase Pro: decided against** (ADR-050).

### 1.3 Moderation & privacy

- [ ] **Document a photo-removal procedure** — admin edits the player row and
      deletes the storage object. The minimum bar before ~30 people can upload
      card photos. ADR-027's photo consent toggle and admin moderation UI remain
      open ([`ROADMAP.md`](ROADMAP.md) one-off items) and are the proper fix;
      not required for launch, but the manual procedure is.

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
- [ ] **Resolve the two placeholder "Nick" rows.** Friday 07.08's sheet listed
      "Nick" twice at different skill levels and both were excluded from the
      import. They need distinguishing display names before either can be
      invited — ask in the group chat rather than guessing.
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

**Wednesday 2026-09-02 (today):**

- Documentation backfill for the shipped features (ADR-047/048/049/050,
  `PROGRESS.md`, `BUILD_SPEC.md` §41 / Part XVII §46 / Part 137, ROADMAP status,
  both hosted-deploy records). *In progress.*
- Narrow the auth redirect allow-list; re-confirm self-sign-up and Site URL.
- Ask the group chat to resolve the two "Nick" identities.

**Thursday 2026-09-03 — the working evening:**

1. **Smoke-test production as a logged-in member first.** The album, the
   Chronicle and the graph went live today and have not been exercised by a
   real account: `/club/collection` (album and `?view=manage`), `/chronicle`
   and an issue, `/players/[slug]`, plus the redirects from `/sessions` and an
   old `/sessions/[id]` link. Do this *before* the invites, not after.
2. Write the password-recovery runbook and the photo-removal procedure.
3. **Fresh backup** (`scripts/backup-kut-hosted.ps1`), logged.
4. Create Player rows for every invitee not already on the roster.
5. Generate and DM invite tokens — one at a time, individually, never in the
   group.
6. Post the group message: what KUT is, the `/how-it-works` link, that the
   invite link is personal and not to be forwarded, and where to ask for help.

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
