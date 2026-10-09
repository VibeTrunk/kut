-- Manifest facts read inside the dump's exported snapshot (ADR-141).
-- Read-only. Variables: snapshot, facts_file, counts_file.
begin isolation level repeatable read read only;
set transaction snapshot :'snapshot';

\o :facts_file
select json_build_object(
  'taken_at', now(),
  'server_version', current_setting('server_version'),
  'hosted_migration_versions',
    (select coalesce(json_agg(version order by version), '[]')
     from supabase_migrations.schema_migrations));

\o :counts_file
\ir row-counts.sql
\o

commit;
