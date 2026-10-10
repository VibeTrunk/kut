# AGENTS.md

Canonical instructions for every agent (Codex and Claude) in this repo.
`CLAUDE.md` imports this file; edit it here. Open work is tracked in
VibeTrunk/kut#212 (the process reset). Its plan says which rules change when.

## Project

FLUT, Football League Ultimate Team (formerly KUT), is a browser-based
collectible football-card game for Terrible Football Haarlem (TFH): real
attendance and match performance drive a card economy that players collect,
open packs of and trade. It is a tool in the [VibeTrunk](https://vibetrunk.com)
hub; `VibeTrunk/home` knows only its name, blurb and URL, so add no coupling
beyond the shared Supabase project.

- Stack: Next.js and TypeScript on Vercel (project `kut`, live at
  `https://flut.vibetrunk.com`; the legacy `kut.vibetrunk.com` redirects, ADR-139).
- Backend: the shared VibeTrunk Supabase project, schema `kut` (not `public`).
  Row-level security is on for every table, and the browser never talks to
  Postgres directly.
- Economically valuable operations (pack opening, discard, market, starter
  grant, attendance rewards) are server-authoritative: validated database
  functions or Edge Functions, never client writes to `wallets`, `user_cards`
  or `market_listings`.
- This is partly a deliberate learning project in production-grade practice:
  favour clear structure and record decisions in markdown.
- Latest hosted migration: `20261019000000_basic_pack_price_250.sql`
  (ADR-136). The `VibeTrunk/supabase` catalogue is the hosted history; older
  release records are at the tag `docs-archive-2026-10`.

## Reading: grep on demand

Start from `docs/PRODUCT.md`: per area, what the game does now and where it
lives. `docs/README.md` is the map. The old build spec, delivery log, roadmap,
bug register and ADR-001 to ADR-141 (over a megabyte) were archived at the git
tag `docs-archive-2026-10`. Do not read them in full; grep the one you need:

```powershell
git show docs-archive-2026-10:docs/BUILD_SPEC.md | rg "^## 44\."
git show docs-archive-2026-10:docs/archive/decisions-2026.md | rg "ADR-099"
```

A `BUILD_SPEC §N` or old `ADR-NNN` in the code or docs resolves that way. Open
work is in GitHub issues (`gh issue list`; labels bug, idea, next, ops).

The design is deliberately prescriptive: security and data integrity win over
convenience, and the Part L invariants in `docs/INVARIANTS.md` must never be
violated. Changing a game rule, database invariant, public API or acceptance
criterion means updating `docs/PRODUCT.md` and recording the deviation in
`docs/decisions.md`. Never silently "improve" a formula.

## Commands

- `npm run verify:fast`: policy check, format, lint, typecheck, unit tests. Run
  once per round of changes (about 7 min locally while the cleanup tests exist).
  CI runs the database, integration and browser suites, so leave those to CI.
- `npm run dev`, `npm run build`, `npm run format`, `npm run policy:sync`.
- Optional locally: `npm run test:db`, `npm run test:integration`,
  `npm run test:e2e:authenticated`. They need the local Supabase stack.
- Local stack: project id `kut`, started and stopped by the `kut-up` and
  `kut-down` PowerShell profile commands. `supabase db reset` is deny-listed,
  so apply a migration or run pgTAP with `docker exec supabase_db_kut psql`.
- Fixtures create and delete real rows, so they refuse any non-loopback target.
- Batch typecheck, lint and tests into one verification per round of changes.

## Workspace and branches

- Work only in `C:\Users\mfvan\dev\kut` (and `C:\Users\mfvan\dev\supabase`).
  The old OneDrive checkout is frozen until S8. One agent per checkout: two
  agents hold stale file state and clobber each other. Serialize them on the
  branch, or give each a `git worktree` under the ignored
  `.release-evidence/worktrees/` and merge into the PR branch.
- `main` is protected: direct pushes are rejected, even for admins. Never commit
  to `main` or force a rejected push. Branch as `feat/`, `fix/`, `docs/` and so
  on, open a PR, and squash-merge. Branches auto-delete on merge. The owner
  reviews and merges, unless they explicitly delegate it.
- Never commit, push, deploy or mutate hosted state without authorization for
  this change. One instruction such as "publish this slice" covers committing,
  pushing and opening or updating its PR. Local implementation permission alone
  does not. Do not re-ask for steps already covered.
- Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
  `test:`, or a combined one such as `docs+fix:`).
- Independent slices branch from `main`. Never stack an independent migration
  on a frontend branch. For a genuinely dependent stack, merge updated
  `origin/main` into the child after its base is squash-merged. Never
  force-push to repair it, and merge `main` into an already pushed PR branch.
- Batch freely: docs, bug-issue filings, independent small UI
  fixes, chores. Never batch anything carrying a `supabase/migrations/*.sql`,
  or any change to a Part L invariant or RPC contract: one such change per PR.
  Squash-merge makes a PR exactly one commit, so batching spends revert and
  bisect granularity.
- The agent that packages a PR reads `git diff main...HEAD` in full first.
- After publication, close out the checkout: compare local edits with merged
  main, preserve unpublished work in a named stash and a verified private
  archive, and bring the checkout onto current main without resets or broad
  discards. Keep generated previews private.

## Release

A merge to `main` deploys to production through Vercel's Git integration
(ADR-140); `docs/RELEASING.md` has the flow, the read-only check afterwards
and rollback. There is no local gate and no deployment record. The merge
authorizes nothing else: migrations, function deployments, secrets, branch
protection and other hosted changes need their own written instruction.

## Migrations and database

- Hosted migrations are catalogued and applied only from
  [`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase), because Supabase
  records migration history globally. This repo keeps matching SQL files for
  local development and tests. Never run a hosted `supabase db push` from here.
- Existing migrations are immutable. A change adds at most one migration and a
  database test (or a reviewed machine-readable exemption); the `migrations`
  job in `.github/workflows/verify.yml` enforces this (ADR-070).
- New code must degrade gracefully against the old schema (a tolerant read, a
  flag, or a catalogue push ready to follow the merge). PR #86 broke listing
  creation for about 2 hours by expecting a signature that did not exist yet.
- Views only ever gain columns, at the end. `create or replace view` cannot
  reorder or drop them, and pages read changed views with `select("*")`.
- A denied read returns zero rows, not an error. The ADR-079 member projections
  are gated on `kut.is_active_member()`, false for a bare `postgres` session:
  run `set role service_role;` first, or a query looks like data loss. After
  any access change, smoke-test as an ordinary member.
- Never flip a definer projection to `security_invoker = true` to please the
  Security Advisor: they are deliberate cross-RLS club projections, and doing so
  blacked out the Chronicle (KB-013).
- The backup tier follows what a migration can do: anything data-changing gets
  a fresh cold-verified backup.
- **Start-up check:** the nightly backup (ADR-141, `docs/BACKUP.md`) can fail
  to start without any email. At the start of a session, run
  `gh run list -w backup.yml -s success -L 1 --json createdAt`. Warn the owner
  if the last success is older than 36 hours, or if there is none once the
  backup has been set up.

## Agent safety

- PreToolUse hooks (`.claude/`, `.codex/`) block destructive commands and npm
  packages younger than 14 days. Whatever a hook enforces is non-negotiable:
  do not look for workarounds. Changing a guard needs a PR the owner asked for.
- `git commit`, `git push`, `supabase functions deploy`, `supabase db push` (real),
  `supabase db reset` and `supabase secrets set` are never auto-allowed: each
  gets a deliberate look. Read-only `supabase migration list` and
  `db push --dry-run` are allowed. Direct pushes to `main` are denied.
- Codex hooks and rules under `.codex/` need the repo to be trusted. Routine
  read-only Git checks and `npm run *` have command rules.
- Deleting files follows `docs/CLEANUP.md` (ADR-135). For ordinary named files,
  inspect, verify independent preservation, get the owner's specific approval,
  recheck, then remove only those files by literal path, with no recursive or
  force options. Protect the ordinary checkout, retained worktrees, shared
  dependencies, refs, stashes, archives and evidence. No plan, record or flag
  grants removal approval; the owner does.

## Documentation map

See `docs/README.md` for what each doc is for. Forward-looking ideas and open
defects are GitHub issues (labels idea, next, bug), not files. This repo
follows the same safety scaffold as every VibeTrunk repo (`.claude/`, `.codex/`,
`AGENTS.md`, gitleaks CI).

<!-- BEGIN:KUT-PRODUCTION-INVARIANTS -->
## Production-safety invariants

This block is generated from `policy/PRODUCTION_INVARIANTS.md`. Run
`npm run policy:sync` after changing the source; CI rejects drift.

- Every game/economy invariant in `docs/INVARIANTS.md` (Part L) must stay true.
- Never output secrets or reversible encodings of secrets.
- Database-backed test fixtures create and delete real rows and users. They refuse any non-loopback target unless an operator sets the explicit acknowledgement variable, which CI and every repository script leave unset.
- Hosted Supabase migrations are applied only from `VibeTrunk/supabase`, never from this repository. Existing migration files are immutable. A PR adds at most one migration, with a database test or a reviewed machine-readable exemption.
- New code works against the old schema until its migration is live: a tolerant read, a flag, or a catalogue push ready to follow the merge.
- Never commit or push without the owner's authorization for that change; no agent rule set auto-allows `git commit` or `git push`. A merge to `main` deploys to production (ADR-140). It authorizes nothing else: migrations, function deployments, secrets, branch protection and other hosted changes each need their own explicit yes.
- The backup route never holds write or migration rights, and the `postgres` credential never goes into GitHub (ADR-141).
- Never declare a backup successful unless its decryption key is durably retrievable and an independent restore check passes.
- Until the old local backup is retired: its credentials come from the Windows DPAPI store under `%LOCALAPPDATA%\VibeTrunk\kut\credentials` (`.env.local` is a one-off bootstrap source, never a runtime fallback); backup plaintext and database passwords never appear in process arguments or durable logs; and a backup or rekey becomes final only after a separate-process decrypt produces the expected SHA-256, never overwriting an existing backup.
<!-- END:KUT-PRODUCTION-INVARIANTS -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
