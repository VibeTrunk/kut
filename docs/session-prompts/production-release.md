# Production release session

This session gathers evidence and may record release approval; it never deploys.
Use one exact 40-character candidate SHA. Require a clean checkout, fresh
successful GitHub checks, immutable migration and catalogue parity, dependency
and secret scans, database/concurrency and finalizer proof, authenticated
member/admin mobile E2E, and a separately cold-verified encrypted backup.

Run `scripts/release/request-production-gate.ps1`. Treat every missing, skipped,
cancelled, stale, duplicated, or SHA-mismatched item as failure. If the owner
explicitly approves release, use `approve-production-release.ps1`; record that
deployment remains unauthorized. Never run Vercel, Supabase push, git push,
merge, branch-protection, secret, or production-data commands without a new and
specific instruction.

Before relying on the exact-squash-SHA workflow, confirm the separately
authorized `vercel.json` main-deployment hold has been published and the Git
integration honors it. The prepared local rule alone is not proof of cutover.
After an authorized merge, gate the final SHA before any deployment. The gate
builds an owned production server, refuses reuse, runs all authenticated
projects without retries and retains first-failure diagnostics. On failure,
diagnose a focused case before another full run; do not change CI/server mode
or substitute a targeted pass. Gate evidence must be version 2 with intact
nested E2E artifacts. Reassert freshness and integrity after release approval.
