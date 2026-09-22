-- ADR-081: kut.season_rating_rules has RLS and one active-member read policy.
--
-- The same caller classes as member_only_projections.test.sql (ADR-079) -- anon,
-- a profileless JWT from another VibeTrunk tool, a disabled member, an active
-- member, an admin (the one app reader, /admin/attendance) and the service
-- role -- plus the three security definer paths that read or write the table
-- on the members' behalf.
--
-- Deny reads are `is(count, 0)`: the policy filters, it never raises. Only a
-- MISSING GRANT raises (anon's read, every member write), and only those are
-- `throws_ok`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(27);

-- ---------------------------------------------------------------------------
-- Shape: RLS on, not forced, exactly one SELECT policy for authenticated.
-- ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid='kut.season_rating_rules'::regclass),
  'RLS is enabled on season_rating_rules');
select ok(not (select relforcerowsecurity from pg_class where oid='kut.season_rating_rules'::regclass),
  'RLS is not forced, so the table owner keeps its bypass');
select policies_are('kut','season_rating_rules',array['active members read rating rules'],
  'season_rating_rules has exactly the one read policy');
select policy_cmd_is('kut','season_rating_rules','active members read rating rules','select',
  'the policy covers SELECT only');
select policy_roles_are('kut','season_rating_rules','active members read rating rules',array['authenticated'],
  'the policy applies to authenticated only');

-- This was the last one: the build spec's "RLS on every table" now holds for
-- the whole schema, and a new table without it fails here.
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='kut' and c.relkind in ('r','p') and not c.relrowsecurity),
  null::text[],
  'every table in the kut schema has RLS enabled');

-- Grants are exactly what 20260920070000 set.
select table_privs_are('kut','season_rating_rules','anon',array[]::text[],'anon has no privilege on season_rating_rules');
select table_privs_are('kut','season_rating_rules','authenticated',array['SELECT'],'members keep SELECT and only SELECT');
select table_privs_are('kut','season_rating_rules','service_role',array['SELECT'],'the service role keeps SELECT and only SELECT');

-- The definer paths bypass RLS because they run as the table's owner. Pin that
-- structurally: it holds on any stack, whatever role attributes the platform
-- grants (locally the owner also has BYPASSRLS, which would mask a regression
-- in the behavioural assertions at the end of this file).
select ok(
  (select p.prosecdef and p.proowner=c.relowner from pg_proc p, pg_class c
   where p.oid='kut._rebuild_season_core(uuid)'::regprocedure and c.oid='kut.season_rating_rules'::regclass),
  'the season rebuild is security definer and owned by the table owner');
select ok(
  (select p.prosecdef and p.proowner=c.relowner from pg_proc p, pg_class c
   where p.oid='kut._version_and_open_session_survey()'::regprocedure and c.oid='kut.season_rating_rules'::regclass),
  'the publish versioning trigger is security definer and owned by the table owner');
select ok(
  (select p.prosecdef and p.proowner=c.relowner from pg_proc p, pg_class c
   where p.oid='kut.initialize_season_rating_rules()'::regprocedure and c.oid='kut.season_rating_rules'::regclass),
  'the season seeding trigger is security definer and owned by the table owner');

-- ---------------------------------------------------------------------------
-- Fixtures.
--   A -- active member.  C -- disabled member.  D -- auth.users only, no
--   kut.profiles row: the cross-tool JWT.  E -- admin.
-- The season's rules row is seeded by the trigger; the cutover is moved to this
-- week so a session published today is a v2 session.
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000081-0000-4000-8000-0000000000a1','rules-active@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000081-0000-4000-8000-0000000000c1','rules-disabled@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000081-0000-4000-8000-0000000000d1','rules-other-tool@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000081-0000-4000-8000-0000000000e1','rules-admin@example.test','authenticated','authenticated','{}','{}',now(),now());

insert into kut.players(id,slug,display_name,archetype) values
('00000081-0000-4000-8000-000000000101','rules-player-a','Rules Player A','all_rounder'),
('00000081-0000-4000-8000-000000000103','rules-player-c','Rules Player C','all_rounder');

insert into kut.profiles(id,display_name,role,player_id,username,is_disabled) values
('00000081-0000-4000-8000-0000000000a1','Rules Active','user','00000081-0000-4000-8000-000000000101','rules_active',false),
('00000081-0000-4000-8000-0000000000c1','Rules Disabled','user','00000081-0000-4000-8000-000000000103','rules_disabled',true),
('00000081-0000-4000-8000-0000000000e1','Rules Admin','admin',null,'rules_admin',false);

update kut.seasons set is_active=false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000081-0000-4000-8000-000000000200','Rules Test Season',current_date-14,true);

select is(
  (select count(*)::int from kut.season_rating_rules where season_id='00000081-0000-4000-8000-000000000200'),
  1,
  'creating a season still seeds its rules row through the definer trigger');

update kut.season_rating_rules set v2_starts_week=date_trunc('week',current_date)::date
where season_id='00000081-0000-4000-8000-000000000200';

-- ---------------------------------------------------------------------------
-- anon is refused at the grant, before any policy runs.
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($q$select 1 from kut.season_rating_rules$q$,'42501',NULL,
  'anon is refused at the grant');
reset role;

-- ---------------------------------------------------------------------------
-- Authenticated caller classes.
-- ---------------------------------------------------------------------------
set local role authenticated;

set local request.jwt.claim.sub='00000081-0000-4000-8000-0000000000d1';
select is((select count(*)::int from kut.season_rating_rules),0,
  'a JWT with no KUT profile reads no rating rules');

set local request.jwt.claim.sub='00000081-0000-4000-8000-0000000000c1';
select is((select count(*)::int from kut.season_rating_rules),0,
  'a disabled member reads no rating rules');

set local request.jwt.claim.sub='00000081-0000-4000-8000-0000000000a1';
select is(
  (select v2_starts_week from kut.season_rating_rules where season_id='00000081-0000-4000-8000-000000000200'),
  date_trunc('week',current_date)::date,
  'an active member reads the season cutover');

-- Writes: no grant, so each raises before RLS is consulted.
select throws_ok(
  $q$insert into kut.season_rating_rules(season_id,v2_starts_week) values('00000081-0000-4000-8000-000000000200',current_date)$q$,
  '42501',NULL,'an active member cannot insert rating rules');
select throws_ok(
  $q$update kut.season_rating_rules set v2_starts_week=current_date where season_id='00000081-0000-4000-8000-000000000200'$q$,
  '42501',NULL,'an active member cannot update rating rules');
select throws_ok(
  $q$delete from kut.season_rating_rules where season_id='00000081-0000-4000-8000-000000000200'$q$,
  '42501',NULL,'an active member cannot delete rating rules');

-- The admin is the one app reader: /admin/attendance explains the cutover.
set local request.jwt.claim.sub='00000081-0000-4000-8000-0000000000e1';
select is(
  (select v2_starts_week from kut.season_rating_rules where season_id='00000081-0000-4000-8000-000000000200'),
  date_trunc('week',current_date)::date,
  'an admin reads the season cutover for /admin/attendance');

-- ---------------------------------------------------------------------------
-- Definer paths, called as the authenticated admin, asserted as the superuser.
-- The version stamp is the discriminating check: if RLS hid the row from the
-- trigger, its subquery would return NULL and the session would be stamped 1.
-- ---------------------------------------------------------------------------
select lives_ok(
  $q$select kut.publish_attendance_session('00000081-0000-4000-8000-000000000200',current_date,'other',
     '[{"player_id":"00000081-0000-4000-8000-000000000101","goals":0}]'::jsonb)$q$,
  'an admin can still publish a session');
select lives_ok(
  $q$select kut.rebuild_season('00000081-0000-4000-8000-000000000200')$q$,
  'an admin can still rebuild the season, which reads the cutover');
reset role; select set_config('request.jwt.claim.sub','',true);

select is(
  (select rating_rules_version from kut.match_sessions
   where season_id='00000081-0000-4000-8000-000000000200' and session_date=current_date),
  2,
  'publishing still stamps the version from the stored cutover');
select is(
  (select count(*)::int from kut.player_season_state
   where season_id='00000081-0000-4000-8000-000000000200' and player_id='00000081-0000-4000-8000-000000000101'),
  1,
  'the rebuild still produced the attendee''s season state');

-- ---------------------------------------------------------------------------
-- service_role, last: the role claim would otherwise leak into later asserts.
-- ---------------------------------------------------------------------------
set local role service_role; set local request.jwt.claim.role='service_role';
select is(
  (select count(*)::int from kut.season_rating_rules where season_id='00000081-0000-4000-8000-000000000200'),
  1,
  'the service role reads the rating rules');
select is(
  (select v2_starts_week from kut.season_rating_rules where season_id='00000081-0000-4000-8000-000000000200'),
  date_trunc('week',current_date)::date,
  'the service role reads the stored cutover');
reset role; select set_config('request.jwt.claim.role','',true);

select * from finish();
rollback;
