-- The Academy lifecycle (20261024000000, ADR-165, #246 S2).
--
-- The world is design/academy/build/world.mjs, anchored so that its "now"
-- (the week of Mon 1 Feb 2027) is the current football week: the admin RPCs
-- evaluate at today, and the later scenarios pass an explicit future day.
-- Every pre-existing session is moved ten years back first, so the only
-- counted weeks are the world's (no sessions in its two Christmas weeks).
--   p01 Anouk   a regular: every counted week is played
--   p11 Kees    last played 9 Nov: At risk at 10
--   p12 Olaf    last played 26 Oct: retires this week
--   p13 Pim     not since 12 Oct, back on 1 Feb with a credit: a comeback
--   p14 Wout    not since 28 Sep: retired 25 Jan
--   p15 Hidde   injured (unlinked) since 23 Nov: paused
--   p16 Ivo     injured 14 Oct, returned 30 Oct, then away: retires
--   t21 Fenna   three weeks running: promoted this week
--   t22 Jip, t23 Sven (fading), t24 Merel (a week and a credit),
--   t25 Lars (one-off), t26 Noor (two credits the same week, no game yet)
-- Members: A1 admin; B1 owns Kees x2, Olaf, Pim, Wout (listed) and Hidde;
-- B2 owns Ivo; U3-U6 are Midweek entrants.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(94);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_column('kut','players','lifecycle_stage','Players have a stored stage');
select is((select count(*)::int from kut.players where lifecycle_stage <> 'first_team'), 0,
  'every existing Player is founding First Team');
select is((select count(*)::int from kut.player_lifecycle_events), 0,
  'the founding First Team is a stored stage, not a promotion event');
select is((select count(*)::int from kut.player_lifecycle), (select count(*)::int from kut.players),
  'the migration evaluates every Player once');
select table_privs_are('kut','academy_credits','authenticated',array['SELECT'],'members cannot write credits');
select table_privs_are('kut','player_lifecycle_events','anon',array[]::text[],'anon cannot read lifecycle events');
select function_privs_are('kut','_evaluate_lifecycle',array['uuid','date'],'authenticated',array[]::text[],
  'members cannot run the evaluator');
select function_privs_are('kut','admin_register_player',array['text','text','text','text','integer','text','boolean'],
  'anon',array[]::text[],'anon cannot register Players');
select is((select array_agg(attname::text order by attnum desc) from (
    select attname, attnum from pg_attribute where attrelid = 'kut.player_directory'::regclass and attnum > 0
    order by attnum desc limit 2) last_two),
  array['at_risk','lifecycle_stage'], 'the album roster appends the stage and the At risk warning');
select ok((select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'user_notifications_event_type_check') ilike all (array['%player_promoted%','%player_at_risk%','%player_retired%']),
  'the three lifecycle messages are known event types');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
update kut.match_sessions set session_date = session_date - 3640;

create temp table t_clock as select kut._football_week() as n0;
create function pg_temp.wk(p text) returns date language sql stable as
  $$ select (select n0 from t_clock) + (p::date - date '2027-02-01') $$;
create function pg_temp.sess(p text) returns uuid language sql stable as
  $$ select id from kut.match_sessions where season_id = '00000165-0000-4000-8000-0000000000f0'
       and session_date = pg_temp.wk(p) and session_type = 'monday' $$;
create function pg_temp.player(p text) returns uuid language sql stable as
  $$ select id from kut.players where display_name = p $$;
create function pg_temp.attend(p_player text, p_from text, p_to text) returns void language sql as
  $$ insert into kut.attendance(session_id, player_id)
     select session.id, ('00000165-0000-4000-8000-0000000001' || p_player)::uuid
     from kut.match_sessions session
     where session.season_id = '00000165-0000-4000-8000-0000000000f0' and session.session_type = 'monday'
       and session.status = 'published'
       and session.session_date between pg_temp.wk(p_from) and pg_temp.wk(p_to) $$;

insert into kut.seasons(id,name,starts_on,is_active) values
  ('00000165-0000-4000-8000-0000000000f0','Academy World',date '2000-01-03',false);
-- One Monday session a week from 31 Aug, none over Christmas.
insert into kut.match_sessions(season_id,session_date,session_type,status,published_at)
select '00000165-0000-4000-8000-0000000000f0', pg_temp.wk(day::date::text), 'monday', 'published', now()
from generate_series(date '2026-08-31', date '2027-02-01', interval '7 days') day
where day::date not in (date '2026-12-21', date '2026-12-28');

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000165-0000-4000-8000-0000000000' || n)::uuid, 'academy-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['a1','b1','b2','c3','c4','c5','c6']) n;
insert into kut.profiles(id,display_name,role,username)
select ('00000165-0000-4000-8000-0000000000' || n)::uuid, 'Academy ' || upper(n),
  case when n = 'a1' then 'admin' else 'user' end, 'academy_' || n
from unnest(array['a1','b1','b2','c3','c4','c5','c6']) n;

-- ---------------------------------------------------------------------------
-- Before go-live: registration, credits, unlinked injuries; nothing for members
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000b1', true);
select throws_ok($$ select kut.admin_register_player('Tamar K.') $$, '42501', 'admin access required',
  'a member cannot register a Player');

select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000a1', true);
select is(kut.admin_register_player('Tamar K.', 'speedster', null, 'talent', 2, 'trained with us all summer')->>'stage',
  'talent', 'the roster registers a Talent with two credits');
select ok((select not is_collectible from kut.players where id = pg_temp.player('Tamar K.'))
    and not exists (select 1 from kut.card_editions where player_id = pg_temp.player('Tamar K.')),
  'a Talent has no Live edition and is not collectible');
select results_eq($$ select count(*)::int, min(granted_week), bool_and(granted_by = '00000165-0000-4000-8000-0000000000a1'::uuid)
    from kut.academy_credits where player_id = pg_temp.player('Tamar K.') $$,
  $$ values (2, (select n0 from t_clock), true) $$, 'both credits are audited with their grant week and admin');
select throws_ok($$ select kut.admin_register_player('Tamar') $$, 'P0001',
  'a Player with a similar name exists: Tamar K.', 'a similar name is offered instead of a second Player');
select results_eq($$ select display_name from kut.admin_similar_players('  tamar-k ') $$, $$ values ('Tamar K.'::text) $$,
  'the similar-name check ignores case, spaces and punctuation');
select throws_ok($$ select kut.admin_register_player('Ugo New', 'all_rounder', null, 'talent', 3, 'too many') $$,
  '22023', NULL, 'a Talent starts with at most two credits');
select throws_ok($$ select kut.admin_register_player('Ugo New', 'all_rounder', null, 'first_team', 1, 'not for First Team') $$,
  '22023', NULL, 'a First Team Player starts without credits');
select throws_ok($$ select kut.admin_register_player('Ugo New', 'all_rounder', null, 'talent', 1, null) $$,
  '22023', 'credits need a reason of 3-200 characters', 'credits need a reason');
select is(kut.admin_add_player('Bram Direct')->>'stage', 'first_team', 'Add Player stays a direct First Team creation');
select results_eq($$ select player.is_collectible, count(edition.id)::int, max(event.reason), max(event.effective_week)
    from kut.players player
    left join kut.card_editions edition on edition.player_id = player.id and edition.is_live
    left join kut.player_lifecycle_events event on event.player_id = player.id and event.kind = 'promotion'
    where player.id = pg_temp.player('Bram Direct') group by player.is_collectible $$,
  $$ values (true, 1, 'admin'::text, (select n0 from t_clock)) $$, 'Add Player writes an admin promotion event and one Live edition');
select throws_ok(format('select kut.admin_grant_academy_credit(%L, %L)', pg_temp.player('Tamar K.'), 'one more'),
  'P0001', 'a Player holds at most 2 active credits', 'the server caps active credits at two');
select throws_ok(format('select kut.admin_grant_academy_credit(%L, %L)', pg_temp.player('Bram Direct'), 'not a Talent'),
  'P0001', 'credits are for Talents and Retired Players', 'a First Team Player gets no credits');
select lives_ok(format('select kut.admin_start_injury(%L, current_date, null)', pg_temp.player('Tamar K.')),
  'an unlinked Player can be put in injury mode');
select is((select count(*)::int from kut.user_notifications notification
    join kut.injury_periods period on period.id = notification.reference_id
    where period.player_id = pg_temp.player('Tamar K.')), 0, 'an unlinked injury sends no message');
select ok(exists (select 1 from kut.injured_players where player_id = pg_temp.player('Tamar K.')),
  'the plaster cast applies to an unlinked injury');

insert into kut.attendance(session_id, player_id) values (pg_temp.sess('2027-02-01'), pg_temp.player('Tamar K.'));
select kut._evaluate_lifecycle();
select results_eq($$ select player.lifecycle_stage, lifecycle.progress from kut.players player
    join kut.player_lifecycle lifecycle on lifecycle.player_id = player.id where player.id = pg_temp.player('Tamar K.') $$,
  $$ values ('talent'::text, 3) $$, 'before go-live a Talent at progress 3 stays a Talent');
select is((select count(*)::int from kut.user_notifications where event_type like 'player_%'), 0,
  'before go-live no lifecycle message is sent');
select is((select count(*)::int from kut.player_lifecycle where absent_weeks is not null or at_risk), 0,
  'before go-live no First Team clock runs, however long a Player has been away');
select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000b1', true);
select is((select count(*)::int from kut.player_lifecycle_public) + (select count(*)::int from kut.academy_status), 0,
  'before go-live members see no Academy and no go-live');
select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000a1', true);
select results_eq($$ select bool_or(player_id = pg_temp.player('Tamar K.')), bool_or(player_id = pg_temp.player('Bram Direct'))
    from kut.pack_draw_pool() $$, $$ values (false, true) $$, 'packs draw First Team, never a Talent');
set local role authenticated;
select throws_ok(format('update kut.players set lifecycle_stage = %L where id = %L', 'retired', pg_temp.player('Bram Direct')),
  '42501', NULL, 'even an admin cannot write a stage directly');
reset role;

-- ---------------------------------------------------------------------------
-- Go-live, promotion and admin promotion
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000b1', true);
select throws_ok($$ select kut.admin_record_academy_go_live() $$, '42501', 'admin access required',
  'a member cannot record go-live');
select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000a1', true);
select is((kut.admin_record_academy_go_live()->>'go_live_week')::date, (select n0 from t_clock),
  'go-live is always the current football week');
select throws_ok($$ select kut.admin_record_academy_go_live() $$, 'P0001', 'the Academy is already live',
  'go-live is recorded once');
select results_eq($$ select player.lifecycle_stage, player.is_collectible, event.reason, event.effective_week
    from kut.players player join kut.player_lifecycle_events event on event.player_id = player.id and event.kind = 'promotion'
    where player.id = pg_temp.player('Tamar K.') $$,
  $$ values ('first_team'::text, true, 'progress'::text, (select n0 from t_clock)) $$,
  'at go-live a Talent at progress 3 is promoted, from that week');
select ok((select count(*) = 1 from kut.card_editions where player_id = pg_temp.player('Tamar K.') and is_live)
    and exists (select 1 from kut.injured_players where player_id = pg_temp.player('Tamar K.')),
  'promotion creates one Live edition and does not end an injury');
select results_eq($$ select title, body from kut.user_notifications
    where user_id = '00000165-0000-4000-8000-0000000000b2' and event_type = 'player_promoted' $$,
  $$ values ('Tamar K. joins the First Team'::text,
    'Promoted from the Academy with a Live card: Common 30. It''s in packs from today, and has a slot in your album.'::text) $$,
  'every member hears about a promotion');
select is(kut.admin_promote_player(pg_temp.player('Bram Direct'))->>'promoted', 'false',
  'promoting a First Team Player is a no-op');
select is((select count(*)::int from kut.player_lifecycle_events where player_id = pg_temp.player('Bram Direct')), 1,
  'a no-op promotion writes no event, so the clock never resets');
select kut.admin_register_player('Ina Inactive');
select kut.admin_set_player_active(pg_temp.player('Ina Inactive'), false);
select throws_ok(format('select kut.admin_promote_player(%L)', pg_temp.player('Ina Inactive')),
  'P0001', 'reactivate the Player before promoting them', 'admin promotion never reactivates an inactive Player');
select kut.admin_register_player('Tom Talent');
select kut.admin_start_injury(pg_temp.player('Tom Talent'), current_date, null);
select results_eq(format('select (kut.admin_promote_player(%L)->>%L)::boolean', pg_temp.player('Tom Talent'), 'promoted'),
  $$ values (true) $$, 'an admin promotes an injured Talent');
select ok(exists (select 1 from kut.injured_players where player_id = pg_temp.player('Tom Talent')),
  'an admin promotion does not end the injury');
select results_eq($$ select event.reason, notification.body like 'A new Live card: Common 30.%'
    from kut.player_lifecycle_events event
    join kut.user_notifications notification on notification.reference_id = event.id
      and notification.user_id = '00000165-0000-4000-8000-0000000000b1'
    where event.player_id = pg_temp.player('Tom Talent') $$,
  $$ values ('admin'::text, true) $$, 'an admin promotion is audited and announced');

-- ---------------------------------------------------------------------------
-- The world (go-live 19 Oct, now the week of 1 Feb)
-- ---------------------------------------------------------------------------
insert into kut.players(id,slug,display_name,archetype,lifecycle_stage,is_collectible)
select ('00000165-0000-4000-8000-0000000001' || code)::uuid, 'academy-' || code, name, 'all_rounder',
  case when code >= '21' then 'talent' else 'first_team' end, code < '21'
from (values ('01','Anouk B.'),('11','Kees R.'),('12','Olaf G.'),('13','Pim L.'),('14','Wout Y.'),
  ('15','Hidde P.'),('16','Ivo D.'),('21','Fenna L.'),('22','Jip W.'),('23','Sven B.'),('24','Merel T.'),
  ('25','Lars N.'),('26','Noor S.')) world(code, name);
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000165-0000-4000-8000-0000000002' || code)::uuid, ('00000165-0000-4000-8000-0000000001' || code)::uuid,
  'live', 'Academy ' || code || ' Live', true
from unnest(array['01','11','12','13','14','15','16']) code;
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000165-0000-4000-8000-0000000003' || copy)::uuid, ('00000165-0000-4000-8000-0000000002' || code)::uuid,
  ('00000165-0000-4000-8000-0000000000' || owner)::uuid, 'pack'
from (values ('a1','11','b1'),('a2','11','b1'),('b1','12','b1'),('c1','13','b1'),('d1','14','b1'),
  ('e1','15','b1'),('f1','16','b2')) copies(copy, code, owner);
insert into kut.market_listings(id,card_id,seller_id,price,expires_at) values
  ('00000165-0000-4000-8000-000000000401','00000165-0000-4000-8000-0000000003d1','00000165-0000-4000-8000-0000000000b1',
   120, now() + interval '1 day');

select pg_temp.attend('01','2026-08-31','2027-02-01');
select pg_temp.attend('11','2026-08-31','2026-11-09');
select pg_temp.attend('12','2026-08-31','2026-10-26');
select pg_temp.attend('13','2026-08-31','2026-10-12');
select pg_temp.attend('13','2027-02-01','2027-02-01');
select pg_temp.attend('14','2026-08-31','2026-09-28');
select pg_temp.attend('15','2026-08-31','2026-11-16');
select pg_temp.attend('16','2026-08-31','2026-10-12');
select pg_temp.attend('21','2027-01-18','2027-02-01');
select pg_temp.attend('22','2027-01-11','2027-01-11');
select pg_temp.attend('22','2027-02-01','2027-02-01');
select pg_temp.attend('23','2026-11-30','2026-11-30');
select pg_temp.attend('23','2027-01-18','2027-01-18');
select pg_temp.attend('24','2027-01-25','2027-01-25');
select pg_temp.attend('25','2027-01-11','2027-01-11');
-- Ivo's return: a Friday session he played alone, in the week of 26 Oct.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at) values
  ('00000165-0000-4000-8000-000000000701','00000165-0000-4000-8000-0000000000f0',pg_temp.wk('2026-10-30'),'friday','published',now());
insert into kut.attendance(session_id,player_id) values
  ('00000165-0000-4000-8000-000000000701','00000165-0000-4000-8000-000000000116');
insert into kut.injury_periods(player_id,started_on) values
  ('00000165-0000-4000-8000-000000000115', pg_temp.wk('2026-11-23')),
  ('00000165-0000-4000-8000-000000000116', pg_temp.wk('2026-10-12') + 2);
insert into kut.academy_credits(player_id,granted_week,reason) values
  ('00000165-0000-4000-8000-000000000113', pg_temp.wk('2027-02-01'), 'played the cup friendly'),
  ('00000165-0000-4000-8000-000000000124', pg_temp.wk('2027-01-25'), 'trained all week'),
  ('00000165-0000-4000-8000-000000000126', pg_temp.wk('2027-01-25'), 'the summer camp'),
  ('00000165-0000-4000-8000-000000000126', pg_temp.wk('2027-01-25'), 'the summer camp');

create temp table t_copies as
  select (select md5(string_agg(row(id, edition_id, owner_id, burned_at, held_by_offer_id)::text, ',' order by id))
          from kut.user_cards) as cards,
         (select md5(string_agg(row(id, card_id, seller_id, price, status)::text, ',' order by id))
          from kut.market_listings) as listings;

update kut.academy_go_live set week_start = pg_temp.wk('2026-10-19');
select kut._evaluate_lifecycle();

create function pg_temp.state(p_code text) returns table (stage text, absent integer, at_risk boolean, retired date,
  weeks integer, credits integer, visible boolean, fading boolean)
language sql stable as $$
  select player.lifecycle_stage, lifecycle.absent_weeks, lifecycle.at_risk, lifecycle.retired_week,
    cardinality(lifecycle.played_weeks), cardinality(lifecycle.credit_weeks), lifecycle.academy_visible, lifecycle.fading
  from kut.players player join kut.player_lifecycle lifecycle on lifecycle.player_id = player.id
  where player.id = ('00000165-0000-4000-8000-0000000001' || p_code)::uuid $$;

select results_eq($$ select stage, absent, at_risk from pg_temp.state('11') $$, $$ values ('first_team'::text, 10, true) $$,
  'Kees is At risk at 10 counted weeks');
select is((select effective_week from kut.player_lifecycle_events where player_id = '00000165-0000-4000-8000-000000000111'
    and kind = 'at_risk'), pg_temp.wk('2027-01-18'), 'the warning is dated to his 8th absent counted week');
select results_eq($$ select body from kut.user_notifications where user_id = '00000165-0000-4000-8000-0000000000b1'
    and event_type = 'player_at_risk' $$,
  $$ values ('10 counted weeks without a game; at 12 they retire. Your 2 copies stay yours either way, but a Retired card can''t play Midweek.'::text) $$,
  'owners of copies are warned once');
select results_eq($$ select stage, retired from pg_temp.state('12') $$, $$ values ('retired'::text, pg_temp.wk('2027-02-01')) $$,
  'Olaf retires this week, his 12th absent counted week');
select results_eq($$ select stage, retired from pg_temp.state('14') $$, $$ values ('retired'::text, pg_temp.wk('2027-01-25')) $$,
  'absence counts from go-live: Wout retires 12 counted weeks after it');
select results_eq($$ select stage, retired, weeks, credits, visible from pg_temp.state('13') $$,
  $$ values ('retired'::text, pg_temp.wk('2027-01-25'), 1, 1, true) $$,
  'Pim is a visible comeback: a week since retiring plus a credit');
select results_eq($$ select stage, absent, at_risk from pg_temp.state('15') $$, $$ values ('first_team'::text, 0, false) $$,
  'weeks overlapping an unlinked injury do not count as absent');
select results_eq($$ select stage, retired from pg_temp.state('16') $$, $$ values ('retired'::text, pg_temp.wk('2027-02-01')) $$,
  'after an injury return, 12 absent counted weeks retire');
select results_eq($$ select player.lifecycle_stage, player.is_collectible, event.reason, event.effective_week
    from kut.players player join kut.player_lifecycle_events event on event.player_id = player.id
    where player.id = '00000165-0000-4000-8000-000000000121' $$,
  $$ values ('first_team'::text, true, 'progress'::text, pg_temp.wk('2027-02-01')) $$,
  'Fenna is promoted in her third week running');
select results_eq($$ select stage, weeks, visible, fading from pg_temp.state('22') $$, $$ values ('talent'::text, 2, true, false) $$,
  'Jip is in the Academy');
select results_eq($$ select visible, fading from pg_temp.state('23') $$, $$ values (true, true) $$,
  'Sven is fading: his oldest week leaves the window next counted week');
select results_eq($$ select weeks, credits, visible from pg_temp.state('24') $$, $$ values (1, 1, true) $$,
  'Merel counts a week and a credit');
select results_eq($$ select weeks, visible from pg_temp.state('25') $$, $$ values (1, false) $$,
  'a one-off visitor is never visible');
select results_eq($$ select stage, weeks, credits, visible from pg_temp.state('26') $$, $$ values ('talent'::text, 0, 2, true) $$,
  'two credits granted together count as two');
select results_eq($$ select player.display_name, notification.body from kut.user_notifications notification
    join kut.player_lifecycle_events event on event.id = notification.reference_id
    join kut.players player on player.id = event.player_id
    where notification.user_id = '00000165-0000-4000-8000-0000000000b1' and notification.event_type = 'player_retired'
    order by player.display_name $$,
  $$ values ('Olaf G.'::text, '12 counted weeks without a game. Your copy stays yours to keep or trade, but can''t play Midweek. A comeback brings it back.'::text),
            ('Pim L.', '12 counted weeks without a game. Your copy stays yours to keep or trade, but can''t play Midweek. A comeback brings it back.'),
            ('Wout Y.', '12 counted weeks without a game. Your copy stays yours to keep or trade, but can''t play Midweek. A comeback brings it back.') $$,
  'owners of copies hear about each retirement');
select is((select count(*)::int from kut.user_notifications where user_id = '00000165-0000-4000-8000-0000000000b2'
    and event_type = 'player_retired'), 1, 'Ivo''s owner hears about his retirement');
select results_eq($$ select bool_or(player_id in ('00000165-0000-4000-8000-000000000112','00000165-0000-4000-8000-000000000113',
      '00000165-0000-4000-8000-000000000114','00000165-0000-4000-8000-000000000116')),
    bool_or(player_id = '00000165-0000-4000-8000-000000000121'), bool_or(player_id = '00000165-0000-4000-8000-000000000111'),
    bool_or(player_id in (select id from kut.players where lifecycle_stage = 'talent'))
  from kut.pack_draw_pool() $$, $$ values (false, true, true, false) $$,
  'packs leave out Retired Players and Talents, and keep the promoted and the warned');

create temp table t_counts as select (select count(*) from kut.player_lifecycle_events) as events,
  (select count(*) from kut.user_notifications) as messages;
select kut._evaluate_lifecycle();
select kut._evaluate_lifecycle();
select results_eq($$ select count(*) from kut.player_lifecycle_events union all select count(*) from kut.user_notifications $$,
  $$ select events from t_counts union all select messages from t_counts $$,
  're-evaluation creates no duplicate events or messages');

select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000b1', true);
select results_eq($$ select display_name from kut.player_lifecycle_public
    where lifecycle_stage <> 'first_team' and academy_visible order by display_name $$,
  $$ values ('Jip W.'::text), ('Merel T.'), ('Noor S.'), ('Pim L.'), ('Sven B.') $$,
  'members see the Academy from go-live: visible Talents and comebacks');
select results_eq($$ select display_name, kind from kut.player_lifecycle_events_public
    where player_id::text like '00000165-%' order by display_name, kind $$,
  $$ values ('Fenna L.'::text, 'promotion'::text), ('Ivo D.', 'retirement'), ('Olaf G.', 'retirement'),
            ('Pim L.', 'retirement'), ('Wout Y.', 'retirement') $$,
  'the Chronicle''s roster lists promotions and retirements, not warnings');
select results_eq($$ select display_name, lifecycle_stage, at_risk from kut.player_directory
    where id in ('00000165-0000-4000-8000-000000000111','00000165-0000-4000-8000-000000000112') order by display_name $$,
  $$ values ('Kees R.'::text, 'first_team'::text, true), ('Olaf G.', 'retired', false) $$,
  'the album roster carries the stage and the warning');
select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000a1', true);
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000165-0000-4000-8000-0000000001' || code)::uuid, season.id, 50, 0, 50, 50, 50, 50, 50, 50, 50, 'silver'
from unnest(array['11','12']) code, kut.seasons season where season.is_active;
select results_eq($$ select display_name from kut.public_live_ratings
    where id in ('00000165-0000-4000-8000-000000000111','00000165-0000-4000-8000-000000000112') $$,
  $$ values ('Kees R.'::text) $$, 'Retired Players leave the rating list');
select ok(pg_get_viewdef('kut.top_risers'::regclass) ilike '%lifecycle_stage <> ''retired''%', 'and Home''s risers');

-- Corrections: removing the cause undoes a retirement; restoring it revives it.
insert into kut.attendance(session_id, player_id) values (pg_temp.sess('2027-01-18'), '00000165-0000-4000-8000-000000000112');
select kut._evaluate_lifecycle();
select results_eq($$ select (select stage from pg_temp.state('12')), (select absent from pg_temp.state('12')),
    (select undone_at is not null from kut.player_lifecycle_events where player_id = '00000165-0000-4000-8000-000000000112' and kind = 'retirement') $$,
  $$ values ('first_team'::text, 2, true) $$, 'a correction that removes the cause of a retirement undoes it');
delete from kut.attendance where session_id = pg_temp.sess('2027-01-18') and player_id = '00000165-0000-4000-8000-000000000112';
select kut._evaluate_lifecycle();
select results_eq($$ select count(*)::int, bool_and(undone_at is null), (select stage from pg_temp.state('12'))
    from kut.player_lifecycle_events where player_id = '00000165-0000-4000-8000-000000000112' and kind = 'retirement' $$,
  $$ values (1, true, 'retired'::text) $$, 'restoring the cause revives the same retirement');
select is((select count(*)::int from kut.user_notifications notification
    join kut.player_lifecycle_events event on event.id = notification.reference_id
    where event.player_id = '00000165-0000-4000-8000-000000000112' and notification.event_type = 'player_retired'), 1,
  'a revived retirement sends no second message');

-- Cancelling the injury return (the RPC, so through rebuild_season) re-pauses Ivo.
select kut.cancel_published_session('00000165-0000-4000-8000-000000000701', 'logged on the wrong day');
select results_eq($$ select (select stage from pg_temp.state('16')), (select absent from pg_temp.state('16')),
    (select undone_at is not null from kut.player_lifecycle_events where player_id = '00000165-0000-4000-8000-000000000116' and kind = 'retirement') $$,
  $$ values ('first_team'::text, 0, true) $$, 'with the return cancelled, the injury covers every week again');

-- An admin brings back a Retired Player.
select results_eq(format('select (kut.admin_promote_player(%L)->>%L)::boolean', '00000165-0000-4000-8000-000000000114', 'promoted'),
  $$ values (true) $$, 'an admin brings back a Retired Player');
select results_eq($$ select (select stage from pg_temp.state('14')), lifecycle.clock_start, lifecycle.absent_weeks, lifecycle.promoted_week
    from kut.player_lifecycle lifecycle where player_id = '00000165-0000-4000-8000-000000000114' $$,
  $$ values ('first_team'::text, (select n0 from t_clock), 0, (select n0 from t_clock)) $$, 'the clock runs from the promotion');
select results_eq($$ select array_agg(id) from kut.card_editions where player_id = '00000165-0000-4000-8000-000000000114' $$,
  $$ values (array['00000165-0000-4000-8000-000000000214'::uuid]) $$, 'a return reuses the single Live edition');
select results_eq($$ select title, body like 'Out of retirement with the same Live card:%' from kut.user_notifications
    where user_id = '00000165-0000-4000-8000-0000000000b1' and event_type = 'player_promoted' and title like 'Wout%' $$,
  $$ values ('Wout Y. is back in the First Team'::text, true) $$, 'a return is announced as a comeback');
select results_eq($$ select (select cards from t_copies), (select listings from t_copies) $$,
  $$ select md5(string_agg(row(id, edition_id, owner_id, burned_at, held_by_offer_id)::text, ',' order by id)),
       (select md5(string_agg(row(id, card_id, seller_id, price, status)::text, ',' order by id)) from kut.market_listings)
     from kut.user_cards $$,
  'no lifecycle change minted, burned, moved or froze a copy, or touched a listing');

-- ---------------------------------------------------------------------------
-- Supply: starter grants, account resets and rotation
-- ---------------------------------------------------------------------------
update kut.players set is_active = false
where id not in ('00000165-0000-4000-8000-000000000101','00000165-0000-4000-8000-000000000111',
  '00000165-0000-4000-8000-000000000115','00000165-0000-4000-8000-000000000112','00000165-0000-4000-8000-000000000113',
  '00000165-0000-4000-8000-000000000122');
select results_eq($$ select array_agg(edition_id order by edition_id)
    from jsonb_array_elements_text(kut.grant_starter_pack('00000165-0000-4000-8000-0000000000c3')->'edition_ids') edition_id(text_id)
    cross join lateral (select text_id::uuid as edition_id) id $$,
  $$ values (array['00000165-0000-4000-8000-000000000201','00000165-0000-4000-8000-000000000211',
    '00000165-0000-4000-8000-000000000215']::uuid[]) $$, 'a starter grant draws only active First Team');
select kut.admin_reset_account('00000165-0000-4000-8000-0000000000b2', '00000165-0000-4000-8000-000000000999');
select results_eq($$ select array_agg(edition.player_id order by edition.player_id) from kut.user_cards card
    join kut.card_editions edition on edition.id = card.edition_id
    where card.owner_id = '00000165-0000-4000-8000-0000000000b2' and card.burned_at is null $$,
  $$ values (array['00000165-0000-4000-8000-000000000101','00000165-0000-4000-8000-000000000111',
    '00000165-0000-4000-8000-000000000115']::uuid[]) $$, 'an account reset regrants only active First Team');
select ok(not exists (
    select 1 from jsonb_array_elements(kut._mm_rotate_archetypes(decode(repeat('ac',32),'hex'))) change
    where (change->>'playerId')::uuid not in ('00000165-0000-4000-8000-000000000101','00000165-0000-4000-8000-000000000111',
      '00000165-0000-4000-8000-000000000115')),
  'archetype rotation leaves out Retired Players and Talents');
update kut.players set is_active = true where id::text like '00000165-%' and display_name <> 'Ina Inactive';

-- ---------------------------------------------------------------------------
-- Midweek: Retired cards don't play
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
where id not in ('00000165-0000-4000-8000-0000000000b1','00000165-0000-4000-8000-0000000000c3',
  '00000165-0000-4000-8000-0000000000c4','00000165-0000-4000-8000-0000000000c5','00000165-0000-4000-8000-0000000000c6')
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;
delete from kut.user_cards where owner_id = '00000165-0000-4000-8000-0000000000c3';
insert into kut.user_cards(id,edition_id,owner_id,source) values
  ('00000165-0000-4000-8000-0000000003c3', '00000165-0000-4000-8000-000000000201', '00000165-0000-4000-8000-0000000000c3', 'pack'),
  ('00000165-0000-4000-8000-0000000003c4', '00000165-0000-4000-8000-000000000213', '00000165-0000-4000-8000-0000000000c4', 'pack'),
  ('00000165-0000-4000-8000-0000000003c5', '00000165-0000-4000-8000-000000000215', '00000165-0000-4000-8000-0000000000c5', 'pack');
insert into kut.user_cards(id,edition_id,owner_id,source)
select '00000165-0000-4000-8000-0000000003c6', edition.id, '00000165-0000-4000-8000-0000000000c6', 'pack'
from kut.card_editions edition where edition.player_id = pg_temp.player('Tamar K.') and edition.is_live;
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash) values
  ('00000165-0000-4000-8000-000000000501', (select n0 from t_clock) + 7, now() + interval '1 day',
   encode(sha256(decode(repeat('5a',32),'hex')),'hex'));
insert into kut.midweek_tournament_secrets(tournament_id,seed) values ('00000165-0000-4000-8000-000000000501', repeat('5a',32));

select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000b1', true);
select throws_ok($$ select kut.save_midweek_squad(array['00000165-0000-4000-8000-0000000003b1'::uuid]) $$,
  '22023', 'a Retired card can''t play Midweek', 'saving a squad rejects a Retired pick');
-- A pick saved while Olaf was First Team, by a client that missed his retirement.
update kut.players set lifecycle_stage = 'first_team' where id = '00000165-0000-4000-8000-000000000112';
select kut.save_midweek_squad(array['00000165-0000-4000-8000-0000000003b1','00000165-0000-4000-8000-0000000003a1']::uuid[]);
update kut.players set lifecycle_stage = 'retired' where id = '00000165-0000-4000-8000-000000000112';
select set_config('request.jwt.claim.sub', '00000165-0000-4000-8000-0000000000a1', true);

select results_eq($$ select (entrant->>'userId')::uuid from jsonb_array_elements(
    kut._mm_field('00000165-0000-4000-8000-000000000501', now())->'entrants') entrant order by 1 $$,
  $$ values ('00000165-0000-4000-8000-0000000000b1'::uuid), ('00000165-0000-4000-8000-0000000000c3'),
            ('00000165-0000-4000-8000-0000000000c5'), ('00000165-0000-4000-8000-0000000000c6') $$,
  'a member with only Retired cards is not entered');
select results_eq($$ select (select array_agg(card->>'cardId' order by card->>'cardId') from jsonb_array_elements(entrant->'saved') card),
      exists (select 1 from jsonb_array_elements(entrant->'owned') card where card->>'playerId' in
        ('00000165-0000-4000-8000-000000000112','00000165-0000-4000-8000-000000000113'))
    from jsonb_array_elements(kut._mm_field('00000165-0000-4000-8000-000000000501', now())->'entrants') entrant
    where entrant->>'userId' = '00000165-0000-4000-8000-0000000000b1' $$,
  $$ values (array['00000165-0000-4000-8000-0000000003a1'], false) $$,
  'the lock drops a Retired saved pick and Retired cards from a mixed collection');
select results_eq($$ select warning->>'message' from jsonb_array_elements(
    kut._mm_field('00000165-0000-4000-8000-000000000501', now())->'warnings') warning $$,
  $$ values ('Academy B1: the card saved in slot 1 is no longer available for Midweek, so a trialist plays'::text) $$,
  'the warning says the card is no longer available for Midweek, not gone');
update kut.midweek_tournaments set lock_at = now() - interval '10 minutes' where id = '00000165-0000-4000-8000-000000000501';
select is(kut._mm_lock_tournament('00000165-0000-4000-8000-000000000501'), 'simulated', 'the week locks with four entrants');
select results_eq($$ select slot::int, trialist, player_id from kut.midweek_entry_cards
    where tournament_id = '00000165-0000-4000-8000-000000000501' and user_id = '00000165-0000-4000-8000-0000000000b1' and slot < 2
    order by slot $$,
  $$ values (0, false, '00000165-0000-4000-8000-000000000111'::uuid), (1, true, null::uuid) $$,
  'the surviving pick moves up and a trialist fills the tail');
create temp table t_entries as select md5(string_agg(row(user_id, slot, card_id, player_id, ovr)::text, ',' order by user_id, slot)) as h
  from kut.midweek_entry_cards where tournament_id = '00000165-0000-4000-8000-000000000501';
update kut.players set lifecycle_stage = 'retired' where id in (pg_temp.player('Kees R.'), pg_temp.player('Tamar K.'));
select is((select md5(string_agg(row(user_id, slot, card_id, player_id, ovr)::text, ',' order by user_id, slot))
    from kut.midweek_entry_cards where tournament_id = '00000165-0000-4000-8000-000000000501'), (select h from t_entries),
  'a retirement after the lock never changes the stored field or its OVRs');
select is(kut._mm_simulate(decode(repeat('5a',32),'hex'),
    kut._mm_field('00000165-0000-4000-8000-000000000501', now())->'entrants')->>'status', 'skipped',
  'a field that falls below four through retirements is skipped');

-- ---------------------------------------------------------------------------
-- After this week: a single appearance, a comeback, its cancellation and a
-- second retirement (explicit days; no RPC from here on)
-- ---------------------------------------------------------------------------
insert into kut.match_sessions(season_id,session_date,session_type,status,published_at)
select '00000165-0000-4000-8000-0000000000f0', pg_temp.wk(day::date::text), 'monday', 'published', now()
from generate_series(date '2027-02-08', date '2027-05-03', interval '7 days') day;
select pg_temp.attend(code, '2027-02-08', '2027-02-08') from unnest(array['12','13','26']) code;
select pg_temp.attend('01', '2027-02-08', '2027-05-03');
select kut._evaluate_lifecycle(null, pg_temp.wk('2027-02-08') + 2);

select results_eq($$ select stage, weeks, visible from pg_temp.state('12') $$, $$ values ('retired'::text, 1, false) $$,
  'after retiring, a single appearance only builds comeback progress');
select results_eq($$ select event.reason, event.effective_week, notification.title from kut.player_lifecycle_events event
    join kut.user_notifications notification on notification.reference_id = event.id
      and notification.user_id = '00000165-0000-4000-8000-0000000000b1'
    where event.player_id = '00000165-0000-4000-8000-000000000113' and event.kind = 'promotion' $$,
  $$ values ('progress'::text, pg_temp.wk('2027-02-08'), 'Pim L. is back in the First Team'::text) $$,
  'Pim''s comeback is a new promotion by the same rule');
select results_eq($$ select (select stage from pg_temp.state('26')), count(edition.id)::int from kut.card_editions edition
    where edition.player_id = '00000165-0000-4000-8000-000000000126' $$,
  $$ values ('first_team'::text, 1) $$, 'a Talent with two credits is promoted at their first appearance');
select is((select count(*)::int from kut.card_editions where player_id = '00000165-0000-4000-8000-000000000113'), 1,
  'a comeback reuses the existing Live edition');

update kut.match_sessions set status = 'cancelled', published_at = null, cancelled_at = now(), cancellation_reason = 'rained off'
where id = pg_temp.sess('2027-02-08');
select kut._evaluate_lifecycle(null, pg_temp.wk('2027-02-08') + 2);
select results_eq($$ select stage, (select promoted_week from kut.player_lifecycle where player_id = '00000165-0000-4000-8000-000000000113')
    from pg_temp.state('13') $$,
  $$ values ('first_team'::text, pg_temp.wk('2027-02-08')) $$, 'cancelling the comeback session never undoes a promotion');

select kut._evaluate_lifecycle(null, pg_temp.wk('2027-05-03') + 2);
select results_eq($$ select stage, retired, (select count(*)::int from kut.player_lifecycle_events
      where player_id = '00000165-0000-4000-8000-000000000113' and kind = 'retirement' and undone_at is null)
    from pg_temp.state('13') $$,
  $$ values ('retired'::text, pg_temp.wk('2027-05-03'), 2) $$, '12 counted weeks after the comeback, Pim retires again');
select is((select count(distinct reference_id)::int from kut.user_notifications notification
    join kut.player_lifecycle_events event on event.id = notification.reference_id
    where event.player_id = '00000165-0000-4000-8000-000000000113' and notification.event_type = 'player_retired'
      and notification.user_id = '00000165-0000-4000-8000-0000000000b1'), 2,
  'a second retirement is a new event with its own message');

select * from finish();
rollback;
