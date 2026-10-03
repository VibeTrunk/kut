-- Midweek Madness 2.0, C2 (20261016000000): balanced squads beat All-rounders.
-- BUILD_SPEC §44.3, §44.4, §44.5, §44.14; ADR-116.
--
-- The plusses table is the engine's input, the four outfielders' plusses are
-- added up per line, and every plus a line falls short of three costs the
-- squad ×0.88. The golden-vector parity suite pins the engine draw for draw;
-- this file checks the table, the rule and what the lock step stores.
--
-- Every profile outside this file is opted out a year ago, so the field is
-- exactly B1-B4:
--   B1  saves a Goalkeeper and four Finishers: defence three short.
--   B2  saves a Goalkeeper, Defender, Playmaker, Tank and Speedster: no line short.
--   B3, B4 save nothing: auto squads.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(23);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_column('kut','midweek_entries','balance_ppm','an entry stores the balance its squad played with');
select col_is_null('kut','midweek_entries','balance_ppm','null for weeks locked before the rule');
select function_privs_are('kut','_mm_balance',array['text[]','integer'],'authenticated',array[]::text[],
  'members cannot call the rule directly');
select function_privs_are('kut','_mm_balance',array['text[]','integer'],'anon',array[]::text[],
  'anon cannot call the rule');
select is((select attname::text from pg_attribute where attrelid='kut.midweek_entries_public'::regclass
    and attnum = (select max(attnum) from pg_attribute where attrelid='kut.midweek_entries_public'::regclass and attnum > 0)),
  'balance_ppm','midweek_entries_public appends balance_ppm after the existing columns');

-- ---------------------------------------------------------------------------
-- The table and the rule
-- ---------------------------------------------------------------------------
select is(kut._mm_config()#>'{shape,plusses}',
  '{"all_rounder":[1,1,1],"speedster":[2,2,0],"finisher":[3,1,0],"playmaker":[1,3,0],"defender":[0,1,3],"tank":[0,2,2],"goalkeeper":[0,0,3]}'::jsonb,
  'the plusses table members see is the one the engine reads');
select ok((select bool_and(case when key = 'all_rounder' or key = 'goalkeeper' then total = 3 else total = 4 end)
    from (select key, (value->>0)::int + (value->>1)::int + (value->>2)::int as total
      from jsonb_each(kut._mm_config()#>'{shape,plusses}')) t),
  'an All-rounder carries three plusses and every outfield specialist four');
select is((select jsonb_build_array(att_ppm, mid_ppm, def_ppm) from kut._mm_lines('all_rounder')),
  '[1000000,1000000,1000000]'::jsonb,'an All-rounder is average in every line');
select is((select jsonb_build_array(att_ppm, mid_ppm, def_ppm) from kut._mm_lines('finisher')),
  '[2000000,1000000,200000]'::jsonb,'a Finisher reads three attack plusses, one midfield, none in defence');
select is((select jsonb_build_array(att_ppm, mid_ppm, def_ppm) from kut._mm_lines('tank')),
  '[500000,1500000,1800000]'::jsonb,'a Tank reads two midfield and two defence plusses');
select throws_ok($q$select * from kut._mm_lines('libero')$q$,'22023',NULL,'an unknown archetype is refused');

select is(kut._mm_balance(array['all_rounder','all_rounder','all_rounder','all_rounder','all_rounder'], 0),
  '{"lines":[4,4,4],"short":[0,0,0],"balancePpm":1000000}'::jsonb,'four All-rounders meet the rule');
select is(kut._mm_balance(array['goalkeeper','finisher','finisher','finisher','finisher'], 0),
  '{"lines":[12,4,0],"short":[0,0,3],"balancePpm":681472}'::jsonb,
  'four Finishers are three short in defence: ×0.88 three times, floored each step');
select is(kut._mm_balance(array['speedster','playmaker','goalkeeper','defender','tank'], 2)->'lines',
  '[3,8,5]'::jsonb,'the keeper''s own plusses never count, whatever its slot');
select throws_ok($q$select kut._mm_balance(array['goalkeeper','libero'], 0)$q$,'22023',NULL,
  'an unknown archetype in a squad is refused');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;

update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000116-0000-4000-8000-0000000000f0','MW Balance Test',date '2024-12-02',true);

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000116-0000-4000-8000-00000000000' || n)::uuid, 'mw116-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from generate_series(1,4) n;
insert into kut.profiles(id,display_name,role,username,is_disabled)
select ('00000116-0000-4000-8000-00000000000' || n)::uuid, 'MW116 B' || n, 'user', 'mw116_' || n, false
from generate_series(1,4) n;

-- Players 1-9: a Goalkeeper, four Finishers, a Defender, a Playmaker, a Tank, a Speedster.
insert into kut.players(id,slug,display_name,archetype)
select ('00000116-0000-4000-8000-00000000010' || n)::uuid, 'mw116-player-' || n, 'MW116 Player ' || n,
  (array['goalkeeper','finisher','finisher','finisher','finisher','defender','playmaker','tank','speedster'])[n]
from generate_series(1,9) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000116-0000-4000-8000-00000000010' || n)::uuid, '00000116-0000-4000-8000-0000000000f0', 50, 0,
  60, 50, 50, 50, 50, 50, 50, 'silver'
from generate_series(1,9) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000116-0000-4000-8000-00000000020' || n)::uuid, ('00000116-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW116 Live ' || n, true
from generate_series(1,9) n;
-- Every member owns one card of every Player.
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000116-0000-4000-8000-000000003' || m || '0' || p)::uuid,
  ('00000116-0000-4000-8000-00000000020' || p)::uuid,
  ('00000116-0000-4000-8000-00000000000' || m)::uuid, 'pack'
from generate_series(1,4) m, generate_series(1,9) p;

-- A published session in the football week before the tournament.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at) values
('00000116-0000-4000-8000-000000000701', '00000116-0000-4000-8000-0000000000f0', date '2025-01-29', 'other', 'published', now());

insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash) values
('00000116-0000-4000-8000-0000000005a1', date '2025-02-03', now() + interval '1 hour',
  encode(sha256(decode(repeat('b6', 32),'hex')),'hex'));
insert into kut.midweek_tournament_secrets(tournament_id,seed) values
('00000116-0000-4000-8000-0000000005a1', repeat('b6', 32));

-- B1: a Goalkeeper and four Finishers; B2: a Goalkeeper and one of each other kind.
insert into kut.midweek_squads(id,tournament_id,user_id)
select ('00000116-0000-4000-8000-00000000060' || m)::uuid, '00000116-0000-4000-8000-0000000005a1',
  ('00000116-0000-4000-8000-00000000000' || m)::uuid
from generate_series(1,2) m;
insert into kut.midweek_squad_cards(squad_id,slot,card_id,player_id)
select ('00000116-0000-4000-8000-00000000060' || m)::uuid, slot,
  ('00000116-0000-4000-8000-000000003' || m || '0' || p)::uuid, ('00000116-0000-4000-8000-00000000010' || p)::uuid
from (values (1,1,1),(1,2,2),(1,3,3),(1,4,4),(1,5,5),
             (2,1,1),(2,2,6),(2,3,7),(2,4,8),(2,5,9)) picks(m, slot, p);

-- ---------------------------------------------------------------------------
-- The lock step stores the balance the engine played with
-- ---------------------------------------------------------------------------
update kut.midweek_tournaments set lock_at = now() - interval '1 minute'
where id = '00000116-0000-4000-8000-0000000005a1';
select is(kut._mm_lock_tournament('00000116-0000-4000-8000-0000000005a1'),'simulated','the week locks and is simulated');

select is((select balance_ppm from kut.midweek_entries
    where tournament_id = '00000116-0000-4000-8000-0000000005a1' and user_id = '00000116-0000-4000-8000-000000000001'),
  681472,'the one-line stack plays at ×0.88 for each of its three missing defence plusses');
select is((select balance_ppm from kut.midweek_entries
    where tournament_id = '00000116-0000-4000-8000-0000000005a1' and user_id = '00000116-0000-4000-8000-000000000002'),
  1000000,'the balanced five plays at full strength');
select is((select count(*)::int from kut.midweek_entries
    where tournament_id = '00000116-0000-4000-8000-0000000005a1' and balance_ppm is not null),
  4,'every entry of a week locked on the rule stores its balance, auto squads included');
select ok((select bool_and(entry.balance_ppm = (kut._mm_balance(array(
      select card.archetype from kut.midweek_entry_cards card
      where card.tournament_id = entry.tournament_id and card.user_id = entry.user_id order by card.slot),
      entry.keeper_slot)->>'balancePpm')::int)
    from kut.midweek_entries entry where entry.tournament_id = '00000116-0000-4000-8000-0000000005a1'),
  'each stored balance follows from the stored archetypes and keeper');
select is((select array_agg(distinct (def_ppm, archetype)::text order by (def_ppm, archetype)::text) from kut.midweek_entry_cards
    where tournament_id = '00000116-0000-4000-8000-0000000005a1' and user_id = '00000116-0000-4000-8000-000000000001'),
  array['(200000,finisher)','(2600000,goalkeeper)']::text[],
  'the stored lines come from the plusses');
select ok((select bool_and(win_chance_ppm < 500000) from kut.midweek_matches m
    where m.tournament_id = '00000116-0000-4000-8000-0000000005a1' and not m.bye
      and m.side_0_user_id = '00000116-0000-4000-8000-000000000001'
      and m.side_1_user_id = '00000116-0000-4000-8000-000000000002')
  or not exists (select 1 from kut.midweek_matches m
    where m.tournament_id = '00000116-0000-4000-8000-0000000005a1' and not m.bye
      and m.side_0_user_id = '00000116-0000-4000-8000-000000000001'
      and m.side_1_user_id = '00000116-0000-4000-8000-000000000002'),
  'when the stack meets the balanced five, the published odds favour the balanced five');

-- ---------------------------------------------------------------------------
-- What members read
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000116-0000-4000-8000-000000000003';
select is((select array_agg(distinct balance_ppm order by balance_ppm) from kut.midweek_entries_public
    where tournament_id = '00000116-0000-4000-8000-0000000005a1'
      and user_id in ('00000116-0000-4000-8000-000000000001','00000116-0000-4000-8000-000000000002')),
  array[681472,1000000],'a member reads each squad''s balance from the lock');
reset role;

select * from finish();
rollback;
