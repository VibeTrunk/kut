# KUT go-live plan

Date drafted: 2026-09-02. **Status: not started.**

The checklist to take KUT from closed alpha (5–10 trusted testers) to open
to everyone at Terrible Football Haarlem. It extends — does not replace — the
alpha checklist and risk-tiered migration process in
[`OPERATIONS.md`](OPERATIONS.md). Mark items done inline as they land; when
the list is clear, record the go-live in [`PROGRESS.md`](PROGRESS.md).

## Readiness summary

- **App / features: ready.** Tester feedback rounds 1–3 are all absorbed
  (batches A–F), there are no open items in
  [`TESTER_FEEDBACK_BATCHES.md`](TESTER_FEEDBACK_BATCHES.md), and both open
  defects were fixed 2026-09-02 ([`KNOWN_BUGS.md`](KNOWN_BUGS.md) KB-001,
  KB-002).
- **The gaps are operational and onboarding**, not product. They are listed
  below in the order they should be tackled.
- Nothing here needs a hosted schema migration except the optional
  trade-offer cron (§1.4) and, if chosen, a Part 137 spec amendment (§2) that
  is documentation only.

## 1. Before the first wide invite

### 1.1 Onboarding & auth

- [ ] **Decide on custom SMTP.** Today onboarding is one-at-a-time WhatsApp
      token links from `/admin/invites`, and every forgotten password is a
      manual admin-assisted reset (ADR-011). The spec calls this a pre-launch
      decision ([`BUILD_SPEC.md`](BUILD_SPEC.md) §2768, §2847; open question
      §4210 #5). Recommendation: configure a free low-volume provider
      (Resend / Brevo / Postmark) so password recovery is self-service.
      **Lead time risk:** email-domain verification needs DNS records that can
      take hours to propagate — start this several days before launch, not on
      the night. If SMTP is skipped, write the admin-assisted recovery runbook
      and expect the support load.
- [ ] **Narrow the Supabase Auth redirect allow-list** from
      `https://*-vibetrunk.vercel.app/**` to `https://kut-*-vibetrunk.vercel.app/**`
      ([`OPERATIONS.md`](OPERATIONS.md) Follow-ups, 2026-08-19). Dashboard
      change, a few minutes.
- [ ] **Re-confirm** hosted Supabase Auth still has public self-sign-up
      disabled and Site URL is `https://kut.vibetrunk.com`.

### 1.2 Data safety

- [ ] **Run the restore drill fresh.** Last run 2026-08-30
      ([`BACKUP.md`](BACKUP.md)); it wants one "before the first invite".
      Needs Docker; budget an hour or two. Log it in
      `.private-backups/BACKUP_LOG.md`.
- [ ] **Take a fresh backup immediately before the first invite wave**
      (`scripts/backup-kut-hosted.ps1`).
- [ ] **`player-photos` storage bucket** is not covered by the SQL dump
      ([`BACKUP.md`](BACKUP.md); [`ROADMAP.md`](ROADMAP.md) one-off items).
      Either add it to the backup or accept the gap in writing before real
      members start uploading card photos.
- [ ] **Decide on Supabase Pro** ($25/mo). It removes free-plan auto-pause on
      low activity and adds PITR — a real backup instead of the manual
      encrypted dump that is currently the only rollback path
      ([`BUILD_SPEC.md`](BUILD_SPEC.md) §92). This is the single biggest
      operational upgrade for going past alpha.

### 1.3 Moderation & privacy

- [ ] **Document a photo-removal procedure** (admin edits the row + deletes
      the storage object) as the minimum. ADR-027's photo consent toggle and
      admin moderation UI remain open ([`ROADMAP.md`](ROADMAP.md) one-off
      items) and are the proper fix — not required for launch, but the manual
      procedure is.

### 1.4 Robustness (optional, safe to defer)

- [ ] **Scheduled `expire_trade_offers`.** Offer expiry is a lazy sweep on
      `/market` page loads today (ADR-042); a cron (Edge Function or pg_cron)
      makes it robust for a larger population. Self-healing without it — defer
      if the launch night is tight.

## 2. Player card database (the roster)

No reset. Card editions are referenced by `user_cards`, `market_sales`, and
`pack_opening_cards` with `ON DELETE RESTRICT`; wiping them is impossible
without destroying the economy. Grow the roster, don't reset it.

- [ ] **Relax the "2+ appearances before a card" rule for launch.** Anyone
      who joins should get a Player at baseline (30 OVR / common) so they have
      a card from day one. `kut.admin_add_player` (`/admin/roster`) already
      does exactly this. Keep the 2+ bar only for migration-backfilled
      historical players. Small amendment to
      [`BUILD_SPEC.md`](BUILD_SPEC.md) Part 137 (already softened once via
      ADR-025) — documentation only, no migration.
- [ ] **Do not backfill new members into past August sessions.** A correction
      that adds them also back-pays 250 KUT Coins per session — an unplanned
      faucet. Let joiners accrue from the next published session.
- [ ] **Resolve the two placeholder "Nick" rows** from the initial import if
      either person is among the joiners — they need distinguishing display
      names (`PROGRESS.md` 2026-08-18 entries).
- [ ] **Decide the archetype default / nudge** for new players (self-service
      RPC lets them pick; goalkeeper archetype exists since ADR-036).

## 3. Accounts — no blanket reset

- [ ] **Do not reset accounts wholesale.** `kut.admin_reset_account`
      (ADR-035) is per-user and idempotent; there is no bulk path and only a
      handful of real accounts exist. A reset zeroes the wallet to 250,
      soft-burns owned cards, clears packs/notifications, re-grants the
      starter, and keeps the `attendance_rewards` guard rows — so a reset
      tester lands on the same footing as a fresh joiner. Everyone is on the
      same 250/session faucet from go-live regardless, so an early tester's
      small head start is minor and arguably earned.
- [ ] **Offer a voluntary reset** to any tester who wants to start clean with
      the group. Reset involuntarily only accounts left in a deliberately
      junk state (spammed test trades, etc.). Record the decision.
- [ ] **No season / ratings reset.** There is no season-rollover feature,
      ratings already reflect real attendance, and new members correctly
      start at 30 OVR / common. A clean competitive restart would need its
      own ADR and is not a launch task.

## 4. Sequencing

**Start several days ahead of launch night:**

- Custom SMTP + DNS verification (§1.1) — the long pole.
- Restore drill (§1.2).
- Narrow the redirect allow-list (§1.1).
- Decide the roster rule (§2) and the Pro-plan question (§1.2).
- Write the photo-removal procedure (§1.3).

**Launch night:**

- Fresh backup (§1.2).
- Add Player rows for joiners who need them; generate invites. This is the
  bulk of the evening's manual work — `/admin/invites` issues one token at a
  time. **Consider inviting in waves** (e.g. the August regulars first, then
  the rest) rather than the whole club in one sitting.
- Pin the invite instructions + `/how-it-works` link in the TFH WhatsApp;
  post a short FAQ.
- Record the go-live in [`PROGRESS.md`](PROGRESS.md).

**First two weeks:** watch `/admin/economy`, market liquidity, failed-action
reports, and feedback; do not change formulas after a single unusual outcome
([`OPERATIONS.md`](OPERATIONS.md) Alpha operations).

## 5. Explicitly out of scope for launch

Tracked in [`ROADMAP.md`](ROADMAP.md), not blockers: the Panini album view,
"Store" / more pack types, duplicate-copy Club Value weighting, "Real-life
play → ratings" (goals + kudos survey), the KUT Five Cup, market auctions,
in-app FAQ page, and the rating-over-time chart.
