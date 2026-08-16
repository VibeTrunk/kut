begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(8);

select has_table('kut', 'players', 'players table exists');
select has_table('kut', 'match_sessions', 'match sessions table exists');
select has_table('kut', 'attendance', 'attendance table exists');
select has_table('kut', 'player_season_state', 'derived player state table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'kut.players'::regclass),
  true,
  'RLS is active for players'
);

insert into kut.match_sessions (id, season_id, session_date, session_type, status)
values (
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000010',
  '2026-08-07',
  'friday',
  'draft'
);

select throws_ok(
  $$
    insert into kut.attendance (session_id, player_id)
    values ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001');
    insert into kut.attendance (session_id, player_id)
    values ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001');
  $$,
  '23505',
  'duplicate key value violates unique constraint "attendance_session_id_player_id_key"',
  'only one attendance row exists per player and session'
);

set local role authenticated;
select lives_ok(
  $$ select count(*) from kut.players; $$,
  'authenticated users can read the fictional roster'
);
reset role;

set local role anon;
select throws_ok(
  $$ select * from kut.players; $$,
  '42501',
  'permission denied for schema kut',
  'anonymous users cannot read the roster'
);
reset role;

select * from finish();
rollback;
