begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(48);

-- Schema surface (ADR-082) -------------------------------------------------
select has_table('kut', 'injury_periods', 'the injury periods table exists');
select has_table('kut', 'injury_check_ins', 'the injury check-ins table exists');
select has_view('kut', 'injured_players', 'the injured players projection exists');
select hasnt_column('kut', 'injured_players', 'note', 'the admin note is never projected to members');
select has_function('kut', 'injury_check_in', array['date'], 'the check-in RPC exists');
select has_function('kut', 'admin_start_injury', array['uuid', 'date', 'text'], 'the start RPC exists');
select has_function('kut', 'admin_end_injury', array['uuid', 'text'], 'the end RPC exists');

-- Fixtures (created as the test superuser) --------------------------------
-- Every date is relative to the current Europe/Amsterdam ISO week, because the
-- check-in window is "this week or last week" by design.
create temp table t_weeks as
select date_trunc('week', (now() at time zone 'Europe/Amsterdam')::date)::date as w0;

update kut.seasons set is_active = false where is_active;
insert into kut.seasons (id, name, starts_on, is_active)
select '00000082-0000-4000-8000-000000000010', 'Injury Test Season', w0 - 70, true from t_weeks;
insert into kut.season_rating_rules (season_id, v2_starts_week)
select '00000082-0000-4000-8000-000000000010', w0 - 70 from t_weeks
on conflict (season_id) do update set v2_starts_week = excluded.v2_starts_week;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000082-0000-4000-8000-0000000000a1', 'inj-admin@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000082-0000-4000-8000-0000000000b1', 'inj-injured@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000082-0000-4000-8000-0000000000c1', 'inj-control@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000082-0000-4000-8000-0000000000d1', 'inj-member@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000082-0000-4000-8000-0000000000e1', 'inj-noprofile@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000082-0000-4000-8000-000000000101', 'inj-injured', 'Inj Injured', 'all_rounder'),
  ('00000082-0000-4000-8000-000000000102', 'inj-control', 'Inj Control', 'all_rounder'),
  ('00000082-0000-4000-8000-000000000103', 'inj-no-account', 'Inj No Account', 'all_rounder'),
  ('00000082-0000-4000-8000-000000000104', 'inj-admin-player', 'Inj Admin Player', 'all_rounder');

insert into kut.profiles (id, display_name, role, player_id, username)
values
  ('00000082-0000-4000-8000-0000000000a1', 'Inj Admin', 'admin', '00000082-0000-4000-8000-000000000104', 'inj_admin'),
  ('00000082-0000-4000-8000-0000000000b1', 'Inj Injured', 'user', '00000082-0000-4000-8000-000000000101', 'inj_injured'),
  ('00000082-0000-4000-8000-0000000000c1', 'Inj Control', 'user', '00000082-0000-4000-8000-000000000102', 'inj_control'),
  ('00000082-0000-4000-8000-0000000000d1', 'Inj Member', 'user', null, 'inj_member');

-- Weeks -4, -3 and -2: both players attend. Week -1: nobody. Week 0: a draft,
-- published later in the test to exercise the "no session yet" refusal and the
-- check-in-open notice.
insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at, rating_rules_version)
select id::uuid, '00000082-0000-4000-8000-000000000010', w0 + offset_days, 'monday', 'published', now(), 2
from t_weeks, (values
  ('00000082-0000-4000-8000-000000000301', -28),
  ('00000082-0000-4000-8000-000000000302', -21),
  ('00000082-0000-4000-8000-000000000303', -14),
  ('00000082-0000-4000-8000-000000000304', -7)) s(id, offset_days);
insert into kut.match_sessions (id, season_id, session_date, session_type, status)
select '00000082-0000-4000-8000-000000000305', '00000082-0000-4000-8000-000000000010', w0, 'monday', 'draft' from t_weeks;

insert into kut.attendance (session_id, player_id, goals)
select session_id::uuid, player_id::uuid, 0 from (values
  ('00000082-0000-4000-8000-000000000301', '00000082-0000-4000-8000-000000000101'),
  ('00000082-0000-4000-8000-000000000302', '00000082-0000-4000-8000-000000000101'),
  ('00000082-0000-4000-8000-000000000303', '00000082-0000-4000-8000-000000000101'),
  ('00000082-0000-4000-8000-000000000301', '00000082-0000-4000-8000-000000000102'),
  ('00000082-0000-4000-8000-000000000302', '00000082-0000-4000-8000-000000000102'),
  ('00000082-0000-4000-8000-000000000303', '00000082-0000-4000-8000-000000000102')) a(session_id, player_id);

-- A 2.00 Form input from week -2, to prove Form keeps fading while Activity is
-- protected. Two later v2 sessions age it to weight 0.50 by week 0.
insert into kut.session_surveys (session_id, opened_at, closes_at, category_ids, selection_seed, status, finalized_at)
values ('00000082-0000-4000-8000-000000000303', now() - interval '48 hours', now() - interval '24 hours',
  array['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003']::uuid[],
  gen_random_uuid(), 'finalized', now() - interval '24 hours');
insert into kut.session_report_results (session_id, player_id, effective_goals, goal_form, kudos_form, session_input, qualified_category_ids)
values ('00000082-0000-4000-8000-000000000303', '00000082-0000-4000-8000-000000000101', 1, 1.00, 1.00, 2.00,
  array['10000000-0000-4000-8000-000000000001']::uuid[]);

-- === Admin start ===========================================================
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000d1', true);
select throws_ok(
  $$ select kut.admin_start_injury('00000082-0000-4000-8000-000000000101', current_date, null) $$,
  '42501', 'admin access required', 'a member cannot start injury mode');

select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000a1', true);
select throws_ok(
  $$ select kut.admin_start_injury('00000082-0000-4000-8000-000000000103', current_date - 1, null) $$,
  'P0001', 'player has no active account', 'a player without an account cannot be put in injury mode');
select throws_ok(
  $$ select kut.admin_start_injury('00000082-0000-4000-8000-000000000104', current_date - 1, null) $$,
  '42501', 'you cannot put your own player in injury mode', 'an admin cannot switch the stipend on for themselves');
select throws_ok(
  $$ select kut.admin_start_injury('00000082-0000-4000-8000-000000000101', current_date + 30, null) $$,
  '22023', null, 'the injury date cannot be in the future');
select throws_ok(
  $$ select kut.admin_start_injury('00000082-0000-4000-8000-000000000101', (select w0 - 28 from t_weeks), null) $$,
  'P0001', 'player has played since that date', 'a date before sessions he since played is refused');

-- Injured during the week -2 session he attended: that attendance is on, not
-- after, the injury date, so it does not count as a return.
select lives_ok(
  $$ select kut.admin_start_injury('00000082-0000-4000-8000-000000000101', (select w0 - 14 from t_weeks), 'hamstring, private') $$,
  'an admin starts injury mode on the injury date');
select throws_ok(
  $$ select kut.admin_start_injury('00000082-0000-4000-8000-000000000101', (select w0 - 14 from t_weeks), null) $$,
  'P0001', 'player is already in injury mode', 'a second open period is refused');
select is(
  (select count(*)::integer from kut.user_notifications
   where user_id = '00000082-0000-4000-8000-0000000000b1' and event_type = 'admin_notice' and title = 'Injury mode on'),
  1, 'the injured member is told injury mode is on');

-- === Member check-in =======================================================
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000b1', true);
select is(
  (kut.my_injury_status() ->> 'checkable_week_start')::date,
  (select w0 - 7 from t_weeks),
  'last week is open; this week has no published session yet');
select throws_ok(
  $$ select kut.injury_check_in((select w0 from t_weeks)) $$,
  'P0001', 'this week is not open for a check-in', 'a week without a published session is not a football week');
select throws_ok(
  $$ select kut.injury_check_in((select w0 - 14 from t_weeks)) $$,
  'P0001', 'this week is not open for a check-in', 'a week older than last week is closed (and he played it)');
select throws_ok(
  $$ select kut.injury_check_in((select w0 - 6 from t_weeks)) $$,
  'P0001', 'this week is not open for a check-in', 'only an ISO Monday names a week');

select is(
  (kut.injury_check_in((select w0 - 7 from t_weeks)) ->> 'checked_in')::boolean,
  true, 'the injured member checks in for last week');

select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000c1', true);
select throws_ok(
  $$ select kut.injury_check_in((select w0 - 7 from t_weeks)) $$,
  'P0001', 'your player is not in injury mode', 'a member who is not injured cannot check in');

-- Publishing this week's first session opens the week and sends the notice.
update kut.match_sessions set status = 'published', published_at = now()
where id = '00000082-0000-4000-8000-000000000305';
select is(
  (select count(*)::integer from kut.user_notifications
   where user_id = '00000082-0000-4000-8000-0000000000b1' and event_type = 'injury_check_in'
     and reference_id = '00000082-0000-4000-8000-000000000305'),
  1, 'the injured member is told the check-in is open');
select is(
  (select count(*)::integer from kut.user_notifications
   where user_id = '00000082-0000-4000-8000-0000000000c1' and event_type = 'injury_check_in'),
  0, 'nobody else is');

select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000b1', true);
select is(
  (kut.injury_check_in((select w0 from t_weeks)) ->> 'checked_in')::boolean,
  true, 'the injured member checks in for this week');
select is(
  (kut.injury_check_in((select w0 from t_weeks)) ->> 'already_checked_in')::boolean,
  true, 'a repeat check-in is reported, not repeated');
select is(
  kut.my_injury_status() ->> 'checkable_week_start', null,
  'with both weeks done, nothing is open');
select is((kut.my_injury_status() ->> 'protected_weeks')::integer, 2, 'two weeks are protected');

select is(
  (select count(*)::integer from kut.wallet_ledger
   where user_id = '00000082-0000-4000-8000-0000000000b1' and reason = 'injury_stipend'),
  2, 'exactly one stipend ledger row per protected week');
-- The fixture attendance already paid attendance rewards, so assert the stipend
-- total and that the wallet still equals its ledger (Part L #5).
select is(
  (select sum(amount) from kut.wallet_ledger
   where user_id = '00000082-0000-4000-8000-0000000000b1' and reason = 'injury_stipend'),
  200::numeric, 'the stipend paid 2 x 100 KUT Coins');
select is(
  (select balance::numeric from kut.wallets where user_id = '00000082-0000-4000-8000-0000000000b1'),
  (select sum(amount) from kut.wallet_ledger where user_id = '00000082-0000-4000-8000-0000000000b1'),
  'the wallet still equals its ledger');

-- === The engine ============================================================
-- Both players: 14 -> 26.6 -> 37.94 over weeks -4..-2. The control then decays
-- twice (x0.81); the protected player carries 37.94 through.
select is(
  (select activity_score from kut.player_season_state
   where player_id = '00000082-0000-4000-8000-000000000101' and season_id = '00000082-0000-4000-8000-000000000010'),
  37.94::numeric, 'protected weeks carry Activity over unchanged');
select is(
  (select activity_score from kut.player_season_state
   where player_id = '00000082-0000-4000-8000-000000000102' and season_id = '00000082-0000-4000-8000-000000000010'),
  30.7314::numeric, 'an unprotected player decays x0.90 per missed football week');
select is(
  (select form_score from kut.player_season_state
   where player_id = '00000082-0000-4000-8000-000000000101' and season_id = '00000082-0000-4000-8000-000000000010'),
  1.00::numeric, 'Form is not protected: the 2.00 input has faded to weight 0.50');
select is(
  (select count(distinct live_ovr)::integer from kut.player_rating_snapshots
   where player_id = '00000082-0000-4000-8000-000000000102' and season_id = '00000082-0000-4000-8000-000000000010'
     and week_start >= (select w0 - 14 from t_weeks)),
  3, 'the control card drops each missed week');

create temp table t_snap as
select player_id, week_start, live_ovr, rarity_tier from kut.player_rating_snapshots
where season_id = '00000082-0000-4000-8000-000000000010';
select lives_ok($$ select kut._rebuild_season_core('00000082-0000-4000-8000-000000000010') $$, 'the season rebuilds again');
select is(
  (select count(*)::integer from (
     select player_id, week_start, live_ovr, rarity_tier from kut.player_rating_snapshots
     where season_id = '00000082-0000-4000-8000-000000000010'
     except select * from t_snap) diff),
  0, 'the rebuild is deterministic (Part L #16)');

-- === Club-wide projection ==================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000d1', true);
select is(
  (select protected_weeks from kut.injured_players where player_id = '00000082-0000-4000-8000-000000000101'),
  2, 'an active member sees the injured player and his protected weeks');
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000e1', true);
select is((select count(*)::integer from kut.injured_players), 0, 'a caller without a KUT profile reads nothing');
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000b1', true);
select is((select count(*)::integer from kut.injury_periods), 0, 'a member cannot read the periods table (or its note)');
reset role;

-- === Admin end =============================================================
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000d1', true);
select throws_ok(
  $$ select kut.admin_end_injury('00000082-0000-4000-8000-000000000101', 'back soon') $$,
  '42501', 'admin access required', 'a member cannot end injury mode');
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000a1', true);
select lives_ok(
  $$ select kut.admin_end_injury('00000082-0000-4000-8000-000000000101', 'fit again') $$,
  'an admin ends injury mode');
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000b1', true);
select is((kut.my_injury_status() ->> 'injured')::boolean, false, 'the member is no longer injured');
select is(
  (select activity_score from kut.player_season_state
   where player_id = '00000082-0000-4000-8000-000000000101' and season_id = '00000082-0000-4000-8000-000000000010'),
  37.94::numeric, 'ending the period keeps the weeks already protected');

-- === Returning to play ends it by itself ===================================
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000a1', true);
select lives_ok(
  $$ select kut.admin_start_injury('00000082-0000-4000-8000-000000000102', (select w0 - 7 from t_weeks), null) $$,
  'the control player gets injured last week');
insert into kut.attendance (session_id, player_id, goals)
values ('00000082-0000-4000-8000-000000000305', '00000082-0000-4000-8000-000000000102', 0);
select is(
  (select count(*)::integer from kut.injured_players where player_id = '00000082-0000-4000-8000-000000000102'),
  0, 'playing a published session after the injury date ends injury mode');
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000c1', true);
select throws_ok(
  $$ select kut.injury_check_in((select w0 - 7 from t_weeks)) $$,
  'P0001', 'your player is not in injury mode', 'a returned player cannot check in');
select set_config('request.jwt.claim.sub', '00000082-0000-4000-8000-0000000000a1', true);
select lives_ok(
  $$ select kut.admin_start_injury('00000082-0000-4000-8000-000000000102', (select w0 from t_weeks), null) $$,
  'a new injury can start after a return');
select is(
  (select end_reason from kut.injury_periods
   where player_id = '00000082-0000-4000-8000-000000000102' and started_on = (select w0 - 7 from t_weeks)),
  'returned to play', 'and the returned period is closed automatically');

select * from finish();
rollback;
