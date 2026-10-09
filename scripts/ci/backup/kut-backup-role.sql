-- kut_backup: the read-only login for the nightly GitHub backup (ADR-141).
--
-- Run as `postgres` in the Supabase SQL editor. It is idempotent. It sets no
-- password, so the password never sits in a file: set one separately with
-- ALTER ROLE kut_backup PASSWORD '...' in the same editor.
--
-- The grants are exactly these:
--   USAGE on schemas kut and supabase_migrations;
--   SELECT on every kut table and sequence, now and in future (never sequence
--   USAGE);
--   SELECT on supabase_migrations.schema_migrations, for the manifest.
-- BYPASSRLS lets pg_dump read every kut row and grants no write right.
--
-- No auth grants: postgres has no grant option on schema auth, so the backup
-- covers kut only (ADR-141). The restore check also applies this file to its
-- disposable stack, so restored grants match the migrated ones.

do $$
begin
  if not exists (select from pg_roles where rolname = 'kut_backup') then
    create role kut_backup
      login bypassrls noinherit
      nosuperuser nocreatedb nocreaterole noreplication
      connection limit 4;
  end if;
end
$$;

-- Defence in depth: every session starts read-only (pg_dump sets it anyway).
alter role kut_backup set default_transaction_read_only = on;

grant usage on schema kut to kut_backup;
grant select on all tables in schema kut to kut_backup;
grant select on all sequences in schema kut to kut_backup;
-- Tables and sequences that later migrations create (they run as postgres).
alter default privileges for role postgres in schema kut
  grant select on tables to kut_backup;
alter default privileges for role postgres in schema kut
  grant select on sequences to kut_backup;

grant usage on schema supabase_migrations to kut_backup;
grant select on supabase_migrations.schema_migrations to kut_backup;
