-- Midweek Madness, migration B (20261004000000): the 14-day archetype cooldown.
-- BUILD_SPEC §44.2; ADR-089, ADR-094.
--
-- Personas:
--   A -- active member linked to Player PA (all_rounder, never changed).
--   D -- disabled member linked to Player PD.
--   M -- admin, not linked to a Player.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(28);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_column('kut','players','archetype_changed_at','players carry the self-service change stamp');
select col_type_is('kut','players','archetype_changed_at','timestamp with time zone','the stamp is a timestamptz');
select col_is_null('kut','players','archetype_changed_at','the stamp is nullable: null means never changed');
select col_hasnt_default('kut','players','archetype_changed_at','the stamp has no default, so nothing is backfilled');
select function_privs_are('kut','set_own_player_archetype',array['text'],'anon',array[]::text[],'anon cannot change an archetype');
select function_privs_are('kut','set_own_player_archetype',array['text'],'authenticated',array['EXECUTE'],'members can call the self-service RPC');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000094-0000-4000-8000-0000000000a1','ac-a@example.test','authenticated','authenticated','{}'::jsonb,'{}'::jsonb,now(),now()),
('00000094-0000-4000-8000-0000000000d1','ac-d@example.test','authenticated','authenticated','{}'::jsonb,'{}'::jsonb,now(),now()),
('00000094-0000-4000-8000-0000000000e1','ac-m@example.test','authenticated','authenticated','{}'::jsonb,'{}'::jsonb,now(),now());

insert into kut.players(id,slug,display_name,archetype) values
('00000094-0000-4000-8000-00000000a001','ac-player-a','AC Player A','all_rounder'),
('00000094-0000-4000-8000-00000000a004','ac-player-d','AC Player D','all_rounder');

insert into kut.profiles(id,display_name,role,player_id,is_disabled) values
('00000094-0000-4000-8000-0000000000a1','AC A','user','00000094-0000-4000-8000-00000000a001',false),
('00000094-0000-4000-8000-0000000000d1','AC D','user','00000094-0000-4000-8000-00000000a004',true),
('00000094-0000-4000-8000-0000000000e1','AC M','admin',null,false);

-- ---------------------------------------------------------------------------
-- The first change is always allowed, and stamps the Player
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000094-0000-4000-8000-0000000000a1';
select lives_ok($q$select kut.set_own_player_archetype('finisher')$q$,'a first change is allowed');
reset role;
select set_config('request.jwt.claim.sub','',true);

select is((select archetype from kut.players where id='00000094-0000-4000-8000-00000000a001'),'finisher','the first change is stored');
select is((select archetype_changed_at from kut.players where id='00000094-0000-4000-8000-00000000a001'),now(),'the first change stamps the Player');
select is(
  (select s.sho from kut.player_season_state s
     join kut.seasons season on season.id=s.season_id and season.is_active
    where s.player_id='00000094-0000-4000-8000-00000000a001'),
  40,
  'the change still rebuilds the stats (SHO 30 + finisher 10)'
);

-- ---------------------------------------------------------------------------
-- Within 14 days: a change is refused, a re-save of the same archetype is not
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000094-0000-4000-8000-0000000000a1';
select throws_ok(
  $q$select kut.set_own_player_archetype('tank')$q$,
  '22023',
  'archetype change cooldown: next change allowed from '
    || to_char((now()+interval '336 hours') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'a second change within 14 days is refused with 22023 and the next allowed moment'
);
do $$
declare
  v_detail text;
begin
  perform kut.set_own_player_archetype('tank');
exception when sqlstate '22023' then
  get stacked diagnostics v_detail = pg_exception_detail;
  perform set_config('kut_test.cooldown_detail', v_detail, true);
end $$;
select throws_ok($q$select kut.set_own_player_archetype('keeper')$q$,'22023','invalid archetype: keeper','an invalid archetype is still rejected as invalid, before the cooldown');
reset role;
select set_config('request.jwt.claim.sub','',true);

select is(
  current_setting('kut_test.cooldown_detail',true),
  to_char((now()+interval '336 hours') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'the refusal DETAIL carries the exact next allowed moment as ISO-8601 UTC'
);
select is((select archetype from kut.players where id='00000094-0000-4000-8000-00000000a001'),'finisher','a refused change leaves the archetype alone');

-- Seven days in: re-saving the archetype the Player already has.
update kut.players set archetype_changed_at = now() - interval '7 days'
where id='00000094-0000-4000-8000-00000000a001';
set local role authenticated;
set local request.jwt.claim.sub = '00000094-0000-4000-8000-0000000000a1';
select lives_ok($q$select kut.set_own_player_archetype('finisher')$q$,'re-saving the current archetype is not a change and is allowed');
reset role;
select set_config('request.jwt.claim.sub','',true);
select is((select archetype_changed_at from kut.players where id='00000094-0000-4000-8000-00000000a001'),now() - interval '7 days','a same-archetype re-save does not restart the cooldown');

-- One second short of 14 days is still inside the window.
update kut.players set archetype_changed_at = now() - interval '336 hours' + interval '1 second'
where id='00000094-0000-4000-8000-00000000a001';
set local role authenticated;
set local request.jwt.claim.sub = '00000094-0000-4000-8000-0000000000a1';
select throws_ok($q$select kut.set_own_player_archetype('tank')$q$,'22023',NULL,'a change one second before the 14 days are up is refused');
reset role;
select set_config('request.jwt.claim.sub','',true);

-- ---------------------------------------------------------------------------
-- After 14 days: allowed again, and the stamp moves
-- ---------------------------------------------------------------------------
update kut.players set archetype_changed_at = now() - interval '336 hours'
where id='00000094-0000-4000-8000-00000000a001';
set local role authenticated;
set local request.jwt.claim.sub = '00000094-0000-4000-8000-0000000000a1';
select lives_ok($q$select kut.set_own_player_archetype('tank')$q$,'a change exactly 14 days after the last one is allowed');
reset role;
select set_config('request.jwt.claim.sub','',true);
select is((select archetype from kut.players where id='00000094-0000-4000-8000-00000000a001'),'tank','the later change is stored');
select is((select archetype_changed_at from kut.players where id='00000094-0000-4000-8000-00000000a001'),now(),'the later change restarts the cooldown');

-- ---------------------------------------------------------------------------
-- The other refusals keep their codes
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000094-0000-4000-8000-0000000000d1';
select throws_ok($q$select kut.set_own_player_archetype('tank')$q$,'P0001','no linked player for this account','a disabled member is still refused as unlinked');
reset role;
select set_config('request.jwt.claim.sub','',true);
select is((select archetype_changed_at from kut.players where id='00000094-0000-4000-8000-00000000a004'),NULL::timestamptz,'a refused disabled member leaves no stamp');

-- ---------------------------------------------------------------------------
-- The admin path is not limited and does not stamp
-- ---------------------------------------------------------------------------
update kut.players set archetype_changed_at = now() - interval '3 days'
where id='00000094-0000-4000-8000-00000000a001';
set local role authenticated;
set local request.jwt.claim.sub = '00000094-0000-4000-8000-0000000000e1';
select lives_ok(
  $q$update kut.players set archetype='defender' where id='00000094-0000-4000-8000-00000000a001'$q$,
  'an admin can reassign an archetype inside the member''s cooldown'
);
select lives_ok($q$select kut.admin_add_player('AC Admin Added','goalkeeper')$q$,'an admin can still add a Player with any archetype');
reset role;
select set_config('request.jwt.claim.sub','',true);

select is((select archetype from kut.players where id='00000094-0000-4000-8000-00000000a001'),'defender','the admin reassignment is stored');
select is((select archetype_changed_at from kut.players where id='00000094-0000-4000-8000-00000000a001'),now() - interval '3 days','the admin reassignment leaves the member''s stamp alone');
select is((select archetype_changed_at from kut.players where slug='ac-admin-added'),NULL::timestamptz,'a Player added by an admin starts unstamped');

-- A Player added by an admin can still make a first self-service change: the
-- unstamped state is what allows it, whatever archetype the admin chose.
update kut.profiles set player_id=(select id from kut.players where slug='ac-admin-added')
where id='00000094-0000-4000-8000-0000000000d1';
update kut.profiles set is_disabled=false where id='00000094-0000-4000-8000-0000000000d1';
set local role authenticated;
set local request.jwt.claim.sub = '00000094-0000-4000-8000-0000000000d1';
select lives_ok($q$select kut.set_own_player_archetype('speedster')$q$,'an admin-set archetype does not start a cooldown');
reset role;
select set_config('request.jwt.claim.sub','',true);

select * from finish();
rollback;
