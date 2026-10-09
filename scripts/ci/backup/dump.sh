#!/usr/bin/env bash
# Takes the nightly kut backup from one exported snapshot (ADR-141).
#
# Runs inside the postgres:17 client container, connected as kut_backup
# through PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE and PGSSLMODE. The
# password reaches libpq through PGPASSWORD only, never an argument.
#
#   dump.sh WORKDIR
#
# WORKDIR/plain/ receives kut.dump and manifest.json (plaintext, never
# printed). WORKDIR/private/ holds the private log. Also needs REPO_SHA and
# BACKUP_SOURCE in the environment.
#
# Steps: privilege audit and denial check as kut_backup; a held REPEATABLE
# READ transaction exports a snapshot; pg_dump and the manifest facts both
# read that snapshot; then the holder commits.
set -euo pipefail

work=${1:?usage: dump.sh WORKDIR}
: "${REPO_SHA:?REPO_SHA is required}"
: "${BACKUP_SOURCE:?BACKUP_SOURCE is required}"
here=$(cd "$(dirname "$0")" && pwd)
export BACKUP_PRIVATE_LOG="$work/private/log.txt"
# shellcheck source=lib.sh
. "$here/lib.sh"

plain="$work/plain"
private="$work/private"
mkdir -p "$plain"

# 1. The role may hold nothing beyond its grants, and may not write.
run_step audit psql "${PSQL_FLAGS[@]}" -At -F '|' \
  -f "$here/audit-kut-backup.sql" -o "$private/audit.txt"
findings=$(grep -c '^FINDING|' "$private/audit.txt" || true)
say "audit: $findings finding(s), $(grep -c '^exception|' "$private/audit.txt" || true) reviewed exception(s)"
[ "$findings" -eq 0 ] || fail 'kut_backup holds privileges beyond its grants'
run_step denial-check psql "${PSQL_FLAGS[@]}" -f "$here/deny-check.sql"

# 2. Export one snapshot from a held transaction.
mkfifo "$private/holder.in"
psql "${PSQL_FLAGS[@]}" -At < "$private/holder.in" > "$private/holder.out" \
  2>> "$BACKUP_PRIVATE_LOG" &
holder=$!
exec 3> "$private/holder.in"
printf '%s\n' 'begin isolation level repeatable read read only;' \
  'select pg_export_snapshot();' >&3

snapshot=
for _ in $(seq 1 120); do
  snapshot=$(grep -m1 -E '^[0-9A-F]{8}-[0-9A-F]{8}-[0-9]+$' "$private/holder.out" || true)
  [ -n "$snapshot" ] && break
  kill -0 "$holder" 2> /dev/null || break
  sleep 0.5
done
[ -n "$snapshot" ] || fail 'step=export-snapshot: no snapshot exported'
say 'step=export-snapshot exit=0 sqlstate=-'

# 3. Both readers import the snapshot.
run_step dump-kut pg_dump -Fc -n kut --snapshot="$snapshot" -f "$plain/kut.dump"
run_step snapshot-facts psql "${PSQL_FLAGS[@]}" -At \
  -v snapshot="$snapshot" \
  -v facts_file="$private/facts.json" \
  -v counts_file="$private/counts.json" \
  -f "$here/snapshot-facts.sql"

# 4. Release the snapshot.
printf 'commit;\n' >&3
exec 3>&-
holder_exit=0
wait "$holder" || holder_exit=$?
say "step=release-snapshot exit=$holder_exit sqlstate=-"
[ "$holder_exit" -eq 0 ] || fail 'the snapshot holder did not commit cleanly'

# 5. Manifest. Its contents stay inside the encrypted archive.
[ -s "$plain/kut.dump" ] || fail 'the kut dump is empty'
dump_sha=$(sha256sum "$plain/kut.dump" | cut -d ' ' -f 1)
dump_bytes=$(stat -c %s "$plain/kut.dump")
pg_dump_version=$(pg_dump --version)
tables=$(grep -oE '" ?:' "$private/counts.json" | wc -l)
{
  printf '{"format":1,'
  printf '"scope":"schema kut only; no auth data (ADR-141)",'
  printf '"source":"%s","repo_sha":"%s","pg_dump":"%s",' \
    "$BACKUP_SOURCE" "$REPO_SHA" "$pg_dump_version"
  printf '"dump":{"file":"kut.dump","sha256":"%s","bytes":%s},' "$dump_sha" "$dump_bytes"
  printf '"database":%s,' "$(cat "$private/facts.json")"
  printf '"row_counts":%s}\n' "$(cat "$private/counts.json")"
} > "$plain/manifest.json"
say "manifest: $tables kut tables counted in the dump's snapshot"
