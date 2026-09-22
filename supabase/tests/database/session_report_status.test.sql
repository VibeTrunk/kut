-- KB-020 / ADR-078: a session report's status only ever moves forward. Once a
-- member has submitted, a later "Save draft" is an edit that stays submitted --
-- it never strips the status while leaving the 50-coin reward behind, and it
-- never leaves a row that kut._finalize_one_session will refuse to score.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(16);

-- ---------------------------------------------------------------------------
-- Fixtures: one admin, two linked members, one published v2 session.
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('40000000-0000-4000-8000-000000000001','status-admin@example.test','authenticated','authenticated','{}','{}',now(),now()),
('40000000-0000-4000-8000-000000000002','status-submitter@example.test','authenticated','authenticated','{}','{}',now(),now()),
('40000000-0000-4000-8000-000000000003','status-drafter@example.test','authenticated','authenticated','{}','{}',now(),now());
insert into kut.players(id,slug,display_name,archetype) values
('40000000-0000-4000-8000-000000000011','status-a','Status A','all_rounder'),
('40000000-0000-4000-8000-000000000012','status-b','Status B','all_rounder');
insert into kut.profiles(id,display_name,role,player_id) values
('40000000-0000-4000-8000-000000000001','Status Admin','admin',null),
('40000000-0000-4000-8000-000000000002','Status Submitter','user','40000000-0000-4000-8000-000000000011'),
('40000000-0000-4000-8000-000000000003','Status Drafter','user','40000000-0000-4000-8000-000000000012');

update kut.seasons set is_active=false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values('40000000-0000-4000-8000-000000000040','Status Test',current_date-14,true);
update kut.season_rating_rules set v2_starts_week=date_trunc('week',current_date)::date where season_id='40000000-0000-4000-8000-000000000040';
insert into kut.match_sessions(id,season_id,session_date,session_type,status,created_by) values
('40000000-0000-4000-8000-000000000041','40000000-0000-4000-8000-000000000040',current_date,'other','draft','40000000-0000-4000-8000-000000000001');
insert into kut.attendance(session_id,player_id,goals) values
('40000000-0000-4000-8000-000000000041','40000000-0000-4000-8000-000000000011',0),
('40000000-0000-4000-8000-000000000041','40000000-0000-4000-8000-000000000012',0);

set local role authenticated; set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';
select kut.publish_session('40000000-0000-4000-8000-000000000041');

-- ---------------------------------------------------------------------------
-- Member A submits, then tries to save a draft over it.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000002';
select kut.submit_session_report(
  '40000000-0000-4000-8000-000000000041',3,
  (select jsonb_object_agg(category::text,case when ordinal=1 then to_jsonb('40000000-0000-4000-8000-000000000012'::text) else 'null'::jsonb end)
     from unnest((select category_ids from kut.session_surveys where session_id='40000000-0000-4000-8000-000000000041')) with ordinality selected(category,ordinal)),
  0,'40000000-0000-4000-8000-000000000051','submit');

select is((select status from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000011'),'submitted','a submitted report is stored as submitted');
select is((select count(*) from kut.session_report_rewards where session_id='40000000-0000-4000-8000-000000000041' and user_id='40000000-0000-4000-8000-000000000002'),1::bigint,'submitting pays the completion reward once');

select set_config('kb020.submitted_at',(select submitted_at::text from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000011'),true);

-- The regression that shipped: the same member presses "Save draft".
select is(
  (kut.submit_session_report(
    '40000000-0000-4000-8000-000000000041',5,
    (select jsonb_object_agg(category::text,case when ordinal=1 then to_jsonb('40000000-0000-4000-8000-000000000012'::text) else 'null'::jsonb end)
       from unnest((select category_ids from kut.session_surveys where session_id='40000000-0000-4000-8000-000000000041')) with ordinality selected(category,ordinal)),
    1,'40000000-0000-4000-8000-000000000052','draft')->>'status'),
  'submit',
  'the RPC reports the effective intent, not the requested one');
select is((select status from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000011'),'submitted','a draft save over a submitted report leaves it submitted');
select is(
  (select submitted_at from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000011'),
  current_setting('kb020.submitted_at')::timestamptz,
  'the original submission time survives the edit');
select is((select revision from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000011'),2,'the edit still bumps the revision');
select is((select goals from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000011'),5,'the edit still applies -- this is a save, not a refusal');
select is((select count(*) from kut.session_report_rewards where session_id='40000000-0000-4000-8000-000000000041' and user_id='40000000-0000-4000-8000-000000000002'),1::bigint,'editing never pays a second reward');

-- Promoting the intent means the stricter validation applies: an edit cannot
-- quietly hollow out a submitted report by sending an incomplete ballot under
-- the draft rules.
select throws_ok(
  $q$select kut.submit_session_report('40000000-0000-4000-8000-000000000041',5,'{}'::jsonb,2,'40000000-0000-4000-8000-000000000053','draft')$q$,
  '22023',NULL,'an incomplete ballot cannot be saved over a submitted report');

-- ---------------------------------------------------------------------------
-- Member B: a genuine draft is still a draft, and still becomes a submission.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000003';
select kut.submit_session_report('40000000-0000-4000-8000-000000000041',1,'{}'::jsonb,0,'40000000-0000-4000-8000-000000000061','draft');
select is((select status from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000012'),'draft','a first save as draft is a draft');
select ok((select submitted_at is null from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000012'),'a draft has no submission time');
select is((select count(*) from kut.session_report_rewards where session_id='40000000-0000-4000-8000-000000000041' and user_id='40000000-0000-4000-8000-000000000003'),0::bigint,'a draft earns nothing');

select kut.submit_session_report('40000000-0000-4000-8000-000000000041',2,'{}'::jsonb,1,'40000000-0000-4000-8000-000000000062','draft');
select is((select status from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000012'),'draft','a second draft save stays a draft');

select kut.submit_session_report(
  '40000000-0000-4000-8000-000000000041',2,
  (select jsonb_object_agg(category::text,case when ordinal=1 then to_jsonb('40000000-0000-4000-8000-000000000011'::text) else 'null'::jsonb end)
     from unnest((select category_ids from kut.session_surveys where session_id='40000000-0000-4000-8000-000000000041')) with ordinality selected(category,ordinal)),
  2,'40000000-0000-4000-8000-000000000063','submit');
select ok(
  (select status='submitted' and submitted_at is not null from kut.session_reports where session_id='40000000-0000-4000-8000-000000000041' and player_id='40000000-0000-4000-8000-000000000012'),
  'a draft still becomes a submission');
select is((select count(*) from kut.session_report_rewards where session_id='40000000-0000-4000-8000-000000000041' and user_id='40000000-0000-4000-8000-000000000003'),1::bigint,'submitting after a draft pays the reward');

-- ---------------------------------------------------------------------------
-- The standing invariant, read without RLS scoping the reward join.
-- ---------------------------------------------------------------------------
reset role; select set_config('request.jwt.claim.sub','',true);
select is(
  (select count(*) from kut.session_reports r
    where r.status='draft'
      and exists(select 1 from kut.session_report_rewards w where w.session_id=r.session_id and w.player_id=r.player_id)),
  0::bigint,
  'no report is ever left as a draft while holding a completion reward');

select * from finish();
rollback;
