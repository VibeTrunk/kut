# KUT handoff

Date: 2026-08-17

## Current state

KUT is a **feature-complete MVP, live in production** at
`https://kut.vibetrunk.com` (see "Hosted deployment update" below). The local
Supabase stack has migrations applied through:

`20260817030000_private_live_ratings.sql`

The normal Next development server was deliberately stopped at the end of the
last session so that `next build` could clear the generated `.next` output.
Start it again with:

```powershell
npm run dev
```

The local database stack can remain running; if it is not, start it with:

```powershell
npx supabase start
npx supabase migration up --local
```

The first alpha-readiness slice is also complete: signed-in members now have
a visible current-device Sign out control on the core member and admin
screens, and all visible currency wording uses **KUT Coins**. This was a
copy/auth UI change only; it did not alter migrations, ledger fields, economy
rules, or historical records.

KUT is now fully member-only: unauthenticated visits to the root route go to
the login page, and anonymous database callers cannot read Live Ratings.

## Implemented product flow

## Hosted deployment update - 2026-08-17

KUT is now live at `https://kut.vibetrunk.com`. The production Vercel project
has its hosted Supabase environment values configured, and the shared
Supabase project's `kut` schema has all 25 KUT migrations through
`20260817030000_private_live_ratings.sql` applied.

Before the schema change, a verified encrypted logical export was created and
its temporary plaintext files were removed. Hosted migration history is now
owned by [`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase), which
contains the Cogitster deployed baseline and KUT's applied migrations. Do not
run hosted migrations from this repository; retain its migration files for
local tests only.

- Member-only Live Ratings derived from published attendance.
- Admin-only attendance publication, correction, cancellation, and
  reactivation, with audit history and deterministic rating rebuilds.
- Invite-only member onboarding and local admin-assisted password resets.
- Wallet/immutable ledger, one-time starter grant, attendance rewards, Live
  editions, Card Copies, pack opening, and discard.
- Private My Club and individual card details.
- Atomic 24-hour buy-now market: listing, cancellation, purchase, 5% tax,
  seller name, Club Value, and leaderboard.
- Private Message Center for market purchases/sales; seller messages name the
  buyer. Existing local market sales were backfilled into the inbox.
- Safe route-level loading, error, and not-found screens.

## Next operational step

Set up KUT's first real playing context in the protected admin UI: create the
real TFH player roster, create and mark the current season active, then issue
member invitations. Do not use fictional local/CI seed data for the hosted
roster.

## Last verification

The final command run was:

```powershell
npm run verify:full
```

It passed (2026-08-29, ahead of the ADR-027/028/029/030 deploy):

- lint and TypeScript checks;
- 28 unit tests;
- 217 local database/pgTAP tests (4 files);
- 17 Chromium browser tests, including two 390px phone-viewport checks;
- production build (24 routes, incl. `/how-it-works`, `/players`,
  `/players/[slug]`, `/settings/card`, `/admin/links`).

## Documentation to read first

1. `CLAUDE.md`
2. `docs/BUILD_SPEC.md`
3. `docs/PROGRESS.md`
4. `docs/decisions.md`
5. `docs/MVP_HARDENING_PLAN.md`
6. `docs/SECURITY_REVIEW.md`
7. `docs/OPERATIONS.md`

Then inspect `git status`. The cumulative MVP work is committed and pushed to
`main`. Preserve unrelated user files—especially `supabase/snippets/`—and do
not reset, clean, or overwrite the working tree.

## Known gaps before a real alpha

1. **Manual signed-in mobile review:** _done (2026-08-29)._ `npm run verify:full`
   and a signed-in narrow-viewport click-through of Home, Collection, Market,
   Messages, the admin tab strip, and the new `/how-it-works`, `/players`, and
   `/settings/card` pages were completed.
2. **Hosted setup:** backup, Supabase migration dry-run, hosted Auth settings,
   Vercel environment variables, CSP host replacement, and preview deployment
   are intentionally not done. Follow `docs/OPERATIONS.md` only with explicit
   approval.
3. **Git:** the MVP work is committed and pushed. Do not force-push or deploy
   further changes without user authorization.

## Recommended next phases

### Phase A — Alpha readiness and operational safety

1. Complete the signed-in mobile review.
2. Follow the backup and preview checklist. Use local Supabase for development
   and a Vercel preview first; do not let previews apply database migrations.

Assessment: all recommended. A separate always-on hosted test environment is
useful only once multiple people regularly change the app. For now, local
Supabase plus preview deployments is the simpler and safer test environment.
If a hosted test environment is later needed, use a separate Supabase project
or branch with fictional data—not the shared production project.

### Phase B — Navigation and product clarity

1. Create a consistent authenticated navigation system:
   - desktop top/side navigation;
   - mobile bottom navigation for Live Ratings, My Club, Packs, Market, and
     Messages;
   - one overflow/admin menu for Leaderboard, account actions, and admin tools.
2. Add an **How KUT works** page covering attendance, Live ratings, rarity,
   cards, packs, discard, market tax, Club Value, and Message Center.
3. Link contextual explanations from pack opening, card detail, market, and
   attendance screens rather than putting all explanation in one long page.

Assessment: strongly recommended. Navigation and clarity are more valuable to
early members than adding another game mechanic.

### Phase C — Safer admin testing tools

Add a **development-only** coin grant tool first. It must never be a casual
production "give coins" button. If it later exists in production, require a
superadmin, a reason, a strict cap, an immutable `admin_correction` ledger
entry, and an audit view. Prefer testing with local/fictional accounts.

Assessment: useful for local testing, but risky in production if it can mint
unexplained currency. The existing ledger is the correct foundation.

### Phase D — Visual and collection experience

1. Improve graphics incrementally: polish CSS card frames, typography, empty
   states, and small motion before adding large bitmap assets.
2. Build the **My Club album** view as a Panini-style folder/sticker album.
   Group Card Copies by edition, display a clear duplicate stack/count, and
   keep the current grid/detail view as an efficient management mode.
3. Add a **My Card profile photo** feature only after a privacy/storage design:
   private authenticated uploads, image type/size limits, consent, deletion
   path, crop/position metadata, RLS-protected Supabase Storage, and a safe
   fallback.
   _Built 2026-08-29 (ADR-027):_ `/settings/card` — square pan/zoom crop, a
   private `player-photos` bucket with folder-scoped `storage.objects` RLS,
   5 MiB / raster-only limits, a remove path, and the initials/jersey
   fallback. Consent is implicit for the invite-only group; a formal consent
   toggle and admin photo moderation are still open. Local-only until the
   `20260830000000` / `20260831000000` / `20260901000000` migrations are
   deployed together as one ADR-021 batch (`verify-catalog.ps1` then expects
   "matches 33"; the batch touches the `storage` schema and widens
   `public_live_ratings` / `my_collection_cards` / `club_value_leaderboard` —
   rollback DDL is in each migration header).
4. Build out the **Player directory** (`src/app/(app)/players/page.tsx`) into
   the real searchable full roster it was always meant to be.
   _Built 2026-08-29 (ADR-027):_ `/players` is now a query / rarity /
   archetype / sort roster over the new `kut.player_directory` view, and
   `/players/[slug]` is a per-player profile. **Still to do:** stop using Home
   as the de facto full roster and show a small curated set there (e.g. 5
   most-improved cards this week) linking out to the directory.
   Noted 2026-08-19 from user feedback during the alpha mobile click-through.

Assessment: album/duplicate stacking is recommended and largely reuses the
existing Card Copy data. Better graphics are recommended if they remain
CSS/data-driven. User photo upload is feasible but should not be rushed: it
creates privacy, storage, moderation, and mobile-upload responsibilities. The
directory/Home split is a natural fit once the directory is built, since Home
already leans on the "browse from Home" workaround as a crutch.

### Phase E — Community contribution mechanics (design before build)

Ideas: washing bibs and being among the first 10 to sign up for a session.

Do **not** directly add these to the football-performance Live Rating without
an explicit design decision. It would mix football ability with volunteering
or speed of registration, be hard to verify fairly, and make ratings less
understandable.

Safer alternatives:

- award a small, capped KUT Coin bonus;
- award a separate Community Contribution badge/cosmetic;
- use a short, clearly labelled temporary boost rather than permanent rating;
- have an admin record verified contributions with a reason and audit trail;
- define caps, eligibility, anti-favoritism rules, and correction policy before
  implementing anything.

Assessment: good community-engagement ideas, but ill-advised as hidden or
permanent rating modifiers. Make them transparent, bounded, and auditable—or
keep them out of the economy until the group agrees on fair rules.

### Phase F — Message Center expansion

Add attendance-reward, pack-opened, invitation/admin, and account-recovery
messages using the current private, append-only notification pattern. Keep
each event generated inside the relevant server-authoritative transaction.

Assessment: recommended after navigation/clarity. It is a clean extension of
the current market-message implementation.

## Guardrails for the next agent

- Read the documents listed above before editing code.
- Use migrations for every schema change. Apply only to local Supabase unless
  the user explicitly authorizes a hosted change.
- Preserve RLS and server-authoritative economy writes; never expose the
  service-role key to the client.
- Use `apply_patch` for edits; do not use destructive git commands.
- Run `npm run verify:fast` for a small change and `npm run verify:full` before
  declaring a phase complete.
- Update `docs/PROGRESS.md` and `docs/decisions.md` whenever a game rule,
  database invariant, or public projection changes.
