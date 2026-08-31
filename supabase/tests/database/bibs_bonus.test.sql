begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(15);

-- Schema surface (ADR-037) --------------------------------------------------
select has_column('kut', 'match_sessions', 'bibs_washed_by', 'match_sessions has a bibs_washed_by column');
select has_table('kut', 'bibs_rewards', 'the bibs reward guard table exists');
select has_function('kut', 'grant_bibs_reward', array['uuid'], 'the bibs reward function exists');

-- Fixtures ----------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000009b001', 'bibs-admin@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000009b201', 'bibs-washer@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000009b202', 'bibs-other@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-00000009b101', 'bibs-washer', 'Bibs Washer', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009b102', 'bibs-other', 'Bibs Other', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009b103', 'bibs-absent', 'Bibs Absent', 'all_rounder');

insert into kut.profiles (id, display_name, role, player_id, username)
values
  ('00000000-0000-4000-8000-00000009b001', 'Bibs Admin', 'admin', null, null),
  ('00000000-0000-4000-8000-00000009b201', 'Bibs Washer', 'user', '00000000-0000-4000-8000-00000009b101', 'bibs_washer'),
  ('00000000-0000-4000-8000-00000009b202', 'Bibs Other', 'user', '00000000-0000-4000-8000-00000009b102', 'bibs_other');

-- A published session that names the washer. The attendance insert below fires
-- process_published_session_rewards -> grant_bibs_reward.
insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at, bibs_washed_by)
values (
  '00000000-0000-4000-8000-00000009b301',
  (select id from kut.seasons where is_active limit 1),
  date '2099-05-04',
  'monday',
  'published',
  now(),
  '00000000-0000-4000-8000-00000009b101'
);

insert into kut.attendance (session_id, player_id, goals)
values
  ('00000000-0000-4000-8000-00000009b301', '00000000-0000-4000-8000-00000009b101', 0),
  ('00000000-0000-4000-8000-00000009b301', '00000000-0000-4000-8000-00000009b102', 0);

-- The washer was paid the bonus, once ------------------------------------
select is(
  (select count(*)::int from kut.wallet_ledger
   where user_id = '00000000-0000-4000-8000-00000009b201' and reason = 'bibs_bonus'),
  1,
  'the bibs washer was credited exactly one bibs_bonus ledger row');
select is(
  (select amount from kut.wallet_ledger
   where user_id = '00000000-0000-4000-8000-00000009b201' and reason = 'bibs_bonus'),
  100::bigint,
  'the bibs bonus is 100 KUT Coins');
select is(
  (select count(*)::int from kut.bibs_rewards
   where session_id = '00000000-0000-4000-8000-00000009b301'
     and player_id = '00000000-0000-4000-8000-00000009b101'),
  1,
  'a bibs_rewards guard row exists for (session, washer)');
select is(
  (select count(*)::int from kut.user_notifications
   where user_id = '00000000-0000-4000-8000-00000009b201'
     and event_type = 'bibs_bonus'
     and reference_id = '00000000-0000-4000-8000-00000009b301'),
  1,
  'the washer got one bibs_bonus inbox message for the session');
select ok(
  (select body from kut.user_notifications
   where user_id = '00000000-0000-4000-8000-00000009b201' and event_type = 'bibs_bonus'
   limit 1) like '%04 May 2099%',
  'the bibs message names the session date');

-- Idempotent: re-running the reward function is a no-op ------------------
select is(kut.grant_bibs_reward('00000000-0000-4000-8000-00000009b301'), 0,
  'a repeat grant_bibs_reward call awards nothing');
select is(
  (select count(*)::int from kut.wallet_ledger
   where user_id = '00000000-0000-4000-8000-00000009b201' and reason = 'bibs_bonus'),
  1,
  'the repeat call did not write a second bibs_bonus ledger row');

-- A washer who is not an attendee is rejected --------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009b001';
select throws_ok(
  $$ select kut.publish_attendance_session(
       (select id from kut.seasons where is_active limit 1),
       '2099-05-11', 'monday',
       '[{"player_id":"00000000-0000-4000-8000-00000009b101","goals":0}]'::jsonb,
       '00000000-0000-4000-8000-00000009b103'
     ); $$,
  '22023',
  'the bibs washer must be one of the session attendees',
  'publish rejects a bibs washer who did not attend');

-- Changing the washer on a correction pays the new one; the old one keeps it.
select lives_ok(
  $$ select kut.correct_published_attendance_session(
       '00000000-0000-4000-8000-00000009b301',
       '2099-05-04', 'monday',
       '[{"player_id":"00000000-0000-4000-8000-00000009b101","goals":0},
         {"player_id":"00000000-0000-4000-8000-00000009b102","goals":0}]'::jsonb,
       'The other player actually washed the bibs.',
       '00000000-0000-4000-8000-00000009b102'
     ); $$,
  'an admin can reassign the bibs washer via a correction');
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*)::int from kut.wallet_ledger
   where user_id = '00000000-0000-4000-8000-00000009b202' and reason = 'bibs_bonus'),
  1,
  'the newly named washer was credited the bibs bonus');
select is(
  (select count(*)::int from kut.bibs_rewards
   where session_id = '00000000-0000-4000-8000-00000009b301'
     and player_id = '00000000-0000-4000-8000-00000009b101'),
  1,
  'the original washer keeps their bibs_rewards row (forward-only)');
select is(
  (select count(*)::int from kut.wallet_ledger
   where user_id = '00000000-0000-4000-8000-00000009b201' and reason = 'bibs_bonus'),
  1,
  'the original washer is not clawed back');

select * from finish();

rollback;
