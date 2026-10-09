# Restore-target guard (ADR-141). Source this file.
#
# The restore check drops schema kut. That may only ever happen in the
# disposable `kut_restore` stack, never the `kut` development stack or a
# hosted database. Every SQL or pg_restore call into the restore target goes
# through restore_exec, which re-verifies the target before each call: the
# container name, its Supabase project label, and its published port. The
# connection is `docker exec` into that container, so no host or port setting
# can redirect it.

readonly RESTORE_PROJECT=kut_restore
readonly RESTORE_CONTAINER=supabase_db_kut_restore
readonly RESTORE_DB_PORT=55322

guard_restore_target() {
  local label port running
  if [ "$RESTORE_CONTAINER" = supabase_db_kut ] || [ "$RESTORE_PROJECT" = kut ]; then
    fail 'guard: the restore target is the kut development stack'
  fi
  running=$(docker inspect -f '{{.State.Running}}' "$RESTORE_CONTAINER" 2> /dev/null) \
    || fail "guard: container $RESTORE_CONTAINER does not exist"
  [ "$running" = true ] || fail "guard: container $RESTORE_CONTAINER is not running"
  label=$(docker inspect -f '{{index .Config.Labels "com.supabase.cli.project"}}' "$RESTORE_CONTAINER")
  [ "$label" = "$RESTORE_PROJECT" ] \
    || fail "guard: $RESTORE_CONTAINER belongs to project '$label', not $RESTORE_PROJECT"
  port=$(docker inspect -f '{{range (index .HostConfig.PortBindings "5432/tcp")}}{{.HostPort}}{{end}}' "$RESTORE_CONTAINER")
  [ "$port" = "$RESTORE_DB_PORT" ] \
    || fail "guard: $RESTORE_CONTAINER publishes port '$port', not $RESTORE_DB_PORT"
}

# restore_exec COMMAND [ARGS...]: run COMMAND inside the verified restore
# container, as the stack's local postgres user, with stdin passed through.
restore_exec() {
  guard_restore_target
  docker exec -i -e PGUSER=postgres -e PGDATABASE=postgres "$RESTORE_CONTAINER" "$@"
}

# restore_psql [PSQL ARGS...]: psql in the verified restore container.
restore_psql() {
  restore_exec psql "${PSQL_FLAGS[@]}" "$@"
}
