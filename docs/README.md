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

For the next five-feature build session, follow
[`IMPLEMENTATION_PLAN_NEXT_FEATURES.md`](IMPLEMENTATION_PLAN_NEXT_FEATURES.md).
[`START_NEXT_FEATURES.md`](START_NEXT_FEATURES.md) contains the copy-paste
starting prompt for 5.6 Terra / High and the files that must accompany it.

## What each document is for

| Document | Role | Update it when |
|---|---|---|
| `BUILD_SPEC.md` | The canonical spec: product vision, game model, rating engine, DB model, RLS, RPC contracts, critical invariants (Part L), phased delivery. | A game rule, invariant, public API, or acceptance criterion changes — here **and** as an ADR. |
| `PROGRESS.md` | Chronological build log — one dated entry per shipped slice, with verification results and hosted-deploy status. | End of every session that ships something. |
| `decisions.md` | ADR log — why the code looks the way it does. `## ADR-NNN — title`, newest at the bottom. | Any architecture or game-behaviour decision. |
| `ROADMAP.md` | Everything **not yet built**: ideas, planned phases, blocked items, spec-defined future scope — each with a status. | An idea is raised, promoted, shipped, or declined. |
| `RATING_BALANCE_REVIEW.md` | Reproducible comparison of the proposed goals/kudos caps and decay against the actual current engine, synthetic participation scenarios and 50-coin reward implications. | Rating or reward proposals change. |
| `IMPLEMENTATION_PLAN_NEXT_FEATURES.md` | Execution guide for building all five designed features in one session: code/SQL map, ordered slices, contracts, history/reward handling, mobile acceptance, tests and operator handoff. No implementation or deployment yet. | Implementation progresses or a dependency/decision changes. |
| `START_NEXT_FEATURES.md` | Copy-paste prompt and required workspace artifacts for the next 5.6 Terra / High session. | The implementation scope or entry point changes. |
| `SPEC_NEXT_FEATURES.md` | Reviewable design for wanted-card availability, Special scaffolding only, self-reported goals/kudos with a 50-coin completion reward and admin reporting tools, 175-coin packs, and duplicate-sensitive Club Value; paired with `design/features/` interactive screens and `docs/design/features/` renders. Proposed rules, not shipped behavior. | This feature design changes or an implementation ADR adopts/revises part of it. |
| `design/` | Rendered mockups (PNG, desktop + mobile) for the album, Chronicle and rating history, with an index mapping each to its route and spec section. Kept as the record of what was designed; all three shipped 2026-09-02, so the built app and `BUILD_SPEC.md` now win over the mockups. | The designs change. |
| `KNOWN_BUGS.md` | Defects in shipped behaviour that aren't fixed yet — `KB-NNN` rows with a status. | A bug is reported or fixed. |
| `TESTER_FEEDBACK_BATCHES.md` | Raw tester-feedback ledger: what was reported each round, de-duplicated, and what each item became (→ ADR / → KB / → ROADMAP / declined). | New feedback arrives and is triaged. |
| `OPERATIONS.md` | Live runbook: shared-migration authority, the risk-tiered hosted-migration checklist (ADR-032), preview-deploy preflight, alpha ops. | The deploy or migration process changes. |
| `LAUNCH_PLAN.md` | The go-live checklist for opening KUT from the closed alpha to all of TFH: the decisions taken (§0, ADR-050), auth and backup prep, the roster rule for joiners, no account reset, what to do if something breaks, and the day-by-day sequencing. Extends `OPERATIONS.md`. | An item lands, or the plan changes; retire it once go-live is recorded in `PROGRESS.md`. |
| `BACKUP.md` | Live runbook: taking an encrypted `kut`-schema backup, and the restore drill. | The backup tooling or cadence changes. |
| `SECURITY_REVIEW.md` | Point-in-time security / integrity review (MVP era). A reference, not a runbook. | A fresh review pass is done. |
| `archive/` | Superseded one-time documents, kept for history: the 2026-08-17 handoff, the MVP hardening plan, and the design spec + build plan for the rating graph / album / Chronicle (all three shipped 2026-09-02 — `BUILD_SPEC.md` and the ADRs are canonical now). | Never — archival only. |

## Root-level docs

- `CLAUDE.md` — project context for agents (canonical)
- `README.md` — repo intro + local development
- `AGENTS.md` — Codex pointer to `CLAUDE.md` + Codex-specific safety
- `SECURITY.md` — vulnerability disclosure policy
