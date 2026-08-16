# Kelderklasse Ultimate Team (KUT)

A browser-based collectible football-card game for Terrible Football
Haarlem (TFH): real attendance and match performance drive a card economy
players collect, open packs of, and trade. Part of the
[VibeTrunk](https://vibetrunk.com) hub.

This repo currently holds only the agent-safety/security scaffold — no
application code yet. Start with [`CLAUDE.md`](CLAUDE.md) for project
context, then [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) for the full
product and technical specification, and [`docs/decisions.md`](docs/decisions.md)
for why this repo looks the way it does (including open items still to be
resolved before implementation starts).

## Status

Phase 0 is complete locally. KUT is not yet deployed. Target:
`kut.vibetrunk.com`, deployed as its own Vercel project, using the shared
VibeTrunk Supabase project's `kut` schema.

## Current foundation

KUT now has a Next.js application, local Supabase configuration, Vitest,
Playwright, database smoke testing, and CI. Read [CLAUDE.md](CLAUDE.md),
[docs/BUILD_SPEC.md](docs/BUILD_SPEC.md), and [docs/PROGRESS.md](docs/PROGRESS.md)
before implementation work.

## Local development

Prerequisites: Node.js 20.9+ and Docker Desktop running.

```powershell
npm ci
npx supabase start
npm run dev
```

The local Supabase stack is independent from the shared hosted project. Use
the local stack for migrations and tests; do not point automated tests at the
production database.

## Verification

```powershell
npm run verify:fast  # lint, typecheck, unit tests
npm run test:e2e     # requires Playwright Chromium once installed
npm run test:db      # requires `npx supabase start`
npm run verify:full  # all checks plus production build
```

Install the local browser once with:

```powershell
npx playwright install chromium
```

## Environment

Copy `.env.example` to `.env.local` and add only the browser-safe Supabase
URL/publishable key when the app begins using Supabase. Keep the service-role
key server-only, never commit it, and never expose it through a
`NEXT_PUBLIC_` variable.
