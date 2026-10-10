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
