-- KB-017 / ADR-079: every member-only definer projection proves an active KUT
-- profile before it returns a row.
--
-- The threat model is the shared VibeTrunk Supabase project: a JWT minted for
-- another tool is `authenticated` here too, and these ten views deliberately
-- bypass their source tables' RLS. Four caller classes are exercised against
-- all ten views -- a profileless UUID, a disabled member, an active member and
-- the service role -- plus `anon`, which must not reach them at all.
--
-- Every deny assertion is `is(count, 0)`, never `throws_ok`. That is deliberate
-- and is itself the regression test: src/lib/nav/context.ts:47-52 reads
-- kut.my_trade_offers in the same Promise.all as the profile read, before the
-- disabled-user redirect fires, so a gate that raised would turn every disabled
-- member's "/" render into a 500 instead of a redirect to /login.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(71);

-- ---------------------------------------------------------------------------
-- The predicate itself
-- ---------------------------------------------------------------------------
select has_function('kut','is_active_member','{}'::text[],'the active-member predicate exists');
select function_privs_are('kut','is_active_member','{}'::text[],'anon',array[]::text[],'anon cannot execute the predicate');
select function_privs_are('kut','is_active_member','{}'::text[],'authenticated',array['EXECUTE'],'members can execute the predicate');
select function_privs_are('kut','is_active_member','{}'::text[],'service_role',array['EXECUTE'],'the service role can execute the predicate');

-- ---------------------------------------------------------------------------
-- Grants are unchanged by the gate: anon still has none, members still have
-- SELECT. A gate that worked by revoking SELECT would be a different, worse
-- fix -- PostgREST would surface it as an error rather than an empty result.
-- ---------------------------------------------------------------------------
select table_privs_are('kut','activity_feed','anon',array[]::text[],'anon cannot select from activity_feed');
select table_privs_are('kut','active_market_listings','anon',array[]::text[],'anon cannot select from active_market_listings');
select table_privs_are('kut','club_value_leaderboard','anon',array[]::text[],'anon cannot select from club_value_leaderboard');
select table_privs_are('kut','public_live_ratings','anon',array[]::text[],'anon cannot select from public_live_ratings');
select table_privs_are('kut','chronicle_session_report_status','anon',array[]::text[],'anon cannot select from chronicle_session_report_status');
select table_privs_are('kut','chronicle_session_reports','anon',array[]::text[],'anon cannot select from chronicle_session_reports');
select table_privs_are('kut','my_trade_offers','anon',array[]::text[],'anon cannot select from my_trade_offers');
select table_privs_are('kut','my_club_value','anon',array[]::text[],'anon cannot select from my_club_value');
select table_privs_are('kut','my_club_value_editions','anon',array[]::text[],'anon cannot select from my_club_value_editions');
select table_privs_are('kut','my_club_value_copies','anon',array[]::text[],'anon cannot select from my_club_value_copies');

select table_privs_are('kut','activity_feed','authenticated',array['SELECT'],'members keep SELECT on activity_feed');
select table_privs_are('kut','active_market_listings','authenticated',array['SELECT'],'members keep SELECT on active_market_listings');
select table_privs_are('kut','club_value_leaderboard','authenticated',array['SELECT'],'members keep SELECT on club_value_leaderboard');
select table_privs_are('kut','public_live_ratings','authenticated',array['SELECT'],'members keep SELECT on public_live_ratings');
select table_privs_are('kut','chronicle_session_report_status','authenticated',array['SELECT'],'members keep SELECT on chronicle_session_report_status');
select table_privs_are('kut','chronicle_session_reports','authenticated',array['SELECT'],'members keep SELECT on chronicle_session_reports');
select table_privs_are('kut','my_trade_offers','authenticated',array['SELECT'],'members keep SELECT on my_trade_offers');
select table_privs_are('kut','my_club_value','authenticated',array['SELECT'],'members keep SELECT on my_club_value');
select table_privs_are('kut','my_club_value_editions','authenticated',array['SELECT'],'members keep SELECT on my_club_value_editions');
select table_privs_are('kut','my_club_value_copies','authenticated',array['SELECT'],'members keep SELECT on my_club_value_copies');

-- ---------------------------------------------------------------------------
-- Fixtures.
--   A -- active member: owns cards, sells a listing, attended the session.
--   B -- active member: owns nothing, is party to nothing, did NOT attend.
--   C -- disabled member: deliberately owns cards and is party to A's offer,
--        so "C reads nothing" is a real assertion rather than a vacuous one.
--   D -- an auth.users row with no kut.profiles row: the cross-tool JWT.
-- No persona is an admin or superadmin: kut.activity_feed filters superadmins
-- (KB-009) and kut.club_value_leaderboard filters non-'user' roles.
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('0000000f-0000-4000-8000-0000000000a1','gate-active@example.test','authenticated','authenticated','{}','{}',now(),now()),
('0000000f-0000-4000-8000-0000000000b1','gate-bystander@example.test','authenticated','authenticated','{}','{}',now(),now()),
('0000000f-0000-4000-8000-0000000000c1','gate-disabled@example.test','authenticated','authenticated','{}','{}',now(),now()),
('0000000f-0000-4000-8000-0000000000d1','gate-other-tool@example.test','authenticated','authenticated','{}','{}',now(),now()),
('0000000f-0000-4000-8000-0000000000e1','gate-admin@example.test','authenticated','authenticated','{}','{}',now(),now());

insert into kut.players(id,slug,display_name,archetype) values
('0000000f-0000-4000-8000-000000000101','gate-player-a','Gate Player A','all_rounder'),
('0000000f-0000-4000-8000-000000000102','gate-player-b','Gate Player B','all_rounder'),
('0000000f-0000-4000-8000-000000000103','gate-player-c','Gate Player C','all_rounder');

insert into kut.profiles(id,display_name,role,player_id,username) values
('0000000f-0000-4000-8000-0000000000a1','Gate Active','user','0000000f-0000-4000-8000-000000000101','gate_active'),
('0000000f-0000-4000-8000-0000000000b1','Gate Bystander','user','0000000f-0000-4000-8000-000000000102','gate_bystander'),
('0000000f-0000-4000-8000-0000000000c1','Gate Disabled','user','0000000f-0000-4000-8000-000000000103','gate_disabled'),
('0000000f-0000-4000-8000-0000000000e1','Gate Admin','admin',null,'gate_admin');

insert into kut.wallets(user_id,balance) values
('0000000f-0000-4000-8000-0000000000a1',500),
('0000000f-0000-4000-8000-0000000000b1',500),
('0000000f-0000-4000-8000-0000000000c1',500);

update kut.seasons set is_active=false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values('0000000f-0000-4000-8000-000000000200','Gate Test Season',current_date-14,true);
update kut.season_rating_rules set v2_starts_week=date_trunc('week',current_date)::date where season_id='0000000f-0000-4000-8000-000000000200';
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier) values
('0000000f-0000-4000-8000-000000000101','0000000f-0000-4000-8000-000000000200',50,0,60,60,60,60,60,60,60,'gold'),
('0000000f-0000-4000-8000-000000000103','0000000f-0000-4000-8000-000000000200',40,0,50,50,50,50,50,50,50,'silver');

insert into kut.card_editions(id,player_id,edition_type,title,is_live) values
('0000000f-0000-4000-8000-000000000301','0000000f-0000-4000-8000-000000000101','live','Gate A Live',true),
('0000000f-0000-4000-8000-000000000302','0000000f-0000-4000-8000-000000000103','live','Gate C Live',true);
insert into kut.user_cards(id,edition_id,owner_id,source) values
('0000000f-0000-4000-8000-000000000401','0000000f-0000-4000-8000-000000000301','0000000f-0000-4000-8000-0000000000a1','pack'),
('0000000f-0000-4000-8000-000000000402','0000000f-0000-4000-8000-000000000302','0000000f-0000-4000-8000-0000000000a1','pack'),
-- C owns a card of their own, so the disabled-caller assertions bite.
('0000000f-0000-4000-8000-000000000403','0000000f-0000-4000-8000-000000000302','0000000f-0000-4000-8000-0000000000c1','pack');

-- A active listing, and C's standing offer on it: both are party to it.
insert into kut.market_listings(id,card_id,seller_id,price,status,listed_at,expires_at) values
('0000000f-0000-4000-8000-000000000501','0000000f-0000-4000-8000-000000000401','0000000f-0000-4000-8000-0000000000a1',120,'active',now(),now()+interval '1 day');
insert into kut.trade_offers(id,listing_id,proposer_id,seller_id,offered_coins,status,proposer_idempotency_key) values
('0000000f-0000-4000-8000-000000000601','0000000f-0000-4000-8000-000000000501','0000000f-0000-4000-8000-0000000000c1','0000000f-0000-4000-8000-0000000000a1',90,'active',gen_random_uuid());

-- A published session A attended and B did not, with a finalized survey and a
-- scored result -- the KB-013 shape.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,created_by,published_at) values
('0000000f-0000-4000-8000-000000000701','0000000f-0000-4000-8000-000000000200',current_date,'other','published','0000000f-0000-4000-8000-0000000000e1',now());
insert into kut.attendance(session_id,player_id,goals) values
('0000000f-0000-4000-8000-000000000701','0000000f-0000-4000-8000-000000000101',2);
insert into kut.session_surveys(session_id,status,opened_at,closes_at,category_ids,selection_seed,finalized_at) values
('0000000f-0000-4000-8000-000000000701','finalized',now()-interval '25 hours',now()-interval '1 hour',
 (select array_agg(id) from (select id from kut.kudos_categories order by id limit 3) c),gen_random_uuid(),now()-interval '1 hour');
insert into kut.session_report_results(session_id,player_id,effective_goals,goal_form,kudos_form,session_input) values
('0000000f-0000-4000-8000-000000000701','0000000f-0000-4000-8000-000000000101',2,1.25,0,1.25);

-- C is disabled only now, so the rows above could be created normally.
update kut.profiles set is_disabled=true where id='0000000f-0000-4000-8000-0000000000c1';

-- ---------------------------------------------------------------------------
-- anon never reaches the views at all -- the grant stops it first.
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $q$select 1 from kut.activity_feed$q$,
  '42501',NULL,'anon is refused at the grant, before any predicate runs');
reset role;

-- ---------------------------------------------------------------------------
-- D: authenticated for another VibeTrunk tool, no KUT profile. This is the
-- disclosure KB-017 was filed for.
-- ---------------------------------------------------------------------------
set local role authenticated; set local request.jwt.claim.sub='0000000f-0000-4000-8000-0000000000d1';
select ok(not kut.is_active_member(),'a JWT with no KUT profile is not an active member');
select is((select count(*)::int from kut.activity_feed),0,'no KUT profile reads no activity');
select is((select count(*)::int from kut.active_market_listings),0,'no KUT profile reads no market listings');
select is((select count(*)::int from kut.club_value_leaderboard),0,'no KUT profile reads no Club Values');
select is((select count(*)::int from kut.public_live_ratings),0,'no KUT profile reads no ratings');
select is((select count(*)::int from kut.chronicle_session_report_status),0,'no KUT profile reads no Chronicle status');
select is((select count(*)::int from kut.chronicle_session_reports),0,'no KUT profile reads no Chronicle results');
select is((select count(*)::int from kut.my_trade_offers),0,'no KUT profile reads no trade offers');
select is((select count(*)::int from kut.my_club_value),0,'no KUT profile reads no club value');
select is((select count(*)::int from kut.my_club_value_editions),0,'no KUT profile reads no club value editions');
select is((select count(*)::int from kut.my_club_value_copies),0,'no KUT profile reads no club value copies');

-- ---------------------------------------------------------------------------
-- C: a disabled account with a still-valid session. C owns cards and is party
-- to a live trade offer, so every zero below is earned.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub='0000000f-0000-4000-8000-0000000000c1';
select ok(not kut.is_active_member(),'a disabled profile is not an active member');
select is((select count(*)::int from kut.activity_feed),0,'a disabled member reads no activity');
select is((select count(*)::int from kut.active_market_listings),0,'a disabled member reads no market listings');
select is((select count(*)::int from kut.club_value_leaderboard),0,'a disabled member reads no Club Values');
select is((select count(*)::int from kut.public_live_ratings),0,'a disabled member reads no ratings');
select is((select count(*)::int from kut.chronicle_session_report_status),0,'a disabled member reads no Chronicle status');
select is((select count(*)::int from kut.chronicle_session_reports),0,'a disabled member reads no Chronicle results');
select is((select count(*)::int from kut.my_trade_offers),0,'a disabled member reads none of their own trade offers');
select is((select count(*)::int from kut.my_club_value),0,'a disabled member reads none of their own club value');
select is((select count(*)::int from kut.my_club_value_editions),0,'a disabled member reads none of their own editions');
select is((select count(*)::int from kut.my_club_value_copies),0,'a disabled member reads none of their own copies');

-- ---------------------------------------------------------------------------
-- A: an active member who owns, sells and played. Nothing may have emptied.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub='0000000f-0000-4000-8000-0000000000a1';
select ok(kut.is_active_member(),'an active member passes the predicate');
select cmp_ok((select count(*)::int from kut.activity_feed),'>',0,'an active member still reads the club activity feed');
select cmp_ok((select count(*)::int from kut.active_market_listings),'>',0,'an active member still reads the market');
select cmp_ok((select count(*)::int from kut.club_value_leaderboard),'>',0,'an active member still reads the leaderboard');
select cmp_ok((select count(*)::int from kut.public_live_ratings),'>',0,'an active member still reads live ratings');
select cmp_ok((select count(*)::int from kut.chronicle_session_report_status),'>',0,'an active member still reads the Chronicle status');
select cmp_ok((select count(*)::int from kut.chronicle_session_reports),'>',0,'an active member still reads the Chronicle results');
select cmp_ok((select count(*)::int from kut.my_trade_offers),'>',0,'a seller still reads the offer standing on their listing');
select cmp_ok((select count(*)::int from kut.my_club_value),'>',0,'an active member still reads their own club value');
select cmp_ok((select count(*)::int from kut.my_club_value_editions),'>',0,'an active member still reads their own editions');
select cmp_ok((select count(*)::int from kut.my_club_value_copies),'>',0,'an active member still reads their own copies');

-- ---------------------------------------------------------------------------
-- B: an active member who took no part in any of it. This is the caller class
-- KB-013 broke -- club-wide projections must reach them, personal ones must not
-- leak anyone else's rows to them.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub='0000000f-0000-4000-8000-0000000000b1';
select cmp_ok((select count(*)::int from kut.activity_feed),'>',0,'a bystander still reads the club activity feed');
select cmp_ok((select count(*)::int from kut.active_market_listings),'>',0,'a bystander still reads the market');
select cmp_ok((select count(*)::int from kut.club_value_leaderboard),'>',0,'a bystander still reads the leaderboard');
select cmp_ok((select count(*)::int from kut.public_live_ratings),'>',0,'a bystander still reads live ratings');
select cmp_ok((select count(*)::int from kut.chronicle_session_report_status),'>',0,'a bystander still reads the Chronicle status');
select is(
  (select effective_goals from kut.chronicle_session_reports where session_id='0000000f-0000-4000-8000-000000000701' and player_id='0000000f-0000-4000-8000-000000000101'),
  2,
  'KB-013: a member who did not attend still reads the finalized results');
select is((select count(*)::int from kut.my_trade_offers),0,'a bystander reads no one else''s trade offers');
select is((select count(*)::int from kut.my_club_value_editions),0,'a bystander reads no one else''s editions');
select is((select count(*)::int from kut.my_club_value_copies),0,'a bystander reads no one else''s copies');

-- ---------------------------------------------------------------------------
-- service_role, last: setting the role claim would otherwise make every later
-- deny assertion pass vacuously.
-- ---------------------------------------------------------------------------
reset role; select set_config('request.jwt.claim.sub','',true);
set local role service_role; set local request.jwt.claim.role='service_role';
select ok(kut.is_active_member(),'the service role passes the gate without a profile');
select cmp_ok((select count(*)::int from kut.activity_feed),'>',0,'the service role still reads the activity feed');
select cmp_ok((select count(*)::int from kut.club_value_leaderboard),'>',0,'the service role still reads the leaderboard');
select is((select count(*)::int from kut.my_club_value),0,'a caller-scoped view is still keyed on auth.uid(), which the service role has none of');
reset role; select set_config('request.jwt.claim.role','',true);

select * from finish();
rollback;
