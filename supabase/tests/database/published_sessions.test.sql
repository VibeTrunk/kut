begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(7);

select has_view('kut', 'published_sessions', 'the published_sessions view exists (ADR-044)');

-- Fixtures ----------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000009c201', 'sessions-viewer@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-00000009c101', 'sessions-fixture-one', 'Sessions Fixture One', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009c102', 'sessions-fixture-two', 'Sessions Fixture Two', 'all_rounder');

insert into kut.profiles (id, display_name, role, username)
values
  ('00000000-0000-4000-8000-00000009c201', 'Sessions Viewer', 'user', 'sessions_viewer');

-- One published session with two attendees (3 goals total) and a draft one.
insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
values
  ('00000000-0000-4000-8000-00000009c601', (select id from kut.seasons where is_active limit 1), date '2099-07-06', 'monday', 'published', now()),
  ('00000000-0000-4000-8000-00000009c602', (select id from kut.seasons where is_active limit 1), date '2099-07-13', 'monday', 'draft', null);

insert into kut.attendance (session_id, player_id, goals)
values
  ('00000000-0000-4000-8000-00000009c601', '00000000-0000-4000-8000-00000009c101', 2),
  ('00000000-0000-4000-8000-00000009c601', '00000000-0000-4000-8000-00000009c102', 1);

-- A plain member sees the published session with correct aggregates --------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009c201';

select is(
  (select count(*)::int from kut.published_sessions where id = '00000000-0000-4000-8000-00000009c601'),
  1,
  'a member sees the published session');
select is(
  (select count(*)::int from kut.published_sessions where id = '00000000-0000-4000-8000-00000009c602'),
  0,
  'a draft session is not in the view');
select is(
  (select attendee_count from kut.published_sessions where id = '00000000-0000-4000-8000-00000009c601'),
  2,
  'attendee_count counts both attendees');
select is(
  (select goal_count from kut.published_sessions where id = '00000000-0000-4000-8000-00000009c601'),
  3,
  'goal_count sums the goals (2 + 1)');
select is(
  (select session_type from kut.published_sessions where id = '00000000-0000-4000-8000-00000009c601'),
  'monday',
  'the view carries session_type');
select ok(
  (select bool_and(published_at is not null) from kut.published_sessions),
  'every published_sessions row has a published_at');

reset role;
select set_config('request.jwt.claim.sub', '', true);

select * from finish();

rollback;
