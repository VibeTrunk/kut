-- Midweek Madness, migration C (20261005000000): the engine's worker, stored
-- results, reveal projections and admin controls. BUILD_SPEC §44.1-§44.11,
-- Part L #25; ADR-089-091, ADR-095. The engine's arithmetic is pinned
-- separately, by midweek_engine_parity.test.sql.
--
-- Every profile outside this file is opted out a year ago, so the field is
-- exactly these personas:
--   M1-M6 -- active members with cards: the field. M1 saves five cards
--            (a Goalkeeper, and a Live card of injured Player 3), M2 two, M3 two
--            of which one is traded away before the lock, M4 one; M5 and M6
--            save nothing and get auto squads. M6 opts out after the locks.
--   G     -- opted out before every lock, with a card.
--   H     -- disabled, with a card.
--   I     -- active, with only a burned card.
--   J     -- admin, with no card.
--   K     -- an auth.users row with no kut.profiles row.
--
-- Tournaments, all created open and moved to their lock once squads are saved:
--   T1 locked 5 hours ago     -> simulated and completed by one worker call
--   T2 locked 45 minutes ago  -> simulated; round 1 revealed, round 2 not
--   T3 locked 10 minutes ago  -> simulated; nothing revealed yet
--   T4 locked an hour ago, no session the week before -> skipped (club break)
--   T5 locks later in the file with two entrants left -> skipped (too few)
--   T6 locks tomorrow         -> open, for the rehearsal and the squad guard
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(147);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_table('kut','midweek_entries','entries exist');
select has_table('kut','midweek_entry_cards','entry cards exist');
select has_table('kut','midweek_pick_shares','pick shares exist');
select has_table('kut','midweek_matches','matches exist');
select has_table('kut','midweek_match_events','match events exist');
select has_table('kut','midweek_jobs','the worker log exists');
select has_view('kut','midweek_matches_public','the match projection exists');
select has_view('kut','midweek_events_public','the event projection exists');
select has_view('kut','midweek_entries_public','the entry projection exists');
select has_view('kut','midweek_pick_shares_public','the pick-share projection exists');
select has_view('kut','midweek_admin_overview','the admin overview exists');
select is((select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid='kut.midweek_tournaments_public'::regclass and attnum>0 and not attisdropped),
  array['tournament_id','week_start','lock_at','seed_hash','status','status_reason','void_note','rounds',
    'final_reveal_at','seed','champion_user_id','champion_name'],
  'the tournament list keeps its columns and appends the champion last');

select table_privs_are('kut','midweek_entries','authenticated',array[]::text[],'members cannot read entries directly');
select table_privs_are('kut','midweek_entry_cards','authenticated',array[]::text[],'members cannot read entry cards directly');
select table_privs_are('kut','midweek_pick_shares','authenticated',array[]::text[],'members cannot read pick shares directly');
select table_privs_are('kut','midweek_matches','authenticated',array[]::text[],'members cannot read matches directly');
select table_privs_are('kut','midweek_match_events','authenticated',array[]::text[],'members cannot read events directly');
select table_privs_are('kut','midweek_jobs','authenticated',array[]::text[],'members cannot read the worker log');
select table_privs_are('kut','midweek_matches','service_role',array['SELECT'],'the service role reads matches');
select table_privs_are('kut','midweek_matches_public','anon',array[]::text[],'anon cannot read matches');
select table_privs_are('kut','midweek_matches_public','authenticated',array['SELECT'],'members read revealed matches');
select table_privs_are('kut','midweek_events_public','anon',array[]::text[],'anon cannot read events');
select table_privs_are('kut','midweek_events_public','authenticated',array['SELECT'],'members read revealed events');
select table_privs_are('kut','midweek_entries_public','anon',array[]::text[],'anon cannot read entries');
select table_privs_are('kut','midweek_entries_public','authenticated',array['SELECT'],'members read revealed entries');
select table_privs_are('kut','midweek_pick_shares_public','anon',array[]::text[],'anon cannot read pick shares');
select table_privs_are('kut','midweek_pick_shares_public','authenticated',array['SELECT'],'members read published pick shares');
select table_privs_are('kut','midweek_admin_overview','anon',array[]::text[],'anon cannot read the admin overview');

select function_privs_are('kut','run_midweek_due',array['integer'],'authenticated',array[]::text[],'members cannot run the worker');
select function_privs_are('kut','run_midweek_due',array['integer'],'anon',array[]::text[],'anon cannot run the worker');
select function_privs_are('kut','run_midweek_due',array['integer'],'service_role',array['EXECUTE'],'the service role runs the worker');
select function_privs_are('kut','_mm_simulate',array['bytea','jsonb'],'authenticated',array[]::text[],'members cannot run the engine');
select function_privs_are('kut','_mm_field',array['uuid','timestamp with time zone'],'authenticated',array[]::text[],'members cannot read the field');
select function_privs_are('kut','admin_void_midweek',array['uuid','text'],'anon',array[]::text[],'anon cannot void');
select function_privs_are('kut','admin_void_midweek',array['uuid','text'],'authenticated',array['EXECUTE'],'void is checked inside, for admins');
select function_privs_are('kut','admin_midweek_rehearsal',array[]::text[],'authenticated',array['EXECUTE'],'the rehearsal is checked inside, for admins');
select function_privs_are('kut','admin_set_midweek_enabled',array['boolean'],'anon',array[]::text[],'anon cannot flip the switch');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;

update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000095-0000-4000-8000-0000000000f0','MW Engine Test',date '2024-12-02',true);

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000095-0000-4000-8000-00000000000' || n)::uuid, 'mw95-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['1','2','3','4','5','6','7','8','9','a','b']) n;

insert into kut.profiles(id,display_name,role,username,is_disabled)
select ('00000095-0000-4000-8000-00000000000' || n)::uuid, 'MW95 ' || upper(n), case when n = 'a' then 'admin' else 'user' end,
  'mw95_' || n, n = '8'
from unnest(array['1','2','3','4','5','6','7','8','9','a']) n;
insert into kut.midweek_opt_outs(user_id, opted_out_at) values ('00000095-0000-4000-8000-000000000007', now() - interval '30 days');

insert into kut.players(id,slug,display_name,archetype)
select ('00000095-0000-4000-8000-00000000010' || n)::uuid, 'mw95-player-' || n, 'MW95 Player ' || n,
  (array['goalkeeper','finisher','speedster','playmaker','defender','tank','all_rounder','all_rounder'])[n]
from generate_series(1,8) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000095-0000-4000-8000-00000000010' || n)::uuid, '00000095-0000-4000-8000-0000000000f0', 50, 0,
  75 - 5 * n, 50, 50, 50, 50, 50, 50, 'silver'
from generate_series(1,8) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000095-0000-4000-8000-00000000020' || n)::uuid, ('00000095-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW95 Live ' || n, true
from generate_series(1,8) n;

-- Player 3 is in injury mode and has not played since.
insert into kut.injury_periods(player_id,started_on) values ('00000095-0000-4000-8000-000000000103', date '2024-12-01');

insert into kut.user_cards(id,edition_id,owner_id,source,burned_at)
select ('00000095-0000-4000-8000-000000000' || card_no)::uuid, ('00000095-0000-4000-8000-00000000020' || player_no)::uuid,
  ('00000095-0000-4000-8000-00000000000' || owner_no)::uuid, 'pack', case when burned then now() end
from (values
  ('301',1,'1',false),('302',2,'1',false),('303',3,'1',false),('304',4,'1',false),('305',5,'1',false),('306',1,'1',false),
  ('311',1,'2',false),('312',2,'2',false),('313',6,'2',false),('314',7,'2',false),
  ('321',3,'3',false),('322',4,'3',false),('323',8,'3',false),
  ('331',5,'4',false),('332',6,'4',false),
  ('341',7,'5',false),
  ('351',2,'6',false),('352',8,'6',false),
  ('361',1,'7',false),('371',2,'8',false),('381',3,'9',true)
) cards(card_no, player_no, owner_no, burned);

-- A published session in the football week before T1, T2, T3 and T5; none before T4.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at)
select ('00000095-0000-4000-8000-00000000070' || n)::uuid, '00000095-0000-4000-8000-0000000000f0', d, 'other', 'published', now()
from (values (1, date '2025-01-01'), (2, date '2025-01-08'), (3, date '2025-01-15'), (5, date '2025-01-29')) s(n, d);

insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash)
select ('00000095-0000-4000-8000-00000000050' || n)::uuid, date '2025-01-06' + 7 * (n - 1), now() + interval '1 day',
  encode(sha256(decode(repeat(to_hex(n) || 'c', 32),'hex')),'hex')
from generate_series(1,6) n;
insert into kut.midweek_tournament_secrets(tournament_id,seed)
select ('00000095-0000-4000-8000-00000000050' || n)::uuid, repeat(to_hex(n) || 'c', 32)
from generate_series(1,6) n;

-- The same saved squads in every tournament.
insert into kut.midweek_squads(id,tournament_id,user_id)
select ('00000095-0000-4000-8000-0000000006' || t || m)::uuid, ('00000095-0000-4000-8000-00000000050' || t)::uuid,
  ('00000095-0000-4000-8000-00000000000' || m)::uuid
from generate_series(1,6) t, generate_series(1,4) m;
insert into kut.midweek_squad_cards(squad_id,slot,card_id,player_id)
select ('00000095-0000-4000-8000-0000000006' || t || m)::uuid, slot, ('00000095-0000-4000-8000-000000000' || card_no)::uuid,
  ('00000095-0000-4000-8000-00000000010' || player_no)::uuid
from generate_series(1,6) t,
(values (1,1,'301',1),(1,2,'302',2),(1,3,'303',3),(1,4,'304',4),(1,5,'305',5),
        (2,1,'313',6),(2,2,'312',2),
        (3,1,'322',4),(3,2,'321',3),
        (4,1,'331',5)) picks(m, slot, card_no, player_no);

-- M3 trades away the card saved in slot 1 before any lock; M6 opts out after them.
update kut.user_cards set owner_id = '00000095-0000-4000-8000-000000000004' where id = '00000095-0000-4000-8000-000000000322';
insert into kut.midweek_opt_outs(user_id, opted_out_at) values ('00000095-0000-4000-8000-000000000006', now());

update kut.midweek_tournaments set lock_at = now() - interval '5 hours' where id = '00000095-0000-4000-8000-000000000501';
update kut.midweek_tournaments set lock_at = now() - interval '45 minutes' where id = '00000095-0000-4000-8000-000000000502';
update kut.midweek_tournaments set lock_at = now() - interval '10 minutes' where id = '00000095-0000-4000-8000-000000000503';
update kut.midweek_tournaments set lock_at = now() - interval '1 hour' where id = '00000095-0000-4000-8000-000000000504';
update kut.midweek_tournaments set lock_at = now() + interval '2 hours' where id = '00000095-0000-4000-8000-000000000505';

-- ---------------------------------------------------------------------------
-- Who may run the worker
-- ---------------------------------------------------------------------------
select throws_ok($q$select kut.run_midweek_due(5)$q$,'42501','service role required','a caller without the service role is refused');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-00000000000a',true);
select throws_ok($q$select kut.run_midweek_due(5)$q$,'42501',NULL,'even an admin cannot run the worker');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role service_role; set local request.jwt.claim.role = 'service_role';
select throws_ok($q$select kut.run_midweek_due(0)$q$,'22023',NULL,'the batch limit is bounded');
reset role; select set_config('request.jwt.claim.role','',true);

-- ---------------------------------------------------------------------------
-- The first worker call: four locks and one completion
-- ---------------------------------------------------------------------------
set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run_1', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);

select is(current_setting('kut_test.run_1')::jsonb,'{"locked": 4, "completed": 1, "opened": 0}'::jsonb,
  'one call locks the four due weeks and completes the one whose final is revealed');
select is((select error_text from kut.midweek_jobs order by id desc limit 1),null,'the worker recorded no error');
select results_eq($q$select id, status, status_reason from kut.midweek_tournaments where id::text like '00000095-%' order by week_start$q$,
  $q$values ('00000095-0000-4000-8000-000000000501'::uuid,'complete',null::text),
    ('00000095-0000-4000-8000-000000000502'::uuid,'simulated',null::text),
    ('00000095-0000-4000-8000-000000000503'::uuid,'simulated',null::text),
    ('00000095-0000-4000-8000-000000000504'::uuid,'skipped','club_break'),
    ('00000095-0000-4000-8000-000000000505'::uuid,'open',null::text),
    ('00000095-0000-4000-8000-000000000506'::uuid,'open',null::text)$q$,
  'each week lands in the state its times and gates call for');
select is((select count(*)::int from kut.midweek_entries where tournament_id='00000095-0000-4000-8000-000000000504'),0,
  'a club break simulates nothing');

select is((select rounds::int from kut.midweek_tournaments where id='00000095-0000-4000-8000-000000000501'),3,'six entrants play three rounds');
select ok((select final_reveal_at = lock_at + interval '90 minutes' from kut.midweek_tournaments where id='00000095-0000-4000-8000-000000000501'),
  'the final is revealed 30 minutes per round after the lock');
select is((select seed from kut.midweek_tournaments where id='00000095-0000-4000-8000-000000000501'),repeat('1c',32),
  'completion publishes the committed seed');
select is((select seed from kut.midweek_tournaments where id='00000095-0000-4000-8000-000000000502'),null,
  'a simulated week keeps its seed secret');

-- The field.
select results_eq($q$select user_id, auto from kut.midweek_entries where tournament_id='00000095-0000-4000-8000-000000000501' order by user_id$q$,
  $q$values ('00000095-0000-4000-8000-000000000001'::uuid,false),('00000095-0000-4000-8000-000000000002'::uuid,false),
    ('00000095-0000-4000-8000-000000000003'::uuid,false),('00000095-0000-4000-8000-000000000004'::uuid,false),
    ('00000095-0000-4000-8000-000000000005'::uuid,true),('00000095-0000-4000-8000-000000000006'::uuid,true)$q$,
  'the field is every active member with a card who had not opted out by the lock; non-pickers are auto');
select is((select count(*)::int from kut.midweek_entry_cards where tournament_id='00000095-0000-4000-8000-000000000501'),30,
  'every entry fields five cards');

-- The lock-time snapshot of M1's picks.
select results_eq($q$select slot::int, player_id, ovr::int, archetype, injured, fitness_ppm, handicap_ppm
  from kut.midweek_entry_cards where tournament_id='00000095-0000-4000-8000-000000000501' and user_id='00000095-0000-4000-8000-000000000001' order by slot$q$,
  $q$values (0,'00000095-0000-4000-8000-000000000101'::uuid,70,'goalkeeper',false,1000000,1000000),
    (1,'00000095-0000-4000-8000-000000000102'::uuid,65,'finisher',false,1000000,1000000),
    (2,'00000095-0000-4000-8000-000000000103'::uuid,60,'speedster',true,950000,1000000),
    (3,'00000095-0000-4000-8000-000000000104'::uuid,55,'playmaker',false,1000000,1000000),
    (4,'00000095-0000-4000-8000-000000000105'::uuid,50,'defender',false,1000000,1000000)$q$,
  'picks keep their order; OVR, archetype and the injury flag are snapshotted, and an injured Live card plays at 0.95');
select results_eq($q$select keeper_slot::int, keeperless from kut.midweek_entries where tournament_id='00000095-0000-4000-8000-000000000501'
  and user_id in ('00000095-0000-4000-8000-000000000001','00000095-0000-4000-8000-000000000002') order by user_id$q$,
  $q$values (0,false),(0,true)$q$,'a Goalkeeper plays in goal; a squad without one is keeperless');
select results_eq($q$select slot::int, trialist, card_id, handicap_ppm from kut.midweek_entry_cards
  where tournament_id='00000095-0000-4000-8000-000000000501' and user_id='00000095-0000-4000-8000-000000000003' order by slot$q$,
  $q$values (0,false,'00000095-0000-4000-8000-000000000321'::uuid,1000000),(1,true,null::uuid,825000),(2,true,null::uuid,825000),
    (3,true,null::uuid,825000),(4,true,null::uuid,825000)$q$,
  'a saved card no longer owned drops out, the survivors move up, and trialists fill the rest');
select results_eq($q$select trialist, pick_factor_ppm, handicap_ppm from kut.midweek_entry_cards
  where tournament_id='00000095-0000-4000-8000-000000000501' and user_id='00000095-0000-4000-8000-000000000005' order by slot$q$,
  $q$values (false,1000000,575000),(true,1000000,474375),(true,1000000,474375),(true,1000000,474375),(true,1000000,474375)$q$,
  'an auto squad fields the one card it owns at the auto factor and neutral pick, and its trialists at both factors');
select ok((select bool_and(card.player_id in ('00000095-0000-4000-8000-000000000102','00000095-0000-4000-8000-000000000108'))
  and count(*) filter (where not trialist) = 2
  from kut.midweek_entry_cards card where tournament_id='00000095-0000-4000-8000-000000000501' and user_id='00000095-0000-4000-8000-000000000006'
  and not trialist), 'an auto squad draws only from the member''s own collection, one copy per Player');

select results_eq($q$select player_id, owners::int, picks::int from kut.midweek_pick_shares
  where tournament_id='00000095-0000-4000-8000-000000000501' order by player_id$q$,
  $q$values ('00000095-0000-4000-8000-000000000101'::uuid,2,1),('00000095-0000-4000-8000-000000000102'::uuid,3,2),
    ('00000095-0000-4000-8000-000000000103'::uuid,2,2),('00000095-0000-4000-8000-000000000104'::uuid,2,1),
    ('00000095-0000-4000-8000-000000000105'::uuid,2,2),('00000095-0000-4000-8000-000000000106'::uuid,2,1),
    ('00000095-0000-4000-8000-000000000107'::uuid,2,0),('00000095-0000-4000-8000-000000000108'::uuid,2,0)$q$,
  'owners count every entrant holding the Player; picks leave out auto squads, the opted-out and the disabled');

-- The bracket.
select is((select count(*)::int from kut.midweek_matches where tournament_id='00000095-0000-4000-8000-000000000501'),7,
  'eight slots make four round-1 pairings, two semi-finals and a final');
select results_eq($q$select count(*)::int, bool_and(round = 1 and winner_side = 0 and winner_user_id = side_0_user_id and side_0_goals is null)
  from kut.midweek_matches where tournament_id='00000095-0000-4000-8000-000000000501' and bye$q$,
  $q$values (2, true)$q$,'two byes sit in round 1, and each goes through as a win');
select is((select count(*)::int from (
  select side_0_user_id u from kut.midweek_matches where tournament_id='00000095-0000-4000-8000-000000000501' and round = 1
  union all select side_1_user_id from kut.midweek_matches where tournament_id='00000095-0000-4000-8000-000000000501' and round = 1 and not bye) r),
  6,'every entrant is seated once in round 1');
select ok((select bool_and(reveal_at = t.lock_at + interval '30 minutes' * round) from kut.midweek_matches m
  join kut.midweek_tournaments t on t.id = m.tournament_id where t.id='00000095-0000-4000-8000-000000000501'),
  'round r is revealed 30 minutes × r after the lock');
select ok((select bool_and(cardinality(side_0_day_rolls_ppm) = 5 and cardinality(side_1_day_rolls_ppm) = 5
  and (side_0_goals <> side_1_goals or side_0_penalties is not null))
  from kut.midweek_matches where tournament_id='00000095-0000-4000-8000-000000000501' and not bye),
  'every match stores each card''s day roll per side and has a winner, by penalties after a draw');
select ok((select bool_and(case when m.bye then e.events = 0 else e.goals = m.side_0_goals + m.side_1_goals end)
  from kut.midweek_matches m
  cross join lateral (select count(*)::int as events, count(*) filter (where kind = 'chance' and outcome = 'goal')::int as goals
    from kut.midweek_match_events where match_id = m.id) e
  where m.tournament_id='00000095-0000-4000-8000-000000000501'),
  'a match''s goals are its goal events; a bye has no events');

-- The stored result is the engine's result for this field and seed.
select is(
  (select winner_user_id from kut.midweek_matches m join kut.midweek_tournaments t on t.id = m.tournament_id
   where t.id='00000095-0000-4000-8000-000000000501' and m.round = t.rounds),
  (select (kut._mm_simulate(decode(repeat('1c',32),'hex'),
     kut._mm_field('00000095-0000-4000-8000-000000000501', t.lock_at)->'entrants')->>'championUserId')::uuid
   from kut.midweek_tournaments t where t.id='00000095-0000-4000-8000-000000000501'),
  'the stored final''s winner is the engine''s champion');
select is(
  (select count(*)::int from kut.midweek_match_events e join kut.midweek_matches m on m.id = e.match_id
   where m.tournament_id='00000095-0000-4000-8000-000000000501'),
  (select sum(jsonb_array_length(played#>'{outcome,events}'))::int
   from kut.midweek_tournaments t,
     jsonb_array_elements(kut._mm_simulate(decode(repeat('1c',32),'hex'),
       kut._mm_field(t.id, t.lock_at)->'entrants')->'matches') played
   where t.id='00000095-0000-4000-8000-000000000501'),
  'every engine event is stored');

-- A second call finds nothing to do and changes nothing (Part L #25).
select set_config('kut_test.counts', (select concat_ws(',',
  (select count(*) from kut.midweek_entries), (select count(*) from kut.midweek_entry_cards),
  (select count(*) from kut.midweek_pick_shares), (select count(*) from kut.midweek_matches),
  (select count(*) from kut.midweek_match_events),
  (select string_agg(id::text || status || coalesce(rounds::text, '') || coalesce(final_reveal_at::text, ''), '' order by id) from kut.midweek_tournaments))), true);
set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run_2', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);
select is(current_setting('kut_test.run_2')::jsonb,'{"locked": 0, "completed": 0, "opened": 0}'::jsonb,'a second call has nothing to do');
select is((select concat_ws(',',
  (select count(*) from kut.midweek_entries), (select count(*) from kut.midweek_entry_cards),
  (select count(*) from kut.midweek_pick_shares), (select count(*) from kut.midweek_matches),
  (select count(*) from kut.midweek_match_events),
  (select string_agg(id::text || status || coalesce(rounds::text, '') || coalesce(final_reveal_at::text, ''), '' order by id) from kut.midweek_tournaments))),
  current_setting('kut_test.counts'),'and changes nothing it stored');

-- ---------------------------------------------------------------------------
-- A stored result never changes (Part L #25)
-- ---------------------------------------------------------------------------
select throws_ok($q$update kut.midweek_entry_cards set power_ppm = power_ppm + 1 where tournament_id='00000095-0000-4000-8000-000000000501'$q$,
  '55000',NULL,'an entry card cannot be changed');
select throws_ok($q$update kut.midweek_matches set winner_side = 1 - winner_side where tournament_id='00000095-0000-4000-8000-000000000501' and not bye$q$,
  '55000',NULL,'a match result cannot be changed');
select throws_ok($q$delete from kut.midweek_match_events where match_id in (select id from kut.midweek_matches where tournament_id='00000095-0000-4000-8000-000000000501')$q$,
  '55000',NULL,'events cannot be deleted');
select throws_ok($q$delete from kut.midweek_entries where tournament_id='00000095-0000-4000-8000-000000000501'$q$,
  '55000',NULL,'entries cannot be deleted');
select throws_ok($q$insert into kut.midweek_pick_shares(tournament_id,player_id,owners,picks,share_ppm,pick_factor_ppm)
  values ('00000095-0000-4000-8000-000000000502','00000095-0000-4000-8000-000000000101',9,9,1,1)$q$,
  '55000',NULL,'nothing is added to a simulated week');
select throws_ok($q$update kut.midweek_tournaments set status = 'open' where id='00000095-0000-4000-8000-000000000502'$q$,
  '55000',NULL,'a simulated week cannot reopen');
select throws_ok($q$update kut.midweek_tournaments set rounds = 4, final_reveal_at = final_reveal_at + interval '30 minutes'
  where id='00000095-0000-4000-8000-000000000502'$q$,'55000',NULL,'a drawn bracket keeps its size');
select throws_ok($q$update kut.midweek_tournaments set lock_at = now() + interval '1 day' where id='00000095-0000-4000-8000-000000000502'$q$,
  '55000',NULL,'a lock that has happened stays put');
select throws_ok($q$update kut.midweek_tournaments set status = 'complete', seed = repeat('0',64) where id='00000095-0000-4000-8000-000000000502'$q$,
  '55000',NULL,'only the committed seed can be published');
select throws_ok($q$update kut.midweek_tournaments set status = 'simulated', rounds = 2, final_reveal_at = now() where id='00000095-0000-4000-8000-000000000504'$q$,
  '55000',NULL,'a skipped week is never simulated');

-- Squads are immutable after the lock, whoever writes.
select throws_ok($q$insert into kut.midweek_squads(tournament_id,user_id) values ('00000095-0000-4000-8000-000000000503','00000095-0000-4000-8000-000000000005')$q$,
  'P0001','squads are locked','no squad is added after the lock');
select throws_ok($q$delete from kut.midweek_squad_cards where squad_id='00000095-0000-4000-8000-000000000621'$q$,
  'P0001','squads are locked','no saved card is removed after the lock');
select throws_ok($q$update kut.midweek_squad_cards set slot = 6 where squad_id='00000095-0000-4000-8000-000000000641'$q$,
  '23514',NULL,'a constraint still fails with its own error');
select lives_ok($q$delete from kut.midweek_squad_cards where squad_id='00000095-0000-4000-8000-000000000654'$q$,
  'a squad for a week that has not locked can still change');

-- The snapshot outlives later changes.
update kut.player_season_state set live_ovr = 80 where player_id='00000095-0000-4000-8000-000000000101';
update kut.players set archetype = 'tank' where id='00000095-0000-4000-8000-000000000101';
select results_eq($q$select ovr::int, archetype from kut.midweek_entry_cards
  where tournament_id='00000095-0000-4000-8000-000000000501' and user_id='00000095-0000-4000-8000-000000000001' and slot = 0$q$,
  $q$values (70,'goalkeeper')$q$,'a later OVR or archetype change leaves the locked snapshot alone');

-- ---------------------------------------------------------------------------
-- Reveals, as an ordinary member
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-000000000005',true);

-- T1, complete: everything is out.
select is((select count(*)::int from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000501'),7,
  'a complete week shows every pairing');
select is((select count(*)::int from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000501' and bye),2,
  'byes show in their round-1 pairing');
select ok((select count(*) > 0 from kut.midweek_events_public where tournament_id='00000095-0000-4000-8000-000000000501'),
  'a complete week shows its events');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000095-0000-4000-8000-000000000501'),30,
  'a complete week shows every entered card');
select results_eq($q$select player_id, picks::int, owners::int from kut.midweek_entries_public
  where tournament_id='00000095-0000-4000-8000-000000000501' and user_id='00000095-0000-4000-8000-000000000001' order by slot$q$,
  $q$values ('00000095-0000-4000-8000-000000000101'::uuid,1,null::int),('00000095-0000-4000-8000-000000000102'::uuid,2,3),
    ('00000095-0000-4000-8000-000000000103'::uuid,2,null),('00000095-0000-4000-8000-000000000104'::uuid,1,null),
    ('00000095-0000-4000-8000-000000000105'::uuid,2,null)$q$,
  'once complete, picks show, and an owner count only from three owners');
select results_eq($q$select player_id, picks::int, owners::int from kut.midweek_pick_shares_public
  where tournament_id='00000095-0000-4000-8000-000000000501' order by player_id$q$,
  $q$values ('00000095-0000-4000-8000-000000000101'::uuid,1,null::int),('00000095-0000-4000-8000-000000000102'::uuid,2,3),
    ('00000095-0000-4000-8000-000000000103'::uuid,2,null),('00000095-0000-4000-8000-000000000104'::uuid,1,null),
    ('00000095-0000-4000-8000-000000000105'::uuid,2,null),('00000095-0000-4000-8000-000000000106'::uuid,1,null)$q$,
  'pick shares show picked Players, owner counts below three hidden, and leave out unpicked Players few own');
select is((select champion_user_id from kut.midweek_tournaments_public where tournament_id='00000095-0000-4000-8000-000000000501'),
  (select winner_user_id from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000501' and round = 3),
  'the tournament list names the champion');
select is((select champion_name from kut.midweek_tournaments_public where tournament_id='00000095-0000-4000-8000-000000000501'),
  (select side_0_name from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000501' and round = 3 and winner_side = 0
   union all select side_1_name from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000501' and round = 3 and winner_side = 1),
  'with the champion''s display name');
select ok((select seed = repeat('1c',32) from kut.midweek_tournaments_public where tournament_id='00000095-0000-4000-8000-000000000501'),
  'members read the seed of a complete week');

-- T2, round 1 revealed.
select results_eq($q$select distinct round::int from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000502'$q$,
  $q$values (1)$q$,'mid-evening only the revealed round shows');
select is((select count(*)::int from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000502'),4,
  'round 1''s four pairings show');
select ok((select bool_and(round = 1) and count(*) > 0 from kut.midweek_events_public where tournament_id='00000095-0000-4000-8000-000000000502'),
  'only round 1''s events show');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000095-0000-4000-8000-000000000502'),30,
  'squads show from round 1');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000095-0000-4000-8000-000000000502'
  and (picks is not null or owners is not null)),0,'no pick or owner count shows before the week is complete (D3)');
select is((select count(*)::int from kut.midweek_pick_shares_public where tournament_id='00000095-0000-4000-8000-000000000502'),0,
  'pick shares wait for completion');
select results_eq($q$select status, champion_user_id, seed from kut.midweek_tournaments_public where tournament_id='00000095-0000-4000-8000-000000000502'$q$,
  $q$values ('simulated', null::uuid, null::text)$q$,'no champion and no seed before the final');

-- T3, locked, nothing revealed.
select is((select count(*)::int from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000503'),0,
  'nothing shows between the lock and round 1');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000095-0000-4000-8000-000000000503'),0,
  'squads stay hidden until round 1');
select is((select count(*)::int from kut.midweek_events_public where tournament_id='00000095-0000-4000-8000-000000000503'),0,
  'events stay hidden until their round');
select is((select status from kut.midweek_tournaments_public where tournament_id='00000095-0000-4000-8000-000000000504'),'skipped',
  'a skipped week is listed with its status');

select is((select count(*)::int from kut.midweek_admin_overview),0,'a member reads no admin overview');
select throws_ok($q$select kut.admin_midweek_rehearsal()$q$,'42501',NULL,'a member cannot rehearse');
select throws_ok($q$select kut.admin_set_midweek_enabled(true)$q$,'42501',NULL,'a member cannot flip the switch');
select throws_ok($q$select kut.admin_void_midweek('00000095-0000-4000-8000-000000000502','Not mine to void')$q$,'42501',NULL,'a member cannot void');

-- Callers who read nothing.
select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-000000000008',true);
select is((select count(*)::int from kut.midweek_matches_public),0,'a disabled member reads no match');
select is((select count(*)::int from kut.midweek_entries_public),0,'a disabled member reads no entry');
select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-00000000000b',true);
select is((select count(*)::int from kut.midweek_matches_public),0,'a JWT with no KUT profile reads no match');
select is((select count(*)::int from kut.midweek_pick_shares_public),0,'a JWT with no KUT profile reads no pick share');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select throws_ok($q$select 1 from kut.midweek_matches_public$q$,'42501',NULL,'anon cannot read matches');
select throws_ok($q$select 1 from kut.midweek_events_public$q$,'42501',NULL,'anon cannot read events');
select throws_ok($q$select 1 from kut.midweek_entries_public$q$,'42501',NULL,'anon cannot read entries');
select throws_ok($q$select kut.admin_midweek_rehearsal()$q$,'42501',NULL,'anon cannot rehearse');
reset role;
set local role service_role;
select is((select count(*)::int from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000502'),4,
  'the service role reads the same reveal');
reset role;

-- ---------------------------------------------------------------------------
-- The admin overview and the rehearsal
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-00000000000a',true);
select results_eq($q$select enabled, tournament_id, status, squads_saved from kut.midweek_admin_overview$q$,
  $q$values (false,'00000095-0000-4000-8000-000000000506'::uuid,'open',4)$q$,
  'the admin overview shows the switch, the latest week and its saved squads');
select ok((select opted_out >= 2 and last_run_at is not null and last_run_error is null from kut.midweek_admin_overview),
  'and the opt-outs and the worker''s last run');

reset role;
select set_config('kut_test.before_rehearsal', (select concat_ws(',',
  (select count(*) from kut.midweek_config), (select count(*) from kut.midweek_tournaments),
  (select count(*) from kut.midweek_tournament_secrets), (select count(*) from kut.midweek_squads),
  (select count(*) from kut.midweek_squad_cards), (select count(*) from kut.midweek_opt_outs),
  (select count(*) from kut.midweek_entries), (select count(*) from kut.midweek_entry_cards),
  (select count(*) from kut.midweek_pick_shares), (select count(*) from kut.midweek_matches),
  (select count(*) from kut.midweek_match_events), (select count(*) from kut.midweek_jobs))), true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-00000000000a',true);
select set_config('kut_test.rehearsal', kut.admin_midweek_rehearsal()::text, true);
reset role;
select is((select concat_ws(',',
  (select count(*) from kut.midweek_config), (select count(*) from kut.midweek_tournaments),
  (select count(*) from kut.midweek_tournament_secrets), (select count(*) from kut.midweek_squads),
  (select count(*) from kut.midweek_squad_cards), (select count(*) from kut.midweek_opt_outs),
  (select count(*) from kut.midweek_entries), (select count(*) from kut.midweek_entry_cards),
  (select count(*) from kut.midweek_pick_shares), (select count(*) from kut.midweek_matches),
  (select count(*) from kut.midweek_match_events), (select count(*) from kut.midweek_jobs))),
  current_setting('kut_test.before_rehearsal'),'the rehearsal writes nothing');
-- It rehearses the earliest open week, T5, whose M4 squad was emptied above.
select results_eq($q$select r->>'tournament_id', r->>'status', (r->>'field')::int, (r->>'picked')::int, (r->>'auto')::int, r->'auto_managers'
  from (select current_setting('kut_test.rehearsal')::jsonb r) x$q$,
  $q$values ('00000095-0000-4000-8000-000000000505','simulated',5,3,2,'["MW95 4", "MW95 5"]'::jsonb)$q$,
  'it rehearses the open week''s field as it stands now, with who would get an auto squad');
select results_eq($q$select (r->>'size')::int, (r->>'rounds')::int, jsonb_array_length(r->'by_round'),
  jsonb_array_length(r->'by_round'->0->'pairings'), r->'champion'->>'name' is not null
  from (select current_setting('kut_test.rehearsal')::jsonb r) x$q$,
  $q$values (8,3,3,4,true)$q$,'with every pairing round by round and a champion');
select ok((select r->'warnings' @> '[{"level":"warning","message":"MW95 3: the card saved in slot 1 is no longer theirs, so a trialist plays"}]'::jsonb
  from (select current_setting('kut_test.rehearsal')::jsonb r) x),'and a warning for each saved card that was lost');
select is((select current_setting('kut_test.rehearsal')::jsonb->>'would_skip'),null,'a week with a session before it and enough entrants would run');

-- ---------------------------------------------------------------------------
-- Too few entrants, and an opt-out's timing
-- ---------------------------------------------------------------------------
update kut.midweek_opt_outs set opted_out_at = now() - interval '1 day'
where user_id in ('00000095-0000-4000-8000-000000000003','00000095-0000-4000-8000-000000000004','00000095-0000-4000-8000-000000000006');
insert into kut.midweek_opt_outs(user_id, opted_out_at) values
  ('00000095-0000-4000-8000-000000000003', now() - interval '1 day'), ('00000095-0000-4000-8000-000000000004', now() - interval '1 day')
on conflict (user_id) do nothing;
update kut.midweek_tournaments set lock_at = now() - interval '30 minutes' where id='00000095-0000-4000-8000-000000000505';
set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run_3', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);
select results_eq($q$select status, status_reason from kut.midweek_tournaments where id='00000095-0000-4000-8000-000000000505'$q$,
  $q$values ('skipped','too_few_entrants')$q$,'three entrants mark the week skipped for too few');
select is((select count(*)::int from kut.midweek_entries where tournament_id='00000095-0000-4000-8000-000000000505'),0,
  'and store no entry');
select ok((select exists (select 1 from kut.midweek_entries where tournament_id='00000095-0000-4000-8000-000000000501'
  and user_id='00000095-0000-4000-8000-000000000006')),'an opt-out made after a lock does not take the member out of that week');

-- ---------------------------------------------------------------------------
-- Void (before payout only)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-00000000000a',true);
select throws_ok($q$select kut.admin_void_midweek('00000095-0000-4000-8000-000000000502','no')$q$,'22023',NULL,'a void needs a reason members can read');
select throws_ok($q$select kut.admin_void_midweek('00000095-0000-4000-8000-0000000005ff','A week that is not there')$q$,'P0002',NULL,'an unknown week cannot be voided');
select throws_ok($q$select kut.admin_void_midweek('00000095-0000-4000-8000-000000000501','Too late for this one')$q$,
  'P0001','this week has been paid, so it cannot be voided','a completed week cannot be voided');
select throws_ok($q$select kut.admin_void_midweek('00000095-0000-4000-8000-000000000504','Nothing ran this week')$q$,
  'P0001','this week did not run, so there is nothing to void','a skipped week cannot be voided');
select is(kut.admin_void_midweek('00000095-0000-4000-8000-000000000502','  A bug in the bracket; nothing is paid.  '),
  '{"tournament_id": "00000095-0000-4000-8000-000000000502", "status": "void"}'::jsonb,'an admin voids a simulated week mid-evening');
select throws_ok($q$select kut.admin_void_midweek('00000095-0000-4000-8000-000000000502','Twice is once too many')$q$,
  'P0001',NULL,'a void is final');

select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-000000000005',true);
select is((select count(*)::int from kut.midweek_matches_public where tournament_id='00000095-0000-4000-8000-000000000502'),0,
  'a void hides even the rounds already shown');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000095-0000-4000-8000-000000000502'),0,
  'and the squads');
select is((select count(*)::int from kut.midweek_events_public where tournament_id='00000095-0000-4000-8000-000000000502'),0,
  'and the events');
select results_eq($q$select status, status_reason, void_note, champion_user_id from kut.midweek_tournaments_public
  where tournament_id='00000095-0000-4000-8000-000000000502'$q$,
  $q$values ('void','admin_void','A bug in the bracket; nothing is paid.',null::uuid)$q$,'members read the void and its note');
reset role;
select ok((select voided_by = '00000095-0000-4000-8000-00000000000a' and voided_at is not null
  from kut.midweek_tournaments where id='00000095-0000-4000-8000-000000000502'),'the void records who and when');
select ok((select count(*) > 0 from kut.midweek_matches where tournament_id='00000095-0000-4000-8000-000000000502'),
  'a void hides the stored result; it never deletes or recomputes it');

-- ---------------------------------------------------------------------------
-- The switch and the open step
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-00000000000a',true);
select lives_ok($q$select kut.admin_void_midweek('00000095-0000-4000-8000-000000000503','Voided to clear the way')$q$,'a just-locked week can be voided');
select lives_ok($q$select kut.admin_void_midweek('00000095-0000-4000-8000-000000000506','Voided before its lock')$q$,'an open week can be voided');
reset role;
select set_config('request.jwt.claim.sub','',true);

-- Any other open or simulated week (outside this file) would hold the open step back.
update kut.midweek_tournaments set status = 'void', status_reason = 'admin_void', void_note = 'Cleared by a test'
where id::text not like '00000095-%' and status in ('open', 'simulated');

set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run_4', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);
select is((current_setting('kut_test.run_4')::jsonb->>'opened')::int,0,'switched off, no new week opens');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000095-0000-4000-8000-00000000000a',true);
select throws_ok($q$select kut.admin_set_midweek_enabled(null)$q$,'22023',NULL,'the switch needs a yes or a no');
select is(kut.admin_set_midweek_enabled(true),'{"enabled": true}'::jsonb,'an admin switches Midweek Madness on');
reset role;
select set_config('request.jwt.claim.sub','',true);
select is((select updated_by from kut.midweek_config),'00000095-0000-4000-8000-00000000000a'::uuid,'the switch records who flipped it');

set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run_5', kut.run_midweek_due(10)::text, true);
select set_config('kut_test.run_6', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);
select is((current_setting('kut_test.run_5')::jsonb->>'opened')::int,1,'switched on, the worker opens the next week');
select is((current_setting('kut_test.run_6')::jsonb->>'opened')::int,0,'and only one');
select results_eq($q$select count(*)::int, bool_and(extract(isodow from week_start) = 1), bool_and(lock_at > now()),
    bool_and(lock_at = kut._mm_lock_at(week_start)), bool_and(seed is null)
  from kut.midweek_tournaments where status = 'open'$q$,
  $q$values (1,true,true,true,true)$q$,'the new week starts on a Monday and locks on its Wednesday evening, still ahead');
select ok((select t.seed_hash = encode(sha256(decode(s.seed,'hex')),'hex') from kut.midweek_tournaments t
  join kut.midweek_tournament_secrets s on s.tournament_id = t.id where t.status = 'open'),
  'its published hash commits to its secret seed');
select ok((select week_start not in (select week_start from kut.midweek_tournaments where id::text like '00000095-%')
  from kut.midweek_tournaments where status = 'open'),'a week that already has a tournament is never opened again');

select * from finish();
rollback;
