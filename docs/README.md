# FLUT documentation map

Agents do not read these in full. Start from `AGENTS.md` and grep the doc you
need for the area you are changing.

| Doc                                         | What it is                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `PRODUCT.md`                                | Current behaviour per area: the rules, their Part L items, where they live. Start here. |
| `BUILD_SPEC.md`                             | The canonical spec. Part L holds the invariants that must stay true.               |
| `decisions.md`                              | Current ADRs (ADR-140 onward). ADR-001 to 141: `archive/decisions-2026.md`.        |
| `PROGRESS.md`                               | Dated delivery log, one entry per shipped slice.                                   |
| `ROADMAP.md`                                | Everything not yet built or declined, each with a status.                          |
| `KNOWN_BUGS.md`                             | Open and fixed defects as `KB-NNN` rows.                                           |
| `DEPLOYMENTS.md`                            | Release and migration log up to 2026-10-10; no new entries (ADR-140).              |
| `RELEASING.md`                              | Merge-to-deploy flow, the check afterwards, and rollback (ADR-140).                |
| `OPERATIONS.md`, `BACKUP.md`                | Runbooks: hosted migrations (ADR-032), alpha ops, encrypted backups and restore.   |
| `CLEANUP.md`                                | Owner-approved file removal and the guarded worktree workflow (ADR-135).           |
| `LAUNCH_PLAN.md`, `SECURITY_REVIEW.md`      | Go-live checklist and the MVP-era security review. References, not runbooks.       |
| `TESTER_FEEDBACK_BATCHES.md`                | Tester feedback ledger and what each item became.                                  |
| `RATING_BALANCE_REVIEW.md`, `BUG_FIX_PLAN.md` | Point-in-time analyses behind rating and bug-fix decisions.                      |
| `design/`, `session-prompts/`, `archive/`   | Rendered mockups, bounded session prompts and handovers, superseded documents.     |

Root docs: `AGENTS.md` (canonical agent instructions), `CLAUDE.md` (imports
it), `README.md` (intro and local development), `SECURITY.md` (disclosure).
