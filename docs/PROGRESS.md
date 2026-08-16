# Current phase

Phase 0 — Foundation (local implementation complete)

# Completed

- Next.js 16 App Router application with strict TypeScript, Tailwind CSS, and
  ESLint.
- Local Supabase CLI configuration, an initial `kut` schema migration, and a
  pgTAP schema smoke test.
- Vitest unit-test and Playwright end-to-end-test foundations.
- `verify:fast` and `verify:full` scripts.
- GitHub Actions verification workflow alongside the existing gitleaks scan.
- Local development, environment, and verification instructions in README.

# In progress

Vercel preview deployment is pending explicit authorization and project setup.

# Tests currently passing

- `npm run verify:fast`
- `npm run test:e2e` (Chromium)
- `npm run test:db` (local pgTAP)
- `npm run verify:full`

# Known failures

- None known.

# Local environment notes

- The host's npm safety policy reports deferred install scripts for `esbuild`,
  `supabase`, and `unrs-resolver`. All Phase 0 checks pass without approving
  them. Do not approve package scripts without reviewing them first.

# Next recommended task

Phase 1A, first slice: implement the players, seasons, profiles,
match-sessions, attendance, and player-season-state migrations with RLS and
fictional test fixtures. Do not begin invitation onboarding or the economy
until those data/security foundations and the rating engine pass tests.

# Manual setup still required

- Link this repository to the shared Supabase project only when ready to
  inspect/deploy migrations. Never run a real `supabase db push` without
  deliberate approval.
- Replace the placeholder Supabase host in `vercel.json` after the project
  reference is known.
- Create/link the Vercel project and deploy a preview only with explicit
  authorization.

# Database migrations added

- `20260816000000_create_kut_schema.sql`

# Environment variables added

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; pre-existing contract retained)

## Phase 1A update — 2026-08-16

This update supersedes the Phase 0 status above. The first Phase 1A slice is
complete: players, profiles, seasons, sessions, attendance, and derived
player-season state are migrated in the `kut` schema; RLS denies anonymous
roster access and limits writes to enabled admins; the deterministic rating
engine has 13 unit tests and a fictional player-ratings preview.

The next recommended slice is the admin-only session publish/rebuild
operation and mobile attendance form. Keep invite onboarding and the economy
out of scope until that operation has passing database and integration tests.

Additional migration: `20260816010000_phase_1a_roster_and_ratings.sql`.

## Attendance-flow update — 2026-08-16

Added the mobile attendance interface at `/admin/attendance` and a protected
database foundation for `publish_session` and `rebuild_season`. The interface
is an interaction preview only: it does not mutate data until Supabase SSR
authentication and a local admin account are implemented. Both functions
require an enabled admin role, publish only draft sessions, and rebuild all
player-season state from published history.

Additional migration: `20260816020000_publish_and_rebuild_sessions.sql`.
The next required slice is SSR email/password sign-in for manually provisioned
local admins, followed by wiring this form to those server-authoritative
operations. Invite claim onboarding remains later work.
