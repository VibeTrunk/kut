begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(14);

-- Schema surface (ADR-074) -------------------------------------------------
select has_view('kut', 'player_rating_breakdown', 'the rating breakdown view exists');
select has_view('kut', 'player_form_contributions', 'the form contributions view exists');

-- Fixtures (created as the test superuser) --------------------------------
update kut.seasons set is_active = false where is_active;
insert into kut.seasons (id, name, starts_on, is_active)
values ('0000000b-0000-4000-8000-000000000010', 'Rating Breakdown Test Season', date '2099-09-01', true);

-- A season-insert trigger seeds kut.season_rating_rules; force the cutover so
-- every session below is scored by the v2 rules and no legacy Form carries in.
-- The sum assertion further down only holds with zero legacy carry-over.
insert into kut.season_rating_rules (season_id, v2_starts_week)
values ('0000000b-0000-4000-8000-000000000010', date '2099-08-31')
on conflict (season_id) do update set v2_starts_week = excluded.v2_starts_week;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000b0201', 'rb-player@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000b0202', 'rb-outsider@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values ('00000000-0000-4000-8000-0000000b0101', 'rb-freek', 'RB Freek', 'all_rounder');

insert into kut.profiles (id, display_name, role, username)
values
  ('00000000-0000-4000-8000-0000000b0201', 'RB Player', 'user', 'rb_player'),
  -- Deliberately NOT an attendee of either session below: ADR-066/KB-013 means
  -- a member who missed a session must still read its finalized results.
  ('00000000-0000-4000-8000-0000000b0202', 'RB Outsider', 'user', 'rb_outsider');

-- Two published v2 sessions. rating_rules_version is normally stamped by the
-- publish trigger (a BEFORE UPDATE), so a direct insert sets it explicitly.
insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at, rating_rules_version)
values
  ('00000000-0000-4000-8000-0000000b0301', '0000000b-0000-4000-8000-000000000010', date '2099-09-07', 'monday', 'published', now(), 2),
  ('00000000-0000-4000-8000-0000000b0302', '0000000b-0000-4000-8000-000000000010', date '2099-09-11', 'friday', 'published', now(), 2);

insert into kut.attendance (session_id, player_id, goals)
values
  ('00000000-0000-4000-8000-0000000b0301', '00000000-0000-4000-8000-0000000b0101', 0),
  ('00000000-0000-4000-8000-0000000b0302', '00000000-0000-4000-8000-0000000b0101', 0);

-- session_report_results FKs to session_surveys, and the member-read policy
-- requires the survey to be finalized.
insert into kut.session_surveys (session_id, opened_at, closes_at, category_ids, selection_seed, status, finalized_at)
values
  ('00000000-0000-4000-8000-0000000b0301', now() - interval '48 hours', now() - interval '24 hours',
   array['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003']::uuid[],
   gen_random_uuid(), 'finalized', now() - interval '24 hours'),
  ('00000000-0000-4000-8000-0000000b0302', now() - interval '36 hours', now() - interval '12 hours',
   array['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003']::uuid[],
   gen_random_uuid(), 'finalized', now() - interval '12 hours');

-- The older session contributes 2.00 Form, the newer 3.00. With the newer one
-- at age 0 (weight 1.00) and the older at age 1 (weight 0.75), the engine's
-- Form total must be 3.00 + 1.50 = 4.50.
insert into kut.session_report_results (session_id, player_id, effective_goals, goal_form, kudos_form, session_input, qualified_category_ids)
values
  ('00000000-0000-4000-8000-0000000b0301', '00000000-0000-4000-8000-0000000b0101', 1, 1.00, 1.00, 2.00,
   array['10000000-0000-4000-8000-000000000001']::uuid[]),
  ('00000000-0000-4000-8000-0000000b0302', '00000000-0000-4000-8000-0000000b0101', 3, 1.50, 1.50, 3.00,
   array['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002']::uuid[]);

-- Run the real engine over the fixture.
select lives_ok(
  $$ select kut._rebuild_season_core('0000000b-0000-4000-8000-000000000010') $$,
  'the season rebuilds over the fixture');

-- === The decay ladder matches the engine =================================
-- This is the load-bearing assertion. player_form_contributions expresses the
-- session-age weights a SECOND time, outside kut._rebuild_season_core. If the
-- engine's ladder changes and the view is not updated, this fails.
select is(
  (select sum(weighted_contribution) from kut.player_form_contributions
   where player_id = '00000000-0000-4000-8000-0000000b0101'),
  (select form_score from kut.player_season_state
   where player_id = '00000000-0000-4000-8000-0000000b0101'
     and season_id = '0000000b-0000-4000-8000-000000000010'),
  'the summed weighted contributions equal the engine Form score');

select is(
  (select sum(weighted_contribution) from kut.player_form_contributions
   where player_id = '00000000-0000-4000-8000-0000000b0101'),
  4.50::numeric,
  'and that total is the expected 3.00 at weight 1.00 plus 2.00 at weight 0.75');

select is(
  (select session_age from kut.player_form_contributions
   where session_id = '00000000-0000-4000-8000-0000000b0302'),
  0,
  'the most recent session has age 0');
select is(
  (select session_age from kut.player_form_contributions
   where session_id = '00000000-0000-4000-8000-0000000b0301'),
  1,
  'the session before it has age 1, counted in sessions rather than weeks');
select is(
  (select weight from kut.player_form_contributions
   where session_id = '00000000-0000-4000-8000-0000000b0301'),
  0.75::numeric,
  'age 1 carries the 0.75 weight');

-- === The split always reconstructs the card face =========================
select is(
  (select attendance_base + form_bonus from kut.player_rating_breakdown
   where player_id = '00000000-0000-4000-8000-0000000b0101'),
  (select live_ovr from kut.player_season_state
   where player_id = '00000000-0000-4000-8000-0000000b0101'
     and season_id = '0000000b-0000-4000-8000-000000000010'),
  'attendance_base + form_bonus equals live_ovr by construction');

select is(
  (select form_bonus from kut.player_rating_breakdown
   where player_id = '00000000-0000-4000-8000-0000000b0101'),
  5,
  'a 4.50 Form score rounds once to a +5 OVR bonus');

-- === Recognised categories are titles, never nominators ==================
select is(
  (select recognized_categories from kut.player_form_contributions
   where session_id = '00000000-0000-4000-8000-0000000b0302'),
  array['Engine', 'Team Player'],
  'qualified categories resolve to their titles, sorted');

-- kut.session_kudos is the nominator-identity table. Neither view may read it.
select is(
  (select count(*)::int from information_schema.view_table_usage
   where view_schema = 'kut'
     and view_name in ('player_rating_breakdown', 'player_form_contributions')
     and table_name in ('session_kudos', 'session_surveys')),
  0,
  'neither view touches session_kudos (nominators) or session_surveys (KB-013)');

-- === A member who missed the session still sees the breakdown ============
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000b0202';

select is(
  (select count(*)::int from kut.player_form_contributions
   where player_id = '00000000-0000-4000-8000-0000000b0101'),
  2,
  'a non-attendee member reads both finalized sessions (the KB-013 regression)');
select is(
  (select live_ovr from kut.player_rating_breakdown
   where player_id = '00000000-0000-4000-8000-0000000b0101'),
  (select live_ovr from kut.player_season_state
   where player_id = '00000000-0000-4000-8000-0000000b0101'
     and season_id = '0000000b-0000-4000-8000-000000000010'),
  'a non-attendee member reads the rating breakdown');

reset role;
select set_config('request.jwt.claim.sub', '', true);

select * from finish();

rollback;
