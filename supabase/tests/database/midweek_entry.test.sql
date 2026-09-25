-- Midweek Madness, migration A (20261003000000): the schema and squad entry.
-- BUILD_SPEC §44.1, §44.2, §44.9; ADR-089, ADR-091.
--
-- Personas:
--   A -- active member: owns five cards of five Players, a second copy of one of
--        them, a burned card and a listed card.
--   B -- active member: owns one card.
--   C -- disabled member with a card of their own.
--   D -- an auth.users row with no kut.profiles row: the cross-tool JWT.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(89);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_table('kut','midweek_config','the launch switch exists');
select has_table('kut','midweek_tournaments','tournaments exist');
select has_table('kut','midweek_tournament_secrets','the seed table exists');
select has_table('kut','midweek_squads','squads exist');
select has_table('kut','midweek_squad_cards','squad cards exist');
select has_table('kut','midweek_opt_outs','opt-outs exist');
select has_view('kut','midweek_current','the current-tournament projection exists');
select has_view('kut','my_midweek_squad','the own-squad projection exists');
select has_view('kut','midweek_tournaments_public','the tournament list exists');

select is((select count(*)::int from kut.midweek_config),1,'the switch is a single row');
select is((select enabled from kut.midweek_config),false,'Midweek Madness starts switched off');
select throws_ok($q$insert into kut.midweek_config(id,enabled) values(false,true)$q$,'23514',NULL,'a second switch row is refused');

select table_privs_are('kut','midweek_tournaments','anon',array[]::text[],'anon cannot read tournaments');
select table_privs_are('kut','midweek_tournaments','authenticated',array[]::text[],'members cannot read tournaments directly');
select table_privs_are('kut','midweek_tournament_secrets','authenticated',array[]::text[],'members cannot read the seed table');
select table_privs_are('kut','midweek_tournament_secrets','service_role',array['SELECT'],'only the service role reads the seed table');
select table_privs_are('kut','midweek_squads','authenticated',array[]::text[],'members cannot read squads directly');
select table_privs_are('kut','midweek_squad_cards','authenticated',array[]::text[],'members cannot read squad cards directly');
select table_privs_are('kut','midweek_opt_outs','authenticated',array[]::text[],'members cannot read opt-outs directly');
select table_privs_are('kut','midweek_config','authenticated',array[]::text[],'members cannot write the switch');
select table_privs_are('kut','midweek_current','anon',array[]::text[],'anon cannot read the current tournament');
select table_privs_are('kut','midweek_current','authenticated',array['SELECT'],'members read the current tournament');
select table_privs_are('kut','midweek_tournaments_public','anon',array[]::text[],'anon cannot read the tournament list');
select table_privs_are('kut','midweek_tournaments_public','authenticated',array['SELECT'],'members read the tournament list');
select table_privs_are('kut','my_midweek_squad','anon',array[]::text[],'anon cannot read squads');
select table_privs_are('kut','my_midweek_squad','authenticated',array['SELECT'],'members read their own squad');

select function_privs_are('kut','save_midweek_squad',array['uuid[]'],'anon',array[]::text[],'anon cannot save a squad');
select function_privs_are('kut','save_midweek_squad',array['uuid[]'],'authenticated',array['EXECUTE'],'members can save a squad');
select function_privs_are('kut','set_midweek_opt_out',array['boolean'],'anon',array[]::text[],'anon cannot opt out');
select function_privs_are('kut','set_midweek_opt_out',array['boolean'],'authenticated',array['EXECUTE'],'members can opt out');

select throws_ok($q$insert into kut.midweek_tournaments(week_start,lock_at,seed_hash) values('2026-10-07',now(),repeat('a',64))$q$,'23514',NULL,'a tournament starts on an ISO Monday');
select throws_ok($q$insert into kut.midweek_tournaments(week_start,lock_at,seed_hash) values('2026-10-05',now(),'not-a-hash')$q$,'23514',NULL,'the seed hash is 64 hex characters');
select throws_ok($q$insert into kut.midweek_tournaments(week_start,lock_at,seed_hash,seed) values('2026-10-05',now(),repeat('a',64),repeat('b',64))$q$,'23514',NULL,'the seed is published only once complete');
select throws_ok($q$insert into kut.midweek_tournaments(week_start,lock_at,seed_hash,status) values('2026-10-05',now(),repeat('a',64),'skipped')$q$,'23514',NULL,'a skipped week says why');
select throws_ok($q$insert into kut.midweek_tournaments(week_start,lock_at,seed_hash,status,status_reason) values('2026-10-05',now(),repeat('a',64),'skipped','admin_void')$q$,'23514',NULL,'a skip is a club break or too few entrants');
select throws_ok($q$insert into kut.midweek_tournaments(week_start,lock_at,seed_hash,status,status_reason) values('2026-10-05',now(),repeat('a',64),'void','admin_void')$q$,'23514',NULL,'a void carries the admin''s note');
select throws_ok($q$insert into kut.midweek_tournaments(week_start,lock_at,seed_hash,status,status_reason,void_note) values('2026-10-05',now(),repeat('a',64),'void','club_break','Oops')$q$,'23514',NULL,'a void''s reason is admin_void');
select throws_ok($q$insert into kut.midweek_tournaments(week_start,lock_at,seed_hash,status_reason) values('2026-10-05',now(),repeat('a',64),'club_break')$q$,'23514',NULL,'an open week has no reason');
select throws_ok($q$insert into kut.midweek_tournaments(week_start,lock_at,seed_hash,status,status_reason,void_note) values('2026-10-05',now(),repeat('a',64),'skipped','club_break','Nope')$q$,'23514',NULL,'only a void has a note');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000093-0000-4000-8000-0000000000a1','mw-a@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000093-0000-4000-8000-0000000000b1','mw-b@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000093-0000-4000-8000-0000000000c1','mw-c@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000093-0000-4000-8000-0000000000d1','mw-d@example.test','authenticated','authenticated','{}','{}',now(),now());

insert into kut.players(id,slug,display_name,archetype)
select ('00000093-0000-4000-8000-00000000010' || n)::uuid, 'mw-player-' || n, 'MW Player ' || n, 'all_rounder'
from generate_series(1,7) n;

insert into kut.profiles(id,display_name,role,username) values
('00000093-0000-4000-8000-0000000000a1','MW A','user','mw_a'),
('00000093-0000-4000-8000-0000000000b1','MW B','user','mw_b'),
('00000093-0000-4000-8000-0000000000c1','MW C','user','mw_c');

insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000093-0000-4000-8000-00000000020' || n)::uuid, ('00000093-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW Live ' || n, true
from generate_series(1,7) n;

-- A: cards 301-305 of Players 1-5, 306 a second copy of Player 1, 307 burned
-- (Player 6), 308 of Player 7 and listed on the market.
insert into kut.user_cards(id,edition_id,owner_id,source,burned_at) values
('00000093-0000-4000-8000-000000000301','00000093-0000-4000-8000-000000000201','00000093-0000-4000-8000-0000000000a1','pack',null),
('00000093-0000-4000-8000-000000000302','00000093-0000-4000-8000-000000000202','00000093-0000-4000-8000-0000000000a1','pack',null),
('00000093-0000-4000-8000-000000000303','00000093-0000-4000-8000-000000000203','00000093-0000-4000-8000-0000000000a1','pack',null),
('00000093-0000-4000-8000-000000000304','00000093-0000-4000-8000-000000000204','00000093-0000-4000-8000-0000000000a1','pack',null),
('00000093-0000-4000-8000-000000000305','00000093-0000-4000-8000-000000000205','00000093-0000-4000-8000-0000000000a1','pack',null),
('00000093-0000-4000-8000-000000000306','00000093-0000-4000-8000-000000000201','00000093-0000-4000-8000-0000000000a1','pack',null),
('00000093-0000-4000-8000-000000000307','00000093-0000-4000-8000-000000000206','00000093-0000-4000-8000-0000000000a1','pack',now()),
('00000093-0000-4000-8000-000000000308','00000093-0000-4000-8000-000000000207','00000093-0000-4000-8000-0000000000a1','pack',null),
('00000093-0000-4000-8000-000000000309','00000093-0000-4000-8000-000000000203','00000093-0000-4000-8000-0000000000b1','pack',null),
('00000093-0000-4000-8000-000000000310','00000093-0000-4000-8000-000000000204','00000093-0000-4000-8000-0000000000c1','pack',null);
insert into kut.market_listings(id,card_id,seller_id,price,status,listed_at,expires_at) values
('00000093-0000-4000-8000-000000000401','00000093-0000-4000-8000-000000000308','00000093-0000-4000-8000-0000000000a1',100,'active',now(),now()+interval '1 day');

update kut.profiles set is_disabled=true where id='00000093-0000-4000-8000-0000000000c1';

-- ---------------------------------------------------------------------------
-- No tournament yet: nothing to save to, but the switch is readable.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000093-0000-4000-8000-0000000000a1',true);
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000301'::uuid])$q$,'P0002',NULL,'with no open tournament there is nothing to save to');
select results_eq($q$select enabled, tournament_id from kut.midweek_current$q$,
  $q$values (false, null::uuid)$q$,'with no tournament, members still read the switch');
reset role;

insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash) values
('00000093-0000-4000-8000-000000000501',date_trunc('week',current_date)::date + 7,now()+interval '2 days',encode(sha256(decode(repeat('ab',32),'hex')),'hex'));
insert into kut.midweek_tournament_secrets(tournament_id,seed) values
('00000093-0000-4000-8000-000000000501',repeat('ab',32));
-- Last week's tournament, voided by an admin, so the list has an outcome to report.
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash,status,status_reason,void_note) values
('00000093-0000-4000-8000-000000000502',date_trunc('week',current_date)::date,now()-interval '5 days',repeat('c',64),'void','admin_void','A bug in the bracket; nothing was paid.');

-- ---------------------------------------------------------------------------
-- Saving
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000093-0000-4000-8000-0000000000a1',true);
select lives_ok($q$select kut.save_midweek_squad(array[
  '00000093-0000-4000-8000-000000000305','00000093-0000-4000-8000-000000000301','00000093-0000-4000-8000-000000000302',
  '00000093-0000-4000-8000-000000000303','00000093-0000-4000-8000-000000000304']::uuid[])$q$,'a member saves five cards of five Players');
select results_eq($q$select slot::int, card_id from kut.my_midweek_squad order by slot$q$,
  $q$values (1,'00000093-0000-4000-8000-000000000305'::uuid),(2,'00000093-0000-4000-8000-000000000301'::uuid),
    (3,'00000093-0000-4000-8000-000000000302'::uuid),(4,'00000093-0000-4000-8000-000000000303'::uuid),
    (5,'00000093-0000-4000-8000-000000000304'::uuid)$q$,'the squad keeps the picked order as its slots');
select lives_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000306','00000093-0000-4000-8000-000000000308']::uuid[])$q$,
  'a member may save fewer than five, and a listed card still counts as owned');
select is((select count(*)::int from kut.my_midweek_squad),2,'saving again replaces the squad');
select is((select count(*)::int from kut.my_midweek_squad where player_id='00000093-0000-4000-8000-000000000101'),1,'the second copy of a Player plays for that Player');

select throws_ok($q$select kut.save_midweek_squad(array[]::uuid[])$q$,'22023',NULL,'an empty squad is refused');
select throws_ok($q$select kut.save_midweek_squad(null)$q$,'22023',NULL,'no squad at all is refused');
select throws_ok($q$select kut.save_midweek_squad(array[
  '00000093-0000-4000-8000-000000000301','00000093-0000-4000-8000-000000000302','00000093-0000-4000-8000-000000000303',
  '00000093-0000-4000-8000-000000000304','00000093-0000-4000-8000-000000000305','00000093-0000-4000-8000-000000000308']::uuid[])$q$,
  '22023',NULL,'six cards are refused');
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000301','00000093-0000-4000-8000-000000000301']::uuid[])$q$,
  '22023',NULL,'the same card twice is refused');
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000301',null]::uuid[])$q$,
  '22023',NULL,'a missing card is refused');
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000301','00000093-0000-4000-8000-000000000306']::uuid[])$q$,
  '22023','each card must be a different Player','two copies of one Player are refused');
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000307']::uuid[])$q$,
  '22023','you can only pick active cards you own','a burned card is refused');
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000309']::uuid[])$q$,
  '22023','you can only pick active cards you own','another member''s card is refused');
select is((select count(*)::int from kut.my_midweek_squad),2,'a refused save leaves the saved squad alone');

-- B cannot see A's squad before the lock (ADR-091).
select set_config('request.jwt.claim.sub','00000093-0000-4000-8000-0000000000b1',true);
select is((select count(*)::int from kut.my_midweek_squad),0,'another member reads nothing of a squad that is not theirs');
select lives_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000309']::uuid[])$q$,'B saves a one-card squad');
select is((select count(*)::int from kut.my_midweek_squad),1,'B reads only their own squad');

-- The current tournament: the hash is public, the seed is not.
select results_eq($q$select enabled, tournament_id, status, seed_hash, seed, opted_out from kut.midweek_current$q$,
  $q$values (false, '00000093-0000-4000-8000-000000000501'::uuid, 'open', encode(sha256(decode(repeat('ab',32),'hex')),'hex'), null::text, false)$q$,
  'members read the open tournament and its seed hash, never its seed');
select results_eq($q$select tournament_id, status, status_reason, void_note, seed from kut.midweek_tournaments_public$q$,
  $q$values ('00000093-0000-4000-8000-000000000501'::uuid,'open',null::text,null::text,null::text),
    ('00000093-0000-4000-8000-000000000502'::uuid,'void','admin_void','A bug in the bracket; nothing was paid.',null::text)$q$,
  'members read every tournament, newest first, with last week''s void and its note');
select is((select status_reason from kut.midweek_current),null,'the open tournament has no reason');
select ok((select seed_hash from kut.midweek_current) = (select encode(sha256(decode(seed,'hex')),'hex') from (select repeat('ab',32) seed) s),
  'the published hash is sha256 of the seed');

-- ---------------------------------------------------------------------------
-- Callers who may not enter
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000093-0000-4000-8000-0000000000c1',true);
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000310']::uuid[])$q$,'42501',NULL,'a disabled member cannot save');
select throws_ok($q$select kut.set_midweek_opt_out(true)$q$,'42501',NULL,'a disabled member cannot opt out');
select is((select count(*)::int from kut.midweek_current),0,'a disabled member reads no tournament');
select is((select count(*)::int from kut.my_midweek_squad),0,'a disabled member reads no squad');
select is((select count(*)::int from kut.midweek_tournaments_public),0,'a disabled member reads no tournament list');

select set_config('request.jwt.claim.sub','00000093-0000-4000-8000-0000000000d1',true);
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000301']::uuid[])$q$,'42501',NULL,'a JWT with no KUT profile cannot save');
select is((select count(*)::int from kut.midweek_current),0,'a JWT with no KUT profile reads no tournament');
select is((select count(*)::int from kut.midweek_tournaments_public),0,'a JWT with no KUT profile reads no tournament list');
reset role;

set local role anon;
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000301']::uuid[])$q$,'42501',NULL,'anon is refused at the grant');
select throws_ok($q$select 1 from kut.midweek_current$q$,'42501',NULL,'anon cannot read the current tournament');
select throws_ok($q$select 1 from kut.midweek_tournaments_public$q$,'42501',NULL,'anon cannot read the tournament list');
reset role;

-- ---------------------------------------------------------------------------
-- Opting out
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000093-0000-4000-8000-0000000000a1',true);
select throws_ok($q$select kut.set_midweek_opt_out(null)$q$,'22023',NULL,'an opt-out needs a yes or a no');
select is(kut.set_midweek_opt_out(true),'{"opted_out": true}'::jsonb,'a member opts out');
select is((select count(*)::int from kut.my_midweek_squad),0,'opting out withdraws the squad saved for the open tournament');
select is((select opted_out from kut.midweek_current),true,'the projection shows the caller has opted out');
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000301']::uuid[])$q$,
  'P0001','you have opted out of Midweek Madness','an opted-out member cannot save');
select is(kut.set_midweek_opt_out(true),'{"opted_out": true}'::jsonb,'opting out twice is harmless');
select is(kut.set_midweek_opt_out(false),'{"opted_out": false}'::jsonb,'a member opts back in');
select lives_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000301']::uuid[])$q$,'and can save again');
reset role;
select is((select count(*)::int from kut.midweek_opt_outs),0,'opting back in leaves no opt-out row');

-- ---------------------------------------------------------------------------
-- The lock
-- ---------------------------------------------------------------------------
update kut.midweek_tournaments set lock_at = now() - interval '1 second' where id='00000093-0000-4000-8000-000000000501';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000093-0000-4000-8000-0000000000a1',true);
select throws_ok($q$select kut.save_midweek_squad(array['00000093-0000-4000-8000-000000000302']::uuid[])$q$,
  'P0001','squads are locked','no change after the lock');
select is((select card_id from kut.my_midweek_squad),'00000093-0000-4000-8000-000000000301'::uuid,'the squad saved before the lock stands');
select is(kut.set_midweek_opt_out(true),'{"opted_out": true}'::jsonb,'a member may still opt out after the lock');
select is((select count(*)::int from kut.my_midweek_squad),1,'but a locked squad is not withdrawn by it');
reset role;

-- The slot rules hold at the table level too, whoever writes.
select is((select count(*)::int from kut.midweek_squad_cards sc join kut.midweek_squads s on s.id=sc.squad_id
  where s.user_id='00000093-0000-4000-8000-0000000000b1'),1,'B still has one card saved');
select throws_ok($q$insert into kut.midweek_squad_cards(squad_id,slot,card_id,player_id)
  select id,6,'00000093-0000-4000-8000-000000000309','00000093-0000-4000-8000-000000000103' from kut.midweek_squads
  where user_id='00000093-0000-4000-8000-0000000000b1'$q$,'23514',NULL,'a squad has at most five slots');
select throws_ok($q$insert into kut.midweek_squad_cards(squad_id,slot,card_id,player_id)
  select id,2,'00000093-0000-4000-8000-000000000309','00000093-0000-4000-8000-000000000103' from kut.midweek_squads
  where user_id='00000093-0000-4000-8000-0000000000b1'$q$,'23505',NULL,'a squad fields each card once');

select * from finish();
rollback;
