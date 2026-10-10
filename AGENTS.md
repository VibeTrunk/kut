# AGENTS.md

Canonical instructions for every agent (Codex and Claude) in this repo.
`CLAUDE.md` imports this file; edit it here. Open work is tracked in
VibeTrunk/kut#212 (the process reset). Its plan says which rules change when.

## Project

FLUT, Football League Ultimate Team (formerly KUT), is a browser-based
collectible football-card game for Terrible Football Haarlem (TFH): real
attendance and match performance drive a card economy of packs, collecting and
trading. It is a tool in the [VibeTrunk](https://vibetrunk.com) hub; add no
coupling to `VibeTrunk/home` beyond the shared Supabase project.

- Stack: Next.js and TypeScript on Vercel (project `kut`, live at
  `https://flut.vibetrunk.com`; `kut.vibetrunk.com` redirects, ADR-139).
- Backend: the shared VibeTrunk Supabase project, schema `kut` (not `public`).
  Row-level security is on for every table; the browser never talks to Postgres.
- Economically valuable operations (pack opening, discard, market, starter
  grant, attendance rewards) are server-authoritative: validated database
  functions or Edge Functions, never client writes to `wallets`, `user_cards`
  or `market_listings`.
- A deliberate learning project in production-grade practice: clear structure,
  decisions recorded in markdown.
- Latest hosted migration: `20261019000000_basic_pack_price_250.sql` (ADR-136).
  The `VibeTrunk/supabase` catalogue is the hosted history.

## Reading: grep on demand

Start from `docs/PRODUCT.md`: per area, what the game does now and where it
lives. The old spec, delivery log, roadmap, bug register and ADR-001 to ADR-141
are at the git tag `docs-archive-2026-10`. Never read them in full; grep the
one you need. A `BUILD_SPEC §N` or old `ADR-NNN` in the code resolves this way:

```powershell
git show docs-archive-2026-10:docs/BUILD_SPEC.md | rg "^## 44\."
git show docs-archive-2026-10:docs/archive/decisions-2026.md | rg "ADR-099"
```

Security and data integrity win over convenience, and the Part L invariants in
`docs/INVARIANTS.md` must never be violated. Changing a game rule, database
invariant, public API or acceptance criterion means updating `docs/PRODUCT.md`
and recording it in `docs/decisions.md`. Never silently "improve" a formula.

## Commands

- `npm run verify:fast`: policy and doc-size checks, format, lint, typecheck,
  unit tests (about 1 min locally). Run it once per round of changes; CI runs
  the database, integration and browser suites.
- `npm run dev`, `build`, `format`, `policy:sync`. Optional locally, against
  the local Supabase stack: `test:db`, `test:integration`, `test:e2e:authenticated`.
- Local stack: project id `kut`, started and stopped by the `kut-up` and
  `kut-down` profile commands. `supabase db reset` is deny-listed, so apply a
  migration or run pgTAP with `docker exec supabase_db_kut psql`. Fixtures
  create and delete real rows, so they refuse any non-loopback target.

## Workspace and branches

- Work only in `C:\Users\mfvan\dev\kut` (and `C:\Users\mfvan\dev\supabase`);
  the old OneDrive checkout is frozen until S8. One agent per checkout; a
  second agent gets a `git worktree` under the ignored
  `.release-evidence/worktrees/` and merges into the PR branch.
- `main` is protected. Branch (`feat/`, `fix/`, `docs/`, ...) and open a PR; the
  owner reviews and squash-merges unless they delegate it. Branches
  auto-delete on merge. Use conventional commit prefixes (`feat:`, `docs+fix:`).
- Never commit, push, deploy or mutate hosted state without authorization for
  this change. "Publish this slice" covers committing, pushing and its PR;
  local implementation permission does not. Don't re-ask for covered steps.
- Independent slices branch from `main`; never stack a migration on a frontend
  branch. Repair a dependent stack by merging updated `origin/main` into it,
  never by force-pushing.
- Batch docs, issue filings, small UI fixes and chores freely. A migration, a
  Part L invariant or an RPC contract change gets a PR of its own.
- The agent that packages a PR reads `git diff main...HEAD` in full first.
- After publication, bring the checkout onto current main. Preserve unpublished
  work first (a named stash or a `tidy` archive); never reset or discard.

## Release

A merge to `main` deploys to production through Vercel's Git integration
(ADR-140); `docs/RELEASING.md` has the read-only check and rollback. The merge
authorizes nothing else: migrations, function deployments, secrets, branch
protection and other hosted changes need their own written instruction.

## Migrations and database

- Hosted migrations are catalogued and applied only from
  [`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase); Supabase keeps
  one global history. This repo keeps matching SQL for local use and tests.
  Never run a hosted `supabase db push` from here.
- Existing migrations are immutable. A change adds at most one migration plus a
  database test or reviewed exemption; CI's `migrations` job enforces it (ADR-070).
- New code degrades gracefully against the old schema (a tolerant read, a flag,
  or a catalogue push ready to follow the merge). PR #86 broke listing creation
  for 2 hours by expecting a signature that wasn't live yet.
- Views only gain columns, at the end; pages read them with `select("*")`.
- A denied read returns zero rows, not an error. The ADR-079 member projections
  need `kut.is_active_member()`, so in a `postgres` session run
  `set role service_role;` first. After an access change, smoke-test as a member.
- Never flip a definer projection to `security_invoker = true` to please the
  Security Advisor; doing so blacked out the Chronicle (KB-013).
- Anything data-changing gets a fresh cold-verified backup first.
- **Start-up check:** run `gh run list -w backup.yml -s success -L 1 --json createdAt`
  and warn the owner if the last success is over 36 hours old (ADR-141,
  `docs/BACKUP.md`). A scheduled run can fail to start without any email.

## Agent safety

- Hooks in `.claude/` and `.codex/` block destructive commands. What they
  enforce is non-negotiable; changing a guard needs a PR the owner asked for.
  Codex rules need the repo to be trusted.
- Never auto-allowed: `git commit`, `git push`, `supabase functions deploy`,
  `supabase db push` (real), `db reset` and `secrets set`. Read-only
  `migration list` and `db push --dry-run` are allowed.
- Dependabot waits 5 days after a release (ADR-142); review any manual install
  in its PR diff.
- Deleting, by tier (ADR-142):
  - Tracked files: delete freely in a PR; Git history keeps them.
  - Local Git state (branches, worktrees, stashes): only `node scripts/tidy.mjs`.
    Its dry run lists everything; `--apply`, as the first argument, bundles and
    proves the items before removing them. Each apply is the owner's approval
    of that exact command.
  - Untracked or ignored files: inspect them, then move them to the archive
    with the owner's OK. Never delete them.
  - Remote branches: `tidy --remote`, with the owner's approval.
  - Hosted data: the owner only.

## Documentation map

The PR description is the narrative, `docs/PRODUCT.md` the current state,
`docs/decisions.md` the rules, GitHub issues the open work (labels bug, idea,
next, ops) and archive tags the history. `docs/README.md` lists every doc;
`npm run policy:check` enforces their size limits.

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
