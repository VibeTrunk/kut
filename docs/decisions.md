# Decisions — FLUT

Record an ADR only for a game, economy, schema or security rule, in about 20
lines at most: context, decision, consequences. Newest at the bottom; numbering
continues from ADR-142.

ADR-001 to ADR-141 are at the git tag `docs-archive-2026-10`; read them with
`git show docs-archive-2026-10:docs/archive/decisions-2026.md | rg "ADR-099"`.
The two ADRs below are still in force, in their current form.

## ADR-140 — Process reset: merge to main deploys

Date: 2026-10-09, extended 2026-10-10 by S4 (VibeTrunk/kut#212). The original
text, with the transition rules S1–S3 ran under, is at the tag `docs-archive-2026-10`.

- A merge to `main` deploys to production through Vercel's Git integration.
  PR validation is the release check: `merge-gate` and `scan`, with the branch
  up to date. The CI authenticated E2E job (S2) replaced the local gate's
  browser run. Accepted: Vercel does not wait for the main-branch CI run.
- The merge authorizes that deployment only. No deployment records are kept.
  `docs/RELEASING.md` has the flow and the rollback.
- Superseded: ADR-071 (the fail-closed release gate), ADR-108 (the gate in the
  owner's session), ADR-123 (held main deployments), ADR-124 (merge authorizes
  a gated release), the deployment-record part of ADR-126 (full main CI stays),
  and ADR-128 to ADR-134 (gate checkout, preflight, E2E progress, release
  steps, release preparation, share-matrix attribution, Topic A monitoring).
- ADR-135 (cleanup) and the 14-day package-age rule were replaced by ADR-142.

## ADR-141 — Nightly encrypted kut backup in GitHub Actions, kut only

Date: 2026-10-09 (S3 spike, VibeTrunk/kut#212). Full text at the tag `docs-archive-2026-10`.

- No read-only role can read the auth tables on hosted (`postgres` has no grant
  option on schema `auth`), so the backup covers schema `kut` only, like the old
  local backup. Member accounts are not backed up.
- `.github/workflows/backup.yml` runs nightly at 03:17 UTC as the read-only
  `kut_backup` role through the Session pooler. A privilege audit and a
  denied-insert check come first; the role never holds write or migration
  rights, and the `postgres` credential never goes into GitHub.
- The dump and its manifest come from one snapshot, are age-encrypted to the
  owner's key and kept 30 days. A restore check in a disposable `kut_restore`
  stack must match the schema and row counts and sign a stand-in member in.
- Six PUBLIC-executable `kut` SECURITY DEFINER functions are reviewed
  exceptions in the audit. Revoking them is a later migration.
- The old local backup stays in use until the owner's drill and a scheduled run
  have passed; then a follow-up PR retires it.

## ADR-142 — Archive-first tidy, deletion tiers and doc size limits

Date: 2026-10-10 (process reset S7, VibeTrunk/kut#212). Supersedes ADR-135 and
the 14-day package-age hook.

- Local Git state (branches, worktrees, stashes) is removed only by
  `node scripts/tidy.mjs`. Its dry run inventories from Git alone. `--apply`
  bundles every selected item, proves the bundle in an empty repository,
  rechecks each SHA and removes only unchanged items. Dirty worktrees are
  refused; untracked and ignored files are listed, never deleted.
- Agents run the dry run only: both hooks deny `tidy --apply`, and the owner
  runs the printed line (`--apply` first, with the dry run's SHAs) in their own
  terminal. Codex hooks can only allow or deny, so this is the one route that
  behaves the same in both agents (ADR-143). The ask and prompt rules stay as a
  fallback. Direct `git branch -D`, `worktree remove` and `push --delete` stay
  blocked. Accepted residual risk: an agent with a shell isn't fully
  containable; the archive makes mistakes recoverable.
- Tiers: tracked files are deleted freely in a PR; untracked or ignored files
  move to the archive with the owner's OK; remote branches need
  `tidy --remote` and approval; hosted data is owner-only.
- Dependabot version updates wait 5 days (`cooldown`); security updates are
  exempt and manual installs are reviewed in the PR diff.
- `npm run policy:check` enforces size limits: PRODUCT.md 25 KB, decisions.md
  30 KB with 25 lines per ADR, AGENTS.md + CLAUDE.md 11 KB.

## ADR-143 — One safety system for Claude and Codex

Date: 2026-10-10 (S7 live tests, VibeTrunk/kut#212).

- Both agents run the same hook script (`block-dangerous-commands.cjs`, one
  copy per agent, kept identical by a unit test). A command it denies is
  blocked in both; this is proven live in each agent.
- Codex setup on the owner's machine: the repo's hook trusted in Settings →
  Hooks (again after any change to `.codex/hooks.json`), `approval_policy =
  "on-request"` with `approvals_reviewer = "user"`, and Codex started at the
  repo root (the hook path is relative).
- Codex limits, from its docs: a hook can only allow or deny, never ask; a hook
  that crashes or times out lets the command through. Hooks are a guardrail,
  not a complete boundary. The Windows launcher is therefore a plain `node`
  command, and a unit test runs it exactly as written.
- Codex's `prompt` rules did not stop commands in the extension. In practice,
  Codex commits and pushes reach the owner because the sandbox can't write
  `.git` and has no network, so Codex must ask to run them outside it.
  Approving "always" removes that check.
