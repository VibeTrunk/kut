-- Midweek Madness 2.0, B2 (20261012000000): what members see from the lock.
-- BUILD_SPEC §44.9, §44.14; ADR-105.
--
-- From the lock members see round 1's draw and every entered five, with none
-- of the week's dice (form roll, pick factor, power) until round 1 kicks off;
-- final_reveal_at only once the final is over; and whether the evening is live.
--
-- Every profile outside this file is opted out a year ago, so the field is
-- exactly M1-M9, nine active members with two cards each (M1 a third, of
-- Player 7, whom nobody else owns): 16 slots, 7 byes, four rounds, on schedule
-- version 2 (round r at lock + 5 + 15 × (r − 1) minutes, the final at +50).
-- A is an admin with no card; B is disabled.
--
--   TF  locked 3 hours ago        -> complete: the final is over and paid
--   TA  locked 50:01 ago          -> the final kicked off a second ago
--   TB  locked 10 minutes ago     -> round 1 has started, round 2 not
--   TC  locked 2 minutes ago      -> drawn; round 1 starts in 3 minutes
--   TD  locked 2 minutes ago      -> drawn, then voided
--   TE  locks tomorrow            -> open
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(49);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_view('kut','midweek_draw_public','the draw projection exists');
select is((select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid='kut.midweek_draw_public'::regclass and attnum>0 and not attisdropped),
  array['match_id','tournament_id','week_start','pairing','bye','side_0_user_id','side_0_name',
    'side_1_user_id','side_1_name','kickoff_at'],
  'the draw carries pairings, managers and the kick-off, and no result column');
select table_privs_are('kut','midweek_draw_public','anon',array[]::text[],'anon cannot read the draw');
select table_privs_are('kut','midweek_draw_public','authenticated',array['SELECT'],'members read the draw');
select is((select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid='kut.midweek_entries_public'::regclass and attnum>0 and not attisdropped),
  array['tournament_id','week_start','user_id','manager_name','auto','keeper_slot','keeperless','slot','trialist',
    'player_id','player_name','photo_path','ovr','archetype','injured','ovr_factor_ppm','form_roll_ppm',
    'pick_factor_ppm','fitness_ppm','handicap_ppm','power_ppm','att_ppm','mid_ppm','def_ppm','picks','owners',
    -- appended by ADR-116
    'balance_ppm'],
  'the entries keep their columns');
select is((select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid='kut.midweek_tournaments_public'::regclass and attnum>0 and not attisdropped),
  array['tournament_id','week_start','lock_at','seed_hash','status','status_reason','void_note','rounds',
    'final_reveal_at','seed','champion_user_id','champion_name','schedule_version'],
  'the tournament list keeps its columns');
select is((select attname::text from pg_attribute where attrelid='kut.midweek_current'::regclass and attnum>0
  and not attisdropped order by attnum desc limit 1),'evening_live','midweek_current appends evening_live last');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;

update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000105-0000-4000-8000-0000000000f0','MW Draw Test',date '2024-12-02',true);

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000105-0000-4000-8000-00000000000' || n)::uuid, 'mw105-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['1','2','3','4','5','6','7','8','9','a','b']) n;
insert into kut.profiles(id,display_name,role,username,is_disabled)
select ('00000105-0000-4000-8000-00000000000' || n)::uuid, 'MW105 ' || upper(n), case when n = 'a' then 'admin' else 'user' end,
  'mw105_' || n, n = 'b'
from unnest(array['1','2','3','4','5','6','7','8','9','a','b']) n;

insert into kut.players(id,slug,display_name,archetype)
select ('00000105-0000-4000-8000-00000000010' || n)::uuid, 'mw105-player-' || n, 'MW105 Player ' || n,
  (array['goalkeeper','finisher','speedster','playmaker','defender','all_rounder','all_rounder'])[n]
from generate_series(1,7) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000105-0000-4000-8000-00000000010' || n)::uuid, '00000105-0000-4000-8000-0000000000f0', 50, 0,
  75 - 5 * n, 50, 50, 50, 50, 50, 50, 'silver'
from generate_series(1,7) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000105-0000-4000-8000-00000000020' || n)::uuid, ('00000105-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW105 Live ' || n, true
from generate_series(1,7) n;

-- Member m owns two cards: Players ((m − 1) mod 6) + 1 and (m mod 6) + 1, so
-- Players 1 and 4 have three owners, 2 and 3 four, 5 and 6 two. M1 also owns
-- the only card of Player 7.
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000105-0000-4000-8000-0000000003' || m || k)::uuid,
  ('00000105-0000-4000-8000-00000000020' || (((m - 1 + k) % 6) + 1))::uuid,
  ('00000105-0000-4000-8000-00000000000' || m)::uuid, 'pack'
from generate_series(1,9) m, generate_series(0,1) k;
insert into kut.user_cards(id,edition_id,owner_id,source) values
('00000105-0000-4000-8000-000000000317','00000105-0000-4000-8000-000000000207','00000105-0000-4000-8000-000000000001','pack');

-- A published session in the football week before each tournament.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at)
select ('00000105-0000-4000-8000-00000000070' || n)::uuid, '00000105-0000-4000-8000-0000000000f0', d, 'other', 'published', now()
from (values (1, date '2025-01-29'), (2, date '2025-02-05'), (3, date '2025-02-12'), (4, date '2025-02-19'),
  (5, date '2025-02-26'), (6, date '2025-03-05')) s(n, d);

insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash,schedule_version)
select ('00000105-0000-4000-8000-0000000005' || t)::uuid, w, now() + o, encode(sha256(decode(repeat(t, 32),'hex')),'hex'), 2
from (values ('f1', date '2025-02-03', - interval '3 hours'), ('a1', date '2025-02-10', - interval '50 minutes 1 second'),
  ('b1', date '2025-02-17', - interval '10 minutes'), ('c1', date '2025-02-24', - interval '2 minutes'),
  ('d1', date '2025-03-03', - interval '2 minutes'), ('e1', date '2025-03-10', interval '1 day')) s(t, w, o);
insert into kut.midweek_tournament_secrets(tournament_id,seed)
select ('00000105-0000-4000-8000-0000000005' || t)::uuid, repeat(t, 32)
from unnest(array['f1','a1','b1','c1','d1','e1']) t;

set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);

select is(current_setting('kut_test.run')::jsonb,'{"locked": 5, "completed": 1, "opened": 0}'::jsonb,
  'one call draws the five weeks past their lock and completes the one whose final is over');

-- TD is voided by an admin after the draw.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000105-0000-4000-8000-00000000000a',true);
select lives_ok($q$select kut.admin_void_midweek('00000105-0000-4000-8000-0000000005d1','Voided for the draw test')$q$,
  'an admin voids a drawn week');
reset role; select set_config('request.jwt.claim.sub','',true);

-- What the table holds, for comparison once reading as a member.
select ok((select bool_and(final_reveal_at is not null) from kut.midweek_tournaments
  where id in ('00000105-0000-4000-8000-0000000005f1','00000105-0000-4000-8000-0000000005a1',
    '00000105-0000-4000-8000-0000000005b1','00000105-0000-4000-8000-0000000005c1')),
  'every drawn week stores the end of its final from the lock');
select set_config('kut_test.tb_dice', (select string_agg(concat_ws(':', user_id, slot, form_roll_ppm, pick_factor_ppm, power_ppm), ','
  order by user_id, slot) from kut.midweek_entry_cards where tournament_id='00000105-0000-4000-8000-0000000005b1'), true);
select set_config('kut_test.tf_final', (select final_reveal_at::text from kut.midweek_tournaments
  where id='00000105-0000-4000-8000-0000000005f1'), true);

-- ---------------------------------------------------------------------------
-- As an ordinary member
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000105-0000-4000-8000-000000000001',true);

-- TE, before the lock: nothing.
select is((select count(*)::int from kut.midweek_draw_public where tournament_id='00000105-0000-4000-8000-0000000005e1'),0,
  'before the lock there is no draw');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000105-0000-4000-8000-0000000005e1'),0,
  'and no entered five');

-- TC, between the lock and round 1.
select results_eq($q$select count(*)::int, count(*) filter (where bye)::int, count(*) filter (where side_1_user_id is null)::int
  from kut.midweek_draw_public where tournament_id='00000105-0000-4000-8000-0000000005c1'$q$,
  $q$values (8, 7, 7)$q$,'from the lock the draw shows round 1''s eight pairings, seven of them byes with one entrant');
select is((select count(distinct entrant)::int from kut.midweek_draw_public
  cross join lateral (values (side_0_user_id), (side_1_user_id)) sides(entrant)
  where tournament_id='00000105-0000-4000-8000-0000000005c1' and entrant is not null),9,
  'every entrant is in the draw once');
select results_eq($q$select pairing::int from kut.midweek_draw_public where tournament_id='00000105-0000-4000-8000-0000000005c1' order by pairing$q$,
  $q$select generate_series(0, 7)$q$,'each pairing keeps its position in the bracket');
select ok((select bool_and(draw.kickoff_at = week.lock_at + interval '5 minutes')
  from kut.midweek_draw_public draw join kut.midweek_tournaments_public week using (tournament_id)
  where draw.tournament_id='00000105-0000-4000-8000-0000000005c1'),
  'every pairing kicks off at round 1''s start, five minutes after the lock');
select ok((select bool_and(side_0_name like 'MW105 %' and (bye or side_1_name like 'MW105 %'))
  from kut.midweek_draw_public where tournament_id='00000105-0000-4000-8000-0000000005c1'),
  'with both managers'' names');
select is((select count(*)::int from kut.midweek_matches_public where tournament_id='00000105-0000-4000-8000-0000000005c1'),0,
  'no match, score or winner shows before round 1');
select is((select count(*)::int from kut.midweek_events_public where tournament_id='00000105-0000-4000-8000-0000000005c1'),0,
  'and no event');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000105-0000-4000-8000-0000000005c1'),45,
  'from the lock every entrant''s five shows, trialists included');
select ok((select bool_and(ovr is not null and archetype is not null and injured is not null and trialist is not null
    and auto is not null and keeper_slot is not null and keeperless is not null and manager_name is not null
    and ovr_factor_ppm is not null and fitness_ppm is not null and handicap_ppm is not null
    and att_ppm is not null and mid_ppm is not null and def_ppm is not null)
  from kut.midweek_entries_public where tournament_id='00000105-0000-4000-8000-0000000005c1'),
  'with the OVR, archetype, injury, trialist and auto flags, the keeper and the fixed factors');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000105-0000-4000-8000-0000000005c1'
  and (form_roll_ppm is not null or pick_factor_ppm is not null or power_ppm is not null)),0,
  'the form roll, pick factor and power wait for round 1');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000105-0000-4000-8000-0000000005c1'
  and (picks is not null or owners is not null)),0,'no pick or owner count shows (D3)');

-- TB, round 1 under way.
select is((select count(*)::int from kut.midweek_draw_public where tournament_id='00000105-0000-4000-8000-0000000005b1'),8,
  'the draw stays out once round 1 has started');
select results_eq($q$select distinct round::int from kut.midweek_matches_public where tournament_id='00000105-0000-4000-8000-0000000005b1'$q$,
  $q$values (1)$q$,'round 1''s matches show from its kick-off, round 2''s not yet');
select is((select string_agg(concat_ws(':', user_id, slot, form_roll_ppm, pick_factor_ppm, power_ppm), ',' order by user_id, slot)
  from kut.midweek_entries_public where tournament_id='00000105-0000-4000-8000-0000000005b1'),
  current_setting('kut_test.tb_dice'),'from round 1 every form roll, pick factor and power shows as stored');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000105-0000-4000-8000-0000000005b1'
  and (picks is not null or owners is not null)),0,'still no pick or owner count before the week is complete (D3)');

-- TF, complete.
select is((select count(*)::int from kut.midweek_draw_public where tournament_id='00000105-0000-4000-8000-0000000005f1'),8,
  'a complete week keeps its draw');
select ok((select bool_and(picks is not null) from kut.midweek_entries_public
  where tournament_id='00000105-0000-4000-8000-0000000005f1' and not trialist),
  'once complete, every entered Player''s picks show');
select results_eq($q$select distinct player_id, owners::int from kut.midweek_entries_public
  where tournament_id='00000105-0000-4000-8000-0000000005f1' and not trialist order by player_id$q$,
  $q$values ('00000105-0000-4000-8000-000000000101'::uuid, 3), ('00000105-0000-4000-8000-000000000102'::uuid, 4),
    ('00000105-0000-4000-8000-000000000103'::uuid, 4), ('00000105-0000-4000-8000-000000000104'::uuid, 3),
    ('00000105-0000-4000-8000-000000000105'::uuid, null::int), ('00000105-0000-4000-8000-000000000106'::uuid, null::int),
    ('00000105-0000-4000-8000-000000000107'::uuid, null::int)$q$,
  'and an owner count only from three owners: two owners, or Player 7''s single one, stay hidden');

-- TD, void.
select is((select count(*)::int from kut.midweek_draw_public where tournament_id='00000105-0000-4000-8000-0000000005d1'),0,
  'a void week shows no draw');
select is((select count(*)::int from kut.midweek_entries_public where tournament_id='00000105-0000-4000-8000-0000000005d1'),0,
  'and no entered five');

-- final_reveal_at only once the final is over.
select results_eq($q$select tournament_id, final_reveal_at from kut.midweek_tournaments_public
  where tournament_id::text like '00000105-%' order by week_start$q$,
  $q$values ('00000105-0000-4000-8000-0000000005f1'::uuid, current_setting('kut_test.tf_final')::timestamptz),
    ('00000105-0000-4000-8000-0000000005a1'::uuid, null::timestamptz),
    ('00000105-0000-4000-8000-0000000005b1'::uuid, null::timestamptz),
    ('00000105-0000-4000-8000-0000000005c1'::uuid, null::timestamptz),
    ('00000105-0000-4000-8000-0000000005d1'::uuid, null::timestamptz),
    ('00000105-0000-4000-8000-0000000005e1'::uuid, null::timestamptz)$q$,
  'the tournament list shows the end of the final only once it has passed');
select ok((select rounds = 4 from kut.midweek_tournaments_public where tournament_id='00000105-0000-4000-8000-0000000005c1'),
  'the number of rounds still shows from the lock');

-- ---------------------------------------------------------------------------
-- midweek_current, week by week: it shows the latest, so each later week is
-- removed in turn (as postgres; the transaction rolls back).
-- ---------------------------------------------------------------------------
select results_eq($q$select tournament_id, status, final_reveal_at, evening_live from kut.midweek_current$q$,
  $q$values ('00000105-0000-4000-8000-0000000005e1'::uuid, 'open', null::timestamptz, false)$q$,
  'before the lock the evening is not live');

reset role;
delete from kut.midweek_tournaments where id='00000105-0000-4000-8000-0000000005e1';
set local role authenticated;
select results_eq($q$select status, evening_live from kut.midweek_current$q$,
  $q$values ('void', false)$q$,'a void week is not live');

reset role;
delete from kut.midweek_tournaments where id='00000105-0000-4000-8000-0000000005d1';
set local role authenticated;
select results_eq($q$select tournament_id, final_reveal_at, evening_live from kut.midweek_current$q$,
  $q$values ('00000105-0000-4000-8000-0000000005c1'::uuid, null::timestamptz, true)$q$,
  'from the lock the evening is live, and the end of the final stays hidden');

reset role;
delete from kut.midweek_tournaments where id='00000105-0000-4000-8000-0000000005c1';
set local role authenticated;
select results_eq($q$select tournament_id, final_reveal_at, evening_live from kut.midweek_current$q$,
  $q$values ('00000105-0000-4000-8000-0000000005b1'::uuid, null::timestamptz, true)$q$,
  'during round 1 the evening is live');

reset role;
delete from kut.midweek_tournaments where id='00000105-0000-4000-8000-0000000005b1';
set local role authenticated;
select results_eq($q$select tournament_id, final_reveal_at, evening_live from kut.midweek_current$q$,
  $q$values ('00000105-0000-4000-8000-0000000005a1'::uuid, null::timestamptz, true)$q$,
  'while the final plays the evening is live, and its end still hidden');

reset role;
delete from kut.midweek_tournaments where id='00000105-0000-4000-8000-0000000005a1';
set local role authenticated;
select results_eq($q$select tournament_id, status, final_reveal_at, evening_live from kut.midweek_current$q$,
  $q$values ('00000105-0000-4000-8000-0000000005f1'::uuid, 'complete', current_setting('kut_test.tf_final')::timestamptz, false)$q$,
  'after the final the evening is over and its end shows');

-- A week past its lock that the worker hasn't drawn yet may still be skipped.
reset role;
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash,schedule_version) values
('00000105-0000-4000-8000-000000000591', date '2025-03-17', now() - interval '1 minute',
  encode(sha256(decode(repeat('91', 32),'hex')),'hex'), 2);
set local role authenticated;
select results_eq($q$select status, evening_live from kut.midweek_current$q$,
  $q$values ('open', false)$q$,'a week not drawn yet is not live, though its lock has passed');
select is((select count(*)::int from kut.midweek_draw_public where tournament_id='00000105-0000-4000-8000-000000000591'),0,
  'and has no draw');

-- A simulated week whose final is over but not yet paid is no longer live.
reset role;
delete from kut.midweek_tournaments where id='00000105-0000-4000-8000-000000000591';
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash,schedule_version) values
('00000105-0000-4000-8000-000000000592', date '2025-03-24', now() - interval '2 hours',
  encode(sha256(decode(repeat('92', 32),'hex')),'hex'), 2);
insert into kut.midweek_tournament_secrets(tournament_id,seed) values ('00000105-0000-4000-8000-000000000592', repeat('92', 32));
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at) values
('00000105-0000-4000-8000-000000000707','00000105-0000-4000-8000-0000000000f0',date '2025-03-19','other','published',now());
select is(kut._mm_lock_tournament('00000105-0000-4000-8000-000000000592'),'simulated','a week drawn late, its final already over');
set local role authenticated;
select results_eq($q$select status, final_reveal_at is not null, evening_live from kut.midweek_current$q$,
  $q$values ('simulated', true, false)$q$,'is not live before the worker pays it, and its final''s end shows');

-- ---------------------------------------------------------------------------
-- Callers who read nothing
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000105-0000-4000-8000-00000000000b',true);
select is((select count(*)::int from kut.midweek_draw_public),0,'a disabled member reads no draw');
select is((select count(*)::int from kut.midweek_entries_public),0,'a disabled member reads no entry');
select is((select count(*)::int from kut.midweek_current),0,'a disabled member reads no current week');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select throws_ok($q$select 1 from kut.midweek_draw_public$q$,'42501',NULL,'anon cannot read the draw');
reset role;
set local role service_role;
select is((select count(*)::int from kut.midweek_draw_public where tournament_id='00000105-0000-4000-8000-0000000005f1'),8,
  'the service role reads the same draw');
reset role;

select * from finish();
rollback;
