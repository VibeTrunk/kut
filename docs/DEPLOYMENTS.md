# Hosted deployment log

Every migration applied to the hosted `kut` schema, **newest first**: what it
changed, its risk tier, the backup it rode, the `migration list --linked`
counts before and after, the hosted smoke test, and how to roll it back.

Hosted migrations are catalogued and pushed only from
[`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase); the process is
the risk-tiered checklist in `OPERATIONS.md`. This file is KUT's record of what
landed and how it was checked. `CLAUDE.md` names only the latest applied
migration and links here.

Deploys before 2026-08-30 (the 2026-08-17 alpha, the roster and formula
updates, the admin roster RPCs, the ADR-027..030 batch) are recorded in the
dated "Hosted deployment…" entries in `PROGRESS.md`.

**Adding an entry:** put it at the top as `## <date> — <migration> <what> (ADR)`,
then bump the "Latest hosted migration" line in `CLAUDE.md`. Record the tier,
backup id, pre/post `migration list` counts, the smoke row, and the rollback.

## 2026-09-26 — Midweek Madness switched on (operational, no migration)

The launch of Midweek Madness (PR 9 of the build, BUILD_SPEC §44.8): no
migration, an external mutation of production, performed by the owner.

- **Rehearsal first.** The owner ran `admin_midweek_rehearsal` three times on
  `/admin/midweek` with the switch off and no week open (it writes nothing).
  Each run: a field of **22**, matching an independent SQL count of members
  not disabled, not opted out (0 opted out) and owning an unburned card; 0
  picked and 22 auto squads; a **32-slot, 5-round** bracket with **10 byes and
  6 matches** in round 1, then 8 · 4 · 2 · 1; pay per win 17 · 33 · 50 · 67 ·
  83; reveals 20:30 to 22:30. A different real champion each run (Jurie,
  Melle, Cedric). Warnings, info only: no tournament open (everyone auto) and
  the switch paused. No club-break warning: the session of 2026-09-21 is
  published.
- **Backup.** A fresh cold-verified backup, `20260926-102414`, before the
  switch, because switching on starts the coin faucet (ADR-096; the first
  final pays up to 953 coins).
- **The switch failed on the first try:** KB-024, fixed by `20261007000000`
  (entry below) before the launch went on.
- **Switched on 2026-09-26 by the owner** in `/admin/midweek`. The next page
  visit ran the lazy trigger, which opened the first week: **week_start
  2026-09-28, locking Wed 30 Sep 20:00 Amsterdam**, status `open`, the seed
  secret and a 64-character seal published. Checked: `/admin/midweek` shows
  it open, Home shows "Pick your five · Wed 30 Sept", and an ordinary member
  sees the picker on `/club/midweek`; in the SQL editor (tables, not the gated
  views) the switch is on and one tournament exists, as expected.
- **Rollback, in order of severity:** pause the switch (no new weeks; an open
  week still runs, §44.8); void an open or simulated week before payout at
  `/admin/midweek?void=1`, with a reason members read; after payout, correct a
  member with the audited `admin_adjust_wallet`. Nothing re-runs a week. The
  backup above is the last resort.

## 2026-09-26 — `20261007000000` the Midweek switch names its row (KB-024)

Deployed 2026-09-26 from `VibeTrunk/supabase` (catalogue PR #56 there), on its
own additive `db push`:

- `20261007000000_midweek_switch_where.sql` (BUILD_SPEC §44.8, ADR-095,
  KB-024, KUT PR #131, tier additive) &mdash; the launch switch through the API.
  - **What changed.** `kut.admin_set_midweek_enabled` re-created with `where
    id`. Its `UPDATE` of the single-row `kut.midweek_config` had no `WHERE`,
    and PostgREST's `authenticator` role preloads `safeupdate`, which rejects
    that (21000), so the owner's first flip on `/admin/midweek` failed.
    Otherwise identical: checks, errors, grants, return value.
  - **No DML.** It rode the fresh backup taken for the launch,
    `20260926-102414`, cold-verified. Pre-push `migration list --linked`
    showed 77 entries with `20261007000000` the only local-only one and no
    remote-only drift, the dry run named exactly that file, and the catalogue
    check reported 77 approved source migrations. Afterwards it showed 77
    entries, all present locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `true | 0 | false | true | true | false | 0`, identical to the local run,
    confirmed:
    - the function names its row;
    - no `kut` function updates or deletes without a `WHERE`;
    - `anon` cannot execute it, `authenticated` can, and it is still
      security definer;
    - the switch was still off, with no tournament.

    The owner's flip then succeeded (entry above).
  - **Deploy ordering** was safe: KUT PR #131 changes no app code.
  - Rollback: re-create the function from `20261005000000` section 6 (the
    switch is then unusable through the API again).

## 2026-09-26 — `20261006000000` Midweek Madness payouts (ADR-096)

Deployed 2026-09-26 from `VibeTrunk/supabase` (catalogue PR #54 there), on its
own data-changing `db push`:

- `20261006000000_midweek_payouts.sql` (BUILD_SPEC §44.7, §44.14, Part L #26,
  ADR-096, KUT PR #127, tier data-changing) &mdash; Midweek Madness migration
  D: the coins.
  - **What changed.** `wallet_ledger_reason_check` re-created with
    `midweek_win` and `user_notifications_event_type_check` with
    `midweek_result`; the guard table `kut.midweek_rewards` (RLS on, only
    `service_role` select) with its Part L #26 trigger; the internal payout
    `kut._mm_pay_tournament`; `kut._mm_complete_tournament` re-created to pay
    before a week completes; the member view `kut.my_midweek_rewards`.
  - **No DML.** Nothing pays until a tournament exists, which needs the switch,
    still off. Data-changing because it adds a coin faucet and widens the
    ledger, so it took a fresh backup, `20260926-052453`, cold-verified in a
    separate process. Pre-push `migration list --linked` showed 76 entries with
    `20261006000000` the only local-only one and no remote-only drift, the dry
    run named exactly that file, and the catalogue check reported 76 approved
    source migrations. Afterwards it showed 76 entries, all present locally and
    remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `true | tournament_id,week_start,round_no,match_id,bye,amount,paid_at | true | true | 1 | true | false | false | true | 17,33,50,67,83 | false | 0 | 0`,
    identical to the local run, confirmed:
    - RLS is on for the rewards table, and the member view has its columns in
      order;
    - both constraints carry the new value after every earlier one;
    - the guard trigger is in place and the complete step calls the payout;
    - members can neither pay nor read the table, but can read the view;
    - the hosted payout for five rounds is `17 · 33 · 50 · 67 · 83`;
    - the switch is off, no tournament exists, and no `midweek_win` row.
  - **Deploy ordering** was safe: KUT PR #127 only labels `midweek_result` in
    the inbox and adds a constant.
  - Rollback: as in the migration header, with the switch off and nothing
    simulated or completed since.

## 2026-09-26 — `20261005000000` Midweek Madness engine (ADR-090, ADR-091, ADR-095)

Deployed 2026-09-26 from `VibeTrunk/supabase` (catalogue PR #52 there), on its
own additive `db push`:

- `20261005000000_midweek_engine.sql` (BUILD_SPEC §44.3–§44.11, §44.14, Part L
  #25, ADR-095, KUT PR #125, tier additive) &mdash; Midweek Madness migration C:
  the engine, the lazy worker, the stored result, the reveal views and the
  admin controls. No coins yet.
  - **What changed.** The engine as internal `kut._mm_*` functions; six result
    tables (entries, entry cards, pick shares, matches, match events, the
    worker log) with RLS on and only `service_role` select; eight Part L #25
    guard triggers; `voided_at` and `voided_by` on `kut.midweek_tournaments`;
    the service-role worker `kut.run_midweek_due`; five gated views
    (`midweek_matches_public`, `midweek_events_public`,
    `midweek_entries_public`, `midweek_pick_shares_public`,
    `midweek_admin_overview`); `champion_user_id` and `champion_name` appended
    to `midweek_tournaments_public`; the admin RPCs
    `admin_set_midweek_enabled`, `admin_void_midweek` and
    `admin_midweek_rehearsal`.
  - **No DML.** The worker writes only once a tournament exists, which needs
    the switch, still off. It rode the latest scheduled backup
    (`20260923-112450`, cold-verified). Pre-push `migration list --linked`
    showed 75 entries with `20261005000000` the only local-only one and no
    remote-only drift, the dry run named exactly that file, and the catalogue
    check reported 75 approved source migrations. Afterwards it showed 75
    entries, all present locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `6/6 | 5/5 | champion_name | 8/8 | false:false:true | false | true | true | false | 0`,
    identical to the local run, confirmed:
    - the six tables and five views exist;
    - the tournament list ends with `champion_name`;
    - all eight guard triggers are in place;
    - only `service_role` can run the worker, and members cannot run the engine;
    - the hosted engine reproduces a golden draw and the golden lock time for
      the week of 2026-10-26, so the time zone data agrees with the TypeScript
      twin;
    - the switch is off and no tournament exists.
  - **Deploy ordering** was safe: KUT PR #125 has no UI.
  - Rollback: as in the migration header, with the switch off and no
    tournament simulated.

## 2026-09-25 — `20261004000000` archetype cooldown (ADR-089, ADR-094)

Deployed 2026-09-25 from `VibeTrunk/supabase` (catalogue PR #50 there), on its
own additive `db push`:

- `20261004000000_archetype_cooldown.sql` (BUILD_SPEC §44.2, §44.14, ADR-094,
  KUT PR #122, tier additive) &mdash; Midweek Madness migration B: a member may
  change their own Player's archetype at most once every 14 days.
  - **What changed.** A nullable column, `kut.players.archetype_changed_at`,
    with no default. `kut.set_own_player_archetype(text)` now locks the Player
    row, refuses a change within 336 hours of the stamp (`22023`, next allowed
    moment in the DETAIL) and stamps `now()` on an actual change. Grants
    unchanged. The admin path is untouched.
  - **No DML**, nothing backfilled, so every member's first change is allowed.
    It rode the latest scheduled backup (`20260923-112450`, cold-verified).
    Pre-push `migration list --linked` showed 74 entries with `20261004000000`
    the only local-only one, and the dry run named exactly that file.
    Afterwards it showed 74 entries, all present locally and remotely, no
    drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row,
    `timestamp with time zone:YES:none | 0 | true | true | false | true`,
    confirmed:
    - the column is a nullable timestamptz with no default;
    - no Player is stamped yet;
    - the function is definer and carries the guard and the row lock;
    - `anon` cannot execute it and `authenticated` can.
  - **Deploy ordering** was safe: `/settings/card` reads the column in its own
    query and treats a missing one as "never changed", so the merge deployed
    ahead of the push harmlessly. The rule applies from the push.
  - Rollback: re-create `kut.set_own_player_archetype` from `20260906000000`,
    then drop the column, as in the migration header.

## 2026-09-25 — `20261003000000` Midweek Madness squad entry (ADR-089, ADR-091)

Deployed 2026-09-25 from `VibeTrunk/supabase` (catalogue PR #48 there), on its
own additive `db push`:

- `20261003000000_midweek_entry.sql` (BUILD_SPEC §44.14, ADR-089, ADR-091, KUT
  PR #120, tier additive) &mdash; Midweek Madness migration A, what a member
  needs to enter a weekly squad knockout. The engine, worker, reveal views and
  payouts follow as their own migrations.
  - **What changed.** Six new tables, each with RLS on and readable by
    `service_role` only:
    - `kut.midweek_config`, the launch switch, off;
    - `kut.midweek_tournaments`;
    - `kut.midweek_tournament_secrets`, the seed (ADR-091);
    - `kut.midweek_squads` and `kut.midweek_squad_cards`;
    - `kut.midweek_opt_outs`.

    Two definer RPCs for `authenticated`: `kut.save_midweek_squad(uuid[])` and
    `kut.set_midweek_opt_out(boolean)`. Three definer views gated on
    `kut.is_active_member()` (ADR-079): `kut.midweek_current`,
    `kut.midweek_tournaments_public` and `kut.my_midweek_squad`.
  - **The only DML** is the switch row in the new `kut.midweek_config`. It rode
    the latest scheduled backup (`20260923-112450`, cold-verified). Pre-push
    `migration list --linked` showed 73 entries with `20261003000000` the only
    local-only one, and the dry run named exactly that file. Afterwards it
    showed 73 entries, all present locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row confirmed:
    - all six tables have RLS on;
    - the switch row is present and off;
    - no tournament exists;
    - `anon` and `authenticated` can read none of the tables, and `anon` none
      of the views;
    - `anon` can execute neither RPC;
    - all three views are definer and gated.

    There is nothing to see in the app yet: no page reads these objects, and
    no tournament exists until the engine migration's worker ships.
  - **Deploy ordering** didn't matter here: no page reads these objects, so
    the merge deployed ahead of the push harmlessly.
  - Rollback: drop the three views, the two functions and the six tables, as
    in the migration header.

## 2026-09-23 — `20261002000000` cast on the market and pack openings (ADR-086)

Deployed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #46 there, marked
applied in #47), on its own additive `db push`:

- `20261002000000_cast_on_market_and_packs.sql` (ADR-086, KUT PR #108, tier
  additive) &mdash; the market and pack openings carry the card's Player, so an
  injured Player's Live card shows the plaster cast there too. With PR #107
  (ADR-085), every card screen now follows one rule: a Live card of a Player in
  injury mode right now.
  - **What changed.** `kut.active_market_listings` and
    `kut.my_pack_opening_results` gain `player_id` and `is_live` as their last
    two columns. Each body is copied from its latest version. Access is
    unchanged: the market keeps its `kut.is_active_member()` gate, and the pack
    view stays a `security_invoker` view over the member's own openings. It was
    never ADR-079 gated and doesn't need to be: ADR-086 explains why a disabled
    member reading their own pack history is not a gap.
  - **Zero DML**, so it rode the latest scheduled backup (`20260923-112450`,
    cold-verified). Pre-push `migration list --linked` showed 72 entries with
    `20261002000000` the only local-only one, and the dry run named exactly that
    file. Afterwards it showed 72 entries, all present locally and remotely, no
    drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row confirmed:
    - both views end in `player_id, is_live`
    - the market view is still definer and gated
    - the pack view is still invoker
    - no `anon` select on either
    - `kut.my_wanted_cards` still resolves

    In the app, `/market` loads normally. No Player is in injury mode on hosted
    today, so the cast itself hasn't been seen there. Locally it was checked on
    the market list, a listing page and a pack result.
  - **Deploy ordering held.** The pages read both views with `select("*")` and
    shipped on merge, before the push. Checked locally against the old views,
    they render with no cast and no error in that window.
  - Rollback (optional, the columns are harmless): drop and re-run
    `kut.my_wanted_cards` and `kut.active_market_listings` from
    `20260928000000` / `20260920060000`, and `kut.my_pack_opening_results` from
    `20260902000000` block 5, as in the migration header.

## 2026-09-23 — `20261001000000` Comeback Form (ADR-083)

Deployed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #44 there, marked
applied in #45), on its own `db push`:

- `20261001000000_injury_comeback_form.sql` (ADR-083, KUT PR #102, tier
  data-changing) &mdash; **Comeback Form**, the second slice of injury mode. The
  first published v2 session a Player attends after an injury period with at
  least 3 protected weeks carries `least(2, 0.25 × protected_weeks)` Form,
  ageing like a session input under the Form cap of 8. Only weeks before the
  return week count, only the first return counts, and periods ending in the
  same return are summed once.
  - **New objects.** `kut.comeback_form_inputs` holds derived rows:
    `kut._rebuild_season_core` deletes and re-derives them from check-ins and
    attendance on every rebuild, like `player_rating_snapshots`. Members read it
    under `kut.is_active_member()`. The rebuild is re-emitted with that
    derivation and a union into the v2 session inputs.
    `kut.player_form_contributions` unions the comeback rows in, with `source`
    and `protected_weeks` appended. The rating story lists a comeback as its own
    row, and the pages read the view with `select("*")`.
  - **Zero DML.** Pushed on a fresh cold-verified backup (`20260923-112450`,
    0 escrowed cards). Pre-push `migration list --linked` showed 71 entries with
    `20261001000000` the only local-only one, and the dry run named exactly that
    file. Afterwards it showed 71 entries, all present locally and remotely, no
    drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row confirmed:
    - the table exists, with RLS on and its one policy
    - no `anon` select
    - zero rows
    - both engine guards
    - both appended view columns

    In the app, Freek's "Why this rating" story still lists three sessions that
    sum to the stated 2.31 Form and +2 OVR, read through the new `select("*")`.
    No comeback row can appear until someone on hosted returns from injury mode
    with 3+ protected weeks.
  - Rollback: `drop view kut.player_form_contributions`, because
    `create or replace` cannot drop the appended columns. Then re-run its
    `20260926000000` block, re-run the `20260930000000` rebuild body, drop the
    table and rebuild the active season.

## 2026-09-23 — `20260930000000` injury mode (ADR-082)

Deployed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #42 there, marked
applied in #43), on its own `db push`:

- `20260930000000_injury_protection.sql` (ADR-082, KUT PR #100, tier
  data-changing) &mdash; **injury mode**. An admin puts a Player with an active
  account into injury mode from `/admin/roster`. Each football week the Player
  sits out, the member does a rehab check-in from Home: +100 KUT Coins, and that
  week's Activity carries over instead of decaying &times;0.90. Form still
  fades, a 🩹 chip marks the Player's Live cards, and injury mode ends by itself
  when the Player attends a published session dated after the injury date.
  Protection is never backdated (owner decision).
  - **New objects.** Tables `kut.injury_periods` (admin-read only; the note may
    hold medical detail) and `kut.injury_check_ins` (primary key
    `(player_id, week_start)`: the stipend's idempotency guard and the only fact
    the rebuild reads). Six functions, the `kut.injured_players` projection gated
    on `kut.is_active_member()`, and a notice trigger on `kut.match_sessions`.
    `wallet_ledger` gains the `injury_stipend` reason and `user_notifications`
    the `injury_check_in` type. Part L #24.
  - **`kut._rebuild_season_core` was re-emitted** with one protected-week guard.
    Its output does not change until a check-in row exists: on the local data a
    rebuild before and after gave zero differences.
  - **Zero DML.** Pushed on a fresh cold-verified backup (`20260923-105756`,
    0 escrowed cards), as the tier requires. Pre-push
    `migration list --linked` showed 70 entries with `20260930000000` the only
    local-only one, and the dry run named exactly that file. Afterwards it showed
    70 entries, all present locally and remotely, no drift.
  - **Smoke-tested on hosted.** In the SQL editor, one row confirmed:
    - both tables, with RLS on
    - all six functions, the view and the trigger
    - both widened check constraints
    - the engine guard
    - no `anon` execute on `kut.injury_check_in`
    - zero injury periods

    In the app, `/admin/roster` shows the Injury column and Home renders
    normally. The code had shipped ahead of the schema (Vercel deploys on merge),
    and every new read is written to degrade gracefully, so there was no PR #86
    style breakage in between.
  - **Operator note.** Like the ADR-079 views, `kut.injured_players` is gated on
    `kut.is_active_member()`, so a bare `postgres` session in the SQL editor
    reads zero rows from it. Query `kut.injury_periods` directly instead.
  - Rollback: the reverse DDL is in the migration header. It drops the trigger,
    view, functions and both tables, re-runs the `20260920000000` rebuild body,
    and narrows both check constraints after deleting rows that use the new
    values. Once those check-in rows are gone, protected weeks decay again on
    the next rebuild.

## 2026-09-23 — `20260929000000` rating-rules RLS (ADR-081)

Deployed 2026-09-23 from `VibeTrunk/supabase` (catalogue PR #40 there), on its
own additive `db push`:

- `20260929000000_season_rating_rules_rls.sql` (ADR-081, KUT PR #98, tier
  additive/access-only) &mdash; `kut.season_rating_rules` gets RLS and one
  policy, `"active members read rating rules"`: `for select to authenticated
  using (kut.is_active_member())`. This was the last `kut` table with RLS off,
  and the last open item from the 2026-09-16 Security Advisor review. Grants
  are unchanged and there is no write policy, so writes stay refused by the
  missing grant.
  - **No `FORCE`.** The three `security definer` paths (the season rebuild and
    the publish-versioning and season-seeding triggers) run as the table's owner
    and keep working through the owner bypass. Measured locally, `FORCE` would
    not break them either, because `postgres` has `BYPASSRLS`. It is left off
    anyway, so those paths rest on ownership rather than on a platform role
    attribute.
  - **Zero DML**, so it rode the latest scheduled backup, `20260922-214356`,
    cold-verified. Pre-push `migration list --linked` showed 68 entries with
    `20260929000000` the only local-only one, and the dry run named exactly that
    file. Afterwards it showed 69 entries, all present locally and remotely, no
    drift.
  - **Smoke-tested on hosted.** In the SQL editor: `relrowsecurity = true`,
    `relforcerowsecurity = false`, the one policy exactly as written, and grants
    unchanged (`SELECT` for `authenticated` and `service_role`, nothing for
    `anon`). The schema-wide check returned no `kut` table without RLS. In the
    app, a superadmin on `/admin/attendance` still sees "This date uses member
    reports" for a post-cutover date. That check is discriminating:
    `sessionUsesMemberReports()` returns `false` when the cutover is missing, so
    a hidden row would have shown the admin-goals wording instead of an error.
    The remaining check, that the next session publishes and finalizes normally,
    waits for a real session.
  - **Operator note.** Like the ADR-079 views, a denied read here returns zero
    rows, not an error. A bare `postgres` psql session is unaffected, because
    that role bypasses RLS.
  - Rollback: `drop policy "active members read rating rules" on
    kut.season_rating_rules; alter table kut.season_rating_rules disable row
    level security;`. Grants are unchanged, so none need re-granting.

## 2026-09-22 — `20260928000000` active-member projection gate (ADR-079)

Deployed 2026-09-22 from `VibeTrunk/supabase` (catalogue PR #36 there, marked
applied in #39), on its own additive `db push` immediately after the one below:

- `20260928000000_active_member_projection_gate.sql` (ADR-079, closing KB-017,
  tier additive/projection-only) &mdash; every member-only definer projection
  now proves an active KUT profile. New `kut.is_active_member()`
  (`stable security definer`, `search_path = kut, pg_catalog`) gates all ten
  `security_invoker = false` views. `security definer` is required: `kut.profiles`
  RLS lets a member read only their own row, so an invoker-rights probe could
  never prove a *foreign* caller has no profile. The service role passes through
  two disjuncts, one per transport &mdash; `auth.role()` for a service-key JWT,
  which carries no `sub`, and `current_setting('role', true)` for a bare
  `set role service_role` session. `current_user` and
  `pg_has_role(session_user, 'service_role', 'member')` are recorded in ADR-079
  as traps: the first is the function *owner* inside a definer body and the
  second is true for everyone, so either would have shipped a no-op that looked
  fixed.
  - **Nothing was flipped to `security_invoker = true`.** That is the Security
    Advisor's generic remedy and it is how KB-013 blacked out the Chronicle;
    these are deliberate cross-RLS club projections.
  - Each view body is copied byte-identically and wrapped as
    `select * from ( &hellip; ) gated where kut.is_active_member()`, because the
    risk was transcription across ten bodies and six source files rather than
    semantics &mdash; and a wrapper makes it structurally impossible for
    `create or replace view` to change a column's name, order or type. `EXPLAIN`
    shows `One-Time Filter`, so a denied caller never executes the body.
  - **Zero DML**, so it rode the backup taken for `20260927000000`
    (`20260922-204443`). Afterwards `migration list --linked` showed 68 entries,
    none pending, no remote-only drift.
  - **Smoke-tested as an ordinary member, which is the only test that counts
    here**: the failure mode is an empty screen, not an error. Home (activity
    feed, Club Value, leaderboard), `/market`, `/leaderboard`, `/club/value`,
    `/market/offers` and a finalized Chronicle issue all rendered populated.
    Under `set role service_role`, `kut.activity_feed` returned 21 rows and
    `kut.chronicle_session_reports` 66 &mdash; the latter consistent with three
    finalized surveys across the roster, so the projection the KB-013 fix
    restored is still whole.
  - **Operator note.** `kut.is_active_member()` is false for a bare psql session
    with no JWT and no `SET ROLE`. An ad-hoc query against any of these ten views
    needs `set role service_role;` first, or it reads zero rows and looks exactly
    like data loss.
  - Rollback: re-emit the ten bodies without the wrapper as
    `create or replace view` &mdash; never `drop view`, because
    `kut.my_club_value` depends on `kut.my_club_value_editions` &mdash; then
    `drop function kut.is_active_member();`. Grants are unchanged, so none need
    re-granting. Fully reversible; no data involved.

## 2026-09-22 — `20260927000000` session-report status is monotonic (ADR-078)

Deployed 2026-09-22 from `VibeTrunk/supabase` (catalogue PR #37 there, marked
applied in #38), on its own `db push`:

- `20260927000000_session_report_status_is_monotonic.sql` (ADR-078, fixing
  KB-020, tier data-changing) &mdash; a submitted session report can no longer
  regress to `draft`. `kut.submit_session_report` derives an effective intent
  from the stored row **before** any validation runs
  (`v_intent := case when v_report.status='submitted' then 'submit' else
  p_intent end`), so a `draft` call against a submitted report is an *edit that
  stays submitted*, held to the same completeness rules that earned the status.
  A guard inside the `on conflict do update` was rejected: it would have held
  the status while letting the row be rewritten under the weaker draft
  validation, leaving a submitted report with a null goal count or an
  incomplete ballot. With the intent promoted first the `on conflict` clause
  needed no change at all &mdash; the BEFORE trigger normalises
  `excluded.status`, `submitted_at` stays
  `coalesce(session_reports.submitted_at, now())`, and the table's
  `check ((status='submitted') = (submitted_at is not null))` holds in all four
  transitions. The reward insert is still `on conflict do nothing`, so nothing
  is ever paid twice.
  - **The backfill matched zero rows on hosted.** Both reconnaissance queries
    run before the push came back empty: no report sat at `status='draft'`
    beside a `session_report_rewards` row, and no survey was open. The reported
    "Draft &middot; Reward paid" row had evidently been re-submitted in the
    meantime, which restores the status and leaves the reward alone. So on
    hosted this shipped as **preventive, not corrective** &mdash; it closed the
    path rather than repairing damage. No false negative was possible: the
    query inner-joins `session_surveys` and `players`, and both keys are
    `not null` with `on delete restrict` foreign keys.
  - **Already-finalized sessions are deliberately never replayed** (owner
    decision, 2026-09-22). `kut._finalize_one_session` is re-runnable and
    `admin_correct_session_goals` calls it exactly that way, but replaying
    would move live OVR retroactively and push `finalized_at` forward. Moot in
    the event, since nothing needed repair, but the decision stands for any
    future occurrence.
  - Pushed on a fresh cold-verified backup (`20260922-204443`) rather than the
    scheduled one, because the tier follows what the file *can* do rather than
    what it happens to do on the day. Afterwards `migration list --linked`
    showed 67 entries, none pending, no remote-only drift.
  - **The UI half shipped ahead of the schema and that was safe**, unlike the
    PR #86 ordering trap: PR #91 removed the "Save draft" button once a report
    is submitted, which degrades gracefully with or without the migration. It
    also gave both buttons an explicit `type="submit"` &mdash; "Save draft" had
    none, so it was the form's default submit button and **Enter in the goals
    field regressed a submitted report with no click at all**.
  - Rollback: re-emit the pre-KB-020 body of `kut.submit_session_report`
    verbatim from `20260920000000_session_reports_rating_v2.sql:242-308`. The
    backfill is not reversible &mdash; nothing records which rows were draft
    beforehand &mdash; but it changed nothing, so there is nothing to reverse.

## 2026-09-16 — `20260926000000` trade log, rating story, listing duration (ADR-072–074)

Deployed 2026-09-16 from `VibeTrunk/supabase` (catalogue PR #34 there), on its
own additive `db push` after everything below:

- `20260926000000_trade_log_rating_story_listing_duration.sql`
  (ADR-072 + ADR-073 + ADR-074, additive) &mdash; **three features in one
  migration**, which is exceptional and authorized once (ADR-075) so the hosted
  schema was pushed once rather than three times. Zero DML: no table created or
  altered, no backfill, no economy or rating formula changed. Each section has
  its own ADR, database test and reverse DDL, and the three touch disjoint
  objects.
  - **ADR-072** &mdash; `kut.create_listing` gains `p_duration_hours`, a 24-or-72
    allow-list, default 24. The two-argument signature is **dropped** first: a
    defaulted third parameter creates an *overload*, not a replacement, which
    would have left a permanently 24-hour entry point alive. Body rebased on the
    `20260911000000` definition so the ADR-042 `held_by_offer_id` escrow guard
    survives. `expires_at` and its 24h column default already existed, and
    expiry was always enforced lazily by `expires_at > now()` predicates &mdash;
    only the value written at insert time moved, and nothing sweeps expired
    listings still.
  - **ADR-073** &mdash; `kut.activity_feed` reports a trade's whole
    consideration. The trade branch reported `coins_to_seller` while every other
    branch reports gross, so it now reports `offered_coins`; **existing trades
    display ~5% higher as a result**, with no row rewritten. `trade_offer_cards`
    was never joined, so a `left join lateral` `array_agg` adds
    `offered_card_names text[]` as the **ninth and last** column &mdash; append
    only, since `create or replace view` cannot reorder.
  - **ADR-074** &mdash; `kut.player_rating_breakdown` and
    `kut.player_form_contributions`, both `security_invoker = true` so
    `session_report_results` stays gated to finalized surveys by
    `kut.is_survey_finalized` (ADR-066); definer views would have bypassed that.
    The OVR split is derived (`live_ovr - floor(form_score + 0.5)`), not
    recomputed, so the halves reconstruct the card face by construction. The
    decay ladder is mirrored from `_rebuild_season_core` and **pinned** by
    `rating_breakdown.test.sql`, which runs the real engine and asserts the
    summed contributions equal `form_score`. Neither view may join
    `kut.session_kudos` (nominator identity) or `kut.session_surveys` (KB-013).
  - Pushed on a fresh cold-verified backup (`20260916-005721`) rather than the
    scheduled one the additive tier allows. Smoke-tested on hosted: a card lists
    for 72 hours with its real expiry, the activity feed returns rows, and a Live
    card renders its rating buildup. Rollback per section is in the migration
    header.
  - **KB-017 overlaps this.** It names `kut.activity_feed` among the definer
    projections granting `SELECT` to `authenticated` without proving an active
    KUT profile. This migration neither caused nor worsened that, but its fix
    must rebase on **this** version of the view or it will silently revert the
    gross-coins change and drop the ninth column.
  - **Deploy-ordering lesson.** Vercel production deploys on merge to `main`, so
    PR #86 shipped code expecting this schema ~2 hours before the schema
    existed: creating a listing failed (`p_duration_hours` against the old
    signature) and the activity feed rendered empty (non-critical by design).
    Nothing crashed, but a migration-bearing PR whose code cannot degrade
    gracefully needs a flag, a tolerant read, or a catalogue push ready to
    follow the merge immediately.

## 2026-09-08 — `20260925000000` kudos award notice detail (ADR-069)

Deployed 2026-09-08 from `VibeTrunk/supabase` (catalogue PR #33 there), on its
own additive `db push` after the batch below:

- `20260925000000_kudos_award_notice_detail.sql` (ADR-069, additive) &mdash;
  the `kudos_awarded` notice from ADR-063 names the categories and says where
  the OVR came from. New immutable `kut._join_names(text[])` renders a list as
  `A` / `A and B` / `A, B and C` (execute to `service_role` only; it is called
  from inside a `security definer` function). `kut._finalize_one_session` is
  `create or replace`d so that body names every recognised category in *ballot*
  order (`array_position` over `session_surveys.category_ids`, not
  `category_id`) and credits this session's goals *and* kudos for the movement
  &mdash; naming the goal count when `effective_goals > 0` ("Your 2 goals and
  these kudos lifted your card rating +3 OVR this week") and claiming no goals
  when it is not ("These kudos lifted&hellip;"). A movement of `<= 0` still adds
  no rating sentence, and no nominator is ever named. Scoring, the season
  rebuild, the `session_results` notice and the idempotency key are untouched;
  no table, constraint, grant or rating-maths change and no DML. Notices already
  written keep the old wording (the existing `on conflict &hellip; do nothing`),
  so the club sees a mix until the next session finalizes. Rollback drops the
  helper and re-runs the ADR-063 finalizer block.

## 2026-09-08 — `20260923000000` + `20260924000000` Chronicle visibility, early finalize (ADR-066, ADR-067)

Deployed 2026-09-08 from `VibeTrunk/supabase` (PR #31 + #32 there) in one
`db push`, both additive and neither changing data:

- `20260923000000_chronicle_results_visibility.sql` (ADR-066, additive) &mdash;
  fixes a live blackout (KB-013) in which only a session's attendees and admins
  could read its finalized Chronicle results; everyone who missed the session
  saw "Results finalized. No report results were recorded."
  `kut.chronicle_session_reports` ran with `security_invoker=true` and
  inner-joins `kut.session_surveys`, whose policy admits only `kut.is_admin()`
  or a member holding a `session_survey_eligibility` row, and the
  `"members read finalized results"` policy failed the same way because
  Postgres applies a referenced table's RLS inside a policy expression. The
  projection becomes `security_invoker=false`, matching its sibling
  `kut.chronicle_session_report_status`, and the policy proves finalization
  through a new `security definer` `kut.is_survey_finalized(uuid)`. Also repairs
  `submitted_reports` / `eligible_accounts` / `attendee_count`, RLS-scoped
  sub-selects that made an attendee compute "1 of 1 reports submitted". The join
  on `status='finalized'` is now the only guard keeping an open session out of
  the projection &mdash; do not drop it. Rollback restores the invoker view and
  the inline-`exists()` policy and drops the function, reinstating the blackout.
- `20260924000000_admin_finalize_session_survey.sql` (ADR-067, additive) &mdash;
  `kut.admin_finalize_session_survey(uuid, text)` lets an admin close a report
  window before its 24 hours elapse, from
  `/admin/attendance/[sessionId]/reports`. A gated front door to
  `kut._finalize_one_session`: same scoring, same `_rebuild_season_core`, same
  `session_results` / `kudos_awarded` notices &mdash; only the timing moves.
  Gated on `kut.is_admin()`, requires a 3&ndash;500 character reason, refuses a
  cancelled survey, returns `already_finalized` instead of raising on a second
  press. `kut.session_surveys` gains nullable `finalized_by` &rarr;
  `kut.profiles(id)` and `finalized_reason`; both stay null on the automatic
  path and on the re-finalization `admin_correct_session_goals` triggers, so
  null means "closed at its deadline". `closes_at` is deliberately not moved
  (the table's `check (closes_at = opened_at + interval '24 hours')` would force
  rewriting `opened_at`), so an early close reads as
  `finalized_at < closes_at`. A member who had not submitted loses the window
  and the 50-coin completion reward; rewards already earned are untouched.
  Rollback drops the function and both columns.

## `20260922000000` kudos cap and award notice (ADR-063), on the 2026-09-06 rating-v2 batch

On top of the rating-v2 / member-reporting batch (`20260916000000` &hellip;
`20260920090000`, deployed 2026-09-06 from `VibeTrunk/supabase`):

- `20260922000000_kudos_cap_two_and_award_notice.sql` (ADR-063, data-changing)
  &mdash; kudos Form ladder becomes 0 / 1 / 1.5 / 2 for 0 / 1 / 2 / 3 recognised
  categories; the combined per-session Form input cap rises 3 &rarr; 3.5
  (`session_report_results.session_input` check widened to `0..3.5`); goals and
  the +8 v2 ceiling unchanged. `user_notifications.event_type` gains
  `kudos_awarded`; `kut._finalize_one_session` is `create or replace`d to apply
  the ladder, snapshot each player's OVR before the season rebuild, and send a
  nominator-free `kudos_awarded` notice stating the OVR change. Existing
  `session_report_results` rows are re-scored and affected seasons replayed;
  raw reports, ballots, rewards, transactions and survey audit times are
  untouched. Rollback restores the narrower ladder/cap and drops the notice.

## 2026-09-04 — `20260914000000` admin self wallet grant (ADR-052)

The hosted `kut` schema was previously applied through
`20260914000000_admin_self_wallet_grant.sql` &mdash; a second,
superadmin-only coin faucet (ADR-052), deployed 2026-09-04 from
`VibeTrunk/supabase` (PR #24 + #25 there):

- `20260914000000_admin_self_wallet_grant.sql` (ADR-052, additive) &mdash;
  `kut.admin_grant_self_wallet(bigint, text, uuid)` credits/claws back the
  *caller's own* wallet (`auth.uid()`), gated to `role = 'superadmin'`.
  `kut.admin_adjust_wallet` (ADR-035) is untouched and still refuses to touch
  the caller's own wallet for every role. New audit tags
  (`wallet_ledger.reason 'admin_self_grant'`,
  `admin_account_events.action 'self_wallet_grant'`) keep self-grants
  distinguishable from admin-to-member grants; a real `p_idempotency_key`
  (backed by a partial unique index) closes a gap `admin_adjust_wallet`
  itself has. Same cap/guards as `admin_adjust_wallet` (`abs(amount) &le;
  100000`, never below zero, 1&ndash;200 char reason). No data change; rollback
  drops the function, the index, and restores the two narrower check
  constraints.

## 2026-09-02 — `20260913000000` Chronicle views (ADR-049)

On top of the TFH Chronicle read projections (ADR-049), deployed 2026-09-02
from `VibeTrunk/supabase` (PR #22 there):

- `20260913000000_chronicle_views.sql` (ADR-049, additive) &mdash; two computed
  read projections behind the Chronicle. `kut.chronicle_weeks` aggregates
  published sessions into one row per football week (session / appearance /
  attendee / goal counts); `kut.chronicle_tier_changes` runs a `lag()` over
  `kut.player_rating_snapshots` to find consecutive weeks where a player's
  rarity tier differs. Both `security_invoker = true, security_barrier = true`,
  `revoke all from public`, `grant select to authenticated, service_role`. No
  data change; rollback is two `drop view`s. Shipped alongside the Panini album
  (ADR-048) and the rating history graph (ADR-047), neither of which needed a
  migration.

## 2026-09-01 — `20260912000000` tester feedback round 2 (ADR-044)

On top of tester feedback round 2, deployed 2026-09-01 in one `db push` from
`VibeTrunk/supabase` (PR #20 there):

- `20260912000000_tester_feedback_round_2.sql` (ADR-044, data-changing for the
  backfill only) &mdash; one migration for four defects + three ideas.
  `create or replace kut.grant_bibs_reward` with the notification body reworded
  ("washing the bibs after" &rarr; "bringing the bibs to") + a scoped,
  reversible backfill of existing `bibs_bonus` `kut.user_notifications` rows;
  new `kut.set_own_club_name(text)` self-service RPC over the dormant
  `kut.profiles.club_name` column (own row, trim, blank&rarr;NULL, &le;80, no
  control chars, not unique); `kut.club_value_leaderboard` `create or replace`d
  to `coalesce` that column with the synthesised `"<name>'s Club"` default
  (`club_value` / `rank` unchanged); new additive `kut.published_sessions`
  summary view backing `/sessions`.

## 2026-08-31 — `20260909000000`–`20260911000000` tester follow-up trio (ADR-040–042)

On top of the tester follow-up trio (ADR-040/041/042), deployed 2026-08-31 in
one `db push` from `VibeTrunk/supabase` (PR #19 there), on top of Batch E:

- `20260909000000_market_listing_card_art.sql` (ADR-040, additive) &mdash;
  `kut.active_market_listings` gains `photo_path` + `seller_id` so `/market`
  renders player card art and hides Buy/Offer on the viewer's own listings.
- `20260910000000_club_value_v2.sql` (ADR-041, data-changing) &mdash; Club
  Value becomes `coins + sum(owned-card discard value) + 4 &times;
  personal-card discard-equivalent`. `kut.my_club_value` dropped + recreated
  (`card_value` &rarr; `owned_cards_value` + personal-card columns);
  `kut.club_value_leaderboard` `create or replace`d. `market_reference_value`
  kept, but only for `get_listing_bounds`.
- `20260911000000_trade_offers.sql` (ADR-042, data-changing) &mdash;
  coin + card escrow trade offers on listings. New `kut.trade_offers` /
  `kut.trade_offer_cards` tables + `kut.user_cards.held_by_offer_id`;
  `propose_trade` / `respond_to_trade` / `withdraw_trade` /
  `expire_trade_offers`; guards added to `create_listing`, `discard_card`,
  `prevent_burning_listed_card`, `cancel_listing`, `buy_listing`,
  `admin_reset_account`, `admin_prepare_account_deletion`.
  `wallet_ledger.reason` += `trade_escrow` / `trade_unescrow` /
  `trade_sale`; `user_notifications.event_type` += `trade_offer` /
  `trade_response`; `kut.activity_feed` gains a `trade` row; new
  `kut.my_trade_offers` view. Accepted trades are never written to
  `kut.market_sales` (invariant #23).

## 2026-08-31 — Batch E, `20260906000000`–`20260908000000` (ADR-036–038)

Batch E migrations (deployed 2026-08-31):

- `20260906000000_goalkeeper_archetype.sql` (ADR-036, E1 / #4) &mdash; a
  seventh `goalkeeper` archetype reusing the six shared attributes with its
  own offset row (sums to 0); widens the `kut.players` archetype `check` and
  `create or replace`s `admin_add_player` / `set_own_player_archetype` /
  `_rebuild_season_core`. No player pre-assigned.
- `20260907000000_bibs_bonus.sql` (ADR-037, E2 / #5) &mdash; a `+100` KUT
  Coins bonus for the session's bibs washer (coins only). Adds
  `kut.match_sessions.bibs_washed_by`, the `kut.bibs_rewards` guard table,
  `kut.grant_bibs_reward`, `bibs_bonus` in the `wallet_ledger.reason` and
  `user_notifications.event_type` checks, and a trailing `p_bibs_washed_by`
  on `publish_attendance_session` / `correct_published_attendance_session`
  (old signatures dropped + recreated).
- `20260908000000_activity_feed.sql` (ADR-038, E3 / #10) &mdash; a read-only
  member-wide `kut.activity_feed` view (sales + listings + pack opens +
  published sessions; sale rows expose the buyer name club-wide).

## 2026-08-30 / 31 — Batches B–D and `20260902000000` (ADR-031, ADR-033–035)

Before Batch E, also deployed 2026-08-31:
`20260905000000_admin_economy_tools.sql` (ADR-035, batch D &mdash;
`admin_adjust_wallet` audited coin faucet + `admin_reset_account` soft club
reset + the `admin_account_events` audit table),
`20260904000000_canonical_coin_name.sql` (ADR-034, batch C &mdash; "KUT
Coins" is the one currency name) and `20260903000000_drop_is_tradeable.sql`
(ADR-033, batch B &mdash; every card tradeable, `is_tradeable` dropped); and,
`20260902000000_starter_reveal_and_rating_snapshots.sql` (ADR-031, deployed
2026-08-30).
