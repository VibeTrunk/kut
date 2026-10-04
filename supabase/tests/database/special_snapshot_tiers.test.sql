-- ADR-121 / KB-038. All six frozen tiers at OVR 75 deliberately disagree
-- with the obsolete ladder (except Elite). Rollback leaves zero issued Specials.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;
select plan(51);

-- Pin the full column contracts, intentional modes, and all read grants.
select columns_are('kut','my_collection_cards',array['card_id','edition_id','source','acquired_at','edition_title','edition_type','is_live','player_id','player_slug','display_name','archetype','ovr','pac','sho','pas','dri','def','phy','rarity_tier','discard_value','active_listing_id','active_listing_price','active_listing_expires_at','photo_path','held_by_offer_id']);
select columns_are('kut','active_market_listings',array['listing_id','price','listed_at','expires_at','card_id','edition_id','display_name','archetype','ovr','pac','sho','pas','dri','def','phy','rarity_tier','seller_display_name','photo_path','seller_id','player_id','is_live','discard_value']);
select columns_are('kut','my_pack_opening_results',array['opening_id','opened_at','price_paid','pack_slug','pack_title','slot','card_id','display_name','archetype','ovr','pac','sho','pas','dri','def','phy','rarity_tier','photo_path','player_id','is_live']);
select columns_are('kut','my_trade_offers',array['offer_id','listing_id','status','offered_coins','created_at','expires_at','resolved_at','coins_to_seller','coins_burned','proposer_id','seller_id','is_outgoing','proposer_name','seller_name','listing_card_name','listing_card_slug','listing_card_photo_path','listing_price','listing_status','offered_card_count','offered_cards']);
-- columns_are pins names; ordinal arrays additionally pin their order.
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='kut.active_market_listings'::regclass and attnum>0),
 array['listing_id','price','listed_at','expires_at','card_id','edition_id','display_name','archetype','ovr','pac','sho','pas','dri','def','phy','rarity_tier','seller_display_name','photo_path','seller_id','player_id','is_live','discard_value'], 'market columns stay in order');
select is(c.reloptions, array['security_invoker=' || v.invoker,'security_barrier=true'], v.name || ' keeps its security mode')
from (values ('my_collection_cards','true'),('active_market_listings','false'),('my_pack_opening_results','true'),('my_trade_offers','false')) v(name,invoker)
join pg_class c on c.oid=('kut.' || v.name)::regclass;
select table_privs_are('kut',v.name,r.name,case when r.name='anon' then array[]::text[] else array['SELECT'] end, v.name || ' preserves ' || r.name || ' grants')
from (values ('my_collection_cards'),('active_market_listings'),('my_pack_opening_results'),('my_trade_offers')) v(name)
cross join (values ('anon'),('authenticated'),('service_role')) r(name);

update kut.seasons set is_active=false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values ('00000121-0000-4000-8000-000000000001','Tier Fixture Season','2099-01-01',true);
insert into kut.players(id,slug,display_name,archetype) values
 ('00000121-0000-4000-8000-000000000101','tier-fixture','Tier Fixture','all_rounder'),
 ('00000121-0000-4000-8000-000000000102','tier-missing-state','Tier Missing State','all_rounder');
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
values ('00000121-0000-4000-8000-000000000101','00000121-0000-4000-8000-000000000001',50,0,62,62,62,62,62,62,62,'gold');

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000121-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'tier-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now() from generate_series(201,205) n;
insert into kut.profiles(id,display_name,role,username)
select ('00000121-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'Tier Member ' || n,'user','tier_' || n from generate_series(201,204) n;
insert into kut.wallets(user_id,balance) select id,1000 from kut.profiles where id::text like '00000121-%';
update kut.profiles set is_disabled=true where id='00000121-0000-4000-8000-000000000204';

insert into kut.card_editions(id,player_id,edition_type,title,is_live,snapshot_ovr,snapshot_pac,snapshot_sho,snapshot_pas,snapshot_dri,snapshot_def,snapshot_phy,snapshot_archetype,snapshot_rarity_tier,description,artwork_key,artwork_version,special_discard_multiplier,issued_at)
select ('00000121-0000-4000-8000-' || lpad((300+n)::text,12,'0'))::uuid,'00000121-0000-4000-8000-000000000101','totw','Tier ' || tier,false,75,70,71,72,73,74,75,'playmaker',tier,'Frozen tier fixture.','tier/fixture',1,1.5,now()
from unnest(array['common','bronze','silver','gold','holo','elite']) with ordinality tiers(tier,n);
insert into kut.card_editions(id,player_id,edition_type,title,is_live) values
 ('00000121-0000-4000-8000-000000000307','00000121-0000-4000-8000-000000000101','live','Live Tier',true),
 ('00000121-0000-4000-8000-000000000308','00000121-0000-4000-8000-000000000102','live','Live Missing State',true);
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000121-0000-4000-8000-' || lpad((base+n)::text,12,'0'))::uuid,
 ('00000121-0000-4000-8000-' || lpad((300+n)::text,12,'0'))::uuid,
 ('00000121-0000-4000-8000-' || lpad(owner::text,12,'0'))::uuid,'pack'
from (values (400,201),(500,202)) copies(base,owner) cross join generate_series(1,8) n;
insert into kut.market_listings(id,card_id,seller_id,price,status,listed_at,expires_at)
select ('00000121-0000-4000-8000-' || lpad((600+n)::text,12,'0'))::uuid,
 ('00000121-0000-4000-8000-' || lpad((400+n)::text,12,'0'))::uuid,'00000121-0000-4000-8000-000000000201',300,'active',now(),now()+interval '1 day' from generate_series(1,8) n;
insert into kut.pack_openings(id,user_id,pack_id,price_paid,idempotency_key) values
 ('00000121-0000-4000-8000-000000000701','00000121-0000-4000-8000-000000000201',(select id from kut.pack_definitions limit 1),175,gen_random_uuid());
insert into kut.pack_opening_cards(opening_id,slot,card_id)
select '00000121-0000-4000-8000-000000000701',n,('00000121-0000-4000-8000-' || lpad((400+n)::text,12,'0'))::uuid from generate_series(1,8) n;

-- Exercise the actual trade RPC with <=3 owned cards per offer.
set local request.jwt.claim.sub='00000121-0000-4000-8000-000000000202';
select lives_ok(format('select kut.propose_trade(%L::uuid,0,%L::uuid[],%L::uuid)',
 ('00000121-0000-4000-8000-' || lpad((601+batch)::text,12,'0'))::uuid,
 array(select ('00000121-0000-4000-8000-' || lpad((500+n)::text,12,'0'))::uuid from generate_series(1+batch*3,least(8,3+batch*3)) n),
 gen_random_uuid()),'trade fixtures pass the unchanged RPC guards') from generate_series(0,2) batch;

set local role authenticated;
set local request.jwt.claim.sub='00000121-0000-4000-8000-000000000201';
select results_eq($$select rarity_tier from kut.my_collection_cards where edition_id::text like '00000121-%' order by edition_id$$,
 $$values ('common'::text),('bronze'),('silver'),('gold'),('holo'),('elite'),('gold'),('common')$$,'collection uses all frozen tiers and unchanged Live state/floor');
select results_eq($$select rarity_tier from kut.active_market_listings where edition_id::text like '00000121-%' order by edition_id$$,
 $$values ('common'::text),('bronze'),('silver'),('gold'),('holo'),('elite'),('gold'),('common')$$,'market uses all frozen tiers and unchanged Live state/floor');
select results_eq($$select rarity_tier from kut.my_pack_opening_results where opening_id='00000121-0000-4000-8000-000000000701' order by slot$$,
 $$values ('common'::text),('bronze'),('silver'),('gold'),('holo'),('elite'),('gold'),('common')$$,'pack output uses all frozen tiers and unchanged Live state/floor');
select results_eq($$select card->>'rarity_tier' from kut.my_trade_offers, jsonb_array_elements(offered_cards) card where seller_id='00000121-0000-4000-8000-000000000201' order by card->>'card_id'$$,
 $$values ('common'::text),('bronze'),('silver'),('gold'),('holo'),('elite'),('gold'),('common')$$,'offered-card JSON uses all frozen tiers and unchanged Live state/floor');
select is((select ovr from kut.my_collection_cards where card_id='00000121-0000-4000-8000-000000000401'),75,'Special OVR remains frozen');
select is((select discard_value from kut.my_collection_cards where card_id='00000121-0000-4000-8000-000000000401'),kut.card_discard_value('00000121-0000-4000-8000-000000000401'),'discard formula unchanged');

-- Bystander has no collection, pack result, or offer, but can see market tiers.
set local request.jwt.claim.sub='00000121-0000-4000-8000-000000000203';
select is((select count(*) from kut.my_collection_cards),0::bigint,'bystander cannot read another collection');
select is((select count(*) from kut.my_pack_opening_results),0::bigint,'bystander cannot read another pack');
select is((select count(*) from kut.my_trade_offers),0::bigint,'bystander cannot read another offer');
select is((select count(*) from kut.active_market_listings where edition_id::text like '00000121-%'),8::bigint,'active member keeps market access');
set local request.jwt.claim.sub='00000121-0000-4000-8000-000000000204';
select is((select count(*) from kut.active_market_listings),0::bigint,'disabled member still denied market');
select is((select count(*) from kut.my_trade_offers),0::bigint,'disabled member still denied offers');
set local request.jwt.claim.sub='00000121-0000-4000-8000-000000000205';
select is((select count(*) from kut.active_market_listings),0::bigint,'profileless JWT still denied market');
select is((select count(*) from kut.my_trade_offers),0::bigint,'profileless JWT still denied offers');
reset role;
set local role anon;
select throws_ok('select * from kut.' || name,'42501',null,'anon still denied ' || name)
from unnest(array['my_collection_cards','active_market_listings','my_pack_opening_results','my_trade_offers']) name;
reset role;
select set_config('request.jwt.claim.sub','',true);

set local role service_role;
set local request.jwt.claim.role='service_role';
set local request.jwt.claim.sub='00000121-0000-4000-8000-000000000201';
select is((select count(*) from kut.my_collection_cards where edition_id::text like '00000121-%'),8::bigint,'service role retains owner-scoped collection access');
select is((select count(*) from kut.active_market_listings where edition_id::text like '00000121-%'),8::bigint,'service role retains market access');
select is((select count(*) from kut.my_pack_opening_results where opening_id='00000121-0000-4000-8000-000000000701'),8::bigint,'service role retains owner-scoped pack access');
select is((select count(*) from kut.my_trade_offers where seller_id='00000121-0000-4000-8000-000000000201'),3::bigint,'service role retains party-scoped offer access');
reset role;
select set_config('request.jwt.claim.role','',true);
select set_config('request.jwt.claim.sub','',true);

-- Rebuild changes the Live state; edition rows remain byte-for-byte identical.
create temporary table frozen_before as select to_jsonb(e) as row from kut.card_editions e where id::text like '00000121-%' and not is_live;
select lives_ok($$select kut._rebuild_season_core('00000121-0000-4000-8000-000000000001')$$,'season rebuild still succeeds');
select results_eq($$select to_jsonb(e) from kut.card_editions e where id::text like '00000121-%' and not is_live order by id$$,
 $$select row from frozen_before order by row->>'id'$$,'all Special snapshot fields persist after rebuild');
select throws_ok($$update kut.card_editions set snapshot_rarity_tier='gold' where id='00000121-0000-4000-8000-000000000301'$$,'P0001','frozen Special edition fields are immutable','frozen tier cannot be changed');
set local role authenticated;
set local request.jwt.claim.sub='00000121-0000-4000-8000-000000000201';
select is((select rarity_tier from kut.my_collection_cards where card_id='00000121-0000-4000-8000-000000000407'),'common','Live tier follows rebuilt state');
select results_eq($$select rarity_tier from kut.my_collection_cards where edition_id::text between '00000121-0000-4000-8000-000000000301' and '00000121-0000-4000-8000-000000000306' order by edition_id$$,
 $$values ('common'::text),('bronze'),('silver'),('gold'),('holo'),('elite')$$,'Special projected tiers persist after rebuild');
reset role;
select * from finish();
rollback;
