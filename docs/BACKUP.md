# KUT backup and restore

KUT's game state (wallets, immutable ledger, card copies, market listings and
sales, attendance, ratings, notifications) lives in the `kut` schema of the
**shared** VibeTrunk Supabase project. On the current plan there is **no
managed backup and no point-in-time recovery**, and git holds none of this
data. A logical dump is the backup mechanism.

Git migrations reproduce the *schema*, not user accounts, coins, cards, or
trade history.

## What is and isn't covered

| Data | Covered by | Notes |
| --- | --- | --- |
| `kut` schema DDL + all `kut` table data | `scripts/backup-kut-hosted.ps1` | The file this doc is about. |
| Account identities (`auth.users`) | Supabase platform backup / dashboard export | Supabase-managed schema. Take a dashboard backup before any schema change (already in `docs/OPERATIONS.md`). A `kut`-only restore needs FK triggers disabled because `kut.profiles` references `auth.users` — see the drill below. |
| Card photos (`player-photos` bucket) | Not yet | Storage objects are not in the SQL dump. Low volume, low stakes for now; note it as an open gap. |

## Take a backup

From the repo root, with the Supabase CLI logged in and the project linked
(`supabase/.temp/project-ref` present):

```powershell
.\scripts\backup-kut-hosted.ps1
```

It prompts for an **encryption passphrase** (store it in your password
manager — a backup you can't decrypt is not a backup) and, unless you pass
`-DbPassword`, the Supabase CLI prompts for the **hosted Postgres password**.

The script:

1. `supabase db dump --linked -s kut` for the schema DDL, then again with
   `--data-only --use-copy` for the data.
2. Concatenates them into one replayable `.sql`.
3. Encrypts it to `%USERPROFILE%\backups\kut\kut-backup-<timestamp>.sql.enc`
   (AES-256-CBC + HMAC-SHA256, PBKDF2 600k — via `scripts/protect-kut-backup.ps1`).
4. **Decrypts the ciphertext back and checks the SHA-256 matches** the source
   before shredding the plaintext. A mismatch deletes the bad file and fails.
5. Appends a metadata entry to `.private-backups/BACKUP_LOG.md` (gitignored).

Options: `-OutDir <path>` (must be outside the repo tree), `-DbPassword
<SecureString>`, `-SkipVerify` (don't).

### Where the encrypted files go

`%USERPROFILE%\backups\kut\` by default. Keep at least the **last two**
generations, and get a copy **off this machine** — an external drive, or a
synced cloud folder is acceptable *because the file is encrypted*. Never put
the `.sql.enc`, the plaintext dump, or connection strings in the repo, an
issue tracker, or chat.

## Restore drill — do this at least once before inviting users

This proves the dump actually replays, which a size check does not. It uses a
throwaway database inside the **local** Supabase Postgres container and never
touches the hosted project. Needs `npx supabase start` running and Docker (no
`psql` on `PATH` required — we use the one inside `supabase_db_kut`).

```powershell
# 1. Decrypt to a scratch file
.\scripts\protect-kut-backup.ps1 -Mode Decrypt `
  -InputPath "$env:USERPROFILE\backups\kut\kut-backup-<timestamp>.sql.enc" `
  -OutputPath "$env:TEMP\kut-restore-check.sql" `
  -Passphrase (Read-Host -AsSecureString "Backup passphrase")

# 2. Fresh scratch database
docker exec supabase_db_kut psql -U postgres -v ON_ERROR_STOP=1 `
  -c "drop database if exists kut_restore_check;" `
  -c "create database kut_restore_check;"

# 3. A kut-only dump references Supabase-managed objects that a bare database
#    lacks: the `extensions` schema (pgcrypto, for gen_random_uuid) and the
#    `auth` schema (view bodies call auth.uid(); several tables FK to
#    auth.users). Create the extension for real and stub the auth surface.
docker exec supabase_db_kut psql -U postgres -d kut_restore_check -v ON_ERROR_STOP=1 `
  -c "create schema if not exists extensions;" `
  -c "create extension if not exists pgcrypto with schema extensions;" `
  -c "create schema if not exists auth;" `
  -c "create or replace function auth.uid() returns uuid language sql stable as 'select null::uuid';" `
  -c "create or replace function auth.role() returns text language sql stable as 'select null::text';" `
  -c "create or replace function auth.jwt() returns jsonb language sql stable as 'select ''{}''::jsonb';" `
  -c "create table if not exists auth.users (id uuid primary key);"

# 4. Copy the dump into the container and replay it.
#    session_replication_role = replica disables FK triggers so the kut-only
#    dump loads without real auth.users rows. -c runs before -f, same session.
docker cp "$env:TEMP\kut-restore-check.sql" supabase_db_kut:/tmp/kut-restore-check.sql
docker exec supabase_db_kut psql -U postgres -d kut_restore_check -v ON_ERROR_STOP=1 `
  -c "set session_replication_role = replica;" `
  -f /tmp/kut-restore-check.sql

# 5. Sanity-check row counts (compare against what you expect from prod)
docker exec supabase_db_kut psql -U postgres -d kut_restore_check -c @"
select 'players'       as t, count(*) from kut.players
union all select 'profiles',      count(*) from kut.profiles
union all select 'wallets',       count(*) from kut.wallets
union all select 'wallet_ledger', count(*) from kut.wallet_ledger
union all select 'user_cards',    count(*) from kut.user_cards
union all select 'market_sales',  count(*) from kut.market_sales
order by t;
"@

# 6. Clean up
docker exec supabase_db_kut psql -U postgres -c "drop database kut_restore_check;"
docker exec supabase_db_kut rm -f /tmp/kut-restore-check.sql
Remove-Item "$env:TEMP\kut-restore-check.sql"
```

A clean run through step 5 with plausible counts = the backup is restorable.
If step 4 stops on `ON_ERROR_STOP`, read the first error: a missing type or
function usually means another extension or `auth`/`storage` stub object to
add in step 3; a genuine data error is a real finding. Record the drill date
and the row counts in `.private-backups/BACKUP_LOG.md`.

Last drill: 2026-08-30 against `kut-backup-20260830-104303` — passed, full
schema + all `COPY` blocks, no errors.

For a **real** disaster recovery (not a drill) you would restore into a
project that already has the matching `auth.users` rows (from the Supabase
dashboard backup), then replay this dump **without** the `replica` setting so
foreign keys are enforced.

## Cadence

- **Now:** one fresh backup + one restore drill before the first invite.
- **Ongoing:** before every hosted schema change (already required by
  `docs/OPERATIONS.md`), and on a schedule matched to activity — at least
  weekly once real members are trading, ideally right before each Friday
  session.
- Re-run the restore drill roughly monthly, or any time the schema changes
  shape significantly.

### Optional: scheduled unattended run

`Export-Clixml` binds a SecureString to the current user + machine via DPAPI,
so a scheduled task can read secrets without a prompt. One-time, as the task's
user on the task's machine:

```powershell
Read-Host -AsSecureString "encryption passphrase"  | Export-Clixml "$env:USERPROFILE\.kut-backup-pp.xml"
Read-Host -AsSecureString "hosted db password"     | Export-Clixml "$env:USERPROFILE\.kut-backup-db.xml"
```

Wrapper the task runs:

```powershell
& "C:\path\to\kut\scripts\backup-kut-hosted.ps1" `
  -Passphrase (Import-Clixml "$env:USERPROFILE\.kut-backup-pp.xml") `
  -DbPassword (Import-Clixml "$env:USERPROFILE\.kut-backup-db.xml")
```

A scheduled backup still needs the restore drill run by hand periodically —
automation that is never tested is not a backup.
