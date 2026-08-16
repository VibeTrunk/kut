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
