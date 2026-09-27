-- ADR-101: from the football week beginning 2026-09-28 a member reports one
-- combined goals + assists count ("G+A"). The migration
-- 20261009000000_goals_assists_notice_copy.sql changes only the wording of the
-- notices SQL writes. This suite proves both halves of that:
--
--   * the wording follows the session date — 2026-09-27 (the last day before the
--     cutover) keeps "goals", 2026-09-28 says "G+A" — for the report-open,
--     session-results, kudos-awarded and admin-correction notices;
--   * the numbers do not move: the count ladder 0/1/1.25/1.5, the kudos ladder,
--     the 3.5 session cap, the Form cap of 8, the 83 Live OVR ceiling and the
--     recent-week SHO modifier (+2 per count, capped at +8) all read the one
--     combined value exactly as they read goals.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(48);

-- ---------------------------------------------------------------------------
-- The cutover itself
-- ---------------------------------------------------------------------------
select has_function('kut','_uses_combined_count',array['date'],'the cutover is stated once in SQL');
select is(kut._uses_combined_count(date '2026-09-27'),false,'2026-09-27 still reports goals');
select is(kut._uses_combined_count(date '2026-09-28'),true,'2026-09-28 reports goals + assists');
select is(kut._uses_combined_count(date '2026-11-02'),true,'a later session reports goals + assists');
select ok(not has_function_privilege('authenticated','kut._uses_combined_count(date)','execute'),'members cannot call the cutover helper directly');

-- ---------------------------------------------------------------------------
-- Fixtures: an admin, a star player A, six teammates N1..N6 with accounts and
-- one accountless guest X. Two published v2 sessions either side of the
-- cutover: PRE on Sunday 2026-09-27, POST on Monday 2026-09-28.
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('41000000-0000-4000-8000-000000000001','ga-a@example.test','authenticated','authenticated','{}','{}',now(),now()),
('41000000-0000-4000-8000-000000000002','ga-n1@example.test','authenticated','authenticated','{}','{}',now(),now()),
('41000000-0000-4000-8000-000000000003','ga-n2@example.test','authenticated','authenticated','{}','{}',now(),now()),
('41000000-0000-4000-8000-000000000004','ga-n3@example.test','authenticated','authenticated','{}','{}',now(),now()),
('41000000-0000-4000-8000-000000000005','ga-n4@example.test','authenticated','authenticated','{}','{}',now(),now()),
('41000000-0000-4000-8000-000000000006','ga-n5@example.test','authenticated','authenticated','{}','{}',now(),now()),
('41000000-0000-4000-8000-000000000007','ga-n6@example.test','authenticated','authenticated','{}','{}',now(),now()),
('41000000-0000-4000-8000-000000000009','ga-admin@example.test','authenticated','authenticated','{}','{}',now(),now());
insert into kut.players(id,slug,display_name,archetype) values
('41000000-0000-4000-8000-000000000011','ga-a','GA A','all_rounder'),
('41000000-0000-4000-8000-000000000012','ga-n1','GA N1','all_rounder'),
('41000000-0000-4000-8000-000000000013','ga-n2','GA N2','all_rounder'),
('41000000-0000-4000-8000-000000000014','ga-n3','GA N3','all_rounder'),
('41000000-0000-4000-8000-000000000015','ga-n4','GA N4','all_rounder'),
('41000000-0000-4000-8000-000000000016','ga-n5','GA N5','all_rounder'),
('41000000-0000-4000-8000-000000000017','ga-n6','GA N6','all_rounder'),
('41000000-0000-4000-8000-000000000018','ga-guest','GA Guest','all_rounder'),
('41000000-0000-4000-8000-000000000019','ga-capped','GA Capped','all_rounder');
insert into kut.profiles(id,display_name,role,player_id) values
('41000000-0000-4000-8000-000000000001','GA A','user','41000000-0000-4000-8000-000000000011'),
('41000000-0000-4000-8000-000000000002','GA N1','user','41000000-0000-4000-8000-000000000012'),
('41000000-0000-4000-8000-000000000003','GA N2','user','41000000-0000-4000-8000-000000000013'),
('41000000-0000-4000-8000-000000000004','GA N3','user','41000000-0000-4000-8000-000000000014'),
('41000000-0000-4000-8000-000000000005','GA N4','user','41000000-0000-4000-8000-000000000015'),
('41000000-0000-4000-8000-000000000006','GA N5','user','41000000-0000-4000-8000-000000000016'),
('41000000-0000-4000-8000-000000000007','GA N6','user','41000000-0000-4000-8000-000000000017'),
('41000000-0000-4000-8000-000000000009','GA Admin','admin',null);

update kut.seasons set is_active=false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values('41000000-0000-4000-8000-000000000040','G+A Test',date '2026-09-14',true);
update kut.season_rating_rules set v2_starts_week=date '2026-09-14' where season_id='41000000-0000-4000-8000-000000000040';
insert into kut.match_sessions(id,season_id,session_date,session_type,status,created_by) values
('41000000-0000-4000-8000-000000000041','41000000-0000-4000-8000-000000000040',date '2026-09-27','other','draft','41000000-0000-4000-8000-000000000009'),
('41000000-0000-4000-8000-000000000042','41000000-0000-4000-8000-000000000040',date '2026-09-28','monday','draft','41000000-0000-4000-8000-000000000009');
insert into kut.attendance(session_id,player_id,goals)
select '41000000-0000-4000-8000-000000000041',id,0 from kut.players
where id in ('41000000-0000-4000-8000-000000000011','41000000-0000-4000-8000-000000000012','41000000-0000-4000-8000-000000000013','41000000-0000-4000-8000-000000000014','41000000-0000-4000-8000-000000000018');
insert into kut.attendance(session_id,player_id,goals)
select '41000000-0000-4000-8000-000000000042',id,0 from kut.players
where id::text like '41000000-0000-4000-8000-00000000001%' and id<>'41000000-0000-4000-8000-000000000019';

-- A ballot naming one teammate in the n-th category and skipping the others.
-- Security invoker, created and rolled back inside this transaction.
create function public.ga_ballot(p_session uuid,p_ordinal integer,p_recipient uuid)
returns jsonb language sql stable as $$
  select jsonb_object_agg(category::text,case when ordinal=p_ordinal then to_jsonb(p_recipient::text) else 'null'::jsonb end)
  from unnest((select category_ids from kut.session_surveys where session_id=p_session)) with ordinality selected(category,ordinal)
$$;

set local role authenticated; set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000009';
select kut.publish_session('41000000-0000-4000-8000-000000000041');
select kut.publish_session('41000000-0000-4000-8000-000000000042');
reset role;
select is((select array_agg(rating_rules_version order by session_date) from kut.match_sessions where id::text like '41000000-0000-4000-8000-00000000004_'),array[2,2],'both fixture sessions are member-reported (rating v2)');

-- ---------------------------------------------------------------------------
-- 1. The report-open notice
-- ---------------------------------------------------------------------------
select is((select title from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000001' and event_type='session_report' and reference_id='41000000-0000-4000-8000-000000000041'),'Goals & kudos','a session before the cutover opens a goals report');
select is((select title from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000001' and event_type='session_report' and reference_id='41000000-0000-4000-8000-000000000042'),'Goals + Assists & kudos','a session on the cutover opens a goals + assists report');
select is((select body from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000001' and event_type='session_report' and reference_id='41000000-0000-4000-8000-000000000042'),'Your session report is open for 24 hours. Complete it to receive 50 KUT Coins.','the report-open body is unchanged');

-- ---------------------------------------------------------------------------
-- 2. PRE (2026-09-27): A reports 2 goals; N1 and N2 recognise A in the first
-- category; N3 completes the quorum of three ballots.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select kut.submit_session_report('41000000-0000-4000-8000-000000000041',2,public.ga_ballot('41000000-0000-4000-8000-000000000041',0,null),0,'41000000-0000-4000-8000-000000000101','submit');
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000002';
select kut.submit_session_report('41000000-0000-4000-8000-000000000041',0,public.ga_ballot('41000000-0000-4000-8000-000000000041',1,'41000000-0000-4000-8000-000000000011'),0,'41000000-0000-4000-8000-000000000102','submit');
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000003';
select kut.submit_session_report('41000000-0000-4000-8000-000000000041',1,public.ga_ballot('41000000-0000-4000-8000-000000000041',1,'41000000-0000-4000-8000-000000000011'),0,'41000000-0000-4000-8000-000000000103','submit');
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000004';
select kut.submit_session_report('41000000-0000-4000-8000-000000000041',3,public.ga_ballot('41000000-0000-4000-8000-000000000041',1,'41000000-0000-4000-8000-000000000012'),0,'41000000-0000-4000-8000-000000000104','submit');
reset role; select set_config('request.jwt.claim.sub','',true);

update kut.session_surveys set opened_at=now()-interval '25 hours',closes_at=now()-interval '1 hour' where session_id='41000000-0000-4000-8000-000000000041';
set local role service_role; set local request.jwt.claim.role='service_role';
select kut.finalize_session_surveys(20);
reset role; select set_config('request.jwt.claim.role','',true);

select is((select goal_form from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000041' and player_id='41000000-0000-4000-8000-000000000011'),1.25::numeric,'PRE: 2 goals still score 1.25 Form');
select is((select session_input from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000041' and player_id='41000000-0000-4000-8000-000000000011'),2.25::numeric,'PRE: 2 goals plus one kudos category is 2.25');
select is((select body from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000001' and event_type='session_results' and reference_id='41000000-0000-4000-8000-000000000041'),'Reported goals and recognized kudos are now in the Chronicle.','PRE: the results notice keeps its goals wording');
-- Before: activity 26.6 (two attended weeks) -> 45.6, no Form -> 46 OVR.
-- After: PRE input 2.25 at weight .75 (POST is published later) = 1.69 Form -> +2 -> 48.
select is((select body from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000001' and event_type='kudos_awarded' and reference_id='41000000-0000-4000-8000-000000000041'),
  'Teammates recognized you for '||(select title from kut.kudos_categories where id=(select category_ids[1] from kut.session_surveys where session_id='41000000-0000-4000-8000-000000000041'))||' this session. Your 2 goals and these kudos lifted your card rating +2 OVR this week.',
  'PRE: the kudos notice still counts goals, in the plural');

-- ---------------------------------------------------------------------------
-- 3. POST (2026-09-28): A reports a combined 4 (say 2 goals + 2 assists) and
-- is recognised in all three categories; the six teammates report 0, 1, 2, 3,
-- 10 and 4.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select kut.submit_session_report('41000000-0000-4000-8000-000000000042',4,public.ga_ballot('41000000-0000-4000-8000-000000000042',0,null),0,'41000000-0000-4000-8000-000000000111','submit');
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000002';
select kut.submit_session_report('41000000-0000-4000-8000-000000000042',0,public.ga_ballot('41000000-0000-4000-8000-000000000042',1,'41000000-0000-4000-8000-000000000011'),0,'41000000-0000-4000-8000-000000000112','submit');
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000003';
select kut.submit_session_report('41000000-0000-4000-8000-000000000042',1,public.ga_ballot('41000000-0000-4000-8000-000000000042',1,'41000000-0000-4000-8000-000000000011'),0,'41000000-0000-4000-8000-000000000113','submit');
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000004';
select kut.submit_session_report('41000000-0000-4000-8000-000000000042',2,public.ga_ballot('41000000-0000-4000-8000-000000000042',2,'41000000-0000-4000-8000-000000000011'),0,'41000000-0000-4000-8000-000000000114','submit');
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000005';
select kut.submit_session_report('41000000-0000-4000-8000-000000000042',3,public.ga_ballot('41000000-0000-4000-8000-000000000042',2,'41000000-0000-4000-8000-000000000011'),0,'41000000-0000-4000-8000-000000000115','submit');
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000006';
select kut.submit_session_report('41000000-0000-4000-8000-000000000042',10,public.ga_ballot('41000000-0000-4000-8000-000000000042',3,'41000000-0000-4000-8000-000000000011'),0,'41000000-0000-4000-8000-000000000116','submit');
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000007';
select kut.submit_session_report('41000000-0000-4000-8000-000000000042',4,public.ga_ballot('41000000-0000-4000-8000-000000000042',3,'41000000-0000-4000-8000-000000000011'),0,'41000000-0000-4000-8000-000000000117','submit');
reset role; select set_config('request.jwt.claim.sub','',true);

update kut.session_surveys set opened_at=now()-interval '25 hours',closes_at=now()-interval '1 hour' where session_id='41000000-0000-4000-8000-000000000042';
set local role service_role; set local request.jwt.claim.role='service_role';
select kut.finalize_session_surveys(20);
reset role; select set_config('request.jwt.claim.role','',true);

-- The count ladder is the old goals ladder, unchanged.
select is((select effective_goals from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000011'),4,'POST: the combined count is stored as one integer, 4');
select is((select goal_form from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000011'),1.5::numeric,'POST: a combined 4 earns exactly 1.5 Form, as 4 goals did');
select is((select goal_form from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000012'),0::numeric,'POST: 0 G+A earns 0 Form');
select is((select goal_form from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000013'),1::numeric,'POST: 1 G+A earns 1 Form');
select is((select goal_form from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000014'),1.25::numeric,'POST: 2 G+A earn 1.25 Form');
select is((select goal_form from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000015'),1.5::numeric,'POST: 3 G+A earn 1.5 Form');
select is((select goal_form from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000016'),1.5::numeric,'POST: 10 G+A still earn only 1.5 Form');
select is((select kudos_form from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000011'),2::numeric,'POST: three recognised categories still earn 2 Form');
select is((select session_input from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000011'),3.5::numeric,'POST: 1.5 + 2 fills the unchanged 3.5 session cap');
select throws_ok($$update kut.session_report_results set session_input=3.6 where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000011'$$,'23514',NULL,'the per-session input still cannot exceed 3.5');

-- Form 3.5 (POST) + 2.25 * .75 (PRE) = 5.19; activity still 26.6 -> 45.6 + 5 = 51.
select is((select form_score from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000040' and player_id='41000000-0000-4000-8000-000000000011'),5.1875::numeric,'POST: Form ages the combined count exactly as it aged goals');
select is((select live_ovr from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000040' and player_id='41000000-0000-4000-8000-000000000011'),51,'POST: Live OVR follows from the unchanged formula');

-- The recent-week SHO modifier reads the same combined value: least(8, 2 * count).
select is((select sho-pac from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000040' and player_id='41000000-0000-4000-8000-000000000011'),8,'POST: a combined 4 gives the existing +8 SHO modifier');
select is((select sho-pac from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000040' and player_id='41000000-0000-4000-8000-000000000015'),6,'POST: a combined 3 gives +6 SHO, 2 per count');
select is((select sho-pac from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000040' and player_id='41000000-0000-4000-8000-000000000016'),8,'POST: a combined 10 is still capped at +8 SHO');

select is((select body from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000001' and event_type='session_results' and reference_id='41000000-0000-4000-8000-000000000042'),'Reported G+A and recognized kudos are now in the Chronicle.','POST: the results notice says G+A');
select is((select body from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000001' and event_type='kudos_awarded' and reference_id='41000000-0000-4000-8000-000000000042'),
  'Teammates recognized you for '||(select kut._join_names(array_agg(c.title order by array_position(s.category_ids,c.id))) from kut.session_surveys s join kut.kudos_categories c on c.id=any(s.category_ids) where s.session_id='41000000-0000-4000-8000-000000000042')||' this session. Your 4 G+A and these kudos lifted your card rating +3 OVR this week.',
  'POST: the kudos notice states one combined G+A count, never goals and assists apart');

-- ---------------------------------------------------------------------------
-- 4. Admin corrections take the wording of their own session's date.
-- ---------------------------------------------------------------------------
set local role authenticated; set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000009';
select kut.admin_correct_session_goals('41000000-0000-4000-8000-000000000041','41000000-0000-4000-8000-000000000012',1,false,'Remembered a late goal');
select kut.admin_correct_session_goals('41000000-0000-4000-8000-000000000042','41000000-0000-4000-8000-000000000013',2,false,'An assist was missed');
select kut.admin_correct_session_goals('41000000-0000-4000-8000-000000000042','41000000-0000-4000-8000-000000000018',5,false,'Guest reported after the session');
reset role; select set_config('request.jwt.claim.sub','',true);

select is((select title from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000002' and event_type='report_correction' and reference_id='41000000-0000-4000-8000-000000000041'),'Reported goals corrected','a correction to a pre-cutover session is titled in goals');
select is((select body from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000002' and event_type='report_correction' and reference_id='41000000-0000-4000-8000-000000000041'),'An administrator corrected the effective goal total and recorded a reason. Your form completion and reward are unchanged.','a correction to a pre-cutover session keeps the goal-total body');
select is((select title from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000003' and event_type='report_correction' and reference_id='41000000-0000-4000-8000-000000000042'),'Reported G+A corrected','a correction to a post-cutover session is titled in G+A');
select is((select body from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000003' and event_type='report_correction' and reference_id='41000000-0000-4000-8000-000000000042'),'An administrator corrected the effective G+A total and recorded a reason. Your form completion and reward are unchanged.','a correction to a post-cutover session names the G+A total');
select is((select goal_form from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000013'),1.25::numeric,'a corrected combined 2 re-scores on the unchanged ladder');
select is((select effective_goals from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000042' and player_id='41000000-0000-4000-8000-000000000018'),5,'an accountless attendee takes a combined count by admin entry');
select is((select sho-pac from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000040' and player_id='41000000-0000-4000-8000-000000000018'),8,'a guest''s combined 5 is capped at the same +8 SHO');
select is((select count(*) from kut.session_report_rewards where player_id='41000000-0000-4000-8000-000000000018'),0::bigint,'admin G+A entry never pays a completion reward');

-- ---------------------------------------------------------------------------
-- 5. History is not relabelled.
-- ---------------------------------------------------------------------------
select is((select count(*) from kut.user_notifications where reference_id='41000000-0000-4000-8000-000000000041' and (title like '%G+A%' or body like '%G+A%' or title like '%Assists%')),0::bigint,'no notice about the pre-cutover session mentions G+A, corrections and re-finalization included');
select is((select effective_goals from kut.session_report_results where session_id='41000000-0000-4000-8000-000000000041' and player_id='41000000-0000-4000-8000-000000000011'),2,'the pre-cutover result keeps its goal count after re-finalization');
select is((select count(*) from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000001' and event_type='kudos_awarded'),2::bigint,'re-finalization after a correction sends no second kudos notice');
select ok((select body like '%Your 2 goals%' from kut.user_notifications where user_id='41000000-0000-4000-8000-000000000001' and event_type='kudos_awarded' and reference_id='41000000-0000-4000-8000-000000000041'),'the written pre-cutover kudos notice is not rewritten');

-- ---------------------------------------------------------------------------
-- 6. The caps. A separate, inactive season: 17 weekly sessions from 29 Jun
-- 2026, the last four (28 Sep - 19 Oct) reported, each a combined 4 with three
-- recognised categories, i.e. the maximum 3.5 per session.
-- ---------------------------------------------------------------------------
insert into kut.seasons(id,name,starts_on,is_active) values('41000000-0000-4000-8000-000000000050','G+A Caps',date '2026-06-29',false);
update kut.season_rating_rules set v2_starts_week=date '2026-09-28' where season_id='41000000-0000-4000-8000-000000000050';
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at,rating_rules_version)
select ('41000000-0000-4000-8000-0000000005'||lpad(n::text,2,'0'))::uuid,'41000000-0000-4000-8000-000000000050',date '2026-06-29'+7*n,'monday','published',now(),
  case when date '2026-06-29'+7*n>=date '2026-09-28' then 2 else 1 end
from generate_series(0,16) n;
insert into kut.attendance(session_id,player_id,goals)
select id,'41000000-0000-4000-8000-000000000019',0 from kut.match_sessions where season_id='41000000-0000-4000-8000-000000000050';
insert into kut.session_surveys(session_id,opened_at,closes_at,category_ids,selection_seed,status,finalized_at)
select id,now()-interval '48 hours',now()-interval '24 hours',(select array_agg(id order by id) from (select id from kut.kudos_categories order by id limit 3) c),gen_random_uuid(),'finalized',now()-interval '24 hours'
from kut.match_sessions where season_id='41000000-0000-4000-8000-000000000050' and rating_rules_version=2;
insert into kut.session_report_results(session_id,player_id,effective_goals,goal_form,kudos_form,session_input,qualified_category_ids)
select session_id,'41000000-0000-4000-8000-000000000019',4,1.5,2,3.5,category_ids
from kut.session_surveys where session_id in (select id from kut.match_sessions where season_id='41000000-0000-4000-8000-000000000050');
select lives_ok($$select kut._rebuild_season_core('41000000-0000-4000-8000-000000000050')$$,'the capped season rebuilds');
select is((select activity_score from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000050' and player_id='41000000-0000-4000-8000-000000000019'),100::numeric,'17 straight weeks cap Activity at 100');
-- 3.5 * (1 + .75 + .5 + .25) = 8.75, held at the cap.
select is((select form_score from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000050' and player_id='41000000-0000-4000-8000-000000000019'),8::numeric,'four maximal G+A sessions stop at the unchanged Form cap of 8');
select is((select live_ovr from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000050' and player_id='41000000-0000-4000-8000-000000000019'),83,'full Activity plus full Form reaches, and stops at, 83');
select is((select max(live_ovr) from kut.player_rating_snapshots where season_id='41000000-0000-4000-8000-000000000050'),83,'no weekly snapshot exceeds the 83 Live OVR ceiling');
select is((select sho from kut.player_season_state where season_id='41000000-0000-4000-8000-000000000050' and player_id='41000000-0000-4000-8000-000000000019'),91,'the +8 SHO modifier still sits on top of a capped 83');

select * from finish();
rollback;
