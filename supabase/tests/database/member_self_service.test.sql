begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(25);

-- ---------------------------------------------------------------------------
-- Schema surface
-- ---------------------------------------------------------------------------
select has_view('kut', 'player_directory', 'member-facing player directory view exists');
select has_function('kut', 'set_own_player_photo', array['text'], 'own-photo RPC exists');
select has_function('kut', 'set_own_player_archetype', array['text'], 'own-archetype RPC exists');
select has_column('kut', 'public_live_ratings', 'photo_path', 'public live ratings exposes photo_path');
select has_column('kut', 'my_collection_cards', 'photo_path', 'collection view exposes photo_path');
select has_column('kut', 'player_directory', 'photo_path', 'directory exposes photo_path');

-- ---------------------------------------------------------------------------
-- Fixtures: one player, one linked member, one unlinked member, one other player
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000009b001', 'linked-member@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000009b002', 'unlinked-member@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-00000009a001', 'self-service-fixture', 'Self Service Fixture', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009a002', 'other-fixture-player', 'Other Fixture Player', 'all_rounder');

insert into kut.card_editions (player_id, edition_type, title, is_live)
values ('00000000-0000-4000-8000-00000009a001', 'live', 'Self Service Fixture Live', true);

insert into kut.profiles (id, display_name, role, player_id)
values
  ('00000000-0000-4000-8000-00000009b001', 'Linked Member', 'user', '00000000-0000-4000-8000-00000009a001'),
  ('00000000-0000-4000-8000-00000009b002', 'Unlinked Member', 'user', null);

-- ---------------------------------------------------------------------------
-- player_directory LEFT JOIN: a player with no season-state row still lists at 30
-- ---------------------------------------------------------------------------
select is(
  (select live_ovr from kut.player_directory where id = '00000000-0000-4000-8000-00000009a001'),
  30,
  'a player with no season-state row lists at OVR 30'
);
select is(
  (select rarity_tier from kut.player_directory where id = '00000000-0000-4000-8000-00000009a001'),
  'common',
  'a player with no season-state row lists as common'
);

update kut.players set is_active = false where id = '00000000-0000-4000-8000-00000009a001';
select is(
  (select count(*)::int from kut.player_directory where id = '00000000-0000-4000-8000-00000009a001'),
  0,
  'an inactive player is hidden from the directory'
);
update kut.players set is_active = true where id = '00000000-0000-4000-8000-00000009a001';

-- ---------------------------------------------------------------------------
-- set_own_player_archetype: linked member, rebuild re-materialises the stats
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009b001';

select lives_ok(
  $$ select kut.set_own_player_archetype('finisher'); $$,
  'a linked member can set their own archetype'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select archetype from kut.players where id = '00000000-0000-4000-8000-00000009a001'),
  'finisher',
  'the archetype was stored'
);
select is(
  (select sho
     from kut.player_season_state s
     join kut.seasons season on season.id = s.season_id and season.is_active
    where s.player_id = '00000000-0000-4000-8000-00000009a001'),
  40,
  'the rebuild re-materialised SHO with the finisher offset (30 + 10)'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009b001';
select throws_ok(
  $$ select kut.set_own_player_archetype('keeper'); $$,
  '22023',
  null,
  'an invalid archetype is rejected'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009b002';
select throws_ok(
  $$ select kut.set_own_player_archetype('finisher'); $$,
  'P0001',
  'no linked player for this account',
  'an unlinked member cannot set an archetype'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- ---------------------------------------------------------------------------
-- set_own_player_photo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009b001';
select lives_ok(
  $$ select kut.set_own_player_photo('players/00000000-0000-4000-8000-00000009a001/profile.webp'); $$,
  'a linked member can set their own photo path'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select photo_path from kut.players where id = '00000000-0000-4000-8000-00000009a001'),
  'players/00000000-0000-4000-8000-00000009a001/profile.webp',
  'the photo path was stored'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009b001';
select throws_ok(
  $$ select kut.set_own_player_photo('players/00000000-0000-4000-8000-00000009a002/profile.webp'); $$,
  '22023',
  'invalid photo path',
  'a member cannot point their card at another player''s folder'
);
select lives_ok(
  $$ select kut.set_own_player_photo(null); $$,
  'passing null clears the photo path'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select ok(
  (select photo_path from kut.players where id = '00000000-0000-4000-8000-00000009a001') is null,
  'the photo path is cleared'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009b002';
select throws_ok(
  $$ select kut.set_own_player_photo('players/00000000-0000-4000-8000-00000009b002/profile.webp'); $$,
  'P0001',
  'no linked player for this account',
  'an unlinked member cannot set a photo'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role anon;
select throws_ok(
  $$ select kut.set_own_player_photo(null); $$,
  '42501',
  null,
  'anon cannot execute the member photo RPC'
);
reset role;

-- ---------------------------------------------------------------------------
-- storage.objects RLS for the private player-photos bucket
-- ---------------------------------------------------------------------------
select is(
  (select public from storage.buckets where id = 'player-photos'),
  false,
  'the player-photos bucket is private'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009b001';
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('player-photos', 'players/00000000-0000-4000-8000-00000009a001/profile.webp', auth.uid()); $$,
  'a linked member can write an object under their own player folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('player-photos', 'players/00000000-0000-4000-8000-00000009a002/profile.webp', auth.uid()); $$,
  '42501',
  null,
  'a linked member cannot write under another player''s folder'
);
select lives_ok(
  $$ select count(*) from storage.objects where bucket_id = 'player-photos'; $$,
  'an enabled member can read the player-photos bucket'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select * from finish();

rollback;
