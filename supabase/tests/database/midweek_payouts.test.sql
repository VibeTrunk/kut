-- Midweek Madness, migration D (20261006000000): the payouts. BUILD_SPEC §44.7,
-- §44.14, Part L #26 (and #4/#5); ADR-096.
--
-- Every profile outside this file is opted out a year ago, so the field is
-- exactly these personas:
--   M1-M9 -- active members, each owning one card; nobody saves a squad, so
--            every entrant plays an auto squad. M1 starts with a wallet of 100,
--            the others with none. M7-M9 opt out 4.5 hours ago and M5-M6
--            3.5 hours ago, so each lock below sees a different field.
--   A     -- admin, with no card.
--   B     -- an auth.users row with no kut.profiles row.
--
-- Tournaments, created open and moved to their lock:
--   T1 locked 5 hours ago, 9 entrants    -> 4 rounds, 7 byes; paid
--   T2 locked 4 hours ago, 6 entrants    -> 3 rounds, 2 byes; paid
--   T3 locked 3 hours ago, 4 entrants    -> 2 rounds; paid
--   T4 locked 45 minutes ago, 4 entrants -> final still ahead; voided unpaid
--   T5 (later in the file) locked 6 hours ago, 9 entrants: locked directly,
--      then its runner-up is disabled before the payout.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(63);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_table('kut','midweek_rewards','the reward guard table exists');
select has_view('kut','my_midweek_rewards','the member reward projection exists');
select is((select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid='kut.my_midweek_rewards'::regclass and attnum>0 and not attisdropped),
  array['tournament_id','week_start','round_no','match_id','bye','amount','paid_at'],
  'the member projection has its columns in order');
select table_privs_are('kut','midweek_rewards','authenticated',array[]::text[],'members cannot read rewards directly');
select table_privs_are('kut','midweek_rewards','anon',array[]::text[],'anon cannot read rewards');
select table_privs_are('kut','midweek_rewards','service_role',array['SELECT'],'the service role reads rewards');
select table_privs_are('kut','my_midweek_rewards','anon',array[]::text[],'anon cannot read the member projection');
select table_privs_are('kut','my_midweek_rewards','authenticated',array['SELECT'],'members read their own rewards');
select function_privs_are('kut','_mm_pay_tournament',array['uuid'],'authenticated',array[]::text[],'members cannot pay out');
select function_privs_are('kut','_mm_pay_tournament',array['uuid'],'service_role',array[]::text[],'the service role pays only through the worker');
select function_privs_are('kut','_mm_complete_tournament',array['uuid'],'authenticated',array[]::text[],'the re-created complete step stays internal');

-- ---------------------------------------------------------------------------
-- The widened constraints still refuse what they refused
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000096-0000-4000-8000-00000000000' || n)::uuid, 'mw96-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['1','2','3','4','5','6','7','8','9','a','b']) n;
insert into kut.profiles(id,display_name,role,username)
select ('00000096-0000-4000-8000-00000000000' || n)::uuid, 'MW96 ' || upper(n), case when n = 'a' then 'admin' else 'user' end, 'mw96_' || n
from unnest(array['1','2','3','4','5','6','7','8','9','a']) n;

select throws_ok($q$insert into kut.wallet_ledger(user_id,amount,reason) values ('00000096-0000-4000-8000-00000000000a',1,'midweek_bogus')$q$,
  '23514',NULL,'the ledger still refuses an unknown reason');
select throws_ok($q$insert into kut.user_notifications(user_id,event_type,title,body) values ('00000096-0000-4000-8000-00000000000a','midweek_bogus','t','b')$q$,
  '23514',NULL,'the inbox still refuses an unknown type');
select lives_ok($q$insert into kut.wallet_ledger(user_id,amount,reason) values ('00000096-0000-4000-8000-00000000000a',1,'injury_stipend'),
  ('00000096-0000-4000-8000-00000000000a',-1,'midweek_win')$q$,'the ledger keeps every earlier reason and accepts midweek_win');
select lives_ok($q$insert into kut.user_notifications(user_id,event_type,title,body) values ('00000096-0000-4000-8000-00000000000a','injury_check_in','t','b'),
  ('00000096-0000-4000-8000-00000000000a','midweek_result','t','b')$q$,'the inbox keeps every earlier type and accepts midweek_result');
delete from kut.wallet_ledger where user_id = '00000096-0000-4000-8000-00000000000a';
delete from kut.user_notifications where user_id = '00000096-0000-4000-8000-00000000000a';

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles where id::text not like '00000096-%'
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select ('00000096-0000-4000-8000-00000000000' || n)::uuid,
  now() - case when n >= 7 then interval '270 minutes' else interval '210 minutes' end
from generate_series(5,9) n;

update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000096-0000-4000-8000-0000000000f0','MW Payout Test',date '2025-02-03',true);

insert into kut.players(id,slug,display_name,archetype)
select ('00000096-0000-4000-8000-00000000010' || n)::uuid, 'mw96-player-' || n, 'MW96 Player ' || n,
  (array['goalkeeper','finisher','speedster','playmaker','defender','tank','all_rounder','all_rounder','all_rounder'])[n]
from generate_series(1,9) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000096-0000-4000-8000-00000000010' || n)::uuid, '00000096-0000-4000-8000-0000000000f0', 50, 0,
  80 - 5 * n, 50, 50, 50, 50, 50, 50, 'silver'
from generate_series(1,9) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000096-0000-4000-8000-00000000020' || n)::uuid, ('00000096-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW96 Live ' || n, true
from generate_series(1,9) n;
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000096-0000-4000-8000-00000000030' || n)::uuid, ('00000096-0000-4000-8000-00000000020' || n)::uuid,
  ('00000096-0000-4000-8000-00000000000' || n)::uuid, 'pack'
from generate_series(1,9) n;

insert into kut.wallets(user_id,balance) values ('00000096-0000-4000-8000-000000000001',100);

-- A published session in the football week before each tournament.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at)
select ('00000096-0000-4000-8000-00000000070' || n)::uuid, '00000096-0000-4000-8000-0000000000f0',
  date '2025-02-26' + 7 * (n - 1), 'other', 'published', now()
from generate_series(1,5) n;

insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash)
select ('00000096-0000-4000-8000-00000000050' || n)::uuid, date '2025-03-03' + 7 * (n - 1), now() + interval '1 day',
  encode(sha256(decode(repeat(to_hex(n) || 'd', 32),'hex')),'hex')
from generate_series(1,4) n;
insert into kut.midweek_tournament_secrets(tournament_id,seed)
select ('00000096-0000-4000-8000-00000000050' || n)::uuid, repeat(to_hex(n) || 'd', 32)
from generate_series(1,4) n;
update kut.midweek_tournaments set lock_at = now() - interval '5 hours' where id = '00000096-0000-4000-8000-000000000501';
update kut.midweek_tournaments set lock_at = now() - interval '4 hours' where id = '00000096-0000-4000-8000-000000000502';
update kut.midweek_tournaments set lock_at = now() - interval '3 hours' where id = '00000096-0000-4000-8000-000000000503';
update kut.midweek_tournaments set lock_at = now() - interval '45 minutes' where id = '00000096-0000-4000-8000-000000000504';

-- ---------------------------------------------------------------------------
-- One worker call locks four weeks and pays the three whose final is out
-- ---------------------------------------------------------------------------
set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run_1', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);

select is(current_setting('kut_test.run_1')::jsonb,'{"locked": 4, "completed": 3, "opened": 0}'::jsonb,
  'one call locks the four due weeks and completes the three whose final is revealed');
select is((select error_text from kut.midweek_jobs order by id desc limit 1),null,'the worker recorded no error');
select results_eq($q$select id, status, rounds::int from kut.midweek_tournaments where id::text like '00000096-%' order by week_start$q$,
  $q$values ('00000096-0000-4000-8000-000000000501'::uuid,'complete',4),('00000096-0000-4000-8000-000000000502'::uuid,'complete',3),
    ('00000096-0000-4000-8000-000000000503'::uuid,'complete',2),('00000096-0000-4000-8000-000000000504'::uuid,'simulated',2)$q$,
  'nine, six and four entrants play four, three and two rounds');

-- Exactly once, at the round's amount (Part L #26).
select results_eq($q$select t.id, count(r.*)::int, coalesce(sum(r.amount),0)::int
  from kut.midweek_tournaments t left join kut.midweek_rewards r on r.tournament_id = t.id
  where t.id::text like '00000096-%' group by t.id, t.week_start order by t.week_start$q$,
  $q$values ('00000096-0000-4000-8000-000000000501'::uuid,15,650),('00000096-0000-4000-8000-000000000502'::uuid,7,459),
    ('00000096-0000-4000-8000-000000000503'::uuid,3,333),('00000096-0000-4000-8000-000000000504'::uuid,0,0)$q$,
  'every pairing pays its winner once, a full bracket''s worth (§44.7), and a week whose final is ahead pays nothing');
select is((select count(*)::int from kut.midweek_matches m
  left join kut.midweek_rewards r on r.match_id = m.id and r.user_id = m.winner_user_id and r.round_no = m.round and r.bye = m.bye
  where m.tournament_id in ('00000096-0000-4000-8000-000000000501','00000096-0000-4000-8000-000000000502','00000096-0000-4000-8000-000000000503')
    and r.match_id is null),0,'each reward is a stored win: the pairing''s winner, in its round');
select ok((select bool_and(r.amount = (kut._mm_round_payouts(t.rounds))[r.round_no])
  from kut.midweek_rewards r join kut.midweek_tournaments t on t.id = r.tournament_id where t.id::text like '00000096-%'),
  'each win pays its round''s amount');
select results_eq($q$select t.id, sum(r.amount)::int from kut.midweek_tournaments t
  join kut.midweek_matches final on final.tournament_id = t.id and final.round = t.rounds
  join kut.midweek_rewards r on r.tournament_id = t.id and r.user_id = final.winner_user_id
  where t.id::text like '00000096-%' and t.status = 'complete' group by t.id, t.week_start order by t.week_start$q$,
  $q$values ('00000096-0000-4000-8000-000000000501'::uuid,250),('00000096-0000-4000-8000-000000000502'::uuid,250),
    ('00000096-0000-4000-8000-000000000503'::uuid,250)$q$,
  'the champion collects exactly 250 in a bracket of 16, 8 and 4');
select is((select max(total)::int from (select sum(amount) total from kut.midweek_rewards
  where tournament_id::text like '00000096-%' group by tournament_id, user_id) x),250,'no member is paid more than 250 by one tournament');
select results_eq($q$select count(*)::int, min(amount)::int, max(amount)::int, bool_and(round_no = 1)
  from kut.midweek_rewards where tournament_id = '00000096-0000-4000-8000-000000000501' and bye$q$,
  $q$values (7, 25, 25, true)$q$,'each of the seven byes pays as a round-1 win');
select is((select count(*)::int from kut.midweek_rewards where tournament_id = '00000096-0000-4000-8000-000000000501' and bye),
  (select count(*)::int from kut.midweek_matches where tournament_id = '00000096-0000-4000-8000-000000000501' and bye),
  'every bye is paid');

-- The ledger and the wallets (Part L #4, #5).
select is((select count(*)::int from kut.midweek_rewards r
  join kut.wallet_ledger l on l.id = r.ledger_id
  where r.tournament_id::text like '00000096-%'
    and l.user_id = r.user_id and l.amount = r.amount and l.reason = 'midweek_win'
    and l.reference_type = 'midweek_tournament' and l.reference_id = r.tournament_id
    and l.idempotency_key = 'midweek:' || r.tournament_id || ':' || r.round_no || ':' || r.user_id),
  (select count(*)::int from kut.midweek_rewards where tournament_id::text like '00000096-%'),
  'every reward has its ledger row: reason, amount, reference and idempotency key');
select is((select count(*)::int from kut.wallet_ledger where reason = 'midweek_win' and user_id::text like '00000096-%'),
  (select count(*)::int from kut.midweek_rewards where user_id::text like '00000096-%'),'and no other midweek_win row exists');
select is((select count(*)::int from kut.profiles p
  left join kut.wallets w on w.user_id = p.id
  where p.id::text like '00000096-%'
    and coalesce(w.balance, 0) - case when p.id = '00000096-0000-4000-8000-000000000001' then 100 else 0 end
      <> coalesce((select sum(amount) from kut.wallet_ledger l where l.user_id = p.id), 0)),0,
  'each wallet moved by exactly its ledger rows');
select is((select coalesce(sum(w.balance), 0)::int - 100 from kut.wallets w where w.user_id::text like '00000096-%'),
  650 + 459 + 333,'together the members were paid the three brackets');
select ok((select bool_and(exists (select 1 from kut.midweek_rewards r where r.user_id = w.user_id))
  from kut.wallets w where w.user_id::text like '00000096-%' and w.user_id <> '00000096-0000-4000-8000-000000000001'),
  'a wallet is opened for a member paid who had none');

-- The inbox: one message per member paid per tournament.
select results_eq($q$select reference_id, count(*)::int, count(distinct user_id)::int from kut.user_notifications
  where event_type = 'midweek_result' and user_id::text like '00000096-%' group by reference_id order by reference_id$q$,
  $q$select tournament_id, count(distinct user_id)::int, count(distinct user_id)::int from kut.midweek_rewards
  where tournament_id::text like '00000096-%' group by tournament_id order by tournament_id$q$,
  'one message per member paid, per tournament');
select ok((select bool_and(title = 'Midweek Madness' and reference_type = 'midweek_tournament') from kut.user_notifications
  where event_type = 'midweek_result' and user_id::text like '00000096-%'),'each message is titled and points at its tournament');
select is((select n.body from kut.user_notifications n
  join kut.midweek_matches final on final.tournament_id = n.reference_id and final.round = 4 and final.winner_user_id = n.user_id
  where n.event_type = 'midweek_result' and n.reference_id = '00000096-0000-4000-8000-000000000501'),
  'You won Midweek Madness on Wed 5 Mar: 250 KUT Coins over the night.','the champion''s message');
select is((select n.body from kut.user_notifications n
  join kut.midweek_matches final on final.tournament_id = n.reference_id and final.round = 2
    and n.user_id = case final.winner_side when 0 then final.side_1_user_id else final.side_0_user_id end
  where n.event_type = 'midweek_result' and n.reference_id = '00000096-0000-4000-8000-000000000503'),
  (select format('You reached the final on Wed 19 Mar: +83 KUT Coins. %s won it.', p.display_name)
   from kut.midweek_matches final join kut.profiles p on p.id = final.winner_user_id
   where final.tournament_id = '00000096-0000-4000-8000-000000000503' and final.round = 2),
  'the runner-up''s message names how far they got, their coins and the champion');
select is((select count(*)::int from kut.midweek_entries e
  where e.tournament_id = '00000096-0000-4000-8000-000000000503'
    and not exists (select 1 from kut.midweek_rewards r where r.tournament_id = e.tournament_id and r.user_id = e.user_id)
    and not exists (select 1 from kut.user_notifications n where n.user_id = e.user_id and n.reference_id = e.tournament_id)),2,
  'the two out in round 1 without a bye get neither coins nor a message');

-- ---------------------------------------------------------------------------
-- A second call pays nothing
-- ---------------------------------------------------------------------------
select set_config('kut_test.paid', (select concat_ws(',',
  (select count(*) from kut.midweek_rewards), (select count(*) from kut.wallet_ledger where reason = 'midweek_win'),
  (select count(*) from kut.user_notifications where event_type = 'midweek_result'),
  (select sum(balance) from kut.wallets where user_id::text like '00000096-%'))), true);
set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run_2', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);
select is(current_setting('kut_test.run_2')::jsonb,'{"locked": 0, "completed": 0, "opened": 0}'::jsonb,'a second call has nothing to do');
select is(kut._mm_pay_tournament('00000096-0000-4000-8000-000000000501'),0,'paying a complete week again pays nothing');
select is((select concat_ws(',',
  (select count(*) from kut.midweek_rewards), (select count(*) from kut.wallet_ledger where reason = 'midweek_win'),
  (select count(*) from kut.user_notifications where event_type = 'midweek_result'),
  (select sum(balance) from kut.wallets where user_id::text like '00000096-%'))),
  current_setting('kut_test.paid'),'no reward, ledger row, message or coin is added');

-- ---------------------------------------------------------------------------
-- The guard (Part L #26)
-- ---------------------------------------------------------------------------
select throws_ok($q$update kut.midweek_rewards set amount = amount + 1 where tournament_id = '00000096-0000-4000-8000-000000000501'$q$,
  '55000','a paid Midweek reward is final','a paid reward cannot change');
select throws_ok($q$insert into kut.midweek_rewards(tournament_id,round_no,user_id,match_id,bye,amount,ledger_id)
  select tournament_id, round, winner_user_id, gen_random_uuid(), bye, 25, gen_random_uuid()
  from kut.midweek_matches where tournament_id = '00000096-0000-4000-8000-000000000501' limit 1$q$,
  '55000',NULL,'a complete week takes no further reward');
select throws_ok($q$insert into kut.midweek_rewards(tournament_id,round_no,user_id,match_id,bye,amount,ledger_id)
  select tournament_id, round, winner_user_id, id, bye, 83, gen_random_uuid()
  from kut.midweek_matches where tournament_id = '00000096-0000-4000-8000-000000000504' and round = 1 limit 1$q$,
  '55000','Midweek rewards are paid once, when the final is revealed','a week whose final is still ahead pays nothing yet');

-- ---------------------------------------------------------------------------
-- Void: before payout only
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000096-0000-4000-8000-00000000000a',true);
select throws_ok($q$select kut.admin_void_midweek('00000096-0000-4000-8000-000000000501','Too late for this one')$q$,
  'P0001','this week has been paid, so it cannot be voided','a paid week cannot be voided');
select lives_ok($q$select kut.admin_void_midweek('00000096-0000-4000-8000-000000000504','Voided before the final')$q$,
  'a week can be voided before its final');
reset role;
select set_config('request.jwt.claim.sub','',true);
select is((select count(*)::int from kut.midweek_rewards where tournament_id = '00000096-0000-4000-8000-000000000504'),0,
  'a void pays nobody');
select is((select count(*)::int from kut.user_notifications where reference_id = '00000096-0000-4000-8000-000000000504'),0,
  'and sends no result');

-- ---------------------------------------------------------------------------
-- T5: the guard against a wrong payment, and a member disabled before payout
-- ---------------------------------------------------------------------------
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash) values
('00000096-0000-4000-8000-000000000505', date '2025-03-31', now() + interval '1 day',
  encode(sha256(decode(repeat('5d', 32),'hex')),'hex'));
insert into kut.midweek_tournament_secrets(tournament_id,seed) values ('00000096-0000-4000-8000-000000000505', repeat('5d', 32));
update kut.midweek_tournaments set lock_at = now() - interval '6 hours' where id = '00000096-0000-4000-8000-000000000505';
select is(kut._mm_lock_tournament('00000096-0000-4000-8000-000000000505'),'simulated','T5 locks with the whole field');
select is((select rounds::int from kut.midweek_tournaments where id = '00000096-0000-4000-8000-000000000505'),4,'nine entrants, four rounds');

select throws_ok($q$insert into kut.midweek_rewards(tournament_id,round_no,user_id,match_id,bye,amount,ledger_id)
  select tournament_id, round, winner_user_id, id, bye, 26, gen_random_uuid()
  from kut.midweek_matches where tournament_id = '00000096-0000-4000-8000-000000000505' and round = 1 limit 1$q$,
  '23514','a Midweek reward pays its round''s amount','a reward pays exactly its round''s amount');
select throws_ok($q$insert into kut.midweek_rewards(tournament_id,round_no,user_id,match_id,bye,amount,ledger_id)
  select tournament_id, round, case winner_side when 0 then side_1_user_id else side_0_user_id end, id, bye, 25, gen_random_uuid()
  from kut.midweek_matches where tournament_id = '00000096-0000-4000-8000-000000000505' and round = 1 and not bye limit 1$q$,
  '23514','a Midweek reward pays a win in the stored bracket','a loser is never paid');
select throws_ok($q$insert into kut.midweek_rewards(tournament_id,round_no,user_id,match_id,bye,amount,ledger_id)
  select tournament_id, 2, winner_user_id, id, bye, 50, gen_random_uuid()
  from kut.midweek_matches where tournament_id = '00000096-0000-4000-8000-000000000505' and round = 1 limit 1$q$,
  '23514',NULL,'a win pays only in its own round');

-- The runner-up is disabled between the lock and the payout.
select set_config('kut_test.runner_up', (select (case winner_side when 0 then side_1_user_id else side_0_user_id end)::text
  from kut.midweek_matches where tournament_id = '00000096-0000-4000-8000-000000000505' and round = 4), true);
update kut.profiles set is_disabled = true where id = current_setting('kut_test.runner_up')::uuid;

set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run_3', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);
select is((current_setting('kut_test.run_3')::jsonb->>'completed')::int,1,'the next call pays T5');
select is((select count(*)::int from kut.midweek_rewards where tournament_id = '00000096-0000-4000-8000-000000000505'
  and user_id = current_setting('kut_test.runner_up')::uuid),0,'a member disabled since the lock is not paid');
select is((select count(*)::int from kut.user_notifications where reference_id = '00000096-0000-4000-8000-000000000505'
  and user_id = current_setting('kut_test.runner_up')::uuid),0,'and gets no message');
select is((select count(*)::int from kut.midweek_rewards where tournament_id = '00000096-0000-4000-8000-000000000505'),
  (select count(*)::int from kut.midweek_matches where tournament_id = '00000096-0000-4000-8000-000000000505'
     and winner_user_id <> current_setting('kut_test.runner_up')::uuid),
  'every other win is paid');
select is((select sum(r.amount)::int from kut.midweek_rewards r join kut.midweek_matches final
  on final.tournament_id = r.tournament_id and final.round = 4 and final.winner_user_id = r.user_id
  where r.tournament_id = '00000096-0000-4000-8000-000000000505'),250,'the champion still collects 250');
select is((select status from kut.midweek_tournaments where id = '00000096-0000-4000-8000-000000000505'),'complete',
  'and the week completes');

-- ---------------------------------------------------------------------------
-- The member's own rewards
-- ---------------------------------------------------------------------------
select set_config('kut_test.member', (select user_id::text from kut.midweek_rewards
  where tournament_id::text like '00000096-%' and user_id <> current_setting('kut_test.runner_up')::uuid
  order by user_id limit 1), true);
select set_config('kut_test.member_rewards', (select string_agg(concat_ws('/', tournament_id, round_no, match_id, bye, amount), ','
  order by tournament_id, round_no) from kut.midweek_rewards where user_id = current_setting('kut_test.member')::uuid), true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('kut_test.member'),true);
select is((select string_agg(concat_ws('/', tournament_id, round_no, match_id, bye, amount), ',' order by tournament_id, round_no)
  from kut.my_midweek_rewards), current_setting('kut_test.member_rewards'),'a member reads every reward of their own');
select ok((select bool_and(r.week_start = t.week_start and r.paid_at is not null) from kut.my_midweek_rewards r
  join kut.midweek_tournaments_public t on t.tournament_id = r.tournament_id),'with the week and when it was paid');
select set_config('request.jwt.claim.sub','00000096-0000-4000-8000-00000000000a',true);
select is((select count(*)::int from kut.my_midweek_rewards),0,'a member never paid reads none, and nobody else''s');
select set_config('request.jwt.claim.sub',current_setting('kut_test.runner_up'),true);
select is((select count(*)::int from kut.my_midweek_rewards),0,'a disabled member reads none of their own');
select set_config('request.jwt.claim.sub','00000096-0000-4000-8000-00000000000b',true);
select is((select count(*)::int from kut.my_midweek_rewards),0,'a JWT with no KUT profile reads none');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select throws_ok($q$select 1 from kut.my_midweek_rewards$q$,'42501',NULL,'anon cannot read rewards');
select throws_ok($q$select 1 from kut.midweek_rewards$q$,'42501',NULL,'anon cannot read the guard table');
reset role;

select * from finish();
rollback;
