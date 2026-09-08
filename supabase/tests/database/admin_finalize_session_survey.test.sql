-- ADR-067: an admin closes a report window early. Same scoring path as the
-- deadline, so what is asserted here is the gate, the audit trail and the
-- consequences for a member who had not submitted yet.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(21);

select has_function('kut','admin_finalize_session_survey',array['uuid','text'],'admins can close a report window early');
select has_column('kut','session_surveys','finalized_by','the survey records who closed it early');
select has_column('kut','session_surveys','finalized_reason','the survey records why it was closed early');

-- ---------------------------------------------------------------------------
-- Fixtures: one admin, two linked members, one accountless attendee, one
-- published v2 session with an open survey.
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('30000000-0000-4000-8000-000000000001','finalize-admin@example.test','authenticated','authenticated','{}','{}',now(),now()),
('30000000-0000-4000-8000-000000000002','finalize-early@example.test','authenticated','authenticated','{}','{}',now(),now()),
('30000000-0000-4000-8000-000000000003','finalize-late@example.test','authenticated','authenticated','{}','{}',now(),now());
insert into kut.players(id,slug,display_name,archetype) values
('30000000-0000-4000-8000-000000000011','finalize-a','Finalize A','all_rounder'),
('30000000-0000-4000-8000-000000000012','finalize-b','Finalize B','all_rounder'),
('30000000-0000-4000-8000-000000000013','finalize-guest','Finalize Guest','all_rounder');
insert into kut.profiles(id,display_name,role,player_id) values
('30000000-0000-4000-8000-000000000001','Finalize Admin','admin',null),
('30000000-0000-4000-8000-000000000002','Finalize Early','user','30000000-0000-4000-8000-000000000011'),
('30000000-0000-4000-8000-000000000003','Finalize Late','user','30000000-0000-4000-8000-000000000012');

update kut.seasons set is_active=false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values('30000000-0000-4000-8000-000000000040','Finalize Test',current_date-14,true);
update kut.season_rating_rules set v2_starts_week=date_trunc('week',current_date)::date where season_id='30000000-0000-4000-8000-000000000040';
insert into kut.match_sessions(id,season_id,session_date,session_type,status,created_by) values
('30000000-0000-4000-8000-000000000041','30000000-0000-4000-8000-000000000040',current_date,'other','draft','30000000-0000-4000-8000-000000000001'),
('30000000-0000-4000-8000-000000000042','30000000-0000-4000-8000-000000000040',current_date,'monday','draft','30000000-0000-4000-8000-000000000001');
insert into kut.attendance(session_id,player_id,goals) values
('30000000-0000-4000-8000-000000000041','30000000-0000-4000-8000-000000000011',0),
('30000000-0000-4000-8000-000000000041','30000000-0000-4000-8000-000000000012',0),
('30000000-0000-4000-8000-000000000041','30000000-0000-4000-8000-000000000013',0),
('30000000-0000-4000-8000-000000000042','30000000-0000-4000-8000-000000000011',0);

set local role authenticated; set local request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
select kut.publish_session('30000000-0000-4000-8000-000000000041');
select kut.publish_session('30000000-0000-4000-8000-000000000042');
select ok((select accepting_reports from kut.chronicle_session_report_status where session_id='30000000-0000-4000-8000-000000000041'),'the window is open before the admin closes it');

-- One of the two account-holding attendees reports; the other never does.
set local request.jwt.claim.sub='30000000-0000-4000-8000-000000000002';
select kut.submit_session_report('30000000-0000-4000-8000-000000000041',2,(select jsonb_object_agg(category::text,case when ordinal=1 then to_jsonb('30000000-0000-4000-8000-000000000012'::text) else 'null'::jsonb end) from unnest((select category_ids from kut.session_surveys where session_id='30000000-0000-4000-8000-000000000041')) with ordinality selected(category,ordinal)),0,'30000000-0000-4000-8000-000000000051','submit');

-- ---------------------------------------------------------------------------
-- Gate
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select kut.admin_finalize_session_survey('30000000-0000-4000-8000-000000000041','Everyone has reported')$$,
  '42501',NULL,'a member cannot close the report window');
set local request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select kut.admin_finalize_session_survey('30000000-0000-4000-8000-000000000041','no')$$,
  '22023',NULL,'closing early demands a reason');

-- ---------------------------------------------------------------------------
-- Early close
-- ---------------------------------------------------------------------------
select ok(
  (select (kut.admin_finalize_session_survey('30000000-0000-4000-8000-000000000041','Everyone present has reported')->>'closed_early')::boolean),
  'the RPC reports that it closed the window ahead of the deadline');
select is((select status from kut.session_surveys where session_id='30000000-0000-4000-8000-000000000041'),'finalized','an early close finalizes the survey');
select is((select count(*) from kut.session_report_results where session_id='30000000-0000-4000-8000-000000000041'),3::bigint,'every attendee is scored, accountless ones included');
select is((select effective_goals from kut.session_report_results where session_id='30000000-0000-4000-8000-000000000041' and player_id='30000000-0000-4000-8000-000000000011'),2,'a submitted report still supplies the effective goals');
select is((select finalized_by from kut.session_surveys where session_id='30000000-0000-4000-8000-000000000041'),'30000000-0000-4000-8000-000000000001'::uuid,'the closing admin is recorded');
select is((select finalized_reason from kut.session_surveys where session_id='30000000-0000-4000-8000-000000000041'),'Everyone present has reported','the reason is recorded');
select ok(
  (select finalized_at < closes_at and closes_at = opened_at + interval '24 hours' from kut.session_surveys where session_id='30000000-0000-4000-8000-000000000041'),
  'the published deadline is left intact, so an early close is visible as finalized_at < closes_at');
select is((select kudos_form from kut.session_report_results where session_id='30000000-0000-4000-8000-000000000041' and player_id='30000000-0000-4000-8000-000000000012'),0::numeric,'fewer than three complete ballots recognise no kudos');

-- ---------------------------------------------------------------------------
-- Consequences for a member who had not submitted
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub='30000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select kut.submit_session_report('30000000-0000-4000-8000-000000000041',1,'{}'::jsonb,0,'30000000-0000-4000-8000-000000000052','submit')$$,
  'P0001',NULL,'a member who had not reported can no longer submit');
select is((select count(*) from kut.session_report_rewards where session_id='30000000-0000-4000-8000-000000000041' and user_id='30000000-0000-4000-8000-000000000003'),0::bigint,'closing early never pays an unearned completion reward');

-- ---------------------------------------------------------------------------
-- Idempotence, and the automatic path's audit trail
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
-- Read back as the admin: "members read own report rewards" would otherwise
-- scope this count to the reader and make it trivially zero.
select is((select count(*) from kut.session_report_rewards where session_id='30000000-0000-4000-8000-000000000041' and user_id='30000000-0000-4000-8000-000000000002'),1::bigint,'a reward already earned is untouched');
select ok(
  (select (kut.admin_finalize_session_survey('30000000-0000-4000-8000-000000000041','Second press of the button')->>'already_finalized')::boolean),
  'a second close is a no-op that says so');
select is((select finalized_reason from kut.session_surveys where session_id='30000000-0000-4000-8000-000000000041'),'Everyone present has reported','a second close does not overwrite the first reason');
reset role; select set_config('request.jwt.claim.sub','',true);

update kut.session_surveys set opened_at=now()-interval '25 hours',closes_at=now()-interval '1 hour' where session_id='30000000-0000-4000-8000-000000000042';
set local role service_role; set local request.jwt.claim.role='service_role';
select kut.finalize_session_surveys(20);
reset role; select set_config('request.jwt.claim.role','',true);
select is((select status from kut.session_surveys where session_id='30000000-0000-4000-8000-000000000042'),'finalized','the deadline path still finalizes on its own');
select ok((select finalized_by is null and finalized_reason is null from kut.session_surveys where session_id='30000000-0000-4000-8000-000000000042'),'a survey that closed at its deadline records no closing admin');

select * from finish();
rollback;
