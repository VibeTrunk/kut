@AGENTS.md

# Claude-specific notes

- Permissions and hooks for Claude live in `.claude/settings.json` and
  `.claude/hooks/`; the Codex equivalents are under `.codex/`.
- Commands you hand to the owner to run themselves use PowerShell syntax. Your
  own shell tool is unaffected by this.
- Your memory index (`MEMORY.md`) is loaded at start-up. Treat it as background:
  verify any file, flag or path it names before recommending it.
- Model hint (Pro plan): Sonnet for S0, S1, S6 and S8 of the process reset;
  Opus for S2–S5, S7 and S9.

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
