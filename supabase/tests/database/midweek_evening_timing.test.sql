-- Midweek Madness 2.0, B1 (20261011000000): the evening's new clock.
-- BUILD_SPEC §44.1, §44.7, §44.11, §44.14; Part L #25; ADR-104.
--
-- Version 2 locks Wednesday 19:55 and starts round r at lock + 5 + 15 × (r − 1)
-- minutes; each event is due when the match clock (0' to 90' over 4:40)
-- reaches it, each shoot-out kick 5 seconds after the one before, and the
-- payout waits for the end of the final. Version 1, which the engine and
-- payout suites keep, is checked here only side by side.
--
-- Every profile outside this file is opted out a year ago, so the field is
-- exactly M1-M9, nine active members with two cards each: 16 slots, 7 byes,
-- four rounds. J is an admin with no card.
--
--   TA  version 2, locked 50:01 ago  -> the final kicked off a second ago: not paid
--   TB  version 2, locked 70 min ago -> the final is over: paid
--   TD  version 1, locked 3 hours ago -> whole matches, paid 120 min after the lock
--   TC  inserted without a version, locks tomorrow -> open, for the views and the rehearsal
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(42);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_column('kut','midweek_tournaments','schedule_version','a week stores the version of its clock');
select has_column('kut','midweek_matches','ends_at','a match stores its end');
select has_column('kut','midweek_match_events','reveal_at','an event stores when it is due');
select hasnt_function('kut','_mm_reveal_at',array['timestamp with time zone','integer'],'the version-less reveal clock is gone');
select function_privs_are('kut','_mm_match_timing',array['jsonb','integer'],'authenticated',array[]::text[],
  'members cannot call the clock directly');
select is((select attname::text from pg_attribute where attrelid='kut.midweek_current'::regclass and attnum>0
  and not attisdropped order by attnum desc limit 1),'schedule_version','midweek_current appends the version last');

-- ---------------------------------------------------------------------------
-- The clock
-- ---------------------------------------------------------------------------
select is(kut._mm_config()#>>'{schedule,current}','2','new weeks open on version 2');
select is(kut._mm_lock_at('2026-10-12'::date),'2026-10-14 17:55:00+00'::timestamptz,'the lock is Wednesday 19:55 in summer time');
select is(kut._mm_lock_at('2026-10-26'::date),'2026-10-28 18:55:00+00'::timestamptz,'and 19:55 in winter time, after the clocks go back');
select is(kut._mm_lock_at('2026-10-26'::date, 1),'2026-10-28 19:00:00+00'::timestamptz,'version 1 still locks at 20:00');
select is(array(select kut._mm_round_start_at('2026-10-14 17:55:00+00'::timestamptz, r, 2) from generate_series(1,5) r),
  array['2026-10-14 18:00:00+00','2026-10-14 18:15:00+00','2026-10-14 18:30:00+00','2026-10-14 18:45:00+00','2026-10-14 19:00:00+00']::timestamptz[],
  'round 1 starts at 20:00 and a round every 15 minutes, the final of five at 21:00');
select throws_ok($q$select kut._mm_schedule(3)$q$,'22023',NULL,'an unknown version is refused');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;

update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000104-0000-4000-8000-0000000000f0','MW Timing Test',date '2024-12-02',true);

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000104-0000-4000-8000-00000000000' || n)::uuid, 'mw104-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['1','2','3','4','5','6','7','8','9','a']) n;
insert into kut.profiles(id,display_name,role,username,is_disabled)
select ('00000104-0000-4000-8000-00000000000' || n)::uuid, 'MW104 ' || upper(n), case when n = 'a' then 'admin' else 'user' end,
  'mw104_' || n, false
from unnest(array['1','2','3','4','5','6','7','8','9','a']) n;

insert into kut.players(id,slug,display_name,archetype)
select ('00000104-0000-4000-8000-00000000010' || n)::uuid, 'mw104-player-' || n, 'MW104 Player ' || n,
  (array['goalkeeper','finisher','speedster','playmaker','defender','all_rounder'])[n]
from generate_series(1,6) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000104-0000-4000-8000-00000000010' || n)::uuid, '00000104-0000-4000-8000-0000000000f0', 50, 0,
  75 - 5 * n, 50, 50, 50, 50, 50, 50, 'silver'
from generate_series(1,6) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000104-0000-4000-8000-00000000020' || n)::uuid, ('00000104-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW104 Live ' || n, true
from generate_series(1,6) n;

-- Member m owns two cards: Players ((m − 1) mod 6) + 1 and (m mod 6) + 1.
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000104-0000-4000-8000-0000000003' || m || k)::uuid,
  ('00000104-0000-4000-8000-00000000020' || (((m - 1 + k) % 6) + 1))::uuid,
  ('00000104-0000-4000-8000-00000000000' || m)::uuid, 'pack'
from generate_series(1,9) m, generate_series(0,1) k;

-- A published session in the football week before each tournament.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at)
select ('00000104-0000-4000-8000-00000000070' || n)::uuid, '00000104-0000-4000-8000-0000000000f0', d, 'other', 'published', now()
from (values (1, date '2025-01-29'), (2, date '2025-02-05'), (3, date '2025-02-19'), (4, date '2025-02-26')) s(n, d);

-- ---------------------------------------------------------------------------
-- The open step names the current version
-- ---------------------------------------------------------------------------
update kut.midweek_config set enabled = true;
select set_config('kut_test.opened', coalesce(kut._mm_open_next()::text, ''), true);
select isnt(current_setting('kut_test.opened'),'','with no week running, the open step opens one');
select ok((select schedule_version = 2 and lock_at = kut._mm_lock_at(week_start, 2)
    and to_char(lock_at at time zone 'Europe/Amsterdam', 'Dy HH24:MI') = 'Wed 19:55'
  from kut.midweek_tournaments where id = current_setting('kut_test.opened')::uuid),
  'the week it opens follows version 2 and locks Wednesday 19:55');
delete from kut.midweek_tournaments where id = current_setting('kut_test.opened')::uuid;

insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash,schedule_version) values
('00000104-0000-4000-8000-0000000005a1', date '2025-02-03', now() - interval '50 minutes 1 second',
  encode(sha256(decode(repeat('ae', 32),'hex')),'hex'), 2),
('00000104-0000-4000-8000-0000000005b1', date '2025-02-10', now() - interval '70 minutes',
  encode(sha256(decode(repeat('be', 32),'hex')),'hex'), 2),
('00000104-0000-4000-8000-0000000005d1', date '2025-02-24', now() - interval '3 hours',
  encode(sha256(decode(repeat('de', 32),'hex')),'hex'), 1);
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash) values
('00000104-0000-4000-8000-0000000005c1', date '2025-03-03', now() + interval '1 day',
  encode(sha256(decode(repeat('ce', 32),'hex')),'hex'));
insert into kut.midweek_tournament_secrets(tournament_id,seed) values
('00000104-0000-4000-8000-0000000005a1', repeat('ae', 32)), ('00000104-0000-4000-8000-0000000005b1', repeat('be', 32)),
('00000104-0000-4000-8000-0000000005c1', repeat('ce', 32)), ('00000104-0000-4000-8000-0000000005d1', repeat('de', 32));

select is((select schedule_version::int from kut.midweek_tournaments where id='00000104-0000-4000-8000-0000000005c1'),2,
  'a week inserted without a version follows version 2');

-- ---------------------------------------------------------------------------
-- The worker: three locks, two completions
-- ---------------------------------------------------------------------------
set local role service_role; set local request.jwt.claim.role = 'service_role';
select set_config('kut_test.run', kut.run_midweek_due(10)::text, true);
reset role; select set_config('request.jwt.claim.role','',true);

select is(current_setting('kut_test.run')::jsonb,'{"locked": 3, "completed": 2, "opened": 0}'::jsonb,
  'one call locks the three due weeks and completes the two whose final is over');
select results_eq($q$select id, status, rounds::int from kut.midweek_tournaments where id::text like '00000104-%' order by week_start$q$,
  $q$values ('00000104-0000-4000-8000-0000000005a1'::uuid,'simulated',4),('00000104-0000-4000-8000-0000000005b1'::uuid,'complete',4),
    ('00000104-0000-4000-8000-0000000005d1'::uuid,'complete',4),('00000104-0000-4000-8000-0000000005c1'::uuid,'open',null::int)$q$,
  'nine entrants play four rounds; the week whose final is still playing is not completed');

-- ---------------------------------------------------------------------------
-- Version 2: every time on the new clock
-- ---------------------------------------------------------------------------
select ok((select bool_and(m.reveal_at = t.lock_at + make_interval(mins => 5 + 15 * (m.round - 1)))
  from kut.midweek_matches m join kut.midweek_tournaments t on t.id = m.tournament_id
  where t.id in ('00000104-0000-4000-8000-0000000005a1','00000104-0000-4000-8000-0000000005b1')),
  'round r starts 5 + 15 × (r − 1) minutes after the lock');
select results_eq($q$select count(*)::int, bool_and(ends_at = reveal_at) from kut.midweek_matches
  where tournament_id='00000104-0000-4000-8000-0000000005a1' and bye$q$,
  $q$values (7, true)$q$,'a bye ends as it starts');
select ok((select bool_and(m.ends_at = m.reveal_at + interval '280 seconds' + interval '5 seconds' * e.after_full_time)
  from kut.midweek_matches m
  cross join lateral (select count(*) filter (where kind <> 'chance') as after_full_time
    from kut.midweek_match_events where match_id = m.id) e
  where m.tournament_id in ('00000104-0000-4000-8000-0000000005a1','00000104-0000-4000-8000-0000000005b1') and not m.bye),
  'a match ends 4:40 after kick-off, plus 5 seconds per shoot-out kick and settling draw');
select ok((select bool_and(e.reveal_at = m.reveal_at + interval '1 millisecond' * (e.minute * 280000 / 90))
  and count(*) > 0
  from kut.midweek_match_events e join kut.midweek_matches m on m.id = e.match_id
  where m.tournament_id in ('00000104-0000-4000-8000-0000000005a1','00000104-0000-4000-8000-0000000005b1') and e.kind = 'chance'),
  'a chance is due when the match clock reaches its minute: 90 minutes over 4:40');
select ok((select bool_and(e.reveal_at = m.reveal_at + interval '280 seconds' + interval '5 seconds' * e.after_full_time)
  from (select event.*, row_number() over (partition by match_id order by seq) as after_full_time
    from kut.midweek_match_events event where kind <> 'chance') e
  join kut.midweek_matches m on m.id = e.match_id
  where m.tournament_id in ('00000104-0000-4000-8000-0000000005a1','00000104-0000-4000-8000-0000000005b1')),
  'each shoot-out kick, and a settling draw, follows 5 seconds after the one before');
select ok((select bool_and(e.reveal_at between m.reveal_at and m.ends_at
    and e.reveal_at >= coalesce(e.previous, m.reveal_at))
  from (select event.*, lag(reveal_at) over (partition by match_id order by seq) as previous
    from kut.midweek_match_events event) e
  join kut.midweek_matches m on m.id = e.match_id
  where m.tournament_id in ('00000104-0000-4000-8000-0000000005a1','00000104-0000-4000-8000-0000000005b1')),
  'events come in their order, between kick-off and the end of their match');
select ok((select bool_and(r.last_end < n.first_start)
  from (select tournament_id, round, max(ends_at) as last_end from kut.midweek_matches group by 1, 2) r
  join (select tournament_id, round, min(reveal_at) as first_start from kut.midweek_matches group by 1, 2) n
    on n.tournament_id = r.tournament_id and n.round = r.round + 1
  where r.tournament_id in ('00000104-0000-4000-8000-0000000005a1','00000104-0000-4000-8000-0000000005b1')),
  'every match ends before the next round starts');
select ok((select t.final_reveal_at = f.ends_at and f.ends_at > f.reveal_at
  from kut.midweek_tournaments t join kut.midweek_matches f on f.tournament_id = t.id and f.round = t.rounds
  where t.id = '00000104-0000-4000-8000-0000000005a1'),
  'final_reveal_at is the end of the final, not its start');

-- ---------------------------------------------------------------------------
-- The payout waits for the end of the final (§44.7)
-- ---------------------------------------------------------------------------
select is(kut._mm_complete_tournament('00000104-0000-4000-8000-0000000005a1'),'not_due',
  'while the final is playing, the week is not completed');
select is((select count(*)::int from kut.midweek_rewards where tournament_id='00000104-0000-4000-8000-0000000005a1'),0,
  'and nobody is paid');
select throws_ok($q$insert into kut.midweek_rewards(tournament_id,round_no,user_id,match_id,bye,amount,ledger_id)
  select tournament_id, round, winner_user_id, id, bye, (kut._mm_round_payouts(4))[round], gen_random_uuid()
  from kut.midweek_matches where tournament_id='00000104-0000-4000-8000-0000000005a1' and round = 1 order by pairing limit 1$q$,
  '55000','Midweek rewards are paid once, when the final is revealed','a reward cannot be written before the final ends');
select is((select seed from kut.midweek_tournaments where id='00000104-0000-4000-8000-0000000005a1'),null,
  'the seed stays secret until the final ends');
select is((select sum(amount)::bigint from kut.midweek_rewards where tournament_id='00000104-0000-4000-8000-0000000005b1'),
  (select sum((kut._mm_round_payouts(4))[round])::bigint from kut.midweek_matches where tournament_id='00000104-0000-4000-8000-0000000005b1'),
  'once the final is over, every win is paid');
select ok((select seed = repeat('be', 32) and final_reveal_at <= now() from kut.midweek_tournaments
  where id='00000104-0000-4000-8000-0000000005b1'),'and the seed is published');

-- ---------------------------------------------------------------------------
-- Version 1, side by side: whole matches, as before
-- ---------------------------------------------------------------------------
select ok((select bool_and(m.reveal_at = t.lock_at + interval '30 minutes' * m.round and m.ends_at = m.reveal_at)
    and t.final_reveal_at = t.lock_at + interval '120 minutes'
  from kut.midweek_matches m join kut.midweek_tournaments t on t.id = m.tournament_id
  where t.id = '00000104-0000-4000-8000-0000000005d1' group by t.final_reveal_at, t.lock_at),
  'a version-1 week reveals round r 30 × r minutes after the lock, and its final ends as it is revealed');
select ok((select bool_and(e.reveal_at = m.reveal_at)
  from kut.midweek_match_events e join kut.midweek_matches m on m.id = e.match_id
  where m.tournament_id = '00000104-0000-4000-8000-0000000005d1'),
  'and every event of it is due at its match''s reveal');

-- ---------------------------------------------------------------------------
-- What members read
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000104-0000-4000-8000-000000000001',true);
select results_eq($q$select tournament_id, schedule_version::int from kut.midweek_current$q$,
  $q$values ('00000104-0000-4000-8000-0000000005c1'::uuid, 2)$q$,'midweek_current carries the open week''s version');
select results_eq($q$select tournament_id, schedule_version::int from kut.midweek_tournaments_public
  where tournament_id::text like '00000104-%' order by week_start$q$,
  $q$values ('00000104-0000-4000-8000-0000000005a1'::uuid, 2),('00000104-0000-4000-8000-0000000005b1'::uuid, 2),
    ('00000104-0000-4000-8000-0000000005d1'::uuid, 1),('00000104-0000-4000-8000-0000000005c1'::uuid, 2)$q$,
  'the tournament list carries each week''s version');
select isnt((select champion_user_id from kut.midweek_tournaments_public where tournament_id='00000104-0000-4000-8000-0000000005a1'),null,
  'matches are still revealed whole at kick-off (§44.9 until ADR-106), so the final''s winner shows while it plays');

-- The rehearsal, on the open week's clock.
select set_config('request.jwt.claim.sub','00000104-0000-4000-8000-00000000000a',true);
select set_config('kut_test.rehearsal', kut.admin_midweek_rehearsal()::text, true);
reset role;
select set_config('request.jwt.claim.sub','',true);
select is(current_setting('kut_test.rehearsal')::jsonb->>'schedule_version','2','the rehearsal says which clock it used');
select ok((select bool_and((r->>'reveal_at')::timestamptz = t.lock_at + make_interval(mins => 5 + 15 * ((r->>'round')::int - 1))
    and (r->>'ends_at')::timestamptz between (r->>'reveal_at')::timestamptz + interval '280 seconds'
      and (r->>'reveal_at')::timestamptz + interval '535 seconds')
    and count(*) = 4
  from jsonb_array_elements(current_setting('kut_test.rehearsal')::jsonb->'by_round') r
  cross join kut.midweek_tournaments t where t.id = '00000104-0000-4000-8000-0000000005c1'),
  'the rehearsal gives each round''s start on the week''s clock, and when its last match ends');

-- ---------------------------------------------------------------------------
-- Part L #25: the clock is fixed once a week locks
-- ---------------------------------------------------------------------------
select throws_ok($q$update kut.midweek_tournaments set schedule_version = 1 where id='00000104-0000-4000-8000-0000000005a1'$q$,
  '55000','a Midweek tournament''s schedule is fixed once it has locked','a locked week keeps its version');
select lives_ok($q$update kut.midweek_tournaments set schedule_version = 1, lock_at = kut._mm_lock_at(week_start, 1)
  where id='00000104-0000-4000-8000-0000000005c1'$q$,'an open week may still move to another clock, as the migration moved the open week');
select throws_ok($q$update kut.midweek_matches set ends_at = ends_at + interval '1 second'
  where tournament_id='00000104-0000-4000-8000-0000000005a1' and round = 4$q$,
  '55000',NULL,'a match''s end is written once');
select throws_ok($q$update kut.midweek_match_events set reveal_at = reveal_at - interval '1 second'
  where match_id in (select id from kut.midweek_matches where tournament_id='00000104-0000-4000-8000-0000000005a1')$q$,
  '55000',NULL,'an event''s time is written once');

select * from finish();
rollback;
