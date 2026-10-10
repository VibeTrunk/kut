# Releasing FLUT

A merge to `main` is the release: Vercel's Git integration deploys it to
production (ADR-140). There is no local gate and no deployment record.

## Flow

1. **PR.** Work on a branch and open a PR. `verify` and `gitleaks` run on it.
   Branch protection requires `merge-gate` and `scan`, and the branch must be
   up to date with `main`. The dependency audit (`npm audit --omit=dev
   --audit-level=high`) stays blocking; an exception is a narrow decision
   recorded in that PR.
2. **Preview.** Vercel builds a preview of every PR. For share, canvas or touch
   work, open the preview on an iPhone before merging: CI runs Chromium only,
   and WebKit runs only in the manual `e2e-webkit` workflow.
3. **Merge.** The owner squash-merges. The merge authorizes this deployment and
   nothing else: migrations, function deployments, secrets, branch protection
   and other hosted changes each need their own explicit yes.
4. **Check, read-only.** Vercel records each production deployment on GitHub:

   ```powershell
   gh api "repos/VibeTrunk/kut/deployments?environment=Production&per_page=1" --jq '.[0].sha'
   curl.exe -sI https://kut.vibetrunk.com/market | Select-String '^(HTTP|location)'
   ```

   The first must print the merge SHA; the second a 307 to the same path on
   `https://flut.vibetrunk.com` (ADR-139).

## Rollback

- **Vercel Instant Rollback** (dashboard: Deployments, the previous production
  deployment, Instant Rollback) puts the previous build back in seconds. It
  changes only the app, **not Supabase state**: a migration stays applied.
- After a rollback, automatic production assignment is **off**: later merges
  build but do not go live until you promote one or undo the rollback.
- Hobby can only roll back to the immediately previous production deployment.
  For anything older, revert the PR on `main` through a new PR.

## Migrations

Hosted migrations are applied only by the `apply-migrations` workflow in
`VibeTrunk/supabase` (ADR-144). The app must work against both the old and the
new schema, which keeps the order safe if anything stalls between steps 4
and 5. The required `catalogue-parity` check passes only once the catalogue
has the file, so the order is:

1. The kut migration PR's database tests are green. `catalogue-parity` is
   red, so `merge-gate` is not green yet.
2. The catalogue PR in `VibeTrunk/supabase` (the file copied unchanged) is
   merged.
3. Rerun the failed jobs on the kut PR; now every required check is green.
4. Start a fresh backup, then dispatch the workflow with the catalogue's main
   SHA and the kut PR's head SHA. Approve once to see the plan, check the
   list, then approve the apply:

   ```powershell
   gh workflow run backup.yml -R VibeTrunk/kut
   gh workflow run apply-migrations.yml -R VibeTrunk/supabase `
     -f catalogue_sha=$(gh api repos/VibeTrunk/supabase/commits/main --jq .sha) `
     -f kut_ref=$(gh pr view <PR> -R VibeTrunk/kut --json headRefOid --jq .headRefOid)
   ```

5. Merge the kut PR (auto-deploys), and bump "Latest hosted migration" in
   `AGENTS.md` in the next PR. `docs/OPERATIONS.md` has the risk tiers and the
   smoke check.
