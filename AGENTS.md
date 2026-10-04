# AGENTS.md

This file provides guidance to ChatGPT and Codex when working with code in this repository.

## Canonical project guidance

Before doing repository work, read [`CLAUDE.md`](CLAUDE.md) in full and follow it as project guidance. It is the canonical description of the project, its status, and the wider VibeTrunk ecosystem.

Do not duplicate that guidance here: keeping a single canonical project description prevents Claude and Codex instructions from drifting apart. If the project changes, update `CLAUDE.md`; this file will continue to direct Codex to it.

The generated safety block below is the sole exception: it must be present in
both agent entry points because either file may be loaded first.

<!-- BEGIN:KUT-PRODUCTION-INVARIANTS -->
## Production-safety invariants

This block is generated from `policy/PRODUCTION_INVARIANTS.md`. Run
`npm run policy:sync` after changing the source; CI rejects drift.

- Never output secrets or reversible encodings of secrets.
- One migration- or invariant-bearing feature is allowed per PR or independently reviewable change slice.
- Never deploy when a required release gate has not run successfully for the exact candidate SHA.
- Never declare an encrypted backup successful unless its credential is durably retrievable and an independent recovery check passes.
- The owner's merge of a reviewed PR into main authorizes release and Vercel production deployment of that exact resulting SHA, conditional on the full production gate passing first. The agent runs the gate, records approval, asserts evidence and deploys without another confirmation. This does not authorize migration application, Supabase function deployment, branch-protection changes, secret changes or other external mutations.
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

## Codex-specific safety and permissions

- Repository-local Codex hooks and command rules live under `.codex/` and require the repository to be trusted. Standard VibeTrunk scaffold — see global `~/.codex/AGENTS.md` for the agent safety policy and push/deployment discipline these hooks and rules enforce.
- Normal `git push`, `npm run *`, and `gh ...` commands are allowed by the repository command rules.
- Never run a `vercel deploy`/`vercel --prod` unless explicitly asked.
- This same pattern (`.claude/`, `.codex/`, `AGENTS.md`, gitleaks CI) is the template for every VibeTrunk-org repo — copy it into new tool repos and adapt only the stack-specific command lists.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
