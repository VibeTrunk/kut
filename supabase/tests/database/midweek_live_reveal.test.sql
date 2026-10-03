-- Midweek Madness 2.0, B3 (20261014000000): the evening unfolds event by event.
-- BUILD_SPEC §44.9, §44.14; ADR-106.
--
-- From kick-off members see a pairing, its win chance and day rolls; each event
-- from its own moment; goals, penalties, the winner and the match's end only
-- once it has ended; the champion only once the final has. Weeks from before
-- ADR-104 (no stored times) still show whole matches at kick-off.
--
-- Every profile outside this file is opted out a year ago, so the field is
-- exactly M1-M8, eight active members with one card each, all OVR 60: eight
-- entrants, three rounds (round 1 at lock + 5 min, round 2 at + 20, the final
-- at + 35). A tournament's result depends only on its seed and the field, so
-- each seed below was chosen for what its evening holds:
--
--   TP  seed 06, locked 2 minutes ago      -> round 1 starts in 3 minutes
--   TK  seed 02, locked 6 minutes ago      -> round 1 kicked off a minute ago
--   TS  seed fb, locked 10 minutes ago     -> round 1, 5 minutes in: pairings 0
--                                             and 2 are drawn and mid shoot-out
--                                             (full time at 4:40, ends at 6:10
--                                             and 5:25), 1 and 3 have ended
--                                             (re-chosen for ADR-116's engine;
--                                             seed 01 was this evening before)
--   TL  seed 05, locked 36 minutes ago     -> the final kicked off a minute ago
--   TF  seed 04, locked 3 hours ago        -> complete, paid
--   TV  seed 03, version 1, locked 45 minutes ago, its stored times then
--       cleared as on a week simulated before ADR-104
--                                          -> round 1 out whole at lock + 30
-- A is disabled.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(32);

-- ---------------------------------------------------------------------------
-- Shape: columns only appended
-- ---------------------------------------------------------------------------
select is((select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid='kut.midweek_matches_public'::regclass and attnum>0 and not attisdropped),
  array['match_id','tournament_id','week_start','round','pairing','bye','side_0_user_id','side_0_name',
    'side_1_user_id','side_1_name','side_0_goals','side_1_goals','side_0_penalties','side_1_penalties',
    'winner_side','winner_user_id','win_chance_ppm','side_0_day_rolls_ppm','side_1_day_rolls_ppm','reveal_at',
    'ends_at','in_play'],
  'the match projection keeps its columns and appends ends_at and in_play');
select is((select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid='kut.midweek_events_public'::regclass and attnum>0 and not attisdropped),
  array['match_id','tournament_id','round','pairing','seq','kind','side','minute','penalty_round','creator_slot',
    'shooter_slot','defender_slot','kicker_slot','keeper_slot','chance_type','outcome','p_goal_ppm','reveal_at'],
  'the event projection keeps its columns and appends reveal_at');
select is((select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid='kut.midweek_tournaments_public'::regclass and attnum>0 and not attisdropped),
  array['tournament_id','week_start','lock_at','seed_hash','status','status_reason','void_note','rounds',
    'final_reveal_at','seed','champion_user_id','champion_name','schedule_version'],
  'the tournament list keeps its columns');
select table_privs_are('kut','midweek_matches_public','anon',array[]::text[],'anon still cannot read matches');
select table_privs_are('kut','midweek_events_public','authenticated',array['SELECT'],'members still read events');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;
update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000106-0000-4000-8000-0000000000f0','MW Live Test',date '2024-12-02',true);

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000106-0000-4000-8000-00000000000' || n)::uuid, 'mw106-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['1','2','3','4','5','6','7','8','a']) n;
insert into kut.profiles(id,display_name,role,username,is_disabled)
select ('00000106-0000-4000-8000-00000000000' || n)::uuid, 'MW106 ' || n, 'user', 'mw106_' || n, n = 'a'
from unnest(array['1','2','3','4','5','6','7','8','a']) n;
insert into kut.players(id,slug,display_name,archetype)
select ('00000106-0000-4000-8000-00000000010' || n)::uuid, 'mw106-player-' || n, 'MW106 Player ' || n,
  (array['goalkeeper','finisher','speedster','playmaker','defender','all_rounder','all_rounder','all_rounder'])[n]
from generate_series(1,8) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000106-0000-4000-8000-00000000010' || n)::uuid, '00000106-0000-4000-8000-0000000000f0', 50, 0,
  60, 50, 50, 50, 50, 50, 50, 'silver'
from generate_series(1,8) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000106-0000-4000-8000-00000000020' || n)::uuid, ('00000106-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW106 Live ' || n, true
from generate_series(1,8) n;
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000106-0000-4000-8000-00000000030' || n)::uuid, ('00000106-0000-4000-8000-00000000020' || n)::uuid,
  ('00000106-0000-4000-8000-00000000000' || n)::uuid, 'pack'
from generate_series(1,8) n;
-- A published session every week, so no week is a club break.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at)
select ('00000106-0000-4000-8000-0000000007' || lpad(n::text,2,'0'))::uuid, '00000106-0000-4000-8000-0000000000f0',
  date '2025-01-01' + 7 * n, 'other', 'published', now()
from generate_series(1,20) n;

-- Week w is seed s; created open, then moved to its lock.
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash,schedule_version)
select ('00000106-0000-4000-8000-0000000005' || s)::uuid, date '2025-01-06' + 7 * w, now() + interval '1 day',
  encode(sha256(decode(repeat(s, 32),'hex')),'hex'), v
from (values ('06', 6, 2), ('02', 2, 2), ('fb', 1, 2), ('05', 5, 2), ('04', 4, 2), ('03', 3, 1)) t(s, w, v);
insert into kut.midweek_tournament_secrets(tournament_id,seed)
select ('00000106-0000-4000-8000-0000000005' || s)::uuid, repeat(s, 32)
from unnest(array['06','02','fb','05','04','03']) s;
update kut.midweek_tournaments t set lock_at = now() - o
from (values ('06', interval '2 minutes'), ('02', interval '6 minutes'), ('fb', interval '10 minutes'),
  ('05', interval '36 minutes'), ('04', interval '3 hours'), ('03', interval '45 minutes')) x(s, o)
where t.id = ('00000106-0000-4000-8000-0000000005' || x.s)::uuid;

set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);
select is(current_setting('kut_test.run')::jsonb,'{"locked": 6, "completed": 1, "opened": 0}'::jsonb,
  'one call draws the six weeks and completes the one whose final is over');

-- TV as a week simulated before ADR-104: no event times, no match ends. The
-- Part L #25 guards refuse the update, so they are bypassed for it.
set local session_replication_role = replica;
update kut.midweek_matches set ends_at = null where tournament_id = '00000106-0000-4000-8000-000000000503';
update kut.midweek_match_events e set reveal_at = null from kut.midweek_matches m
where m.id = e.match_id and m.tournament_id = '00000106-0000-4000-8000-000000000503';
set local session_replication_role = origin;

-- What the tables hold, for comparison once reading as a member.
select is((select string_agg(pairing || ':' || (side_0_penalties is not null) || ':' || extract(epoch from ends_at - reveal_at)::int, ','
  order by pairing) from kut.midweek_matches where tournament_id = '00000106-0000-4000-8000-0000000005fb' and round = 1),
  '0:true:370,1:false:280,2:true:325,3:false:280',
  'TS''s round 1 is the evening this file was written for');
select set_config('kut_test.tk_due', (select count(*)::text from kut.midweek_match_events e
  join kut.midweek_matches m on m.id = e.match_id
  where m.tournament_id = '00000106-0000-4000-8000-000000000502' and e.reveal_at <= now()), true);
select set_config('kut_test.ts_kicks', (select concat_ws(':', count(*) filter (where e.reveal_at <= now()), count(*))
  from kut.midweek_match_events e join kut.midweek_matches m on m.id = e.match_id
  where m.tournament_id = '00000106-0000-4000-8000-0000000005fb' and m.round = 1 and m.pairing = 0 and e.kind = 'penalty'), true);
select set_config('kut_test.ts_ended', (select string_agg(concat_ws(':', pairing, side_0_goals, side_1_goals, winner_side, ends_at), ','
  order by pairing) from kut.midweek_matches where tournament_id = '00000106-0000-4000-8000-0000000005fb'
  and round = 1 and pairing in (1, 3)), true);
select set_config('kut_test.tf_champion', (select winner_user_id::text from kut.midweek_matches
  where tournament_id = '00000106-0000-4000-8000-000000000504' and round = 3), true);
select set_config('kut_test.tv_events', (select count(*)::text from kut.midweek_match_events e
  join kut.midweek_matches m on m.id = e.match_id
  where m.tournament_id = '00000106-0000-4000-8000-000000000503' and m.round = 1), true);

-- ---------------------------------------------------------------------------
-- As an ordinary member
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000106-0000-4000-8000-000000000001',true);

-- TP: nothing has kicked off.
select is((select count(*)::int from kut.midweek_matches_public where tournament_id = '00000106-0000-4000-8000-000000000506'),0,
  'before round 1 no match shows');
select is((select count(*)::int from kut.midweek_events_public where tournament_id = '00000106-0000-4000-8000-000000000506'),0,
  'and no event');

-- TK: a minute into round 1.
select results_eq($q$select count(*)::int, bool_and(in_play), bool_and(side_0_goals is null and side_1_goals is null
    and side_0_penalties is null and winner_side is null and winner_user_id is null and ends_at is null)
  from kut.midweek_matches_public where tournament_id = '00000106-0000-4000-8000-000000000502'$q$,
  $q$values (4, true, true)$q$,
  'a minute in, every round-1 match is in play with no score, winner or end');
select ok((select bool_and(win_chance_ppm is not null and side_0_day_rolls_ppm is not null)
  from kut.midweek_matches_public where tournament_id = '00000106-0000-4000-8000-000000000502'),
  'but its win chance and day rolls show from kick-off');
select is((select count(*)::text from kut.midweek_events_public where tournament_id = '00000106-0000-4000-8000-000000000502'),
  current_setting('kut_test.tk_due'),'exactly the events due so far show');
select ok((select coalesce(bool_and(reveal_at <= now()), true) from kut.midweek_events_public
  where tournament_id = '00000106-0000-4000-8000-000000000502'),'and none from later in the match');

-- TS: five minutes in, two matches mid shoot-out.
select results_eq($q$select pairing::int, in_play, winner_side is null, side_0_goals is null, ends_at is null
  from kut.midweek_matches_public where tournament_id = '00000106-0000-4000-8000-0000000005fb' and round = 1 order by pairing$q$,
  $q$values (0, true, true, true, true), (1, false, false, false, false), (2, true, true, true, true), (3, false, false, false, false)$q$,
  'the matches that went to penalties are still in play, the others have ended');
select is((select string_agg(concat_ws(':', pairing, side_0_goals, side_1_goals, winner_side, ends_at), ',' order by pairing)
  from kut.midweek_matches_public where tournament_id = '00000106-0000-4000-8000-0000000005fb' and round = 1 and pairing in (1, 3)),
  current_setting('kut_test.ts_ended'),'an ended match shows its goals, winner and end');
select is((select concat_ws(':', count(*), split_part(current_setting('kut_test.ts_kicks'), ':', 2))
  from kut.midweek_events_public where tournament_id = '00000106-0000-4000-8000-0000000005fb'
  and round = 1 and pairing = 0 and kind = 'penalty'),
  current_setting('kut_test.ts_kicks'),'mid shoot-out, only the kicks taken so far show');
select ok(split_part(current_setting('kut_test.ts_kicks'), ':', 1)::int between 1 and
  split_part(current_setting('kut_test.ts_kicks'), ':', 2)::int - 1,
  'and the shoot-out really is half taken');
select is((select count(*)::int from kut.midweek_events_public where tournament_id = '00000106-0000-4000-8000-0000000005fb'
  and round = 1 and pairing = 0 and kind = 'toss'),0,'a settling draw that is still to come does not show');
select is((select count(*)::int from kut.midweek_matches_public where tournament_id = '00000106-0000-4000-8000-0000000005fb'
  and round > 1),0,'round 2 has not kicked off');

-- TL: the final a minute in.
select results_eq($q$select round::int, bool_and(not in_play), bool_and(winner_side is not null) from kut.midweek_matches_public
  where tournament_id = '00000106-0000-4000-8000-000000000505' and round < 3 group by round order by round$q$,
  $q$values (1, true, true), (2, true, true)$q$,'before the final, every earlier match has ended and shows its winner');
select results_eq($q$select in_play, winner_side is null, ends_at is null from kut.midweek_matches_public
  where tournament_id = '00000106-0000-4000-8000-000000000505' and round = 3$q$,
  $q$values (true, true, true)$q$,'the final is in play');
select is((select champion_user_id from kut.midweek_tournaments_public where tournament_id = '00000106-0000-4000-8000-000000000505'),
  null,'and no champion is named while it plays');
select is((select final_reveal_at from kut.midweek_tournaments_public where tournament_id = '00000106-0000-4000-8000-000000000505'),
  null,'nor the end of the final');

-- TF: complete.
select is((select champion_user_id::text from kut.midweek_tournaments_public where tournament_id = '00000106-0000-4000-8000-000000000504'),
  current_setting('kut_test.tf_champion'),'once the final has ended the champion is named');
select ok((select bool_and(not in_play and winner_side is not null and ends_at is not null) from kut.midweek_matches_public
  where tournament_id = '00000106-0000-4000-8000-000000000504'),'and every match shows its result and end');

-- TV: a week from before ADR-104 shows whole matches at kick-off.
select ok((select bool_and(not in_play and winner_side is not null and ends_at is null) from kut.midweek_matches_public
  where tournament_id = '00000106-0000-4000-8000-000000000503' and round = 1),
  'a version-1 week''s round shows whole from its reveal, as drawn');
select is((select count(*)::text from kut.midweek_events_public where tournament_id = '00000106-0000-4000-8000-000000000503'
  and round = 1),current_setting('kut_test.tv_events'),'with every event');
select is((select count(*)::int from kut.midweek_matches_public where tournament_id = '00000106-0000-4000-8000-000000000503'
  and round > 1),0,'and its next round waits for its own reveal');

-- Across every week: no result before an end.
select is((select count(*)::int from kut.midweek_matches_public where tournament_id::text like '00000106-%'
  and in_play and (winner_side is not null or side_0_goals is not null or side_0_penalties is not null or ends_at is not null)),0,
  'no match in play shows a score, a winner or an end');
select ok((select bool_and(reveal_at <= now()) from kut.midweek_events_public where tournament_id::text like '00000106-%'
  and reveal_at is not null),'no event shows before its moment');

-- A disabled member reads nothing; anon cannot read.
select set_config('request.jwt.claim.sub','00000106-0000-4000-8000-00000000000a',true);
select is((select count(*)::int from kut.midweek_events_public where tournament_id::text like '00000106-%'),0,
  'a disabled member reads no event');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select throws_ok($q$select 1 from kut.midweek_events_public$q$,'42501',NULL,'anon cannot read events');
reset role;

select * from finish();
rollback;
