# Operations and deployment checklist

KUT is live at `https://kut.vibetrunk.com`. This document covers alpha
operations; following it does **not** itself authorize a hosted schema change.

## Shared migration authority

The shared Supabase project has one global migration ledger. Hosted schema
changes must be catalogued, reviewed, backed up, dry-run, and applied only
from [`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase). KUT keeps
matching migration files only so its local stack and database tests reproduce
the hosted schema. Do not run a hosted `supabase db push` from this repository.

## Hosted migration process (risk-tiered)

There is **no PITR and no managed backup** on the shared project's plan
(`docs/BACKUP.md`), so the encrypted logical dump is the only way back to a
known-good state. That makes a pre-migration backup load-bearing — but only
for migrations that can actually lose data. Classify every migration first,
then run the matching checklist. When unsure, treat it as data-changing.

- **Additive** — new table / view / function, `create or replace` of a
  function or view, a new column with a default or nullable, a new index, a
  new `check`/enum value. Nothing existing is rewritten or dropped.
- **Data-changing** — a backfill `update`/`delete`, `drop`/`rename`/retype of
  a column, anything that triggers a rating rebuild (e.g. reassigning an
  existing player's archetype), or any change to `wallets`, `wallet_ledger`,
  `user_cards`, `market_listings`, or `market_sales` semantics.

Always, both tiers:

1. Confirm the shared Supabase project and database branch in scope. KUT uses
   the `kut` schema and must not affect other VibeTrunk schemas.
2. Matching reviewed migration files exist in **this** repo and in the
   `VibeTrunk/supabase` catalogue (ADR-021); catalogue parity check passes.
3. `npx supabase db push --dry-run` reviewed line by line.
4. Local `npm run verify:fast && npm run test:db` passes. CI's `verify`
   workflow runs the rest on every PR (`build`, `test:e2e`, and `test:db`
   against a fresh local stack) — running `verify:full` locally per migration
   is not required.
5. Explicit sign-off, then the real push from `VibeTrunk/supabase` only.

Data-changing tier also requires, before the push:

6. A **fresh** `scripts/backup-kut-hosted.ps1` run (not just the last
   scheduled one), its timestamp recorded in `.private-backups/BACKUP_LOG.md`.
7. Write the migration to be reversible in SQL where practical — add a column
   instead of mutating one, or snapshot pre-state into a scratch table in the
   same migration — so a bad outcome is a one-line rollback, not a restore.

Additive tier relies on the most recent **scheduled** backup instead of a
fresh one. Keep that cadence tight (see `docs/BACKUP.md` — at least weekly
once members trade, ideally right before each session) so "most recent
scheduled backup" is never stale. Residual risk accepted: an additive
migration that breaks in a way a follow-up migration cannot cleanly fix would
fall back to that scheduled backup, losing whatever happened since.

The restore drill (`docs/BACKUP.md`) is **periodic, not per-migration** — run
it before the first real invite, then roughly monthly or whenever the schema
changes shape significantly.

Git migrations are necessary but are **not** a backup of user accounts,
wallets, cards, sessions, or market history.

## Preview deployment preflight

1. Run `npm run verify:full` locally with Docker running.
2. Review `docs/SECURITY_REVIEW.md` and resolve or consciously accept the
   remaining local two-client market-race check.
3. In the central migration repository only, link the intended hosted
   Supabase project after confirming its project reference. Run the catalogue
   parity check and `npx supabase db push --dry-run`; review every listed
   migration. Do not run the real push without explicit approval and a fresh
   backup.
4. In Vercel, configure Preview and Production environment values separately:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `APP_URL`. The service-role key is server
   only and must never use a `NEXT_PUBLIC_` prefix.
5. _Stale._ The CSP now lives in `src/proxy.ts`, not `vercel.json`
   (`vercel.json` no longer has a `Content-Security-Policy` header at all).
   `src/proxy.ts` derives `connect-src` / `img-src` from
   `NEXT_PUBLIC_SUPABASE_URL` at request time, with a hosted-project fallback,
   so no manual host substitution is needed — just make sure the updated
   `src/proxy.ts` ships with any change that adds a new CSP source (e.g. the
   `img-src blob: <supabase>` addition for player-card photos).
6. Confirm hosted Supabase Auth disables public self-sign-up and configure
   approved redirect URLs for the preview and production domains.
7. Deploy a preview only after explicit authorization. Do not make preview
   deploys run database migrations automatically.
8. Smoke-test invite claim, member sign-in, admin attendance publish, pack
   opening, discard, market buy/sell, messages, and mobile navigation using
   fictional accounts before inviting real members.

## Follow-ups

- **Resolved 2026-09-02.** The redirect URL allow-list previously included
  `https://*-vibetrunk.vercel.app/**`, scoped to the whole `vibetrunk` Vercel
  team rather than just KUT's own previews, which made any preview deployment
  under that team a valid auth-redirect target for KUT sessions. It has been
  narrowed to `https://kut-*-vibetrunk.vercel.app/**` ahead of the wide launch.
  The list now holds exactly three entries: production, that KUT preview
  pattern, and `http://localhost:3000/**` for local development against the
  hosted project.
- Re-confirmed 2026-09-02 alongside that change: public self-sign-up is
  disabled, anonymous sign-ins are disabled, Email is the only enabled auth
  provider, and the Site URL is `https://kut.vibetrunk.com`.
- The hosted **"Confirm email" toggle is on, and that is fine.** Invited
  accounts are created through the service-role admin API with
  `email_confirm: true` (`src/app/invite/[token]/actions.ts`), so they are
  pre-confirmed and no mail is ever attempted; the toggle only gates the public
  sign-up path, which is disabled. Do not read it as a launch risk — but do not
  turn *off* self-sign-up protection thinking the toggle compensates, either.

## Member support runbooks

Written for the wide TFH launch (ADR-050). Both procedures are manual by
design: KUT has no self-service password recovery and no admin photo tooling,
and both gaps were accepted knowingly rather than overlooked.

### Password recovery (the only recovery path)

KUT holds **no real email address for any member**. Sign-in is by self-chosen
username, mapped to a synthetic address on the non-routable domain
`users.kut.local` (`src/lib/auth/username.ts`). There is nowhere to send a reset
link, so every forgotten password is handled by an admin by hand. This is not a
gap waiting on SMTP — see ADR-050's amendment.

**When a member says they are locked out:**

1. **Confirm who they are** out of band. A WhatsApp message from their own
   number is enough for this group; the point is that whoever asks is the person
   who owns the account, because this procedure hands out a working credential.
   Do not act on a request relayed by someone else.
2. **Get their username**, not their display name. If they cannot remember it,
   find it at `/admin/links`, which lists every profile with its username and
   linked player.
3. Go to **`/admin/accounts`**, pick the member, enter a **new temporary
   password of at least 12 characters**, and write a **reason** (3–500
   characters — it is stored in the audit trail, so make it meaningful:
   "forgot password, confirmed by WhatsApp DM 2026-09-05").
4. Submit. The action writes an audit row through `create_password_reset_event`,
   changes the password via the service-role admin API, then closes the audit
   row with `complete_password_reset_event`. A failed attempt is recorded too.
5. **Send the temporary password by DM only.** Never in the group chat, and
   never alongside the username in the same message if you can avoid it.
6. **Tell them to change it** at `/settings` once they are back in.

**Notes and failure modes.**

- Disabled accounts are not listed at `/admin/accounts`, and the RPC refuses
  them — "This reset is not allowed for that account" usually means the profile
  is disabled, not that you mistyped.
- "Password changed, but its audit record needs review before another reset"
  means the password *did* change but the audit row did not close. The member
  can sign in; check `kut.password_reset_events` before doing another reset for
  the same person.
- The last ten resets are shown on the page. Skim them occasionally — a member
  needing frequent resets is a sign of a shared or forgotten username rather
  than a security problem.
- Only enabled admins can do this, and every attempt is attributable. Do not
  work around a failure by editing `auth.users` directly.

### Removing a player card photo

Members upload their own card photo at `/settings/card`. There is **no admin UI
to remove someone else's** — ADR-027's consent toggle and moderation surface are
still open roadmap items — so a takedown is done by hand. Two things must
happen, in this order.

**First, ask the member to remove it themselves.** `/settings/card` has a clear
action that calls `set_own_player_photo(null)`. For anything short of an urgent
problem this is the right route: it is one message, it leaves them in control of
their own card, and it does both steps below correctly.

**If that is not appropriate or not fast enough:**

1. **Clear the pointer.** In Supabase Studio, against the `kut` schema:

   ```sql
   update kut.players set photo_path = null where slug = '<player-slug>';
   ```

   `kut.players.photo_path` is the source of truth. Nulling it removes the photo
   from every surface — card faces, the album, the directory, the market — on
   the next page load.

2. **Delete the object.** Storage → `player-photos` bucket → delete
   `players/<player_id>/profile.webp`. Step 1 alone hides the photo; only this
   step removes the file.

**Timing note.** The bucket is private and images are served as **signed URLs
with a one-hour TTL** (`src/lib/player-photos.ts`). Clearing `photo_path` stops
new URLs being minted immediately, but a URL already handed to a browser stays
valid until it expires. For an ordinary "I don't like my photo" this is
irrelevant; for a genuine takedown, do step 2 and know the object may still be
fetchable through an outstanding link for up to an hour.

**Record what you did and why**, at least in the launch notes — there is no
audit table for photo actions, unlike password resets.

## Alpha operations

- Start with 5–10 trusted members and one or two weeks of sessions.
- Monitor the admin economy view, failed-action logs, market liquidity, and
  member feedback; do not change formulas after a single unusual outcome.
- Keep the local migration/test workflow working. Every hosted schema change
  must first exist as matching reviewed files in KUT and the central catalogue,
  and pass locally before central deployment. Run it through the risk-tiered
  checklist above.
- Run `scripts/backup-kut-hosted.ps1` on a regular schedule appropriate to the
  group’s activity (at least weekly once members trade). A **fresh** run is
  additionally required before a data-changing migration; an additive
  migration rides on the last scheduled backup. Run the
  [`docs/BACKUP.md`](BACKUP.md) restore drill once before the first real
  invite, then periodically — not per migration.
