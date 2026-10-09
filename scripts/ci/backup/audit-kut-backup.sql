-- Privilege audit for kut_backup (ADR-141). Read-only; catalogue data only.
--
-- Lists every privilege kut_backup holds beyond kut-backup-role.sql, whether
-- held directly, through a role it can use, or through PUBLIC. The
-- has_*_privilege functions count PUBLIC and inherited membership. Run it as
-- postgres in the database the role logs in to.
--
-- status:
--   FINDING      not allowed. The audit passes only with zero FINDING rows.
--   exception    reviewed and accepted in ADR-141.
--   unreachable  the privilege exists, but the role has no USAGE on the
--                object's schema, so it cannot name the object to use it.
--
-- Not listed at all: USAGE on types and languages, and EXECUTE on SECURITY
-- INVOKER functions. PUBLIC holds those everywhere, and they run with the
-- caller's own read-only rights. pg_catalog and information_schema are out of
-- scope.

with
target as (select * from pg_roles where rolname = 'kut_backup'),
user_schemas as (
  select oid, nspname from pg_namespace
  where nspname not in ('pg_catalog', 'information_schema')
    and nspname !~ '^pg_(toast|temp_|toast_temp_)'
),
granted_schemas as (
  select unnest(array['kut', 'supabase_migrations']) as nspname
),
expected_tables as (
  select c.oid from pg_class c
  where c.relnamespace = 'kut'::regnamespace and c.relkind in ('r','p','v','m','f')
  union all
  select 'supabase_migrations.schema_migrations'::regclass::oid
),
-- ADR-141: PUBLIC can execute these. Five are trigger functions, which
-- Postgres refuses to run outside a trigger; is_admin() only reports whether
-- the caller is an admin. A new function like them is a FINDING.
accepted_definer_functions as (
  select unnest(array[
    'kut._clear_availability_for_listing()',
    'kut._maintain_trade_discovery_for_card()',
    'kut._open_session_survey()',
    'kut._version_and_open_session_survey()',
    'kut.is_admin()',
    'kut.prevent_burning_listed_card()']) as signature
),
raw as (
  -- 1. Role attributes beyond LOGIN, BYPASSRLS and NOINHERIT.
  select 'role attribute' as kind, a.attr as object, 'set' as privilege,
         'FINDING' as status, null::oid as ns
  from target t, lateral (values
    ('superuser', t.rolsuper), ('createdb', t.rolcreatedb),
    ('createrole', t.rolcreaterole), ('replication', t.rolreplication),
    ('inherit', t.rolinherit)) a(attr, isset)
  where a.isset

  -- 2. Any role membership, direct or indirect: SET ROLE would unlock it.
  union all
  select 'role membership', r.rolname, 'member', 'FINDING', null
  from target t
  join pg_roles r on r.oid <> t.oid and pg_has_role(t.oid, r.oid, 'member')

  -- 3. Anything the role owns.
  union all
  select 'ownership', format('%s.%I', c.relnamespace::regnamespace, c.relname), 'owner', 'FINDING', null
  from pg_class c, target t where c.relowner = t.oid
  union all
  select 'ownership', p.oid::regprocedure::text, 'owner', 'FINDING', null
  from pg_proc p, target t where p.proowner = t.oid
  union all
  select 'ownership', n.nspname, 'owner', 'FINDING', null
  from pg_namespace n, target t where n.nspowner = t.oid

  -- 4. Database privileges. CONNECT on this database is how it logs in.
  -- TEMPORARY (session-private temp tables) and CONNECT on the empty
  -- template databases come from PUBLIC (ADR-141).
  union all
  select 'database', d.datname, p.priv,
         case when d.datname = current_database() and p.priv = 'TEMPORARY'
                then 'exception'
              when d.datname in ('template0', 'template1') and p.priv = 'CONNECT'
                then 'exception'
              else 'FINDING' end, null
  from pg_database d, target t,
       unnest(array['CREATE', 'TEMPORARY', 'CONNECT']) p(priv)
  where has_database_privilege(t.oid, d.oid, p.priv)
    and not (d.datname = current_database() and p.priv = 'CONNECT')

  -- 5. Schema privileges. USAGE on public comes from PUBLIC (ADR-141); any
  -- right on an object in it is still listed below.
  union all
  select 'schema', s.nspname, p.priv,
         case when s.nspname = 'public' and p.priv = 'USAGE' then 'exception'
              else 'FINDING' end, null
  from user_schemas s, target t, unnest(array['USAGE', 'CREATE']) p(priv)
  where has_schema_privilege(t.oid, s.oid, p.priv)
    and not (p.priv = 'USAGE' and s.nspname in (select nspname from granted_schemas))

  -- 6. Table, view and foreign-table privileges beyond the expected SELECTs.
  union all
  select 'table', format('%I.%I', s.nspname, c.relname), p.priv, 'FINDING', s.oid
  from pg_class c join user_schemas s on s.oid = c.relnamespace, target t,
       unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE',
                    'REFERENCES','TRIGGER','MAINTAIN']) p(priv)
  where c.relkind in ('r','p','v','m','f')
    and has_table_privilege(t.oid, c.oid, p.priv)
    and not (p.priv = 'SELECT' and c.oid in (select oid from expected_tables))

  -- 7. Column privileges where the role lacks the table privilege.
  union all
  select 'column', format('%I.%I.%I', s.nspname, c.relname, a.attname), p.priv,
         'FINDING', s.oid
  from pg_class c join user_schemas s on s.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped,
       target t, unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) p(priv)
  where c.relkind in ('r','p','v','m','f')
    and a.attacl is not null
    and has_column_privilege(t.oid, c.oid, a.attnum, p.priv)
    and not has_table_privilege(t.oid, c.oid, p.priv)
    and not (p.priv = 'SELECT' and c.oid in (select oid from expected_tables))

  -- 8. Sequence privileges beyond SELECT on kut sequences.
  union all
  select 'sequence', format('%I.%I', s.nspname, c.relname), p.priv, 'FINDING', s.oid
  from pg_class c join user_schemas s on s.oid = c.relnamespace, target t,
       unnest(array['USAGE', 'SELECT', 'UPDATE']) p(priv)
  where c.relkind = 'S'
    and has_sequence_privilege(t.oid, c.oid, p.priv)
    and not (p.priv = 'SELECT' and s.nspname = 'kut')

  -- 9. Executable SECURITY DEFINER functions: they run as their owner.
  union all
  select 'security definer function', p.oid::regprocedure::text, 'EXECUTE',
         case when p.oid::regprocedure::text in
                     (select signature from accepted_definer_functions)
              then 'exception' else 'FINDING' end, s.oid
  from pg_proc p join user_schemas s on s.oid = p.pronamespace, target t
  where p.prosecdef and has_function_privilege(t.oid, p.oid, 'EXECUTE')

  -- 10. Large objects, foreign servers and wrappers, tablespaces, parameters.
  -- (has_largeobject_privilege arrives in Postgres 18; read the ACL instead.)
  union all
  select 'large object', l.oid::text, a.privilege_type, 'FINDING', null
  from pg_largeobject_metadata l, target t, aclexplode(l.lomacl) a
  where a.grantee = 0 or pg_has_role(t.oid, a.grantee, 'member')
  union all
  select 'large object', l.oid::text, 'owner', 'FINDING', null
  from pg_largeobject_metadata l, target t
  where pg_has_role(t.oid, l.lomowner, 'member')
  union all
  select 'foreign server', f.srvname, 'USAGE', 'FINDING', null
  from pg_foreign_server f, target t
  where has_server_privilege(t.oid, f.oid, 'USAGE')
  union all
  select 'foreign data wrapper', w.fdwname, 'USAGE', 'FINDING', null
  from pg_foreign_data_wrapper w, target t
  where has_foreign_data_wrapper_privilege(t.oid, w.oid, 'USAGE')
  union all
  select 'tablespace', ts.spcname, 'CREATE', 'FINDING', null
  from pg_tablespace ts, target t
  where has_tablespace_privilege(t.oid, ts.oid, 'CREATE')
  union all
  select 'parameter', pa.parname, p.priv, 'FINDING', null
  from pg_parameter_acl pa, target t, unnest(array['SET','ALTER SYSTEM']) p(priv)
  where has_parameter_privilege(t.oid, pa.parname, p.priv)

  -- 11. Default privileges that would give the role, or PUBLIC, more later.
  union all
  select 'default privilege',
         coalesce(d.defaclnamespace::regnamespace::text, '(all schemas)')
           || ' ' || d.defaclobjtype::text || ' by ' || d.defaclrole::regrole::text,
         a.privilege_type, 'FINDING', null
  from pg_default_acl d, target t, aclexplode(d.defaclacl) a
  where a.grantee in (t.oid, 0)
    and not (a.grantee = t.oid and a.privilege_type = 'SELECT'
             and d.defaclnamespace = 'kut'::regnamespace
             and d.defaclobjtype in ('r', 'S'))
),
reachability as (
  -- An object in a schema the role cannot use cannot be named, so a
  -- privilege on it is unusable. Schema rights themselves are always listed.
  select r.*,
         case when r.ns is not null
                and not has_schema_privilege((select oid from target), r.ns, 'USAGE')
              then 'unreachable' else r.status end as final_status
  from raw r
)
select final_status as status, kind, object, privilege from reachability
union all
select 'FINDING', 'missing role', 'kut_backup', 'role does not exist'
where not exists (select from target)
order by 1, 2, 3, 4;
