-- Midweek Madness (20261015000000): unclaimed Players' archetypes rotate when
-- a week opens. BUILD_SPEC §44.2, §44.11, Part L #27; ADR-110.
--
-- Fixture Players, each set to an archetype other than their draw for SEED
-- (repeat('a1', 32)), so every one would change if it were eligible:
--   P1, P2 -- active, collectible, unclaimed: rotate.
--   P3     -- claimed by an enabled member.
--   P4     -- claimed by a disabled member.
--   P5     -- inactive.
--   P6     -- not collectible.
-- Any week running on the stack is removed inside this transaction, so the
-- open step can run; everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(34);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_table('kut','midweek_archetype_rotations','the rotation log exists');
select table_privs_are('kut','midweek_archetype_rotations','authenticated',array[]::text[],'members cannot read the log');
select table_privs_are('kut','midweek_archetype_rotations','anon',array[]::text[],'anon cannot read the log');
select table_privs_are('kut','midweek_archetype_rotations','service_role',array['SELECT'],'the service role reads the log');
select function_privs_are('kut','_mm_rotation_archetype',array['bytea','uuid'],'authenticated',array[]::text[],'members cannot call the draw');
select function_privs_are('kut','_mm_rotate_archetypes',array['bytea'],'authenticated',array[]::text[],'members cannot rotate');
select function_privs_are('kut','_mm_rotate_archetypes',array['bytea'],'service_role',array[]::text[],'the service role rotates only through the worker');

-- ---------------------------------------------------------------------------
-- The draw
-- ---------------------------------------------------------------------------
select is(kut._mm_rotation_archetype(decode(repeat('a1',32),'hex'),'000000a1-0000-4000-8000-000000000101'),
  kut._mm_rotation_archetype(decode(repeat('a1',32),'hex'),'000000a1-0000-4000-8000-000000000101'),
  'the draw is a function of the seed and the Player');
select is((select count(distinct kut._mm_rotation_archetype(decode(repeat('a1',32),'hex'), md5(n::text)::uuid))::int
  from generate_series(1,700) n), 7, 'every archetype can be drawn, All-rounder and Goalkeeper included');
select ok((select bool_and(n between 70 and 130) from (
    select count(*) n from generate_series(1,700) g
    group by kut._mm_rotation_archetype(decode(repeat('a1',32),'hex'), md5(g::text)::uuid)) draws),
  'the seven are drawn about equally (700 Players, each 70..130)');
select isnt((select array_agg(kut._mm_rotation_archetype(decode(repeat('a1',32),'hex'), md5(n::text)::uuid) order by n)
    from generate_series(1,50) n),
  (select array_agg(kut._mm_rotation_archetype(decode(repeat('b2',32),'hex'), md5(n::text)::uuid) order by n)
    from generate_series(1,50) n),
  'another seed draws differently');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('000000a1-0000-4000-8000-0000000000f0','MW Rotation Test',date '2024-05-06',true);

insert into kut.players(id,slug,display_name,is_active,is_collectible)
select ('000000a1-0000-4000-8000-00000000010' || n)::uuid, 'mwa1-player-' || n, 'MWA1 Player ' || n,
  n <> 5, n <> 6
from generate_series(1,6) n;
-- Each fixture Player starts on an archetype other than their draw for SEED.
update kut.players set archetype = case
    when kut._mm_rotation_archetype(decode(repeat('a1',32),'hex'), id) = 'tank' then 'finisher' else 'tank' end
where id::text like '000000a1-%';

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('000000a1-0000-4000-8000-00000000000' || n)::uuid, 'mwa1-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from generate_series(3,4) n;
insert into kut.profiles(id,display_name,role,username,player_id,is_disabled)
select ('000000a1-0000-4000-8000-00000000000' || n)::uuid, 'MWA1 ' || n, 'user', 'mwa1_' || n,
  ('000000a1-0000-4000-8000-00000000010' || n)::uuid, n = 4
from generate_series(3,4) n;

select kut._rebuild_season_core('000000a1-0000-4000-8000-0000000000f0');
create temp table before_rotation on commit drop as
select player.id, player.archetype, state.live_ovr, array[state.pac,state.sho,state.pas,state.dri,state.def,state.phy] as stats
from kut.players player
left join kut.player_season_state state
  on state.player_id = player.id and state.season_id = '000000a1-0000-4000-8000-0000000000f0';

-- ---------------------------------------------------------------------------
-- The rotation, for a seed
-- ---------------------------------------------------------------------------
create temp table first_run on commit drop as
select kut._mm_rotate_archetypes(decode(repeat('a1',32),'hex')) as changes;

select ok((select changes @> jsonb_build_array(
    jsonb_build_object('playerId','000000a1-0000-4000-8000-000000000101'),
    jsonb_build_object('playerId','000000a1-0000-4000-8000-000000000102')) from first_run),
  'the unclaimed, active, collectible Players are rotated');
select is((select count(*)::int from kut.players
  where id in ('000000a1-0000-4000-8000-000000000101','000000a1-0000-4000-8000-000000000102')
    and archetype = kut._mm_rotation_archetype(decode(repeat('a1',32),'hex'), id)), 2,
  'each rotated Player now has their draw');
select is((select count(*)::int from kut.players player join before_rotation before using (id)
  where player.id::text like '000000a1-%' and player.id::text >= '000000a1-0000-4000-8000-000000000103'
    and player.archetype = before.archetype), 4,
  'claimed (enabled or disabled), inactive and non-collectible Players keep their archetype');
select is((select count(*)::int from jsonb_array_elements((select changes from first_run)) change
  join kut.players player on player.id = (change->>'playerId')::uuid
  where not player.is_active or not player.is_collectible
    or exists (select 1 from kut.profiles profile where profile.player_id = player.id)), 0,
  'no change anywhere touches an ineligible Player');
select is((select count(*)::int from jsonb_array_elements((select changes from first_run)) change
  join before_rotation before on before.id = (change->>'playerId')::uuid
  join kut.players player on player.id = before.id
  where change->>'from' = before.archetype and change->>'to' = player.archetype and before.archetype <> player.archetype),
  jsonb_array_length((select changes from first_run)),
  'every change reports the Player''s old and new archetype');
select is((select count(*)::int from kut.players player join before_rotation before using (id)
  where player.archetype <> before.archetype), jsonb_array_length((select changes from first_run)),
  'every archetype that moved is reported');
select is((select archetype_changed_at from kut.players where id = '000000a1-0000-4000-8000-000000000101'), null,
  'a rotation does not stamp the cooldown, so a claiming member''s first change stays free');
select is((select live_ovr from kut.player_season_state
  where player_id = '000000a1-0000-4000-8000-000000000101' and season_id = '000000a1-0000-4000-8000-0000000000f0'),
  (select live_ovr from before_rotation where id = '000000a1-0000-4000-8000-000000000101'),
  'OVR is unchanged');
select isnt((select array[pac,sho,pas,dri,def,phy] from kut.player_season_state
  where player_id = '000000a1-0000-4000-8000-000000000101' and season_id = '000000a1-0000-4000-8000-0000000000f0'),
  (select stats from before_rotation where id = '000000a1-0000-4000-8000-000000000101'),
  'the card face''s six stats follow the new archetype (the season is rebuilt)');
select is(kut._mm_rotate_archetypes(decode(repeat('a1',32),'hex')), '[]'::jsonb,
  'running it again with the same seed changes nothing');

-- ---------------------------------------------------------------------------
-- The open step
-- ---------------------------------------------------------------------------
-- Back to the starting archetypes, and no week running.
update kut.players player set archetype = before.archetype
from before_rotation before where before.id = player.id and player.archetype <> before.archetype;
delete from kut.midweek_tournaments where status in ('open','simulated');

update kut.midweek_config set enabled = false;
select is(kut._mm_open_next(), null, 'with the switch off nothing opens');
select is((select count(*)::int from kut.players player join before_rotation before using (id)
  where player.archetype <> before.archetype), 0, 'and nothing rotates');

update kut.midweek_config set enabled = true;
create temp table opened on commit drop as select kut._mm_open_next() as id;
create temp table opened_seed on commit drop as
select decode(secret.seed,'hex') as seed from kut.midweek_tournament_secrets secret join opened on opened.id = secret.tournament_id;

select isnt((select id from opened), null, 'with the switch on the next week opens');
select is((select count(*)::int from kut.players player
  where player.is_active and player.is_collectible
    and not exists (select 1 from kut.profiles profile where profile.player_id = player.id)
    and player.archetype <> kut._mm_rotation_archetype((select seed from opened_seed), player.id)), 0,
  'every eligible Player has their draw from the new week''s seed');
select is((select count(*)::int from kut.players player join before_rotation before using (id)
  where (not player.is_active or not player.is_collectible
    or exists (select 1 from kut.profiles profile where profile.player_id = player.id))
    and player.archetype <> before.archetype), 0,
  'no ineligible Player changes at the open');
select is((select count(*)::int from kut.midweek_archetype_rotations rotation
  join before_rotation before on before.id = rotation.player_id
  join kut.players player on player.id = rotation.player_id
  where rotation.tournament_id = (select id from opened)
    and rotation.from_archetype = before.archetype and rotation.to_archetype = player.archetype),
  (select count(*)::int from kut.players player join before_rotation before using (id)
    where player.archetype <> before.archetype),
  'each change is logged against the new week, and only the changes');
select ok((select count(*) > 0 from kut.midweek_archetype_rotations where tournament_id = (select id from opened)),
  'the open logged at least the fixture''s two rotations');
select is((select count(*)::int from kut.midweek_archetype_snapshots snapshot
  join kut.players player on player.id = snapshot.player_id
  where snapshot.tournament_id = (select id from opened) and snapshot.archetype <> player.archetype), 0,
  'the week''s snapshot freezes the rotated archetypes');
select is((select archetype from kut.midweek_archetype_snapshots
  where tournament_id = (select id from opened) and player_id = '000000a1-0000-4000-8000-000000000101'),
  kut._mm_rotation_archetype((select seed from opened_seed), '000000a1-0000-4000-8000-000000000101'),
  'P1 plays the week as its draw');

create temp table after_open on commit drop as select id, archetype from kut.players;
create temp table log_after_open on commit drop as select count(*)::int as n from kut.midweek_archetype_rotations;
select is(kut._mm_open_next(), null, 'a rerun while the week is open opens nothing');
select is((select count(*)::int from kut.players player join after_open using (id)
  where player.archetype <> after_open.archetype), 0, 'and rotates nothing');
select is((select count(*)::int from kut.midweek_archetype_rotations), (select n from log_after_open),
  'and logs nothing');

-- An admin change after the open waits for the next week, as before (ADR-099).
update kut.players set archetype = 'goalkeeper' where id = '000000a1-0000-4000-8000-000000000101';
select is((select archetype from kut.midweek_archetype_snapshots
  where tournament_id = (select id from opened) and player_id = '000000a1-0000-4000-8000-000000000101'),
  kut._mm_rotation_archetype((select seed from opened_seed), '000000a1-0000-4000-8000-000000000101'),
  'a change after the open does not reach the open week');

select * from finish();
rollback;
