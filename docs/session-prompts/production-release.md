# Production release session

This session gathers evidence and may record release approval; it never deploys.
Start through a production launcher. Use one exact 40-character candidate SHA.
Require a clean checkout, fresh successful GitHub checks, immutable migration
and catalogue parity, dependency and secret scans, database/concurrency and
finalizer proof, authenticated member/admin mobile E2E, a separately cold-
verified encrypted backup, and hook-verified agent-session evidence.

Run `scripts/release/request-production-gate.ps1`. Treat every missing, skipped,
cancelled, stale, duplicated, or SHA-mismatched item as failure. If the owner
explicitly approves release, use `approve-production-release.ps1`; record that
deployment remains unauthorized. Never run Vercel, Supabase push, git push,
merge, branch-protection, secret, or production-data commands without a new and
specific instruction.
