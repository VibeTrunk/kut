-- Midweek Madness 2.0, D (20261017000000): predictions for members who are out.
-- BUILD_SPEC §44.7, §44.9, §44.14; Part L #28; ADR-118.
--
-- Every profile outside this file is opted out a year ago, so the field is
-- exactly M1-M8, eight active members with one card each, all OVR 60: eight
-- entrants, three rounds (round 1 at lock + 5 min, round 2 at + 20, the final
-- at + 35), four round-1 losers, 10 coins a correct pick. A match lasts at
-- most 8:55, so whatever the seed:
--
--   TA  locked 16 minutes ago  -> round 1 has ended, round 2 kicks off in 4
--   TB  locked 30 minutes ago  -> round 2 kicked off 10 minutes ago and has
--                                 ended, the final kicks off in 5
--   TC  locked 45 minutes ago  -> the final has ended; locked here, picks
--                                 written as they would have been, then paid
-- A is disabled and not in any field. Nobody saved a squad, so every squad is
-- an auto squad and every message ends by saying so.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(47);

-- ---------------------------------------------------------------------------
-- Shape and grants
-- ---------------------------------------------------------------------------
select ok((select pg_get_constraintdef(oid) ilike '%''midweek_prediction''%' from pg_constraint
  where conname = 'wallet_ledger_reason_check' and conrelid = 'kut.wallet_ledger'::regclass),
  'the ledger accepts midweek_prediction');
select is((select array_agg(kut._mm_prediction_coins(r) order by r) from generate_series(2, 6) r),
  array[30, 10, 4, 2, 0], 'coins a correct pick: 30 split over the matches after round 1');
select table_privs_are('kut','midweek_predictions','authenticated',array[]::text[],'members never touch the picks table');
select table_privs_are('kut','midweek_prediction_rewards','authenticated',array[]::text[],'nor the coins table');
select function_privs_are('kut','save_midweek_prediction',array['uuid','integer','integer','uuid'],'anon',array[]::text[],
  'anon cannot predict');
select function_privs_are('kut','save_midweek_prediction',array['uuid','integer','integer','uuid'],'authenticated',array['EXECUTE'],
  'members can');
select table_privs_are('kut','my_midweek_predictions','anon',array[]::text[],'anon reads no picks');
select table_privs_are('kut','midweek_prediction_splits_public','authenticated',array['SELECT'],'members read the split');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;
update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000118-0000-4000-8000-0000000000f0','MW Predictions Test',date '2024-12-02',true);

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000118-0000-4000-8000-00000000000' || n)::uuid, 'mw118-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['1','2','3','4','5','6','7','8','a']) n;
insert into kut.profiles(id,display_name,role,username,is_disabled)
select ('00000118-0000-4000-8000-00000000000' || n)::uuid, 'MW118 ' || n, 'user', 'mw118_' || n, n = 'a'
from unnest(array['1','2','3','4','5','6','7','8','a']) n;
insert into kut.players(id,slug,display_name,archetype)
select ('00000118-0000-4000-8000-00000000010' || n)::uuid, 'mw118-player-' || n, 'MW118 Player ' || n,
  (array['goalkeeper','finisher','speedster','playmaker','defender','tank','all_rounder','all_rounder'])[n]
from generate_series(1,8) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000118-0000-4000-8000-00000000010' || n)::uuid, '00000118-0000-4000-8000-0000000000f0', 50, 0,
  60, 50, 50, 50, 50, 50, 50, 'silver'
from generate_series(1,8) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000118-0000-4000-8000-00000000020' || n)::uuid, ('00000118-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW118 Live ' || n, true
from generate_series(1,8) n;
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000118-0000-4000-8000-00000000030' || n)::uuid, ('00000118-0000-4000-8000-00000000020' || n)::uuid,
  ('00000118-0000-4000-8000-00000000000' || n)::uuid, 'pack'
from generate_series(1,8) n;
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at)
select ('00000118-0000-4000-8000-0000000007' || lpad(n::text,2,'0'))::uuid, '00000118-0000-4000-8000-0000000000f0',
  date '2025-01-01' + 7 * n, 'other', 'published', now()
from generate_series(1,20) n;

insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash,schedule_version)
select ('00000118-0000-4000-8000-0000000005' || s)::uuid, date '2025-01-06' + 7 * w, now() + interval '1 day',
  encode(sha256(decode(repeat(s, 32),'hex')),'hex'), 2
from (values ('a1', 1), ('b2', 2), ('c3', 3)) t(s, w);
insert into kut.midweek_tournament_secrets(tournament_id,seed)
select ('00000118-0000-4000-8000-0000000005' || s)::uuid, repeat(s, 32)
from unnest(array['a1','b2','c3']) s;
update kut.midweek_tournaments t set lock_at = now() - o
from (values ('a1', interval '16 minutes'), ('b2', interval '30 minutes')) x(s, o)
where t.id = ('00000118-0000-4000-8000-0000000005' || x.s)::uuid;

set local role service_role; set local request.jwt.claim.role = 'service_role';
select is(kut.run_midweek_due(10), '{"locked": 2, "completed": 0, "opened": 0}'::jsonb,
  'the worker draws TA and TB');
reset role; select set_config('request.jwt.claim.role','',true);

-- Who lost where, read from the stored brackets.
create temporary table who on commit drop as
select t.s, m.round, m.pairing, m.winner_user_id as winner,
  case m.winner_side when 0 then m.side_1_user_id else m.side_0_user_id end as loser,
  m.side_0_user_id as side_0, m.side_1_user_id as side_1
from kut.midweek_matches m
join (values ('a1'), ('b2'), ('c3')) t(s) on m.tournament_id = ('00000118-0000-4000-8000-0000000005' || t.s)::uuid;
grant select on who to authenticated;

select is((select count(*)::int from who where s = 'a1' and round = 1), 4, 'TA has four round-1 matches');
select ok((select bool_and(m.ends_at <= now()) and bool_and(m2.reveal_at > now())
  from kut.midweek_matches m, kut.midweek_matches m2
  where m.tournament_id = '00000118-0000-4000-8000-0000000005a1' and m.round = 1
    and m2.tournament_id = m.tournament_id and m2.round = 2),
  'in TA round 1 has ended and round 2 has not kicked off');

-- ---------------------------------------------------------------------------
-- TA as members
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', (select loser::text from who where s = 'a1' and round = 1 and pairing = 0), true);

select lives_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 2, 0,
  (select side_0 from who where s = 'a1' and round = 2 and pairing = 0))$q$,
  'a member out in round 1 picks a round-2 match');
select lives_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 2, 0,
  (select side_1 from who where s = 'a1' and round = 2 and pairing = 0))$q$,
  'and changes the pick before kick-off');
select results_eq($q$select round::int, pairing::int, predicted_user_id, correct from kut.my_midweek_predictions
  where tournament_id = '00000118-0000-4000-8000-0000000005a1'$q$,
  $q$select 2, 0, side_1, null::boolean from who where s = 'a1' and round = 2 and pairing = 0$q$,
  'one pick per match, the latest, not yet decided');
select lives_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 2, 0, null)$q$,
  'a null pick clears it');
select is((select count(*)::int from kut.my_midweek_predictions where tournament_id = '00000118-0000-4000-8000-0000000005a1'),
  0, 'and it is gone');
select throws_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 2, 0,
  (select side_0 from who where s = 'a1' and round = 2 and pairing = 1))$q$,
  '22023', 'pick one of the two managers in that match', 'a manager from another match is refused');
select throws_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 3, 0,
  (select side_0 from who where s = 'a1' and round = 2 and pairing = 0))$q$,
  'P0001', 'this match opens for predictions once both matches before it have ended',
  'the final opens only once the semi-finals have ended');
select throws_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 2, 7,
  (select side_0 from who where s = 'a1' and round = 2 and pairing = 0))$q$,
  'P0002', 'no such match to predict', 'a pairing the bracket does not have');
select throws_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 1, 1,
  (select side_0 from who where s = 'a1' and round = 1 and pairing = 1))$q$,
  'P0001', 'predictions close at kick-off', 'round 1 kicked off long ago');
select lives_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 2, 1,
  (select side_0 from who where s = 'a1' and round = 2 and pairing = 1))$q$,
  'the other round-2 match too');

select set_config('request.jwt.claim.sub', (select winner::text from who where s = 'a1' and round = 1 and pairing = 2), true);
select throws_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 2, 0,
  (select side_0 from who where s = 'a1' and round = 2 and pairing = 0))$q$,
  'P0001', 'predictions open once you are out', 'a member still in cannot predict');
select throws_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 2, 9,
  (select side_0 from who where s = 'a1' and round = 2 and pairing = 0))$q$,
  'P0001', 'predictions open once you are out', 'nor learn which pairings exist by asking for one that does not');
select is((select count(*)::int from kut.my_midweek_predictions), 0, 'and sees nobody else''s picks');
select is((select count(*)::int from kut.midweek_prediction_splits_public
  where tournament_id = '00000118-0000-4000-8000-0000000005a1'), 0, 'no split shows before kick-off');

select set_config('request.jwt.claim.sub', '00000118-0000-4000-8000-00000000000a', true);
select throws_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005a1', 2, 0, null)$q$,
  '42501', 'an active KUT account is required', 'a disabled account cannot predict');
reset role;

-- The rules hold in the table, whoever writes.
select throws_ok($q$insert into kut.midweek_predictions(match_id, user_id, tournament_id, predicted_user_id)
  select m.id, w.winner, m.tournament_id, m.side_0_user_id from kut.midweek_matches m
  join who w on w.s = 'a1' and w.round = 1 and w.pairing = 3
  where m.tournament_id = '00000118-0000-4000-8000-0000000005a1' and m.round = 2 and m.pairing = 0$q$,
  'P0001', 'predictions open once you are out', 'the guard refuses a pick from a member still in');
select throws_ok($q$update kut.midweek_predictions set match_id = (select id from kut.midweek_matches
  where tournament_id = '00000118-0000-4000-8000-0000000005a1' and round = 2 and pairing = 0)
  where tournament_id = '00000118-0000-4000-8000-0000000005a1'$q$,
  '55000', 'a prediction keeps its match and member', 'a pick never moves to another match');

-- ---------------------------------------------------------------------------
-- TB: round 2 over, the final to come
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', (select loser::text from who where s = 'b2' and round = 1 and pairing = 0), true);
select throws_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005b2', 2, 1,
  (select side_0 from who where s = 'b2' and round = 2 and pairing = 1))$q$,
  'P0001', 'predictions close at kick-off', 'round 2 has kicked off');
select lives_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005b2', 3, 0,
  (select side_0 from who where s = 'b2' and round = 3))$q$,
  'a round-1 loser picks the final once both semi-finals have ended');
select set_config('request.jwt.claim.sub', (select loser::text from who where s = 'b2' and round = 2 and pairing = 1), true);
select lives_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005b2', 3, 0,
  (select side_1 from who where s = 'b2' and round = 3))$q$,
  'so does a semi-final loser');
reset role;

-- Two picks on a round-2 match, written as if before kick-off, for the split.
set local session_replication_role = replica;
insert into kut.midweek_predictions(match_id, user_id, tournament_id, predicted_user_id)
select m.id, w.loser, m.tournament_id, m.side_0_user_id
from kut.midweek_matches m join who w on w.s = 'b2' and w.round = 1 and w.pairing in (2, 3)
where m.tournament_id = '00000118-0000-4000-8000-0000000005b2' and m.round = 2 and m.pairing = 0;
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select loser::text from who where s = 'b2' and round = 1 and pairing = 2), true);
select results_eq($q$select round::int, pairing::int, side_0_picks, side_1_picks from kut.midweek_prediction_splits_public
  where tournament_id = '00000118-0000-4000-8000-0000000005b2' order by round$q$,
  $q$values (2, 0, 2, 0)$q$, 'from kick-off members see how the club split, and only the matches already under way');
select throws_ok($q$select kut.save_midweek_prediction('00000118-0000-4000-8000-0000000005b2', 2, 0, null)$q$,
  'P0001', 'predictions close at kick-off', 'a pick cannot be taken back after kick-off');
select results_eq($q$select correct from kut.my_midweek_predictions where tournament_id = '00000118-0000-4000-8000-0000000005b2'$q$,
  $q$select side_0 = winner from who where s = 'b2' and round = 2 and pairing = 0$q$,
  'once the match has ended, the member sees whether the pick came true');
reset role;

-- ---------------------------------------------------------------------------
-- TC: picks paid at the payout
-- ---------------------------------------------------------------------------
update kut.midweek_tournaments set lock_at = now() - interval '45 minutes'
where id = '00000118-0000-4000-8000-0000000005c3';
select is(kut._mm_lock_tournament('00000118-0000-4000-8000-0000000005c3'), 'simulated', 'TC is drawn');
insert into who
select 'c3', m.round, m.pairing, m.winner_user_id,
  case m.winner_side when 0 then m.side_1_user_id else m.side_0_user_id end, m.side_0_user_id, m.side_1_user_id
from kut.midweek_matches m where m.tournament_id = '00000118-0000-4000-8000-0000000005c3';
select ok((select final_reveal_at <= now() from kut.midweek_tournaments where id = '00000118-0000-4000-8000-0000000005c3'),
  'and its final has ended');

-- P1, out in round 1: both semi-finals and the final, two right.
-- P2, out in round 1: one semi-final, wrong. P3, out in round 1: no picks.
set local session_replication_role = replica;
insert into kut.midweek_predictions(match_id, user_id, tournament_id, predicted_user_id)
select m.id, p1.loser, m.tournament_id,
  case when m.round = 2 and m.pairing = 1 then
    case when m.winner_side = 0 then m.side_1_user_id else m.side_0_user_id end
  else m.winner_user_id end
from kut.midweek_matches m, who p1
where m.tournament_id = '00000118-0000-4000-8000-0000000005c3' and m.round >= 2
  and p1.s = 'c3' and p1.round = 1 and p1.pairing = 0;
insert into kut.midweek_predictions(match_id, user_id, tournament_id, predicted_user_id)
select m.id, p2.loser, m.tournament_id, case when m.winner_side = 0 then m.side_1_user_id else m.side_0_user_id end
from kut.midweek_matches m, who p2
where m.tournament_id = '00000118-0000-4000-8000-0000000005c3' and m.round = 2 and m.pairing = 0
  and p2.s = 'c3' and p2.round = 1 and p2.pairing = 1;
set local session_replication_role = origin;
select set_config('kut_test.p1', (select loser::text from who where s = 'c3' and round = 1 and pairing = 0), true);
select set_config('kut_test.p2', (select loser::text from who where s = 'c3' and round = 1 and pairing = 1), true);
select set_config('kut_test.p3', (select loser::text from who where s = 'c3' and round = 1 and pairing = 2), true);

select throws_ok($q$insert into kut.midweek_prediction_rewards(tournament_id, user_id, picks, correct, amount, ledger_id)
  values ('00000118-0000-4000-8000-0000000005c3', current_setting('kut_test.p1')::uuid, 3, 3, 30, gen_random_uuid())$q$,
  '23514', 'a Midweek prediction reward pays the stored picks that came true', 'the guard refuses a reward for picks that did not come true');
select throws_ok($q$insert into kut.midweek_prediction_rewards(tournament_id, user_id, picks, correct, amount, ledger_id)
  values ('00000118-0000-4000-8000-0000000005c3', current_setting('kut_test.p1')::uuid, 3, 2, 30, gen_random_uuid())$q$,
  '23514', 'a Midweek prediction reward pays the week''s rate a correct pick, at most 30', 'or at the wrong rate');

select is(kut._mm_complete_tournament('00000118-0000-4000-8000-0000000005c3'), 'complete', 'TC is paid and complete');
select results_eq($q$select user_id, picks::int, correct::int, amount::int from kut.midweek_prediction_rewards
  where tournament_id = '00000118-0000-4000-8000-0000000005c3'$q$,
  $q$values (current_setting('kut_test.p1')::uuid, 3, 2, 20)$q$,
  'one reward, for the member with picks that came true: 2 right at 10 coins');
select results_eq($q$select amount::int, idempotency_key from kut.wallet_ledger
  where reason = 'midweek_prediction' and reference_id = '00000118-0000-4000-8000-0000000005c3'$q$,
  $q$values (20, 'midweek-prediction:00000118-0000-4000-8000-0000000005c3:' || current_setting('kut_test.p1'))$q$,
  'with its own ledger row');
select is((select balance::int from kut.wallets where user_id = current_setting('kut_test.p1')::uuid), 20,
  'and the wallet holds it (a round-1 loser won nothing else)');
select ok((select body like '% won it. You called 2 of 3 right: +20 KUT Coins. Your auto squad played for you.' from kut.user_notifications
  where user_id = current_setting('kut_test.p1')::uuid and reference_id = '00000118-0000-4000-8000-0000000005c3'),
  'the result message says how the picks went');
select ok((select body like '% won it. You called 0 of 1 right. Your auto squad played for you.' from kut.user_notifications
  where user_id = current_setting('kut_test.p2')::uuid and reference_id = '00000118-0000-4000-8000-0000000005c3'),
  'including none right, without coins');
select ok((select body not like '%You called%' from kut.user_notifications
  where user_id = current_setting('kut_test.p3')::uuid and reference_id = '00000118-0000-4000-8000-0000000005c3'),
  'and nothing for a member who made no picks');
select is(kut._mm_pay_tournament('00000118-0000-4000-8000-0000000005c3'), 0, 'a second payout pays nothing');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('kut_test.p1'), true);
select results_eq($q$select picks::int, correct::int, amount::int from kut.my_midweek_prediction_rewards$q$,
  $q$values (3, 2, 20)$q$, 'the member reads their own coins');
reset role;

select * from finish();
rollback;
