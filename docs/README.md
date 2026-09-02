# KUT documentation map

Start-of-session reading order (same as `CLAUDE.md`):

1. `CLAUDE.md` (repo root) — project orientation and current hosted state
2. `BUILD_SPEC.md` — canonical product & technical specification
3. `PROGRESS.md` — dated delivery log (newest entry at the bottom)
4. `decisions.md` — architecture / game-rule decisions (ADR log)
5. recent `git log`

Then, as needed: `ROADMAP.md` for what's next, `KNOWN_BUGS.md` for open
defects, `LAUNCH_PLAN.md` before opening KUT up beyond the alpha testers, and
the runbooks below before any deploy or migration.

## What each document is for

| Document | Role | Update it when |
|---|---|---|
| `BUILD_SPEC.md` | The canonical spec: product vision, game model, rating engine, DB model, RLS, RPC contracts, critical invariants (Part L), phased delivery. | A game rule, invariant, public API, or acceptance criterion changes — here **and** as an ADR. |
| `PROGRESS.md` | Chronological build log — one dated entry per shipped slice, with verification results and hosted-deploy status. | End of every session that ships something. |
| `decisions.md` | ADR log — why the code looks the way it does. `## ADR-NNN — title`, newest at the bottom. | Any architecture or game-behaviour decision. |
| `ROADMAP.md` | Everything **not yet built**: ideas, planned phases, blocked items, spec-defined future scope — each with a status. | An idea is raised, promoted, shipped, or declined. |
| `SPEC_ALBUM_CHRONICLE_GRAPH.md` | Pre-ADR design spec for the rating history graph, the Panini collection album, and the TFH Chronicle — the agreed design their ADRs and `BUILD_SPEC.md` edits get written from. | A design decision in it changes before build. Archive it once all three have shipped. |
| `PLAN_ALBUM_CHRONICLE_GRAPH.md` | The build plan for those three: slice order, branch-by-branch work, tests, the one additive migration and when it must be deployed, and the traps. Read §0 before writing code. | A slice lands or the sequencing changes. Archive it with the spec. |
| `design/` | Rendered mockups (PNG, desktop + mobile) for the album, Chronicle and rating history, with an index mapping each to its route and spec section. The **visual** source of truth for that build; the spec still wins on rules. | The designs change. Archive with the spec and plan. |
| `KNOWN_BUGS.md` | Defects in shipped behaviour that aren't fixed yet — `KB-NNN` rows with a status. | A bug is reported or fixed. |
| `TESTER_FEEDBACK_BATCHES.md` | Raw tester-feedback ledger: what was reported each round, de-duplicated, and what each item became (→ ADR / → KB / → ROADMAP / declined). | New feedback arrives and is triaged. |
| `OPERATIONS.md` | Live runbook: shared-migration authority, the risk-tiered hosted-migration checklist (ADR-032), preview-deploy preflight, alpha ops. | The deploy or migration process changes. |
| `LAUNCH_PLAN.md` | The go-live checklist: what to settle before opening KUT from the closed alpha to all of TFH — SMTP, backups, roster rule, no account reset, sequencing. Extends `OPERATIONS.md`. | An item lands, or the plan changes; retire it once go-live is recorded in `PROGRESS.md`. |
| `BACKUP.md` | Live runbook: taking an encrypted `kut`-schema backup, and the restore drill. | The backup tooling or cadence changes. |
| `SECURITY_REVIEW.md` | Point-in-time security / integrity review (MVP era). A reference, not a runbook. | A fresh review pass is done. |
| `archive/` | Superseded one-time documents, kept for history: the 2026-08-17 handoff and the MVP hardening plan. | Never — archival only. |

## Root-level docs

- `CLAUDE.md` — project context for agents (canonical)
- `README.md` — repo intro + local development
- `AGENTS.md` — Codex pointer to `CLAUDE.md` + Codex-specific safety
- `SECURITY.md` — vulnerability disclosure policy
