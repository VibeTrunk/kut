#!/usr/bin/env bash
# Prepares the runner's throwaway `kut` stack as the source for the backup
# self-test on pull requests (ADR-141). CI only: it writes to the stack.
#
# Loads the fictional fixture, creates kut_backup from kut-backup-role.sql
# with a random password, and exports the connection to later steps through
# GITHUB_ENV, masked. It also removes the PUBLIC rights on pg_net and the
# internal _supabase database that the local Supabase image grants but the
# hosted project does not, so the privilege audit sees what hosted has.
set -euo pipefail

[ "${GITHUB_ACTIONS:-}" = true ] || {
  echo 'FAILED: selftest-source.sh runs only on a CI runner'
  exit 1
}
here=$(cd "$(dirname "$0")" && pwd)
source_db() {
  docker exec -i supabase_db_kut psql -X -q -v ON_ERROR_STOP=1 -d postgres "$@"
}

source_db -U postgres < "$here/selftest-fixture.sql"
source_db -U postgres < "$here/kut-backup-role.sql"
source_db -U supabase_admin <<'SQL'
revoke all on all tables in schema net from public;
revoke all on all sequences in schema net from public;
revoke usage on schema net from public;
revoke connect, temporary on database _supabase from public;
SQL

password=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
echo "::add-mask::$password"
printf "alter role kut_backup password '%s';\n" "$password" | source_db -U postgres
{
  echo 'PGHOST=127.0.0.1'
  echo 'PGPORT=54322'
  echo 'PGUSER=kut_backup'
  echo "PGPASSWORD=$password"
  echo 'PGSSLMODE=disable'
} >> "$GITHUB_ENV"
echo 'self-test source ready: fixture loaded, kut_backup created'
