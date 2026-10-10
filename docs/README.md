# FLUT documentation map

Agents do not read these in full. Start from `AGENTS.md` and grep the doc you
need for the area you are changing.

| Doc                                           | What it is                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `PRODUCT.md`                                  | Current behaviour per area: the rules, their Part L items, where they live. Start here.       |
| `INVARIANTS.md`                               | Part L: the 28 invariants that must never be violated.                                        |
| `decisions.md`                                | Current ADRs (ADR-140 onward), including deletion tiers and `tidy` (ADR-142).                 |
| `RELEASING.md`                                | Merge-to-deploy flow, the check afterwards, and rollback (ADR-140).                           |
| `OPERATIONS.md`, `BACKUP.md`                  | Runbooks: hosted migrations (ADR-032), alpha ops, encrypted backups and restore.              |
| `SECURITY_REVIEW.md`                          | The MVP-era security review. A reference, not a runbook.                                      |
| `RATING_BALANCE_REVIEW.md`                    | Point-in-time analysis behind the ADR-063 rating balance.                                     |
| `design/`, and `../design/README.md`          | Rendered mockups and the design packages' decisions.                                          |

**Archive.** The build spec, delivery log, release log, roadmap, bug register,
ADR-001 to ADR-141, the old plans and session prompts, and the design canvas
sources are at the git tag `docs-archive-2026-10`. Read one with
`git show docs-archive-2026-10:<path>`, for example
`git show docs-archive-2026-10:docs/BUILD_SPEC.md`. A `BUILD_SPEC §N` or an
old `ADR-NNN` mentioned anywhere resolves there.

**Open work** (ideas, defects, operations) is GitHub issues, with the labels
`bug`, `idea`, `next` and `ops`. Process-reset state is VibeTrunk/kut#212.

Root docs: `AGENTS.md` (canonical agent instructions), `CLAUDE.md` (imports
it), `README.md` (intro and local development), `SECURITY.md` (disclosure).
`npm run policy:check` keeps `PRODUCT.md`, `decisions.md` and the agent start-up
files within their size limits (ADR-142).
