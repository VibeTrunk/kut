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

By default the workers retrieve `backup-encryption-v1` and `hosted-db-v1`
from the current Windows user's DPAPI store. Import `.env.local` only through
the explicit bootstrap command in `docs/PRODUCTION_SAFETY.md`. For a manual
emergency run, pass `-Interactive`; encryption and cold verification then ask
for the passphrase separately.

The script:

1. Starts a short-lived worker that independently retrieves both credentials.
2. Passes the database password to the Supabase child only through that
   worker's environment — never process arguments or logs.
3. Dumps schema DDL and data, concatenates them, hashes the plaintext, encrypts
   to a `.pending` candidate, deletes plaintext, and exits.
4. Starts a different worker, which retrieves the passphrase independently,
   decrypts to a new temporary file, and compares the plaintext SHA-256.
5. Atomically publishes the candidate only after the cold check passes. A
   failure removes only that pending candidate; existing backups are untouched.
6. Writes nonsecret locator/hash evidence to the gitignored backup log and
   `latest-backup-evidence.json` for the production gate.

The cipher remains AES-256-CBC + HMAC-SHA256 with PBKDF2 600k. `-OutDir`
must be outside the repository. There is no skip-verification switch.

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

Last drill: 2026-09-15 against `kut-backup-20260915-225752` — passed, `psql`
exit 0, zero errors, 33 players / 22 profiles / 513 user_cards / 41
trade_offers. First drill against the post-ADR-042 schema; the previous one
(2026-08-30, `kut-backup-20260830-104303`) predated trade offers.

For a **real** disaster recovery (not a drill) you would restore into a
project that already has the matching `auth.users` rows (from the Supabase
dashboard backup), then replay this dump **without** the `replica` setting so
foreign keys are enforced.

### The circular foreign key, and why it only matters in real DR

Since ADR-042, `pg_dump` warns on every backup:

```
warning: there are circular foreign-key constraints among these tables:
detail: user_cards
detail: trade_offers
```

`kut.user_cards.held_by_offer_id` references `kut.trade_offers`, which
references `kut.user_cards` back. A `--data-only` dump cannot order the two
`COPY` blocks so that both sides are satisfied as they load.

The **drill** never hits this, because step 4 sets
`session_replication_role = replica` and that suspends FK triggers. Real DR
replays with foreign keys live, which is exactly where the cycle bites — and
only when a card is genuinely escrowed in an open offer, i.e.
`held_by_offer_id is not null` for at least one row. That count was **0** at
the 2026-09-15 drill, so that backup restores cleanly either way. That is a
property of the data on the day, not a guarantee.

**Every backup now records that count**, so this is no longer something to
work out mid-recovery. `scripts/internal/new-kut-backup-candidate.ps1` counts
rows in the dump's own `kut.user_cards` `COPY` block whose `held_by_offer_id`
is not `\N`, and `BACKUP_LOG.md` carries the answer on the entry:

```
- Cards escrowed in open offers: 0 - the ADR-042 circular foreign key cannot
  bite, so this dump replays with foreign keys live
```

A non-zero count says the replay needs deferred or suspended FK checks. The
literal string `unknown` means the dump predates ADR-042 and carries no
`held_by_offer_id` column at all. The count is taken from the dump that was
encrypted, not from a separate query, so it describes *that* backup rather
than the database at some nearby moment.

The proper fix is to stop depending on the count: make both sides of the cycle
`DEFERRABLE INITIALLY IMMEDIATE` so a restore can `SET CONSTRAINTS ALL
DEFERRED` inside its transaction and satisfy the cycle at commit **with
foreign keys enforced** — strictly better than `session_replication_role =
replica`, which suspends enforcement and can load genuinely broken data
silently. That needs its own migration, and it was considered and declined on
2026-09-23: the fix only pays off in a real recovery that meets a non-zero
escrow count, and the recorded count plus the procedure below already covers
that case.

So before a real restore, check the recorded escrow count. If it
is non-zero, replay with `--disable-triggers` semantics — the same
`set session_replication_role = replica` the drill uses — and then re-enable
and validate, rather than discovering the failure halfway through recovery:

```sql
-- after restoring, with replication role back to 'origin'
select count(*) from kut.user_cards uc
  where uc.held_by_offer_id is not null
    and not exists (select 1 from kut.trade_offers t where t.id = uc.held_by_offer_id);
-- must be 0; anything else means escrow rows were lost
```

## Cadence

- **Now:** one fresh backup + one restore drill before the first invite.
- **Ongoing:** a fresh run before every **data-changing** hosted migration
  (see the risk-tiered checklist in `docs/OPERATIONS.md`; additive migrations
  ride on the last scheduled backup), and on a schedule matched to activity —
  at least weekly once real members are trading, ideally right before each
  Friday session.
- Re-run the restore drill roughly monthly, or any time the schema changes
  shape significantly.

### Scheduled unattended run

Run `scripts/backup-kut-hosted.ps1` as the same Windows account that performed
the DPAPI bootstrap. DPAPI binds each locator to that account and machine, so a
different task identity cannot decrypt it. A scheduled backup still needs the
restore drill run by hand periodically — automation that is never tested is
not a backup.

### Rekey

Store the replacement under a new locator (normally `backup-encryption-v2`),
then run:

```powershell
powershell -NoProfile -File scripts/rekey-kut-backup.ps1 `
  -SourcePath C:\backups\kut\kut-backup-....sql.enc
```

Rekey writes a new candidate, separately decrypts both old and new ciphertext,
and publishes only when their plaintext hashes match. It never overwrites or
bulk-rewrites existing backups. Keep the old locator and old backup until the
new generation has passed the periodic restore drill.
