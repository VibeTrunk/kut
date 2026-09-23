begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(25);

-- Schema surface (ADR-083) -------------------------------------------------
select has_table('kut', 'comeback_form_inputs', 'the derived comeback inputs table exists');
select has_column('kut', 'player_form_contributions', 'source', 'the contributions view says where a row comes from');
select has_column('kut', 'player_form_contributions', 'protected_weeks', 'and how many weeks a comeback rewards');

-- Fixtures (created as the test superuser) --------------------------------
-- Eleven weekly v2 sessions k0..k10, all on Mondays of a 2099 season, so the
-- check-in week_start of week k is simply the session date of k.
create temp table t_w as select date_trunc('week', date '2099-08-05')::date as w0;

update kut.seasons set is_active = false where is_active;
insert into kut.seasons (id, name, starts_on, is_active)
select '00000083-0000-4000-8000-000000000010', 'Comeback Test Season', w0 - 7, true from t_w;
insert into kut.season_rating_rules (season_id, v2_starts_week)
select '00000083-0000-4000-8000-000000000010', w0 - 7 from t_w
on conflict (season_id) do update set v2_starts_week = excluded.v2_starts_week;

insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at, rating_rules_version)
select ('00000083-0000-4000-8000-0000000003' || lpad(k::text, 2, '0'))::uuid,
  '00000083-0000-4000-8000-000000000010', w0 + 7 * k, 'monday', 'published', now(), 2
from t_w, generate_series(0, 10) k;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000083-0000-4000-8000-0000000000a1', 'cb-admin@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000083-0000-4000-8000-0000000000d1', 'cb-member@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000083-0000-4000-8000-0000000000e1', 'cb-noprofile@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into kut.profiles (id, display_name, role, player_id, username)
values
  ('00000083-0000-4000-8000-0000000000a1', 'CB Admin', 'admin', null, 'cb_admin'),
  ('00000083-0000-4000-8000-0000000000d1', 'CB Member', 'user', null, 'cb_member');

-- R returner (6 weeks), C cap (9 weeks), T threshold (2 weeks), T3 exactly 3,
-- W checks in during the return week too, D two periods sharing one return.
insert into kut.players (id, slug, display_name, archetype)
values
  ('00000083-0000-4000-8000-000000000101', 'cb-returner', 'CB Returner', 'all_rounder'),
  ('00000083-0000-4000-8000-000000000102', 'cb-cap', 'CB Cap', 'all_rounder'),
  ('00000083-0000-4000-8000-000000000103', 'cb-two', 'CB Two', 'all_rounder'),
  ('00000083-0000-4000-8000-000000000104', 'cb-three', 'CB Three', 'all_rounder'),
  ('00000083-0000-4000-8000-000000000105', 'cb-return-week', 'CB Return Week', 'all_rounder'),
  ('00000083-0000-4000-8000-000000000106', 'cb-double', 'CB Double', 'all_rounder');

insert into kut.attendance (session_id, player_id, goals)
select ('00000083-0000-4000-8000-0000000003' || lpad(k::text, 2, '0'))::uuid, player_id::uuid, 0
from (values
  ('00000083-0000-4000-8000-000000000101', array[0, 1, 8, 9, 10]),
  ('00000083-0000-4000-8000-000000000102', array[0, 10]),
  ('00000083-0000-4000-8000-000000000103', array[0, 1, 4]),
  ('00000083-0000-4000-8000-000000000104', array[0, 1, 5]),
  ('00000083-0000-4000-8000-000000000105', array[0, 1, 5]),
  ('00000083-0000-4000-8000-000000000106', array[0, 1, 6])) p(player_id, weeks),
  unnest(p.weeks) k;

insert into kut.injury_periods (id, player_id, started_on, started_by, ended_on, end_reason)
select id::uuid, player_id::uuid, w0 + 7 * start_k, '00000083-0000-4000-8000-0000000000a1',
  case when end_k is null then null else w0 + 7 * end_k end, case when end_k is null then null else 'fit again' end
from t_w, (values
  ('00000083-0000-4000-8000-000000000501', '00000083-0000-4000-8000-000000000101', 1, null::integer),
  ('00000083-0000-4000-8000-000000000502', '00000083-0000-4000-8000-000000000102', 0, null),
  ('00000083-0000-4000-8000-000000000503', '00000083-0000-4000-8000-000000000103', 1, null),
  ('00000083-0000-4000-8000-000000000504', '00000083-0000-4000-8000-000000000104', 1, null),
  ('00000083-0000-4000-8000-000000000505', '00000083-0000-4000-8000-000000000105', 1, null),
  ('00000083-0000-4000-8000-000000000506', '00000083-0000-4000-8000-000000000106', 1, 3),
  ('00000083-0000-4000-8000-000000000507', '00000083-0000-4000-8000-000000000106', 4, null)) p(id, player_id, start_k, end_k);

insert into kut.injury_check_ins (player_id, week_start, period_id, user_id, amount, ledger_id)
select player_id::uuid, w0 + 7 * k, period_id::uuid, '00000083-0000-4000-8000-0000000000a1', 100, gen_random_uuid()
from t_w, (values
  ('00000083-0000-4000-8000-000000000101', '00000083-0000-4000-8000-000000000501', 2, 7),
  ('00000083-0000-4000-8000-000000000102', '00000083-0000-4000-8000-000000000502', 1, 9),
  ('00000083-0000-4000-8000-000000000103', '00000083-0000-4000-8000-000000000503', 2, 3),
  ('00000083-0000-4000-8000-000000000104', '00000083-0000-4000-8000-000000000504', 2, 4),
  ('00000083-0000-4000-8000-000000000105', '00000083-0000-4000-8000-000000000505', 2, 5),
  ('00000083-0000-4000-8000-000000000106', '00000083-0000-4000-8000-000000000506', 2, 3),
  ('00000083-0000-4000-8000-000000000106', '00000083-0000-4000-8000-000000000507', 4, 5)) c(player_id, period_id, from_k, to_k),
  generate_series(c.from_k, c.to_k) k;

select lives_ok($$ select kut._rebuild_season_core('00000083-0000-4000-8000-000000000010') $$, 'the season rebuilds over the fixture');

-- === The rule ==============================================================
select is(
  (select count(*)::integer from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000101'),
  1, 'only the first session after the injury is a comeback, not the ones after it');
select is(
  (select protected_weeks from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000101'),
  6, 'six protected weeks are counted');
select is(
  (select form_input from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000101'),
  1.50::numeric, '0.25 Form per protected week: 6 weeks give 1.5');
select is(
  (select session_id from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000101'),
  '00000083-0000-4000-8000-000000000308'::uuid, 'the comeback sits on the return session');

select is(
  (select form_input from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000102'),
  2.00::numeric, 'nine protected weeks hit the 2 Form cap');
select is(
  (select count(*)::integer from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000103'),
  0, 'two protected weeks earn no comeback');
select is(
  (select form_input from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000104'),
  0.75::numeric, 'exactly three protected weeks earn 0.75');
select is(
  (select protected_weeks from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000105'),
  3, 'a check-in in the return week protected nothing, so it is not counted');
select is(
  (select count(*)::integer from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000106'),
  1, 'two periods that end in the same return are one comeback');
select is(
  (select protected_weeks from kut.comeback_form_inputs where player_id = '00000083-0000-4000-8000-000000000106'),
  4, 'and their protected weeks are summed');

-- === The engine: it is Form, and it fades ==================================
-- R returned at k8; k9 and k10 follow, so the input is at age 2, weight 0.50.
select is(
  (select form_score from kut.player_season_state
   where player_id = '00000083-0000-4000-8000-000000000101' and season_id = '00000083-0000-4000-8000-000000000010'),
  0.75::numeric, 'the comeback counts as Form and fades like a session input (1.5 x 0.50)');
select is(
  (select form_score from kut.player_season_state
   where player_id = '00000083-0000-4000-8000-000000000102' and season_id = '00000083-0000-4000-8000-000000000010'),
  2.00::numeric, 'a comeback in the latest session counts in full');
select is(
  (select form_score from kut.player_season_state
   where player_id = '00000083-0000-4000-8000-000000000104' and season_id = '00000083-0000-4000-8000-000000000010'),
  0.00::numeric, 'five sessions later it has faded to nothing');

-- === The rating story still sums to the total ==============================
select is(
  (select sum(weighted_contribution) from kut.player_form_contributions where player_id = '00000083-0000-4000-8000-000000000101'),
  (select form_score from kut.player_season_state
   where player_id = '00000083-0000-4000-8000-000000000101' and season_id = '00000083-0000-4000-8000-000000000010'),
  'the returner''s contribution rows sum to the engine Form score');
select is(
  (select sum(weighted_contribution) from kut.player_form_contributions where player_id = '00000083-0000-4000-8000-000000000102'),
  (select form_score from kut.player_season_state
   where player_id = '00000083-0000-4000-8000-000000000102' and season_id = '00000083-0000-4000-8000-000000000010'),
  'and so do the capped player''s');
select is(
  (select source || ':' || protected_weeks || ':' || weight from kut.player_form_contributions
   where player_id = '00000083-0000-4000-8000-000000000101'),
  'comeback:6:0.50', 'the story row is labelled a comeback, with its weeks and current weight');

-- === Deterministic =========================================================
create temp table t_cb as select player_id, session_id, protected_weeks, form_input from kut.comeback_form_inputs;
select lives_ok($$ select kut._rebuild_season_core('00000083-0000-4000-8000-000000000010') $$, 'the season rebuilds again');
select is(
  (select count(*)::integer from (
     (select player_id, session_id, protected_weeks, form_input from kut.comeback_form_inputs except select * from t_cb)
     union all
     (select * from t_cb except select player_id, session_id, protected_weeks, form_input from kut.comeback_form_inputs)) diff),
  0, 'the derived comeback rows are re-derived identically (Part L #16)');

-- === Access ================================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000083-0000-4000-8000-0000000000d1', true);
select is(
  (select count(*)::integer from kut.player_form_contributions where source = 'comeback'),
  5, 'an active member sees every comeback in the rating story');
select set_config('request.jwt.claim.sub', '00000083-0000-4000-8000-0000000000e1', true);
select is(
  (select count(*)::integer from kut.comeback_form_inputs), 0, 'a caller without a KUT profile reads no comeback rows');
select set_config('request.jwt.claim.sub', '00000083-0000-4000-8000-0000000000d1', true);
select throws_ok(
  $$ insert into kut.comeback_form_inputs (player_id, season_id, session_id, protected_weeks, form_input)
     values ('00000083-0000-4000-8000-000000000103', '00000083-0000-4000-8000-000000000010', '00000083-0000-4000-8000-000000000304', 3, 0.75) $$,
  '42501', null, 'members cannot write comeback rows');
reset role;

select * from finish();
rollback;
