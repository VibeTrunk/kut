# Kelderklasse Ultimate Team (KUT) — Project Context

## What this is
KUT (working title "TFH Ultimate Cards" in the build spec) is a browser-based
collectible football-card game for Terrible Football Haarlem (TFH): real
attendance and match performance drive a card economy players collect, open
packs of, and trade with each other. It is a tool in the
[VibeTrunk](https://vibetrunk.com) hub — see
[VibeTrunk/home](https://github.com/VibeTrunk/home) for the landing page and
the wider ecosystem context. The canonical, exhaustive product and technical
specification lives in [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) — read it
in full before implementing anything; this file is orientation, not a
substitute.

<!-- BEGIN:KUT-PRODUCTION-INVARIANTS -->
## Production-safety invariants

This block is generated from `policy/PRODUCTION_INVARIANTS.md`. Run
`npm run policy:sync` after changing the source; CI rejects drift.

- Never output secrets or reversible encodings of secrets.
- One migration- or invariant-bearing feature is allowed per PR or independently reviewable change slice.
- Never deploy when a required release gate has not run successfully for the exact candidate SHA.
- Never declare an encrypted backup successful unless its credential is durably retrievable and an independent recovery check passes.
- Production release approval never authorizes deployment, migration application, branch-protection changes, secret changes, or any other external mutation. Each needs a separate explicit instruction.
- Hosted Supabase migrations are applied only from `VibeTrunk/supabase`, never from this repository. Existing migration files are immutable; a change may add at most one migration and must include a database test or reviewed machine-readable exemption.
- A production candidate is one exact 40-character commit SHA. Every gate artifact and external check must name that SHA; skipped, stale, cancelled, missing, or mismatched evidence fails closed.
- Production-sensitive agent sessions start through the repository launcher. Codex uses `gpt-6-astra` with high reasoning when available, otherwise `gpt-5.6-sol` with high reasoning; Claude uses Opus. Session hooks record what they can actually observe: Codex does not expose reasoning effort, and Claude Code sends a model to `SessionStart` only sometimes and cannot abort a session there. Evidence says which checks were attested and which are launcher-enforced, and the gate fails closed on anything it cannot establish.
- Committing, pushing, and deploying are per-change authorization decisions, never standing permissions. No agent rule set auto-allows `git commit`, `git push`, or a Supabase function deployment.
- Database-backed test fixtures create and delete real rows and users. They refuse any non-loopback target unless an operator sets the explicit acknowledgement variable, which CI and every repository script leave unset.
- Production credentials are retrieved by stable locator from the Windows DPAPI store under `%LOCALAPPDATA%\VibeTrunk\kut\credentials`. `.env.local` is an explicit, interactive bootstrap source only and is never a runtime fallback.
- Backup plaintext and database passwords never appear in process arguments or durable logs. Encryption and cold verification run in separate child processes that independently retrieve credentials.
- A backup becomes final only after a separate-process decrypt produces the expected plaintext SHA-256. Failure removes only the new pending candidate and never overwrites or bulk-deletes existing backups.
- Rekeying always writes a new staged candidate. It verifies old and new plaintext hashes in separate processes and never overwrites the source backup.
- The release gate is fail-closed and does not deploy. It requires the merge gate, secret scan, dependency scan, database and concurrency suites, authenticated mobile E2E, finalizer readiness, migration/catalogue parity, a cold-verified backup, and valid agent-session evidence.
- Every game/economy invariant in `docs/BUILD_SPEC.md` Part L remains part of the canonical product regression checklist and must stay true.
<!-- END:KUT-PRODUCTION-INVARIANTS -->

## Status so far
- **Repo:** feature-complete MVP built and committed; see "Current hosted
  deployment" below for what's live.
- **Branch workflow:** GitHub branch protection on `main` is enabled
  (2026-08-23) — direct pushes are rejected, even for admins. All changes
  go through a feature branch and PR, squash-merged, branch auto-deleted on
  merge. See the global CLAUDE.md's "Branch workflow" section for the
  session-level conventions (branch naming, who merges).
- **Batching agent work into one PR:** Claude Code and Codex often contribute
  to the same branch, and whichever agent pushes packages the lot into a
  single PR. That is the intended default — a full `verify` round costs
  minutes — but squash-merge means one PR becomes exactly one commit on
  `main`, so batching spends revert and `git bisect` granularity to buy it.
  Therefore:
  - **Batch freely:** docs, `KNOWN_BUGS.md` registrations, independent small
    UI/layout fixes, chores. Use a combined prefix (`docs+fix:`), as #42 did.
  - **Never batch:** anything carrying a `supabase/migrations/*.sql`, or any
    change to a Part L invariant or an RPC contract. Hosted migrations are
    deployed separately from `VibeTrunk/supabase`, so a bundled PR cannot be
    reverted without dragging unrelated work with it while the hosted schema
    stays migrated. One such change per PR. Since ADR-070 this is enforced
    mechanically: the `migrations` job in `.github/workflows/verify.yml`
    rejects any modification/deletion/rename/copy of an existing migration,
    permits at most one newly added `supabase/migrations/*.sql`, and requires a
    changed database test or reviewed machine-readable exemption. There is no
    label override.
  - **Never run two agents in one working tree.** Each holds stale file state
    and they will silently clobber each other. Serialize them on the branch,
    or give each its own `git worktree` and merge into the PR branch.
  - **The packaging agent reads `git diff main...HEAD` in full** before
    writing the PR body — not only its own changes.
- **Vercel:** connected as project `kut` at `kut.vibetrunk.com`.
- **Supabase:** uses the shared VibeTrunk Supabase project, schema `kut`
  (not `public`); the hosted schema is created and migrated — see below.

## This repo's job
Own KUT end to end, per `docs/BUILD_SPEC.md`: the Next.js/TypeScript
frontend, the Supabase backend (migrations, RLS policies, RPC/Edge
Functions for atomic economy operations), and its deployment as the `kut`
Vercel project on the `kut.vibetrunk.com` subdomain. `VibeTrunk/home` knows
nothing about this repo beyond its name, blurb, and URL — keep it that way;
don't add cross-repo coupling beyond the shared Supabase project.

## Current hosted deployment

KUT is live at `https://kut.vibetrunk.com` as Vercel project `kut`.

**Latest hosted migration:** `20261004000000_archetype_cooldown.sql`
(ADR-094), pushed 2026-09-25; `migration list --linked` showed 74
entries, all present locally and remotely, no drift. Every hosted deploy, with its backup,
smoke test and rollback, is in [`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md).

Lessons that hold for every migration-bearing change:

- **Vercel deploys on merge to `main`, before the schema push.** New code must
  degrade gracefully against the old schema (a tolerant read, a flag, or a
  catalogue push ready to follow the merge). PR #86 broke listing creation for
  ~2 hours by expecting a signature that didn't exist yet.
- **Views only ever gain columns at the end.** `create or replace view` cannot
  reorder or drop columns, and pages read the changed views with `select("*")`
  so they work before and after the push.
- **A denied read returns zero rows, not an error.** The ADR-079 member
  projections are gated on `kut.is_active_member()`, which is false for a bare
  `postgres` session: run `set role service_role;` first, or an ad-hoc query
  looks exactly like data loss. After any access change, smoke-test as an
  ordinary member; the failure mode is an empty screen.
- **Never flip a definer projection to `security_invoker = true`** to satisfy
  the Security Advisor. These are deliberate cross-RLS club projections, and
  that is how KB-013 blacked out the Chronicle.
- **The backup tier follows what the migration *can* do**, not what it happens
  to do on the day: anything data-changing gets a fresh cold-verified backup.

Supabase records migration history globally for the shared database, not per
schema. Hosted migrations are therefore catalogued and deployed only from
[`VibeTrunk/supabase`](https://github.com/VibeTrunk/supabase). This repository
keeps matching SQL files for local Supabase development and database tests;
never run a hosted `supabase db push` from here.

Before writing code in a new session, read (in order): `docs/README.md` (the
documentation map — what every doc is for), `docs/BUILD_SPEC.md`,
`docs/PROGRESS.md`, `docs/decisions.md`, and recent git history; then
`docs/ROADMAP.md` for what is planned or parked and `docs/KNOWN_BUGS.md` for
open defects. The build spec asks for this same reading order (Part XXXI) and
lists the phased delivery plan (Part XXXIV) to follow slice by slice rather
than building everything at once. Forward-looking ideas belong in
`docs/ROADMAP.md` (ADR-045), not scattered across handoffs or the feedback
ledger.

## Backend model
All VibeTrunk tools share **one Supabase project**, each in its own Postgres
schema — this tool's is the `kut` schema. Row-level security is enabled on
every table; the browser never talks to Postgres directly. Per the build
spec (Part XX–XXIII), economically valuable operations (pack opening,
discard, market buy/sell, starter grant, attendance rewards) must be
server-authoritative — implemented as tightly validated database functions
or Edge Functions, never as direct client writes to `wallets`, `user_cards`,
or `market_listings`.

## Working style
Same as `VibeTrunk/home`: this is partly a deliberate learning project in
production-grade practices, not just a quick hack — favor clear structure
and document decisions in markdown as you go (`docs/decisions.md`,
`docs/PROGRESS.md` per the build spec's Part XXXI).

The build spec is unusually prescriptive on purpose (Part I, §1): security
and data-integrity requirements win over convenience, the game-economy
invariants (Part L) must never be violated, and any agent that changes a
game rule, database invariant, public API, or phase acceptance criterion
must update the spec or record the deviation in `docs/decisions.md` — never
silently "improve" a formula.

## Agent safety
Standard VibeTrunk scaffold (see global CLAUDE.md's agent safety policy) —
PreToolUse hooks block destructive commands and young (<14-day) npm
packages; see `AGENTS.md` and `.claude/settings.json` /
`.codex/rules/project.rules` for exact allow/deny lists. This scaffold was
generated by the `vibetrunk-new-tool` skill from the template
`VibeTrunk/home` established, and copied into `VibeTrunk/cogitster` before
that.

Live-mutating Supabase CLI commands (`supabase db push` for real, `supabase
db reset`, `supabase secrets set`) are intentionally **not** auto-allowed —
they change the live schema or rotate live credentials for every VibeTrunk
tool sharing this Supabase project, so each use should get a deliberate look
rather than running unattended. Genuinely read-only commands (`supabase
migration list`, `supabase db push --dry-run`) are allowed.

`supabase functions deploy` is **not** in that read-only set, and since
ADR-071 is no longer auto-allowed: it ships code to the shared hosted project,
so being reversible does not make it unattended. `git commit` and `git push`
are likewise no longer auto-allowed in either rule set. A standing permission
is not per-change authorization — conflating the two is how one session
produced a 140-file, 14-migration commit — so each of these now surfaces an
approval prompt. Direct pushes to `main` are denied outright; branch
protection rejects them anyway.
