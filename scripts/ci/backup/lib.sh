# Shared helpers for the nightly kut backup (ADR-141). Source this file.
#
# The repository is public, so its job logs are too. Every database tool's
# output (pg_dump, pg_restore, psql, the Supabase CLI) goes to a private log
# file that is never printed and is uploaded only age-encrypted. The job log
# gets one scrubbed line per step: its name, exit code and SQLSTATE.

: "${BACKUP_PRIVATE_LOG:?BACKUP_PRIVATE_LOG must name the private log file}"

# psql flags shared by every call: no psqlrc, quiet, stop on the first error,
# and verbose errors so the SQLSTATE lands in the private log.
PSQL_FLAGS=(-X -q -v ON_ERROR_STOP=1 -v VERBOSITY=verbose)

# say MESSAGE: a public log line. Only ever pass fixed text and counts.
say() { printf '%s\n' "$*"; }

# fail MESSAGE: a public failure line, then exit 1.
fail() { printf 'FAILED: %s\n' "$*"; exit 1; }

# run_step NAME COMMAND [ARGS...]
# Runs COMMAND with stdout and stderr appended to the private log, then prints
# `step=NAME exit=N sqlstate=XXXXX` (or `-` when there is none). Returns the
# command's exit code.
run_step() {
  local name=$1
  shift
  local before
  before=$(wc -l < "$BACKUP_PRIVATE_LOG")
  printf '\n=== %s ===\n' "$name" >> "$BACKUP_PRIVATE_LOG"
  local code=0
  "$@" >> "$BACKUP_PRIVATE_LOG" 2>&1 || code=$?
  # Only a five-character SQLSTATE after a server severity ever leaves the
  # private log, never the message or detail around it.
  local sqlstate
  sqlstate=$(tail -n "+$((before + 1))" "$BACKUP_PRIVATE_LOG" \
    | grep -oE '(ERROR|FATAL|PANIC): +[0-9A-Z]{5}:' \
    | tail -n 1 | grep -oE '[0-9A-Z]{5}:$' | tr -d ':' || true)
  say "step=$name exit=$code sqlstate=${sqlstate:--}"
  return "$code"
}
