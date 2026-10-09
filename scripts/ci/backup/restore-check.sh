#!/usr/bin/env bash
# Restore check for a kut backup (ADR-141). Runs on the CI runner each night,
# and on the owner's machine for the drill (Git Bash).
#
#   restore-check.sh PLAINTEXT_DIR WORKDIR
#
# PLAINTEXT_DIR holds kut.dump and manifest.json. WORKDIR receives the
# disposable stack's project folder and the private log. The checkout must be
# at the manifest's repo SHA, with supabase/ unchanged.
#
# 1. Start a fresh disposable Supabase stack (project kut_restore, ports
#    553xx) from this checkout's migrations, with an empty seed.
# 2. Apply kut-backup-role.sql, so grants match hosted, and capture what the
#    cascade will drop outside kut. Round-trip the migrated schema once (see
#    below), then take the reference schema-only dump of kut.
# 3. Drop schema kut. Restore pre-data, then data. Insert stand-in auth.users
#    rows for every referenced user id. Restore post-data, so every
#    constraint is checked against the restored data.
# 4. Recreate the captured dependents and assert they exist.
# 5. Gate: the schema-only dump equals the one from step 2; the row counts
#    equal the manifest's snapshot counts; every profile has an auth row; a
#    restored member can sign in and read their own profile through the API.
#
# On a migration-window night, when hosted is ahead of main, the schema diff
# fails as expected and clears after the merge.
set -euo pipefail
export MSYS_NO_PATHCONV=1

plain=${1:?usage: restore-check.sh PLAINTEXT_DIR WORKDIR}
work=${2:?usage: restore-check.sh PLAINTEXT_DIR WORKDIR}
repo=$(git rev-parse --show-toplevel)
here="$repo/scripts/ci/backup"
mkdir -p "$work/private"
export BACKUP_PRIVATE_LOG="$work/private/log.txt"
touch "$BACKUP_PRIVATE_LOG"
# shellcheck source=lib.sh
. "$here/lib.sh"
# shellcheck source=guard.sh
. "$here/guard.sh"

inner=/tmp/kut-restore-check

# --- Baseline -----------------------------------------------------------------
[ -s "$plain/kut.dump" ] && [ -s "$plain/manifest.json" ] \
  || fail "$plain must hold kut.dump and manifest.json"
manifest_sha=$(jq -r '.repo_sha' "$plain/manifest.json")
head_sha=$(git -C "$repo" rev-parse HEAD)
[ "$manifest_sha" = "$head_sha" ] \
  || fail "the checkout is at $head_sha; check out the backup's repo SHA $manifest_sha first"
[ -z "$(git -C "$repo" status --porcelain -- supabase)" ] \
  || fail 'supabase/ has local changes; the restore needs the migrations at that SHA'
dump_sha=$(sha256sum "$plain/kut.dump" | cut -d ' ' -f 1)
[ "$dump_sha" = "$(jq -r '.dump.sha256' "$plain/manifest.json")" ] \
  || fail 'kut.dump does not match the SHA-256 in its manifest'
say 'baseline: checkout at the manifest SHA, dump hash matches'

# --- 1. Fresh disposable stack --------------------------------------------------
if docker inspect "$RESTORE_CONTAINER" > /dev/null 2>&1; then
  fail "$RESTORE_CONTAINER already exists; stop it first with: npx supabase stop --workdir <its folder> --no-backup"
fi
stack="$work/stack"
mkdir -p "$stack/supabase"
cp -R "$repo/supabase/migrations" "$stack/supabase/"
: > "$stack/supabase/seed.sql"
sed -E \
  -e 's/^project_id = "kut"$/project_id = "kut_restore"/' \
  -e 's/^([[:space:]]*(shadow_)?port = )543([0-9]{2})$/\1553\3/' \
  "$repo/supabase/config.toml" > "$stack/supabase/config.toml"
grep -q '^project_id = "kut_restore"$' "$stack/supabase/config.toml" \
  || fail 'could not set the disposable project id'
if grep -qE '^[[:space:]]*(shadow_)?port = 543[0-9]{2}$' "$stack/supabase/config.toml"; then
  fail 'a port of the disposable stack still collides with the kut stack'
fi
run_step start-restore-stack npx --no-install supabase start --workdir "$stack" \
  -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
guard_restore_target
say "guard: $RESTORE_CONTAINER verified (project $RESTORE_PROJECT, port $RESTORE_DB_PORT)"

# --- 2. Before the drop -----------------------------------------------------------
restore_exec mkdir -p "$inner"
docker cp "$plain/kut.dump" "$RESTORE_CONTAINER:$inner/kut.dump" > /dev/null
for file in kut-backup-role.sql capture-before-drop.sql row-counts.sql; do
  docker cp "$here/$file" "$RESTORE_CONTAINER:$inner/$file" > /dev/null
done
run_step apply-role restore_psql -f "$inner/kut-backup-role.sql"
run_step capture-dependents restore_psql -At \
  -v recreate_file="$inner/recreate.sql" \
  -v assert_file="$inner/assert.sql" \
  -v stubs_file="$inner/stubs.sql" \
  -f "$inner/capture-before-drop.sql"
if restore_exec grep -q UNSUPPORTED "$inner/recreate.sql" "$inner/stubs.sql"; then
  fail 'an object outside kut depends on kut in a way the restore check cannot recreate'
fi
say "captured: $(restore_exec grep -c '^create ' "$inner/recreate.sql" || true) dependent(s) outside kut," \
  "$(restore_exec grep -c '^insert ' "$inner/stubs.sql" || true) foreign key(s) to auth.users"
# Postgres does not deparse every view identically after a dump and restore:
# unnamed UNION ALL columns come back as `NULL::text AS text`. So the
# migrated schema makes the same round trip as the backup before it is
# compared: dump it, drop it, restore it, then take the reference dump.
run_step schema-archive restore_exec pg_dump -Fc -s -n kut -f "$inner/migrated-schema.dump"
run_step roundtrip-drop restore_psql -c 'drop schema kut cascade'
run_step roundtrip-restore restore_exec pg_restore --exit-on-error -d postgres \
  "$inner/migrated-schema.dump"
run_step roundtrip-dependents restore_psql -f "$inner/recreate.sql"
run_step schema-before restore_exec pg_dump -s -n kut -f "$inner/schema-before.sql"

# --- 3. Drop and restore ------------------------------------------------------------
run_step drop-kut restore_psql -c 'drop schema kut cascade'
run_step restore-pre-data restore_exec pg_restore --exit-on-error --section=pre-data \
  -d postgres "$inner/kut.dump"
run_step restore-data restore_exec pg_restore --exit-on-error --section=data \
  -d postgres "$inner/kut.dump"
run_step auth-stubs restore_psql -f "$inner/stubs.sql"
run_step restore-post-data restore_exec pg_restore --exit-on-error --section=post-data \
  -d postgres "$inner/kut.dump"

# --- 4. Dependents outside kut ------------------------------------------------------
run_step recreate-dependents restore_psql -f "$inner/recreate.sql"
run_step assert-dependents restore_psql -f "$inner/assert.sql"

# --- 5. Gate -----------------------------------------------------------------------
run_step schema-after restore_exec pg_dump -s -n kut -f "$inner/schema-after.sql"
# pg_dump 17.6+ wraps plain output in \restrict lines with a random key.
normalize='grep -vE "^\\\\(un)?restrict " '
run_step schema-diff restore_exec sh -c \
  "$normalize $inner/schema-before.sql > $inner/before.norm &&
   $normalize $inner/schema-after.sql > $inner/after.norm &&
   diff $inner/before.norm $inner/after.norm"

run_step restored-counts restore_psql -At -f "$inner/row-counts.sql" -o "$inner/counts.json"
docker cp "$RESTORE_CONTAINER:$inner/counts.json" "$work/private/restored-counts.json" > /dev/null
if ! jq -e --slurpfile restored "$work/private/restored-counts.json" \
    '.row_counts == $restored[0]' "$plain/manifest.json" > /dev/null; then
  fail 'restored row counts differ from the snapshot counts in the manifest'
fi
say "row counts: $(jq '.row_counts | length' "$plain/manifest.json") kut tables match the snapshot"

run_step profiles-have-auth restore_psql -c "do \$\$ begin
  if exists (select from kut.profiles p where not exists (select from auth.users u where u.id = p.id))
  then raise exception 'a restored profile has no auth.users row'; end if; end \$\$;"

# A restored member signs in and reads their own profile through the API.
member=$(restore_psql -At 2>> "$BACKUP_PRIVATE_LOG" -c \
  "select id from kut.profiles where not is_disabled order by created_at, id limit 1")
if [ -z "$member" ]; then
  say 'sign-in: skipped, the backup holds no enabled profile'
else
  password=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
  run_step prepare-sign-in restore_psql <<SQL
update auth.users
   set encrypted_password = extensions.crypt('$password', extensions.gen_salt('bf')),
       email_confirmed_at = now()
 where id = '$member';
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
  from auth.users where id = '$member'
on conflict do nothing;
SQL
  npx --no-install supabase status --workdir "$stack" -o env 2>> "$BACKUP_PRIVATE_LOG" \
    | grep -E '^(API_URL|ANON_KEY)=' | sed -E 's/^([A-Z_]+)="(.*)"$/\1=\2/' > "$work/private/stack.env"
  api_url=$(sed -n 's/^API_URL=//p' "$work/private/stack.env")
  anon_key=$(sed -n 's/^ANON_KEY=//p' "$work/private/stack.env")
  [ -n "$api_url" ] && [ -n "$anon_key" ] || fail 'could not read the disposable stack API URL and key'
  email="restored-$member@example.invalid"
  code=$(curl -sS -o "$work/private/token.json" -w '%{http_code}' \
    -H "apikey: $anon_key" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    "$api_url/auth/v1/token?grant_type=password" 2>> "$BACKUP_PRIVATE_LOG" || true)
  say "step=sign-in http=$code"
  [ "$code" = 200 ] || fail 'a restored member could not sign in'
  token=$(jq -r '.access_token' "$work/private/token.json")
  code=$(curl -sS -o "$work/private/own-profile.json" -w '%{http_code}' \
    -H "apikey: $anon_key" -H "Authorization: Bearer $token" -H 'Accept-Profile: kut' \
    "$api_url/rest/v1/profiles?select=id&id=eq.$member" 2>> "$BACKUP_PRIVATE_LOG" || true)
  rows=$(jq 'length' "$work/private/own-profile.json" 2> /dev/null || echo 0)
  say "step=read-own-profile http=$code rows=$rows"
  [ "$code" = 200 ] && [ "$rows" = 1 ] || fail 'a restored member could not read their own profile'
fi

say 'restore check passed'
