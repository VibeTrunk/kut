begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(26);

-- ---------------------------------------------------------------------------
-- Schema surface
-- ---------------------------------------------------------------------------
select has_table('kut', 'player_rating_snapshots', 'weekly rating snapshot table exists');
select has_view('kut', 'top_risers', 'top risers view exists');
select has_column('kut', 'profiles', 'starter_opened_at', 'profiles records when the starter reveal was seen');
select has_column('kut', 'top_risers', 'ovr_delta', 'top_risers exposes the week-over-week OVR delta');
select has_column('kut', 'my_pack_opening_results', 'photo_path', 'pack results view exposes the player photo');
select has_function('kut', 'mark_starter_opened', 'starter-opened RPC exists');

-- ---------------------------------------------------------------------------
-- Fixtures: a dedicated active season, two players, three weekly sessions.
--   Riser attends every week; Faller attends only week 1 then decays.
-- ---------------------------------------------------------------------------
update kut.seasons set is_active = false where is_active;
insert into kut.seasons (id, name, starts_on, is_active)
values ('0000000c-0000-4000-8000-000000000010', 'Movers Test Season', date '2099-03-01', true);

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-0000000c0001', 'movers-riser', 'Movers Riser', 'all_rounder'),
  ('00000000-0000-4000-8000-0000000c0002', 'movers-faller', 'Movers Faller', 'all_rounder');

insert into kut.card_editions (player_id, edition_type, title, is_live)
values
  ('00000000-0000-4000-8000-0000000c0001', 'live', 'Movers Riser Live', true),
  ('00000000-0000-4000-8000-0000000c0002', 'live', 'Movers Faller Live', true);

-- Sessions are published one week at a time so last_week_start advances and each
-- rebuild captures a distinct weekly snapshot.
insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
values ('00000000-0000-4000-8000-0000000c0101', '0000000c-0000-4000-8000-000000000010', date '2099-03-02', 'other', 'published', now());

-- Week 1: both attend. Rebuild -> snapshot at week 1.
insert into kut.attendance (session_id, player_id, goals)
values
  ('00000000-0000-4000-8000-0000000c0101', '00000000-0000-4000-8000-0000000c0001', 0),
  ('00000000-0000-4000-8000-0000000c0101', '00000000-0000-4000-8000-0000000c0002', 0);
select kut._rebuild_season_core('0000000c-0000-4000-8000-000000000010');

select is(
  (select live_ovr from kut.player_rating_snapshots
    where player_id = '00000000-0000-4000-8000-0000000c0001'
      and week_start = date_trunc('week', date '2099-03-02')::date),
  (select live_ovr from kut.player_season_state
    where player_id = '00000000-0000-4000-8000-0000000c0001'
      and season_id = '0000000c-0000-4000-8000-000000000010'),
  'a rebuild captures the riser''s week-1 snapshot at the current live OVR'
);

-- Week 2 + 3: only the riser attends. Publish + rebuild one week at a time.
insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
values ('00000000-0000-4000-8000-0000000c0102', '0000000c-0000-4000-8000-000000000010', date '2099-03-09', 'other', 'published', now());
insert into kut.attendance (session_id, player_id, goals)
values ('00000000-0000-4000-8000-0000000c0102', '00000000-0000-4000-8000-0000000c0001', 0);
select kut._rebuild_season_core('0000000c-0000-4000-8000-000000000010');

insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
values ('00000000-0000-4000-8000-0000000c0103', '0000000c-0000-4000-8000-000000000010', date '2099-03-16', 'other', 'published', now());
insert into kut.attendance (session_id, player_id, goals)
values ('00000000-0000-4000-8000-0000000c0103', '00000000-0000-4000-8000-0000000c0001', 0);
select kut._rebuild_season_core('0000000c-0000-4000-8000-000000000010');

select is(
  (select count(distinct week_start)::int from kut.player_rating_snapshots
    where player_id = '00000000-0000-4000-8000-0000000c0001'),
  3,
  'three rebuilds across three published weeks leave three distinct snapshot weeks'
);

select isnt(
  (select live_ovr from kut.player_rating_snapshots
    where player_id = '00000000-0000-4000-8000-0000000c0001'
      and week_start = date_trunc('week', date '2099-03-02')::date),
  (select live_ovr from kut.player_rating_snapshots
    where player_id = '00000000-0000-4000-8000-0000000c0001'
      and week_start = date_trunc('week', date '2099-03-16')::date),
  'the earlier week snapshot is preserved, not overwritten by a later rebuild'
);

-- Re-running the rebuild with no new data must not add snapshot rows.
select kut._rebuild_season_core('0000000c-0000-4000-8000-000000000010');
select is(
  (select count(*)::int from kut.player_rating_snapshots
    where player_id = '00000000-0000-4000-8000-0000000c0001'),
  3,
  'an idempotent rebuild overwrites the current-week snapshot in place'
);

-- ---------------------------------------------------------------------------
-- top_risers
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from kut.top_risers where id = '00000000-0000-4000-8000-0000000c0001'),
  1,
  'the riser appears in top_risers'
);
select ok(
  (select ovr_delta from kut.top_risers where id = '00000000-0000-4000-8000-0000000c0001') > 0,
  'the riser has a positive OVR delta'
);
select is(
  (select count(*)::int from kut.top_risers where id = '00000000-0000-4000-8000-0000000c0002'),
  0,
  'the faller is excluded from top_risers'
);
select is(
  (select count(*)::int from kut.top_risers where ovr_delta <= 0),
  0,
  'top_risers never returns a zero or negative delta'
);
select is(
  (select live_ovr from kut.top_risers where id = '00000000-0000-4000-8000-0000000c0001'),
  (select live_ovr from kut.player_season_state
    where player_id = '00000000-0000-4000-8000-0000000c0001'
      and season_id = '0000000c-0000-4000-8000-000000000010'),
  'top_risers reports the current live OVR for the riser'
);

-- ---------------------------------------------------------------------------
-- mark_starter_opened
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000c0b01', 'starter-claimed@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000c0b02', 'starter-fresh@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

-- Member whose starter was already granted at invite claim, not yet "opened".
insert into kut.profiles (id, display_name, role, player_id, starter_claimed_at)
values ('00000000-0000-4000-8000-0000000c0b01', 'Starter Claimed', 'user', null, now());
insert into kut.wallets (user_id, balance) values ('00000000-0000-4000-8000-0000000c0b01', 250);
insert into kut.user_cards (edition_id, owner_id, source)
select id, '00000000-0000-4000-8000-0000000c0b01', 'starter'
from kut.card_editions where is_live limit 3;

-- Legacy member who never claimed (no wallet, no cards).
insert into kut.profiles (id, display_name, role, player_id)
values ('00000000-0000-4000-8000-0000000c0b02', 'Starter Fresh', 'user', null);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000c0b01';
select lives_ok($$ select kut.mark_starter_opened(); $$, 'an already-claimed member can mark the starter opened');
select lives_ok($$ select kut.mark_starter_opened(); $$, 'marking the starter opened again is a no-op');
reset role;
select set_config('request.jwt.claim.sub', '', true);

select ok(
  (select starter_opened_at is not null from kut.profiles where id = '00000000-0000-4000-8000-0000000c0b01'),
  'starter_opened_at is stamped'
);
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000c0b01'),
  250::bigint,
  'an already-claimed member is not re-granted starter coins'
);
select is(
  (select count(*)::int from kut.user_cards
    where owner_id = '00000000-0000-4000-8000-0000000c0b01' and source = 'starter'),
  3,
  'an already-claimed member keeps exactly three starter cards'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000c0b02';
select lives_ok($$ select kut.mark_starter_opened(); $$, 'a never-claimed member is granted the starter on open');
reset role;
select set_config('request.jwt.claim.sub', '', true);

select ok(
  (select starter_claimed_at is not null from kut.profiles where id = '00000000-0000-4000-8000-0000000c0b02'),
  'the legacy fallback stamps starter_claimed_at'
);
select ok(
  (select starter_opened_at is not null from kut.profiles where id = '00000000-0000-4000-8000-0000000c0b02'),
  'the legacy fallback also stamps starter_opened_at'
);
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000c0b02'),
  250::bigint,
  'the legacy fallback grants 250 starter coins'
);
select is(
  (select count(*)::int from kut.user_cards
    where owner_id = '00000000-0000-4000-8000-0000000c0b02' and source = 'starter'),
  3,
  'the legacy fallback grants three starter cards'
);

set local role anon;
select throws_ok($$ select kut.mark_starter_opened(); $$, '42501', null, 'anon cannot mark the starter opened');
reset role;

select * from finish();

rollback;
