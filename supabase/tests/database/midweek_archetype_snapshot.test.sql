-- Midweek Madness (20261008000000): archetypes are frozen when a tournament
-- opens. BUILD_SPEC §44.2; ADR-099.
--
-- Every profile outside this file is opted out a year ago, so the field is
-- exactly these personas:
--   M1   -- saves a squad with Player 1, a Goalkeeper when the week opens.
--   M2   -- owns Player 2, and Player 5, which is created after the open.
--   M3   -- owns Player 3.
--   M4   -- is Player 1, owns Player 4, and changes their archetype to
--           Speedster after the open.
--   D    -- a disabled member.
-- T1 opens before the change and locks in this file; T2 opens after it.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(19);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_table('kut','midweek_archetype_snapshots','the snapshot table exists');
select has_view('kut','midweek_archetypes','the members'' projection exists');
select table_privs_are('kut','midweek_archetype_snapshots','authenticated',array[]::text[],'members cannot read snapshots directly');
select table_privs_are('kut','midweek_archetype_snapshots','anon',array[]::text[],'anon cannot read snapshots');
select table_privs_are('kut','midweek_archetypes','authenticated',array['SELECT'],'members read the projection');
select table_privs_are('kut','midweek_archetypes','anon',array[]::text[],'anon cannot read the projection');
select function_privs_are('kut','_mm_snapshot_archetypes',array[]::text[],'authenticated',array[]::text[],'members cannot call the snapshot trigger function');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;

update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000099-0000-4000-8000-0000000000f0','MW Snapshot Test',date '2024-05-06',true);

insert into kut.players(id,slug,display_name,archetype)
select ('00000099-0000-4000-8000-00000000010' || n)::uuid, 'mw99-player-' || n, 'MW99 Player ' || n,
  (array['goalkeeper','finisher','defender','tank'])[n]
from generate_series(1,4) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000099-0000-4000-8000-00000000010' || n)::uuid, '00000099-0000-4000-8000-0000000000f0', 50, 0,
  60, 50, 50, 50, 50, 50, 50, 'gold'
from generate_series(1,4) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000099-0000-4000-8000-00000000020' || n)::uuid, ('00000099-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW99 Live ' || n, true
from generate_series(1,4) n;

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000099-0000-4000-8000-00000000000' || n)::uuid, 'mw99-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['1','2','3','4','d']) n;
insert into kut.profiles(id,display_name,role,username,player_id,is_disabled)
select ('00000099-0000-4000-8000-00000000000' || n)::uuid, 'MW99 ' || upper(n), 'user', 'mw99_' || n,
  case when n = '4' then '00000099-0000-4000-8000-000000000101'::uuid end, n = 'd'
from unnest(array['1','2','3','4','d']) n;

insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000099-0000-4000-8000-00000000030' || n)::uuid, ('00000099-0000-4000-8000-00000000020' || n)::uuid,
  ('00000099-0000-4000-8000-00000000000' || n)::uuid, 'pack'
from generate_series(1,4) n;

-- A published session the football week before T1, so it isn't a club break.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at) values
('00000099-0000-4000-8000-000000000701','00000099-0000-4000-8000-0000000000f0',date '2024-05-29','other','published',now());

-- ---------------------------------------------------------------------------
-- Opening a week snapshots the roster
-- ---------------------------------------------------------------------------
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash) values
('00000099-0000-4000-8000-000000000501',date '2024-06-03',now() + interval '1 day',encode(sha256(decode(repeat('9c',32),'hex')),'hex'));
insert into kut.midweek_tournament_secrets(tournament_id,seed) values ('00000099-0000-4000-8000-000000000501',repeat('9c',32));

select is((select count(*)::int from kut.midweek_archetype_snapshots where tournament_id='00000099-0000-4000-8000-000000000501'),
  (select count(*)::int from kut.players),'opening a week snapshots every Player');
select is((select archetype from kut.midweek_archetype_snapshots
  where tournament_id='00000099-0000-4000-8000-000000000501' and player_id='00000099-0000-4000-8000-000000000101'),
  'goalkeeper','each Player''s archetype as it stands at the open');

-- M1 saves Player 1 in goal.
insert into kut.midweek_squads(id,tournament_id,user_id) values
('00000099-0000-4000-8000-000000000601','00000099-0000-4000-8000-000000000501','00000099-0000-4000-8000-000000000001');
insert into kut.midweek_squad_cards(squad_id,slot,card_id,player_id) values
('00000099-0000-4000-8000-000000000601',1,'00000099-0000-4000-8000-000000000301','00000099-0000-4000-8000-000000000101');

-- ---------------------------------------------------------------------------
-- A change after the open applies from the next week
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000099-0000-4000-8000-000000000004';
select lives_ok($q$select kut.set_own_player_archetype('speedster')$q$,'the member changes their archetype after the open');
reset role;
select set_config('request.jwt.claim.sub','',true);

select is((select archetype from kut.players where id='00000099-0000-4000-8000-000000000101'),'speedster',
  'the change applies to the Player at once');
select is((select archetype from kut.midweek_archetype_snapshots
  where tournament_id='00000099-0000-4000-8000-000000000501' and player_id='00000099-0000-4000-8000-000000000101'),
  'goalkeeper','the open week''s snapshot keeps the archetype from the open');

-- Members read the snapshot; a disabled member reads nothing (ADR-079).
set local role authenticated;
set local request.jwt.claim.sub = '00000099-0000-4000-8000-000000000001';
select is((select archetype from kut.midweek_archetypes
  where tournament_id='00000099-0000-4000-8000-000000000501' and player_id='00000099-0000-4000-8000-000000000101'),
  'goalkeeper','a member reads the archetype the week will play');
set local request.jwt.claim.sub = '00000099-0000-4000-8000-00000000000d';
select is((select count(*)::int from kut.midweek_archetypes),0,'a disabled member reads no snapshot');
reset role;
select set_config('request.jwt.claim.sub','',true);

-- Player 5 joins the roster after the open, with a card for M2: no snapshot
-- row, so the field plays its live archetype.
insert into kut.players(id,slug,display_name,archetype) values
('00000099-0000-4000-8000-000000000105','mw99-player-5','MW99 Player 5','playmaker');
insert into kut.card_editions(id,player_id,edition_type,title,is_live) values
('00000099-0000-4000-8000-000000000205','00000099-0000-4000-8000-000000000105','live','MW99 Live 5',true);
insert into kut.user_cards(id,edition_id,owner_id,source) values
('00000099-0000-4000-8000-000000000305','00000099-0000-4000-8000-000000000205','00000099-0000-4000-8000-000000000002','pack');

select is((select card->>'archetype'
  from jsonb_array_elements(kut._mm_field('00000099-0000-4000-8000-000000000501', now())->'entrants') entrant,
    jsonb_array_elements(entrant->'owned') card
  where card->>'playerId' = '00000099-0000-4000-8000-000000000105'),
  'playmaker','a Player created after the open plays their live archetype');

-- ---------------------------------------------------------------------------
-- The lock plays the snapshot
-- ---------------------------------------------------------------------------
update kut.midweek_tournaments set lock_at = now() - interval '10 minutes' where id = '00000099-0000-4000-8000-000000000501';
set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);

select is((select status from kut.midweek_tournaments where id='00000099-0000-4000-8000-000000000501'),'simulated',
  'the week locks and simulates');
select is((select archetype from kut.midweek_entry_cards
  where tournament_id='00000099-0000-4000-8000-000000000501' and user_id='00000099-0000-4000-8000-000000000001' and slot = 0),
  'goalkeeper','the lock plays the archetype from the open, not the one changed since');
select results_eq($q$select keeper_slot::int, keeperless from kut.midweek_entries
  where tournament_id='00000099-0000-4000-8000-000000000501' and user_id='00000099-0000-4000-8000-000000000001'$q$,
  $q$values (0,false)$q$,'the squad that picked a Goalkeeper keeps its keeper');

-- ---------------------------------------------------------------------------
-- The next week opens with the new archetype
-- ---------------------------------------------------------------------------
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash) values
('00000099-0000-4000-8000-000000000502',date '2024-06-10',now() + interval '7 days',encode(sha256(decode(repeat('9d',32),'hex')),'hex'));

select is((select archetype from kut.midweek_archetype_snapshots
  where tournament_id='00000099-0000-4000-8000-000000000502' and player_id='00000099-0000-4000-8000-000000000101'),
  'speedster','the next week plays the changed archetype');

select * from finish();
rollback;
