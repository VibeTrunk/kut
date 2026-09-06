begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;
select plan(35);

select is((select price from kut.pack_definitions where slug='tfh-pack'),175::bigint,'basic pack price is exactly 175');
select has_function('kut','open_pack',array['text','bigint','uuid'],'pack opening requires an expected price');
select is(kut.duplicate_edition_contribution(101,0),0::bigint,'zero copies contribute zero');
select is(kut.duplicate_edition_contribution(101,5),126::bigint,'five copies contribute 100/20/5/0/0');
select is(kut.duplicate_edition_contribution(10,3),12::bigint,'duplicate weights floor each component');
select is((select count(*) from kut.card_editions where not is_live),0::bigint,'Special issuance remains zero');
select has_table('kut','card_wants','private card wants exist');
select has_table('kut','trade_availability','copy-level availability exists');
select has_function('kut','get_my_wanted_availability',array[]::text[],'narrow availability reader exists');
select has_table('kut','session_reports','session reports exist');
select has_table('kut','session_report_rewards','once-only report reward receipts exist');
select has_function('kut','finalize_session_surveys',array['integer'],'bounded finalizer exists');
select has_view('kut','chronicle_session_report_status','Chronicle has a privacy-safe report progress projection');

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('20000000-0000-4000-8000-000000000001','want-a@example.test','authenticated','authenticated','{}','{}',now(),now()),
('20000000-0000-4000-8000-000000000002','want-b@example.test','authenticated','authenticated','{}','{}',now(),now()),
('20000000-0000-4000-8000-000000000003','report-admin@example.test','authenticated','authenticated','{}','{}',now(),now()),
('20000000-0000-4000-8000-000000000004','report-c@example.test','authenticated','authenticated','{}','{}',now(),now());
insert into kut.players(id,slug,display_name,archetype) values
('20000000-0000-4000-8000-000000000011','next-a','Next A','all_rounder'),
('20000000-0000-4000-8000-000000000012','next-b','Next B','all_rounder'),
('20000000-0000-4000-8000-000000000013','next-guest','Next Guest','all_rounder'),
('20000000-0000-4000-8000-000000000014','next-c','Next C','all_rounder');
insert into kut.profiles(id,display_name,role,player_id) values
('20000000-0000-4000-8000-000000000001','Want A','user','20000000-0000-4000-8000-000000000011'),
('20000000-0000-4000-8000-000000000002','Want B','user','20000000-0000-4000-8000-000000000012'),
('20000000-0000-4000-8000-000000000003','Report Admin','admin',null),
('20000000-0000-4000-8000-000000000004','Report C','user','20000000-0000-4000-8000-000000000014');
insert into kut.card_editions(id,player_id,edition_type,title,is_live) values
('20000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000011','live','Next A Live',true),
('20000000-0000-4000-8000-000000000022','20000000-0000-4000-8000-000000000012','live','Next B Live',true);
insert into kut.user_cards(id,edition_id,owner_id,source) values
('20000000-0000-4000-8000-000000000031','20000000-0000-4000-8000-000000000022','20000000-0000-4000-8000-000000000002','pack'),
('20000000-0000-4000-8000-000000000034','20000000-0000-4000-8000-000000000022','20000000-0000-4000-8000-000000000003','pack');
insert into kut.market_listings(id,card_id,seller_id,price) values
('20000000-0000-4000-8000-000000000035','20000000-0000-4000-8000-000000000034','20000000-0000-4000-8000-000000000003',333);

set local role authenticated; set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select ok((select count(*) from kut.season_rating_rules)>0,'authenticated screens can read the stored reporting cutover');
select kut.set_card_want('20000000-0000-4000-8000-000000000022',true);
select is((select lowest_listing_price from kut.my_wanted_cards where edition_id='20000000-0000-4000-8000-000000000022'),333::bigint,'wanted cards expose an active admin listing through the public market projection');
select is((select count(*) from kut.trade_availability),0::bigint,'a want does not expose counterpart inventory');
set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000002';
select kut.set_trade_availability('20000000-0000-4000-8000-000000000031',true);
select is((select count(*) from kut.card_wants),0::bigint,'counterpart cannot read another member wanted list');
set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select is((select owner_display_name from kut.get_my_wanted_availability()),'Want B','non-reciprocal explicit availability returns only the owner name');
reset role; select set_config('request.jwt.claim.sub','',true);
update kut.user_cards set owner_id='20000000-0000-4000-8000-000000000001' where id='20000000-0000-4000-8000-000000000031';
select is((select count(*) from kut.trade_availability where card_id='20000000-0000-4000-8000-000000000031'),0::bigint,'ownership change clears availability');
select is((select state from kut.card_wants where user_id='20000000-0000-4000-8000-000000000001' and edition_id='20000000-0000-4000-8000-000000000022'),'fulfilled','acquisition fulfills the private want');

update kut.seasons set is_active=false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values('20000000-0000-4000-8000-000000000040','Reports Test',current_date-14,true);
update kut.season_rating_rules set v2_starts_week=date_trunc('week',current_date)::date where season_id='20000000-0000-4000-8000-000000000040';
insert into kut.match_sessions(id,season_id,session_date,session_type,status,created_by) values('20000000-0000-4000-8000-000000000041','20000000-0000-4000-8000-000000000040',current_date,'other','draft','20000000-0000-4000-8000-000000000003');
insert into kut.attendance(session_id,player_id,goals) values
('20000000-0000-4000-8000-000000000041','20000000-0000-4000-8000-000000000011',0),
('20000000-0000-4000-8000-000000000041','20000000-0000-4000-8000-000000000012',0),
('20000000-0000-4000-8000-000000000041','20000000-0000-4000-8000-000000000013',0),
('20000000-0000-4000-8000-000000000041','20000000-0000-4000-8000-000000000014',0);
set local role authenticated; set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000003'; select kut.publish_session('20000000-0000-4000-8000-000000000041');
select is((select rating_rules_version from kut.match_sessions where id='20000000-0000-4000-8000-000000000041'),2,'cutover session is version two');
set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select is((select count(*) from kut.my_session_reports where session_id='20000000-0000-4000-8000-000000000041' and survey_status='open'),1::bigint,'an eligible member can discover the open report immediately after publication');
select kut.submit_session_report('20000000-0000-4000-8000-000000000041',0,(select jsonb_object_agg(category::text,'null'::jsonb) from unnest((select category_ids from kut.session_surveys where session_id='20000000-0000-4000-8000-000000000041')) category),0,'20000000-0000-4000-8000-000000000051','submit');
select is((select sum(amount) from kut.wallet_ledger where user_id='20000000-0000-4000-8000-000000000001' and reason='session_report_reward'),50::numeric,'zero goals and three skips earn 50 once');
select kut.submit_session_report('20000000-0000-4000-8000-000000000041',1,(select jsonb_object_agg(category::text,case when ordinal=1 then to_jsonb('20000000-0000-4000-8000-000000000012'::text) else 'null'::jsonb end) from unnest((select category_ids from kut.session_surveys where session_id='20000000-0000-4000-8000-000000000041')) with ordinality selected(category,ordinal)),1,'20000000-0000-4000-8000-000000000052','submit');
select is((select balance from kut.wallets where user_id='20000000-0000-4000-8000-000000000001'),300::bigint,'editing a submitted report cannot repay the reward or attendance award');
select is((select submitted_reports from kut.chronicle_session_report_status where session_id='20000000-0000-4000-8000-000000000041'),1,'Chronicle reports one submitted form while the survey is open');
select is((select goal_total from kut.chronicle_session_report_status where session_id='20000000-0000-4000-8000-000000000041'),1,'Chronicle reports the provisional aggregate goal total while preserving individual privacy');
select ok((select accepting_reports from kut.chronicle_session_report_status where session_id='20000000-0000-4000-8000-000000000041'),'Chronicle uses the database deadline to identify an open survey');
select is((select goal_count from kut.chronicle_weeks where week_start=date_trunc('week',current_date)::date),1,'Chronicle weekly headline includes goals submitted during an open survey');
set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000002';
select kut.submit_session_report('20000000-0000-4000-8000-000000000041',0,(select jsonb_object_agg(category::text,case when ordinal=1 then to_jsonb('20000000-0000-4000-8000-000000000011'::text) else 'null'::jsonb end) from unnest((select category_ids from kut.session_surveys where session_id='20000000-0000-4000-8000-000000000041')) with ordinality selected(category,ordinal)),0,'20000000-0000-4000-8000-000000000053','submit');
set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000004';
select kut.submit_session_report('20000000-0000-4000-8000-000000000041',0,(select jsonb_object_agg(category::text,case when ordinal=1 then to_jsonb('20000000-0000-4000-8000-000000000011'::text) else 'null'::jsonb end) from unnest((select category_ids from kut.session_surveys where session_id='20000000-0000-4000-8000-000000000041')) with ordinality selected(category,ordinal)),0,'20000000-0000-4000-8000-000000000054','submit');
reset role; select set_config('request.jwt.claim.sub','',true);
update kut.session_surveys set opened_at=now()-interval '25 hours',closes_at=now()-interval '1 hour' where session_id='20000000-0000-4000-8000-000000000041';
set local role service_role; set local request.jwt.claim.role='service_role'; select kut.finalize_session_surveys(20);
select is((select status from kut.session_surveys where session_id='20000000-0000-4000-8000-000000000041'),'finalized','due survey finalizes atomically');
select is((select effective_goals from kut.session_report_results where session_id='20000000-0000-4000-8000-000000000041' and player_id='20000000-0000-4000-8000-000000000011'),1,'finalization uses the latest submitted goals');
select is((select kudos_form from kut.session_report_results where session_id='20000000-0000-4000-8000-000000000041' and player_id='20000000-0000-4000-8000-000000000011'),1::numeric,'one recognized kudos category awards one Form');
select is((select form_score from kut.player_season_state where season_id='20000000-0000-4000-8000-000000000040' and player_id='20000000-0000-4000-8000-000000000011'),2::numeric,'SQL v2 form score combines one goal and one recognized kudos category');
select is((select snapshot.live_ovr from kut.player_rating_snapshots snapshot join kut.player_season_state state on state.player_id=snapshot.player_id and state.season_id=snapshot.season_id where snapshot.season_id='20000000-0000-4000-8000-000000000040' and snapshot.player_id='20000000-0000-4000-8000-000000000011' and snapshot.week_start=date_trunc('week',current_date)::date), (select live_ovr from kut.player_season_state where season_id='20000000-0000-4000-8000-000000000040' and player_id='20000000-0000-4000-8000-000000000011'),'finalization writes a history snapshot equal to the rebuilt current state');
reset role; select set_config('request.jwt.claim.role','',true);
set local role authenticated; set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000003';
select kut.admin_correct_session_goals('20000000-0000-4000-8000-000000000041','20000000-0000-4000-8000-000000000013',2,false,'Guest reported after the session');
select is((select effective_goals from kut.session_report_results where session_id='20000000-0000-4000-8000-000000000041' and player_id='20000000-0000-4000-8000-000000000013'),2,'admin may add accountless attendee goals after finalization');
select is((select count(*) from kut.session_report_rewards where player_id='20000000-0000-4000-8000-000000000013'),0::bigint,'admin goal entry never fabricates a completion reward');
reset role;

select * from finish();
rollback;
