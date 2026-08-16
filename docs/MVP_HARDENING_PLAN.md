# MVP hardening plan

Date: 2026-08-17

## Goal

Make the completed local MVP reliable and understandable in normal use before
any hosted deployment. This phase does not add new game-economy rules and does
not deploy KUT or apply migrations to the shared hosted Supabase project.

## Scope and sequence

1. **Resilient routes**
   - Add user-safe route error, not-found, and loading states.
   - Keep technical error details in server logs only.
   - Review authenticated pages for clear empty states and safe recovery links.

2. **Mobile usability**
   - Make the key authenticated navigation wrap and remain touch-friendly.
   - Add Playwright coverage at a phone viewport for the public page and
     protected-route sign-in boundary.
   - Manually verify My Club, Market, Messages, and admin attendance at a
     narrow viewport using the local app.

3. **Security and integrity review**
   - Re-run the database RLS/invariant suite.
   - Review all browser-accessible mutations to confirm they use validated
     server actions and database RPCs.
   - Add a repeat-purchase notification assertion so a retry cannot create
     duplicate messages. A true simultaneous-buy test remains a follow-up
     because it needs two independent authenticated database sessions.

4. **Production-readiness documentation**
   - Document pre-deploy environment variables, a migration dry-run, and a
     deliberate preview-deployment checklist.
   - Document a repeatable backup/export procedure and recovery expectations.
   - Do not run a hosted migration, connect Vercel, or deploy without explicit
     user authorization.

5. **Verification and handoff**
   - Run `npm run verify:full` locally.
   - Summarize remaining manual checks and the required authority for preview
     deployment.

## Acceptance criteria

- A user sees a safe recovery page instead of a raw runtime error.
- Key pages have a loading state and clear empty-state language.
- Mobile browser tests pass and key controls remain usable at 390px width.
- RLS/invariant tests, unit tests, browser tests, and production build pass.
- No service-role key, password, invitation token, or raw database error is
  rendered to a user or added to client-side code.
- Backup and deployment steps are documented but not executed.
