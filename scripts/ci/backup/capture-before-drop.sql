-- Run in the migrated restore stack before `drop schema kut cascade`
-- (ADR-141). Read-only. Writes three generated SQL files:
--   :recreate_file  recreates objects outside kut that depend on kut and that
--                   the cascade drops (today: the player-photo policies on
--                   storage.objects);
--   :assert_file    fails unless each of them exists again;
--   :stubs_file     inserts a stand-in auth.users row for every user id that
--                   a kut foreign key references, because the backup carries
--                   no auth data.
-- A dependent kind it cannot recreate yields an UNSUPPORTED line, and the
-- restore check fails on it.
set search_path = pg_catalog;

\o :recreate_file
with refs as (
  select d.classid, d.objid,
    case d.refclassid
      when 'pg_proc'::regclass then (select pronamespace from pg_proc where oid = d.refobjid)
      when 'pg_class'::regclass then (select relnamespace from pg_class where oid = d.refobjid)
      when 'pg_type'::regclass then (select typnamespace from pg_type where oid = d.refobjid)
    end as refns
  from pg_depend d
),
dependents as (
  select distinct r.classid, r.objid,
    case r.classid
      when 'pg_policy'::regclass then
        (select c.relnamespace from pg_policy p join pg_class c on c.oid = p.polrelid where p.oid = r.objid)
      when 'pg_trigger'::regclass then
        (select c.relnamespace from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.oid = r.objid)
      when 'pg_class'::regclass then (select relnamespace from pg_class where oid = r.objid)
      when 'pg_proc'::regclass then (select pronamespace from pg_proc where oid = r.objid)
      when 'pg_type'::regclass then (select typnamespace from pg_type where oid = r.objid)
      when 'pg_rewrite'::regclass then
        (select c.relnamespace from pg_rewrite w join pg_class c on c.oid = w.ev_class where w.oid = r.objid)
      when 'pg_constraint'::regclass then
        (select coalesce(c.relnamespace, k.connamespace) from pg_constraint k
         left join pg_class c on c.oid = k.conrelid where k.oid = r.objid)
      when 'pg_attrdef'::regclass then
        (select c.relnamespace from pg_attrdef a join pg_class c on c.oid = a.adrelid where a.oid = r.objid)
    end as objns
  from refs r
  where r.refns = 'kut'::regnamespace
)
select case d.classid
  when 'pg_policy'::regclass then (
    select format('create policy %I on %s as %s for %s to %s%s%s;',
      p.polname, p.polrelid::regclass,
      case when p.polpermissive then 'permissive' else 'restrictive' end,
      case p.polcmd when 'r' then 'select' when 'a' then 'insert'
                    when 'w' then 'update' when 'd' then 'delete' else 'all' end,
      (select string_agg(case when role_oid = 0 then 'public'
                              else quote_ident(pg_get_userbyid(role_oid)) end, ', ')
       from unnest(p.polroles) role_oid),
      coalesce(' using (' || pg_get_expr(p.polqual, p.polrelid) || ')', ''),
      coalesce(' with check (' || pg_get_expr(p.polwithcheck, p.polrelid) || ')', ''))
    from pg_policy p where p.oid = d.objid)
  when 'pg_trigger'::regclass then pg_get_triggerdef(d.objid) || ';'
  else 'UNSUPPORTED ' || pg_describe_object(d.classid, d.objid, 0)
end
from dependents d
where d.objns is distinct from 'kut'::regnamespace
  and d.objns is distinct from 'pg_toast'::regnamespace
order by 1;

\o :assert_file
select format(
  'do $a$ begin if not exists (select from pg_policy where polrelid = %L::regclass and polname = %L) '
  'then raise exception %L; end if; end $a$;',
  p.polrelid::regclass::text, p.polname, 'a dependent policy was not recreated')
from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relnamespace <> 'kut'::regnamespace
  and exists (
    select from pg_depend d
    join pg_proc f on d.refclassid = 'pg_proc'::regclass and f.oid = d.refobjid
    where d.classid = 'pg_policy'::regclass and d.objid = p.oid
      and f.pronamespace = 'kut'::regnamespace
    union all
    select from pg_depend d
    join pg_class k on d.refclassid = 'pg_class'::regclass and k.oid = d.refobjid
    where d.classid = 'pg_policy'::regclass and d.objid = p.oid
      and k.relnamespace = 'kut'::regnamespace)
union all
select format(
  'do $a$ begin if not exists (select from pg_trigger where tgrelid = %L::regclass and tgname = %L) '
  'then raise exception %L; end if; end $a$;',
  t.tgrelid::regclass::text, t.tgname, 'a dependent trigger was not recreated')
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc f on f.oid = t.tgfoid
where c.relnamespace <> 'kut'::regnamespace
  and f.pronamespace = 'kut'::regnamespace
order by 1;

\o :stubs_file
select case
  when array_length(k.conkey, 1) <> 1 then
    'UNSUPPORTED multi-column foreign key ' || k.conname || ' to auth.users'
  else format(
    'insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, '
    'raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, '
    'email_change_token_new, email_change) '
    'select distinct %1$I, ''00000000-0000-0000-0000-000000000000''::uuid, '
    '''authenticated''::text, ''authenticated''::text, '
    '''restored-'' || %1$I || ''@example.invalid'', '
    '''{"provider":"email","providers":["email"]}''::jsonb, ''{}''::jsonb, now(), now(), '
    '''''::text, ''''::text, ''''::text, ''''::text '
    'from %2$s where %1$I is not null on conflict (id) do nothing;',
    a.attname, k.conrelid::regclass)
end
from pg_constraint k
join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
where k.contype = 'f'
  and k.confrelid = 'auth.users'::regclass
  and k.connamespace = 'kut'::regnamespace
order by 1;
\o
