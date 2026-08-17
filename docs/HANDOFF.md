# KUT handoff

Date: 2026-08-17

## Current state

KUT is a **local-only, feature-complete MVP**. It has not been linked to a
hosted Supabase project, connected to Vercel, deployed, or pushed to a remote.
The local Supabase stack has migrations applied through:

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

## Last verification

The final command run was:

```powershell
npm run verify:full
```

It passed:

- lint and TypeScript checks;
- 20 unit tests;
- 145 local database/pgTAP tests;
- 11 Chromium browser tests, including two 390px phone-viewport checks;
- production build.

The only build interruption was a stale `next dev` process holding `.next`
files. It was stopped, the build then passed, and generated `.next` artifacts
were safely rebuilt. OneDrive's delete prompt concerned those generated files,
not source code or local database data.

## Documentation to read first

1. `CLAUDE.md`
2. `docs/BUILD_SPEC.md`
3. `docs/PROGRESS.md`
4. `docs/decisions.md`
5. `docs/MVP_HARDENING_PLAN.md`
6. `docs/SECURITY_REVIEW.md`
7. `docs/OPERATIONS.md`

Then inspect `git status`. The working tree contains the cumulative local MVP
work and is not committed. Preserve unrelated user files—especially
`supabase/snippets/`—and do not reset, clean, or overwrite the working tree.

## Known gaps before a real alpha

1. **Manual signed-in mobile review:** automated phone checks cover public and
   auth-boundary pages. Manually check My Club, Market, Messages, and admin
   attendance at a narrow viewport while signed in.
2. **Hosted setup:** backup, Supabase migration dry-run, hosted Auth settings,
   Vercel environment variables, CSP host replacement, and preview deployment
   are intentionally not done. Follow `docs/OPERATIONS.md` only with explicit
   approval.
3. **Git:** review and commit the local work before any deployment. Do not
   push or deploy without user authorization.

## Recommended next phases

### Phase A — Alpha readiness and operational safety

1. Commit the completed local MVP after reviewing the working tree.
2. Complete the signed-in mobile review.
3. Follow the backup and preview checklist. Use local Supabase for development
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
   fallback. Show the approved cropped round image on cards.

Assessment: album/duplicate stacking is recommended and largely reuses the
existing Card Copy data. Better graphics are recommended if they remain
CSS/data-driven. User photo upload is feasible but should not be rushed: it
creates privacy, storage, moderation, and mobile-upload responsibilities.

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
