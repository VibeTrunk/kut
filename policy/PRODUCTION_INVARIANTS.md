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
- The 23 game/economy invariants in `docs/BUILD_SPEC.md` Part L remain the canonical product regression checklist and must all stay true.
