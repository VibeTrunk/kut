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
  (ADR-136). Hosted history is in `docs/DEPLOYMENTS.md`.

## Reading: grep on demand

Do not read the big docs in full. `docs/BUILD_SPEC.md`, `docs/decisions.md`,
`docs/PROGRESS.md` and `docs/DEPLOYMENTS.md` total over a megabyte. Grep for
the area you are changing (a Part L rule, an ADR number or title, a function
name) and read only those sections. `docs/README.md` is the map.

The build spec is deliberately prescriptive: security and data integrity win
over convenience, and the Part L invariants must never be violated. Changing a
game rule, database invariant, public API or acceptance criterion means
updating the spec or recording the deviation in `docs/decisions.md`. Never
silently "improve" a formula.

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
- Batch freely: docs, `KNOWN_BUGS.md` registrations, independent small UI
  fixes, chores. Never batch anything carrying a `supabase/migrations/*.sql`,
  or any change to a Part L invariant or RPC contract: one such change per PR.
  Squash-merge makes a PR exactly one commit, so batching spends revert and
  bisect granularity.
- The agent that packages a PR reads `git diff main...HEAD` in full first.
- After publication, close out the checkout: compare local edits with merged
  main, preserve unpublished work in a named stash and a verified private
  archive, and bring the checkout onto current main without resets or broad
  discards. Keep generated previews private.
- Deployment records go into the next PR for other work, never a standalone
  record PR (until S4 removes them).

## Release

The current gate in `docs/PRODUCTION_SAFETY.md` remains in force until S4,
except for ADR-140 CI-only merges. Game merges are frozen until S4. Automatic
main deployment is held (`git.deploymentEnabled = false` in `vercel.json`).
Check Vercel access early with the read-only checker in that doc: a green
preview or missing deployment record does not certify the commit serving
production. Release gates run only from the ordinary, non-linked checkout with
real `node_modules` (ADR-128). Hosted application, function deployment and
other external mutations need their own written instruction.

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

See `docs/README.md` for what each doc is for. Forward-looking ideas belong in
`docs/ROADMAP.md` (ADR-045), open defects in `docs/KNOWN_BUGS.md`. This repo
follows the same safety scaffold as every VibeTrunk repo (`.claude/`, `.codex/`,
`AGENTS.md`, gitleaks CI).

<!-- BEGIN:KUT-PRODUCTION-INVARIANTS -->
## Production-safety invariants

This block is generated from `policy/PRODUCTION_INVARIANTS.md`. Run
`npm run policy:sync` after changing the source; CI rejects drift.

- Never output secrets or reversible encodings of secrets.
- One migration- or invariant-bearing feature is allowed per PR or independently reviewable change slice.
- Never deploy when a required release gate has not run successfully for the exact candidate SHA, except as ADR-140 states for CI-only merges and the one-off merge of its gate-removal PR.
- Never declare an encrypted backup successful unless its credential is durably retrievable and an independent recovery check passes.
- The owner's merge of a reviewed PR into main authorizes release and Vercel production deployment of that exact resulting SHA, conditional on the full production gate passing first, except for documentation-only and CI-only merges. For any other merge, the agent runs the gate, records approval, asserts evidence and deploys without another confirmation. This does not authorize migration application, Supabase function deployment, branch-protection changes, secret changes or other external mutations.
- A merge changing only documentation needs no release gate or deployment unless the owner asks for that release. A CI-only merge (ADR-140) is treated the same way: its complete diff touches only `.github/**`, `tests/**`, `playwright*.config.ts`, `scripts/ci/**` or documentation. Production may lag main by such commits; state that explicitly in the PR and `docs/DEPLOYMENTS.md`. Review the complete diff: any other executable or configuration change, including `package.json`, the lockfile, `src/**`, `supabase/**`, `next.config.ts` and `vercel.json`, is neither documentation-only nor CI-only. Full main CI remains required under ADR-126; any requested deployment still needs the full gate for its exact SHA.
- One-off exception (ADR-140): the owner's merge of the process-reset PR that deletes the release gate authorizes Vercel's Git integration to deploy that exact SHA without the old gate. Until that merge, an urgent game fix uses the old gate from the ordinary checkout `C:\Users\mfvan\dev\kut` only.
- Deployment records accompany the next PR opened for other work, never a standalone record PR. Release gates run only from the ordinary, non-linked checkout with real `node_modules` (ADR-128); the exact candidate SHA and clean checkout are separate requirements.
- Hosted Supabase migrations are applied only from `VibeTrunk/supabase`, never from this repository. Existing migration files are immutable; a change may add at most one migration and must include a database test or reviewed machine-readable exemption.
- A production candidate is one exact 40-character commit SHA. Every gate artifact and external check must name that SHA; skipped, stale, cancelled, missing, or mismatched evidence fails closed.
- Production-sensitive work, including the release gate, runs in the owner's ordinary agent session. There is no production launcher or session receipt, and the gate does not certify which model ran it (ADR-108).
- Committing, pushing, and deploying are per-change authorization decisions, never standing permissions. No agent rule set auto-allows `git commit`, `git push`, or a Supabase function deployment.
- Database-backed test fixtures create and delete real rows and users. They refuse any non-loopback target unless an operator sets the explicit acknowledgement variable, which CI and every repository script leave unset.
- Production credentials are retrieved by stable locator from the Windows DPAPI store under `%LOCALAPPDATA%\VibeTrunk\kut\credentials`. `.env.local` is an explicit, interactive bootstrap source only and is never a runtime fallback.
- Backup plaintext and database passwords never appear in process arguments or durable logs. Encryption and cold verification run in separate child processes that independently retrieve credentials.
- A backup becomes final only after a separate-process decrypt produces the expected plaintext SHA-256. Failure removes only the new pending candidate and never overwrites or bulk-deletes existing backups.
- Rekeying always writes a new staged candidate. It verifies old and new plaintext hashes in separate processes and never overwrites the source backup.
- The release gate is fail-closed and does not deploy. It requires the merge gate, secret scan, dependency scan, database and concurrency suites, authenticated mobile E2E, finalizer readiness, migration/catalogue parity, and a cold-verified backup.
- Every game/economy invariant in `docs/BUILD_SPEC.md` Part L remains part of the canonical product regression checklist and must stay true.
<!-- END:KUT-PRODUCTION-INVARIANTS -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
