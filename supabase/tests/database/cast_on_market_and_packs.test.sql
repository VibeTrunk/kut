-- ADR-086: kut.active_market_listings and kut.my_pack_opening_results carry
-- the card's Player (`player_id`) and whether it is a Live card (`is_live`), so
-- the app can apply the one plaster-cast rule of ADR-085 on the market and in
-- pack openings.
--
-- Covers: the columns exist and come last; they are right for a Live and a
-- Special copy of one Player in both views; access is unchanged -- a disabled
-- member and a profileless JWT still read zero market rows (ADR-079), pack
-- results stay the opener's own, and anon has no access to either view.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(26);

-- ---------------------------------------------------------------------------
-- Schema surface: both columns exist and are appended last, so every existing
-- column keeps its position (the ADR-073 lesson).
-- ---------------------------------------------------------------------------
select has_column('kut','active_market_listings','player_id','the market listings view exposes the Player id');
select has_column('kut','active_market_listings','is_live','the market listings view exposes whether the card is Live');
select has_column('kut','my_pack_opening_results','player_id','the pack results view exposes the Player id');
select has_column('kut','my_pack_opening_results','is_live','the pack results view exposes whether the card is Live');

select is(
  (select array_agg(column_name::text order by ordinal_position desc) from (
     select column_name, ordinal_position from information_schema.columns
     where table_schema='kut' and table_name='active_market_listings'
     order by ordinal_position desc limit 2) last_two),
  array['is_live','player_id'],
  'player_id and is_live are the last two market columns');
select is(
  (select array_agg(column_name::text order by ordinal_position desc) from (
     select column_name, ordinal_position from information_schema.columns
     where table_schema='kut' and table_name='my_pack_opening_results'
     order by ordinal_position desc limit 2) last_two),
  array['is_live','player_id'],
  'player_id and is_live are the last two pack result columns');

-- Grants are unchanged: anon has none, members keep SELECT.
select table_privs_are('kut','active_market_listings','anon',array[]::text[],'anon cannot select from active_market_listings');
select table_privs_are('kut','my_pack_opening_results','anon',array[]::text[],'anon cannot select from my_pack_opening_results');
select table_privs_are('kut','active_market_listings','authenticated',array['SELECT'],'members keep SELECT on active_market_listings');
select table_privs_are('kut','my_pack_opening_results','authenticated',array['SELECT'],'members keep SELECT on my_pack_opening_results');

-- ---------------------------------------------------------------------------
-- Fixtures.
--   A -- active member: lists a Live and a Special copy of Player P, and opened
--        a pack that held another Live and another Special copy of P.
--   B -- active member: a bystander who owns nothing.
--   C -- disabled member.
--   D -- an auth.users row with no kut.profiles row: the cross-tool JWT.
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000086-0000-4000-8000-0000000000a1','cast-seller@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000086-0000-4000-8000-0000000000b1','cast-bystander@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000086-0000-4000-8000-0000000000c1','cast-disabled@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000086-0000-4000-8000-0000000000d1','cast-other-tool@example.test','authenticated','authenticated','{}','{}',now(),now());

insert into kut.players(id,slug,display_name,archetype) values
('00000086-0000-4000-8000-000000000101','cast-player','Cast Player','all_rounder');

insert into kut.profiles(id,display_name,role,username) values
('00000086-0000-4000-8000-0000000000a1','Cast Seller','user','cast_seller'),
('00000086-0000-4000-8000-0000000000b1','Cast Bystander','user','cast_bystander'),
('00000086-0000-4000-8000-0000000000c1','Cast Disabled','user','cast_disabled');

insert into kut.card_editions(id,player_id,edition_type,title,is_live) values
('00000086-0000-4000-8000-000000000301','00000086-0000-4000-8000-000000000101','live','Cast Player Live',true);
insert into kut.card_editions(
  id,player_id,edition_type,title,is_live,
  snapshot_ovr,snapshot_pac,snapshot_sho,snapshot_pas,snapshot_dri,snapshot_def,snapshot_phy,
  snapshot_archetype,snapshot_rarity_tier,description,artwork_key,artwork_version,
  special_discard_multiplier,issued_at)
values
('00000086-0000-4000-8000-000000000302','00000086-0000-4000-8000-000000000101','totw','Cast Player TOTW',false,
 75,70,71,72,73,60,74,'all_rounder','elite','A frozen Team of the Week snapshot.','cast/totw',1,1.5,now());

insert into kut.user_cards(id,edition_id,owner_id,source) values
('00000086-0000-4000-8000-000000000401','00000086-0000-4000-8000-000000000301','00000086-0000-4000-8000-0000000000a1','pack'),
('00000086-0000-4000-8000-000000000402','00000086-0000-4000-8000-000000000302','00000086-0000-4000-8000-0000000000a1','special_grant'),
('00000086-0000-4000-8000-000000000403','00000086-0000-4000-8000-000000000301','00000086-0000-4000-8000-0000000000a1','pack'),
('00000086-0000-4000-8000-000000000404','00000086-0000-4000-8000-000000000302','00000086-0000-4000-8000-0000000000a1','pack');

insert into kut.market_listings(id,card_id,seller_id,price,status,listed_at,expires_at) values
('00000086-0000-4000-8000-000000000501','00000086-0000-4000-8000-000000000401','00000086-0000-4000-8000-0000000000a1',100,'active',now(),now()+interval '1 day'),
('00000086-0000-4000-8000-000000000502','00000086-0000-4000-8000-000000000402','00000086-0000-4000-8000-0000000000a1',300,'active',now(),now()+interval '1 day');

insert into kut.pack_openings(id,user_id,pack_id,price_paid,idempotency_key) values
('00000086-0000-4000-8000-000000000601','00000086-0000-4000-8000-0000000000a1',(select id from kut.pack_definitions limit 1),250,gen_random_uuid());
insert into kut.pack_opening_cards(opening_id,slot,card_id) values
('00000086-0000-4000-8000-000000000601',1,'00000086-0000-4000-8000-000000000403'),
('00000086-0000-4000-8000-000000000601',2,'00000086-0000-4000-8000-000000000404');

update kut.profiles set is_disabled=true where id='00000086-0000-4000-8000-0000000000c1';

-- ---------------------------------------------------------------------------
-- anon is refused at the grant on both views.
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($q$select 1 from kut.active_market_listings$q$,'42501',null,'anon cannot read the market');
select throws_ok($q$select 1 from kut.my_pack_opening_results$q$,'42501',null,'anon cannot read pack results');
reset role;

-- ---------------------------------------------------------------------------
-- B, an active bystander, reads both of A's listings with the right Player
-- and edition kind.
-- ---------------------------------------------------------------------------
set local role authenticated; set local request.jwt.claim.sub='00000086-0000-4000-8000-0000000000b1';
select is((select player_id from kut.active_market_listings where listing_id='00000086-0000-4000-8000-000000000501'),
  '00000086-0000-4000-8000-000000000101'::uuid,'a Live listing carries its Player id');
select is((select is_live from kut.active_market_listings where listing_id='00000086-0000-4000-8000-000000000501'),
  true,'a Live listing is marked Live');
select is((select player_id from kut.active_market_listings where listing_id='00000086-0000-4000-8000-000000000502'),
  '00000086-0000-4000-8000-000000000101'::uuid,'a Special listing carries the same Player id');
select is((select is_live from kut.active_market_listings where listing_id='00000086-0000-4000-8000-000000000502'),
  false,'a Special listing is not marked Live');
select is((select ovr from kut.active_market_listings where listing_id='00000086-0000-4000-8000-000000000502'),
  75,'existing columns are untouched: a Special listing still shows its snapshot rating');
select is((select count(*)::int from kut.my_pack_opening_results),0,'a bystander reads none of another member''s pack results');
select lives_ok($q$select * from kut.my_wanted_cards$q$,'kut.my_wanted_cards, which reads the market view, still resolves');

-- ---------------------------------------------------------------------------
-- A reads their own pack opening, slot by slot.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub='00000086-0000-4000-8000-0000000000a1';
select is((select player_id from kut.my_pack_opening_results where opening_id='00000086-0000-4000-8000-000000000601' and slot=1),
  '00000086-0000-4000-8000-000000000101'::uuid,'a Live pack result carries its Player id');
select is((select is_live from kut.my_pack_opening_results where opening_id='00000086-0000-4000-8000-000000000601' and slot=1),
  true,'a Live pack result is marked Live');
select is((select player_id from kut.my_pack_opening_results where opening_id='00000086-0000-4000-8000-000000000601' and slot=2),
  '00000086-0000-4000-8000-000000000101'::uuid,'a Special pack result carries the same Player id');
select is((select is_live from kut.my_pack_opening_results where opening_id='00000086-0000-4000-8000-000000000601' and slot=2),
  false,'a Special pack result is not marked Live');

-- ---------------------------------------------------------------------------
-- The ADR-079 gate still holds on the market: a disabled member and a JWT with
-- no KUT profile read zero rows, and no error.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub='00000086-0000-4000-8000-0000000000c1';
select is((select count(*)::int from kut.active_market_listings),0,'a disabled member reads no market listings');
set local request.jwt.claim.sub='00000086-0000-4000-8000-0000000000d1';
select is((select count(*)::int from kut.active_market_listings),0,'no KUT profile reads no market listings');
select is((select count(*)::int from kut.my_pack_opening_results),0,'no KUT profile reads no pack results');

reset role;
select set_config('request.jwt.claim.sub','',true);

select * from finish();
rollback;
