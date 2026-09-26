-- Midweek Madness: the launch switch through the API (20261007000000, KB-024).
-- BUILD_SPEC §44.8; ADR-095.
--
-- PostgREST connects as `authenticator`, which preloads safeupdate: an UPDATE
-- or DELETE without a WHERE fails there (21000) and nowhere else. pgTAP runs as
-- postgres and cannot load it, so this file pins the rule itself for every
-- kut function, and tests/integration/midweek-switch.test.ts calls the switch
-- as authenticator.
--
-- Personas: A -- an admin; B -- an ordinary member.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(8);

-- Every UPDATE and DELETE in a kut function names its rows. Statements are
-- split at semicolons after comments are removed; an ON CONFLICT ... DO UPDATE
-- is an INSERT, which safeupdate does not check, and the pattern skips it.
select is(
  array(
    select distinct p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral regexp_split_to_table(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), ';') stmt
    where n.nspname = 'kut'
      and p.prolang in (select oid from pg_language where lanname in ('sql', 'plpgsql'))
      and stmt ~* '(\mupdate\s+(only\s+)?[a-z_][a-z0-9_.]*(\s+(as\s+)?[a-z_][a-z0-9_]*)?\s+set\M|\mdelete\s+from\M)'
      and stmt !~* '\mwhere\M'
    order by 1),
  array[]::text[],
  'no kut function updates or deletes without a WHERE (safeupdate, KB-024)');

select function_privs_are('kut','admin_set_midweek_enabled',array['boolean'],'anon',array[]::text[],
  'anon cannot flip the switch');

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000124-0000-4000-8000-00000000000' || n)::uuid, 'kb24-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['a','b']) n;
insert into kut.profiles(id,display_name,role,username,is_disabled)
select ('00000124-0000-4000-8000-00000000000' || n)::uuid, 'KB24 ' || upper(n), case when n = 'a' then 'admin' else 'user' end,
  'kb24_' || n, false
from unnest(array['a','b']) n;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000124-0000-4000-8000-00000000000b',true);
select throws_ok($q$select kut.admin_set_midweek_enabled(true)$q$,'42501',NULL,'a member cannot flip the switch');

select set_config('request.jwt.claim.sub','00000124-0000-4000-8000-00000000000a',true);
select throws_ok($q$select kut.admin_set_midweek_enabled(null)$q$,'22023',NULL,'the switch needs a yes or a no');
select is(kut.admin_set_midweek_enabled(true),'{"enabled": true}'::jsonb,'an admin switches Midweek Madness on');
reset role;
select results_eq($q$select enabled, updated_by from kut.midweek_config$q$,
  $q$values (true, '00000124-0000-4000-8000-00000000000a'::uuid)$q$,
  'the switch is on and records who flipped it');

set local role authenticated;
select is(kut.admin_set_midweek_enabled(false),'{"enabled": false}'::jsonb,'an admin pauses Midweek Madness');
reset role;
select is((select count(*)::int from kut.midweek_config),1,'the switch is still a single row');

select * from finish();
rollback;
